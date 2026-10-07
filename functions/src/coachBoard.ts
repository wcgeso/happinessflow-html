import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room,PresenceState,GameState} from '../../src/types';
import {canSkipDisconnectedPlayer,getPresenceTimestamp,mapRealtimePresenceValue} from '../../src/utils/presence';
import {buildNextBoardTurnState,clearBoardFlowState,getNextBoardTurn} from '../../src/utils/experienceState';
import {applyBoardCommand} from '../../src/game/board/boardRevision';
import {isBoardPromptForCurrentEvent} from '../../src/game/board/promptCompletion';
import {cleanObject} from '../../src/utils/utils';
import {key} from './commands';
import {buildBoardCardResultById} from '../../src/game/board/movementResolution';
export type CoachBoardCommand={type:'skipDisconnectedTurn'|'skipDisconnectedSharedTarget'|'setCoachNextTurn'|'coachTestCard'|'coachReplayEvent'|'coachClearEvent'|'coachForceEnd';roomId:string;sessionId:string;commandId:string;playerUid:string;revision?:number;eventId?:string;promptId?:string;cardId?:string};
export function parseCoachBoardCommand(data:unknown):CoachBoardCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','執行師棋盤操作資料無效');
 const c=data as CoachBoardCommand,turn=c.type!=='skipDisconnectedSharedTarget',fields=['type','roomId','sessionId','commandId','playerUid',...(turn?['revision']:['eventId','promptId']),...(c.type==='coachTestCard'?['cardId']:[]),...(['coachReplayEvent','coachClearEvent','coachForceEnd'].includes(c.type)?['eventId']:[])];
 if(!['skipDisconnectedTurn','skipDisconnectedSharedTarget','setCoachNextTurn','coachTestCard','coachReplayEvent','coachClearEvent','coachForceEnd'].includes(c.type)||Object.keys(c).some(k=>!fields.includes(k))||fields.filter(k=>k!=='revision').some(k=>typeof c[k as keyof CoachBoardCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof CoachBoardCommand])))||(turn&&(!Number.isSafeInteger(c.revision)||c.revision!<0)))throw new HttpsError('invalid-argument','執行師棋盤操作欄位無效');
 return c;
}
// Presence is auxiliary: the Firestore transaction still fences the target turn/event.
export async function executeCoachBoardCommand(db:Firestore,c:CoachBoardCommand,uid:string,readPresence:(playerUid:string)=>Promise<PresenceState|undefined>,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.playerUid,c.revision??null,c.eventId??null,c.promptId??null,c.cardId??null]));
 return db.runTransaction(async tx=>{
  const snapshot=await tx.get(ref);if(!snapshot.exists)throw new HttpsError('not-found','房間不存在');const room=snapshot.data() as Room;
  if(uid!==room.hostId||!room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','只有本場執行師可以處理棋盤操作');
  if(room.sessionId!==c.sessionId||room.movementAuthority!=='server-movement-v1'||room.promptCompletionAuthority!=='server-prompts-v1'||room.bankingAuthority!=='server-banking-v1'||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection'||room.publicPlayerStorage!=='subcollection'||room.requiredClientProtocol!==1||room.isBoardGame!==true||room.isPractice)throw new HttpsError('failed-precondition','場次已更新或不是後端房間');
  const saved=await tx.get(intent);if(saved.exists){if(saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作不能更改棋盤處理內容');return {...saved.data()!.result,status:'duplicate'};}
  const board=room.boardState;
  if(room.status!=='playing'||!board||c.playerUid===room.hostId||!room.members?.some(m=>m.uid===c.playerUid&&!m.isLeft)||!board.turnOrder.includes(c.playerUid))throw new HttpsError('failed-precondition','玩家或遊戲階段已更新');
  if(c.type==='coachClearEvent'||c.type==='coachForceEnd'){
   if(board.revision!==c.revision||board.currentTurnUid!==c.playerUid||(board.currentEvent?.id||'none')!==c.eventId)throw new HttpsError('failed-precondition','回合或事件已更新，不能解除舊流程');
   if((board.pendingContinuation&&board.pendingContinuation.phase!=='completed')||board.familyMilestoneJoinPrompt||board.sharedCardPrompt)throw new HttpsError('failed-precondition','尚有待判定或共享流程，請接續原事件，不能強制清除');
   const events=[...(board.currentEvent?[board.currentEvent]:[]),...(board.pendingEvents||[]).map(entry=>entry.event)];
   if(events.length>32||board.turnOrder.length>6)throw new HttpsError('failed-precondition','流程資料超出可安全復原範圍');
   const ids=Array.from(new Set(events.map(event=>key(`${c.sessionId}:${event.playerUid}:${event.id}`))));
   const [requests,players,receipts,movements,prompts]=await Promise.all([
    tx.get(ref.collection('pendingRequests')),
    Promise.all(board.turnOrder.map(id=>tx.get(ref.collection('players').doc(id)))),
    Promise.all(ids.flatMap(id=>['bankSettlements','learningResults','serviceResults','happinessResults','opportunityResults','medicalCardResults'].map(name=>tx.get(ref.collection(name).doc(id))))),
    tx.get(ref.collection('movementTasks').where('status','in',['pending','scheduled'])),
    tx.get(ref.collection('promptFinalizationTasks').where('status','in',['pending','scheduled']))
   ]);
   if(requests.size||receipts.some(document=>document.exists)||players.some(document=>!document.exists||document.data()?.pendingCardAction||document.data()?.pendingFamilyMilestoneJoinAction||document.data()?.pendingStartupUpgradeAction||document.data()?.pendingStartupUpgradeActions?.length||document.data()?.schoolExam?.phase==='paid'))throw new HttpsError('failed-precondition','尚有已確認結果、玩家待辦或審核，請接續原流程，不能強制清除');
   const audit=ref.collection('boardRecoveries').doc(key(`${uid}:${c.commandId}`));
   let cleared=clearBoardFlowState(board,now);
   if(c.type==='coachForceEnd'){
    const turn=getNextBoardTurn(cleared);if(!turn)throw new HttpsError('failed-precondition','沒有可接續的玩家');
    cleared={...cleared,currentTurnUid:turn.nextUid,hasRolledThisTurn:false,skipTurns:turn.skipTurns,skippedTurnNotice:turn.skippedUids.length?{playerUids:turn.skippedUids,nextTurnUid:turn.nextUid,timestamp:now}:null};
   }
   const next=applyBoardCommand(cleared,c.commandId).boardState,result={status:'applied',playerUid:next.currentTurnUid,revision:next.revision,recoveryId:audit.id};
   tx.create(audit,cleanObject({uid,sessionId:c.sessionId,type:c.type,commandId:c.commandId,recoveredAt:now,boardBefore:board,result,cancelledTaskCount:movements.size+prompts.size}));
   for(const group of [movements,prompts])for(const document of group.docs){tx.create(audit.collection(document.ref.parent.id).doc(document.id),document.data());tx.update(document.ref,{status:'cancelled',cancelledAt:now});}
   tx.update(ref,{boardState:cleanObject(next)});tx.create(intent,{type:c.type,uid,sessionId:c.sessionId,fingerprint,result,completedAt:now});return result;
  }
  if(c.type==='coachReplayEvent'){
   if(board.revision!==c.revision||board.movement||board.currentEvent?.id!==c.eventId||board.currentEvent.playerUid!==c.playerUid||board.currentTurnUid!==c.playerUid)throw new HttpsError('failed-precondition','事件或回合已更新，不能重新顯示舊事件');
   // Re-display only: identity, payment receipts, dice, prompts and deadlines stay unchanged.
   const replayId=key(`${c.sessionId}:${uid}:${c.commandId}`);
   const next=applyBoardCommand({...board,currentEvent:{...board.currentEvent,presentationReplayId:replayId},updatedAt:now},c.commandId).boardState;
   const result={status:'applied',eventId:c.eventId,playerUid:c.playerUid,revision:next.revision,replayId};tx.update(ref,{boardState:cleanObject(next)});tx.create(intent,{type:c.type,uid,sessionId:c.sessionId,fingerprint,result,completedAt:now});return result;
  }
  let responseRef:import('firebase-admin/firestore').DocumentReference|undefined;
  if(c.type!=='skipDisconnectedSharedTarget'){
   if((c.type==='skipDisconnectedTurn'&&board.currentTurnUid!==c.playerUid)||board.revision!==c.revision)throw new HttpsError('failed-precondition','回合已更新，不能處理舊回合');
   // Explicit host turn changes reuse completion guards and waive only the unrolled requirement.
   try{buildNextBoardTurnState({...board,hasRolledThisTurn:true},board.currentTurnUid!,now);if(['setCoachNextTurn','coachTestCard'].includes(c.type)&&board.currentCard)throw new Error('目前卡片尚未完成');}catch(error){throw new HttpsError('failed-precondition',(error as Error).message);}
  }else{
   const prompt=board.sharedCardPrompt;
   if(!prompt||prompt.id!==c.promptId||prompt.sourceEventId!==c.eventId||!isBoardPromptForCurrentEvent(prompt,board)||prompt.responseStorage!=='subcollection'||!prompt.targetPlayerUids.includes(c.playerUid)||prompt.sourcePlayerUid===c.playerUid)throw new HttpsError('failed-precondition','共享事件或參與者已更新');
   if(board.currentCardReveal?.eventId!==c.eventId||!board.currentCardReveal.isRevealed)throw new HttpsError('failed-precondition','共享卡片尚未翻開');
   responseRef=ref.collection('events').doc(c.promptId!).collection('responses').doc(c.playerUid);
   if((await tx.get(responseRef)).exists||prompt.responses?.[c.playerUid])throw new HttpsError('failed-precondition','玩家已回覆，不能替換選擇');
  }
  if(c.type==='coachTestCard'){
   if(process.env.FUNCTIONS_EMULATOR!=='true')throw new HttpsError('failed-precondition','測試發卡只允許模擬器執行');
   const player=await tx.get(ref.collection('players').doc(c.playerUid));
   if(!player.exists||!player.data()?.isSetup)throw new HttpsError('failed-precondition','玩家資料尚未準備完成');
   const state=player.data() as GameState,card=buildBoardCardResultById(c.cardId!,state);
   if(!card)throw new HttpsError('invalid-argument','找不到官方卡片');
   const eventId=`coach-card:${key(`${c.sessionId}:${uid}:${c.commandId}`)}`;
   const event={id:eventId,playerUid:c.playerUid,playerName:state.playerName||room.members.find(m=>m.uid===c.playerUid)!.name||'玩家',type:'card' as const,summary:`測試觸發：${card.title}`,detail:`執行師直接觸發 ${card.cardId}`,squareIndex:board.playerPositions[c.playerUid]??0,timestamp:now};
   const next=applyBoardCommand({...board,currentTurnUid:c.playerUid,hasRolledThisTurn:true,currentEvent:event,currentCard:card,currentCardReveal:{eventId,cardId:card.cardId,isRevealed:false},skippedTurnNotice:null,updatedAt:now},c.commandId).boardState;
   const result={status:'applied',playerUid:c.playerUid,eventId,cardId:card.cardId,revision:next.revision};tx.update(ref,{boardState:cleanObject(next)});tx.create(intent,{type:c.type,uid,sessionId:c.sessionId,fingerprint,result,completedAt:now});return result;
  }
  if(c.type==='setCoachNextTurn'){
   const next=applyBoardCommand({...board,currentTurnUid:c.playerUid,hasRolledThisTurn:false,skippedTurnNotice:null,updatedAt:now},c.commandId).boardState;
   const result={status:'applied',playerUid:c.playerUid,revision:next.revision};
   tx.update(ref,{boardState:cleanObject(next)});tx.create(intent,{type:c.type,uid,sessionId:c.sessionId,fingerprint,result,completedAt:now});return result;
  }
  let timer:ReturnType<typeof setTimeout>|undefined,presence:PresenceState|undefined;
  try{presence=await Promise.race([readPresence(c.playerUid),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new HttpsError('unavailable','在線狀態查核逾時，尚未跳過玩家，請沿用原操作重試')),5000);})]);}
  finally{if(timer)clearTimeout(timer);}
  const lastSeen=getPresenceTimestamp(presence);
  if(presence?.uid!==c.playerUid||presence.source!=='realtime'||lastSeen===null||!Number.isFinite(lastSeen)||lastSeen<=0||!canSkipDisconnectedPlayer(presence,now))throw new HttpsError('failed-precondition','玩家仍在線、離線未滿 120 秒，或尚無可靠離線紀錄');
  let revision=board.revision;
  if(c.type==='skipDisconnectedTurn'){
   const next=applyBoardCommand(buildNextBoardTurnState({...board,hasRolledThisTurn:true},c.playerUid,now),c.commandId).boardState;revision=next.revision;
   tx.update(ref,{boardState:cleanObject(next)});
  }else{
   tx.create(responseRef!,{playerUid:c.playerUid,playerName:room.members.find(m=>m.uid===c.playerUid)!.name||'失聯玩家',status:'declined',note:'主持人依離線門檻排除',respondedAt:now,excludedBy:uid});
   // The existing response trigger owns finalization; this command never pays or closes the source event.
  }
  const result={status:'applied',playerUid:c.playerUid,revision};tx.create(intent,{type:c.type,uid,sessionId:c.sessionId,fingerprint,result,completedAt:now});return result;
 });
}
export async function readServerPresence(roomId:string,playerUid:string):Promise<PresenceState|undefined>{
 if(process.env.FUNCTIONS_EMULATOR==='true'&&!process.env.FIREBASE_DATABASE_EMULATOR_HOST)throw new HttpsError('unavailable','離線處理需要本機 RTDB 模擬器，已停止雲端讀取');
 const {getDatabase}=await import('firebase-admin/database');
 const db=getDatabase(),[connections,lastOnline]=await Promise.all([db.ref(`roomConnections/${roomId}/${playerUid}`).get(),db.ref(`roomLastOnline/${roomId}/${playerUid}`).get()]);
 return mapRealtimePresenceValue({[playerUid]:connections.val()},{[playerUid]:lastOnline.val()})[playerUid];
}

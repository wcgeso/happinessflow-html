import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room,GameState,PendingRequest} from '../../src/types';
import {HAPPINESS_CARD_MAP} from '../../src/constants/cards';
import {buildPendingRequestId,applyApprovedHappinessStory} from '../../src/game/requests/state';
import {buildBoardEventAdvanceState,appendBoardCardLog} from '../../src/game/board/eventQueue';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {cleanObject} from '../../src/utils/utils';
import {key} from './commands';
import {BANKING_AUTHORITY} from './banking';
import {MOVEMENT_AUTHORITY,saveMovementTask} from './movement';
import {commitFinance} from './financeCommit';
export type StoryCommand={type:'submitStory'|'approveStory'|'rejectStory'|'clearStory'|'finishStory'|'declineStory';roomId:string;sessionId:string;eventId:string;commandId:string;cardId?:string;requestId?:string;attempt?:number};
export function parseStoryCommand(data:unknown):StoryCommand {
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','分享命令無效');
 const c=data as StoryCommand,review=['approveStory','rejectStory','clearStory'].includes(c.type),fields=['type','roomId','sessionId','eventId','commandId',...(review?['requestId','attempt']:['cardId'])];
 if(!['submitStory','approveStory','rejectStory','clearStory','finishStory','declineStory'].includes(c.type)||Object.keys(c).some(k=>!fields.includes(k))||['roomId','sessionId','eventId','commandId',review?'requestId':'cardId'].some(k=>typeof c[k as keyof StoryCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof StoryCommand])))||review&&(!Number.isSafeInteger(c.attempt)||c.attempt!<1))throw new HttpsError('invalid-argument','分享識別值或審核批次無效');
 return c;
}
export async function executeStoryCommand(db:Firestore,c:StoryCommand,actor:string,now=Date.now()) {
 const ref=db.doc(`rooms/${c.roomId}`),intent=ref.collection('gameCommands').doc(key(`${actor}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.eventId,c.cardId||null,c.requestId||null,c.attempt||null]));
 return db.runTransaction(async tx=>{
  const roomSnapshot=await tx.get(ref),previous=await tx.get(intent);
  if(!roomSnapshot.exists)throw new HttpsError('not-found','房間不存在');
  const room=roomSnapshot.data() as Room;
  if(!room.members?.some(m=>m.uid===actor&&!m.isLeft))throw new HttpsError('permission-denied','不是本場成員');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection')throw new HttpsError('failed-precondition','場次已更新或後端分享尚未啟用');
  if(previous.exists&&previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一命令不能更改分享內容');
  if(previous.data()?.result.status==='applied')return {...previous.data()!.result,status:'duplicate'};
  const review=['approveStory','rejectStory','clearStory'].includes(c.type);
  const requestId=review?c.requestId!:buildPendingRequestId({type:'happiness',uid:actor,boardEventId:c.eventId,boardCardId:c.cardId},c.sessionId),requestRef=ref.collection('pendingRequests').doc(requestId),requestSnapshot=await tx.get(requestRef),request=requestSnapshot.data() as (PendingRequest&{attempt:number})|undefined;
  const receipt=ref.collection('storyResults').doc(requestId),saved=await tx.get(receipt),stored=saved.data();
  const uid=review?(request?.uid||stored?.uid):actor;
  if(!uid){if(c.type==='clearStory')return {status:'duplicate'};throw new HttpsError('not-found','分享請求不存在');}
  if(review&&(request?.boardEventId||stored?.eventId)!==c.eventId)throw new HttpsError('failed-precondition','分享事件已更新');
  if(['approveStory','rejectStory'].includes(c.type)&&actor!==room.hostId)throw new HttpsError('permission-denied','只有本場執行師能審核');
  if(c.type==='clearStory'&&actor!==uid&&actor!==room.hostId)throw new HttpsError('permission-denied','不能清除他人分享');
  if(request&&request.sessionId!==c.sessionId)throw new HttpsError('failed-precondition','分享屬於舊場次');
  const cardId=request?.boardCardId||stored?.cardId||c.cardId!,card=HAPPINESS_CARD_MAP[cardId];
  if(requestId!==buildPendingRequestId({type:'happiness',uid,boardEventId:c.eventId,boardCardId:cardId},c.sessionId))throw new HttpsError('invalid-argument','分享請求與事件不符');
  if(!card?.requiresStorySharing||request&&request.type!=='happiness')throw new HttpsError('failed-precondition','不是幸福故事分享卡');
  if(review&&(request?.attempt||stored?.attempt)!==c.attempt)throw new HttpsError('failed-precondition','審核批次已更新');
  const playerRef=ref.collection('players').doc(uid),player=await tx.get(playerRef);
  const summary=(status:'pending'|'approved'|'rejected'|'declined',attempt:number)=>({sessionId:c.sessionId,eventId:c.eventId,requestId,attempt,status});
  const commit=(result:any)=>{tx.set(intent,{uid:actor,sessionId:c.sessionId,fingerprint,result});return result;};
  if(c.type==='clearStory') {
   if(request?.status==='pending')return {status:'waiting',message:'分享尚在審核，待辦保留'};
   if(request?.status==='approved'&&stored?.phase!=='approved')return {status:'waiting',message:'幸福效果尚待確認'};
   tx.delete(requestRef);return commit({status:'applied'});
  }
  if(stored?.phase==='approved') {
   if(c.type==='rejectStory'||c.type==='declineStory')throw new HttpsError('already-exists','分享已核准並完成');
   commit(stored.result);return {...stored.result,status:'duplicate'};
  }
  if(stored?.phase==='declined')throw new HttpsError('already-exists','本事件已選擇不接受');
  const board=room.boardState,current=room.status==='playing'&&board?.currentTurnUid===uid&&board.currentEvent?.id===c.eventId&&board.currentEvent.playerUid===uid&&board.currentCard?.cardId===cardId&&board.currentCard.deck==='happiness'&&board.currentCardReveal?.eventId===c.eventId&&board.currentCardReveal.cardId===cardId&&board.currentCardReveal.isRevealed===true;
  if(c.type==='rejectStory') {
   if(request?.status==='rejected')return commit({status:'applied'});
   tx.update(requestRef,{status:'rejected'});if(player.exists)tx.update(playerRef,{storyApproval:summary('rejected',c.attempt!)});tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,cardId,attempt:c.attempt,phase:'rejected'});return commit({status:'applied'});
  }
  if(!current)throw new HttpsError('failed-precondition','幸福分享事件已更新');
  if(!room.members.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','分享玩家已離場');
  if(c.type==='submitStory') {
   if(actor===room.hostId)throw new HttpsError('permission-denied','執行師不能代替玩家分享');
   if(request?.status==='pending')return commit({status:'applied',requestId,attempt:request.attempt});
   if(!player.exists||!player.data()?.isSetup)throw new HttpsError('failed-precondition','玩家資料未準備完成');
   const attempt=(stored?.attempt||0)+1;
   const record={id:requestId,uid,playerName:room.members.find(m=>m.uid===uid)?.name||'玩家',type:'happiness',amount:card.happinessPoints,happinessLabel:card.title,boardCardId:cardId,boardEventId:c.eventId,sessionId:c.sessionId,status:'pending',timestamp:now,attempt};
   tx.update(playerRef,{storyApproval:summary('pending',attempt)});tx.set(requestRef,record);tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,cardId,attempt,phase:'pending'});return commit({status:'applied',requestId,attempt});
  }
  if(c.type==='finishStory')return {status:'waiting',message:'幸福分享尚未核准'};
  if(c.type==='approveStory'&&(request?.status!=='pending'||stored?.phase!=='pending'))throw new HttpsError('failed-precondition','分享請求已處理');
  const advanced=buildBoardEventAdvanceState(room);
  if(!advanced?.boardState)return {status:'waiting',message:'仍有其他待辦，分享結果保留'};
  let cardLog=appendBoardCardLog(board!,board!.currentCard,board!.currentEvent);
  if(advanced.boardState.currentCard)cardLog=appendBoardCardLog({...board!,cardLog},advanced.boardState.currentCard,advanced.boardState.currentEvent);
  const next=cleanObject({...advanced.boardState,cardLog,revision:(board!.revision||0)+1,updatedAt:now}),result={status:'applied',requestId,attempt:stored?.attempt||0};
  if(c.type==='approveStory') {
   if(!player.exists||!player.data()?.isSetup)throw new HttpsError('failed-precondition','玩家資料未準備完成');
   const state=player.data() as GameState,applied=applyApprovedHappinessStory(state,request!,card.happinessPoints,now);
   if(applied.duplicate)throw new HttpsError('failed-precondition','舊版幸福紀錄需要核對');
   commitFinance(tx,ref,uid,state,withAutomaticHappiness({...applied.state,storyApproval:summary('approved',c.attempt!)},room.financialAcceleration),room,`approve-story:${requestId}:${c.attempt}`,result);
   tx.update(requestRef,{status:'approved'});
  }else {if(request)tx.update(requestRef,{status:'rejected'});if(player.exists)tx.update(playerRef,{storyApproval:summary('declined',stored?.attempt||0)});}
  tx.update(ref,{boardState:next});
  if(room.movementAuthority===MOVEMENT_AUTHORITY&&next.movement?.isActive)saveMovementTask(tx,ref,c.sessionId,next.movement);
  tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,cardId,attempt:stored?.attempt||0,phase:c.type==='approveStory'?'approved':'declined',result});return commit(result);
 });
}

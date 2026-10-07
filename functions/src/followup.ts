import {randomBytes} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room,GameState,PendingRequest} from '../../src/types';
import {OPPORTUNITY_CARD_MAP} from '../../src/constants/cards';
import {buildPendingRequestId} from '../../src/game/requests/state';
import {buildApprovedDrawContinuation} from '../../src/game/board/continuation';
import {resolveBoardCardAction} from '../../src/utils/boardCardActions';
import {applyBoardTransaction,createSequentialIdGenerator} from '../../src/game/finance/applyBoardTransaction';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {commitFinance} from './financeCommit';
import {drawBoardCard} from '../../src/game/board/movementResolution';
import {appendBoardCardLog,buildBoardEventAdvanceState} from '../../src/game/board/eventQueue';
import {cleanObject} from '../../src/utils/utils';
import {key} from './commands';
import {BANKING_AUTHORITY} from './banking';
import {MOVEMENT_AUTHORITY,saveMovementTask} from './movement';
export type FollowupCommand={type:'submitFollowup'|'approveFollowup'|'rejectFollowup'|'clearFollowup'|'drawFollowup'|'declineFollowup'|'applyFollowup';roomId:string;sessionId:string;eventId:string;commandId:string;requestId?:string;attempt?:number;cardId?:'C054'|'C056'};
export function parseFollowupCommand(data:unknown):FollowupCommand {
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','抽卡接續命令無效');
 const c=data as FollowupCommand,review=['approveFollowup','rejectFollowup','clearFollowup'].includes(c.type),fields=['type','roomId','sessionId','eventId','commandId','cardId',...(review?['requestId','attempt']:[])];
 if(!['submitFollowup','approveFollowup','rejectFollowup','clearFollowup','drawFollowup','declineFollowup','applyFollowup'].includes(c.type)||Object.keys(c).some(k=>!fields.includes(k))||['roomId','sessionId','eventId','commandId',...(review?['requestId']:[])].some(k=>typeof c[k as keyof FollowupCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof FollowupCommand])))||(c.cardId!==undefined&&!['C054','C056'].includes(c.cardId))||review&&(!Number.isSafeInteger(c.attempt)||c.attempt!<1))throw new HttpsError('invalid-argument','抽卡識別值或審核批次無效');
 return c;
}
export async function executeFollowupCommand(db:Firestore,c:FollowupCommand,actor:string,now=Date.now()) {
 if((c.cardId||'C056')==='C056'&&c.type==='applyFollowup')throw new HttpsError('failed-precondition','此分享卡不需財務入帳');
 if(c.cardId==='C054'&&c.type==='drawFollowup')throw new HttpsError('failed-precondition','資源回收不提供抽卡');
 const cardId=c.cardId||'C056',ref=db.doc(`rooms/${c.roomId}`),intent=ref.collection('gameCommands').doc(key(`${actor}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.eventId,c.requestId||null,c.attempt||null,cardId])),seed=randomBytes(16).toString('hex');
 return db.runTransaction(async tx=>{
  const roomSnapshot=await tx.get(ref),previous=await tx.get(intent),room=roomSnapshot.data() as Room;
  if(!room)throw new HttpsError('not-found','房間不存在');
  if(!room.members?.some(m=>m.uid===actor&&!m.isLeft))throw new HttpsError('permission-denied','不是本場成員');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection')throw new HttpsError('failed-precondition','場次已更新或接續尚未啟用');
  if(previous.exists&&previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一命令不能更改內容');
  if(previous.data()?.result.status==='applied')return {...previous.data()!.result,status:'duplicate'};
  const review=['approveFollowup','rejectFollowup','clearFollowup'].includes(c.type),requestId=review?c.requestId!:buildPendingRequestId({type:'board_share',uid:actor,boardEventId:c.eventId,boardCardId:cardId},c.sessionId);
  const requestRef=ref.collection('pendingRequests').doc(requestId),receipt=ref.collection('followupResults').doc(requestId),requestSnapshot=await tx.get(requestRef),saved=await tx.get(receipt),request=requestSnapshot.data() as PendingRequest|undefined,stored=saved.data(),uid=review?(request?.uid||stored?.uid):actor;
  if(!uid)throw new HttpsError('not-found','分享請求不存在');
  if(requestId!==buildPendingRequestId({type:'board_share',uid,boardEventId:c.eventId,boardCardId:cardId},c.sessionId)||request&&(request.type!=='board_share'||request.sessionId!==c.sessionId||request.boardEventId!==c.eventId||request.boardCardId!==cardId))throw new HttpsError('failed-precondition','分享與場次或事件不符');
  if(['approveFollowup','rejectFollowup'].includes(c.type)&&actor!==room.hostId)throw new HttpsError('permission-denied','只有本場執行師能審核');
  if(c.type==='clearFollowup'&&actor!==uid&&actor!==room.hostId)throw new HttpsError('permission-denied','不能清除他人分享');
  if(review&&(request?.attempt||stored?.attempt)!==c.attempt)throw new HttpsError('failed-precondition','審核批次已更新');
  const playerRef=ref.collection('players').doc(uid),player=await tx.get(playerRef),board=room.boardState,card=OPPORTUNITY_CARD_MAP[cardId];
  const commit=(result:any)=>{tx.set(intent,{uid:actor,sessionId:c.sessionId,fingerprint,result});return result;};
  const marker=(status:'pending'|'approved'|'rejected'|'declined',attempt:number)=>({sessionId:c.sessionId,eventId:c.eventId,requestId,attempt,status});
  if(c.type==='clearFollowup') {
   if(request?.status==='pending'||stored?.phase==='approved')return {status:'waiting',message:'分享或抽新聞卡尚未完成，待辦保留'};
   tx.delete(requestRef);return commit({status:'applied'});
  }
  if(stored?.phase==='completed') {if(c.type==='rejectFollowup'||(c.type==='declineFollowup'&&cardId==='C056'))throw new HttpsError('already-exists','分享效果已完成');commit(stored.result);return {...stored.result,status:'duplicate'};}
  if(stored?.phase==='declined') {if(c.type==='declineFollowup'){commit(stored.result);return {...stored.result,status:'duplicate'};}throw new HttpsError('already-exists','本事件已選擇不接受');}
  if(c.type==='rejectFollowup') {
   if(stored?.phase==='approved')throw new HttpsError('already-exists','已核准，請完成抽卡');
   if(!request)throw new HttpsError('not-found','分享請求不存在');
   tx.update(requestRef,{status:'rejected'});if(player.exists)tx.update(playerRef,{followupApproval:marker('rejected',c.attempt!)});tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,attempt:c.attempt,phase:'rejected'});return commit({status:'applied'});
  }
  if(room.status!=='playing'||!room.members.some(m=>m.uid===uid&&!m.isLeft)||board?.currentTurnUid!==uid||board.currentEvent?.id!==c.eventId||board.currentEvent.playerUid!==uid||board.currentCard?.cardId!==cardId||board.currentCard.deck!=='opportunity'||board.currentCardReveal?.eventId!==c.eventId||board.currentCardReveal.cardId!==cardId||!board.currentCardReveal.isRevealed)throw new HttpsError('failed-precondition','分享卡事件已更新或尚未翻開');
  if(c.type==='submitFollowup') {
   if(actor===room.hostId||!player.exists||!player.data()?.isSetup)throw new HttpsError('failed-precondition','玩家資料未準備完成');
   if(request?.status==='pending'||stored?.phase==='approved')return commit({status:'applied',requestId,attempt:stored?.attempt});
   const attempt=(stored?.attempt||0)+1;
   tx.set(requestRef,{id:requestId,uid,playerName:room.members.find(m=>m.uid===uid)?.name||'玩家',type:'board_share',amount:0,shareLabel:card.title,boardCardId:cardId,boardEventId:c.eventId,sessionId:c.sessionId,status:'pending',timestamp:now,attempt});
   tx.update(playerRef,{followupApproval:marker('pending',attempt)});tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,attempt,phase:'pending'});return commit({status:'applied',requestId,attempt});
  }
  if(c.type==='approveFollowup') {
   if(!player.exists||!player.data()?.isSetup)throw new HttpsError('failed-precondition','玩家資料未準備完成，分享待辦保留');
   if(stored?.phase==='approved'){const result={status:'applied',requestId,attempt:c.attempt};commit(result);return {...result,status:'duplicate'};}
   if(request?.status!=='pending'||stored?.phase!=='pending')throw new HttpsError('failed-precondition','分享已處理');
   if(board.pendingContinuation&&board.pendingContinuation.phase!=='completed')return {status:'waiting',message:'尚有其他接續，審核待辦保留'};
   if(cardId==='C054'){
    tx.update(requestRef,{status:'approved'});tx.update(playerRef,{followupApproval:marker('approved',c.attempt!)});tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,cardId,attempt:c.attempt,phase:'approved'});return commit({status:'applied',requestId,attempt:c.attempt});
   }
   const pending=buildApprovedDrawContinuation(room,request,now);if(!pending)throw new HttpsError('failed-precondition','卡片沒有抽卡接續');
   tx.update(ref,{'boardState.pendingContinuation':pending});tx.update(requestRef,{status:'approved'});tx.update(playerRef,{followupApproval:marker('approved',c.attempt!)});tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,attempt:c.attempt,phase:'approved'});return commit({status:'applied',requestId,attempt:c.attempt});
  }
  if(c.type==='applyFollowup'){
    if(stored?.phase!=='approved'||request?.status!=='approved')return {status:'waiting',message:'分享尚未核准，財務待辦保留'};
    if(!player.exists||!player.data()?.isSetup||Object.keys(room.playerStates||{}).length)throw new HttpsError('failed-precondition','本人資料未準備完成，財務待辦保留');
    const state=player.data() as GameState;
    if(!Number.isFinite(state.cash)||!Array.isArray(state.assets)||!Array.isArray(state.liabilities)||!Array.isArray(state.history)||!Array.isArray(state.happiness)||!state.expenses||Object.values(state.expenses).some(v=>!Number.isFinite(v)||Number(v)<0))throw new HttpsError('failed-precondition','本人財務資料不完整，審核待辦保留');
    const action=resolveBoardCardAction(cardId,state),selected=action.kind==='choice'?action.options.find(o=>o.id==='accept')?.action:action;
    if(selected?.kind!=='financial')throw new HttpsError('failed-precondition','分享效果無法處理，待辦保留');
    const advanced=buildBoardEventAdvanceState(room);if(!advanced?.boardState)return {status:'waiting',message:'尚有未完成待辦，分享未入帳'};
    const operation=`sharing:${c.sessionId}:${uid}:${c.eventId}`,applied=applyBoardTransaction(state,{...selected.txData,boardEventId:operation},{now,generateId:createSequentialIdGenerator(operation),financialAcceleration:room.financialAcceleration});
    if(applied.status!=='applied')throw new HttpsError('failed-precondition',applied.status==='error'?applied.message:'既有分享財務紀錄需要核對');
    const result={status:'applied',requestId,attempt:stored.attempt,eventId:c.eventId},next=cleanObject({...advanced.boardState,cardLog:appendBoardCardLog(board,board.currentCard,board.currentEvent),revision:(board.revision||0)+1,updatedAt:now});
    commitFinance(tx,ref,uid,state,withAutomaticHappiness({...applied.state,followupApproval:marker('approved',stored.attempt)},room.financialAcceleration),room,operation,result);
    tx.update(ref,{boardState:next});if(room.movementAuthority===MOVEMENT_AUTHORITY)saveMovementTask(tx,ref,c.sessionId,next.movement);
    tx.update(requestRef,{status:'approved'});tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,cardId,attempt:stored.attempt,phase:'completed',result});return commit(result);
   }
  if(c.type==='declineFollowup') {
   if(stored?.phase==='approved')return {status:'waiting',message:cardId==='C054'?'分享已核准，請完成財務檢核':'分享已核准，請接續抽新聞卡'};
   const advanced=buildBoardEventAdvanceState(room);if(!advanced?.boardState)return {status:'waiting',message:'尚有未完成待辦'};
   const next=cleanObject({...advanced.boardState,cardLog:appendBoardCardLog(board,board.currentCard,board.currentEvent),revision:(board.revision||0)+1,updatedAt:now});
   tx.update(ref,{boardState:next});if(room.movementAuthority===MOVEMENT_AUTHORITY&&next.movement?.isActive)saveMovementTask(tx,ref,c.sessionId,next.movement);
   if(request)tx.update(requestRef,{status:'rejected'});if(player.exists)tx.update(playerRef,{followupApproval:marker('declined',stored?.attempt||0)});tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,attempt:stored?.attempt||0,phase:'declined',result:{status:'applied'}});return commit({status:'applied'});
  }
  if(cardId==='C054')throw new HttpsError('failed-precondition','資源回收由審核交易完成，不能抽卡');
  const pending=board.pendingContinuation;
  if(stored?.phase!=='approved'||pending?.kind!=='followup-card'||pending.phase!=='awaiting_draw'||pending.playerUid!==uid||pending.sourceEventId!==c.eventId||pending.cardId!==cardId||pending.sessionId!==c.sessionId||pending.deck!=='news')return {status:'waiting',message:'分享尚未核准或待抽卡不符'};
  if(!player.exists||!player.data()?.isSetup||!board.deckState)throw new HttpsError('failed-precondition','抽卡資料未準備完成');
  let cursor=0;const drawn=drawBoardCard(board.deckState,'news',player.data() as GameState,()=>parseInt(key(`${seed}:${cursor++}`).slice(0,8),16)/2**32);if(!drawn)throw new HttpsError('failed-precondition','新聞牌堆沒有可用卡片，待辦保留');
  const eventId=`news-followup:${key(`${c.sessionId}:${uid}:${c.eventId}`).slice(0,24)}`,event={id:eventId,playerUid:uid,playerName:room.members.find(m=>m.uid===uid)?.name||'玩家',type:'followup' as const,summary:'分享完成後抽新聞卡',detail:drawn.card.title,squareIndex:board.playerPositions?.[uid]||0,timestamp:now},result={status:'applied',eventId,cardId:drawn.card.cardId};
  const sourceLog=appendBoardCardLog(board,board.currentCard,board.currentEvent);
  tx.update(ref,{boardState:cleanObject({...board,deckState:drawn.deckState,currentEvent:event,currentCard:drawn.card,currentCardReveal:{eventId,cardId:drawn.card.cardId,isRevealed:false},cardLog:appendBoardCardLog({...board,cardLog:sourceLog},drawn.card,event),pendingContinuation:{...pending,phase:'completed',result:{eventId,cardId:drawn.card.cardId}},revision:(board.revision||0)+1,updatedAt:now})});
  tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,attempt:stored.attempt,phase:'completed',result});return commit(result);
 });
}

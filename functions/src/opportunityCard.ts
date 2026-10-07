import {randomBytes} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {GameState,Room} from '../../src/types';
import {OPPORTUNITY_CARD_MAP} from '../../src/constants/cards';
import {resolveBoardCardAction,isStandaloneOpportunityCard,isForcedBoardCard,hasIncompleteSharedPrompts} from '../../src/utils/boardCardActions';
import {buildVehicleLossState} from '../../src/game/finance/cardState';
import {applyBoardTransaction,createSequentialIdGenerator} from '../../src/game/finance/applyBoardTransaction';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {drawBoardCard,getNextBoardSquare} from '../../src/game/board/movementResolution';
import {buildBoardEventAdvanceState,appendBoardCardLog} from '../../src/game/board/eventQueue';
import {cleanObject} from '../../src/utils/utils';
import {BANKING_AUTHORITY} from './banking';
import {MOVEMENT_AUTHORITY,saveMovementTask} from './movement';
import {commitFinance} from './financeCommit';
import {key} from './commands';
export type OpportunityCommand={type:'opportunityCard';roomId:string;sessionId:string;eventId:string;cardId:string;commandId:string;choice:'accept'|'dismiss';assetId?:string;fundingLoanAmount?:number;forcedDebtAmount?:number};
export function parseOpportunityCommand(data:unknown):OpportunityCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','機運卡操作無效');
 const c=data as OpportunityCommand,ids=['roomId','sessionId','eventId','cardId','commandId',...(c.assetId!==undefined?['assetId']:[])];
 if(c.type!=='opportunityCard'||!['accept','dismiss'].includes(c.choice)||Object.keys(c).some(k=>!['type','choice','fundingLoanAmount','forcedDebtAmount',...ids].includes(k))||ids.some(k=>typeof c[k as keyof OpportunityCommand]!=='string'||!(['commandId','assetId'].includes(k)?/^[\w:.#-]{1,512}$/:/^[\w:.-]{1,512}$/).test(String(c[k as keyof OpportunityCommand])))||['fundingLoanAmount','forcedDebtAmount'].some(k=>c[k as keyof OpportunityCommand]!==undefined&&(!Number.isSafeInteger(c[k as keyof OpportunityCommand])||Number(c[k as keyof OpportunityCommand])<0||Number(c[k as keyof OpportunityCommand])>1e12))||(c.choice==='dismiss'&&(c.assetId||c.fundingLoanAmount||c.forcedDebtAmount)))throw new HttpsError('invalid-argument','機運卡識別值或選擇無效');
 return c;
}
export async function executeOpportunityCommand(db:Firestore,c:OpportunityCommand,uid:string,now=Date.now(),seed=randomBytes(16).toString('hex')){
 const ref=db.doc(`rooms/${c.roomId}`),player=ref.collection('players').doc(uid),receipt=ref.collection('opportunityResults').doc(key(`${c.sessionId}:${uid}:${c.eventId}`)),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.eventId,c.cardId,c.choice,c.assetId??null,c.fundingLoanAmount||0,c.forcedDebtAmount||0]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);
  const [ps,saved,previous]=await Promise.all([tx.get(player),tx.get(receipt),tx.get(intent)]);
  if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(uid===room.hostId||!room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','不是本場玩家');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection'||Object.keys(room.playerStates||{}).length)throw new HttpsError('failed-precondition','場次已更新或後端機運卡尚未啟用');
  if(previous.exists&&previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一命令不能更改選擇');
  const commit=(result:any)=>{tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;};
  if(saved.exists){const value=saved.data()!;if(value.cardId!==c.cardId||(c.choice==='accept'&&(value.choice!=='accept'||value.assetId!==(c.assetId||null)||value.fundingLoanAmount!==(c.fundingLoanAmount||0)||value.forcedDebtAmount!==(c.forcedDebtAmount||0))))throw new HttpsError('already-exists','已完成機運卡不能更改選擇');commit(value.result);return {...value.result,status:'duplicate'};}
  const board=room.boardState,event=board?.currentEvent,card=OPPORTUNITY_CARD_MAP[c.cardId];
  if(room.status!=='playing'||!room.isBoardGame||!board||board.currentTurnUid!==uid||event?.id!==c.eventId||event.playerUid!==uid||board.currentCard?.deck!=='opportunity'||board.currentCard.cardId!==c.cardId||board.currentCardReveal?.eventId!==c.eventId||!board.currentCardReveal.isRevealed||!isStandaloneOpportunityCard(c.cardId))throw new HttpsError('failed-precondition','機運卡事件已更新、未翻牌或需專用流程');
  if(!ps.exists||!ps.data()?.isSetup)throw new HttpsError('failed-precondition','本人資料尚未準備完成');const state=ps.data() as GameState;
  if(!Number.isFinite(state.cash)||state.cash<0||!Array.isArray(state.assets)||!Array.isArray(state.liabilities)||!Array.isArray(state.history)||!Array.isArray(state.happiness)||!state.expenses||!state.income)throw new HttpsError('failed-precondition','本人財務資料不完整');
  if(hasIncompleteSharedPrompts(board)||(board.pendingContinuation&&board.pendingContinuation.phase!=='completed'))return {status:'waiting',message:'尚有其他待辦，機運效果未入帳'};
  const action=resolveBoardCardAction(c.cardId,state),operation=`opportunity:${c.sessionId}:${uid}:${c.eventId}`;
  if(action.kind==='unsupported')throw new HttpsError('failed-precondition',action.note);
  const selected=action.kind==='choice'?action.options.find(o=>o.id==='accept')?.action:action;
  const freeClose=action.kind==='choice'&&action.options.every(o=>o.action.kind==='dismiss');
  if(c.choice==='dismiss'&&isForcedBoardCard(c.cardId)&&!freeClose)throw new HttpsError('failed-precondition','強制機運效果尚未完成，不能關閉');
  if(c.assetId&&c.cardId!=='C038')throw new HttpsError('invalid-argument','此卡不能指定汽車');
  let after=state,next={...board,cardLog:appendBoardCardLog(board,board.currentCard,event)};
  if(c.choice==='accept'){
   if(!selected||!['financial','effect'].includes(selected.kind))throw new HttpsError('failed-precondition','本次無效果，請關閉卡片');
   if(c.cardId==='C038'){
    const vehicle=state.assets.find(a=>(a.type==='汽車'||a.type==='飛行器')&&(!c.assetId||a.id===c.assetId));
    if(!vehicle)throw new HttpsError('failed-precondition','指定汽車不存在');if(c.fundingLoanAmount||c.forcedDebtAmount)throw new HttpsError('invalid-argument','汽車損失不需周轉');
    after=buildVehicleLossState(state,{assetId:vehicle.id,claimAmount:vehicle.isInsured?(card.insurancePays||400000):0},operation,now);
   }else if(selected.kind==='financial'){
    const data=selected.txData,shortfall=Math.max(0,-data.cashChange-state.cash),funding=(c.fundingLoanAmount||0)+(c.forcedDebtAmount||0);
    if((c.fundingLoanAmount&&c.forcedDebtAmount)||(funding&&funding!==shortfall)||(c.forcedDebtAmount&&!isForcedBoardCard(c.cardId)))throw new HttpsError('invalid-argument','周轉必須符合強制事件資格且等於實際不足');
    const applied=applyBoardTransaction(state,{...data,boardEventId:operation,fundingLoanAmount:c.fundingLoanAmount,forcedDebtAmount:c.forcedDebtAmount},{now,generateId:createSequentialIdGenerator(operation),financialAcceleration:room.financialAcceleration});
    if(applied.status==='error'){if(applied.code==='insufficient_cash')return {status:'requires_funding',shortfall:applied.shortfall,message:applied.message};throw new HttpsError('failed-precondition',applied.message);}
    if(applied.status==='duplicate')throw new HttpsError('failed-precondition','既有財務紀錄需要核對，未重複入帳');after=applied.state;
   }else if(c.fundingLoanAmount||c.forcedDebtAmount)throw new HttpsError('invalid-argument','此效果不需周轉');
   if('afterApply' in selected&&selected.afterApply?.moveToSquare){
    const move=selected.afterApply.moveToSquare,destination=getNextBoardSquare(board.playerPositions?.[uid],move.squareType),skip=Math.max(board.skipTurns?.[uid]||0,move.skipTurns||0);
    next={...next,playerPositions:{...board.playerPositions,[uid]:destination.index},skipTurns:{...board.skipTurns,[uid]:skip},movement:null};
    after={...after,boardPosition:destination.index,skipTurns:skip,lastBoardEvent:move.detail,pendingCardAction:undefined,bankServiceWindowActive:false,bankServiceGrantedAtEventId:undefined};
   }
   if('afterApply' in selected&&selected.afterApply?.drawCard){
    if(!board.deckState)throw new HttpsError('failed-precondition','牌堆尚未準備完成，未入帳');
    const deck=selected.afterApply.drawCard;let cursor=0;const drawn=drawBoardCard(board.deckState,deck,after,()=>parseInt(key(`${seed}:${cursor++}`).slice(0,8),16)/2**32);
    if(!drawn)throw new HttpsError('failed-precondition','後續牌堆沒有可用卡片，未入帳');
    const eventId=`card-followup:${key(`${c.sessionId}:${uid}:${c.eventId}`).slice(0,24)}`,followup={id:eventId,playerUid:uid,playerName:room.members.find(m=>m.uid===uid)?.name||'玩家',type:'followup' as const,summary:`機運卡：${card.title} 後續抽卡`,detail:drawn.card.title,squareIndex:next.playerPositions?.[uid]||0,timestamp:now};
    next={...next,currentEvent:followup,currentCard:drawn.card,currentCardReveal:{eventId,cardId:drawn.card.cardId,isRevealed:false},deckState:drawn.deckState,cardLog:appendBoardCardLog(next,drawn.card,followup)};
   }else{const advanced=buildBoardEventAdvanceState({...room,boardState:next});if(!advanced?.boardState)return {status:'waiting',message:'尚有其他待辦，機運效果未入帳'};next=advanced.boardState;}
  }else{const advanced=buildBoardEventAdvanceState({...room,boardState:next});if(!advanced?.boardState)return {status:'waiting',message:'尚有其他待辦，機運卡尚未結案'};next=advanced.boardState;}
  const result={status:'applied',sourceEventId:c.eventId,eventId:next.currentEvent?.id||null,cardId:next.currentCard?.cardId||null};
  if(after!==state)commitFinance(tx,ref,uid,state,withAutomaticHappiness(after,room.financialAcceleration),room,operation,result);
  tx.update(ref,{boardState:cleanObject({...next,revision:(board.revision||0)+1,updatedAt:now})});if(room.movementAuthority===MOVEMENT_AUTHORITY)saveMovementTask(tx,ref,c.sessionId,next.movement);
  tx.create(receipt,{uid,sessionId:c.sessionId,cardId:c.cardId,choice:c.choice,assetId:c.assetId||null,fundingLoanAmount:c.fundingLoanAmount||0,forcedDebtAmount:c.forcedDebtAmount||0,result});return commit(result);
 });
}

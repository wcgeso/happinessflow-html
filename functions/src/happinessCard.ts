import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {GameState,Room} from '../../src/types';
import {getFamilyMilestoneStatus,applyFamilyMilestoneStage} from '../../src/utils/familyMilestones';
import {HAPPINESS_CARD_MAP} from '../../src/constants/cards';
import {resolveBoardCardAction} from '../../src/utils/boardCardActions';
import {applyBoardTransaction,createSequentialIdGenerator} from '../../src/game/finance/applyBoardTransaction';
import {buildDirectHappinessCardState} from '../../src/game/finance/cardState';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {buildBoardEventAdvanceState,appendBoardCardLog} from '../../src/game/board/eventQueue';
import {cleanObject} from '../../src/utils/utils';
import {BANKING_AUTHORITY} from './banking';
import {MOVEMENT_AUTHORITY,saveMovementTask} from './movement';
import {commitFinance} from './financeCommit';
import {key} from './commands';
export type HappinessCommand={type:'happinessCard';roomId:string;sessionId:string;eventId:string;cardId:string;commandId:string;choice:'accept'|'dismiss';fundingLoanAmount?:number};
export function parseHappinessCommand(data:unknown):HappinessCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','幸福卡操作無效');
 const c=data as HappinessCommand,ids=['roomId','sessionId','eventId','cardId','commandId'];
 if(c.type!=='happinessCard'||!['accept','dismiss'].includes(c.choice)||Object.keys(c).some(k=>!['type','choice','fundingLoanAmount',...ids].includes(k))||ids.some(k=>typeof c[k as keyof HappinessCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof HappinessCommand])))||(c.fundingLoanAmount!==undefined&&(!Number.isSafeInteger(c.fundingLoanAmount)||c.fundingLoanAmount<0||c.fundingLoanAmount>1e12))||(c.choice==='dismiss'&&c.fundingLoanAmount))throw new HttpsError('invalid-argument','幸福卡識別值或選擇無效');
 return c;
}
export async function executeHappinessCommand(db:Firestore,c:HappinessCommand,uid:string,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),player=ref.collection('players').doc(uid),receipt=ref.collection('happinessResults').doc(key(`${c.sessionId}:${uid}:${c.eventId}`)),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.eventId,c.cardId,c.choice,c.fundingLoanAmount||0]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);
  const [ps,saved,previous]=await Promise.all([tx.get(player),tx.get(receipt),tx.get(intent)]);
  if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(uid===room.hostId||!room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','不是本場玩家');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection'||Object.keys(room.playerStates||{}).length)throw new HttpsError('failed-precondition','場次已更新或後端幸福卡尚未啟用');
  if(previous.exists&&previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一命令不能更改選擇');
  const commit=(result:any)=>{tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;};
  if(saved.exists){const value=saved.data()!;if(value.cardId!==c.cardId||(c.choice==='accept'&&(value.choice!==c.choice||value.fundingLoanAmount!==(c.fundingLoanAmount||0))))throw new HttpsError('already-exists','已完成幸福卡不能更改選擇');commit(value.result);return {...value.result,status:'duplicate'};}
  const board=room.boardState,event=board?.currentEvent,card=HAPPINESS_CARD_MAP[c.cardId];
  if(room.status!=='playing'||!room.isBoardGame||!board||board.currentTurnUid!==uid||event?.id!==c.eventId||event.playerUid!==uid||board.currentCard?.deck!=='happiness'||board.currentCard.cardId!==c.cardId||board.currentCardReveal?.eventId!==c.eventId||!board.currentCardReveal.isRevealed)throw new HttpsError('failed-precondition','幸福卡事件已更新或未翻牌');
  if(!card||(card.category==='家庭重要歷程'&&board.familyMilestoneJoinPrompt)||card.requiresStorySharing)throw new HttpsError('failed-precondition','此卡應使用家庭歷程或分享審核流程');
  if(!ps.exists||!ps.data()?.isSetup)throw new HttpsError('failed-precondition','本人資料尚未準備完成');
  const state=ps.data() as GameState;
  if(!Number.isFinite(state.cash)||!Array.isArray(state.assets)||!Array.isArray(state.liabilities)||!Array.isArray(state.history)||!Array.isArray(state.happiness)||!state.expenses)throw new HttpsError('failed-precondition','本人財務資料不完整');
  const action=resolveBoardCardAction(c.cardId,state);
  if(action.kind==='unsupported')throw new HttpsError('failed-precondition',action.note);
  const advanced=buildBoardEventAdvanceState({...room,boardState:{...board,cardLog:appendBoardCardLog(board,board.currentCard,event)}});
  if(!advanced?.boardState)return {status:'waiting',message:'尚有其他待辦，幸福卡尚未入帳'};
  const operation=`happiness:${c.sessionId}:${uid}:${c.eventId}`,result={status:'applied',eventId:c.eventId},next={...advanced.boardState,revision:(board.revision||0)+1,updatedAt:now};
  let after=state;
  if(c.choice==='accept'){
   const selected=action.kind==='choice'?action.options.find(o=>o.id==='accept')?.action:action;
   if(!selected||!['financial','happiness'].includes(selected.kind)||!('txData' in selected))throw new HttpsError('failed-precondition','目前不符合此幸福卡接受條件');
   const data={...selected.txData,boardEventId:operation},shortfall=Math.max(0,-data.cashChange-state.cash);
   if(c.fundingLoanAmount&&c.fundingLoanAmount!==shortfall)throw new HttpsError('invalid-argument','周轉金額必須等於實際不足金額');
   if(shortfall&&!c.fundingLoanAmount)return {status:'requires_funding',shortfall,message:'現金不足，請先周轉或不接受'};
   if(card.category==='家庭重要歷程'){
    const status=getFamilyMilestoneStatus(state),stage=status.currentStageIndex>=0?status.stages[status.currentStageIndex]:undefined;
    if(!stage)throw new HttpsError('failed-precondition','家庭歷程已完成');
    const applied=applyFamilyMilestoneStage(state,stage,operation,now,0,c.fundingLoanAmount);
    if(applied.status==='insufficient')return {status:'requires_funding',shortfall:applied.shortfall};
    if(applied.status!=='applied')throw new HttpsError('failed-precondition',applied.status==='failed'?applied.message:'既有家庭歷程紀錄需要核對');
    after=applied.state;
   }
   else if(selected.kind==='happiness')after=buildDirectHappinessCardState(state,data,operation,now);
   else{
    const applied=applyBoardTransaction(state,{...data,fundingLoanAmount:c.fundingLoanAmount},{now,generateId:createSequentialIdGenerator(operation),financialAcceleration:room.financialAcceleration});
    if(applied.status==='error')throw new HttpsError('failed-precondition',applied.message);
    if(applied.status==='duplicate')throw new HttpsError('failed-precondition','舊版紀錄需要核對，未重複入帳');
    after=applied.state;
   }
   commitFinance(tx,ref,uid,state,withAutomaticHappiness(after,room.financialAcceleration),room,operation,result);
  }
  tx.update(ref,{boardState:cleanObject(next)});if(room.movementAuthority===MOVEMENT_AUTHORITY)saveMovementTask(tx,ref,c.sessionId,next.movement);
  tx.create(receipt,{uid,sessionId:c.sessionId,cardId:c.cardId,choice:c.choice,fundingLoanAmount:c.fundingLoanAmount||0,result});return commit(result);
 });
}

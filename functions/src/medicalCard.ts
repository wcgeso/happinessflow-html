import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {GameState,Room} from '../../src/types';
import {OPPORTUNITY_CARD_MAP} from '../../src/constants/cards';
import {buildMedicalBoardCardState} from '../../src/utils/boardMedical';
import {applyBoardTransaction,createSequentialIdGenerator} from '../../src/game/finance/applyBoardTransaction';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {getNextBoardSquare} from '../../src/game/board/movementResolution';
import {buildBoardEventAdvanceState,appendBoardCardLog} from '../../src/game/board/eventQueue';
import {cleanObject} from '../../src/utils/utils';
import {BANKING_AUTHORITY} from './banking';
import {MOVEMENT_AUTHORITY,saveMovementTask} from './movement';
import {commitFinance} from './financeCommit';
import {key} from './commands';
export type MedicalCommand={type:'payMedicalCard'|'finishMedicalCard'|'claimMedical';roomId:string;sessionId:string;commandId:string;eventId?:string;cardId?:string;claimId?:string;fundingLoanAmount?:number;forcedDebtAmount?:number};
export function parseMedicalCommand(data:unknown):MedicalCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','醫療卡操作無效');
 const c=data as MedicalCommand,ids=['roomId','sessionId','commandId',...(c.type==='claimMedical'?['claimId']:['eventId','cardId'])],funds=c.type==='payMedicalCard'?['fundingLoanAmount','forcedDebtAmount']:[];
 if(!['payMedicalCard','finishMedicalCard','claimMedical'].includes(c.type)||Object.keys(c).some(k=>!['type',...ids,...funds].includes(k))||ids.some(k=>typeof c[k as keyof MedicalCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof MedicalCommand])))||funds.some(k=>c[k as keyof MedicalCommand]!==undefined&&(!Number.isSafeInteger(c[k as keyof MedicalCommand])||Number(c[k as keyof MedicalCommand])<0||Number(c[k as keyof MedicalCommand])>1e12)))throw new HttpsError('invalid-argument','醫療卡識別值或周轉選擇無效');
 return c;
}
export async function executeMedicalCommand(db:Firestore,c:MedicalCommand,uid:string,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),player=ref.collection('players').doc(uid),receipt=ref.collection(c.type==='claimMedical'?'medicalClaimResults':'medicalCardResults').doc(key(`${c.sessionId}:${uid}:${c.claimId||c.eventId}`)),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.eventId??null,c.cardId??null,c.claimId??null,c.fundingLoanAmount||0,c.forcedDebtAmount||0]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);
  const [ps,saved,previous]=await Promise.all([tx.get(player),tx.get(receipt),tx.get(intent)]);
  if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(uid===room.hostId||!room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','不是本場玩家');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection'||Object.keys(room.playerStates||{}).length)throw new HttpsError('failed-precondition','場次已更新或後端醫療卡尚未啟用');
  if(previous.exists&&previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一命令不能更改內容');
  const commit=(result:any)=>{tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;};
  if(saved.exists){const value=saved.data()!;if(c.cardId&&value.cardId!==c.cardId)throw new HttpsError('already-exists','已完成醫療事件不能更改卡片');commit(value.result);return {...value.result,status:'duplicate'};}
  if(c.type==='finishMedicalCard')return {status:'waiting',message:'醫療費尚未入帳，不能關閉事件'};
  if(room.status!=='playing'||!ps.exists||!ps.data()?.isSetup)throw new HttpsError('failed-precondition','遊戲或本人資料尚未準備完成');
  const state=ps.data() as GameState;
  if(!Number.isFinite(state.cash)||state.cash<0||!Array.isArray(state.assets)||!Array.isArray(state.liabilities)||!Array.isArray(state.history)||!Array.isArray(state.happiness)||!Array.isArray(state.pendingMedicalClaims)||!state.expenses||!Number.isSafeInteger(state.medicalInsuranceCount)||state.medicalInsuranceCount<0)throw new HttpsError('failed-precondition','本人醫療或財務資料不完整');
  if(c.type==='claimMedical'){
   const claim=state.pendingMedicalClaims.find(x=>x.id===c.claimId),card=claim&&OPPORTUNITY_CARD_MAP[claim.sourceCardId];
   if(!claim||card?.type!=='medical'||!(card.insurancePays!>0))throw new HttpsError('failed-precondition','沒有可申請的理賠');
   const paid=await tx.get(ref.collection('medicalCardResults').doc(key(`${c.sessionId}:${uid}:${claim.sourceEventId}`)));
   if(!paid.exists||paid.data()!.cardId!==claim.sourceCardId||paid.data()!.claimId!==claim.id)throw new HttpsError('failed-precondition','找不到本場已付款的理賠資格');
   const amount=card.insurancePays!,operation=`medical-claim:${c.sessionId}:${uid}:${claim.id}`,result={status:'applied',claimId:claim.id,amount};
   const applied=applyBoardTransaction(state,{name:`醫療保險理賠：${card.title}`,amount,cashChange:amount,source:'income',usage:'cash',boardFlow:'insurance-claim',boardEventId:claim.id,medicalClaimId:claim.id,flowType:'其它'},{now,generateId:createSequentialIdGenerator(operation),financialAcceleration:room.financialAcceleration});
   if(applied.status!=='applied')throw new HttpsError('failed-precondition',applied.status==='error'?applied.message:'既有理賠紀錄需要核對，未重複發放');
   commitFinance(tx,ref,uid,state,withAutomaticHappiness(applied.state,room.financialAcceleration),room,operation,result);tx.create(receipt,{uid,sessionId:c.sessionId,claimId:claim.id,cardId:claim.sourceCardId,result});return commit(result);
  }
  const board=room.boardState,event=board?.currentEvent,card=OPPORTUNITY_CARD_MAP[c.cardId!];
  if(!room.isBoardGame||!board||board.currentTurnUid!==uid||event?.id!==c.eventId||event.playerUid!==uid||board.currentCard?.deck!=='opportunity'||board.currentCard.cardId!==c.cardId||board.currentCardReveal?.eventId!==c.eventId||!board.currentCardReveal.isRevealed||card?.type!=='medical')throw new HttpsError('failed-precondition','醫療卡事件已更新或未翻牌');
  const cost=card.cashLoss||0,shortfall=Math.max(0,cost-state.cash),funding=(c.fundingLoanAmount||0)+(c.forcedDebtAmount||0);
  if((c.fundingLoanAmount&&c.forcedDebtAmount)||(funding&&funding!==shortfall))throw new HttpsError('invalid-argument','只能選一種周轉方式，金額必須等於實際不足');
  const operation=`medical:${c.sessionId}:${uid}:${c.eventId}`;
  const applied=buildMedicalBoardCardState({currentState:state,cardId:c.cardId!,eventId:c.eventId!,commandId:operation,now,txData:{name:`機運卡：${card.title}`,amount:cost,cashChange:-cost,source:'cash',usage:'expense',boardFlow:'board-card',fundingLoanAmount:c.fundingLoanAmount,forcedDebtAmount:c.forcedDebtAmount}});
  if(applied.status==='requires_funding')return {status:'requires_funding',shortfall:applied.shortfall,message:applied.message};
  if(applied.status!=='applied')throw new HttpsError('failed-precondition',applied.message||'既有付款紀錄需要核對，未重複入帳');
  const destination=getNextBoardSquare(board.playerPositions?.[uid],'hospital'),skip=Math.max(board.skipTurns?.[uid]||0,card.missRounds||0),moved={...board,playerPositions:{...board.playerPositions,[uid]:destination.index},skipTurns:{...board.skipTurns,[uid]:skip},movement:null,cardLog:appendBoardCardLog(board,board.currentCard,event)};
  const advanced=buildBoardEventAdvanceState({...room,boardState:moved});if(!advanced?.boardState)return {status:'waiting',message:'尚有其他待辦，醫療付款未提交'};
  const after=withAutomaticHappiness({...applied.state,boardPosition:destination.index,skipTurns:skip,lastBoardEvent:`機運卡送醫：${card.title}`,pendingCardAction:undefined,bankServiceWindowActive:false,bankServiceGrantedAtEventId:undefined},room.financialAcceleration),claimId=state.medicalInsuranceCount>0&&(card.insurancePays||0)>0?`medical-claim:${c.eventId}:${c.cardId}`:undefined,result={status:'applied',eventId:c.eventId,squareIndex:destination.index};
  commitFinance(tx,ref,uid,state,after,room,operation,result);tx.update(ref,{boardState:cleanObject({...advanced.boardState,revision:(board.revision||0)+1,updatedAt:now})});if(room.movementAuthority===MOVEMENT_AUTHORITY)saveMovementTask(tx,ref,c.sessionId,advanced.boardState.movement);
  tx.create(receipt,cleanObject({uid,sessionId:c.sessionId,cardId:c.cardId,claimId,result}));return commit(result);
 });
}

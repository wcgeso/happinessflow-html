import {randomInt} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room,GameState} from '../../src/types';
import {buildBoardEventAdvanceState} from '../../src/game/board/eventQueue';
import {appendDicePresentation,DICE_PRESENTATION_DURATION_MS} from '../../src/game/board/dicePresentation';
import {applyBoardTransaction,createSequentialIdGenerator} from '../../src/game/finance/applyBoardTransaction';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {cleanObject} from '../../src/utils/utils';
import {key} from './commands';
import {BANKING_AUTHORITY} from './banking';
import {MOVEMENT_AUTHORITY,saveMovementTask} from './movement';
import {commitFinance} from './financeCommit';
export type ServiceCommand={type:'rollService'|'payService'|'finishService';roomId:string;sessionId:string;eventId:string;commandId:string;kind:'hospital'|'repair';fundingLoanAmount?:number;forcedDebtAmount?:number};
export function parseServiceCommand(data:unknown):ServiceCommand {
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','格子事件操作無效');
 const c=data as ServiceCommand,fields=['type','roomId','sessionId','eventId','commandId','kind',...(c.type==='payService'?['fundingLoanAmount','forcedDebtAmount']:[])];
 if(!['rollService','payService','finishService'].includes(c.type)||!['hospital','repair'].includes(c.kind)||Object.keys(c).some(k=>!fields.includes(k))||['roomId','sessionId','eventId','commandId'].some(k=>typeof c[k as keyof ServiceCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof ServiceCommand])))||['fundingLoanAmount','forcedDebtAmount'].some(k=>c[k as keyof ServiceCommand]!==undefined&&(!Number.isSafeInteger(c[k as keyof ServiceCommand])||Number(c[k as keyof ServiceCommand])<0||Number(c[k as keyof ServiceCommand])>1e12)))throw new HttpsError('invalid-argument','格子識別值或周轉選擇無效');
 return c;
}
export async function executeServiceCommand(db:Firestore,c:ServiceCommand,uid:string,now=Date.now(),candidateRoll=randomInt(1,7)) {
 if(!Number.isInteger(candidateRoll)||candidateRoll<1||candidateRoll>6)throw new HttpsError('internal','骰點產生失敗');
 const ref=db.doc(`rooms/${c.roomId}`),playerRef=ref.collection('players').doc(uid),receipt=ref.collection('serviceResults').doc(key(`${c.sessionId}:${uid}:${c.eventId}`)),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.eventId,c.kind,c.fundingLoanAmount||0,c.forcedDebtAmount||0]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);
  const [ps,saved,previous]=await Promise.all([tx.get(playerRef),tx.get(receipt),tx.get(intent)]);
  if(!rs.exists)throw new HttpsError('not-found','房間不存在');
  const room=rs.data() as Room,stored=saved.data();
  if(uid===room.hostId||!room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','不是本場玩家');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection')throw new HttpsError('failed-precondition','場次已更新或後端格子流程尚未啟用');
  if(previous.exists&&previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一命令不能更改內容');
  if(stored&&stored.kind!==c.kind)throw new HttpsError('failed-precondition','事件不能改為另一種格子');
  const commit=(result:any)=>{tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;};
  const original=c.type==='rollService'?stored?.rollResult:stored?.finishedResult;
  if(original){commit(original);return {...original,status:'duplicate'};}
  if(!ps.exists||!ps.data()?.isSetup)throw new HttpsError('failed-precondition','玩家資料尚未準備完成');
  const state=ps.data() as GameState,board=room.boardState,event=board?.currentEvent;
  if(room.status!=='playing'||!board||board.currentTurnUid!==uid||event?.id!==c.eventId||event.playerUid!==uid||event.type!==c.kind)throw new HttpsError('failed-precondition','格子事件已更新');
  const free=c.kind==='hospital'?event.hospitalFeeCoveredByInsurance===true:event.repairHasCar===false;
  const base={uid,sessionId:c.sessionId,eventId:c.eventId,kind:c.kind};
  if(c.type==='rollService') {
   if(free)throw new HttpsError('failed-precondition','本事件不需付費，請完成事件');
   if(c.kind==='repair'&&event.repairHasCar!==true)throw new HttpsError('failed-precondition','維修資格尚未確認');
   if(event.hospitalRoll||event.repairRoll)throw new HttpsError('failed-precondition','既有骰點缺少後端紀錄，請核對');
   const fee=candidateRoll*(c.kind==='hospital'?1000:2000),result={status:'applied',roll:candidateRoll,fee,presentationDurationMs:DICE_PRESENTATION_DURATION_MS};
   const next=appendDicePresentation({...board,currentEvent:{...event,...(c.kind==='hospital'?{hospitalRoll:candidateRoll,hospitalFee:fee}:{repairRoll:candidateRoll,repairFee:fee})},revision:(board.revision||0)+1,updatedAt:now},{id:c.commandId,sequence:(board.revision||0)+1,playerUid:uid,playerName:event.playerName||'玩家',kind:c.kind==='hospital'?'hospital-fee':'repair',sourceEventId:c.eventId,dice:[candidateRoll],total:candidateRoll,timestamp:now,detail:`費用 ${fee}`});
   tx.update(ref,{boardState:cleanObject(next)});tx.set(receipt,{...base,rollResult:result});return commit(result);
  }
  if(!free&&c.type==='finishService')return {status:'waiting',message:'費用尚未入帳，請完成財務檢核'};
  if(!free&&!stored?.rollResult)return {status:'waiting',message:'請先擲骰決定費用'};
  const advanced=buildBoardEventAdvanceState(room);if(!advanced?.boardState)return {status:'waiting',message:'尚有其他待辦，費用尚未入帳'};
  const fee=free?0:stored!.rollResult.fee;
  if(!Number.isFinite(state.cash)||state.cash<0||!Number.isSafeInteger(fee)||fee<0)throw new HttpsError('failed-precondition','財務或費用資料無效');
  if(c.fundingLoanAmount&&c.forcedDebtAmount)throw new HttpsError('invalid-argument','不可同時使用兩種周轉');
  const result={status:'applied',fee,completed:true};
  if(fee>0){
   const operation=`service:${c.sessionId}:${c.eventId}:${uid}`,shortfall=Math.max(0,fee-state.cash),paid=applyBoardTransaction(state,{name:c.kind==='hospital'?'棋盤事件：醫院醫藥費':'棋盤事件：維修廠保養費',amount:fee,cashChange:-fee,source:'cash',usage:'expense',boardEventId:operation,fundingLoanAmount:Math.min(c.fundingLoanAmount||0,shortfall),forcedDebtAmount:Math.min(c.forcedDebtAmount||0,shortfall)},{now,generateId:createSequentialIdGenerator(operation),financialAcceleration:room.financialAcceleration});
   if(paid.status!=='applied'){if(paid.status==='error'&&paid.code==='insufficient_cash')return {status:'requires_funding',shortfall:paid.shortfall,message:paid.message};throw new HttpsError('failed-precondition','費用未確認，請核對既有紀錄');}
   commitFinance(tx,ref,uid,state,withAutomaticHappiness(paid.state,room.financialAcceleration),room,operation,result);
  }
  const next=cleanObject({...advanced.boardState,revision:(board.revision||0)+1,updatedAt:now});tx.update(ref,{boardState:next});
  if(room.movementAuthority===MOVEMENT_AUTHORITY&&next.movement?.isActive)saveMovementTask(tx,ref,c.sessionId,next.movement);
  tx.set(receipt,{...base,rollResult:stored?.rollResult||null,finishedResult:result});return commit(result);
 });
}

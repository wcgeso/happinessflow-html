import {buildBoardEventAdvanceState} from '../../src/game/board/eventQueue';
import {MOVEMENT_AUTHORITY,saveMovementTask} from './movement';
import {drawBoardCard} from '../../src/game/board/movementResolution';
import {appendBoardCardLog} from '../../src/game/board/eventQueue';
import {randomInt,randomBytes} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room,GameState,TransactionData} from '../../src/types';
import {OPPORTUNITY_CARD_MAP} from '../../src/constants/cards';
import {buildPaidLearningContinuation,applyPaidLearningMove,completeLearningContinuation} from '../../src/game/board/continuation';
import {buildLifelongLearningSuccessState,buildSchoolPromotionState} from '../../src/game/finance/cardState';
import {applyBoardTransaction,createSequentialIdGenerator} from '../../src/game/finance/applyBoardTransaction';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {appendDicePresentation,DICE_PRESENTATION_DURATION_MS} from '../../src/game/board/dicePresentation';
import {cleanObject} from '../../src/utils/utils';
import {BANKING_AUTHORITY} from './banking';
import {key} from './commands';
import {commitFinance} from './financeCommit';
export type LearningCommand={type:'payLearning'|'rollLearning'|'paySchool'|'rollSchool'|'finishSchool'|'skipSchool'|'finishLearning'|'declineLearning';roomId:string;sessionId:string;commandId:string;eventId:string;fundingLoanAmount?:number;forcedDebtAmount?:number};
export function parseLearningCommand(data:unknown):LearningCommand {
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','學習操作無效');
 const c=data as LearningCommand,fields=['type','roomId','sessionId','commandId','eventId',...(typeof c.type==='string'&&c.type.startsWith('pay')?['fundingLoanAmount','forcedDebtAmount']:[])];
 if(!['payLearning','rollLearning','paySchool','rollSchool','finishSchool','skipSchool','finishLearning','declineLearning'].includes(c.type)||Object.keys(c).some(k=>!fields.includes(k))||['roomId','sessionId','commandId','eventId'].some(k=>typeof c[k as keyof LearningCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof LearningCommand])))||['fundingLoanAmount','forcedDebtAmount'].some(k=>c[k as keyof LearningCommand]!==undefined&&(!Number.isSafeInteger(c[k as keyof LearningCommand])||Number(c[k as keyof LearningCommand])<0||Number(c[k as keyof LearningCommand])>1e12)))throw new HttpsError('invalid-argument','學習選擇或識別值無效');
 return c;
}
export async function executeLearningCommand(db:Firestore,c:LearningCommand,uid:string,now=Date.now(),roll=randomInt(1,7)) {
 if(!Number.isInteger(roll)||roll<1||roll>6)throw new HttpsError('internal','學習骰點無效');
 const shuffleSeed=randomBytes(16).toString('hex');
 const ref=db.doc(`rooms/${c.roomId}`),player=ref.collection('players').doc(uid),receipt=ref.collection('learningResults').doc(key(`${c.sessionId}:${uid}:${c.eventId}`)),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`));
 const fingerprint=key(JSON.stringify([c.type,c.sessionId,c.eventId,c.fundingLoanAmount||0,c.forcedDebtAmount||0]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);
  const [ps,saved,previous]=await Promise.all([tx.get(player),tx.get(receipt),tx.get(intent)]);
  if(!rs.exists||!ps.exists)throw new HttpsError('not-found','房間或玩家不存在');
  const room=rs.data() as Room,state=ps.data() as GameState;
  if(!room.members?.some(m=>m.uid===uid&&!m.isLeft)||room.hostId===uid)throw new HttpsError('permission-denied','不是本場玩家');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection')throw new HttpsError('failed-precondition','場次已更新或後端學習尚未啟用');
  if(previous.exists&&previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一命令不可更改學習選擇');
  if(previous.data()?.result?.status==='applied')return {...previous.data()!.result,status:'duplicate',...(c.type.startsWith('roll')?{presentationDurationMs:0}:{})};
  const stored=saved.data(),resultField=c.type.startsWith('pay')?'paidResult':['finishSchool','skipSchool','finishLearning','declineLearning'].includes(c.type)?'finishedResult':'rollResult';
  if(stored&&Boolean(stored.cardId)===['paySchool','rollSchool','finishSchool','skipSchool'].includes(c.type))throw new HttpsError('failed-precondition','考試與終身學習事件不可混用');
  if(stored?.finishedKind&&['finishLearning','declineLearning'].includes(c.type)&&stored.finishedKind!==c.type)throw new HttpsError('already-exists','學習卡已完成其他選擇');
  if(stored?.[resultField]){const result=stored[resultField];tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return {...result,status:'duplicate',...(c.type.startsWith('roll')?{presentationDurationMs:0}:{})};}
  const board=room.boardState;
  if(room.status!=='playing'||!state.isSetup||!Number.isFinite(state.cash)||!board||board.currentTurnUid!==uid||board.currentEvent?.id!==c.eventId||board.currentEvent.playerUid!==uid)throw new HttpsError('failed-precondition','學習事件已更新');
  if(['paySchool','rollSchool','finishSchool','skipSchool'].includes(c.type)) {
   if(c.type==='skipSchool') {
    if(board.currentEvent.type!=='school')throw new HttpsError('failed-precondition','學校事件已更新');
    if(stored?.paidResult)return {status:'waiting',message:'已繳費，請完成考試與接續'};
    const advanced=buildBoardEventAdvanceState({...room,boardState:board});
    if(!advanced?.boardState)return {status:'waiting',message:'仍有其他待辦'};
    const next={...advanced.boardState,revision:(board.revision||0)+1,updatedAt:now};
    tx.update(ref,{boardState:cleanObject(next)});
    if(room.movementAuthority===MOVEMENT_AUTHORITY&&next.movement?.isActive)saveMovementTask(tx,ref,c.sessionId,next.movement);
    const result={status:'applied'};tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,finishedResult:result});tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;
   }
   if(board.currentEvent.type!=='school'||(c.type!=='finishSchool'&&!state.profession?.promotions?.[(state.currentRankLevel||1)-1]))throw new HttpsError('failed-precondition','目前沒有可執行的升等考試');
   if(c.type==='finishSchool') {
    if(!stored?.rollResult)return {status:'waiting',message:'等待升等考試判定'};
    if(board.currentCard||!board.deckState)throw new HttpsError('failed-precondition','考試接續資料不完整');
    let cursor=0;const drawn=drawBoardCard(board.deckState,'happiness',state,()=>parseInt(key(`${shuffleSeed}:${cursor++}`).slice(0,8),16)/2**32);
    if(!drawn)throw new HttpsError('failed-precondition','幸福牌堆沒有可用卡片，待辦保留');
    const eventId=`exam-followup:${key(`${c.sessionId}:${uid}:${c.eventId}`).slice(0,24)}`;
    const event={id:eventId,playerUid:uid,playerName:room.members.find(m=>m.uid===uid)?.name||'玩家',type:'exam_happiness' as const,summary:'升等考試後抽到幸福卡',detail:drawn.card.title,squareIndex:board.playerPositions?.[uid]||0,timestamp:now};
    const result={status:'applied',eventId,cardId:drawn.card.cardId};
    tx.update(ref,{boardState:cleanObject({...board,deckState:drawn.deckState,currentEvent:event,currentCard:drawn.card,currentCardReveal:{eventId,cardId:drawn.card.cardId,isRevealed:false},cardLog:appendBoardCardLog(board,drawn.card,event),revision:(board.revision||0)+1,updatedAt:now})});
    tx.update(receipt,{finishedResult:result});tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;
   }
   let after=state;
   if(!stored?.paidResult) {
    if(c.fundingLoanAmount&&c.forcedDebtAmount)throw new HttpsError('invalid-argument','不可同時使用兩種周轉');
    const shortfall=Math.max(0,1000-state.cash);
    const paid=applyBoardTransaction(state,{name:'升等考試報名費',amount:1000,cashChange:-1000,source:'cash',usage:'expense',boardEventId:`school-fee:${c.eventId}`,fundingLoanAmount:Math.min(c.fundingLoanAmount||0,shortfall),forcedDebtAmount:Math.min(c.forcedDebtAmount||0,shortfall)},{now,generateId:createSequentialIdGenerator(`${c.commandId}:fee`),financialAcceleration:room.financialAcceleration});
    if(paid.status==='error'){if(paid.code==='insufficient_cash'){if(c.type==='rollSchool')throw new HttpsError('failed-precondition','請先完成考試報名費的財務檢核');return {status:'requires_funding',shortfall:paid.shortfall,message:paid.message};}throw new HttpsError('failed-precondition',paid.message);}
    if(paid.status==='duplicate')throw new HttpsError('failed-precondition','舊版考試付款需要核對');
    after=paid.state;
   }
   let result:any={status:'applied'};
   after={...after,schoolExam:{sessionId:c.sessionId,eventId:c.eventId,phase:'paid'}};
   if(c.type==='rollSchool') {
    const target=(state.currentRankLevel||1)+1,success=roll>=target;
    const outcome=buildSchoolPromotionState(after,success,c.commandId,now);after=outcome.state;
    result={status:'applied',roll,dice:[roll],total:roll,target,success,bonus:outcome.bonus,newTitle:outcome.newTitle||'',presentationDurationMs:DICE_PRESENTATION_DURATION_MS};
    after.schoolExam={sessionId:c.sessionId,eventId:c.eventId,phase:'completed',result};
    tx.update(ref,{boardState:cleanObject(appendDicePresentation({...board,revision:(board.revision||0)+1,updatedAt:now},{id:c.commandId,sequence:(board.revision||0)+1,playerUid:uid,playerName:room.members.find(m=>m.uid===uid)?.name||'玩家',kind:'school-exam',sourceEventId:c.eventId,dice:[roll],total:roll,target,success,bonus:outcome.bonus,newTitle:outcome.newTitle||'',timestamp:now}))});
   }
   commitFinance(tx,ref,uid,state,withAutomaticHappiness(after,room.financialAcceleration),room,c.commandId,result);
   tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,paidResult:stored?.paidResult||{status:'applied'},...(c.type==='rollSchool'?{rollResult:result}:{})},{merge:true});
   tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;
  }
  if(board.currentCard?.deck!=='opportunity'||board.currentCardReveal?.eventId!==c.eventId||board.currentCardReveal?.cardId!==board.currentCard.cardId||!board.currentCardReveal.isRevealed)throw new HttpsError('failed-precondition','學習卡尚未翻開');
  const card=OPPORTUNITY_CARD_MAP[board.currentCard.cardId],types={ability_profession:'enhance_profession',ability_stock:'stock_ability',ability_realestate:'real_estate_ability'} as const,kind=card&&types[card.type as keyof typeof types];
  if(!kind)throw new HttpsError('failed-precondition','目前不是終身學習卡');
  if(c.type==='finishLearning'||c.type==='declineLearning') {
   if(c.type==='finishLearning'&&(!stored?.rollResult||board.pendingContinuation?.phase!=='completed'||board.pendingContinuation.sourceEventId!==c.eventId))return {status:'waiting',message:'等待已付款的學習判定'};
   if(c.type==='declineLearning'&&stored?.paidResult)return {status:'waiting',message:'已付款，請接續學習判定'};
   const advanced=buildBoardEventAdvanceState({...room,boardState:board});
   if(!advanced?.boardState)return {status:'waiting',message:'仍有其他必要操作'};
   const completedLog=appendBoardCardLog(board,board.currentCard,board.currentEvent);
   const cardLog=advanced.boardState.currentCard?appendBoardCardLog({...board,cardLog:completedLog},advanced.boardState.currentCard,advanced.boardState.currentEvent):completedLog;
   const next=cleanObject({...advanced.boardState,pendingContinuation:null,cardLog,revision:(board.revision||0)+1,updatedAt:now});
   tx.update(ref,{boardState:next});
   if(room.movementAuthority===MOVEMENT_AUTHORITY&&next.movement?.isActive)saveMovementTask(tx,ref,c.sessionId,next.movement);
   const result={status:'applied'};tx.set(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,cardId:card.id,finishedResult:result,finishedKind:c.type},{merge:true});tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;
  }
  let after:GameState,next=board,result:any;
  if(c.type==='payLearning') {
   const fee=Number(card.schoolFee||0),shortfall=Math.max(0,fee-state.cash);
   if(c.fundingLoanAmount&&c.forcedDebtAmount)throw new HttpsError('invalid-argument','不可同時使用兩種周轉');
   const data:TransactionData={name:`機運卡：${card.title}（接受）`,amount:fee,cashChange:-fee,source:'cash',usage:'lifelong_learning',boardFlow:'board-card',boardEventId:`learning-payment:${c.eventId}`,lifelongLearningPayload:{learningType:kind,requiredRoll:card.diceRequirement||2},fundingLoanAmount:Math.min(c.fundingLoanAmount||0,shortfall),forcedDebtAmount:Math.min(c.forcedDebtAmount||0,shortfall)};
   const applied=applyBoardTransaction(state,data,{now,generateId:createSequentialIdGenerator(c.commandId),financialAcceleration:room.financialAcceleration});
   if(applied.status==='error'){if(applied.code==='insufficient_cash')return {status:'requires_funding',shortfall:applied.shortfall,message:applied.message};throw new HttpsError('failed-precondition',applied.message);}
   if(applied.status==='duplicate')throw new HttpsError('failed-precondition','舊版學習付款需要核對');
   const pending=buildPaidLearningContinuation(room,uid,data,c.commandId,now)!;
   const moved=applyPaidLearningMove(board,applied.state,pending);after=moved.state;next=moved.boardState;
   result={status:'applied',continuation:pending};
   tx.create(receipt,{uid,sessionId:c.sessionId,eventId:c.eventId,cardId:card.id,paidResult:result});
  }else {
   const pending=board.pendingContinuation;
   if(!stored?.paidResult||pending?.phase!=='awaiting_roll'||pending.kind!=='lifelong-learning'||pending.playerUid!==uid||pending.sessionId!==c.sessionId||pending.sourceEventId!==c.eventId||pending.cardId!==card.id||pending.learningType!==kind)throw new HttpsError('failed-precondition','尚未完成學習付款');
   const target=card.diceRequirement||2,success=roll>=target;
   after=success?buildLifelongLearningSuccessState(state,kind,c.commandId,now):{...state,history:[{id:c.commandId,timestamp:now,name:'終身學習判定未達標',amount:0,sourceLabel:'事件',usageLabel:'學習結果',cashChange:0,balance:state.cash,details:JSON.stringify({kind,roll,target,success}),flowType:'其它'},...(state.history||[])]};
   result={status:'applied',roll,dice:[roll],total:roll,target,success,bonus:0,newTitle:after.currentRankTitle||'',presentationDurationMs:DICE_PRESENTATION_DURATION_MS};
   next=appendDicePresentation({...board,pendingContinuation:completeLearningContinuation(pending,uid,kind,c.eventId,result)},{id:c.commandId,sequence:(board.revision||0)+1,playerUid:uid,playerName:room.members.find(m=>m.uid===uid)?.name||'玩家',kind:'lifelong-learning',sourceEventId:c.eventId,dice:[roll],total:roll,target,success,timestamp:now});
   tx.update(receipt,{rollResult:result});
  }
  commitFinance(tx,ref,uid,state,withAutomaticHappiness(after,room.financialAcceleration),room,c.commandId,result);
  tx.update(ref,{boardState:cleanObject({...next,revision:(board.revision||0)+1,updatedAt:now})});
  tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;
 });
}

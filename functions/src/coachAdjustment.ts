import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {GameState,Room,Transaction,CoachExpenseCategory} from '../../src/types';
import {applyPlayerExpenseAdjustment,applyPlayerLiabilityAdjustment} from '../../src/utils/coachAdjustments';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {commitFinance} from './financeCommit';
import {BANKING_AUTHORITY} from './banking';
import {key} from './commands';
import {ROOM_PLAYER_SLOT_COUNT} from '../../src/utils/roomPlayerSlots';
import {STOCK_DATA,STOCK_SYMBOLS,BUBBLE_BURST_CODES} from '../../src/constants';
import {applyPublicFinancialEffect,isValidMarketPlayerState} from '../../src/game/finance/publicEffects';
export type CoachAccelerationCommand={type:'coachAcceleration';roomId:string;sessionId:string;commandId:string;multiplier:1|1.5|2|3};
export function parseCoachAccelerationCommand(data:unknown):CoachAccelerationCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','收益倍率資料無效');const c=data as CoachAccelerationCommand;
 if(c.type!=='coachAcceleration'||Object.keys(c).some(k=>!['type','roomId','sessionId','commandId','multiplier'].includes(k))||['roomId','sessionId','commandId'].some(k=>typeof c[k as keyof CoachAccelerationCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof CoachAccelerationCommand])))||![1,1.5,2,3].includes(c.multiplier))throw new HttpsError('invalid-argument','收益倍率或識別值無效');return c;
}
export async function executeCoachAccelerationCommand(db:Firestore,c:CoachAccelerationCommand,actor:string,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),intent=ref.collection('gameCommands').doc(key(`${actor}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.multiplier]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(actor!==room.hostId||!room.members?.some(m=>m.uid===actor&&!m.isLeft))throw new HttpsError('permission-denied','只有本場執行師能調整收益倍率');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1)throw new HttpsError('failed-precondition','場次已更新或未啟用後端財務');
  const saved=await tx.get(intent);if(saved.exists){if(saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一倍率命令不能更換內容');return {...saved.data()!.result,status:'duplicate'};}
  if(room.status!=='playing')throw new HttpsError('failed-precondition','遊戲尚未開始或已結束');
  const changed=(room.financialAcceleration?.multiplier||1)!==c.multiplier,acceleration=changed?{multiplier:c.multiplier,updatedAt:now,updatedByUid:actor,updatedByName:room.members.find(m=>m.uid===actor)?.name||actor}:room.financialAcceleration||{multiplier:1},result={status:'applied',changed,acceleration};
  if(changed)tx.update(ref,{financialAcceleration:acceleration});tx.create(intent,{uid:actor,sessionId:c.sessionId,fingerprint,result});return result;
 });
}
export type CoachMarketCommand={type:'coachMarket';roomId:string;sessionId:string;commandId:string;code:string};
export function parseCoachMarketCommand(data:unknown):CoachMarketCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','行情資料無效');const c=data as CoachMarketCommand;
 if(c.type!=='coachMarket'||Object.keys(c).some(k=>!['type','roomId','sessionId','commandId','code'].includes(k))||['roomId','sessionId','commandId'].some(k=>typeof c[k as keyof CoachMarketCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof CoachMarketCommand])))||typeof c.code!=='string'||!Object.hasOwn(STOCK_DATA,c.code))throw new HttpsError('invalid-argument','行情代碼或識別值無效');return c;
}
export async function executeCoachMarketCommand(db:Firestore,c:CoachMarketCommand,actor:string,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),intent=ref.collection('gameCommands').doc(key(`${actor}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.code]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(actor!==room.hostId||!room.members?.some(m=>m.uid===actor&&!m.isLeft))throw new HttpsError('permission-denied','只有本場執行師能發布行情');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection'||Object.keys(room.playerStates||{}).length)throw new HttpsError('failed-precondition','場次已更新或未啟用後端財務');
  const saved=await tx.get(intent);if(saved.exists){if(saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一行情命令不能更換代碼');return {...saved.data()!.result,status:'duplicate'};}
  const uids=room.members.filter(m=>m.uid!==room.hostId&&!m.isLeft).map(m=>m.uid),previous=room.marketPrices||{},prices=STOCK_DATA[c.code];
  if(room.status!=='playing'||!uids.length||uids.length>ROOM_PLAYER_SLOT_COUNT||new Set(uids).size!==uids.length||uids.some(uid=>typeof uid!=='string'||!/^[\w.-]{1,512}$/.test(uid))||STOCK_SYMBOLS.some(symbol=>previous[symbol]!==undefined&&(!Number.isSafeInteger(previous[symbol])||previous[symbol]<0)))throw new HttpsError('failed-precondition','場次、玩家清單或現有股價資料無效');
  const snapshots=await Promise.all(uids.map(uid=>tx.get(ref.collection('players').doc(uid)))),states=snapshots.map(s=>s.data() as GameState);
  if(snapshots.some((s,i)=>!s.exists||!states[i]?.isSetup||!isValidMarketPlayerState(states[i])))throw new HttpsError('failed-precondition','必要玩家資料不完整，行情尚未發布');
  let totalPrevious=0,totalCurrent=0;for(const symbol of STOCK_SYMBOLS)if(previous[symbol]>0){totalPrevious+=previous[symbol];totalCurrent+=prices[symbol];}
  if(!Number.isSafeInteger(totalPrevious)||!Number.isSafeInteger(totalCurrent))throw new HttpsError('failed-precondition','股價總額超出可處理範圍');
  const isBubble=BUBBLE_BURST_CODES.includes(c.code)||(totalPrevious>0&&(totalPrevious-totalCurrent)/totalPrevious>=0.65),operation=`coach-market:${key(`${actor}:${c.commandId}`)}`,payload={updates:prices,code:c.code,isBubble,timestamp:now},result={status:'applied',marketUpdates:payload},effect={id:operation,sessionId:c.sessionId,timestamp:now,kind:'market' as const,sourcePlayerUid:actor,payload};
  const after=states.map((state,i)=>withAutomaticHappiness(applyPublicFinancialEffect(state,effect,uids[i]),room.financialAcceleration));
  after.forEach((state,i)=>commitFinance(tx,ref,uids[i],states[i],state,room,operation,result));
  tx.update(ref,{previousMarketPrices:previous,marketPrices:prices,marketUpdates:payload});tx.create(intent,{uid:actor,sessionId:c.sessionId,fingerprint,result});return result;
 });
}
export type CoachSubsidyCommand={type:'coachSubsidy';roomId:string;sessionId:string;commandId:string;amount:number};
export function parseCoachSubsidyCommand(data:unknown):CoachSubsidyCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','補助資料無效');const c=data as CoachSubsidyCommand;
 if(c.type!=='coachSubsidy'||Object.keys(c).some(k=>!['type','roomId','sessionId','commandId','amount'].includes(k))||['roomId','sessionId','commandId'].some(k=>typeof c[k as keyof CoachSubsidyCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof CoachSubsidyCommand])))||!Number.isSafeInteger(c.amount)||c.amount<=0||c.amount>1e12)throw new HttpsError('invalid-argument','補助金額或識別值無效');return c;
}
export async function executeCoachSubsidyCommand(db:Firestore,c:CoachSubsidyCommand,actor:string,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),intent=ref.collection('gameCommands').doc(key(`${actor}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.amount]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(actor!==room.hostId||!room.members?.some(m=>m.uid===actor&&!m.isLeft))throw new HttpsError('permission-denied','只有本場執行師能發放補助');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection'||Object.keys(room.playerStates||{}).length)throw new HttpsError('failed-precondition','場次已更新或未啟用後端財務');
  const saved=await tx.get(intent);if(saved.exists){if(saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一補助不能更換內容');return {...saved.data()!.result,status:'duplicate'};}
  const playerUids=room.members.filter(m=>m.uid!==room.hostId&&!m.isLeft).map(m=>m.uid),previous=room.financialSubsidy?.sequence??0;
  if(room.status!=='playing'||!playerUids.length||playerUids.length>ROOM_PLAYER_SLOT_COUNT||new Set(playerUids).size!==playerUids.length||playerUids.some(uid=>typeof uid!=='string'||!/^[\w.-]{1,512}$/.test(uid))||!Number.isSafeInteger(previous)||previous<0||!Number.isSafeInteger(previous+1))throw new HttpsError('failed-precondition','場次、玩家清單或補助紀錄無效，尚未發放');
  const snapshots=await Promise.all(playerUids.map(uid=>tx.get(ref.collection('players').doc(uid))));
  const states=snapshots.map(s=>s.data() as GameState);
  if(snapshots.some((s,i)=>!s.exists||!states[i]?.isSetup||!Number.isSafeInteger(states[i].cash)||states[i].cash<0||!Number.isSafeInteger(states[i].cash+c.amount)||!Array.isArray(states[i].history)||!Array.isArray(states[i].assets)||!Array.isArray(states[i].liabilities)||!Array.isArray(states[i].happiness)))throw new HttpsError('failed-precondition','有玩家財務資料未準備完成或超出範圍，補助尚未發放');
  const subsidy={sequence:previous+1,amount:c.amount,grantedAt:now,grantedByUid:actor,grantedByName:room.members.find(m=>m.uid===actor)?.name||actor,playerUids},result={status:'applied',subsidy},operation=`coach-subsidy:${key(`${actor}:${c.commandId}`)}`;
  states.forEach((state,i)=>{const cash=state.cash+c.amount,record:Transaction={id:operation,name:'執行師全體補助',amount:c.amount,sourceLabel:'執行師補助',usageLabel:'全體補助',cashChange:c.amount,balance:cash,timestamp:now,details:`第 ${subsidy.sequence} 次全體補助，由 ${subsidy.grantedByName} (${actor}) 發放，不套用收益倍率`,flowType:'其它',incomeMultiplierEligible:false};commitFinance(tx,ref,playerUids[i],state,{...state,cash,history:[...state.history,record]},room,operation,result);});
  tx.update(ref,{financialSubsidy:subsidy});tx.create(intent,{uid:actor,sessionId:c.sessionId,fingerprint,result});return result;
 });
}
export type CoachAdjustmentCommand={type:'coachAdjustment';roomId:string;sessionId:string;commandId:string;playerUid:string;action:'cash'|'income'|'liability'|'expense';amount?:number;liabilityId?:string;totalOwedDelta?:number;monthlyPaymentDelta?:number;category?:CoachExpenseCategory;reason?:string};
export function parseCoachAdjustmentCommand(data:unknown):CoachAdjustmentCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','執行師調整資料無效');
 const c=data as CoachAdjustmentCommand,fields=['type','roomId','sessionId','commandId','playerUid','action',...(c.action==='liability'?['liabilityId','totalOwedDelta','monthlyPaymentDelta','reason']:c.action==='expense'?['category','amount','reason']:['amount'])],deltas=c.action==='liability'?[c.totalOwedDelta,c.monthlyPaymentDelta]:[c.amount];
 if(c.type!=='coachAdjustment'||!['cash','income','liability','expense'].includes(c.action)||Object.keys(c).some(k=>!fields.includes(k))||['roomId','sessionId','commandId','playerUid',...(c.action==='liability'?['liabilityId']:[])].some(k=>typeof c[k as keyof CoachAdjustmentCommand]!=='string'||!(k==='liabilityId'?/^[\w:.#-]{1,512}$/:/^[\w:.-]{1,512}$/).test(String(c[k as keyof CoachAdjustmentCommand])))||deltas.some(n=>!Number.isSafeInteger(n)||Math.abs(n!)>1e12)||deltas.every(n=>n===0)||(c.action==='expense'&&!['basicLiving','transportEdu','otherMedicalChild'].includes(c.category!))||(['expense','liability'].includes(c.action)&&(typeof c.reason!=='string'||!c.reason.trim()||c.reason.length>500)))throw new HttpsError('invalid-argument','調整種類、金額、識別值或原因無效');
 return c;
}
export async function executeCoachAdjustmentCommand(db:Firestore,c:CoachAdjustmentCommand,actor:string,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),player=ref.collection('players').doc(c.playerUid),intent=ref.collection('gameCommands').doc(key(`${actor}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.playerUid,c.action,c.amount??null,c.liabilityId??null,c.totalOwedDelta??null,c.monthlyPaymentDelta??null,c.category??null,c.reason??null]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(actor!==room.hostId||!room.members?.some(m=>m.uid===actor&&!m.isLeft))throw new HttpsError('permission-denied','只有本場執行師能調整');
  if(room.sessionId!==c.sessionId||room.bankingAuthority!==BANKING_AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection'||Object.keys(room.playerStates||{}).length)throw new HttpsError('failed-precondition','場次已更新或未啟用後端財務');
  const [saved,ps]=await Promise.all([tx.get(intent),tx.get(player)]);
  if(saved.exists){if(saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一調整不能更換內容或玩家');return {...saved.data()!.result,status:'duplicate'};}
  if(room.status!=='playing'||c.playerUid===room.hostId||!room.members.some(m=>m.uid===c.playerUid&&!m.isLeft)||!ps.exists||!ps.data()?.isSetup)throw new HttpsError('failed-precondition','目標玩家已離開或資料尚未準備完成');
  const state=ps.data() as GameState;
  if(!Number.isSafeInteger(state.cash)||state.cash<0||!Array.isArray(state.assets)||!Array.isArray(state.liabilities)||!Array.isArray(state.history)||!Array.isArray(state.happiness)||!state.expenses||!state.income||Object.values(state.expenses).some(n=>!Number.isSafeInteger(n)||Number(n)<0)||Object.values(state.income).some(n=>!Number.isSafeInteger(n)||Number(n)<0)||state.liabilities.some(l=>!Number.isSafeInteger(l.totalOwed)||l.totalOwed<0||!Number.isSafeInteger(l.monthlyPayment)||l.monthlyPayment<0))throw new HttpsError('failed-precondition','目標財務資料不完整，調整保留');
  const operation=`coach-adjustment:${key(`${actor}:${c.commandId}`)}`,actorName=room.members.find(m=>m.uid===actor)?.name||actor,categoryLabels={basicLiving:'基本生活',transportEdu:'交通教育',otherMedicalChild:'其他醫療育兒'};
  let after=state,name='',details=`執行師 ${actorName} (${actor})`,amount=Math.abs(c.amount||0),flowType:Transaction['flowType']='其它',usageLabel='';
  try{
   if(c.action==='cash'){const cash=state.cash+c.amount!;if(cash<0||!Number.isSafeInteger(cash))throw new Error('玩家現金不足或超出可處理範圍');after={...state,cash};name=c.amount!>0?'執行師增加現金':'執行師扣除現金';usageLabel='現金調整';}
   else if(c.action==='income'){const investment=(state.income.investment||0)+c.amount!;if(investment<0||!Number.isSafeInteger(investment))throw new Error('玩家理財收入不足或超出可處理範圍');after={...state,income:{...state.income,investment}};name=c.amount!>0?'執行師增加理財收入':'執行師扣除理財收入';usageLabel='理財收入調整';flowType='投資';details+='；後續月結套用房間收益倍率';}
   else if(c.action==='liability'){const applied=applyPlayerLiabilityAdjustment(state,c.liabilityId!,c.totalOwedDelta!,c.monthlyPaymentDelta!);if(!Number.isSafeInteger(applied.after.totalOwed)||!Number.isSafeInteger(applied.after.monthlyPayment))throw new Error('負債超出可處理範圍');after=applied.state;name=`執行師調整負債：${applied.liabilityName}`;usageLabel='負債調整';flowType='融資';amount=Math.abs(c.totalOwedDelta!)+Math.abs(c.monthlyPaymentDelta!);details+=`；原因：${c.reason!.trim()}；本金 ${applied.before.totalOwed} → ${applied.after.totalOwed}；每月還款 ${applied.before.monthlyPayment} → ${applied.after.monthlyPayment}`;}
   else{const applied=applyPlayerExpenseAdjustment(state,c.category!,c.amount!);if(!Number.isSafeInteger(applied.after))throw new Error('支出超出可處理範圍');after=applied.state;name=`執行師調整每月支出：${categoryLabels[c.category!]}`;usageLabel='每月支出調整';flowType='生活';details+=`；原因：${c.reason!.trim()}；${applied.before} → ${applied.after} / 月`;}
  }catch(error){throw new HttpsError('failed-precondition',error instanceof Error?error.message:'調整無法完成');}
  const record:Transaction={id:operation,name,amount,sourceLabel:'執行師調整',usageLabel,cashChange:after.cash-state.cash,balance:after.cash,timestamp:now,details,flowType,...(c.action==='income'?{incomeMultiplierEligible:true,originalAmount:amount,appliedMultiplier:1}:{})},result={status:'applied',playerUid:c.playerUid};
  commitFinance(tx,ref,c.playerUid,state,withAutomaticHappiness({...after,history:[...state.history,record]},room.financialAcceleration),room,operation,result);
  tx.create(intent,{uid:actor,sessionId:c.sessionId,fingerprint,result});return result;
 });
}

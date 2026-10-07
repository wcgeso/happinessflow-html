import {commitFinance} from './financeCommit';
import {ENTERPRISES,STOCK_SYMBOLS,DREAMS} from '../../src/constants';
import {appendDicePresentation} from '../../src/game/board/dicePresentation';
import {resolveStartupUpgradeTarget,getPendingStartupUpgradeActions} from '../../src/game/finance/cardState';
import {buildTargetEnterprisePurchaseState,buildStartupUpgradeState} from '../../src/game/finance/cardState';
import {randomInt} from 'node:crypto';
import {saveMovementTask,MOVEMENT_AUTHORITY} from './movement';
import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {GameState,Room,TransactionData} from '../../src/types';
import {CAR_PRICE,MIN_CAR_DOWN_PAYMENT,buildLoanBorrowState,buildLoanRepaymentState,buildStockTradeState,buildCarPurchaseState,buildInsurancePurchaseState,buildDepositPurchaseState,buildDepositWithdrawalState,buildManualAssetSaleState,buildDreamPurchaseState} from '../../src/game/finance/personalState';
import {applyPaydayCollection,createSequentialIdGenerator} from '../../src/game/finance/applyBoardTransaction';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
import {getRemainingCreditCapacity} from '../../src/utils/financialRules';
import {buildBoardEventAdvanceState} from '../../src/game/board/eventQueue';
import {cleanObject} from '../../src/utils/utils';
import {key} from './commands';
export const BANKING_AUTHORITY='server-banking-v1';
export type BankingCommand={type:'borrowLoan'|'repayLoan'|'collectPayday'|'finishBank'|'purchaseEnterprise'|'upgradeStartup'|'rollStartup'|'deferStartup'|'tradeStock'|'purchaseCar'|'purchaseInsurance'|'purchaseDeposit'|'withdrawDeposit'|'sellAssets'|'purchaseDream';dreamId?:string;roomId:string;sessionId:string;commandId:string;amount?:number;liabilityId?:string;eventId?:string;enterpriseId?:string;assetId?:string;cardId?:string;fundingLoanAmount?:number;forcedDebtAmount?:number;stage?:1|2;mode?:'buy'|'sell';trades?:{symbol:string;qty:number;expectedPrice:number}[];cashContribution?:number;insuranceType?:'medical'|'house'|'aircraft';targetAssetIds?:string[];sales?:{assetId:string;price:number}[]};
const personalTypes=['tradeStock','purchaseCar','purchaseInsurance','purchaseDeposit','withdrawDeposit','sellAssets','purchaseDream'];
export type BankingResult={status:'applied'|'duplicate'|'waiting'|'requires_funding';phase?:'collected'|'completed';message?:string;roll?:number;eligible?:boolean;shortfall?:number};
export function parseBankingCommand(data:unknown):BankingCommand {
  if(!data || typeof data!=='object' || Array.isArray(data))throw new HttpsError('invalid-argument','交易資料無效');
  const c=data as BankingCommand;
  const extra=c.type==='purchaseDream'?['dreamId']:c.type==='sellAssets'?['sales']:c.type==='tradeStock'?['mode','trades']:c.type==='purchaseCar'?['cashContribution']:c.type==='purchaseInsurance'?['insuranceType','targetAssetIds']:c.type==='purchaseDeposit'?['amount']:c.type==='withdrawDeposit'?['amount','assetId']:c.type==='rollStartup'?['assetId','cardId','stage','eventId']:c.type==='purchaseEnterprise'?['enterpriseId','fundingLoanAmount','forcedDebtAmount']:['upgradeStartup','deferStartup'].includes(c.type)?['assetId','cardId','eventId']:c.type==='borrowLoan'?['amount']:c.type==='repayLoan'?['amount','liabilityId']:['eventId'];
  const fields=['type','roomId','sessionId','commandId',...extra];
  if(!['borrowLoan','repayLoan','collectPayday','finishBank','purchaseEnterprise','upgradeStartup','rollStartup','deferStartup',...personalTypes].includes(c.type) || Object.keys(c).some(f=>!fields.includes(f)) ||
    ['type','roomId','sessionId','commandId',...(extra.includes('liabilityId')?['liabilityId']:[]),...extra.filter(f=>['eventId','enterpriseId','assetId','cardId','dreamId'].includes(f))].some(f=>typeof c[f as keyof BankingCommand]!=='string' || !(['commandId','assetId','liabilityId'].includes(f)?/^[\w:.#-]{1,512}$/:/^[\w:.-]{1,512}$/).test(String(c[f as keyof BankingCommand]))) ||
    (extra.includes('amount') && (!Number.isSafeInteger(c.amount) || c.amount!<=0 || c.amount!>1e12)) ||
    (c.type==='rollStartup' && c.stage!==1 && c.stage!==2) ||
    ['fundingLoanAmount','forcedDebtAmount'].some(f=>c[f as keyof BankingCommand]!==undefined && (!Number.isSafeInteger(c[f as keyof BankingCommand]) || Number(c[f as keyof BankingCommand])<0 || Number(c[f as keyof BankingCommand])>1e12)))
    throw new HttpsError('invalid-argument','交易類型、金額或識別值無效');
  if(c.type==='sellAssets'&&(!Array.isArray(c.sales)||!c.sales.length||c.sales.length>100||new Set(c.sales.map(s=>s?.assetId)).size!==c.sales.length||c.sales.some(s=>!s||Object.keys(s).some(k=>!['assetId','price'].includes(k))||typeof s.assetId!=='string'||!/^[\w:.#-]{1,512}$/.test(s.assetId)||!Number.isSafeInteger(s.price)||s.price<=0||s.price>1e12)))throw new HttpsError('invalid-argument','出售資產或售價無效');
  if(c.type==='tradeStock'&&(!['buy','sell'].includes(c.mode!)||!Array.isArray(c.trades)||!c.trades.length||c.trades.length>STOCK_SYMBOLS.length||new Set(c.trades.map(t=>t?.symbol)).size!==c.trades.length||c.trades.some(t=>!t||Object.keys(t).some(k=>!['symbol','qty','expectedPrice'].includes(k))||!STOCK_SYMBOLS.includes(t.symbol)||!Number.isSafeInteger(t.qty)||t.qty<1||t.qty>1e6||!Number.isSafeInteger(t.expectedPrice)||t.expectedPrice<=0||t.expectedPrice>1e12)))throw new HttpsError('invalid-argument','股票種類、數量或預期價格無效');
  if(c.type==='purchaseCar'&&(!Number.isSafeInteger(c.cashContribution)||c.cashContribution!<MIN_CAR_DOWN_PAYMENT||c.cashContribution!>CAR_PRICE))throw new HttpsError('invalid-argument',`汽車自備款需介於 ${MIN_CAR_DOWN_PAYMENT.toLocaleString()} 到 ${CAR_PRICE.toLocaleString()}`);
  if(c.type==='purchaseInsurance'&&(!['medical','house','aircraft'].includes(c.insuranceType!)||(c.insuranceType==='house'?(!Array.isArray(c.targetAssetIds)||!c.targetAssetIds.length||c.targetAssetIds.length>50||new Set(c.targetAssetIds).size!==c.targetAssetIds.length||c.targetAssetIds.some(id=>typeof id!=='string'||!/^[\w:.#-]{1,512}$/.test(id))):c.targetAssetIds!==undefined)))throw new HttpsError('invalid-argument','保險種類或房屋識別值無效');
  if(['purchaseDeposit','withdrawDeposit'].includes(c.type)&&c.amount!%10000!==0)throw new HttpsError('invalid-argument','定存與解約金額需為 10,000 的倍數');
  return c;
}
export async function executeBankingCommand(db:Firestore,c:BankingCommand,uid:string,now=Date.now()):Promise<BankingResult> {
  const candidateRoll=randomInt(1,7);
  const roomRef=db.doc(`rooms/${c.roomId}`),playerRef=roomRef.collection('players').doc(uid);
  const intentRef=roomRef.collection('gameCommands').doc(key(`${uid}:${c.commandId}`));
  const fingerprint=key(JSON.stringify(personalTypes.includes(c.type)?[c.type,c.roomId,c.sessionId,c.amount??null,c.assetId??null,c.mode??null,c.trades??null,c.cashContribution??null,c.insuranceType??null,c.targetAssetIds??null,...(c.type==='sellAssets'?[c.sales]:c.type==='purchaseDream'?[c.dreamId]:[])]:[c.type,c.roomId,c.sessionId,c.amount??null,c.liabilityId??null,c.eventId??null,c.enterpriseId??null,c.assetId??null,c.cardId??null,c.fundingLoanAmount??0,c.forcedDebtAmount??0,c.stage??null]));
  const upgradeRef=c.assetId&&c.eventId?roomRef.collection('startupRolls').doc(key(`${c.sessionId}:${uid}:${c.assetId}:${c.eventId}`)):null;
  const settlementRef=c.eventId && ['collectPayday','finishBank'].includes(c.type)?roomRef.collection('bankSettlements').doc(key(`${c.sessionId}:${uid}:${c.eventId}`)):null;
  return db.runTransaction(async tx=>{
    const rs=await tx.get(roomRef);
  const [ps,intent,settlement,upgrade]=await Promise.all([tx.get(playerRef),tx.get(intentRef),settlementRef?tx.get(settlementRef):Promise.resolve(null),upgradeRef?tx.get(upgradeRef):Promise.resolve(null)]);
    if(!rs.exists || !ps.exists)throw new HttpsError('not-found','房間或玩家資料不存在');
    const room=rs.data() as Room & {bankingAuthority?:string};
    if(uid===room.hostId||!room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','目前不是房間玩家');
    if(room.sessionId!==c.sessionId || room.bankingAuthority!==BANKING_AUTHORITY || room.financialHistoryStorage!=='subcollection' || room.syncSchemaVersion!==2 || room.flowSchemaVersion!==1 || Object.keys(room.playerStates||{}).length>0)
      throw new HttpsError('failed-precondition','場次已更新或未啟用後端銀行');
    if(intent.exists && intent.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作識別值不可更改內容');
    if(intent.exists && intent.data()!.result.status==='applied')return {...intent.data()!.result,status:'duplicate'};
    if(settlement?.exists && (c.type==='collectPayday' || settlement.data()!.phase==='completed')) {
      const result:BankingResult={status:'duplicate',phase:settlement.data()!.phase};
      tx.set(intentRef,{uid,sessionId:c.sessionId,fingerprint,result:{...result,status:'applied'}});return result;
    }
    if(room.status!=='playing')throw new HttpsError('failed-precondition','遊戲尚未進行或已結束');
    const state=ps.data() as GameState;
    if(!state.isSetup || !Number.isFinite(state.cash) || state.cash<0 || !Array.isArray(state.assets) || !Array.isArray(state.liabilities) || !Array.isArray(state.history) ||
      !Number.isFinite(state.profession?.salary) || state.profession!.salary<0 || !Number.isFinite(state.loans??0) || (state.loans??0)<0 ||
      state.liabilities.some(l=>!Number.isFinite(l.totalOwed)||l.totalOwed<0||!Number.isFinite(l.monthlyPayment)||l.monthlyPayment<0))
      throw new HttpsError('failed-precondition','玩家財務資料不完整，保留操作等待修復');
    const board=room.boardState;
    if(c.eventId && (!board || board.currentEvent?.id!==c.eventId || board.currentEvent.type!=='bank' || board.currentEvent.playerUid!==uid || board.currentTurnUid!==uid))
      throw new HttpsError('failed-precondition','銀行事件已過期或不屬於目前玩家');
    const result:BankingResult={status:'applied'};
    if(['rollStartup','upgradeStartup','deferStartup'].includes(c.type)) {
      const target=resolveStartupUpgradeTarget(state,{assetId:c.assetId!,cardId:c.cardId!});
      if(!target || target.asset.id!==c.assetId)throw new HttpsError('failed-precondition','企業識別值已更新，請同步實際資產');
    }

    if(c.type==='deferStartup') {
      if(!resolveStartupUpgradeTarget(state,{assetId:c.assetId!,cardId:c.cardId!}))throw new HttpsError('failed-precondition','企業升級等待狀態已更新');
      if(upgrade?.data()?.income)throw new HttpsError('failed-precondition','收入骰已確認，請完成升級');
      tx.set(upgradeRef!,{deferred:true},{merge:true});tx.set(intentRef,{uid,sessionId:c.sessionId,fingerprint,result});return result;
    }

    if(c.type==='rollStartup') {
      if(!resolveStartupUpgradeTarget(state,{assetId:c.assetId!,cardId:c.cardId!}))throw new HttpsError('failed-precondition','企業升級等待狀態已更新');
      const value=upgrade?.data();
      const existing=c.stage===1?value?.eligibility:value?.income;
      if(existing){tx.set(intentRef,{uid,sessionId:c.sessionId,fingerprint,result:existing});return {...existing,status:'duplicate'};}
      if(value?.deferred)throw new HttpsError('failed-precondition','本次銀行升級已選擇稍後處理');
      if(c.stage===2 && !value?.eligibility?.eligible)throw new HttpsError('failed-precondition','請先通過企業升級判定');
      const rollResult:BankingResult={status:'applied',roll:candidateRoll,eligible:c.stage===2 || candidateRoll>=5};
      tx.set(upgradeRef!,{[c.stage===1?'eligibility':'income']:rollResult},{merge:true});
      tx.set(intentRef,{uid,sessionId:c.sessionId,fingerprint,result:rollResult});
      tx.update(roomRef,{boardState:cleanObject(appendDicePresentation({...board!,revision:(board!.revision||0)+1,updatedAt:now},{id:c.commandId,sequence:(board!.revision||0)+1,playerUid:uid,playerName:state.playerName||'玩家',kind:'business-upgrade',sourceEventId:c.eventId,dice:[candidateRoll],total:candidateRoll,target:c.stage===1?5:undefined,success:rollResult.eligible,resultLabel:c.stage===1?'升級判定':'收入骰完成',detail:c.stage===1?`需 5 點，實際 ${candidateRoll} 點`:`企業收入增加 ${candidateRoll*10000}`,timestamp:now}))});
      return rollResult;
    }

    if(c.type==='finishBank') {
      if(!settlement?.exists)throw new HttpsError('failed-precondition','請先完成銀行領款');
      const wait=(message:string):BankingResult=>{const result:BankingResult={status:'waiting',message};tx.set(intentRef,{uid,sessionId:c.sessionId,fingerprint,result});return result;};
      const pendingUpgrades=getPendingStartupUpgradeActions(state);
      const attempts=await Promise.all(pendingUpgrades.map(p=>tx.get(roomRef.collection('startupRolls').doc(key(`${c.sessionId}:${uid}:${p.assetId}:${c.eventId}`)))));
      if(attempts.some(a=>!a.exists || (!a.data()!.deferred && a.data()!.eligibility?.eligible!==false)))return wait('等待企業升級選擇完成');
      const next=buildBoardEventAdvanceState(room);
      if(!next)return wait('等待事件接續完成');
      tx.update(roomRef,{boardState:cleanObject({...next.boardState,revision:(board!.revision||0)+1,
        processedCommandIds:[...(board!.processedCommandIds||[]),`bank:finish:${key(`${c.sessionId}:${uid}:${c.eventId}`)}`].slice(-100)})});
      if(room.movementAuthority===MOVEMENT_AUTHORITY)saveMovementTask(tx,roomRef,c.sessionId,next.boardState.movement);
      result.phase='completed';
      tx.update(playerRef,{bankSettlement:{sessionId:c.sessionId,eventId:c.eventId,phase:'completed'}});
      tx.update(settlementRef!,{phase:'completed',completedAt:now});
    }else{
      let after:GameState;
      if(personalTypes.includes(c.type)) {
        if(['purchaseDeposit','purchaseInsurance'].includes(c.type)&&!state.bankServiceWindowActive&&!(board?.currentEvent?.type==='bank'&&board.currentEvent.playerUid===uid&&board.currentTurnUid===uid))throw new HttpsError('failed-precondition','請先經過銀行以辦理保險或定存');
        try{
          if(c.type==='purchaseDream'){
            const dream=DREAMS.find(d=>d.id===state.selectedDream?.id);
            if(!dream||dream.id!==c.dreamId)throw new Error('夢想選擇已更新，請同步最新資料');
            after=buildDreamPurchaseState(state,dream,c.commandId,now);
          }else if(c.type==='sellAssets'){after=buildManualAssetSaleState(state,c.sales!,c.commandId,now);}
          else if(c.type==='tradeStock'){
            if(state.assets.some(a=>a.type==='股票'&&(!Number.isSafeInteger(a.quantity??a.shares??0)||(a.quantity??a.shares??0)<0)))throw new Error('股票持有資料不完整，請先核對');
            const stockList=c.trades!.map(t=>{const price=room.marketPrices?.[t.symbol];if(!Number.isSafeInteger(price)||price!<=0||price!==t.expectedPrice)throw new Error('股價已更新或尚未同步，請重新確認價格');return {symbol:t.symbol,qty:t.qty,price:price!};});
            const amount=stockList.reduce((sum,t)=>sum+t.price*t.qty,0);if(!Number.isSafeInteger(amount)||amount>1e12)throw new Error('股票交易總額無效');
            after=buildStockTradeState(state,{usage:c.mode==='buy'?'asset':'cash',source:c.mode==='buy'?'cash':'income',amount,cashChange:c.mode==='buy'?-amount:amount,stockList,name:`${c.mode==='buy'?'買入':'賣出'}股票 (${stockList.map(t=>t.symbol).join(', ')})`} as TransactionData,c.commandId,now);
          }else if(c.type==='purchaseCar'){
            const cash=c.cashContribution!,loan=CAR_PRICE-cash;
            after=buildCarPurchaseState(state,{usage:'asset',source:loan?'loan':'cash',amount:CAR_PRICE,cashChange:-cash,name:'買入汽車（增加一顆骰子）',assetDetails:{type:'汽車',downPayment:cash,cashflow:0,loanAmount:loan,loanInterest:Math.floor(loan*0.005)}} as TransactionData,c.commandId,now);
          }else if(c.type==='purchaseInsurance'){
            if(!Number.isSafeInteger(state.medicalInsuranceCount??0)||(state.medicalInsuranceCount??0)<0)throw new Error('醫療保險資料不完整，請先核對');
            after=buildInsurancePurchaseState(state,{usage:'insurance',source:'cash',amount:c.insuranceType==='house'?2000*c.targetAssetIds!.length:0,cashChange:0,name:c.insuranceType==='medical'?'購買醫療保險':c.insuranceType==='house'?'購買房屋保險':'購買汽車保險',insuranceType:c.insuranceType,insurancePayload:c.insuranceType==='house'?{targetAssetIds:c.targetAssetIds}:c.insuranceType==='medical'?{medicalQty:1}:{aircraft:true}} as TransactionData,c.commandId,now);
          }else if(c.type==='purchaseDeposit')after=buildDepositPurchaseState(state,{usage:'buy_asset',source:'cash',amount:c.amount!,cashChange:-c.amount!,name:`定存 ${c.amount!.toLocaleString()}`} as TransactionData,c.commandId,now);
          else {const target=state.assets.find(a=>a.id===c.assetId&&a.type==='定存'),balance=target?.cost||target?.value||0;if(!Number.isSafeInteger(balance)||balance<=0)throw new Error('定存資料不完整，請先核對');after=buildDepositWithdrawalState(state,{usage:'cash',source:'income',amount:c.amount!,cashChange:c.amount!,relatedAssetId:c.assetId,name:`解約定存 ${c.amount!.toLocaleString()}`} as TransactionData,c.commandId,now);}
        }catch(error){throw new HttpsError('failed-precondition',error instanceof Error?error.message:'個人財務交易無法完成');}
        if(after===state)throw new HttpsError('failed-precondition','舊版交易紀錄需要核對，未重複入帳');
      }else if(c.type==='collectPayday') {
        const applied=applyPaydayCollection(state,room.financialAcceleration,`${c.eventId}_bank`,{now,generateId:createSequentialIdGenerator(c.commandId)});
        // A legacy in-memory marker is insufficient to establish this server-owned receipt.
        if(applied.status==='duplicate')throw new HttpsError('failed-precondition','舊版領款紀錄需要核對，未再次發款');
        after={...applied.state,bankSettlement:{sessionId:c.sessionId,eventId:c.eventId!,phase:'collected'}};result.phase='collected';
      }else if(c.type==='purchaseEnterprise') {
        if(!Array.isArray(state.happiness) || !state.happiness.some(h=>h.id==='h_career'))throw new HttpsError('failed-precondition','玩家目標資料尚未完成');
        const enterprise=ENTERPRISES.find(e=>e.id===state.selectedEnterprise?.id);
        if(!enterprise || enterprise.id!==c.enterpriseId)throw new HttpsError('failed-precondition','目標企業已更新');
        const shortfall=Math.max(0,enterprise.cost-state.cash);
        if((c.fundingLoanAmount||0)+(c.forcedDebtAmount||0)>shortfall)throw new HttpsError('invalid-argument','周轉不可超過購買不足金額');
        const purchase=buildTargetEnterprisePurchaseState({...state,selectedEnterprise:enterprise},{usage:'asset',source:'cash',amount:enterprise.cost,cashChange:-enterprise.cost,name:`購買目標企業：${enterprise.name}`,assetDetails:{type:'企業'},fundingLoanAmount:c.fundingLoanAmount,forcedDebtAmount:c.forcedDebtAmount} as TransactionData,c.commandId,now);
        if(purchase.status==='requires_funding')return {status:'requires_funding',shortfall:purchase.shortfall,message:'現金不足，請選擇周轉方式'};
        if(!purchase.state)throw new HttpsError('failed-precondition',purchase.message||'企業購買失敗');
        if(purchase.status==='duplicate')return {status:'duplicate'};
        after=purchase.state;
      }else if(c.type==='upgradeStartup') {
        const savedRoll=upgrade?.data()?.income?.roll;
        if(!Number.isInteger(savedRoll) || !upgrade?.data()?.eligibility?.eligible)throw new HttpsError('failed-precondition','企業升級骰點尚未完成');
        try{after=buildStartupUpgradeState(state,{assetId:c.assetId!,cardId:c.cardId!,diceRoll:savedRoll},c.commandId,now);}
        catch(error){throw new HttpsError('failed-precondition',error instanceof Error?error.message:'企業升級尚未準備完成');}
        if(after===state)throw new HttpsError('failed-precondition','舊版升級紀錄需要核對');
        result.roll=savedRoll;
      }else{
        const amount=c.amount!;
        if(c.type==='borrowLoan' && amount>getRemainingCreditCapacity(state.profession!.salary,state.liabilities,state.loans||0))
          throw new HttpsError('failed-precondition','超過目前信貸額度');
        const txData={usage:c.type==='borrowLoan'?'loan':'liability',source:'cash',amount,cashChange:c.type==='borrowLoan'?amount:-amount,liabilityId:c.liabilityId} as TransactionData;
        try{after=c.type==='borrowLoan'?buildLoanBorrowState(state,txData,c.commandId,now):buildLoanRepaymentState(state,txData,c.commandId,now);}
        catch(error){throw new HttpsError('failed-precondition',error instanceof Error?error.message:'交易資料無效');}
        if(after===state)throw new HttpsError('failed-precondition','舊版交易紀錄需要核對，未重複入帳');
      }
      after=withAutomaticHappiness(after,room.financialAcceleration);
      if(!Number.isFinite(after.cash) || after.cash<0)throw new HttpsError('failed-precondition','財務計算異常，未入帳');
      commitFinance(tx,roomRef,uid,state,after,room,c.commandId,result);
      if(settlementRef)tx.create(settlementRef,{uid,eventId:c.eventId,sessionId:c.sessionId,phase:'collected',collectedAt:now});
    }
    tx.set(intentRef,{uid,sessionId:c.sessionId,fingerprint,result,completedAt:now});return result;
  });
}

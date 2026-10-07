import {getRoomCompatibilityError} from '../board/roomCompatibility';
import {submitServerGameCommand} from '../board/serverPromptCommand';
import {runLockedBoardCommand} from '../board/commandLock';
import {gameCommandContents,isUncertainGameCommandError} from '../board/pendingCommand';
import type {Room,GameState} from '../../types';
import type {FinancialCommandResult} from './privateCommand';
const pending=new Map<string,Map<string,Promise<unknown>>>();
const contents=new WeakMap<Promise<unknown>,string>();
export function submitServerBanking(room:Room,uid:string,commandId:string,data:{type:'borrowLoan'|'repayLoan'|'collectPayday'|'finishBank'|'purchaseEnterprise'|'upgradeStartup'|'rollStartup'|'deferStartup'|'tradeStock'|'purchaseCar'|'purchaseInsurance'|'purchaseDeposit'|'withdrawDeposit'|'purchaseRealEstate'|'declineRealEstate'|'convertHouse'|'sellAssets'|'purchaseDream';dreamId?:string;sales?:{assetId:string;price:number}[];stage?:1|2;enterpriseId?:string;assetId?:string;cardId?:string;fundingLoanAmount?:number;forcedDebtAmount?:number;amount?:number;liabilityId?:string;eventId?:string;mode?:'buy'|'sell';trades?:{symbol:string;qty:number;expectedPrice:number}[];cashContribution?:number;insuranceType?:'medical'|'house'|'aircraft';targetAssetIds?:string[];source?:'current'|'market';toSelfUse?:boolean}):Promise<FinancialCommandResult>{
  const compatibilityError=getRoomCompatibilityError(room);
  if(compatibilityError)return Promise.resolve({status:'failed',code:'update-required',message:compatibilityError});
  const scope=`${room.id}:${room.sessionId}:${uid}`;
  const commands=pending.get(scope)||new Map();pending.set(scope,commands);
  const previous=commands.get(commandId),payload=gameCommandContents(data);
  if(previous&&contents.get(previous)!==payload)return Promise.resolve({status:'failed',code:'already-exists',message:'同一操作不能更改內容，請保留原選擇'});
  const operation=runLockedBoardCommand<FinancialCommandResult>(commands,commandId,async()=>{
    try{return await submitServerGameCommand<FinancialCommandResult>({...data,roomId:room.id,sessionId:room.sessionId,commandId});}
    catch(error:any){
      const code=String(error?.code||'internal').replace(/^functions\//,'');
      const uncertain=isUncertainGameCommandError(error);
      return {status:uncertain?'waiting':'failed',code,commandId,message:uncertain?(code==='aborted'?'交易發生競爭，請查核結果後沿用這次操作重試':'交易結果尚待確認，請沿用這次操作安全重試'):error?.message||'銀行交易未完成'};
    }
  },()=>({status:'failed',code:'busy',message:'另一筆銀行操作正在處理'}));
  contents.set(operation,payload);
  const release=()=>{if(!commands.size && pending.get(scope)===commands)pending.delete(scope);};
  void operation.then(release,release);
  return operation;
}

export function isBankPaydayCollected(state:Pick<GameState,'bankSettlement'|'appliedBoardFinancialEventIds'>|undefined,sessionId:string|undefined,eventId:string|undefined,serverOwned=false):boolean {
  if(!eventId)return false;
  if(!serverOwned)return !!state?.appliedBoardFinancialEventIds?.includes(`payday:${eventId}_bank`);
  const receipt=state?.bankSettlement;
  return !!receipt && receipt.sessionId===sessionId && receipt.eventId===eventId && ['collected','completed'].includes(receipt.phase);
}

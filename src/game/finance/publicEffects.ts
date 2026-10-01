import type {GameState} from '../../types';
export type PublicFinancialEffect = {id:string;sessionId:string;timestamp:number;kind:'market'|'expense';sourcePlayerUid:string;
  payload:{updates?:Record<string,number>;code?:string;isBubble?:boolean;amount?:number;category?:'basicLiving'|'transportEdu'|'otherMedicalChild';isIncrease?:boolean;summary?:string;detail?:string}};
export const applyPublicFinancialEffect=(state:GameState,effect:PublicFinancialEffect,uid:string):GameState=>{
  if(!Array.isArray(state.assets) || !state.expenses) throw new Error('玩家資產或支出資料尚未同步');
  let next:GameState;
  if(effect.kind==='market') {
    const assets=effect.payload.isBubble ? state.assets.map(asset=>{
      if(asset.type!=='股票')return asset;
      const quantity=Math.floor((asset.quantity || asset.shares || 0)/2);
      return {...asset,quantity,shares:quantity,cost:quantity*(asset.lastPurchasePrice||0)};
    }).filter(asset=>asset.type!=='股票'||(asset.quantity||0)>0) : state.assets;
    next={...state,assets,previousMarketPrices:state.marketPrices,marketPrices:effect.payload.updates || {},
      lastPublishedCode:effect.payload.code || '',lastMarketUpdateTimestamp:effect.timestamp};
  }
  else if(effect.kind==='expense') {
    const category=effect.payload.category;
    if(!category || !['basicLiving','transportEdu','otherMedicalChild'].includes(category) || !Number.isFinite(effect.payload.amount) || effect.payload.amount!<0) throw new Error('共享支出資料無效');
    if(effect.sourcePlayerUid===uid)return state;
    const current=state.expenses[category]||0;
    next={...state,expenses:{...state.expenses,[category]:effect.payload.isIncrease ? current+effect.payload.amount! : Math.max(0,current-effect.payload.amount!)},
      lastSharedExpenseSyncedAt:effect.timestamp,lastSharedExpenseEventId:effect.id};
  }
  else throw new Error('尚未支援的公共財務事件');
  return {...next,history:[{id:`public-effect:${effect.sessionId}:${effect.id}`,timestamp:effect.timestamp,
    name:effect.payload.summary || (effect.payload.isBubble?'股市泡沫：持股減半':'股市行情更新'),amount:effect.payload.amount || 0,
    sourceLabel:'全體事件',usageLabel:effect.kind==='expense'?'每月支出':'股市',cashChange:0,balance:next.cash,
    details:JSON.stringify(effect),flowType:'其它' as const},...(next.history||[])]};
};

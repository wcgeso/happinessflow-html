import React,{useSyncExternalStore} from 'react';
import {getSubscriptionHealth,subscribeSubscriptionHealth,type SubscriptionHealth} from '../../utils/recoveringSnapshot';
export const SubscriptionStatus=({flowSchemaVersion}:{flowSchemaVersion?:number}={})=>{
 const snapshot=useSyncExternalStore(subscribeSubscriptionHealth,getSubscriptionHealth,getSubscriptionHealth);
 const failed=(JSON.parse(snapshot) as SubscriptionHealth[]).filter(state=>state.status==='error');
 if(flowSchemaVersion && flowSchemaVersion!==1)return <div role="alert" className="fixed inset-0 z-[10100] flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white"><p>此房間需要較新的遊戲版本，請更新後繼續。</p><button type="button" onClick={()=>window.location.reload()} className="mt-4 rounded-lg bg-amber-600 px-4 py-3">重新載入遊戲</button></div>;
 if(!failed.length)return null;
 return <div role="alert" className="fixed inset-x-4 top-4 z-[10090] rounded-xl bg-amber-100 p-3 text-amber-950 shadow-lg">
   <p>資料同步中斷：{failed.map(state=>`${state.channel.split(':').slice(0,2).join(' ')} (${state.code})`).join('、')}</p>
   <button type="button" onClick={()=>window.dispatchEvent(new Event('hf-reconnect'))} className="mt-2 rounded-lg bg-amber-900 px-3 py-2 text-white">重新連線並核對待辦</button>
 </div>;
};

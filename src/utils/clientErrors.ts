// Uncaught errors and unhandled rejections from players' devices go to telemetry so production
// problems are visible without asking players for screenshots. Bounded per page to avoid floods.
const MAX_REPORTS_PER_PAGE=20;
let reported=0;
const seen=new Set<string>();

export const describeError=(value:unknown)=>{
  if(value instanceof Error)return {name:value.name,message:value.message,code:String((value as {code?:unknown}).code||''),stack:(value.stack||'').split('\n').slice(0,3).join(' | ')};
  if(value&&typeof value==='object')return {name:'object',message:String((value as {message?:unknown}).message||''),code:String((value as {code?:unknown}).code||''),stack:''};
  return {name:typeof value,message:String(value),code:'',stack:''};
};

const report=(kind:'error'|'rejection',value:unknown)=>{
  const detail=describeError(value),key=`${kind}:${detail.name}:${detail.message}`;
  if(reported>=MAX_REPORTS_PER_PAGE||seen.has(key))return;
  seen.add(key);reported++;
  void import('./telemetry').then(m=>m.trackGameEvent('client_error',{kind,error_name:detail.name,error_code:detail.code,error_message:detail.message,stack:detail.stack,path:location.pathname})).catch(()=>undefined);
};

let installed=false;
export function installClientErrorReporting(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  window.addEventListener('error',event=>report('error',event.error??event.message));
  window.addEventListener('unhandledrejection',event=>report('rejection',event.reason));
}

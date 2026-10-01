import {onSnapshot as firebaseSnapshot} from 'firebase/firestore';
import {getAuth} from 'firebase/auth';

export type SubscriptionHealth = {channel:string;status:'connecting'|'live'|'cached'|'error';code?:string;attempts:number;receivedAt?:number};
const health=new Map<string,SubscriptionHealth>();
const subscribers=new Set<()=>void>();
let sequence=0;
let healthSnapshot='[]', errorSnapshot='[]';
const publish=()=>{healthSnapshot=JSON.stringify([...health.values()]);errorSnapshot=JSON.stringify([...health.values()].filter(s=>s.status==='error'));subscribers.forEach(fn=>fn());};
export const subscribeSubscriptionHealth=(fn:()=>void)=>{subscribers.add(fn);return()=>{subscribers.delete(fn);};};
export const getSubscriptionHealth=()=>healthSnapshot;
export const getSubscriptionErrors=()=>errorSnapshot;

// Firestore closes a listener after its error callback. Rebuild transient failures; permission failures wait for a verified login and an explicit resume.
export const observeSnapshots=(surface:string):typeof firebaseSnapshot=>((...args:any[])=>{
  const callbackIndex=typeof args[1]==='function'?1:2;
  const next=args[callbackIndex], error=args[callbackIndex+1];
  const reference=args[0];
  const key=`${surface}:${reference.path || 'query'}:${++sequence}`;
  let unsubscribe:(()=>void)|undefined, timer:ReturnType<typeof setTimeout>|undefined, disposed=false, generation=0;
  let failures=0, lastError='';
  const status=(value:SubscriptionHealth)=>{health.set(key,value);publish();};
  const start=()=>{
    if(disposed)return;
    if(timer)clearTimeout(timer);
    unsubscribe?.();
    const current=++generation;
    status({channel:key,status:'connecting',attempts:failures});
    const actual=[...args];
    actual[callbackIndex]=(snapshot:any)=>{
      if(disposed||current!==generation)return;
      failures=0;lastError='';
      status({channel:key,status:snapshot.metadata?.fromCache?'cached':'live',attempts:0,receivedAt:Date.now()});
      next(snapshot);
    };
    actual[callbackIndex+1]=(failure:any)=>{
      if(disposed||current!==generation)return;
      failures++;lastError=failure?.code || 'unknown';
      status({channel:key,status:'error',code:lastError,attempts:failures});
      error?.(failure);
      if(['unavailable','deadline-exceeded','aborted'].includes(lastError)&&failures<=3) timer=setTimeout(start,Math.min(4000,500*2**(failures-1)));
    };
    unsubscribe=(firebaseSnapshot as any)(...actual);
  };
  const resume=()=>{
    if(typeof document!=='undefined' && document.visibilityState==='hidden')return;
    if(lastError==='permission-denied'&&!getAuth().currentUser)return;
    failures=0;start();
  };
  globalThis.addEventListener?.('online',resume);
  globalThis.addEventListener?.('hf-reconnect',resume);
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',resume);
  start();
  return()=>{disposed=true;generation++;unsubscribe?.();if(timer)clearTimeout(timer);
    globalThis.removeEventListener?.('online',resume);globalThis.removeEventListener?.('hf-reconnect',resume);
    if(typeof document!=='undefined')document.removeEventListener('visibilitychange',resume);
    health.delete(key);publish();};
}) as typeof firebaseSnapshot;

import {useEffect,useState} from 'react';
import {confirmPendingGameCommand,pendingCommandEvent,readPendingGameCommand,type PendingGameCommand} from '../game/board/pendingCommand';
import {callServerGameCommand,submitServerGameCommand} from '../game/board/serverPromptCommand';

// A confirmed close can remove the room before the browser receives its response.
export function RoomLifecycleRecovery({uid}:{uid:string}){
 const [scope,setScope]=useState<{roomId:string;sessionId:string}|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  const refresh=()=>{
   const prefix=`hf-server-command:${uid}:`;let corrupt=false;
   for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
    try{
     const value=JSON.parse(localStorage.getItem(key)!);
     if(!['finishRoom','closeRoom'].includes(value?.type))continue;
     if(!['roomId','sessionId','commandId'].every(field=>typeof value[field]==='string'&&/^[\w:.-]{1,512}$/.test(value[field]))||key!==`${prefix}${value.roomId}:${value.sessionId}`){corrupt=true;continue;}
     const pending=readPendingGameCommand(localStorage,uid,value.roomId,value.sessionId);if(pending){setError('');setScope({roomId:value.roomId,sessionId:value.sessionId});return;}
    }catch{corrupt=true;}
   }
   setScope(null);
   setError(corrupt?'未確認場次資料無法讀取，已保留原資料，請核對紀錄。':'');
  };
  refresh();window.addEventListener(pendingCommandEvent,refresh);window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener(pendingCommandEvent,refresh);window.removeEventListener('storage',refresh);};
 },[uid]);
 return scope?<ServerCommandRecovery key={`${uid}:${scope.roomId}:${scope.sessionId}`} uid={uid} {...scope} canRetry/>:error?<aside role="alert">{error}</aside>:null;
}

export function ServerCommandRecovery({uid,roomId,sessionId,canRetry}:{uid:string;roomId:string;sessionId:string;canRetry:boolean}) {
 const [pending,setPending]=useState<PendingGameCommand|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[slow,setSlow]=useState(false);
 useEffect(()=>{
  let active=true,checking=false;
  const refresh=()=>{if(!active)return;try{const saved=readPendingGameCommand(localStorage,uid,roomId,sessionId);setPending(saved);if(!saved)setMessage('');}catch(e){setMessage((e as Error).message);}};
  const check=async()=>{if(!active||checking)return;checking=true;try{const result=await confirmPendingGameCommand(localStorage,uid,roomId,sessionId,callServerGameCommand);if(active){setMessage(result?.status==='waiting'?result.message:'');refresh();}}catch(e){if(active)setMessage((e as Error).message);}finally{checking=false;}};
  const resume=()=>{if(document.visibilityState==='visible')void check();};
  refresh();void check();
  window.addEventListener(pendingCommandEvent,refresh);window.addEventListener('storage',refresh);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  return()=>{active=false;window.removeEventListener(pendingCommandEvent,refresh);window.removeEventListener('storage',refresh);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
 },[uid,roomId,sessionId]);
 useEffect(()=>{setSlow(false);if(!pending)return;const timer=setTimeout(()=>setSlow(true),3000);return()=>clearTimeout(timer);},[pending?.commandId]);
 async function recover(retry:boolean){
  if(busy)return;setBusy(true);setMessage('');
  try{if(retry&&pending&&canRetry)await submitServerGameCommand(pending);else {const result=await confirmPendingGameCommand(localStorage,uid,roomId,sessionId,callServerGameCommand);if(result?.status==='waiting')setMessage(result.message);}setPending(readPendingGameCommand(localStorage,uid,roomId,sessionId));}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 if(!message&&(!pending||!slow))return null;
 return <aside role="status" aria-live="polite" className="fixed bottom-4 left-4 right-4 z-[100] rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-slate-900 shadow-lg">
  <p>{pending?'操作結果待確認': '操作資料需要查核'}</p>
  {message&&<p>{message}</p>}
  {busy&&<p>正在確認原操作…</p>}
  {pending&&slow&&<div className="mt-2 flex gap-3"><button type="button" disabled={busy} onClick={()=>void recover(false)}>查核結果</button><button type="button" disabled={busy||!canRetry} onClick={()=>void recover(true)}>安全重試原操作</button></div>}
 </aside>;
}

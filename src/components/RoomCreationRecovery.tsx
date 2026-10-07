import {useEffect,useRef,useState} from 'react';
import {pendingCommandEvent,readPendingGameCommand,type PendingGameCommand} from '../game/board/pendingCommand';

export function RoomCreationRecovery({uid,recover}:{uid:string;recover:(retry?:boolean)=>Promise<boolean>}){
 const [pending,setPending]=useState<PendingGameCommand|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[slow,setSlow]=useState(false),checking=useRef(false);
 useEffect(()=>{
  let active=true;
  const refresh=()=>{if(!active)return;try{const saved=readPendingGameCommand(localStorage,uid,'new-room','new-room');setPending(saved);if(!saved)setMessage('');return saved;}catch(error){setMessage((error as Error).message);}};
  const check=async()=>{if(!active||checking.current)return;checking.current=true;setBusy(true);try{await recover(false);if(active)refresh();}catch(error){if(active)setMessage((error as Error).message);}finally{if(active){checking.current=false;setBusy(false);}}};
  const resume=()=>{if(document.visibilityState==='visible')void check();};
  if(refresh())void check();
  window.addEventListener(pendingCommandEvent,refresh);window.addEventListener('storage',refresh);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  return()=>{active=false;checking.current=false;window.removeEventListener(pendingCommandEvent,refresh);window.removeEventListener('storage',refresh);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
 },[uid,recover]);
 useEffect(()=>{setSlow(false);if(!pending)return;const timer=setTimeout(()=>setSlow(true),3000);return()=>clearTimeout(timer);},[pending?.commandId]);
 async function act(retry:boolean){
  if(checking.current)return;checking.current=true;setBusy(true);setMessage('');
  try{await recover(retry);setPending(readPendingGameCommand(localStorage,uid,'new-room','new-room'));}catch(error){setMessage((error as Error).message);}finally{checking.current=false;setBusy(false);}
 }
 if(!pending&&!message)return null;
 return <aside role="status" aria-live="polite" className="fixed bottom-4 left-4 right-4 z-[100] rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-slate-900 shadow-lg">
  <p>{busy?'正在確認原開房操作…':slow?'開房結果待確認':'房間建立中…'}</p>
  {message&&<p>{message}</p>}
  {pending&&(slow||message)&&<div className="mt-2 flex gap-3"><button type="button" disabled={busy} onClick={()=>void act(false)}>查核並載入原房間</button><button type="button" disabled={busy} onClick={()=>void act(true)}>安全重試原開房</button></div>}
 </aside>;
}

import {useEffect,useState} from 'react';
import {getDicePresentationTiming} from '../game/board/dicePresentation';
import {serverNow} from '../utils/serverClock';

// Presentation only: authoritative dice and fees remain in the cloud event.
export function useDicePresentationReady(key:string|null,timestamp?:number) {
 const [readyKey,setReadyKey]=useState<string|null>(null);
 useEffect(()=>{
  if(!key){setReadyKey(null);return;}
  // Older events without dice history get one bounded wait, never an endless blocker.
  const startedAt=timestamp??serverNow();let timer:ReturnType<typeof setTimeout>|undefined;
  const align=()=>{
   clearTimeout(timer);
   const remaining=getDicePresentationTiming(startedAt,serverNow()).closeInMs;
   setReadyKey(remaining===0?key:null);
   if(remaining>0)timer=setTimeout(align,remaining);
  };
  align();
  document.addEventListener('visibilitychange',align);
  window.addEventListener('online',align);window.addEventListener('hf-clock-sync',align);
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',align);window.removeEventListener('online',align);window.removeEventListener('hf-clock-sync',align);};
 },[key,timestamp]);
 return !!key&&readyKey===key;
}

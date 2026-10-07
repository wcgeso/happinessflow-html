import {useEffect} from 'react';

// One shared observer; listeners receive each frame that blocked the main thread for > 50ms.
type LongFrameListener=(durationMs:number)=>void;
const listeners=new Set<LongFrameListener>();
let observer:PerformanceObserver|null=null;

const startObserver=()=>{
  if(observer||typeof PerformanceObserver==='undefined')return;
  const supported=PerformanceObserver.supportedEntryTypes||[];
  const type=supported.includes('long-animation-frame')?'long-animation-frame':supported.includes('longtask')?'longtask':null;
  if(!type)return;
  observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())listeners.forEach(fn=>fn(entry.duration));});
  try{observer.observe({type,buffered:false});}catch{observer=null;}
};

export const subscribeLongFrames=(fn:LongFrameListener)=>{
  listeners.add(fn);startObserver();
  return()=>{listeners.delete(fn);if(!listeners.size&&observer){observer.disconnect();observer=null;}};
};

const REPORT_INTERVAL_MS=30_000;
/** Reports a jank summary per surface every 30s, only when long frames occurred. */
export const useFrameJankReport=(surface:'player'|'projection'|'coach')=>{
  useEffect(()=>{
    let count=0,total=0,max=0;
    const stop=subscribeLongFrames(ms=>{count++;total+=ms;max=Math.max(max,ms);});
    const flush=()=>{
      if(!count)return;
      const params={surface,long_frames:count,total_ms:Math.round(total),max_ms:Math.round(max),visibility:document.visibilityState};
      count=0;total=0;max=0;
      void import('./telemetry').then(m=>m.trackGameEvent('frame_jank',params)).catch(()=>undefined);
    };
    const id=window.setInterval(flush,REPORT_INTERVAL_MS);
    return()=>{window.clearInterval(id);flush();stop();};
  },[surface]);
};

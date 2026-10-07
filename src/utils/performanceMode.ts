import {useSyncExternalStore} from 'react';
import {subscribeLongFrames} from './frameMonitor';

// 'lite' turns off decorative GPU work (large blurs, backdrop filters, infinite ambient animation).
// Gameplay visuals (dice, token movement, card reveal) are unchanged in both modes.
export type PerformanceMode='full'|'lite';
export type PerformancePreference='auto'|PerformanceMode;

const STORAGE_KEY='hf-performance-mode';
const LONG_FRAME_MS=100;          // a frame this long is a visible stutter
const LONG_FRAMES_TO_DEGRADE=3;   // within the window below
const DEGRADE_WINDOW_MS=10_000;
const STARTUP_GRACE_MS=8_000;     // first render and code loading are expected to be slow

const listeners=new Set<()=>void>();
let preference:PerformancePreference=readPreference();
let autoMode:PerformanceMode=initialAutoMode();

function readPreference():PerformancePreference{
  try{const v=localStorage.getItem(STORAGE_KEY);return v==='full'||v==='lite'?v:'auto';}catch{return 'auto';}
}
function initialAutoMode():PerformanceMode{
  if(typeof navigator==='undefined')return 'full';
  const cores=navigator.hardwareConcurrency||8;
  const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory||8;
  return cores<=4||memory<=4?'lite':'full';
}
const currentMode=():PerformanceMode=>preference==='auto'?autoMode:preference;
const apply=()=>{if(typeof document!=='undefined')document.documentElement.dataset.perf=currentMode();listeners.forEach(fn=>fn());};

export const getPerformanceMode=currentMode;
export const getPerformancePreference=()=>preference;
export function setPerformancePreference(next:PerformancePreference){
  preference=next;
  try{if(next==='auto')localStorage.removeItem(STORAGE_KEY);else localStorage.setItem(STORAGE_KEY,next);}catch{/* per-device convenience only */}
  apply();
}
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export const usePerformanceMode=()=>useSyncExternalStore(subscribe,currentMode,()=>'full' as PerformanceMode);

/** Starts the automatic detector once per page. Repeated stutter switches this session to lite. */
let started=false;
export function startPerformanceMode(now:()=>number=()=>performance.now()){
  apply();
  if(started)return;
  started=true;
  const startedAt=now();let recent:number[]=[];
  const stop=subscribeLongFrames(duration=>{
    const t=now();
    if(t-startedAt<STARTUP_GRACE_MS||duration<LONG_FRAME_MS||autoMode==='lite')return;
    recent=[...recent.filter(at=>t-at<DEGRADE_WINDOW_MS),t];
    if(recent.length>=LONG_FRAMES_TO_DEGRADE){autoMode='lite';apply();stop();}
  });
}
/** Test helper. */
export function resetPerformanceModeForTest(){started=false;preference=readPreference();autoMode=initialAutoMode();apply();}

const PREFERENCE_ORDER:PerformancePreference[]=['auto','lite','full'];
export const nextPerformancePreference=(p:PerformancePreference)=>PREFERENCE_ORDER[(PREFERENCE_ORDER.indexOf(p)+1)%PREFERENCE_ORDER.length];
/** Label for settings: auto shows what it resolved to. */
export const performanceLabel=(p:PerformancePreference,mode:PerformanceMode)=>p==='auto'?`自動（${mode==='lite'?'流暢':'精緻'}）`:p==='lite'?'流暢':'精緻';
/** Re-renders with the current preference and resolved mode. */
export const usePerformanceSetting=()=>{
  const snapshot=useSyncExternalStore(subscribe,()=>`${preference}|${currentMode()}`,()=>'auto|full');
  const [pref,mode]=snapshot.split('|') as [PerformancePreference,PerformanceMode];
  return {mode,preference:pref,label:performanceLabel(pref,mode),cycle:()=>setPerformancePreference(nextPerformancePreference(pref))};
};

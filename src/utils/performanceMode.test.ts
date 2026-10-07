import {beforeEach,expect,it} from 'vitest';
let emit:(ms:number)=>void=()=>undefined;
vi.mock('./frameMonitor',()=>({subscribeLongFrames:(fn:(ms:number)=>void)=>{emit=fn;return()=>{emit=()=>undefined;};}}));
import {getPerformanceMode,resetPerformanceModeForTest,setPerformancePreference,startPerformanceMode} from './performanceMode';
beforeEach(()=>{localStorage.clear();Object.defineProperty(navigator,'hardwareConcurrency',{value:8,configurable:true});resetPerformanceModeForTest();});

it('switches to lite after repeated stutter, ignoring the startup grace period and short frames',()=>{
 let t=0;startPerformanceMode(()=>t);
 emit(500);emit(500);emit(500);expect(getPerformanceMode()).toBe('full');
 t=9000;emit(60);emit(60);emit(60);expect(getPerformanceMode()).toBe('full');
 emit(150);t=12000;emit(150);expect(getPerformanceMode()).toBe('full');
 t=14000;emit(150);expect(getPerformanceMode()).toBe('lite');
 expect(document.documentElement.dataset.perf).toBe('lite');
});

it('starts in lite on low-core devices and respects a manual choice',()=>{
 Object.defineProperty(navigator,'hardwareConcurrency',{value:4,configurable:true});resetPerformanceModeForTest();
 expect(getPerformanceMode()).toBe('lite');
 setPerformancePreference('full');expect(getPerformanceMode()).toBe('full');expect(localStorage.getItem('hf-performance-mode')).toBe('full');
 setPerformancePreference('auto');expect(getPerformanceMode()).toBe('lite');
});

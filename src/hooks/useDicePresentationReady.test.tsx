import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useDicePresentationReady} from './useDicePresentationReady';
vi.mock('../utils/serverClock',()=>({serverNow:()=>Date.now()}));
afterEach(()=>{cleanup();vi.useRealTimers();});
it('holds the result until the common deadline, using only the remaining time on late receipt',()=>{
 vi.useFakeTimers();vi.setSystemTime(10000);
 const {result}=renderHook(()=>useDicePresentationReady('repair-a',9000));
 expect(result.current).toBe(false);
 act(()=>vi.advanceTimersByTime(1399));expect(result.current).toBe(false);
 act(()=>vi.advanceTimersByTime(1));expect(result.current).toBe(true);
});
it('shows an expired result immediately and prevents the previous event timer revealing the next event',()=>{
 vi.useFakeTimers();vi.setSystemTime(10000);
 const {result,rerender}=renderHook(({key,timestamp})=>useDicePresentationReady(key,timestamp),{initialProps:{key:'repair-a',timestamp:7000}});
 expect(result.current).toBe(true);
 rerender({key:'repair-b',timestamp:10000});expect(result.current).toBe(false);
 act(()=>vi.advanceTimersByTime(1000));rerender({key:'repair-c',timestamp:11000});
 act(()=>vi.advanceTimersByTime(1400));expect(result.current).toBe(false);
 act(()=>vi.advanceTimersByTime(1000));expect(result.current).toBe(true);
});
it('aligns after returning to foreground and safely completes legacy events without a timestamp',()=>{
 vi.useFakeTimers();vi.setSystemTime(10000);
 const {result,rerender}=renderHook(({key,timestamp}:{key:string;timestamp?:number})=>useDicePresentationReady(key,timestamp),{initialProps:{key:'repair-a',timestamp:10000}});
 vi.setSystemTime(15000);act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(result.current).toBe(true);
 rerender({key:'legacy'});expect(result.current).toBe(false);
 act(()=>vi.advanceTimersByTime(2400));expect(result.current).toBe(true);
});

import React from 'react';
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {DicePresentationEvent,FamilyMilestoneJoinPrompt} from '../../types';
const clock=vi.hoisted(()=>({offset:0}));
vi.mock('../../utils/serverClock',()=>({serverNow:()=>Date.now()+clock.offset}));
vi.mock('../../utils/telemetry',()=>({trackBoardStage:vi.fn()}));
vi.mock('framer-motion',()=>({AnimatePresence:({children}:{children:React.ReactNode})=>children,motion:{div:({children,initial,animate,exit,transition,...props}:any)=><div {...props}>{children}</div>}}));
import {DicePresentationOverlay} from './DicePresentationOverlay';
const event=(id='roll',timestamp=1000,sequence=1):DicePresentationEvent=>({id,timestamp,sequence,playerUid:'p',playerName:'玩家',kind:'school-exam',dice:[6],total:6,success:true,resultLabel:'考試通過'});
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(1000);clock.offset=0;});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('keeps an initial dice event through StrictMode effect recreation and reveals at its original deadline',()=>{
 render(<DicePresentationOverlay roomId="r" scopeKey="s:turn" events={[event()]}/>,{reactStrictMode:true});
 expect(screen.getByRole('img')).toHaveAccessibleName('骰子滾動中');
 act(()=>vi.advanceTimersByTime(800));expect(screen.getByRole('img')).toHaveAccessibleName('骰子 6 點');expect(screen.getByText('考試通過')).toBeTruthy();
 act(()=>vi.advanceTimersByTime(1600));expect(screen.queryByRole('img')).toBeNull();
});
it('shows a late confirmed result for only its remaining duration and never replays expired events',()=>{
 vi.setSystemTime(2100);const {rerender}=render(<DicePresentationOverlay roomId="r" scopeKey="s:turn" events={[event()]}/>);expect(screen.getByRole('img')).toHaveAccessibleName('骰子 6 點');
 act(()=>vi.advanceTimersByTime(1300));expect(screen.queryByRole('img')).toBeNull();rerender(<DicePresentationOverlay roomId="r" scopeKey="s:turn" events={[event()]}/>);expect(screen.queryByRole('img')).toBeNull();
});
it.each(['visibilitychange','hf-clock-sync','online'])('realigns on %s even when background timers have not run',signal=>{
 render(<DicePresentationOverlay roomId="r" scopeKey="s:turn" events={[event()]}/>);expect(screen.getByRole('img')).toBeTruthy();
 vi.setSystemTime(5000);act(()=>{(signal==='visibilitychange'?document:window).dispatchEvent(new Event(signal));});expect(screen.queryByRole('img')).toBeNull();
});
it('reschedules when calibration changes and prevents old timers from closing a newer event',()=>{
 const {rerender}=render(<DicePresentationOverlay roomId="r" scopeKey="s:turn" events={[event()]}/>);
 clock.offset=1000;act(()=>window.dispatchEvent(new Event('hf-clock-sync')));expect(screen.getByRole('img')).toHaveAccessibleName('骰子 6 點');
 clock.offset=0;vi.setSystemTime(1600);rerender(<DicePresentationOverlay roomId="r" scopeKey="s:turn" events={[event(),event('new',1600,2)]}/>);
 act(()=>vi.advanceTimersByTime(1800));expect(screen.getByRole('img')).toHaveAccessibleName('骰子 6 點');
 act(()=>vi.advanceTimersByTime(600));expect(screen.queryByRole('img')).toBeNull();
});
it('clears the previous turn, room and removed event immediately, including a single-player new turn',()=>{
 const {rerender}=render(<DicePresentationOverlay roomId="r" scopeKey="s:turn" events={[event()]}/>);expect(screen.getByRole('img')).toBeTruthy();
 rerender(<DicePresentationOverlay roomId="r" scopeKey="s:turn" turnStartedAt={Infinity} events={[event()]}/>);expect(screen.queryByRole('img')).toBeNull();
 rerender(<DicePresentationOverlay roomId="other" scopeKey="s:turn" events={[]}/>);expect(screen.queryByRole('img')).toBeNull();
 rerender(<DicePresentationOverlay roomId="other" scopeKey="s:turn" events={[event()]}/>);expect(screen.getByRole('img')).toBeTruthy();
 rerender(<DicePresentationOverlay roomId="other" scopeKey="s:turn" events={[]}/>);expect(screen.queryByRole('img')).toBeNull();
});

it('does not animate a late family response and catches up a family roll on returning to the foreground',()=>{
 const prompt={id:'family',sourcePlayerUid:'coach',sourcePlayerName:'執行師',targetPlayerUids:['p'],responses:{}} as FamilyMilestoneJoinPrompt;
 const reply={playerUid:'p',playerName:'玩家',roll:6,status:'passed',respondedAt:1000,presentationReadyAt:3400} as const;
 const {rerender}=render(<DicePresentationOverlay roomId="r" familyPrompt={prompt}/>);
 vi.setSystemTime(5000);rerender(<DicePresentationOverlay roomId="r" familyPrompt={{...prompt,responses:{p:reply}}}/>);expect(screen.getByRole('img')).toHaveAccessibleName('骰子 6 點');
 vi.setSystemTime(6000);rerender(<DicePresentationOverlay roomId="r" familyPrompt={{...prompt,id:'next',responses:{}}}/>);rerender(<DicePresentationOverlay roomId="r" familyPrompt={{...prompt,id:'next',responses:{p:{...reply,respondedAt:6000,presentationReadyAt:8400}}}}/>);expect(screen.getByRole('img')).toHaveAccessibleName('骰子滾動中');
 vi.setSystemTime(10000);act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(screen.getByRole('img')).toHaveAccessibleName('骰子 6 點');
});

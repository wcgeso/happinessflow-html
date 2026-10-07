import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({user:{uid:'coach'},project:vi.fn(()=>({room:null,syncState:'error'}))}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:mocks.user})}));
vi.mock('../../hooks/useProjectionRoom',()=>({useProjectionRoom:mocks.project}));
vi.mock('../../hooks/useGameDiagnostics',()=>({useGameDiagnostics:()=>{}}));
vi.mock('../../utils/serverClock',()=>({serverNow:()=>Date.now(),subscribeServerClock:()=>()=>{}}));
vi.mock('../../utils/telemetry',()=>({trackBoardStage:vi.fn()}));
vi.mock('../../utils/audio',()=>({AUDIO_SETTINGS_EVENT:'audio',getAudioSettings:()=>({}),setAudioSettings:vi.fn(),audioManager:{unlock:async()=>{},startBackgroundMusic:async()=>{},stopBackgroundMusic:()=>{},syncBackgroundMusic:()=>{},playOnce:async()=>{}}}));
import {BoardProjectionView} from './BoardProjectionView';
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.user.uid='coach';});
it('binds the actual projection page to the current account/room and reconnects without reloading',()=>{
 const reconnect=vi.fn();window.addEventListener('hf-reconnect',reconnect);
 try{
  const {rerender}=render(<BoardProjectionView roomCode="123456"/>);expect(mocks.project).toHaveBeenLastCalledWith('123456','coach');expect(screen.getByText('房號 123456')).toBeTruthy();
  act(()=>fireEvent.click(screen.getByRole('button',{name:'重新連線'})));expect(reconnect).toHaveBeenCalledOnce();
  mocks.user.uid='other';rerender(<BoardProjectionView roomCode="654321"/>);expect(mocks.project).toHaveBeenLastCalledWith('654321','other');expect(screen.getByText('房號 654321')).toBeTruthy();
 }finally{window.removeEventListener('hf-reconnect',reconnect);}
});
it('catches up movement immediately on foreground/online without replaying elapsed steps',()=>{
 vi.useFakeTimers();vi.setSystemTime(10000);
 const movement={isActive:true,playerUid:'p',startedAt:10000,introDelayMs:1000,stepDurationMs:500,startPosition:0,path:[1,2,3,4],remainingPath:[]};
 const room:any={id:'123456',sessionId:'s',hostId:'coach',status:'playing',members:[{uid:'p',name:'玩家甲'}],boardState:{turnOrder:['p'],currentTurnUid:'p',playerPositions:{p:0},movement},publicPlayerStates:{},playerStates:{}};
 mocks.project.mockReturnValue({room,syncState:'synced'} as any);
 try{
  render(<BoardProjectionView roomCode="123456"/>);expect(screen.getByText('4 步')).toBeTruthy();
  const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');
  vi.setSystemTime(13000);act(()=>window.dispatchEvent(new Event('online')));expect(screen.getByText('4 步')).toBeTruthy();
  visibility.mockReturnValue('visible');act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(screen.getByText('0 步')).toBeTruthy();
  act(()=>window.dispatchEvent(new Event('online')));expect(screen.getByText('0 步')).toBeTruthy();visibility.mockRestore();
 }finally{cleanup();vi.restoreAllMocks();vi.useRealTimers();mocks.project.mockReturnValue({room:null,syncState:'error'});}
});
it('removes expired turn notices on foreground and clears them when the event disappears',()=>{
 vi.useFakeTimers();vi.setSystemTime(10000);
 const room:any={id:'123456',sessionId:'s',hostId:'coach',status:'playing',members:[{uid:'p',name:'玩家甲'}],boardState:{turnOrder:['p'],currentTurnUid:'p',playerPositions:{p:0},skippedTurnNotice:{timestamp:10000,playerUids:['p'],nextTurnUid:'p'}},publicPlayerStates:{},playerStates:{}};
 mocks.project.mockReturnValue({room,syncState:'synced'} as any);
 try{
  const view=render(<BoardProjectionView roomCode="123456"/>);expect(screen.getByText('本回合暫停，無法行動')).toBeTruthy();
  vi.setSystemTime(100000);act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(screen.queryByText('本回合暫停，無法行動')).toBeNull();
  room.boardState={...room.boardState,skippedTurnNotice:{timestamp:100000,playerUids:['p'],nextTurnUid:'p'}};view.rerender(<BoardProjectionView roomCode="123456"/>);expect(screen.getByText('本回合暫停，無法行動')).toBeTruthy();
  room.boardState={...room.boardState,skippedTurnNotice:null};view.rerender(<BoardProjectionView roomCode="123456"/>);expect(screen.queryByText('本回合暫停，無法行動')).toBeNull();
 }finally{cleanup();vi.useRealTimers();mocks.project.mockReturnValue({room:null,syncState:'error'});}
});

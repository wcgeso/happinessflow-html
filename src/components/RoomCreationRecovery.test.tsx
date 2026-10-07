import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {RoomCreationRecovery} from './RoomCreationRecovery';
afterEach(()=>{cleanup();localStorage.clear();vi.useRealTimers();});
it('only queries on reload and reconnect, then offers an explicit retry after three seconds',async()=>{
 vi.useFakeTimers();localStorage.setItem('hf-server-command:u:new-room:new-room',JSON.stringify({type:'createRoom',roomId:'new-room',sessionId:'new-room',commandId:'original',name:'房間',maxPlayers:6,duration:60}));const recover=vi.fn().mockRejectedValue(new Error('尚未確認'));
 await act(async()=>{render(<RoomCreationRecovery uid="u" recover={recover}/>);});expect(recover).toHaveBeenCalledWith(false);
 await act(async()=>{window.dispatchEvent(new Event('online'));});expect(recover.mock.calls.every(([retry])=>retry===false)).toBe(true);
 await act(async()=>{vi.advanceTimersByTime(3000);});expect(screen.getByText('開房結果待確認')).toBeTruthy();await act(async()=>{fireEvent.click(screen.getByText('安全重試原開房'));});expect(recover).toHaveBeenLastCalledWith(true);
});
it('preserves corrupt storage and displays the reason without executing a command',async()=>{
 localStorage.setItem('hf-server-command:u:new-room:new-room','invalid');const recover=vi.fn();await act(async()=>{render(<RoomCreationRecovery uid="u" recover={recover}/>);});expect(screen.getByText(/未確認操作資料無法讀取/)).toBeTruthy();expect(recover).not.toHaveBeenCalled();expect(localStorage.getItem('hf-server-command:u:new-room:new-room')).toBe('invalid');
});
it('can query again when StrictMode cancels the first effect without leaving the buttons busy',async()=>{
 localStorage.setItem('hf-server-command:u:new-room:new-room',JSON.stringify({type:'createRoom',roomId:'new-room',sessionId:'new-room',commandId:'original',name:'房間',maxPlayers:6,duration:60}));let reject!:(error:Error)=>void;const recover=vi.fn().mockImplementationOnce(()=>new Promise((_resolve,r)=>{reject=r;})).mockRejectedValue(new Error('原操作待確認'));
 await act(async()=>{render(<RoomCreationRecovery uid="u" recover={recover}/>,{reactStrictMode:true});});expect(recover).toHaveBeenCalledTimes(2);expect((screen.getByText('安全重試原開房') as HTMLButtonElement).disabled).toBe(false);
 await act(async()=>{reject(new Error('已取消的舊查核'));});expect(screen.queryByText('已取消的舊查核')).toBeNull();expect((screen.getByText('安全重試原開房') as HTMLButtonElement).disabled).toBe(false);
});

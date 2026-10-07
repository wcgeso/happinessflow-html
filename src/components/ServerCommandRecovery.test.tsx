import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ServerCommandRecovery,RoomLifecycleRecovery} from './ServerCommandRecovery';
import {callServerGameCommand,submitServerGameCommand} from '../game/board/serverPromptCommand';
vi.mock('../game/board/serverPromptCommand',()=>({callServerGameCommand:vi.fn(),submitServerGameCommand:vi.fn()}));
afterEach(()=>{cleanup();localStorage.clear();vi.useRealTimers();vi.clearAllMocks();});
it('queries on reload and reconnect, never replays automatically, and retry uses the saved payload',async()=>{
 vi.useFakeTimers();const command={type:'borrowLoan',roomId:'r',sessionId:'s',commandId:'original',amount:500};localStorage.setItem('hf-server-command:u:r:s',JSON.stringify(command));
 vi.mocked(callServerGameCommand).mockResolvedValue({status:'waiting'});vi.mocked(submitServerGameCommand).mockResolvedValue({status:'duplicate'});
 await act(async()=>{render(<ServerCommandRecovery uid="u" roomId="r" sessionId="s" canRetry/>);});
 expect(callServerGameCommand).toHaveBeenCalledWith({type:'getCommandResult',roomId:'r',sessionId:'s',commandId:'original'});expect(submitServerGameCommand).not.toHaveBeenCalled();
 await act(async()=>{window.dispatchEvent(new Event('online'));});expect(submitServerGameCommand).not.toHaveBeenCalled();
 await act(async()=>{vi.advanceTimersByTime(3000);});expect(screen.getByText('操作結果待確認')).toBeTruthy();
 await act(async()=>{fireEvent.click(screen.getByText('安全重試原操作'));});expect(submitServerGameCommand).toHaveBeenCalledWith(command);
});
it('preserves corrupt data and reports it without submitting',async()=>{
 localStorage.setItem('hf-server-command:u:r:s','invalid');await act(async()=>{render(<ServerCommandRecovery uid="u" roomId="r" sessionId="s" canRetry={false}/>);});
 expect(screen.getByText(/未確認操作資料無法讀取/)).toBeTruthy();expect(localStorage.getItem('hf-server-command:u:r:s')).toBe('invalid');expect(submitServerGameCommand).not.toHaveBeenCalled();
});
it('finds only this account lifecycle draft after room removal and clears it through a read-only lookup',async()=>{
 const command={type:'closeRoom',roomId:'123456',sessionId:'s',commandId:'closeRoom:s:u'};
 localStorage.setItem('hf-server-command:other:123456:s',JSON.stringify(command));localStorage.setItem('hf-server-command:u:123456:s',JSON.stringify(command));
 vi.mocked(callServerGameCommand).mockResolvedValue({status:'confirmed',result:{status:'applied',closed:true}});
 await act(async()=>{render(<RoomLifecycleRecovery uid="u"/>);});
 expect(callServerGameCommand).toHaveBeenCalledWith({type:'getCommandResult',roomId:'123456',sessionId:'s',commandId:command.commandId});expect(localStorage.getItem('hf-server-command:u:123456:s')).toBeNull();expect(localStorage.getItem('hf-server-command:other:123456:s')).not.toBeNull();expect(submitServerGameCommand).not.toHaveBeenCalled();
});
it('preserves corrupt lifecycle drafts outside a room without calling the backend',async()=>{
 localStorage.setItem('hf-server-command:u:123456:s',JSON.stringify({type:'closeRoom',roomId:'../bad',sessionId:'s',commandId:'close'}));
 await act(async()=>{render(<RoomLifecycleRecovery uid="u"/>);});expect(screen.getByRole('alert').textContent).toContain('已保留原資料');expect(localStorage.getItem('hf-server-command:u:123456:s')).not.toBeNull();expect(callServerGameCommand).not.toHaveBeenCalled();expect(submitServerGameCommand).not.toHaveBeenCalled();
});

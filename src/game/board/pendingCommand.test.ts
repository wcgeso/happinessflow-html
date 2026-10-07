import {beforeEach,expect,it,vi} from 'vitest';
import {submitPersistentGameCommand,confirmPendingGameCommand,readPendingGameCommand} from './pendingCommand';
const command={type:'borrowLoan',roomId:'room',sessionId:'s',commandId:'one',amount:10};
beforeEach(()=>localStorage.clear());
it('shares identical in-flight work, queues another command and refuses changed content',async()=>{
 const resolvers:((r:unknown)=>void)[]=[];const call=vi.fn(()=>new Promise(r=>{resolvers.push(r);}));
 const first=submitPersistentGameCommand(localStorage,'u',command,call);
 await Promise.resolve();
 expect(submitPersistentGameCommand(localStorage,'u',{...command},call)).toBe(first);
 const other=submitPersistentGameCommand(localStorage,'u',{...command,commandId:'other'},call);
 await expect(submitPersistentGameCommand(localStorage,'u',{...command,amount:20},call)).rejects.toMatchObject({code:'already-exists'});
 await vi.waitFor(()=>expect(resolvers).toHaveLength(1));
 resolvers[0]({status:'applied'});await first;
 await vi.waitFor(()=>expect(resolvers).toHaveLength(2));
 expect(call.mock.calls[1][0]).toMatchObject({commandId:'other'});
 resolvers[1]({status:'applied'});await other;
 expect(call).toHaveBeenCalledTimes(2);expect(readPendingGameCommand(localStorage,'u','room','s')).toBeNull();
});
it('resends an unconfirmed earlier command with its original ID before running a new tap',async()=>{
 localStorage.setItem('hf-server-command:u:room:s',JSON.stringify({...command,commandId:'earlier'}));
 const call=vi.fn(async(data:any)=>data.type==='getCommandResult'?{status:'waiting'}:{status:'applied'});
 await expect(submitPersistentGameCommand(localStorage,'u',command,call)).resolves.toEqual({status:'applied'});
 expect(call.mock.calls.map(([data]:any)=>data.type==='getCommandResult'?'lookup':data.commandId)).toEqual(['lookup','earlier','one']);
 expect(readPendingGameCommand(localStorage,'u','room','s')).toBeNull();
});
it('confirms a timed-out committed write without sending another mutation',async()=>{
 const call=vi.fn().mockRejectedValueOnce({code:'functions/deadline-exceeded'}).mockResolvedValueOnce({status:'confirmed',result:{status:'applied',cash:20}});
 expect(await submitPersistentGameCommand(localStorage,'u',command,call)).toEqual({status:'applied',cash:20});expect(call.mock.calls[1][0]).toEqual({type:'getCommandResult',roomId:'room',sessionId:'s',commandId:'one'});expect(call).toHaveBeenCalledTimes(2);
});
it.each(['functions/unavailable','functions/aborted','functions/unknown','functions/cancelled'])('retains an unknown write (%s) across reload, lookup only cannot trigger a write, and explicit retry uses its original ID',async code=>{
 const call=vi.fn().mockImplementation(data=>data.type==='getCommandResult'?Promise.resolve({status:'waiting'}):Promise.reject({code}));
 await expect(submitPersistentGameCommand(localStorage,'u',command,call)).rejects.toMatchObject({code});
 expect(readPendingGameCommand(localStorage,'u','room','s')).toEqual(command);
 const lookup=vi.fn().mockResolvedValue({status:'waiting'});expect((await confirmPendingGameCommand(localStorage,'u','room','s',lookup))?.status).toBe('waiting');expect(lookup.mock.calls[0][0].type).toBe('getCommandResult');
 const retry=vi.fn().mockResolvedValueOnce({status:'waiting'}).mockResolvedValueOnce({status:'duplicate',cash:10});expect(await submitPersistentGameCommand(localStorage,'u',command,retry)).toEqual({status:'duplicate',cash:10});expect(retry.mock.calls[1][0]).toEqual(command);
});
it('limits transaction-abort retries, checks the receipt first and keeps the same payload',async()=>{
 const call=vi.fn().mockRejectedValueOnce({code:'functions/aborted'}).mockResolvedValueOnce({status:'waiting'}).mockResolvedValueOnce({status:'applied'});
 expect(await submitPersistentGameCommand(localStorage,'u',command,call)).toEqual({status:'applied'});expect(call.mock.calls.map(c=>c[0])).toEqual([command,{type:'getCommandResult',roomId:'room',sessionId:'s',commandId:'one'},command]);
});
it('keeps the original command and does not retry a write if its confirmation is denied',async()=>{
 const call=vi.fn().mockRejectedValueOnce({code:'functions/aborted'}).mockRejectedValue({code:'functions/permission-denied'});
 await expect(submitPersistentGameCommand(localStorage,'u',command,call)).rejects.toMatchObject({code:'functions/aborted'});expect(readPendingGameCommand(localStorage,'u','room','s')).toEqual(command);expect(call.mock.calls.filter(c=>c[0].type!=='getCommandResult')).toHaveLength(1);
});
it('does not discard uncertain data when lookup fails or allow a new command',async()=>{
 const call=vi.fn().mockRejectedValue({code:'functions/internal'});await expect(submitPersistentGameCommand(localStorage,'u',command,call)).rejects.toBeDefined();
 await expect(submitPersistentGameCommand(localStorage,'u',{...command,commandId:'two'},vi.fn().mockResolvedValue({status:'waiting'}))).rejects.toMatchObject({code:'busy'});expect(readPendingGameCommand(localStorage,'u','room','s')?.commandId).toBe('one');
});
it('distinguishes confirmed domain waiting from an unknown transport result',async()=>{
 const call=vi.fn().mockRejectedValueOnce({code:'functions/deadline-exceeded'}).mockResolvedValueOnce({status:'confirmed',result:{status:'waiting',message:'等待共享'}});
 expect(await submitPersistentGameCommand(localStorage,'u',command,call)).toEqual({status:'waiting',message:'等待共享'});expect(readPendingGameCommand(localStorage,'u','room','s')).toBeNull();
});
it('fails before writing if storage is unavailable and isolates room, session and account',async()=>{
 const storage={getItem:()=>null,setItem:()=>{throw new Error('storage full');}} as unknown as Storage,call=vi.fn();await expect(submitPersistentGameCommand(storage,'u',command,call)).rejects.toThrow('storage full');expect(call).not.toHaveBeenCalled();
 const offline=vi.fn().mockRejectedValue({code:'functions/unavailable'});await expect(submitPersistentGameCommand(localStorage,'u',command,offline)).rejects.toBeDefined();expect(readPendingGameCommand(localStorage,'other','room','s')).toBeNull();expect(readPendingGameCommand(localStorage,'u','other','s')).toBeNull();expect(readPendingGameCommand(localStorage,'u','room','new')).toBeNull();
});
it('keeps a pending receipt when the response has no explicit status',async()=>{
 const call=vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({status:'waiting'});await expect(submitPersistentGameCommand(localStorage,'u',command,call)).rejects.toMatchObject({code:'functions/internal'});expect(readPendingGameCommand(localStorage,'u','room','s')).toEqual(command);
});
it('never erases a newer command when an older lookup finishes late',async()=>{
 localStorage.setItem('hf-server-command:u:room:s',JSON.stringify(command));let finish!:(value:unknown)=>void;
 const lookup=confirmPendingGameCommand(localStorage,'u','room','s',()=>new Promise(resolve=>{finish=resolve;}));
 const newer={...command,commandId:'newer'};localStorage.setItem('hf-server-command:u:room:s',JSON.stringify(newer));
 finish({status:'confirmed',result:{status:'applied'}});await lookup;expect(readPendingGameCommand(localStorage,'u','room','s')).toEqual(newer);
});

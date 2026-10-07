import {beforeEach,expect,it,vi} from 'vitest';
const trackGameEvent=vi.fn(async()=>undefined);
vi.mock('./telemetry',()=>({trackGameEvent}));
import {runLockedBoardCommand} from '../game/board/commandLock';
import {submitPersistentGameCommand} from '../game/board/pendingCommand';
beforeEach(()=>{trackGameEvent.mockClear();localStorage.clear();});

it('reports a click rejected because another command is in flight',async()=>{
 const inFlight=new Map<string,Promise<unknown>>();
 const first=runLockedBoardCommand(inFlight,'roll:a',()=>new Promise(()=>undefined));
 await expect(runLockedBoardCommand(inFlight,'turn-end:a',async()=>1)).rejects.toMatchObject({code:'busy'});
 await vi.waitFor(()=>expect(trackGameEvent).toHaveBeenCalledWith('command_rejected_client',{reason:'busy',command_type:'turn-end'}));
 void first;
});

it('reports a command blocked by an unconfirmed earlier command',async()=>{
 const command={type:'borrowLoan',roomId:'room',sessionId:'s',commandId:'loan:1',amount:10};
 localStorage.setItem('hf-server-command:u:room:s',JSON.stringify({...command,commandId:'loan:0'}));
 const call=vi.fn(async()=>({status:'waiting'}));
 await expect(submitPersistentGameCommand(localStorage,'u',command,call)).rejects.toMatchObject({code:'busy'});
 await vi.waitFor(()=>expect(trackGameEvent).toHaveBeenCalledWith('command_rejected_client',{reason:'pending-unconfirmed',command_type:'loan'}));
});

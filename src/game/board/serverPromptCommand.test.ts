import {expect,it,vi} from 'vitest';
const sdk=vi.hoisted(()=>({call:vi.fn(async(_data:unknown)=>({data:{status:'applied'}}))}));
vi.mock('firebase/app',()=>({getApp:()=>({})}));
vi.mock('firebase/functions',()=>({getFunctions:()=>({}),connectFunctionsEmulator:()=>{},httpsCallable:()=>sdk.call}));
import {callServerGameCommand} from './serverPromptCommand';
it('adds protocol metadata at the wire boundary without changing persisted command choices',async()=>{
 const original={type:'borrowLoan',roomId:'room',sessionId:'s',commandId:'original',amount:100};await callServerGameCommand(original);expect(sdk.call).toHaveBeenLastCalledWith({...original,clientProtocolVersion:1});expect(original).not.toHaveProperty('clientProtocolVersion');
 const query={type:'getCommandResult',roomId:'room',sessionId:'s',commandId:'original'};await callServerGameCommand(query);expect(sdk.call).toHaveBeenLastCalledWith({...query,clientProtocolVersion:1});
});
it('omits unset family funding fields on the wire while preserving explicit amounts and invalid nulls',async()=>{
 const command={type:'familyAction',roomId:'300404',sessionId:'s',eventId:'event',promptId:'prompt',commandId:'family:accept',accepted:true,forcedDebtAmount:undefined,fundingLoanAmount:undefined};
 await callServerGameCommand(command);
 const sent=sdk.call.mock.calls.at(-1)![0] as any;
 expect(sent).not.toHaveProperty('forcedDebtAmount');expect(sent).not.toHaveProperty('fundingLoanAmount');expect(sent.accepted).toBe(true);
 await callServerGameCommand({...command,forcedDebtAmount:0,fundingLoanAmount:3000});
 expect(sdk.call).toHaveBeenLastCalledWith({...command,forcedDebtAmount:0,fundingLoanAmount:3000,clientProtocolVersion:1});
 await callServerGameCommand({...command,forcedDebtAmount:null});
 expect(sdk.call.mock.calls.at(-1)![0]).toHaveProperty('forcedDebtAmount',null);
});

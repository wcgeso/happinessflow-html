import {beforeEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({call:vi.fn(),user:{uid:'admin'}}));
vi.mock('firebase/app',()=>({getApp:()=>({})}));vi.mock('firebase/auth',()=>({getAuth:()=>({currentUser:mocks.user})}));vi.mock('../board/serverPromptCommand',()=>({callServerGameCommand:mocks.call}));
import {setAdminScore} from './adminScore';
const choices={targetUid:'p',score:100,expectedExperience:7,expectedRankScore:9},result={status:'applied',targetUid:'p',experience:100,rankScore:100};
beforeEach(()=>{localStorage.clear();mocks.call.mockReset();mocks.user.uid='admin';});
it('shares identical in-flight requests and retains the same command on timeout recovery',async()=>{
 let finish:(value:unknown)=>void=()=>{};mocks.call.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const a=setAdminScore(choices),b=setAdminScore(choices);await vi.waitFor(()=>expect(mocks.call).toHaveBeenCalledTimes(1));finish(result);expect(await a).toEqual(result);expect(await b).toEqual(result);expect(localStorage.length).toBe(0);
 mocks.call.mockRejectedValueOnce({code:'functions/unavailable'}).mockResolvedValueOnce({status:'waiting'});await expect(setAdminScore(choices)).rejects.toMatchObject({code:'functions/unavailable'});const prior=JSON.parse(localStorage.getItem('hf-server-command:admin:score-admin:score-admin')!);mocks.call.mockResolvedValueOnce({status:'confirmed',result});expect(await setAdminScore(choices)).toEqual(result);expect(mocks.call.mock.calls.at(-1)?.[0]).toMatchObject({type:'getAdminScoreResult',commandId:prior.commandId});expect(localStorage.length).toBe(0);
});
it('preserves an ambiguous result and refuses changing an unconfirmed operation',async()=>{
 mocks.call.mockResolvedValue({status:'applied',targetUid:'p'});await expect(setAdminScore(choices)).rejects.toThrow('無法確認');expect(localStorage.length).toBe(1);mocks.call.mockClear();await expect(setAdminScore({...choices,score:200})).rejects.toThrow('原積分修改');expect(mocks.call).not.toHaveBeenCalled();
});
it('does not announce success after permission refusal',async()=>{
 mocks.call.mockRejectedValue({code:'functions/permission-denied'});await expect(setAdminScore(choices)).rejects.toMatchObject({code:'functions/permission-denied'});expect(localStorage.length).toBe(0);
});

it('clears an uncertain original command only after its durable rejection is confirmed',async()=>{
 mocks.call.mockRejectedValueOnce({code:'functions/unavailable'}).mockResolvedValueOnce({status:'waiting'});await expect(setAdminScore(choices)).rejects.toMatchObject({code:'functions/unavailable'});
 const prior=JSON.parse(localStorage.getItem('hf-server-command:admin:score-admin:score-admin')!);
 const rejected={status:'rejected',...choices,requestedScore:choices.score,code:'failed-precondition',message:'玩家積分已變動'};
 mocks.call.mockResolvedValueOnce({status:'waiting'}).mockResolvedValueOnce(rejected);await expect(setAdminScore(choices)).rejects.toMatchObject({code:'functions/failed-precondition'});expect(mocks.call.mock.calls.at(-1)?.[0].commandId).toBe(prior.commandId);expect(localStorage.length).toBe(0);
 const refreshed={...choices,expectedExperience:110,expectedRankScore:110};mocks.call.mockResolvedValueOnce(result);expect(await setAdminScore(refreshed)).toEqual(result);expect(mocks.call.mock.calls.at(-1)?.[0].commandId).not.toBe(prior.commandId);
});
it('retains the original command when a rejection does not identify the original choices',async()=>{
 mocks.call.mockResolvedValue({status:'rejected',targetUid:'p',requestedScore:200,expectedExperience:7,expectedRankScore:9,code:'failed-precondition',message:'rejected'});await expect(setAdminScore(choices)).rejects.toThrow('無法確認');expect(localStorage.length).toBe(1);
});

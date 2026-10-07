import {beforeEach,expect,it,vi} from 'vitest';
import type {Room} from '../../types';
import {PROFESSIONS,ENTERPRISES,DREAMS} from '../../constants';
import {buildPlayerSetup} from '../finance/playerSetup';
const mocks=vi.hoisted(()=>({send:vi.fn(),get:vi.fn(),auth:{currentUser:{uid:'p'}}}));
vi.mock('firebase/firestore',()=>({doc:(_db:unknown,...path:string[])=>path.join('/'),getDoc:mocks.get}));
vi.mock('../../../services/firebase',()=>({db:{},auth:mocks.auth}));
vi.mock('./serverPromptCommand',()=>({submitServerGameCommand:mocks.send}));
import {submitPlayerSetup} from './serverPlayerSetup';
const room={id:'r',sessionId:'s',startedAt:100,bankingAuthority:'server-banking-v1'} as Room;
const state=buildPlayerSetup({professionId:PROFESSIONS[0].id,enterpriseId:ENTERPRISES[0].id,dreamId:DREAMS[0].id},room,'玩家','財報');
beforeEach(()=>{vi.clearAllMocks();mocks.auth.currentUser={uid:'p'};mocks.send.mockResolvedValue({status:'duplicate'});mocks.get.mockImplementation((path:string)=>Promise.resolve({exists:()=>true,data:()=>path==='rooms/r'?{sessionId:'s'}:{...state,cash:123}}));});
it('sends only choices with a stable ID and restores current finances after replay',async()=>{
 expect((await submitPlayerSetup(room,'p',{...state,cash:999999})).cash).toBe(123);
 expect(mocks.send).toHaveBeenCalledWith({type:'setupPlayer',roomId:'r',sessionId:'s',commandId:'setup:s:p',professionId:PROFESSIONS[0].id,enterpriseId:ENTERPRISES[0].id,dreamId:DREAMS[0].id,playerName:'玩家',reportName:'財報'});
});
it('retains unconfirmed setup without reading or declaring success',async()=>{
 mocks.send.mockResolvedValue({status:'waiting',reason:'等待確認'});await expect(submitPlayerSetup(room,'p',state)).rejects.toThrow('等待確認');expect(mocks.get).not.toHaveBeenCalled();
});
it('rejects an unknown authority before submitting and stale sessions after confirmation',async()=>{
 await expect(submitPlayerSetup({...room,bankingAuthority:'future'} as unknown as Room,'p',state)).rejects.toThrow();expect(mocks.send).not.toHaveBeenCalled();
 mocks.get.mockResolvedValue({exists:()=>true,data:()=>({sessionId:'next'})});await expect(submitPlayerSetup(room,'p',state)).rejects.toThrow('場次或登入已變更');
});
it('rejects login changes before applying confirmed private state',async()=>{
 mocks.auth.currentUser={uid:'other'};await expect(submitPlayerSetup(room,'p',state)).rejects.toThrow('登入已變更');
});
it('uses official enterprise and dream values for all selections',()=>{
 for(const enterprise of ENTERPRISES)for(const dream of DREAMS){const initial=buildPlayerSetup({professionId:PROFESSIONS[0].id,enterpriseId:enterprise.id,dreamId:dream.id},room,'玩家','財報');expect(initial.selectedEnterprise).toEqual(enterprise);expect(initial.selectedDream).toEqual(dream);expect(initial.happiness.find(h=>h.id==='h_career')?.code).toBe(enterprise.id);expect(initial.happiness.find(h=>h.id==='h_dream')?.code).toBe(dream.id);}
 expect(()=>buildPlayerSetup({professionId:'fake',enterpriseId:ENTERPRISES[0].id,dreamId:DREAMS[0].id},room,'玩家','財報')).toThrow();
});

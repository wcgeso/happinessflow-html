import {beforeEach,expect,it,vi} from 'vitest';
import type {Room} from '../../types';
const mocks=vi.hoisted(()=>({submit:vi.fn(),auth:{currentUser:{uid:'coach'}}}));vi.mock('firebase/app',()=>({getApp:()=>({})}));vi.mock('firebase/auth',()=>({getAuth:()=>mocks.auth}));vi.mock('./serverPromptCommand',()=>({submitServerGameCommand:mocks.submit}));
import {submitRoomLifecycle} from './serverRoomLifecycle';
const room={id:'123456',sessionId:'s',hostId:'coach',bankingAuthority:'server-banking-v1'} as Room;
beforeEach(()=>{localStorage.clear();vi.resetAllMocks();mocks.auth.currentUser={uid:'coach'};});
it.each(['finishRoom','closeRoom'] as const)('keeps %s bound to the original session and sends no archive or player effects',async type=>{
 const result={status:'duplicate',roomId:room.id,sessionId:'s',closed:type==='closeRoom'};mocks.submit.mockResolvedValue(result);expect(await submitRoomLifecycle(room,'coach',type)).toEqual(result);expect(mocks.submit).toHaveBeenCalledWith({type,roomId:room.id,sessionId:'s',commandId:`${type}:s:coach`});
});
it('retains the original intent after a malformed result without replacing a newer draft',async()=>{
 mocks.submit.mockResolvedValue({status:'applied',roomId:'other',sessionId:'s',closed:true});await expect(submitRoomLifecycle(room,'coach','closeRoom')).rejects.toThrow('需要核對');expect(JSON.parse(localStorage.getItem('hf-server-command:coach:123456:s')!).commandId).toBe('closeRoom:s:coach');
 const newer={type:'setRoomSlot',roomId:room.id,sessionId:'s',commandId:'newer',slotIndex:5,isOpen:false};localStorage.setItem('hf-server-command:coach:123456:s',JSON.stringify(newer));await expect(submitRoomLifecycle(room,'coach','closeRoom')).rejects.toThrow('需要核對');expect(JSON.parse(localStorage.getItem('hf-server-command:coach:123456:s')!)).toEqual(newer);
});
it('rejects waiting, malformed results, unknown format and changed account',async()=>{
 mocks.submit.mockResolvedValue({status:'waiting',reason:'待確認'});await expect(submitRoomLifecycle(room,'coach','closeRoom')).rejects.toThrow('待確認');mocks.submit.mockResolvedValue({status:'applied',roomId:'other',sessionId:'s',closed:true});await expect(submitRoomLifecycle(room,'coach','closeRoom')).rejects.toThrow('需要核對');await expect(submitRoomLifecycle({...room,bankingAuthority:'future'} as unknown as Room,'coach','closeRoom')).rejects.toThrow('更新');mocks.auth.currentUser={uid:'other'};await expect(submitRoomLifecycle(room,'coach','closeRoom')).rejects.toThrow('登入');
});

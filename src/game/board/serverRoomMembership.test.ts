import {beforeEach,expect,it,vi} from 'vitest';
import type {Room} from '../../types';
const mocks=vi.hoisted(()=>({submit:vi.fn(),auth:{currentUser:{uid:'p'}}}));vi.mock('firebase/app',()=>({getApp:()=>({})}));vi.mock('firebase/auth',()=>({getAuth:()=>mocks.auth}));vi.mock('./serverPromptCommand',()=>({submitServerGameCommand:mocks.submit}));
import {submitRoomMembership} from './serverRoomMembership';
const room={id:'123456',sessionId:'s',bankingAuthority:'server-banking-v1'} as Room;
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();mocks.auth.currentUser={uid:'p'};});
it('shares a concurrent join intent and sends no player identity or edited membership',async()=>{
 let resolve!:(v:unknown)=>void;mocks.submit.mockImplementation(()=>new Promise(r=>{resolve=r;}));const first=submitRoomMembership(room,'p',{type:'joinRoom'}),second=submitRoomMembership(room,'p',{type:'joinRoom'});await vi.waitFor(()=>expect(mocks.submit).toHaveBeenCalledTimes(1));expect(mocks.submit).toHaveBeenCalledWith({type:'joinRoom',roomId:room.id,sessionId:'s',commandId:expect.any(String)});resolve({status:'applied'});expect(await first).toEqual(await second);
});
it('keeps the original slot intent through waiting, and a completed later action gets a fresh ID',async()=>{
 const prior={type:'setRoomSlot',roomId:room.id,sessionId:'s',commandId:'original',slotIndex:5,isOpen:false};localStorage.setItem('hf-server-command:p:123456:s',JSON.stringify(prior));mocks.submit.mockResolvedValue({status:'waiting',reason:'待確認'});await expect(submitRoomMembership(room,'p',{type:'setRoomSlot',slotIndex:5,isOpen:false})).rejects.toThrow('待確認');expect(mocks.submit).toHaveBeenCalledWith(prior);
 localStorage.clear();mocks.submit.mockResolvedValue({status:'duplicate'});await submitRoomMembership(room,'p',{type:'setRoomSlot',slotIndex:5,isOpen:false});expect(mocks.submit.mock.calls.at(-1)?.[0].commandId).not.toBe('original');
});
it('rejects unknown room formats or changed login before any submission',async()=>{
 await expect(submitRoomMembership({...room,bankingAuthority:'future'} as unknown as Room,'p',{type:'joinRoom'})).rejects.toThrow('更新');mocks.auth.currentUser={uid:'other'};await expect(submitRoomMembership(room,'p',{type:'joinRoom'})).rejects.toThrow('登入');expect(mocks.submit).not.toHaveBeenCalled();
});

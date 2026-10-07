import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({call:vi.fn(),get:vi.fn(),auth:{currentUser:{uid:'coach'} as {uid:string}|null}}));
vi.mock('../../../services/firebase',()=>({db:{}}));vi.mock('firebase/firestore',()=>({doc:(_db:unknown,...path:string[])=>path.join('/'),getDocFromServer:mocks.get}));
vi.mock('firebase/app',()=>({getApp:()=>({})}));vi.mock('firebase/auth',()=>({getAuth:()=>mocks.auth}));vi.mock('./serverPromptCommand',()=>({callServerGameCommand:mocks.call}));
import {createRoomOnServer,recoverRoomCreationOnServer} from './serverRoomCreation';
const choices={name:'測試房',maxPlayers:6,duration:60};
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();mocks.auth.currentUser={uid:'coach'};mocks.get.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',hostId:'coach',sessionId:mocks.call.mock.calls.at(-1)?.[0]?.commandId==='original'?'s':'server-session',status:'waiting'})}));});
it('shares an in-progress create intent and sends no client room ID or authority',async()=>{
 let resolve!:(value:unknown)=>void;mocks.call.mockImplementation(()=>new Promise(r=>{resolve=r;}));const a=createRoomOnServer(choices),b=createRoomOnServer(choices);await vi.waitFor(()=>expect(mocks.call).toHaveBeenCalledTimes(1));expect(mocks.call).toHaveBeenCalledWith({type:'createRoom',commandId:expect.any(String),...choices});resolve({status:'applied',roomId:'123456',sessionId:'server-session'});expect(await a).toEqual(await b);
});
it('queries a persisted unknown operation before retrying its original ID',async()=>{
 localStorage.setItem('hf-server-command:coach:new-room:new-room',JSON.stringify({type:'createRoom',roomId:'new-room',sessionId:'new-room',commandId:'original',...choices}));mocks.call.mockResolvedValueOnce({status:'waiting'}).mockResolvedValueOnce({status:'duplicate',roomId:'123456',sessionId:'s'});expect((await createRoomOnServer(choices)).roomId).toBe('123456');expect(mocks.call.mock.calls.map(([data])=>data)).toEqual([{type:'getRoomCreationResult',commandId:'original'},{type:'createRoom',commandId:'original',...choices}]);
});
it('uses a confirmed creation after reload without creating a second room',async()=>{
 localStorage.setItem('hf-server-command:coach:new-room:new-room',JSON.stringify({type:'createRoom',roomId:'new-room',sessionId:'new-room',commandId:'original',...choices}));mocks.call.mockResolvedValue({status:'confirmed',result:{status:'applied',roomId:'123456',sessionId:'s'}});await createRoomOnServer(choices);expect(mocks.call).toHaveBeenCalledTimes(1);expect(localStorage.length).toBe(0);
});
it('preserves the original intent when settings change or both submission and lookup time out',async()=>{
 const pending={type:'createRoom',roomId:'new-room',sessionId:'new-room',commandId:'original',...choices};localStorage.setItem('hf-server-command:coach:new-room:new-room',JSON.stringify(pending));await expect(createRoomOnServer({...choices,name:'改名'})).rejects.toThrow('保留原設定');expect(mocks.call).not.toHaveBeenCalled();mocks.call.mockRejectedValue(Object.assign(new Error('timeout'),{code:'functions/deadline-exceeded'}));await expect(createRoomOnServer(choices)).rejects.toThrow();expect(JSON.parse(localStorage.getItem('hf-server-command:coach:new-room:new-room')!)).toEqual(pending);
});
it('requires login and does not present another account’s created room',async()=>{
 mocks.auth.currentUser=null;await expect(createRoomOnServer(choices)).rejects.toThrow('請先登入');expect(mocks.call).not.toHaveBeenCalled();mocks.auth.currentUser={uid:'coach'};mocks.call.mockImplementation(async()=>{mocks.auth.currentUser={uid:'other'};return {status:'applied',roomId:'123456',sessionId:'s'};});await expect(createRoomOnServer(choices)).rejects.toThrow('登入已變更');
});

it('retains a confirmed original command when loading fails, then attaches it without another create',async()=>{
 mocks.call.mockResolvedValueOnce({status:'applied',roomId:'123456',sessionId:'server-session'});mocks.get.mockRejectedValueOnce(new Error('離線'));
 await expect(createRoomOnServer(choices)).rejects.toThrow('房間 123456 已建立');const original=JSON.parse(localStorage.getItem('hf-server-command:coach:new-room:new-room')!);expect(original.commandId).toBe(mocks.call.mock.calls[0][0].commandId);
 mocks.call.mockResolvedValue({status:'confirmed',result:{status:'applied',roomId:'123456',sessionId:'server-session'}});expect((await recoverRoomCreationOnServer(false))?.room.hostId).toBe('coach');expect(mocks.call.mock.calls.slice(1).every(([c])=>c.type==='getRoomCreationResult')).toBe(true);expect(localStorage.length).toBe(0);
});
it('never replaces a newer draft after an older confirmed room fails to attach',async()=>{
 const newer={type:'createRoom',roomId:'new-room',sessionId:'new-room',commandId:'newer',...choices};mocks.call.mockResolvedValue({status:'applied',roomId:'123456',sessionId:'server-session'});mocks.get.mockImplementationOnce(async()=>{localStorage.setItem('hf-server-command:coach:new-room:new-room',JSON.stringify(newer));throw new Error('離線');});await expect(createRoomOnServer(choices)).rejects.toThrow();expect(JSON.parse(localStorage.getItem('hf-server-command:coach:new-room:new-room')!)).toEqual(newer);
});
it('query-only recovery never creates an unconfirmed room and malformed drafts remain intact',async()=>{
 const original={type:'createRoom',roomId:'new-room',sessionId:'new-room',commandId:'original',...choices};localStorage.setItem('hf-server-command:coach:new-room:new-room',JSON.stringify(original));mocks.call.mockResolvedValue({status:'waiting',message:'未找到結果'});await expect(recoverRoomCreationOnServer(false)).rejects.toThrow('未找到');expect(mocks.call).toHaveBeenCalledTimes(1);expect(mocks.call).toHaveBeenCalledWith({type:'getRoomCreationResult',commandId:'original'});
 const malformed={...original,maxPlayers:'six'};localStorage.setItem('hf-server-command:coach:new-room:new-room',JSON.stringify(malformed));mocks.call.mockClear();await expect(recoverRoomCreationOnServer(true)).rejects.toThrow('保留資料');expect(mocks.call).not.toHaveBeenCalled();expect(JSON.parse(localStorage.getItem('hf-server-command:coach:new-room:new-room')!)).toEqual(malformed);
});
it('keeps ambiguous results for lookup but releases an original room confirmed deleted by the server',async()=>{
 mocks.call.mockResolvedValueOnce({status:'applied'});await expect(createRoomOnServer(choices)).rejects.toThrow('開房結果尚未確認');expect(localStorage.getItem('hf-server-command:coach:new-room:new-room')).not.toBeNull();
 mocks.call.mockResolvedValue({status:'confirmed',result:{status:'applied',roomId:'123456',sessionId:'server-session'}});mocks.get.mockResolvedValueOnce({exists:()=>false,data:()=>undefined});await expect(recoverRoomCreationOnServer(false)).rejects.toThrow('原房間已關閉');expect(localStorage.length).toBe(0);
});

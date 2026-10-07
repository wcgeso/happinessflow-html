import {afterEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({calls:[] as any[][],uid:'player' as string|null,close:vi.fn(),readDoc:vi.fn(),readQuery:vi.fn()}));
vi.mock('firebase/firestore',()=>({onSnapshot:(...args:any[])=>{mock.calls.push(args);return mock.close;},getDocFromServer:mock.readDoc,getDocsFromServer:mock.readQuery}));
vi.mock('firebase/auth',()=>({getAuth:()=>({currentUser:mock.uid?{uid:mock.uid}:null})}));
import {observeSnapshots,getSubscriptionHealth,getSubscriptionErrors} from './recoveringSnapshot';
afterEach(()=>{mock.calls=[];mock.uid='player';mock.readDoc.mockReset();mock.readQuery.mockReset();vi.useRealTimers();});
it('rebuilds transient failures, verifies server access after permission errors and ignores old callbacks',async()=>{
 vi.useFakeTimers();const received=vi.fn(),error=vi.fn();
 const reference={type:'document',path:'rooms/test'};
 const stop=(observeSnapshots('test') as any)(reference,received,error);
 try{
  const old=mock.calls[0];old[1]({metadata:{fromCache:false}});
  old[2]({code:'unavailable'});expect(error).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(500);expect(mock.calls).toHaveLength(2);
  old[1]({metadata:{fromCache:false}});expect(received).toHaveBeenCalledTimes(1);
  mock.calls[1][2]({code:'permission-denied'});
  expect(JSON.parse(getSubscriptionErrors())[0].code).toBe('permission-denied');
  vi.advanceTimersByTime(10000);expect(mock.calls).toHaveLength(2);
  mock.uid=null;window.dispatchEvent(new Event('hf-reconnect'));expect(mock.readDoc).not.toHaveBeenCalled();
  mock.uid='player';mock.readDoc.mockRejectedValueOnce({code:'permission-denied'});
  window.dispatchEvent(new Event('hf-reconnect'));await Promise.resolve();await Promise.resolve();
  expect(mock.calls).toHaveLength(2);expect(mock.readDoc).toHaveBeenCalledWith(reference);
  expect(JSON.parse(getSubscriptionErrors())[0].code).toBe('permission-denied');
  mock.readDoc.mockResolvedValueOnce({});window.dispatchEvent(new Event('hf-reconnect'));
  await Promise.resolve();expect(mock.calls).toHaveLength(3);
  mock.calls[2][1]({metadata:{fromCache:false}});
  expect(JSON.parse(getSubscriptionHealth())[0].status).toBe('live');
 }finally{stop();}
 mock.calls[2][1]({metadata:{fromCache:false}});expect(received).toHaveBeenCalledTimes(2);
 expect(getSubscriptionHealth()).toBe('[]');expect(getSubscriptionErrors()).toBe('[]');
});
it('checks the exact query once during concurrent resume events, without publishing probe results',async()=>{
 let resolve!:(value:unknown)=>void;mock.readQuery.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const reference={type:'query'},received=vi.fn(),stop=(observeSnapshots('query') as any)(reference,{includeMetadataChanges:true},received,vi.fn());
 try{
  mock.calls[0][3]({code:'permission-denied'});
  window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('hf-reconnect'));
  expect(mock.readQuery).toHaveBeenCalledTimes(1);expect(mock.readQuery).toHaveBeenCalledWith(reference);
  expect(mock.calls).toHaveLength(1);resolve({docs:[]});await Promise.resolve();
  expect(mock.calls).toHaveLength(2);expect(received).not.toHaveBeenCalled();
 }finally{stop();}
});
it.each(['account','disposed','hidden'])('does not revive a stale listener after access verification: %s',async reason=>{
 let resolve!:(value:unknown)=>void;mock.readDoc.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const stop=(observeSnapshots('scope') as any)({type:'document',path:'rooms/test'},vi.fn(),vi.fn());
 try{
  mock.calls[0][2]({code:'permission-denied'});window.dispatchEvent(new Event('hf-reconnect'));
  if(reason==='account')mock.uid='different';
  if(reason==='disposed')stop();
  if(reason==='hidden')vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');
  resolve({});await Promise.resolve();expect(mock.calls).toHaveLength(1);
 }finally{stop();vi.restoreAllMocks();}
});
it('cannot reuse an old account subscription or restart an unsupported target after denial',async()=>{
 const stop=(observeSnapshots('scope') as any)({path:'unknown'},vi.fn(),vi.fn());
 try{
  mock.calls[0][2]({code:'permission-denied'});mock.uid='different';
  window.dispatchEvent(new Event('hf-reconnect'));expect(mock.readDoc).not.toHaveBeenCalled();
  mock.uid='player';window.dispatchEvent(new Event('hf-reconnect'));await Promise.resolve();
  expect(mock.calls).toHaveLength(1);expect(mock.readQuery).not.toHaveBeenCalled();
 }finally{stop();}
});

it('ignores snapshots and scheduled retries from an account that has changed',()=>{
 vi.useFakeTimers();const received=vi.fn();
 const stop=(observeSnapshots('account') as any)({type:'document',path:'rooms/test'},received,vi.fn());
 try{
  mock.calls[0][2]({code:'unavailable'});mock.uid='different';
  mock.calls[0][1]({metadata:{fromCache:false}});vi.advanceTimersByTime(500);
  expect(received).not.toHaveBeenCalled();expect(mock.calls).toHaveLength(1);
 }finally{stop();}
});

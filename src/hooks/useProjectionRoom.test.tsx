import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {Room} from '../types';
const listeners=vi.hoisted(()=>({entries:[] as {path:string;next:(s:any)=>void;error:(e:any)=>void;stop:ReturnType<typeof vi.fn>}[]}));
vi.mock('../../services/firebase',()=>({db:{}}));
vi.mock('firebase/firestore',()=>({doc:(_db:unknown,...parts:string[])=>parts.join('/'),collection:(_db:unknown,...parts:string[])=>parts.join('/')}));
vi.mock('../utils/telemetry',()=>({trackBoardStage:vi.fn()}));
vi.mock('./usePublicPlayerStates',()=>({usePublicPlayerStates:vi.fn()}));
vi.mock('../utils/recoveringSnapshot',()=>({observeSnapshots:()=> (path:string,_options:any,next:(s:any)=>void,error:(e:any)=>void)=>{const entry={path,next,error,stop:vi.fn()};listeners.entries.push(entry);return entry.stop;}}));
import {useProjectionRoom} from './useProjectionRoom';
import {usePublicPlayerStates} from './usePublicPlayerStates';
const room=(id='r',sessionId='s',revision=5)=>({id,sessionId,hostId:'coach',status:'playing',publicPlayerStorage:'subcollection',bankingAuthority:'server-banking-v1',members:[{uid:'coach'},{uid:'p'}],boardState:{revision,updatedAt:revision*100,currentTurnUid:'p',currentCardReveal:{isRevealed:true},sharedCardPrompt:{id:'prompt',sourcePlayerUid:'coach',targetPlayerUids:['p'],responseStorage:'subcollection'}}}) as Room;
const snapshot=(value:Room|null,fromCache=false,hasPendingWrites=false)=>({exists:()=>!!value,data:()=>value,metadata:{fromCache,hasPendingWrites}});
const emit=(index:number,value:Room|null,cached=false,pending=false)=>act(()=>listeners.entries[index].next(snapshot(value,cached,pending)));
afterEach(()=>{cleanup();listeners.entries.length=0;vi.clearAllMocks();});
it('waits for auth, then scopes the root listener to the account and hides old room data on changes',()=>{
 const hook=renderHook(({id,uid}:{id:string;uid?:string})=>useProjectionRoom(id,uid),{initialProps:{id:'r',uid:undefined}});expect(listeners.entries).toHaveLength(0);
 hook.rerender({id:'r',uid:'coach'});emit(0,room());expect(hook.result.current.room?.id).toBe('r');
 hook.rerender({id:'next',uid:'coach'});expect(hook.result.current.room).toBeNull();expect(listeners.entries[0].stop).toHaveBeenCalledOnce();emit(0,room());expect(hook.result.current.room).toBeNull();emit(2,room('next'));expect(hook.result.current.room?.id).toBe('next');
 hook.rerender({id:'next',uid:'other'});expect(hook.result.current.room).toBeNull();expect(hook.result.current.syncState).toBe('loading');
});
it('preserves a confirmed board through cached misses, older revisions and unconfirmed server writes',()=>{
 const {result}=renderHook(()=>useProjectionRoom('r','coach'));emit(0,room());const confirmed=result.current.room;
 emit(0,null,true);expect(result.current.room).toBe(confirmed);expect(result.current.syncState).toBe('cached');
 emit(0,room('r','s',4),true);expect(result.current.room).toBe(confirmed);emit(0,room('r','older-session',1),true);expect(result.current.room).toBe(confirmed);emit(0,{...room(),boardState:undefined},true);expect(result.current.room).toBe(confirmed);
 emit(0,room('r','s',6),false,true);expect(result.current.room).toBe(confirmed);emit(0,room());expect(result.current.room).toBe(confirmed);expect(result.current.syncState).toBe('live');
 emit(0,null);expect(result.current.room).toBeNull();expect(result.current.syncState).toBe('missing');
});
it('filters prompt identities and ignores removed prompts, old sessions and unsubscribed callbacks',()=>{
 const {result}=renderHook(()=>useProjectionRoom('r','coach'));emit(0,room());expect(listeners.entries[1].path).toBe('rooms/r/events/prompt/responses');
 const records=[['p','p','prompt'],['other','other','prompt'],['coach','wrong','prompt'],['coach','coach','old']].map(([id,playerUid,promptId])=>({id,data:()=>({playerUid,promptId,status:'completed'})}));act(()=>listeners.entries[1].next({docs:records}));expect(Object.keys(result.current.room!.boardState!.sharedCardPrompt!.responses!)).toEqual(['p']);
 emit(0,{...room(),boardState:{...room().boardState!,sharedCardPrompt:null}});expect(listeners.entries[1].stop).toHaveBeenCalledOnce();act(()=>listeners.entries[1].next({docs:records}));expect(result.current.room!.boardState!.sharedCardPrompt).toBeNull();
 emit(0,room('r','next'));expect(result.current.room?.sessionId).toBe('next');expect(result.current.room!.boardState!.sharedCardPrompt!.responses).toBeUndefined();
});
it('keeps root errors visible without discarding the board and ignores errors after changing rooms',()=>{
 const hook=renderHook(({id})=>useProjectionRoom(id,'coach'),{initialProps:{id:'r'}});emit(0,room());const confirmed=hook.result.current.room;act(()=>listeners.entries[0].error({code:'unavailable'}));expect(hook.result.current.room).toBe(confirmed);expect(hook.result.current.syncState).toBe('error');
 hook.rerender({id:'next'});act(()=>listeners.entries[0].error({code:'permission-denied'}));expect(hook.result.current.syncState).toBe('loading');
});
it('retains public summaries on unchanged root snapshots and refuses mismatched room data',()=>{
 const {result}=renderHook(()=>useProjectionRoom('r','coach'));emit(0,room());const setRoom=vi.mocked(usePublicPlayerStates).mock.calls.at(-1)![2];act(()=>setRoom(current=>({...current!,publicPlayerStates:{p:{uid:'p',happinessTotal:10} as any}})));const summary=result.current.room;emit(0,room());expect(result.current.room).toBe(summary);
 emit(0,room('wrong'));expect(result.current.room).toBe(summary);expect(result.current.syncState).toBe('error');
});

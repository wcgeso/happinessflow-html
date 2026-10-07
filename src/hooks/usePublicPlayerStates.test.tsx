import {useState} from 'react';
import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {Room} from '../types';
const listeners=vi.hoisted(()=>({entries:[] as {next:(s:any)=>void;stop:ReturnType<typeof vi.fn>}[]}));
vi.mock('../../services/firebase',()=>({db:{}}));
vi.mock('firebase/firestore',()=>({collection:(_db:unknown,...parts:string[])=>parts.join('/')}));
vi.mock('../utils/recoveringSnapshot',()=>({observeSnapshots:()=> (_path:unknown,_options:unknown,next:(s:any)=>void)=>{const entry={next,stop:vi.fn()};listeners.entries.push(entry);return entry.stop;}}));
import {usePublicPlayerStates} from './usePublicPlayerStates';
afterEach(()=>{cleanup();listeners.entries.length=0;});
const initial=()=>({id:'room',sessionId:'s',publicPlayerStorage:'subcollection',members:[{uid:'p'},{uid:'gone',isLeft:true}],publicPlayerStates:{}} as Room);
const record=(id:string,sessionId='s',uid=id)=>({id,data:()=>({uid,sessionId,happinessTotal:10})});
function harness(){return renderHook(()=>{const [room,setRoom]=useState<Room|null>(initial);const [error,setError]=useState('');usePublicPlayerStates(room,true,setRoom,setError);return {room,setRoom,error};});}
it('filters stale sessions, departed players and mismatched identities without recreating subscriptions',()=>{
 const {result}=harness();act(()=>listeners.entries[0].next({docs:[record('p'),record('other'),record('gone'),record('old','old'),record('fake','s','p')]}));expect(result.current.room!.publicPlayerStates).toEqual({p:{uid:'p',happinessTotal:10}});expect(listeners.entries).toHaveLength(1);
 const previous=result.current.room;act(()=>listeners.entries[0].next({docs:[record('p')]}));expect(result.current.room).toBe(previous);
});
it('ignores a delayed previous-session callback and unsubscribes on room changes',()=>{
 const {result,unmount}=harness();act(()=>result.current.setRoom({...initial(),sessionId:'next'}));expect(listeners.entries[0].stop).toHaveBeenCalledOnce();act(()=>listeners.entries[0].next({docs:[record('p')]}));expect(result.current.room!.publicPlayerStates).toEqual({});act(()=>listeners.entries[1].next({docs:[record('p','next')]}));expect(result.current.room!.publicPlayerStates!.p.happinessTotal).toBe(10);unmount();expect(listeners.entries[1].stop).toHaveBeenCalledOnce();
});
it('keeps legacy rooms on the existing room projection path',()=>{
 renderHook(()=>{const [room,setRoom]=useState<Room|null>({...initial(),publicPlayerStorage:undefined});const [,setError]=useState('');usePublicPlayerStates(room,true,setRoom,setError);});expect(listeners.entries).toHaveLength(0);
});

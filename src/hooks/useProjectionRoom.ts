import {useCallback,useEffect,useMemo,useState} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import {collection,doc} from 'firebase/firestore';
import {db} from '../../services/firebase';
import type {Room} from '../types';
import {observeSnapshots} from '../utils/recoveringSnapshot';
import {trackBoardStage} from '../utils/telemetry';
import {mergeRoomSnapshotWithPrivateStates,shouldAcceptBoardSnapshot} from '../game/board/roomSnapshot';
import {usePublicPlayerStates} from './usePublicPlayerStates';
const onProjectionSnapshot=observeSnapshots('projection');
type SyncState='loading'|'live'|'missing'|'error'|'cached';
export function useProjectionRoom(roomCode:string,uid?:string){
 const scope=`${uid||''}:${roomCode}`;
 const [state,setState]=useState<{scope:string;room:Room|null;sync:SyncState;snapshotHash?:string;confirmed?:boolean}>({scope,room:null,sync:'loading'});
 const baseRoom=state.scope===scope?state.room:null,syncState=state.scope===scope?state.sync:'loading';
 const setRoom:Dispatch<SetStateAction<Room|null>>=useCallback(update=>setState(current=>current.scope!==scope?current:{...current,room:typeof update==='function'?update(current.room):update}),[scope]);
 useEffect(()=>{
  let active=true;setState({scope,room:null,sync:'loading'});
  if(!uid)return()=>{active=false;};
  const stop=onProjectionSnapshot(doc(db,'rooms',roomCode),{includeMetadataChanges:true},snapshot=>{
   if(!active)return;
   const cached=!!snapshot.metadata.fromCache||!!snapshot.metadata.hasPendingWrites;
   if(!snapshot.exists()){
    setState(current=>!active||current.scope!==scope?current:{...current,room:cached?current.room:null,sync:cached?'cached':'missing'});return;
   }
   const data=snapshot.data() as Room;
   if(data.id!==roomCode){setState(current=>!active||current.scope!==scope?current:{...current,sync:'error'});return;}
   const snapshotHash=JSON.stringify(data);
   trackBoardStage('received',roomCode,data.boardState,{surface:'projection',from_cache:snapshot.metadata.fromCache,pending_writes:snapshot.metadata.hasPendingWrites});
   setState(current=>{
    if(!active||current.scope!==scope)return current;
    const outdated=(cached&&current.confirmed&&!!current.room&&current.room.sessionId!==data.sessionId)||!shouldAcceptBoardSnapshot(current.room,data)||(cached&&current.room?.sessionId===data.sessionId&&!!current.room?.boardState&&!data.boardState);
    const unconfirmed=snapshot.metadata.hasPendingWrites&&data.bankingAuthority==='server-banking-v1';
    const sync=cached?'cached':'live',unchanged=outdated||unconfirmed||current.snapshotHash===snapshotHash;
    const room=unchanged?current.room:mergeRoomSnapshotWithPrivateStates(data,current.room);
    const hash=outdated||unconfirmed?current.snapshotHash:snapshotHash;
    return room===current.room&&sync===current.sync&&hash===current.snapshotHash?current:{...current,scope,room,sync,snapshotHash:hash,confirmed:current.confirmed||(!cached&&!outdated&&!unconfirmed)};
   });
  },()=>{if(active)setState(current=>active&&current.scope===scope?{...current,sync:'error'}:current);});
  return()=>{active=false;stop();};
 },[scope,roomCode,uid]);
 usePublicPlayerStates(baseRoom,!!uid&&syncState==='live',setRoom);
 const prompt=baseRoom?.boardState?.familyMilestoneJoinPrompt?.responseStorage==='subcollection'?baseRoom.boardState.familyMilestoneJoinPrompt:baseRoom?.boardState?.sharedCardPrompt?.responseStorage==='subcollection'?baseRoom.boardState.sharedCardPrompt:null;
 const promptId=prompt?.id,sessionId=baseRoom?.sessionId;
 const [replies,setReplies]=useState<{scope:string;sessionId?:string;promptId:string;responses:Record<string,any>}|null>(null);
 const participants=prompt?[prompt.sourcePlayerUid,...prompt.targetPlayerUids].sort().join('|'):'';
 useEffect(()=>{
  let active=true;setReplies(null);
  if(!uid||!promptId)return()=>{active=false;};
  const allowed=new Set(participants.split('|'));
  const stop=onProjectionSnapshot(collection(db,'rooms',roomCode,'events',promptId,'responses'),{includeMetadataChanges:true},snapshot=>{
   if(!active)return;
   const responses=Object.fromEntries(snapshot.docs.filter(d=>allowed.has(d.id)&&d.data().playerUid===d.id&&(d.data().promptId==null||d.data().promptId===promptId)).map(d=>[d.id,d.data()]));
   setReplies(current=>active?{scope,sessionId,promptId,responses}:current);
  });
  return()=>{active=false;stop();};
 },[scope,uid,roomCode,sessionId,promptId,participants]);
 const room=useMemo(()=>{
  if(!baseRoom?.boardState||replies?.scope!==scope||replies.sessionId!==sessionId||replies.promptId!==promptId)return baseRoom;
  const key=baseRoom.boardState.familyMilestoneJoinPrompt?.id===promptId?'familyMilestoneJoinPrompt':'sharedCardPrompt';
  const current=baseRoom.boardState[key];if(!current)return baseRoom;
  return {...baseRoom,boardState:{...baseRoom.boardState,[key]:{...current,responses:{...(current.responses||{}),...replies.responses}}}} as Room;
 },[baseRoom,replies,scope,sessionId,promptId]);
 return {room,syncState};
}

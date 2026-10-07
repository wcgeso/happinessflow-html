import {useEffect} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import {collection} from 'firebase/firestore';
import {db} from '../../services/firebase';
import type {Room,PublicPlayerState} from '../types';
import {observeSnapshots} from '../utils/recoveringSnapshot';
const onPublicSnapshot=observeSnapshots('public-players');
export function usePublicPlayerStates(room:Room|null,enabled:boolean,setRoom:Dispatch<SetStateAction<Room|null>>,setError?:(message:string)=>void){
 const members=room?.members?.filter(m=>!m.isLeft).map(m=>m.uid).sort().join('|')||'';
 useEffect(()=>{
  if(!enabled||!room?.id||!room.sessionId||room.publicPlayerStorage!=='subcollection')return;
  const roomId=room.id,sessionId=room.sessionId,active=new Set(members.split('|'));
  return onPublicSnapshot(collection(db,'rooms',roomId,'publicPlayers'),{includeMetadataChanges:true},snapshot=>{
   const states=Object.fromEntries(snapshot.docs.filter(d=>d.data().sessionId===sessionId&&d.data().uid===d.id&&active.has(d.id)).map(d=>{const {sessionId:_session,...projection}=d.data();return [d.id,projection as PublicPlayerState];}));
   setRoom(current=>current?.id===roomId&&current.sessionId===sessionId&&current.publicPlayerStorage==='subcollection'&&JSON.stringify(current.publicPlayerStates)!==JSON.stringify(states)?{...current,publicPlayerStates:states}:current);
  },error=>setError?.(`公開玩家狀態尚未同步：${error.code}`));
 },[room?.id,room?.sessionId,room?.publicPlayerStorage,members,enabled,setRoom,setError]);
}

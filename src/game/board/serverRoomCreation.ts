import {runLockedBoardCommand} from './commandLock';
import {getApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {doc,getDocFromServer} from 'firebase/firestore';
import {db} from '../../../services/firebase';
import type {Room} from '../../types';
import {getRoomCompatibilityError} from './roomCompatibility';
import {callServerGameCommand} from './serverPromptCommand';
import {readPendingGameCommand,submitPersistentGameCommand,gameCommandContents,pendingCommandEvent} from './pendingCommand';
const creating=new Map<string,Promise<unknown>>();
type RoomSettings={name:string;maxPlayers:number;duration:number};
export async function recoverRoomCreationOnServer(retry=false){
 const uid=getAuth(getApp()).currentUser?.uid;if(!uid)throw new Error('請先登入再恢復房間');
 const prior=readPendingGameCommand(localStorage,uid,'new-room','new-room');if(!prior)return null;
 if(prior.type!=='createRoom'||typeof prior.name!=='string'||!Number.isSafeInteger(prior.maxPlayers)||Number(prior.maxPlayers)<1||Number(prior.maxPlayers)>6||!Number.isSafeInteger(prior.duration)||Number(prior.duration)<1||Number(prior.duration)>1440)throw new Error('原開房資料需要核對，請保留資料。');
 if(!retry){
  const query=await callServerGameCommand<{status:string;message?:string}>({type:'getRoomCreationResult',commandId:prior.commandId});
  if(query.status!=='confirmed')throw new Error(query.message||'尚未找到開房結果，請安全重試原操作。');
 }
 return createRoomOnServer({name:prior.name as string,maxPlayers:prior.maxPlayers as number,duration:prior.duration as number});
}
export async function createRoomOnServer(settings:RoomSettings):Promise<{status:string;roomId:string;sessionId:string;room:Room}>{
 const uid=getAuth(getApp()).currentUser?.uid;if(!uid)throw new Error('請先登入再建立房間');
 return runLockedBoardCommand(creating,`${uid}:${gameCommandContents(settings)}`,async()=>{
 // Reuse the existing command recovery store, with a scope reserved for creation before a room exists.
 const roomId='new-room',sessionId='new-room',prior=readPendingGameCommand(localStorage,uid,roomId,sessionId),choices={name:settings.name,maxPlayers:settings.maxPlayers,duration:settings.duration};
 if(prior&&(prior.type!=='createRoom'||gameCommandContents({name:prior.name,maxPlayers:prior.maxPlayers,duration:prior.duration})!==gameCommandContents(choices)))throw new Error('原開房操作尚待確認，請保留原設定並重試。');
 const command=prior||{type:'createRoom',roomId,sessionId,commandId:crypto.randomUUID(),...choices};
 const result=await submitPersistentGameCommand<{status:string;roomId:string;sessionId:string}>(localStorage,uid,command,data=>{
  const c=data as typeof command;
  return callServerGameCommand(c.type==='getCommandResult'?{type:'getRoomCreationResult',commandId:c.commandId}:{type:'createRoom',commandId:c.commandId,name:c.name,maxPlayers:c.maxPlayers,duration:c.duration});
 });
 let confirmedClosed=false;
 try{
  if(!['applied','duplicate'].includes(result.status)||typeof result.roomId!=='string'||!/^\d{6}$/.test(result.roomId)||typeof result.sessionId!=='string'||!result.sessionId)throw new Error('開房結果尚未確認，請沿用原操作查核。');
  if(getAuth(getApp()).currentUser?.uid!==uid)throw new Error('登入已變更，請登入原帳號恢復房間。');
  const snapshot=await getDocFromServer(doc(db,'rooms',result.roomId)),room=snapshot.data() as Room|undefined;
  if(!snapshot.exists()){confirmedClosed=true;throw new Error('原房間已關閉，請重新建立。');}
  if(!room||room.id!==result.roomId||room.sessionId!==result.sessionId||room.hostId!==uid)throw new Error('原房間已關閉或資料已變更，請核對原開房結果。');
  const compatibilityError=getRoomCompatibilityError(room);if(compatibilityError)throw new Error(compatibilityError);
  if(getAuth(getApp()).currentUser?.uid!==uid)throw new Error('登入已變更，請登入原帳號恢復房間。');
  return {...result,room};
 }catch(error){
  // A confirmed create is still the original intent if attaching its room fails.
  // Never overwrite a newer command saved by another tab.
  if(!confirmedClosed&&!readPendingGameCommand(localStorage,uid,roomId,sessionId)){
   localStorage.setItem(`hf-server-command:${uid}:${roomId}:${sessionId}`,JSON.stringify(command));
   window.dispatchEvent(new Event(pendingCommandEvent));
  }
  if(confirmedClosed)throw error;
  const label=typeof result.roomId==='string'?`房間 ${result.roomId} 已建立，但尚未載入`:'開房結果尚未確認';
  throw new Error(`${label}：${(error as Error).message}；請恢復原開房操作。`);
 }
 });
}

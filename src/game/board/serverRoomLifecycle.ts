import {getApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import type {Room} from '../../types';
import {getRoomCompatibilityError} from './roomCompatibility';
import {submitServerGameCommand} from './serverPromptCommand';
import {pendingCommandEvent,readPendingGameCommand} from './pendingCommand';
export async function submitRoomLifecycle(room:Room,uid:string,type:'finishRoom'|'closeRoom'){
 if(getAuth(getApp()).currentUser?.uid!==uid)throw new Error('登入帳號已變更，請重新確認房間。');
 const error=getRoomCompatibilityError(room);if(error)throw new Error(error);
 if(!room.sessionId||room.hostId!==uid)throw new Error('只有本場執行師可以結束或關閉房間');
 const command={type,roomId:room.id,sessionId:room.sessionId,commandId:`${type}:${room.sessionId}:${uid}`};
 const result=await submitServerGameCommand<{status:string;reason?:string;roomId:string;sessionId:string;closed:boolean}>(command);
 try{
 if(getAuth(getApp()).currentUser?.uid!==uid)throw new Error('登入帳號已變更，請登入原帳號查核操作。');
 if(!['applied','duplicate'].includes(result.status))throw new Error(result.reason||'場次結束尚待確認，請查核原操作。');
 if(result.roomId!==room.id||result.sessionId!==room.sessionId||result.closed!==(type==='closeRoom'))throw new Error('場次結束結果需要核對，請查核原操作。');
 return result;
 }catch(error){
  if(!readPendingGameCommand(localStorage,uid,room.id,room.sessionId)){
   localStorage.setItem(`hf-server-command:${uid}:${room.id}:${room.sessionId}`,JSON.stringify(command));
   window.dispatchEvent(new Event(pendingCommandEvent));
  }
  throw error;
 }
}

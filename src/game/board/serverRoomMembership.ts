import {getApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import type {Room} from '../../types';
import {getRoomCompatibilityError} from './roomCompatibility';
import {readPendingGameCommand,gameCommandContents} from './pendingCommand';
import {runLockedBoardCommand} from './commandLock';
import {submitServerGameCommand} from './serverPromptCommand';
const pending=new Map<string,Promise<unknown>>();
type MembershipChoice={type:'joinRoom'|'leaveRoom'}|{type:'setRoomSlot';slotIndex:number;isOpen:boolean};
export function submitRoomMembership(room:Room,uid:string,choice:MembershipChoice){
 if(getAuth(getApp()).currentUser?.uid!==uid)return Promise.reject(new Error('登入帳號已變更，請重新確認房間。'));
 const error=getRoomCompatibilityError(room);if(error)return Promise.reject(new Error(error));
 if(!room.sessionId)return Promise.reject(new Error('場次資料不完整，請重新確認房間'));
 return runLockedBoardCommand(pending,`${uid}:${room.id}:${room.sessionId}:${gameCommandContents(choice)}`,async()=>{
  const prior=readPendingGameCommand(localStorage,uid,room.id,room.sessionId!),matches=prior?.type===choice.type&&(choice.type!=='setRoomSlot'||(prior.slotIndex===choice.slotIndex&&prior.isOpen===choice.isOpen));
  const result=await submitServerGameCommand<{status:string;reason?:string}>({roomId:room.id,sessionId:room.sessionId,commandId:matches?prior!.commandId:crypto.randomUUID(),...choice});
  if(getAuth(getApp()).currentUser?.uid!==uid)throw new Error('登入帳號已變更，請登入原帳號查核操作。');
  if(!['applied','duplicate'].includes(result.status))throw new Error(result.reason||'房間名單操作尚待確認，請查核原操作。');
  return result;
 });
}

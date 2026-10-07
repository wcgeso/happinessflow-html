import {randomInt,randomUUID} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {key} from './commands';
import {createInitialBoardState} from '../../src/game/board/initialState';
import {createInitialDeckState} from '../../src/constants/board';
export type RoomCreationCommand={type:'createRoom'|'getRoomCreationResult';commandId:string;name?:string;maxPlayers?:number;duration?:number};
export function parseRoomCreationCommand(data:unknown):RoomCreationCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','建立房間資料無效');
 const c=data as RoomCreationCommand,fields=c.type==='getRoomCreationResult'?['type','commandId']:['type','commandId','name','maxPlayers','duration'];
 if(!['createRoom','getRoomCreationResult'].includes(c.type)||Object.keys(c).some(k=>!fields.includes(k))||typeof c.commandId!=='string'||!/^[\w:.-]{1,512}$/.test(c.commandId)||(c.type==='createRoom'&&(typeof c.name!=='string'||c.name.length>160||!Number.isSafeInteger(c.maxPlayers)||c.maxPlayers!<1||c.maxPlayers!>6||!Number.isSafeInteger(c.duration)||c.duration!<1||c.duration!>1440)))throw new HttpsError('invalid-argument','房間名稱、容量或時間無效');
 return c;
}
export async function executeRoomCreationCommand(db:Firestore,c:RoomCreationCommand,uid:string,gameHost=false,now=Date.now()){
 const receipt=db.doc(`roomCreationCommands/${key(`${uid}:${c.commandId}`)}`);
 if(c.type==='getRoomCreationResult'){
  const saved=await receipt.get();if(!saved.exists)return {status:'waiting',message:'尚未找到開房結果，請沿用原操作重試'};
  if(saved.data()!.uid!==uid||!saved.data()!.result?.roomId)throw new HttpsError('failed-precondition','開房結果資料不完整');
  return {status:'confirmed',result:saved.data()!.result};
 }
 // Role/title fields are protected by Rules; check the current profile in the transaction.
 const fingerprint=key(JSON.stringify([c.type,c.name,c.maxPlayers,c.duration])),assignment=db.doc(`hostRoomAssignments/${uid}`),profile=db.doc(`users/${uid}`),roomId=String(randomInt(100000,1000000)),ref=db.doc(`rooms/${roomId}`),sessionId=randomUUID(),deck=createInitialDeckState();
 return db.runTransaction(async tx=>{
  const [saved,hostAssignment,user]=await Promise.all([tx.get(receipt),tx.get(assignment),tx.get(profile)]);
  const host=user.data();
  if(!gameHost&&!(['coach','gm'].includes(host?.role)||['遊戲管理員','管理員'].includes(host?.title)))throw new HttpsError('permission-denied','僅執行師或管理員可以開房');
  if(saved.exists){if(saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一開房操作不能更改設定');return {...saved.data()!.result,status:'duplicate'};}
  if(!user.exists||typeof user.data()!.name!=='string'||!user.data()!.name.trim()||user.data()!.name.length>160)throw new HttpsError('failed-precondition','請先完成帳號名稱設定');
  if(hostAssignment.exists){
   const previousId=hostAssignment.data()!.roomId;
   if(typeof previousId!=='string'||!/^\d{6}$/.test(previousId))throw new HttpsError('failed-precondition','執行師房間紀錄需要核對');
   const previous=await tx.get(db.doc(`rooms/${previousId}`));
   if(previous.exists&&previous.data()!.status!=='finished')throw new HttpsError('failed-precondition','請先結束目前房間，再建立新房');
  }
  const [candidate,archived]=await Promise.all([tx.get(ref),tx.get(db.collection('room_archives').where('roomId','==',roomId).limit(1))]);if(candidate.exists||!archived.empty)throw new HttpsError('aborted','房號已被使用，請沿用原開房操作重試');
  const result={status:'applied',roomId,sessionId};
  tx.create(ref,{id:roomId,name:c.name!.trim(),hostId:uid,status:'waiting',sessionId,createdAt:FieldValue.serverTimestamp(),members:[{uid,name:user.data()!.name.trim(),photoURL:typeof user.data()!.photoURL==='string'?user.data()!.photoURL:'bee',role:'coach',joinedAt:now}],memberUids:[uid],maxPlayers:c.maxPlayers,closedPlayerSlots:Array.from({length:6},(_,i)=>i).filter(i=>i>=c.maxPlayers!),duration:c.duration,gameTimeLeft:c.duration!*60,isTimerPaused:true,isBoardGame:true,isPractice:false,financialAcceleration:{multiplier:1},publicPlayerStates:{},pendingRequests:{},boardState:createInitialBoardState([],uid,undefined,now,deck),syncSchemaVersion:2,flowSchemaVersion:1,financialHistoryStorage:'subcollection',publicPlayerStorage:'subcollection',requiredClientProtocol:1,promptCompletionAuthority:'server-prompts-v1',bankingAuthority:'server-banking-v1',movementAuthority:'server-movement-v1'});
  tx.set(assignment,{uid,roomId,sessionId,commandId:c.commandId});tx.update(profile,{activeGame:{roomId,joinedAt:now}});tx.create(receipt,{uid,commandId:c.commandId,fingerprint,result,createdAt:now});return result;
 });
}

import type {Firestore} from 'firebase-admin/firestore';
import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room} from '../../src/types';
import {getRoomPlayerSlots,buildRoomPlayerSlotUpdate} from '../../src/utils/roomPlayerSlots';
import {key} from './commands';
export type RoomMembershipCommand={type:'joinRoom'|'leaveRoom'|'setRoomSlot';roomId:string;sessionId:string;commandId:string;slotIndex?:number;isOpen?:boolean};
export function parseRoomMembershipCommand(data:unknown):RoomMembershipCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','房間名單操作無效');
 const c=data as RoomMembershipCommand,fields=['type','roomId','sessionId','commandId',...(c.type==='setRoomSlot'?['slotIndex','isOpen']:[])];
 if(!['joinRoom','leaveRoom','setRoomSlot'].includes(c.type)||Object.keys(c).some(k=>!fields.includes(k))||['roomId','sessionId','commandId'].some(k=>typeof c[k as keyof RoomMembershipCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof RoomMembershipCommand])))||(c.type==='setRoomSlot'&&(!Number.isInteger(c.slotIndex)||c.slotIndex!<0||c.slotIndex!>5||typeof c.isOpen!=='boolean')))throw new HttpsError('invalid-argument','房間名單或欄位識別值無效');
 return c;
}
export async function executeRoomMembershipCommand(db:Firestore,c:RoomMembershipCommand,uid:string,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),receipt=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),profile=db.doc(`users/${uid}`),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.slotIndex??null,c.isOpen??null]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(room.sessionId!==c.sessionId||room.bankingAuthority!=='server-banking-v1'||room.movementAuthority!=='server-movement-v1'||room.promptCompletionAuthority!=='server-prompts-v1'||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.requiredClientProtocol!==1||room.publicPlayerStorage!=='subcollection'||room.financialHistoryStorage!=='subcollection'||room.isBoardGame!==true||room.isPractice)throw new HttpsError('failed-precondition','場次已變更或不是可操作的後端房間');
  if(!Array.isArray(room.members)||room.members.some(m=>!m||typeof m.uid!=='string')||new Set(room.members.map(m=>m.uid)).size!==room.members.length)throw new HttpsError('failed-precondition','房間名單需要核對');
  const member=room.members.find(m=>m.uid===uid&&!m.isLeft);
  if(c.type==='setRoomSlot'&&(uid!==room.hostId||!member))throw new HttpsError('permission-denied','只有本場執行師可以調整欄位');
  const [saved,user]=await Promise.all([tx.get(receipt),c.type==='setRoomSlot'?Promise.resolve(null):tx.get(profile)]);
  if(saved.exists){if(saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作不能更改名單設定');return {...saved.data()!.result,status:'duplicate'};}
  if(c.type!=='joinRoom'&&!member)throw new HttpsError('permission-denied','目前不是本場有效成員');
  if(c.type!=='setRoomSlot'&&uid===room.hostId)throw new HttpsError('failed-precondition','執行師請使用關閉房間流程');
  if(c.type==='leaveRoom'&&room.status==='playing')throw new HttpsError('failed-precondition','遊戲中請暫時回大廳，保留席位與已確認流程');
  if((c.type==='setRoomSlot'&&room.status!=='waiting')||(c.type==='joinRoom'&&room.status!=='waiting'&&!(room.status==='playing'&&member))||(c.type==='leaveRoom'&&!['waiting','finished'].includes(room.status)))throw new HttpsError('failed-precondition','此階段不能修改玩家名單');
  if(!Number.isSafeInteger(room.maxPlayers)||room.maxPlayers<1||room.maxPlayers>6||(room.closedPlayerSlots!==undefined&&(!Array.isArray(room.closedPlayerSlots)||room.closedPlayerSlots.some(i=>!Number.isInteger(i)||i<0||i>5)||new Set(room.closedPlayerSlots).size!==room.closedPlayerSlots.length)))throw new HttpsError('failed-precondition','房間容量需要核對');
  const active=room.members.filter(m=>!m.isLeft),occupied=active.filter(m=>m.uid!==room.hostId).length,capacity=getRoomPlayerSlots(room.maxPlayers,room.closedPlayerSlots).filter(s=>s.isOpen).length;
  if(!active.some(m=>m.uid===room.hostId)||capacity!==room.maxPlayers||occupied>capacity)throw new HttpsError('failed-precondition','房間容量或房主資料不一致');
  let changed=false;
  if(c.type==='joinRoom'){
   if(!user?.exists||typeof user.data()!.name!=='string'||!user.data()!.name.trim()||user.data()!.name.length>160)throw new HttpsError('failed-precondition','請先完成帳號名稱設定');
   if(!member){
    if(occupied>=capacity)throw new HttpsError('resource-exhausted','目前沒有開放的玩家欄位');
    const next=[...room.members.filter(m=>m.uid!==uid),{uid,name:user.data()!.name.trim(),photoURL:typeof user.data()!.photoURL==='string'?user.data()!.photoURL:'bee',role:'player',joinedAt:now}];
    tx.update(ref,{members:next,memberUids:next.filter(m=>!('isLeft' in m)||!m.isLeft).map(m=>m.uid)});changed=true;
   }
   tx.update(profile,{activeGame:{roomId:c.roomId,joinedAt:now}});
  }else if(c.type==='leaveRoom'){
   const next=room.members.filter(m=>m.uid!==uid);tx.update(ref,{members:next,memberUids:next.filter(m=>!m.isLeft).map(m=>m.uid)});changed=true;
   if(user?.exists&&user.data()!.activeGame?.roomId===c.roomId)tx.update(profile,{activeGame:FieldValue.delete()});
  }else{
   let patch;try{patch=buildRoomPlayerSlotUpdate(room.maxPlayers,room.closedPlayerSlots,c.slotIndex!,c.isOpen!,occupied);}catch(error){throw new HttpsError('failed-precondition',(error as Error).message);}
   if(patch){tx.update(ref,patch);changed=true;}
  }
  const result={status:'applied',roomId:c.roomId,sessionId:c.sessionId,changed};tx.create(receipt,{type:c.type,uid,sessionId:c.sessionId,fingerprint,result});return result;
 });
}

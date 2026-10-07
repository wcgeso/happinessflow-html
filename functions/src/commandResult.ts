import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {key} from './commands';
export async function getCommandResult(db:Firestore,data:unknown,uid:string){
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','命令查核資料無效');
 const c=data as {type:string;roomId:string;sessionId:string;commandId:string},fields=['type','roomId','sessionId','commandId'];
 if(c.type!=='getCommandResult'||Object.keys(c).some(k=>!fields.includes(k))||fields.some(k=>typeof c[k as keyof typeof c]!=='string'||!(k==='commandId'?/^[\w:.#-]{1,512}$/:/^[\w:.-]{1,512}$/).test(c[k as keyof typeof c])))throw new HttpsError('invalid-argument','命令查核識別值無效');
 const ref=db.doc(`rooms/${c.roomId}`),[snapshot,saved]=await Promise.all([ref.get(),ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)).get()]);
 let room=snapshot.data();
 if(!room){
  const archive=(await db.doc(`room_archives/${c.sessionId}`).get()).data();
  if(archive?.backendArchived!==true||archive.roomId!==c.roomId||archive.sessionId!==c.sessionId||archive.closed!==true)throw new HttpsError('not-found','房間不存在，請核對場次紀錄');
  room=archive.roomSnapshot;
  if(!room||room.sessionId!==c.sessionId||room.hostId!==archive.hostId)throw new HttpsError('failed-precondition','封存場次資料不一致，請保留原操作並核對');
  if(archive.hostId===uid&&archive.closeReceipt?.uid===uid&&archive.closeReceipt.commandId===c.commandId&&archive.closeReceipt.sessionId===c.sessionId&&typeof archive.closeReceipt.result?.status==='string')return {status:'confirmed',result:archive.closeReceipt.result};
 }
 const membershipReceipt=saved.exists&&saved.data()!.uid===uid&&['joinRoom','leaveRoom'].includes(saved.data()!.type);
 const joiningWithoutReceipt=!saved.exists&&room.status==='waiting'&&room.bankingAuthority==='server-banking-v1';
 if(room.hostId!==uid&&!room.members?.some((m:any)=>m.uid===uid&&!m.isLeft)&&!membershipReceipt&&!joiningWithoutReceipt)throw new HttpsError('permission-denied','目前無權查核本場命令');
 if(room.sessionId!==c.sessionId)throw new HttpsError('failed-precondition','場次已更新，不重送舊操作');
 if(!saved.exists)return {status:'waiting',code:'not-confirmed',message:'尚未找到提交結果，保留原操作供安全重試'};
 const record=saved.data()!;
 if(record.uid!==uid||record.sessionId!==c.sessionId||!record.result||typeof record.result.status!=='string')throw new HttpsError('failed-precondition','命令結果資料不完整，請保留原操作並核對');
 return {status:'confirmed',result:record.result};
}

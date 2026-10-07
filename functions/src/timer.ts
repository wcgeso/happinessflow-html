import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {key} from './commands';
export async function executeTimerCommand(db:Firestore,data:unknown,uid:string,now=Date.now()) {
  const c=data as {type:string;roomId:string;sessionId:string;commandId:string;paused:boolean;seconds:number;mode?:'set'|'pause'};
  if(!c || typeof c!=='object' || Array.isArray(c) || Object.keys(c).some(k=>!['type','roomId','sessionId','commandId','paused','seconds','mode'].includes(k)) || c.type!=='setTimer' ||
    ['roomId','sessionId','commandId'].some(k=>typeof c[k as keyof typeof c]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof typeof c]))) || typeof c.paused!=='boolean' || !Number.isSafeInteger(c.seconds) || c.seconds<0 || c.seconds>86400 || (c.mode!==undefined&&!['set','pause'].includes(c.mode)) || (c.mode==='pause'&&!c.paused))
    throw new HttpsError('invalid-argument','計時器資料無效');
  const ref=db.doc(`rooms/${c.roomId}`),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.paused,c.seconds,...(c.mode?[c.mode]:[])]));
  return db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref),room=snapshot.data();
    if(!room)throw new HttpsError('not-found','房間不存在');
    if(room.hostId!==uid||!room.members?.some((m:{uid:string;isLeft?:boolean})=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','只有本場有效執行師可以控制計時器');
    if(room.sessionId!==c.sessionId || room.movementAuthority!=='server-movement-v1' || room.syncSchemaVersion!==2 || room.flowSchemaVersion!==1 || room.status!=='playing')throw new HttpsError('failed-precondition','場次已更新或尚未啟用後端計時器');
    const saved=await tx.get(intent);
    if(saved.exists && saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作不可更改內容');
    if(saved.exists)return {...saved.data()!.result,status:'duplicate'};
    if(c.mode==='pause'&&!room.isTimerPaused&&(!Number.isSafeInteger(room.timerEndsAtMs)||room.timerEndsAtMs<0))throw new HttpsError('failed-precondition','共同截止時間遺失或無效，請由執行師重新設定計時器');
    const remaining=c.mode==='pause'&&room.isTimerPaused?room.gameTimeLeft:c.mode!=='set' && c.paused && !room.isTimerPaused && Number.isFinite(room.timerEndsAtMs)?Math.max(0,Math.ceil((room.timerEndsAtMs-now)/1000)):c.seconds;
    if(!Number.isSafeInteger(remaining)||remaining<0||remaining>86400)throw new HttpsError('failed-precondition','目前計時資料無效，請核對房間狀態');
    const result={status:'applied',seconds:remaining,paused:c.paused,deadline:c.paused?null:now+remaining*1000};
    tx.update(ref,{gameTimeLeft:remaining,isTimerPaused:c.paused,timerEndsAtMs:result.deadline});
    tx.create(intent,{uid,sessionId:c.sessionId,fingerprint,result,completedAt:now});return result;
  });
}

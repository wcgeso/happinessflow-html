import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room,GameState} from '../../src/types';
import {buildPlayerSetup,type PlayerSelection} from '../../src/game/finance/playerSetup';
import {cleanObject} from '../../src/utils/utils';
import {toPublicPlayerState} from '../../src/utils/playerState';
import {writePublicPlayerState} from './financeCommit';
import {key} from './commands';
export type PlayerSetupCommand=PlayerSelection&{type:'setupPlayer';roomId:string;sessionId:string;commandId:string;playerName:string;reportName:string};
export function parsePlayerSetupCommand(data:unknown):PlayerSetupCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','玩家選擇無效');
 const c=data as PlayerSetupCommand;
 if(c.type!=='setupPlayer'||Object.keys(c).some(k=>!['type','roomId','sessionId','commandId','professionId','enterpriseId','dreamId','playerName','reportName'].includes(k))||['roomId','sessionId','commandId','professionId','enterpriseId','dreamId'].some(k=>typeof c[k as keyof PlayerSetupCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(c[k as keyof PlayerSetupCommand]))||[c.playerName,c.reportName].some(v=>typeof v!=='string'||!v.trim()||v.length>160))throw new HttpsError('invalid-argument','玩家選擇或名稱無效');
 return c;
}
export async function executePlayerSetupCommand(db:Firestore,c:PlayerSetupCommand,uid:string){
 const ref=db.doc(`rooms/${c.roomId}`),player=ref.collection('players').doc(uid),receipt=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.professionId,c.enterpriseId,c.dreamId,c.playerName,c.reportName]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(uid===room.hostId||!room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','不是本場玩家');
  if(room.sessionId!==c.sessionId||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.bankingAuthority!=='server-banking-v1'||room.financialHistoryStorage!=='subcollection'||Object.keys(room.playerStates||{}).length)throw new HttpsError('failed-precondition','場次已更新或後端模式尚未啟用');
  const [ps,saved]=await Promise.all([tx.get(player),tx.get(receipt)]);
  if(saved.exists){if(saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作不能更改選擇');return {...saved.data()!.result,status:'duplicate'};}
  if(room.status!=='playing'||!Number.isSafeInteger(room.startedAt)||room.startedAt!<=0||!ps.exists||ps.data()!.boardGameStartedAt!==room.startedAt)throw new HttpsError('failed-precondition','本場玩家資料尚未初始化');
  const before=ps.data() as GameState;
  if(before.isSetup)throw new HttpsError('failed-precondition','已完成選擇，請載入已儲存的設定');
  let state:GameState;try{state=buildPlayerSetup(c,room,c.playerName.trim(),c.reportName.trim());}catch{throw new HttpsError('invalid-argument','選擇內容已不存在，請重新選擇。');}
  const result={status:'applied',professionId:c.professionId,enterpriseId:c.enterpriseId,dreamId:c.dreamId};
  tx.set(player,cleanObject(state));writePublicPlayerState(tx,ref,room,uid,toPublicPlayerState(uid,state));tx.create(receipt,{uid,sessionId:c.sessionId,fingerprint,result});return result;
 });
}

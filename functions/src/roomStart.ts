import type {Firestore} from 'firebase-admin/firestore';
import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room} from '../../src/types';
import {createInitialDeckState} from '../../src/constants/board';
import {createInitialMarketPrices} from '../../src/constants';
import {createInitialBoardState} from '../../src/game/board/initialState';
import {createDefaultGameState} from '../../src/utils/gameState';
import {cleanObject} from '../../src/utils/utils';
import {toPublicPlayerState} from '../../src/utils/playerState';
import {key} from './commands';
export type RoomStartCommand={type:'startRoom';roomId:string;sessionId:string;commandId:string};
export function parseRoomStartCommand(data:unknown):RoomStartCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','開始場次資料無效');
 const c=data as RoomStartCommand;
 if(c.type!=='startRoom'||Object.keys(c).some(k=>!['type','roomId','sessionId','commandId'].includes(k))||['roomId','sessionId','commandId'].some(k=>typeof c[k as keyof RoomStartCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(c[k as keyof RoomStartCommand])))throw new HttpsError('invalid-argument','開始場次識別值無效');
 return c;
}
export async function executeRoomStartCommand(db:Firestore,c:RoomStartCommand,uid:string,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),receipt=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.roomId,c.sessionId]));
 // One deck per request, never reshuffle during an SDK transaction retry.
 const deck=createInitialDeckState();
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);if(!rs.exists)throw new HttpsError('not-found','房間不存在');const room=rs.data() as Room;
  if(uid!==room.hostId||!Array.isArray(room.members)||room.members.some(m=>!m||typeof m!=='object')||!room.members.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','只有本場有效執行師可以開始遊戲');
  if(room.sessionId!==c.sessionId||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.bankingAuthority!=='server-banking-v1'||room.movementAuthority!=='server-movement-v1'||room.promptCompletionAuthority!=='server-prompts-v1'||room.publicPlayerStorage!=='subcollection'||room.financialHistoryStorage!=='subcollection'||room.requiredClientProtocol!==1||room.isBoardGame!==true||room.isPractice)throw new HttpsError('failed-precondition','不是可啟用的後端場次，既有房間不能強制搬遷');
  const saved=await tx.get(receipt);
  if(saved.exists){if(saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作不能更改場次');return {...saved.data()!.result,status:'duplicate'};}
  if(room.status!=='waiting'||room.startedAt!=null||Object.keys(room.playerStates||{}).length)throw new HttpsError('failed-precondition','場次已開始或已結束，不能重設');
  const active=room.members.filter(m=>!m.isLeft),players=active.filter(m=>m.uid!==uid),ids=active.map(m=>m.uid);
  if(!players.length||players.length>6||ids.some(id=>typeof id!=='string'||!/^[\w:.-]{1,512}$/.test(id))||new Set(ids).size!==ids.length||!Number.isSafeInteger(room.maxPlayers)||room.maxPlayers<1||room.maxPlayers>6||players.length>room.maxPlayers||!Number.isSafeInteger(room.duration)||room.duration!<1||room.duration!>1440||!Number.isSafeInteger(now)||now<=0)throw new HttpsError('failed-precondition','玩家名單、容量或遊戲時間無效，尚未開始');
  const prices=createInitialMarketPrices(),board=createInitialBoardState(active,uid,undefined,now,deck),gameTimeLeft=room.duration!*60;
  for(const member of players){
   const state=cleanObject({...createDefaultGameState(),expenses:{},income:{},boardGameStartedAt:now,playerName:member.name||'',marketPrices:prices,previousMarketPrices:prices});
   tx.set(ref.collection('players').doc(member.uid),state);
   tx.set(ref.collection('publicPlayers').doc(member.uid),{...toPublicPlayerState(member.uid,state),sessionId:c.sessionId});
  }
  // Trusted room creation reserves the session ID; start keeps it so a lost response remains queryable.
  const result={status:'applied',sessionId:c.sessionId,startedAt:now};
  tx.update(ref,{status:'playing',startedAt:now,boardState:cleanObject(board),publicPlayerStates:{},playerStates:FieldValue.delete(),pendingRequests:{},gameTimeLeft,isTimerPaused:true,timerEndsAtMs:FieldValue.delete(),marketPrices:prices,previousMarketPrices:prices,marketUpdates:FieldValue.delete(),memberUids:ids});
  tx.create(receipt,{uid,sessionId:c.sessionId,fingerprint,result});return result;
 });
}

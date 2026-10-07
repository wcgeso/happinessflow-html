import type {DocumentReference,Transaction} from 'firebase-admin/firestore';
import type {GameState,Room,PublicPlayerState} from '../../src/types';
import {toPublicPlayerState,hasPublicPlayerStateChanged} from '../../src/utils/playerState';
import {cleanObject} from '../../src/utils/utils';
// All handlers share the existing private-history format; effects and receipts are one commit.
export function commitFinance(tx:Transaction,roomRef:DocumentReference,uid:string,before:GameState,after:GameState,room:Room,commandId:string,result:unknown) {
  const player=roomRef.collection('players').doc(uid),financialId=encodeURIComponent(`${room.sessionId}:${commandId}`),oldIds=new Set((before.history||[]).map(h=>h.id));
  for(const entry of after.history||[])if(!oldIds.has(entry.id))tx.create(player.collection('transactions').doc(encodeURIComponent(`${room.sessionId}:${entry.id}`)),cleanObject({...entry,sessionId:room.sessionId,playerUid:uid}));
  const saved=cleanObject({...after,lastFinancialCommandId:financialId,history:[...(after.history||[])].sort((a,b)=>b.timestamp-a.timestamp).slice(0,100),appliedBoardFinancialEventIds:after.appliedBoardFinancialEventIds?.slice(-200)});
  tx.set(player,saved);
  tx.create(player.collection('commandResults').doc(financialId),{commandId:financialId,originalCommandId:commandId,sessionId:room.sessionId,playerUid:uid,status:'applied',hasResult:true,result:cleanObject(result)});
  const projection=toPublicPlayerState(uid,saved);
  if(hasPublicPlayerStateChanged(toPublicPlayerState(uid,before),projection))writePublicPlayerState(tx,roomRef,room,uid,projection);
}

export function writePublicPlayerState(tx:Transaction,roomRef:DocumentReference,room:Room,uid:string,projection:PublicPlayerState){
  if(room.publicPlayerStorage==='subcollection')tx.set(roomRef.collection('publicPlayers').doc(uid),{...projection,sessionId:room.sessionId});
  else tx.update(roomRef,{[`publicPlayerStates.${uid}`]:projection});
}

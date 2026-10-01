import {toPublicPlayerState,hasPublicPlayerStateChanged} from '../../utils/playerState';
import {doc,type Firestore,type Transaction as FirestoreTransaction} from 'firebase/firestore';
import type {GameState} from '../../types';
import type {BoardRoomSnapshot} from '../board/runBoardMutation';
import {cleanObject} from '../../utils/utils';
import {withAutomaticHappiness} from './automaticHappiness';

export const financialRecordId = (id:string) => encodeURIComponent(id);
export const financialCommandRef = (db:Firestore,roomId:string,uid:string,sessionId:string,commandId:string) =>
  doc(db,'rooms',roomId,'players',uid,'commandResults',financialRecordId(`${sessionId}:${commandId}`));
export const hasFinancialStateChange=(before:GameState,after:GameState)=>
  ['cash','assets','liabilities','expenses','income','happiness','happinessTotal','profession','abilities','medicalInsuranceCount','history','marketPrices','previousMarketPrices','lastMarketUpdateTimestamp','lastPublicEffectTimestamp','lastPublicEffectId']
    .some(field=>JSON.stringify((before as any)[field])!==JSON.stringify((after as any)[field]));
export const writePrivateFinancialState = (transaction:FirestoreTransaction, db:Firestore, roomId:string, uid:string,
  before:GameState, after:GameState, room:BoardRoomSnapshot, commandId:string, result?:unknown,publishProjection=true):GameState => {
  const publish=(state:GameState)=>{
    const next=toPublicPlayerState(uid,state);
    if(publishProjection && hasPublicPlayerStateChanged(toPublicPlayerState(uid,before),next)) transaction.update(doc(db,'rooms',roomId),{[`publicPlayerStates.${uid}`]:next});
  };
  if(!hasFinancialStateChange(before,after)) {publish(after);transaction.set(doc(db,'rooms',roomId,'players',uid),cleanObject(after));return after;}
  const state=withAutomaticHappiness(after,room.financialAcceleration);
  if (room.financialHistoryStorage !== 'subcollection') { publish(state);transaction.set(doc(db,'rooms',roomId,'players',uid),cleanObject(state)); return state; }
  if(!room.sessionId) throw new Error('交易缺少場次識別碼');
  const oldIds=new Set((before.history || []).map(entry=>entry.id));
  for (const entry of state.history || []) if (!oldIds.has(entry.id)) {
    transaction.set(doc(db,'rooms',roomId,'players',uid,'transactions',financialRecordId(`${room.sessionId}:${entry.id}`)),
      cleanObject({...entry,sessionId:room.sessionId,playerUid:uid}));
  }
  const saved={...state,lastFinancialCommandId:financialRecordId(`${room.sessionId}:${commandId}`),history:[...(state.history||[])].sort((a,b)=>b.timestamp-a.timestamp).slice(0,100),
    appliedBoardFinancialEventIds:state.appliedBoardFinancialEventIds?.slice(-200)};
  publish(saved);
  transaction.set(doc(db,'rooms',roomId,'players',uid),cleanObject(saved));
  transaction.set(financialCommandRef(db,roomId,uid,room.sessionId,commandId),cleanObject({commandId:financialRecordId(`${room.sessionId}:${commandId}`),originalCommandId:commandId,
    sessionId:room.sessionId,playerUid:uid,status:'applied',hasResult:result!==undefined,result:result ?? null}));
  return saved;
};

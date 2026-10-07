import {applicationDefault} from 'firebase-admin/app';
import type {Firestore} from 'firebase-admin/firestore';
import {Timestamp} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

// Keeps one instance of the latency-critical functions warm only while games are running.
// Cold starts measured in production take 3-4s; our own module load is ~30ms, so only warm instances help.
export const ACTIVE_ROOM_IDLE_MS=30*60_000;
export const NEW_ROOM_WINDOW_MS=3*60*60_000;

type RoomActivity={status?:string;createdAt?:Timestamp|number;boardState?:{updatedAt?:number}|null};
const millis=(value:RoomActivity['createdAt'])=>value instanceof Timestamp?value.toMillis():Number(value)||0;

/** A room needs warm functions while players are gathering or the board moved recently. */
export function isRoomActive(room:RoomActivity,now:number){
  if(room.status==='playing')return now-Number(room.boardState?.updatedAt||0)<=ACTIVE_ROOM_IDLE_MS;
  if(room.status==='waiting')return now-millis(room.createdAt)<=NEW_ROOM_WINDOW_MS;
  return false;
}

export async function hasActiveRooms(db:Firestore,now=Date.now()){
  // Two single-field queries (automatic indexes): recently created rooms, and rooms marked playing.
  const [recent,playing]=await Promise.all([
    db.collection('rooms').where('createdAt','>=',Timestamp.fromMillis(now-NEW_ROOM_WINDOW_MS)).limit(200).get(),
    db.collection('rooms').where('status','==','playing').limit(200).get(),
  ]);
  return [...recent.docs,...playing.docs].some(doc=>isRoomActive(doc.data() as RoomActivity,now));
}

export type WarmPoolTarget={project:string;region:string;services:string[]};

/** Sets service-level min instances; Cloud Run keeps the current revision (no redeploy). */
export async function setWarmPool(db:Firestore,target:WarmPoolTarget,minInstances:0|1,now=Date.now()){
  const stateRef=db.doc('ops/warmPool'),state=(await stateRef.get()).data();
  if(state?.minInstances===minInstances && now-Number(state.appliedAt||0)<60*60_000)return {changed:false};
  const token=(await applicationDefault().getAccessToken()).access_token;
  const results=await Promise.allSettled(target.services.map(async service=>{
    const url=`https://run.googleapis.com/v2/projects/${target.project}/locations/${target.region}/services/${service}?updateMask=scaling.minInstanceCount`;
    const response=await fetch(url,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({scaling:{minInstanceCount:minInstances}})});
    if(!response.ok)throw new Error(`${service}: HTTP ${response.status} ${(await response.text()).slice(0,300)}`);
  }));
  const failures=results.flatMap(r=>r.status==='rejected'?[String(r.reason?.message||r.reason)]:[]);
  if(failures.length)logger.error('warm_pool_update_failed',{minInstances,failures});
  // Re-applied hourly even when unchanged, because a deploy resets service settings to the declared value.
  await stateRef.set({minInstances,appliedAt:now,failures},{merge:true});
  logger.info('warm_pool_updated',{minInstances,services:target.services,failed:failures.length});
  return {changed:true,failures};
}

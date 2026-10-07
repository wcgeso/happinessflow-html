import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {ACTIVE_ROOM_IDLE_MS,NEW_ROOM_WINDOW_MS,hasActiveRooms,isRoomActive} from '../src/warmPool';
async function main(){
 const now=10*NEW_ROOM_WINDOW_MS;let count=0;const check=(v:unknown)=>{assert.ok(v);count++;};
 check(isRoomActive({status:'playing',boardState:{updatedAt:now-ACTIVE_ROOM_IDLE_MS+1}},now));
 check(!isRoomActive({status:'playing',boardState:{updatedAt:now-ACTIVE_ROOM_IDLE_MS-1}},now));
 check(isRoomActive({status:'waiting',createdAt:Timestamp.fromMillis(now-60_000)},now));
 check(!isRoomActive({status:'waiting',createdAt:Timestamp.fromMillis(now-NEW_ROOM_WINDOW_MS-1)},now));
 check(!isRoomActive({status:'finished',boardState:{updatedAt:now}},now));
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');
 initializeApp({projectId:'demo-happinessflow-backend'});const db=getFirestore();
 await db.recursiveDelete(db.collection('rooms'));
 check(!(await hasActiveRooms(db,now)));
 await db.doc('rooms/stale').set({status:'playing',createdAt:Timestamp.fromMillis(0),boardState:{updatedAt:0}});
 check(!(await hasActiveRooms(db,now)));
 await db.doc('rooms/live').set({status:'playing',createdAt:Timestamp.fromMillis(0),boardState:{updatedAt:now-1000}});
 check(await hasActiveRooms(db,now));
 await db.recursiveDelete(db.collection('rooms'));
 await db.doc('rooms/new').set({status:'waiting',createdAt:Timestamp.fromMillis(now-1000)});
 check(await hasActiveRooms(db,now));
 await db.recursiveDelete(db.collection('rooms'));
 console.log(`PASS ${count} warm pool checks (activity window, idle rooms ignored)`);
}
main().catch(error=>{console.error(error);process.exit(1);});

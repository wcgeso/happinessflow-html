import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {executeRoomCreationCommand,parseRoomCreationCommand} from '../src/roomCreate';
import {executeRoomStartCommand} from '../src/roomStart';
import {key} from '../src/commands';
async function main(){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');initializeApp({projectId:process.env.GCLOUD_PROJECT});const db=getFirestore(),uid='creation-coach',profile=db.doc(`users/${uid}`),assignment=db.doc(`hostRoomAssignments/${uid}`),created:string[]=[];
 await assignment.delete();await profile.set({name:'玩家',role:'player'});
 const c=parseRoomCreationCommand({type:'createRoom',commandId:'create-pilot',name:' 測試房 ',maxPlayers:6,duration:60}),receipt=db.doc(`roomCreationCommands/${key(`${uid}:${c.commandId}`)}`);await receipt.delete();
 await assert.rejects(executeRoomCreationCommand(db,c,uid),{code:'permission-denied'});assert.equal((await assignment.get()).exists,false);assert.equal((await receipt.get()).exists,false);
 await profile.update({role:'coach',name:'執行師'});
 for(const patch of [{role:'coach'},{hostId:uid},{sessionId:'fake'},{roomId:'123456'},{maxPlayers:7},{duration:0},{name:[]},{commandId:'../x'}])assert.throws(()=>parseRoomCreationCommand({...c,...patch}),{code:'invalid-argument'});
 const results=await Promise.all(Array.from({length:6},()=>executeRoomCreationCommand(db,c,uid,false,100)));assert.equal(results.filter(r=>r.status==='applied').length,1);assert.equal(results.filter(r=>r.status==='duplicate').length,5);const result=results[0] as {roomId:string;sessionId:string};created.push(result.roomId);assert.match(result.roomId,/^\d{6}$/);assert.match(result.sessionId,/^[\da-f-]{36}$/);assert.ok(results.every((r:any)=>r.roomId===result.roomId));
 const ref=db.doc(`rooms/${result.roomId}`),room=(await ref.get()).data()!;assert.equal(room.status,'waiting');assert.equal(room.name,'測試房');assert.equal(room.hostId,uid);assert.equal(room.requiredClientProtocol,1);assert.equal(room.bankingAuthority,'server-banking-v1');assert.equal(room.movementAuthority,'server-movement-v1');assert.equal(room.promptCompletionAuthority,'server-prompts-v1');assert.equal(room.publicPlayerStorage,'subcollection');assert.equal(room.financialHistoryStorage,'subcollection');assert.equal(room.boardState.currentTurnUid,null);assert.equal(room.boardState.currentEvent,null);assert.equal(room.boardState.movement,null);assert.deepEqual(room.memberUids,[uid]);assert.equal((await profile.get()).data()!.activeGame.roomId,ref.id);assert.equal((await assignment.get()).data()!.roomId,ref.id);
 const q={type:'getRoomCreationResult' as const,commandId:c.commandId};assert.equal((await executeRoomCreationCommand(db,q,uid)).status,'confirmed');assert.equal((await executeRoomCreationCommand(db,q,'outside')).status,'waiting');await assert.rejects(executeRoomCreationCommand(db,{...c,name:'改名'},uid,true),{code:'already-exists'});
 await assert.rejects(executeRoomCreationCommand(db,{...c,commandId:'second'},uid,true),{code:'failed-precondition'});assert.equal((await assignment.get()).data()!.roomId,ref.id);
 await ref.update({members:[...room.members,{uid:'p',name:'玩家'}],memberUids:[uid,'p']});assert.equal((await executeRoomStartCommand(db,{type:'startRoom',roomId:ref.id,sessionId:result.sessionId,commandId:'start'},uid,200)).status,'applied');assert.equal((await ref.collection('players').doc('p').get()).data()!.isSetup,false);
 assert.equal((await executeRoomCreationCommand(db,c,uid,true)).status,'duplicate');assert.equal((await ref.get()).data()!.status,'playing');
 await ref.update({status:'finished'});const nextId='create-next',nextReceipt=db.doc(`roomCreationCommands/${key(`${uid}:${nextId}`)}`);await nextReceipt.delete();const next=await executeRoomCreationCommand(db,{...c,commandId:nextId},uid,true) as {roomId:string;sessionId:string};created.push(next.roomId);assert.notEqual(next.sessionId,result.sessionId);assert.equal((await assignment.get()).data()!.roomId,next.roomId);assert.equal((await executeRoomCreationCommand(db,c,uid,true)).status,'duplicate');assert.equal((await assignment.get()).data()!.roomId,next.roomId);
 for(const [role,title] of [['gm',''],['player','遊戲管理員'],['player','管理員']]){
  const id=`creation-admin-${role}-${title}`,p=db.doc(`users/${id}`);await p.set({name:'管理員',role,title});
  const r=await executeRoomCreationCommand(db,{...c,commandId:'admin-create'},id) as {roomId:string;status:string};created.push(r.roomId);assert.equal(r.status,'applied');
  await p.update({role:'player',title:''});await assert.rejects(executeRoomCreationCommand(db,{...c,commandId:'revoked'},id),{code:'permission-denied'});
  await p.delete();await db.doc(`hostRoomAssignments/${id}`).delete();await db.doc(`roomCreationCommands/${key(`${id}:admin-create`)}`).delete();
 }
 for(const id of created)await db.recursiveDelete(db.doc(`rooms/${id}`));await receipt.delete();await nextReceipt.delete();await assignment.delete();await profile.delete();await db.terminate();console.log('PASS room creation: protected coach/admin roles, revocation, signed permission, six-way idempotency, canonical flags and create/start recovery');
}
main().catch(e=>{console.error(e);process.exit(1)});

import type {Firestore} from 'firebase-admin/firestore';
import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {key} from './commands';
import {buildSettlementRecord} from './settlementRecord';
import type {Room,GameState} from '../../src/types';
export type RoomLifecycleCommand={type:'finishRoom'|'closeRoom';roomId:string;sessionId:string;commandId:string};
export function parseRoomLifecycleCommand(data:unknown):RoomLifecycleCommand{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','場次結束操作無效');
 const c=data as RoomLifecycleCommand;
 if(!['finishRoom','closeRoom'].includes(c.type)||Object.keys(c).some(k=>!['type','roomId','sessionId','commandId'].includes(k))||['roomId','sessionId','commandId'].some(k=>typeof c[k as keyof RoomLifecycleCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(c[k as keyof RoomLifecycleCommand])))throw new HttpsError('invalid-argument','場次結束識別值無效');
 return c;
}
export async function executeRoomLifecycleCommand(db:Firestore,c:RoomLifecycleCommand,uid:string,now=Date.now()){
 const ref=db.doc(`rooms/${c.roomId}`),archive=db.doc(`room_archives/${c.sessionId}`),receipt=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.roomId,c.sessionId]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref),priorArchive=await tx.get(archive),previous=priorArchive.data();
  if(!rs.exists){
   if(previous?.backendArchived!==true||previous.roomId!==c.roomId||previous.sessionId!==c.sessionId)throw new HttpsError('not-found','房間不存在，請核對場次紀錄');
   if(previous.hostId!==uid)throw new HttpsError('permission-denied','只有本場執行師可以關房');
   const saved=previous.closeReceipt;
   if(c.type==='closeRoom'&&saved?.uid===uid&&saved.commandId===c.commandId&&saved.fingerprint===fingerprint)return {...saved.result,status:'duplicate'};
   const original=await tx.get(receipt);
   if(original.exists&&original.data()!.uid===uid&&original.data()!.sessionId===c.sessionId){if(original.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作不能更改結束方式');return {...original.data()!.result,status:'duplicate'};}
   throw new HttpsError('failed-precondition','房間已封存關閉，請查核原操作');
  }
  const room=rs.data()!;
  if(uid!==room.hostId||!Array.isArray(room.members)||!room.members.some((m:any)=>m?.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','只有本場有效執行師可以結束或關閉房間');
  if(room.sessionId!==c.sessionId||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.bankingAuthority!=='server-banking-v1'||room.movementAuthority!=='server-movement-v1'||room.promptCompletionAuthority!=='server-prompts-v1'||room.publicPlayerStorage!=='subcollection'||room.financialHistoryStorage!=='subcollection'||room.requiredClientProtocol!==1||room.isBoardGame!==true||room.isPractice)throw new HttpsError('failed-precondition','場次已變更或不是可操作的後端房間');
  if(previous&&(previous.roomId!==c.roomId||previous.hostId!==uid||previous.sessionId!==c.sessionId||previous.backendArchived!==true))throw new HttpsError('failed-precondition','封存場次資料不一致，請保留房間並核對');
  const saved=await tx.get(receipt);
  if(saved.exists){if(saved.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作不能更改結束方式');return {...saved.data()!.result,status:'duplicate'};}
  if(!['waiting','playing','finished'].includes(room.status)||(c.type==='finishRoom'&&room.status!=='playing'))throw new HttpsError('failed-precondition','目前階段不能執行場次結束');
  const ids=room.members.map((m:any)=>m?.uid);
  if(ids.length>7||ids.some((id:any)=>typeof id!=='string'||!/^[\w:.-]{1,512}$/.test(id))||new Set(ids).size!==ids.length||!Number.isSafeInteger(now)||now<=0)throw new HttpsError('failed-precondition','房間名單或時間無效，請保留房間並核對');
  // All archive reads precede writes. A read/write/size failure aborts the whole close, retaining the room.
  const [diagnostics,requests,profiles,assignment,movements,prompts]=await Promise.all([tx.get(ref.collection('diagnostics')),tx.get(ref.collection('pendingRequests')),Promise.all(ids.map((id:string)=>tx.get(db.doc(`users/${id}`)))),tx.get(db.doc(`hostRoomAssignments/${uid}`)),tx.get(ref.collection('movementTasks').where('status','in',['pending','scheduled'])),tx.get(ref.collection('promptFinalizationTasks').where('status','in',['pending','scheduled']))]);
  const [playerSnapshots,recoveries]=await Promise.all([Promise.all(ids.filter((id:string)=>id!==uid).map((id:string)=>tx.get(ref.collection('players').doc(id)))),tx.get(ref.collection('boardRecoveries'))]);
  const recoveryTasks=await Promise.all(recoveries.docs.map(async recovery=>({recovery,groups:await Promise.all(['movementTasks','promptFinalizationTasks'].map(name=>tx.get(recovery.ref.collection(name))))})));
  const scoreRef=db.doc(`score_records/S1/records/${c.sessionId}`),scoreSnapshot=c.type==='finishRoom'?await tx.get(scoreRef):null;
  let settlement:ReturnType<typeof buildSettlementRecord>|undefined;
  if(c.type==='finishRoom'){
   if(scoreSnapshot?.exists&&(scoreSnapshot.data()!.trustedSettlement===true||scoreSnapshot.data()!.scoreAppliedAt))throw new HttpsError('failed-precondition','本場已有結算紀錄，請核對原操作，不能重複發放積分');
   if(scoreSnapshot?.exists&&(scoreSnapshot.data()!.roomId!==c.roomId||scoreSnapshot.data()!.sessionId!==c.sessionId||scoreSnapshot.data()!.coachId!==uid))throw new HttpsError('failed-precondition','本場紀錄識別不一致，結算尚未保存');
   settlement=buildSettlementRecord({...room,id:c.roomId} as Room,playerSnapshots.filter(player=>player.exists).map(player=>({uid:player.id,state:player.data() as GameState})),profiles.find(profile=>profile.id===uid)?.data()?.name||'執行師',now);
   for(const player of settlement.details){const profile=profiles.find(profile=>profile.id===player.uid);if(!profile?.exists||['experience','rankScore'].some(field=>profile.data()![field]!==undefined&&(!Number.isSafeInteger(profile.data()![field])||profile.data()![field]<0||!Number.isSafeInteger(profile.data()![field]+player.totalScore))))throw new HttpsError('failed-precondition','玩家帳號積分資料無效，結算尚未保存');}
  }
  const expected=room.members.filter((m:any)=>!m.isLeft).map((m:any)=>m.uid),available:FirebaseFirestore.DocumentData[]=diagnostics.docs.map(d=>({id:d.id,...d.data()}));
  const timerValid=room.isTimerPaused===true?Number.isSafeInteger(room.gameTimeLeft)&&room.gameTimeLeft>=0:Number.isSafeInteger(room.timerEndsAtMs)&&room.timerEndsAtMs>0;
  const remaining=timerValid?(room.isTimerPaused===true?room.gameTimeLeft:Math.max(0,Math.ceil((room.timerEndsAtMs-now)/1000))):null;
  const result={status:'applied',roomId:c.roomId,sessionId:c.sessionId,archivedAt:now,closed:c.type==='closeRoom'};
  const record={uid,type:c.type,sessionId:c.sessionId,commandId:c.commandId,fingerprint,result};
  tx.set(archive,{roomId:c.roomId,sessionId:c.sessionId,hostId:uid,backendArchived:true,archiveSchemaVersion:2,archivedAt:now,closed:c.type==='closeRoom',roomSnapshot:{sessionId:c.sessionId,hostId:uid,members:room.members,status:room.status,bankingAuthority:room.bankingAuthority},statePath:archive.collection('state').doc('room').path,diagnosticsCount:diagnostics.size,pendingRequestCount:requests.size,playerSnapshotCount:playerSnapshots.filter(player=>player.exists).length,missingPlayerSnapshotUids:playerSnapshots.filter(player=>!player.exists).map(player=>player.id),recoveryCount:recoveries.size,cancelledTaskCount:(previous?.cancelledTaskCount||0)+movements.size+prompts.size,missingDiagnosticUids:expected.filter((id:string)=>!available.some(d=>d.uid===id&&d.sessionId===c.sessionId)),projectionDiagnosticsMissing:!available.some(d=>d.screen==='projection'&&d.sessionId===c.sessionId),timerStateValid:timerValid,remainingSeconds:remaining,backendBuildId:process.env.K_REVISION||null,backendRuntime:process.version,...(c.type==='closeRoom'?{closeReceipt:record}:{} )});
  if(settlement){
   tx.set(scoreRef,settlement.score);tx.set(db.doc(`coach_records/${c.sessionId}`),settlement.coach);
   for(const player of settlement.details){tx.set(scoreRef.collection('players').doc(player.uid),player);const profile=profiles.find(profile=>profile.id===player.uid)!;tx.update(profile.ref,{experience:(profile.data()!.experience||0)+player.totalScore,rankScore:(profile.data()!.rankScore||0)+player.totalScore});}
  }
  tx.set(archive.collection('state').doc('room'),room);
  for(const player of playerSnapshots)if(player.exists)tx.set(archive.collection('players').doc(player.id),{uid:player.id,sessionId:c.sessionId,state:player.data(),historySourcePath:player.ref.collection('transactions').path});
  for(const {recovery,groups} of recoveryTasks){const target=archive.collection('boardRecoveries').doc(recovery.id);tx.set(target,recovery.data());for(const group of groups)for(const task of group.docs)tx.set(target.collection(task.ref.parent.id).doc(task.id),task.data());}

  for(const document of diagnostics.docs)tx.set(archive.collection('diagnostics').doc(document.id),document.data());
  for(const document of requests.docs)tx.set(archive.collection('pendingRequests').doc(document.id),document.data());
  for(const group of [movements,prompts])for(const document of group.docs){tx.set(archive.collection(document.ref.parent.id).doc(document.id),document.data());tx.update(document.ref,{status:'cancelled',cancelledAt:now});}
  for(const profile of profiles)if(profile.exists&&profile.data()!.activeGame?.roomId===c.roomId)tx.update(profile.ref,{activeGame:FieldValue.delete()});
  if(assignment.exists&&assignment.data()!.roomId===c.roomId&&assignment.data()!.sessionId===c.sessionId)tx.delete(assignment.ref);
  tx.create(receipt,record);
  if(c.type==='closeRoom')tx.delete(ref);
  else tx.update(ref,{status:'finished',finishedAt:now,isTimerPaused:true,timerEndsAtMs:FieldValue.delete(),...(remaining===null?{}:{gameTimeLeft:remaining})});
  // Child histories and command receipts are deliberately retained, never recursively deleted.
  return result;
 });
}

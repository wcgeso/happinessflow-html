import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {executePlayerSetupCommand,parsePlayerSetupCommand} from '../src/playerSetup';
import {PROFESSIONS,ENTERPRISES,DREAMS} from '../../src/constants';
async function main(){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');
 initializeApp({projectId:process.env.GCLOUD_PROJECT});const db=getFirestore(),room=db.doc('rooms/setup-pilot');await db.recursiveDelete(room);
 const fixture={sessionId:'s',startedAt:100,status:'playing',hostId:'coach',syncSchemaVersion:2,flowSchemaVersion:1,bankingAuthority:'server-banking-v1',financialHistoryStorage:'subcollection',publicPlayerStorage:'subcollection',members:[{uid:'coach'},{uid:'p'},{uid:'left',isLeft:true}]};
 const c={type:'setupPlayer' as const,roomId:room.id,sessionId:'s',commandId:'setup',professionId:PROFESSIONS[0].id,enterpriseId:ENTERPRISES[0].id,dreamId:DREAMS[0].id,playerName:' 玩家 ',reportName:' 報表 '};let checks=0;
 for(const profession of PROFESSIONS){
  await room.set(fixture);await room.collection('players').doc('p').set({isSetup:false,boardGameStartedAt:100});await db.recursiveDelete(room.collection('gameCommands'));
  const command=parsePlayerSetupCommand({...c,professionId:profession.id});
  const results=await Promise.all(Array.from({length:6},()=>executePlayerSetupCommand(db,command,'p')));assert.equal(results.filter(r=>r.status==='applied').length,1);
  const state=(await room.collection('players').doc('p').get()).data()!;
  assert.equal(state.cash,profession.savings);assert.equal(state.currentRankTitle,profession.initialRank);assert.equal(state.profession.salary,profession.salary);assert.deepEqual(state.expenses,{});assert.deepEqual(state.income,{});assert.equal(state.playerName,'玩家');assert.equal(state.reportName,'報表');assert.equal(state.happiness.find((h:any)=>h.id==='h_dream').points,10);assert.equal(state.isSetup,true);assert.deepEqual(Object.keys(state.selectionDraft).sort(),['dreamId','enterpriseId','professionId']);
  const summary=(await room.collection('publicPlayers').doc('p').get()).data()!;assert.equal(summary.isSetup,true);assert.equal(summary.sessionId,'s');assert.equal('cash' in summary,false);
  await room.collection('players').doc('p').update({cash:123});assert.equal((await executePlayerSetupCommand(db,command,'p')).status,'duplicate');assert.equal((await room.collection('players').doc('p').get()).data()!.cash,123);
  await assert.rejects(executePlayerSetupCommand(db,{...command,commandId:'new'},'p'),{code:'failed-precondition'});await assert.rejects(executePlayerSetupCommand(db,{...command,reportName:'changed'},'p'),{code:'already-exists'});checks+=18;
 }
 for(const uid of ['coach','left','outsider']){await assert.rejects(executePlayerSetupCommand(db,c,uid),{code:'permission-denied'});checks++;}
 for(const patch of [{cash:100000},{professionId:'fake'},{playerName:''},{commandId:'../x'}]){
  if('professionId' in patch){await room.collection('players').doc('p').set({isSetup:false,boardGameStartedAt:100});await assert.rejects(executePlayerSetupCommand(db,{...c,...patch,commandId:'fake'},'p'),{code:'invalid-argument'});}
  else assert.throws(()=>parsePlayerSetupCommand({...c,...patch}),{code:'invalid-argument'});checks++;
 }
 await assert.rejects(executePlayerSetupCommand(db,{...c,sessionId:'old'},'p'),{code:'failed-precondition'});checks++;
 await room.collection('players').doc('p').set({isSetup:false,boardGameStartedAt:99});await assert.rejects(executePlayerSetupCommand(db,{...c,commandId:'stale'},'p'),{code:'failed-precondition'});checks++;
 await db.recursiveDelete(room);await db.terminate();console.log(`PASS ${checks} setup checks: official professions, six concurrent requests, private/public atomic state, replay preserves later cash, invalid actor/selection/session`);
}
main().catch(e=>{console.error(e);process.exit(1)});

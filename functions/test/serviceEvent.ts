import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {executeServiceCommand,parseServiceCommand,type ServiceCommand} from '../src/serviceEvent';
import {createDefaultGameState} from '../../src/utils/gameState';
async function main(){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');initializeApp({projectId:process.env.GCLOUD_PROJECT});const db=getFirestore(),ref=db.doc('rooms/service-pilot'),player=ref.collection('players').doc('p');
 let checks=0;const check=(ok:unknown)=>{assert.ok(ok);checks++;};
 let kind:'hospital'|'repair'='hospital';
 const cmd=(type:ServiceCommand['type'],extra:Partial<ServiceCommand>={}):ServiceCommand=>({type,roomId:ref.id,sessionId:'s',eventId:'e',commandId:type,kind,...extra});
 async function reset(free=false,cash=10000){await db.recursiveDelete(ref);await ref.set({id:ref.id,sessionId:'s',hostId:'coach',status:'playing',bankingAuthority:'server-banking-v1',movementAuthority:'server-movement-v1',syncSchemaVersion:2,flowSchemaVersion:1,financialHistoryStorage:'subcollection',members:[{uid:'coach'},{uid:'p'},{uid:'p2'}],boardState:{revision:1,currentTurnUid:'p',currentEvent:{id:'e',playerUid:'p',type:kind,...(kind==='hospital'?{hospitalFeeCoveredByInsurance:free}:{repairHasCar:!free})},pendingEvents:[]}});await player.set({...createDefaultGameState(),isSetup:true,cash,profession:{salary:1000}});}
 assert.throws(()=>parseServiceCommand({...cmd('rollService'),roll:6}),{code:'invalid-argument'});checks++;
 assert.throws(()=>parseServiceCommand({...cmd('payService'),fee:1}),{code:'invalid-argument'});checks++;
 for(kind of ['hospital','repair'] as const){
  for(const roll of [1,6]){
   await reset();check((await executeServiceCommand(db,cmd('payService'),'p')).status==='waiting');check((await executeServiceCommand(db,cmd('finishService'),'p')).status==='waiting');
   const rolls=await Promise.all(Array.from({length:6},(_,i)=>executeServiceCommand(db,cmd('rollService',{commandId:`roll-${i}`}),'p',1000,roll)));check(rolls.filter(r=>r.status==='applied').length===1);check(rolls.every(r=>r.roll===roll&&r.fee===roll*(kind==='hospital'?1000:2000)));
   check((await ref.get()).data()!.boardState.diceEvents.length===1);
   const fee=roll*(kind==='hospital'?1000:2000);if(fee>10000){check((await executeServiceCommand(db,cmd('payService'),'p')).status==='requires_funding');check((await player.get()).data()!.cash===10000);}
   const paid=await Promise.all(Array.from({length:6},(_,i)=>executeServiceCommand(db,cmd('payService',{commandId:`pay-${i}`,forcedDebtAmount:Math.max(0,fee-10000)}),'p')));check(paid.filter(r=>r.status==='applied').length===1);check(paid.filter(r=>r.status==='duplicate').length===5);
   const after=(await player.get()).data()!;check(after.cash===Math.max(0,10000-fee));check((await player.collection('transactions').get()).size===(fee>10000?2:1));check((await ref.get()).data()!.boardState.currentEvent===null);
   await player.update({history:[],appliedBoardFinancialEventIds:Array.from({length:250},(_,i)=>`old-${i}`)});check((await executeServiceCommand(db,cmd('payService',{commandId:'after-reopen'}),'p')).status==='duplicate');check((await player.get()).data()!.cash===after.cash);check((await executeServiceCommand(db,cmd('rollService',{commandId:'old-roll'}),'p',2000,7- roll)).roll===roll);
  }
  await reset(true);check((await executeServiceCommand(db,cmd('finishService'),'p')).status==='applied');check((await player.get()).data()!.cash===10000);check((await executeServiceCommand(db,cmd('finishService',{commandId:'reopen-free'}),'p')).status==='duplicate');
 }
 kind='hospital';await reset();await assert.rejects(executeServiceCommand(db,cmd('rollService'),'outsider'),{code:'permission-denied'});checks++;
 await assert.rejects(executeServiceCommand(db,cmd('rollService'),'p2'),{code:'failed-precondition'});checks++;
 await assert.rejects(executeServiceCommand(db,cmd('rollService',{sessionId:'old'}),'p'),{code:'failed-precondition'});checks++;
 await reset(false,0);await executeServiceCommand(db,cmd('rollService'),'p',1000,4);check((await executeServiceCommand(db,cmd('payService'),'p')).status==='requires_funding');check((await player.collection('transactions').get()).size===0);
 check((await executeServiceCommand(db,cmd('payService',{fundingLoanAmount:50000}),'p')).status==='applied');check((await player.get()).data()!.cash===0);check((await player.get()).data()!.liabilities.some((x:any)=>x.totalOwed===4000));
 // A queued next event must survive a duplicate old payment.
 await reset();await executeServiceCommand(db,cmd('rollService'),'p',1000,2);await ref.update({'boardState.pendingEvents':[{event:{id:'next',playerUid:'p',type:'card'},card:{cardId:'H009',deck:'happiness'}}]});await executeServiceCommand(db,cmd('payService'),'p');check((await ref.get()).data()!.boardState.currentEvent.id==='next');await executeServiceCommand(db,cmd('payService',{commandId:'repeat-old'}),'p');check((await ref.get()).data()!.boardState.currentEvent.id==='next');
 kind='repair';await reset();await executeServiceCommand(db,cmd('rollService'),'p',1000,1);await ref.update({'boardState.movement':{isActive:false,playerUid:'p',path:[2,3],remainingPath:[],startedAt:1,stepDurationMs:200,rollTotal:3,effects:[]}});await executeServiceCommand(db,cmd('payService'),'p');check((await ref.collection('movementTasks').get()).size===1);check((await ref.get()).data()!.boardState.movement.isActive===true);
 console.log(`PASS ${checks} service event invariants (hospital and repair, demo emulator only)`);await db.recursiveDelete(ref);await db.terminate();
}
main().catch(e=>{console.error(e);process.exit(1)});

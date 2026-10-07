import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {executeFamilyCommand,parseFamilyCommand,type FamilyCommand} from '../src/family';
import {executeCommand,AUTHORITY} from '../src/commands';
import {BANKING_AUTHORITY} from '../src/banking';
import {createDefaultGameState} from '../../src/utils/gameState';
import {FAMILY_MILESTONE_STAGES} from '../../src/utils/familyMilestones';
import {PROFESSIONS} from '../../src/constants';
async function main(){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');
 initializeApp({projectId:process.env.GCLOUD_PROJECT});const db=getFirestore(),ref=db.doc('rooms/family-pilot');
 const players=['p1','p2','p3','p4','p5','p6'];
 const base={id:'family-pilot',sessionId:'s',hostId:'coach',status:'playing',syncSchemaVersion:2,flowSchemaVersion:1,financialHistoryStorage:'subcollection',promptCompletionAuthority:AUTHORITY,bankingAuthority:BANKING_AUTHORITY,members:[{uid:'coach'},...players.map(uid=>({uid,name:uid}))],publicPlayerStates:{},boardState:{revision:1,currentTurnUid:'p1',currentEvent:{id:'e',type:'card',playerUid:'p1',timestamp:1},currentCard:{cardId:'H020',deck:'happiness'},pendingEvents:[],familyMilestoneJoinPrompt:{id:'prompt',sourceEventId:'e',sourceCardId:'H020',sourcePlayerUid:'p1',sourceStageProgressId:'date',sourceActionCompleted:false,targetPlayerUids:players.slice(1),requiredRoll:1,responseStorage:'subcollection',responses:{}}}};
 const player=(uid:string)=>ref.collection('players').doc(uid);
 const command=(type:FamilyCommand['type'],uid:string,extra:Partial<FamilyCommand>={}):FamilyCommand=>({type,roomId:'family-pilot',sessionId:'s',eventId:'e',promptId:'prompt',commandId:`${type}:${uid}`,...extra});
 async function reset(){await db.recursiveDelete(ref);await ref.set(base);for(const uid of players)await player(uid).set({...createDefaultGameState(),isSetup:true,cash:10000});}
 let checks=0;const check=(ok:unknown)=>{assert.ok(ok);checks++;};
 assert.throws(()=>parseFamilyCommand({...command('familyRespond','p2',{choice:'roll'}),roll:6}),{code:'invalid-argument'});checks++;
 assert.throws(()=>parseFamilyCommand(command('familyAction','p2',{accepted:true,fundingLoanAmount:-1})),{code:'invalid-argument'});checks++;
 await reset();await player('outsider').set({...createDefaultGameState(),isSetup:true});
 await assert.rejects(executeFamilyCommand(db,command('familyRespond','outsider',{choice:'roll'}),'outsider'),{code:'permission-denied'});checks++;
 await assert.rejects(executeFamilyCommand(db,command('familyRespond','p1',{choice:'roll'}),'p1'),{code:'failed-precondition'});checks++;
 const rolls=await Promise.all(players.slice(1).map(uid=>executeFamilyCommand(db,command('familyRespond',uid,{choice:'roll'}),uid)));
 check(rolls.every(r=>'response' in r&&r.response?.status==='passed'));
 check((await ref.collection('events').doc('prompt').collection('responses').get()).size===5);
 const before=(await player('p2').get()).data()!;check(before.cash===10000&&before.pendingFamilyMilestoneJoinAction.stageProgressId==='date');
 const original=rolls[0];const repeated=await executeFamilyCommand(db,command('familyRespond','p2',{choice:'roll'}),'p2');
 check(repeated.status==='duplicate'&&'response' in original&&'response' in repeated&&repeated.response?.roll===original.response?.roll);
 await assert.rejects(executeFamilyCommand(db,command('familyRespond','p2',{choice:'decline'}),'p2'),{code:'already-exists'});checks++;
 check((await executeFamilyCommand(db,command('familyConfirm','p2'),'p2')).status==='waiting');
 const paid=await Promise.all(Array.from({length:8},()=>executeFamilyCommand(db,command('familyAction','p2',{accepted:true}),'p2')));
 check(paid.filter(r=>r.status==='applied').length===1&&paid.filter(r=>r.status==='duplicate').length===7);
 const state=(await player('p2').get()).data()!;check(state.cash===7000&&!state.pendingFamilyMilestoneJoinAction);check(!state.pendingCardAction);
 check((await player('p2').collection('transactions').get()).size===1);
 check((await executeFamilyCommand(db,command('familyConfirm','p2'),'p2')).status==='duplicate');
 await player('p2').update({history:[],appliedBoardFinancialEventIds:[]});
 check((await executeFamilyCommand(db,command('familyAction','p2',{accepted:true,commandId:'new-payment-id'}),'p2')).status==='duplicate');
 check((await player('p2').get()).data()!.cash===7000);
 await assert.rejects(executeFamilyCommand(db,command('familyAction','p2',{accepted:false,commandId:'new-payment-id'}),'p2'),{code:'already-exists'});checks++;
 for(const uid of ['p1','p3','p4','p5','p6'])await executeFamilyCommand(db,command('familyAction',uid,{accepted:uid!=='p3'}),uid);
 check((await player('p3').get()).data()!.cash===10000);
 const finalized=await executeCommand(db,{type:'finalizePrompt',roomId:'family-pilot',sessionId:'s',eventId:'e',promptId:'prompt',commandId:'finalize'},undefined,Date.now()+60000);
 check(finalized.status==='applied');check((await ref.get()).data()!.boardState.currentEvent===null);
 check((await executeFamilyCommand(db,command('familyAction','p2',{accepted:true}),'p2')).status==='duplicate');
 await reset();await player('p1').update({cash:100});
 const insufficient=await executeFamilyCommand(db,command('familyAction','p1',{accepted:true}),'p1');check(insufficient.status==='requires_funding');
 check((await player('p1').get()).data()!.cash===100&&!(await ref.get()).data()!.boardState.familyMilestoneJoinPrompt.sourceActionCompleted);
 await executeFamilyCommand(db,command('familyAction','p1',{accepted:true,forcedDebtAmount:2900}),'p1');
 const funded=(await player('p1').get()).data()!;check(funded.cash===0&&funded.liabilities[0].totalOwed===2900);
 await assert.rejects(executeFamilyCommand(db,command('familyAction','p1',{accepted:true,sessionId:'old'}),'p1'),{code:'failed-precondition'});checks++;
 // Every family stage: participant payment/rejection, insufficient funds and later completion.
 for(const [index,stage] of FAMILY_MILESTONE_STAGES.entries())for(const accepted of [true,false]){
  await reset();await ref.update({'boardState.familyMilestoneJoinPrompt.sourceStageProgressId':stage.progressId});
  const history=FAMILY_MILESTONE_STAGES.slice(0,index),state={...createDefaultGameState(),isSetup:true,profession:PROFESSIONS[0],income:{},expenses:{otherMedicalChild:0},cash:stage.cashCostAmount?stage.cashCostAmount-1:10000,children:history.filter(s=>s.progressId.startsWith('child')).length,completedHappinessEvents:history.map(s=>s.progressId),happiness:[...history.map(s=>({id:s.happinessId,label:s.label,points:s.happinessPointsValue,checked:true})),{id:'h_family',label:'幸福家庭',points:20,checked:false}],assets:[{id:'house',name:'自住房',type:'不動產',houseType:'1room',isSelfUse:true,cost:1000000,cashflow:0}]};
  await player('p2').set(state);await player('p1').set({...state,cash:1000000,pendingCardAction:'其他流程資訊'});
  await Promise.all(players.slice(1).map(uid=>executeFamilyCommand(db,command('familyRespond',uid,{choice:uid==='p2'?'roll':'decline'}),uid)));
  const before=(await player('p2').get()).data()!;
  if(accepted&&stage.cashCostAmount){
   check((await executeFamilyCommand(db,command('familyAction','p2',{accepted}),'p2')).status==='requires_funding');
   check((await executeFamilyCommand(db,command('familyConfirm','p2'),'p2')).status==='waiting');
   assert.deepEqual((await player('p2').get()).data(),before);checks++;check((await player('p2').collection('transactions').get()).empty);
  }
  const action=command('familyAction','p2',{accepted,...(accepted&&stage.cashCostAmount?{forcedDebtAmount:1}:{})});
  const results=await Promise.all(Array.from({length:6},()=>executeFamilyCommand(db,action,'p2')));check(results.filter(r=>r.status==='applied').length===1);
  const after=(await player('p2').get()).data()!;check(!after.pendingFamilyMilestoneJoinAction&&!after.pendingCardAction);
  check((await ref.collection('events').doc('prompt').collection('responses').doc('p2').get()).data()!.actionCompleted===true);
  if(accepted){
   check(after.cash===(stage.cashCostAmount?0:state.cash));check(after.completedHappinessEvents.includes(stage.progressId));check(after.children===state.children+(stage.progressId.startsWith('child')?1:0));check((after.expenses.otherMedicalChild||0)===(stage.monthlyExpenseIncreaseAmount||0));
   check(after.happiness.find((h:any)=>h.id===stage.happinessId)?.checked===true);if(index>=3)check(after.happiness.find((h:any)=>h.id==='h_family')?.checked===true);
   check((await player('p2').collection('transactions').get()).size===(stage.cashCostAmount?2:1));
  }else{check(after.cash===state.cash&&after.children===state.children);assert.deepEqual(after.completedHappinessEvents,state.completedHappinessEvents);checks++;check((await player('p2').collection('transactions').get()).empty);}
  await executeFamilyCommand(db,command('familyAction','p1',{accepted}),'p1');check((await player('p1').get()).data()!.pendingCardAction==='其他流程資訊');
  check((await executeCommand(db,{type:'finalizePrompt',roomId:ref.id,sessionId:'s',eventId:'e',promptId:'prompt',commandId:'finalize'},undefined,Date.now()+60000)).status==='applied');
  const persisted=(await player('p2').get()).data();check((await executeFamilyCommand(db,action,'p2')).status==='duplicate');assert.deepEqual((await player('p2').get()).data(),persisted);checks++;
 }
 // A failed official >=4 participation roll completes only the response, with no payment.
 await reset();await ref.update({'boardState.familyMilestoneJoinPrompt.requiredRoll':4});
 const originalRandom=crypto.randomInt;let failed:any;
 try{(crypto as any).randomInt=()=>1;failed=await executeFamilyCommand(db,command('familyRespond','p2',{choice:'roll'}),'p2');}finally{crypto.randomInt=originalRandom;}
 check(failed.response.status==='failed'&&failed.response.roll===1&&failed.response.actionCompleted===true);
 const unchanged=(await player('p2').get()).data()!;check(unchanged.cash===10000&&!unchanged.pendingFamilyMilestoneJoinAction&&!unchanged.pendingCardAction);check((await player('p2').collection('transactions').get()).empty);
 check((await executeFamilyCommand(db,command('familyRespond','p2',{choice:'roll'}),'p2') as any).response.roll===1);
 await assert.rejects(executeFamilyCommand(db,command('familyAction','p2',{accepted:true}),'p2'),{code:'failed-precondition'});checks++;
 assert.deepEqual((await player('p2').get()).data(),unchanged);checks++;
 await Promise.all(players.slice(2).map(uid=>executeFamilyCommand(db,command('familyRespond',uid,{choice:'decline'}),uid)));await executeFamilyCommand(db,command('familyAction','p1',{accepted:false}),'p1');
 check((await executeCommand(db,{type:'finalizePrompt',roomId:ref.id,sessionId:'s',eventId:'e',promptId:'prompt',commandId:'finalize'},undefined,Date.now()+60000)).status==='applied');
 console.log(`PASS ${checks} family invariants (six players, demo emulator only)`);await db.recursiveDelete(ref);await db.terminate();
}
main().catch(error=>{console.error(error);process.exit(1)});

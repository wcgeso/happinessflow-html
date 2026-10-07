import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {FAMILY_MILESTONE_STAGES} from '../../src/utils/familyMilestones';
import {HAPPINESS_CARDS} from '../../src/constants/cards';
import {createDefaultGameState} from '../../src/utils/gameState';
import {executeHappinessCommand,parseHappinessCommand,type HappinessCommand} from '../src/happinessCard';
async function main(){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');initializeApp({projectId:process.env.GCLOUD_PROJECT});const db=getFirestore(),ref=db.doc('rooms/happiness-pilot'),player=ref.collection('players').doc('p');let checks=0;const check=(ok:unknown)=>{assert.ok(ok);checks++;};
 const cards=HAPPINESS_CARDS.filter(c=>c.category!=='家庭重要歷程'&&!c.requiresStorySharing);
 async function reset(cardId=cards[0].id,cash=1000000){await db.recursiveDelete(ref);await ref.set({id:ref.id,hostId:'coach',sessionId:'s',isBoardGame:true,status:'playing',bankingAuthority:'server-banking-v1',syncSchemaVersion:2,flowSchemaVersion:1,financialHistoryStorage:'subcollection',members:[{uid:'p'},{uid:'p2'},{uid:'coach'}],boardState:{revision:1,currentTurnUid:'p',currentEvent:{id:'e',type:'card',playerUid:'p'},currentCard:{deck:'happiness',cardId},currentCardReveal:{eventId:'e',cardId,isRevealed:true},pendingEvents:[]}});await player.set({...createDefaultGameState(),isSetup:true,cash,profession:{salary:100000,promotions:[]},income:{},expenses:{basicLiving:0,transportEdu:0,otherMedicalChild:0},children:2,happiness:[{id:'h_date',checked:true,points:0,label:'約會'}]});}
 const command=(cardId=cards[0].id,extra:Partial<HappinessCommand>={}):HappinessCommand=>({type:'happinessCard',roomId:ref.id,sessionId:'s',eventId:'e',cardId,commandId:'accept',choice:'accept',...extra});
 assert.throws(()=>parseHappinessCommand({...command(),points:999}),{code:'invalid-argument'});checks++;
 for(const card of cards){await reset(card.id);check((await executeHappinessCommand(db,command(card.id),'p')).status==='applied');const state=(await player.get()).data()!;check(state.cash===1000000-(card.cashCost||0));check(state.happinessTotal===card.happinessPoints);check(Object.values(state.expenses).reduce((sum:number,n)=>sum+Number(n),0)===(card.monthlyExpenseIncrease||0));check(state.history.length===1);check((await player.collection('transactions').get()).size===1);check((await ref.get()).data()!.boardState.currentEvent===null);
  check((await executeHappinessCommand(db,command(card.id,{commandId:'reopen'}),'p')).status==='duplicate');check((await player.get()).data()!.history.length===1);
  await ref.update({'boardState.currentEvent':{id:'new',type:'card',playerUid:'p'},'boardState.currentCard':{deck:'happiness',cardId:'H009'}});check((await executeHappinessCommand(db,command(card.id,{choice:'dismiss',commandId:'finish'}),'p')).status==='duplicate');check((await ref.get()).data()!.boardState.currentEvent.id==='new');
  await reset(card.id);check((await executeHappinessCommand(db,command(card.id,{choice:'dismiss',commandId:'decline'}),'p')).status==='applied');check((await player.get()).data()!.history.length===0);await assert.rejects(executeHappinessCommand(db,command(card.id),'p'),{code:'already-exists'});checks++;
 }
 const paid=cards.find(c=>(c.cashCost||0)>0)!;await reset(paid.id,0);
 const waiting=await executeHappinessCommand(db,command(paid.id),'p');check(waiting.status==='requires_funding');check((await ref.get()).data()!.boardState.currentEvent.id==='e');check((await player.get()).data()!.history.length===0);
 await assert.rejects(executeHappinessCommand(db,command(paid.id,{fundingLoanAmount:paid.cashCost!+1}),'p'),{code:'invalid-argument'});checks++;
 check((await executeHappinessCommand(db,command(paid.id,{fundingLoanAmount:paid.cashCost!}),'p')).status==='applied');check((await player.get()).data()!.cash===0);check((await player.get()).data()!.liabilities[0].totalOwed===paid.cashCost);
 await reset();await assert.rejects(executeHappinessCommand(db,command(),'p2'),{code:'failed-precondition'});checks++;await assert.rejects(executeHappinessCommand(db,command(),'coach'),{code:'permission-denied'});checks++;await assert.rejects(executeHappinessCommand(db,command(),'outsider'),{code:'permission-denied'});checks++;
 await ref.update({'boardState.currentCardReveal.isRevealed':false});await assert.rejects(executeHappinessCommand(db,command(),'p'),{code:'failed-precondition'});checks++;
 const child=cards.find(c=>c.requiresChildCount)!;await reset(child.id);await player.update({children:0,happiness:[],completedHappinessEvents:[]});await assert.rejects(executeHappinessCommand(db,command(child.id),'p'),{code:'failed-precondition'});checks++;check((await executeHappinessCommand(db,command(child.id,{choice:'dismiss'}),'p')).status==='applied');
 await reset('H027');await player.update({happiness:[],completedHappinessEvents:[]});await assert.rejects(executeHappinessCommand(db,command('H027'),'p'),{code:'failed-precondition'});checks++;
 await reset('H013');await ref.update({'boardState.familyMilestoneJoinPrompt':{id:'active',sourceEventId:'e',sourceCardId:'H013',sourcePlayerUid:'p',targetPlayerUids:['p2'],responseStorage:'subcollection'}});await assert.rejects(executeHappinessCommand(db,command('H013'),'p'),{code:'failed-precondition'});checks++;
 await reset('H009');await assert.rejects(executeHappinessCommand(db,command('H009'),'p'),{code:'failed-precondition'});checks++;
 await reset();const results=await Promise.all(Array.from({length:3},(_,i)=>executeHappinessCommand(db,command(cards[0].id,{commandId:`parallel-${i}`}),'p')));check(results.filter(r=>r.status==='applied').length===1);check((await player.get()).data()!.history.length===1);
 for(const card of HAPPINESS_CARDS.filter(c=>c.category==='家庭重要歷程')){
  await reset(card.id);await ref.update({members:[{uid:'p'},{uid:'coach'}]});await player.update({children:0,happiness:[],completedHappinessEvents:[]});
  check((await executeHappinessCommand(db,command(card.id),'p')).status==='applied');const state=(await player.get()).data()!;
  check(state.cash===997000);check(state.happinessTotal===2);check(state.completedHappinessEvents.includes('date'));check((await ref.get()).data()!.boardState.currentEvent===null);
 }
 for(let i=0;i<FAMILY_MILESTONE_STAGES.length;i++){
  const stage=FAMILY_MILESTONE_STAGES[i];await reset('H020');await ref.update({members:[{uid:'p'}]});await player.update({children:0,happiness:[],completedHappinessEvents:FAMILY_MILESTONE_STAGES.slice(0,i).map(s=>s.progressId)});
  check((await executeHappinessCommand(db,command('H020'),'p')).status==='applied');const state=(await player.get()).data()!;
  check(state.cash===1000000-(stage.cashCostAmount||0));check(state.happiness.find((h:any)=>h.id===stage.happinessId)?.checked);check(state.expenses.otherMedicalChild===(stage.monthlyExpenseIncreaseAmount||0));check(state.children===(stage.progressId.startsWith('child')?1:0));
 }
 await reset('H020');await player.update({completedHappinessEvents:FAMILY_MILESTONE_STAGES.map(s=>s.progressId)});await assert.rejects(executeHappinessCommand(db,command('H020'),'p'),{code:'failed-precondition'});checks++;check((await executeHappinessCommand(db,command('H020',{choice:'dismiss'}),'p')).status==='applied');check((await ref.get()).data()!.boardState.currentEvent===null);
 console.log(`PASS ${checks} happiness-card checks (${cards.length} regular cards, canonical effects and closure); demo only`);await db.recursiveDelete(ref);await db.terminate();
}
main().catch(e=>{console.error(e);process.exit(1)});

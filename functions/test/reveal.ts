import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {executeRevealCommand,parseRevealCommand,type RevealCommand} from '../src/reveal';
import {createDefaultGameState} from '../../src/utils/gameState';
import {HAPPINESS_CARDS,OPPORTUNITY_CARDS,NEWS_CARDS,CARD_REQUIREMENTS} from '../../src/constants/cards';
async function main(){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');initializeApp({projectId:process.env.GCLOUD_PROJECT});const db=getFirestore(),ref=db.doc('rooms/reveal-pilot');let checks=0;const check=(ok:unknown)=>{assert.ok(ok);checks++;};
 const all=[...HAPPINESS_CARDS.map(c=>({id:c.id,deck:'happiness'})),...OPPORTUNITY_CARDS.map(c=>({id:c.id,deck:'opportunity'})),...NEWS_CARDS.map(c=>({id:c.id,deck:'news'}))];
 async function reset(card={id:'H020',deck:'happiness'}){await db.recursiveDelete(ref);await ref.set({id:ref.id,isBoardGame:true,sessionId:'s',hostId:'coach',promptCompletionAuthority:'server-prompts-v1',syncSchemaVersion:2,flowSchemaVersion:1,financialHistoryStorage:'subcollection',status:'playing',members:[{uid:'coach'},{uid:'p'},{uid:'p2'},{uid:'left',isLeft:true}],boardState:{revision:1,currentTurnUid:'p',currentEvent:{id:'e',playerUid:'p',type:'card'},currentCard:{cardId:card.id,deck:card.deck},currentCardReveal:{eventId:'e',cardId:card.id,isRevealed:false},pendingEvents:[]}});for(const uid of ['p','p2'])await ref.collection('players').doc(uid).set({...createDefaultGameState(),isSetup:true,cash:10000,expenses:{basicLiving:0,transportEdu:0,otherMedicalChild:0}});}
 const command=(cardId='H020',extra:Partial<RevealCommand>={}):RevealCommand=>({type:'revealCard',roomId:ref.id,sessionId:'s',eventId:'e',cardId,commandId:'reveal',...extra});
 assert.throws(()=>parseRevealCommand({...command(),targetPlayerUids:['p']}),{code:'invalid-argument'});checks++;
 await reset();const requirements=CARD_REQUIREMENTS.H020;
 try{
  for(const unsupported of ['unhandled_requirement','toString','constructor']){
   CARD_REQUIREMENTS.H020=[unsupported];await assert.rejects(executeRevealCommand(db,command(),'p'),{code:'failed-precondition'});checks++;
   const board=(await ref.get()).data()!.boardState;check(board.revision===1);check(board.currentCardReveal.isRevealed===false);check(!board.familyMilestoneJoinPrompt);check((await ref.collection('cardReveals').get()).empty);check((await ref.collection('gameCommands').get()).empty);
  }
 }finally{CARD_REQUIREMENTS.H020=requirements;}
 for(const card of all){await reset(card);const result=await executeRevealCommand(db,command(card.id),'p');check(result.status==='applied');check((await ref.get()).data()!.boardState.currentCardReveal.isRevealed===true);check((await executeRevealCommand(db,command(card.id,{commandId:'reopen'}),'p')).status==='duplicate');}
 await reset();const concurrent=await Promise.all(Array.from({length:6},(_,i)=>executeRevealCommand(db,command('H020',{commandId:`reveal-${i}`}),'p')));check(concurrent.filter(x=>x.status==='applied').length===1);check(concurrent.every(x=>x.familyPrompt==='opened'));
 let board=(await ref.get()).data()!.boardState;check(board.familyMilestoneJoinPrompt.targetPlayerUids.join(',')==='p2');check(board.revision===2);check((await ref.collection('cardReveals').get()).size===1);
 await ref.update({'boardState.currentEvent':{id:'next',playerUid:'p',type:'card'},'boardState.currentCard':{cardId:'H009',deck:'happiness'}});check((await executeRevealCommand(db,command('H020',{commandId:'old-after-event-change'}),'p')).status==='duplicate');check((await ref.get()).data()!.boardState.currentCard.cardId==='H009');
 await assert.rejects(executeRevealCommand(db,command(),'p2'),{code:'permission-denied'});checks++;
 await reset({id:'N027',deck:'news'});check((await executeRevealCommand(db,command('N027'),'p')).sharedPrompt==='opened');board=(await ref.get()).data()!.boardState;check(board.sharedCardPrompt.targetPlayerUids.join(',')==='p,p2');check(board.sharedCardPrompt.responseStorage==='subcollection');
 await reset();await assert.rejects(executeRevealCommand(db,command(),'outsider'),{code:'permission-denied'});checks++;await assert.rejects(executeRevealCommand(db,command(),'coach'),{code:'permission-denied'});checks++;await assert.rejects(executeRevealCommand(db,command(),'p2'),{code:'failed-precondition'});checks++;
 await assert.rejects(executeRevealCommand(db,command('H009'),'p'),{code:'failed-precondition'});checks++;await assert.rejects(executeRevealCommand(db,command('H020',{sessionId:'old'}),'p'),{code:'failed-precondition'});checks++;
 await ref.collection('players').doc('p2').delete();await assert.rejects(executeRevealCommand(db,command(),'p'),{code:'failed-precondition'});checks++;check(!(await ref.get()).data()!.boardState.currentCardReveal.isRevealed);
 await reset();await ref.collection('players').doc('p2').update({children:2});check((await executeRevealCommand(db,command(),'p')).familyPrompt==='no_target');check(!(await ref.get()).data()!.boardState.familyMilestoneJoinPrompt);
 await reset();await ref.collection('players').doc('p').update({children:2});await ref.collection('players').doc('p2').delete();check((await executeRevealCommand(db,command(),'p')).familyPrompt==='no_target');
 // Ordinary cards do not require unrelated players' private state.
 await reset({id:'C001',deck:'opportunity'});await ref.collection('players').doc('p2').delete();check((await executeRevealCommand(db,command('C001'),'p')).status==='applied');
 // All market effects are committed without any player browser, then finished independently.
 for(const card of NEWS_CARDS.filter(c=>c.type==='stock_price')){
  await reset({id:card.id,deck:'news'});await ref.update({bankingAuthority:'server-banking-v1',marketPrices:{A10:99}});
  for(const uid of ['p','p2'])await ref.collection('players').doc(uid).update({expenses:{basicLiving:0,transportEdu:0,otherMedicalChild:0},assets:[{id:'stock',type:'股票',name:'股票',quantity:5,shares:5,lastPurchasePrice:100,cost:500,cashflow:0}]});
  const payload=command(card.id),result=await executeRevealCommand(db,payload,'p');check(result.status==='applied');
  const expected=card.specialRule?.includes('減半')?2:5;
  for(const uid of ['p','p2']){const state=(await ref.collection('players').doc(uid).get()).data()!;check(state.assets[0].quantity===expected);check(state.history.length===1);check((await ref.collection('players').doc(uid).collection('transactions').get()).size===1);}
  check((await executeRevealCommand(db,command(card.id,{commandId:'second-reveal'}),'p')).status==='duplicate');
  check((await ref.collection('players').doc('p2').get()).data()!.assets[0].quantity===expected);
  const finish=command(card.id,{type:'finishMarket',commandId:'finish'});
  await assert.rejects(executeRevealCommand(db,finish,'p2'),{code:'permission-denied'});checks++;
  check((await executeRevealCommand(db,finish,'p')).status==='applied');check((await ref.get()).data()!.boardState.currentEvent===null);
  await ref.update({'boardState.currentEvent':{id:'next',playerUid:'p',type:'card'},'boardState.currentCard':{deck:'news',cardId:'N027'}});
  check((await executeRevealCommand(db,{...finish,commandId:'old-finish'},'p')).status==='duplicate');check((await ref.get()).data()!.boardState.currentEvent.id==='next');
 }
 const marketCard=NEWS_CARDS.find(c=>c.type==='stock_price')!;
 await reset({id:marketCard.id,deck:'news'});await ref.update({bankingAuthority:'server-banking-v1'});
 await assert.rejects(executeRevealCommand(db,command(marketCard.id,{type:'finishMarket'}),'p'),{code:'failed-precondition'});checks++;
 await ref.collection('players').doc('p2').delete();await assert.rejects(executeRevealCommand(db,command(marketCard.id),'p'),{code:'failed-precondition'});checks++;
 check(!(await ref.get()).data()!.boardState.currentCardReveal.isRevealed);check((await ref.collection('players').doc('p').collection('transactions').get()).empty);
 await reset({id:marketCard.id,deck:'news'});await ref.update({bankingAuthority:'server-banking-v1'});await ref.collection('players').doc('p2').update({assets:[{id:'bad',type:'股票',quantity:-1}]});
 await assert.rejects(executeRevealCommand(db,command(marketCard.id),'p'),{code:'failed-precondition'});checks++;check(!(await ref.get()).data()!.boardState.currentCardReveal.isRevealed);
 console.log(`PASS ${checks} reveal invariants (${all.length} cards, demo emulator only)`);await db.recursiveDelete(ref);await db.terminate();
}
main().catch(e=>{console.error(e);process.exit(1)});

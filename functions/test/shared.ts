import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {executeCommand} from '../src/commands';
import {executeSharedCommand,parseSharedCommand,type SharedCommand} from '../src/shared';
import {createDefaultGameState} from '../../src/utils/gameState';
import {NEWS_CARDS,OPPORTUNITY_CARDS} from '../../src/constants/cards';
import {resolveBoardCardAction,getSharedOpportunityKind} from '../../src/utils/boardCardActions';
import type {GameState,SharedCardPrompt} from '../../src/types';
async function main(){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');initializeApp({projectId:process.env.GCLOUD_PROJECT});const db=getFirestore(),ref=db.doc('rooms/shared-pilot');
 let checks=0;const check=(ok:unknown)=>{assert.ok(ok);checks++;};
 const state={...createDefaultGameState(),isSetup:true,cash:100000000,profession:{salary:1000000},assets:[{id:'stock',type:'股票',name:'股票 A10',quantity:10,cost:10000,downPayment:10000,cashflow:0},{id:'studio',type:'企業',name:'兼職工作室 (C027)',cost:5000,downPayment:5000,cashflow:0,isUpgraded:false}]} as GameState;
 const kinds:Record<string,SharedCardPrompt['kind']>={cash_dividend:'cash_dividend',stock_dividend:'stock_dividend',large_enterprise:'investment',small_business:'startup_loan'};
 const cards=[...NEWS_CARDS.filter(c=>kinds[c.type]).map(c=>({id:c.id,deck:'news',kind:kinds[c.type]})),...OPPORTUNITY_CARDS.filter(c=>getSharedOpportunityKind(c.id)).map(c=>({id:c.id,deck:'opportunity',kind:getSharedOpportunityKind(c.id)!}))];
 async function reset(card=cards[0],targets=['p']) {await db.recursiveDelete(ref);await ref.set({id:ref.id,sessionId:'s',hostId:'coach',status:'playing',promptCompletionAuthority:'server-prompts-v1',bankingAuthority:'server-banking-v1',syncSchemaVersion:2,flowSchemaVersion:1,financialHistoryStorage:'subcollection',members:[{uid:'coach'},...targets.map(uid=>({uid}))],boardState:{revision:1,currentTurnUid:targets[0],currentEvent:{id:'e',playerUid:targets[0],type:'card'},currentCard:{cardId:card.id,deck:card.deck},currentCardReveal:{eventId:'e',cardId:card.id,isRevealed:true},pendingEvents:[],sharedCardPrompt:{id:'prompt',sourceEventId:'e',sourceCardId:card.id,sourcePlayerUid:targets[0],kind:card.kind,targetPlayerUids:targets,responses:{},responseStorage:'subcollection'}}});for(const uid of targets)await ref.collection('players').doc(uid).set(state);}
 const command=(extra:Partial<SharedCommand>={}):SharedCommand=>({type:'sharedAction',roomId:ref.id,sessionId:'s',eventId:'e',promptId:'prompt',commandId:'act',choice:'accept',...extra});
 assert.throws(()=>parseSharedCommand({...command(),cashChange:999999}),{code:'invalid-argument'});checks++;
 assert.throws(()=>parseSharedCommand(command({selectedAssetIds:['stock','stock']})),{code:'invalid-argument'});checks++;
 for(const card of cards){await reset(card);const action=resolveBoardCardAction(card.id,state),c=command(card.kind==='investment'?{amount:1000000}:card.kind==='asset_sale'&&action.kind==='asset_sale'?{choice:action.items.find(x=>x.selectable)?'accept':action.items.length?'decline':'no_effect',selectedAssetIds:action.items.find(x=>x.selectable)?[action.items.find(x=>x.selectable)!.id]:undefined}:{});
  if(c.choice!=='accept')delete c.selectedAssetIds;
  const result=await executeSharedCommand(db,c,'p');check(result.status==='applied');const after=(await ref.collection('players').doc('p').get()).data()!;
  const definition=NEWS_CARDS.find(x=>x.id===card.id);if(definition?.type==='cash_dividend')check(after.cash===state.cash+1000*(definition.dividendPerShare.A10||0));if(definition?.type==='stock_dividend')check(after.assets[0].quantity===10+Math.ceil(10*(definition.dividendRate.A10||0)));if(definition?.type==='large_enterprise')check(after.cash===state.cash-1000000);if(definition?.type==='small_business'){check(after.cash===state.cash+definition.loanAmount-definition.investmentPerMonth);check(after.liabilities.some((l:any)=>l.totalOwed===definition.loanAmount));}
  check((await ref.collection('events').doc('prompt').collection('responses').doc('p').get()).exists);check((await ref.get()).data()!.boardState.revision===1);
  check((await executeSharedCommand(db,{...c,commandId:'reopen'},'p')).status==='duplicate');check((await ref.collection('players').doc('p').get()).data()!.cash===after.cash);
  await ref.collection('players').doc('p').update({history:[],appliedBoardFinancialEventIds:Array.from({length:250},(_,i)=>`other-${i}`)});await ref.update({'boardState.sharedCardPrompt':null,'boardState.currentEvent':null});check((await executeSharedCommand(db,{...c,commandId:'old-command'},'p')).status==='duplicate');
 }
 const dividend=cards.find(c=>c.kind==='cash_dividend')!;await reset(dividend,['p','p2','p3','p4','p5','p6']);
 const concurrent=await Promise.all(['p','p2','p3','p4','p5','p6'].flatMap(uid=>[executeSharedCommand(db,command(),uid),executeSharedCommand(db,command(),uid)]));check(concurrent.filter(x=>x.status==='applied').length===6);check((await ref.collection('events').doc('prompt').collection('responses').get()).size===6);
 await assert.rejects(executeSharedCommand(db,command({choice:'decline',commandId:'different'}),'p'),{code:'already-exists'});checks++;
 await assert.rejects(executeSharedCommand(db,command(),'outsider'),{code:'permission-denied'});checks++;
 const investment=cards.find(c=>c.kind==='investment')!;await reset(investment);await ref.collection('players').doc('p').update({cash:0});check((await executeSharedCommand(db,command({amount:1000000}),'p')).status==='requires_funding');check(!(await ref.collection('events').doc('prompt').collection('responses').doc('p').get()).exists);
 check((await executeSharedCommand(db,command({amount:1000000,fundingLoanAmount:1000000}),'p')).status==='applied');check((await ref.collection('players').doc('p').get()).data()!.cash===0);
 await reset(dividend);await ref.update({'boardState.currentCardReveal.isRevealed':false});await assert.rejects(executeSharedCommand(db,command(),'p'),{code:'failed-precondition'});checks++;await ref.update({'boardState.currentCardReveal.isRevealed':true});await assert.rejects(executeSharedCommand(db,command({amount:1}),'p'),{code:'invalid-argument'});checks++;
 await assert.rejects(executeSharedCommand(db,command({sessionId:'old'}),'p'),{code:'failed-precondition'});checks++;
 await ref.collection('players').doc('p').update({assets:[]});check((await executeSharedCommand(db,command({choice:'no_effect'}),'p')).status==='applied');check((await ref.collection('players').doc('p').get()).data()!.cash===state.cash);
 const expense=cards.find(c=>c.kind==='expense_adjustment')!;await reset(expense);await assert.rejects(executeSharedCommand(db,command({choice:'decline'}),'p'),{code:'failed-precondition'});checks++;
 // All shared cards: legal decline or mandatory refusal, no-effect qualification and closure.
 for(const card of cards){
  await reset(card);const privateRef=ref.collection('players').doc('p'),before=(await privateRef.get()).data();
  if(card.kind==='expense_adjustment'){
   await assert.rejects(executeSharedCommand(db,command({choice:'decline'}),'p'),{code:'failed-precondition'});checks++;
   check(!(await ref.collection('events').doc('prompt').collection('responses').doc('p').get()).exists);
   check((await executeCommand(db,{type:'finalizePrompt',roomId:ref.id,sessionId:'s',eventId:'e',promptId:'prompt',commandId:'finish'},undefined)).status==='waiting');
  }else{
   check((await executeSharedCommand(db,command({choice:'decline'}),'p')).responseStatus==='declined');
   assert.deepEqual((await privateRef.get()).data(),before);checks++;
   check((await privateRef.collection('transactions').get()).empty);check((await executeCommand(db,{type:'finalizePrompt',roomId:ref.id,sessionId:'s',eventId:'e',promptId:'prompt',commandId:'finish'},undefined)).status==='applied');
   check((await executeSharedCommand(db,command({choice:'decline'}),'p')).status==='duplicate');
  }
  await reset(card);await privateRef.update({assets:[]});const noAssets=(await privateRef.get()).data();
  if(['cash_dividend','stock_dividend','asset_sale'].includes(card.kind)){
   check((await executeSharedCommand(db,command({choice:'no_effect'}),'p')).responseStatus==='no_effect');assert.deepEqual((await privateRef.get()).data(),noAssets);checks++;check((await privateRef.collection('transactions').get()).empty);
   check((await executeCommand(db,{type:'finalizePrompt',roomId:ref.id,sessionId:'s',eventId:'e',promptId:'prompt',commandId:'finish'},undefined)).status==='applied');
  }else{
   await assert.rejects(executeSharedCommand(db,command({choice:'no_effect'}),'p'),{code:'failed-precondition'});checks++;assert.deepEqual((await privateRef.get()).data(),noAssets);checks++;check(!(await ref.collection('events').doc('prompt').collection('responses').doc('p').get()).exists);
  }
  if(card.kind==='investment'){
   await reset(card);await privateRef.update({cash:0});const unfunded=(await privateRef.get()).data(),investment=command({amount:1000000});
   check((await executeSharedCommand(db,investment,'p')).status==='requires_funding');assert.deepEqual((await privateRef.get()).data(),unfunded);checks++;
   for(const path of ['sharedActions','gameCommands'])check((await ref.collection(path).get()).empty);check((await privateRef.collection('transactions').get()).empty);check(!(await ref.collection('events').doc('prompt').collection('responses').doc('p').get()).exists);
   check((await executeCommand(db,{type:'finalizePrompt',roomId:ref.id,sessionId:'s',eventId:'e',promptId:'prompt',commandId:'finish'},undefined)).status==='waiting');
   const funded={...investment,fundingLoanAmount:1000000};check((await executeSharedCommand(db,funded,'p')).status==='applied');const fundedState=(await privateRef.get()).data()!;check(fundedState.cash===0&&fundedState.liabilities.reduce((sum:number,l:any)=>sum+l.totalOwed,0)===1000000);
   check((await executeSharedCommand(db,funded,'p')).status==='duplicate');assert.deepEqual((await privateRef.get()).data(),fundedState);checks++;
   check((await executeCommand(db,{type:'finalizePrompt',roomId:ref.id,sessionId:'s',eventId:'e',promptId:'prompt',commandId:'finish'},undefined)).status==='applied');
  }
 }
 console.log(`PASS ${checks} shared invariants (${cards.length} shared cards, six players, demo emulator only)`);await db.recursiveDelete(ref);await db.terminate();
}
main().catch(e=>{console.error(e);process.exit(1)});

import {ENTERPRISES} from '../../src/constants';
import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {BANKING_AUTHORITY,executeBankingCommand,parseBankingCommand,type BankingCommand} from '../src/banking';
import {createDefaultGameState} from '../../src/utils/gameState';
async function main(){
 const projectId='demo-happinessflow-backend';assert.equal(process.env.GCLOUD_PROJECT,projectId);assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');
 initializeApp({projectId});const db=getFirestore(),ref=db.doc('rooms/banking-pilot'),player=ref.collection('players').doc('p1');
 const base={id:'banking-pilot',hostId:'coach',sessionId:'s',status:'playing',bankingAuthority:BANKING_AUTHORITY,financialHistoryStorage:'subcollection',syncSchemaVersion:2,flowSchemaVersion:1,playerStates:{},members:[{uid:'coach'},{uid:'p1'},{uid:'p2'}],publicPlayerStates:{},boardState:{revision:1,currentTurnUid:'p2',currentEvent:{id:'shared-event',type:'card',playerUid:'p2'},sharedCardPrompt:{id:'unrelated',responseStorage:'subcollection',targetPlayerUids:['p2']},pendingEvents:[]}};
 const state={...createDefaultGameState(),isSetup:true,profession:{salary:1000},cash:500,playerName:'P1'};
 const command=(type:BankingCommand['type'],commandId:string,extra:Partial<BankingCommand>={}):BankingCommand=>({type,roomId:'banking-pilot',sessionId:'s',commandId,...extra});
 async function reset(){await db.recursiveDelete(ref);await ref.set(base);await player.set(state);}
 let count=0;const check=(value:unknown)=>{assert.ok(value);count++;};
 assert.throws(()=>parseBankingCommand(command('borrowLoan','invalid',{amount:NaN})),{code:'invalid-argument'});count++;
 assert.throws(()=>parseBankingCommand({...command('borrowLoan','invalid',{amount:10}),uid:'p2'}),{code:'invalid-argument'});count++;
 await reset();
 await ref.collection('players').doc('outsider').set(state);
 await assert.rejects(executeBankingCommand(db,command('borrowLoan','outsider',{amount:10}),'outsider'),{code:'permission-denied'});count++;
 await assert.rejects(executeBankingCommand(db,command('borrowLoan','wrong',{amount:10}),'coach'),{code:'not-found'});count++;
 await player.set(state);await assert.rejects(executeBankingCommand(db,{...command('borrowLoan','old',{amount:10}),sessionId:'old'},'p1'),{code:'failed-precondition'});count++;
 const borrow=command('borrowLoan','borrow',{amount:4000});
 const outcomes=await Promise.all(Array.from({length:8},()=>executeBankingCommand(db,borrow,'p1')));
 check(outcomes.filter(o=>o.status==='applied').length===1);check(outcomes.filter(o=>o.status==='duplicate').length===7);
 let saved=(await player.get()).data()!;check(saved.cash===4500&&saved.liabilities.length===1&&saved.liabilities[0].totalOwed===4000&&saved.liabilities[0].monthlyPayment===400);
 check((await ref.get()).data()!.boardState.revision===1); // Other player's shared prompt is never read or modified.
 await assert.rejects(executeBankingCommand(db,{...borrow,amount:3000},'p1'),{code:'already-exists'});count++;
 await assert.rejects(executeBankingCommand(db,command('borrowLoan','over',{amount:6001}),'p1'),{code:'failed-precondition'});count++;
 check((await executeBankingCommand(db,command('repayLoan','repay',{amount:1000,liabilityId:'borrow'}),'p1')).status==='applied');
 saved=(await player.get()).data()!;check(saved.cash===3500&&saved.liabilities[0].totalOwed===3000&&saved.liabilities[0].monthlyPayment===300);
 await assert.rejects(executeBankingCommand(db,command('repayLoan','too-much',{amount:3001,liabilityId:'borrow'}),'p1'),{code:'failed-precondition'});count++;
 await player.update({cash:0});
 await assert.rejects(executeBankingCommand(db,command('repayLoan','no-cash',{amount:1,liabilityId:'borrow'}),'p1'),{code:'failed-precondition'});count++;
 await player.update({cash:3500});
 // Durable receipts still work after the bounded local ID cache has been removed.
 await player.update({appliedBoardFinancialEventIds:[],history:[]});check((await executeBankingCommand(db,borrow,'p1')).status==='duplicate');check((await player.get()).data()!.cash===3500);
 check((await player.collection('transactions').get()).size===2);
 // Independent commands compete on the same authoritative credit balance.
 await reset();const concurrent=await Promise.allSettled([executeBankingCommand(db,command('borrowLoan','a',{amount:6000}),'p1'),executeBankingCommand(db,command('borrowLoan','b',{amount:6000}),'p1')]);
 check(concurrent.filter(o=>o.status==='fulfilled').length===1);check((await player.get()).data()!.cash===6500);
 await reset();await ref.update({boardState:{revision:1,currentTurnUid:'p1',currentEvent:{id:'bank-event',type:'bank',playerUid:'p1'},pendingEvents:[]}});
 const collect=command('collectPayday','pay1',{eventId:'bank-event'}),finish=command('finishBank','finish',{eventId:'bank-event'});
 await assert.rejects(executeBankingCommand(db,finish,'p1'),{code:'failed-precondition'});count++;
 const collected=await Promise.all([executeBankingCommand(db,collect,'p1'),executeBankingCommand(db,{...collect,commandId:'pay2'},'p1')]);
 check(collected.filter(o=>o.status==='applied').length===1);check((await player.get()).data()!.cash===1450);
 check((await player.get()).data()!.bankSettlement.phase==='collected');
 await player.update({appliedBoardFinancialEventIds:[]});
 check((await player.get()).data()!.bankSettlement.eventId==='bank-event');
 await ref.update({'boardState.pendingContinuation':{phase:'awaiting_roll'}});check((await executeBankingCommand(db,finish,'p1')).status==='waiting');
 check((await executeBankingCommand(db,{...collect,commandId:'pay3'},'p1')).status==='duplicate');check((await player.get()).data()!.cash===1450);
 await ref.update({'boardState.pendingContinuation':{phase:'completed'}});check((await executeBankingCommand(db,finish,'p1')).status==='applied');
 check((await ref.get()).data()!.boardState.currentEvent===null);check((await player.get()).data()!.bankSettlement.phase==='completed');check((await executeBankingCommand(db,finish,'p1')).status==='duplicate');
 check((await executeBankingCommand(db,{...collect,commandId:'pay4'},'p1')).status==='duplicate');
 // Negative cashflow creates forced debt exactly once.
 await reset();await player.update({cash:10,expenses:{basicLiving:2000}});await ref.update({boardState:{revision:1,currentTurnUid:'p1',currentEvent:{id:'bank-event',type:'bank',playerUid:'p1'},pendingEvents:[]}});
 await executeBankingCommand(db,collect,'p1');saved=(await player.get()).data()!;
 check(saved.cash===0&&saved.liabilities[0].type==='強制負債'&&saved.liabilities[0].totalOwed===1040);
 await reset();const enterprise=ENTERPRISES[0];await player.update({cash:enterprise.cost+1000,selectedEnterprise:{...enterprise,cost:1,income:999999999},happiness:[{id:'h_career',checked:false,points:5}]});
 const purchase=command('purchaseEnterprise','enterprise',{enterpriseId:enterprise.id});
 assert.throws(()=>parseBankingCommand({...purchase,cashChange:1000}),{code:'invalid-argument'});count++;
 const purchases=await Promise.all([executeBankingCommand(db,purchase,'p1'),executeBankingCommand(db,purchase,'p1')]);
 check(purchases.filter(o=>o.status==='applied').length===1);check((await player.get()).data()!.cash===1000);
 check((await ref.get()).data()!.boardState.revision===1);check((await player.get()).data()!.assets.length===1);
 await reset();await player.update({assets:[{id:'studio',type:'企業',name:'工作室 (N01)',cashflow:100,cost:100}],pendingStartupUpgradeAction:{assetId:'studio',cardId:'N01',symbol:'N01'}});
 await ref.update({boardState:{revision:1,currentTurnUid:'p1',currentEvent:{id:'bank-event',type:'bank',playerUid:'p1'},pendingEvents:[]}});
 const upgrade=command('upgradeStartup','upgrade',{assetId:'studio',cardId:'N01',eventId:'bank-event'});
 assert.throws(()=>parseBankingCommand({...upgrade,diceRoll:6}),{code:'invalid-argument'});count++;
 await assert.rejects(executeBankingCommand(db,upgrade,'p1'),{code:'failed-precondition'});count++;
 // Closing/skipping an upgrade is a bank-specific acknowledgement, not deletion of the future upgrade.
 await executeBankingCommand(db,collect,'p1');
 check((await executeBankingCommand(db,finish,'p1')).status==='waiting');
 const deferred=command('deferStartup','defer',{assetId:'studio',cardId:'N01',eventId:'bank-event'});
 check((await executeBankingCommand(db,deferred,'p1')).status==='applied');
 check((await executeBankingCommand(db,finish,'p1')).status==='applied');
 check(!!(await player.get()).data()!.pendingStartupUpgradeAction);
 // New bank visit, same unresolved studio; previous bank's acknowledgement cannot bypass this visit.
 await ref.update({boardState:{revision:3,currentTurnUid:'p1',currentEvent:{id:'next-bank',type:'bank',playerUid:'p1'},pendingEvents:[]}});
 const nextCollect={...collect,commandId:'next-collect',eventId:'next-bank'},nextFinish={...finish,commandId:'next-finish',eventId:'next-bank'};
 await executeBankingCommand(db,nextCollect,'p1');check((await executeBankingCommand(db,nextFinish,'p1')).status==='waiting');
 await ref.update({'boardState.currentEvent.id':'bank-event'});
 const attempts=await ref.collection('startupRolls').get();for(const attempt of attempts.docs)await attempt.ref.delete();
 const stage1=command('rollStartup','s1',{assetId:'studio',cardId:'N01',eventId:'bank-event',stage:1});
 await assert.rejects(executeBankingCommand(db,{...stage1,assetId:'forged-alias'},'p1'),{code:'failed-precondition'});count++;
 const eligibility=await executeBankingCommand(db,stage1,'p1');
 check((await executeBankingCommand(db,{...stage1,commandId:'s1-other'},'p1')).roll===eligibility.roll);
 const stage2=command('rollStartup','s2',{assetId:'studio',cardId:'N01',eventId:'bank-event',stage:2});
 if(!eligibility.eligible) {
   await assert.rejects(executeBankingCommand(db,stage2,'p1'),{code:'failed-precondition'});count++;
   const rolls=await ref.collection('startupRolls').get();await rolls.docs[0].ref.update({eligibility:{status:'applied',roll:5,eligible:true}});
 }
 const income=await executeBankingCommand(db,stage2,'p1');check(income.roll!>=1&&income.roll!<=6);
 const upgraded=await Promise.all([executeBankingCommand(db,upgrade,'p1'),executeBankingCommand(db,upgrade,'p1')]);
 check(upgraded.filter(o=>o.status==='applied').length===1);
 saved=(await player.get()).data()!;check(saved.assets[0].cashflow===100+income.roll!*10000&&saved.assets[0].isUpgraded===true);
 check(saved.pendingStartupUpgradeAction===undefined);
 console.log(`PASS ${count} banking invariants (demo emulator only)`);await db.recursiveDelete(ref);await db.terminate();
}
main().catch(e=>{console.error(e);process.exit(1)});

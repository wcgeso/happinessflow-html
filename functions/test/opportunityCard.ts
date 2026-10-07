import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {OPPORTUNITY_CARDS} from '../../src/constants/cards';
import {createDefaultGameState} from '../../src/utils/gameState';
import {resolveBoardCardAction,isStandaloneOpportunityCard,isForcedBoardCard} from '../../src/utils/boardCardActions';
import {getNextBoardSquare} from '../../src/game/board/movementResolution';
import {executeOpportunityCommand,parseOpportunityCommand,type OpportunityCommand} from '../src/opportunityCard';
async function main(){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');initializeApp({projectId:process.env.GCLOUD_PROJECT});const db=getFirestore(),ref=db.doc('rooms/opportunity-pilot'),player=ref.collection('players').doc('p');let checks=0;const check=(ok:unknown)=>{assert.ok(ok);checks++;};
 const cards=OPPORTUNITY_CARDS.filter(c=>isStandaloneOpportunityCard(c.id));
 async function reset(cardId='C044',cash=1000000,insured=false){await db.recursiveDelete(ref);await ref.set({id:ref.id,hostId:'coach',sessionId:'s',isBoardGame:true,status:'playing',bankingAuthority:'server-banking-v1',syncSchemaVersion:2,flowSchemaVersion:1,financialHistoryStorage:'subcollection',members:[{uid:'p'},{uid:'p2'},{uid:'coach'}],boardState:{revision:1,currentTurnUid:'p',playerPositions:{p:12},skipTurns:{p:0},currentEvent:{id:'e',type:'card',playerUid:'p'},currentCard:{deck:'opportunity',cardId},currentCardReveal:{eventId:'e',cardId,isRevealed:true},pendingEvents:[],deckState:{happiness:['H021','H022'],opportunity:[],news:[],usedHappiness:[],usedOpportunity:[],usedNews:[]}}});await player.set({...createDefaultGameState(),isSetup:true,cash,profession:{salary:100000,promotions:[]},income:{},expenses:{basicLiving:0,transportEdu:0,otherMedicalChild:0},assets:[{id:'car',name:'汽車',type:'汽車',cost:600000,isInsured:insured},{id:'house',name:'房屋',type:'不動產',cost:1000000,isInsured:insured}],liabilities:[{id:'loan',name:'汽車貸款',type:'汽車貸款',totalOwed:480000,monthlyPayment:10000}]});}
 const command=(cardId='C044',extra:Partial<OpportunityCommand>={}):OpportunityCommand=>({type:'opportunityCard',roomId:ref.id,sessionId:'s',eventId:'e',cardId,commandId:'accept',choice:'accept',...extra});
 assert.throws(()=>parseOpportunityCommand({...command(),cashChange:999}),{code:'invalid-argument'});checks++;
 for(const card of cards)for(const insured of [false,true]){
  await reset(card.id,1000000,insured);const before=(await player.get()).data()!;const action=resolveBoardCardAction(card.id,before as any),selected=action.kind==='choice'?action.options.find(o=>o.id==='accept')?.action:action,free=action.kind==='choice'&&action.options.every(o=>o.action.kind==='dismiss');const choice=free?'dismiss':'accept';
  check((await executeOpportunityCommand(db,command(card.id,{choice}),'p')).status==='applied');const after=(await player.get()).data()!,board=(await ref.get()).data()!.boardState;
  const delta=card.id==='C038'?(insured?(card.insurancePays||400000):0):(selected?.kind==='financial'?selected.txData.cashChange:0);
  check(after.cash===before.cash+delta);check(after.liabilities[0].totalOwed===480000);
  if(card.id==='C038'){check(after.assets.length===1);check(after.assets[0].id==='house');}
  const extra=selected&&'afterApply' in selected?selected.afterApply:undefined;
  if(extra?.drawCard){check(board.currentCard.cardId==='H021');check(board.deckState.happiness.length===1);check(board.currentCardReveal.isRevealed===false);}
  else check(board.currentEvent===null);
  if(extra?.moveToSquare){const destination=getNextBoardSquare(12,extra.moveToSquare.squareType);check(board.playerPositions.p===destination.index);check(after.boardPosition===destination.index);check(after.skipTurns===extra.moveToSquare.skipTurns);}
  check((await executeOpportunityCommand(db,command(card.id,{choice,commandId:'reopen'}),'p')).status==='duplicate');check((await player.get()).data()!.cash===after.cash);
  await ref.update({'boardState.currentEvent':{id:'new',type:'card',playerUid:'p'}});check((await executeOpportunityCommand(db,command(card.id,{choice:'dismiss',commandId:'old-callback'}),'p')).status==='duplicate');check((await ref.get()).data()!.boardState.currentEvent.id==='new');
  if(isForcedBoardCard(card.id)&&!free){await reset(card.id);await assert.rejects(executeOpportunityCommand(db,command(card.id,{choice:'dismiss'}),'p'),{code:'failed-precondition'});checks++;}
 }
 for(const id of ['C038','C039','C040','C041','C042','C043']){await reset(id);await player.update({assets:[]});check((await executeOpportunityCommand(db,command(id,{choice:'dismiss'}),'p')).status==='applied');check((await player.get()).data()!.cash===1000000);check((await ref.get()).data()!.boardState.playerPositions.p===12);}
 for(const id of ['C041','C042','C043']){await reset(id);const asset=(await player.get()).data()!.assets.find((a:any)=>a.id==='house');await player.update({assets:[asset,{...asset,id:'house2'},{...asset,id:'insured',isInsured:true}]});check((await executeOpportunityCommand(db,command(id),'p')).status==='applied');check((await player.get()).data()!.cash===1000000-OPPORTUNITY_CARDS.find(c=>c.id===id)!.cashLoss!*2);}
 await reset('C038');check((await executeOpportunityCommand(db,command('C038',{assetId:'car'}),'p')).status==='applied');await assert.rejects(executeOpportunityCommand(db,command('C038',{assetId:'other',commandId:'changed-choice'}),'p'),{code:'already-exists'});checks++;
 await reset('C055');await ref.update({'boardState.deckState.happiness':[]});await assert.rejects(executeOpportunityCommand(db,command('C055'),'p'),{code:'failed-precondition'});checks++;check((await player.get()).data()!.expenses.otherMedicalChild===0);check((await ref.get()).data()!.boardState.currentEvent.id==='e');
 await reset('C055');await ref.update({'boardState.pendingContinuation':{phase:'awaiting_roll'}});check((await executeOpportunityCommand(db,command('C055'),'p')).status==='waiting');check((await player.get()).data()!.expenses.otherMedicalChild===0);
 await reset('C055');check((await executeOpportunityCommand(db,command('C055',{choice:'dismiss'}),'p')).status==='applied');check((await player.get()).data()!.expenses.otherMedicalChild===0);await assert.rejects(executeOpportunityCommand(db,command('C055'),'p'),{code:'already-exists'});checks++;
 await reset('C055');check((await executeOpportunityCommand(db,command('C055'),'p')).status==='applied');check((await player.get()).data()!.expenses.otherMedicalChild===2000);
 await reset('C044',0);check((await executeOpportunityCommand(db,command(),'p')).status==='requires_funding');check((await ref.get()).data()!.boardState.currentEvent.id==='e');await assert.rejects(executeOpportunityCommand(db,command('C044',{forcedDebtAmount:8001}),'p'),{code:'invalid-argument'});checks++;check((await executeOpportunityCommand(db,command('C044',{forcedDebtAmount:8000}),'p')).status==='applied');check((await player.get()).data()!.cash===0);check((await player.get()).data()!.liabilities.some((l:any)=>l.totalOwed===8000));
 for(const id of ['C003','C035','C045','C054','C056']){await reset(id);await assert.rejects(executeOpportunityCommand(db,command(id),'p'),{code:'failed-precondition'});checks++;}
 await reset();for(const uid of ['coach','outsider']){await assert.rejects(executeOpportunityCommand(db,command(),uid),{code:'permission-denied'});checks++;}await assert.rejects(executeOpportunityCommand(db,command(),'p2'),{code:'failed-precondition'});checks++;
 await reset('C051');const results=await Promise.all(Array.from({length:3},(_,i)=>executeOpportunityCommand(db,command('C051',{commandId:`parallel-${i}`}),'p')));check(results.filter(r=>r.status==='applied').length===1);check((await ref.get()).data()!.boardState.deckState.happiness.length===1);
 console.log(`PASS ${checks} standalone opportunity checks (${cards.length} cards, canonical effects, atomic draw and movement); demo only`);await db.recursiveDelete(ref);await db.terminate();
}
main().catch(e=>{console.error(e);process.exit(1)});

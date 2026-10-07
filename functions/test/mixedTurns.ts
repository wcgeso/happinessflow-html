import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {writeFileSync} from 'node:fs';
import {createDefaultGameState} from '../../src/utils/gameState';
import {createInitialBoardState} from '../../src/game/board/initialState';
import {PROFESSIONS} from '../../src/constants';
import {NEWS_CARD_MAP,OPPORTUNITY_CARD_MAP,HAPPINESS_CARD_MAP} from '../../src/constants/cards';
import {resolveBoardCardAction,isForcedBoardCard} from '../../src/utils/boardCardActions';
import {getPendingStartupUpgradeActions} from '../../src/game/finance/cardState';
import {movementEndsAt} from '../../src/game/board/movementSettlement';
import {executeMovementCommand} from '../src/movement';
import {executeRevealCommand} from '../src/reveal';
import {executeBankingCommand} from '../src/banking';
import {executeLearningCommand} from '../src/learning';
import {executeServiceCommand} from '../src/serviceEvent';
import {executeHappinessCommand} from '../src/happinessCard';
import {executeOpportunityCommand} from '../src/opportunityCard';
import {executeMedicalCommand} from '../src/medicalCard';
import {executeFamilyCommand} from '../src/family';
import {executeSharedCommand} from '../src/shared';
import {executeCommand} from '../src/commands';
import {executeRealEstateCommand} from '../src/realEstate';
import {executeStoryCommand} from '../src/story';
import {executeFollowupCommand} from '../src/followup';
async function main(){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');
 initializeApp({projectId:process.env.GCLOUD_PROJECT});const db=getFirestore(),ref=db.doc('rooms/mixed-turns-pilot'),uids=['p1','p2','p3','p4','p5','p6'];
 const total=Number(process.env.MIXED_TURNS||500);assert.ok(Number.isSafeInteger(total)&&total>=1&&total<=1000);
 await db.recursiveDelete(ref);await ref.set({id:ref.id,sessionId:'mixed-session',hostId:'coach',isBoardGame:true,status:'playing',isTimerPaused:false,syncSchemaVersion:2,flowSchemaVersion:1,financialHistoryStorage:'subcollection',publicPlayerStorage:'subcollection',promptCompletionAuthority:'server-prompts-v1',bankingAuthority:'server-banking-v1',movementAuthority:'server-movement-v1',members:[{uid:'coach'},...uids.map(uid=>({uid,name:uid}))],boardState:createInitialBoardState(uids.map(uid=>({uid,name:uid,joinedAt:1})), 'coach'),marketPrices:{}});
 for(const uid of uids)await ref.collection('players').doc(uid).set({...createDefaultGameState(),isSetup:true,playerName:uid,cash:100000000,profession:PROFESSIONS[0],currentRankLevel:5,assets:[{id:`car-${uid}`,type:'汽車',name:'汽車',cost:600000,cashflow:0}],income:{},expenses:{}});
 const trace:Array<{uid?:string;command:any;result:any}>=[];const counts:Record<string,number>={},cards=new Set<string>(),players:Record<string,number>={},replays:Array<()=>Promise<any>>=[];let serial=0,clock=Date.now();
 const room=async()=>(await ref.get()).data()!;
 const base=(type:string,extra:any={})=>({type,roomId:ref.id,sessionId:'mixed-session',commandId:`mixed-${++serial}`, ...extra});
 const run=async(fn:(db:any,c:any,uid?:string,now?:number)=>Promise<any>,c:any,uid?:string)=>{
  clock+=10;const result=await fn(db,c,uid,clock);assert.ok(['applied','duplicate'].includes(result.status),JSON.stringify({command:c,result}));counts[c.type]=(counts[c.type]||0)+1;trace.push({uid,command:c,result});
  if(c.type!=='finalizePrompt'&&replays.length<60)replays.push(()=>fn(db,c,uid,clock));return result;
 };
 const settlePrompt=async(prompt:any)=>{clock+=60000;await run(executeCommand,base('finalizePrompt',{eventId:prompt.sourceEventId,promptId:prompt.id}),undefined);};
 try{
  for(let turn=0;turn<total;turn++){
   let current=await room(),board=current.boardState,uid=board.currentTurnUid;assert.ok(uids.includes(uid));players[uid]=(players[uid]||0)+1;
   const roll=base('rollBoard',{revision:board.revision});await run(executeMovementCommand,roll,uid);
   for(let stage=0;stage<80;stage++){
    current=await room();board=current.boardState;
    if(board.movement?.isActive){clock=Math.max(clock,movementEndsAt(board.movement));const c=base('settleMovement',{playerUid:uid,startedAt:board.movement.startedAt});await run(executeMovementCommand,c,undefined);continue;}
    const event=board.currentEvent;
    if(!event){assert.ok(!board.currentCard&&!board.sharedCardPrompt&&!board.familyMilestoneJoinPrompt);await run(executeMovementCommand,base('endTurn',{revision:board.revision}),uid);break;}
    const eventId=event.id;
    if(event.type==='bank'){await run(executeBankingCommand,base('collectPayday',{eventId}),uid);const state=(await ref.collection('players').doc(uid).get()).data() as any;for(const pending of getPendingStartupUpgradeActions(state))await run(executeBankingCommand,base('deferStartup',{eventId,assetId:pending.assetId,cardId:pending.cardId}),uid);await run(executeBankingCommand,base('finishBank',{eventId}),uid);continue;}
    if(event.type==='school'){await run(executeLearningCommand,base('skipSchool',{eventId}),uid);continue;}
    if(event.type==='hospital'||event.type==='repair'){
     const kind=event.type;
     if(kind==='hospital'&&event.hospitalFeeCoveredByInsurance||kind==='repair'&&!event.repairHasCar)await run(executeServiceCommand,base('finishService',{eventId,kind}),uid);
     else{await run(executeServiceCommand,base('rollService',{eventId,kind}),uid);await run(executeServiceCommand,base('payService',{eventId,kind}),uid);}
     continue;
    }
    assert.ok(board.currentCard,JSON.stringify(event));const cardId=board.currentCard.cardId;cards.add(cardId);
    if(!board.currentCardReveal?.isRevealed){await run(executeRevealCommand,base('revealCard',{eventId,cardId}),uid);continue;}
    if(board.familyMilestoneJoinPrompt){const prompt=board.familyMilestoneJoinPrompt;
     await Promise.all(prompt.targetPlayerUids.map((p:string)=>run(executeFamilyCommand,base('familyRespond',{eventId,promptId:prompt.id,choice:'decline'}),p)));
     await run(executeFamilyCommand,base('familyAction',{eventId,promptId:prompt.id,accepted:turn%2===0}),uid);await settlePrompt(prompt);continue;}
    if(board.sharedCardPrompt){const prompt=board.sharedCardPrompt;
     await Promise.all(prompt.targetPlayerUids.map((p:string)=>run(executeSharedCommand,base('sharedAction',{eventId,promptId:prompt.id,choice:prompt.kind==='expense_adjustment'||turn%4===0&&prompt.kind!=='asset_sale'?'accept':'decline',...(prompt.kind==='investment'&&turn%4===0?{amount:1000000}:{})}),p)));await settlePrompt(prompt);continue;}
    if(board.currentCard.deck==='happiness'){
     if(HAPPINESS_CARD_MAP[cardId].requiresStorySharing){
      if(turn%3===0){const submitted=await run(executeStoryCommand,base('submitStory',{eventId,cardId}),uid);await run(executeStoryCommand,base('approveStory',{eventId,requestId:submitted.requestId,attempt:submitted.attempt}),'coach');await run(executeStoryCommand,base('finishStory',{eventId,cardId}),uid);}
      else await run(executeStoryCommand,base('declineStory',{eventId,cardId}),uid);
     }
     else await run(executeHappinessCommand,base('happinessCard',{eventId,cardId,choice:'dismiss'}),uid);continue;
    }
    if(board.currentCard.deck==='news'){
     const card=NEWS_CARD_MAP[cardId];if(card.type==='stock_price')await run(executeRevealCommand,base('finishMarket',{eventId,cardId}),uid);
     else if(card.type==='real_estate')await run(executeRealEstateCommand,base('declineRealEstate',{eventId,cardId}),uid);
     else throw new Error(`新聞卡缺少共享流程 ${cardId}`);continue;
    }
    const card=OPPORTUNITY_CARD_MAP[cardId];
    if(['ability_profession','ability_stock','ability_realestate'].includes(card.type)){
     if(turn%2===0){await run(executeLearningCommand,base('payLearning',{eventId}),uid);await run(executeLearningCommand,base('rollLearning',{eventId}),uid);await run(executeLearningCommand,base('finishLearning',{eventId}),uid);}
     else await run(executeLearningCommand,base('declineLearning',{eventId}),uid);
    }
    else if(cardId==='C054'||cardId==='C056'){
     if(turn%2===0){const submitted=await run(executeFollowupCommand,base('submitFollowup',{eventId,cardId}),uid);await run(executeFollowupCommand,base('approveFollowup',{eventId,cardId,requestId:submitted.requestId,attempt:submitted.attempt}),'coach');await run(executeFollowupCommand,base(cardId==='C056'?'drawFollowup':'applyFollowup',{eventId,cardId}),uid);}
     else await run(executeFollowupCommand,base('declineFollowup',{eventId,cardId}),uid);
    }
    else if(card.type==='medical'){await run(executeMedicalCommand,base('payMedicalCard',{eventId,cardId}),uid);}
    else{
     const state=(await ref.collection('players').doc(uid).get()).data() as any,action=resolveBoardCardAction(cardId,state),free=action.kind==='choice'&&action.options.every(option=>option.action.kind==='dismiss');
     await run(executeOpportunityCommand,base('opportunityCard',{eventId,cardId,choice:isForcedBoardCard(cardId)&&!free?'accept':'dismiss'}),uid);
    }
    if(stage===79)throw new Error(`回合超過階段上限 ${turn}`);
   }
   if(turn%25===0)console.log(`mixed turns ${turn+1}/${total}: ${cards.size} cards, ${serial} commands`);
  }
  assert.equal(counts.endTurn,total);assert.equal(Object.values(players).reduce((sum,value)=>sum+value,0),total);
  const before=await room(),financialBefore=await Promise.all(uids.map(async uid=>(await ref.collection('players').doc(uid).get()).data()));
  for(const replay of replays)assert.equal((await replay()).status,'duplicate');
  assert.deepEqual((await room()).boardState,before.boardState);assert.deepEqual(await Promise.all(uids.map(async uid=>(await ref.collection('players').doc(uid).get()).data())),financialBefore);
  const report={turns:total,commands:serial,counts,players,cards:[...cards].sort(),oldCommandReplays:replays.length,forcedCoachActions:0,scope:'Firestore-only backend commands; natural rolls with mixed accept/decline, manual approval and forced payment; not browser or full-card branch acceptance'};
  writeFileSync('verification-mixed-turns-trace.json',JSON.stringify(trace));
  writeFileSync('verification-mixed-turns-summary.json',JSON.stringify(report,null,2));console.log('PASS mixed turn run',JSON.stringify(report));
  await db.recursiveDelete(ref);
 }catch(error){writeFileSync('verification-mixed-turns-trace.json',JSON.stringify(trace));writeFileSync('verification-mixed-turns-failure.json',JSON.stringify({commands:serial,counts,players,cards:[...cards],room:await room(),playerStates:await Promise.all(uids.map(async uid=>({uid,state:(await ref.collection('players').doc(uid).get()).data(),transactions:(await ref.collection('players').doc(uid).collection('transactions').get()).docs.map(document=>({id:document.id,...document.data()}))}))),error:String(error)},null,2));throw error;}
 finally{await db.terminate();}
}main().catch(error=>{console.error(error);process.exit(1)});

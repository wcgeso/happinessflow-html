import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {MOVEMENT_AUTHORITY,executeMovementCommand,parseMovementCommand,type MovementCommand} from '../src/movement';
import {executeTimerCommand} from '../src/timer';
import {createDefaultGameState} from '../../src/utils/gameState';
import {createInitialDeckState,BOARD_SQUARES} from '../../src/constants/board';
import {movementEndsAt} from '../../src/game/board/movementSettlement';
async function main(){
 const projectId='demo-happinessflow-backend';assert.equal(process.env.GCLOUD_PROJECT,projectId);assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');
 initializeApp({projectId});const db=getFirestore(),ref=db.doc('rooms/movement-pilot'),player=ref.collection('players').doc('p1');
 const base={id:ref.id,sessionId:'s',hostId:'coach',isBoardGame:true,status:'playing',isTimerPaused:false,movementAuthority:MOVEMENT_AUTHORITY,syncSchemaVersion:2,flowSchemaVersion:1,financialHistoryStorage:'subcollection',playerStates:{},members:[{uid:'p1'},{uid:'p2'},{uid:'coach'}],boardState:{revision:0,currentTurnUid:'p1',turnOrder:['p1','p2'],playerPositions:{p1:0,p2:0},skipTurns:{p1:0,p2:0},hasRolledThisTurn:false,deckState:createInitialDeckState(),pendingEvents:[],currentEvent:null,movement:null}};
 const state={...createDefaultGameState(),isSetup:true};
 let count=0;const check=(v:unknown)=>{assert.ok(v);count++;};
 const cmd=(type:MovementCommand['type'],commandId:string,extra:Partial<MovementCommand>={}):MovementCommand=>({type,roomId:ref.id,sessionId:'s',commandId,...extra});
 const reset=async()=>{await db.recursiveDelete(ref);await ref.set(base);await player.set(state);};
 assert.throws(()=>parseMovementCommand({...cmd('rollBoard','r',{revision:0}),dice:[6]}),{code:'invalid-argument'});count++;
 await reset();await assert.rejects(executeMovementCommand(db,cmd('rollBoard','bad',{revision:0}),'outsider'),{code:'permission-denied'});count++;
 await assert.rejects(executeMovementCommand(db,cmd('rollBoard','other',{revision:0}),'p2'),{code:'permission-denied'});count++;
 const roll=cmd('rollBoard','r',{revision:0});const rolls=await Promise.all(Array.from({length:8},()=>executeMovementCommand(db,roll,'p1',1000)));
 check(rolls.filter(r=>r.status==='applied').length===1);check(rolls.filter(r=>r.status==='duplicate').length===7);
 let room=(await ref.get()).data()!,movement=room.boardState.movement;
 check(movement.dice.length===1 && movement.dice[0]>=1 && movement.dice[0]<=6);
 check((await ref.collection('movementTasks').get()).size===1);
 // A second tap sent from the pre-roll view reports the existing roll instead of failing.
 const repeat=await executeMovementCommand(db,cmd('rollBoard','r-repeat',{revision:0}),'p1',1000);
 check(repeat.status==='duplicate' && JSON.stringify(repeat.dice)===JSON.stringify(movement.dice));
 await assert.rejects(executeMovementCommand(db,cmd('rollBoard','r-seen',{revision:room.boardState.revision}),'p1',1000),{code:'failed-precondition'});count++;
 await assert.rejects(executeMovementCommand(db,{...roll,diceCount:2},'p1'),{code:'already-exists'});count++;
 const settle=cmd('settleMovement','settle',{playerUid:'p1',startedAt:movement.startedAt});
 check((await executeMovementCommand(db,settle,'p1',1001)).status==='waiting');
 await assert.rejects(executeMovementCommand(db,settle,'p2',movementEndsAt(movement)),{code:'permission-denied'});count++;
 const settled=await Promise.all([executeMovementCommand(db,settle,undefined,movementEndsAt(movement)),executeMovementCommand(db,{...settle,commandId:'recovery'},'p1',movementEndsAt(movement))]);
 check(settled.filter(r=>r.status==='applied').length===1);check((await ref.collection('movementResults').get()).size===1);
 room=(await ref.get()).data()!;check(room.boardState.playerPositions.p1===movement.path.at(-1));
 check(room.boardState.currentEvent || !room.boardState.movement);
 check((await executeMovementCommand(db,settle,undefined,movementEndsAt(movement)+9999)).status==='duplicate');
 // Explicit late card landing is settled without ANY browser or coach client.
 await reset();const square=BOARD_SQUARES.find(s=>s.type==='happiness')!;
 movement={playerUid:'p1',startPosition:0,path:[square.index],rollTotal:1,dice:[1],startedAt:1000,introDelayMs:600,stepDurationMs:380,landingDelayMs:600,isActive:true};
 await ref.update({'boardState.movement':movement,'boardState.hasRolledThisTurn':true});
 await executeMovementCommand(db,cmd('settleMovement','card',{playerUid:'p1',startedAt:1000}),undefined,5000);
 room=(await ref.get()).data()!;check(room.boardState.currentCard.deck==='happiness');check(room.boardState.cardLog.length===1);
 await assert.rejects(executeMovementCommand(db,cmd('endTurn','early',{revision:room.boardState.revision}),'p1'),{code:'failed-precondition'});count++;
 await ref.update({'boardState.currentEvent':null,'boardState.currentCard':null});
 const end=cmd('endTurn','end',{revision:room.boardState.revision});check((await executeMovementCommand(db,end,'p1')).status==='applied');
 check((await executeMovementCommand(db,end,'p1')).status==='duplicate');check((await ref.get()).data()!.boardState.currentTurnUid==='p2');
 // Delayed job from the previous session can never touch a new game.
 await ref.update({sessionId:'new'});check((await executeMovementCommand(db,settle)).status==='stale');
 // A roll from a view that is a few revisions behind (other players replied meanwhile) still applies.
 await reset();await ref.update({'boardState.revision':5});
 check((await executeMovementCommand(db,cmd('rollBoard','behind',{revision:3}),'p1',1000)).status==='applied');
 await reset();await ref.update({publicPlayerStorage:'subcollection'});await executeMovementCommand(db,roll,'p1',1000);room=(await ref.get()).data()!;movement=room.boardState.movement;await executeMovementCommand(db,cmd('settleMovement','public-settle',{playerUid:'p1',startedAt:movement.startedAt}),undefined,movementEndsAt(movement));const publicState=(await ref.collection('publicPlayers').doc('p1').get()).data()!;check(publicState.uid==='p1'&&publicState.sessionId==='s');check(publicState.boardPosition===(await player.get()).data()!.boardPosition);check(!(await ref.get()).data()!.publicPlayerStates);
 await reset();
 const timer={type:'setTimer',roomId:ref.id,sessionId:'s',commandId:'timer',seconds:60,paused:false};
 await assert.rejects(executeTimerCommand(db,timer,'p1',1000),{code:'permission-denied'});count++;
 const started=await executeTimerCommand(db,timer,'coach',1000);check(started.deadline===61000);
 check((await executeTimerCommand(db,timer,'coach',9999)).deadline===61000);
 const paused=await executeTimerCommand(db,{...timer,commandId:'pause',paused:true,seconds:999},'coach',11000);check(paused.seconds===50&&paused.deadline===null);
 const resumed=await executeTimerCommand(db,{...timer,commandId:'resume',seconds:50},'coach',21000);check(resumed.deadline===71000);
 const resetTimer=await executeTimerCommand(db,{...timer,commandId:'reset-running',mode:'set',paused:true,seconds:3600},'coach',22000);check(resetTimer.seconds===3600&&resetTimer.deadline===null);
 const pauseAgain=await executeTimerCommand(db,{...timer,commandId:'already-paused',mode:'pause',paused:true,seconds:999},'coach',23000);check(pauseAgain.seconds===3600);
 const restart=await executeTimerCommand(db,{...timer,commandId:'restart',mode:'set',seconds:60},'coach',30000);check(restart.deadline===90000);check((await executeTimerCommand(db,timer,'coach',31000)).deadline===61000);check((await ref.get()).data()!.timerEndsAtMs===90000);
 for(const deadline of [null,'90000',-1]){await ref.update({isTimerPaused:false,timerEndsAtMs:deadline});await assert.rejects(executeTimerCommand(db,{...timer,commandId:'invalid-deadline',mode:'pause',paused:true,seconds:999},'coach',31000),{code:'failed-precondition'});count++;check((await ref.get()).data()!.isTimerPaused===false);}
 const repaired=await executeTimerCommand(db,{...timer,commandId:'repair-timer',mode:'set',seconds:60},'coach',32000);check(repaired.deadline===92000);check((await ref.get()).data()!.timerEndsAtMs===92000);
 await assert.rejects(executeTimerCommand(db,{...timer,commandId:'invalid-mode',mode:'pause'},'coach'),{code:'invalid-argument'});count++;
 await ref.update({members:[{uid:'p1'},{uid:'coach',isLeft:true}]});await assert.rejects(executeTimerCommand(db,{...timer,commandId:'left-coach'},'coach',22000),{code:'permission-denied'});count++;
 console.log(`PASS ${count} movement invariants (no browser required)`);await db.recursiveDelete(ref);await db.terminate();
}
main().catch(e=>{console.error(e);process.exit(1)});

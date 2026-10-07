import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {executeRoomStartCommand,parseRoomStartCommand} from '../src/roomStart';
import {executePlayerSetupCommand} from '../src/playerSetup';
import {getCommandResult} from '../src/commandResult';
import {HAPPINESS_CARDS,NEWS_CARDS,OPPORTUNITY_CARDS} from '../../src/constants/cards';
async function main(){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');initializeApp({projectId:process.env.GCLOUD_PROJECT});const db=getFirestore(),ref=db.doc('rooms/start-pilot');await db.recursiveDelete(ref);
 const base={id:ref.id,sessionId:'reserved-s',status:'waiting',hostId:'coach',duration:60,maxPlayers:6,isBoardGame:true,syncSchemaVersion:2,flowSchemaVersion:1,bankingAuthority:'server-banking-v1',movementAuthority:'server-movement-v1',promptCompletionAuthority:'server-prompts-v1',publicPlayerStorage:'subcollection',financialHistoryStorage:'subcollection',requiredClientProtocol:1,members:[{uid:'coach',name:'執行師'},...Array.from({length:6},(_,i)=>({uid:`p${i}`,name:`玩家${i}`,role:i===0?'coach':'player'})),{uid:'left',isLeft:true}],boardState:{currentTurnUid:null},publicPlayerStates:{}};
 const c=parseRoomStartCommand({type:'startRoom',roomId:ref.id,sessionId:base.sessionId,commandId:'start'});await ref.set(base);
 for(const uid of ['p0','outside','left'])await assert.rejects(executeRoomStartCommand(db,c,uid,100),{code:'permission-denied'});
 for(const patch of [{duration:0},{duration:1.5},{maxPlayers:5},{members:[{uid:'coach'}]},{members:[{uid:'coach'},{uid:'p'},{uid:'p'}]},{requiredClientProtocol:2},{bankingAuthority:null},{isPractice:true},{startedAt:1}]){
  await ref.set({...base,...patch});await assert.rejects(executeRoomStartCommand(db,c,'coach',100),{code:'failed-precondition'});assert.equal((await ref.get()).data()!.status,'waiting');assert.equal((await ref.collection('players').get()).size,0);
 }
 await ref.set(base);const results=await Promise.all(Array.from({length:6},(_,i)=>executeRoomStartCommand(db,c,'coach',100+i)));assert.equal(results.filter(r=>r.status==='applied').length,1);
 const room=(await ref.get()).data()!,started=room.startedAt;assert.equal(room.sessionId,base.sessionId);assert.equal(room.status,'playing');assert.equal(room.isTimerPaused,true);assert.equal(room.gameTimeLeft,3600);assert.equal(room.timerEndsAtMs,undefined);assert.equal(room.boardState.revision,0);assert.equal(room.boardState.currentTurnUid,'p0');assert.deepEqual(room.boardState.turnOrder,Array.from({length:6},(_,i)=>`p${i}`));assert.equal(room.boardState.movement,null);
 for(const [name,cards] of [['happiness',HAPPINESS_CARDS],['news',NEWS_CARDS],['opportunity',OPPORTUNITY_CARDS]] as const)assert.deepEqual([...room.boardState.deckState[name]].sort(),cards.map(c=>c.id).sort());
 assert.equal((await ref.collection('players').get()).size,6);assert.equal((await ref.collection('publicPlayers').get()).size,6);assert.equal((await ref.collection('players').doc('coach').get()).exists,false);assert.equal((await ref.collection('players').doc('left').get()).exists,false);
 for(let i=0;i<6;i++){const player=(await ref.collection('players').doc(`p${i}`).get()).data()!;assert.equal(player.boardGameStartedAt,started);assert.equal(player.isSetup,false);assert.equal(player.cash,0);assert.equal((await ref.collection('publicPlayers').doc(`p${i}`).get()).data()!.sessionId,base.sessionId);assert.equal((await executePlayerSetupCommand(db,{type:'setupPlayer',roomId:ref.id,sessionId:base.sessionId,commandId:'setup',professionId:'nest_builder',enterpriseId:'C01',dreamId:'D01',playerName:`玩家${i}`,reportName:'我的財報'},`p${i}`)).status,'applied');}
 await ref.collection('players').doc('p0').update({cash:123});await ref.update({'boardState.revision':7});const before=(await ref.get()).data();assert.equal((await executeRoomStartCommand(db,c,'coach',999)).status,'duplicate');assert.deepEqual((await ref.get()).data(),before);assert.equal((await ref.collection('players').doc('p0').get()).data()!.cash,123);
 assert.equal((await getCommandResult(db,{...c,type:'getCommandResult'},'coach')).status,'confirmed');await assert.rejects(executeRoomStartCommand(db,{...c,commandId:'new'},'coach'),{code:'failed-precondition'});await assert.rejects(executeRoomStartCommand(db,{...c,sessionId:'old'},'coach'),{code:'failed-precondition'});
 for(const patch of [{startedAt:1},{players:[]},{clientProtocolVersion:1},{sessionId:'../x'}])assert.throws(()=>parseRoomStartCommand({...c,...patch}),{code:'invalid-argument'});
 await db.recursiveDelete(ref);await db.terminate();console.log('PASS room start: six-way start, six canonical setups, complete decks, atomic projections, lost-response lookup, stale/illegal/invalid rejection and replay preserving live state');
}
main().catch(e=>{console.error(e);process.exit(1)});

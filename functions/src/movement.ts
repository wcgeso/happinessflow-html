import {writePublicPlayerState} from './financeCommit';
import {randomInt} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room,GameState} from '../../src/types';
import {BOARD_SQUARES} from '../../src/constants/board';
import {splitMovementLeg} from '../../src/game/board/eventQueue';
import {hasIncompleteSharedPrompts} from '../../src/game/board/promptCompletion';
import {buildMovementEffects,describeMovementEffects} from '../../src/game/board/movementEffects';
import {appendDicePresentation,DICE_PRESENTATION_DURATION_MS} from '../../src/game/board/dicePresentation';
import {buildBoardMovementLegResolution,hasCarAsset,resolveBoardDiceCount} from '../../src/game/board/movementResolution';
import {movementEndsAt} from '../../src/game/board/movementSettlement';
import {buildNextBoardTurnState} from '../../src/utils/experienceState';
import {toPublicPlayerState} from '../../src/utils/playerState';
import {cleanObject} from '../../src/utils/utils';
import {key} from './commands';
export const MOVEMENT_AUTHORITY='server-movement-v1';
export type MovementCommand={type:'rollBoard'|'settleMovement'|'endTurn';roomId:string;sessionId:string;commandId:string;revision?:number;diceCount?:1|2;startedAt?:number;playerUid?:string};
export function parseMovementCommand(data:unknown):MovementCommand {
  if(!data || typeof data!=='object' || Array.isArray(data))throw new HttpsError('invalid-argument','操作資料無效');
  const c=data as MovementCommand;
  const extra=c.type==='rollBoard'?['revision','diceCount']:c.type==='endTurn'?['revision']:['startedAt','playerUid'];
  if(!['rollBoard','settleMovement','endTurn'].includes(c.type) || Object.keys(c).some(k=>!['type','roomId','sessionId','commandId',...extra].includes(k)) ||
    ['type','roomId','sessionId','commandId',...(c.type==='settleMovement'?['playerUid']:[])].some(k=>typeof c[k as keyof MovementCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof MovementCommand]))) ||
    (c.type==='settleMovement'? !Number.isSafeInteger(c.startedAt)||c.startedAt!<0 : !Number.isSafeInteger(c.revision)||c.revision!<0) ||
    (c.diceCount!==undefined && c.diceCount!==1 && c.diceCount!==2))throw new HttpsError('invalid-argument','操作類型或識別值無效');
  return c;
}
export async function executeMovementCommand(db:Firestore,c:MovementCommand,uid?:string,now=Date.now()) {
  if(!uid && c.type!=='settleMovement')throw new HttpsError('unauthenticated','請先登入');
  // Candidates remain fixed across SDK transaction retries. Never accept client dice.
  const dice=[randomInt(1,7),randomInt(1,7)];
  const ref=db.doc(`rooms/${c.roomId}`);
  const fingerprint=key(JSON.stringify([c.type,c.sessionId,c.revision??null,c.diceCount??null,c.startedAt??null,c.playerUid??null]));
  const intent=ref.collection('gameCommands').doc(key(`${uid||'server'}:${c.commandId}`));
  const receipt=c.type==='settleMovement'?ref.collection('movementResults').doc(key(`${c.sessionId}:${c.playerUid}:${c.startedAt}`)):null;
  return db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref);
  const [previous,saved]=await Promise.all([tx.get(intent),receipt?tx.get(receipt):Promise.resolve(null)]);
    if(!snapshot.exists) {if(!uid)return {status:'stale'};throw new HttpsError('not-found','房間不存在');}
    const room=snapshot.data() as Room;
    if(uid && !room.members?.some(m=>m.uid===uid&&!m.isLeft))throw new HttpsError('permission-denied','目前不是房間成員');
    if(room.sessionId!==c.sessionId || room.movementAuthority!==MOVEMENT_AUTHORITY || room.syncSchemaVersion!==2 || room.flowSchemaVersion!==1 || room.financialHistoryStorage!=='subcollection' || Object.keys(room.playerStates||{}).length>0) {
      if(!uid)return {status:'stale'};throw new HttpsError('failed-precondition','場次已更新或尚未啟用後端移動');
    }
    if(previous.exists && previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作識別值不可更改內容');
    if(previous.data()?.result.status==='applied')return {...previous.data()!.result,status:'duplicate'};
    if(saved?.exists)return {...saved.data()!.result,status:'duplicate'};
    const board=room.boardState;
    if(room.status!=='playing'||!board){if(!uid)return {status:'stale'};throw new HttpsError('failed-precondition','遊戲尚未進行或已結束');}
    const actor=c.type==='settleMovement'?c.playerUid!:uid!;
    if(!room.members?.some(m=>m.uid===actor&&!m.isLeft) || !board.turnOrder.includes(actor) || board.currentTurnUid!==actor) {
      if(!uid)return {status:'stale'};throw new HttpsError('permission-denied','目前不是你的回合');
    }
    if(c.type==='settleMovement' && uid!==undefined && uid!==actor && uid!==room.hostId)throw new HttpsError('permission-denied','不能結算其他玩家');
    const playerRef=ref.collection('players').doc(actor),player=await tx.get(playerRef);
    if(!player.exists)throw new HttpsError('failed-precondition','玩家資料未完成');
    const state=player.data() as GameState;
    if(!state.isSetup)throw new HttpsError('failed-precondition','玩家設定未完成');
    let next=board,after=state,result:Record<string,unknown>={status:'applied'};
    if(c.type==='settleMovement') {
      const m=board.movement;
      if(!m?.isActive || m.startedAt!==c.startedAt || m.playerUid!==actor) {
        if(!uid)return {status:'stale'};throw new HttpsError('failed-precondition','移動事件已更新');
      }
      if(now<movementEndsAt(m))return {status:'waiting',retryAt:movementEndsAt(m),message:'等待移動展示完成'};
      const resolution=buildBoardMovementLegResolution({...room,playerStates:{[actor]:state}},actor);
      if(!resolution)throw new HttpsError('failed-precondition','移動無法結算');
      next=resolution.boardState;after=resolution.playerStates?.[actor]||state;
      result.eventId=next.currentEvent?.id||null;
    }else {
      if(room.isTimerPaused)throw new HttpsError('failed-precondition','遊戲暫停中');
      if(c.revision!==board.revision)throw new HttpsError('failed-precondition','棋盤狀態已更新，請重新同步');
      if(c.type==='endTurn') {
        try {next=buildNextBoardTurnState(board,actor,now);}catch(e){throw new HttpsError('failed-precondition',e instanceof Error?e.message:'回合尚未完成');}
      }else {
        if(board.hasRolledThisTurn || board.movement || board.currentEvent || board.pendingEvents?.length || hasIncompleteSharedPrompts(board,now) || (board.pendingContinuation && board.pendingContinuation.phase!=='completed'))
          throw new HttpsError('failed-precondition','請先完成目前事件');
        const selected=dice.slice(0,resolveBoardDiceCount(hasCarAsset(state),c.diceCount)),total=selected.reduce((a,b)=>a+b,0),start=board.playerPositions[actor]||0;
        const path=Array.from({length:total},(_,i)=>(start+i+1)%BOARD_SQUARES.length),effects=buildMovementEffects(path,hasCarAsset(state));
        const {legPath,remainingPath}=splitMovementLeg(path,effects);
        const detail=describeMovementEffects(effects).join('\n');
        next=appendDicePresentation({...board,hasRolledThisTurn:true,currentCard:null,currentCardReveal:null,currentEvent:null,
          lastRoll:{uid:actor,dice:selected,total,timestamp:now},
          movement:{playerUid:actor,startPosition:start,path:legPath,remainingPath:remainingPath.length?remainingPath:undefined,rollTotal:total,dice:selected,startedAt:now,stepDurationMs:380,introDelayMs:600+DICE_PRESENTATION_DURATION_MS,landingDelayMs:600,isActive:true,effects}},
          {id:c.commandId,sequence:(board.revision||0)+1,playerUid:actor,playerName:state.playerName||'玩家',kind:'board-movement',dice:selected,total,detail,timestamp:now});
        after=cleanObject({...state,bankServiceWindowActive:false,bankServiceGrantedAtEventId:undefined});
        result={status:'applied',dice:selected,total,timestamp:now,position:legPath.at(-1)??start,detail,skipTurns:state.skipTurns||0};
      }
    }
    next=cleanObject({...next,revision:(board.revision||0)+1,updatedAt:now});
    result.revision=next.revision;
    tx.update(ref,{boardState:next});
    writePublicPlayerState(tx,ref,room,actor,toPublicPlayerState(actor,after));
    tx.set(playerRef,cleanObject(after));
    tx.set(intent,{uid:uid||actor,sessionId:c.sessionId,fingerprint,result,completedAt:now});
    if(receipt)tx.create(receipt,{sessionId:c.sessionId,result,completedAt:now});
    // Movement write and outbox are atomic, including continuation legs triggered elsewhere.
    if(next.movement?.isActive)saveMovementTask(tx,ref,c.sessionId,next.movement);
    if(c.type==='settleMovement')tx.set(ref.collection('movementTasks').doc(key(`${c.sessionId}:${actor}:${c.startedAt}`)),{status:'completed',completedAt:now},{merge:true});
    return result;
  });
}
export function saveMovementTask(tx:import('firebase-admin/firestore').Transaction,ref:import('firebase-admin/firestore').DocumentReference,sessionId:string,m:NonNullable<Room['boardState']>['movement']) {
  if(!m?.isActive)return;
  tx.set(ref.collection('movementTasks').doc(key(`${sessionId}:${m.playerUid}:${m.startedAt}`)),
    {type:'settleMovement',roomId:ref.id,sessionId,playerUid:m.playerUid,startedAt:m.startedAt,commandId:`movement:${m.playerUid}:${m.startedAt}:settle`,status:'pending',retryAt:movementEndsAt(m)});
}

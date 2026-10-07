import {saveMovementTask,MOVEMENT_AUTHORITY} from './movement';
import {createHash} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room, BoardState} from '../../src/types';
import {hasIncompleteSharedPrompts, isBoardPromptForCurrentEvent} from '../../src/game/board/promptCompletion';
import {appendBoardCardLog, buildBoardEventAdvanceState} from '../../src/game/board/eventQueue';
import {cleanObject} from '../../src/utils/utils';

export const AUTHORITY = 'server-prompts-v1';
export interface FinalizeCommand {
  type: 'finalizePrompt'; roomId: string; sessionId: string; eventId: string; promptId: string; commandId: string;
}
export type CommandResult = {status:'applied'|'duplicate'|'waiting'|'stale'; eventId:string; revision?:number; retryAt?:number; reason?:string};
export const key = (value:string) => createHash('sha256').update(value).digest('hex');
export const finalizationKey = (c:Pick<FinalizeCommand,'sessionId'|'promptId'>) => key(`${c.sessionId}:${c.promptId}`);
export function parseCommand(data:unknown):FinalizeCommand {
  if (!data || typeof data!=='object' || Array.isArray(data)) throw new HttpsError('invalid-argument','操作資料無效');
  const c=data as FinalizeCommand;
  const fields=['type','roomId','sessionId','eventId','promptId','commandId'];
  if (Object.keys(c).some(k=>!fields.includes(k)) || c.type!=='finalizePrompt' ||
      fields.some(k=>typeof c[k as keyof FinalizeCommand]!=='string' || !/^[\w:.-]{1,512}$/.test(c[k as keyof FinalizeCommand])))
    throw new HttpsError('invalid-argument','操作類型或識別值無效');
  return c;
}

// All effects, the durable result and the next phase commit in the same transaction.
export async function executeCommand(db:Firestore,c:FinalizeCommand,uid?:string,now=Date.now()):Promise<CommandResult> {
  const roomRef=db.doc(`rooms/${c.roomId}`);
  const receiptRef=roomRef.collection('promptFinalizations').doc(finalizationKey(c));
  const intentRef=uid ? roomRef.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)) : null;
  const taskRef=roomRef.collection('promptFinalizationTasks').doc(finalizationKey(c));
  const fingerprint=key(JSON.stringify([c.type,c.roomId,c.sessionId,c.eventId,c.promptId]));
  return db.runTransaction(async tx=>{
    const roomDoc=await tx.get(roomRef);
    if(!roomDoc.exists) {if(uid)throw new HttpsError('not-found','房間不存在');return {status:'stale',eventId:c.eventId};}
    const room=roomDoc.data() as Room & {promptCompletionAuthority?:string};
    if(uid && !(room.members||[]).some(member=>member.uid===uid && !member.isLeft))
      throw new HttpsError('permission-denied','目前不是房間成員');
    if(room.sessionId!==c.sessionId || room.promptCompletionAuthority!==AUTHORITY) {
      if(uid)throw new HttpsError('failed-precondition','場次已更新或尚未啟用後端結案');
      return {status:'stale',eventId:c.eventId};
    }
    const [receipt,intent]=await Promise.all([tx.get(receiptRef),intentRef?tx.get(intentRef):Promise.resolve(null)]);
    if(intent?.exists && intent.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一操作識別值不可搭配不同內容');
    if(receipt.exists) {
      if(receipt.data()!.eventId!==c.eventId)throw new HttpsError('failed-precondition','提示識別值已屬於其他事件');
      const result={...receipt.data()!.result,status:'duplicate'} as CommandResult;
      if(intentRef)tx.set(intentRef,{uid,sessionId:c.sessionId,fingerprint,result},{merge:true});
      return result;
    }
    const board=room.boardState;
    if(room.status!=='playing' || !board || board.currentEvent?.id!==c.eventId) {
      if(uid)throw new HttpsError('failed-precondition','事件已過期');
      return {status:'stale',eventId:c.eventId};
    }
    const promptKey=board.familyMilestoneJoinPrompt?.id===c.promptId?'familyMilestoneJoinPrompt':
      board.sharedCardPrompt?.id===c.promptId?'sharedCardPrompt':null;
    if(!promptKey || !isBoardPromptForCurrentEvent(board[promptKey],board)) {
      if(uid)throw new HttpsError('failed-precondition','共享事件已更新');
      return {status:'stale',eventId:c.eventId};
    }
    let hydrated={...board};
    for(const name of ['familyMilestoneJoinPrompt','sharedCardPrompt'] as const) {
      const prompt=board[name];
      if(!prompt || !isBoardPromptForCurrentEvent(prompt,board))continue;
      if(prompt.responseStorage!=='subcollection' || !Array.isArray(prompt.targetPlayerUids) || prompt.targetPlayerUids.length>16 ||
         new Set(prompt.targetPlayerUids).size!==prompt.targetPlayerUids.length || prompt.targetPlayerUids.some(id=>typeof id!=='string'||!id.length||id.length>128||id.includes('/')))
        throw new HttpsError('failed-precondition','回覆格式不支援後端结案');
      const responses=await Promise.all(prompt.targetPlayerUids.map(id=>tx.get(roomRef.collection('events').doc(prompt.id).collection('responses').doc(id))));
      for(const response of responses) {
        if(!response.exists)continue;
        const value=response.data()!;
        const statuses=name==='familyMilestoneJoinPrompt'?['passed','failed','declined']:['completed','declined','no_effect'];
        if(value.playerUid!==response.id || !statuses.includes(value.status) ||
           (value.presentationReadyAt!==undefined && (!Number.isFinite(value.presentationReadyAt) || value.presentationReadyAt<0)) ||
           (value.actionCompleted!==undefined && typeof value.actionCompleted!=='boolean'))
          throw new HttpsError('failed-precondition','回覆資料不完整，保留事件等待修復');
      }
      hydrated={...hydrated,[name]:{...prompt,responses:Object.fromEntries(responses.filter(d=>d.exists).map(d=>[d.id,d.data()]))}};
    }
    const family=hydrated.familyMilestoneJoinPrompt;
    const retryAt=family ? Math.max(0,...family.targetPlayerUids.map(id=>family.responses?.[id]?.presentationReadyAt||0)) : 0;
    const result:CommandResult={status:'waiting',eventId:c.eventId,reason:'等待必要玩家完成'};
    if(hasIncompleteSharedPrompts(hydrated,now)) {
      // Ignore only the animation deadline to distinguish pending choices from scheduled work.
      if(!hasIncompleteSharedPrompts(hydrated,Number.MAX_SAFE_INTEGER) && retryAt>now) {
        result.retryAt=retryAt;result.reason='等待骰點展示完成';
        tx.set(taskRef,{...c,commandId:`finalize:${finalizationKey(c)}`,status:'pending',retryAt},{merge:true});
      }
      if(intentRef)tx.set(intentRef,{uid,sessionId:c.sessionId,fingerprint,result},{merge:true});
      return result;
    }
    const cardLog=appendBoardCardLog(hydrated,hydrated.currentCard,hydrated.currentEvent);
    const next=buildBoardEventAdvanceState({...room,boardState:{...hydrated,familyMilestoneJoinPrompt:null,sharedCardPrompt:null,cardLog}});
    if(!next?.boardState) {
      if(intentRef)tx.set(intentRef,{uid,sessionId:c.sessionId,fingerprint,result},{merge:true});
      return result;
    }
    const finalResult:CommandResult={status:'applied',eventId:c.eventId,revision:(board.revision||0)+1};
    const nextBoard=cleanObject({...next.boardState,
      cardLog:next.boardState.currentCard ? appendBoardCardLog({...hydrated,cardLog},next.boardState.currentCard,next.boardState.currentEvent) : cardLog,
      revision:finalResult.revision,
      processedCommandIds:[...(board.processedCommandIds||[]),`server:finalize:${finalizationKey(c)}`].slice(-100)});
    tx.update(roomRef,{boardState:nextBoard});
    if(room.movementAuthority===MOVEMENT_AUTHORITY)saveMovementTask(tx,roomRef,c.sessionId,nextBoard.movement);
    tx.create(receiptRef,{sessionId:c.sessionId,eventId:c.eventId,promptId:c.promptId,result:finalResult,completedAt:now});
    tx.set(taskRef,{status:'completed',completedAt:now},{merge:true});
    if(intentRef)tx.set(intentRef,{uid,sessionId:c.sessionId,fingerprint,result:finalResult},{merge:true});
    return finalResult;
  });
}

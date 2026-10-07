import {getApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {callServerGameCommand} from '../board/serverPromptCommand';
import {readPendingGameCommand,submitPersistentGameCommand,gameCommandContents} from '../board/pendingCommand';
import {runLockedBoardCommand} from '../board/commandLock';
const pending=new Map<string,Promise<unknown>>();
export function setAdminScore(choices:{targetUid:string;score:number;expectedExperience:number;expectedRankScore:number}):Promise<{status:string;targetUid:string;experience:number;rankScore:number}>{
 const uid=getAuth(getApp()).currentUser?.uid;if(!uid)return Promise.reject(new Error('請先登入'));
 return runLockedBoardCommand(pending,`${uid}:${gameCommandContents(choices)}`,async()=>{
  const roomId='score-admin',sessionId='score-admin',old=readPendingGameCommand(localStorage,uid,roomId,sessionId);
  if(old&&gameCommandContents({targetUid:old.targetUid,score:old.score,expectedExperience:old.expectedExperience,expectedRankScore:old.expectedRankScore})!==gameCommandContents(choices))throw new Error('原積分修改尚待確認，請保留原操作並重試');
  const command=old||{type:'adminSetScore',roomId,sessionId,commandId:crypto.randomUUID(),...choices};
  const result=await submitPersistentGameCommand<any>(localStorage,uid,command,async data=>{
   const response:any=await callServerGameCommand((data as any).type==='getCommandResult'?{...(data as object),type:'getAdminScoreResult'}:data),effect=response?.status==='confirmed'?response.result:response;
   const rejection=effect?.status==='rejected'&&effect.code==='failed-precondition'&&effect.targetUid===choices.targetUid&&effect.requestedScore===choices.score&&effect.expectedExperience===choices.expectedExperience&&effect.expectedRankScore===choices.expectedRankScore;
   if(response?.status!=='waiting'&&!rejection&&(!['applied','duplicate'].includes(effect?.status)||effect.targetUid!==choices.targetUid||effect.rankScore!==choices.score||effect.experience!==choices.score))throw Object.assign(new Error('積分修改結果無法確認，請保留原操作'),{code:'functions/internal'});
   return response;
  });
  if(result.status==='rejected')throw Object.assign(new Error(result.message),{code:`functions/${result.code}`});
  if(!['applied','duplicate'].includes(result.status)||result.targetUid!==choices.targetUid||result.rankScore!==choices.score||result.experience!==choices.score)throw new Error('積分修改尚未確認，請查核原操作');
  if(getAuth(getApp()).currentUser?.uid!==uid)throw new Error('登入已變更，請用原帳號查核積分');
  return result;
 });
}

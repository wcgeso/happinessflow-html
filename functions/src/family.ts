import {randomInt} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Room,GameState,FamilyMilestoneJoinResponse} from '../../src/types';
import {getFamilyMilestoneStatus,getFamilyMilestoneStageByProgressId,applyFamilyMilestoneStage} from '../../src/utils/familyMilestones';
import {getFamilyDicePresentationReadyAt,appendDicePresentation} from '../../src/game/board/dicePresentation';
import {isBoardPromptForCurrentEvent} from '../../src/game/board/promptCompletion';
import {cleanObject} from '../../src/utils/utils';
import {AUTHORITY,key} from './commands';
import {BANKING_AUTHORITY} from './banking';
import {commitFinance} from './financeCommit';
import {withAutomaticHappiness} from '../../src/game/finance/automaticHappiness';
export type FamilyCommand={type:'familyRespond'|'familyAction'|'familyConfirm';roomId:string;sessionId:string;eventId:string;promptId:string;commandId:string;choice?:'roll'|'decline';accepted?:boolean;forcedDebtAmount?:number;fundingLoanAmount?:number};
export function parseFamilyCommand(data:unknown):FamilyCommand {
  if(!data || typeof data!=='object' || Array.isArray(data))throw new HttpsError('invalid-argument','家庭歷程操作無效');
  const c=data as FamilyCommand,fields=['type','roomId','sessionId','eventId','promptId','commandId',...(c.type==='familyRespond'?['choice']:c.type==='familyAction'?['accepted','forcedDebtAmount','fundingLoanAmount']:[])];
  if(!['familyRespond','familyAction','familyConfirm'].includes(c.type)||Object.keys(c).some(k=>!fields.includes(k))||['roomId','sessionId','eventId','promptId','commandId'].some(k=>typeof c[k as keyof FamilyCommand]!=='string'||!/^[\w:.-]{1,512}$/.test(String(c[k as keyof FamilyCommand])))||
    (c.type==='familyRespond'?!['roll','decline'].includes(c.choice!):c.type==='familyAction'&&typeof c.accepted!=='boolean')||['forcedDebtAmount','fundingLoanAmount'].some(k=>c[k as keyof FamilyCommand]!==undefined&&(!Number.isSafeInteger(c[k as keyof FamilyCommand])||Number(c[k as keyof FamilyCommand])<0||Number(c[k as keyof FamilyCommand])>1e12)))
    throw new HttpsError('invalid-argument','家庭歷程選擇或識別值無效');
  return c;
}
export async function executeFamilyCommand(db:Firestore,c:FamilyCommand,uid:string,now=Date.now()) {
 const roll=randomInt(1,7),ref=db.doc(`rooms/${c.roomId}`),playerRef=ref.collection('players').doc(uid),responseRef=ref.collection('events').doc(c.promptId).collection('responses').doc(uid);
 const receipt=ref.collection('familyActions').doc(key(`${c.sessionId}:${c.promptId}:${uid}`)),intent=ref.collection('gameCommands').doc(key(`${uid}:${c.commandId}`)),fingerprint=key(JSON.stringify([c.type,c.sessionId,c.eventId,c.promptId,c.choice??null,c.accepted??null,c.forcedDebtAmount??0,c.fundingLoanAmount??0]));
 return db.runTransaction(async tx=>{
  const rs=await tx.get(ref);
  const [ps,response,previous,saved]=await Promise.all([tx.get(playerRef),tx.get(responseRef),tx.get(intent),tx.get(receipt)]);
  if(!rs.exists||!ps.exists)throw new HttpsError('not-found','房間或玩家資料不存在');
  const room=rs.data() as Room,state=ps.data() as GameState;
  if(!room.members?.some(m=>m.uid===uid&&!m.isLeft)||uid===room.hostId)throw new HttpsError('permission-denied','目前不是家庭歷程玩家');
  if(room.sessionId!==c.sessionId||room.promptCompletionAuthority!==AUTHORITY||room.syncSchemaVersion!==2||room.flowSchemaVersion!==1||room.financialHistoryStorage!=='subcollection')throw new HttpsError('failed-precondition','場次已更新或後端家庭歷程尚未啟用');
  if(previous.exists&&previous.data()!.fingerprint!==fingerprint)throw new HttpsError('already-exists','同一命令不可更改選擇');
  if(previous.data()?.result.status==='applied')return {...previous.data()!.result,status:'duplicate'};
  if(c.type==='familyConfirm'){const result=saved.exists?{status:'duplicate'}:{status:'waiting',message:'家庭歷程付款或拒絕尚未確認'};tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;}
  if(c.type==='familyAction'&&saved.exists){if(saved.data()!.accepted!==c.accepted)throw new HttpsError('already-exists','家庭歷程已完成其他選擇');const result=saved.data()!.result;tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return {...result,status:'duplicate'};}
  const board=room.boardState,prompt=board?.familyMilestoneJoinPrompt;
  if(room.status!=='playing'||!state.isSetup||!board||!prompt||prompt.id!==c.promptId||prompt.sourceEventId!==c.eventId||!isBoardPromptForCurrentEvent(prompt,board)||prompt.responseStorage!=='subcollection')throw new HttpsError('failed-precondition','家庭歷程事件已更新');
  const isSource=prompt.sourcePlayerUid===uid;
  if(!isSource&&!prompt.targetPlayerUids.includes(uid))throw new HttpsError('permission-denied','不在家庭歷程參與名單');
  if(c.type==='familyRespond') {
    if(isSource)throw new HttpsError('failed-precondition','抽卡者不需參與骰');
    if(response.exists){const r=response.data()!;if((c.choice==='decline')!==(r.status==='declined'))throw new HttpsError('already-exists','已提交不同回覆');const result={status:'applied',response:r};tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return {...result,status:'duplicate'};}
    const family=getFamilyMilestoneStatus(state),stage=family.currentStageIndex>=0?family.stages[family.currentStageIndex]:undefined;
    const status=c.choice==='decline'?'declined':roll>=prompt.requiredRoll?'passed':'failed';
    const r=cleanObject({playerUid:uid,playerName:room.members.find(m=>m.uid===uid)?.name||'玩家',status,actionCompleted:status!=='passed'||!stage,stageProgressId:stage?.progressId,roll:c.choice==='roll'?roll:undefined,respondedAt:now,presentationReadyAt:c.choice==='roll'?getFamilyDicePresentationReadyAt(now):undefined,promptId:c.promptId,commandId:c.commandId}) as FamilyMilestoneJoinResponse;
    if(status==='passed'&&stage)tx.update(playerRef,{pendingFamilyMilestoneJoinAction:{promptId:c.promptId,cardId:prompt.sourceCardId,sourcePlayerUid:prompt.sourcePlayerUid,stageProgressId:stage.progressId},pendingCardAction:'家庭歷程參與付款待完成'});
    tx.create(responseRef,r);
    if(c.choice==='roll')tx.update(ref,{boardState:cleanObject(appendDicePresentation({...board,revision:(board.revision||0)+1,updatedAt:now},{id:c.commandId,sequence:(board.revision||0)+1,playerUid:uid,playerName:r.playerName,kind:'family-participation',sourceEventId:c.eventId,dice:[roll],total:roll,target:prompt.requiredRoll,success:status==='passed',timestamp:now}))});
    const result={status:'applied',response:r};tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;
  }
  if(room.bankingAuthority!==BANKING_AUTHORITY)throw new HttpsError('failed-precondition','家庭財務尚未啟用後端');
  const r=response.data() as FamilyMilestoneJoinResponse|undefined;
  if(!isSource&&r?.status!=='passed')throw new HttpsError('failed-precondition','尚未取得家庭歷程參與資格');
  const stage=getFamilyMilestoneStageByProgressId(isSource?prompt.sourceStageProgressId:r?.stageProgressId);
  if(!Number.isFinite(state.cash)||state.cash<0)throw new HttpsError('failed-precondition','玩家財務資料無效');
  let after=state;
  if(c.accepted) {
    if(!stage||getFamilyMilestoneStatus(state).stages.find(s=>!s.completed)?.progressId!==stage.progressId)throw new HttpsError('failed-precondition','家庭歷程階段不存在');
    const applied=applyFamilyMilestoneStage(state,stage,`family:${prompt.id}:${uid}:${stage.progressId}`,now,c.forcedDebtAmount,c.fundingLoanAmount);
    if(applied.status==='insufficient')return {status:'requires_funding',shortfall:applied.shortfall};
    if(applied.status==='failed')throw new HttpsError('failed-precondition',applied.message);
    if(applied.status==='duplicate')throw new HttpsError('failed-precondition','舊版付款紀錄需要核對');
    after=applied.state;
  }
  after={...withAutomaticHappiness(after,room.financialAcceleration)};
  if(after.pendingFamilyMilestoneJoinAction?.promptId===c.promptId){
   delete after.pendingFamilyMilestoneJoinAction;
   if(after.pendingCardAction==='家庭歷程參與付款待完成')delete after.pendingCardAction;
  }
  const result={status:'applied'};
  commitFinance(tx,ref,uid,state,after,room,c.commandId,result);
  if(isSource)tx.update(ref,{'boardState.familyMilestoneJoinPrompt.sourceActionCompleted':true,'boardState.updatedAt':now,'boardState.revision':(board.revision||0)+1});
  else tx.update(responseRef,{actionCompleted:true,actionAccepted:c.accepted,commandId:c.commandId});
  tx.create(receipt,{uid,sessionId:c.sessionId,promptId:c.promptId,accepted:c.accepted,result});
  tx.set(intent,{uid,sessionId:c.sessionId,fingerprint,result});return result;
 });
}

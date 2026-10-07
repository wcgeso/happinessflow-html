import {parseAdminScoreCommand,executeAdminScoreCommand} from './adminScore';
import {parseCoachBoardCommand,executeCoachBoardCommand,readServerPresence} from './coachBoard';
import {parseRoomLifecycleCommand,executeRoomLifecycleCommand} from './roomLifecycle';
import {parseRoomMembershipCommand,executeRoomMembershipCommand} from './roomMembership';
import {parseRoomCreationCommand,executeRoomCreationCommand} from './roomCreate';
import {parseRoomStartCommand,executeRoomStartCommand} from './roomStart';
import {parsePlayerSetupCommand,executePlayerSetupCommand} from './playerSetup';
import {readClientCommand} from './clientProtocol';
import {parseCoachAdjustmentCommand,executeCoachAdjustmentCommand,parseCoachSubsidyCommand,executeCoachSubsidyCommand,parseCoachMarketCommand,executeCoachMarketCommand,parseCoachAccelerationCommand,executeCoachAccelerationCommand} from './coachAdjustment';
import {parsePersonalHappinessCommand,executePersonalHappinessCommand} from './personalHappiness';
import {parseOpportunityCommand,executeOpportunityCommand} from './opportunityCard';
import {parseMedicalCommand,executeMedicalCommand} from './medicalCard';
import {parseHappinessCommand,executeHappinessCommand} from './happinessCard';
import {getCommandResult} from './commandResult';
import {commandError} from './commandError';
import {parseRealEstateCommand,executeRealEstateCommand} from './realEstate';
import {parseRevealCommand,executeRevealCommand} from './reveal';
import {parseStoryCommand,executeStoryCommand} from './story';
import {parseFollowupCommand,executeFollowupCommand} from './followup';
import {parseSharedCommand,executeSharedCommand} from './shared';
import {parseServiceCommand,executeServiceCommand} from './serviceEvent';
import {parseLearningCommand,executeLearningCommand} from './learning';
import {parseFamilyCommand,executeFamilyCommand} from './family';
import {executeTimerCommand} from './timer';
import {MOVEMENT_AUTHORITY,executeMovementCommand,parseMovementCommand,saveMovementTask} from './movement';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {parseBankingCommand,executeBankingCommand} from './banking';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {getFunctions} from 'firebase-admin/functions';
import * as logger from 'firebase-functions/logger';
import {setGlobalOptions} from 'firebase-functions/v2';
import {defineString} from 'firebase-functions/params';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onDocumentWritten,onDocumentCreated} from 'firebase-functions/v2/firestore';
import {hasActiveRooms,setWarmPool} from './warmPool';
import {onTaskDispatched} from 'firebase-functions/v2/tasks';
import {AUTHORITY,key,executeCommand,parseCommand,type FinalizeCommand} from './commands';
initializeApp();
const region=defineString('GAME_FUNCTION_REGION',{default:'asia-east1'});
// Cloud Run service names of the functions on the tap → result path (lowercase function names).
const warmServices=defineString('WARM_SERVICES',{default:'gamecommand,enqueuemovementsettlement,settlemovementtask,onpromptresponse'});
setGlobalOptions({region,maxInstances:5});
const db=getFirestore();
export const gameCommand=onCall({enforceAppCheck:process.env.FUNCTIONS_EMULATOR!=='true'},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','請先登入');
  // Sent when a player opens the lobby or a room, so the first real tap does not pay the cold start.
  if((request.data as {type?:unknown})?.type==='warmup')return {status:'warm'};
  const data:any=await readClientCommand(db,request.data,request.auth.uid);
  if(['adminSetScore','getAdminScoreResult'].includes(data?.type)){
    const command=parseAdminScoreCommand(data),started=performance.now();
    try{const result=await executeAdminScoreCommand(db,command,request.auth.uid,request.auth.token.gameAdmin===true);logger.info('admin_score_command',{uid:request.auth.uid,commandId:command.commandId,status:result.status,durationMs:performance.now()-started});return result;}
    catch(error){const failure=commandError(error);logger.error('admin_score_failed',{uid:request.auth.uid,commandId:command.commandId,code:failure.code,durationMs:performance.now()-started});throw failure;}
  }
  if(data?.type==='getCommandResult')return getCommandResult(db,data,request.auth.uid);
  if(['skipDisconnectedTurn','skipDisconnectedSharedTarget','setCoachNextTurn','coachTestCard','coachReplayEvent','coachClearEvent','coachForceEnd'].includes(data?.type)){
    const command=parseCoachBoardCommand(data),started=performance.now();
    try{const result=await executeCoachBoardCommand(db,command,request.auth.uid,playerUid=>readServerPresence(command.roomId,playerUid));logger.info('game_command',{...command,uid:request.auth.uid,status:result.status,durationMs:performance.now()-started});return result;}
    catch(error){const failure=commandError(error);logger.error('game_command_failed',{...command,uid:request.auth.uid,code:failure.code,cause:error instanceof Error?error.message:String(error),durationMs:performance.now()-started});throw failure;}
  }
  if(['finishRoom','closeRoom'].includes(data?.type)){
    const command=parseRoomLifecycleCommand(data),started=performance.now();
    try{const result=await executeRoomLifecycleCommand(db,command,request.auth.uid);logger.info('game_command',{...command,uid:request.auth.uid,status:result.status,durationMs:performance.now()-started});return result;}
    catch(error){const failure=commandError(error);logger.error('game_command_failed',{...command,uid:request.auth.uid,code:failure.code,cause:error instanceof Error?error.message:String(error),durationMs:performance.now()-started});throw failure;}
  }
  if(data?.type==='createRoom'||data?.type==='getRoomCreationResult'){
    const command=parseRoomCreationCommand(data),started=performance.now();
    try{const result=await executeRoomCreationCommand(db,command,request.auth.uid,request.auth.token.gameHost===true||request.auth.token.gameAdmin===true||request.auth.token.email==='gm0221@happinessflow.com');logger.info('game_command',{type:command.type,commandId:command.commandId,uid:request.auth.uid,status:result.status,durationMs:performance.now()-started});return result;}
    catch(error){const failure=commandError(error);logger.error('game_command_failed',{type:command.type,commandId:command.commandId,uid:request.auth.uid,code:failure.code,cause:error instanceof Error?error.message:String(error),durationMs:performance.now()-started});throw failure;}
  }
  if(['joinRoom','leaveRoom','setRoomSlot'].includes(data?.type)){
    const command=parseRoomMembershipCommand(data),started=performance.now();
    try{const result=await executeRoomMembershipCommand(db,command,request.auth.uid);logger.info('game_command',{...command,uid:request.auth.uid,status:result.status,durationMs:performance.now()-started});return result;}
    catch(error){const failure=commandError(error);logger.error('game_command_failed',{...command,uid:request.auth.uid,code:failure.code,cause:error instanceof Error?error.message:String(error),durationMs:performance.now()-started});throw failure;}
  }
  if(data?.type==='startRoom'){
    const command=parseRoomStartCommand(data),started=performance.now();
    try{const result=await executeRoomStartCommand(db,command,request.auth.uid);logger.info('game_command',{...command,uid:request.auth.uid,status:result.status,durationMs:performance.now()-started});return result;}
    catch(error){const failure=commandError(error);logger.error('game_command_failed',{...command,uid:request.auth.uid,code:failure.code,cause:error instanceof Error?error.message:String(error),durationMs:performance.now()-started});throw failure;}
  }
  if(data?.type==='setupPlayer'){
    const command=parsePlayerSetupCommand(data),started=performance.now();
    try{const result=await executePlayerSetupCommand(db,command,request.auth.uid);logger.info('game_command',{type:command.type,roomId:command.roomId,sessionId:command.sessionId,commandId:command.commandId,uid:request.auth.uid,status:result.status,durationMs:performance.now()-started});return result;}
    catch(error){const failure=commandError(error);logger.error('game_command_failed',{type:command.type,roomId:command.roomId,sessionId:command.sessionId,commandId:command.commandId,uid:request.auth.uid,code:failure.code,cause:error instanceof Error?error.message:String(error),durationMs:performance.now()-started});throw failure;}
  }
  if(data?.type==='setTimer'){
    const started=performance.now();try{const result=await executeTimerCommand(db,data,request.auth.uid);logger.info('game_command',{...data,uid:request.auth.uid,status:result.status,durationMs:performance.now()-started});return result;}
    catch(error){const failure=commandError(error);logger.error('game_command_failed',{...data,uid:request.auth.uid,code:failure.code,cause:error instanceof Error?error.message:String(error),durationMs:performance.now()-started});throw failure;}
  }
  if(['purchaseRealEstate','declineRealEstate','convertHouse'].includes(data?.type)){
    const command=parseRealEstateCommand(data),started=performance.now();
    try{const result=await executeRealEstateCommand(db,command,request.auth.uid);logger.info('game_command',{...command,uid:request.auth.uid,status:result.status,durationMs:performance.now()-started});return result;}
    catch(error){const failure=commandError(error);logger.error('game_command_failed',{...command,uid:request.auth.uid,code:failure.code,cause:error instanceof Error?error.message:String(error),durationMs:performance.now()-started});throw failure;}
  }
  const movement=['rollBoard','settleMovement','endTurn'].includes(data?.type);
  const family=['familyRespond','familyAction','familyConfirm'].includes(data?.type);
  const learning=['payLearning','rollLearning','paySchool','rollSchool','finishSchool','skipSchool','finishLearning','declineLearning'].includes(data?.type);
  const story=['submitStory','approveStory','rejectStory','clearStory','finishStory','declineStory'].includes(data?.type);
  const followup=['submitFollowup','approveFollowup','rejectFollowup','clearFollowup','drawFollowup','declineFollowup','applyFollowup'].includes(data?.type);
  const shared=data?.type==='sharedAction';
  const service=['rollService','payService','finishService'].includes(data?.type);
  const coachAcceleration=data?.type==='coachAcceleration';
  const coachMarket=data?.type==='coachMarket';
  const coachSubsidy=data?.type==='coachSubsidy';
  const coachAdjustment=data?.type==='coachAdjustment';
  const personalHappiness=data?.type==='personalHappiness';
  const opportunity=data?.type==='opportunityCard';
  const medical=['payMedicalCard','finishMedicalCard','claimMedical'].includes(data?.type);
  const happiness=data?.type==='happinessCard';
  const reveal=['revealCard','finishMarket'].includes(data?.type);
  const command=coachAcceleration?parseCoachAccelerationCommand(data):coachMarket?parseCoachMarketCommand(data):coachSubsidy?parseCoachSubsidyCommand(data):coachAdjustment?parseCoachAdjustmentCommand(data):personalHappiness?parsePersonalHappinessCommand(data):opportunity?parseOpportunityCommand(data):medical?parseMedicalCommand(data):happiness?parseHappinessCommand(data):reveal?parseRevealCommand(data):service?parseServiceCommand(data):shared?parseSharedCommand(data):followup?parseFollowupCommand(data):story?parseStoryCommand(data):learning?parseLearningCommand(data):family?parseFamilyCommand(data):movement?parseMovementCommand(data):data?.type==='finalizePrompt'?parseCommand(data):parseBankingCommand(data),started=performance.now();
  try {
    const result=await (coachAcceleration?executeCoachAccelerationCommand(db,command as import('./coachAdjustment').CoachAccelerationCommand,request.auth.uid):coachMarket?executeCoachMarketCommand(db,command as import('./coachAdjustment').CoachMarketCommand,request.auth.uid):coachSubsidy?executeCoachSubsidyCommand(db,command as import('./coachAdjustment').CoachSubsidyCommand,request.auth.uid):coachAdjustment?executeCoachAdjustmentCommand(db,command as import('./coachAdjustment').CoachAdjustmentCommand,request.auth.uid):personalHappiness?executePersonalHappinessCommand(db,command as import('./personalHappiness').PersonalHappinessCommand,request.auth.uid):opportunity?executeOpportunityCommand(db,command as import('./opportunityCard').OpportunityCommand,request.auth.uid):medical?executeMedicalCommand(db,command as import('./medicalCard').MedicalCommand,request.auth.uid):happiness?executeHappinessCommand(db,command as import('./happinessCard').HappinessCommand,request.auth.uid):reveal?executeRevealCommand(db,command as import('./reveal').RevealCommand,request.auth.uid):service?executeServiceCommand(db,command as import('./serviceEvent').ServiceCommand,request.auth.uid):shared?executeSharedCommand(db,command as import('./shared').SharedCommand,request.auth.uid):followup?executeFollowupCommand(db,command as import('./followup').FollowupCommand,request.auth.uid):story?executeStoryCommand(db,command as import('./story').StoryCommand,request.auth.uid):learning?executeLearningCommand(db,command as import('./learning').LearningCommand,request.auth.uid):family?executeFamilyCommand(db,command as import('./family').FamilyCommand,request.auth.uid):command.type==='finalizePrompt'?executeCommand(db,command,request.auth.uid):['rollBoard','settleMovement','endTurn'].includes(command.type)?executeMovementCommand(db,command as import('./movement').MovementCommand,request.auth.uid):executeBankingCommand(db,command as import('./banking').BankingCommand,request.auth.uid));
    logger.info('game_command',{...command,uid:request.auth.uid,status:result.status,durationMs:performance.now()-started});
    return result;
  }catch(error){
    const failure=commandError(error);
    logger.error('game_command_failed',{...command,uid:request.auth.uid,code:failure.code,cause:error instanceof Error?error.message:String(error),durationMs:performance.now()-started});
    throw failure;
  }
});
async function reconcile(roomId:string,promptId?:string) {
  const snapshot=await db.doc(`rooms/${roomId}`).get();const room=snapshot.data();
  if(!room || room.promptCompletionAuthority!==AUTHORITY || room.status!=='playing')return;
  const board=room.boardState;
  for(const p of [board?.familyMilestoneJoinPrompt,board?.sharedCardPrompt]) {
    if(!p || (promptId && p.id!==promptId))continue;
    try {
      await executeCommand(db,parseCommand({type:'finalizePrompt',roomId,sessionId:room.sessionId,eventId:p.sourceEventId,promptId:p.id,commandId:`finalize:${p.id}`}));
    }catch(error){
      if(!(error instanceof HttpsError))throw error;
      logger.error('prompt_reconciliation_blocked',{roomId,promptId:p.id,code:error.code,message:error.message});
    }
  }
}
export const onPromptResponse=onDocumentWritten({document:'rooms/{roomId}/events/{promptId}/responses/{uid}',retry:true},async event=>{
  if(event.data?.after.exists)await reconcile(event.params.roomId,event.params.promptId);
});
export const onPromptSource=onDocumentWritten({document:'rooms/{roomId}',retry:true},async event=>{
  const before=event.data?.before.data()?.boardState,after=event.data?.after.data()?.boardState;
  if(after && (before?.familyMilestoneJoinPrompt?.sourceActionCompleted!==after.familyMilestoneJoinPrompt?.sourceActionCompleted ||
    before?.familyMilestoneJoinPrompt?.id!==after.familyMilestoneJoinPrompt?.id || before?.sharedCardPrompt?.id!==after.sharedCardPrompt?.id))
    await reconcile(event.params.roomId);
});
// Durable outbox: failed enqueue remains pending; trigger retry must not lose the deadline.
export const enqueuePromptFinalization=onDocumentWritten({document:'rooms/{roomId}/promptFinalizationTasks/{taskId}',retry:true},async event=>{
  const task=event.data?.after.data(),before=event.data?.before.data();
  if(!task || task.status!=='pending' || (before?.status==='pending' && before.retryAt===task.retryAt))return;
  if(process.env.FUNCTIONS_EMULATOR==='true' && !process.env.CLOUD_TASKS_EMULATOR_HOST)
    throw new Error('Cloud Tasks emulator is required; refusing cloud enqueue');
  await getFunctions().taskQueue(`locations/${region.value()}/functions/retryPromptFinalization`).enqueue(task,{scheduleTime:new Date(task.retryAt)});
  await db.runTransaction(async tx=>{
    const ref=event.data!.after.ref,current=await tx.get(ref);
    if(current.data()?.status==='pending' && current.data()?.retryAt===task.retryAt)tx.update(ref,{status:'scheduled'});
  });
});
export const retryPromptFinalization=onTaskDispatched({retryConfig:{maxAttempts:5,minBackoffSeconds:2}},async request=>{
  const {status,retryAt,...data}=request.data;
  await executeCommand(db,parseCommand(data) as FinalizeCommand);
});

// Capture continuation legs from legacy event-completion commands during staged migration.
export const onMovementStarted=onDocumentWritten({document:'rooms/{roomId}',retry:true},async event=>{
  const after=event.data?.after.data(),before=event.data?.before.data(),m=after?.boardState?.movement;
  if(after?.movementAuthority!==MOVEMENT_AUTHORITY || after.status!=='playing' || !m?.isActive ||
    (before?.boardState?.movement?.isActive && before.boardState.movement.startedAt===m.startedAt))return;
  await db.runTransaction(async tx=>{
    const ref=event.data!.after.ref,snapshot=await tx.get(ref),room=snapshot.data();
    if(room?.movementAuthority===MOVEMENT_AUTHORITY && room.status==='playing' && room.sessionId===after.sessionId && room.boardState?.movement?.isActive && room.boardState.movement.startedAt===m.startedAt)
      saveMovementTask(tx,ref,room.sessionId,room.boardState.movement);
  });
});
export const enqueueMovementSettlement=onDocumentWritten({document:'rooms/{roomId}/movementTasks/{taskId}',retry:true},async event=>{
  const task=event.data?.after.data(),before=event.data?.before.data();
  if(!task || task.status!=='pending' || (before?.status==='pending' && before.retryAt===task.retryAt))return;
  if(process.env.FUNCTIONS_EMULATOR==='true' && !process.env.CLOUD_TASKS_EMULATOR_HOST)
    throw new Error('Cloud Tasks emulator required; refusing cloud enqueue');
  const {status,retryAt,...command}=task;
  await getFunctions().taskQueue(`locations/${region.value()}/functions/settleMovementTask`).enqueue(command,{scheduleTime:new Date(retryAt)});
  await db.runTransaction(async tx=>{const ref=event.data!.after.ref,current=await tx.get(ref);
    if(current.data()?.status==='pending' && current.data()?.retryAt===retryAt)tx.update(ref,{status:'scheduled'});
  });
});
export const settleMovementTask=onTaskDispatched({retryConfig:{maxAttempts:5,minBackoffSeconds:2}},async request=>{
  const command=parseMovementCommand(request.data),result=await executeMovementCommand(db,command);
  if(result.status==='waiting')throw new HttpsError('unavailable','移動尚未到期');
  if(result.status==='stale')await db.doc(`rooms/${command.roomId}/movementTasks/${keyForMovement(command)}`).set({status:'stale'},{merge:true});
});
const keyForMovement=(c:import('./movement').MovementCommand)=>key(`${c.sessionId}:${c.playerUid}:${c.startedAt}`);
// Query only due pending/scheduled work, bounded to 50 jobs each minute. Completed history is never scanned.
export const recoverDueMovements=onSchedule({schedule:'every 1 minutes',timeZone:'Asia/Taipei'},async()=>{
  const due=await db.collectionGroup('movementTasks').where('status','in',['pending','scheduled']).where('retryAt','<=',Date.now()).limit(50).get();
  for(const job of due.docs){const {status,retryAt,...data}=job.data();
    try{const c=parseMovementCommand(data),result=await executeMovementCommand(db,c);
      if(result.status==='stale')await job.ref.update({status:'stale'});
    }catch(error){logger.error('movement_recovery_failed',{path:job.ref.path,code:error instanceof HttpsError?error.code:'internal'});}
  }
});

const warmTarget=()=>({project:process.env.GCLOUD_PROJECT||'',region:region.value(),services:warmServices.value().split(',').map(v=>v.trim()).filter(Boolean)});
// Warm the tap → result path as soon as a coach opens a room; players join a few minutes later.
export const warmOnRoomCreated=onDocumentCreated({document:'rooms/{roomId}'},async()=>{
  if(process.env.FUNCTIONS_EMULATOR==='true')return;
  await setWarmPool(db,warmTarget(),1);
});
// Scale back to zero 30 minutes after the last board activity; re-apply hourly in case a deploy reset it.
export const maintainWarmPool=onSchedule({schedule:'every 5 minutes',timeZone:'Asia/Taipei'},async()=>{
  if(process.env.FUNCTIONS_EMULATOR==='true')return;
  await setWarmPool(db,warmTarget(),await hasActiveRooms(db)?1:0);
});

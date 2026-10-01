import {doc,getDocFromServer,runTransaction,type Firestore,type Transaction as FirestoreTransaction} from 'firebase/firestore';
import type {GameState} from '../../types';
import {cleanObject} from '../../utils/utils';
import {runBoardTransactionWithRetry,isUnconfirmedTransactionError,withConfirmationDeadline,type BoardRoomSnapshot} from '../board/runBoardMutation';
import {writePrivateFinancialState,financialCommandRef} from './history';
export {financialRecordId,writePrivateFinancialState} from './history';
import {trackBoardStage} from '../../utils/telemetry';
import {runLockedBoardCommand} from '../board/commandLock';

export type FinancialCommandResult = {status:'applied'|'duplicate'|'requires_funding'|'waiting'|'failed';message?:string;code?:string;shortfall?:number;commandId?:string};
// One player document is the conflict boundary. Shared replies and board revisions are unrelated to personal banking.
const pending=new Map<string,Map<string,Promise<unknown>>>();
export const waitForPrivateFinance=(roomId:string,uid:string)=>Promise.allSettled([...(pending.get(`${roomId}:${uid}`)?.values() || [])]);
export const runPrivateFinancialCommand = <R extends BoardRoomSnapshot>(params:{db:Firestore;roomId:string;uid:string;commandId:string;sessionId?:string;
  apply:(state:GameState,room:R)=>FinancialCommandResult & {state?:GameState}}):Promise<FinancialCommandResult> => {
  const scope=`${params.roomId}:${params.uid}`;
  const commands=pending.get(scope)||new Map();pending.set(scope,commands);
  const operation=runLockedBoardCommand<FinancialCommandResult>(commands,params.commandId,async()=> {
    const startedAt=performance.now();let observedRoom:R|undefined,attempts=0,failureCode='',outcomeStatus='failed';
    trackBoardStage('requested',params.roomId,undefined,{command_id:params.commandId});
    try { const outcome=await runBoardTransactionWithRetry(()=>runTransaction(params.db,async transaction=>{
      attempts+=1;
      const [rs,ps]=await Promise.all([transaction.get(doc(params.db,'rooms',params.roomId)),transaction.get(doc(params.db,'rooms',params.roomId,'players',params.uid))]);
      if (!rs.exists() || !ps.exists()) return {status:'failed',code:'missing-data',message:'房間或玩家資料尚未同步，請重新連線'} as FinancialCommandResult;
      const room=rs.data() as R, state=ps.data() as GameState;observedRoom=room;
      if(room.flowSchemaVersion && room.flowSchemaVersion!==1)return {status:'failed',code:'unsupported-schema',message:'此房間需要更新遊戲版本，請重新載入'} as FinancialCommandResult;
      if(params.sessionId && room.sessionId!==params.sessionId) return {status:'failed',code:'stale-session',message:'目前場次已更新，原操作已過期'} as FinancialCommandResult;
      if (room.status!=='playing' || !room.members?.some(m=>m.uid===params.uid&&!m.isLeft)) return {status:'failed',code:'not-member',message:'目前帳號不是進行中房間的玩家'} as FinancialCommandResult;
      if (room.financialHistoryStorage==='subcollection') {
        const receipt=await transaction.get(financialCommandRef(params.db,params.roomId,params.uid,room.sessionId!,params.commandId));
        if(receipt.exists()) return {status:'duplicate'} as FinancialCommandResult;
      }
      if (state.appliedBoardFinancialEventIds?.includes(params.commandId)) return {status:'duplicate'} as FinancialCommandResult;
      const result=params.apply(state,room);
      if(result.status==='applied') {
        if(!result.state) throw new Error('交易沒有回傳入帳資料');
        writePrivateFinancialState(transaction,params.db,params.roomId,params.uid,state,result.state,room,params.commandId,{status:'applied'});
      }
      const {state:_,...outcome}=result;return outcome;
    }));outcomeStatus=outcome.status;return outcome; } catch(error:any) {
      failureCode=error?.code||'transaction-failed';
      if (isUnconfirmedTransactionError(error) || error?.code==='permission-denied') {
        const confirmed=await withConfirmationDeadline(async()=>{
          const roomSnapshot=await getDocFromServer(doc(params.db,'rooms',params.roomId));
          if(!roomSnapshot.exists())return false;
          const room=roomSnapshot.data() as R;
          if(params.sessionId && room.sessionId!==params.sessionId)return false;
          if(room.financialHistoryStorage==='subcollection' && room.sessionId) {
            return (await getDocFromServer(financialCommandRef(params.db,params.roomId,params.uid,room.sessionId,params.commandId))).exists();
          }
          const player=await getDocFromServer(doc(params.db,'rooms',params.roomId,'players',params.uid));
          return player.exists() && player.data().appliedBoardFinancialEventIds?.includes(params.commandId)===true;
        }).catch(()=>false);
        if(confirmed){outcomeStatus='duplicate';failureCode='';return {status:'duplicate'};}
        if(error?.code==='permission-denied')return {status:'failed',code:failureCode,message:'財務交易權限不足，請確認登入及房間資格'};
        outcomeStatus='waiting';
        return {status:'waiting',code:'waiting-confirmation',commandId:params.commandId,message:'交易結果等待確認，請保留目前選擇並沿用原操作安全重試'};
      }
      return {status:'failed',code:failureCode,message:error?.code==='permission-denied'?'財務交易權限不足，請確認登入及房間資格':error?.message||'交易尚未確認，請沿用原操作安全重試'};
    } finally {
      trackBoardStage('transaction_finished',params.roomId,observedRoom?.boardState || undefined,{command_id:params.commandId,result:outcomeStatus,error_code:failureCode,retry_count:Math.max(0,attempts-1),duration_ms:Math.round(performance.now()-startedAt)});
    }
  },()=>({status:'failed',code:'busy',message:'另一筆財務交易正在處理，請等待原交易確認'}));
  const release=()=>{if(commands.size===0 && pending.get(scope)===commands)pending.delete(scope);};
  void operation.then(release,release);
  return operation;
};

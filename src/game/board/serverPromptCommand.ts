import {GAME_CLIENT_PROTOCOL,getRoomCompatibilityError} from './roomCompatibility';
import {getApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {submitPersistentGameCommand,type PendingGameCommand} from './pendingCommand';
import type {Room} from '../../types';
import {cleanObject} from '../../utils/utils';
export type PromptCommandResult={status:'applied'|'duplicate'|'waiting'|'stale';eventId:string;revision?:number;retryAt?:number;reason?:string};
let client:ReturnType<typeof import('firebase/functions').getFunctions> | undefined;
export async function callServerGameCommand<T>(data:unknown):Promise<T> {
  const {getFunctions,connectFunctionsEmulator,httpsCallable}=await import('firebase/functions');
  if(!client){
    client=getFunctions(getApp(),import.meta.env.VITE_GAME_FUNCTION_REGION||'asia-southeast1');
    if(import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR==='true'){
      const endpoint=new URL(import.meta.env.VITE_FUNCTIONS_EMULATOR_URL||'http://127.0.0.1:5301');
      connectFunctionsEmulator(client,endpoint.hostname,Number(endpoint.port));
    }
  }
  // Match the persisted command: omitted optional fields must not become null in Callable encoding.
  return (await httpsCallable<unknown,T>(client,'gameCommand',{timeout:10000})(cleanObject({...data as object,clientProtocolVersion:GAME_CLIENT_PROTOCOL}))).data;
}

export function submitServerGameCommand<T>(data:unknown):Promise<T> {
  const uid=getAuth(getApp()).currentUser?.uid,command=data as PendingGameCommand;
  if(!uid)return Promise.reject(Object.assign(new Error('請先登入再提交操作'),{code:'functions/unauthenticated'}));
  if(!command?.roomId||!command.sessionId||!command.commandId||!command.type)return Promise.reject(new Error('操作缺少場次或命令識別'));
  return submitPersistentGameCommand<T>(localStorage,uid,command,callServerGameCommand);
}

export async function finalizeServerPrompt(room:Room,promptId:string):Promise<PromptCommandResult> {
  const compatibilityError=getRoomCompatibilityError(room);if(compatibilityError)throw new Error(compatibilityError);
  const eventId=room.boardState?.currentEvent?.id;
  if(!room.sessionId || !eventId)throw new Error('場次或事件不存在');
  return submitServerGameCommand({type:'finalizePrompt',roomId:room.id,sessionId:room.sessionId,eventId,promptId,commandId:`prompt:finalize:${room.sessionId}:${promptId}`});
}

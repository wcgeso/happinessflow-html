import {runLockedBoardCommand} from './commandLock';
import {reportClientRejection} from '../../utils/clientRejection';
export type PendingGameCommand={type:string;roomId:string;sessionId:string;commandId:string;[key:string]:unknown};
const scopeKey=(uid:string,roomId:string,sessionId:string)=>`hf-server-command:${uid}:${roomId}:${sessionId}`;
const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value;
export const gameCommandContents=(value:unknown)=>JSON.stringify(stable(value));
export const isUncertainGameCommandError=(error:any)=>['aborted','deadline-exceeded','unavailable','internal','unknown','cancelled'].includes(String(error?.code||'internal').replace(/^functions\//,''));
export const pendingCommandEvent='hf-server-command-changed';
const notify=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event(pendingCommandEvent));};
const inFlight=new Map<string,Map<string,Promise<unknown>>>();
export function readPendingGameCommand(storage:Storage,uid:string,roomId:string,sessionId:string):PendingGameCommand|null {
 const raw=storage.getItem(scopeKey(uid,roomId,sessionId));if(!raw)return null;
 let value;try{value=JSON.parse(raw);}catch{throw new Error('未確認操作資料無法讀取，請保留資料並核對紀錄');}
 if(!value||typeof value.type!=='string'||!value.type||value.roomId!==roomId||value.sessionId!==sessionId||typeof value.commandId!=='string'||!value.commandId)throw new Error('未確認操作識別資料不完整，請保留資料並核對紀錄');
 return value;
}
export async function confirmPendingGameCommand(storage:Storage,uid:string,roomId:string,sessionId:string,call:(data:unknown)=>Promise<any>) {
 const command=readPendingGameCommand(storage,uid,roomId,sessionId);if(!command)return null;
 const response=await call({type:'getCommandResult',roomId,sessionId,commandId:command.commandId});
 if(response?.status==='confirmed'&&response.result&&typeof response.result.status==='string'){
  // A late confirmation must never erase a newer command saved by another tab.
  const current=readPendingGameCommand(storage,uid,roomId,sessionId);
  if(current?.commandId===command.commandId){storage.removeItem(scopeKey(uid,roomId,sessionId));notify();}
  return {status:'confirmed',result:response.result};
 }
 return {status:'waiting',code:'not-confirmed',message:response?.message||'操作結果尚待確認，請保留原操作'};
}
export function submitPersistentGameCommand<T>(storage:Storage,uid:string,command:PendingGameCommand,call:(data:unknown)=>Promise<any>):Promise<T> {
 const scope=scopeKey(uid,command.roomId,command.sessionId),payload=gameCommandContents(command),commands=inFlight.get(scope)||new Map();inFlight.set(scope,commands);
 const existing=commands.get(command.commandId);
 // Check the saved content even when sharing an in-flight Promise.
 const old=readPendingGameCommand(storage,uid,command.roomId,command.sessionId);
 if(old?.commandId===command.commandId&&gameCommandContents(old)!==payload){reportClientRejection('content-changed',command.commandId);return Promise.reject(Object.assign(new Error('同一操作不能更改內容，請保留原選擇'),{code:'already-exists'}));}
 if(existing)return existing as Promise<T>;
 const operation=runLockedBoardCommand<T>(commands,command.commandId,async()=>{
  let prior=readPendingGameCommand(storage,uid,command.roomId,command.sessionId);
  if(prior){
   let confirmed;
   try{confirmed=await confirmPendingGameCommand(storage,uid,command.roomId,command.sessionId,call);}catch(error){throw Object.assign(new Error(`原操作尚未確認：${(error as Error).message}`),{code:'functions/deadline-exceeded'});}
   if(confirmed?.status==='confirmed') {if(prior.commandId===command.commandId)return confirmed.result;prior=null;}
   else if(prior.commandId!==command.commandId){
    // Resend the earlier command with its original ID and contents; the server de-duplicates by
    // commandId, so this either confirms it or applies it once. Only then continue with the new tap.
    let settled=false;
    try{const replay=await call(prior);settled=typeof replay?.status==='string'&&replay.status!=='waiting';}
    catch(error){settled=!isUncertainGameCommandError(error);/* A definite rejection means it never applied. */}
    if(!settled){reportClientRejection('pending-unconfirmed',command.commandId);throw Object.assign(new Error('上一筆操作尚待確認，請稍後再試'),{code:'busy'});}
    if(readPendingGameCommand(storage,uid,command.roomId,command.sessionId)?.commandId===prior.commandId){storage.removeItem(scope);notify();}
    prior=null;
   }
  }
  // Persist before submitting; a storage failure must stop the write.
  storage.setItem(scope,payload);notify();
  try{
   let result;
   for(let attempt=0;attempt<2;attempt++){
    try{result=await call(command);break;}catch(error){
     const code=String((error as any)?.code).replace(/^functions\//,'');if(code!=='aborted'||attempt===1)throw error;
     let confirmed;try{confirmed=await confirmPendingGameCommand(storage,uid,command.roomId,command.sessionId,call);}catch{throw error;}
     if(confirmed?.status==='confirmed')return confirmed.result;
     // Only an explicit transaction abort gets one retry, with the original ID and choices.
     await new Promise(resolve=>setTimeout(resolve,200+Math.random()*200));
    }
   }
   if(!result||typeof result.status!=='string')throw Object.assign(new Error('後端未回傳明確結果，保留原操作'),{code:'functions/internal'});
   if(readPendingGameCommand(storage,uid,command.roomId,command.sessionId)?.commandId===command.commandId){storage.removeItem(scope);notify();}
   return result;
  }catch(error){
   if(isUncertainGameCommandError(error)){
    try{const confirmed=await confirmPendingGameCommand(storage,uid,command.roomId,command.sessionId,call);if(confirmed?.status==='confirmed')return confirmed.result;}catch{/* Keep the original command when confirmation is unavailable. */}
   }else if(!prior&&readPendingGameCommand(storage,uid,command.roomId,command.sessionId)?.commandId===command.commandId){storage.removeItem(scope);notify();}
   throw error;
  }
 });
 const release=()=>{if(!commands.size&&inFlight.get(scope)===commands)inFlight.delete(scope);};void operation.then(release,release);return operation;
}

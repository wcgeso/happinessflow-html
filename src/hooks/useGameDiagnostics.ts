import {useEffect,useRef} from 'react';
import {doc,setDoc,serverTimestamp} from 'firebase/firestore';
import {db} from '../../services/firebase';
import {APP_VERSION,BUILD_ID,RULES_HASH} from '../constants/version';
import {recentBoardTelemetry,subscribeTelemetry} from '../utils/telemetry';
import {getSubscriptionHealth,subscribeSubscriptionHealth,type SubscriptionHealth} from '../utils/recoveringSnapshot';
import {clockMetadata} from '../utils/serverClock';
export const useGameDiagnostics=(input:{roomId?:string;sessionId?:string;uid?:string;surface:string;controller?:boolean})=>{
 const latest=useRef(input);latest.current=input;
 const client=useRef<string>('');
 if(!client.current)client.current=`${input.surface}_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
 useEffect(()=>{
  if(!input.roomId||!input.sessionId||!input.uid)return;
  let alive=true, writing=false,dirty=true,urgent=false,lastWrite=0,lastFailure='';
  const save=async(important=false)=>{
   if(!alive)return;
   dirty=true;urgent ||=important;
   if(writing || (!urgent&&Date.now()-lastWrite<10000))return;
   writing=true;dirty=false;urgent=false;lastWrite=Date.now();
   const state=latest.current,records=recentBoardTelemetry(input.roomId!);
   const last=records.at(-1)?.params || {};
   try { await setDoc(doc(db,'rooms',input.roomId!,'diagnostics',`${input.uid}_${client.current}`),{
    uid:input.uid,sessionId:input.sessionId,clientId:client.current,appVersion:APP_VERSION,buildId:BUILD_ID,rulesHash:RULES_HASH,
    flow:'board',screen:state.surface,activeModal:String(last.modal||last.phase||''),boardEventId:String(last.event_id||''),
    pendingAction:String(last.blocker||''),updatedAt:serverTimestamp(),controller:!!state.controller,
    records,subscriptions:(JSON.parse(getSubscriptionHealth()) as SubscriptionHealth[]).slice(-20),clock:clockMetadata(),
   }); } catch {dirty=true;} finally {writing=false;if(alive&&urgent)void save(true);}
  };
  const unsubscribe=subscribeTelemetry(record=>{
   if(record.params.room_id!==input.roomId)return;
   dirty=true;
   if(record.params.stage==='failed'||record.params.stage==='error'||record.params.result==='failed')void save(true);
  });
  const healthUnsubscribe=subscribeSubscriptionHealth(()=>{
   const failures=(JSON.parse(getSubscriptionHealth()) as SubscriptionHealth[]).filter(s=>s.status==='error');
   const fingerprint=JSON.stringify(failures);
   if(failures.length&&fingerprint!==lastFailure){lastFailure=fingerprint;void save(true);}
   if(!failures.length)lastFailure='';
   dirty=true;
  });
  void save();
  const interval=setInterval(()=>{if(dirty)void save();},10000);
  return()=>{alive=false;clearInterval(interval);unsubscribe();healthUnsubscribe();};
 },[input.roomId,input.sessionId,input.uid,input.surface]);
};

import {useEffect,useState,useCallback} from 'react';
import {collection,documentId,limit,orderBy,query,startAfter,where,type Firestore} from 'firebase/firestore';
import {observeSnapshots} from '../utils/recoveringSnapshot';
import {runPrivateFinancialCommand,waitForPrivateFinance} from '../game/finance/privateCommand';
import {applyPublicFinancialEffect,type PublicFinancialEffect} from '../game/finance/publicEffects';

// The persistent cursor owns progress. A failed effect stays ahead of the cursor until safely retried.
export const usePublicFinancialEffects = (params:{db:Firestore;roomId?:string;sessionId?:string;uid?:string;enabled:boolean;timestamp?:number;effectId?:string}) => {
  const [failure,setFailure]=useState<{code:string;message:string}|null>(null);
  const [generation,setGeneration]=useState(0);
  const retry=useCallback(()=>setGeneration(value=>value+1),[]);
  const {db,roomId,sessionId,uid,enabled,timestamp,effectId}=params;
  useEffect(()=>{
    setFailure(null);
    if(!enabled || !roomId || !sessionId || !uid)return;
    let alive=true,stopped=false;
    // Snapshot callbacks can overlap while a transaction is pending; serialize their application.
    let queue=Promise.resolve();
    const cursor=timestamp!==undefined && effectId ? [startAfter(timestamp,effectId)] : [];
    const effects=query(collection(db,'rooms',roomId,'financialEffects'),where('sessionId','==',sessionId),orderBy('timestamp'),orderBy(documentId()),...cursor,limit(100));
    const fail=(error:{code?:string;message?:string})=>{
      if(!alive)return;
      stopped=true;
      setFailure({code:error.code||'transaction-failed',message:error.message||'公共財務事件尚未確認'});
    };
    const unsubscribe=observeSnapshots('financial-effects')(effects,snapshot=>{
      queue=queue.then(async()=>{
        if(!alive || stopped)return;
        for(const record of snapshot.docs) {
          if(!alive || stopped)return;
          const effect=record.data() as PublicFinancialEffect;
          const submit=()=>runPrivateFinancialCommand({db,roomId,uid,sessionId,commandId:`public-effect:${record.id}`,apply:state=>({
            status:'applied',state:{...applyPublicFinancialEffect(state,effect,uid),lastPublicEffectTimestamp:effect.timestamp,lastPublicEffectId:record.id}
          })});
          let result=await submit();
          if(result.code==='busy') {await waitForPrivateFinance(roomId,uid);if(!alive)return;result=await submit();}
          if(!alive)return;
          if(result.status!=='applied' && result.status!=='duplicate'){fail(result);return;}
        }
      }).catch(fail);
    },fail);
    return()=>{alive=false;unsubscribe();};
  },[db,roomId,sessionId,uid,enabled,timestamp,effectId,generation]);
  return {failure,retry};
};

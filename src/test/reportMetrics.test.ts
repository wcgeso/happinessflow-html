import {it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

it('measures presentation only against the same device, event and revision, excluding designed animations',()=>{
 const temporary=mkdtempSync(join(tmpdir(),'hf-metrics-'));
 try{
  const file=join(temporary,'report.json');
  const record=(label:string,time:number,params:Record<string,unknown>)=>({event:'hf_board_timeline',label,monotonicMs:time,params:{event_id:'event',revision:1,...params}});
  writeFileSync(file,JSON.stringify({status:'passed',turns:[{syncMs:100}],telemetry:[
   record('p1',10,{stage:'received',from_cache:false}),
   record('p2',20,{stage:'presented'}),
   record('p1',25,{stage:'presented'}),
   record('p1',30,{stage:'transaction_finished',duration_ms:100}),
   record('p1',35,{stage:'presented',phase:'dice_animation'}),
  ]}));
  const output=JSON.parse(execFileSync(process.execPath,['scripts/e2e/summarize-board-report.mjs',file],{encoding:'utf8'}));
  expect(output.receivedToPresentation).toEqual({count:1,p50:15,p95:15,p99:15,max:15});
  expect(output.presentationEvidence).toMatchObject({unpaired:1,excludedAnimations:1});
  expect(output.commandConfirmation.p95).toBe(100);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});

it('retains write failures while classifying only empty Firestore channel termination responses',async()=>{
 const {isFirestoreTransportCleanup}=await import('../../scripts/e2e/firestoreTransport.mjs');
 const url='http://localhost:8480/google.firestore.v1.Firestore/Write/channel?TYPE=terminate&SID=original';
 expect(isFirestoreTransportCleanup(url,400,'')).toBe(true);
 for(const [request,status,body] of [[url,403,''],[url,400,'PERMISSION_DENIED'],[url.replace('terminate','xmlhttp'),400,''],[url.replace('localhost','example.com'),400,''],['invalid',400,'']])
  expect(isFirestoreTransportCleanup(request,status,body)).toBe(false);
});

import {readFileSync,writeFileSync} from 'node:fs';

const [input,output]=process.argv.slice(2);
if(!input)throw new Error('Usage: node scripts/e2e/summarize-board-report.mjs report.json [summary.json]');
const report=JSON.parse(readFileSync(input,'utf8'));
const distribution=values=>{
 const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
 const percentile=p=>sorted.length?Math.round(sorted[Math.ceil(sorted.length*p)-1]*100)/100:null;
 return {count:sorted.length,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:sorted.at(-1)??null};
};
const commandTimes=[],renderTimes=[],received=new Map(),lastClock=new Map();
let unpaired=0,excludedAnimations=0,reloadBoundaries=0;
for(const row of report.telemetry || []){
 const p=row.params || {},time=row.monotonicMs,label=row.label;
 if(row.event!=='hf_board_timeline' || !Number.isFinite(time) || !label)continue;
 if(time<(lastClock.get(label)??-Infinity)){
  for(const key of received.keys())if(key.startsWith(`${label}:`))received.delete(key);
  reloadBoundaries++;
 }
 lastClock.set(label,time);
 if(p.stage==='transaction_finished' && Number.isFinite(p.duration_ms))commandTimes.push(p.duration_ms);
 if(!p.event_id)continue;
 const key=`${label}:${p.event_id}:${p.revision}`;
 if(p.stage==='received' && p.from_cache!==true && p.pending_writes!==true && !received.has(key))received.set(key,time);
 if(p.stage==='presented'){
  if(['movement','dice_animation','dice_result'].includes(p.phase)){excludedAnimations++;continue;}
  const started=received.get(key);
  if(started===undefined || time<started){unpaired++;continue;}
  renderTimes.push(time-started);received.delete(key);
 }
}
const summary={source:input,status:report.status,turnsCompleted:report.turns?.length || 0,
 units:'milliseconds',basis:'same-device monotonic clock; matching event ID and revision; cached/local-write snapshots excluded',
 commandConfirmation:distribution(commandTimes),receivedToPresentation:distribution(renderTimes),
 presentationEvidence:{unpaired,excludedAnimations,reloadBoundaries},
 turnSync:distribution((report.turns || []).map(row=>row.syncMs)),
 sharedCompletion:distribution((report.turns || []).map(row=>row.sharedCompletionMs)),
 errors:report.errors || [],retryableErrors:report.retryableErrors || [],
 limits:['These are local emulator measurements, not mobile or production acceptance.',
 'Unpaired presentations are missing evidence; they are not assumed instantaneous.',
 'No cross-device wall-clock subtraction or bounded clock error is inferred.']};
if(output)writeFileSync(output,JSON.stringify(summary,null,2));
process.stdout.write(JSON.stringify(summary,null,2)+'\n');

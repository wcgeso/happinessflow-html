import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {executeAdminScoreCommand,parseAdminScoreCommand} from '../src/adminScore';
async function main(){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');initializeApp({projectId:process.env.GCLOUD_PROJECT});const db=getFirestore(),target=db.doc('users/admin-score-pilot');
 const input={type:'adminSetScore',roomId:'score-admin',sessionId:'score-admin',commandId:'original',targetUid:target.id,score:100,expectedExperience:7,expectedRankScore:9};
 for(const patch of [{score:-1},{score:1.5},{score:Number.MAX_SAFE_INTEGER+1},{expectedRankScore:'9'},{targetUid:'../bad'},{roomId:'123456'},{role:'gm'}])assert.throws(()=>parseAdminScoreCommand({...input,...patch}),{code:'invalid-argument'});
 const command=parseAdminScoreCommand(input);await target.set({experience:7,rankScore:9,cash:42,role:'player'});
 await assert.rejects(executeAdminScoreCommand(db,command,'fake',false),{code:'permission-denied'});assert.equal((await target.get()).data()!.experience,7);
 const results=await Promise.all(Array.from({length:6},()=>executeAdminScoreCommand(db,command,'signed-admin',true)));assert.equal(results.filter(r=>r.status==='applied').length,1);assert.equal(results.filter(r=>r.status==='duplicate').length,5);
 assert.deepEqual((await target.get()).data(),{experience:100,rankScore:100,cash:42,role:'player'});
 await assert.rejects(executeAdminScoreCommand(db,{...command,score:200},'signed-admin',true),{code:'already-exists'});
 await target.update({experience:110,rankScore:110});assert.equal((await executeAdminScoreCommand(db,command,'signed-admin',true)).status,'duplicate');assert.equal((await target.get()).data()!.experience,110);
 const stale={...command,commandId:'stale'};assert.equal((await executeAdminScoreCommand(db,stale,'signed-admin',true)).status,'rejected');await target.update({experience:7,rankScore:9});assert.equal((await executeAdminScoreCommand(db,stale,'signed-admin',true)).status,'rejected');assert.equal((await target.get()).data()!.experience,7);const rejected:any=await executeAdminScoreCommand(db,{type:'getAdminScoreResult',roomId:'score-admin',sessionId:'score-admin',commandId:'stale'},'signed-admin',true);assert.equal(rejected.result.code,'failed-precondition');
 const query=parseAdminScoreCommand({type:'getAdminScoreResult',roomId:'score-admin',sessionId:'score-admin',commandId:'original'});const saved:any=await executeAdminScoreCommand(db,query,'signed-admin',true);assert.equal(saved.status,'confirmed');assert.equal(saved.result.experience,100);assert.equal((await executeAdminScoreCommand(db,query,'other-admin',true)).status,'waiting');
 await assert.rejects(executeAdminScoreCommand(db,{...command,commandId:'missing',targetUid:'missing-admin-score'},'signed-admin',true),{code:'not-found'});
 console.log('PASS admin score strict inputs, signed authority, six-way atomic audit, stale score refusal, durable replay and private result');await target.delete();await db.terminate();
}main().catch(error=>{console.error(error);process.exit(1)});

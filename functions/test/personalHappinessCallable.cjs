const assert=require('node:assert/strict');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
async function main(){
 const projectId='demo-happinessflow-backend';assert.equal(process.env.GCLOUD_PROJECT,projectId);assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9399');initializeApp({projectId});const db=getFirestore();
 const auth=await (await fetch('http://127.0.0.1:9399/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})})).json();assert.ok(auth.idToken);
 const ref=db.doc('rooms/personal-happiness-callable'),player=ref.collection('players').doc(auth.localId);await db.recursiveDelete(ref);
 await ref.set({id:ref.id,hostId:'coach',sessionId:'s',status:'playing',bankingAuthority:'server-banking-v1',syncSchemaVersion:2,flowSchemaVersion:1,financialHistoryStorage:'subcollection',members:[{uid:auth.localId},{uid:'coach'}],boardState:{revision:7,currentTurnUid:'coach',currentEvent:{id:'other-event',type:'card',playerUid:'coach'}}});
 await player.set({isSetup:true,cash:10000,assets:[],liabilities:[],history:[],income:{},expenses:{basicLiving:0,transportEdu:0,otherMedicalChild:0},happiness:[{id:'protected',points:30,checked:false,readOnly:true,label:'流程管理'}],happinessTotal:0});
 const post=async data=>{const r=await fetch(`http://127.0.0.1:5301/${projectId}/asia-east1/gameCommand`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.idToken}`},body:JSON.stringify({data})});return {status:r.status,body:await r.json()};};
 const c={type:'personalHappiness',roomId:ref.id,sessionId:'s',commandId:'add',action:'add',label:'手動項目',points:2};
 assert.equal((await post({...c,uid:'coach'})).status,400);assert.equal((await post({...c,points:-1})).status,400);assert.equal((await post({type:c.type,roomId:ref.id,sessionId:'s',commandId:'protected-toggle',action:'toggle',itemId:'protected',checked:true})).status,403);
 const adds=await Promise.all([post(c),post(c)]);assert.deepEqual(adds.map(r=>r.body.result.status).sort(),['applied','duplicate']);const state=(await player.get()).data();assert.equal(state.happinessTotal,2);assert.equal(state.happiness.length,2);assert.equal(state.cash,10000);assert.equal((await ref.get()).data().boardState.revision,7);
 const item=state.happiness.find(h=>h.isCustom),toggle={type:c.type,roomId:ref.id,sessionId:'s',commandId:'toggle',action:'toggle',itemId:item.id,checked:false};assert.equal((await post(toggle)).body.result.status,'applied');assert.equal((await post(c)).body.result.status,'duplicate');assert.equal((await player.get()).data().happinessTotal,0);
 assert.equal((await post({type:'getCommandResult',roomId:ref.id,sessionId:'s',commandId:'add'})).body.result.status,'confirmed');
 console.log('PASS own happiness Auth/Callable: readonly protection, concurrent add, durable replay, unchanged cash and board');await db.recursiveDelete(ref);await db.terminate();
}
main().catch(e=>{console.error(e);process.exit(1)});

const assert=require('node:assert/strict');
assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9399');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');const {getFirestore}=require('firebase-admin/firestore');
initializeApp({projectId:process.env.GCLOUD_PROJECT});
async function main(){
 const auth=getAuth(),db=getFirestore();
 for(const role of ['host','p1','p2','p3','p4','p5','p6']){
  const uid=`browser-${role}`,email=`pilot-${role}@example.test`;
  try{await auth.getUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;await auth.createUser({uid,email,password:'DemoPlayer2026!',displayName:role==='host'?'模擬執行師':`模擬玩家${role.slice(1)}`});}
  if(role==='host')await auth.setCustomUserClaims(uid,{gameHost:true});
  const profile=db.doc(`users/${uid}`);if(!(await profile.get()).exists)await profile.set({uid,email,name:role==='host'?'模擬執行師':`模擬玩家${role.slice(1)}`,role:role==='host'?'coach':'player',photoURL:'bee',experience:0,rankScore:0,photoPromotionConsent:{choice:'declined',documentVersion:'2026-09-07-v1'}});
  console.log(uid,email);
 }
 await db.terminate();
}main().catch(error=>{console.error(error);process.exit(1);});

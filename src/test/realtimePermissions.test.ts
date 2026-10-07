import {afterAll,beforeEach,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {get,ref,set} from 'firebase/database';
let env:RulesTestEnvironment;
const run=process.env.FIREBASE_DATABASE_EMULATOR_HOST?it:it.skip;
beforeEach(async()=>{
 if(!process.env.FIREBASE_DATABASE_EMULATOR_HOST)return;
 if(!env)env=await initializeTestEnvironment({projectId:'demo-happinessflow-rtdb',database:{rules:readFileSync('database.rules.json','utf8')}});
 await env.clearDatabase();
});
afterAll(async()=>{if(env)await env.cleanup();});
run('allows own controller lease and rejects another player or a forged client id',async()=>{
 const db=env.authenticatedContext('self').database();
 await assertSucceeds(set(ref(db,'roomControllers/room/self/tab'),{clientId:'tab',claimedAt:1,lastSeenAt:2}));
 await assertFails(set(ref(db,'roomControllers/room/other/tab'),{clientId:'tab',claimedAt:1,lastSeenAt:2}));
 await assertFails(set(ref(db,'roomControllers/room/self/tab'),{clientId:'forged',claimedAt:1,lastSeenAt:2}));
 await assertSucceeds(set(ref(db,'roomControllers/room/self/tab'),null));
});
run('reads presence per player and rejects anonymous or cross-player writes',async()=>{
 const db=env.authenticatedContext('self').database();
 await assertSucceeds(set(ref(db,'roomLastOnline/room/self'),123));
 await assertSucceeds(get(ref(db,'roomLastOnline/room/self')));
 await assertFails(get(ref(db,'roomLastOnline/room')));
 await assertFails(set(ref(db,'roomLastOnline/room/other'),123));
 await assertFails(get(ref(env.unauthenticatedContext().database(),'roomLastOnline/room/self')));
});
run('validates connection ownership and status, rejects anonymous access and preserves own disconnect deletion',async()=>{
 const db=env.authenticatedContext('self').database(),path='roomConnections/room/self/tab';
 const valid={uid:'self',sessionId:'session',status:'online',lastSeenAt:123};
 await assertSucceeds(set(ref(db,path),valid));
 await assertSucceeds(get(ref(db,'roomConnections/room')));
 await assertFails(set(ref(db,path),{...valid,uid:'other'}));
 await assertFails(set(ref(db,path),{...valid,status:'unknown'}));
 await assertFails(set(ref(db,'roomConnections/room/other/tab'),{...valid,uid:'other'}));
 await assertFails(get(ref(env.unauthenticatedContext().database(),'roomConnections/room')));
 await assertSucceeds(set(ref(db,path),null));
});
run('validates diagnostic identity and timestamp, with own updates/deletion and cross-player rejection',async()=>{
 const db=env.authenticatedContext('self').database(),path='roomDiagnostics/room/self/tab';
 const valid={uid:'self',updatedAt:123,sessionId:'session'};
 await assertSucceeds(set(ref(db,path),valid));
 await assertSucceeds(set(ref(db,path),{...valid,updatedAt:124}));
 await assertFails(set(ref(db,path),{...valid,uid:'other'}));
 await assertFails(set(ref(db,path),{...valid,updatedAt:'now'}));
 await assertFails(set(ref(db,'roomDiagnostics/room/other/tab'),{...valid,uid:'other'}));
 await assertSucceeds(get(ref(db,path)));
 await assertFails(get(ref(env.unauthenticatedContext().database(),path)));
 await assertSucceeds(set(ref(db,path),null));
});
run('rejects malformed controller claims and authenticated writes outside the approved collections',async()=>{
 const db=env.authenticatedContext('self').database(),path='roomControllers/room/self/tab';
 await assertFails(set(ref(db,path),{clientId:'tab',claimedAt:'now',lastSeenAt:2}));
 await assertFails(set(ref(db,path),{clientId:'tab',claimedAt:1,lastSeenAt:'now'}));
 await assertFails(set(ref(db,'roomLastOnline/room/self'),'now'));
 await assertFails(set(ref(db,'unknown/self'),{value:true}));
 await assertFails(get(ref(db,'unknown/self')));
});

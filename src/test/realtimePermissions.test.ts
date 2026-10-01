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

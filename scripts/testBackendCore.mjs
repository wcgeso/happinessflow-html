import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
assert.equal(process.env.GCLOUD_PROJECT,'demo-happinessflow-backend');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8482');
const tests=['adminScore','coachBoard','commands','commandResult','banking','personalBanking','realEstate','happinessCard','personalHappiness','coachAdjustment','coachMarket','assetIdentifiers','medicalCard','opportunityCard','movement','family','learning','story','followup','shared','serviceEvent','reveal','playerSetup','roomStart','roomCreate','roomMembership','roomLifecycle','warmPool'];
for(const name of tests){
 console.log(`RUN backend core: ${name}`);
 execFileSync(process.execPath,['functions/test/build.mjs',name],{stdio:'inherit'});
 execFileSync(process.execPath,[`functions/lib/${name==='commands'?'test':name+'-test'}.cjs`],{stdio:'inherit'});
}
console.log(`PASS ${tests.length} backend core suites (Firestore only)`);

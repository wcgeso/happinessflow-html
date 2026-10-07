// The Firebase Emulator Suite does not automatically dispatch Cloud Tasks or Scheduler jobs.
// Reuse the deployed handlers against the demo emulator; never enqueue cloud work here.
const project = process.env.GCLOUD_PROJECT;
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!project?.startsWith('demo-') || !/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) {
  throw new Error('Task runner requires a demo project and a loopback Firestore emulator');
}
process.env.FUNCTIONS_EMULATOR = 'true';
const { createRequire } = require('node:module');
const functionsRequire = createRequire(require('node:path').resolve(__dirname, '../functions/package.json'));
const handlers = require('../functions/lib/index.cjs');
const db = functionsRequire('firebase-admin/firestore').getFirestore();
async function tick() {
  await handlers.recoverDueMovements.run({});
  const jobs = await db.collectionGroup('promptFinalizationTasks')
    .where('status', 'in', ['pending', 'scheduled']).where('retryAt', '<=', Date.now()).limit(50).get();
  for (const job of jobs.docs) {
    try { await handlers.retryPromptFinalization.run({ data: job.data() }); }
    catch (error) { console.error('emulator_prompt_task_failed', job.ref.path, error.message); }
  }
}
async function main() {
  console.log(`Local task runner: ${project} at ${host}`);
  do {
    await tick();
    if (process.argv.includes('--once')) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (true);
  await db.terminate();
}
main().catch(error => { console.error(error); process.exitCode = 1; });

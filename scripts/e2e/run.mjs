// Orchestrates the full local board-multiplayer E2E run:
//   1. start the Auth + Firestore emulators (project must match the app's
//      default client-side projectId, see adminClient.mjs PROJECT_ID)
//   2. wait for both emulator ports to accept connections
//   3. seed the 4 fixed local test accounts
//   4. run `playwright test` (which itself starts `npm run dev` against the
//      emulator via playwright.config.ts webServer)
//   5. always shut the emulators down afterwards, regardless of test outcome
//
// Usage: node scripts/e2e/run.mjs [-- <extra playwright test args>]

import { spawn } from 'node:child_process';
import net from 'node:net';
import { PROJECT_ID } from './adminClient.mjs';

const FIRESTORE_HOST = 'localhost:8080';
const AUTH_HOST = 'localhost:9099';

const waitForPort = (host, port, timeoutMs = 60_000) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
    child.on('error', reject);
  });

const extraArgs = process.argv.slice(2);

const emulatorEnv = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: FIRESTORE_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST,
};

console.log('[e2e/run] Starting Firebase emulators...');
const emulator = spawn(
  'npx',
  ['firebase', 'emulators:start', '--project', PROJECT_ID, '--only', 'auth,firestore'],
  { stdio: 'inherit' }
);

let exitCode = 0;
try {
  await waitForPort('localhost', 8080);
  await waitForPort('localhost', 9099);
  console.log('[e2e/run] Emulators ready. Seeding accounts...');
  await run('node', ['scripts/e2e/seedAccounts.mjs'], { env: emulatorEnv });

  console.log('[e2e/run] Running Playwright...');
  await run('npx', ['playwright', 'test', ...extraArgs], { env: emulatorEnv });
} catch (err) {
  console.error('[e2e/run] Failed:', err.message);
  exitCode = 1;
} finally {
  console.log('[e2e/run] Shutting down emulators...');
  emulator.kill('SIGINT');
}

process.exit(exitCode);

// Orchestrates the full local board-multiplayer E2E run:
//   1. start the Auth + Firestore + Realtime Database emulators (project must match the app's
//      default client-side projectId, see adminClient.mjs PROJECT_ID)
//   2. wait for both emulator ports to accept connections
//   3. seed the fixed local test accounts (1 coach + 6 players)
//   4. run `playwright test` (which itself starts `npm run dev` against the
//      emulator via playwright.config.ts webServer)
//   5. always shut the emulators down afterwards, regardless of test outcome
//
// Usage: node scripts/e2e/run.mjs [-- <extra playwright test args>]

import { spawn } from 'node:child_process';
import net from 'node:net';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_ID } from './adminClient.mjs';

const canListen = (port, host) => new Promise((resolve) => {
  const server = net.createServer();
  server.once('error', () => resolve(false));
  server.once('listening', () => server.close(() => resolve(true)));
  server.listen(port, host);
});

const isPortAvailable = async (port) =>
  await canListen(port, '127.0.0.1') && await canListen(port, '::1') &&
  await canListen(port, '0.0.0.0') && await canListen(port, '::');

const findAvailablePort = async (preferredPort) => {
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available emulator port near ${preferredPort}`);
};

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

let activeCommand;
const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', detached: process.platform !== 'win32', ...options });
    activeCommand = child;
    child.on('exit', (code) => {
      if (activeCommand === child) activeCommand = undefined;
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
    child.on('error', reject);
  });

const extraArgs = process.argv.slice(2);
// E2E_SERVER_MODE=true runs the same backend-authority path as production: Functions emulator,
// VITE_SERVER_GAME_ROOMS and the local Cloud Tasks/Scheduler runner. Requires a demo- project, e.g.
//   E2E_SERVER_MODE=true FIREBASE_PROJECT_ID=demo-happinessflow-backend node scripts/e2e/run.mjs
const serverMode = process.env.E2E_SERVER_MODE === 'true';
if (serverMode && !PROJECT_ID.startsWith('demo-')) throw new Error('E2E_SERVER_MODE requires FIREBASE_PROJECT_ID=demo-...');
const firestorePort = await findAvailablePort(Number(process.env.E2E_FIRESTORE_PORT || 8080));
const authPort = await findAvailablePort(Number(process.env.E2E_AUTH_PORT || 9099));
const databasePort = await findAvailablePort(Number(process.env.E2E_DATABASE_PORT || 9000));
const uiPort = await findAvailablePort(Number(process.env.E2E_UI_PORT || 4000));
const hubPort = await findAvailablePort(Number(process.env.E2E_HUB_PORT || uiPort + 100));
const loggingPort = await findAvailablePort(Number(process.env.E2E_LOGGING_PORT || uiPort + 200));
const functionsPort = serverMode ? await findAvailablePort(Number(process.env.E2E_FUNCTIONS_PORT || 5001)) : 0;
const firestoreHost = `localhost:${firestorePort}`;
const authHost = `localhost:${authPort}`;
const databaseHost = `localhost:${databasePort}`;
const configSource = JSON.parse(readFileSync(fileURLToPath(new URL('../../firebase.json', import.meta.url)), 'utf8'));
configSource.emulators.firestore.port = firestorePort;
configSource.emulators.firestore.websocketPort = await findAvailablePort(Number(process.env.E2E_FIRESTORE_WS_PORT || 9150));
configSource.emulators.auth.port = authPort;
configSource.emulators.database.port = databasePort;
configSource.emulators.ui.port = uiPort;
configSource.emulators.hub = {host: '127.0.0.1', port: hubPort};
configSource.emulators.logging = {host: '127.0.0.1', port: loggingPort};
if (serverMode) configSource.emulators.functions = {host: '127.0.0.1', port: functionsPort};

configSource.firestore.rules = fileURLToPath(new URL('../../firestore.rules', import.meta.url));
configSource.database.rules = fileURLToPath(new URL('../../database.rules.json', import.meta.url));
const temporaryConfigPath = join(tmpdir(), `happinessflow-e2e-${process.pid}.json`);
// firebase.json paths resolve against the config file's directory, so point back at this repo.
configSource.functions.source = relative(dirname(temporaryConfigPath), fileURLToPath(new URL('../../functions', import.meta.url)));
writeFileSync(temporaryConfigPath, JSON.stringify(configSource));

const emulatorEnv = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: firestoreHost,
  FIREBASE_AUTH_EMULATOR_HOST: authHost,
  VITE_USE_EMULATOR: 'true',
  VITE_FIRESTORE_EMULATOR_URL: `http://${firestoreHost}`,
  VITE_AUTH_EMULATOR_URL: `http://${authHost}`,
  VITE_REALTIME_DATABASE_EMULATOR_URL: `http://${databaseHost}`,
  FIREBASE_PROJECT_ID: PROJECT_ID,
  ...(serverMode ? {
    GCLOUD_PROJECT: PROJECT_ID,
    VITE_FIREBASE_PROJECT_ID: PROJECT_ID,
    VITE_SERVER_GAME_ROOMS: 'true',
    VITE_FUNCTIONS_EMULATOR_URL: `http://127.0.0.1:${functionsPort}`,
  } : {}),
};

console.log(`[e2e/run] Starting Firebase emulators on Firestore ${firestoreHost}, Auth ${authHost}, RTDB ${databaseHost}...`);
if (serverMode) {
  // `emulators:start` prompts for unset params, which blocks function loading; pin them for the demo project.
  writeFileSync(fileURLToPath(new URL(`../../functions/.env.${PROJECT_ID}`, import.meta.url)),
    'GAME_FUNCTION_REGION=asia-east1\nWARM_SERVICES=gamecommand,enqueuemovementsettlement,settlemovementtask,onpromptresponse\n');
  console.log('[e2e/run] Building functions for server mode...');
  await run('npm', ['--prefix', 'functions', 'run', 'build']);
}
const emulator = spawn(
  'npx',
  ['firebase', 'emulators:start', '--config', temporaryConfigPath, '--project', PROJECT_ID, '--only', serverMode ? 'auth,firestore,database,functions' : 'auth,firestore,database'],
  { stdio: 'inherit', detached: process.platform !== 'win32', env: {...process.env,JAVA_TOOL_OPTIONS:process.env.JAVA_TOOL_OPTIONS || '-Xmx4g'} }
);
const emulatorExited = () => new Promise((resolve) => {
  if (emulator.exitCode !== null || emulator.signalCode !== null) return resolve(true);
  const timer = setTimeout(() => { emulator.off('exit', onExit); resolve(false); }, 10_000);
  const onExit = () => { clearTimeout(timer); resolve(true); };
  emulator.once('exit', onExit);
});
const signalEmulator = (signal) => {
  try {
    if (process.platform === 'win32') emulator.kill(signal);
    else if (emulator.pid) process.kill(-emulator.pid, signal);
  } catch {}
};

let exitCode = 0;
let taskRunner;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  exitCode = 130;
  signalEmulator(signal);
  if (activeCommand?.pid) {
    try {
      if (process.platform === 'win32') activeCommand.kill(signal);
      else process.kill(-activeCommand.pid, signal);
    } catch {}
  }
});
try {
  await waitForPort('localhost', firestorePort);
  await waitForPort('localhost', authPort);
  await waitForPort('localhost', databasePort);
  if (serverMode) await waitForPort('127.0.0.1', functionsPort, 120_000);
  console.log('[e2e/run] Emulators ready. Seeding accounts...');
  await run('node', ['scripts/e2e/seedAccounts.mjs'], { env: emulatorEnv });

  if (serverMode) {
    // The emulator suite does not dispatch Cloud Tasks or Scheduler jobs; run the deployed handlers locally.
    taskRunner = spawn('node', ['scripts/runEmulatorTasks.cjs'], { stdio: 'inherit', detached: process.platform !== 'win32',
      env: { ...emulatorEnv, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${firestorePort}` } });
  }
  console.log('[e2e/run] Running Playwright...');
  await run('npx', ['playwright', 'test', ...extraArgs], { env: emulatorEnv });
} catch (err) {
  console.error('[e2e/run] Failed:', err.message);
  if (!exitCode) exitCode = 1;
} finally {
  if (taskRunner?.pid) { try { process.kill(process.platform === 'win32' ? taskRunner.pid : -taskRunner.pid, 'SIGTERM'); } catch {} }
  console.log('[e2e/run] Shutting down emulators...');
  signalEmulator('SIGINT');
  if (!await emulatorExited()) {
    signalEmulator('SIGTERM');
    if (!await emulatorExited()) signalEmulator('SIGKILL');
  }
  // Firebase CLI may exit before its Java child; signal the owned process group after shutdown.
  if (process.platform !== 'win32') signalEmulator('SIGTERM');
  try { unlinkSync(temporaryConfigPath); } catch {}
}

process.exit(exitCode);

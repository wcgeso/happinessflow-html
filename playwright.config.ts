import { defineConfig, devices } from 'playwright/test';

const serverPort = Number(process.env.E2E_SERVER_PORT || 5183);
const runId = process.env.E2E_RUN_ID || 'default';
// Long runs keep telemetry and failure screenshots without unbounded trace/video archives.
const recordArtifacts = process.env.E2E_NO_ARTIFACTS !== 'true' && Number(process.env.E2E_TURNS || 0) <= 100;

// Local-only board-multiplayer acceptance suite. Requires the Firebase Auth
// + Firestore emulators to already be running (see `npm run e2e`, which
// orchestrates emulator start/seed/teardown around `playwright test`).
export default defineConfig({
  testDir: './e2e',
  outputDir: `test-results/${runId}`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: `e2e/report/${runId}-results.json` }],
    ['html', { outputFolder: `playwright-report/${runId}`, open: 'never' }],
  ],
  use: {
    // 任何單一步驟卡住都要盡快失敗，不能讓整個測試無限等待。
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    baseURL: `http://localhost:${serverPort}`,
    trace: recordArtifacts ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
    video: recordArtifacts ? 'retain-on-failure' : 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Emulator mode is intentionally DEV-only in services/firebase.ts. Keep
    // this server in Vite DEV mode so the E2E process uses its isolated
    // Auth/Firestore/RTDB emulators instead of the cloud project.
    command: `npm run dev -- --host 127.0.0.1 --port ${serverPort} --strictPort`,
    url: `http://localhost:${serverPort}`,
    // Always use the server started for this emulator run. Reusing an older
    // preview can silently point the browser at a stale Firebase endpoint.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

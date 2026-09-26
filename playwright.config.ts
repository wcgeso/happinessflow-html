import { defineConfig, devices } from 'playwright/test';

// Local-only board-multiplayer acceptance suite. Requires the Firebase Auth
// + Firestore emulators to already be running (see `npm run e2e`, which
// orchestrates emulator start/seed/teardown around `playwright test`).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/report/results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    // 任何單一步驟卡住都要盡快失敗，不能讓整個測試無限等待。
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    baseURL: 'http://localhost:5183',
    trace: process.env.E2E_NO_ARTIFACTS === 'true' ? 'off' : 'retain-on-failure',
    screenshot: process.env.E2E_NO_ARTIFACTS === 'true' ? 'off' : 'only-on-failure',
    video: process.env.E2E_NO_ARTIFACTS === 'true' ? 'off' : 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Emulator mode is intentionally DEV-only in services/firebase.ts. Keep
    // this server in Vite DEV mode so the E2E process uses its isolated
    // Auth/Firestore/RTDB emulators instead of the cloud project.
    command: 'npm run dev -- --host 127.0.0.1 --port 5183 --strictPort',
    url: 'http://localhost:5183',
    // Always use the server started for this emulator run. Reusing an older
    // preview can silently point the browser at a stale Firebase endpoint.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

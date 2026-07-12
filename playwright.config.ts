import { defineConfig, devices } from '@playwright/test';

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
    baseURL: 'http://localhost:5183',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Uses a production preview build rather than the dev server: with 5
    // concurrent browser contexts (coach/display/3 players) hammering the
    // dev server's on-demand module transform, Vite intermittently returns
    // 400s for chunk requests and silently drops a player's state update.
    // The prebuilt static preview server has no such per-request transform
    // race.
    command: 'npx vite build --mode e2e && npx vite preview --port 5183 --strictPort',
    url: 'http://localhost:5183',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

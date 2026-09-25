import { defineConfig, devices } from 'playwright/test';

// Production run of the board stress suite (E2E_TARGET=prod). No local web
// server: the browsers open the deployed site, and the spec reads the test
// room through the Firebase CLI login (see scripts/e2e/prodAdmin.mjs).
export default defineConfig({
  testDir: './e2e',
  testMatch: /board-50-turn-stress\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: 'e2e/report/results-prod.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://2ife.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

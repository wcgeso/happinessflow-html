import { test, expect } from '@playwright/test';

// Sanity check for the E2E pipeline itself (emulator + seeded accounts + dev
// server all wired together) before any real board-multiplayer flow specs
// are layered on top.
test('app boots against the emulator-backed dev server', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});

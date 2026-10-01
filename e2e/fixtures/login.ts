import type { Page } from 'playwright/test';

export const completePhotoConsentIfNeeded = async (page: Page) => {
  const dialog = page.getByRole('dialog', { name: '照片與遊戲畫面使用同意' });
  try {
    await dialog.waitFor({ state: 'visible', timeout: 30_000 });
  } catch {
    return;
  }

  await dialog.getByText('不同意', { exact: true }).click();
  await dialog.getByRole('button', { name: '確認選擇', exact: true }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
};

export const login = async (page: Page, email: string, password: string, path = '/') => {
  await page.goto(path);
  await page.locator('form input[autocomplete="email"]').fill(email);
  await page.locator('form input[type="password"]').fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await page.getByRole('button', { name: '登入', exact: true }).waitFor({ state: 'detached' });
  await completePhotoConsentIfNeeded(page);
};

// Coach accounts default to the player-facing lobby (`lobbyViewMode` state in
// src/App.tsx starts at 'player' regardless of the account's Firestore role).
// A coach must open the floating identity switcher (bottom-right circular
// button) and pick "執行師模式" to reach the CoachDashboard.
export const switchToCoachMode = async (page: Page) => {
  // The trigger button has no accessible name (icon-only); it's the sole
  // button inside the `fixed bottom-6 right-6` wrapper in src/App.tsx.
  const trigger = page.locator('.fixed.bottom-6.right-6 > button');
  const consent = page.getByRole('dialog', { name: '照片與遊戲畫面使用同意' });
  await trigger.or(consent).first().waitFor({ state: 'visible', timeout: 30_000 });
  if (await consent.isVisible()) await completePhotoConsentIfNeeded(page);
  await trigger.click();
  await page.getByRole('button', { name: '執行師模式' }).click();
};

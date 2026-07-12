import type { Page } from '@playwright/test';

// AuthView's email/password inputs are both plain <input type="text">
// (no `type="password"`, no id/htmlFor linking them to their labels), so we
// locate them positionally within the login form. See src/views/auth/AuthView.tsx.
export const login = async (page: Page, email: string, password: string) => {
  await page.goto('/');
  const inputs = page.locator('form input[type="text"]');
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
};

// Coach accounts default to the player-facing lobby (`lobbyViewMode` state in
// src/App.tsx starts at 'player' regardless of the account's Firestore role).
// A coach must open the floating identity switcher (bottom-right circular
// button) and pick "執行師模式" to reach the CoachDashboard.
export const switchToCoachMode = async (page: Page) => {
  // The trigger button has no accessible name (icon-only); it's the sole
  // button inside the `fixed bottom-6 right-6` wrapper in src/App.tsx.
  await page.locator('.fixed.bottom-6.right-6 > button').click();
  await page.getByRole('button', { name: '執行師模式' }).click();
};

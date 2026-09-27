import { test, expect, Page } from 'playwright/test';
import { login, switchToCoachMode } from './fixtures/login';
import { seedAccounts, TEST_ACCOUNTS } from '../scripts/e2e/seedAccounts.mjs';
import { getEmulatorDb } from '../scripts/e2e/adminClient.mjs';

// Phase 6 of the finance migration: house self-use/rent conversion and the
// happiness checklist (toggle/add/remove) now run through server transactions
// (completeHouseConversion / completeHappinessToggle / completeHappinessAdd /
// completeHappinessRemove) instead of local state + background sync. This
// confirms the real Firestore rules accept these writes and the private
// player document ends up with the correct result — not just the local UI.
test.setTimeout(120_000);

const PLAYER = TEST_ACCOUNTS.find((a) => a.role === 'player')!;
const COACH = TEST_ACCOUNTS.find((a) => a.role === 'coach')!;

const completeSelectionWizard = async (page: Page) => {
  await page.locator('[data-selection-option]').first().click();
  const step1 = page.getByRole('button', { name: '確認選擇並前往：選擇企業' });
  await expect(step1).toBeVisible({ timeout: 30_000 });
  await step1.click();

  await page.locator('[data-selection-option]').first().click();
  const step2 = page.getByRole('button', { name: '確認選擇並前往：選擇夢想' });
  await expect(step2).toBeVisible({ timeout: 30_000 });
  await step2.click();

  await page.locator('[data-selection-option]').first().click();
  const step3 = page.getByRole('button', { name: '確認選擇並開始遊戲' });
  await expect(step3).toBeVisible({ timeout: 30_000 });
  await step3.click();

  await page.getByRole('button', { name: '確認並開始遊戲' }).click();
};

test('房屋自住／出租切換與幸福清單改由伺服器結算', async ({ browser }) => {
  await seedAccounts();

  const coachContext = await browser.newContext();
  const coachPage = await coachContext.newPage();
  await login(coachPage, COACH.email, COACH.password);
  await switchToCoachMode(coachPage);

  await coachPage.getByText('建立新遊戲').click();
  await coachPage.getByRole('button', { name: '1', exact: true }).click();
  await coachPage.getByText('線上棋盤').click();
  await coachPage.getByRole('button', { name: '開啟房間' }).click();

  const roomCodeButton = coachPage.getByRole('button', { name: /房間碼/ });
  await expect(roomCodeButton).toBeVisible({ timeout: 20_000 });
  const roomCode = (await roomCodeButton.locator('text=/^\\d{6}$/').innerText()).trim();
  const roomRef = getEmulatorDb().collection('rooms').doc(roomCode);

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await login(playerPage, PLAYER.email, PLAYER.password);
  await playerPage.getByPlaceholder('請輸入 6 位數房間碼').fill(roomCode);
  await playerPage.getByRole('button', { name: '進入' }).click();

  await expect(coachPage.getByRole('button', { name: '開始遊戲' })).toBeVisible({ timeout: 20_000 });
  await coachPage.getByRole('button', { name: '開始遊戲' }).click();
  await completeSelectionWizard(playerPage);
  await expect(coachPage.getByText('所有玩家已準備就緒')).toBeVisible({ timeout: 30_000 });
  await coachPage.getByRole('button', { name: '開始遊戲' }).click();

  await expect.poll(async () => (await roomRef.get()).data()?.boardState?.currentTurnUid, { timeout: 20_000 })
    .toEqual(expect.any(String));
  const tutorialSkip = playerPage.getByRole('button', { name: '跳過' });
  if (await tutorialSkip.isVisible().catch(() => false)) await tutorialSkip.click();

  const playerUid = (await roomRef.get()).data()!.boardState.currentTurnUid;
  const playerDocRef = roomRef.collection('players').doc(playerUid);

  // Seed an owned rental property (N038) and a custom, unchecked happiness
  // item so the two flows can be exercised deterministically through the UI.
  await playerDocRef.update({
    assets: [
      { id: 'seed-house', name: '兩房一廳住宅 (N038)', cost: 2_800_000, downPayment: 300_000, cashflow: -2500, type: '不動產', isSelfUse: false },
    ],
    happiness: [
      { id: 'seed-happy', label: '測試專用幸福項目', points: 3, checked: false, isCustom: true },
    ],
    happinessTotal: 0,
  });

  // --- House conversion: rent -> self-use, through the real modal flow ---
  await playerPage.getByRole('button', { name: '出租', exact: true }).first().click();
  await expect(playerPage.getByText('房屋狀態轉換')).toBeVisible({ timeout: 10_000 });
  await playerPage.getByText('轉為自用').click();
  await playerPage.getByRole('button', { name: '確認轉換', exact: true }).click();

  await expect.poll(async () => {
    const asset = (await playerDocRef.get()).data()?.assets?.find((a: any) => a.id === 'seed-house');
    return { isSelfUse: asset?.isSelfUse, cashflow: asset?.cashflow, conversionCount: asset?.conversionCount };
  }, { timeout: 15_000 }).toMatchObject({ isSelfUse: true, cashflow: 0, conversionCount: 1 });

  // --- Happiness checklist: toggle the seeded item on ---
  const happinessButton = playerPage.getByLabel(/查看幸福指數明細/);
  await happinessButton.click();
  await expect(playerPage.getByText('測試專用幸福項目')).toBeVisible({ timeout: 10_000 });
  await playerPage.getByText('測試專用幸福項目').click();

  await expect.poll(async () => {
    const data = (await playerDocRef.get()).data();
    const item = data?.happiness?.find((h: any) => h.id === 'seed-happy');
    return { checked: item?.checked, total: data?.happinessTotal };
  }, { timeout: 15_000 }).toMatchObject({ checked: true, total: 3 });

  await coachContext.close();
  await playerContext.close();
});

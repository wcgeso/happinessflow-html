import { test, expect, Page } from 'playwright/test';
import { login, switchToCoachMode } from './fixtures/login';
import { seedAccounts, TEST_ACCOUNTS } from '../scripts/e2e/seedAccounts.mjs';
import { getEmulatorDb } from '../scripts/e2e/adminClient.mjs';

// Board-game "bank" landing (payday) now runs through a server transaction
// (completePaydayCollection, phase 5 of the finance migration). This spec
// forces the current turn player onto a bank event directly via Firestore
// and confirms the private player document — not just the local UI state —
// ends up with the correct cash, forced-debt liability and dedupe id.
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

test('棋盤「銀行」事件的月結餘由伺服器結算，現金不足時自動計入強制負債', async ({ browser }) => {
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
  expect(roomCode).toMatch(/^\d{6}$/);
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

  const room = (await roomRef.get()).data();
  const playerUid = room.boardState.currentTurnUid;
  const playerDocRef = roomRef.collection('players').doc(playerUid);

  // Force cash to 0 and monthly living expenses above income, so the payday
  // formula must produce a negative flow it cannot cover from cash alone.
  const before = (await playerDocRef.get()).data();
  await playerDocRef.update({
    cash: 0,
    currentRankLevel: 1,
    medicalInsuranceCount: 0,
    // calculateFinancialSummary 疊加職業本身內建的基礎支出／稅率／職等加成，
    // 全部清零才能讓月現金流只由下面這一筆支出決定，精確驗證伺服器重算的結果。
    profession: { ...before.profession, salary: 0, expenses: { basicLiving: 0, transportEdu: 0, otherMedicalChild: 0 } },
    income: { salary: 0, investment: 0, other: 0 },
    expenses: { taxes: 0, mortgage: 0, studentLoan: 0, creditCard: 0, other: 0, basicLiving: 12_345, transportEdu: 0, otherMedicalChild: 0 },
    assets: [],
  });

  const bankEventId = `${playerUid}_${Date.now()}_bank`;
  await roomRef.update({
    'boardState.currentTurnUid': playerUid,
    'boardState.currentEvent': {
      id: bankEventId,
      playerUid,
      playerName: before.playerName,
      type: 'bank',
      summary: '測試觸發：經過銀行',
      detail: '先領取月結餘，再決定是否購買保險或定存',
      squareIndex: 6,
      timestamp: Date.now(),
    },
    'boardState.currentCard': null,
    'boardState.currentCardReveal': null,
    'boardState.movement': null,
    'boardState.pendingEvents': [],
    'boardState.sharedCardPrompt': null,
    'boardState.familyMilestoneJoinPrompt': null,
    'boardState.updatedAt': Date.now(),
  });

  const confirmButton = playerPage.getByRole('button', { name: '確認收訖', exact: true });
  await expect(confirmButton).toBeVisible({ timeout: 20_000 });
  await confirmButton.click();

  await expect.poll(async () => {
    const data = (await playerDocRef.get()).data();
    return {
      cash: data?.cash,
      liabilityCount: (data?.liabilities || []).length,
      liabilityType: data?.liabilities?.[0]?.type,
      appliedDedupe: (data?.appliedBoardFinancialEventIds || []).includes(`payday:${bankEventId}_bank`),
    };
  }, { timeout: 20_000 }).toMatchObject({
    cash: 0,
    liabilityCount: 1,
    liabilityType: '強制負債',
    appliedDedupe: true,
  });

  const after = (await playerDocRef.get()).data();
  expect(after.liabilities[0].totalOwed).toBe(12_345);
  expect(after.history.some((h: any) => h.name === '每月結餘')).toBe(true);
  expect(after.history.some((h: any) => h.name === '月結餘不足：強制計入負債')).toBe(true);

  await coachContext.close();
  await playerContext.close();
});

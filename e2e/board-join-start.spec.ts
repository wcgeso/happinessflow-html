import { test, expect, Page } from '@playwright/test';
import { login, switchToCoachMode } from './fixtures/login';
import { seedAccounts, TEST_ACCOUNTS } from '../scripts/e2e/seedAccounts.mjs';

test.setTimeout(150_000);

const PLAYERS = TEST_ACCOUNTS.filter((a) => a.role === 'player');
const COACH = TEST_ACCOUNTS.find((a) => a.role === 'coach')!;

// Drives a freshly-joined player through the profession/enterprise/dream
// setup wizard. Each SelectionCarousel step auto-selects its first item on
// mount (see src/components/common/SelectionCarousel.tsx), so the "next"
// button is immediately enabled without touching the carousel itself.
const completeSelectionWizard = async (page: Page) => {
  const step1 = page.getByRole('button', { name: '確認選擇並前往：選擇企業' });
  await expect(step1).toBeVisible({ timeout: 30_000 });
  await step1.click();

  const step2 = page.getByRole('button', { name: '確認選擇並前往：選擇夢想' });
  await expect(step2).toBeVisible({ timeout: 30_000 });
  await step2.click();

  const step3 = page.getByRole('button', { name: '確認選擇並開始遊戲' });
  await expect(step3).toBeVisible({ timeout: 30_000 });
  await step3.click();
};

test('coach creates a board room, 3 players join + set up, display syncs', async ({ browser }) => {
  await seedAccounts();

  const coachContext = await browser.newContext();
  const coachPage = await coachContext.newPage();
  await login(coachPage, COACH.email, COACH.password);
  await switchToCoachMode(coachPage);

  await coachPage.getByText('建立新遊戲').click();
  await coachPage.getByRole('button', { name: '3', exact: true }).click();
  await coachPage.getByText('線上棋盤').click();
  await coachPage.getByRole('button', { name: '開啟房間' }).click();

  // The room-code button's accessible name is "房間碼 {code}" (label + code
  // concatenated); scope the digit search to inside it rather than searching
  // the whole page, since other 6-digit-looking text can transiently exist
  // elsewhere (e.g. the create-room modal's player-count buttons "1".."6"
  // while it's still animating out).
  const roomCodeButton = coachPage.getByRole('button', { name: /房間碼/ });
  await expect(roomCodeButton).toBeVisible({ timeout: 20_000 });
  const roomCodeText = await roomCodeButton.locator('text=/^\\d{6}$/').innerText();
  const roomCode = roomCodeText.trim();
  expect(roomCode).toMatch(/^\d{6}$/);

  const playerPages: Page[] = [];
  for (const player of PLAYERS) {
    const context = await browser.newContext();
    const page = await context.newPage();
    // KNOWN ISSUE: under 3 concurrent browser contexts, the debounced
    // playerStates sync in src/context/GameContext.tsx (the 800ms-delayed
    // `runTransaction` write) has been observed to stall or intermittently
    // 400 against the Firestore emulator's `:commit` endpoint, while the
    // identical flow with a single player is reliable. Not yet confirmed
    // whether this is a real concurrency bug in that sync effect or
    // resource contention from running 5 browser contexts + 2 emulators in
    // one sandbox. These listeners are left in to make that diagnosable.
    page.on('pageerror', (err) => console.log(`[${player.name} pageerror]`, err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[${player.name} console.error]`, msg.text());
    });

    await login(page, player.email, player.password);

    await page.getByPlaceholder('請輸入 6 位數房間碼').fill(roomCode);
    await page.getByRole('button', { name: '進入' }).click();

    playerPages.push(page);
  }

  // Coach's RoomView should now show the "開始遊戲" start button once all 3
  // have joined (playerMembers.length >= room.maxPlayers), see RoomView.tsx.
  await expect(coachPage.getByRole('button', { name: '開始遊戲' })).toBeVisible({ timeout: 20_000 });
  await coachPage.getByRole('button', { name: '開始遊戲' }).click();

  // All 3 players auto-route into the setup wizard once room.status flips to
  // 'playing' (see App.tsx's room.status === 'playing' routing effect).
  // Run concurrently (Promise.all), matching how 3 real players would set up
  // simultaneously rather than artificially serializing them.
  await Promise.all(playerPages.map((page) => completeSelectionWizard(page)));

  // Coach should now see the 3/3 ready counter in CoachGameView. This has
  // been flaky under 3 concurrent contexts in this sandbox — see the KNOWN
  // ISSUE note above.
  await expect(coachPage.getByText('3 / 3')).toBeVisible({ timeout: 30_000 });

  // Display: a second browser context logged in as the same coach account,
  // opening the projector URL (see CoachGameView.tsx's `?boardRoom=` link).
  const displayContext = await browser.newContext();
  const displayPage = await displayContext.newPage();
  await login(displayPage, COACH.email, COACH.password);
  await displayPage.goto(`/?boardRoom=${roomCode}`);

  for (const player of PLAYERS) {
    await expect(displayPage.getByText(player.name)).toBeVisible({ timeout: 20_000 });
  }
});

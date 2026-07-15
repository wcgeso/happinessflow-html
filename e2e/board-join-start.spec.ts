import { test, expect, Page } from '@playwright/test';
import { login, switchToCoachMode } from './fixtures/login';
import { seedAccounts, TEST_ACCOUNTS } from '../scripts/e2e/seedAccounts.mjs';
import { getEmulatorDb } from '../scripts/e2e/adminClient.mjs';

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
  const seededAccounts = await seedAccounts();

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

  // CoachGameView now summarizes readiness in a start modal instead of the
  // former "3 / 3" counter. Start the actual turn flow before opening the
  // projector so this verifies the playable board state.
  await expect(coachPage.getByText('所有玩家已準備就緒')).toBeVisible({ timeout: 30_000 });
  await expect(coachPage.getByText('總玩家數').locator('..')).toContainText('3');
  await coachPage.getByRole('button', { name: '開始遊戲' }).click();

  // Display: a second browser context logged in as the same coach account,
  // opening the projector URL (see CoachGameView.tsx's `?boardRoom=` link).
  const displayContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const displayPage = await displayContext.newPage();
  await login(displayPage, COACH.email, COACH.password, `/?boardRoom=${roomCode}`);

  for (const player of PLAYERS) {
    await expect(displayPage.locator(`[data-player-token="${player.name}"]`)).toBeVisible({ timeout: 20_000 });
  }

  const playerTokenBoxes = await displayPage.locator('[data-player-token]').evaluateAll((tokens) =>
    tokens.map((token) => {
      const box = token.getBoundingClientRect();
      return {
        position: token.getAttribute('data-board-position'),
        centerX: Math.round(box.left + box.width / 2),
        centerY: Math.round(box.top + box.height / 2),
      };
    }),
  );

  expect(playerTokenBoxes).toHaveLength(3);
  expect(new Set(playerTokenBoxes.map((token) => token.position))).toEqual(new Set(['0']));
  expect(new Set(playerTokenBoxes.map((token) => `${token.centerX}:${token.centerY}`)).size).toBe(3);

  await expect(displayPage.locator('[data-projection-hud]')).toBeVisible();
  await expect(displayPage.locator('[data-projection-stage]')).toBeVisible();
  await expect(displayPage.getByText('順位 1／3').first()).toBeVisible();
  await displayPage.screenshot({ path: 'e2e/report/projection-p1-1920.png' });

  await displayPage.setViewportSize({ width: 1366, height: 768 });
  await expect(displayPage.locator('[data-projection-hud]')).toBeInViewport();
  await expect(displayPage.locator('[data-projection-stage]')).toBeInViewport();
  for (const player of PLAYERS) {
    await expect(displayPage.locator(`[data-player-token="${player.name}"]`)).toBeInViewport();
  }
  await displayPage.screenshot({ path: 'e2e/report/projection-p1-1366.png' });

  const roomRef = getEmulatorDb().collection('rooms').doc(roomCode);
  const cardCases = [
    { deck: 'happiness', cardId: 'H001', title: '幸福卡投影測試' },
    { deck: 'opportunity', cardId: 'C001', title: '機運卡投影測試' },
    { deck: 'news', cardId: 'N001', title: '新聞卡投影測試' },
  ] as const;

  for (const card of cardCases) {
    const eventId = `projection_${card.cardId}`;
    await roomRef.update({
      'boardState.currentEvent': {
        id: eventId,
        playerUid: seededAccounts.p1.uid,
        playerName: PLAYERS[0].name,
        type: 'card',
        summary: `${PLAYERS[0].name} 抽到卡片`,
        squareIndex: 0,
        timestamp: Date.now(),
      },
      'boardState.currentCard': {
        deck: card.deck,
        cardId: card.cardId,
        title: card.title,
        description: '投影卡片版面驗證',
        effectLines: ['現金 +1,000'],
      },
      'boardState.currentCardReveal': {
        eventId,
        cardId: card.cardId,
        isRevealed: true,
        revealedAt: Date.now(),
      },
    });

    const cardOverlay = displayPage.locator(`[data-projection-card][data-card-id="${card.cardId}"]`);
    await expect(cardOverlay).toBeVisible();
    await expect(cardOverlay.getByText('抽卡玩家')).toBeVisible();
    await displayPage.screenshot({ path: `e2e/report/projection-p1-card-${card.deck}.png` });
  }

  await roomRef.update({
    'boardState.currentEvent': null,
    'boardState.currentCard': null,
    'boardState.currentCardReveal': null,
  });
});

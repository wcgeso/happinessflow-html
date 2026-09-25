import { test, expect, type Browser, type BrowserContext, type Page } from 'playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { completePhotoConsentIfNeeded, login, switchToCoachMode } from './fixtures/login';
import { getAccounts, getDb, IS_PROD, seedIfLocal } from './utils/target';

const STRESS_PLAYER_COUNT = Number(process.env.E2E_STRESS_PLAYERS || 3);
if (![3, 4, 6].includes(STRESS_PLAYER_COUNT)) throw new Error('E2E_STRESS_PLAYERS 只支援 3、4 或 6');
const ACCOUNTS = getAccounts(STRESS_PLAYER_COUNT);
const PLAYERS = ACCOUNTS.filter((account) => account.role === 'player').slice(0, STRESS_PLAYER_COUNT);
const COACH = ACCOUNTS.find((account) => account.role === 'coach')!;
const REPORT_PATH = process.env.E2E_STRESS_REPORT || (
  STRESS_PLAYER_COUNT === 6
    ? 'e2e/report/board-6p-50-turn-stress.json'
    : 'e2e/report/board-50-turn-stress.json'
);
const SHARED_MODE = process.env.E2E_CARD_SET === 'shared';
const TURNS = Number(process.env.E2E_TURNS || 50);
// 共享卡片：N055 投資、N056 創業貸款、N028 股票股息、N027 現金股利，以及
// 機運卡的出售房產／店面／工作室／企業收購。每張都有「放棄」按鈕，可走完整個回覆流程。
const SHARED_CARDS = ['N055', 'N056', 'N028', 'N027', 'C009', 'C013', 'C023', 'C027', 'C029'];
const ROLLS = [1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1];
const SAFE_CARD_BY_DECK = {
  happiness: 'H026',
  opportunity: 'C038',
  news: 'N027',
} as const;
const BOARD_LENGTH = 52;
const BOARD_SPECIAL_TYPES: Record<number, string> = {
  0: 'school', 6: 'bank', 13: 'hospital', 15: 'bank', 24: 'bank',
  26: 'school', 27: 'repair', 32: 'bank', 39: 'hospital', 41: 'bank', 50: 'bank',
};
const CARD_TYPES = ['happiness', 'news', 'opportunity'] as const;

const getLandingType = (index: number) => {
  if (BOARD_SPECIAL_TYPES[index]) return BOARD_SPECIAL_TYPES[index];
  let cardIndex = 0;
  for (let position = 0; position <= index; position += 1) {
    if (BOARD_SPECIAL_TYPES[position]) continue;
    if (position === index) return CARD_TYPES[cardIndex % CARD_TYPES.length];
    cardIndex += 1;
  }
  return 'unknown';
};

type RoomData = {
  status?: string;
  startedAt?: number;
  sessionId?: string;
  members?: Array<{ uid: string; role?: string; name?: string }>;
  boardState?: any;
  playerStates?: Record<string, any>;
};

type TurnRecord = {
  turn: number;
  uid: string;
  player: string;
  roll: number;
  startPosition: number;
  endPosition: number;
  landingSquare: string;
  landingType: string;
  cardId: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  syncMs?: number;
  revision?: number;
  eventId?: string | null;
  errors: string[];
};

type DebugTelemetryRecord = {
  event: string;
  params: Record<string, string | number | boolean>;
  timestamp: number;
  monotonicMs: number;
};

const roomRef = (roomCode: string) => getDb().collection('rooms').doc(roomCode);

const withTimeout = async <T>(promise: Promise<T>, label: string, timeout = 15_000) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} 逾時（${timeout}ms）`)), timeout);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const prepareNextCard = async (roomCode: string, deck: 'happiness' | 'opportunity' | 'news', cardId: string) => {
  const usedKey = `used${deck[0].toUpperCase()}${deck.slice(1)}`;
  await roomRef(roomCode).update({
    [`boardState.deckState.${deck}`]: [cardId],
    [`boardState.deckState.${usedKey}`]: [],
  });
};

const prepareStressTurn = async (
  roomCode: string,
  uid: string,
  startPosition: number,
  forced?: { deck: 'happiness' | 'opportunity' | 'news'; cardId: string },
) => {
  await withTimeout(roomRef(roomCode).update({
    [`boardState.playerPositions.${uid}`]: startPosition,
    'boardState.deckState.happiness': [SAFE_CARD_BY_DECK.happiness],
    'boardState.deckState.opportunity': [SAFE_CARD_BY_DECK.opportunity],
    'boardState.deckState.news': [SAFE_CARD_BY_DECK.news],
    'boardState.deckState.usedHappiness': [],
    'boardState.deckState.usedOpportunity': [],
    'boardState.deckState.usedNews': [],
    'boardState.updatedAt': Date.now(),
    ...(forced ? { [`boardState.deckState.${forced.deck}`]: [forced.cardId] } : {}),
  }), `準備第 ${startPosition + 1} 格回合`);
};

const readRoom = async (roomCode: string): Promise<RoomData> => {
  const snapshot = await withTimeout(roomRef(roomCode).get(), `讀取房間 ${roomCode}`);
  if (!snapshot.exists) throw new Error(`找不到測試房間 ${roomCode}`);
  return snapshot.data() as RoomData;
};

const readPrivatePlayerState = async (roomCode: string, uid: string) => {
  const snapshot = await withTimeout(roomRef(roomCode).collection('players').doc(uid).get(), `讀取玩家 ${uid}`);
  return snapshot.exists ? snapshot.data() : undefined;
};

const waitFor = async <T>(read: () => Promise<T>, predicate: (value: T) => boolean, timeout = 15_000) => {
  const deadline = Date.now() + timeout;
  let last: T;
  do {
    last = await read();
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  throw new Error(`等待狀態逾時：${JSON.stringify(last)}`);
};

const completeSelectionWizard = async (page: Page) => {
  const selectFirstOption = async () => {
    await page.locator('main').getByRole('button', { name: /^選擇/ }).first().click();
  };

  await selectFirstOption();
  await expect(page.getByRole('button', { name: '確認選擇並前往：選擇企業' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: '確認選擇並前往：選擇企業' }).click();
  await selectFirstOption();
  await expect(page.getByRole('button', { name: '確認選擇並前往：選擇夢想' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '確認選擇並前往：選擇夢想' }).click();
  await selectFirstOption();
  await expect(page.getByRole('button', { name: '確認選擇並開始遊戲' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '確認選擇並開始遊戲' }).click();
  await expect(page.getByRole('button', { name: '確認並開始遊戲' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '確認並開始遊戲' }).click();
};

const loginForStress = async (page: Page, email: string, password: string, label: string) => {
  console.log(`[stress] ${label}: open login`);
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 20_000 });
  const emailInput = page.locator('form input[autocomplete="email"]');
  const passwordInput = page.locator('form input[type="password"]');
  await expect(emailInput).toBeVisible({ timeout: 20_000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('button', { name: '登入', exact: true })).toHaveCount(0, { timeout: 20_000 });
  await completePhotoConsentIfNeeded(page);
  console.log(`[stress] ${label}: logged in`);
};

const installDiceQueue = async (page: Page) => {
  await page.evaluate(() => {
    const originalRandom = Math.random.bind(Math);
    const queue: number[] = [];
    (window as any).__e2eDiceQueue = {
      push: (values: number[]) => queue.push(...values),
    };
    Math.random = () => queue.shift() ?? 0.01;
  });
};

const queueRoll = async (page: Page, roll: number) => {
  await page.evaluate((value) => {
    (window as any).__e2eDiceQueue?.push([((value - 1) + 0.01) / 6, 0.51]);
  }, roll);
};

const attachDiagnostics = (page: Page, label: string, errors: string[], retryableErrors: string[]) => {
  page.on('pageerror', (error) => errors.push(`${label} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // ponytail: 外部分析／字型資源不是遊戲命令依賴；本地請求仍由 response 監控。
    if (message.text() === 'Failed to load resource: net::ERR_TIMED_OUT') {
      console.warn(`[stress] ${label} non-blocking external resource timeout`);
      return;
    }
    // Firestore may expose a handled transaction retry as a transient HTTP 400
    // in the browser network log. The response handler records its body below.
    // Chrome omits the status text over HTTPS (production), so accept both forms.
    if (/^Failed to load resource: the server responded with a status of 400 \((Bad Request)?\)$/.test(message.text())) return;
    errors.push(`${label} console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    void response.text()
      .then((body) => {
        const item = `${label} HTTP ${response.status()} ${response.url()} ${body.slice(0, 500)}`;
        if (response.status() === 400 && /FAILED_PRECONDITION|stored version|base version/i.test(body)) {
          retryableErrors.push(item);
          return;
        }
        errors.push(item);
      })
      .catch(() => errors.push(`${label} HTTP ${response.status()} ${response.url()}`));
  });
};

const drainDebugTelemetry = async (page: Page, label: string, turn: number): Promise<Array<DebugTelemetryRecord & { label: string; turn: number }>> => {
  return page.evaluate(({ pageLabel, currentTurn }) => {
    const records = window.__hfTelemetry?.drain?.() || [];
    return records.map(record => ({ ...record, label: pageLabel, turn: currentTurn }));
  }, { pageLabel: label, currentTurn: turn });
};

const validateRoomSnapshot = async (roomCode: string, previousRevision: number | undefined, errors: string[]) => {
  const room = await readRoom(roomCode);
  const board = room.boardState || {};
  const positions = board.playerPositions || {};
  const turnOrder: string[] = board.turnOrder || [];

  expect(turnOrder).toHaveLength(STRESS_PLAYER_COUNT);
  expect(turnOrder).toContain(board.currentTurnUid);
  expect(Object.values(positions).every((position) => Number.isInteger(position) && position >= 0 && position <= 51)).toBe(true);
  expect(board.movement?.isActive ?? false).toBe(false);
  expect(board.currentEvent ?? null).toBeNull();
  expect(board.pendingEvents || []).toHaveLength(0);
  expect(board.sharedCardPrompt ?? null).toBeNull();
  expect(board.familyMilestoneJoinPrompt ?? null).toBeNull();
  if (previousRevision !== undefined) expect(board.revision).toBeGreaterThan(previousRevision);

  const cardLog = board.cardLog || [];
  const logKeys = cardLog.map((entry: any) => `${entry.eventId}:${entry.cardId}`);
  expect(new Set(logKeys).size).toBe(logKeys.length);
  expect(cardLog.length).toBeLessThanOrEqual(40);

  for (const uid of turnOrder) {
    const state = room.playerStates?.[uid] || await readPrivatePlayerState(roomCode, uid);
    expect(state, `缺少玩家私有資料 ${uid}`).toBeTruthy();
    expect(Number.isFinite(state.cash)).toBe(true);
    expect(Array.isArray(state.assets)).toBe(true);
    expect(Array.isArray(state.liabilities)).toBe(true);
    expect(Number.isFinite(state.happinessTotal)).toBe(true);
  }

  if ((board.revision || 0) < (previousRevision || 0)) errors.push('revision 非單調遞增');
  return room;
};

const closeSimpleCard = async (page: Page) => {
  const payday = page.getByRole('dialog', { name: '領取月結餘' });
  if (await payday.isVisible().catch(() => false)) {
    await payday.getByRole('button', { name: '確認收訖', exact: true }).click();
    const followup = page.getByRole('dialog', { name: '月結餘已完成' });
    if (await followup.isVisible().catch(() => false)) {
      await followup.getByRole('button', { name: '稍後再說', exact: true }).click();
    }
    return;
  }

  const sharedDividend = page.getByRole('heading', { name: '現金股利結算', exact: true });
  if (await sharedDividend.isVisible().catch(() => false)) {
    const modal = sharedDividend.locator('xpath=ancestor::div[contains(@class, "max-w-lg")]');
    await modal.getByRole('button', { name: '關閉', exact: true }).click();
    return;
  }

  const cover = page.getByText('事件封面 · 等待翻牌');
  await expect(cover).toBeVisible({ timeout: 15_000 });
  await cover.click();
  await expect(page.getByRole('button', { name: '關閉', exact: true }).last()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: '關閉', exact: true }).last().click();
};

const closeSharedDividendPrompt = async (page: Page) => {
  const heading = page.getByRole('heading', { name: '現金股利結算', exact: true });
  await heading.waitFor({ state: 'visible', timeout: 15_000 });
  const modal = heading.locator('xpath=ancestor::div[contains(@class, "max-w-lg")]');
  await modal.getByRole('button', { name: '關閉', exact: true }).click();
};

const dismissBoardTutorial = async (page: Page) => {
  const skip = page.getByRole('button', { name: '跳過', exact: true });
  await skip.waitFor({ state: 'visible', timeout: 10_000 }).then(() => skip.click()).catch(() => undefined);
};

const openBoardRoom = async (browser: Browser) => {
  const coachContext = await browser.newContext();
  const coachPage = await coachContext.newPage();
  await login(coachPage, COACH.email, COACH.password);
  await switchToCoachMode(coachPage);
  await coachPage.getByText('建立新遊戲').click();
  await coachPage.getByRole('button', { name: String(STRESS_PLAYER_COUNT), exact: true }).click();
  await coachPage.getByText('線上棋盤').click();
  await coachPage.getByRole('button', { name: '開啟房間' }).click();
  const roomCodeButton = coachPage.getByRole('button', { name: /房間碼/ });
  await expect(roomCodeButton).toBeVisible({ timeout: 20_000 });
  const roomCodeText = await roomCodeButton.innerText();
  const roomCode = roomCodeText.match(/\d{6}/)?.[0];
  if (!roomCode) throw new Error(`無法從房間碼按鈕讀取 6 位房間碼：${roomCodeText}`);

  const playerContexts: BrowserContext[] = [];
  const playerPages: Page[] = [];
  for (const player of PLAYERS) {
    console.log(`[stress] ${player.name}: create browser context`);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    console.log(`[stress] ${player.name}: browser page ready`);
    await installDiceQueue(page);
    await loginForStress(page, player.email, player.password, player.name);
    console.log(`[stress] ${player.name}: join room`);
    await page.getByPlaceholder('請輸入 6 位數房間碼').fill(roomCode);
    await page.getByRole('button', { name: '進入' }).click();
    await expect(page.getByText(player.name, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await installDiceQueue(page);
    console.log(`[stress] ${player.name}: joined room`);
    playerContexts.push(context);
    playerPages.push(page);
  }

  await expect(coachPage.getByRole('button', { name: '開始遊戲' })).toBeVisible({ timeout: 20_000 });
  console.log('[stress] coach: start selection');
  await coachPage.getByRole('button', { name: '開始遊戲' }).click();
  console.log('[stress] players: complete selection');
  await Promise.all(playerPages.map(completeSelectionWizard));
  console.log('[stress] coach: all players selected');
  await expect(coachPage.getByText('所有玩家已準備就緒')).toBeVisible({ timeout: 30_000 });
  console.log('[stress] coach: start board');
  await coachPage.getByRole('button', { name: '開始遊戲' }).click();
  await Promise.all(playerPages.map(dismissBoardTutorial));

  const displayContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const displayPage = await displayContext.newPage();
  await login(displayPage, COACH.email, COACH.password, `/?boardRoom=${roomCode}`);
  console.log('[stress] display: ready');
  await expect(displayPage.locator('[data-projection-stage]')).toBeVisible({ timeout: 30_000 });
  return { coachContext, coachPage, playerContexts, playerPages, displayContext, displayPage, roomCode };
};

test(`${STRESS_PLAYER_COUNT} 位玩家＋1 位執行師完成 50 回合壓力測試`, async ({ browser }, testInfo) => {
  test.setTimeout(15 * 60 * 1000);
  const errors: string[] = [];
  const retryableErrors: string[] = [];
  const telemetry: Array<DebugTelemetryRecord & { label: string; turn: number }> = [];
  const turns: TurnRecord[] = [];
  const snapshots: Array<{ turn: number; revision?: number; currentTurnUid?: string; positions: Record<string, number>; cardLogLength: number; heap?: number }> = [];
  let handles: Awaited<ReturnType<typeof openBoardRoom>> | null = null;
  let report: any = {
    test: `BOARD_${STRESS_PLAYER_COUNT}P_50_TURN_STRESS_2026-08-26`,
    status: 'running',
    environment: { target: IS_PROD ? 'production' : 'emulator', baseURL: process.env.E2E_BASE_URL || 'http://localhost:5183', firestore: process.env.FIRESTORE_EMULATOR_HOST, auth: process.env.FIREBASE_AUTH_EMULATOR_HOST },
    accounts: { players: STRESS_PLAYER_COUNT, coach: 1 },
    startedAt: new Date().toISOString(),
    turns,
    snapshots,
    errors,
    retryableErrors,
    telemetry,
  };

  mkdirSync('e2e/report', { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  try {
    await seedIfLocal();
    handles = await openBoardRoom(browser);
    attachDiagnostics(handles.coachPage, 'coach', errors, retryableErrors);
    attachDiagnostics(handles.displayPage, 'display', errors, retryableErrors);
    handles.playerPages.forEach((page, index) => attachDiagnostics(page, `p${index + 1}`, errors, retryableErrors));

    const roomAtStart = await readRoom(handles.roomCode);
    const turnOrder = (roomAtStart.boardState?.turnOrder || []) as string[];
    const playerByUid = new Map(
      turnOrder.map((uid: string) => {
        const member = roomAtStart.members?.find((candidate) => candidate.uid === uid);
        const playerIndex = PLAYERS.findIndex((player) => player.name === member?.name);
        if (playerIndex < 0) throw new Error(`找不到玩家頁面對應 ${uid}`);
        return [uid, PLAYERS[playerIndex]] as const;
      }),
    );
    const pageByUid = new Map(
      turnOrder.map((uid) => [uid, handles!.playerPages[PLAYERS.indexOf(playerByUid.get(uid)!)] ] as const),
    );
    const rollIndexByUid = new Map(turnOrder.map((uid) => [uid, 0] as const));
    const revisionAtStart = (await readRoom(handles.roomCode)).boardState?.revision;
    let previousRevision = revisionAtStart as number | undefined;

    for (let turn = 1; turn <= TURNS; turn += 1) {
      console.log(`[stress] turn ${turn}: read state`);
      const before = await readRoom(handles.roomCode);
      const board = before.boardState || {};
      const uid = board.currentTurnUid as string;
      const player = playerByUid.get(uid);
      const page = pageByUid.get(uid);
      if (!player || !page) throw new Error(`第 ${turn} 回合找不到目前玩家 ${uid}`);

      const playerRollIndex = rollIndexByUid.get(uid) || 0;
      const roll = ROLLS[playerRollIndex];
      if (!roll) throw new Error(`${player.name} 已超過預期回合數`);
      rollIndexByUid.set(uid, playerRollIndex + 1);
      const sharedCardId = SHARED_MODE ? SHARED_CARDS[(turn - 1) % SHARED_CARDS.length] : undefined;
      const sharedDeck = sharedCardId?.startsWith('N') ? 'news' : 'opportunity';
      const sharedLandingIndex = sharedCardId
        ? Array.from({ length: BOARD_LENGTH }, (_, index) => index).find((index) => index > 0 && getLandingType(index) === sharedDeck)!
        : undefined;
      const startPosition = sharedLandingIndex !== undefined ? sharedLandingIndex - 1 : ((turn - 1) % 2 === 0 ? 0 : 2);
      const endPosition = (startPosition + roll) % BOARD_LENGTH;
      const landingType = getLandingType(endPosition);
      const landingSquare = { label: landingType, type: landingType };
      const record: TurnRecord = {
        turn,
        uid,
        player: player.name,
        roll,
        startPosition,
        endPosition,
        landingSquare: landingSquare.label,
        landingType: landingSquare.type,
        cardId: '',
        startedAt: Date.now(),
        errors: [],
      };
      const beforeErrorCount = errors.length;

      expect(['happiness', 'opportunity', 'news']).toContain(landingSquare.type);
      const deck = landingSquare.type as 'happiness' | 'opportunity' | 'news';
      const cardId = sharedCardId || SAFE_CARD_BY_DECK[deck];
      record.cardId = cardId;
      const previousCardLogId = board.cardLog?.[0]?.id;
      console.log(`[stress] turn ${turn}: prepare ${player.name} position=${startPosition} card=${cardId}`);
      await prepareStressTurn(handles.roomCode, uid, startPosition, sharedCardId ? { deck, cardId } : undefined);
      await page.waitForTimeout(250);
      await queueRoll(page, roll);

      await expect(page.getByRole('button', { name: /^擲骰子/ })).toBeEnabled({ timeout: 10_000 });
      console.log(`[stress] turn ${turn}: roll`);
      await page.getByRole('button', { name: /^擲骰子/ }).click();

      const eventState = await waitFor(
        () => readRoom(handles!.roomCode),
        (room) => {
          if (room.boardState?.movement?.isActive) return false;
          if (room.boardState?.currentEvent?.playerUid === uid) return true;
          return !room.boardState?.currentEvent &&
            !room.boardState?.currentCard &&
            !room.boardState?.currentCardReveal &&
            room.boardState?.cardLog?.[0]?.cardId === cardId &&
            room.boardState?.cardLog?.[0]?.id !== previousCardLogId;
        },
        20_000,
      );
      if (SHARED_MODE) {
        expect(eventState.boardState?.currentEvent?.playerUid, `${cardId} 沒有產生棋盤事件`).toBe(uid);
        // #2：抽卡玩家翻牌後，大螢幕必須跟著翻開。
        const cover = page.getByText('事件封面 · 等待翻牌');
        await expect(cover).toBeVisible({ timeout: 15_000 });
        const revealClickedAt = Date.now();
        await cover.click();
        await handles.displayPage.locator('[data-projection-card-content]').waitFor({ state: 'visible', timeout: 10_000 });
        (record as any).projectionRevealMs = Date.now() - revealClickedAt;
        // #1：所有玩家（含抽卡者）各自回覆「放棄」，事件必須自動結案。
        await Promise.all(handles.playerPages.map(async (candidate, index) => {
          await candidate.getByText('共享卡片事件', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
          await candidate.getByRole('button', { name: '放棄', exact: true }).click();
          console.log(`[stress] turn ${turn}: p${index + 1} declined ${cardId}`);
        }));
        const declinedAt = Date.now();
        await waitFor(
          () => readRoom(handles!.roomCode),
          (room) => !room.boardState?.sharedCardPrompt && !room.boardState?.currentEvent,
          15_000,
        );
        (record as any).sharedCompletionMs = Date.now() - declinedAt;
        console.log(`[stress] turn ${turn}: ${cardId} projection=${(record as any).projectionRevealMs}ms completion=${(record as any).sharedCompletionMs}ms`);
      } else if (eventState.boardState?.currentEvent?.playerUid === uid) {
        if (cardId === 'N027') {
          await Promise.all([
            closeSimpleCard(page),
            ...handles.playerPages
              .filter(candidate => candidate !== page)
              .map(closeSharedDividendPrompt)
          ]);
        } else {
          await closeSimpleCard(page);
        }
        console.log(`[stress] turn ${turn}: card closed`);
      } else {
        console.log(`[stress] turn ${turn}: card auto-completed`);
      }
      await waitFor(
        () => readRoom(handles!.roomCode),
        (room) => !room.boardState?.movement &&
          !room.boardState?.currentEvent &&
          !room.boardState?.currentCard &&
          !room.boardState?.currentCardReveal &&
          !(room.boardState?.pendingEvents || []).length,
        15_000,
      );

      const nextUid = turnOrder[turn % turnOrder.length];
      await expect(page.getByRole('button', { name: '結束回合', exact: true })).toBeEnabled({ timeout: 10_000 });
      await page.getByRole('button', { name: '結束回合', exact: true }).click();
      const syncStarted = Date.now();
      const after = await waitFor(
        () => readRoom(handles!.roomCode),
        (room) => room.boardState?.currentTurnUid === nextUid && !room.boardState?.movement && !room.boardState?.currentEvent,
        15_000,
      );
      const completedAt = Date.now();
      record.completedAt = completedAt;
      record.durationMs = completedAt - record.startedAt;
      record.syncMs = completedAt - syncStarted;
      record.revision = after.boardState?.revision;
      record.eventId = after.boardState?.lastEvent?.id || null;
      record.errors = errors.slice(beforeErrorCount);
      turns.push(record);

      const telemetryBatch = await Promise.all([
        drainDebugTelemetry(handles.coachPage, 'coach', turn),
        drainDebugTelemetry(handles.displayPage, 'display', turn),
        ...handles.playerPages.map((candidate, index) => drainDebugTelemetry(candidate, `p${index + 1}`, turn))
      ]);
      telemetry.push(...telemetryBatch.flat());

      const validated = await validateRoomSnapshot(handles.roomCode, previousRevision, errors);
      previousRevision = validated.boardState?.revision;
      snapshots.push({
        turn,
        revision: validated.boardState?.revision,
        currentTurnUid: validated.boardState?.currentTurnUid,
        positions: validated.boardState?.playerPositions || {},
        cardLogLength: (validated.boardState?.cardLog || []).length,
        heap: await page.evaluate(() => (performance as any).memory?.usedJSHeapSize),
      });
      expect(record.syncMs).toBeLessThanOrEqual(5_000);
      if (SHARED_MODE) {
        expect((record as any).projectionRevealMs).toBeLessThanOrEqual(5_000);
        expect((record as any).sharedCompletionMs).toBeLessThanOrEqual(10_000);
      }
      expect(record.durationMs).toBeLessThanOrEqual(120_000);
      report.turns = turns;
      report.snapshots = snapshots;
      report.errors = errors;
      report.retryableErrors = retryableErrors;
      report.telemetry = telemetry;
      writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    }

    for (const [index, uid] of turnOrder.entries()) {
      const expectedRolls = Math.floor(TURNS / STRESS_PLAYER_COUNT) + (index < TURNS % STRESS_PLAYER_COUNT ? 1 : 0);
      expect(rollIndexByUid.get(uid)).toBe(expectedRolls);
    }
    await handles.coachPage.waitForTimeout(1_000);
    expect(errors).toEqual([]);
    expect(retryableErrors.length).toBeLessThanOrEqual(Math.max(1, Math.ceil(50 * 0.05)));

    await handles.coachPage.getByTitle('遊戲結算').click();
    await expect(handles.coachPage.getByRole('button', { name: '確認' })).toBeVisible({ timeout: 5_000 });
    await handles.coachPage.getByRole('button', { name: '確認' }).click();
    await waitFor(() => readRoom(handles!.roomCode), (room) => room.status === 'finished', 20_000);
    await expect(handles.coachPage.getByRole('heading', { name: '遊戲結算', exact: true }).first()).toBeVisible({ timeout: 20_000 });
    for (const page of handles.playerPages) {
      await expect(page.getByRole('region', { name: '遊戲結算', exact: true })).toBeVisible({ timeout: 20_000 });
    }
    await handles.coachPage.waitForTimeout(1_000);
    expect(errors).toEqual([]);

    const finalRoom = await readRoom(handles.roomCode);
    expect(finalRoom.status).toBe('finished');
    expect(finalRoom.boardState?.currentEvent ?? null).toBeNull();
    expect(finalRoom.boardState?.movement ?? null).toBeNull();
    report.final = { status: finalRoom.status, sessionId: finalRoom.sessionId, revision: finalRoom.boardState?.revision };
    report.status = 'passed';
  } catch (error: any) {
    report.status = 'failed';
    report.failure = { message: error?.message || String(error), stack: error?.stack };
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.errors = errors;
    report.retryableErrors = retryableErrors;
    report.telemetry = telemetry;
    report.testInfo = { status: testInfo.status, expectedStatus: testInfo.expectedStatus };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    await Promise.all([
      handles?.displayContext.close(),
      handles?.coachContext.close(),
      ...(handles?.playerContexts || []).map((context) => context.close()),
    ]);
  }
});

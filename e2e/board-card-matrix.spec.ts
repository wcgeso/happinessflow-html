import { test, expect, type Browser, type BrowserContext, type Page } from 'playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { completePhotoConsentIfNeeded, switchToCoachMode } from './fixtures/login';
import { seedAccounts, TEST_ACCOUNTS } from '../scripts/e2e/seedAccounts.mjs';
import { getEmulatorDb } from '../scripts/e2e/adminClient.mjs';

type Deck = 'happiness' | 'opportunity' | 'news';
type Severity = 'A' | 'B' | 'C';
type CardDefinition = {
  id: string;
  title: string;
  description?: string;
  deck: Deck;
  type?: string;
  status?: string;
  choiceRequired?: boolean;
  financialCheck?: boolean;
  multiplayer?: Record<string, unknown>;
};
type CardResult = {
  index: number;
  deck: Deck;
  cardId: string;
  title: string;
  status?: string;
  player: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  outcome: 'passed' | 'failed' | 'blocked';
  severity?: Severity;
  branch: string;
  expected: string[];
  actual?: string[];
  roomRevisionBefore?: number;
  roomRevisionAfter?: number;
  eventId?: string | null;
  errors: string[];
  evidence: string[];
};
type RoomData = {
  id?: string;
  status?: string;
  members?: Array<{ uid: string; name?: string; role?: string; isLeft?: boolean }>;
  playerStates?: Record<string, any>;
  boardState?: any;
};

const PLAYERS = TEST_ACCOUNTS.filter((account) => account.role === 'player').slice(0, 3);
const COACH = TEST_ACCOUNTS.find((account) => account.role === 'coach')!;
const REPORT_PATH = 'e2e/report/board-card-matrix-local-2026-09-01.json';
const EVIDENCE_ROOT = path.resolve('output/playwright/board-card-matrix-2026-09-01');
const CARD_FILES: Array<{ deck: Deck; file: string }> = [
  { deck: 'happiness', file: 'happiness.cards.json' },
  { deck: 'opportunity', file: 'opportunity.cards.json' },
  { deck: 'news', file: 'news.cards.json' },
];

const readCardDefinitions = (): CardDefinition[] => {
  const cards: CardDefinition[] = [];
  for (const { deck, file } of CARD_FILES) {
    const values = JSON.parse(readFileSync(path.resolve('src/data/cards', file), 'utf8')) as CardDefinition[];
    cards.push(...values.map((card) => ({ ...card, deck })));
  }
  return cards;
};

const db = getEmulatorDb();
const roomRef = (roomCode: string) => db.collection('rooms').doc(roomCode);
const playerRef = (roomCode: string, uid: string) => roomRef(roomCode).collection('players').doc(uid);

const withTimeout = async <T>(promise: Promise<T>, label: string, timeout = 15_000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}逾時（${timeout}ms）`)), timeout);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const readRoom = async (roomCode: string): Promise<RoomData> => {
  const snapshot = await withTimeout(roomRef(roomCode).get(), `讀取房間 ${roomCode}`);
  if (!snapshot.exists) throw new Error(`找不到房間 ${roomCode}`);
  return { id: snapshot.id, ...(snapshot.data() as RoomData) };
};

const waitForRoom = async (roomCode: string, predicate: (room: RoomData) => boolean, label: string, timeout = 20_000) => {
  const deadline = Date.now() + timeout;
  let latest = await readRoom(roomCode);
  while (Date.now() < deadline) {
    if (predicate(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 250));
    latest = await readRoom(roomCode);
  }
  throw new Error(`${label}逾時：${JSON.stringify(latest.boardState || {})}`);
};

const visibleEnabledButtons = async (page: Page) => page.locator('button').evaluateAll((buttons) => buttons
  .map((button) => ({
    text: (button.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: (button as HTMLButtonElement).disabled,
    rect: button.getBoundingClientRect(),
  }))
  .filter(({ text, disabled, rect }) => text && !disabled && rect.width > 0 && rect.height > 0));

const hasVisibleButton = async (page: Page, name: string | RegExp) => {
  const locator = page.getByRole('button', { name, exact: typeof name === 'string' });
  for (let index = 0; index < await locator.count(); index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) return true;
  }
  return false;
};

const clickVisibleButton = async (page: Page, names: Array<string | RegExp>) => {
  for (const name of names) {
    const locator = page.getByRole('button', { name, exact: typeof name === 'string' });
    for (let index = (await locator.count()) - 1; index >= 0; index -= 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
        await candidate.click();
        return name.toString();
      }
    }
  }
  return null;
};

const waitForVisible = async (page: Page, text: string | RegExp, timeout = 15_000) => {
  const locator = page.getByText(text, { exact: typeof text === 'string' });
  await expect(locator).toBeVisible({ timeout });
  return locator;
};

const installDiceQueue = async (page: Page) => {
  await page.evaluate(() => {
    const queue: number[] = [];
    (window as any).__cardMatrixDice = {
      push: (roll: number) => queue.push(((roll - 1) + 0.01) / 6, 0.51),
    };
    Math.random = () => queue.shift() ?? 0.84;
  });
};

const loginPlayer = async (page: Page, email: string, password: string, label: string) => {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 20_000 });
  const inputs = page.locator('form input');
  await expect(inputs.nth(0)).toBeVisible({ timeout: 20_000 });
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('button', { name: '登入', exact: true })).toHaveCount(0, { timeout: 20_000 });
  await completePhotoConsentIfNeeded(page);
  console.log(`[card-matrix] ${label} logged in`);
};

const completeSelectionWizard = async (page: Page) => {
  await page.locator('[data-selection-option]').first().click();
  await expect(page.getByRole('button', { name: '確認選擇並前往：選擇企業' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: '確認選擇並前往：選擇企業' }).click();
  await page.locator('[data-selection-option]').first().click();
  await expect(page.getByRole('button', { name: '確認選擇並前往：選擇夢想' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '確認選擇並前往：選擇夢想' }).click();
  await page.locator('[data-selection-option]').first().click();
  await expect(page.getByRole('button', { name: '確認選擇並開始遊戲' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '確認選擇並開始遊戲' }).click();
  await page.getByRole('button', { name: '確認並開始遊戲' }).click();
};

const createRoom = async (browser: Browser) => {
  const coachContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const coachPage = await coachContext.newPage();
  coachPage.on('console', (message) => {
    if (message.type() === 'error' && !/permission_denied/.test(message.text())) {
      console.log(`[card-matrix] coach console.error: ${message.text().replace(/\s+/g, ' ').slice(0, 900)}`);
    }
  });
  coachPage.on('pageerror', (error) => console.log(`[card-matrix] coach pageerror: ${error.message}`));
  coachPage.on('response', (response) => {
    if (response.status() >= 400) {
      void response.text().then((body) => {
        console.log(`[card-matrix] coach HTTP ${response.status()}: ${response.url().slice(-220)} ${body.slice(0, 1200)}`);
      }).catch(() => console.log(`[card-matrix] coach HTTP ${response.status()}: ${response.url().slice(-220)}`));
    }
  });
  coachPage.on('dialog', async (dialog) => {
    console.log(`[card-matrix] coach dialog: ${dialog.message()}`);
    await dialog.dismiss();
  });
  await loginPlayer(coachPage, COACH.email, COACH.password, COACH.name);
  await switchToCoachMode(coachPage);
  await coachPage.getByText('建立新遊戲', { exact: true }).click();
  await coachPage.getByRole('button', { name: '3', exact: true }).click();
  await coachPage.getByText('線上棋盤', { exact: true }).click();
  await coachPage.getByRole('button', { name: '開啟房間', exact: true }).click();
  const roomCodeButton = coachPage.getByRole('button', { name: /房間碼/ });
  await expect(roomCodeButton).toBeVisible({ timeout: 20_000 });
  const roomCode = (await roomCodeButton.innerText()).match(/\d{6}/)?.[0];
  if (!roomCode) throw new Error('無法取得六位數房間碼');

  const playerContexts: BrowserContext[] = [];
  const playerPages: Page[] = [];
  for (const player of PLAYERS) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error' && !/permission_denied/.test(message.text())) {
        console.log(`[card-matrix] ${player.name} console.error: ${message.text().replace(/\s+/g, ' ').slice(0, 900)}`);
      }
      if (message.text().includes('共享卡片彈窗被擋住')) {
        void Promise.all(message.args().map((arg) => arg.jsonValue().catch(() => null))).then((values) => {
          console.log(`[card-matrix] ${player.name} BLOCKED-SHARED-MODAL ${JSON.stringify(values).slice(0, 600)}`);
        });
      }
    });
    page.on('pageerror', (error) => console.log(`[card-matrix] ${player.name} pageerror: ${error.message}`));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        void response.text().then((body) => {
          console.log(`[card-matrix] ${player.name} HTTP ${response.status()}: ${response.url().slice(-220)} ${body.slice(0, 1200)}`);
        }).catch(() => console.log(`[card-matrix] ${player.name} HTTP ${response.status()}: ${response.url().slice(-220)}`));
      }
    });
    page.on('dialog', async (dialog) => {
      console.log(`[card-matrix] ${player.name} dialog: ${dialog.message()}`);
      await dialog.dismiss();
    });
    await installDiceQueue(page);
    await loginPlayer(page, player.email, player.password, player.name);
    await page.getByPlaceholder('請輸入 6 位數房間碼').fill(roomCode);
    await page.getByRole('button', { name: '進入', exact: true }).click();
    await expect(page.getByText(player.name, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    playerContexts.push(context);
    playerPages.push(page);
  }

  await expect(coachPage.getByRole('button', { name: '開始遊戲', exact: true })).toBeVisible({ timeout: 20_000 });
  await coachPage.getByRole('button', { name: '開始遊戲', exact: true }).click();
  await Promise.all(playerPages.map(completeSelectionWizard));
  await expect(coachPage.getByText('所有玩家已準備就緒')).toBeVisible({ timeout: 30_000 });
  await coachPage.getByRole('button', { name: '開始遊戲', exact: true }).click();

  // Verify that the existing player sessions receive the active board state;
  // do not force a reload that would mix reconnect behavior into card tests.
  await Promise.all(playerPages.map(async (page) => {
    await installDiceQueue(page);
    await expect(page.getByText('目前回合', { exact: true })).toBeVisible({ timeout: 30_000 });
  }));

  for (const page of playerPages) {
    const skip = page.getByRole('button', { name: '跳過', exact: true });
    if (await skip.count()) await skip.first().click().catch(() => undefined);
  }
  await waitForRoom(roomCode, (room) => room.status === 'playing' && !!room.boardState?.turnOrder?.length, '棋盤開局');
  return { roomCode, coachContext, coachPage, playerContexts, playerPages };
};

const playerMapForRoom = async (roomCode: string, pages: Page[]) => {
  const room = await readRoom(roomCode);
  const byUid = new Map<string, Page>();
  for (const uid of room.boardState?.turnOrder || []) {
    const member = room.members?.find((candidate) => candidate.uid === uid);
    const index = PLAYERS.findIndex((player) => player.name === member?.name);
    if (index >= 0) byUid.set(uid, pages[index]);
  }
  if (byUid.size !== 3) throw new Error(`房間玩家頁面對應不完整：${byUid.size}/3`);
  return { room, byUid };
};

const seedFinancialBaseline = async (roomCode: string, room: RoomData, targetUid: string, card: CardDefinition) => {
  const baselineAssets = [
    { id: 'matrix-stock-a10', name: 'A10 股票', cost: 1_000_000, downPayment: 0, cashflow: 0, type: '股票', quantity: 100 },
    { id: 'matrix-house-1', name: '測試單間住宅', cost: 1_000_000, downPayment: 300_000, cashflow: 10_000, type: '不動產', houseType: '1room', isInsured: true },
    { id: 'matrix-house-2', name: '測試兩房住宅', cost: 3_000_000, downPayment: 900_000, cashflow: 20_000, type: '不動產', houseType: '2room', isInsured: true },
    { id: 'matrix-store', name: '測試小型店面', cost: 5_000_000, downPayment: 1_500_000, cashflow: 50_000, type: '不動產', houseType: 'store_small', isInsured: true },
    { id: 'matrix-car', name: '測試汽車', cost: 600_000, downPayment: 120_000, cashflow: 0, type: '汽車', isInsured: true },
  ];
  const existing = (await playerRef(roomCode, targetUid).get()).data() || room.playerStates?.[targetUid] || {};
  const shouldStartLoan = card.id === 'N056' || card.id === 'N057' || card.id === 'N058';
  const nextState = {
    ...existing,
    cash: 50_000_000,
    assets: shouldStartLoan
      ? baselineAssets.filter((asset) => asset.type !== '企業')
      : baselineAssets,
    liabilities: [],
    loans: 0,
    happiness: [],
    happinessTotal: 0,
    children: 2,
    medicalInsuranceCount: 2,
    expenses: {
      taxes: 0, mortgage: 0, studentLoan: 0, creditCard: 0, other: 0,
      basicLiving: 0, transportEdu: 0, otherMedicalChild: 0,
    },
    income: { ...(existing.income || {}), salary: 100_000, investment: 0, other: 0 },
    completedHappinessEvents: [],
    pendingStartupUpgradeAction: null,
    pendingStartupUpgradeActions: [],
    boardGameStartedAt: room.startedAt,
    sessionId: room.sessionId,
    isSetup: true,
  };

  await Promise.all([
    playerRef(roomCode, targetUid).set(nextState, { merge: true }),
  ]);
};

const resetBoardFlow = async (roomCode: string, targetUid: string) => {
  await roomRef(roomCode).update({
    'boardState.currentTurnUid': targetUid,
    'boardState.hasRolledThisTurn': true,
    'boardState.currentEvent': null,
    'boardState.currentCard': null,
    'boardState.currentCardReveal': null,
    'boardState.movement': null,
    'boardState.pendingEvents': [],
    'boardState.sharedCardPrompt': null,
    'boardState.familyMilestoneJoinPrompt': null,
    'boardState.updatedAt': Date.now(),
  });
};

const openCardConsoleAndTrigger = async (coachPage: Page, card: CardDefinition, playerName: string) => {
  const consoleButton = coachPage.getByRole('button', { name: '卡片發送', exact: true });
  if (await consoleButton.count() === 0) throw new Error('找不到執行師卡片發送按鈕');
  const searchPlaceholder = '例如 H014、創業貸款';
  if (!(await coachPage.getByPlaceholder(searchPlaceholder).count())) await consoleButton.click();
  const search = coachPage.getByPlaceholder(searchPlaceholder);
  await search.fill(card.id);
  const article = coachPage.locator('article').filter({ hasText: card.id }).filter({ hasText: card.title });
  await expect(article).toBeVisible({ timeout: 10_000 });
  await article.getByRole('button', { name: '觸發', exact: true }).click();
  await expect(coachPage.getByText(new RegExp(`觸發 ${card.id}`))).toBeVisible({ timeout: 5_000 });
  await coachPage.getByRole('button', { name: '確認', exact: true }).last().click();
  await coachPage.getByRole('button', { name: '關閉卡片發送', exact: true }).click();
  console.log(`[card-matrix] trigger ${card.id} for ${playerName}`);
};

const openCardCover = async (page: Page, allowReveal: boolean) => {
  if (!allowReveal) return false;
  const cover = page.getByText('事件封面 · 等待翻牌', { exact: true });
  for (let index = 0; index < await cover.count(); index += 1) {
    const candidate = cover.nth(index);
    if (!await candidate.isVisible().catch(() => false)) continue;
    if (await candidate.evaluate((element) => getComputedStyle(element).opacity !== '1')) continue;
    await candidate.click();
    await page.waitForTimeout(850);
    return true;
  }
  return false;
};

const completeFinancialCheck = async (page: Page) => {
  const verify = page.getByRole('button', { name: '確認檢核答案', exact: true });
  if (await verify.count() === 0 || !await verify.first().isVisible().catch(() => false)) return false;

  await verify.click();
  const firstPopup = page.getByRole('button', { name: '我知道了', exact: true });
  await expect(firstPopup).toBeVisible({ timeout: 5_000 });
  await firstPopup.click();
  await verify.click();
  await expect(firstPopup).toBeVisible({ timeout: 5_000 });

  const lines = await page.locator('li, div:not(:has(*))').allTextContents();
  const entries = lines
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .map((line) => line.match(/(?:^|[•\s]|應填寫：)(資產|負債|收入|支出)：(.+?)（(增加|減少)）$/))
    .filter((match): match is RegExpMatchArray => !!match)
    .map((match) => ({ category: match[1], name: match[2], direction: match[3] }));
  if (!entries.length) throw new Error(`財務檢核第二次提示沒有提供答案：${lines.join(' | ')}`);
  await firstPopup.click();

  const categoryMap: Record<string, string> = { 資產: 'Assets', 負債: 'Liabilities', 收入: 'Income', 支出: 'Expenses' };
  const directionMap: Record<string, string> = { 增加: '增加', 減少: '減少' };
  for (const entry of entries) {
    const heading = page.getByText(entry.category, { exact: true }).first();
    const section = heading.locator('xpath=ancestor::section[1]');
    await section.locator('select').selectOption({ label: entry.name });
    await section.getByRole('button', { name: directionMap[entry.direction], exact: true }).click();
  }
  await verify.click();

  const failurePopup = page.getByRole('button', { name: '我知道了', exact: true });
  if (await failurePopup.count()) {
    const popupText = await page.locator('body').innerText();
    await failurePopup.click().catch(() => undefined);
    throw new Error(`財務檢核答案仍被拒絕：${popupText.slice(-800)}`);
  }
  const completed = page.getByRole('button', { name: '返回遊戲', exact: true });
  await expect(completed).toBeVisible({ timeout: 20_000 });
  await completed.click();
  return true;
};

const clickPrimaryCardAction = async (page: Page) => {
  const checkboxes = page.locator('input[type="checkbox"]:visible:not(:disabled)');
  if (await checkboxes.count()) {
    const checked = await checkboxes.evaluateAll((items) => items.some((item) => (item as HTMLInputElement).checked));
    if (!checked) await checkboxes.first().click();
  }

  const input = page.locator('input[type="number"]:visible').first();
  if (await input.count()) {
    const min = await input.getAttribute('min');
    if (min) await input.fill(min);
  }

  const clicked = await clickVisibleButton(page, [
    '送出故事分享確認',
    '送出分享確認',
    '進入財務檢核',
    '確認交易內容',
    '進入財務流程',
    '前往交易',
    '開始結算',
    /^(接受|參與|購買|申請|辦理|執行|套用|完成|出售|投入|確認)/,
  ]);
  return clicked;
};

const approveCoachRequests = async (coachPage: Page) => {
  for (let i = 0; i < 8; i += 1) {
    const approve = coachPage.getByRole('button', { name: '同意', exact: true });
    if (await approve.count() === 0) return;
    // 審核視窗有進場動畫且會隨請求更新重新掛載；單次點擊逾時不算失敗，下一輪會再試。
    await approve.first().click({ timeout: 3_000 }).catch(() => undefined);
    await coachPage.waitForTimeout(250);
  }
};

const processPlayerStep = async (page: Page, allowReveal = false) => {
  if (await openCardCover(page, allowReveal)) return 'reveal';
  if (await page.getByRole('button', { name: '確認檢核答案', exact: true }).count()) {
    await completeFinancialCheck(page);
    return 'financial';
  }
  if (await page.getByRole('button', { name: '返回遊戲', exact: true }).count()) {
    await page.getByRole('button', { name: '返回遊戲', exact: true }).click();
    return 'financial-close';
  }
  if (await page.getByRole('button', { name: '我知道了', exact: true }).count()) {
    await page.getByRole('button', { name: '我知道了', exact: true }).click();
    return 'alert';
  }

  const enabledTexts = await visibleEnabledButtons(page);
  const hasFamilyPrompt = enabledTexts.some(({ text }) => /家庭歷程|家庭重要歷程|要不要參與/.test(text));
  if (hasFamilyPrompt || enabledTexts.some(({ text }) => /^擲骰子/.test(text))) {
    const dice = page.getByRole('button', { name: /^擲骰子/ });
    for (let index = 0; index < await dice.count(); index += 1) {
      const candidate = dice.nth(index);
      if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
        await candidate.click();
        await page.waitForTimeout(700);
        return 'family-roll';
      }
    }
  }

  const cardAction = await clickPrimaryCardAction(page);
  if (cardAction) return cardAction;

  const fallback = await clickVisibleButton(page, [/^(關閉|放棄)$/]);
  return fallback || null;
};

const settleCurrentCard = async (handles: Awaited<ReturnType<typeof createRoom>>, pagesByUid: Map<string, Page>) => {
  const deadline = Date.now() + Number.parseInt(process.env.CARD_MATRIX_SETTLE_TIMEOUT_MS || '120000', 10);
  for (let cycle = 0; cycle < 240 && Date.now() < deadline; cycle += 1) {
    await approveCoachRequests(handles.coachPage);
    const pages = [...pagesByUid.values()];
    const before = await readRoom(handles.roomCode);
    const revealPage = before.boardState?.currentCardReveal?.isRevealed
      ? null
      : pagesByUid.get(before.boardState?.currentEvent?.playerUid || '');
    const steps = await Promise.all(pages.map((page) => processPlayerStep(page, page === revealPage).catch((error) => `error:${error.message}`)));
    if (steps.some(Boolean)) console.log(`[card-matrix] player steps: ${steps.join(', ')}`);
    if (steps.some((step) => typeof step === 'string' && step.startsWith('error:'))) {
      throw new Error(steps.find((step) => typeof step === 'string' && step.startsWith('error:')) as string);
    }
    const room = await readRoom(handles.roomCode);
    const board = room.boardState || {};
    const hasFlow = !!(
      board.currentEvent || board.currentCard || board.currentCardReveal || board.movement ||
      (board.pendingEvents || []).length || board.sharedCardPrompt || board.familyMilestoneJoinPrompt
    );
    if (!hasFlow) return room;
    if (!steps.some(Boolean)) await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('卡片流程 120 秒內未完成');
};

const classifyFailure = (error: unknown): Severity => {
  const message = error instanceof Error ? error.message : String(error);
  if (/權限|permission|重複|duplicate|跨玩家|資料|扣款|入帳|無法結束|未完成|卡住|逾時/.test(message)) return 'A';
  if (/規則待確認|partial|待補流程/.test(message)) return 'C';
  return 'B';
};

const saveEvidence = async (handles: Awaited<ReturnType<typeof createRoom>>, card: CardDefinition, index: number) => {
  const folder = path.join(EVIDENCE_ROOT, `${String(index).padStart(3, '0')}-${card.id}`);
  mkdirSync(folder, { recursive: true });
  const paths: string[] = [];
  const pages = [handles.coachPage, ...handles.playerPages];
  for (let i = 0; i < pages.length; i += 1) {
    const file = path.join(folder, `${i === 0 ? 'coach' : `player-${i}`}.png`);
    await pages[i].screenshot({ path: file, fullPage: false }).catch(() => undefined);
    paths.push(file);
  }
  const snapshot = await readRoom(handles.roomCode).catch(() => null);
  const snapshotFile = path.join(folder, 'room-snapshot.json');
  writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
  paths.push(snapshotFile);
  // 共享提示的回覆存在子集合，房間快照看不到；連同各玩家頁面文字一起保存，方便判斷卡在誰。
  const promptId = snapshot?.boardState?.sharedCardPrompt?.id || snapshot?.boardState?.familyMilestoneJoinPrompt?.id;
  const extra: Record<string, unknown> = {};
  if (promptId) {
    const responses = await roomRef(handles.roomCode).collection('events').doc(promptId).collection('responses').get().catch(() => null);
    extra.responses = responses ? responses.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : null;
  }
  extra.pageText = await Promise.all(pages.map((page) => page.locator('body').innerText().then((text) => text.slice(0, 1500)).catch(() => '')));
  const extraFile = path.join(folder, 'extra.json');
  writeFileSync(extraFile, JSON.stringify(extra, null, 2));
  paths.push(extraFile);
  return paths;
};

const recoverFlow = async (handles: Awaited<ReturnType<typeof createRoom>>, targetUid: string) => {
  await resetBoardFlow(handles.roomCode, targetUid);
  // 一張卡失敗後，玩家端可能殘留財務檢核／共享提示視窗，執行師端可能殘留審核彈窗；
  // 不清掉會讓後面每張卡都連鎖失敗，所以先處理審核、再重新載入玩家頁面。
  await approveCoachRequests(handles.coachPage).catch(() => undefined);
  await Promise.all(handles.playerPages.map(async (page) => {
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    await completePhotoConsentIfNeeded(page).catch(() => undefined);
    const resume = page.getByRole('button', { name: /繼續遊戲/ });
    await resume.first().click({ timeout: 10_000 }).catch(() => undefined);
    const skip = page.getByRole('button', { name: '跳過', exact: true });
    await skip.click({ timeout: 2_000 }).catch(() => undefined);
  }));
  await handles.coachPage.waitForTimeout(1_000);
};

test('3 位玩家＋1 位執行師逐張測試 160 張卡片（本地 Emulator）', async ({ browser }, testInfo) => {
  test.setTimeout(4 * 60 * 60 * 1000);
  test.skip(process.env.VITE_USE_EMULATOR !== 'true', '只允許在 VITE_USE_EMULATOR=true 執行');
  test.skip(!process.env.FIRESTORE_EMULATOR_HOST?.match(/^(localhost|127\.0\.0\.1):\d+$/), '只允許連接本地 Firestore Emulator');
  test.skip(!process.env.FIREBASE_AUTH_EMULATOR_HOST?.match(/^(localhost|127\.0\.0\.1):\d+$/), '只允許連接本地 Auth Emulator');

  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const allCards = readCardDefinitions();
  const requestedCardLimit = Number.parseInt(process.env.CARD_MATRIX_LIMIT || '', 10);
  const requestedIds = (process.env.CARD_MATRIX_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  const cards = requestedIds.length
    ? allCards.filter((card) => requestedIds.includes(card.id))
    : Number.isFinite(requestedCardLimit) && requestedCardLimit > 0
      ? allCards.slice(0, requestedCardLimit)
      : allCards;
  const results: CardResult[] = [];
  const report: any = {
    test: 'BOARD_3P_ALL_160_CARDS_LOCAL_2026-09-01',
    status: 'running',
    environment: {
      baseURL: 'http://127.0.0.1:5183',
      firestore: process.env.FIRESTORE_EMULATOR_HOST,
      auth: process.env.FIREBASE_AUTH_EMULATOR_HOST,
      database: process.env.VITE_REALTIME_DATABASE_EMULATOR_URL || 'http://127.0.0.1:9000',
      cards: cards.length,
      totalCards: allCards.length,
    },
    accounts: { players: 3, coach: 1 },
    startedAt: new Date().toISOString(),
    results,
    errors: [],
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  let handles: Awaited<ReturnType<typeof createRoom>> | null = null;
  try {
    const seeded = await seedAccounts();
    const authUsers = Object.values(seeded) as Array<{ uid: string }>;
    await Promise.all(authUsers.map(({ uid }) => db.collection('users').doc(uid).set({ activeGame: null }, { merge: true })));
    handles = await createRoom(browser);
    report.roomCode = handles.roomCode;
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    const { room, byUid } = await playerMapForRoom(handles.roomCode, handles.playerPages);
    const turnOrder = room.boardState.turnOrder as string[];

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const targetUid = turnOrder[index % turnOrder.length];
      const targetPage = byUid.get(targetUid)!;
      const targetMember = room.members?.find((member) => member.uid === targetUid);
      const startedAt = Date.now();
      const before = await readRoom(handles.roomCode);
      const result: CardResult = {
        index: index + 1,
        deck: card.deck,
        cardId: card.id,
        title: card.title,
        status: card.status,
        player: targetMember?.name || targetUid,
        startedAt: new Date(startedAt).toISOString(),
        outcome: 'failed',
        branch: card.choiceRequired ? '主要接受／執行流程' : '主要套用流程',
        expected: ['卡片可翻開', '玩家可完成主要操作', '結果只套用一次', '流程清除並可繼續遊戲'],
        roomRevisionBefore: before.boardState?.revision,
        errors: [],
        evidence: [],
      };
      try {
        await seedFinancialBaseline(handles.roomCode, before, targetUid, card);
        await resetBoardFlow(handles.roomCode, targetUid);
        await openCardConsoleAndTrigger(handles.coachPage, card, result.player);
        await waitForRoom(handles.roomCode, (current) => current.boardState?.currentCard?.cardId === card.id, `${card.id} 建立事件`);
        await expect(targetPage.getByText('事件封面 · 等待翻牌', { exact: true })).toBeVisible({ timeout: 15_000 });
        await settleCurrentCard(handles, byUid);
        const after = await readRoom(handles.roomCode);
        result.outcome = 'passed';
        result.finishedAt = new Date().toISOString();
        result.durationMs = Date.now() - startedAt;
        result.roomRevisionAfter = after.boardState?.revision;
        result.eventId = after.boardState?.lastEvent?.id || null;
        result.actual = ['事件已清除', '所有共享提示已清除', '可進入下一筆卡片測試'];
      } catch (error) {
        result.outcome = 'failed';
        result.severity = classifyFailure(error);
        result.errors.push(error instanceof Error ? error.message : String(error));
        result.finishedAt = new Date().toISOString();
        result.durationMs = Date.now() - startedAt;
        result.evidence = await saveEvidence(handles, card, index + 1);
        await recoverFlow(handles, targetUid).catch((recoveryError) => {
          result.errors.push(`恢復失敗：${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
        });
      }
      results.push(result);
      report.results = results;
      report.summary = {
        attempted: results.length,
        passed: results.filter((item) => item.outcome === 'passed').length,
        failed: results.filter((item) => item.outcome === 'failed').length,
        severityA: results.filter((item) => item.severity === 'A').length,
        severityB: results.filter((item) => item.severity === 'B').length,
        severityC: results.filter((item) => item.severity === 'C').length,
      };
      writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
      console.log(`[card-matrix] ${index + 1}/${cards.length} ${card.id} ${result.outcome}${result.severity ? ` (${result.severity})` : ''}`);
    }

    const closeCardConsole = handles.coachPage.getByRole('button', { name: '關閉卡片發送', exact: true });
    if (await closeCardConsole.count() && await closeCardConsole.isVisible().catch(() => false)) {
      await closeCardConsole.click();
    }
    await handles.coachPage.getByTitle('遊戲結算').click();
    await handles.coachPage.getByRole('button', { name: '確認', exact: true }).last().click();
    await waitForRoom(handles.roomCode, (current) => current.status === 'finished', '遊戲結算', 30_000);
    report.final = { roomCode: handles.roomCode, status: 'finished' };
    report.status = report.summary.severityA || report.summary.severityB ? 'failed' : report.summary.severityC ? 'conditional' : 'passed';
  } catch (error) {
    report.status = 'blocked';
    report.failure = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined };
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.testInfo = { status: testInfo.status, expectedStatus: testInfo.expectedStatus };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    if (handles) {
      await Promise.all([
        handles.coachContext.close(),
        ...handles.playerContexts.map((context) => context.close()),
      ]);
    }
  }
});

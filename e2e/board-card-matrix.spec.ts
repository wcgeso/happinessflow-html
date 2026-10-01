import { test, expect, type Browser, type BrowserContext, type Locator, type Page } from 'playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { completePhotoConsentIfNeeded, switchToCoachMode } from './fixtures/login';
import { seedAccounts, TEST_ACCOUNTS } from '../scripts/e2e/seedAccounts.mjs';
import { getEmulatorDb, getEmulatorAuth } from '../scripts/e2e/adminClient.mjs';

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
  financialProof?:Record<string,unknown>;
  projectionProof?:Record<string,unknown>;
  followupProof?:Record<string,unknown>;
  actions?: string[];
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
const TEST_BRANCH = process.env.CARD_MATRIX_BRANCH || 'accept';
const RUN_ID = process.env.CARD_MATRIX_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_PATH = `e2e/report/board-card-matrix-${RUN_ID}.json`;
const EVIDENCE_ROOT = path.resolve(`output/playwright/board-card-matrix-${RUN_ID}`);
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
        const text = (await candidate.innerText({timeout:1000}).catch(()=>null))?.trim();
        if (!text) continue;
        return await clickWhileSyncing(candidate) ? text : null;
      }
    }
  }
  return null;
};

const clickWhileSyncing = async (locator: Locator) => {
    try {
      await locator.click({ timeout: 3_000 });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!await locator.isVisible().catch(() => false)
        || /element was detached from the DOM|element is not stable|element is not visible|intercepts pointer events/i.test(message)) return false;
      throw error;
    }
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
  coachPage.on('console', async message => {
    if (message.type() !== 'warning') return;
    const details = await Promise.all(message.args().map(arg => arg.jsonValue().catch(() => '')));
    if (JSON.stringify(details).includes('共享卡片彈窗被擋住')) console.log(`[card-matrix] coach shared-prompt blocker: ${JSON.stringify(details)}`);
  });
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
    page.on('console', async message => {
      if (message.type() !== 'warning') return;
      const details = await Promise.all(message.args().map(arg => arg.jsonValue().catch(() => '')));
      if (JSON.stringify(details).includes('共享卡片彈窗被擋住')) console.log(`[card-matrix] player shared-prompt blocker: ${JSON.stringify(details)}`);
    });
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
  const displayContext=await browser.newContext({viewport:{width:1366,height:768}});
  const displayPage=await displayContext.newPage();
  await loginPlayer(displayPage,COACH.email,COACH.password,COACH.name);
  await displayPage.goto(`/?boardRoom=${roomCode}`);
  await expect(displayPage.locator('[data-projection-stage]')).toBeVisible({timeout:30000});
  return { roomCode, coachContext, coachPage, playerContexts, playerPages, displayContext, displayPage };
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
    { id: 'matrix-house-1', name: '測試單間住宅', cost: 1_000_000, downPayment: 300_000, cashflow: 10_000, type: '不動產', houseType: '1room', isInsured: process.env.CARD_MATRIX_ASSET_INSURED !== 'false' },
    { id: 'matrix-house-2', name: '測試兩房住宅', cost: 3_000_000, downPayment: 900_000, cashflow: 20_000, type: '不動產', houseType: '2room', isInsured: process.env.CARD_MATRIX_ASSET_INSURED !== 'false' },
    { id: 'matrix-store', name: '測試小型店面', cost: 5_000_000, downPayment: 1_500_000, cashflow: 50_000, type: '不動產', houseType: 'store_small', isInsured: process.env.CARD_MATRIX_ASSET_INSURED !== 'false' },
    { id: 'matrix-studio', name: '測試兼職工作室', cost: 1_000_000, downPayment: 1_000_000, cashflow: 20_000, type: '企業', enterpriseLevel: 1 },
    { id: 'matrix-enterprise', name: '測試企業', cost: 5_000_000, downPayment: 5_000_000, cashflow: 100_000, type: '企業', enterpriseLevel: 2 },
    { id: 'matrix-car', name: '測試汽車', cost: 600_000, downPayment: 120_000, cashflow: 0, type: '汽車', isInsured: process.env.CARD_MATRIX_ASSET_INSURED !== 'false' },
  ];
  const existing = (await playerRef(roomCode, targetUid).get()).data() || room.playerStates?.[targetUid] || {};
  const shouldStartLoan = card.id === 'N056' || card.id === 'N057' || card.id === 'N058';
  const nextState = {
    ...existing,
    cash: Number(process.env.CARD_MATRIX_CASH ?? 50_000_000),
    assets: shouldStartLoan
      ? baselineAssets.filter((asset) => asset.type !== '企業')
      : baselineAssets,
    liabilities: [],
    loans: 0,
    happiness: [],
    happinessTotal: 0,
    children: card.id === 'H020' ? 0 : 2,
    medicalInsuranceCount: 2,
    expenses: {
      taxes: 0, mortgage: 0, studentLoan: 0, creditCard: 0, other: 0,
      basicLiving: 0, transportEdu: 0, otherMedicalChild: 0,
    },
    income: { ...(existing.income || {}), salary: 100_000, investment: 0, other: 0 },
    completedHappinessEvents: card.id === 'H027' ? ['date'] : [],
    pendingStartupUpgradeAction: null,
    pendingStartupUpgradeActions: [],
    boardGameStartedAt: room.startedAt,
    sessionId: room.sessionId,
    isSetup: true,
  };

  const baselineWrites = [playerRef(roomCode, targetUid).set(nextState, { merge: true })];
  if (card.id === 'H020') {
    baselineWrites.push(...(room.boardState?.turnOrder || []).filter(uid => uid !== targetUid).map(uid =>
      playerRef(roomCode, uid).set({ children: 0, completedHappinessEvents: [], happiness: [], happinessTotal: 0, cash: 50_000_000 }, { merge: true })));
  }
  if (card.id === 'N055') {
    baselineWrites.push(...(room.boardState?.turnOrder || [])
      .filter(uid => uid !== targetUid)
      .map(uid => playerRef(roomCode, uid).set({ cash: 50_000_000 }, { merge: true })));
  }
  await Promise.all(baselineWrites);
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
    'boardState.pendingContinuation': null,
    'boardState.updatedAt': Date.now(),
  });
};

// Only the isolated emulator admin seeds the deck and starting square. The ordinary player rolls, lands and draws through the real UI.
const drawCardAsPlayer = async (roomCode:string, page:Page, card:CardDefinition, uid:string) => {
  const current=await readRoom(roomCode);
  const player=await playerRef(roomCode,uid).get();
  const diceCount=player.data()?.assets?.some((asset:any)=>asset.type==='汽車'||asset.type==='飛行器')?2:1;
  // The board's first three regular squares are happiness, news, opportunity. Fixture positions are emulator-only.
  const landing={happiness:8,news:9,opportunity:10}[card.deck];
  const start=(landing-diceCount+52)%52;
  const remaining=current.boardState.deckState[card.deck] as string[];
  await playerRef(roomCode,uid).set({boardPosition:start,skipTurns:0},{merge:true});
  await roomRef(roomCode).update({
    'boardState.hasRolledThisTurn':false,[`boardState.playerPositions.${uid}`]:start,
    [`boardState.skipTurns.${uid}`]:0,[`boardState.deckState.${card.deck}`]:[card.id,...remaining.filter(id=>id!==card.id)],
  });
  const roll=page.getByRole('button',{name:/^(擲骰子|立即擲骰)/});
  await expect(roll).toBeEnabled({timeout:15000});
  await page.evaluate(()=>{(window as any).__e2eOriginalRandom=Math.random;Math.random=()=>0;});
  try {await roll.click();} finally {await page.evaluate(()=>{Math.random=(window as any).__e2eOriginalRandom;});}
  const rolled=await waitForRoom(roomCode,room=>room.boardState?.hasRolledThisTurn===true,'一般玩家擲骰');
  expect(rolled.boardState.lastRoll.dice).toEqual(Array(diceCount).fill(1));
};

const openCardCover = async (page: Page, allowReveal: boolean) => {
  if (!allowReveal) return false;
  const cover = page.getByText('事件封面 · 等待翻牌', { exact: true });
  for (let index = 0; index < await cover.count(); index += 1) {
    const candidate = cover.nth(index);
    if (!await candidate.isVisible().catch(() => false)) continue;
    if (await candidate.evaluate((element) => getComputedStyle(element).opacity !== '1')) continue;
    if (!await clickWhileSyncing(candidate)) return false;
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
  const completedEarly=page.getByRole('button',{name:'返回遊戲',exact:true});
  const funding=page.getByRole('heading',{name:'需要先周轉資金',exact:true});
  await expect(firstPopup.or(completedEarly).or(funding).first()).toBeVisible({timeout:15000});
  if(await completedEarly.isVisible().catch(()=>false)){await clickWhileSyncing(completedEarly);return true;}
  if(await funding.isVisible().catch(()=>false)){if(await firstPopup.isVisible().catch(()=>false))await firstPopup.click();return true;}
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
    if(await funding.isVisible().catch(()=>false))return true;
    throw new Error(`財務檢核答案仍被拒絕：${popupText.slice(-800)}`);
  }
  const completed = page.getByRole('button', { name: '返回遊戲', exact: true });
  if (await completed.isVisible().catch(() => false)) {
    await clickWhileSyncing(completed);
  } else {
    // A successful transaction can immediately open its follow-up card, replacing this button.
    await page.waitForTimeout(500);
  }
  return true;
};

const clickPrimaryCardAction = async (page: Page) => {
  if (TEST_BRANCH === 'decline') {
    const declined = await clickVisibleButton(page, [/^(拒絕|放棄|略過|不參與|不購買|不接受|不執行|不辦理|不報名)/, '關閉']);
    if (declined) return declined;
  }
  const checkboxes = page.locator('input[type="checkbox"]:visible:not(:disabled)');
  if (await checkboxes.count()) {
    const checked = await checkboxes.evaluateAll((items) => items.some((item) => (item as HTMLInputElement).checked));
    if (!checked && !await clickWhileSyncing(checkboxes.first())) return null;
  }

  const input = page.locator('input[type="number"]:visible').first();
  if (await input.count()) {
    if (await page.getByText('投資金額', { exact: true }).isVisible().catch(() => false)) {
      await input.fill('1000000');
    } else {
      const min = await input.getAttribute('min');
      if (min && Number(await input.inputValue()) < Number(min)) await input.fill(min);
    }
  }

  const clicked = await clickVisibleButton(page, [
    process.env.CARD_MATRIX_PROPERTY_USE === 'rental' ? '出租購買' : '自用購買',
    '送出故事分享確認',
    '送出分享確認',
    '進入財務檢核',
    '進入出售',
    '確認交易內容',
    '進入財務流程',
    '前往交易',
    '開始結算',
    '抽一張幸福卡',
    '借信用貸款補差額',
    /^(接受|參與|參加|購買|申請|辦理|執行|套用|完成|出售|投入|確認)/,
  ]);
  return clicked;
};

const approveCoachRequests = async (coachPage: Page,roomCode?:string) => {
  for (let i = 0; i < 8; i += 1) {
    const approve = coachPage.getByRole('button', { name: '同意', exact: true });
    if (await approve.count() === 0) return;
    if(roomCode && (await readRoom(roomCode)).boardState?.currentCard?.cardId==='H009') {
      mkdirSync(EVIDENCE_ROOT,{recursive:true});
      await coachPage.screenshot({path:path.join(EVIDENCE_ROOT,`H009-${roomCode}-approval.png`)});
    }
    // 審核視窗有進場動畫且會隨請求更新重新掛載；單次點擊逾時不算失敗，下一輪會再試。
    await approve.first().click({ timeout: 3_000 }).catch(() => undefined);
    await coachPage.waitForTimeout(250);
  }
};

const reloadedLearningEvents=new Set<string>();
const learningEvidence=new Map<string,string>();
const capturedLearningResults=new Set<string>();
const fundingCashSince=(before:any,after:any)=>{
  const old=new Set((before.history || []).map((entry:any)=>entry.id));
  return (after.history || []).filter((entry:any)=>!old.has(entry.id) && entry.cashChange>0 && entry.name.includes('信用貸款')).reduce((sum:number,entry:any)=>sum+entry.cashChange,0);
};
const processPlayerStep = async (page: Page, allowReveal = false, closeBankIfBlocking = false,roomCode?:string) => {
  const closeBank = page.getByRole('button', { name: '關閉數位銀行', exact: true });
  if (closeBankIfBlocking && await closeBank.isVisible().catch(() => false)) {
    await clickWhileSyncing(closeBank);
    return 'close-blocking-bank';
  }
  if (await openCardCover(page, allowReveal)) return 'reveal';
  const fundingHeading=page.getByRole('heading',{name:'需要先周轉資金',exact:true});
  if(await fundingHeading.isVisible().catch(()=>false)) {
    if(/同步權限不足|交易權限不足/.test(await page.locator('body').innerText()))throw new Error('周轉交易權限不足，停止自動重送');
    const popup=page.getByRole('button',{name:'我知道了',exact:true});
    if(await popup.isVisible().catch(()=>false))await clickWhileSyncing(popup);
    if(await clickWhileSyncing(page.getByRole('button',{name:'借信用貸款補差額',exact:true})))return 'funding-loan';
    return null;
  }
  const existingError=page.getByRole('button',{name:'我知道了',exact:true});
  if(await existingError.isVisible().catch(()=>false)) throw new Error(`操作失敗視窗：${(await page.locator('body').innerText()).slice(-1400)}`);
  if (await page.getByRole('button', { name: '確認檢核答案', exact: true }).count()) {
    await completeFinancialCheck(page);
    return 'financial';
  }
  if (await page.getByRole('button', { name: '返回遊戲', exact: true }).count()) {
    await clickWhileSyncing(page.getByRole('button', { name: '返回遊戲', exact: true }));
    return 'financial-close';
  }
  if (await page.getByRole('button', { name: '我知道了', exact: true }).count()) {
    await page.getByRole('button', { name: '我知道了', exact: true }).click();
    return 'alert';
  }

  const learningDice=page.getByRole('button',{name:/點擊骰子開始/});
  if(await learningDice.isVisible().catch(()=>false)&&await learningDice.isEnabled()) {
    if(roomCode && process.env.CARD_MATRIX_RELOAD_LEARNING==='true') {
      const before=await readRoom(roomCode);const pending=before.boardState?.pendingContinuation;
      if(pending?.cardId)learningEvidence.set(roomCode,pending.cardId);
      if(pending?.phase==='awaiting_roll'&&!reloadedLearningEvents.has(pending.sourceEventId)) {
        const uid=pending.playerUid;const paidState=(await playerRef(roomCode,uid).get()).data();
        const paidReceipts=await playerRef(roomCode,uid).collection('commandResults').get();
        reloadedLearningEvents.add(pending.sourceEventId);await page.reload();
        await expect(learningDice).toBeVisible({timeout:15000});
        expect((await readRoom(roomCode)).boardState?.pendingContinuation).toEqual(pending);
        expect((await playerRef(roomCode,uid).get()).data()?.cash,'重開不得再次扣款').toBe(paidState?.cash);
        expect((await playerRef(roomCode,uid).collection('commandResults').get()).size,'重開不得建立新的財務命令').toBe(paidReceipts.size);
        return 'learning-recovered-after-reload';
      }
    }
    const learningRoll=Number(process.env.CARD_MATRIX_LEARNING_ROLL || 6);
    await page.evaluate(value=>{(window as any).__e2eOriginalLearningRandom=Math.random;Math.random=()=>((value-1)+0.01)/6;},learningRoll);
    try {await learningDice.click();}finally{await page.evaluate(()=>{Math.random=(window as any).__e2eOriginalLearningRandom;});}
    return 'learning-roll';
  }
  const learningClose=page.getByRole('button',{name:/^(領取獎勵並關閉|回首頁)$/});
  if(await learningClose.isVisible().catch(()=>false)){
    const cardId=roomCode && learningEvidence.get(roomCode);
    const pending=roomCode ? (await readRoom(roomCode)).boardState?.pendingContinuation : null;
    if(cardId && pending?.cardId===cardId && !capturedLearningResults.has(pending.sourceEventId)){
      const heading=page.getByRole('heading',{name:/^(考試通過|未通過)$/});
      await expect(heading).toBeVisible();
      const modal=heading.locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
      mkdirSync(EVIDENCE_ROOT,{recursive:true});
      await modal.screenshot({path:path.join(EVIDENCE_ROOT,`${cardId}-${roomCode}-result.png`)});
      await expect(learningClose).toBeVisible();
      capturedLearningResults.add(pending.sourceEventId);
    }
    if(await clickWhileSyncing(learningClose)) return 'learning-close';
    return null;
  }

  const enabledTexts = await visibleEnabledButtons(page);
  const hasFamilyPrompt = enabledTexts.some(({ text }) => /家庭歷程|家庭重要歷程|要不要參與/.test(text));
  if (hasFamilyPrompt || enabledTexts.some(({ text }) => /^(擲骰子|立即擲骰)/.test(text))) {
    const dice = page.getByRole('button', { name: /^(擲骰子|立即擲骰)/ });
    for (let index = 0; index < await dice.count(); index += 1) {
      const candidate = dice.nth(index);
      if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
        const forcedFamilyRoll = process.env.CARD_MATRIX_FAMILY_ROLL;
        if (forcedFamilyRoll) await page.evaluate(roll => {
          (window as any).__e2eFamilyRandom = Math.random;
          Math.random = () => (roll - 1 + 0.01) / 6;
        }, Number(forcedFamilyRoll));
        try { if (!await clickWhileSyncing(candidate)) return null; }
        finally { if (forcedFamilyRoll) await page.evaluate(() => { Math.random = (window as any).__e2eFamilyRandom; }); }
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

const settleCurrentCard = async (handles: Awaited<ReturnType<typeof createRoom>>, pagesByUid: Map<string, Page>, actions: string[], result:CardResult) => {
  const deadline = Date.now() + Number.parseInt(process.env.CARD_MATRIX_SETTLE_TIMEOUT_MS || '120000', 10);
  for (let cycle = 0; cycle < 240 && Date.now() < deadline; cycle += 1) {
    await approveCoachRequests(handles.coachPage,handles.roomCode);
    const before = await readRoom(handles.roomCode);
    const sharedPromptActive = !!(before.boardState?.sharedCardPrompt || before.boardState?.familyMilestoneJoinPrompt);
    const activePlayerPage = pagesByUid.get(before.boardState?.currentEvent?.playerUid || '');
    const pages = sharedPromptActive ? [...pagesByUid.values()] : activePlayerPage ? [activePlayerPage] : [];
    const revealPage = before.boardState?.currentCardReveal?.isRevealed
      ? null
      : pagesByUid.get(before.boardState?.currentEvent?.playerUid || '');
    const steps = await Promise.all(pages.map((page) => processPlayerStep(page, page === revealPage, sharedPromptActive, handles.roomCode).catch((error) => `error:${error.message}`)));
    actions.push(...steps.filter((step): step is string => !!step));
    if (steps.some(Boolean)) console.log(`[card-matrix] player steps: ${steps.join(', ')}`);
    if (steps.some((step) => typeof step === 'string' && step.startsWith('error:'))) {
      throw new Error(steps.find((step) => typeof step === 'string' && step.startsWith('error:')) as string);
    }
    const room = await readRoom(handles.roomCode);
    const board = room.boardState || {};
    if(result.cardId==='C056' && !result.followupProof && board.currentCard?.deck==='news' && board.currentCardReveal?.isRevealed) {
      const page=pagesByUid.get(board.currentEvent.playerUid)!;
      const file=path.join(EVIDENCE_ROOT,`C056-${handles.roomCode}-news.png`);
      mkdirSync(EVIDENCE_ROOT,{recursive:true});
      if (board.sharedCardPrompt?.sourceEventId === board.currentEvent.id) {
        await expect(page.getByText('共享卡片事件', { exact: true })).toBeVisible();
        await expect(page.getByText(new RegExp(`抽到 ${board.currentCard.cardId}[。.]`)).first()).toBeVisible();
      } else {
        await expect(page.getByText(board.currentCard.title, { exact: true }).first()).toBeVisible({ timeout: 10000 });
      }
      await page.screenshot({path:file});
      result.evidence.push(file);
      result.followupProof={eventId:board.currentEvent.id,newsCardId:board.currentCard.cardId,cloudRevealed:true};
    }
    const hasFlow = !!(
      board.currentEvent || board.currentCard || board.currentCardReveal || board.movement ||
      (board.pendingEvents || []).length || board.sharedCardPrompt || board.familyMilestoneJoinPrompt
    );
    if (!hasFlow) return room;
    if (!steps.some(Boolean)) await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`卡片流程在指定期限內未完成（${process.env.CARD_MATRIX_SETTLE_TIMEOUT_MS || '120000'}ms）`);
};

const clearPlayerOverlays = async (pages: Page[]) => Promise.all(pages.map(async page => {
  const alert = page.getByRole('button', { name: '我知道了', exact: true });
  if (await alert.isVisible().catch(() => false)) await clickWhileSyncing(alert);
  const returnToGame = page.getByRole('button', { name: '返回遊戲', exact: true });
  if (await returnToGame.isVisible().catch(() => false)) await clickWhileSyncing(returnToGame);
  const closeBank = page.getByRole('button', { name: '關閉數位銀行', exact: true });
  if (await closeBank.isVisible().catch(() => false)) await clickWhileSyncing(closeBank);
}));

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
    const closeBank = page.getByRole('button', { name: '關閉數位銀行', exact: true });
    await closeBank.click({ timeout: 2_000 }).catch(() => undefined);
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
  const selectedCards = requestedIds.length
    ? allCards.filter((card) => requestedIds.includes(card.id))
    : Number.isFinite(requestedCardLimit) && requestedCardLimit > 0
      ? allCards.slice(0, requestedCardLimit)
      : allCards;
  const cards = TEST_BRANCH === 'decline' ? selectedCards.filter(card => card.choiceRequired) : selectedCards;
  const results: CardResult[] = [];
  const report: any = {
    test: 'BOARD_3P_ALL_160_CARDS_LOCAL_2026-09-01',
    status: 'running',
    environment: {
      baseURL: `http://127.0.0.1:${process.env.E2E_SERVER_PORT || '5183'}`,
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
    if(process.env.CARD_MATRIX_COACH_RECOVERY==='true') {
      const uid=turnOrder[0], coachUid=(await getEmulatorAuth().getUserByEmail(COACH.email)).uid;
      const scope=`${handles.roomCode}:${(await roomRef(handles.roomCode).get()).data()!.sessionId}:${coachUid}`;
      const key=`hf-coach-intent:${scope}`;
      const preserve=async()=>handles!.coachPage.evaluate(()=>{
        const remove=Storage.prototype.removeItem;
        Storage.prototype.removeItem=function(key){if(!key.startsWith('hf-coach-intent:'))return remove.call(this,key);};
      });
      const statesBefore=Object.fromEntries(await Promise.all(turnOrder.map(async uid=>[uid,(await playerRef(handles!.roomCode,uid).get()).data()!])));
      await preserve();
      const input=handles.coachPage.getByRole('spinbutton',{name:'現金調整金額'});
      await input.fill('10000');
      await input.locator('xpath=..').getByRole('button',{name:'+ 增加',exact:true}).click();
      await expect.poll(async()=>(await playerRef(handles!.roomCode,uid).get()).data()?.cash,{timeout:15000}).toBe(statesBefore[uid].cash+10000);
      const receiptCount=(await playerRef(handles.roomCode,uid).collection('commandResults').get()).size;
      await expect.poll(()=>handles!.coachPage.evaluate(key=>localStorage.getItem(key),key)).toBeTruthy();
      await handles.coachPage.reload();
      await handles.coachPage.getByRole('button',{name:'安全核對原財務操作',exact:true}).click();
      await expect(handles.coachPage.getByRole('button',{name:'安全核對原財務操作',exact:true})).not.toBeVisible({timeout:15000});
      expect((await playerRef(handles.roomCode,uid).get()).data()?.cash).toBe(statesBefore[uid].cash+10000);
      expect((await playerRef(handles.roomCode,uid).collection('commandResults').get()).size).toBe(receiptCount);
      const beforeSubsidy=Object.fromEntries(await Promise.all(turnOrder.map(async uid=>[uid,(await playerRef(handles!.roomCode,uid).get()).data()!.cash])));
      await preserve();
      await handles.coachPage.getByRole('spinbutton',{name:'全體補助金額'}).fill('5000');
      await handles.coachPage.getByRole('button',{name:'發放給有效玩家',exact:true}).click();
      await handles.coachPage.getByRole('button',{name:'確認',exact:true}).last().click();
      for(const uid of turnOrder)await expect.poll(async()=>(await playerRef(handles!.roomCode,uid).get()).data()?.cash,{timeout:15000}).toBe(beforeSubsidy[uid]+5000);
      await expect.poll(()=>handles!.coachPage.evaluate(key=>localStorage.getItem(key),key)).toBeTruthy();
      const subsidyReceipt=(await roomRef(handles.roomCode).collection('coachCommands').get()).docs;
      expect(subsidyReceipt).toHaveLength(1);
      await handles.coachPage.reload();
      await handles.coachPage.getByRole('button',{name:'安全核對原財務操作',exact:true}).click();
      await expect(handles.coachPage.getByRole('button',{name:'安全核對原財務操作',exact:true})).not.toBeVisible({timeout:15000});
      for(const uid of turnOrder)expect((await playerRef(handles.roomCode,uid).get()).data()?.cash).toBe(beforeSubsidy[uid]+5000);
      expect((await roomRef(handles.roomCode).collection('coachCommands').get()).size).toBe(1);
      report.coachRecoveryProof={cashReceiptCount:receiptCount,subsidyCommand:subsidyReceipt[0].id,recipients:turnOrder.length,duplicateEffects:0};
    }


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
        branch: TEST_BRANCH === 'decline' ? '拒絕／關閉流程' : card.choiceRequired ? '主要接受／執行流程' : '主要套用流程',
        expected: ['卡片可翻開', '玩家可完成主要操作', '結果只套用一次', '流程清除並可繼續遊戲'],
        roomRevisionBefore: before.boardState?.revision,
        errors: [],
        evidence: [],
      };
      try {
        await seedFinancialBaseline(handles.roomCode, before, targetUid, card);
        await resetBoardFlow(handles.roomCode, targetUid);
        await clearPlayerOverlays(handles.playerPages);
        const peerBefore=Object.fromEntries(await Promise.all(turnOrder.map(async uid=>[uid,(await playerRef(handles.roomCode,uid).get()).data()!])));
        const financeBefore=peerBefore[targetUid];
        const receiptsBefore=await playerRef(handles.roomCode,targetUid).collection('commandResults').get();
        const oldReceiptIds=new Set(receiptsBefore.docs.map(row=>row.id));
        const oldEffectIds=new Set((await roomRef(handles.roomCode).collection('financialEffects').get()).docs.map(row=>row.id));
        const expenseReceiptsBefore=['C045','C046','C047','C048'].includes(card.id) ? Object.fromEntries(await Promise.all(turnOrder.map(async uid=>[uid,new Set((await playerRef(handles.roomCode,uid).collection('commandResults').get()).docs.map(row=>row.id))]))) : {};
        await drawCardAsPlayer(handles.roomCode,targetPage,card,targetUid);
        await waitForRoom(handles.roomCode, (current) => current.boardState?.currentCard?.cardId === card.id, `${card.id} 建立事件`);
        await expect(targetPage.getByText('事件封面 · 等待翻牌', { exact: true })).toBeVisible({ timeout: 15_000 });
        result.actions = [];
        if (card.id === 'N001' && process.env.CARD_MATRIX_RELOAD_REVEAL === 'true') {
          // Test the ordinary player's reveal with no CSS transitionend, then restore it.
          await targetPage.addStyleTag({ content: '[style*="preserve-3d"] { transition: none !important; }' });
          await targetPage.getByText('事件封面 · 等待翻牌', { exact: true }).click();
          const source = readCardDefinitions().find(entry => entry.id === card.id) as any;
          await waitForRoom(handles.roomCode, current => current.boardState?.currentCardReveal?.isRevealed === true &&
            Object.entries(source.effects.prices).every(([symbol, price]) => (current as any).marketPrices?.[symbol] === price), '市場效果不依賴動畫回呼');
          await targetPage.reload();
          await expect(targetPage.getByRole('button', { name: '關閉', exact: true }).last()).toBeEnabled({ timeout: 15000 });
          result.actions.push('revealed-without-transition-and-recovered-after-reload');
        }
        if(card.id==='C034') {
          const event=(await readRoom(handles.roomCode)).boardState.currentEvent;
          await targetPage.getByText('事件封面 · 等待翻牌',{exact:true}).click();
          await waitForRoom(handles.roomCode,current=>current.boardState?.currentCardReveal?.isRevealed===true,'C034 雲端翻牌');
          const projected=handles.displayPage.locator('[data-projection-card][data-card-id="C034"] [data-projection-card-content]');
          await expect(projected).toHaveAttribute('aria-hidden','false',{timeout:10000});
          await expect(projected).toBeVisible();
          mkdirSync(EVIDENCE_ROOT,{recursive:true});
          const imagePath=path.join(EVIDENCE_ROOT,`C034-${handles.roomCode}-projection.png`);
          await projected.screenshot({path:imagePath});result.evidence.push(imagePath);
          result.projectionProof={eventId:event.id,cloudReveal:true,displayVisible:true};
          result.actions.push('reveal-with-projection-proof');
        }
        if (card.id === 'H020') {
          await expect.poll(async () => {
            if (!(await readRoom(handles.roomCode)).boardState?.currentCardReveal?.isRevealed) {
              await processPlayerStep(targetPage, true, false, handles.roomCode);
            }
            return (await readRoom(handles.roomCode)).boardState?.currentCardReveal?.isRevealed;
          }, { timeout: 15000 }).toBe(true);
          result.actions.push('reveal');
          const sharedRoom = await waitForRoom(handles.roomCode, current => current.boardState?.familyMilestoneJoinPrompt?.targetPlayerUids?.length === 2, 'H020 三人共享提示');
          result.eventId = sharedRoom.boardState.familyMilestoneJoinPrompt.id;
        }
        await settleCurrentCard(handles, byUid, result.actions,result);
        if (result.actions.some(action => /^(關閉|放棄)$/.test(action)) && !result.actions.includes('financial')) result.branch = '關閉／拒絕／無效果流程';
        await clearPlayerOverlays(handles.playerPages);
        const after = await readRoom(handles.roomCode);
        if(TEST_BRANCH !== 'decline' && ['C003','C005','C007'].includes(card.id)) {
          const financeAfter=(await playerRef(handles.roomCode,targetUid).get()).data()!;
          const receiptsAfter=await playerRef(handles.roomCode,targetUid).collection('commandResults').get();
          const fresh=receiptsAfter.docs.filter(row=>!oldReceiptIds.has(row.id)).map(row=>row.data());
          const source=readCardDefinitions().find(entry=>entry.id===card.id) as any;
          const expectedFee=Number(source.amount.schoolFee);
          const fundingCash=fundingCashSince(financeBefore,financeAfter);
          expect(result.actions).toContain('financial');
          expect(financeAfter.cash,'終身學習只能扣一次費用').toBe(financeBefore.cash+fundingCash-expectedFee);
          const rolls=fresh.filter(row=>row.originalCommandId?.startsWith('skill-roll:'));
          expect(rolls,'成功或失敗判定必須持久保存一次').toHaveLength(1);
          expect(fresh.filter(row=>row.originalCommandId?.startsWith('fin:')),'付款只建立一次').toHaveLength(1);
          const expectedRoll = Number(process.env.CARD_MATRIX_LEARNING_ROLL || 6);
          expect(rolls[0].result).toMatchObject({roll:expectedRoll,success:expectedRoll >= source.multiplier.diceRequirement});
          const abilityKey = card.id === 'C003' ? 'professionAbilityCount' : card.id === 'C005' ? 'stockAbilityCount' : 'realEstateAbilityCount';
          const succeeded = expectedRoll >= source.multiplier.diceRequirement;
          expect(financeAfter.abilities?.[abilityKey] || 0, '能力效果只能套用一次').toBe((financeBefore.abilities?.[abilityKey] || 0) + (succeeded ? 1 : 0));
          if (card.id === 'C005') expect(financeAfter.assets.find((asset:any)=>asset.id === 'matrix-stock-a10')?.quantity).toBe(succeeded ? 200 : 100);
          result.financialProof={cashBefore:financeBefore.cash,cashAfter:financeAfter.cash,abilitiesBefore:financeBefore.abilities,abilitiesAfter:financeAfter.abilities,receipts:fresh};
        }
        if (TEST_BRANCH !== 'decline' && card.type === 'real_estate' && result.actions.includes('financial')) {
          const state = (await playerRef(handles.roomCode,targetUid).get()).data()!;
          const source = readCardDefinitions().find(entry=>entry.id===card.id) as any;
          const oldAssetIds = new Set(financeBefore.assets.map((asset:any)=>asset.id));
          const purchases = state.assets.filter((asset:any)=>!oldAssetIds.has(asset.id));
          expect(purchases, '購屋只建立一筆資產').toHaveLength(1);
          const asset = purchases[0];
          const selfUse = result.actions.includes('自用購買');
          expect(state.cash, '頭期款只能扣一次').toBe(financeBefore.cash+fundingCashSince(financeBefore,state)-source.amount.downPayment);
          expect(asset).toMatchObject({cost:source.amount.totalPrice,downPayment:source.amount.downPayment,cashflow:selfUse ? 0 : source.amount.rent,isSelfUse:selfUse});
          const loans = state.liabilities.filter((liability:any)=>liability.linkedAssetId===asset.id);
          expect(loans, '購屋只建立一筆對應貸款').toHaveLength(1);
          expect(loans[0]).toMatchObject({totalOwed:source.amount.loanAmount,monthlyPayment:source.amount.monthlyPayment});
          const fresh=(await playerRef(handles.roomCode,targetUid).collection('commandResults').get()).docs.filter(row=>!oldReceiptIds.has(row.id)).map(row=>row.data());
          expect(fresh.filter(row=>row.originalCommandId?.startsWith('card-purchase:')), '購屋只有一次交易結果').toHaveLength(1);
          result.financialProof = {cashBefore:financeBefore.cash,cashAfter:state.cash,asset,loan:loans[0],receipts:fresh};
        }
        if(TEST_BRANCH !== 'decline' && ['C045','C046','C047','C048'].includes(card.id)) {
          const source=readCardDefinitions().find(entry=>entry.id===card.id) as any;
          const category=card.id==='C047' ? 'transportEdu' : 'basicLiving';
          const delta=Number(source.amount.monthlyExpenseChange);
          const proof:Record<string,unknown>={};
          for(const uid of turnOrder) {
            await expect.poll(async()=>Number((await playerRef(handles.roomCode,uid).get()).data()?.expenses?.[category]),{timeout:15000}).toBe(Number(peerBefore[uid].expenses[category])+delta);
            const state=(await playerRef(handles.roomCode,uid).get()).data()!;
            const fresh=(await playerRef(handles.roomCode,uid).collection('commandResults').get()).docs.filter(row=>!expenseReceiptsBefore[uid].has(row.id) && row.data().originalCommandId?.startsWith('shared-tx:'));
            expect(fresh,'共享支出本人只能入帳一次').toHaveLength(1);
            proof[uid]={before:peerBefore[uid].expenses[category],after:state.expenses[category],receiptId:fresh[0].id};
          }
          const effects=await roomRef(handles.roomCode).collection('financialEffects').get();
          const matching=effects.docs.filter(row=>!oldEffectIds.has(row.id) && row.data().kind==='expense');
          expect(matching,'本人共享交易不得再廣播一次支出').toHaveLength(0);
          result.financialProof={category,delta,players:proof,broadcastEffects:0};
        }
        if (card.id === 'H020') {
          const sourceEventId = result.eventId;
          expect(sourceEventId, 'H020 必須實際建立共享回覆文件').toBeTruthy();
          const responses = (await roomRef(handles.roomCode).collection('events').doc(sourceEventId!).collection('responses').get()).docs;
          expect(responses).toHaveLength(2);
          expect(responses.every(doc => doc.data().actionCompleted === true)).toBe(true);
          const endTurn = targetPage.getByRole('button', { name: '結束回合', exact: true });
          await expect(endTurn).toBeEnabled({ timeout: 10000 });
          const imagePath = path.join(EVIDENCE_ROOT, `H020-${handles.roomCode}-end-turn.png`);
          await targetPage.screenshot({ path: imagePath });
          result.evidence.push(imagePath);
          for (const uid of turnOrder) {
            const state = (await playerRef(handles.roomCode, uid).get()).data()!;
            const applied = uid === targetUid || responses.some(doc => doc.id === uid && doc.data().status === 'passed');
            expect(state.cash, '家庭歷程只能扣一次款').toBe(peerBefore[uid].cash - (applied ? 3000 : 0));
            expect(state.happinessTotal).toBe(peerBefore[uid].happinessTotal + (applied ? 2 : 0));
          }
          await endTurn.click();
          await waitForRoom(handles.roomCode, current => current.boardState?.currentTurnUid !== targetUid, 'H020 正常結束回合');
          result.followupProof = { responses: responses.map(doc => doc.data()), endTurnCompleted: true };
        }
        if (TEST_BRANCH !== 'decline' && card.id === 'H009') {
          const state = (await playerRef(handles.roomCode,targetUid).get()).data()!;
          expect(state.happinessTotal, 'H009 核准只能發兩點幸福').toBe(financeBefore.happinessTotal + 2);
          expect(state.cash).toBe(financeBefore.cash);
          result.financialProof = { happinessBefore: financeBefore.happinessTotal, happinessAfter: state.happinessTotal };
        }
        if(['C003','C005','C007'].includes(card.id))result.evidence.push(path.join(EVIDENCE_ROOT,`${card.id}-${handles.roomCode}-result.png`));
        if(card.id==='H009')result.evidence.push(path.join(EVIDENCE_ROOT,`H009-${handles.roomCode}-approval.png`));
        result.outcome = 'passed';
        result.finishedAt = new Date().toISOString();
        result.durationMs = Date.now() - startedAt;
        result.roomRevisionAfter = after.boardState?.revision;
        result.eventId = after.boardState?.lastEvent?.id || null;
        result.actual = ['事件已清除', '所有共享提示已清除', '可進入下一筆卡片測試'];
      } catch (error) {
        if (targetPage.isClosed()) {report.status='interrupted';report.errors.push('瀏覽器已關閉，剩餘卡片未測試');break;}
        result.outcome = 'failed';
        result.severity = classifyFailure(error);
        result.errors.push(error instanceof Error ? error.message : String(error));
        result.finishedAt = new Date().toISOString();
        result.durationMs = Date.now() - startedAt;
        result.evidence = await saveEvidence(handles, card, index + 1);
        try {await recoverFlow(handles,targetUid);} catch(recoveryError) {
          result.errors.push(`恢復失敗：${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
          results.push(result);report.results=results;
          throw new Error(`測試環境無法恢復，停止剩餘卡片：${result.errors.at(-1)}`);
        }
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
    report.status = report.summary.failed ? 'failed' : 'passed';
    expect(results.filter(item=>item.outcome!=='passed').map(item=>({cardId:item.cardId,errors:item.errors}))).toEqual([]);
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
        handles.displayContext.close(),
        ...handles.playerContexts.map((context) => context.close()),
      ]);
    }
  }
});

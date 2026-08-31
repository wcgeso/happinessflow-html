import { chromium } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5183';
const assetDir = '/Users/wcg/程式開發/蜂富人生HappinessFlow/第二人生/preview-site/assets';

const login = async (page, email, password, path = '/') => {
  await page.goto(`${baseURL}${path}`);
  const inputs = page.locator('form input[type="text"]');
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await page.getByRole('button', { name: '登入', exact: true }).waitFor({ state: 'detached' });
};

const browser = await chromium.launch({ headless: true });

try {
  const coachContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const coachPage = await coachContext.newPage();
  await login(coachPage, 'coach.local@hf.test', 'Coach123!');
  await coachPage.locator('.fixed.bottom-6.right-6 > button').click();
  await coachPage.getByRole('button', { name: '執行師模式' }).click();
  await coachPage.getByText('建立新遊戲').click();
  await coachPage.getByRole('button', { name: '1', exact: true }).click();
  await coachPage.getByText('線上棋盤').click();
  await coachPage.getByRole('button', { name: '開啟房間' }).click();

  const roomCodeButton = coachPage.getByRole('button', { name: /房間碼/ });
  await roomCodeButton.waitFor({ state: 'visible' });
  const roomCode = (await roomCodeButton.innerText()).match(/\d{6}/)?.[0];
  if (!roomCode) throw new Error('Room code was not rendered');

  const playerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const playerPage = await playerContext.newPage();
  await login(playerPage, 'p1.local@hf.test', 'Player123!');
  await playerPage.getByPlaceholder('請輸入 6 位數房間碼').fill(roomCode);
  await playerPage.getByRole('button', { name: '進入' }).click();

  await coachPage.getByRole('button', { name: '開始遊戲' }).waitFor({ state: 'visible' });
  await coachPage.getByRole('button', { name: '開始遊戲' }).click();

  await playerPage.getByRole('button', { name: '確認選擇並前往：選擇企業' }).click();
  await playerPage.getByRole('button', { name: '確認選擇並前往：選擇夢想' }).click();
  await playerPage.getByRole('button', { name: '確認選擇並開始遊戲' }).click();

  await coachPage.getByText('所有玩家已準備就緒').waitFor({ state: 'visible' });
  await coachPage.getByRole('button', { name: '開始遊戲' }).click();

  await playerPage.getByRole('button', { name: /^擲骰子/ }).waitFor({ state: 'visible', timeout: 30_000 });
  const skipTutorial = playerPage.getByRole('button', { name: '跳過', exact: true });
  if (await skipTutorial.isVisible()) {
    await skipTutorial.click();
    await skipTutorial.waitFor({ state: 'detached' });
  }
  await playerPage.waitForTimeout(1200);
  await playerPage.screenshot({ path: `${assetDir}/game-mobile-board.png` });

  await playerPage.getByRole('button', { name: '開啟數位銀行' }).click();
  await playerPage.waitForTimeout(500);
  await playerPage.screenshot({ path: `${assetDir}/game-mobile-bank.png` });

  const displayPage = await coachContext.newPage();
  await displayPage.goto(`${baseURL}/?boardRoom=${roomCode}`);
  await displayPage.locator('[data-projection-stage]').waitFor({ state: 'visible', timeout: 30_000 });
  await displayPage.waitForTimeout(800);
  await displayPage.screenshot({ path: `${assetDir}/game-board-map.png` });

  console.log(JSON.stringify({ roomCode, screenshots: 3 }));
} finally {
  await browser.close();
}

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
test.setTimeout(300_000);

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

test('銀行同一事件可合法借兩次，重開查核原借還款不重複入帳', async ({ browser }) => {
  const seeded = await seedAccounts();
  await Promise.all(Object.values(seeded).map((account:any)=>getEmulatorDb().collection('users').doc(account.uid).set({activeGame:null},{merge:true})));

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

  const playerContext = await browser.newContext({viewport:{width:390,height:844}});
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

  await playerPage.evaluate(uid=>localStorage.setItem(`happiness_flow_board_tutorial_seen_v1_${uid}`,'true'),playerUid);
  await playerPage.reload();
  await expect(playerPage.getByRole('button',{name:'開啟數位銀行',exact:true})).toBeVisible({timeout:20000});
  const original = (await playerDocRef.get()).data()!;
  await playerDocRef.update({cash:500000,profession:{...original.profession,salary:100000},income:{salary:100000,investment:0,other:0},liabilities:[],loans:0});
  const bankEventId=`${playerUid}_intent_recovery_bank`;
  await roomRef.update({'boardState.currentEvent':{id:bankEventId,playerUid,playerName:'Player1',type:'bank',summary:'測試到達銀行',detail:'借還款接續驗證',squareIndex:6,timestamp:Date.now()},'boardState.hasRolledThisTurn':true,'boardState.pendingEvents':[],'boardState.movement':null});
  await playerPage.getByRole('button',{name:'確認收訖',exact:true}).click();
  await expect(playerPage.getByRole('button',{name:/購買保險/})).toBeVisible({timeout:15000});
  const baseline=(await playerDocRef.get()).data()!;
  const baselineReceipts=(await playerDocRef.collection('commandResults').get()).size;
  const revision=(await roomRef.get()).data()!.boardState.revision;
  const storageKey=`hf-financial-intent:${roomCode}:${(await roomRef.get()).data()!.sessionId}:${playerUid}`;
  const openBanking=async(repay=false)=>{
    await playerPage.getByRole('button',{name:/購買保險/}).click();
    await playerPage.getByRole('button',{name:'信用貸款',exact:true}).click();
    if(repay)await playerPage.getByRole('button',{name:'償還各類貸款',exact:true}).click();
    await playerPage.locator('input[type="number"]:visible').fill('100000');
    await playerPage.getByRole('button',{name:repay?'確認償還貸款':'確認申請貸款',exact:true}).click();
  };
  const check=async(direction:'增加'|'減少')=>{
    for(const [category,label] of [['資產','現金'],['負債','信用貸款'],['支出','信貸利息']]){
      const section=playerPage.getByText(category,{exact:true}).first().locator('xpath=ancestor::section[1]');
      await section.locator('select').selectOption({label});
      await section.getByRole('button',{name:direction,exact:true}).click();
    }
    await playerPage.getByRole('button',{name:'確認檢核答案',exact:true}).click();
    await expect(playerPage.getByText('交易完成',{exact:true})).toBeVisible({timeout:15000});
    await playerPage.getByRole('button',{name:'返回遊戲',exact:true}).click();
  };
  const retainDraft=async()=>playerPage.evaluate(()=>{
    const remove=Storage.prototype.removeItem;
    Storage.prototype.removeItem=function(key){if(!key.startsWith('hf-financial-intent:'))return remove.call(this,key);};
  });
  await retainDraft();
  await openBanking();await check('增加');
  await expect.poll(async()=>(await playerDocRef.get()).data()?.cash).toBe(baseline.cash+100000);
  const loanAfter=(await playerDocRef.get()).data()!;
  const pending=await playerPage.evaluate(key=>JSON.parse(localStorage.getItem(key)!),storageKey);
  expect(pending.commandId).toBeTruthy();
  expect((await playerDocRef.collection('commandResults').get()).size).toBe(baselineReceipts+1);
  await playerPage.reload();
  await expect(playerPage.getByRole('button',{name:'確認檢核答案',exact:true})).toBeVisible({timeout:20000});
  await check('增加');
  expect((await playerDocRef.get()).data()?.cash).toBe(loanAfter.cash);
  expect((await playerDocRef.get()).data()?.liabilities).toEqual(loanAfter.liabilities);
  expect((await playerDocRef.collection('commandResults').get()).size).toBe(baselineReceipts+1);
  expect(await playerPage.evaluate(key=>localStorage.getItem(key),storageKey)).toBeNull();
  // A distinct player choice in the same bank event must get a distinct command.
  await openBanking();await check('增加');
  await expect.poll(async()=>(await playerDocRef.get()).data()?.cash).toBe(baseline.cash+200000);
  expect((await playerDocRef.collection('commandResults').get()).size).toBe(baselineReceipts+2);
  await retainDraft();
  await openBanking(true);await check('減少');
  const repaid=(await playerDocRef.get()).data()!;
  expect(repaid.cash).toBe(baseline.cash+100000);
  // Other operations may consume cash after a payment commits. Receipt recovery must precede a fresh balance check.
  await playerDocRef.update({cash:0});
  await playerPage.reload();
  await expect(playerPage.getByRole('button',{name:'確認檢核答案',exact:true})).toBeVisible({timeout:20000});
  await check('減少');
  expect((await playerDocRef.get()).data()?.cash).toBe(0);
  expect((await playerDocRef.get()).data()?.liabilities).toEqual(repaid.liabilities);
  expect((await playerDocRef.collection('commandResults').get()).size).toBe(baselineReceipts+3);
  expect((await roomRef.get()).data()!.boardState.revision).toBe(revision);
  expect((await roomRef.get()).data()!.boardState.currentEvent.id).toBe(bankEventId);
  await playerPage.getByRole('button',{name:/^(稍後再說|結束並關閉)$/}).click();
  await expect(playerPage.getByRole('button',{name:'結束回合',exact:true})).toBeEnabled({timeout:15000});
  await coachContext.close();await playerContext.close();
});

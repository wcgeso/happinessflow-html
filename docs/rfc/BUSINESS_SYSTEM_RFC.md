# Business System RFC

> 文件定位：企業系統討論稿，不是正式 GDD。
>
> 分析依據：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/ASSET_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md`、`docs/gdd/FINANCIAL_SYSTEM.md`，以及目前 worktree 內的程式實作。
>
> 本文件只整理目前程式真正存在的企業、收購、升級、Cashflow、Enterprise Loan、Business Asset、Business Card 與 Financial Check 行為，不自行設計新玩法，也不建立正式 GDD。

## Current Implementation

### 1. 企業 / Business Asset

- 開局時的 `selectedEnterprise` 不是資產表中的企業資產，而是 `SelectionView.tsx` 讓玩家在職業之後選的第二個基礎設定。
- `SelectionView.tsx` 顯示企業名稱、投資金額、企業收入增加與幸福點數，完成後寫回 `GameState.selectedEnterprise`。
- `GameContext.tsx` 會把 `selectedEnterprise`、`selectedDream` 與 `profession` 一起保存在 `gameState`。
- 真正的企業資產是 `Asset.type === '企業'`，其資料結構包含 `isUpgraded`、`cashflow`、`downPayment`、`loanAmount`、`loanInterest`。
- `src/types.ts` 同時保留 `liabilities` 與 `loans`，企業相關狀態會落在 `assets` 與 `liabilities` 的組合中。

### 2. 收購

- 機運卡 `purchase_startup`、`enterprise_acquisition` 會在 `src/utils/boardCardActions.ts` 轉成 `asset_sale`。
- `purchase_startup` 目前只對未升級的兼職工作室 `Asset.type === '企業' && name.includes('兼職工作室') && !isUpgraded` 建立出售候選。
- `enterprise_acquisition` 會對所有企業資產建立出售候選，價格以 `asset.cashflow * acquisitionMultiple` 計算。
- `purchase_startup` 與 `enterprise_acquisition` 的回傳結果都會交給 `GameView.tsx` 的財務流程處理，而不是直接改資產。
- `FinancialCheckBoard.tsx` 與 `BoardFinancialCheckModal.tsx` 會把這類操作導向 `Financial Check`。

### 3. 升級 / Upgrade

- `src/components/modals/BizUpgradeModal.tsx` 是企業升級 UI，流程固定是兩次擲骰。
- 第一骰判定是否符合升級條件，門檻是 `>= 5`。
- 第二骰決定收入增加量，增加值是 `diceRoll * 10000`。
- 實際寫入狀態的是 `useGameLogic.ts` 的 `handleBizUpgrade()`。
- `handleBizUpgrade()` 會：
  - 增加企業 `cashflow`
  - 將 `isUpgraded` 設為 `true`
  - 移除名稱相符的 `企業貸款`
  - 寫入一筆交易歷史
- `FinancialStatement.tsx` 會把企業區塊與 `onUpgradeBiz` 接到升級模態。

### 4. Cashflow

- `calculateFinancialSummary()` 會把所有資產的 `cashflow` 納入 `passiveIncome`。
- `calculateFinancialSummary()` 對 `不動產` 另外加上能力加成；企業資產本身則直接用 `asset.cashflow`。
- `useGameLogic.ts` 在處理 `達成事業成就` 時，會把 `selectedEnterprise` 對應的收入寫回 `gameState.income`。
- 也就是說，現有程式同時存在兩種企業相關收入來源：
  - `selectedEnterprise` 對 `income` 的動態收入
  - `Asset.type === '企業'` 對 `assets[].cashflow` 的被動收入
- `FinancialStatement.tsx` 會把企業資產列在資產區，並把企業貸款利息列在月支出摘要中。

### 5. Enterprise Loan

- `useTransactionLogic.ts` 的企業購買流程會收集 `bizLoan`、`bizInterest`、`bizIncome`。
- 企業購買交易會建立 `assetDetails.type === '企業'`，並帶入 `loanAmount` 與 `loanInterest`。
- `useGameLogic.ts` 在 `data.usage === 'asset' && data.assetDetails` 時，若 `loanAmount > 0` 就建立 `Liability.type === '企業貸款'`。
- 新增的企業貸款會以 `monthlyPayment: details.loanInterest || 0` 寫入。
- `BankingView.tsx` 會把 `企業貸款` 列成可償還類別。
- `calculateFinancialSummary()` 會把 `企業貸款` 的 `monthlyPayment` 納入 `totalExpenses`。

### 6. Business Card

- `src/constants/cards.ts` 有 `small_business` 與 `large_enterprise` 兩種企業新聞卡。
- `RoomContext.tsx` 只把這兩種卡做成顯示 metadata，列出金額、貸款與月收益說明。
- `src/utils/boardCardActions.ts` 目前只對 `small_business` 產生正式 `financial` 動作。
- `small_business` 會建立企業資產、企業貸款、企業收益與財務檢核條目。
- `large_enterprise` 在 `boardCardActions.ts` 目前沒有對應分支，最後會落到 `unsupported`。
- `enterprise_acquisition` 是另一條企業卡路徑，但它是 `asset_sale`，不是新增企業資產。

### 7. Financial Check

- `useTransactionLogic.ts` 會先組出 `expectedEntries`，玩家在 Phase 2 用 `FinancialCheckBoard.tsx` 填 `userEntries`。
- `checkAnswers()` 只檢查 `userEntries` 與 `correctEntries` 是否完全一致，通過後才 `completeTransaction()`。
- `BankingAppModal.tsx` 會替股票、借貸、還款、保險、定存等交易補上 `financialCheckEntries`。
- `src/components/game/BoardFinancialCheckModal.tsx` 會把棋盤事件導向財務檢核流程。
- `useGameLogic.ts` 本身不會獨立驗證財務檢核答案；它是在交易被送進來後更新 `GameState`。

## Problem

### 與 `docs/gdd` 的衝突

- `docs/gdd/ASSET_SYSTEM.md` 與 `docs/gdd/BANK_SYSTEM.md` 都把 `liabilities` 定義為正式貸款權威，`loans` 只保留 Legacy 相容用途；但目前 `calculateFinancialSummary()`、`FinancialStatement.tsx`、`BankingAppModal.tsx` 與 `GameContext.tsx` 仍讀寫 `gameState.loans`。
- `docs/gdd/ASSET_SYSTEM.md` 與 `docs/gdd/BANK_SYSTEM.md` 都要求企業購買、出售、升級與貸款變動通過正式財務流程；但 `handleBizUpgrade()` 會直接改 `assets`、`liabilities` 與 `history`，沒有先走完整的交易/檢核入口。
- `docs/gdd/CARD_SYSTEM.md` 要求 `small_business` 與 `large_enterprise` 在揭露後進入正式財務或投資流程；目前只有 `small_business` 有正式 action，`large_enterprise` 仍會落到 `unsupported`。
- `docs/gdd/CARD_SYSTEM.md` 與 `docs/gdd/FINANCIAL_SYSTEM.md` 要求正式交易都要經過 `Financial Check`；但企業升級不是由同一個檢核流程驅動。
- `docs/gdd/FINANCIAL_SYSTEM.md` 要求只有 `Forced Debt` 自動償還；但企業資產相關流程一旦帶有正向現金流，仍會經過現有的自動還款邏輯，而該邏輯同時涵蓋 legacy `loans`。

### 目前實作的結構性問題

- 目前有兩種「企業」同時存在：
  - 開局選擇的 `selectedEnterprise`
  - 資產表中的 `Asset.type === '企業'`
- 這兩者都會影響收入，但資料位置、變更入口與顯示層不同。
- `企業貸款` 由交易時建立，卻由企業升級時直接移除，沒有獨立的貸款清償流程。
- `large_enterprise` 目前只在卡片 metadata 層存在，沒有對應的正式動作。
- `enterprise_acquisition` 現在是資產出售流程，不是新增企業持有或企業併購後的新持有結構。
- `FinancialCheckBoard.tsx` 只有四象限概念，企業相關操作其實是透過交易資料帶出的科目清單在處理，沒有單獨的企業檢核模型。

## Option A（維持目前）

### 說明

- 保留現況的雙軌做法：
  - `selectedEnterprise` 繼續作為開局選擇
  - `Asset.type === '企業'` 繼續作為企業資產
  - `small_business` 直接走現有金融交易
  - `enterprise_acquisition` 維持 asset sale
  - `BizUpgradeModal` 維持兩次擲骰升級
- `gameState.loans` 繼續參與摘要與舊資料相容。
- `large_enterprise` 維持目前 unsupported 狀態。

### 優點

- 與目前 worktree 的實作最一致。
- 不需要先處理既有資料或既有歷史紀錄。
- 不需要先改動 `GameView.tsx`、`BoardFinancialCheckModal.tsx` 與 `BoardCardActions.ts` 的事件銜接。

### 缺點

- 企業系統會持續維持雙軌資料模型。
- `docs/gdd` 的正式規格與程式會持續不一致。
- `large_enterprise` 仍然沒有正式可執行流程。
- 企業升級、企業收購與企業貸款的責任邊界仍然分散。

## Option B（推薦）

### 說明

- 在 RFC 層先把企業系統收斂成單一正式模型：
  - `Asset.type === '企業'` 是正式企業資產
  - `selectedEnterprise` 只保留為開局選擇結果
  - `企業貸款` 只屬於 `liabilities`
  - `企業升級` 必須先過正式交易/檢核流程
  - `small_business`、`enterprise_acquisition`、`large_enterprise` 都應有明確的正式 action 類型
- `gameState.loans` 只保留舊資料相容。
- `Financial Check` 只保留一個正式入口，不再由各頁面各自定義不同語意。

### 優點

- 與 `docs/gdd` 的正式方向較一致。
- 企業資產、企業貸款與企業升級可以用同一個語意框架描述。
- `large_enterprise` 可被明確標示為待補完，不再和正式流程混在一起。

### 缺點

- 這份 RFC 會明確暴露目前程式與正式規格的落差。
- 需要另外處理舊資料、舊交易與 `loans` 的相容路徑。
- 需要把企業升級從直接 mutation 轉成正式交易鏈。

## Recommendation

建議採 `Option B`。

理由是目前程式雖然已經可以跑企業購買、企業貸款、企業升級與企業收購，但它們的資料與流程分散在 `SelectionView.tsx`、`useTransactionLogic.ts`、`useGameLogic.ts`、`BoardCardActions.ts`、`RoomContext.tsx`、`FinancialStatement.tsx` 與 `BankingView.tsx`，並沒有單一的企業正式模型。若 RFC 先收斂成單一語意，後續才有辦法把現況與 `docs/gdd` 對齊。

## Decision Required

- [ ] A. 維持目前雙軌企業模型與現有流程
- [ ] B. 以 `Asset.type === '企業'` 為正式企業資產，`selectedEnterprise` 只保留開局選擇語意
- [ ] C. 企業升級必須先進正式 `Financial Check`，`handleBizUpgrade()` 不能直接完成最終狀態
- [ ] D. `large_enterprise` 目前維持 unsupported，或補成正式 action

## Need Confirmation

1. `selectedEnterprise` 是否只保留為開局選擇，不再視為企業資產的一部分。
2. 企業升級是否仍要保留現有兩次擲骰流程，還是必須改成單一正式交易入口。
3. `enterprise_acquisition` 是否要維持「出售企業」語意，還是未來要改成真正的收購持有流程。
4. `large_enterprise` 是否要保留為 unsupported，還是需要正式動作與檢核條目。
5. `gameState.loans` 是否還要繼續參與企業與財務摘要，或只保留舊存檔相容用途。
6. 企業相關交易是否一律必須經過 `Financial Check`，或只要求目前 UI 入口的交易。

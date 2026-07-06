# Dream System RFC

> 文件定位：Dream 系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/*.md`，以及目前 `線上模式0611` 工作樹中的實作。
>
> 本文件只整理目前程式真正存在的 Dream / Dream Purchase / Dream Cost / Happiness / Financial Check / Asset Relation / Win Condition，不自行設計新玩法，也不建立正式 GDD。

## 1. Current Implementation

### 1.1 Dream 資料

- `src/types.ts` 的 `Dream` 只有 `id`、`name`、`cost`、`happyPoints`、`description?`。
- `src/constants.ts` 的 `DREAMS` 目前是固定清單，cost 介於 `30,000,000` 到 `100,000,000`，`happyPoints` 都是 `10`。
- `src/views/selection/SelectionView.tsx` 讓玩家在開局流程選擇 dream。
- `src/App.tsx` 會把選到的 dream 存進 `gameState.selectedDream`。
- `src/context/GameContext.tsx` 會把 `selectedDream` 連同其他開局資料一起保存在 `GameState`。

### 1.2 Dream 與 Happiness 的關係

- `src/utils/gameUtils.ts` 的 `getInitialHappinessList(enterprise, dream)` 會建立 `h_dream`。
- `h_dream` 是 read-only happiness item，label 會顯示 `完成夢想 (${dream.name})`，description 會顯示 `花費: ${dream.cost}` 與可選的 dream description。
- `src/hooks/useGameLogic.ts` 在交易名稱包含 `實現人生夢想` 時，會把 `h_dream.checked` 設為 `true`。
- `src/hooks/useGameLogic.ts` 在刪除該交易紀錄時，會把 `h_dream.checked` 還原。
- `src/views/game/GameView.tsx` 會在 `gameState.happinessTotal >= 100 && !gameState.hasShownWinAnimation` 時顯示 `HappinessWinAnimation`。

### 1.3 Dream Purchase 的兩條現有路徑

#### 路徑 A：`TransactionForm` / `useTransactionLogic`

- `src/components/business/TransactionForm.tsx` 透過 `useTransactionLogic.ts` 走表單流程。
- `src/hooks/useTransactionLogic.ts` 在 `assetType === '心儀夢想' && selectedDream` 時：
  - 檢查 `happiness.find(h => h.id === 'h_dream')?.checked`
  - 檢查 `cash >= selectedDream.cost`
  - 建立 `txData`
  - `name` 是 `實現人生夢想：${selectedDream.name}`
  - `amount` 是 `selectedDream.cost`
  - `cashChange` 是負值
  - `source` 是 `cash`
  - `usage` 是 `expense`
- 同一段邏輯會把 `expectedEntries` 設成現金減少，沒有把 Dream 當成資產。

#### 路徑 B：`GameActions` -> `TargetDreamSelectorModal` -> `TargetAndDreamModal`

- `src/views/game/GameView.tsx` 的 `GameActions` 可以打開 `TargetDreamSelectorModal`。
- `src/components/banking/TargetDreamSelectorModal.tsx` 再打開 `TargetAndDreamModal`。
- `src/components/banking/TargetAndDreamModals.tsx` 在 dream 分支會送出：
  - `name: \`實現夢想: ${dream.name}\``
  - `usage: 'buy_asset'`
  - `assetChange.asset.type: '夢想'`
  - `assetChange.asset.value: dream.cost`
- `src/views/game/GameView.tsx` 把這筆資料放進 `boardFinancialAction`，再交給 `BoardFinancialCheckModal`。
- `src/hooks/useGameLogic.ts` 的 `normalizeTransactionData()` 只處理 `buy_asset` 的 `股票` 與 `定存`，沒有 `夢想` 的轉換分支。
- `src/hooks/useGameLogic.ts` 的 `handleTransactionSubmit()` 也沒有 `type === '夢想'` 的資產新增分支。

### 1.4 Dream Cost

- 現有夢想成本就是 `selectedDream.cost`。
- `DREAMS` 內每個夢想都直接定義成本。
- `TransactionForm` 的 dream 分支使用 `selectedDream.cost` 當成交易金額。
- `TargetAndDreamModal` 的 dream 分支也使用 `dream.cost`。

### 1.5 Financial Check

- `src/hooks/useTransactionLogic.ts` 的 dream 分支會進入交易表單的檢核流程，`expectedEntries` 目前只要求現金減少。
- `src/views/game/GameView.tsx` 的 `TargetDreamSelectorModal` 路徑會把資料交給 `BoardFinancialCheckModal`。
- `src/components/game/BoardFinancialCheckModal.tsx` 的 `expectedEntries` 是由 `txData.financialCheckEntries || []` 帶入。
- 目前 dream modal 送出的 payload 沒有看到獨立的 `financialCheckEntries`，所以這條路徑的檢核內容不是 Dream 專屬，而是一般交易檢核框架。
- `src/hooks/useGameLogic.ts` 的 `handleTransactionSubmit()` 本身是落帳函式，不是檢核函式。

### 1.6 Asset Relation

- `src/types.ts` 的 `Asset.type` 只有：
  - `現金`
  - `定存`
  - `股票`
  - `企業`
  - `不動產`
  - `飛行器`
  - `汽車`
- `Dream` 不在 `Asset.type` 裡。
- `src/hooks/useGameLogic.ts` 只有在 `selectedDream` 對應的交易名稱命中 `實現人生夢想` 時，才把結果寫進 `h_dream`。
- 目前程式沒有看到正式的 `Dream` 資產持有表、持有人欄位或 dream 專屬估值邏輯。

### 1.7 Win Condition

- `src/views/game/GameView.tsx` 的勝利動畫條件是 `happinessTotal >= 100`。
- `src/utils/gameUtils.ts` 的 `calculateScoreResult()` 也把 `幸福指數達 100` 列為一個得分條件。
- `src/hooks/useGameLogic.ts` 的 `handleFinishGame()` 與 `src/context/GameContext.tsx` 的 `saveToPlayerSessions()` 都把 `isWin` 設成 `summary.passiveIncome > summary.totalExpenses`。
- `room.status = finished` 仍然是另一個獨立的房間結束狀態，不是 Dream 專屬勝利條件。

## 2. Problem

- `docs/gdd/ASSET_SYSTEM.md` 與 `docs/gdd/FINANCIAL_SYSTEM.md` 的正式資產與財務規則沒有定義 `Dream` 為資產；但目前 `TargetAndDreamModal` 會送出 `assetChange.asset.type: '夢想'`，這個字面資料與正式資產分類不一致。
- `docs/gdd/FINANCIAL_SYSTEM.md` 要求正式交易都要經過 `Financial Check`；目前 Dream 有兩條入口，檢核語意不同，一條是 `TransactionForm` 的一般表單檢核，一條是 `BoardFinancialCheckModal` 的一般交易檢核框架。
- `TransactionForm` 的 Dream 路徑與 `TargetAndDreamModal` 的 Dream 路徑名稱不同，分別是 `實現人生夢想` 與 `實現夢想`；但 `handleTransactionSubmit()` 只認 `實現人生夢想` 來切換 `h_dream`，所以兩條路徑的結果不一致。
- `TargetAndDreamModal` 的 dream payload 會用 `type: '夢想'`，但 `useGameLogic.ts` 沒有 `夢想` 資產新增分支，這條路徑目前沒有對應的正式資產落帳。
- `happinessTotal >= 100` 的勝利動畫，與 `summary.passiveIncome > summary.totalExpenses` 的 `isWin`，目前是兩種不同的勝利語意。
- `docs/gdd` 內沒有獨立 Dream System 文件，Dream 目前只能從幸福、財務與資產規則間接推得，但程式內已經存在多個彼此不一致的入口。

## 3. Option A（維持目前）

### 說明

維持現況，讓 Dream 同時保留兩條入口：

- `TransactionForm` 的 dream 交易仍以 `實現人生夢想` 的 happiness 事件處理
- `TargetDreamSelectorModal` 的 dream 交易仍以 `buy_asset` / `夢想` payload 進入檢核與落帳流程
- `h_dream` 與 `happinessTotal >= 100` 的現有顯示邏輯不改
- `summary.passiveIncome > summary.totalExpenses` 的 `isWin` 不改

### 優點

- 完全貼近目前工作樹的程式行為。
- 不需要重新統一 `Dream` 的資料語意。
- 不需要重整現有表單與按鈕入口。

### 缺點

- `Dream` 仍然有兩套不一致的名稱與結果。
- `夢想` 會繼續維持成一種沒有正式資產定義的 payload。
- `h_dream` 只會被部分路徑更新，結果不容易一致。

## 4. Option B（推薦）

### 說明

把 Dream 的正式語意統一成單一結果：

- `selectedDream` 只代表開局與成就參考資料
- Dream Purchase 只對應 `h_dream` 的完成狀態與一筆現金交易
- Dream 不作為正式資產
- 夢想完成的結果只保留一種名稱與一種落帳語意

### 優點

- 與目前 `getInitialHappinessList()`、`h_dream`、`happinessTotal` 的資料權威一致。
- 與 `docs/gdd/ASSET_SYSTEM.md` 的正式資產分類一致。
- 可以避免 `實現人生夢想` 與 `實現夢想` 兩條路徑的語意分裂。

### 缺點

- 必須接受 `TargetAndDreamModal` 目前的 `夢想` asset payload 不屬於正式語意。
- 需要把 Dream 的結果統一到同一條資料路徑。

## 5. Recommendation

建議採 `Option B`。

原因很單純：目前程式已經把 Dream 的真正結果放在 `h_dream` 與 `happinessTotal`，而不是放在資產表；若繼續保留 `夢想` asset payload 與 `實現夢想` / `實現人生夢想` 兩套名稱，Dream 會持續成為一個沒有單一權威來源的概念。

## 6. Decision Required

- [ ] A. 維持目前 Dream 的雙入口與雙語意
- [ ] B. 把 Dream 統一成單一的非資產結果，並以 `h_dream` 作為唯一正式結果

## 7. Need Confirmation

1. `selectedDream` 只是開局時的目標資料，還是也要允許後續再被重選或重置。
2. `TargetAndDreamModal` 的 `type: '夢想'` payload 是否要保留為正式資料。
3. Dream 完成後是否只更新 `h_dream`，而不新增任何 `Asset`。
4. `happinessTotal >= 100` 是否是 Dream / Happiness 的正式勝利條件，還是只是動畫條件。
5. `summary.passiveIncome > summary.totalExpenses` 是否才是最終 `isWin` 定義。

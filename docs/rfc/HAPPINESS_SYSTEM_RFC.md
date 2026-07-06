# Happiness System RFC

> 文件定位：幸福系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/README.md`、`docs/gdd/CARD_SYSTEM.md`、`docs/gdd/BOARD_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/FINANCIAL_SYSTEM.md` 與目前 worktree 內程式實作。
>
> 本文件只整理目前程式真正存在的幸福資料、卡片、家庭歷程、完成事件、勝利條件與同步方式，不自行設計新玩法。

## Current Implementation

### Happiness

目前的幸福狀態不是單一數值，而是 `GameState.happiness` 中的一組 `HappinessItem[]`。

可確認的結構與來源：

- 型別定義在 `src/types.ts`
- 初始清單由 `src/utils/gameUtils.ts#getInitialHappinessList()` 建立
- 畫面顯示由 `src/components/business/HappinessPanel.tsx`、`src/components/game/GameStats.tsx`、`src/components/game/GameHeader.tsx` 負責
- 幸福總分由 `happiness` 內 `checked === true` 的項目加總

目前幸福項目包含三種常見來源：

- 固定項目
  - 例如 `h_finance`、`h_family`、`h_date`、`h_proposal`、`h_wedding`、`h_child1`、`h_house_self`、`h_house_1`、`h_house_2`、`h_house_3`、`h_house_5`、`h_child2`、`h_plane`、`h_career`、`h_dream`
- 自動勾選項目
  - `GameContext.tsx` 會依財務與資產狀態自動更新 `h_finance`、`h_house_*`、`h_house_self`、`h_family`、`h_plane`
- 自訂項目
  - `HappinessPanel.tsx` 允許新增與刪除 `isCustom: true` 的項目

### Happiness Item

`HappinessItem` 是一筆清單資料，不等同於卡片。

目前欄位在 `src/types.ts`：

- `id`
- `label`
- `points`
- `checked`
- `isCustom?`
- `readOnly?`
- `code?`
- `description?`
- `parentId?`

目前程式已存在的行為：

- `readOnly` 項目不能由一般點擊修改
- `parentId` 會讓子項目在 `HappinessPanel` 內縮排顯示
- `code` 與 `description` 會被用來顯示細節
- `executeAddHappinessItem()` 會新增 `checked: true` 的自訂項目
- `handleRemoveHappinessItem()` 可以移除自訂項目
- `handleToggleHappiness()` 可以切換可操作項目

### Happiness Total

`happinessTotal` 是 `GameState` 裡的整數欄位，實際計算方式是：

- 把 `happiness` 中 `checked === true` 的項目 `points` 加總

目前它被多個地方直接使用：

- `GameView.tsx` 以 `happinessTotal >= 100` 顯示勝利動畫
- `GameHeader.tsx` 與 `GameStats.tsx` 直接顯示數值與進度條
- `GameContext.tsx` 與 `RoomContext.tsx` 會把它同步到 `rooms/{roomCode}.playerStates.{uid}`
- `GameContext.tsx` 會把它寫進 `player_sessions/{uid}/records/{sessionId}`
- `useGameLogic.ts` 與 `ScoreView.tsx` 會把它寫入結算紀錄中的 `happinessScore`

### Happiness Card

幸福卡資料來自 `src/constants/cards.ts` 的 `HAPPINESS_CARDS`。

目前可確認的分類是：

- `幸福回憶`
- `家庭重要歷程`
- `追求家庭幸福`
- `良好人際關係`
- `幸福的社會`

幸福卡在棋盤上的實際處理，主要由 `src/utils/boardCardActions.ts#resolveBoardCardAction()` 決定：

- 有些卡會變成 `kind: 'happiness'`
- 有些卡會變成 `kind: 'choice'`
- 有些卡會變成 `kind: 'financial'`
- 有些卡會變成 `kind: 'asset_sale'`
- 有些卡會變成 `kind: 'unsupported'`

目前能確認的幸福卡執行型態：

- 直接加幸福
- 先做財務檢核再套用
- 先做選擇，再決定接受或關閉
- 家庭重要歷程會依目前進度改寫成對應階段卡

### Family Milestone

目前家庭歷程的實作是「卡片資料 + 目前進度 + 共同參與 prompt」的組合。

可確認的靜態資料與邏輯：

- `src/constants/cards.ts` 有 `H011-H020` 與 `H043-H046`
- `src/utils/familyMilestones.ts` 目前只定義 `H011-H015` 的階段清單
- `src/utils/boardCardActions.ts` 會用 `getFamilyMilestoneStatus(gameState)` 決定目前階段
- `src/context/RoomContext.tsx#openFamilyMilestoneJoinPrompt()` 會建立 `boardState.familyMilestoneJoinPrompt`
- `src/context/RoomContext.tsx#submitFamilyMilestoneJoinResponse()` 會把其他玩家的回覆寫進共享房間狀態
- `src/views/game/GameView.tsx` 會在成功加入時把對應卡片轉成幸福結算或財務流程

目前家庭歷程的完成判定不是獨立事件表，而是混合使用：

- `GameState.completedHappinessEvents`
- `GameState.happiness` 中對應項目的 `checked`

### Completed Events

目前的「已完成事件」主要是 `GameState.completedHappinessEvents: string[]`。

它被用來：

- 避免歷程重複執行
- 在 `useTransactionLogic.ts` 的幸福事件流程中做重複檢查
- 在 `familyMilestones.ts#getFamilyMilestoneStatus()` 中推算目前階段
- 在 `GameView.tsx` 中記錄已完成的 board happiness / family join 結果
- 在 `useGameLogic.ts` 的刪除交易回滾流程中清除對應 ID

目前這個陣列存的是事件或階段相關 ID，並不是完整事件物件。

### Win Condition

目前程式同時存在兩種不同的勝利/達標語意：

- UI 勝利動畫
  - `GameView.tsx` 以 `gameState.happinessTotal >= 100` 顯示 `HappinessWinAnimation`
- 結算紀錄中的 `isWin`
  - `useGameLogic.ts` 的 `handleFinishGame()` 會用 `summary.passiveIncome > summary.totalExpenses`
  - `GameContext.tsx` 的 `saveToPlayerSessions()` 也用同一個條件
  - `ScoreView.tsx` 與 `coach_records` 的玩家資料則以 `happiness >= 100` 標記 `isWin`

### Sync Method

幸福相關資料目前不是只存在單一地方，而是同步到多層：

- 本地 React state
  - `GameContext.gameState`
- 房間共享狀態
  - `rooms/{roomCode}.playerStates.{uid}`
- 玩家場次備份
  - `player_sessions/{uid}/records/{sessionId}`
- 結算紀錄
  - `score_records/S1/records/{recordId}`
  - `coach_records/{recordId}`
- 本地備份
  - `localStorage['happiness_game_state']`

`GameContext.tsx` 目前會以延遲更新的方式把玩家狀態寫入房間文件；`RoomContext.tsx` 以 `onSnapshot` 監聽房間文件，再把 `playerStates` 回填到本地。幸福分數、完成事件與部分 UI 防重旗標都跟著 `GameState` 一起同步。

## Problem

### 與 `docs/gdd` 的衝突

- `docs/gdd/CARD_SYSTEM.md` 與 `docs/gdd/EVENT_SYSTEM.md` 都把卡片與家庭歷程視為正式事件生命週期的一部分，但目前程式中：
  - `exam_happiness` 與 `followup` 是直接覆寫 `currentEvent/currentCard`
  - `familyMilestoneJoinPrompt` 與 `pendingFamilyMilestoneJoinAction` 分散在房間狀態與玩家狀態
  - `shiftBoardQueue()` 會在推進 queue 時清掉 `familyMilestoneJoinPrompt`
- `docs/gdd/CARD_SYSTEM.md` 明確列出 `H016-H020` 與 `H043-H046` 為正式卡池內容；目前程式雖然有這些卡號，但 `src/utils/familyMilestones.ts` 的可運作階段仍只定義 `H011-H015`
- `docs/gdd/BOARD_SYSTEM.md` 的勝利條件是 `Happiness >= 100`；目前程式的畫面勝利條件是這個，但結算紀錄中的 `isWin` 另用 `summary.passiveIncome > summary.totalExpenses`
- `docs/gdd/FINANCIAL_SYSTEM.md` 沒有定義以財務自由作為幸福勝利相同層級的 `isWin`；目前程式把它寫進 `GameRecord` 與 `player_sessions`

### 現行程式內部的不一致

- `Happiness` 是一組可勾選清單，但同一份清單同時承載：
  - 固定成就
  - 自動成就
  - 卡片結果
  - 家庭歷程
  - 自訂項目
- `Completed Events` 目前只是一個 `string[]`，不是正式事件紀錄，所以它能拿來去重，但不適合單獨描述完整幸福流程
- `Happiness Card` 的行為依賴 `GameState`：
  - 家庭重要歷程會依目前進度改寫成不同 stage card
  - 同一張卡在不同狀態下可能走 `happiness`、`financial`、`choice` 或 `unsupported`
- `Win Condition` 目前有兩套來源，導致 UI、結算紀錄與報表不一定看的是同一件事
- `Sync Method` 目前把幸福資料分散在本地、房間、player session 與結算紀錄，多來源之間沒有單一主檔欄位

### 與目前文件註記的一致性問題

- `docs/PROJECT_OVERVIEW.md` 目前仍把幸福卡費用與月支出區間列為待確認項
- `src/constants/cards.ts` 對 `H016-H020`、`H043-H046` 也保留了 TODO 註記
- `src/utils/familyMilestones.ts` 只處理五個階段，但卡池資料已存在更多同系列卡號

## Option A

維持目前做法。

### 內容

- 續用 `GameState.happiness` 作為幸福主資料
- 續用 `happinessTotal` 作為 UI 主要顯示值
- 續用 `completedHappinessEvents` 作為去重與階段推算輔助
- 續用 `boardState.familyMilestoneJoinPrompt` + `pendingFamilyMilestoneJoinAction` 的分散同步方式
- `GameView.tsx` 仍以 `happinessTotal >= 100` 顯示勝利動畫
- `GameRecord.isWin` 與 `player_sessions.isWin` 仍保留目前的財務自由判定

### 影響

- 與現有程式一致，改動面最小
- 仍保留現有兩套勝利語意
- 仍保留家庭歷程在 boardState / playerState 之間分散的寫入方式
- 仍保留 `H011-H015` 與 `H043-H046` 的資料存在，但不補齊同一套可運作階段

## Option B

以目前程式已有的資料結構為基礎，收斂幸福系統的正式語意到同一套共享判定。

### 內容

- `Happiness` 與 `Happiness Item` 維持現在的 `GameState.happiness` 結構，但正式語意只承認同一套完成來源
- `Happiness Total` 明確對應同一個勝利門檻
- `Happiness Card`、`Family Milestone`、`Completed Events` 依目前 board / room / playerState 的同步結構，統一成可追蹤的完成流程
- `Win Condition` 以 `happinessTotal >= 100` 作為單一 in-game 勝利條件，並避免結算紀錄再用另一套不同語意
- `H043-H046` 是否屬於同一家庭歷程系列，需由產品確認後再決定是否納入同一條可運作階段鏈

### 影響

- 與 `docs/gdd` 的勝利門檻與卡片/事件方向較一致
- 可以保留現有資料欄位，不必先改掉 `GameState` 結構
- 需要先釐清哪些 ID 是正式完成事件，哪些只是顯示或相容資料

## Recommendation

採用 **Option B**。

原因只有一個：目前程式已經把幸福系統拆成 `GameState.happiness`、`happinessTotal`、`completedHappinessEvents`、`boardState.familyMilestoneJoinPrompt`、`pendingFamilyMilestoneJoinAction` 與多個同步副本，最需要的是把這些現有資料的正式語意收斂到同一條線，而不是再增加另一套判定。

## Decision Required

1. `Win Condition` 是否以 `happinessTotal >= 100` 為唯一正式勝利條件。
2. `GameRecord.isWin` 與 `player_sessions.isWin` 是否也要跟著幸福 100 分同步，還是只保留財務自由作為報表欄位。
3. `H043-H046` 是否屬於與 `H011-H015` 同一條家庭歷程階段鏈。
4. `Completed Events` 是否只保留 `completedHappinessEvents` 這種 ID 清單，或需要再加一份正式事件紀錄。
5. `Family Milestone` 的完成判定，是否以 `completedHappinessEvents` 為主，還是以 `happiness` 勾選狀態為主。

## Need Confirmation

1. `H016-H020` 的精確卡名與費用，目前仍是 TODO。
2. `H043-H046` 是否應與 `H011-H015` 使用同一套階段規則，目前程式沒有把它們接進 `familyMilestones.ts`。
3. 幸福項目中的自動勾選項目，例如 `h_finance`、`h_house_*`、`h_family`、`h_plane`，是否都應視為正式幸福完成來源。
4. `familyMilestoneJoinPrompt` 在 queue 推進時被清除，是否符合正式流程。
5. `GameView.tsx` 的 `happinessTotal >= 100` 與結算紀錄的 `summary.passiveIncome > summary.totalExpenses`，是否允許同時存在不同語意。

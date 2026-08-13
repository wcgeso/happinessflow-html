# 漸進式重構遷移計畫 (Incremental Core Migration Plan)

本文件採用 **Strangler Fig Pattern（絞殺者模式）**，規劃如何將 Legacy 《第二人生》系統，在不影響既有 UI 渲染、大廳、房間、執行師介面與 Firebase 連線的前提下，漸進式重構並遷移至獨立的 Headless Game Core。

---

## 1. 遷移架構與適配器設計 (Architecture & Strangler Adapter)

為了保證「每次遷移後遊戲仍可啟動、可進入多人房間並遊玩」，我們不打破既有的 `RoomContext` 與 `GameContext`，而是將其明確定義為**適配器層（Adapter）**：

- **RoomContext / GameContext 只是 Adapter**：
  - **不擁有任何遊戲規則**，也不應存有就地修改狀態的程式碼。
  - **不產生核心的 State Transition**。
  - **只負責中轉**：把來自 UI 的行為轉譯為 Core Commands，傳遞給 Game Core。
  - **只負責同步**：把 Core 執行完畢產生的 Transition Result（新狀態/變更），寫回現有的 Firestore 欄位 Schema 中。

```text
+-------------------------------------------------------------+
|                        Legacy React UI                      |
+-------------------------------------------------------------+
                               |
                        [Command / Event]
                               v
+-------------------------------------------------------------+
|        Strangler Adapter (RoomContext / GameContext)        |
+-------------------------------------------------------------+
         |                                           ^
   [Map to Command]                           [Sync back State]
         v                                           |
+-------------------+                       +-----------------+
| Headless Game Core| --[State Transition]->| Firebase Sync   |
+-------------------+                       +-----------------+
```

---

## 2. 系統保留與抽離分析

### 2.1 哪些可以完全保留 (Fully Preserved)
- **大廳與房間 UI** (`LobbyView`, `RoomView`)
- **執行師控制台 UI** (`CoachDashboard`, `CoachGameView`)
- **使用者認證** (`AuthContext`, Firebase Auth)
- **Firebase 資料庫實體與連線** (`services/firebase.ts`)
- **前端報表與看板繪製** (`FinancialStatement.tsx`, `CashFlowLog.tsx`, `DiceRollContainer.tsx`)

### 2.2 哪些可以暫時保留 (Temporarily Preserved)
- **Firestore Room / Player Schema**：第一階段完全不更改雲端欄位結構，透過 Adapter 做讀寫映射，避免影響併發的其他玩家。

### 2.3 `GameView.tsx` 抽離項目
- **移出**：Modal 的開啟與關閉順序決策（如：卡片 Resolved 後自動打開財務檢核 Modal，再自動推進下一個 Queue）。
- **移出**：對 `familyMilestoneJoinPrompt` 和 `sharedCardPrompt` 的超時與本地提交狀態快照判定。
- **保留**：單純的 Modal 渲染、按鈕點擊後向 Context 發送 Command。

### 2.4 `RoomContext.tsx` 抽離項目
- **移出**：`rollBoardDice` 內部的骰點生成、位置計算、經過格判定。
- **移出**：`advanceBoardEventQueue` 的經過事件與停留事件流轉邏輯。
- **移出**：`getNextTurnUid` 的停回合回合跳過計算。

### 2.5 `useGameLogic.ts` / `useTransactionLogic.ts` 抽離項目
- **移出**：所有 `handleRepayLoan`、`handleBuyInsurance`、`handleBuyAsset` 等財務資料變更公式。
- **移出**：在 React State 中同時更新 `liabilities` 與 `loans` 的寫入邏輯。

### 2.6 `boardCardActions.ts` 抽離項目
- **移出**：對 160 張卡片 ID 的 If/Else 效果解算（由 Core Card Domain 統一接管）。

---

## 3. 卡片資料來源整合
- **直接載入**：新版 Core 的 Card System 將直接 import 現有的三個 JSON 檔案（`happiness.cards.json`、`opportunity.cards.json`、`news.cards.json`）。
- **無縫過渡**：Core 在 Reveal 時使用 JSON 中的 `effects` 屬性做解析，而 UI 則繼續引用 JSON 中的 `description` 與 `title` 做文字渲染。

---

## 4. 系統遷移對照與目標路徑表

新版重寫路徑統一組織在 `src/game/` 底下：

| # | 系統名稱 | Legacy Source Location | Target Core Module Path |
|---|---|---|---|
| 1 | Dice | `RoomContext.tsx` (rollBoardDice random) | `src/game/systems/Dice.ts` |
| 2 | Board | `RoomContext.tsx` (squares metadata / index) | `src/game/systems/Board.ts` |
| 3 | TurnTracker | `RoomContext.tsx` (`getNextTurnUid`, `skipTurns`) | `src/game/systems/TurnTracker.ts` |
| 4 | Movement | `RoomContext.tsx` (`rollBoardDice` position update) | `src/game/systems/Movement.ts` |
| 5 | Event Queue | `RoomContext.tsx` (`pendingEvents`, `currentEvent`) | `src/game/systems/EventQueue.ts` |
| 6 | Financial Kernel | `useGameLogic.ts`, `useTransactionLogic.ts` | `src/game/systems/Financial.ts` |
| 7 | Asset | `useTransactionLogic.ts` (`assets`) | `src/game/systems/Asset.ts` |
| 8 | Liability / Loan | `useTransactionLogic.ts` (`liabilities`, `loans`) | `src/game/systems/Liability.ts` |
| 9 | Insurance | `useGameLogic.ts` (buyInsurance) | `src/game/systems/Insurance.ts` |
| 10| Stock / Market | `RoomContext.tsx` (`marketPrices`) | `src/game/systems/StockMarket.ts` |
| 11| Happiness | `GameContext.tsx` (`completedHappinessEvents`) | `src/game/systems/Happiness.ts` |
| 12| Family Milestone | `familyMilestones.ts`, `RoomContext.tsx` | `src/game/systems/FamilyMilestone.ts` |
| 13| Card System | `boardCardActions.ts` (resolveBoardCardAction) | `src/game/systems/CardSystem.ts` |
| 14| Shared Event | `RoomContext.tsx` (sharedCardPrompt) | `src/game/systems/SharedEvent.ts` |
| 15| Profession | `useGameLogic.ts` (profession rank) | `src/game/systems/Profession.ts` |
| 16| Real Estate / Biz | `useTransactionLogic.ts` (rent/upgrade) | `src/game/systems/RealEstateBusiness.ts` |
| 17| Settlement | `gameUtils.ts` (`calculateScoreResult`) | `src/game/systems/Settlement.ts` |

### 核心架構路徑定義
- `src/game/core`：核心運行時 Engine，整合各 System。
- `src/game/state`：純 TypeScript 的遊戲狀態定義與介面。
- `src/game/commands`：應用程式命令定義與分發（Commands）。
- `src/game/events`：State Transition 產生的事件與差額定義。
- `src/game/systems`：純領域商業規則（Domain Rules）。
- `src/game/adapters`：與 React Context、Firebase 溝通的適配器。

---

## 5. 測試策略 (Test Strategy)

每次遷移一個 System 時，必須為其撰寫兩種測試：

1. **特徵測試 (Characterization Test)**
   - **目的**：確認新 Core 產生的狀態與 Legacy 系統的現有行為完全一致。
   - **方法**：透過隨機生成的測試資料，同時跑 Legacy 舊程式與新 Core 系統，確認狀態變更無差異。
2. **規格測試 (Spec Test)**
   - **目的**：確認新 Core 的行動作為符合 `GAME_OVERVIEW` 與 `GAME_SYSTEM_MAP` 的正式規格。
   - **處理原則**：**當 Legacy 行為與正式規格衝突時，以 Spec Test 為準。** 我們必須在測試中明確記錄此差異，並透過寫入 Adapter 來做雲端 Schema 轉換，而不應妥協將壞行為寫入新 Core。

---

## 6. 系統層級 Feature Flags

為確保重構步驟完全安全、可局部 Rollback，採用 **System-Level Feature Flags**。這些 Flags 可在配置檔中動態切換：
- `useCoreDice`：切換使用新 Core 的骰子系統或舊版隨機骰。
- `useCoreMovement`：切換使用新 Core 的移動邏輯或舊版移動計算。
- `useCoreTurn`：切換使用新 Core 的回合判定與輪空跳過。
- `useCoreEventQueue`：切換使用新 Core 的事件佇列管理器。
- `useCoreFinancial`：切換使用新 Core 的財務計費、被動收入與 Payday 結算。
- `useCoreCard`：切換使用新 Core 的卡片抽取與效果 Resolver。

每個 Flag 都是獨立的開關。若在測試過程中發現新 Core 某模組有 bug，可個別將其設為 `false`，立即退回使用 Legacy 程式碼運行。

---

## 7. 遷移步驟與第一階段里程碑

### 🎯 Milestone 0：建立 Core 空殼與 Adapter
本階段不改變、不接管任何實質的遊戲行為，純粹建立基礎架構與橋樑。
- **實作內容**：
  1. 建立 `src/game/state`、`src/game/core` 空殼，以及空跑的 Command Gateway 於 `src/game/commands`。
  2. 建立 `src/game/adapters` 資料結構，在 `RoomContext` 與 `GameContext` 內部掛載 Gateway 初始化，但不分流任何實體指令。
- **完成條件（Success Criteria）**：
  - 現有遊戲可正常啟動。
  - 可以像平常一樣正常建立房間。
  - 可加入兩位玩家（或三位玩家）。
  - 可正常開始遊戲，且不改變任何既有流程。
  - 本地所有單元測試與 Vite build 通過。

### 階段二：移動與回合核心遷移
- **步驟 1：Dice & Board & Movement (System-Level Flag: `useCoreDice` & `useCoreMovement`)**
- **步驟 2：Turn System (System-Level Flag: `useCoreTurn`)**

### 階段三：事件佇列與卡片流遷移
- **步驟 3：Board Event Queue (System-Level Flag: `useCoreEventQueue`)**
- **步驟 4：Card Decks & Reveal (System-Level Flag: `useCoreCard`)**

### 階段四：財務與資產系統遷移
- **步驟 5：Financial Kernel & Payday (System-Level Flag: `useCoreFinancial`)**
- **步驟 6：Asset & Liability / Loan & Insurance**

### 階段五：特殊格與人生決策遷移
- **步驟 7：Special Squares (Bank, School, Hospital, Repair)**
- **步驟 8：Happiness & Family Milestone & Profession & Business**
- **步驟 9：Multiplayer Shared Events**
- **步驟 10：Settlement**

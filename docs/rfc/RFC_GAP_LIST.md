# RFC Gap List

## 1. Purpose

本文件是整個專案的唯一 Gap 管理文件。

本文件不是正式 GDD，不是產品規格，不是重構方案，也不做產品決策。

本文件唯一目的如下：

- 彙整所有 RFC 中已發現的 `Problem`
- 彙整所有 RFC 中的 `Need Confirmation`
- 彙整目前程式實作與正式 GDD 的衝突
- 彙整 RFC 與 RFC 之間的衝突
- 彙整架構、State、同步、Ownership、Legacy 與資料模型衝突
- 彙整目前尚未完成實作的部分

本文件的判讀原則如下：

- 若程式與 RFC 不一致，以目前程式為主描述現況
- 若 RFC 與 GDD 不一致，保留衝突，不裁定哪一方正確
- 若多份 RFC 描述的是同一個核心問題，合併成單一 Gap，並交叉引用
- 本文件不提供解法，不提出重構方案，不補做產品決策

## 2. Gap Categories

本文件使用以下 Gap 分類。

| Category | 定義 |
|---|---|
| `Architecture Gap` | 系統分層、Context、Hooks、資料流、責任邊界的衝突或不清楚 |
| `Implementation Gap` | 正式 GDD 已定義，但目前程式尚未符合 |
| `Specification Gap` | RFC、GDD、程式之間存在規則定義衝突 |
| `State Gap` | State 重複、來源不明、共享/本地邊界不清楚 |
| `Synchronization Gap` | Firestore、多端同步、snapshot、race condition 相關問題 |
| `Ownership Gap` | 誰可以操作、誰是事件/資產/回合擁有者不清楚 |
| `Multiplayer Gap` | 多人同時互動、事件阻塞、回合切換、共同參與不一致 |
| `Legacy Gap` | 舊欄位、舊命名、相容資料仍參與正式流程 |
| `Data Model Gap` | 正式資料結構不存在、資料只靠字串或推導 |
| `Flow Gap` | 流程完成點、事件推進點、UI 關閉點不一致 |
| `UI Gap` | UI 顯示與資料層邏輯不一致，或 UI gate 取代正式規則 |
| `Financial Gap` | 財務檢核、交易落帳、現金/負債/歷史更新不一致 |
| `Asset Gap` | 資產分類、持有狀態、估值、買賣規則不一致 |
| `Card Gap` | 抽牌、揭露、後續卡、牌堆、ownership、unsupported card 問題 |
| `Board Gap` | 棋盤格、經過/停留、移動、特殊格規則不一致 |
| `Event Gap` | 事件生命週期、Queue、Current Event、Follow-up、Completion 衝突 |
| `Market Gap` | 市場價格來源、行情更新、新聞卡套用、估值衝突 |
| `Dependency Gap` | 系統之間依賴方向不清、模組相互滲透 |
| `Naming Gap` | 命名不一致，導致資料語意分裂 |
| `Documentation Gap` | 文件之間互相衝突，或文件仍留有未閉合議題 |

## 3. Gap Summary

### 3.1 Total

本次去重後的主 Gap 數量：`22`

### 3.2 By Category

| Category | Count |
|---|---:|
| `Architecture Gap` | 3 |
| `Implementation Gap` | 9 |
| `Specification Gap` | 7 |
| `State Gap` | 3 |
| `Synchronization Gap` | 4 |
| `Ownership Gap` | 3 |
| `Multiplayer Gap` | 5 |
| `Legacy Gap` | 3 |
| `Data Model Gap` | 5 |
| `Flow Gap` | 6 |
| `UI Gap` | 4 |
| `Financial Gap` | 5 |
| `Asset Gap` | 5 |
| `Card Gap` | 4 |
| `Board Gap` | 4 |
| `Event Gap` | 6 |
| `Market Gap` | 3 |
| `Dependency Gap` | 2 |
| `Naming Gap` | 4 |
| `Documentation Gap` | 4 |

### 3.3 Highest-Impact Gap Clusters

1. 回合、事件與 Queue 的正式完成點與目前程式不一致。
2. `GameState`、`room.playerStates`、`room.marketPrices`、`gameState.marketPrices` 的權威來源未收斂。
3. `loans` / `liabilities`、`aircraft` / `vehicle` 等 Legacy 資料仍直接參與正式流程。
4. Follow-up card、School、Family Milestone、Repair Shop 等事件鏈仍存在程式 / RFC / GDD 三方衝突。
5. 多人同步大量依賴 UI gate 與 client-side guard，而不是完整共享狀態約束。

## 4. Core System Gaps

### GAP-001

- **Title**: Turn completion 與 current turn 切換時機衝突
- **System**: Turn
- **Category**: `Specification Gap`, `Multiplayer Gap`, `Flow Gap`, `Implementation Gap`
- **Description**: 正式 GDD 要求所有事件完成後才切下一位玩家，但目前程式在 movement resolution 時就先切 `currentTurnUid`，事件之後才繼續處理。
- **Current Implementation**: `buildBoardMovementResolution()` 會先更新位置並切換 `currentTurnUid`，`pendingEvents` 與 `currentEvent` 之後才由原玩家端繼續處理。
- **Related GDD**: `TURN_SYSTEM.md`, `EVENT_SYSTEM.md`, `BOARD_SYSTEM.md`
- **Related RFC**: `TURN_SYSTEM_RFC.md`, `BOARD_SYSTEM_RFC.md`, `EVENT_SYSTEM_RFC.md`, `SCHOOL_SYSTEM_RFC.md`
- **Affected Systems**: Turn, Board, Event, Card, School, Family, Multiplayer
- **Current Status**: Open
- **Decision Required**: No

### GAP-002

- **Title**: Shared Event 與 Local Event Flow 分層未落實到程式
- **System**: Event
- **Category**: `Architecture Gap`, `Event Gap`, `Flow Gap`, `Implementation Gap`
- **Description**: 正式 GDD 已定義 Shared Board Events / Shared Event-like States / Local Event Flows 三層模型，但目前程式的事件推進仍散落在 `RoomContext`、`GameView`、Modal 與 local state。
- **Current Implementation**: Queue 與 current event 在 `room.boardState`；`boardFinancialAction`、`pendingForcedBoardPayment`、`pendingBoardStepAdvance`、`shouldResumeBankFollowup` 等在 `GameView` 本地 state。
- **Related GDD**: `EVENT_SYSTEM.md`, `TURN_SYSTEM.md`
- **Related RFC**: `EVENT_SYSTEM_RFC.md`, `ARCHITECTURE_RFC.md`
- **Affected Systems**: Event, Turn, Board, Financial, Card, UI
- **Current Status**: Open
- **Decision Required**: No

### GAP-003

- **Title**: Follow-up Card 未正式 queue 化
- **System**: Card
- **Category**: `Card Gap`, `Event Gap`, `Implementation Gap`, `Flow Gap`
- **Description**: 正式 GDD 要求所有正式 Card Event 都遵循 Queue -> Current -> Complete；目前 follow-up 與 exam happiness 仍可能直接覆寫 `currentEvent/currentCard`。
- **Current Implementation**: `drawPostExamHappinessCard()`、`drawBoardFollowupCard()` 直接寫入新的 `currentEvent` 與 `currentCard`，不是完整排入 queue。
- **Related GDD**: `CARD_SYSTEM.md`, `EVENT_SYSTEM.md`, `TURN_SYSTEM.md`
- **Related RFC**: `CARD_SYSTEM_RFC.md`, `SCHOOL_SYSTEM_RFC.md`, `TURN_SYSTEM_RFC.md`
- **Affected Systems**: Card, Event, School, Turn, Board
- **Current Status**: Open
- **Decision Required**: No

### GAP-004

- **Title**: Bank Event 與 Bank Service Window 已文件化分離，但程式仍混合實作
- **System**: Bank
- **Category**: `Specification Gap`, `Flow Gap`, `Implementation Gap`
- **Description**: 正式 GDD 把 Bank Event 與 Bank Service Window 明確分為兩層；目前程式仍以 `PaydayModal + follow-up + bankServiceWindowActive` 混合控制。
- **Current Implementation**: 經過銀行後，玩家端本地 `GameView` 依 `bankServiceWindowActive` 與 prompt key 開啟 `PaydayModal`，follow-up 只涵蓋部分商品，窗口則可能在事件關閉後仍持續存在。
- **Related GDD**: `BANK_SYSTEM.md`, `TURN_SYSTEM.md`
- **Related RFC**: `BANK_SYSTEM_RFC.md`, `ARCHITECTURE_RFC.md`
- **Affected Systems**: Bank, Turn, Financial, UI
- **Current Status**: Open
- **Decision Required**: No

### GAP-005

- **Title**: Financial Check 完成點與正式交易成立點未完全一致
- **System**: Financial
- **Category**: `Financial Gap`, `Flow Gap`, `Implementation Gap`
- **Description**: 正式 GDD 要求所有正式交易在 Financial Check 成功完成後才正式寫入玩家資料；目前不同交易入口的完成點依賴不同 UI/handler。
- **Current Implementation**: 一般交易與棋盤交易都會進入財務檢核，但 apply 點分散在 `useGameLogic.handleTransactionSubmit()`、Board modal `onApply` 與一些直接 state mutation 的流程中。
- **Related GDD**: `FINANCIAL_SYSTEM.md`, `BANK_SYSTEM.md`, `ASSET_SYSTEM.md`
- **Related RFC**: `FINANCIAL_SYSTEM_RFC.md`, `BANK_SYSTEM_RFC.md`, `REAL_ESTATE_SYSTEM_RFC.md`, `BUSINESS_SYSTEM_RFC.md`
- **Affected Systems**: Financial, Asset, Bank, Board, Card, Dream, Business, Real Estate
- **Current Status**: Open
- **Decision Required**: No

### GAP-006

- **Title**: Asset ownership 與 asset attachment 雖有正式規格，但程式仍靠分散欄位與名稱比對
- **System**: Asset
- **Category**: `Asset Gap`, `Data Model Gap`, `Implementation Gap`
- **Description**: 正式 GDD 規定資產 ownership 以 `GameState.assets` 為準，保險、upgrade、self-use 等狀態需與資產綁定；目前房貸、車貸、房屋保險、企業升級等仍常靠 `name`、`symbol` 或分散欄位推導。
- **Current Implementation**: `findRelatedLiability()` 透過資產 type + 名稱內 symbol 對應負債；房屋保險靠 `Asset.isInsured`；企業升級靠 `isUpgraded`；無獨立 linkage model。
- **Related GDD**: `ASSET_SYSTEM.md`, `FINANCIAL_SYSTEM.md`
- **Related RFC**: `ASSET_SYSTEM_RFC.md`, `REAL_ESTATE_SYSTEM_RFC.md`, `BUSINESS_SYSTEM_RFC.md`, `INSURANCE_SYSTEM_RFC.md`
- **Affected Systems**: Asset, Loan, Insurance, Real Estate, Business, Financial
- **Current Status**: Open
- **Decision Required**: No

## 5. Domain System Gaps

### GAP-007

- **Title**: Insurance 正式規格未完整落到資料模型與理賠流程
- **System**: Insurance
- **Category**: `Implementation Gap`, `Data Model Gap`, `Financial Gap`, `Legacy Gap`
- **Description**: 保險正式規格要求有明確購買入口、每月支出與後續理賠系統邊界；目前房屋/汽車保險主要只落在 `Asset.isInsured` 與支出摘要，醫療保險則是 count，三者模型不一致。
- **Current Implementation**: 醫療保險用 `medicalInsuranceCount`；房屋與車輛保險用 `asset.isInsured`；汽車保險內部 payload 仍常用 `aircraft`。
- **Related GDD**: `BANK_SYSTEM.md`, `ASSET_SYSTEM.md`, `FINANCIAL_SYSTEM.md`
- **Related RFC**: `INSURANCE_SYSTEM_RFC.md`, `ASSET_SYSTEM_RFC.md`, `BANK_SYSTEM_RFC.md`
- **Affected Systems**: Insurance, Bank, Asset, Financial, Loan
- **Current Status**: Open
- **Decision Required**: Yes

### GAP-008

- **Title**: Loan 權威來源未完全從 legacy `loans` 收斂到 `liabilities`
- **System**: Loan
- **Category**: `Legacy Gap`, `State Gap`, `Financial Gap`, `Data Model Gap`
- **Description**: 正式 GDD 已明定 `liabilities` 是正式負債權威，`loans` 只保留 legacy 相容；但目前程式仍以兩者並存參與摘要、借款與還款流程。
- **Current Implementation**: `calculateFinancialSummary()` 同時計入 `liabilities` 與 `gameState.loans`；借貸與償還流程仍處理兩者。
- **Related GDD**: `BANK_SYSTEM.md`, `FINANCIAL_SYSTEM.md`, `ASSET_SYSTEM.md`
- **Related RFC**: `LOAN_SYSTEM_RFC.md`, `FINANCIAL_SYSTEM_RFC.md`, `ASSET_SYSTEM_RFC.md`
- **Affected Systems**: Loan, Financial, Asset, Business, Real Estate, Vehicle
- **Current Status**: Open
- **Decision Required**: No

### GAP-009

- **Title**: Market price 權威來源與同步副本未完全收斂
- **System**: Market
- **Category**: `Market Gap`, `State Gap`, `Synchronization Gap`, `Implementation Gap`
- **Description**: 正式 GDD 要求股票價格唯一正式來源是 `room.marketPrices`，`playerState.marketPrices` 只是同步副本；目前 UI 與估值仍大量直接使用本地 `gameState.marketPrices`，且 `BankingAppModal` 還會再套用新聞卡當前價格覆蓋顯示。
- **Current Implementation**: `room.marketPrices`、`room.previousMarketPrices`、`gameState.marketPrices`、`gameState.previousMarketPrices` 並存，且顯示與估值使用點不一致。
- **Related GDD**: `BANK_SYSTEM.md`, `FINANCIAL_SYSTEM.md`, `ASSET_SYSTEM.md`, `CARD_SYSTEM.md`
- **Related RFC**: `MARKET_SYSTEM_RFC.md`, `ASSET_SYSTEM_RFC.md`, `BANK_SYSTEM_RFC.md`, `ARCHITECTURE_RFC.md`
- **Affected Systems**: Market, Card, Asset, Financial, Bank, UI
- **Current Status**: Open
- **Decision Required**: No

### GAP-010

- **Title**: School event completion、follow-up 與 turn blocking 仍與正式規格衝突
- **System**: School
- **Category**: `Implementation Gap`, `Event Gap`, `Multiplayer Gap`, `Flow Gap`
- **Description**: 正式 GDD 要求參加考試後，不論成功失敗都抽 Happiness Card，且整個 School event 完成前不得切下一位；目前程式仍在回合切換後才本地處理 school 流程。
- **Current Implementation**: `PromotionModal`、`DiceRollModal` 與 `drawPostExamHappinessCard()` 在 `GameView` 本地串接，回合切換與 queue 完成點未一致。
- **Related GDD**: `TURN_SYSTEM.md`, `BOARD_SYSTEM.md`, `EVENT_SYSTEM.md`, `CARD_SYSTEM.md`
- **Related RFC**: `SCHOOL_SYSTEM_RFC.md`, `TURN_SYSTEM_RFC.md`, `BOARD_SYSTEM_RFC.md`
- **Affected Systems**: School, Turn, Event, Card, Board, Multiplayer
- **Current Status**: Open
- **Decision Required**: No

### GAP-011

- **Title**: Hospital / Repair Shop 正式事件化與目前實作成熟度不一致
- **System**: Hospital, Repair
- **Category**: `Implementation Gap`, `Board Gap`, `Event Gap`
- **Description**: Hospital 已有較完整流程，但 Repair Shop 仍主要是提示文字與 skip turn，尚未形成和 GDD 一致的正式 queue event。
- **Current Implementation**: Hospital 有 `hospital` event 與 `showHospitalRollModal`；Repair 沒有正式 `repair` event type、專屬 modal 或完整 queue entry。
- **Related GDD**: `TURN_SYSTEM.md`, `BOARD_SYSTEM.md`, `EVENT_SYSTEM.md`
- **Related RFC**: `HOSPITAL_SYSTEM_RFC.md`, `REPAIR_SYSTEM_RFC.md`, `BOARD_SYSTEM_RFC.md`, `TURN_SYSTEM_RFC.md`
- **Affected Systems**: Board, Event, Turn, Vehicle, Financial
- **Current Status**: Open
- **Decision Required**: No

### GAP-012

- **Title**: Profession / promotion 流程混合一般升等、學校考試與終身學習
- **System**: Profession
- **Category**: `Flow Gap`, `Data Model Gap`, `Documentation Gap`
- **Description**: 職業升等、學校考試、終身學習共用部分 UI 與骰子邏輯，但正式規格已分層；目前 profession 的正式資料與事件資料邊界仍不清楚。
- **Current Implementation**: `useDiceRollLogic` 用同一組 modal / roll state 處理多種 promotionType；`profession.promotions` 同時承擔資料、條件文字與獎勵來源。
- **Related GDD**: `TURN_SYSTEM.md`
- **Related RFC**: `PROFESSION_SYSTEM_RFC.md`, `SCHOOL_SYSTEM_RFC.md`
- **Affected Systems**: Profession, School, Financial, Event
- **Current Status**: Open
- **Decision Required**: Yes

### GAP-013

- **Title**: Dream 目前存在雙入口、雙名稱、雙語意
- **System**: Dream
- **Category**: `Specification Gap`, `Naming Gap`, `Asset Gap`, `Financial Gap`
- **Description**: 程式內同時存在 `實現人生夢想` 與 `實現夢想`，且一條把夢想當幸福結果，一條送出 `type: '夢想'` 的 asset-like payload。
- **Current Implementation**: `handleTransactionSubmit()` 只在命中 `實現人生夢想` 時更新 `h_dream`；`TargetAndDreamModal` 會送出 `buy_asset` / `type: '夢想'`。
- **Related GDD**: `ASSET_SYSTEM.md`, `FINANCIAL_SYSTEM.md`
- **Related RFC**: `DREAM_SYSTEM_RFC.md`
- **Affected Systems**: Dream, Happiness, Financial, Asset, UI
- **Current Status**: Open
- **Decision Required**: Yes

### GAP-014

- **Title**: Happiness 勝利語意、家庭歷程語意與程式現況未完全一致
- **System**: Happiness, Family
- **Category**: `Specification Gap`, `Flow Gap`, `Multiplayer Gap`
- **Description**: Happiness 100 分、被動收入大於總支出、家庭歷程完成、共同參與等待條件目前是多條並存語意。
- **Current Implementation**: `GameView` 用 `happinessTotal >= 100` 觸發勝利動畫；`saveGameRecord()` / score logic 另以 `passiveIncome > totalExpenses` 表示 `isWin`；家庭歷程完成又混合 `completedHappinessEvents`、`happiness.checked`、`familyMilestoneJoinPrompt`。
- **Related GDD**: `TURN_SYSTEM.md`, `BOARD_SYSTEM.md`, `FINANCIAL_SYSTEM.md`, `CARD_SYSTEM.md`
- **Related RFC**: `HAPPINESS_SYSTEM_RFC.md`, `FAMILY_SYSTEM_RFC.md`, `DREAM_SYSTEM_RFC.md`
- **Affected Systems**: Happiness, Family, Dream, Turn, Card, Financial
- **Current Status**: Open
- **Decision Required**: Yes

### GAP-015

- **Title**: Real Estate market 仍只有卡號清單，缺少正式市場資料結構
- **System**: Real Estate
- **Category**: `Data Model Gap`, `Implementation Gap`, `Asset Gap`
- **Description**: 正式 GDD 要求房屋市場有正式資料結構，不應只依賴卡號清單；目前 `boardState.realEstateMarket` 仍只是 `string[]`。
- **Current Implementation**: 只保存可購買房卡 cardId，沒有價格、持有人、條件、來源事件等欄位。
- **Related GDD**: `ASSET_SYSTEM.md`, `BOARD_SYSTEM.md`
- **Related RFC**: `REAL_ESTATE_SYSTEM_RFC.md`, `ASSET_SYSTEM_RFC.md`
- **Affected Systems**: Real Estate, Asset, Board, Market, Financial
- **Current Status**: Open
- **Decision Required**: No

### GAP-016

- **Title**: Business asset acquisition、upgrade 與 unsupported business card 邏輯尚未收斂
- **System**: Business
- **Category**: `Implementation Gap`, `Data Model Gap`, `Card Gap`
- **Description**: 企業取得、升級、cashflow、貸款已有部分流程，但 Business RFC 仍保留 unsupported / acquisition 語意分裂問題。
- **Current Implementation**: 企業是正式資產類型之一，但 acquisition/upgrade 的流程與命名仍部分依賴舊行為或 unsupported card。
- **Related GDD**: `ASSET_SYSTEM.md`, `FINANCIAL_SYSTEM.md`, `CARD_SYSTEM.md`
- **Related RFC**: `BUSINESS_SYSTEM_RFC.md`, `ASSET_SYSTEM_RFC.md`, `CARD_SYSTEM_RFC.md`
- **Affected Systems**: Business, Asset, Card, Financial, Loan
- **Current Status**: Open
- **Decision Required**: Yes

## 6. Architecture Gaps

### GAP-017

- **Title**: Context responsibility 過度集中且邊界不清
- **System**: Architecture
- **Category**: `Architecture Gap`, `Dependency Gap`
- **Description**: `RoomContext` 與 `GameContext` 都承擔了超出單一責任的範圍，且 `GameView` 需要同時掌握三個 Context 與大量本地流程狀態。
- **Current Implementation**: `RoomContext` 管房間、事件、queue、timer、market、request；`GameContext` 管玩家 state、autosave、room sync、history、summary、alerts；`GameView` 是大 orchestration hub。
- **Related GDD**: 無直接正式架構 GDD；間接受 `TURN_SYSTEM.md`, `EVENT_SYSTEM.md`, `BANK_SYSTEM.md` 影響
- **Related RFC**: `ARCHITECTURE_RFC.md`
- **Affected Systems**: All core systems
- **Current Status**: Open
- **Decision Required**: Yes

### GAP-018

- **Title**: Source of Truth 邊界未正式收斂
- **System**: Architecture, State
- **Category**: `State Gap`, `Synchronization Gap`, `Documentation Gap`
- **Description**: 多份文件與程式都提到正式權威來源，但目前仍有多份重複狀態並行，例如玩家 state、行情、副本、結算結果與勝利條件。
- **Current Implementation**: `gameState` / `room.playerStates`、`room.marketPrices` / `gameState.marketPrices`、`currentTurnUid` / local modal guard 等並存。
- **Related GDD**: `BANK_SYSTEM.md`, `FINANCIAL_SYSTEM.md`, `ASSET_SYSTEM.md`, `EVENT_SYSTEM.md`
- **Related RFC**: `ARCHITECTURE_RFC.md`, `ASSET_SYSTEM_RFC.md`, `BANK_SYSTEM_RFC.md`, `FINANCIAL_SYSTEM_RFC.md`, `MARKET_SYSTEM_RFC.md`
- **Affected Systems**: State, Sync, Market, Financial, Asset, Event, Turn
- **Current Status**: Open
- **Decision Required**: Yes

### GAP-019

- **Title**: URL routing 與 UI flow 仍以本地 view state 為中心
- **System**: UI Flow, Architecture
- **Category**: `UI Gap`, `Architecture Gap`
- **Description**: 主站沒有 React Router，除了 `?boardRoom=` 外，多數畫面無法以 URL 表達，目前完全依賴 `currentView`。
- **Current Implementation**: `App.tsx` 用 `currentView` 切換 `lobby`、`selection`、`game`、`score`、`coach_monitor` 等畫面。
- **Related GDD**: 無直接對應
- **Related RFC**: `ARCHITECTURE_RFC.md`
- **Affected Systems**: UI Flow, App Shell, Lobby, Game
- **Current Status**: Open
- **Decision Required**: Yes


### Architecture Gap Index

| Area | Related Gap ID | Summary |
|---|---|---|
| Context | `GAP-017` | `RoomContext` / `GameContext` 責任過度集中 |
| Hooks | `GAP-017`, `GAP-002`, `GAP-005` | Hook 與 View orchestration 邊界不清 |
| State | `GAP-018`, `GAP-008`, `GAP-009` | 正式 state 與副本並行 |
| Firestore | `GAP-018`, `GAP-001`, `GAP-009` | room document 承載過多共享狀態，且同步邊界未收斂 |
| Modal | `GAP-002`, `GAP-005`, `GAP-010` | Modal 關閉點與正式完成點不一致 |
| Data Flow | `GAP-005`, `GAP-017` | Transaction / event apply 點分散 |
| UI Flow | `GAP-019`, `GAP-010`, `GAP-004` | 本地 view / modal state 仍主導流程觀感 |
| Dependency | `GAP-017` | `GameView` 與多 Context / 多流程高度耦合 |
| Architecture | `GAP-017`, `GAP-018`, `GAP-019` | 整體邊界仍待正式化 |
| Source of Truth | `GAP-018`, `GAP-008`, `GAP-009` | 權威來源未完全收斂 |
| Legacy | `GAP-008`, `GAP-007`, `GAP-Legacy-01`, `GAP-Legacy-02`, `GAP-Legacy-03` | Legacy 欄位仍直接參與正式流程 |

## 7. Cross-System Gaps

| Gap ID | Cross-System Impact | Description |
|---|---|---|
| `GAP-001` | Turn ↔ Event ↔ Board ↔ Card | 回合切換早於事件完成，影響所有後續事件鏈與多人同步判讀 |
| `GAP-002` | Event ↔ Financial ↔ UI | Shared event 與 local flow 分層未落地，完成點散落 |
| `GAP-003` | Card ↔ Event ↔ School | Follow-up card 直接覆寫 current event/card，不走正式 queue |
| `GAP-004` | Bank ↔ Turn ↔ Financial | Bank Event 與 Service Window 在規格已分離，但程式仍混用 |
| `GAP-005` | Financial ↔ Asset ↔ Card ↔ Board | 交易成立點與 Financial Check 完成點未完全一致 |
| `GAP-007` | Insurance ↔ Bank ↔ Asset ↔ Financial | 保險狀態、保費與理賠流程模型不一致 |
| `GAP-008` | Loan ↔ Financial ↔ Asset | `loans` 與 `liabilities` 併存造成負債權威衝突 |
| `GAP-009` | Market ↔ Card ↔ Asset ↔ Financial | 行情價格權威與副本並行，顯示與估值點不一致 |
| `GAP-010` | Board ↔ School ↔ Card ↔ Turn | 學校流程、後續幸福卡與回合阻塞仍衝突 |
| `GAP-011` | Board ↔ Repair ↔ Vehicle ↔ Financial | 維修廠正式事件化仍未完成 |
| `GAP-014` | Family ↔ Happiness ↔ Dream ↔ Financial | 勝利條件、幸福完成與共同參與完成點多語意並存 |
| `GAP-015` | Real Estate ↔ Board ↔ Asset ↔ Market | 房市資料結構尚未正式化 |
| `GAP-016` | Business ↔ Card ↔ Asset ↔ Financial | 企業收購、升級、unsupported card 邏輯尚未收斂 |

## 8. State & Synchronization Gaps

### 8.1 Repeated State

| Gap Theme | Current Repetition |
|---|---|
| 玩家正式狀態 | `GameContext.gameState`、`rooms.playerStates.{uid}`、`player_sessions`、localStorage `happiness_game_state` |
| 市場價格 | `room.marketPrices`、`room.previousMarketPrices`、`gameState.marketPrices`、`gameState.previousMarketPrices` |
| 回合與事件阻塞 | `currentTurnUid`、`currentEvent`、`pendingEvents`、大量本地 modal / pending flags |
| 家庭歷程 | `completedHappinessEvents`、`happiness.checked`、`familyMilestoneJoinPrompt`、`pendingFamilyMilestoneJoinAction` |
| 勝利/完成 | `happinessTotal >= 100`、`isWin = passiveIncome > totalExpenses`、`room.status = finished` |

### 8.2 Synchronization Copies

- `room.playerStates` 是共享版玩家資料；`gameState` 是本地版玩家資料。
- `room.marketPrices` 是共享行情；`gameState.marketPrices` 是玩家副本。
- `player_sessions` 是玩家 session 備份；`score_records` 是正式結算版。
- `room.boardState` 是共享事件來源；`GameView` 本地 state 是事件內部處理暫態。

### 8.3 Source of Truth Inconsistency

1. 玩家財務狀態到底以 `gameState` 還是 `room.playerStates` 為正式執行中權威，程式仍是雙軌。
2. 股票價格正式權威已在 GDD 定為 `room.marketPrices`，但程式與部分 RFC 仍直接引用 `gameState.marketPrices`。
3. 負債正式權威已在 GDD 定為 `liabilities`，但程式仍讓 `loans` 參與正式計算。
4. 事件完成是否以 shared room state 還是 local modal completion 為準，程式未完全一致。

## 9. Legacy Gaps

### GAP-Legacy-01

- **Legacy Item**: `loans`
- **Current Locations**: `GameState`、`calculateFinancialSummary()`、借款/還款流程、部分 RFC
- **Dependent Systems**: Loan, Financial, Bank, Business, Real Estate
- **Mentioned In RFC**: `LOAN_SYSTEM_RFC.md`, `FINANCIAL_SYSTEM_RFC.md`, `ASSET_SYSTEM_RFC.md`, `BUSINESS_SYSTEM_RFC.md`
- **Description**: 已被正式規格降為 legacy 相容欄位，但目前仍參與正式摘要與還款。

### GAP-Legacy-02

- **Legacy Item**: `aircraft` / `飛行器` / `飛行器貸款`
- **Current Locations**: `Asset.type`、`Liability.type`、保險 payload、車輛判定、部分 UI 與 RFC
- **Dependent Systems**: Asset, Vehicle, Insurance, Loan, Board
- **Mentioned In RFC**: `ASSET_SYSTEM_RFC.md`, `INSURANCE_SYSTEM_RFC.md`, `LOAN_SYSTEM_RFC.md`, `REPAIR_SYSTEM_RFC.md`
- **Description**: 正式規格統一為汽車，但程式仍大量兼容舊命名並直接參與邏輯。

### GAP-Legacy-03

- **Legacy Item**: `lastPurchasePrice` 作為價格 fallback
- **Current Locations**: 股票估值、資產顯示、交易回滾
- **Dependent Systems**: Market, Asset, Financial
- **Mentioned In RFC**: `ASSET_SYSTEM_RFC.md`, `MARKET_SYSTEM_RFC.md`, `FINANCIAL_SYSTEM_RFC.md`
- **Description**: 正式規格只允許它作為 fallback，但程式仍在一般估值流程裡直接使用。

## 10. Ownership Gaps

| Theme | Current Gap |
|---|---|
| Card Ownership | 一般卡片多由事件玩家操作，但資料層對 reveal / dismiss / advance 的所有者驗證不完整 |
| Turn Ownership | `currentTurnUid` 是共享回合擁有者，但事件未完成時下一位可能已持有 turn ownership |
| Room Ownership | 房主掌控 start/finish/close，但 room 更新大量是一般成員也可寫的共享欄位 |
| Bank Ownership | 股票/貸款/汽車是常駐功能，保險/定存需銀行窗口；但 UI 與資料層權限邊界仍部分依賴前端 gate |
| Family Ownership | 主卡玩家、共同參與玩家、pending action 玩家三種 ownership 並存，完成點仍未完全一致 |
| Asset Ownership | 正式上以 `assets` 為 ownership，但貸款/保險/upgrade attachment 仍有名稱比對 |
| Event Ownership | `advanceBoardEventQueue()` 等共享操作仍缺少完整事件所有者驗證 |

## 11. Multiplayer Gaps

1. `currentTurnUid` 已切換但 `currentEvent` 尚未完成，造成回合與事件所有權重疊。
2. Firestore 主要靠 `updateDoc` + client-side 組物件，存在最後寫入覆蓋風險。
3. `revealBoardCard`、`dismissBoardCard`、`advanceBoardEventQueue` 等共享事件推進 API 仍以條件寫入為主，未形成完整 ownership barrier。
4. Family Milestone 需要多人同步回覆，但 source card 是否等待全部回覆完成，在現況與文件之間存在衝突。
5. Market 更新、Card Reveal、Financial Check 完成點在多端 UI 上的顯示時機可能不同。
6. 投影端與執行師端都讀 room snapshot，但玩家本地流程 state 不會同步過去，因此看到的是共享事件外觀，不是本地處理進度。

## 12. Open Questions

| System | Question | Reason | Related RFC | Current Implementation |
|---|---|---|---|---|
| Bank | 停留銀行是否保證建立 Bank Event | 程式與 RFC 仍提到需進一步確認 | `BANK_SYSTEM_RFC.md` | 經過銀行一定建立 path event；停留銀行現況描述不一致 |
| Bank | `payday` request type 是否已廢棄 | room.pendingRequests 型別仍存在 `payday` | `BANK_SYSTEM_RFC.md` | 主遊戲找不到明確呼叫端 |
| Business | `selectedEnterprise` 是否只是開局資料 | 企業 ownership 與開局選擇角色尚未完全分離 | `BUSINESS_SYSTEM_RFC.md` | 兩者並存 |
| Business | `large_enterprise` unsupported 是否保留 | 企業卡池仍有未完成動作 | `BUSINESS_SYSTEM_RFC.md` | unsupported 仍存在 |
| Family | 沒有 eligible player 時是否直接略過 | 影響是否建立 shared prompt | `FAMILY_SYSTEM_RFC.md` | 目前傾向不建立 prompt |
| Family | source event 是否要等所有 passed player 處理完 pending action | 影響正式 completion rule | `FAMILY_SYSTEM_RFC.md` | 現況未完全保證 |
| Financial | 現金是否允許任何情況下為負 | 影響 Forced Debt 與交易成立點 | `FINANCIAL_SYSTEM_RFC.md` | 未看到全域硬限制 |
| Happiness | `H016-H020` 精確卡名與費用 | RFC 仍標為 TODO | `HAPPINESS_SYSTEM_RFC.md` | 未完全文件化 |
| Happiness | `H043-H046` 是否應接入正式家庭歷程規則 | 影響 family milestone stage mapping | `HAPPINESS_SYSTEM_RFC.md` | 目前未完整接入 |
| Insurance | 房屋保險是否要獨立理賠狀態 | 目前只有 `Asset.isInsured` | `INSURANCE_SYSTEM_RFC.md` | 無獨立理賠資料 |
| Insurance | 三種保險理賠是否要走統一 Financial Check 鏈 | 目前流程不一致 | `INSURANCE_SYSTEM_RFC.md` | 醫療、房屋、汽車路徑不同 |
| Loan | `loans` 是否只保留相容用途 | 仍參與摘要與流程 | `LOAN_SYSTEM_RFC.md` | 雙軌並存 |
| Loan | 自動還款是否只處理 Forced Debt | 目前行為與正式規格可能不一致 | `LOAN_SYSTEM_RFC.md` | 仍需核對完整程式 |
| Profession | `rankExpenseBonus` 是否屬正式 profession 支出 | 目前是計算結果而非獨立 state | `PROFESSION_SYSTEM_RFC.md` | 摘要時計入 |
| Real Estate | 房市是否需正式結構化資料模型 | 目前只有 `string[]` | `REAL_ESTATE_SYSTEM_RFC.md` | 未結構化 |
| Real Estate | 房屋轉換是否可繼續直接在報表介面切換 | 影響財務檢核一致性 | `REAL_ESTATE_SYSTEM_RFC.md` | 目前可直接改 state |
| School | 關閉學校視窗是否等於正式放棄考試 | 影響 school event completion | `SCHOOL_SYSTEM_RFC.md` | 程式現況不明確 |
| School | 學校事件是否必須阻塞到 exam_happiness / follow-up 全完成 | 與正式 GDD 衝突 | `SCHOOL_SYSTEM_RFC.md`, `TURN_SYSTEM_RFC.md` | 目前不阻塞 |
| Turn | 維修廠是否應視為正式阻塞事件 | 產品已在 GDD 定義，但 RFC 曾保留待確認 | `TURN_SYSTEM_RFC.md`, `REPAIR_SYSTEM_RFC.md` | 目前未完整事件化 |
| Turn | 動畫完成是否具有規則效力 | 各流程不一致 | `TURN_SYSTEM_RFC.md` | 有些 blocking，有些純演出 |

## 13. Dependency Impact

| Gap ID | Impacted Systems |
|---|---|
| `GAP-001` | Turn, Board, Event, Card, School, Family, Multiplayer |
| `GAP-002` | Event, Turn, Financial, UI, Board |
| `GAP-003` | Card, Event, School, Turn |
| `GAP-004` | Bank, Financial, Turn, UI |
| `GAP-005` | Financial, Asset, Card, Board, Bank, Dream, Business, Real Estate |
| `GAP-006` | Asset, Loan, Insurance, Real Estate, Business, Financial |
| `GAP-007` | Insurance, Bank, Asset, Financial |
| `GAP-008` | Loan, Financial, Asset, Bank, Business, Real Estate |
| `GAP-009` | Market, Card, Asset, Financial, Bank |
| `GAP-010` | School, Turn, Event, Card, Board, Multiplayer |
| `GAP-011` | Hospital, Repair, Board, Event, Vehicle, Financial |
| `GAP-012` | Profession, School, Event, Financial |
| `GAP-013` | Dream, Happiness, Financial, Asset |
| `GAP-014` | Happiness, Family, Dream, Financial, Turn, Card |
| `GAP-015` | Real Estate, Asset, Board, Market, Financial |
| `GAP-016` | Business, Card, Asset, Financial, Loan |
| `GAP-017` | All core systems |
| `GAP-018` | State, Sync, Market, Financial, Asset, Event, Turn |
| `GAP-019` | UI Flow, App Shell, Lobby, Game |

## 14. Current Implementation Summary

### 已完成且相對成熟的部分

- Firebase Auth + Firestore room snapshot 的多人主幹已完整存在。
- 玩家本地財務系統、交易歷史、摘要計算與執行師監看流程已可運作。
- 棋盤基礎移動、共享 `boardState`、投影端與玩家端同步已可運作。
- 銀行基本入口、股票買賣、貸款借還、定存與保險 UI 已具備可操作流程。
- 正式 GDD 與多份 RFC 已建立，文件骨架完整。

### 仍明顯屬 Legacy 的部分

- `loans`
- `aircraft` / `飛行器` / `飛行器貸款`
- `lastPurchasePrice` 被一般流程直接用於估值
- 部分舊命名與舊 payload 仍在交易、保險、車輛流程裡出現

### 仍未完整的部分

- Repair Shop 正式事件化
- Follow-up card 正式 queue 化
- Family Milestone completion 與多人等待規則
- Real Estate 市場正式資料結構
- Dream 的正式資料語意
- Insurance 理賠正式模型
- Source of Truth 完全收斂

## 15. Next Step

本章節不提出解法，只整理適合交付的下一步歸屬。

### 應優先交由產品決策的 Gap

- `GAP-007` Insurance 正式理賠與狀態模型
- `GAP-012` Profession / Promotion 正式語意邊界
- `GAP-013` Dream 正式語意
- `GAP-014` Happiness / Family / Win condition 正式語意
- `GAP-017` / `GAP-018` 中涉及正式 Source of Truth 與 ownership 的部分

### 應交由未來 Architecture GDD 的 Gap

- `GAP-002` Shared Event vs Local Event Flow
- `GAP-017` Context / Hook / orchestration boundary
- `GAP-018` Source of Truth / Sync boundary
- `GAP-019` App shell / routing / UI flow ownership

### 應交由未來正式 GDD 持續收斂的 Gap

- `GAP-001` Turn completion
- `GAP-003` Follow-up card queue
- `GAP-004` Bank event / service window
- `GAP-005` Financial Check completion
- `GAP-006` Asset ownership / attachment
- `GAP-008` Loan authority
- `GAP-009` Market price authority
- `GAP-010` School event completion
- `GAP-011` Repair / Hospital event maturity
- `GAP-015` Real Estate market model
- `GAP-016` Business asset flow

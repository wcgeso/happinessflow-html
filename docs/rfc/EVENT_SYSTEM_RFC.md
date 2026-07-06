# Event System RFC

> 文件定位：事件系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/TURN_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md` 與目前 `線上版0618` 程式。
>
> 本文件只盤點目前程式真正存在的 Event 架構、生命週期、同步方式與已知衝突，不直接建立正式規格，不自行修正玩法。

## 1. Event Definition

目前程式中的「Event」不是單一 class 或單一 state machine。

可確認的 Event 架構由以下幾層共同組成：

- 共享棋盤事件：
  - `room.boardState.currentEvent`
  - `room.boardState.pendingEvents`
- 共享卡片事件附屬資料：
  - `room.boardState.currentCard`
  - `room.boardState.currentCardReveal`
- 共享多人參與事件附屬資料：
  - `room.boardState.familyMilestoneJoinPrompt`
- 本地事件處理流程：
  - `boardFinancialAction`
  - `pendingForcedBoardPayment`
  - `pendingBoardStepAdvance`
  - `pendingHandledBoardCard`
  - `pendingBoardLifelongRoll`
  - `shouldResumeBankFollowup`
- 其他事件相關 UI state：
  - `showPaydayModal`
  - `showPromotionModal`
  - `showHospitalRollModal`
  - `isBoardCardDrawerOpen`
  - `showForcedBoardPaymentModal`

因此，程式裡的 Event 可以分成三類：

1. `Board Event`
   寫入 Firestore，存在 `currentEvent` / `pendingEvents`
2. `Event-like Shared State`
   不是 `currentEvent.type`，但寫入 Firestore 並影響多人，例如 `familyMilestoneJoinPrompt`
3. `Local Event Flow`
   只存在玩家瀏覽器，例如 `boardFinancialAction`、`pendingForcedBoardPayment`

與 GDD 的衝突：

- `TURN_SYSTEM.md` 與 `BANK_SYSTEM.md` 都已把部分流程當成正式事件規則，但目前程式中並不是所有「玩法事件」都會對應到 `currentEvent.type`。

## 2. Event Types

### 2.1 目前真正存在於 `currentEvent.type` 的類型

依 `src/types.ts` 與 `RoomContext.tsx` 可確認，`BoardEventLog.type` 目前只有以下型別：

- `bank`
- `school`
- `hospital`
- `card`
- `exam_happiness`
- `followup`

### 2.2 目前存在但不是 `currentEvent.type` 的事件型流程

以下流程在玩法上是事件，但不是 `BoardEventLog.type`：

- `Family Milestone Join Prompt`
  共享狀態，寫在 `familyMilestoneJoinPrompt`
- `Forced Payment`
  本地 state，寫在 `pendingForcedBoardPayment`
- `Board Financial Check`
  本地 state，寫在 `boardFinancialAction`
- `Market Apply`
  某些卡片 action 會觸發市場更新，但它本身不是獨立 event type
- `Move To Square`
  某些卡片 effect 會把玩家移到學校 / 醫院 / 銀行，但不會新增新的 `move` 類 event type
- `Apply Board Expense To All Players`
  會批次更新所有玩家支出，但不是獨立 event type

### 2.3 文件與程式衝突點

- `TURN_SYSTEM.md` 已把 `Repair Shop` 視為正式事件，但目前程式沒有 `repair` event type。
- `BANK_SYSTEM.md` 已把 `Bank Event` 視為正式規格，這與目前 `currentEvent.type='bank'` 一致；但 `Bank Service Window` 不是 event type。
- `Forced Payment Event` 在需求上像事件，但目前程式是 local flow，不是共享 event。

## 3. Event Lifecycle

### 3.1 目前可確認存在的生命週期

根據 `STATE_MACHINE.md`，目前程式中確實存在以下事件生命週期片段：

```text
Idle
  -> Queued
  -> Current
  -> Card Hidden（僅卡片）
  -> Reveal（僅卡片）
  -> Decision
  -> Financial Check
  -> Applying
  -> Closing
  -> Completed / Idle
```

### 3.2 各狀態的現況定義

| State | 目前程式依據 |
|---|---|
| `Idle` | `currentEvent=null`、`currentCard=null` |
| `Queued` | `pendingEvents` 有項目 |
| `Current` | `currentEvent` 存在 |
| `Card Hidden` | `currentCard` 存在且 `currentCardReveal.isRevealed=false` |
| `Reveal` | 玩家呼叫 `revealBoardCard()` |
| `Decision` | 卡片 action 為 `choice` / `asset_sale` 等需玩家選擇 |
| `Financial Check` | `boardFinancialAction` 存在 |
| `Applying` | 正在套用卡片、行情、全員支出、移動或玩家本地交易 |
| `Closing` | `dismissBoardCard()` 或 `advanceBoardEventQueue()` 或 `markBoardCardHandled()` |
| `Completed` | queue 已推進，或 local flow 已清除 |

### 3.3 並非所有 Event 都走完整生命週期

- `bank`
  主要走 modal / follow-up，不經 `Reveal`
- `school`
  主要走 modal / dice / happiness，不經 `Reveal`
- `hospital`
  主要走 second roll / financial check，不經 `Reveal`
- `card`
  會走 `Card Hidden -> Reveal -> Decision/Financial Check`
- `exam_happiness`
  是卡片類事件，但不是從 queue 建立
- `followup`
  是卡片類事件，但不是從 queue 建立
- `familyMilestoneJoinPrompt`
  不走 `currentEvent.type` 生命週期

## 4. Event Ownership

### 4.1 只有事件玩家可以操作

- `bank` event 的 payday 與 follow-up
- `school` event 的是否報名與考試
- `hospital` event 的醫療骰與付款
- `card` event 的 reveal、dismiss、choice、asset sale、financial check
- `exam_happiness` / `followup` card 的 reveal 與處理
- `moveCurrentPlayerToSquare()` 觸發後的後續事件處理

### 4.2 所有人可以操作

- `familyMilestoneJoinPrompt` 的 target players 可同時回覆
- 股票、貸款等常駐功能可在其他玩家事件期間操作，但這些不屬 `currentEvent` 所有者流程

### 4.3 執行師可以操作

目前可確認在 Event System 內，執行師主要可操作的是：

- `approveRequest()`
- `rejectRequest()`

但 `Request Approval` 目前未接到主遊戲事件流程。

### 4.4 系統自動操作

- movement 結算建立 queue
- `activateBoardQueueEntry()`
- `shiftBoardQueue()`
- `drawPostExamHappinessCard()`
- `drawBoardFollowupCard()`
- `applyBoardMarketPrices()`
- `applyBoardExpenseToAllPlayers()`
- `moveCurrentPlayerToSquare()`
- `executePayday()` 內的月結餘與自動還款

### 4.5 權限風險

- `advanceBoardEventQueue()` 本身不驗證呼叫者是否為事件所有者
- `dismissBoardCard()` 只驗證是否為 current card，不驗證角色
- 多數 ownership 限制其實依賴 `GameView` UI 與開關狀態

## 5. Event Queue

### 5.1 `pendingEvents` 如何運作

目前 queue 為 `BoardQueuedEvent[]`，每個 item 包含：

- `event: BoardEventLog`
- `card?: BoardCardResult | null`

queue 建立主要發生在 `buildBoardMovementResolution()`。

### 5.2 queue 來源

目前可確認會被推進 queue 的來源有：

- 經過銀行 -> `bank`
- 經過學校 -> `school`
- 停留卡格 -> `card`
- 停留醫院 -> `hospital`

目前不會進 queue 的有：

- `exam_happiness`
- `followup`
- `familyMilestoneJoinPrompt`
- `pendingForcedBoardPayment`
- `boardFinancialAction`
- 維修廠提示

### 5.3 `currentEvent` 如何切換

- movement 結算時，queue 第一個 item 會成為 `currentEvent`
- `activateBoardQueueEntry(entry)` 會同步設定：
  - `currentEvent`
  - `currentCard`
  - `currentCardReveal`
- `shiftBoardQueue()` 會：
  - 取出下一個 queue item
  - 清掉 `familyMilestoneJoinPrompt`
  - 用下一個 item 覆寫 `currentEvent/currentCard/currentCardReveal`

### 5.4 `advanceBoardEventQueue()` 如何推進

已確認行為：

- 可帶 `expectedType`
- 若 `currentEvent.type !== expectedType`，直接 return
- 若符合，就呼叫 `shiftBoardQueue()`
- 若 queue 空，則 `currentEvent/currentCard/currentCardReveal` 會被清空

### 5.5 與 GDD 衝突點

- `TURN_SYSTEM.md` 已把更多玩法視為正式事件；但目前 queue 真正承載的事件種類較少。
- `BANK_SYSTEM.md` 把銀行服務窗口視為正式銀行規則的一部分；但窗口本身不在 queue 內。

## 6. Event Blocking

### 6.1 會阻塞回合的事件

就玩家 UI 現況而言，以下會阻塞該事件玩家的棋盤擲骰：

- `bank`
- `school`
- `hospital`
- `card`
- `exam_happiness`
- `followup`
- `boardFinancialAction`
- `pendingForcedBoardPayment`

### 6.2 不完全阻塞整體回合的事件

目前程式中，以下情況會造成「事件仍在，但 `currentTurnUid` 已切換」：

- 所有 queue-based events

因此它們：

- 會阻塞事件玩家自己的 UI
- 但不一定阻塞下一位玩家的資料層擲骰條件

### 6.3 會阻塞 Financial Check 的事件

- `boardFinancialAction` 本身就是 financial check 入口
- `pendingForcedBoardPayment` 會阻塞目前 financial flow，直到：
  - 借款
  - 賣資產
  - 強制負債

### 6.4 會阻塞 Reveal 的事件

- `currentCardReveal.isRevealed=false` 的 card event
- 未 reveal 前，無法進入 card action 主流程

### 6.5 會阻塞下一個 Event 的狀態

- `currentEvent` 尚未關閉時，queue 不會自動往後推
- `boardFinancialAction` 尚未完成時，不會自動開下一個 board step
- `canOpenNextBoardStep=false` 時，bank/school/hospital/card 不會自動彈出

## 7. Event Priority

### 7.1 Priority

目前程式沒有獨立的數值型 `priority` 欄位。

### 7.2 Queue order

目前真正存在的優先順序來自 queue 建立順序：

- route events 先加入：
  - bank
  - school
- landed event 後加入：
  - card / hospital

### 7.3 Nested Event

目前存在 nested / chained event：

- `school` -> `exam_happiness`
- `card` -> `followup`
- `card` -> `boardFinancialAction`
- `card` -> `moveCurrentPlayerToSquare()` -> 可能導向新的 square effect
- `familyMilestoneJoinPrompt` -> `pendingFamilyMilestoneJoinAction`

### 7.4 Follow-up Event

目前明確存在：

- `exam_happiness`
- `followup`

兩者都會直接覆寫 `currentEvent/currentCard`，不是先排進 `pendingEvents`

### 7.5 Immediate Event

以下更接近 immediate apply，而不是獨立 queue event：

- `applyBoardMarketPrices()`
- `applyBoardExpenseToAllPlayers()`
- 直接幸福卡效果

### 7.6 Stack

目前沒有獨立 stack structure。

較接近 stack 行為的是：

- local flow 疊在 current event 上：
  - card drawer
  - board financial check
  - forced payment modal

但資料結構上並沒有 stack。

## 8. Event Completion

### 8.1 `bank`

真正完成條件：

- `PaydayModal` confirm / follow-up 完成
- 玩家 skip 或完成 quick transaction

真正 close 條件：

- 呼叫 `advanceBoardEventQueue('bank')`

### 8.2 `school`

真正完成條件：

- 玩家關閉 school modal，並完成考試或不考
- 若觸發 post-exam happiness，該 card 也要再處理

真正 close 條件：

- 理論上應 `advanceBoardEventQueue('school')`
- 但目前正常 exam 後多半先被 `drawPostExamHappinessCard()` 覆寫

### 8.3 `hospital`

真正完成條件：

- 醫療骰已確認
- 醫藥費 financial check 完成

真正 close 條件：

- 呼叫 `advanceBoardEventQueue('hospital')`

### 8.4 `card`

真正完成條件依 action kind 而不同：

- `financial` -> financial check 完成
- `happiness` -> 直接套用完成
- `market` -> 市場套用或略過完成
- `choice` -> 玩家選擇完成
- `asset_sale` -> 出售流程完成
- `unsupported` -> 玩家按關閉

真正 close 條件：

- `dismissBoardCard()` 或 `markBoardCardHandled()` 間接觸發 queue 推進

### 8.5 `exam_happiness` / `followup`

真正完成條件：

- reveal 完成
- 後續卡片 action 完成

真正 close 條件：

- `dismissBoardCard()` / `markBoardCardHandled()`

### 8.6 `familyMilestoneJoinPrompt`

真正完成條件：

- 各 target 都已回覆，或 source player 推進原卡而導致 prompt 被清掉

真正 close 條件：

- `shiftBoardQueue()` 把 `familyMilestoneJoinPrompt` 清空

### 8.7 `boardFinancialAction`

真正完成條件：

- `handleApplyBoardFinancialTx()` 成功
- 或 local cancel 返回 card

真正 close 條件：

- `finalizeBoardFinancialFlow()` 清掉：
  - `boardFinancialAction`
  - `pendingHandledBoardCard`
  - `pendingBoardStepAdvance`

### 8.8 `pendingForcedBoardPayment`

真正完成條件：

- 借款周轉成功
- 強制負債成功
- 賣資產後再回來完成原交易

真正 close 條件：

- `setPendingForcedBoardPayment(null)`

## 9. Multiplayer

### 9.1 哪些 Event State 會寫 Firestore

共享寫入：

- `boardState.currentEvent`
- `boardState.pendingEvents`
- `boardState.currentCard`
- `boardState.currentCardReveal`
- `boardState.familyMilestoneJoinPrompt`
- `boardState.deckState`
- `boardState.cardLog`
- `playerStates[uid].pendingFamilyMilestoneJoinAction`
- `playerStates[uid].bankServiceWindowActive`
- `playerStates[uid].bankServiceGrantedAtEventId`

### 9.2 哪些只是 UI State

本地 state：

- `boardFinancialAction`
- `pendingForcedBoardPayment`
- `pendingBoardStepAdvance`
- `pendingHandledBoardCard`
- `isBoardCardDrawerOpen`
- `isBoardCardRevealed`
- `showPaydayModal`
- `showPromotionModal`
- `showHospitalRollModal`
- `showForcedBoardPaymentModal`
- `familyJoinRollValue`
- `familyJoinResult`

### 9.3 Race Conditions

目前可直接確認的風險：

- `currentTurnUid` 已切下一位，但上一事件仍在處理
- `advanceBoardEventQueue()` 不驗證呼叫者 ownership
- 市場價格會同時存在 room / player state / card overlay
- `currentCardReveal` 與 `isBoardCardRevealed` 是兩份 state
- `familyMilestoneJoinPrompt` 可能被 source player 提前結束原卡而清空
- 大多 room 更新是 `updateDoc`，不是 transaction

### 9.4 與 GDD 的衝突

- `TURN_SYSTEM.md` 已正式要求事件完成前不可切下一位，但目前程式仍會並行。
- `BANK_SYSTEM.md` 已正式要求某些金融規則，但常駐金融操作與當前 shared event 仍可交錯發生。

## 10. Current Implementation

目前 Event System 的整體運作可以總結為：

1. event queue 只承載少數 board event：`bank`、`school`、`hospital`、`card`
2. `exam_happiness` 與 `followup` 直接覆寫 current event，不進 queue
3. 家庭共同參與是共享 prompt，但不是 `currentEvent.type`
4. 財務檢核與強制付款是本地流程，不是共享 event type
5. queue-based event 與 turn system 是並行的，不是串行的
6. 多數 ownership 與 blocking 由 UI guard 控制，而不是資料層強制
7. Event System 同時包含共享 Firestore state 與大量本地 modal state

## 11. Problem

目前 Event System 的主要問題如下：

- Event 定義分散，沒有單一權威模型
- 並非所有玩法事件都對應到 `currentEvent.type`
- turn 與 event 並行，造成事件未完就切人
- queue-based event 與 local flow 疊在一起，邊界不清
- ownership 多數只靠 UI，資料層驗證不足
- `exam_happiness` / `followup` 會直接覆寫 current event，容易與 queue 邏輯衝突
- `familyMilestoneJoinPrompt` 的完成條件與原卡 completion 不是同一個 atomic flow
- GDD 已開始定義未來正式規格，但與現況存在多個明確衝突

## 12. Option A

說明：

完全維持目前 Event System 的文件表達方式，直接照現況列所有 event / local flow / shared state，不做抽象整理。

優點：

- 最忠實於程式
- 不會提前把本地流程包裝成正式事件架構

缺點：

- 文件會顯得碎裂
- 不利於後續產品決策

適合什麼情境。

只想做純盤點、不準備進一步整理時。

## 13. Option B（推薦）

說明：

不改玩法，只做文件抽象，把目前 Event System 分成三層來描述：

- Shared Board Events
- Shared Event-like States
- Local Event Flows

再逐項標示：

- ownership
- blocking
- queue participation
- completion rule

優點：

- 不會誤改現況
- 能把現在的混合架構講清楚
- 最適合做 RFC

缺點：

- 文件較長
- 需要接受目前事件系統不是單一 machine

適合什麼情境。

準備讓產品負責人逐項確認 Event System 時。

## 14. Recommendation

較建議採 `Option B`。

原因如下：

- 目前程式中的 Event 並不是只有一套 `currentEvent` 機制
- 若不先把 shared event / shared prompt / local flow 拆開，後續任何 GDD 都會混淆
- 這種抽象只是在文件上整理現況，不是設計新玩法

另外需要特別標示但不在 RFC 階段裁定的衝突：

- 與 `TURN_SYSTEM.md` 的衝突：
  - 現況是回合與事件並行
  - GDD 要求事件完成後才切下一位
- 與 `BANK_SYSTEM.md` 的衝突：
  - 現況銀行事件與窗口高度耦合
  - GDD 已正式拆分兩層
- 與維修廠正式規格的衝突：
  - 現況沒有 `repair` event type

## 15. Need Confirmation

1. `unsupported` 卡片允許直接關閉，是否代表效果可略過，目前程式無法確認。
2. 市場行情卡在 reveal 前後的正式生效切點，目前程式存在自動套用，無法確認是否刻意。
3. `school` event 在正常考試後的真正 close 點，因 `exam_happiness` 會覆寫 current event，需確認。
4. `familyMilestoneJoinPrompt` 是否應等待所有人回覆才可關閉，目前程式不保證。
5. `pendingForcedBoardPayment` 是否應被視為正式 Event 類型，還是僅屬 local flow，程式只能證實它是 local state。
6. `boardFinancialAction` 是否應被視為正式 Event 類型，還是共用結算子流程，程式只能證實它是 local state。
7. 維修廠未形成 queue event，是否只是未完成實作，或原設計本來就不是 event，無法確認。
8. `Request Approval` 是否仍屬 Event System 正式一環，目前主流程找不到接線。
9. `room.status = finished` 時，是否所有 event 入口都完整封鎖，需逐條確認 UI disabled 傳遞鏈。

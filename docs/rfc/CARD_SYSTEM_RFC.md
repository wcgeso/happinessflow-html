# Card System RFC

> 文件定位：卡片系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/TURN_SYSTEM.md` 與目前 `線上版0618` 程式。
>
> 本文件只整理目前程式真正存在的卡片系統、同步方式、已知衝突與待確認項目，不直接修改規則，也不建立正式 GDD。

## 1. Card Categories

### Current Implementation

目前程式中的卡片先以牌堆分類，再以效果分類。

牌堆分類：

- `happiness`
  - 對應 `HAPPINESS_CARDS`
- `opportunity`
  - 對應 `OPPORTUNITY_CARDS`
- `news`
  - 對應 `NEWS_CARDS`

靜態資料層可確認的細分類如下：

- 幸福卡分類
  - `幸福回憶`
  - `家庭重要歷程`
  - `追求家庭幸福`
  - `良好人際關係`
  - `幸福的社會`
- 機運卡類型
  - `ability_profession`
  - `ability_stock`
  - `ability_realestate`
  - `purchase_1room`
  - `purchase_any_house`
  - `purchase_store`
  - `purchase_startup`
  - `enterprise_acquisition`
  - `medical`
  - `aircraft_damage`
  - `property_repair`
  - `theft`
  - `inflation`
  - `penalty`
  - `reward`
- 新聞卡類型
  - `stock_price`
  - `cash_dividend`
  - `stock_dividend`
  - `real_estate`
  - `small_business`
  - `large_enterprise`

但真正進入棋盤流程後，卡片又會被 `resolveBoardCardAction()` 轉成動作分類：

- `financial`
- `happiness`
- `market`
- `asset_sale`
- `choice`
- `unsupported`

### Problem

- 目前有兩套分類系統同時存在：
  - 靜態資料分類
  - 執行時 action 分類
- `家庭重要歷程` 在資料上是多張幸福卡，但執行時會被改寫成「依玩家目前階段對應的那一張」。
- 部分卡片資料本身保留 TODO，例如：
  - `H016-H020`
  - `H043-H046`
  代表靜態卡片內容仍有未定稿痕跡。

## 2. Draw Rules

### Current Implementation

目前抽牌由 `drawBoardCard()` 統一處理。

已確認規則：

- 棋盤停在 `happiness` / `opportunity` / `news` 格時才會抽對應牌堆。
- 每個牌堆都有：
  - `active deck`
  - `used deck`
- 抽牌時會：
  - 從 `active deck` 取第一張
  - 把該卡放到 `used deck`
- 只有當 `active deck` 抽完時，才會把 `used deck` 洗回並重組 `active deck`。

目前這代表：

- 抽過的卡不會立刻回牌堆
- 全部抽完才重洗

抽牌入口目前有三種：

1. 一般棋盤落地抽牌
2. `drawPostExamHappinessCard()`
   - 學校考試後抽幸福卡
3. `drawBoardFollowupCard()`
   - 卡片後續效果再抽幸福卡或新聞卡

### Problem

- follow-up 卡與 exam happiness 卡不是從 queue 抽出，而是直接覆寫 `currentEvent/currentCard`。
- 抽牌時的洗牌使用 `sort(() => Math.random() - 0.5)`，是前端隨機，不是可驗證或伺服器權威。

## 3. Reveal Rules

### Current Implementation

共享揭露狀態在：

- `boardState.currentCardReveal.isRevealed`

本地揭露顯示 state 在：

- `GameView.isBoardCardRevealed`

目前流程：

1. `currentCard` 建立時，`currentCardReveal.isRevealed = false`
2. 玩家端抽屜打開
3. 事件玩家點擊卡片正面觸發 `handleBoardCardReveal()`
4. `revealBoardCard(eventId, cardId)` 寫入 Firestore
5. 家庭歷程卡在 reveal 當下可額外開 `familyMilestoneJoinPrompt`

資料層的 reveal guard 只有：

- `currentEvent.id` 必須匹配
- `currentCard.cardId` 必須匹配

### Problem

- Reveal 有兩份 state：
  - 共享 Firestore state
  - 本地 UI state
- `market` 類型卡片在 `GameView` 中，只要 `activeBoardCardAction.kind === 'market'` 就會自動套用行情，不以 `isBoardCardRevealed` 為前置條件。
- 這與 `TURN_SYSTEM.md` 中「卡片必須先 Reveal，才可進入效果處理」有衝突。

## 4. Resolve Rules

### Current Implementation

目前卡片效果不是直接寫在卡片資料上執行，而是透過 `resolveBoardCardAction(cardId, gameState)` 轉成 action definition。

常見解法如下：

- `financial`
  - 進入財務檢核
- `happiness`
  - 直接加幸福
- `market`
  - 套用市場價格
- `asset_sale`
  - 選資產出售
- `choice`
  - 玩家選接受或略過
- `unsupported`
  - 顯示卡片，但沒有對應完整結算流程

`financial` 類 action 另外還可能帶 `afterApply`：

- `drawCard`
- `affectsAllPlayersExpense`
- `moveToSquare`

### Problem

- 目前有一部分卡片會落到 `unsupported`，代表資料存在，但沒有完整落地結算。
- `afterApply.moveToSquare` 會直接移動玩家位置，但不會建立新的正式 card event type。
- `afterApply.affectsAllPlayersExpense` 會更新所有玩家支出，但不是獨立多人事件。

## 5. Follow-up Cards

### Current Implementation

目前 follow-up card 有兩種主要來源：

1. `drawPostExamHappinessCard(success)`
   - 學校考試結束後抽幸福卡
   - event type = `exam_happiness`
2. `drawBoardFollowupCard(deck, summary, detail?)`
   - 某些卡片效果再抽幸福卡或新聞卡
   - event type = `followup`

這兩種都會：

- 直接覆寫 `boardState.currentCard`
- 直接覆寫 `boardState.currentCardReveal`
- 直接覆寫 `boardState.currentEvent`
- 保留原本 `pendingEvents`

### Problem

- follow-up card 不是 queue item，而是直接插入目前事件流。
- 這種做法代表 queue 與 follow-up 是兩條不同機制。
- `exam_happiness` 與 `followup` 是 event type，但不是由 `pendingEvents` 正常推進出來。

## 6. Family Milestone Cards

### Current Implementation

家庭歷程卡目前不是單純照抽到的 `cardId` 執行。

已確認流程：

1. 抽到 `家庭重要歷程` 類幸福卡
2. `resolveBoardCardAction()` 先讀玩家 `getFamilyMilestoneStatus(gameState)`
3. 若尚有未完成階段，實際執行的會改成當前階段對應卡：
   - `H011` 至 `H015`
4. 若全部完成，會回傳只允許關閉的 `choice`

共同參與流程：

1. 原抽卡玩家 reveal 後可開 `openFamilyMilestoneJoinPrompt()`
2. 系統找出其他符合資格玩家
3. 其他玩家同時收到同一份 prompt
4. 每位玩家可回覆：
   - `passed`
   - `failed`
   - `declined`
5. `passed` 玩家會得到 `pendingFamilyMilestoneJoinAction`
6. 後續由該玩家自己的 `GameView` 再執行對應 action

### Problem

- 家庭歷程卡資料上有很多張同名卡，但執行時只吃目前階段。
- `shiftBoardQueue()` 會直接清掉 `familyMilestoneJoinPrompt`。
- 這與 `TURN_SYSTEM.md` 的正式規格衝突：
  - 正式規格要求必須等所有符合資格玩家回覆完成後，事件才可結束
  - 目前程式只要 queue 被推進，prompt 就會被清掉

## 7. Happiness Cards

### Current Implementation

幸福卡目前有幾種實際處理方式：

- 直接幸福加分
- 進入財務檢核後換幸福
- 增加每月支出換幸福
- 家庭歷程多階段卡
- 故事分享類卡

直接幸福加分時，`GameView` 會：

- 新增一個 `custom happiness item`
- 更新 `happinessTotal`
- 把 `cardId` 寫入 `completedHappinessEvents`

### Problem

- 有些幸福卡會轉成 `financial`
- 有些會轉成 `happiness`
- 有些又必須先依玩家條件改寫成家庭歷程階段卡
- 因此「幸福卡」在程式裡不是單一解法

## 8. Market Cards

### Current Implementation

目前市場卡主要是新聞卡中的：

- `stock_price`
- `cash_dividend`
- `stock_dividend`
- 部分房市 / 企業新訊也會走 card flow

其中真正會更新市場價格的是 action kind = `market`。

`GameView` 目前會先：

1. 本地 `applyLocalBoardMarketPrices()`
2. 再呼叫 `applyBoardMarketPrices()` 寫入 room

room 端正式市場欄位是：

- `room.marketPrices`
- `room.previousMarketPrices`
- `room.marketUpdates`

### Problem

- 市場卡的共享價格與本地價格是先本地後同步，不是單一步驟。
- 同一張市場卡防重依賴本地 `appliedBoardMarketKeys`。
- 若同步中斷，可能出現：
  - 本地玩家已看到新價格
  - room 還沒成功寫入
- 這類卡的實際效果套用點不依賴 reveal 完成。

## 9. Card Queue

### Current Implementation

目前真正進入 `pendingEvents/currentEvent` 的卡片流程只有：

- 棋盤停留卡格時建立 `type='card'`

queue item 結構為：

- `event`
- `card`

queue 推進工具：

- `activateBoardQueueEntry()`
- `shiftBoardQueue()`
- `advanceBoardEventQueue()`
- `dismissBoardCard()`

非 queue 卡片：

- `exam_happiness`
- `followup`

### Problem

- 卡片系統其實同時有：
  - queue-based card
  - direct replacement card
- `dismissBoardCard()` 與 `advanceBoardEventQueue()` 都能推進事件。
- queue 沒有獨立的 card-only ownership 驗證層，主要靠 UI。

## 10. Card Ownership

### Current Implementation

一般卡片目前只讓事件玩家操作。

可確認依據：

- `activeBoardCard` 只在 `currentEvent.playerUid === user.uid` 時成立
- `BankingAppModal` 若 `currentEvent.playerUid !== user.uid` 會直接不顯示 active card 內容

但家庭歷程卡另外擴張為多人所有權：

- 原抽卡玩家擁有 reveal 與主卡處理權
- target players 擁有 join response 權
- `passed` 玩家之後擁有自己的 `pendingFamilyMilestoneJoinAction` 執行權

### Problem

- 卡片所有權分三層：
  - 主事件玩家
  - 共同參與玩家
  - 全體受影響玩家
- 資料層函式如 `advanceBoardEventQueue()`、`dismissBoardCard()` 沒有完整再驗一次所有權。

## 11. Multiplayer

### Current Implementation

卡片相關共享 state：

- `boardState.currentCard`
- `boardState.currentCardReveal`
- `boardState.currentEvent`
- `boardState.pendingEvents`
- `boardState.deckState`
- `boardState.cardLog`
- `boardState.familyMilestoneJoinPrompt`
- `room.marketPrices`

卡片相關本地 state：

- `isBoardCardDrawerOpen`
- `isBoardCardRevealed`
- `handledBoardCardKeys`
- `pendingHandledBoardCard`
- `boardFinancialAction`
- `pendingForcedBoardPayment`
- `appliedBoardMarketKeys`

多人同步特性：

- 抽到哪張卡是寫 Firestore 共享
- 是否揭露也有共享 state
- 但是否顯示抽屜、是否已本地處理過、是否已本地套用市場價格，仍是每個玩家自己的 UI / flow state

### Problem

- 同一張卡的「共享完成狀態」與「本地完成狀態」是分開的。
- 家庭歷程 join prompt 與後續 individual action 又是第三條流程。
- 目前程式中，下一位玩家的回合切換早於所有卡片事件完成，這與 `TURN_SYSTEM.md` 正式規格衝突。

## 12. Current Implementation

目前卡片系統可以整理成以下真實架構：

1. 棋盤只在落地卡格時建立 `card` queue event。
2. 抽牌結果存在 `currentCard`。
3. 揭露狀態同時有共享與本地兩份。
4. 卡片行為先經 `resolveBoardCardAction()` 映射成執行 action。
5. `financial` 類卡進入本地財務檢核。
6. 某些卡可再抽 follow-up 幸福卡或新聞卡。
7. 家庭歷程卡是特例：
   - 會依玩家進度改寫實際卡內容
   - 可能開多人共同參與 prompt
8. 市場卡是另一個特例：
   - 會先本地更新行情，再同步到 room
9. 牌堆採「抽完才重洗」。

目前這不是單一 state machine，而是：

- queue
- current card
- reveal
- local financial flow
- follow-up override
- family join prompt

共同組成的混合系統。

## 13. Problem

### 13.1 與 `TURN_SYSTEM.md` 的衝突

- `TURN_SYSTEM.md` 要求事件未完成不可切下一位。
  - 現況：`buildBoardMovementResolution()` 在建立 card / bank / school / hospital queue 後，就已經切 `currentTurnUid`。
- `TURN_SYSTEM.md` 要求停留卡片格時，卡片必須先 Reveal 才能進效果。
  - 現況：市場卡會在 `activeBoardCardAction.kind === 'market'` 時自動套用，不以 reveal 完成為前置。
- `TURN_SYSTEM.md` 已將家庭歷程共同參與定義為必須等待所有符合資格玩家回覆。
  - 現況：`shiftBoardQueue()` 會清除 `familyMilestoneJoinPrompt`，不保證等待所有回覆。
- `TURN_SYSTEM.md` 已把維修廠列為正式事件。
  - 現況：卡片與事件系統中都沒有 `repair` card event type。

### 13.2 系統設計問題

- reveal 有共享 state 與本地 state 雙軌。
- queue 卡與 follow-up 卡是兩種不同推進方式。
- `dismissBoardCard()` 與 `advanceBoardEventQueue()` 都可以推進流程。
- 部分卡片是 `unsupported`，代表規則存在但實作未完整。
- card ownership 在資料層驗證不足，主要靠 UI 限制。

### 13.3 同步與維護風險

- 本地行情先更新，再同步 room，會有短暫不一致。
- 防重邏輯散落在：
  - `handledBoardCardKeys`
  - `appliedBoardMarketKeys`
  - `pendingHandledBoardCard`
  - `currentCardReveal`
- 家庭歷程是共享 prompt + 個人 pending action 的雙階段流程，容易出現半完成狀態。

## 14. Option A

### 完全維持目前

說明：

把卡片系統視為目前這套混合機制，不先抽象，不先統一 queue / reveal / follow-up。

優點：

- 最忠實反映目前程式。
- 不需要先決定哪些流程算正式事件。

缺點：

- 文件可讀性較差。
- 很難直接變成正式 GDD。
- 會保留目前 queue、reveal、follow-up、多人參與彼此交疊的複雜度。

## 15. Option B（推薦）

### 只做文件抽象，不改玩法

說明：

不改任何規則，僅在文件上把目前卡片系統拆成幾個可討論層：

1. 牌堆層
2. 抽牌 / reveal 層
3. action resolve 層
4. queue / follow-up 層
5. 多人共同參與層

優點：

- 與目前程式最接近，同時比現況更容易檢查衝突。
- 可直接支援後續正式 GDD 拆成：
  - Card System
  - Family System
  - Market System
- 不會把尚未定稿的產品規則誤寫成既定玩法。

缺點：

- 仍保留現有實作的不一致性，只是先文件化。
- 後續建立正式 GDD 時，還是需要產品決策裁定衝突。

## 16. Recommendation

較建議採 `Option B`。

原因不是要優化玩法，而是目前卡片系統確實已經分裂成：

- deck system
- reveal system
- action system
- follow-up override
- family milestone multiplayer flow

若不先做文件抽象，後續很難把現況與正式規格的差距講清楚。

## 17. Need Confirmation

- `unsupported` 卡片是否都應視為「尚未完成實作」，還是其中一部分本來就只需顯示文本，程式無法確認。
- `market` 類卡是否產品上允許在 reveal 前就先套用市場效果，程式目前如此，但與正式 Turn System 衝突。
- `dismissBoardCard()` 與 `advanceBoardEventQueue()` 的最終權威入口應是哪一個，程式目前兩者並存。
- `exam_happiness` 與 `followup` 未經 queue，是否產品上應視為正式卡片事件，程式可確認存在，但無法確認是否為最終設計。
- `H016-H020`、`H043-H046` 等家庭歷程幸福卡在靜態資料中仍留有 TODO 痕跡，這些卡是否仍為正式卡池內容，需產品確認。

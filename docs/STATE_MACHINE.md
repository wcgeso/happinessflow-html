# State Machine

> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md` 與目前 `線上版0618` 原始碼，2026-07-01。
>
> 本文件描述程式實際存在的轉換，不代表理想規則。程式沒有集中式 state-machine library；以下狀態由 Firestore 欄位、React flags、事件佇列與函式 guard 共同形成。

## 判讀標記

- **共享 State**：寫入 `rooms/{roomId}`，由 Firestore 即時同步。
- **玩家 State**：寫入 `room.playerStates.{uid}` / `GameContext.gameState`。
- **UI State**：只存在目前瀏覽器記憶體。
- **合法 / 禁止**：只描述程式已有的 guard。若只有 UI 禁用而資料層未阻止，會明確標示。

# 1. Turn State Machine

## 實際流程

```text
Room Waiting
  -> Game Started
  -> Waiting Turn
  -> Rolling Dice
  -> Moving
  -> Landing Resolution
       ├─ 建立 Board Event Queue
       ├─ 寫入落點與 skipTurns
       └─ currentTurnUid 立即切到下一玩家
  -> Next Player Waiting Turn

Board Event Queue 會與 Next Player Waiting Turn 並行處理，
不是等事件全部完成後才切換 currentTurnUid。
```

## 狀態表

| State 名稱 | 進入條件 | 離開條件 | 可觸發事件 | 下一個可能 State |
|---|---|---|---|---|
| `Room Waiting` | `room.status === 'waiting'` | 房主執行 `startRoomGame()` | 執行師/房主開始遊戲 | `Game Started` |
| `Game Started` | room 寫入 `status='playing'` 並建立 `boardState` | 初始 `currentTurnUid` 可用 | 系統初始化 turn order、positions、deck | `Waiting Turn` |
| `Waiting Turn` | `boardState.currentTurnUid === user.uid`、無 active movement | 玩家成功呼叫 `rollBoardDice()` | 當前玩家擲骰 | `Rolling Dice` |
| `Rolling Dice` | 玩家通過 UI 與 `rollBoardDice` guard；寫入 `lastRoll`、`movement.isActive=true` | Firestore movement 寫入完成，前端播放動畫 | 當前玩家；骰數為有車 2 顆、否則 1 顆 | `Moving` |
| `Moving` | `movement.isActive === true` | 擲骰端延遲結算，或 snapshot listener 補完過期 movement | 系統 `buildBoardMovementResolution()` | `Landing Resolution` |
| `Landing Resolution` | movement 結算函式取得最新 room | 寫回位置、事件佇列、`movement=null`、下一位 `currentTurnUid` | 系統解析經過銀行/學校與落地卡片/醫院/維修廠 | `Waiting Turn` + 可能的 `Board Event Pending` |
| `Skipped Turn`（隱含） | `getNextTurnUid` 掃描到下一玩家 `skipTurns > 0` | 立即把該玩家 skipTurns 減 1 並繼續掃描 | 系統 | 下一個未被跳過玩家的 `Waiting Turn` |
| `Game Finished` | 房主執行 `finishRoomGame()`，`status='finished'` | 程式沒有恢復 playing 的公開流程 | 房主結算；各 UI disabled | 結算畫面 |

## 合法 Action

- `Waiting Turn`：只有 `currentTurnUid` 對應玩家可由 `rollBoardDice()` 通過回合 guard。
- `Moving`：擲骰端可在動畫時間到後結算；若逾時，房主或移動玩家的 room listener 可補完。
- `Landing Resolution`：系統可建立 `bank`、`school`、`card`、`hospital` 事件並推入 queue。
- `Game Finished`：房主可關房；玩家可進入結算畫面。

## 禁止 Action

- 非當前玩家擲骰：`rollBoardDice()` 會丟出「還沒輪到你」。
- movement active 時再次擲骰：RoomContext 會拒絕。
- 玩家端在遊戲 finished、骰子同步中、movement active、自己的 Modal/財務/事件未完成時擲骰：`getBoardRollBlockReason()` 阻止。
- UI 在非自己回合時不啟用棋盤骰子。

## 現有轉換缺口

- `currentTurnUid` 在落地結算時已切換，不等待 `currentEvent` / `pendingEvents` 清空。
- RoomContext 的 `rollBoardDice()` 不檢查 `currentEvent` 或 `pendingEvents`。下一玩家若自己的 UI 沒有被前一玩家事件鎖住，程式層允許擲骰。
- `advanceBoardEventQueue()` 不驗證呼叫者是否為事件玩家或目前回合玩家；前端 UI 是主要限制。

## Need Confirmation

1. 產品規格是否要求「所有落地事件完成後才換下一位」；現有程式不是這樣運作。
2. 所有玩家都被 skip 時，`getNextTurnUid()` 回到原 `currentTurnUid`；是否符合預期無法由程式確認。
3. 經過維修廠產生的保養費目前只形成文字提示，沒有建立財務事件；是否需要阻塞回合無法確認。

# 2. Board Event State Machine

## 實際流程

```text
No Current Event
  -> Events Queued during Landing Resolution
  -> Current Event Activated
       ├─ bank
       ├─ school
       ├─ hospital
       └─ card
  -> Event-specific UI / Card Hidden
  -> Reveal（只有 card）
  -> Decision / Financial Check / Direct Apply
  -> Dismiss or Advance Queue
  -> Next Queued Event
  -> No Current Event
```

## 狀態表

| State 名稱 | 進入條件 | 離開條件 | 可觸發事件 | 下一個可能 State |
|---|---|---|---|---|
| `Idle` | `currentEvent=null`、`currentCard=null`；queue 可為空 | landing resolution 建立 queue，或 follow-up 直接建立 event | 系統抽卡/解析路徑 | `Queued` 或 `Card Hidden` |
| `Queued` | `pendingEvents` 有項目 | `activateBoardQueueEntry` / `shiftBoardQueue` 取出第一項 | 系統 | `Bank Event`、`School Event`、`Hospital Event`、`Card Hidden` |
| `Card Hidden` | `currentCard` 存在，`currentCardReveal.isRevealed=false` | 抽卡玩家呼叫 reveal | 抽卡玩家 `revealBoardCard` | `Card Revealed` |
| `Card Revealed` | eventId、cardId 匹配且 reveal 為 true | 玩家選擇直接效果、財務動作、出售、dismiss，或系統套用 market | 抽卡玩家；market action 由 effect 自動套用 | `Decision`、`Financial Check`、`Applying Result`、`Closing` |
| `Decision` | `resolveBoardCardAction()` 回傳 choice / asset_sale | 選擇 dismiss 或 action | 抽卡玩家 | `Financial Check` 或 `Closing` |
| `Financial Check` | 設定 `boardFinancialAction` | 驗證並 `onApply`；或未完成時關閉返回卡片 | 抽卡玩家 | `Applying Result` 或 `Card Revealed` |
| `Applying Result` | 直接幸福、行情、交易、全員支出或 follow-up effect 執行中 | 本地 GameState / room 更新完成 | 系統、抽卡玩家 | `Closing`、`Follow-up Card` |
| `Closing` | `markBoardCardHandled` / `dismissBoardCard` / `advanceBoardEventQueue` | `shiftBoardQueue` 完成 | 事件玩家 UI | 下一個 queue event 或 `Idle` |
| `Follow-up Card` | 卡片效果呼叫 `drawBoardFollowupCard()` 或考試後抽幸福卡 | 新卡寫入 current event | 系統 | `Card Hidden` |

## 合法 Action

- Reveal 只在 room 的 current event/card 與傳入 ID 相同時寫入。
- 卡片可依解析結果執行 `financial`、`happiness`、`market`、`choice`、`asset_sale`、`unsupported`。
- 財務檢核完成後才可 finalize 並關閉相關卡片/推進事件。
- 強制卡不能使用一般「關閉」按鈕；現金不足會進入周轉/負債 UI。

## 禁止 Action

- 非 current card ID 的 reveal/dismiss 會直接 return。
- 事件 Modal、財務檢核或其他 overlay 開啟時，不會自動打開下一個 board step。
- choice 顯示現金不足時，該購買選項 disabled。
- asset sale 未選資產不能確認。

## Need Confirmation

1. `unsupported` 卡片允許直接關閉，是否代表規則效果可不執行，程式無法確認。
2. market card 在卡片 action 被偵測時會自動更新行情，不要求先 reveal；這是否是刻意流程無法確認。
3. `advanceBoardEventQueue` 與 `dismissBoardCard` 都能推進 queue，資料層沒有事件所有者限制。

# 3. Hospital State Machine

## 實際流程

```text
Land on Hospital
  -> skipTurns[player] = max(current, 1)
  -> Hospital Event Queued
  -> Hospital Roll Modal
  -> Roll Second Die (可重骰，直到確認)
  -> Medical Fee = die × 1,000
  -> Financial Check
  -> Apply Payment / Handle Shortfall
  -> Advance Hospital Event
  -> Later: next scheduled turn is skipped once
  -> Following scheduled turn becomes normal
```

## 狀態表

| State 名稱 | 進入條件 | 離開條件 | 可觸發事件 | 下一個可能 State |
|---|---|---|---|---|
| `Entering Hospital` | 棋子落在 hospital square | landing resolution 設定 skipTurns 並 queue hospital event | 系統 | `Awaiting Hospital Event` |
| `Awaiting Hospital Event` | `currentEvent.type='hospital'` 且 playerUid 是自己 | GameView 可開下一流程時自動開 Modal | 系統 UI effect | `Rolling Medical Die` |
| `Rolling Medical Die` | hospital Modal 開啟、`hospitalRollValue=null` | 玩家按「擲第二次骰子」 | 事件玩家 | `Medical Die Rolled` |
| `Medical Die Rolled` | `hospitalRollValue` 為 1–6 | 玩家按「進入財務流程」 | 事件玩家可再次擲骰或確認 | 自己或 `Medical Financial Check` |
| `Medical Financial Check` | 建立 cash decrease = roll × 1,000；pending advance=`hospital` | 財務檢核完成 | 事件玩家 | `Applying Medical Fee` |
| `Applying Medical Fee` | 套用交易；若不足則進強制付款流程 | 付款/周轉完成並 finalize | 玩家、系統 | `Hospital Event Closed` |
| `Hospital Event Closed` | `advanceBoardEventQueue('hospital')` | queue 推進 | 系統 | 下一 board event 或 Idle |
| `Hospital Stay / Skipped Turn` | 輪序掃描到該玩家且 `skipTurns > 0` | 系統減 1 並跳過 | 系統 | 其他玩家 Waiting Turn |
| `Normal Leave` | 未來再次掃描到該玩家且 skipTurns=0 | 玩家取得正常回合 | 系統 | Waiting Turn |

## 合法 Action

- 事件玩家可擲第二次骰子、確認醫藥費、完成財務檢核。
- 現金不足時可賣資產、借信用貸款、記入強制負債，或暫時關閉周轉 Modal。

## 禁止 Action

- 未擲出 `hospitalRollValue` 前，確認按鈕 disabled。
- hospital event 未處理時，事件玩家的棋盤擲骰被 UI guard 阻止。
- `advanceBoardEventQueue('hospital')` 在 current event type 不符時不推進。

## Need Confirmation

1. **程式沒有「提前出院」Action 或 State。** 無法建立其轉換規則。
2. 第二次骰子在確認前可以反覆按下重骰；是否只允許一次無法由程式確認。
3. 醫院「停留」只以 `skipTurns=1` 表達，沒有獨立 hospital occupancy/status。
4. 醫療保險是否應直接影響醫院費用；目前 hospital payment 沒有自動套用保險。

# 4. School / Promotion State Machine

## 實際流程

```text
Pass School Square
  -> School Event Queued
  -> Promotion Modal
       ├─ Close (event remains current)
       └─ Register Exam
            -> Pay 1,000 immediately
            -> Dice Modal
            -> Roll
            -> Success / Failure applied
            -> Close Dice Modal
            -> Draw Happiness Card (replaces current school event)

Normal promotion opened outside board follows the same final step:
Promotion Modal -> Pay -> Roll -> Apply -> Draw Happiness Card
```

## 狀態表

| State 名稱 | 進入條件 | 離開條件 | 可觸發事件 | 下一個可能 State |
|---|---|---|---|---|
| `School Event Pending` | movement path 第一次經過 school，queue 建立 `type='school'` | school event 成為 current | 系統 | `Promotion Offered` |
| `Promotion Offered` | current school event 屬於自己；UI 可開下一步 | 玩家關閉或確認報名 | 事件玩家 | 保持 current event 或 `Registration Check` |
| `Registration Check` | 玩家確認 normal exam | 現金 >= 1,000 則扣款；不足則留在 Modal | 玩家、系統 | `Exam Rolling` 或 `Promotion Offered` |
| `Exam Rolling` | `promotionType='normal'`、Dice Modal 開啟 | 擲骰完成 | 玩家 | `Exam Success` 或 `Exam Failure` |
| `Exam Success` | roll >= `currentRankLevel + 1` | `applyExamResult` 更新職級/薪資，玩家關閉 Dice Modal | 系統 | `Post-exam Happiness Card` |
| `Exam Failure` | roll < target | 記錄失敗，玩家關閉 Dice Modal | 系統 | `Post-exam Happiness Card` |
| `Post-exam Happiness Card` | normal exam 關閉 Dice Modal且沒有 active board card | `drawPostExamHappinessCard()` 直接以 `exam_happiness` 覆寫 current event/card | 系統 | Board Card Hidden |
| `School Event Closed`（備用分支） | normal exam 且 current event 是 school，但 `shouldDrawExamHappiness=false` | `advanceBoardEventQueue('school')` | 系統 | 下一 board event 或 Idle |

## 合法 Action

- 有 1,000 現金時可報名一般考試。
- 一般考試門檻是目前 rank level + 1。
- 成功時 rank +1、職稱與薪資更新；失敗時保留原狀並寫交易歷史。
- 終身學習使用同一 Dice Modal，但有不同門檻與結果套用流程。

## 禁止 Action

- 現金不足 1,000 時不能進入擲骰。
- room finished 時 Promotion Modal 的確認 disabled。
- Dice Modal 正在處理時不能擲棋盤骰。

## Need Confirmation

1. School Modal 可直接關閉，但沒有同步推進 school event；之後同一瀏覽器因 handled key 已加入也不會自動重開。如何恢復/略過需確認。
2. 正常 school exam 關閉時會先符合 `shouldDrawExamHappiness`，直接覆寫 current school event；`advanceBoardEventQueue('school')` 分支在目前條件下看似不可達，是否刻意需確認。
3. 程式保留 `handlePromotionConfirm()` 回傳 `'pending'` 的分支，但目前函式只會回傳 true/false；pending 流程沒有實際入口。
4. 「停在學校」與「經過學校」都在 path 掃描時建立同一 school event，沒有不同規則。

# 5. Banking State Machine

## 銀行服務窗口

```text
Pass Bank Square
  -> bankServiceWindowActive = true
  -> Bank Event Queued
  -> Payday Confirm
  -> Apply Monthly Cashflow + Auto Repay
  -> Follow-up Choice
       ├─ Insurance -> Transaction -> Financial Check -> Follow-up
       ├─ Deposit   -> Transaction -> Financial Check -> Follow-up
       └─ Skip      -> Advance Bank Event
  -> Window remains active until player's next board roll
```

## 狀態表

| State 名稱 | 進入條件 | 離開條件 | 可觸發事件 | 下一個可能 State |
|---|---|---|---|---|
| `Bank Locked` | 棋盤模式且 `bankServiceWindowActive` 不為 true | 玩家經過 bank | 無法進 wealth tab 的保險/定存/汽車 | `Bank Window Open` |
| `Bank Window Open` | movement resolution 偵測經過 bank | 玩家下一次呼叫 roll 時清除；另有切換下一玩家時清除該 next player's舊窗口 | 系統、玩家 | `Payday Confirm`；亦可開 banking/broker UI |
| `Payday Confirm` | active bank prompt 自動開 Payday Modal，step=`confirm` | 玩家關閉/確認，`executePayday` 套用月現金流 | 玩家 | `Bank Follow-up` |
| `Bank Follow-up` | payday 完成且可使用 bank products | 選保險、定存或 skip | 玩家 | `Insurance Form`、`Deposit Form`、`Bank Event Closed` |
| `Insurance Form` | quick transaction assetType=`保險` | 交易提交或取消 | 玩家 | `Financial Check` 或 `Bank Follow-up` |
| `Deposit Form` | quick transaction assetType=`定存` | 交易提交或取消 | 玩家 | `Financial Check` 或 `Bank Follow-up` |
| `Stock Trading` | Banking App broker tab | 買/賣提交或取消 | 玩家 | `Financial Check` / 回到 UI |
| `Loan Management` | Banking App banking tab | 借款或還款提交 | 玩家 | `Financial Check` / 回到 UI |
| `Financial Check` | 交易表單提交後建立 board financial action | 套用或取消 | 玩家 | `Bank Follow-up` 或原交易 UI |
| `Bank Event Closed` | follow-up skip 或流程關閉後 `advanceBoardEventQueue('bank')` | queue 推進 | 玩家/系統 | 下一 board event 或 Idle |

## 各產品現有門檻

| 產品 | 銀行窗口要求 | 現有轉換 |
|---|---|---|
| 股票 | 不要求；broker tab 在窗口關閉時仍可使用 | buy/sell form -> financial check -> apply transaction |
| 保險 | 棋盤模式要求窗口；非棋盤模式不要求 | choose insurance -> form -> financial check -> asset/expense update |
| 定存 | 棋盤模式要求窗口；非棋盤模式不要求 | enter amount -> financial check -> cash/asset update；提款走 sell/withdraw flow |
| 貸款 | 不要求；banking tab 在窗口關閉時仍可使用 | borrow/repay -> financial check -> cash/liability update |
| 汽車 | wealth tab 與保險/定存共用窗口鎖定 | cash/loan purchase form -> financial check -> asset/liability update |

## 合法 Action

- bank event 玩家可確認月結餘，再選保險/定存或略過。
- 正月現金流會先加入現金，再自動償還「強制負債」及「信用貸款」。
- 股票與貸款頁籤即使 bank window 關閉仍可使用。
- quick insurance/deposit transaction 完成或取消後會回到 bank follow-up。

## 禁止 Action

- 棋盤模式無 bank window 時，wealth tab 被鎖定並切回 broker。
- room finished 時 Payday / Transaction UI disabled。
- bank event 未完成時，事件玩家的棋盤擲骰被 UI guard 阻止。

## Need Confirmation

1. 規格是否真的只限制保險、定存、汽車，卻允許任何時間交易股票與貸款；目前程式如此。
2. bank event 關閉後 `bankServiceWindowActive` 仍為 true，直到該玩家下一次擲骰；此期間即使不是其回合仍可開 wealth tab。
3. 負月現金流可讓 cash 變負，是否應進入強制負債流程無法由現有 payday 程式確認。
4. 程式同時存在 legacy `loans` 與明細 `liabilities`，還款狀態機的唯一權威需確認。

# 6. Request Approval State Machine

## 定義存在的流程

```text
Request Object Created by submitRequest()
  -> Pending
       ├─ approveRequest() -> Approved
       └─ rejectRequest()  -> Rejected
  -> clearRequest() -> Deleted/Cleared
```

## 狀態表

| State 名稱 | 進入條件 | 離開條件 | 可觸發事件 | 下一個可能 State |
|---|---|---|---|---|
| `Not Created` | `pendingRequests` 無該 ID | 呼叫 `submitRequest()` | 理論上玩家/呼叫端 | `Pending` |
| `Pending` | request 寫入，status=`pending` | 執行師/GM 核准或拒絕 | `approveRequest`、`rejectRequest` | `Approved` 或 `Rejected` |
| `Approved` | status 更新為 approved | 呼叫 `clearRequest()` | 未找到自動 apply handler | `Cleared` 或持續 Approved |
| `Rejected` | status 更新為 rejected | 呼叫 `clearRequest()` | 未找到自動 reject handler | `Cleared` 或持續 Rejected |
| `Applied` | **目前沒有可確認的程式 State 或 transition** | 無 | 無 | 無法確認 |
| `Cleared` | request 欄位被 `deleteField()` | 結束 | `clearRequest` | `Not Created` |

## 合法 Action

- `approveRequest` / `rejectRequest` 只允許 role 為 coach 或 gm 的呼叫者通過函式 guard。
- `clearRequest` 在有 room 時可刪除指定 request。
- Coach UI 只顯示 timestamp 最早的 pending request。

## 禁止 Action

- player role 不能透過 RoomContext 函式 approve/reject。
- 已非 pending 的 request 不會出現在 Coach 的 pending Modal。

## 目前實際接線狀態

- 全專案沒有任何 `submitRequest(...)` 呼叫端。
- 全專案沒有監聽 approved/rejected 後套用結果的 handler。
- 全專案沒有 `clearRequest(...)` 呼叫端。
- 因此 Request API 與 Coach 審核 UI 存在，但目前主遊戲流程直接在玩家端套用 payday、保險、幸福、升等與終身學習，不會進入這個 state machine。

## Need Confirmation

1. Request Approval 是否仍是正式玩法，或已被直接套用流程取代。
2. Approved 後由誰執行 `Applied`、如何防止重複套用，程式沒有答案。
3. Rejected/Approved 何時 clear、由玩家還是執行師清除，程式沒有呼叫端可確認。

# 7. Family Milestone State Machine

## 實際流程

```text
Source Player Reveals Family Milestone Card
  -> Create Join Prompt for all eligible other players
  -> Waiting Responses (simultaneous)
       ├─ Decline -> Declined
       └─ Roll
            ├─ roll >= requiredRoll -> Passed
            │    -> pendingFamilyMilestoneJoinAction
            │    -> Apply own card action
            │    -> Clear pending action
            └─ roll < requiredRoll -> Failed
  -> Source player resolves/closes original card
  -> Queue advance clears familyMilestoneJoinPrompt
```

## 狀態表

| State 名稱 | 進入條件 | 離開條件 | 可觸發事件 | 下一個可能 State |
|---|---|---|---|---|
| `No Prompt` | 無 join prompt | source player reveal 的卡屬家庭重要歷程且 `otherPlayersCanJoin` | source player / system | `Prompt Open` |
| `Prompt Open` | current event/card/source player 都匹配；存在 eligible targets | 寫入 Firestore prompt | source player `openFamilyMilestoneJoinPrompt` | `Waiting Responses` |
| `Waiting Responses` | target 玩家尚無 `responses[uid]` | 每位 target 獨立 decline 或 roll | 所有 eligible 玩家同時操作 | `Declined`、`Rolling`；其他人仍 Waiting |
| `Rolling` | target 按擲骰 | 本地產生 1–6 並比較 requiredRoll | target 玩家 | `Passed` 或 `Failed` |
| `Passed` | roll >= requiredRoll | response 寫入，並在該玩家 state 建立 pending action | 系統 | `Pending Apply` |
| `Failed` | roll < requiredRoll | response 寫入完成 | 系統 | `Completed Response` |
| `Declined` | target 主動拒絕 | response 寫入完成 | target 玩家 | `Completed Response` |
| `Pending Apply` | `pendingFamilyMilestoneJoinAction` 存在 | GameView 依卡片 action 套用 direct happiness / financial / choice；或略過 unsupported | target 玩家、系統 | `Applying` |
| `Applying` | 財務檢核或 direct action 執行 | 清除 pending action 並加入 handled key | target 玩家、系統 | `Completed Response` |
| `Completed Response` | response 已存在，且 passed action 已處理或無 action | 原卡事件 queue 被推進 | source player結案 | `No Prompt` |

## 合法 Action

- 只有 prompt target、尚未回覆的玩家可以提交一次 response。
- targets 同時看到 prompt，不按順序等待。
- pass 時建立各玩家自己的 pending action，再依自己當前 `GameState` 解析卡片。
- decline 不擲骰；failed 不建立 pending action。

## 禁止 Action

- source player不能加入自己的 prompt。
- coach、沒有 playerState、家庭歷程已無有效 current stage 的玩家不列入 target。
- 已存在 response 的玩家不能再次提交。
- 非 current source card 無法開 prompt。

## Need Confirmation

1. 原卡玩家可以在其他玩家尚未全部回覆前關閉卡片；queue 推進會清除整個 prompt。是否應等待全部 response 無法確認。
2. prompt 沒有 timeout、截止狀態或 all-responses-complete 欄位。
3. passed 玩家若離線，pending action 會保留；何時視為整張家庭事件完成沒有集中規則。
4. source player本人的家庭歷程完成與其他玩家共同參與不是同一個 atomic 更新，部分成功可能發生。

# 8. Animation State Machine

## 棋盤骰子動畫

```text
Idle
  -> Click Allowed
  -> Requesting Roll
  -> Rolling / Flying (2.4s)
  -> Result Face Reveal (0.85s delay)
  -> Animation Complete Callback
  -> Idle when isRollingBoardDice=false
```

| State 名稱 | 進入條件 | 離開條件 | 可觸發事件 | 下一個可能 State |
|---|---|---|---|---|
| `Dice Idle` | `isAnimating=false`、外部 `isRollingBoardDice=false` | active 玩家點骰子 | 當前玩家 | `Requesting Roll` |
| `Requesting Roll` | `isAnimating=true`，等待 `onRollBoardDice()` | 成功取得 total 或發生錯誤 | 系統/API | `Rolling Visual` 或 `Dice Idle` |
| `Rolling Visual` | Framer Motion start，duration 2.4 秒 | timer 到期 | 系統 | `Result Revealed` |
| `Result Revealed` | diceResult 已設定；0.85 秒後 landing face 顯示 | 2.4 秒 callback | 系統 | `Animation Complete` |
| `Animation Complete` | 呼叫 `onRollAnimationComplete(result)` | 外部把 `isRollingBoardDice=false` | 系統 | `Dice Idle` |

## 考試骰子動畫

```text
Idle -> Rolling Interval -> Final Roll -> Success/Failure -> Modal Close -> Idle/Next Event
```

| State 名稱 | 進入條件 | 離開條件 | 可觸發事件 | 下一個可能 State |
|---|---|---|---|---|
| `Exam Idle` | `examResult='idle'`、`isRolling=false` | 玩家 roll | 玩家 | `Exam Rolling` |
| `Exam Rolling` | interval 持續改 diceValue | timeout 產生 final value | 系統 | `Exam Success` / `Exam Failure` |
| `Exam Success` | final >= target | `onComplete` 套用結果、玩家關閉 Modal | 系統、玩家 | school advance / happiness card / normal UI |
| `Exam Failure` | final < target | 同上 | 系統、玩家 | 同上 |

## 幸福勝利動畫

```text
Pre-intro -> Buildup (立即) -> Peak (4s) -> Main (7.5s)
  -> Closable (9.5s) -> Outro (click) -> Complete (1s)
```

| State 名稱 | 進入條件 | 離開條件 | 可觸發事件 | 下一個可能 State |
|---|---|---|---|---|
| `Pre-intro` | 元件 mount | effect 立即 set buildup | 系統 | `Buildup` |
| `Buildup` | mount effect | 4 秒 timer | 系統 | `Peak` |
| `Peak` | 4 秒 | 7.5 秒 timer（從 mount 計） | 系統 | `Main` |
| `Main Locked` | 7.5 秒、`canClose=false` | 9.5 秒 timer | 系統 | `Main Closable` |
| `Main Closable` | `canClose=true` | 玩家 click | 玩家 | `Outro` |
| `Outro` | click 後 phase=outro | 1 秒 timeout | 系統 | unmount / complete |

## 共享棋子移動動畫

`BoardMovementState` 把 path、startedAt、step/intro/landing duration 寫入 Firestore。大地圖以本地 `animationNow` 計算顯示位置；擲骰端按相同 duration 延遲後結算，逾時則由 listener 補完。

## 合法 Action

- 棋盤骰子只有 active、非 disabled、非 rolling 時可點。
- 幸福動畫 9.5 秒前 pointer events disabled，不能關閉。
- 元件 unmount 時會清理主要 timer/ref。

## 禁止 Action

- rolling 中再次點棋盤骰子。
- exam rolling 或 exam result 非 idle 時再次開始。
- 勝利動畫 canClose=false 時關閉。

## Need Confirmation

1. 棋盤資料結算等待時間與 UI 2.4 秒動畫不是同一常數；RoomContext 使用至少 3.5 秒再加 movement duration，兩者是否刻意不同無法確認。
2. 醫院第二次骰子沒有使用共用骰子動畫 state machine，是直接 `Math.random()` 更新數值。
3. 家庭共同參與骰子也沒有動畫 state machine，是直接產生結果。
4. 動畫結束不等於事件結束；`currentTurnUid`、movement 與 UI animation flags 可能在不同時間切換。

# Cross-Machine Constraints

| 條件 | 目前影響 |
|---|---|
| `room.status === 'finished'` | 主要操作 UI disabled，玩家顯示 ScoreView |
| `movement.isActive` | RoomContext 拒絕任何新 board roll |
| `isProcessingEvent` | 事件玩家的 GameView 阻止新 board roll |
| `canOpenNextBoardStep=false` | 暫停自動開啟下一個 bank/school/hospital/card UI |
| `currentEvent.type` | 決定推進時 expected type 是否匹配 |
| `bankServiceWindowActive` | 只控制 wealth products；不鎖股票與貸款 |
| `pendingFamilyMilestoneJoinAction` | 在 UI 空閒時自動啟動該玩家的卡片效果 |
| `boardFinancialAction` | 暫停其他 board flow，直到 apply 或返回 |

# Global Need Confirmation

1. 回合狀態與事件狀態目前是並行機器；是否要在 GDD 視為正式規則，需要產品確認。
2. 多數禁止條件只在 React UI / Context 函式，Firestore Rules 沒有欄位級 state transition 驗證。
3. Request Approval machine 未接到任何主遊戲 Action，不能視為目前可操作流程。
4. Hospital early discharge、request applied、事件 timeout、家庭回覆截止等狀態目前不存在，文件未替它們設計轉換。

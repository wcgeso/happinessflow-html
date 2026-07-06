# MVP Playability Audit

## Purpose

本文件只回答一件事：

> 現有《幸福流 HappinessFlow》Legacy 專案，距離「一位執行師 + 至少兩位玩家，可連續完成至少 3 個完整 Round」還差哪些會阻塞 MVP 可玩的問題。

本輪判定規則採以下權威順序：

1. `docs/rewrite/GAME_OVERVIEW.md`
2. `docs/rewrite/GAME_SYSTEM_MAP.md`
3. `src/data/cards/*.json`
4. 正式 GDD / Product Specification
5. Legacy Code（只代表 Current Implementation，不代表 Expected Behavior）

若正式規格與 Legacy Runtime 不一致，標記為 `RULE MISMATCH`。  
若正式規格彼此互相衝突，標記為 `SPEC CONFLICT`。

---

## 1. MVP Critical Path

| 階段 | Expected Behavior | Required State | Completion Condition | Blocking Condition |
|---|---|---|---|---|
| Lobby | 執行師可建立房間，玩家可看到房間並準備加入 | `room.status = waiting` | 房間建立成功且可被加入 | 房間建立失敗、加入碼無效 |
| Room | 房間正確記錄 1 位執行師與至少 2 位玩家 | `room.members` | 成員列表完整且角色正確 | 玩家重複身分、成員未寫入 |
| Player Join | 玩家成功加入同一房間 | `room.members`, `room.playerStates` | 玩家出現在房內列表 | 房間已開始卻無法重連、玩家資料缺失 |
| Game Start | 執行師開始遊戲，房間切到 `playing` | `room.status`, `boardState` | 建立初始 `boardState` 與回合順序 | `boardState` 未建立、`currentTurnUid` 為空 |
| Player Initialization | 每位玩家完成職業、企業、夢想初始化 | `playerStates.{uid}` / local game state | 所有玩家 `isSetup = true` | 某玩家卡在初始化或未同步 |
| Turn Start | 指派當前回合玩家；若有 `skipTurns` 則輪空後切下一位 | `boardState.currentTurnUid`, `boardState.skipTurns` | 當前回合玩家明確可操作 | `currentTurnUid` 錯亂、Skip Turn 無法消化 |
| Dice | 只有當前回合玩家可以擲骰；有汽車可選 1 或 2 顆 | `boardState.currentTurnUid`, `boardState.movement = null` | 產生一次有效擲骰結果 | 非回合玩家可擲骰、重複擲骰、移動中又擲骰 |
| Movement | 依骰點逐步移動，建立完整 path | `boardState.movement` | 角色停在正確格位 | 移動中斷、path 不完整、位置未更新 |
| Pass Events | 經過銀行 / 學校 / 維修廠時，依順序建立正式事件 | `boardState.pendingEvents` | 所有經過事件入佇列 | 經過事件未建立、順序錯誤 |
| Landing Event | 停留銀行 / 學校 / 醫院 / 維修廠 / 卡片格時建立正式事件 | `boardState.currentEvent` 或 `pendingEvents` | 停留事件成為目前事件或入佇列 | 停留事件未建立、直接略過 |
| Card Draw | 停卡片格時抽到正確牌堆卡片 | `boardState.currentCard`, `deckState` | 卡片被抽出並記錄 | 抽牌失敗、牌堆狀態錯誤 |
| Reveal | 卡片先揭示，再進入效果 | `boardState.currentCardReveal.revealed = true` | 卡片已揭示 | 效果在 Reveal 前生效 |
| Player Decision | 事件玩家或共享事件目標玩家完成必要決策 | `currentEvent`, prompt state | 所有必要回覆收齊 | Modal 沒出現、玩家無法回覆、共享事件少人/多人卡死 |
| Resolve | 將卡片 / 特殊格效果正式套用 | 財務 / 幸福 / 資產 / 負債可變狀態 | 效果成功寫入正式狀態 | 重複 Resolve、重複扣款、重複發幸福 |
| Financial Check | 所有正式交易先經財務處理再成立 | 玩家財務狀態、必要交易資料 | 交易完成或明確放棄 | 財務檢核卡死、無法返回、無法完成 |
| Follow-up Event | 考試後幸福卡、新聞後續、創業貸款後續等正式事件接續 | `pendingEvents` / follow-up state | 後續事件完成 | Follow-up 沒建立、提早跳下一位 |
| Event Queue Complete | 本回合所有必要事件、共享事件、後續事件與財務處理完成 | `currentEvent = null`, `pendingEvents = []`, prompt 已結束 | 佇列清空 | Queue 無法清空、共享事件永遠等待、提早結束 |
| End Turn | 回合正式結束 | 上述事件皆完成 | 可切換到下一位玩家 | 還有未完成事件卻切回合 |
| Next Player | 指派下一位玩家並保留正確 `skipTurns` 狀態 | `boardState.currentTurnUid`, `skipTurns` | 下一位玩家可開始新回合 | 回合順序錯亂、同玩家重複回合 |

---

## 2. Expected Flow vs Actual Runtime Flow

| 階段 | Expected Flow | Actual Runtime Flow | 判定 |
|---|---|---|---|
| Game Start | 建立房間後開始遊戲，初始化 `boardState` 與玩家順序 | `startRoomGame()` 會建立 `boardState`，`turnOrder` 排除 coach，`currentTurnUid` 指向第一位玩家 | 基本符合 |
| Player Initialization | 玩家完成職業 / 企業 / 夢想後才進遊戲 | `SelectionView` 三步初始化，`App.tsx` 以 `selectionStep` / `isSetup` 切換畫面 | 基本符合 |
| Turn Start | 只有當前回合玩家可操作；停回合需正確消耗 | `rollBoardDice()` 檢查 `currentTurnUid`；`getNextTurnUid()` 會扣減 `skipTurns` | 基本符合，但需注意醫院/維修廠何時寫入 `skipTurns` |
| Dice | 有汽車者可選 1 或 2 顆；無汽車者只能 1 顆 | `rollBoardDice(requestedDiceCount)` 支援 1/2 顆；實作仍以呼叫端是否傳入決定 | 部分符合 |
| Movement | 逐步移動並依順序建立所有經過事件 | `buildBoardMovementResolution()` 會掃 path，但只正式入佇列銀行 / 學校，維修廠僅寫文字訊息 | `RULE MISMATCH` |
| Landing Event | 停留銀行 / 學校 / 醫院 / 維修廠 / 卡片格都要建立正式事件 | Legacy 只正式建立卡片與醫院；停留銀行 / 學校只寫提示，停留維修廠只寫提示與 `skipTurns` | `RULE MISMATCH` |
| Card Draw | 抽卡後進入 Reveal | `buildBoardMovementResolution()` 抽卡後建立 `currentEvent.type = card` | 基本符合 |
| Reveal | Reveal 前不得生效 | `handleBoardCardReveal()` 會呼叫 `revealBoardCard()`；但市場新聞在 `useEffect` 中只要解析出 `market` action 就會同步股價，不等 Reveal | `RULE MISMATCH` |
| Shared Event | 家庭歷程 / 收購 / 股利 / 投資 / 創業貸款都需等待全體目標回覆 | 已修正（2026-07-07）：`sharedCardPrompt` 與 `familyMilestoneJoinPrompt` 皆由共用函式 `hasIncompleteSharedPrompts()` 判斷 all-responded，`dismissBoardCard()` 已無法在未全員回覆前清掉 prompt | 基本符合（原 `P1` 已修正） |
| Resolve | 效果只應套用一次 | 多數效果由 `handleTransactionSubmit()` 或 room-level 寫入完成，但缺乏事件層 idempotency token | `P1` 風險 |
| Financial Check | 正式交易要先走財務處理 | `boardFinancialAction` + `BoardFinancialCheckModal` 負責大多數棋盤交易 | 基本符合，但共享 / 後續卡仍有分流 |
| Follow-up Event | Follow-up 仍屬正式事件鏈 | 學校考後幸福卡有正式 `exam_happiness` 事件；創業貸款 follow-up 只寫成玩家本地 `pendingStartupUpgradeAction`，不是正式共享事件 | `RULE MISMATCH` |
| Event Queue Complete | 只有 Queue 清空且共享事件完成後才能切換回合 | 已修正（2026-07-07）：`advanceBoardEventQueue()` 與 `dismissBoardCard()` 皆呼叫 `buildBoardEventAdvanceState()`，且該函式已內建 `hasIncompleteSharedPrompts()` guard，`dismissBoardCard()` 不再能繞過 | 基本符合（原 `P1` 已修正） |
| Next Player | 所有事件完成後才切換下一位 | 若 movement 沒有 queued event 會直接切下一位；若 queued event 結束，`buildBoardEventAdvanceState()` 決定下一位 | 基本符合，但前提是事件建立與結案都正確 |

---

## 3. MVP Blocking Bug Audit

### 3.1 P0 — Game Blocking

以下問題會直接威脅「至少 3 個完整 Round 可玩」，即使目前不一定每局必定重現，也屬高風險阻塞點。

| Bug ID | 問題 | Expected Behavior | Actual Behavior | Root Cause | 最小修改範圍 |
|---|---|---|---|---|---|
| P0-01（已修正 2026-07-07） | 共享事件結案入口不單一 | Event Queue 只能在共享回覆完成後結案 | ~~`advanceBoardEventQueue()` 會檢查 prompt 是否回齊，但 `dismissBoardCard()` 直接推進佇列，繞過相同檢查~~ 已修正：guard 邏輯收斂為 `src/utils/boardCardActions.ts` 的 `hasIncompleteSharedPrompts()` 單一事實來源，`dismissBoardCard()`、`advanceBoardEventQueue()` 與 UI 層 `hasIncompleteSharedBoardPrompt` 皆改為呼叫此共用函式；`dismissBoardCard()` 並補上 `runTransaction`，與 `advanceBoardEventQueue()` 對齊 | 事件結案規則分裂在兩個入口（已收斂為單一函式） | `src/context/RoomContext.tsx`, `src/views/game/GameView.tsx`, `src/utils/boardCardActions.ts` |
| P0-02（部分修正 2026-07-07） | 本地玩家狀態與房間正式狀態雙軌，可能導致共享事件後玩家看到不同正式結果 | 共享效果套用後，所有玩家都應看到同一份正式財務 / 資產 / 幸福狀態 | 確認唯一目前存在的跨玩家寫入是 `applyBoardExpenseToAllPlayers()`（新聞卡「全體支出調整」）。~~`GameContext` 以 local `gameState` 為主，僅少量欄位從 `room.playerStates` 回填；room-level 共享寫入不會完整回灌到本地~~ 已修正此實例：比照既有 `marketPrices` 廣播模式，新增 `lastSharedExpenseSyncedAt` 時間戳，`applyBoardExpenseToAllPlayers()` 寫入時標記，`GameContext.tsx` 新增監聽把 `expenses` 回灌本地，且本地防抖同步會在房間端時間戳較新時保留房間資料，避免覆寫 | `playerStates` 與 local `gameState` 雙重 mutable state，沒有穩定單一權威同步——**本次只針對已知的支出共享效果加上點對點回灌，未解決架構層問題**：未來若新增其他跨玩家寫入 `room.playerStates` 的函式（例如共享資產效果），仍須比照同一模式（syncedAt 標記 + 監聽回灌 + 防抖保護）才不會重蹈覆轍。徹底解法仍需 `docs/architecture/STATE_MODEL.md`（目前未建立）定義單一權威同步規則 | `src/context/GameContext.tsx`, `src/context/RoomContext.tsx`, `src/types.ts` |
| P0-03（已修正 2026-07-07） | 正式停留事件建立不完整 | 停留銀行 / 學校 / 維修廠 / 醫院 / 卡片格都要成為正式事件 | ~~Legacy 只把卡片與醫院入佇列；停留銀行 / 學校 / 維修廠沒有正式 queue entry~~ 稽核當下發現停留銀行 / 學校 / 醫院 / 卡片格皆已建立正式 queuedEvent；唯獨「經過維修廠」（非停留）仍只顯示文字提示，未建立正式事件、未走財務檢核。已修正：`buildBoardMovementResolution()` 的 `routeEvents` 加入 `repair` 類型，經過維修廠比照銀行/學校建立正式 queuedEvent，見 RM-03 | `buildBoardMovementResolution()` 實作已完成全部 special square（含經過維修廠） | `src/context/RoomContext.tsx` |

### 3.2 P1 — State / Multiplayer Corruption

| Bug ID | 問題 | 影響 | Root Cause | 最小修改範圍 |
|---|---|---|---|---|
| P1-01（已修正 2026-07-07） | 家庭歷程共同參與可能提前結束 | ~~其他玩家尚未回覆，主事件就被結案，導致「多人事件提前結束」~~ 已修正：見 P0-01，`dismissBoardCard()` 現在會先檢查 `hasIncompleteSharedPrompts()`，未全員回覆前直接中止、不寫入 Firestore | `markBoardCardHandled()` → `dismissBoardCard()` 直接推進；`buildBoardEventAdvanceState()` 會清掉 `familyMilestoneJoinPrompt`（已加上前置 guard） | `src/views/game/GameView.tsx`, `src/context/RoomContext.tsx` |
| P1-02（已修正 2026-07-07） | 家庭歷程沒有正式的 all-responded completion path | ~~事件不是依「所有人回覆完成」結案，而是依 UI 關閉或財務流尾端結案~~ 已修正：`GameView.tsx` 的 `hasIncompleteSharedBoardPrompt` 已改為呼叫 `hasIncompleteSharedPrompts()`，與 `familyMilestoneJoinPrompt` 全員回覆判斷邏輯一致；全員回覆後由既有 retry watcher（`GameView.tsx` 財務流程 useEffect）觸發正式結案 | `sharedCardPrompt` 有 watcher，`familyMilestoneJoinPrompt` 沒有對等 watcher（現由共用 guard 函式統一判斷） | `src/views/game/GameView.tsx` |
| P1-03（部分修正 2026-07-07，見 P0-02） | 共享效果可能只更新 room，不更新受影響玩家本地畫面 | 玩家 A / B 對同一正式狀態看到不同內容 | `applyBoardExpenseToAllPlayers()` 已補上回灌；其他未來新增的 room-level 共享寫入函式仍需個別補上同一模式，`GameContext` 沒有通用 hydrate 機制 | `src/context/GameContext.tsx`, `src/context/RoomContext.tsx` |
| P1-04 | 規則所有權分裂在 resolver 與畫面流程 | 同一張卡的正式規則同時存在 current-player resolver 與 shared prompt 特判，容易重複處理或漏處理 | `resolveBoardCardAction()` 回傳 current-player action；`GameView` 再對特定卡型做 shared flow 分流 | `src/utils/boardCardActions.ts`, `src/views/game/GameView.tsx` |
| P1-05 | 金融 / 幸福效果缺乏事件級 idempotency | 若 modal 重開、effect watcher 重跑、snapshot 延遲，可能重複扣款或重複加幸福 | 沒有以 eventId / cardKey 為正式結算 token | `src/views/game/GameView.tsx`, `src/hooks/useGameLogic.ts` |

---

## 4. Important Rule Mismatch

以下不是一定立刻卡死，但與正式規格明顯不一致，會直接破壞 MVP 遊戲規則正確性。

| ID | 正式規格 | Legacy Runtime | 來源衝突 |
|---|---|---|---|
| RM-01（已修正，發現時已是修正狀態） | 停留銀行應建立正式 Bank Event，流程為 Payday → 自動處理 → 可選銀行服務 → 結束 | ~~停留銀行只寫提示字串，未建立正式 `bank` queue event~~ 稽核當下（2026-07-07）發現 `buildBoardMovementResolution()` 停留銀行（`landedSquare.type === 'bank'`）已建立正式 `bank` queuedEvent，本項描述為過時記錄 | `GAME_OVERVIEW` / `GAME_SYSTEM_MAP` vs `buildBoardMovementResolution()`（已對齊） |
| RM-02（已修正，發現時已是修正狀態） | 停留學校應建立正式 School Event | ~~停留學校只寫提示字串，未建立正式 `school` queue event~~ 稽核當下（2026-07-07）發現停留學校已建立正式 `school` queuedEvent，本項描述為過時記錄 | 同上 |
| RM-03（已修正 2026-07-07） | 經過 / 停留維修廠都應建立正式事件 | ~~維修廠只寫提示字串；停留時直接先寫 `skipTurns`，未建立 repair event~~ 停留維修廠原本就已建立正式 `repair` queuedEvent 並走財務檢核；但「經過維修廠」原本只顯示文字提示「請自行登錄」，未建立正式事件、未走財務檢核，違反 `docs/gdd/REPAIR_SYSTEM.md`「經過與停留都必須先擲一次正式事件骰點」「保養費不得以畫面顯示代替正式結果」。已修正：`buildBoardMovementResolution()` 的 `routeEvents` 加入 `repair` 類型，經過維修廠時比照銀行/學校建立正式 queuedEvent 並帶入 `repairFee`/`repairRoll`/`repairHasCar`，交由既有的 `repair` 事件財務檢核流程處理；不寫入 `skipTurns`（維持「只有停留才停回合」規則） | 同上（經過部分已修正，停留部分本就正確） |
| RM-04 | 卡片效果必須 `Draw → Reveal → Resolve → Complete` | 市場新聞在 `activeBoardCardAction.kind === market` 時即同步 `room.marketPrices`，未明確等待 Reveal | `GAME_OVERVIEW` / `GAME_SYSTEM_MAP` vs `GameView.tsx` |
| RM-05（已修正 2026-07-07） | 家庭歷程事件必須等待所有符合資格玩家回覆完成後才可結束 | ~~`familyMilestoneJoinPrompt` 可被 `dismissBoardCard()` 提前清除~~ 已修正：見 P0-01/P1-01，`dismissBoardCard()` 現在會先呼叫 `hasIncompleteSharedPrompts()` 檢查，未全員回覆不得清除 | `GAME_OVERVIEW` vs `RoomContext.tsx` / `GameView.tsx`（已對齊） |
| RM-06 | 創業貸款 Follow-up 應是正式事件鏈的一部分 | Legacy 以玩家本地 `pendingStartupUpgradeAction` 表示，未進入正式 shared event / queue | `GAME_OVERVIEW` / `GAME_SYSTEM_MAP` vs `GameView.tsx` |
| RM-07 | 醫院事件應為「第二次擲骰 → 支付醫療費 → 停回合 1 次」 | landing hospital 時已先寫入 `skipTurns`，早於醫療費正式結算 | `GAME_OVERVIEW` vs `buildBoardMovementResolution()` |

---

## 5. Spec Conflicts

以下屬正式資料來源彼此衝突，本輪不自行裁定。

| ID | 衝突內容 | 衝突來源 |
|---|---|---|
| SC-01 | 遊戲結束排名是否只看幸福值，或幸福值平手時再以淨資產決勝 | `docs/rewrite/GAME_OVERVIEW.md` 寫「正式結束後依最終幸福值排序」；`docs/rewrite/GAME_SYSTEM_MAP.md` 的 Settlement 描述有淨資產 tie-break 意圖 |
| SC-02 | 醫院事件的保險效果是否屬正式規則 | `GAME_SYSTEM_MAP` 寫醫療保險可免付醫療費；`GAME_OVERVIEW` 只明講第二次擲骰、支付醫療費與停回合，未定義醫院保險抵免細節 |
| SC-03 | MVP 範圍是否僅要求基本卡片，或沿用完整正式卡池規則 | `GAME_SYSTEM_MAP` 末段帶有「MVP slice」語氣；`GAME_OVERVIEW` 與 card JSON 直接以完整正式玩法描述 |

---

## 6. 卡片系統抽樣檢查（依流程類型）

本輪不逐張檢查 160 張卡，而是先看會影響 Event Queue 與多人流程的 Resolver 層級共通問題。

### 6.1 會卡住或污染 Event Queue 的卡片流程類型

1. 家庭歷程共同參與卡
   - 代表卡群：`H011-H020`, `H043-H046`
   - 正式需求：共享回覆全部完成後才可結案
   - 共通 Bug：結案入口繞過 prompt 完成條件

2. 共享收購卡
   - 代表卡群：`C009-C034`
   - 正式需求：所有符合條件玩家都可出售 / 放棄，全部回覆後事件才完成
   - Legacy 狀況：已有 `sharedCardPrompt` 思路，但規則所有權分裂在 resolver 與畫面邏輯

3. 股利 / 股息卡
   - 代表卡群：`N027-N028`
   - 正式需求：所有持股玩家受影響；無持股玩家顯示無效果
   - Legacy 狀況：`resolveBoardCardAction()` 仍以 current player 資產計算，再由 `GameView` 額外包 shared prompt

4. 共同投資 / 創業貸款卡
   - 代表卡群：`N055-N058`
   - 正式需求：所有玩家可參與；完成後可能有 follow-up
   - Legacy 狀況：N055/N056-N058 的 shared flow 依賴 `sharedCardPrompt` 與本地 follow-up state，未形成單一 formal event model

### 6.2 Financial Mutation 卡片類型

1. 直接財務變動卡
   - `resolveBoardCardAction().kind === financial`
   - 風險：若結案與交易提交分層不清，容易重複扣款

2. 可選接受 / 拒絕卡
   - `kind === choice`
   - 風險：accept / dismiss 兩條路的 completion condition 並未統一歸到 queue owner

3. 影響全體月支出的卡
   - 例如通膨卡 `C045-C048`
   - 風險：效果寫在 room.playerStates，但玩家本地財務畫面不一定同步

### 6.3 Happiness Mutation 卡片類型

1. 幸福回憶卡 `H001-H010`
   - 正式需求：故事分享後，執行端 / 主持人確認才發放幸福
   - Legacy 狀況：已有 pending request 流程，屬較接近正式規格的部分

2. 家庭歷程卡
   - 正式需求：依玩家當前階段推進下一階段，並支援多人共同參與
   - Legacy 狀況：階段推進已有資料化傾向，但共享完成規則尚未封住

---

## 7. 最先修的 5 個問題

### Fix-01：統一 Board Card / Shared Event 的結案入口

- **Root Cause**：
  - `advanceBoardEventQueue()` 有共享回覆 guard
  - `dismissBoardCard()` 沒有同樣 guard
  - `markBoardCardHandled()` 預設直接走 `dismissBoardCard()`
- **最小修改範圍**：
  - `src/context/RoomContext.tsx`
  - `src/views/game/GameView.tsx`
- **為什麼先修**：
  - 這是「提早切下一位」與「共享事件提前結束」的根因之一
- **建議測試方式**：
  - 3 人房間
  - 抽家庭歷程 / 共享收購 / 股利卡
  - 驗證事件未收齊前不能結案

### Fix-02：補齊 Family Milestone 的正式 completion path

- **Root Cause**：
  - `sharedCardPrompt` 有 all-responded watcher
  - `familyMilestoneJoinPrompt` 缺少對等 watcher
- **最小修改範圍**：
  - `src/views/game/GameView.tsx`
  - 如需要，再微調 `src/context/RoomContext.tsx`
- **為什麼先修**：
  - 直接對應「多人事件提前結束」與「多人事件永遠等待」兩種 MVP 禁止情況
- **建議測試方式**：
  - 玩家 A 抽家庭歷程
  - 玩家 B 成功加入
  - 玩家 C 放棄
  - 確認事件只在三人結果都寫入後才完成

### Fix-03：把停留銀行 / 學校 / 維修廠補成正式 queue event

- **Root Cause**：
  - `buildBoardMovementResolution()` 只完成卡片與醫院停留事件
- **最小修改範圍**：
  - `src/context/RoomContext.tsx`
  - `src/views/game/GameView.tsx`（只補對應 UI 入口時）
- **為什麼先修**：
  - 這是 MVP critical path 的正式流程缺口，不補齊就無法宣稱「停留事件正確建立」
- **建議測試方式**：
  - 連續移動到銀行、學校、維修廠
  - 驗證每個停留都建立 `currentEvent` / `pendingEvents`

### Fix-04：修正 room/player local 雙軌狀態造成的同步分裂

- **Root Cause**：
  - `GameContext` 以 local `gameState` 為主，僅少量欄位從 `room.playerStates` 回填
  - 共享事件又直接寫 `room.playerStates`
- **最小修改範圍**：
  - `src/context/GameContext.tsx`
  - `src/context/RoomContext.tsx`
- **為什麼先修**：
  - 這直接對應 MVP 禁止項「Firebase 狀態不同步導致玩家看到不同正式遊戲狀態」
- **建議測試方式**：
  - 通膨卡 / 股利卡 / 共享支出卡
  - 三個 session 同時看財務畫面是否一致

### Fix-05：把市場新聞效果延後到 Reveal 之後

- **Root Cause**：
  - `GameView.tsx` 的市場同步 effect 未受 `isBoardCardRevealed` 約束
- **最小修改範圍**：
  - `src/views/game/GameView.tsx`
- **為什麼先修**：
  - 雖不是最常見卡死點，但它會破壞卡片正式事件鏈，且已影響股價一致性與交易正確性
- **建議測試方式**：
  - 抽任一 `stock_price` 新聞卡
  - 驗證 Reveal 前股價不變，Reveal 後所有玩家同步更新

---

## 8. Architecture Guardrail Review

本段依 `modular-software-architecture` skill，只用於限制修正邊界，不擴大成架構重構。

### Behavior being changed

- 共享事件何時算完成
- 事件佇列何時可推進
- 停留事件是否正式建立
- room/player 狀態同步何時視為正式結果
- 市場新聞何時正式生效

### Owning domain

- Turn / Board Event Queue
- Shared Event
- Card Resolution
- Multiplayer Synchronization

### Owning module

- `src/context/RoomContext.tsx`：正式 shared board state、event queue、room-level side effects
- `src/views/game/GameView.tsx`：事件 UI 流程、modal lifecycle、玩家互動
- `src/context/GameContext.tsx`：玩家本地狀態與 room snapshot 之間的同步策略
- `src/utils/boardCardActions.ts`：卡片規則解譯層

### Source of truth

- **共享回合 / 事件 / prompt / queue**：`room.boardState`
- **共享玩家正式資料快照**：`room.playerStates`
- **玩家本地操作中狀態**：local `gameState`

目前最大問題不是缺少 state，而是 **shared formal state 與 local mutable state 的權威界線不穩定**。

### State owner

- `RoomContext` 應擁有：
  - `boardState`
  - shared prompts
  - queue progression
  - room-level multiplayer side effects
- `GameContext` 應擁有：
  - 單一玩家本地操作中的暫時狀態
  - 但不應覆蓋 room 已正式成立的 shared result

### Rule owner

- 事件完成條件：應由 queue / prompt owner 決定，不應由單一 UI close 行為決定
- Reveal-before-resolve：應由 card event owner 決定，不應分散在畫面 side effect
- 共享事件 all-responded：應由 shared prompt owner 決定，不應各卡分散自判

### Side-effect owner

- Firestore room-level write：`RoomContext`
- 本地財務變動：`useGameLogic` / `GameContext`
- 問題點：有些共享卡效果目前同時由本地與 room-side effect 分散處理

### Dependency impact

- 本輪應避免新增新的平行 prompt 系統
- 只修：
  - queue progression
  - shared completion
  - existing state hydration
  - reveal gate

### Duplicate rule risk

- `resolveBoardCardAction()` 與 `GameView.tsx` 對同一卡型各自加規則
- `advanceBoardEventQueue()` 與 `dismissBoardCard()` 各自定義 completion

### Duplicate state risk

- `room.playerStates` vs local `gameState`
- `room.marketPrices` vs local `gameState.marketPrices`
- `boardState.skipTurns` vs `gameState.skipTurns`

### God File risk

- `GameView.tsx` 已承接過多流程編排責任
- 但本輪不建議重拆；只做最小修補，避免再把 queue / prompt 規則塞更多進畫面層

### Data-driven opportunity

- 家庭歷程階段本身已有資料化方向
- 共享卡型可以沿用既有 `sharedCardPrompt` / `familyMilestoneJoinPrompt` 模型，不要再加第三套 prompt

### Recommended change surface

1. 先統一事件結案規則
2. 再補 family prompt completion
3. 再補停留特殊格事件建立
4. 再收斂 local / room 同步
5. 最後補 Reveal gate

### Files that should change

- `src/context/RoomContext.tsx`
- `src/views/game/GameView.tsx`
- `src/context/GameContext.tsx`
- `src/utils/boardCardActions.ts`（只在需要收斂 shared rule owner 時）

### Files that should not change

- `src/data/cards/*.json`
- 正式規格文件
- 初始化 / Lobby / Selection 流程檔案
- 純展示型 component

---

## 9. 建議測試方式

### 單元級流程測試

1. Turn / Queue
   - 建立 3 人房
   - 檢查 `currentTurnUid` 是否只在 queue 清空後切換

2. Shared Event
   - 家庭歷程
   - 共享收購
   - 股利 / 股息
   - 驗證未收齊前不可結案，收齊後只結案一次

3. Reveal Gate
   - 新聞股價卡
   - 驗證 Reveal 前後 `room.marketPrices` 差異

4. Multiplayer State Consistency
   - 通膨卡 / 共享支出卡
   - 3 個 session 同時比對現金、月支出、幸福值

### Regression 測試

1. 醫院事件
2. 學校考試 + 考後幸福卡
3. 銀行經過 + Payday + 服務窗口
4. 維修廠有車 / 無車
5. 卡片關閉、Follow-up、財務檢核返回

---

## 10. 修完後的實機測試路徑

### Playtest Route A：最短 MVP 路徑

1. 執行師建立房間
2. 兩位玩家加入
3. 執行師開始遊戲
4. 兩位玩家完成初始化
5. 玩家 1 完整跑完：
   - 擲骰
   - 移動
   - 經過事件
   - 停留事件
   - 若抽卡則 Reveal → Decide → Resolve → Financial → Follow-up
   - End Turn
6. 玩家 2 完整跑完同樣流程
7. 回到玩家 1，確認至少完成 3 個完整 Round

### Playtest Route B：共享事件壓力測試

1. 強制觸發家庭歷程卡
2. 強制觸發共享收購卡
3. 強制觸發股利 / 股息卡
4. 驗證：
   - 不提前結束
   - 不永遠等待
   - 不重複發款 / 扣款 / 加幸福

### Playtest Route C：特殊格壓力測試

1. 停留銀行
2. 停留學校
3. 停留醫院
4. 停留維修廠
5. 驗證四者都建立正式事件並能清空 queue

---

## 結論

目前 Legacy 專案距離「MVP 可玩」不是卡在卡牌總數，而是卡在 5 個核心根因：

1. 事件結案入口不單一
2. 家庭歷程共享事件沒有正式 completion path
3. 停留特殊格事件建立不完整
4. room / local player state 雙軌且同步權威不穩
5. Reveal 與 Resolve 邊界被市場新聞打破

若先只修這 5 類問題，而不擴大成重構，最有機會把 Legacy 專案推到「至少可穩定跑 3 個完整 Round」的 MVP 可玩狀態。

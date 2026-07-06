# Family System RFC

> 文件定位：家庭系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/README.md`、`docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md` 與目前 worktree 內 `src/` 程式。
>
> 本文件只整理目前程式真實存在的家庭重要歷程、Join Prompt、Pending Join、共享同步、`passed / failed / declined`、多人流程、Queue 與 Completion Rule，不自行設計新玩法。

## Current Implementation

### Family Milestone

- 家庭重要歷程的靜態階段定義在 [`src/utils/familyMilestones.ts`](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/線上模式0611/src/utils/familyMilestones.ts)。
- `FAMILY_MILESTONE_STAGES` 目前固定 5 階段，對應卡片 `H011` 到 `H015`。
- `getFamilyMilestoneStatus(gameState)` 以兩個來源判斷進度：
  - `gameState.completedHappinessEvents`
  - `gameState.happiness[].checked`
- `currentStageIndex` 由第一個未完成階段計算；若全部完成，`currentStageIndex === -1`。
- `resolveBoardCardAction(cardId, gameState)` 會把 `家庭重要歷程` 卡轉成目前階段對應的卡片效果，而不是永遠照原始 `cardId` 執行。

### Join Prompt

- 共享 Join Prompt 寫在 [`src/context/RoomContext.tsx`](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/線上模式0611/src/context/RoomContext.tsx) 的 `room.boardState.familyMilestoneJoinPrompt`。
- `openFamilyMilestoneJoinPrompt(eventId, cardId)` 只在以下條件成立時建立 prompt：
  - 房間存在且是棋盤模式
  - 來源卡是 `家庭重要歷程`
  - 該卡 `otherPlayersCanJoin === true`
  - 呼叫者是目前 `currentEvent` / `currentCard` 的擁有者
- 目標玩家名單會過濾掉：
  - coach
  - 來源玩家本人
  - 沒有 `playerState`
  - `getFamilyMilestoneStatus(playerState).currentStageIndex === -1` 的玩家
- `requiredRoll` 直接取 `sourceCard.joinDiceMin || 4`。
- `responses` 初始為空物件。

### Pending Join

- 參與成功後，`submitFamilyMilestoneJoinResponse()` 會在該玩家的 `playerStates.{uid}` 寫入：
  - `pendingFamilyMilestoneJoinAction`
  - `pendingCardAction`
  - `lastBoardEvent`
- `pendingFamilyMilestoneJoinAction` 內含：
  - `promptId`
  - `cardId`
  - `sourcePlayerUid`
- 這個 pending action 是玩家層的後續處理，不是新的 `boardState` queue item。
- [`src/views/game/GameView.tsx`](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/線上模式0611/src/views/game/GameView.tsx) 會在本地 effect 偵測到 pending action 後，依 `resolveBoardCardAction(cardId, gameState)` 套用後續流程：
  - `financial`
  - `happiness`
  - `choice`
  - `dismiss`

### Shared Prompt

- `familyMilestoneJoinPrompt` 與 `pendingFamilyMilestoneJoinAction` 是兩個不同層級的狀態：
  - 前者是房間共享 prompt
  - 後者是單一玩家的待處理動作
- `submitFamilyMilestoneJoinResponse()` 會把回覆寫進：
  - `boardState.familyMilestoneJoinPrompt.responses.{uid}`
- `passed / failed / declined` 目前都已存在於 [`src/types.ts`](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/線上模式0611/src/types.ts)。

### Passed / Failed / Declined

- [`src/views/game/GameView.tsx`](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/線上模式0611/src/views/game/GameView.tsx) 的 `handleFamilyJoinRoll()`：
  - 本地擲出 1 到 6
  - 與 `requiredRoll` 比較
  - 成功時送出 `passed`
  - 失敗時送出 `failed`
- 同一個畫面也有 `handleDeclineFamilyJoin()`，直接送出 `declined`。
- `submitFamilyMilestoneJoinResponse()` 對 `passed` 以外的狀態只寫 response，不建立 pending action。

### Multiplayer

- 現況的多人同步權威是 Firestore `rooms/{roomId}`。
- 家庭重要歷程相關狀態分散在：
  - `rooms/{roomId}.boardState.familyMilestoneJoinPrompt`
  - `rooms/{roomId}.playerStates.{uid}.pendingFamilyMilestoneJoinAction`
  - `rooms/{roomId}.playerStates.{uid}.completedHappinessEvents`
  - `rooms/{roomId}.playerStates.{uid}.happiness`
- `docs/PROJECT_OVERVIEW.md` 與 `docs/STATE_INVENTORY.md` 都已把這些欄位列為目前已存在狀態。

### Queue

- `advanceBoardEventQueue()` 與 `dismissBoardCard()` 都會走 `shiftBoardQueue()`。
- `shiftBoardQueue()` 在推進時會直接把 `familyMilestoneJoinPrompt` 清空。
- 也就是說，目前 queue 推進與 family prompt 收束是同一路徑的一部分，不是獨立等待所有回覆完成的機制。
- `advanceBoardEventQueue(expectedType?)` 只驗證 `currentEvent.type`，沒有再檢查 family prompt 是否已完整收束。

### Completion Rule

- 家庭重要歷程的階段完成與顯示，現在主要依 `getFamilyMilestoneStatus(gameState)` 推算。
- 其判斷依據是：
  - `completedHappinessEvents`
  - `happiness[].checked`
- 目前沒有看到一個單一的 shared completion flag 直接代表「所有 eligible 玩家都已回覆且 source event 可以正式結束」。
- `passed` 玩家完成後的 pending action，也是在玩家端 local flow 內被收束，再回寫共享狀態。

## Problem

- 目前實作與正式規格文件的衝突，集中在「家庭重要歷程到底是 shared prompt 還是正式事件鏈的一部分」。
- `docs/gdd/CARD_SYSTEM.md` 與 `docs/gdd/EVENT_SYSTEM.md` 都要求：
  - Family Milestone 是正式多人事件
  - 所有符合資格玩家都要回覆
  - 所有回覆與後續效果完成後，來源事件才可結束
  - `Family Milestone Join Prompt` 屬於 shared event-like state，但不能讓來源事件提早結束
- 目前程式的實際行為不是這樣：
  - `shiftBoardQueue()` 會在 queue 推進時直接清掉 `familyMilestoneJoinPrompt`
  - `advanceBoardEventQueue()` 沒有檢查 prompt 是否還在等待回覆
  - `passed` 之後的後續效果被拆到玩家本地 pending flow
  - 家庭歷程完成進度仍主要由 `completedHappinessEvents` 與 `happiness.checked` 推算
- `docs/STATE_MACHINE.md` 也已記錄目前 family join flow 是：
  - source player reveal
  - create join prompt
  - target players decline / roll
  - passed 進入 pending action
  - queue advance 會清 prompt
  - 這代表 prompt 與 source event completion 不是同一個 atomic flow
- 如果與 `docs/gdd` 不一致，衝突點不只是一個 UI 行為，而是三個層次同時不一致：
  - 共享 prompt 的生命週期
  - queue 的結束時機
  - completion rule 的權威來源

## Option A（維持目前）

- 維持目前的兩段式流程：
  - source player 完成自己的卡片處理
  - 參與玩家各自回覆並在本地處理 pending action
  - queue 由 `advanceBoardEventQueue()` / `dismissBoardCard()` 繼續推進
- `familyMilestoneJoinPrompt` 仍是共享提醒，但不作為 source event 結束的阻塞條件。
- `passed / failed / declined` 繼續只作為回覆結果與個人 pending flow 的輸入。
- 家庭歷程完成規則仍以 `completedHappinessEvents` / `happiness.checked` 為主。

### Option A 影響

- 與目前程式行為一致。
- 不需要改變現有 queue / prompt / pending action 分層。
- 但會持續與 `docs/gdd` 的正式要求不一致。

## Option B（推薦）

- 保留目前已存在的 state 與資料欄位，但把家庭重要歷程明確定義成正式 shared event-like flow：
  - prompt 建立時固定 eligible 名單
  - eligible 名單內的每位玩家都要完成 `passed / failed / declined`
  - `passed` 玩家後續 pending action 也要完成
  - source event 只在上述條件全部完成後才可正式結束
- `familyMilestoneJoinPrompt` 不應在 queue 進位時被提早清掉，而應在 prompt 自己完成後再清除。
- `completedHappinessEvents` 可以保留作為歷程進度資料，但不應單獨取代 shared completion 條件。

### Option B 影響

- 與 `docs/gdd/CARD_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md` 的規格方向一致。
- 仍然使用現有欄位，不需要引入新的玩法。
- 需要把「prompt 完成」和「source event 結束」視為同一條共享流程的兩個收束點。

## Recommendation

- 建議採用 **Option B**。
- 原因是目前資料結構已經同時存在：
  - `familyMilestoneJoinPrompt`
  - `responses.{uid}`
  - `pendingFamilyMilestoneJoinAction`
  - `completedHappinessEvents`
- 既有程式已經把 family flow 做成 shared prompt + per-player pending flow，只是收束點分散在 queue、local effect、以及 progress 推算。
- 若要與現有正式文件一致，應把 family flow 的完成條件集中到 shared completion rule，而不是讓 queue 先行清 prompt。

## Decision Required

1. 家庭重要歷程是否要以 `docs/gdd` 的正式規格為準。
2. `familyMilestoneJoinPrompt` 是否必須等所有符合資格玩家回覆完成後才能清除。
3. `passed` 玩家產生的 `pendingFamilyMilestoneJoinAction` 是否屬於正式完成條件的一部分。
4. `completedHappinessEvents` 是否只作為進度資料，而不是最終完成權威。
5. `advanceBoardEventQueue()` 是否要在 family prompt 未收束時禁止推進來源事件。

## Need Confirmation

1. 如果沒有任何 eligible target player，是否要維持目前「不建立 prompt，直接略過」的行為。
2. `eligible` 名單是否應以 prompt 建立當下固定，不再跟著玩家後續狀態變動。
3. `passed` 玩家如果還沒處理完 pending action，來源事件是否必須持續等待。
4. `declined` 與 `failed` 是否都只算回覆完成，不會再產生後續本地流程。
5. 當 source player 已推進到下一個 queue event 時，舊的 family prompt 是否仍應保留到全部回覆完成。
6. 家庭重要歷程的 completion rule 是否要完全依 shared prompt response，而不是依 `completedHappinessEvents` 或 `happiness.checked`。

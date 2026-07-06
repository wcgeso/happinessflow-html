# School System RFC

> 文件定位：學校系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/TURN_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/BOARD_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md`，以及目前 `線上模式0611` 工作樹中的實作。
>
> 本文件只整理現況、問題與待決策點，不自行設計新玩法。

## Current Implementation

### 學校事件

- `src/context/RoomContext.tsx` 的 `buildBoardMovementResolution()` 會在移動路徑上掃到 `school` 格時建立 `type: 'school'` 的 `BoardEventLog`。
- 同一趟移動如果經過多個學校格，會透過 `queuedRouteTypes` 去重，只保留第一筆 `school` 路徑事件。
- 停留在學校格時，不會建立另一種獨立的學校事件型別；只會寫入提示文字 `可選擇報名升等考試`。
- `src/views/game/GameView.tsx` 會用 `boardState.currentEvent.type === 'school'` 判斷是否顯示學校提示。

### 升等 / Promotion

- `src/views/game/GameView.tsx` 的 `PromotionModal` 只提供一般考試報名。
- `onPromotionRegister('normal')` 會呼叫 `handlePromotionConfirm()`，成功後設定 `promotionType = 'normal'` 並打開 `DiceRollContainer`。
- `src/hooks/useGameLogic.ts` 的 `handlePromotionConfirm()` 會直接扣除 1,000 H 報名費，並新增一筆 `升等考試報名費` 交易。
- `src/hooks/useGameLogic.ts` 的 `applyExamResult()` 會在成功時更新 `currentRankLevel`、`currentRankTitle` 與 `profession.salary`，並寫入 `晉升加薪` 交易；失敗時只寫入 `升等考試未通過` 交易。
- `src/hooks/useGameLogic.ts` 另外保留 `handleLifelongConfirm()` / `applyLifelongResult()`，但那是另一條終身學習流程，不是學校格本身的獨立事件。

### 考試與 Exam Dice

- `src/hooks/useDiceRollLogic.ts` 是共用的考試骰邏輯。
- 當 `promotionType === 'normal'` 時，目標值是 `currentRankLevel + 1`。
- 當 `promotionType === 'enhance_profession'` 或 `'lifelong'` 時，目標值是 2。
- 當 `promotionType === 'stock_ability'` 或 `'real_estate_ability'` 時，目標值是 4。
- `src/components/modals/DiceRollModal.tsx` 顯示同一個骰子 UI，只是依 `promotionType` 切換文案。

### Happiness Card

- `src/context/RoomContext.tsx` 的 `drawPostExamHappinessCard(success)` 會直接抽一張幸福卡，並把 `boardState.currentEvent` 改成 `type: 'exam_happiness'`。
- 這個函式同時直接覆寫 `boardState.currentCard` 與 `boardState.currentCardReveal`，其中 `isRevealed` 初始為 `false`。
- `src/views/game/GameView.tsx` 在骰子 Modal 關閉時，若 `promotionType === 'normal'` 且沒有 active board card，就會呼叫 `drawPostExamHappinessCard(lastDiceSuccess)`。
- 這表示考後幸福卡是由學校流程直接接出來，不是先進入一個新的獨立 queue entry 再等待下一步。

### Reveal

- `src/context/RoomContext.tsx` 的 `revealBoardCard(eventId, cardId)` 只會在 `currentEvent.id` 與 `currentCard.cardId` 都吻合時，把 `currentCardReveal.isRevealed` 設為 `true`。
- 學校考後幸福卡也走同一個 reveal 機制，因為它最後仍是 `currentCard`。
- `src/views/game/GameView.tsx` 會在抽卡 drawer 開啟後，透過 `handleBoardCardReveal()` 呼叫 `revealBoardCard()`。

### Follow-up

- `src/context/RoomContext.tsx` 的 `drawBoardFollowupCard(deck, summary, detail)` 會直接建立 `type: 'followup'` 的 `currentEvent`，同時覆寫 `currentCard` 與 `currentCardReveal`。
- `src/context/RoomContext.tsx` 的 `advanceBoardEventQueue()` 與 `dismissBoardCard()` 只會把 `pendingEvents` 往前 shift，沒有專門的學校完成判定。
- `docs/gdd/CARD_SYSTEM.md` 與 `docs/gdd/EVENT_SYSTEM.md` 都把 `exam_happiness`、`followup` 視為正式事件鏈的一部分；目前程式雖然有這兩個型別，但處理方式是直接覆寫 current event/card。

### skip

- `src/context/RoomContext.tsx` 的 `getNextTurnUid()` 會掃描 `skipTurns`，遇到被跳過的玩家就把該玩家的 skip 次數減 1。
- 如果所有玩家都被 skip，函式會回到原本的 `currentTurnUid`。
- 這代表 skip 是回合掃描邏輯的一部分，不是學校事件本身的專屬流程。

### Event Queue

- `src/context/RoomContext.tsx` 以 `pendingEvents` / `currentEvent` / `currentCard` 組成棋盤事件佇列。
- `buildBoardMovementResolution()` 在結算移動時會先建立 queue，然後立即切換 `currentTurnUid`。
- `advanceBoardEventQueue('school')` 只會在目前 `currentEvent.type === 'school'` 時推進 queue，沒有額外的所有者驗證。
- `docs/STATE_MACHINE.md` 已明確寫出目前程式是「落地結算時就切換下一位」，不是等 `currentEvent` 全部處理完才切換。

## Problem

- `docs/gdd/TURN_SYSTEM.md` 與 `docs/gdd/EVENT_SYSTEM.md` 都把學校事件定義成完整事件鏈，要求「選擇、考試、後續幸福卡」完成後才算結束；目前程式則是由 `GameView.tsx` 在骰子 Modal 關閉時直接觸發 `drawPostExamHappinessCard()`，屬於直接覆寫 `currentEvent/currentCard`。
- `docs/gdd/CARD_SYSTEM.md` 要求 `Follow-up Card` 必須走正式佇列，不能用覆寫略過生命週期；目前 `drawPostExamHappinessCard()` 與 `drawBoardFollowupCard()` 都是直接寫入新的 `currentEvent` 與 `currentCard`。
- `docs/gdd/BOARD_SYSTEM.md` 與 `docs/gdd/TURN_SYSTEM.md` 要求參加考試後，無論成功或失敗都要抽幸福卡，且學校事件未完成前不得切換下一位玩家；目前 `buildBoardMovementResolution()` 會先切 `currentTurnUid`，再讓學校流程留在當前客戶端處理。
- `src/views/game/GameView.tsx` 對學校只保留一個本地 `handledSchoolPromptKeys` 防重機制，關閉視窗不等於資料層的正式完成。
- `src/hooks/useGameLogic.ts` 的 `handlePromotionConfirm()` 回傳型別保留了 `'pending'`，但目前學校報名流程沒有實際的 pending request 入口；這使得 `Promotion` 在程式裡是 UI 入口，不是完整的事件狀態機。
- `src/hooks/useDiceRollLogic.ts` 與 `src/components/modals/DiceRollModal.tsx` 共用同一個骰子模組，學校考試與終身學習共用 UI 與基礎邏輯；正式文件若要區分「升等」與「其他 Promotion」，目前程式沒有分拆成不同事件層。
- `src/context/RoomContext.tsx` 的 `advanceBoardEventQueue()`、`dismissBoardCard()`、`revealBoardCard()` 都是條件式寫入，正式規格若要求 school / exam_happiness / follow-up 有嚴格生命週期，現有實作還沒有把這些邊界分開。

## Option A（維持目前）

說明：

維持現有流程，把學校視為「玩家先報名、再擲考試骰、再由客戶端直接接出考後幸福卡」的複合 UI 流程。

優點：

- 目前程式不用改變資料流。
- `PromotionModal`、`DiceRollModal`、`drawPostExamHappinessCard()` 的串接方式可以維持原樣。
- 跟現有 `GameView.tsx` 的操作節奏一致。

缺點：

- `school`、`exam_happiness`、`followup` 的正式邊界不清楚。
- `currentTurnUid` 先切換、事件後處理的行為會持續和正式文件衝突。
- 關閉學校視窗與正式結束學校事件仍然不是同一件事。

適合什麼情境：

只想忠實保留目前程式行為，不打算立刻把學校事件完全納入正式 queue 規格時。

## Option B（推薦）

說明：

把學校流程明確定義為正式事件鏈，並以 `school -> exam -> exam_happiness -> follow-up -> completion` 的順序描述。

具體含意只限於文件與狀態定義，不新增玩法：

- `school` 是正式事件入口。
- `Promotion` / 報名只是 `school` 事件中的一個步驟。
- `Exam Dice` 是 `school` 事件中的判定步驟。
- `exam_happiness` 是學校事件衍生的正式後續事件。
- `follow-up` 仍然是正式後續事件，不可用覆寫視為完成。

優點：

- 與 `docs/gdd/TURN_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md` 的正式方向一致。
- `school`、`Reveal`、`Follow-up`、`Event Queue` 的邊界會比較清楚。
- 之後可以直接拿這份 RFC 當學校系統的對照依據。

缺點：

- 和現有程式的直接覆寫流程不一致。
- 必須接受目前 `drawPostExamHappinessCard()` / `drawBoardFollowupCard()` 不是正式 queue 驅動。

適合什麼情境：

要把學校系統正式化，並且讓學校、考試、幸福卡、後續卡用同一套事件語言描述時。

## Recommendation

建議採 `Option B`。

原因不是要新增玩法，而是目前程式已經同時存在 `school`、`exam_happiness`、`followup`、`Reveal`、`skip`、`Event Queue` 這些概念，但它們的邊界在實作上是分散的；若要對齊正式文件，先把這條鏈條說清楚，比維持模糊的 UI 流程更可控。

## Decision Required

□ A

□ B

請確認以下定義：

- `Promotion` 在正式文件中是否只指一般升等考試，還是也要涵蓋終身學習的其他 promotion 類型。
- `exam_happiness` 是否要被視為學校事件的正式後續事件，而不是單純的 UI 轉場。
- `follow-up` 是否必須先進入正式 queue，再進行 `Reveal` 與處理。

## Need Confirmation

1. 學校視窗直接關閉時，是否代表玩家選擇不參加考試並正式結束本次學校事件。
2. 一般考試成功或失敗後，是否都必須抽一張幸福卡且不得跳過。
3. 學校事件是否應阻塞下一位玩家，直到 `exam_happiness` 與可能的 `follow-up` 全部完成。
4. `Reveal` 是否只適用於卡片事件，還是也要明確寫入學校後續幸福卡與後續卡。
5. `skip` 在學校流程中是否只是回合掃描邏輯，還是應有學校專屬的跳過定義。

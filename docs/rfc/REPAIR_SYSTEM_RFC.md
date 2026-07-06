# Repair System RFC

> 文件定位：維修系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/TURN_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/BOARD_SYSTEM.md`，以及目前 worktree 內的程式實作。
>
> 本文件只整理目前程式真正存在的維修廠流程、保養費、車輛判定、Skip Turn、Event / Queue / Financial Check / Modal / UI 及與 GDD 的衝突，不自行設計新玩法。

## 1. Current Implementation

### 維修廠

- `src/constants/board.ts` 已有 `type: 'repair'` 的棋盤格，index 是 `27`，標籤是 `維修廠`，`pauseTurns` 設為 `1`。
- `src/types.ts` 的 `BoardSquareType` 已包含 `repair`，但 `BoardEventLog.type` 只有 `bank`、`school`、`hospital`、`card`、`exam_happiness`、`followup`，沒有 `repair`。
- `src/context/RoomContext.tsx` 在移動路徑掃描與落點結算時都會檢查 `square.type === 'repair'`。
- 經過維修廠時，程式只會產生文字提示 `經過維修廠，汽車保養費 ...，請自行登錄`。
- 停留維修廠時，程式只會產生文字提示 `踩到維修廠，保養費 ...，並暫停一回合`，並把 `skipTurns[playerUid]` 設為至少 `1`。

### 保養費

- `RoomContext.tsx` 在經過或停留維修廠時，會用 `Math.floor(Math.random() * 6) + 1` 先骰一次 `repairRoll` / `feeRoll`。
- 文字提示中的保養費固定是 `骰點 x 2000`。
- 目前這個金額只存在於提示文字，沒有被寫成獨立的 `repair` 事件，也沒有直接轉成 `boardFinancialAction`。
- `src/components/game/BoardFinancialCheckModal.tsx` 是通用財務檢核 UI，但目前維修廠流程沒有接到它。

### 車輛判定

- `RoomContext.tsx` 的 `hasCarAsset()` 會把 `Asset.type === '汽車'` 或 `Asset.type === '飛行器'` 都視為有車。
- `rollBoardDice()` 會依 `hasCarAsset()` 決定擲 1 顆或 2 顆骰子。
- 維修廠提示也同樣依 `hasCarAsset()` 決定是否顯示保養費文字。
- 目前沒有獨立的維修廠車輛判定層；車輛可否觸發維修廠與車輛可否擲兩顆骰子，共用同一個 boolean 判定。

### Skip Turn

- 停留維修廠時，`RoomContext.buildBoardMovementResolution()` 會直接把 `nextSkipTurns[playerUid]` 設為 `landedSquare.pauseTurns || 1`。
- `getNextTurnUid()` 會依 `skipTurns` 直接跳過下一輪輪到的玩家，並在掃描時遞減次數。
- `buildBoardMovementResolution()` 會在移動結算當下直接切換 `currentTurnUid`，因此維修廠的停一回合效果不是在事件完成後才生效，而是在落地結算時就已經寫入狀態。

### Event

- `RoomContext.buildBoardMovementResolution()` 目前只會把 `bank`、`school` 以及落點 `card`、`hospital` 轉成 `pendingEvents`。
- 維修廠沒有對應的 `BoardQueuedEvent`，也沒有 `currentEvent.type === 'repair'`。
- `GameView.tsx` 目前能處理的正式事件面板是銀行、學校、醫院、卡片與通用財務檢核，沒有維修廠專屬事件流程。

### Queue

- `BoardState.pendingEvents` 目前由 `bank`、`school`、`card`、`hospital` 組成。
- 維修廠只出現在 `detailMessages` 與 `skipTurns`，沒有進入 queue。
- `advanceBoardEventQueue()` 目前只接受 `bank`、`school`、`hospital`、`card`、`exam_happiness`、`followup`，沒有 `repair`。

### Financial Check

- `src/components/game/BoardFinancialCheckModal.tsx` 已存在通用財務檢核 UI。
- 現在真正接入這個 UI 的流程是 `boardFinancialAction`，例如醫院醫藥費、卡片財務動作、銀行 follow-up 等。
- 維修廠目前沒有產生 `boardFinancialAction`，所以沒有經過正式財務檢核。

### Modal

- `GameView.tsx` 目前有 `PaydayModal`、`MedicalClaimModal`、`PromotionModal`、`LifelongLearningModal`、`BoardFinancialCheckModal` 等流程。
- 目前沒有 `Repair` 專屬 Modal。
- 維修廠流程只透過 `RoomContext.tsx` 的提示文字表達，沒有任何對應的使用者互動畫面。

### UI

- 棋盤格本身在 `src/constants/board.ts` 已顯示為 `維修廠`。
- `GameView.tsx` 並沒有維修廠專屬 overlay、確認框或操作按鈕。
- 玩家能看到的只有移動結算文字，並沒有像醫院那樣的明確事件視窗。

## 2. Problem

### GDD 衝突

- `docs/gdd/TURN_SYSTEM.md` 明確把維修廠列為正式事件，要求經過或停留時都要擲保養判定骰、計算保養費、完成財務檢核，並讓事件成為回合的一部分。
- `docs/gdd/EVENT_SYSTEM.md` 明確要求 `Repair Shop Event` 是正式 `Board Event`，而且必須進入 `Event Queue`。
- `docs/gdd/BOARD_SYSTEM.md` 明確寫出目前程式沒有正式 `repair` 事件型別與 queue entry，且這是實作落差。
- `docs/gdd/TURN_SYSTEM.md` 與 `docs/gdd/BOARD_SYSTEM.md` 都要求維修廠的停一回合效果，要等事件正式完成後才成立；目前程式是在移動結算時就先寫入 `skipTurns`，不是事件完成後才寫入。
- `docs/gdd/TURN_SYSTEM.md` 要求維修費是 `骰點 x 2000`，並且要走 `Financial Check`；目前程式只把金額寫在提示文字，沒有正式檢核流程。

### 實作衝突

- 維修廠在資料上存在，但在事件模型上不存在。
- 維修廠在 UI 上只是一段提示文字，不是可操作的事件流程。
- 維修廠沒有進 queue，所以也沒有辦法跟銀行、學校、醫院、卡片維持一致的事件生命週期。
- 維修廠沒有接到 `BoardFinancialCheckModal`，所以保養費不會以正式交易條目處理。
- 車輛判定目前同時接受 `汽車` 與 `飛行器`，若正式規格只認 `汽車`，現況會與規格不一致。
- `currentTurnUid` 會在移動結算時立刻切到下一位，維修廠不能像正式事件那樣阻塞回合。

### 目前程式會造成的結果

- 玩家看到的是「有一段保養費提示」與「可能停一回合」，不是完整事件。
- 保養費沒有獨立的完成點。
- 下一位玩家的回合切換不依賴維修廠事件完成。
- 維修廠無法用 queue / modal / financial check 的既有框架被一致處理。

## 3. Option A（維持目前）

### Current Approach

- 保持維修廠只是 `repair` 棋盤格與提示文字。
- 維持目前 `skipTurns` 的寫入時機與 `currentTurnUid` 切換方式。
- 不新增 `repair` queue event，不新增專屬 Modal，也不把保養費接入正式財務檢核。

### Pros

- 與現有程式完全一致。
- 不需要改動事件佇列與回合切換邏輯。
- 不需要新增修理事件的 UI 流程。

### Cons

- 與正式 GDD 持續衝突。
- 維修廠無法被當成正式事件處理。
- 保養費、Skip Turn、Financial Check 的邊界都不清楚。
- 玩家只會看到提示，不會看到正式事件完成狀態。

## 4. Option B（推薦）

### GDD 對齊

- 把維修廠視為正式 `Board Event`。
- 讓維修廠進入 `pendingEvents` 與 `currentEvent` 生命週期。
- 讓保養費走既有的 `Financial Check` 流程。
- 讓停一回合效果在事件完成後才成立。
- 讓現有 `BoardFinancialCheckModal` 承接維修費的檢核與完成。

### Pros

- 與 `docs/gdd/TURN_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/BOARD_SYSTEM.md` 一致。
- 能和銀行、學校、醫院、卡片共用同一套事件生命週期。
- Queue、Modal、Financial Check、Skip Turn 的責任邊界會一致。
- 之後比較容易寫驗收條件與測試案例。

### Cons

- 需要把現有「提示文字」流程整理成正式事件流程。
- 需要補齊維修廠事件與現有 queue / modal 的接線。
- 會比維持現況多出一層事件狀態管理。

## 5. Recommendation

建議採 `Option B`。

理由只有一個：正式 GDD 已經明確要求維修廠是正式事件，而目前程式的維修廠只停留在提示文字與立即寫入 `skipTurns` 的層級，兩者差距不是文案問題，而是事件模型問題。

## 6. Decision Required

- `repair` 是否要進入 `pendingEvents`，並成為正式 `currentEvent.type`？
- 維修費是否要固定走 `骰點 x 2000`，並透過 `BoardFinancialCheckModal` 完成？
- `skipTurns` 是否要等維修廠事件正式完成後才寫入？
- 車輛判定是否要保留 `汽車` / `飛行器` 的相容性，還是正式規格只認 `汽車`？

## 7. Need Confirmation

- 維修廠是否要跟銀行、學校、醫院一樣，成為正式 queue event？
- 維修廠的保養費是否要由既有財務檢核 UI 承接，而不是只顯示提示文字？
- 停留維修廠的停一回合效果，是否一定要等事件完成後才生效？
- `飛行器` 是否仍要視為可觸發維修廠與車輛移動骰的有效車輛？

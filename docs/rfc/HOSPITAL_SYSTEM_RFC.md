# Hospital System RFC

> 文件定位：醫院系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/rfc/*.md`、`docs/gdd/*.md` 與目前 worktree 內的程式實作。
>
> 本文件只整理目前程式真正存在的醫院事件、第二顆骰、醫藥費、Skip Turn、Financial Check、Event Queue 與 Multiplayer 行為，不自行設計新玩法。

## 1. Current Implementation

### 1.1 醫院事件

目前醫院事件只在棋盤移動落點是 `hospital` 時建立。

可確認的實作路徑：

- `src/context/RoomContext.tsx`
  - `buildBoardMovementResolution()`
  - 落點為 `hospital` 時建立 `BoardQueuedEvent`
  - `BoardEventLog.type = 'hospital'`
- `src/views/game/GameView.tsx`
  - `showHospitalRollModal`
  - `activeHospitalPromptKey`
  - `handleHospitalRollConfirm()`

目前流程是：

1. 玩家擲棋盤骰後，`RoomContext.rollBoardDice()` 寫入共享 `movement`。
2. 移動結算後，`buildBoardMovementResolution()` 若落在 `hospital`，會把 `hospital` 事件放進 `pendingEvents`，並把 `skipTurns[playerUid]` 設為至少 `1`。
3. `GameView` 監聽到 `currentEvent.type === 'hospital'` 後，打開醫院 modal。
4. 玩家在 modal 中先處理第二次骰子，再進入財務流程。

### 1.2 第二顆骰

目前醫院第二顆骰是 `GameView` 本地 UI 狀態：

- `hospitalRollValue`
- 按鈕文字是 `擲第二次骰子`
- 每次按下按鈕都會用 `Math.floor(Math.random() * 6) + 1` 產生 1 到 6

目前可確認的行為：

- 在 `showHospitalRollModal` 關閉前，可以反覆按 `擲第二次骰子`
- 沒有看到 Firestore 層的鎖定欄位
- 沒有看到獨立的 hospital dice event type

### 1.3 醫藥費

目前醫藥費公式固定是：

```text
medicalFee = hospitalRollValue × 1000
```

可確認的實作路徑：

- `src/views/game/GameView.tsx`
  - `handleHospitalRollConfirm()`
  - `txData.amount = medicalFee`
  - `txData.cashChange = -medicalFee`
  - `txData.usage = 'expense'`
  - `txData.impacts` 會寫入骰點與金額
- `src/components/game/BoardFinancialCheckModal.tsx`
  - 使用 `expectedEntries` 驗證財務檢核

### 1.4 Skip Turn

目前醫院的停一回合不是獨立 hospital occupancy state，而是直接寫在 `skipTurns`。

可確認的實作路徑：

- `src/context/RoomContext.tsx`
  - `buildBoardMovementResolution()`
    - `nextSkipTurns[playerUid] = Math.max(nextSkipTurns[playerUid] || 0, landedSquare.pauseTurns || 1)`
  - `getNextTurnUid()`
    - 回合切換時掃描 `skipTurns`
    - 若某玩家 `skipTurns > 0`，會先扣 1 再跳過
- `src/types.ts`
  - `BoardSquare.pauseTurns?: number`
  - `GameState.skipTurns`
  - `BoardState.skipTurns`

醫院格本身在 `src/constants/board.ts` 已帶有 `pauseTurns`，目前醫院落點會把該值寫入停回合狀態。

### 1.5 Financial Check

目前醫院事件的財務檢核是 UI 流程，不是資料層獨立驗證。

可確認的實作路徑：

- `src/views/game/GameView.tsx`
  - `handleHospitalRollConfirm()` 會建立 `boardFinancialAction`
  - `boardFinancialAction.expectedEntries` 只要求現金減少
  - `applyResolvedBoardFinancialTx()` 內部呼叫 `handleTransactionSubmit(txData)`
- `src/components/game/BoardFinancialCheckModal.tsx`
  - 玩家在 modal 中填寫 `expectedEntries`
  - 驗證通過後才呼叫 `onApply(txData)`
- `src/hooks/useGameLogic.ts`
  - `handleTransactionSubmit()` 實際套用交易
  - 本身不驗證 `expectedEntries`

如果現金不足，`GameView` 會先進入 `pendingForcedBoardPayment` / `showForcedBoardPaymentModal`，再由玩家選擇周轉方式。

### 1.6 Event Queue

醫院事件會進入 `rooms/{roomCode}.boardState.pendingEvents`，但回合切換不是等醫院事件完成才進行。

可確認的實作路徑：

- `src/context/RoomContext.tsx`
  - `buildBoardMovementResolution()` 會把 `hospital` 放進 `queuedEvents`
  - 結算完成後，會立即寫入 `currentTurnUid = nextTurn?.nextUid || playerUid`
  - `pendingEvents` 保留尚未處理完的事件
- `src/context/RoomContext.tsx`
  - `advanceBoardEventQueue('hospital')` 會把 queue 往前推進
- `src/views/game/GameView.tsx`
  - `pendingBoardStepAdvance` 會在醫療費套用完成後觸發 `advanceBoardEventQueue('hospital')`

### 1.7 Multiplayer

目前醫院事件的同步來源是 Firestore `rooms/{roomCode}`。

可確認的實作路徑：

- `src/context/RoomContext.tsx`
  - `onSnapshot(doc(db, 'rooms', room.id), ...)`
  - `boardState.currentEvent`
  - `boardState.pendingEvents`
  - `boardState.skipTurns`
  - `playerStates`
- `src/views/board/BoardProjectionView.tsx`
  - 直接監看 `room.boardState`
  - 顯示目前移動、目前回合、目前事件

醫院 modal 與醫院財務流程都依賴各客戶端對同一份 `room` snapshot 的讀取，但 `currentTurnUid` 在醫院事件完成前就已切換到下一位玩家。

## 2. Problem

### 與 `docs/gdd` 的衝突

- `docs/gdd/BOARD_SYSTEM.md` 與 `docs/gdd/TURN_SYSTEM.md` 都要求「所有必須處理事件完成後，才可切換下一位玩家」；目前程式在 `buildBoardMovementResolution()` 完成後就立刻把 `currentTurnUid` 切到下一位。
- `docs/gdd/BOARD_SYSTEM.md` 與 `docs/gdd/TURN_SYSTEM.md` 都要求醫院事件屬於本回合正式事件鏈；目前醫院事件雖然會寫入 `pendingEvents`，但不會阻止下一位玩家進入自己的回合。
- `docs/gdd/BOARD_SYSTEM.md` 與 `docs/gdd/TURN_SYSTEM.md` 都要求事件完成前不得切換下一位玩家；目前醫院是以「queue 還沒清完，但 turn 已經換人」的方式運作。
- `docs/gdd/BOARD_SYSTEM.md` 要求停留醫院時必須進入正式事件與正式 `Financial Check`；目前 `Financial Check` 是 `GameView` / `BoardFinancialCheckModal` 的 UI 流程，`useGameLogic.handleTransactionSubmit()` 本身不驗證檢核答案。
- `docs/gdd/FINANCIAL_SYSTEM.md` 要求所有正式交易都必須完成 `Financial Check` 才成立；目前醫院醫藥費是否成立，主要取決於前端 modal 流程是否有被走完。

### 目前實作的結構性問題

- 第二次骰子是本地 UI 狀態 `hospitalRollValue`，沒有獨立的共享鎖定欄位，因此可在 modal 關閉前反覆重骰。
- 醫院停一回合是透過 `skipTurns` 寫入與 `getNextTurnUid()` 跳過來完成，沒有獨立 hospital status。
- `skipTurns` 同時存在於 `GameState` 與 `BoardState`，醫院事件結束、下一回合切換與本地顯示會同時讀寫這兩份資料。
- `pendingEvents` 已有醫院事件，但 `currentTurnUid` 在醫院財務流程前就切到下一位，事件佇列與回合順序不是同一個阻塞點。
- `BoardFinancialCheckModal` 驗證的是 `expectedEntries` 與玩家輸入的配對，`handleTransactionSubmit()` 只負責套用交易結果，沒有資料層的醫院專屬驗證。
- 多人同步依賴 Firestore snapshot 與前端 effect，沒有看到醫院事件的專屬 server-side 仲裁。

## 3. Option A（維持目前）

### 說明

保留目前醫院流程：

- 落到醫院後建立 `hospital` queue event
- 在本地 modal 內擲第二次骰子
- 醫藥費固定為 `骰點 × 1000`
- 先完成 UI 財務檢核，再套用交易
- `skipTurns` 依現有 `getNextTurnUid()` 規則在未來回合被消耗
- `currentTurnUid` 維持目前的立即切換方式

### 優點

- 與目前 worktree 的程式實作最一致。
- 不需要重整回合與事件阻塞邊界。
- 不需要補新的共享狀態欄位。

### 缺點

- 與 `docs/gdd/BOARD_SYSTEM.md`、`docs/gdd/TURN_SYSTEM.md` 的「事件先完成、再切換下一位」不一致。
- 下一位玩家的回合與前一位玩家的醫院事件可能並行存在。
- `Financial Check` 主要靠 UI 保障，資料層不是唯一門檻。

## 4. Option B（推薦）

### 說明

把醫院正式定位成會阻塞本回合結束的共享事件鏈：

- 醫院落點建立 `hospital` queue event
- 第二次骰子仍由事件玩家處理
- 醫藥費仍以 `骰點 × 1000` 計算
- 醫藥費的 `Financial Check` 完成前，不視為該事件結束
- `skipTurns` 只在醫院事件完成後，才作為下一次輪到該玩家時的跳過依據
- `currentTurnUid` 不在醫院事件尚未完成時提前切到下一位

### 優點

- 與 `docs/gdd/BOARD_SYSTEM.md`、`docs/gdd/TURN_SYSTEM.md` 的事件順序一致。
- 醫院事件、跳回合與多人同步的邊界比較清楚。
- `pendingEvents` 會真正成為回合阻塞的一部分，而不是只是一份待處理清單。

### 缺點

- 與目前程式流程不同，需重新定義回合與事件的結束點。
- 會讓醫院事件與下一位玩家回合的切換更緊密地綁在一起。

## 5. Recommendation

建議採 `Option B`。

理由只有一個：目前醫院事件與下一位玩家回合的切換已經發生順序錯位，若不先把醫院事件定義成會阻塞回合結束的共享事件鏈，`skipTurns`、`pendingEvents`、`Financial Check` 與多人同步的語意會持續分裂。

## 6. Decision Required

- [ ] A. 維持目前醫院事件流程
- [ ] B. 讓醫院事件成為會阻塞回合結束的正式事件鏈

## 7. Need Confirmation

1. 醫院的第二次骰子是否允許在同一個 modal 內重骰多次，目前程式是允許，但正式規格未確認。
2. 醫院事件是否應該在 `Financial Check` 完成前就鎖住下一位玩家，目前程式沒有這個阻塞。
3. 醫院的 `skipTurns` 是否只代表「下一次輪到該玩家時跳過」，還是要代表「住院期間不能操作」，目前程式只看到前者。
4. 醫療費若現金不足時，是否必須先周轉再完成醫院事件，目前程式會進入 `pendingForcedBoardPayment`，但正式規則未確認。
5. 醫院事件是否應該只在落點時觸發，或也要支援其他卡片 / 事件直接導入醫院，目前程式只看到落點建立 `hospital` event。

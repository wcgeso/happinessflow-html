# Board System RFC

> 文件定位：棋盤系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/TURN_SYSTEM.md` 與目前程式實作。
>
> 本文件只整理目前程式真正存在的棋盤規則、同步方式、已知衝突與待確認項目，不自行設計新規則。

## 1. Board Layout

### Current Implementation

目前棋盤由 `src/constants/board.ts` 生成，固定為 52 格外圈循環。

- 路徑由 `createBoardPath()` 組成
- 位置順序是：
  - 上邊 14 格
  - 右邊 12 格
  - 下邊 14 格
  - 左邊 12 格
- `getSquareByIndex(index)` 會用 `% BOARD_SQUARES.length` 回繞，所以棋盤是環狀循環
- `createInitialBoardState()` 會把所有玩家初始位置設為 0
- `createInitialBoardState()` 只把 `role !== 'coach'` 的成員放入 `turnOrder`

### Squares

目前棋盤格分成兩層：

- 固定特殊格
- 其餘 41 格的循環卡片格

固定特殊格如下：

| Index | Type | Label | Current Trigger |
|---|---|---|---|
| `0` | `school` | 學校 | `起點，可報名升等考試` |
| `6` | `bank` | 銀行 | `經過時確認月結餘` |
| `13` | `hospital` | 醫院 | `棋子到達後再擲一次骰子，醫藥費為骰點 x 1000，停一回合` |
| `15` | `bank` | 銀行 | `經過時確認月結餘` |
| `24` | `bank` | 銀行 | `經過時確認月結餘` |
| `26` | `school` | 學校 | `可報名升等考試` |
| `27` | `repair` | 維修廠 | `有汽車需支付保養費，踩到停一回合` |
| `32` | `bank` | 銀行 | `經過時確認月結餘` |
| `39` | `hospital` | 醫院 | `棋子到達後再擲一次骰子，醫藥費為骰點 x 1000，停一回合` |
| `41` | `bank` | 銀行 | `經過時確認月結餘` |
| `50` | `bank` | 銀行 | `經過時確認月結餘` |

其餘格子依 `happiness -> news -> opportunity` 的循環順序配置。

## 2. Pass Rules

### Current Implementation

目前「經過」是由 `RoomContext.buildBoardMovementResolution()` 在移動路徑上逐格掃描得到。

已確認行為：

- 經過銀行時，會建立一筆 `bank` 路徑事件
- 經過學校時，會建立一筆 `school` 路徑事件
- 同一趟移動中，重複經過同一類型時只會保留第一筆路徑事件
- 經過維修廠且玩家有汽車資產時，只會寫入提示文字，不會建立正式事件
- 經過醫院時，不會建立路徑事件

### Landing Rules

目前「停留」是由落點 square 類型決定。

已確認行為：

- 停在卡片格會抽卡
- 停在醫院會建立 `hospital` 事件
- 停在銀行只會開啟銀行服務窗口，不一定會建立 `bank` 事件
- 停在學校只會寫入提示文字，不一定會建立 `school` 事件
- 停在維修廠只會寫入提示文字；若有汽車，還會產生一段保養費提示與停一回合效果

## 3. Movement Rules

### Current Implementation

目前棋盤移動由 `RoomContext.rollBoardDice()` 建立 `boardState.movement`，再由延遲結算與 snapshot listener 補完。

已確認行為：

- 每次擲骰都會寫入共享 `movement`
- `movement.path` 是從起點依骰點數逐格前進的索引序列
- `movement` 包含 `startedAt`、`stepDurationMs`、`introDelayMs`、`landingDelayMs`、`isActive`
- 擲骰端會在延遲後讀取最新 room，再由 `buildBoardMovementResolution()` 寫回結算結果
- `buildBoardMovementResolution()` 完成後，`currentTurnUid` 會立即切到下一位玩家
- `pendingEvents` 會保留尚未處理完的事件

### Dice Rules

目前棋盤移動骰只看玩家是否有汽車資產。

- 沒有汽車時：擲 1 顆骰
- 有汽車時：擲 2 顆骰
- 程式把 `汽車` 與 `飛行器` 都視為有車
- 目前程式沒有提供「有車時可自行選 1 顆或 2 顆」的正式流程

此外，醫院、學校與家庭歷程還有各自獨立的事件骰流程，但它們不是棋盤移動骰。

## 4. Special Squares

### Bank

- 會觸發銀行服務窗口
- 會影響 `bankServiceWindowActive`
- `GameView` 會以這個旗標開啟 `PaydayModal`
- 目前銀行窗口主要影響保險與定存
- 股票、貸款與汽車不靠銀行窗口限制

### School

- `boardState` 有 `school` 格
- `GameView` 會用 `PromotionModal` 與 `DiceRollModal` 處理學校流程
- 正常考試完成後，程式會以 `drawPostExamHappinessCard()` 再抽一張幸福卡

### Hospital

- `boardState` 有 `hospital` 格
- `GameView` 會開 `showHospitalRollModal`
- 醫藥費公式是 `骰點 x 1,000`
- 會設定 `skipTurns`

### Repair Shop

- `boardState` 有 `repair` 格
- 目前沒有正式 `repair` 事件型別
- 目前沒有對應的專屬 Modal 或 queue entry
- 程式只會在移動結算時寫入保養費提示

### Start

- `index 0` 不是獨立的 `start` 型別
- 它是 `school` 格
- trigger 文字是 `起點，可報名升等考試`
- 初始位置也設在 `0`

### Victory

- 目前程式沒有棋盤專屬的自動勝利結束條件
- `GameView` 會在 `gameState.happinessTotal >= 100` 時顯示勝利動畫
- `RoomContext.finishRoomGame()` 仍是另一個獨立的房間結束動作

## 5. Hospital

### Current Implementation

醫院是目前最完整的特殊格流程之一。

已確認行為：

- 停在醫院時會建立 `hospital` 事件
- 事件玩家會看到醫院骰 Modal
- 玩家先擲第二顆骰子
- 醫藥費等於骰點乘以 1,000
- 套用費用後才會推進 `advanceBoardEventQueue('hospital')`
- 醫院格會設定 `skipTurns`

## 6. School

### Current Implementation

學校目前同時存在「路徑經過提示」與「正式考試流程」兩種處理。

已確認行為：

- `buildBoardMovementResolution()` 會在經過學校時建立 `school` 路徑事件
- `GameView` 會把 school 事件接到 `PromotionModal`
- 正常考試流程會進入 `DiceRollModal`
- 考試後可抽一張幸福卡
- `drawPostExamHappinessCard()` 會直接寫入 `exam_happiness` 類型事件

## 7. Bank

### Current Implementation

銀行目前同時是事件與服務窗口來源。

已確認行為：

- 經過銀行時會建立 `bank` 路徑事件
- 停在銀行時會開啟銀行服務窗口
- `bankServiceWindowActive` 與 `bankServiceGrantedAtEventId` 存在玩家狀態中
- `openQuickTransaction()` 只允許保險與定存走銀行窗口
- `rollBoardDice()` 會在新回合開始時清掉自己原本的銀行窗口
- `buildBoardMovementResolution()` 也會清掉下一位玩家舊的銀行窗口

## 8. Repair Shop

### Current Implementation

維修廠在目前程式裡存在格子，但沒有完整事件機制。

已確認行為：

- 經過維修廠且有汽車時，會產生保養費提示
- 停在維修廠且有汽車時，會產生保養費提示並設定 `skipTurns`
- 保養費用會以 `骰點 x 2,000` 的形式出現在提示文字中
- 目前沒有 `currentEvent.type === 'repair'`
- 目前沒有對應 `advanceBoardEventQueue('repair')`

## 9. Current Implementation

### 主要流程

目前棋盤的實際執行路徑如下：

1. `RoomContext.rollBoardDice()` 先決定 1 顆或 2 顆骰子
2. 寫入 `boardState.lastRoll` 與 `boardState.movement`
3. 所有裝置根據相同 `movement` 播放移動
4. 延遲到動畫結束後，由 `buildBoardMovementResolution()` 結算
5. 結算時建立 `pendingEvents`
6. 結算完成時，`currentTurnUid` 直接切到下一位
7. `GameView` 透過 `currentEvent`、`currentCard`、`bankServiceWindowActive`、`skipTurns` 顯示後續流程

### 目前可確認的事件型別

- `bank`
- `school`
- `hospital`
- `card`
- `exam_happiness`
- `followup`

### 目前沒有的事件型別

- `repair`

## 10. Problem

### 與 `TURN_SYSTEM.md` 的衝突

- `TURN_SYSTEM.md` 要求同一位玩家本回合產生的所有必須處理事件都完成後，才切換下一位；目前程式在落地結算時就先切換 `currentTurnUid`
- `TURN_SYSTEM.md` 要求所有事件佇列清空前不可切換下一位；目前程式允許 `pendingEvents` 與下一位等待狀態並行存在
- `TURN_SYSTEM.md` 要求有車時可自行選 1 顆或 2 顆移動骰；目前程式固定擲 2 顆
- `TURN_SYSTEM.md` 將維修廠列為正式事件；目前程式沒有 `repair` 事件型別，也沒有正式結算流程
- `TURN_SYSTEM.md` 寫明停留銀行視為一次經過銀行；目前程式停在銀行主要只會開啟服務窗口，不一定建立銀行事件
- `TURN_SYSTEM.md` 寫明停留學校時觸發學校事件；目前程式停在學校只會寫提示文字，不一定建立學校事件
- `TURN_SYSTEM.md` 寫明銀行服務窗口持續到下一回合開始前；目前程式更接近下一次擲骰前清除
- `TURN_SYSTEM.md` 要求卡片必須先 Reveal 才可進入效果；目前棋盤相關流程中，部分效果仍由事件或 UI 直接推進，沒有單一統一 gate

### 目前實作的邊界

- `RoomContext.buildBoardMovementResolution()` 只對銀行與學校建立路徑事件
- 維修廠目前只留下提示，沒有正式 queue
- 醫院有正式 queue 與費用流程
- `GameView` 是實際把提示變成 Modal 的地方

## 11. Option A

### 維持目前

說明：

保留目前程式的 board 行為，包含：

- 52 格外圈循環
- 車輛固定 2 顆骰
- 回合在落地結算時就切到下一位
- 銀行、學校、醫院保留目前已實作的 queue 範圍
- 維修廠維持提示型處理

優點：

- 與現況完全一致
- 不需要先重新定義所有邊界
- 可以直接作為現行實作說明

缺點：

- 與 `TURN_SYSTEM.md` 的正式規格仍有多處差異
- 事件順序與格子規則會保留例外

## 12. Option B

### 以 `TURN_SYSTEM.md` 作為最終 board 規則

說明：

以正式文件的順序與阻塞條件當作 board 規則目標，並把目前程式中的差異都視為 implementation gap。

優點：

- 與正式規格一致
- `Pass Rules`、`Landing Rules`、`Repair Shop`、`Victory` 會更容易統一

缺點：

- 這不是目前程式的現況
- 需要補齊多個事件與阻塞流程

## 13. Recommendation

### 建議採 A

這份文件的任務是整理目前程式真正存在的棋盤系統，所以應以現況為主。

`TURN_SYSTEM.md` 的差異應留在 `Problem` 與 `Need Confirmation`，而不是直接寫成已實作規則。

## 14. Need Confirmation

1. 停在銀行時，產品規格是否要求一定要建立 `bank` 事件，還是只要開銀行服務窗口即可。
2. 停在學校時，產品規格是否要求一定要建立 `school` 事件，還是只要顯示考試入口即可。
3. 維修廠是否應該成為正式 `repair` 事件，並有自己的 Modal、財務檢核與 queue。
4. 車輛玩家是否仍要保留「可自行選 1 顆或 2 顆骰子」的規則。
5. 棋盤模式的勝利條件是否應該由 `happinessTotal >= 100` 自動結束，或仍維持由執行師手動 `finishRoomGame()`。
6. 銀行服務窗口的有效期限到底是「下一次擲骰前」還是「下一回合開始前」。

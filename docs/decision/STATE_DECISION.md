# Metadata

Status: Confirmed

Owner: 汪家慶

Last Updated: 2026-07-01

# Purpose

把與 Source of Truth、State duplication、Legacy data、sync copy 相關的 Gap，整理成需要產品負責人拍板的決策項目。

# Related Gaps

- GAP-008
- GAP-009
- GAP-018

# Decision Items

## DEC-001：玩家執行中狀態採用單一正式權威

Decision ID: DEC-001

Related Gap:
- GAP-018

Related RFC:
- `ARCHITECTURE_RFC.md`
- `FINANCIAL_SYSTEM_RFC.md`
- `TURN_SYSTEM_RFC.md`

Related GDD:
- `TURN_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`
- `BANK_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: `ARCHITECTURE_RFC.md` 已指出玩家 state 與 room.playerStates 的正式權威仍未完全收斂。
- Current GDD: `PROJECT_OVERVIEW.md` 與 `STATE_INVENTORY.md` 只描述共享 room state 與玩家 state 並存，尚未把執行中權威完全收斂成單一來源。
- Current Implementation: `GameContext.gameState`、`rooms.playerStates.{uid}`、`player_sessions` 與 localStorage 都有玩家狀態副本。
- Product Decision: 玩家執行中的正式權威採用單一來源。GameState 作為執行中的唯一正式狀態，room.playerStates 為多人同步副本，player_sessions 與 localStorage 僅作備份與恢復用途。

Options:
- Option A
  - 優點: 保持 GameState 與 room.playerStates 雙軌。
  - 缺點: 權威來源容易混淆。
- Option B（採用）
  - 優點: 建立唯一 Source of Truth，Shared State 與 Cache 的角色清楚。
  - 缺點: GDD 必須明確定義同步流程。

Recommendation:
採用 Option B。

正式規格如下：
- GameState 為玩家執行中的唯一正式狀態（Source of Truth）。
- room.playerStates 為多人同步副本，不是正式權威。
- player_sessions 僅作斷線恢復用途。
- localStorage 僅作本機快取用途。
- Shared State 不得反向成為正式資料來源。
- 所有同步流程皆由正式狀態同步至副本，不允許副本成為正式權威。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

## DEC-002：市場價格與負債權威是否只承認正式欄位

Decision ID: DEC-002

Related Gap:
- GAP-008
- GAP-009

Related RFC:
- `ASSET_SYSTEM_RFC.md`
- `MARKET_SYSTEM_RFC.md`
- `LOAN_SYSTEM_RFC.md`
- `FINANCIAL_SYSTEM_RFC.md`

Related GDD:
- `BANK_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`
- `ASSET_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 市場價格與負債權威已被拆成正式與 legacy 來源。
- Current GDD: `BANK_SYSTEM.md`、`FINANCIAL_SYSTEM.md`、`ASSET_SYSTEM.md` 已分別指定 `room.marketPrices` 與 `liabilities` 為正式權威。
- Current Implementation: `gameState.marketPrices`、`room.marketPrices`、`gameState.loans`、`liabilities` 都仍在不同流程中被讀寫。

Options:
- Option A
  - 優點: 保持同步副本也可當正式依據。
  - 缺點: 正式權威不清楚。
- Option B
  - 優點: 只承認正式欄位。
  - 缺點: 需要清理 legacy 讀取點。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-003：Legacy data 的正式邊界是否固定為相容用途

Decision ID: DEC-003

Related Gap:
- GAP-008
- GAP-018

Related RFC:
- `LOAN_SYSTEM_RFC.md`
- `ASSET_SYSTEM_RFC.md`
- `BANK_SYSTEM_RFC.md`
- `MARKET_SYSTEM_RFC.md`

Related GDD:
- `ASSET_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`
- `BANK_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: `loans`、`aircraft`、`飛行器`、`lastPurchasePrice` 一直被視為 legacy / fallback 來源。
- Current GDD: `ASSET_SYSTEM.md`、`FINANCIAL_SYSTEM.md`、`BANK_SYSTEM.md` 已把這些欄位降為 legacy 或 fallback。
- Current Implementation: 這些欄位仍參與部分計算與顯示。

Options:
- Option A
  - 優點: Legacy data 仍可作正式來源。
  - 缺點: 與正式 GDD 衝突。
- Option B
  - 優點: Legacy data 僅保留相容用途。
  - 缺點: 需要逐步清理讀取點。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

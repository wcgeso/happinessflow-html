# Metadata

Status: Confirmed

Owner: 汪家慶

Last Updated: 2026-07-01

# Purpose

把與 Context responsibility、Routing、Architecture boundary、Source of Truth、UI flow ownership 相關的 Gap，整理成需要產品負責人拍板的決策項目。

# Related Gaps

- GAP-017
- GAP-018
- GAP-019

# Decision Items

## DEC-001：正式定義 Context responsibility 邊界

Decision ID: DEC-001

Related Gap:
- GAP-017

Related RFC:
- `ARCHITECTURE_RFC.md`

Related GDD:
- `TURN_SYSTEM.md`
- `EVENT_SYSTEM.md`
- `BANK_SYSTEM.md`
- `CARD_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`
- `ASSET_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: `ARCHITECTURE_RFC.md` 已指出 `RoomContext` 與 `GameContext` 責任過度集中。
- Current GDD: 目前沒有直接對應的正式 Architecture GDD，僅由各系統 GDD 間接約束。
- Current Implementation: `RoomContext` 管房間、事件、queue、timer、market、request；`GameContext` 管玩家 state、autosave、room sync、history、summary、alerts；`GameView` 是主要 orchestration hub。
- Product Decision: 正式規格需建立 Architecture GDD，用來定義 `RoomContext`、`GameContext`、`AuthContext`、View orchestration 與 hooks 的責任邊界；現有三層 Context 結構可作為目前實作基礎，但不得作為未來正式架構邊界的唯一依據。

Options:
- Option A
  - 優點: 維持目前 Context 邊界。
  - 缺點: `RoomContext`、`GameContext` 與 `GameView` 責任仍會持續集中。
- Option B（採用）
  - 優點: 由正式 Architecture GDD 定義責任邊界，讓 Context、hooks、View orchestration 與 Firestore sync 的責任更清楚。
  - 缺點: 後續需要建立正式 Architecture GDD，並在 Implementation Plan 中分階段對齊。

Recommendation:
採用 Option B。

正式規格如下：
- Architecture GDD 必須正式定義 Context responsibility。
- `AuthContext` 應只負責身分、登入狀態與使用者資料。
- `RoomContext` 應負責房間、多人共享狀態、boardState、event queue、market sync 與 room-level actions。
- `GameContext` 應負責單一玩家 GameState、玩家資料保存、玩家狀態同步副本與 session restore。
- `GameView` 不應被視為正式架構邊界，只是目前 implementation orchestration hub。
- 現有架構可暫時保留，但正式責任邊界需由 Architecture GDD 定義。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

## DEC-002：正式收斂 Source of Truth 與同步邊界

Decision ID: DEC-002

Related Gap:
- GAP-018

Related RFC:
- `ARCHITECTURE_RFC.md`
- `STATE_DECISION.md`

Related GDD:
- `BANK_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`
- `ASSET_SYSTEM.md`
- `EVENT_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: `ARCHITECTURE_RFC.md` 與 `STATE_DECISION.md` 都指出正式權威來源尚未完全收斂。
- Current GDD: 各系統 GDD 已指定部分權威來源，但還沒有一份獨立架構文件把整體 Source of Truth 邊界一次收斂。
- Current Implementation: 玩家 state、market price、turn / event blocking、local modal state 都各自有副本或暫存。
- Product Decision: Source of Truth、sync copy、cache、derived state 與 local UI state 必須由正式 Architecture GDD / State Model 統一定義；各系統不得各自任意定義權威來源。

Options:
- Option A
  - 優點: 維持目前由各系統自行定義。
  - 缺點: 權威來源容易分散，容易造成同步副本反向成為正式資料。
- Option B（採用）
  - 優點: 由正式 Architecture GDD / State Model 統一定義 Source of Truth 與 sync boundary。
  - 缺點: 需要後續文件把所有 shared state、cache、derived state、local UI state 明確分類。

Recommendation:
採用 Option B。

正式規格如下：
- Architecture GDD / State Model 必須定義所有 Source of Truth。
- 每個 State 必須被分類為：Source of Truth、Sync Copy、Cache、Derived State、Temporary State 或 UI State。
- Sync Copy 不得反向成為正式資料來源。
- Local UI State 不得承擔正式流程完成判定。
- Firestore shared state 必須明確標示其權威層級。
- 若某狀態僅用於顯示或恢復，不得被當作正式規則判定來源。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

## DEC-003：正式定義 App shell 與 UI flow ownership

Decision ID: DEC-003

Related Gap:
- GAP-019

Related RFC:
- `ARCHITECTURE_RFC.md`

Related GDD:
- 無直接對應正式 GDD。

Status: Confirmed

Background:
- Current RFC: `ARCHITECTURE_RFC.md` 已指出主站沒有 React Router，畫面多由 `currentView` 控制。
- Current GDD: 各正式 GDD 只定義流程，不定義路由架構。
- Current Implementation: `App.tsx` 用 `currentView` 切換 `lobby`、`selection`、`game`、`score`、`coach_monitor` 等畫面。
- Product Decision: UI flow ownership 必須被正式定義。現階段不要求立即導入 React Router；`currentView` 可保留為目前實作方式，但正式流程邊界需由 Architecture GDD / UI Flow GDD 定義。

Options:
- Option A
  - 優點: 維持 `currentView` 為唯一流程控制方式。
  - 缺點: URL 與流程狀態無法完整對齊，UI flow ownership 不清楚。
- Option B（採用）
  - 優點: 正式定義 App shell 與 UI flow ownership，並允許目前 `currentView` 作為 implementation detail 暫時保留。
  - 缺點: 後續需建立 UI Flow / Architecture GDD 來描述正式流程邊界。

Recommendation:
採用 Option B。

正式規格如下：
- Architecture GDD / UI Flow GDD 必須定義 App shell 與 UI flow ownership。
- `currentView` 可作為目前 implementation detail 暫時保留。
- 正式規格不要求立即導入 React Router。
- 是否導入 React Router 屬後續技術決策，不是本 Decision 的必要結論。
- 每個主要流程必須明確定義由誰擁有：App shell、View、Context、Room state 或 local UI state。
- 投影模式、玩家模式、執行師模式與管理員模式需在 UI Flow GDD 中明確分層。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

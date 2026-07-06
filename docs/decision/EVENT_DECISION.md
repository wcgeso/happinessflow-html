# Metadata

Status: Confirmed

Owner: 汪家慶

Last Updated: 2026-07-01

# Purpose

把與 Event Queue、Follow-up、Shared Event、Local Flow、Completion 相關的 Gap，整理成需要產品負責人拍板的決策項目。

# Related Gaps

- GAP-002
- GAP-003
- GAP-010
- GAP-011
- GAP-014

# Decision Items

## DEC-001：Event 是否分成三層正式模型

Decision ID: DEC-001

Related Gap:
- GAP-002

Related RFC:
- `EVENT_SYSTEM_RFC.md`
- `ARCHITECTURE_RFC.md`

Related GDD:
- `EVENT_SYSTEM.md`
- `TURN_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: `EVENT_SYSTEM_RFC.md` 已把事件整理成 Shared Board Events、Shared Event-like States、Local Event Flows。
- Current GDD: `EVENT_SYSTEM.md` 已正式採用三層模型。
- Current Implementation: 事件推進仍散落在 `RoomContext`、`GameView`、Modal 與 local state。

Options:
- Option A
  - 優點: 保持目前混合式事件處理。
  - 缺點: 事件邊界不清楚。
- Option B
  - 優點: 與正式 GDD 一致，方便判定事件責任。
  - 缺點: 現有流程需要更清楚區隔。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-002：Follow-up Card 是否必須走正式 Queue

Decision ID: DEC-002

Related Gap:
- GAP-003

Related RFC:
- `CARD_SYSTEM_RFC.md`
- `EVENT_SYSTEM_RFC.md`
- `SCHOOL_SYSTEM_RFC.md`

Related GDD:
- `CARD_SYSTEM.md`
- `EVENT_SYSTEM.md`
- `TURN_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: Follow-up Card 在 RFC 中被視為正式事件，不應直接跳過生命週期。
- Current GDD: `CARD_SYSTEM.md` 與 `EVENT_SYSTEM.md` 已要求 Follow-up Card 必須走正式 Queue。
- Current Implementation: `drawPostExamHappinessCard()` 與 `drawBoardFollowupCard()` 會直接寫入新的 `currentEvent/currentCard`。

Options:
- Option A
  - 優點: 保持目前直接覆寫流程。
  - 缺點: 不符合正式 queue 生命週期。
- Option B
  - 優點: 與正式 GDD 一致。
  - 缺點: 需要完整 queue 化處理。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-003：School / Hospital / Repair 是否都屬正式事件鏈

Decision ID: DEC-003

Related Gap:
- GAP-010
- GAP-011
- GAP-014

Related RFC:
- `SCHOOL_SYSTEM_RFC.md`
- `HOSPITAL_SYSTEM_RFC.md`
- `REPAIR_SYSTEM_RFC.md`
- `TURN_SYSTEM_RFC.md`

Related GDD:
- `TURN_SYSTEM.md`
- `BOARD_SYSTEM.md`
- `EVENT_SYSTEM.md`
- `CARD_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 這三類事件都存在阻塞、後續卡、停回合等語意。
- Current GDD: `TURN_SYSTEM.md`、`BOARD_SYSTEM.md`、`EVENT_SYSTEM.md` 已把它們納入正式事件鏈。
- Current Implementation: 事件完成點仍分散在不同 UI 與 local flow 中。

Options:
- Option A
  - 優點: 各系統自行處理，維持現況。
  - 缺點: 完成點不一致。
- Option B
  - 優點: 納入正式事件鏈與完成門檻。
  - 缺點: 需要更完整的統一流程。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

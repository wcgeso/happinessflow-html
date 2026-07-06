# Metadata

Status: Confirmed

Owner: 汪家慶

Last Updated: 2026-07-01

# Purpose

把與回合完成、切換、skip turn、Board event blocking 相關的 Gap，整理成需要產品負責人拍板的決策項目。

# Related Gaps

- GAP-001
- GAP-010
- GAP-011

# Decision Items

## DEC-001：回合完成後才切換下一位

Decision ID: DEC-001

Related Gap:
- GAP-001

Related RFC:
- `TURN_SYSTEM_RFC.md`
- `BOARD_SYSTEM_RFC.md`
- `EVENT_SYSTEM_RFC.md`

Related GDD:
- `TURN_SYSTEM.md`
- `BOARD_SYSTEM.md`
- `EVENT_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: `TURN_SYSTEM_RFC.md` 已把「事件完成後才切換下一位」列為推薦方向。
- Current GDD: `TURN_SYSTEM.md` 已明確定義所有事件完成後才可切換下一位玩家。
- Current Implementation: `buildBoardMovementResolution()` 目前會先切換 `currentTurnUid`，事件之後才由原玩家端繼續處理。

Options:
- Option A
  - 優點: 保持目前節奏與實作。
  - 缺點: 回合與事件並行，容易造成多人同步混亂。
- Option B
  - 優點: 與正式 GDD 一致，回合邊界清楚。
  - 缺點: 需要所有事件完成後才切 turn。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-002：學校事件是否必須阻塞回合

Decision ID: DEC-002

Related Gap:
- GAP-010

Related RFC:
- `SCHOOL_SYSTEM_RFC.md`
- `TURN_SYSTEM_RFC.md`
- `BOARD_SYSTEM_RFC.md`
- `CARD_SYSTEM_RFC.md`

Related GDD:
- `TURN_SYSTEM.md`
- `BOARD_SYSTEM.md`
- `EVENT_SYSTEM.md`
- `CARD_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 學校事件與後續幸福卡在 RFC 中被視為需要完整完成的事件鏈。
- Current GDD: `TURN_SYSTEM.md` 與 `BOARD_SYSTEM.md` 已要求學校事件完成後才可切換下一位。
- Current Implementation: `GameView` 內用 `PromotionModal`、`DiceRollModal`、`drawPostExamHappinessCard()` 串接，完成點與 turn 切換未完全一致。

Options:
- Option A
  - 優點: 可保留現有 local flow。
  - 缺點: 事件完成點不清楚。
- Option B
  - 優點: 學校事件正式阻塞回合，與 GDD 一致。
  - 缺點: 節奏較慢。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-003：醫院與維修廠的 skip turn 與事件阻塞

Decision ID: DEC-003

Related Gap:
- GAP-011

Related RFC:
- `HOSPITAL_SYSTEM_RFC.md`
- `REPAIR_SYSTEM_RFC.md`
- `TURN_SYSTEM_RFC.md`
- `BOARD_SYSTEM_RFC.md`

Related GDD:
- `TURN_SYSTEM.md`
- `BOARD_SYSTEM.md`
- `EVENT_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 醫院與維修廠都涉及停回合與事件處理，但維修廠仍有較多待確認項。
- Current GDD: `TURN_SYSTEM.md` 與 `BOARD_SYSTEM.md` 已把醫院、維修廠定義為正式事件，並要求事件完成前阻塞回合切換。
- Current Implementation: 醫院有較完整流程；維修廠目前仍偏提示文字，事件化不完整。

Options:
- Option A
  - 優點: 保持醫院成熟、維修廠弱化的現況。
  - 缺點: 事件規則不一致。
- Option B
  - 優點: 兩者都視為正式阻塞事件。
  - 缺點: 需要更完整的事件處理。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

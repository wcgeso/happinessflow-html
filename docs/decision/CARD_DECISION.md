# Metadata

Status: Confirmed

Owner: 汪家慶

Last Updated: 2026-07-01

# Purpose

把與 Reveal、Resolve、Follow-up Card、Unsupported Card、Family Card 相關的 Gap，整理成需要產品負責人拍板的決策項目。

# Related Gaps

- GAP-003
- GAP-014
- GAP-016

# Decision Items

## DEC-001：卡片是否必須遵守 Draw -> Reveal -> Resolve -> Complete

Decision ID: DEC-001

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
- Current RFC: 卡片事件被要求要先揭露再正式生效。
- Current GDD: `CARD_SYSTEM.md` 已要求所有卡片效果都必須依照 `Draw -> Reveal -> Resolve -> Complete`。
- Current Implementation: 部分卡片流程會直接進入後續效果，沒有完整經過正式生命週期。

Options:
- Option A
  - 優點: 保持部分卡片可直接套用效果。
  - 缺點: 生命週期不一致。
- Option B
  - 優點: 所有卡片都遵守正式流程。
  - 缺點: 需要完整拆分 Reveal / Resolve。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-002：Family Milestone 是否屬正式多人卡片事件

Decision ID: DEC-002

Related Gap:
- GAP-014

Related RFC:
- `FAMILY_SYSTEM_RFC.md`
- `HAPPINESS_SYSTEM_RFC.md`
- `CARD_SYSTEM_RFC.md`

Related GDD:
- `CARD_SYSTEM.md`
- `EVENT_SYSTEM.md`
- `TURN_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: Family Milestone 需要多人共同參與與回覆。
- Current GDD: `CARD_SYSTEM.md` 與 `EVENT_SYSTEM.md` 都要求 Family Milestone 是正式多人事件。
- Current Implementation: 目前混合 `completedHappinessEvents`、`happiness.checked`、`familyMilestoneJoinPrompt` 與本地 pending action。

Options:
- Option A
  - 優點: 只由主玩家處理，流程簡單。
  - 缺點: 不符合多人事件定義。
- Option B
  - 優點: 符合正式多人事件定義。
  - 缺點: 需要等待所有符合資格玩家回覆。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-003：Unsupported Card 是否只能留在 Implementation Gap

Decision ID: DEC-003

Related Gap:
- GAP-003
- GAP-016

Related RFC:
- `CARD_SYSTEM_RFC.md`
- `BUSINESS_SYSTEM_RFC.md`

Related GDD:
- `CARD_SYSTEM.md`
- `EVENT_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: unsupported card / unsupported action 仍被拿來討論其實作。
- Current GDD: `CARD_SYSTEM.md` 已明確要求 unsupported card 不得列為正式規格。
- Current Implementation: 程式與 RFC 仍存在 unsupported card / unsupported action 流程。

Options:
- Option A
  - 優點: 保留 unsupported card 作為正式規格的一部分。
  - 缺點: 與正式 GDD 衝突。
- Option B
  - 優點: 只保留在 Implementation Gap。
  - 缺點: 目前實作需另行補齊。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

# Metadata

Status: Confirmed

Owner: 汪家慶

Last Updated: 2026-07-01

# Purpose

把與 Bank Event、Bank Service Window、Payday、銀行功能權限相關的 Gap，整理成需要產品負責人拍板的決策項目。

# Related Gaps

- GAP-004

# Decision Items

## DEC-001：Bank Event 與 Bank Service Window 是否分層

Decision ID: DEC-001

Related Gap:
- GAP-004

Related RFC:
- `BANK_SYSTEM_RFC.md`
- `TURN_SYSTEM_RFC.md`
- `ARCHITECTURE_RFC.md`

Related GDD:
- `BANK_SYSTEM.md`
- `TURN_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 銀行事件與銀行服務窗口已被討論為兩層不同規則。
- Current GDD: `BANK_SYSTEM.md` 已明確要求 Bank Event 與 Bank Service Window 分層。
- Current Implementation: `PaydayModal + follow-up + bankServiceWindowActive` 仍混合控制。

Options:
- Option A
  - 優點: 保持目前混合實作。
  - 缺點: 事件與權限邊界不清楚。
- Option B
  - 優點: 與正式 GDD 一致，便於討論權限。
  - 缺點: 需要接受兩層規則。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-002：銀行功能權限是否依正式窗口與常駐功能區分

Decision ID: DEC-002

Related Gap:
- GAP-004

Related RFC:
- `BANK_SYSTEM_RFC.md`
- `ASSET_SYSTEM_RFC.md`
- `LOAN_SYSTEM_RFC.md`
- `INSURANCE_SYSTEM_RFC.md`

Related GDD:
- `BANK_SYSTEM.md`
- `ASSET_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 股票、貸款、汽車、保險、定存的權限分類已被分開討論。
- Current GDD: `BANK_SYSTEM.md` 已明確區分常駐功能與需要 Bank Service Window 的功能。
- Current Implementation: 這些功能目前分散在不同 UI 與權限判定中。

Options:
- Option A
  - 優點: 保持目前各入口自行判定。
  - 缺點: 權限邊界容易不一致。
- Option B
  - 優點: 依正式權限表統一判定。
  - 缺點: 需要統一各入口的規則來源。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

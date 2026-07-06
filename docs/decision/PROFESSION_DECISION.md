# Metadata

Status: Confirmed

Owner: 汪家慶

Last Updated: 2026-07-02

# Purpose

把與職業、升等、薪資、Rank、Promotion 與 Profession Data 相關的 Gap，整理成需要產品負責人拍板的決策項目。

# Related Gaps

- GAP-012

# Decision Items

## DEC-001：Profession / Promotion 與 School / Lifelong Learning 的正式邊界

Decision ID: DEC-001

Related Gap:
- GAP-012

Related RFC:
- `PROFESSION_SYSTEM_RFC.md`
- `SCHOOL_SYSTEM_RFC.md`
- `TURN_SYSTEM_RFC.md`

Related GDD:
- `TURN_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: `PROFESSION_SYSTEM_RFC.md` 指出職業、升等、薪資、Rank、Promotion 與 Profession Data 仍有邊界不清。
- Current GDD: `TURN_SYSTEM.md` 與 `FINANCIAL_SYSTEM.md` 已定義職業、升等與相關流程，但 Profession System 尚未建立獨立 GDD。
- Current Implementation: `useDiceRollLogic` 使用同一組骰子 / Modal 流程處理 `normal`、`lifelong`、`enhance_profession`、`stock_ability`、`real_estate_ability` 等多種 `promotionType`；`profession.promotions` 同時承擔資料、條件文字與獎勵來源，因此 Profession、School 與 Lifelong Learning 共用 UI，但正式規則邊界尚未明確。

Options:
- Option A
  - 優點: 保持目前共用骰子與 Modal 流程。
  - 缺點: Profession、School、Lifelong Learning 的正式邊界仍不清楚。
- Option B
  - 優點: Profession、School、Lifelong Learning 各自擁有正式系統與規則，但可共用骰子 UI、Modal 與動畫。
  - 缺點: 後續需要建立完整 Profession System GDD。

Recommendation:
建議採 Option B。

Profession 應作為正式獨立系統。

Promotion 屬於 Profession System。

School Event 屬於 School System。

Lifelong Learning 屬於獨立流程。

三者可以共用骰子 UI、Modal 與動畫，但不得共用 Business Rule、Data Model、Event Flow 與 Completion Rule。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

# Metadata

| 項目 | 內容 |
|---|---|
| Status | Draft |
| Owner | 汪家慶 |
| Last Updated | 2026-07-02 |
| Related Specification | `docs/spec/PRODUCT_SPECIFICATION.md` |
| Related Decision | `docs/decision/DECISION_INDEX.md`、`docs/decision/STATE_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md`、`docs/decision/FINANCIAL_DECISION.md`、`docs/decision/ASSET_DECISION.md`、`docs/decision/BANK_DECISION.md` |
| Related GDD | `docs/gdd/GDD_INDEX.md`、`docs/gdd/TURN_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/FINANCIAL_SYSTEM.md`、`docs/gdd/ASSET_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md` |
| Version | v0.1 |

# Purpose

本文件定義《第二人生》的正式多人模型。

本文件只負責說明 Room、Player、Synchronization、Consistency、Authority、Ownership 與 Conflict Resolution 的正式邊界。

本文件不得重新定義產品規則。

所有多人相關正式規則皆以上游 Product Specification、已確認 Decision 與既有 GDD 為正式來源；本文件只承接上游規則，將其整理為多人模型的正式設計。

# Scope

## 本文件負責

- 定義 Room 的正式責任範圍
- 定義 Player 的正式責任範圍
- 定義同步副本、正式權威與一致性的正式邊界
- 定義多人資料的所有權與同步方向
- 定義衝突收束的正式處理方式
- 定義多人模型的正式狀態與狀態轉換

## 本文件不負責

- 重新定義回合順序或回合完成條件
- 重新定義任何上游正式系統內容
- 重新定義任何產品玩法或正式規則
- 描述任何具體實作技術、呈現細節、同步機制或程式碼

## 邊界原則

- Room 只負責共享正式狀態、共享同步副本與多人可見結果。
- Player 只負責玩家個人正式狀態與玩家專屬操作權。
- 正式權威必須先由上游文件定義，本文件只承認並整理其權威邊界。
- 同步副本不得反向成為正式權威。
- 若多人資料同時存在正式權威與同步副本，正式權威永遠優先。

# Related Documents

本章節用於整理本多人模型的正式上游與關聯文件。

## Product Specification

| 文件 | 用途 |
|---|---|
| `docs/spec/PRODUCT_SPECIFICATION.md` | 唯一正式產品規格來源 |

## Decision

| 文件 | 用途 |
|---|---|
| `docs/decision/DECISION_INDEX.md` | 已確認決策索引 |
| `docs/decision/STATE_DECISION.md` | 正式權威、同步副本與 legacy 邊界 |
| `docs/decision/ARCHITECTURE_DECISION.md` | 架構責任、正式來源與流程邊界 |
| `docs/decision/FINANCIAL_DECISION.md` | 負債、價格與里程碑的正式權威邊界 |
| `docs/decision/ASSET_DECISION.md` | 資產所有權、附掛與正式來源邊界 |
| `docs/decision/BANK_DECISION.md` | 銀行事件、服務窗口與常駐金融功能權限邊界 |

## Core GDD

| 文件 | 用途 |
|---|---|
| `docs/gdd/GDD_INDEX.md` | GDD 權威索引 |
| `docs/gdd/TURN_SYSTEM.md` | 回合正式完成與切換邊界 |
| `docs/gdd/EVENT_SYSTEM.md` | 正式事件生命週期與完成邊界 |
| `docs/gdd/FINANCIAL_SYSTEM.md` | 正式交易、現金、負債與結算邊界 |
| `docs/gdd/ASSET_SYSTEM.md` | 資產所有權與附掛邊界 |
| `docs/gdd/BANK_SYSTEM.md` | 銀行事件與金融權限邊界 |
| `docs/gdd/CARD_SYSTEM.md` | 卡片抽取、揭示、結算與完成邊界 |

## Domain GDD

| 文件 | 用途 |
|---|---|
| `docs/gdd/HAPPINESS_SYSTEM.md` | 幸福值、里程碑與最終評分承接 |
| `docs/gdd/FAMILY_SYSTEM.md` | 多人共同參與與回覆收束 |
| `docs/gdd/SCHOOL_SYSTEM.md` | 學校事件的多人與後續承接邊界 |
| `docs/gdd/HOSPITAL_SYSTEM.md` | 停回合結果的回合承接邊界 |
| `docs/gdd/REPAIR_SYSTEM.md` | 停回合與汽車持有的承接邊界 |
| `docs/gdd/MARKET_SYSTEM.md` | 市場價格的正式引用邊界 |
| `docs/gdd/LOAN_SYSTEM.md` | 負債與自動償還的正式邊界 |
| `docs/gdd/INSURANCE_SYSTEM.md` | 保險附掛與理賠結果的正式邊界 |
| `docs/gdd/REAL_ESTATE_SYSTEM.md` | 房屋所有權與市場標的的正式邊界 |
| `docs/gdd/BUSINESS_SYSTEM.md` | 企業所有權、現金流與市場標的的正式邊界 |
| `docs/gdd/PROFESSION_SYSTEM.md` | 職業與升等結果的正式承接邊界 |
| `docs/gdd/DREAM_SYSTEM.md` | 人生夢想里程碑的正式承接邊界 |

## Architecture

| 文件 | 用途 |
|---|---|
| `docs/architecture/ARCHITECTURE_INDEX.md` | Architecture Layer 索引 |
| `docs/architecture/ARCHITECTURE_TEMPLATE.md` | Architecture 文件模板 |
| `docs/architecture/ARCHITECTURE.md` | 整體架構總覽的正式上游文件 |
| `docs/architecture/STATE_MODEL.md` | 正式狀態分類與正式來源邊界的上游文件 |
| `docs/architecture/EVENT_MODEL.md` | 正式事件模型與等待條件的上游文件 |
| `docs/architecture/DATA_MODEL.md` | 正式資料權威與附掛關係的上游文件 |

# Architecture Principles

本章節定義本文件必須遵守的架構原則。

| 原則 | 說明 |
|---|---|
| Single Responsibility | 一份 Architecture 文件只負責一個主要架構主題 |
| High Cohesion | 同一份文件內的內容必須高度聚焦於同一模型層級 |
| Low Coupling | 各文件之間只保留必要依賴，不建立多餘橫向耦合 |
| Single Source of Truth | 正式權威、正式所有權與正式同步邊界只能有一份權威定義 |
| Layered Architecture | 文件層級必須服從 Product Specification → Decision → GDD → Architecture → Code |
| Modular Design | 每份文件都應可獨立維護、獨立引用、獨立審查 |
| DAG | 文件依賴必須形成有向無環圖 |
| Separation of Concerns | 不同文件只處理自己的架構責任，不跨層混寫 |

# Architecture Model

本章節描述本文件所管理的架構模型。

| 模型名稱 | 說明 | 邊界 | 上游來源 |
|---|---|---|---|
| Room Model | 管理共享正式狀態、共享同步副本與多人可見結果 | 只管理共享資料，不承擔玩家個人專屬權威 | `docs/spec/PRODUCT_SPECIFICATION.md`、`docs/decision/STATE_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md`、`docs/gdd/GDD_INDEX.md` |
| Player Model | 管理玩家個人正式狀態與玩家專屬操作權 | 只管理玩家專屬資料，不反向覆蓋共享正式狀態 | `docs/spec/PRODUCT_SPECIFICATION.md`、`docs/decision/STATE_DECISION.md`、`docs/decision/ASSET_DECISION.md`、`docs/decision/FINANCIAL_DECISION.md` |
| Synchronization Model | 管理正式權威向同步副本的單向同步 | 只承認正式權威向下同步，不承認副本回寫為權威 | `docs/decision/STATE_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md`、`docs/gdd/TURN_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md` |
| Consistency Model | 管理多人可見資料的一致狀態 | 只描述一致性要求，不重新定義玩法 | `docs/spec/PRODUCT_SPECIFICATION.md`、`docs/gdd/FINANCIAL_SYSTEM.md`、`docs/gdd/ASSET_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md` |
| Authority Model | 管理正式權威來源的優先順序 | 只承認上游已確認權威，不建立第二套正式來源 | `docs/spec/PRODUCT_SPECIFICATION.md`、`docs/decision/STATE_DECISION.md`、`docs/decision/FINANCIAL_DECISION.md`、`docs/decision/ASSET_DECISION.md` |
| Ownership Model | 管理資料與操作權的歸屬 | 只描述誰擁有正式操作權，不擴充玩法責任 | `docs/decision/ARCHITECTURE_DECISION.md`、`docs/gdd/TURN_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/FAMILY_SYSTEM.md` |

# Data Ownership

本章節描述本文件範圍內的資料權威、所有權與生命週期邊界。

| 資料項目 | 正式權威 | 所有權 | 生命週期 | 說明 |
|---|---|---|---|---|
| Room | 上游正式規則所定義的共享正式狀態 | 共享所有權 | 隨房間建立、同步、收束與結束而變動 | Room 是多人共享資料的正式容器 |
| Player | 上游正式規則所定義的玩家正式狀態 | 玩家個人所有權 | 隨玩家加入、進行、完成與結束而變動 | Player 是玩家專屬資料的正式容器 |
| Room 同步副本 | 對應的正式權威 | 共享可見，但不是正式所有權 | 由正式權威同步產生，並隨權威變動更新 | 同步副本只承接正式結果 |
| Player 同步副本 | 對應的正式權威 | 玩家專屬可見，但不是正式所有權 | 由正式權威同步產生，並隨權威變動更新 | 不得反向成為正式來源 |
| 共享正式結果 | 上游 GDD 所定義的正式結果 | 依結果所屬系統決定 | 隨上游正式流程完成而成立 | 只保存已確認正式結果 |
| 衝突後結果 | 正式權威或正式收束流程 | 依正式權威決定 | 隨衝突收束完成後成立 | 衝突只能收束到正式權威 |

# State Model

本文件管理正式多人狀態模型。

| 狀態名稱 | 用途 | 進入條件 | 離開條件 | 正式來源 |
|---|---|---|---|---|
| 正式同步中 | 表示正式權威正在向同步副本收斂 | 正式權威已變動，且同步副本尚未一致 | 同步副本完成更新後離開 | `docs/decision/STATE_DECISION.md`、`docs/gdd/GDD_INDEX.md` |
| 一致 | 表示 Room 與 Player 的正式權威與同步副本一致 | 所有同步副本都已反映最新正式權威 | 出現新的正式變動時離開 | `docs/spec/PRODUCT_SPECIFICATION.md`、`docs/gdd/TURN_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md` |
| 衝突收束中 | 表示偵測到副本與正式權威不一致，正在收束 | 同步副本與正式權威出現差異 | 依正式權威完成收束後離開 | `docs/decision/STATE_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md` |
| 封存 | 表示正式流程已結束，僅保留既有結果 | 遊戲正式結束 | 無 | `docs/spec/PRODUCT_SPECIFICATION.md`、`docs/gdd/HAPPINESS_SYSTEM.md` |

# Lifecycle

```text
開始
  ->
正式權威變動
  ->
正式同步中
  ->
同步副本完成更新
  ->
一致
  ->
若出現副本差異
  ->
衝突收束中
  ->
以正式權威收束
  ->
一致
  ->
若遊戲正式結束
  ->
封存
  ->
完成
```

# Dependency

## Upstream

| 文件 | 依賴原因 |
|---|---|
| `docs/architecture/ARCHITECTURE.md` | 提供整體架構分層、模組邊界與正式依賴方向 |
| `docs/architecture/STATE_MODEL.md` | 提供正式狀態、共享狀態與同步副本邊界 |
| `docs/architecture/EVENT_MODEL.md` | 提供共享事件、等待條件與事件完成邊界 |
| `docs/architecture/DATA_MODEL.md` | 提供正式資料權威、附掛關係與身份模型邊界 |
| `docs/spec/PRODUCT_SPECIFICATION.md` | 提供正式產品規格與多人規則的唯一來源 |
| `docs/decision/DECISION_INDEX.md` | 提供已確認決策索引 |
| `docs/decision/STATE_DECISION.md` | 提供正式權威與同步副本邊界 |
| `docs/decision/ARCHITECTURE_DECISION.md` | 提供架構責任與正式來源邊界 |
| `docs/decision/FINANCIAL_DECISION.md` | 提供財務與價格正式權威 |
| `docs/decision/ASSET_DECISION.md` | 提供資產所有權與附掛正式權威 |
| `docs/decision/BANK_DECISION.md` | 提供銀行事件與金融權限正式邊界 |
| `docs/gdd/GDD_INDEX.md` | 提供 Core 與 Domain GDD 的正式依賴順序 |
| `docs/gdd/TURN_SYSTEM.md` | 提供回合完成與切換邊界 |
| `docs/gdd/EVENT_SYSTEM.md` | 提供事件生命週期與完成邊界 |
| `docs/gdd/FINANCIAL_SYSTEM.md` | 提供交易成立與月結算邊界 |
| `docs/gdd/ASSET_SYSTEM.md` | 提供資產所有權與附掛邊界 |
| `docs/gdd/BANK_SYSTEM.md` | 提供銀行事件與服務窗口邊界 |
| `docs/gdd/CARD_SYSTEM.md` | 提供卡片事件與後續事件邊界 |
| `docs/gdd/HAPPINESS_SYSTEM.md` | 提供最終評分與封存邊界 |
| `docs/gdd/FAMILY_SYSTEM.md` | 提供共同參與與等待收束邊界 |

## Downstream

| 文件 | 被依賴原因 |
|---|---|
| 無 | 本文件作為多人模型整理文件，不向下游再拆分正式責任 |

## Related

| 文件 | 關聯原因 |
|---|---|
| `docs/architecture/ARCHITECTURE_INDEX.md` | 多人模型在 Architecture Layer 的索引位置 |
| `docs/architecture/ARCHITECTURE_TEMPLATE.md` | 多人模型的正式寫作格式參考 |

撰寫原則如下：

- Upstream 只能列出正式上游來源
- Downstream 只能列出正式承接本文件的下游文件
- Related 只能列出需要交叉引用但不構成正式依賴的文件
- 不得讓依賴方向形成循環

# Edge Cases

本章節整理 Architecture 層需要注意的特殊情況。

| 情境 | 風險 | 正式處理方式 |
|---|---|---|
| Room 的同步副本與正式權威同時存在 | 可能誤把副本當權威 | 以正式權威為唯一來源，副本只作同步結果 |
| Player 資料與 Room 資料出現不一致 | 可能產生多人可見差異 | 先收束到正式權威，再同步所有副本 |
| 同一筆多人資料同時被多個來源寫入 | 可能產生雙重正式來源 | 只承認上游正式權威，其餘寫入視為同步結果 |
| 上游正式流程仍未完成 | 可能提前改寫多人狀態 | 不得提前收束，必須等正式完成後才同步 |
| 任何需要多方回覆的正式流程仍有人未回覆 | 可能提早結束共享資料 | 以等待機制維持同步中，直到正式收束 |
| 舊同步副本與正式欄位衝突 | 可能產生多個來源 | 舊同步副本只保留相容用途，不得取代正式權威 |
| 遊戲正式結束後仍存在未收束副本 | 可能持續改寫結果 | 進入封存後只允許讀取既有結果，不再接受新同步 |

# References

## Product Specification

- `docs/spec/PRODUCT_SPECIFICATION.md`

## Decision

- `docs/decision/DECISION_INDEX.md`
- `docs/decision/STATE_DECISION.md`
- `docs/decision/ARCHITECTURE_DECISION.md`
- `docs/decision/FINANCIAL_DECISION.md`
- `docs/decision/ASSET_DECISION.md`
- `docs/decision/BANK_DECISION.md`

## Core GDD

- `docs/gdd/GDD_INDEX.md`
- `docs/gdd/TURN_SYSTEM.md`
- `docs/gdd/EVENT_SYSTEM.md`
- `docs/gdd/FINANCIAL_SYSTEM.md`
- `docs/gdd/ASSET_SYSTEM.md`
- `docs/gdd/BANK_SYSTEM.md`
- `docs/gdd/CARD_SYSTEM.md`

## Domain GDD

- `docs/gdd/HAPPINESS_SYSTEM.md`
- `docs/gdd/FAMILY_SYSTEM.md`
- `docs/gdd/SCHOOL_SYSTEM.md`
- `docs/gdd/HOSPITAL_SYSTEM.md`
- `docs/gdd/REPAIR_SYSTEM.md`
- `docs/gdd/MARKET_SYSTEM.md`
- `docs/gdd/LOAN_SYSTEM.md`
- `docs/gdd/INSURANCE_SYSTEM.md`
- `docs/gdd/REAL_ESTATE_SYSTEM.md`
- `docs/gdd/BUSINESS_SYSTEM.md`
- `docs/gdd/PROFESSION_SYSTEM.md`
- `docs/gdd/DREAM_SYSTEM.md`

## Architecture Index

- `docs/architecture/ARCHITECTURE_INDEX.md`

# Writing Rules

Architecture 文件必須遵守以下規定：

1. 不得重新定義 Product Specification。
2. 不得重新定義任何已確認決策。
3. 不得重新定義任何 Core GDD。
4. 不得重新定義任何 Domain GDD。
5. 不得新增產品玩法。
6. 不得新增產品規則。
7. 只能描述：
   - 架構
   - 模型
   - 資料
   - 同步
   - 責任
   - 依賴
8. 不得描述具體實作技術、介面細節、同步機制、儲存方式或程式細節。
9. 不得讓同步副本反向成為正式權威。
10. 不得讓共享可見性取代個人正式所有權。

# Modular Design Rules

- 本文件只負責多人模型，不承擔事件模型或資料模型的全部責任。
- Room、Player、正式權威、同步副本與衝突收束必須清楚分層。
- 多人一致性只能承接上游正式來源，不得自行建立第二份正式規則。
- 衝突收束只能回到正式權威，不得在副本層解釋成新的正式結果。
- 多人模型依賴方向必須維持 DAG，不得形成循環依賴。

# Architecture Checklist

- [x] 是否引用 `docs/spec/PRODUCT_SPECIFICATION.md`
- [x] 是否承接 Confirmed Decision
- [x] 是否承接 Core GDD
- [x] 是否承接 Domain GDD
- [x] 是否引用 `docs/architecture/ARCHITECTURE_INDEX.md`
- [x] 是否沒有重新定義產品規則
- [x] 是否沒有重新定義任何 GDD
- [x] 是否沒有新增產品玩法
- [x] 是否只描述架構、模型、資料、同步、責任與依賴
- [x] 是否沒有描述實作細節
- [x] 是否符合 Single Responsibility
- [x] 是否符合 High Cohesion
- [x] 是否符合 Low Coupling
- [x] 是否符合 Single Source of Truth
- [x] 是否符合 DAG
- [x] 是否沒有循環依賴

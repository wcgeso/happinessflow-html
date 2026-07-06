# Metadata

| 項目 | 內容 |
|---|---|
| Status | Draft |
| Owner | 汪家慶 |
| Last Updated | 2026-07-02 |
| Related Specification | `docs/spec/PRODUCT_SPECIFICATION.md` |
| Related Decision | `docs/decision/DECISION_INDEX.md`、`docs/decision/STATE_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md` |
| Related GDD | `docs/gdd/GDD_INDEX.md`、所有 Core GDD、所有 Domain GDD |
| Version | v0.1 |

# Purpose

本文件是正式狀態模型的唯一架構文件。

本文件只負責把上游已確認的正式來源，整理成 `State`、`Source of Truth`、`State Ownership`、`State Lifecycle`、`Shared State`、`Local State`、`Derived State` 與 `State Synchronization` 的正式邊界。

本文件不負責重新定義產品規則，也不負責重新定義任何 Core GDD 或 Domain GDD。

# Scope

## 本文件負責

- 定義正式狀態模型的分類方式
- 定義正式狀態的所有權邊界
- 定義正式狀態的生命周期邊界
- 定義共享狀態、同步副本、本機狀態與衍生狀態的邊界
- 定義狀態同步的正式方向

## 本文件不負責

- 重新定義產品玩法
- 重新定義產品規則
- 重新定義 Core GDD
- 重新定義 Domain GDD
- 描述具體實作技術、介面細節、同步機制或程式碼

## 邊界原則

- 正式狀態只能有一個正式來源。
- 共享狀態只能作為同步後的共同可見狀態，不得反向成為正式來源。
- 本機狀態只能承擔單一操作脈絡內的暫存責任，不得承擔正式判定責任。
- 衍生狀態只能由正式來源計算，不得獨立成為正式來源。
- 狀態同步只能由正式來源單向推送到其他狀態層，不得由副本反推正式來源。
- 同一狀態在不同層級的存在，必須以正式來源與同步邊界為準。

# Related Documents

## Product Specification

| 文件 | 用途 |
|---|---|
| `docs/spec/PRODUCT_SPECIFICATION.md` | 唯一正式產品規格來源 |

## Decision

| 文件 | 用途 |
|---|---|
| `docs/decision/DECISION_INDEX.md` | 已確認決策索引 |
| `docs/decision/TURN_DECISION.md` | 回合完成、切換與阻塞的正式決策 |
| `docs/decision/EVENT_DECISION.md` | 正式事件鏈、共享事件與完成邊界的正式決策 |
| `docs/decision/CARD_DECISION.md` | 卡片生命週期與多人卡片事件的正式決策 |
| `docs/decision/BANK_DECISION.md` | 銀行事件與銀行服務窗口的正式決策 |
| `docs/decision/FINANCIAL_DECISION.md` | 正式交易成立、負債權威與價格權威的正式決策 |
| `docs/decision/ASSET_DECISION.md` | 資產所有權、附掛關係與房屋市場的正式決策 |
| `docs/decision/STATE_DECISION.md` | Source of Truth、同步副本與 legacy 邊界的正式決策 |
| `docs/decision/ARCHITECTURE_DECISION.md` | 架構責任、正式來源與流程邊界的正式決策 |
| `docs/decision/PROFESSION_DECISION.md` | 職業、升等與共用流程邊界的正式決策 |

## Core GDD

| 文件 | 用途 |
|---|---|
| `docs/gdd/TURN_SYSTEM.md` | 回合正式完成與阻塞邊界的正式來源 |
| `docs/gdd/EVENT_SYSTEM.md` | 事件生命週期、事件所有權與完成邊界的正式來源 |
| `docs/gdd/CARD_SYSTEM.md` | 卡片生命週期、卡片所有權與後續事件邊界的正式來源 |
| `docs/gdd/BANK_SYSTEM.md` | 銀行事件、服務窗口與金融功能邊界的正式來源 |
| `docs/gdd/FINANCIAL_SYSTEM.md` | 正式交易、財務檢核、負債與結算邊界的正式來源 |
| `docs/gdd/BOARD_SYSTEM.md` | 棋盤事件入口、經過與停留狀態的正式來源 |
| `docs/gdd/ASSET_SYSTEM.md` | 資產所有權、附掛狀態與估值邊界的正式來源 |

## Domain GDD

| 文件 | 用途 |
|---|---|
| `docs/gdd/INSURANCE_SYSTEM.md` | 保險狀態、附掛與完成邊界的正式來源 |
| `docs/gdd/LOAN_SYSTEM.md` | 貸款狀態、附掛與清償邊界的正式來源 |
| `docs/gdd/MARKET_SYSTEM.md` | 行情狀態與同步邊界的正式來源 |
| `docs/gdd/SCHOOL_SYSTEM.md` | 學校事件狀態與承接邊界的正式來源 |
| `docs/gdd/HOSPITAL_SYSTEM.md` | 醫院事件狀態與停回合邊界的正式來源 |
| `docs/gdd/REPAIR_SYSTEM.md` | 維修廠事件狀態與停回合邊界的正式來源 |
| `docs/gdd/PROFESSION_SYSTEM.md` | 職業狀態、升等與薪資狀態的正式來源 |
| `docs/gdd/DREAM_SYSTEM.md` | 人生夢想狀態與里程碑邊界的正式來源 |
| `docs/gdd/HAPPINESS_SYSTEM.md` | 幸福值狀態與評分邊界的正式來源 |
| `docs/gdd/FAMILY_SYSTEM.md` | 共同參與狀態、等待與完成邊界的正式來源 |
| `docs/gdd/REAL_ESTATE_SYSTEM.md` | 房屋狀態、所有權與附掛邊界的正式來源 |
| `docs/gdd/BUSINESS_SYSTEM.md` | 企業狀態、所有權與現金流邊界的正式來源 |

## Architecture

| 文件 | 用途 |
|---|---|
| `docs/architecture/ARCHITECTURE_INDEX.md` | Architecture 層索引與文件邊界來源 |
| `docs/architecture/ARCHITECTURE.md` | 整體架構總覽的正式上游文件 |

# Architecture Principles

| 原則 | 說明 |
|---|---|
| Single Responsibility | 本文件只負責正式狀態模型，不跨入產品規則或實作細節 |
| High Cohesion | 同一份文件內的內容只聚焦於狀態、所有權、生命周期與同步邊界 |
| Low Coupling | 本文件只承接上游已確認來源，不向下游輸出多餘責任 |
| Single Source of Truth | 正式狀態只能有一個權威來源，其他狀態只能是同步結果 |
| Layered Architecture | 狀態模型位於 GDD 之上、實作之下，不能反向定義上游規則 |
| Modular Design | 各狀態類型可被分工，但不得混寫成單一無邊界的狀態集合 |
| DAG | 狀態依賴必須維持有向無環圖，不得形成循環權威 |
| Separation of Concerns | 正式來源、共享狀態、本機狀態與衍生狀態各自承擔不同責任 |

# Architecture Model

| 模型名稱 | 說明 | 邊界 | 上游來源 |
|---|---|---|---|
| 正式狀態模型 | 定義正式狀態、共享狀態、本機狀態、衍生狀態與同步副本的正式邊界 | 正式來源只負責定義狀態；共享狀態只負責共同可見；本機狀態只負責單一脈絡；衍生狀態只負責計算結果 | `docs/spec/PRODUCT_SPECIFICATION.md`、所有 Confirmed Decision、所有 Core GDD、所有 Domain GDD |

# Data Ownership

| 資料項目 | 正式權威 | 所有權 | 生命週期 | 說明 |
|---|---|---|---|---|
| 正式狀態 | 唯一正式來源 | 由對應正式系統持有 | 從建立到收束，再到結束 | 作為 `Source of Truth`，只能由上游正式來源定義 |
| 共享狀態 | 正式狀態同步後的共同可見結果 | 共享於對應正式脈絡 | 隨正式來源同步、更新與收束 | 作為 `Shared State`，只能承接正式來源，不可反向定義正式來源 |
| 本機狀態 | 單一操作脈絡內的暫存狀態 | 由當前操作脈絡持有 | 隨互動開始、變動與關閉而存在 | 作為 `Local State`，只服務單一脈絡，不承擔正式判定 |
| 衍生狀態 | 由正式狀態計算而得 | 無獨立所有權 | 隨來源更新而重新計算 | 作為 `Derived State`，不可獨立成為正式來源 |
| 同步副本 | 正式狀態的同步結果 | 由正式來源單向提供 | 隨來源同步、失效與重建 | 作為 `State Synchronization` 的結果，不得反向成為正式來源 |

# State Model

| 狀態名稱 | 用途 | 進入條件 | 離開條件 | 正式來源 |
|---|---|---|---|---|
| 正式狀態 | 表示某項資料在正式規則下的唯一權威 | 上游正式來源已確認且可作為權威 | 被正式收束、替換或終止 | `docs/spec/PRODUCT_SPECIFICATION.md`、Confirmed Decision、對應 Core / Domain GDD |
| 共享狀態 | 表示多方共同可見的同步狀態 | 正式狀態已同步到共享脈絡 | 正式來源更新或共享脈絡收束 | 正式狀態與對應同步規則 |
| 本機狀態 | 表示單一操作脈絡內的暫存狀態 | 互動或流程開始 | 互動結束或脈絡關閉 | 當前操作脈絡下的正式狀態或共享狀態 |
| 衍生狀態 | 表示由正式資料計算出的結果 | 來源狀態可被計算 | 來源狀態變更或衍生結果失效 | 正式狀態或共享狀態 |
| 同步副本 | 表示由正式來源同步而來的副本狀態 | 正式來源需要跨脈絡可見 | 正式來源更新、重建或收束 | 正式來源與同步規則 |

# Lifecycle

```text
正式來源建立
  ->
成為唯一正式狀態
  ->
同步為共享狀態與同步副本
  ->
必要時產生本機狀態與衍生狀態
  ->
正式來源更新或收束
  ->
同步狀態更新或失效
  ->
完成
```

- `Source of Truth` 的生命周期最長，其他狀態都必須跟隨它的正式邊界。
- `Shared State` 只在正式來源存在且需要共同可見時維持。
- `Local State` 只在單一互動脈絡內存在，脈絡結束即收束。
- `Derived State` 只要來源變動，就必須重新計算或失效。
- `State Synchronization` 只負責把正式來源的結果傳遞出去，不負責改寫來源本身。

# Dependency

## Upstream

| 文件 | 依賴原因 |
|---|---|
| `docs/architecture/ARCHITECTURE.md` | 提供整體系統分層、權威順序與模組邊界的正式上游架構來源 |
| `docs/spec/PRODUCT_SPECIFICATION.md` | 提供所有正式規則的唯一產品來源 |
| `docs/decision/DECISION_INDEX.md` | 提供已確認決策的總索引 |
| `docs/decision/TURN_DECISION.md` | 提供回合狀態與阻塞邊界的正式決策 |
| `docs/decision/EVENT_DECISION.md` | 提供事件狀態與共享事件邊界的正式決策 |
| `docs/decision/CARD_DECISION.md` | 提供卡片狀態與多人卡片邊界的正式決策 |
| `docs/decision/BANK_DECISION.md` | 提供銀行狀態與服務窗口邊界的正式決策 |
| `docs/decision/FINANCIAL_DECISION.md` | 提供正式來源、負債與價格權威的正式決策 |
| `docs/decision/ASSET_DECISION.md` | 提供資產所有權與附掛邊界的正式決策 |
| `docs/decision/STATE_DECISION.md` | 提供 Source of Truth、同步副本與 legacy 邊界的正式決策 |
| `docs/decision/ARCHITECTURE_DECISION.md` | 提供架構責任、正式來源與流程邊界的正式決策 |
| `docs/decision/PROFESSION_DECISION.md` | 提供共用流程下的正式邊界決策 |
| `docs/gdd/GDD_INDEX.md` | 提供 Core GDD、Domain GDD 與 Architecture GDD 的正式索引 |
| 所有 Core GDD | 提供各核心系統的正式狀態與同步邊界 |
| 所有 Domain GDD | 提供各子系統的正式狀態與同步邊界 |

## Downstream

| 文件 | 被依賴原因 |
|---|---|
| `EVENT_MODEL.md` | 事件模型需要先知道正式狀態、共享狀態與同步副本邊界 |
| `DATA_MODEL.md` | 資料模型需要先知道狀態所有權與正式來源邊界 |
| `MULTIPLAYER_MODEL.md` | 多人模型需要先知道共享狀態、同步邊界與本機狀態邊界 |

## Related

| 文件 | 關聯原因 |
|---|---|
| `docs/architecture/ARCHITECTURE_INDEX.md` | 同屬 Architecture 層，提供文件整體邊界與閱讀順序 |

# Edge Cases

| 情境 | 風險 | 正式處理方式 |
|---|---|---|
| 正式來源與共享狀態不一致 | 共享狀態可能被誤認為正式來源 | 一律以正式來源為準，並由正式來源重新同步共享狀態 |
| 正式來源與本機狀態不一致 | 本機脈絡可能承擔不應有的判定責任 | 本機狀態只能跟隨正式來源，不能反向改寫正式來源 |
| 衍生狀態與正式來源不一致 | 計算結果可能過時 | 以正式來源重新計算，衍生狀態不得獨立保留為權威 |
| 同步副本先於正式來源被使用 | 副本可能反向成為權威 | 同步副本只能作為讀取結果，必須等待正式來源確認 |
| 來源切換尚未完成 | 新舊來源可能同時被視為權威 | 只有在正式來源完成收束後，新的正式來源才能開始同步 |
| 多個脈絡同時持有本機狀態 | 本機狀態可能被誤用為共享狀態 | 本機狀態不得跨脈絡流通，離開脈絡即收束 |

# References

## Product Specification

- `docs/spec/PRODUCT_SPECIFICATION.md`

## Decision

- `docs/decision/DECISION_INDEX.md`
- `docs/decision/TURN_DECISION.md`
- `docs/decision/EVENT_DECISION.md`
- `docs/decision/CARD_DECISION.md`
- `docs/decision/BANK_DECISION.md`
- `docs/decision/FINANCIAL_DECISION.md`
- `docs/decision/ASSET_DECISION.md`
- `docs/decision/STATE_DECISION.md`
- `docs/decision/ARCHITECTURE_DECISION.md`
- `docs/decision/PROFESSION_DECISION.md`

## Core GDD

- `docs/gdd/GDD_INDEX.md`
- `docs/gdd/TURN_SYSTEM.md`
- `docs/gdd/EVENT_SYSTEM.md`
- `docs/gdd/CARD_SYSTEM.md`
- `docs/gdd/BANK_SYSTEM.md`
- `docs/gdd/FINANCIAL_SYSTEM.md`
- `docs/gdd/BOARD_SYSTEM.md`
- `docs/gdd/ASSET_SYSTEM.md`

## Domain GDD

- `docs/gdd/INSURANCE_SYSTEM.md`
- `docs/gdd/LOAN_SYSTEM.md`
- `docs/gdd/MARKET_SYSTEM.md`
- `docs/gdd/SCHOOL_SYSTEM.md`
- `docs/gdd/HOSPITAL_SYSTEM.md`
- `docs/gdd/REPAIR_SYSTEM.md`
- `docs/gdd/PROFESSION_SYSTEM.md`
- `docs/gdd/DREAM_SYSTEM.md`
- `docs/gdd/HAPPINESS_SYSTEM.md`
- `docs/gdd/FAMILY_SYSTEM.md`
- `docs/gdd/REAL_ESTATE_SYSTEM.md`
- `docs/gdd/BUSINESS_SYSTEM.md`

## Architecture Index

- `docs/architecture/ARCHITECTURE_INDEX.md`

# Writing Rules

1. 不得重新定義 `Product Specification`。
2. 不得重新定義任何已確認決策。
3. 不得重新定義任何 Core GDD。
4. 不得重新定義任何 Domain GDD。
5. 只能描述：
   - `State`
   - `Source of Truth`
   - `State Ownership`
   - `State Lifecycle`
   - `Shared State`
   - `Local State`
   - `Derived State`
   - `State Synchronization`
6. 不得描述具體實作技術、介面細節、同步機制、儲存方式或程式碼。
7. 不得把共享狀態、本機狀態或衍生狀態寫成正式權威。
8. 不得讓副本、暫存或衍生結果反向成為正式來源。

# Modular Design Rules

- 本文件只負責正式狀態模型，不承擔事件、資料或多人同步的細部責任。
- 正式來源、共享狀態、本機狀態與衍生狀態必須保持清楚分層。
- 狀態同步只能沿著正式來源向下游傳遞，不得形成循環依賴。
- 下游文件若需要引用正式狀態邊界，必須以本文件為正式來源。
- 任何需要跨文件共用的狀態責任，都必須先回到正式來源與同步邊界定義。

# Architecture Checklist

- [x] 是否引用 `docs/spec/PRODUCT_SPECIFICATION.md`
- [x] 是否承接 Confirmed Decision
- [x] 是否承接 Core GDD
- [x] 是否承接 Domain GDD
- [x] 是否引用 `docs/architecture/ARCHITECTURE_INDEX.md`
- [x] 是否沒有重新定義產品規則
- [x] 是否沒有重新定義任何 GDD
- [x] 是否沒有新增產品玩法
- [x] 是否只描述架構、模型、狀態、資料、同步、責任與依賴
- [x] 是否沒有描述實作細節
- [x] 是否符合 Single Responsibility
- [x] 是否符合 High Cohesion
- [x] 是否符合 Low Coupling
- [x] 是否符合 Single Source of Truth
- [x] 是否符合 DAG
- [x] 是否沒有循環依賴

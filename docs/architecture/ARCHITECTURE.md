# Metadata

| 項目 | 內容 |
|---|---|
| Status | Draft |
| Owner | 汪家慶 |
| Last Updated | 2026-07-02 |
| Related Specification | `docs/spec/PRODUCT_SPECIFICATION.md` |
| Related Decision | `docs/decision/DECISION_INDEX.md`、`docs/decision/TURN_DECISION.md`、`docs/decision/EVENT_DECISION.md`、`docs/decision/CARD_DECISION.md`、`docs/decision/BANK_DECISION.md`、`docs/decision/FINANCIAL_DECISION.md`、`docs/decision/ASSET_DECISION.md`、`docs/decision/STATE_DECISION.md`、`docs/decision/PROFESSION_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md` |
| Related GDD | `docs/gdd/GDD_INDEX.md`、所有 Core GDD、所有 Domain GDD |
| Version | v1.0 |

# Purpose

本文件是《第二人生》Architecture Layer 的總覽文件。

本文件只負責整理正式文件體系中的系統分層、模組邊界、依賴方向、權威順序與系統責任。

本文件不負責重新定義產品規則，不負責重新定義任何 Core GDD 或 Domain GDD 的正式責任，也不負責描述任何實作細節。

# Scope

## 本文件負責

- 定義 Architecture Layer 在正式文件體系中的位置
- 定義 Architecture Layer 的權威順序
- 定義各正式系統模組的責任邊界
- 定義模組之間的正式依賴方向
- 定義整體系統分層與 DAG 原則

## 本文件不負責

- 重新定義 Product Specification
- 重新定義任何 Confirmed Decision
- 重新定義任何 Core GDD
- 重新定義任何 Domain GDD
- 重新定義任何遊戲玩法、規則或數值
- 描述任何具體實作技術、介面細節、同步機制或程式碼

## 邊界原則

- Product Specification 是正式產品規則的唯一來源
- Decision 是正式拍板結果的唯一來源
- Core GDD 是核心系統責任的正式來源
- Domain GDD 是各子系統責任的正式來源
- Architecture Layer 只整理責任邊界與依賴方向，不取代上游規則

# Related Documents

## Product Specification

| 文件 | 用途 |
|---|---|
| `docs/spec/PRODUCT_SPECIFICATION.md` | 唯一正式產品規格來源 |

## Decision

| 文件 | 用途 |
|---|---|
| `docs/decision/DECISION_INDEX.md` | 已確認決策索引 |
| `docs/decision/TURN_DECISION.md` | 回合完成、切換與阻塞的正式決策來源 |
| `docs/decision/EVENT_DECISION.md` | 事件層級、後續事件與共同參與的正式決策來源 |
| `docs/decision/CARD_DECISION.md` | 卡片生命週期、家庭歷程與未支援卡邊界的正式決策來源 |
| `docs/decision/BANK_DECISION.md` | 銀行事件與銀行服務窗口分層的正式決策來源 |
| `docs/decision/FINANCIAL_DECISION.md` | 財務檢核、負債權威、價格權威與里程碑邊界的正式決策來源 |
| `docs/decision/ASSET_DECISION.md` | 資產 ownership、附掛模型與房屋市場結構的正式決策來源 |
| `docs/decision/STATE_DECISION.md` | 正式權威、同步副本與 legacy 邊界的正式決策來源 |
| `docs/decision/PROFESSION_DECISION.md` | 職業、升等與終身學習邊界的正式決策來源 |
| `docs/decision/ARCHITECTURE_DECISION.md` | 架構責任邊界、正式來源與流程邊界的正式決策來源 |

## Core GDD

| 文件 | 用途 |
|---|---|
| `docs/gdd/GDD_INDEX.md` | GDD 權威索引與依賴總覽 |
| `docs/gdd/TURN_SYSTEM.md` | 回合生命週期、操作權、完成與阻塞的正式設計 |
| `docs/gdd/EVENT_SYSTEM.md` | 事件層級、事件佇列、完成與阻塞的正式設計 |
| `docs/gdd/CARD_SYSTEM.md` | 卡片抽牌、揭示、結算、後續卡與家庭卡的正式設計 |
| `docs/gdd/BANK_SYSTEM.md` | 銀行事件、銀行服務窗口與金融服務權限的正式設計 |
| `docs/gdd/FINANCIAL_SYSTEM.md` | 現金、收入、支出、交易、結算與負債的正式設計 |
| `docs/gdd/BOARD_SYSTEM.md` | 棋盤結構、移動、經過、停留與棋盤事件入口的正式設計 |
| `docs/gdd/ASSET_SYSTEM.md` | 資產 ownership、附掛狀態與正式資產邊界的正式設計 |

## Domain GDD

| 文件 | 用途 |
|---|---|
| `docs/gdd/INSURANCE_SYSTEM.md` | 保險類型、保費、理賠與附掛關係的正式設計 |
| `docs/gdd/LOAN_SYSTEM.md` | 貸款類型、附掛貸款、強制負債與還款規則的正式設計 |
| `docs/gdd/MARKET_SYSTEM.md` | 市場行情、股利、房市與企業市場的正式設計 |
| `docs/gdd/SCHOOL_SYSTEM.md` | 學校事件、考試、考後幸福卡與職業承接的正式設計 |
| `docs/gdd/HOSPITAL_SYSTEM.md` | 醫院事件、醫療費與停回合的正式設計 |
| `docs/gdd/REPAIR_SYSTEM.md` | 維修廠事件、保養費、汽車判定與停回合的正式設計 |
| `docs/gdd/PROFESSION_SYSTEM.md` | 職業、職級、升等、薪資與終身學習的正式設計 |
| `docs/gdd/DREAM_SYSTEM.md` | 人生夢想、完成條件與里程碑的正式設計 |
| `docs/gdd/HAPPINESS_SYSTEM.md` | 幸福值、幸福里程碑、最終評分與排名的正式設計 |
| `docs/gdd/FAMILY_SYSTEM.md` | 家庭歷程、共同參與、等待與收束的正式設計 |
| `docs/gdd/REAL_ESTATE_SYSTEM.md` | 房屋、自住、出租、房貸、房屋保險與房市的正式設計 |
| `docs/gdd/BUSINESS_SYSTEM.md` | 企業、收購、升級、現金流、企業貸款與企業市場的正式設計 |

## Architecture

| 文件 | 用途 |
|---|---|
| `docs/architecture/ARCHITECTURE_INDEX.md` | Architecture Layer 索引與依賴總覽 |

# Architecture Principles

本章節定義本文件必須遵守的架構原則。

| 原則 | 說明 |
|---|---|
| Single Responsibility | 一份 Architecture 文件只負責一個主要架構主題 |
| High Cohesion | 同一份文件內的內容必須高度聚焦於同一層級的架構責任 |
| Low Coupling | 各文件之間只保留必要依賴，不建立多餘橫向耦合 |
| Single Source of Truth | 正式規則、正式責任與正式邊界只能有一份權威來源 |
| Layered Architecture | 文件層級必須服從 Product Specification -> Decision -> GDD -> Architecture -> Code |
| Modular Design | 每份文件都應可獨立維護、獨立引用、獨立審查 |
| DAG | 文件依賴必須形成有向無環圖 |
| Separation of Concerns | 不同文件只處理自己的正式責任，不跨層混寫 |

# Architecture Model

本章節描述本文件管理的架構模型。

| 模型名稱 | 說明 | 邊界 | 上游來源 |
|---|---|---|---|
| 整體系統分層模型 | 定義 Product Specification、Decision、Core GDD、Domain GDD、Architecture 與 Code 的正式順序 | 只描述正式文件層級，不重新定義任何玩法或系統規則 | `docs/spec/PRODUCT_SPECIFICATION.md`、`docs/decision/DECISION_INDEX.md`、所有 Confirmed Decision、`docs/gdd/GDD_INDEX.md`、所有 Core GDD、所有 Domain GDD |
| 模組責任邊界模型 | 定義各 Core GDD 與 Domain GDD 的單一職責與承接範圍 | 只描述責任歸屬，不複寫各系統的細部規則 | `docs/gdd/GDD_INDEX.md`、所有 Core GDD、所有 Domain GDD |
| 依賴方向模型 | 定義上游權威文件如何向下游責任文件提供依據 | 只允許由上游承接到下游，不允許下游反向改寫上游 | `docs/decision/DECISION_INDEX.md`、`docs/gdd/GDD_INDEX.md`、`docs/architecture/ARCHITECTURE_INDEX.md` |
| 權威順序模型 | 定義正式來源的優先順序與不可覆蓋規則 | 只描述權威層級，不建立新的規則來源 | `docs/spec/PRODUCT_SPECIFICATION.md`、`docs/decision/DECISION_INDEX.md`、`docs/gdd/GDD_INDEX.md`、`docs/architecture/ARCHITECTURE_INDEX.md` |

撰寫原則如下：

- 必須說明本文件管理的是哪一種架構模型
- 必須說明此模型與其他模型的邊界
- 必須指出模型的正式上游來源
- 不得把產品規則重新寫成架構規則

# Data Ownership

本章節描述本文件範圍內的正式權威、所有權與生命週期邊界。

| 資料項目 | 正式權威 | 所有權 | 生命週期 | 說明 |
|---|---|---|---|---|
| 正式產品規格 | `docs/spec/PRODUCT_SPECIFICATION.md` | Product Specification | 建立 -> 維護 -> 修訂 -> 作為正式來源 | 提供唯一正式產品規則來源 |
| 已確認決策 | `docs/decision/` 下所有 Confirmed Decision | Decision 文件本身 | 建立 -> 確認 -> 固化 -> 被 GDD 承接 | 提供正式拍板結果，不回寫產品規格 |
| 核心系統責任 | `docs/gdd/` 下所有 Core GDD | 對應 Core GDD | 建立 -> 承接 -> 穩定 -> 被下游引用 | 定義核心系統如何分工與協作 |
| 領域系統責任 | `docs/gdd/` 下所有 Domain GDD | 對應 Domain GDD | 建立 -> 承接 -> 穩定 -> 被下游引用 | 定義各子系統的正式邊界 |
| 架構總覽責任 | `docs/architecture/ARCHITECTURE.md` | 本文件 | 建立 -> 收斂 -> 維護 -> 被下游 Architecture 文件引用 | 只整理整體分層、邊界與依賴，不承擔玩法定義 |

撰寫原則如下：

- 必須指出每一類正式責任的正式權威來源
- 必須指出責任由哪一層文件定義
- 必須指出正式責任的承接方向
- 不得以本文件覆蓋上游已定義的正式來源

# State Model

本文件不管理正式遊戲狀態模型。

正式狀態模型由對應的 Core GDD 與 Domain GDD 承接，例如回合、事件、卡片、銀行、財務、棋盤、資產與各子系統的正式狀態。

# Lifecycle

本文件不管理正式玩法生命周期。

本文件只整理 Architecture Layer 的文件承接順序，因此其實際關注點是正式文件由上游收斂到下游的依賴順序。

# Dependency

本章節用於列出本文件的依賴方向。

## Upstream

| 文件 | 依賴原因 |
|---|---|
| `docs/spec/PRODUCT_SPECIFICATION.md` | 提供唯一正式產品規格來源 |
| `docs/decision/DECISION_INDEX.md` | 提供已確認決策的索引入口 |
| `docs/decision/TURN_DECISION.md` | 提供回合責任邊界的正式決策來源 |
| `docs/decision/EVENT_DECISION.md` | 提供事件責任邊界的正式決策來源 |
| `docs/decision/CARD_DECISION.md` | 提供卡片與家庭歷程邊界的正式決策來源 |
| `docs/decision/BANK_DECISION.md` | 提供銀行責任邊界的正式決策來源 |
| `docs/decision/FINANCIAL_DECISION.md` | 提供財務、里程碑與權威邊界的正式決策來源 |
| `docs/decision/ASSET_DECISION.md` | 提供資產、附掛與市場結構的正式決策來源 |
| `docs/decision/STATE_DECISION.md` | 提供 Source of Truth 與同步邊界的正式決策來源 |
| `docs/decision/PROFESSION_DECISION.md` | 提供職業與學校邊界的正式決策來源 |
| `docs/decision/ARCHITECTURE_DECISION.md` | 提供架構責任邊界與正式來源順序的正式決策來源 |
| `docs/gdd/GDD_INDEX.md` | 提供 Core GDD 與 Domain GDD 的正式索引 |
| 所有 Core GDD | 提供核心系統責任與上游承接邊界 |
| 所有 Domain GDD | 提供各子系統責任與上游承接邊界 |

## Downstream

| 文件 | 被依賴原因 |
|---|---|
| `docs/architecture/STATE_MODEL.md` | 需要先以本文件收斂整體架構邊界，再定義正式狀態權威 |
| `docs/architecture/EVENT_MODEL.md` | 需要先以本文件收斂整體架構邊界，再定義事件模型邊界 |
| `docs/architecture/DATA_MODEL.md` | 需要先以本文件收斂整體架構邊界，再定義資料責任邊界 |
| `docs/architecture/MULTIPLAYER_MODEL.md` | 需要先以本文件收斂整體架構邊界，再定義多人同步邊界 |

## Related

| 文件 | 關聯原因 |
|---|---|
| `docs/architecture/ARCHITECTURE_INDEX.md` | 供 Architecture Layer 的正式索引與閱讀順序使用 |

撰寫原則如下：

- Upstream 只能列出正式上游來源
- Downstream 只能列出正式承接本文件的下游文件
- Related 只能列出需要交叉引用但不構成正式依賴的文件
- 不得讓依賴方向形成循環

# Edge Cases

本章節整理 Architecture Layer 需要注意的特殊情況。

| 情境 | 風險 | 正式處理方式 |
|---|---|---|
| 上游文件對同一責任有不同描述 | 權威來源可能衝突 | 依正式權威順序處理，優先採用 Product Specification，其次是 Confirmed Decision，再來是 Core GDD、Domain GDD、Architecture |
| 同一模組同時被多份文件提及 | 責任可能重複定義 | 由擁有正式責任的那一份 GDD 承接，其餘文件只可引用，不得重寫 |
| 同一資料項目被同步副本與正式來源同時描述 | 正式權威可能混淆 | 正式來源保持為唯一權威，同步副本不得反向成為正式來源 |
| 模組之間出現交界責任 | 邊界可能被跨寫 | 以上游文件定義的正式責任為準，交界處只保留引用與承接，不重複定義 |
| 下游文件想直接改寫上游規則 | 依賴方向可能反轉 | 下游文件不得改寫上游；若需調整，必須回到上游正式文件修訂 |
| 依賴圖出現循環 | 架構可能失去 DAG 特性 | 將責任重新切分回上游或相鄰模組，讓依賴只保留單向承接 |
| 新增架構主題與既有 Core GDD / Domain GDD 重疊 | 可能產生第二份正式規格 | 本文件只整理總覽，不建立第二份玩法規格；重疊責任必須回到既有 GDD 承接 |

# References

本章節用於列出本文件引用的正式文件來源。

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
- `docs/decision/PROFESSION_DECISION.md`
- `docs/decision/ARCHITECTURE_DECISION.md`

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

# Modular Design Rules

- 本文件只負責整體架構總覽，不承擔任何單一業務系統的細部責任。
- 文件分層、模組邊界與依賴方向必須與上游 GDD 一致，不得另建第二份系統規格。
- 下游 Architecture 文件只能承接本文件所整理的邊界，不得反向改寫上游權威。
- 所有模組依賴必須維持單向承接，避免形成循環依賴。
- 若出現責任重疊，必須回到原本擁有正式責任的 GDD 收斂，而不是由本文件重寫。

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

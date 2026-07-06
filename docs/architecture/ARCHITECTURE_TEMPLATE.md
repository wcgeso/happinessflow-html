# Metadata

| 項目 | 內容 |
|---|---|
| Status |  |
| Owner |  |
| Last Updated |  |

# Purpose

本文件用於定義單一 Architecture 文件的正式寫作格式。

本文件的目的，是把已確認的產品規格、決策與 GDD，轉化為可維護、可分工、可追溯的架構文件。

本文件負責提供：

- 架構文件的統一章節
- 架構文件的責任邊界
- 架構文件的依賴方向
- 架構文件的撰寫原則

本文件不負責：

- 重新定義產品規則
- 重新定義任何 GDD
- 重新定義任何已確認決策
- 描述實作細節

# Scope

## 本模板負責

- 規範單一 Architecture 文件的正式結構
- 規範單一 Architecture 文件應描述的架構責任
- 規範單一 Architecture 文件的引用方式
- 規範單一 Architecture 文件的依賴與邊界表達方式

## 本模板不負責

- 定義玩家玩法
- 定義產品規則
- 定義系統細部設計規則
- 定義實作技術方案
- 承擔其他層文件已明確擁有的責任

## 邊界原則

- Product Specification 負責玩家真正玩的正式規則
- Decision 負責已拍板的產品決策
- Core GDD 與 Domain GDD 負責系統規則與系統設計
- Architecture 文件只負責架構、模型、資料、同步、責任與依賴

# Related Documents

本章節用於整理本 Architecture 文件的正式上游與關聯文件。

## Product Specification

| 文件 | 用途 |
|---|---|
| `docs/spec/PRODUCT_SPECIFICATION.md` | 唯一正式產品規格來源 |

## Decision

| 文件 | 用途 |
|---|---|
| `docs/decision/DECISION_INDEX.md` | 已確認決策索引 |
|  |  |

## Core GDD

| 文件 | 用途 |
|---|---|
| `docs/gdd/GDD_INDEX.md` | GDD 權威索引 |
|  |  |

## Domain GDD

| 文件 | 用途 |
|---|---|
|  |  |

## Architecture

| 文件 | 用途 |
|---|---|
| `docs/architecture/ARCHITECTURE_INDEX.md` | Architecture Layer 索引 |
|  |  |

# Architecture Principles

本章節定義本文件必須遵守的架構原則。

| 原則 | 說明 |
|---|---|
| Single Responsibility | 一份 Architecture 文件只負責一個主要架構主題 |
| High Cohesion | 同一份文件內的內容必須高度聚焦於同一模型層級 |
| Low Coupling | 各文件之間只保留必要依賴，不建立多餘橫向耦合 |
| Single Source of Truth | 正式責任、正式來源與正式模型只能有一份權威定義 |
| Layered Architecture | 文件層級必須服從 Product Specification → Decision → GDD → Architecture → Code |
| Modular Design | 每份文件都應可獨立維護、獨立引用、獨立審查 |
| DAG | 文件依賴必須形成有向無環圖 |
| Separation of Concerns | 不同文件只處理自己的架構責任，不跨層混寫 |

# Architecture Model

本章節描述本文件所管理的架構模型。

建議格式如下：

| 模型名稱 | 說明 | 邊界 | 上游來源 |
|---|---|---|---|
|  |  |  |  |

撰寫原則如下：

- 必須說明本文件管理的是哪一種模型
- 必須說明此模型與其他模型的邊界
- 必須指出模型的正式上游來源
- 不得把產品規則重新寫成模型規則

# Data Ownership

本章節描述本文件範圍內的資料權威、所有權與生命週期邊界。

建議格式如下：

| 資料項目 | 正式權威 | 所有權 | 生命週期 | 說明 |
|---|---|---|---|---|
|  |  |  |  |  |

撰寫原則如下：

- 必須指出每一類資料的正式權威來源
- 必須指出資料由哪一層文件定義責任
- 必須指出資料從建立到結束的生命週期邊界
- 不得以本文件覆蓋上游已定義的正式來源

# State Model

若本文件涉及正式狀態，應在本章節描述狀態模型。

建議格式如下：

| 狀態名稱 | 用途 | 進入條件 | 離開條件 | 正式來源 |
|---|---|---|---|---|
|  |  |  |  |  |

若本文件不涉及正式狀態，應明確註記「本文件不管理正式狀態模型」。

# Lifecycle

若本文件涉及生命周期，應在本章節描述其開始、演進、收束與結束條件。

建議格式如下：

```text
開始
  ->
階段 A
  ->
階段 B
  ->
完成
```

若本文件不涉及生命周期，應明確註記「本文件不管理正式生命周期」。

# Dependency

本章節用於列出本文件的依賴方向。

## Upstream

| 文件 | 依賴原因 |
|---|---|
|  |  |

## Downstream

| 文件 | 被依賴原因 |
|---|---|
|  |  |

## Related

| 文件 | 關聯原因 |
|---|---|
|  |  |

撰寫原則如下：

- Upstream 只能列出正式上游來源
- Downstream 只能列出正式承接本文件的下游文件
- Related 只能列出需要交叉引用但不構成正式依賴的文件
- 不得讓依賴方向形成循環

# Edge Cases

本章節整理 Architecture 層需要注意的特殊情況。

建議至少涵蓋以下類型：

- 權威來源切換
- 多模型交界
- 跨文件責任交界
- 共享資料與私有資料分界
- 建立與收束時機
- 依賴方向收斂

建議格式如下：

| 情境 | 風險 | 正式處理方式 |
|---|---|---|
|  |  |  |

# References

本章節用於列出本文件引用的正式文件來源。

## Product Specification

- `docs/spec/PRODUCT_SPECIFICATION.md`

## Decision

- `docs/decision/DECISION_INDEX.md`
- 

## Core GDD

- `docs/gdd/GDD_INDEX.md`
- 

## Domain GDD

- 

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
8. 不得描述具體前端框架、函式庫機制、同步服務、介面端點、儲存技術或程式細節。
9. 不得包含現況分析、問題清單、選項比較、建議段落、未定案討論、背景分析或待辦項目。
10. 若本文件需要承接正式規則，必須以引用方式連回上游文件，不得在本文件重寫成另一份產品規格或 GDD。

# Modular Design Rules

Architecture 文件必須遵守以下模組化設計規範：

1. 單一責任：一份文件只負責一個主要架構主題。
2. 模組解耦：不同文件只透過正式依賴關係交互引用。
3. 避免循環依賴：任何文件都不得反向依賴自己的上游。
4. 依賴方向固定：依賴方向必須由上游流向下游，不得倒流。
5. 抽象優先：先定義模型與責任，再定義細部結構。
6. 禁止跨層直接依賴：Architecture 文件不得跳過上游層級，自行建立新的正式規則來源。
7. 單一權威來源：同一架構責任只能有一份正式定義。
8. 維持 DAG：Architecture Layer 整體必須形成有向無環圖。

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

# Metadata

| 項目 | 內容 |
|---|---|
| Status | Draft |
| Owner | 汪家慶 |
| Last Updated | 2026-07-02 |
| Related Specification | `docs/spec/PRODUCT_SPECIFICATION.md` |
| Related Decision | `docs/decision/DECISION_INDEX.md`、`docs/decision/ARCHITECTURE_DECISION.md`、`docs/decision/STATE_DECISION.md` |
| Related GDD | `docs/gdd/GDD_INDEX.md`、所有 Core GDD、所有 Domain GDD |
| Version | v0.1 |

# Purpose

本文件是 Architecture GDD 的唯一索引文件。

本文件只負責以下事項：

- 整理所有 Architecture GDD
- 定義各份 Architecture GDD 的責任
- 定義各份 Architecture GDD 的依賴方向
- 定義閱讀順序
- 定義 Architecture Layer 的權威順序

本文件不是 RFC。

本文件不是 Product Specification。

本文件不是 Decision。

本文件不是 GDD。

本文件不得重新定義產品規則，也不得重新定義任何 Core GDD 或 Domain GDD 的正式責任。

# Architecture Layer Position

Architecture Layer 在整個正式文件體系中的位置如下：

```text
Product Specification
  ->
Decision
  ->
Core GDD
  ->
Domain GDD
  ->
Architecture GDD
  ->
Code
```

各層權威順序如下：

1. `docs/spec/PRODUCT_SPECIFICATION.md`
2. `docs/decision/`
3. `docs/gdd/` 之 Core GDD
4. `docs/gdd/` 之 Domain GDD
5. `docs/architecture/`
6. Code

Architecture GDD 的角色，不是重新規定玩法，而是整理正式系統模型、狀態模型、事件模型、資料模型與多人同步模型。

# Architecture Documents

## 必備文件

| 文件 | 用途 | 負責範圍 | 依賴哪些文件 | 被哪些文件依賴 |
|---|---|---|---|---|
| `ARCHITECTURE.md` | 定義整體架構總覽 | 系統分層、模組責任、文件邊界、權威順序、跨系統依賴地圖 | `docs/spec/PRODUCT_SPECIFICATION.md`、所有 Confirmed Decision、`docs/gdd/GDD_INDEX.md`、所有 Core GDD、所有 Domain GDD | `STATE_MODEL.md`、`EVENT_MODEL.md`、`DATA_MODEL.md`、`MULTIPLAYER_MODEL.md` |
| `STATE_MODEL.md` | 定義正式狀態模型 | 系統正式 State、狀態分類、狀態責任、正式來源與同步副本邊界 | `ARCHITECTURE.md`、`docs/decision/STATE_DECISION.md`、所有涉及 State 的 Core / Domain GDD | `EVENT_MODEL.md`、`DATA_MODEL.md`、`MULTIPLAYER_MODEL.md` |
| `EVENT_MODEL.md` | 定義正式事件模型 | 事件層級、事件生命周期、事件所有權、事件完成條件、事件阻塞模型 | `ARCHITECTURE.md`、`STATE_MODEL.md`、`docs/decision/EVENT_DECISION.md`、`docs/gdd/EVENT_SYSTEM.md`、相關 Domain GDD | `DATA_MODEL.md`、`MULTIPLAYER_MODEL.md` |
| `DATA_MODEL.md` | 定義正式資料模型 | 核心 Entity、欄位責任、資料邊界、正式資料關聯、正式來源映射 | `ARCHITECTURE.md`、`STATE_MODEL.md`、`EVENT_MODEL.md`、`docs/decision/STATE_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md`、所有涉及資料模型的 GDD | `MULTIPLAYER_MODEL.md` |
| `MULTIPLAYER_MODEL.md` | 定義正式多人模型 | 共享資料、玩家私有資料、等待條件、同步邊界、一致性原則、多人權限模型 | `ARCHITECTURE.md`、`STATE_MODEL.md`、`EVENT_MODEL.md`、`DATA_MODEL.md`、所有涉及多人規則的 GDD | 下游 Architecture 文件與未來實作對照文件 |

## 選用文件

| 文件 | 用途 | 負責範圍 | 依賴哪些文件 | 被哪些文件依賴 |
|---|---|---|---|---|
| `docs/PROJECT_OVERVIEW.md` | 作為歷史總覽參考 | 提供專案結構、主要模組與系統盤點背景 | 無 | `ARCHITECTURE.md` 可引用其摘要作背景索引 |
| `docs/STATE_INVENTORY.md` | 作為歷史狀態盤點參考 | 提供現有 State 盤點背景 | `docs/PROJECT_OVERVIEW.md` | `STATE_MODEL.md` 可引用其盤點結果作歷史來源 |

必備文件屬於正式 Architecture Layer。

選用文件不是正式 Architecture GDD，但可作為建立 Architecture GDD 時的背景索引與歷史盤點參考。

# Dependency Graph

Architecture 層依賴圖如下：

```text
ARCHITECTURE
  ->
STATE_MODEL
  ->
EVENT_MODEL
  ->
DATA_MODEL
  ->
MULTIPLAYER_MODEL
```

補充依賴原則如下：

1. `ARCHITECTURE.md` 是 Architecture Layer 的總入口。
2. `STATE_MODEL.md` 必須建立在整體架構邊界已明確之後。
3. `EVENT_MODEL.md` 依賴 `STATE_MODEL.md`，因為事件生命周期必須建立在正式狀態模型上。
4. `DATA_MODEL.md` 依賴 `STATE_MODEL.md` 與 `EVENT_MODEL.md`，因為資料欄位責任必須對應正式狀態與正式事件。
5. `MULTIPLAYER_MODEL.md` 依賴前述所有文件，因為共享、一致性與等待條件必須建立在整體模型已穩定後。
6. Architecture Layer 必須保持 DAG，不得形成循環依賴。

# Reading Order

建議閱讀順序如下：

1. `docs/spec/PRODUCT_SPECIFICATION.md`
2. `docs/decision/DECISION_INDEX.md`
3. 所有 Confirmed Decision
4. `docs/gdd/GDD_INDEX.md`
5. 所有 Core GDD
6. 所有 Domain GDD
7. `docs/architecture/ARCHITECTURE_INDEX.md`
8. `ARCHITECTURE.md`
9. `STATE_MODEL.md`
10. `EVENT_MODEL.md`
11. `DATA_MODEL.md`
12. `MULTIPLAYER_MODEL.md`

排序原則如下：

- 先確認正式產品規則
- 再確認已拍板決策
- 再確認核心與領域系統責任
- 最後才整理 Architecture Layer

# Design Principles

Architecture Layer 必須遵守以下原則：

- Single Responsibility：每份 Architecture 文件只負責單一模型層級，不跨層重複定義。
- High Cohesion：同一份文件內的內容應高度聚焦於單一架構主題。
- Low Coupling：各文件之間只保留必要依賴，不建立多餘橫向耦合。
- Single Source of Truth：正式規則與正式責任只能有一份權威來源。
- Dependency Injection：下游模型只能依賴上游已定義的責任，不可反向決定上游內容。
- DAG：Architecture 文件必須形成有向無環圖。
- Layered Architecture：Architecture 層只能位於 GDD 之下、Code 之上。
- Modular Design：每份文件都是可獨立維護的正式模組，不得形成責任混寫。

# Architecture Writing Rules

Architecture 文件必須遵守以下規定：

1. 不得重新定義 `Product Specification`。
2. 不得重新定義任何 Confirmed Decision。
3. 不得重新定義任何 Core GDD。
4. 不得重新定義任何 Domain GDD。
5. Architecture 只能描述：
   - 系統
   - 模型
   - 狀態
   - 同步
   - 資料
   - 責任
6. Architecture 文件不得描述具體前端框架、函式庫機制、狀態容器、同步服務、介面端點、儲存技術或程式碼細節。
7. Architecture 文件不得包含現況分析、問題清單、選項比較、建議段落、未定案討論、待辦項目或背景分析內容。
8. 若 Architecture 文件需要承接正式規則，必須以引用方式連回上游文件，不得重新書寫成另一份產品規格。

# Architecture Checklist

- [x] 是否引用 `docs/spec/PRODUCT_SPECIFICATION.md`
- [x] 是否引用所有 Confirmed Decision 的上游位置
- [x] 是否承接 `docs/gdd/GDD_INDEX.md`
- [x] 是否沒有重新定義產品規則
- [x] 是否沒有重新定義任何 GDD
- [x] 是否只描述系統、模型、狀態、同步、資料與責任
- [x] 是否沒有描述程式碼
- [x] 是否沒有描述 Framework
- [x] 是否沒有包含 RFC 分析內容
- [x] 是否沒有包含未定案討論
- [x] 是否符合 Single Responsibility
- [x] 是否符合 High Cohesion
- [x] 是否符合 Low Coupling
- [x] 是否符合 Single Source of Truth
- [x] 是否符合 DAG
- [x] 是否沒有循環依賴

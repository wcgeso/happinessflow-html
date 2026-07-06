# GDD Template

## Metadata

| 項目 | 內容 |
|---|---|
| Status |  |
| Owner |  |
| Last Updated |  |
| Related Specification |  |
| Related Decision |  |
| Related GDD |  |
| Version |  |

## Purpose

本文件用於定義單一系統的正式設計。

本文件的責任是把已確認的產品規則轉化為可維護、可分工、可延伸的系統設計。

本文件不得重新定義產品規則。

所有產品規則只能引用 Product Specification。

若產品規則已由上游文件確認，本文件應直接承接並展開設計，不得重新討論。

## Scope

### 本文件負責

- 定義本系統的正式責任範圍
- 定義本系統的正式資料模型
- 定義本系統的正式 State
- 定義本系統的正式規則與流程
- 定義本系統與其他系統的依賴關係

### 本文件不負責

- 重新定義產品規則
- 討論未決產品選項
- 描述程式碼實作
- 描述 UI 細節
- 描述 API 或資料庫
- 承擔其他系統已明確擁有的責任

### 邊界原則

- 不同 GDD 之間不得重複定義責任
- 若某規則屬於其他系統，應以引用方式處理
- 若某流程跨模組，應拆分責任並明確標示依賴方向

## Definitions

本章節用於定義本系統的核心名詞。

所有名詞都必須具有唯一正式定義。

建議格式如下：

| 名詞 | 定義 |
|---|---|
| Entity |  |
| State |  |
| Event |  |
| Action |  |
| Resource |  |
| Ownership |  |
| Status |  |
| Lifecycle |  |

補充原則如下：

- 同一名詞在同一份 GDD 中只能有一個正式定義
- 若上游文件已定義名詞，應直接引用，不得重新改寫語意
- 若同名詞跨多份 GDD 使用，應明確指定哪一份 GDD 為正式來源

## Data Model

本章節描述正式資料模型。

本章節不得引用：

- React
- Vue
- Context
- Hook
- Firestore
- API
- Database Schema

本章節只描述正式資料模型。

建議格式如下：

| 欄位名稱 | 型別 | 用途 | 限制 | 說明 |
|---|---|---|---|---|
|  |  |  |  |  |

撰寫原則如下：

- 每個欄位都必須有明確用途
- 每個欄位都必須有使用限制
- 每個欄位都必須有語意說明
- 不得混入實作欄位、快取欄位或 UI 欄位，除非其為正式資料模型的一部分
- 若某欄位來自其他系統，應引用來源 GDD，而不是在本文件重複定義

## State

本章節定義本系統的正式 State。

每個 State 應至少包含以下內容：

| State 名稱 | 用途 | 進入條件 | 離開條件 | 允許操作 | 禁止操作 |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

撰寫原則如下：

- 每個 State 都必須有存在目的
- 每個 State 都必須有清楚的進入條件與離開條件
- 每個 State 都必須界定允許與禁止操作
- 不得將 UI 顯示狀態誤寫為正式 State，除非它屬於正式規則的一部分

## Rules

本章節完整描述本系統的正式規則。

本章節不得描述：

- UI
- 程式
- Framework

本章節只描述系統規則。

建議撰寫方式如下：

1. 先定義規則主題
2. 再列出觸發條件
3. 再列出限制條件
4. 再列出完成條件
5. 再列出與其他系統的交界

規則撰寫原則如下：

- 規則應可被驗證
- 規則應避免模糊詞
- 規則應避免把流程責任寫到其他系統
- 規則若引用上游文件，應明確標示來源

## Flow

本章節以正式流程描述本系統從開始到完成的運作方式。

流程只描述正式流程。

不得描述程式流程。

建議格式如下：

```text
開始
  ->
流程步驟 A
  ->
流程步驟 B
  ->
流程步驟 C
  ->
完成
```

撰寫原則如下：

- 流程必須反映正式規則，而非畫面操作順序
- 流程中的每個節點都應可對應到正式 State 或正式規則
- 若流程會分支，應明確寫出分支條件與收束點

## State Machine

本章節建立本系統完整的 State Machine。

每個 State Machine 至少應包含：

| State | Transition | Trigger | Allowed Transition | Forbidden Transition |
|---|---|---|---|---|
|  |  |  |  |  |

撰寫原則如下：

- 每個 State 轉換都必須有 Trigger
- 每個 State 都必須有允許與禁止的轉換方向
- 不得省略結束條件與失敗條件
- 若某 Transition 依賴其他 GDD，應明確引用

## Edge Cases

本章節整理所有特殊情況。

至少應包含以下類型：

- 中斷
- 取消
- 失敗
- 多人同步
- 重複操作
- 例外流程
- Recovery

建議格式如下：

| 情境 | 問題 | 正式處理方式 |
|---|---|---|
|  |  |  |

撰寫原則如下：

- Edge Case 必須屬於正式規則的一部分
- 不得把實作 bug 當作 Edge Case
- 不得把未定義行為留白

## Dependencies

本章節整理本文件的依賴關係。

至少應包含：

- 依賴哪些 Specification
- 依賴哪些 Decision
- 依賴哪些其他 GDD
- 哪些 GDD 依賴本文件

建議格式如下：

| 類型 | 文件 | 依賴原因 |
|---|---|---|
| Specification |  |  |
| Decision |  |  |
| Upstream GDD |  |  |
| Downstream GDD |  |  |

依賴原則如下：

- 依賴方向必須清楚
- 不得存在反向依賴
- 不得存在循環依賴

## References

本章節只引用正式文件。

可引用：

- Product Specification
- Decision
- 其他 GDD

不得引用 RFC。

RFC 僅可作為歷史參考，不得作為正式規格來源。

建議格式如下：

| 文件類型 | 文件名稱 | 用途 |
|---|---|---|
| Product Specification |  |  |
| Decision |  |  |
| GDD |  |  |

## Design Principles

本章節定義所有 GDD 共通必須遵守的設計原則。

### 單一職責（Single Responsibility）

- 一份 GDD 只應負責一個系統
- 一份 GDD 不應同時承擔多個不相干系統的正式責任

### 模組化（Modular Design）

- 各系統應可獨立理解、獨立維護、獨立引用
- 下游文件應依賴上游文件，而不是複製其內容

### 低耦合（Low Coupling）

- 系統之間的依賴應最小化
- 只保留必要依賴

### 高內聚（High Cohesion）

- 同一份 GDD 內的所有章節應服務同一個系統目標
- 不應混入其他系統的主責內容

### 單一權威來源（Single Source of Truth）

- 每個正式規則只能有一個正式來源
- 每個正式資料模型只能有一個正式定義來源

### 不可循環依賴（No Circular Dependency）

- GDD 之間不得相互依賴形成閉環

### 依賴方向固定（Top-down Dependency）

- 依賴方向必須由上而下
- 下游 GDD 只能依賴上游 GDD

### 資料與 UI 分離

- 正式資料模型不得與 UI 表現細節混寫

### 規則與實作分離

- 正式規則文件不得描述實作細節

### 產品規則不得寫進程式

- 產品規則必須先存在於正式文件
- 程式只能實作既有規則，不得成為規則來源

## Writing Rules

所有 GDD 必須遵守以下規則：

1. 不得重新定義產品規則。
2. 不得包含：
   - Option
   - Recommendation
   - Problem
   - Current Implementation
   - Need Confirmation
   - TODO
   - RFC Analysis
   - Legacy Analysis
3. 不得描述程式碼。
4. 不得描述 Framework。
5. 不得描述 UI 細節。
6. 不得描述 API。
7. 不得描述 Database。
8. 不得重新開啟產品討論。
9. 若 Product Specification 已定義，必須直接引用。
10. 若 Decision 已 Confirmed，必須直接引用。
11. 不得與其他 GDD 重複定義責任。
12. 若責任跨模組，必須引用其他 GDD，不得複製內容。

## Modular Design Rules

本章節定義所有 GDD 必須遵守的模組化規範。

- 一個 GDD 只負責一個系統。
- GDD 可依賴多份上游 GDD。
- 不得反向依賴。
- 不得形成循環依賴，整體結構必須為 DAG。
- 每個系統只能有一份正式 GDD。
- 每個正式規則只能定義一次。
- 所有下游 GDD 必須引用上游，而不是複製內容。
- 若多個系統共用一條正式規則，必須由其中一份上游 GDD 作為正式來源。
- 若某系統只負責特定子域，則其 GDD 不得向上覆蓋上游系統的責任範圍。

## GDD Checklist

- □ 是否引用 Product Specification
- □ 是否引用 Confirmed Decision
- □ 是否沒有重新定義產品規則
- □ 是否沒有引用程式
- □ 是否沒有引用 Framework
- □ 是否沒有引用 RFC
- □ 是否沒有 Current Implementation
- □ 是否沒有 Option
- □ 是否沒有 Recommendation
- □ 是否沒有 TODO
- □ 是否符合模組化
- □ 是否符合 DAG
- □ 是否沒有循環依賴
- □ 是否沒有重複定義其他 GDD

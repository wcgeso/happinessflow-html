# Metadata

| 項目 | 內容 |
|---|---|
| Status | Review |
| Owner | 汪家慶 |
| Last Updated | 2026-07-02 |
| Related Specification | `docs/spec/PRODUCT_SPECIFICATION.md` |
| Related Decision | `docs/decision/FINANCIAL_DECISION.md`、`docs/decision/BANK_DECISION.md`、`docs/decision/ASSET_DECISION.md`、`docs/decision/STATE_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md`、`docs/decision/PROFESSION_DECISION.md` |
| Related GDD | `docs/gdd/BANK_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md`、`docs/gdd/ASSET_SYSTEM.md` |
| Version | v1.0 |

## Purpose

本文件定義《幸福流》的正式財務系統，涵蓋 `Cash`、`Income`、`Expense`、`Passive Income`、`Financial Check`、`Transaction`、`Settlement` 與 `Debt`。

本文件的責任是把已確認的產品規格轉化為可維護、可追蹤、可同步的正式財務設計。

本文件不得重新定義產品規則。

所有正式規則只能引用 Product Specification 與已確認 Decision。

本文件的目標如下：

- 提供財務規則的唯一正式設計來源
- 明確定義交易成立、月結算與債務處理的正式門檻
- 明確區分一次性交易、月度結算與被動收入
- 明確區分正式債務與附屬債務處理規則
- 讓所有正式財務結果都能被追蹤與回溯

## Scope

### 本文件負責

- 定義正式現金與可用餘額規則
- 定義正式收入、支出與被動收入規則
- 定義正式財務檢核規則
- 定義正式交易成立條件
- 定義正式月結算與月現金流規則
- 定義正式負債與債務處理規則
- 定義正式交易紀錄與財務追蹤規則

### 本文件不負責

- 銀行事件本身的流程設計
- 銀行服務窗口本身的權限設計
- 資產 ownership 的正式邊界
- 卡片抽牌、揭示與效果流程
- 棋盤移動與回合切換流程
- 職業、夢想、幸福、卡片或資產本體的完整規格

### 邊界原則

- 本文件只處理財務語意與財務結果
- 若某規則屬於銀行、資產或其他系統，應以引用方式承接
- 若某流程跨系統，應明確標示其財務責任，不重複定義其他系統責任

## Definitions

本章節用於定義本系統的核心名詞。

同一名詞在本文件中只能有一個正式定義。

| 名詞 | 定義 |
|---|---|
| Cash | 玩家可立即使用、可直接支付的現金餘額。 |
| Income | 會增加玩家財務能力、並納入月現金流計算的正式收入。 |
| Expense | 會降低玩家財務能力、並納入月現金流計算的正式支出。 |
| Passive Income | 不需要當回合主動操作即可持續產生、並納入月現金流計算的收入。 |
| Financial Check | 所有正式交易在正式成立前必須通過的檢核程序。 |
| Transaction | 一筆正式財務變動的結果紀錄，包含現金、收入、支出、資產或負債的變化。 |
| Settlement | 每次銀行事件中執行的月結算程序，用於計算收入、支出與月現金流。 |
| Debt | 玩家尚未清償的正式負債總稱。 |
| Forced Debt | 因支付不足而形成的特殊負債，具有自動償還優先性。 |
| Monthly Cashflow | 當期收入減去當期支出的正式月度結果。 |

## Data Model

本章節描述正式財務資料模型，只定義概念層，不定義實作。

| 欄位名稱 | 型別 | 用途 | 限制 | 說明 |
|---|---|---|---|---|
| Cash Balance | 金額 | 表示玩家可立即使用的現金。 | 不得為負數。 | 所有正式交易完成後必須更新。 |
| Income Item | 收入項目 | 表示一筆正式收入來源。 | 必須能對應來源與生效時點。 | 可用於薪資、被動收入或動態收入。 |
| Expense Item | 支出項目 | 表示一筆正式支出來源。 | 必須能對應來源與生效時點。 | 可用於稅、生活費、保險費或其他正式支出。 |
| Passive Income Item | 被動收入項目 | 表示不需主動操作即可持續發生的收入。 | 必須可納入月現金流。 | 其正式意義是定期性收入，不是一次性入帳。 |
| Monthly Cashflow | 金額 | 表示當期收入減支出的淨結果。 | 必須由正式收入與正式支出推得。 | 不得以獨立任意值替代。 |
| Financial Check Result | 檢核結果 | 表示交易是否可正式成立。 | 必須有通過或未通過結果。 | 若未通過，必須能說明不足原因。 |
| Transaction Record | 交易紀錄 | 表示一筆正式財務結果。 | 每筆正式交易都必須有一筆紀錄。 | 必須可追溯來源、金額與影響範圍。 |
| Settlement Record | 結算紀錄 | 表示一次月結算的正式結果。 | 每次銀行事件都應產生。 | 必須能反映當期收入、支出與月現金流。 |
| Debt Item | 負債項目 | 表示一筆尚未清償的正式負債。 | 必須可識別種類與清償規則。 | 可為一般負債或強制負債。 |

## State

本章節定義本系統的正式狀態。

| State 名稱 | 用途 | 進入條件 | 離開條件 | 允許操作 | 禁止操作 |
|---|---|---|---|---|---|
| 穩定狀態 | 沒有進行中的財務程序。 | 前一筆交易或結算已完成。 | 進入財務檢核、月結算或債務處理。 | 發起正式交易申請、等待結算、查閱既有財務結果。 | 直接讓正式交易成立。 |
| 財務檢核中 | 檢查交易是否可正式成立。 | 玩家或系統提出正式交易。 | 檢核通過、檢核失敗或需要補足支付。 | 驗證金額、來源、影響與支付能力。 | 未經檢核直接寫入正式結果。 |
| 月結算中 | 正式執行當期結算。 | 銀行事件啟動月結算。 | 收入、支出與自動清償處理完成。 | 計算月現金流、更新收入與支出、處理自動償還。 | 跳過收入或支出計算。 |
| 債務處理中 | 處理支付不足或正式清償。 | 現金不足、需借款、需賣資產或需建立強制負債。 | 補足完成或負債建立完成。 | 借款、賣資產、建立強制負債、清償強制負債。 | 保持未補足狀態卻讓交易成立。 |
| 結束鎖定 | 遊戲正式結束後的鎖定狀態。 | 遊戲結束。 | 無。 | 只允許讀取既有財務結果。 | 任何新交易、結算、檢核或負債變動。 |

## Rules

### 1. Cash Rules

1. `Cash` 為玩家可立即使用的正式現金。
2. 所有正式交易完成後，都必須更新 `Cash`。
3. 玩家不得維持負現金。
4. 若支付不足，必須先完成以下其中一種處理，交易才可正式成立：
   - 借款
   - 賣出資產
   - 形成 `Forced Debt`
5. 未完成補足處理前，不得以正式交易結果視為成立。
6. 遊戲正式結束後，不得再變動 `Cash`。

### 2. Income Rules

1. 正式收入包含：
   - 薪資
   - 被動收入
   - 動態收入
2. 所有收入都必須可追溯其來源。
3. 收入若由資產產生，必須能對應到正式資產。
4. 收入若由事件、卡片或結算產生，必須能對應到正式交易紀錄。
5. 所有正式收入都必須納入 `Monthly Cashflow`。

### 3. Expense Rules

1. 正式支出包含：
   - 稅
   - 生活費
   - 交通費
   - 教育費
   - 醫療費
   - 育兒費
   - 保險費
   - 貸款利息
   - 等級支出
2. 支出可分為一次性支出與每月固定支出。
3. 所有正式支出都必須納入 `Monthly Cashflow`。
4. 支出若由卡片、事件、升級、保險或貸款產生，必須更新正式支出資料。
5. 支出若屬一次性交易，仍必須建立正式交易紀錄。

### 4. Passive Income Rules

1. `Passive Income` 屬於正式收入的一種。
2. `Passive Income` 的正式特徵是可在月結算時自動納入，不需要當回合主動操作。
3. `Passive Income` 必須可對應到正式來源，例如資產或其他正式持續性來源。
4. `Passive Income` 必須納入 `Monthly Cashflow`。

### 5. Financial Check Rules

1. 所有正式交易都必須通過 `Financial Check`。
2. `Financial Check` 必須確認交易是否符合正式規則。
3. `Financial Check` 必須確認交易後的現金狀態是否可成立。
4. `Financial Check` 未通過時，交易不得正式成立。
5. 若交易需要立即支付且現金不足，必須先進入債務處理或賣資產處理，再重新檢核。
6. `Financial Check` 完成後，才允許正式寫入交易結果。

### 6. Transaction Rules

1. 所有正式財務變動都必須建立 `Transaction`。
2. `Transaction` 必須能反映：
   - 來源
   - 金額
   - 現金變動
   - 受影響的收入、支出或負債
3. 一筆正式交易只應對應一筆可追蹤的交易結果。
4. 交易結果必須同步更新相關正式財務資料。
5. 遊戲正式結束後，不得建立新交易。

### 7. Settlement Rules

1. 每次觸發銀行事件時，都必須執行一次 `Settlement`。
2. `Settlement` 的正式內容為：
   - 計算當期收入
   - 計算當期支出
   - 得出 `Monthly Cashflow`
   - 更新 `Cash`
   - 套用必要的自動清償
3. `Settlement` 完成前，不得視為銀行事件完成。
4. `Monthly Cashflow` 即使為負，`Settlement` 仍須正常完成。
5. `Settlement` 與一般交易不同，不能用來取代正式交易流程。

### 8. Debt Rules

1. `Debt` 為玩家尚未清償的正式負債總稱。
2. 正式負債包含：
   - `Credit Loan`
   - `Forced Debt`
   - `Vehicle Loan`
   - `Enterprise Loan`
   - `Real Estate Loan`
3. `Forced Debt` 為因支付不足而形成的特殊負債。
4. 只有 `Forced Debt` 會自動償還。
5. 一般貸款不得自動清償，只能依玩家主動還款或正式扣款規則處理。
6. 若負債與資產有正式附著關係，必須能對應回正式資產。

## Flow

### 1. Formal Transaction Flow

```text
交易申請
  ->
Financial Check
  ->
通過
  ->
正式交易成立
  ->
更新 Cash / Income / Expense / Debt
  ->
建立 Transaction
  ->
完成
```

### 2. Settlement Flow

```text
經過銀行
  ->
Settlement
  ->
計算收入
  ->
計算支出
  ->
得出 Monthly Cashflow
  ->
更新 Cash
  ->
處理強制負債自動償還
  ->
建立 Settlement 與相關 Transaction
  ->
完成
```

### 3. Insufficient Payment Flow

```text
支付不足
  ->
借款 / 賣出資產 / 形成 Forced Debt
  ->
Financial Check
  ->
通過
  ->
正式交易成立
  ->
完成
```

### 4. Debt Repayment Flow

```text
產生可償還現金
  ->
檢查是否存在 Forced Debt
  ->
優先償還 Forced Debt
  ->
若仍有剩餘，依正式負債規則處理其他負債
  ->
更新 Transaction
  ->
完成
```

## State Machine

| State | Transition | Trigger | Allowed Transition | Forbidden Transition |
|---|---|---|---|---|
| 穩定狀態 | 進入財務檢核中 | 玩家提出正式交易 | 財務檢核中、月結算中、債務處理中 | 未經檢核直接成立交易 |
| 財務檢核中 | 檢核通過 | 金額、來源與支付條件成立 | 穩定狀態 | 略過正式交易成立 |
| 財務檢核中 | 檢核失敗 | 條件不成立或支付不足 | 債務處理中、穩定狀態 | 直接讓負現金成立 |
| 月結算中 | 結算完成 | 銀行事件的月結算處理完成 | 穩定狀態 | 跳過收入、支出或自動償還步驟 |
| 債務處理中 | 補足完成 | 借款、賣資產或建立強制負債已完成 | 財務檢核中、穩定狀態 | 以未補足狀態完成交易 |
| 結束鎖定 | 無 | 遊戲正式結束 | 無 | 任何財務變動 |

## Edge Cases

| 情境 | 問題 | 正式處理方式 |
|---|---|---|
| 現金不足但必須立即付款 | 交易無法直接成立 | 必須先完成借款、賣出資產或形成 `Forced Debt`，再重新通過 `Financial Check`。 |
| 同一筆交易同時影響多個財務項目 | 容易只更新部分資料 | 必須以同一筆正式交易完整反映現金、收入、支出與負債變動。 |
| 月結算後仍有支付不足 | 結算結果可能造成後續壓力 | `Settlement` 仍須完成，後續不足部分依正式債務處理規則解決。 |
| 只有 `Forced Debt` 會自動清償 | 一般貸款與強制負債規則不同 | 自動償還只適用 `Forced Debt`，其他負債不得自動清償。 |
| 正式交易來源為卡片或事件 | 容易混淆財務與事件責任 | 仍視為正式交易，必須通過 `Financial Check` 並建立 `Transaction`。 |
| 遊戲正式結束後 | 仍可能有人嘗試變動財務 | 所有財務變動、檢核、結算與債務處理都必須停止。 |
| 同時存在多筆負債 | 可能出現償還順序爭議 | `Forced Debt` 必須優先處理；一般負債依正式規則與玩家主動操作處理。 |

## Dependencies

| 類型 | 文件 | 依賴原因 |
|---|---|---|
| Specification | `docs/spec/PRODUCT_SPECIFICATION.md` | 正式財務規則、月結算、負債與交易成立的唯一產品來源。 |
| Decision | `docs/decision/FINANCIAL_DECISION.md` | 確認 `Financial Check`、負債權威、股價權威與人生里程碑的正式邊界。 |
| Decision | `docs/decision/BANK_DECISION.md` | 確認銀行事件、銀行服務窗口與財務功能權限的正式邊界。 |
| Decision | `docs/decision/ASSET_DECISION.md` | 確認資產 ownership、保險附著、貸款附著與市場資料結構。 |
| Decision | `docs/decision/STATE_DECISION.md` | 確認正式權威、同步副本與 legacy 邊界。 |
| Decision | `docs/decision/ARCHITECTURE_DECISION.md` | 確認正式架構責任邊界與同步模型。 |
| Decision | `docs/decision/PROFESSION_DECISION.md` | 確認職業、升等與相關財務變動的正式邊界。 |
| Downstream GDD | `docs/gdd/BANK_SYSTEM.md` | 銀行系統需承接本文件的財務檢核、月結算與債務規則。 |
| Downstream GDD | `docs/gdd/CARD_SYSTEM.md` | 卡片金額、支付與資產或負債變動需承接本文件的正式交易規則。 |
| Downstream GDD | `docs/gdd/ASSET_SYSTEM.md` | 資產系統需承接本文件的交易成立、資產變動與負債處理規則。 |
| Downstream GDD | `LOAN_SYSTEM.md` | 貸款系統需承接本文件的負債與還款規則。 |
| Downstream GDD | `INSURANCE_SYSTEM.md` | 保險系統需承接本文件的保費與理賠財務規則。 |
| Downstream GDD | `MARKET_SYSTEM.md` | 市場系統需承接本文件的價格、股利與市場變動財務規則。 |
| Downstream GDD | `REAL_ESTATE_SYSTEM.md` | 房地產系統需承接本文件的購買、出售、貸款與現金流規則。 |
| Downstream GDD | `BUSINESS_SYSTEM.md` | 企業系統需承接本文件的收購、升級、收入與負債規則。 |
| Downstream GDD | `DREAM_SYSTEM.md` | 夢想系統需承接本文件的交易與財務門檻。 |
| Downstream GDD | `HAPPINESS_SYSTEM.md` | 幸福系統中的幸福事件與里程碑不得繞過本文件的正式財務成立條件。 |
| Downstream GDD | `PROFESSION_SYSTEM.md` | 職業系統需承接本文件的薪資、等級支出與財務門檻。 |

## References

- `docs/spec/PRODUCT_SPECIFICATION.md`
- `docs/decision/FINANCIAL_DECISION.md`
- `docs/decision/BANK_DECISION.md`
- `docs/decision/ASSET_DECISION.md`
- `docs/decision/STATE_DECISION.md`
- `docs/decision/ARCHITECTURE_DECISION.md`
- `docs/decision/PROFESSION_DECISION.md`
- `docs/gdd/GDD_INDEX.md`
- `docs/gdd/GDD_TEMPLATE.md`

## Design Principles

### 單一職責（Single Responsibility）

- 本文件只負責正式財務規則、正式交易成立條件與正式結算責任。
- 本文件不承擔銀行事件流程、資產所有權、卡片生命周期或棋盤入口設計。

### 模組化（Modular Design）

- 現金、收入、支出、被動收入、財務檢核、交易、結算與負債集中在本文件定義。
- 其他系統若涉及金額、支付、收入或負債，必須引用本文件，不得各自重寫。

### 低耦合（Low Coupling）

- 本文件直接承接產品規格與已確認決策，不反向依賴銀行、資產或卡片子系統的細節。
- 與其他系統的關聯只保留正式財務邊界。

### 高內聚（High Cohesion）

- 本文件所有章節都圍繞正式財務結果如何成立、結算與追蹤。

### 單一權威來源（Single Source of Truth）

- 正式財務規則以 `PRODUCT_SPECIFICATION.md` 與已確認 Decision 為唯一上位來源。
- 財務資料的正式責任以本文件為核心 GDD 來源。

### 不可循環依賴（No Circular Dependency）

- 本文件作為核心財務上游，不反向依賴銀行、資產或其他下游 GDD。
- 下游系統若需正式財務規則，應引用本文件，不得讓本文件依賴其細節。

### 依賴方向固定（Top-down Dependency）

- 依賴方向維持為 Product Specification -> Decision -> Core GDD -> Domain GDD。

### 資料與 UI 分離

- 本文件只定義正式資料模型、正式狀態與正式規則。
- 本文件不描述畫面、互動元件或呈現方式。

### 規則與實作分離

- 本文件只描述正式設計，不描述任何技術實作。

### 產品規則不得寫進程式

- 本文件承接正式產品規格與已確認決策。
- 實作必須追隨本文件，不得以實作現況覆蓋正式規則。

## Writing Rules

1. 本文件不得重新定義產品規則。
2. 本文件不得包含：
   - Option
   - Recommendation
   - Problem
   - Current Implementation
   - Need Confirmation
   - TODO
   - RFC Analysis
   - Legacy Analysis
3. 本文件不得描述程式碼。
4. 本文件不得描述 Framework。
5. 本文件不得描述 UI 細節。
6. 本文件不得描述 API。
7. 本文件不得描述 Database。
8. 本文件不得重新開啟產品討論。
9. 本文件若引用產品規則，必須直接以上游正式文件為準。
10. 本文件若引用已確認決策，必須直接承接，不得改寫其結論。
11. 本文件不得與其他 GDD 重複定義責任。
12. 本文件若需跨模組規則，必須以引用方式處理。

## Modular Design Rules

- 一個 GDD 只負責一個系統，本文件只負責財務系統。
- 本文件可依賴多份上游 Decision，但不得反向依賴下游 GDD。
- 本文件不得與其他 GDD 形成循環依賴。
- 每個正式財務規則只能定義一次。
- 其他 GDD 若涉及現金、收入、支出、負債、財務檢核或交易成立，必須引用本文件。
- 若規則屬於銀行、資產、保險、貸款、夢想、職業或市場子系統，應由對應 GDD 承接其專屬內容。

## GDD Checklist

- [x] 是否引用 Product Specification
- [x] 是否引用 Confirmed Decision
- [x] 是否沒有重新定義產品規則
- [x] 是否沒有引用程式
- [x] 是否沒有引用 Framework
- [x] 是否沒有引用 RFC
- [x] 是否沒有 Current Implementation
- [x] 是否沒有 Option
- [x] 是否沒有 Recommendation
- [x] 是否沒有 TODO
- [x] 是否符合模組化
- [x] 是否符合 DAG
- [x] 是否沒有循環依賴
- [x] 是否沒有重複定義其他 GDD

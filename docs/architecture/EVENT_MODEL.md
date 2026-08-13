# Metadata

| 項目 | 內容 |
|---|---|
| Status | Draft |
| Owner | 汪家慶 |
| Last Updated | 2026-07-02 |
| Related Specification | `docs/spec/PRODUCT_SPECIFICATION.md` |
| Related Decision | `docs/decision/DECISION_INDEX.md`、`docs/decision/TURN_DECISION.md`、`docs/decision/EVENT_DECISION.md`、`docs/decision/CARD_DECISION.md`、`docs/decision/BANK_DECISION.md`、`docs/decision/FINANCIAL_DECISION.md`、`docs/decision/ASSET_DECISION.md`、`docs/decision/STATE_DECISION.md`、`docs/decision/PROFESSION_DECISION.md` |
| Related GDD | `docs/gdd/GDD_INDEX.md`、`docs/gdd/TURN_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md`、`docs/gdd/FINANCIAL_SYSTEM.md`、`docs/gdd/BOARD_SYSTEM.md`、`docs/gdd/ASSET_SYSTEM.md`、`docs/gdd/INSURANCE_SYSTEM.md`、`docs/gdd/LOAN_SYSTEM.md`、`docs/gdd/MARKET_SYSTEM.md`、`docs/gdd/SCHOOL_SYSTEM.md`、`docs/gdd/HOSPITAL_SYSTEM.md`、`docs/gdd/REPAIR_SYSTEM.md`、`docs/gdd/PROFESSION_SYSTEM.md`、`docs/gdd/DREAM_SYSTEM.md`、`docs/gdd/HAPPINESS_SYSTEM.md`、`docs/gdd/FAMILY_SYSTEM.md`、`docs/gdd/REAL_ESTATE_SYSTEM.md`、`docs/gdd/BUSINESS_SYSTEM.md` |
| Version | v0.1 |

# Purpose

本文件定義《第二人生》的正式事件模型。

本文件只負責整理事件層級、事件佇列、事件生命週期、事件阻塞、事件所有權、事件完成條件、共享事件與在地事件流程的正式架構，不重新定義產品玩法或產品規則。

本文件的角色，是把已確認的事件相關上游規則收斂成單一架構文件，讓事件何時進入佇列、何時可以完成、何時阻塞回合，以及誰擁有事件的正式處理責任，都有一致的正式邊界。

# Scope

## 本文件負責

- 定義正式事件模型
- 定義事件佇列與目前事件的正式邊界
- 定義事件生命週期
- 定義事件阻塞與完成條件
- 定義事件所有權
- 定義共享事件與在地事件流程的正式分界
- 定義事件狀態模型與依賴方向

## 本文件不負責

- 重新定義產品規格
- 重新定義回合順序
- 重新定義卡片內容
- 重新定義銀行服務
- 重新定義財務成立條件
- 重新定義資產、保險、貸款或市場規則
- 描述任何具體實作技術、介面細節、同步機制或程式碼

## 邊界原則

- 事件模型只負責事件何時成立、何時排入、何時推進、何時完成。
- 事件內容由 `docs/gdd/EVENT_SYSTEM.md` 與其下游 GDD 承接，本文件不重寫其正式內容。
- 回合完成與切換邊界由 `docs/gdd/TURN_SYSTEM.md` 承接。
- 棋盤、卡片、銀行與財務的正式入口條件由對應 GDD 承接，本文件只處理事件層級的正式封裝。
- 共享事件與在地事件流程都屬於正式事件模型的一部分，但兩者的責任不同，不能混為同一正式層級。

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
| `docs/decision/EVENT_DECISION.md` | 事件三層模型、正式事件鏈與 Queue 規則的正式決策來源 |
| `docs/decision/CARD_DECISION.md` | 後續卡、家庭歷程與正式卡片事件鏈的正式決策來源 |
| `docs/decision/BANK_DECISION.md` | 銀行事件與銀行服務窗口分層的正式決策來源 |
| `docs/decision/FINANCIAL_DECISION.md` | 正式交易成立、財務檢核與里程碑分離的正式決策來源 |
| `docs/decision/ASSET_DECISION.md` | 所有權、附掛與正式資料權威的正式決策來源 |
| `docs/decision/STATE_DECISION.md` | 正式權威與同步副本邊界的正式決策來源 |
| `docs/decision/PROFESSION_DECISION.md` | 學校、職業與終身學習邊界的正式決策來源 |

## Core GDD

| 文件 | 用途 |
|---|---|
| `docs/gdd/GDD_INDEX.md` | GDD 權威索引 |
| `docs/gdd/TURN_SYSTEM.md` | 回合完成、阻塞與切換邊界 |
| `docs/gdd/EVENT_SYSTEM.md` | 正式事件模型、Queue、完成與阻塞規則 |
| `docs/gdd/CARD_SYSTEM.md` | 抽牌、揭示、結算與後續卡事件邊界 |
| `docs/gdd/BANK_SYSTEM.md` | 銀行事件與銀行服務窗口邊界 |
| `docs/gdd/FINANCIAL_SYSTEM.md` | 財務檢核、交易成立與月結算邊界 |
| `docs/gdd/BOARD_SYSTEM.md` | 棋盤事件入口與格子判定邊界 |
| `docs/gdd/ASSET_SYSTEM.md` | 資產所有權與附掛邊界 |

## Domain GDD

| 文件 | 用途 |
|---|---|
| `docs/gdd/INSURANCE_SYSTEM.md` | 保險事件與保費承接邊界 |
| `docs/gdd/LOAN_SYSTEM.md` | 貸款事件與自動償還邊界 |
| `docs/gdd/MARKET_SYSTEM.md` | 市場更新與揭示邊界 |
| `docs/gdd/SCHOOL_SYSTEM.md` | 學校事件與後續幸福卡邊界 |
| `docs/gdd/HOSPITAL_SYSTEM.md` | 醫院事件、停回合與完成邊界 |
| `docs/gdd/REPAIR_SYSTEM.md` | 維修廠事件、停回合與完成邊界 |
| `docs/gdd/PROFESSION_SYSTEM.md` | 學校結果與職涯承接邊界 |
| `docs/gdd/DREAM_SYSTEM.md` | 夢想里程碑與事件承接邊界 |
| `docs/gdd/HAPPINESS_SYSTEM.md` | 幸福結果承接與最終評分邊界 |
| `docs/gdd/FAMILY_SYSTEM.md` | 共同參與、等待與收束邊界 |
| `docs/gdd/REAL_ESTATE_SYSTEM.md` | 房屋事件與市場承接邊界 |
| `docs/gdd/BUSINESS_SYSTEM.md` | 企業事件與市場承接邊界 |

## Architecture

| 文件 | 用途 |
|---|---|
| `docs/architecture/ARCHITECTURE.md` | 整體架構總覽的正式上游文件 |
| `docs/architecture/STATE_MODEL.md` | 狀態模型的正式上游文件 |
| `docs/architecture/DATA_MODEL.md` | 下游資料模型的正式承接文件 |
| `docs/architecture/MULTIPLAYER_MODEL.md` | 下游多人模型的正式承接文件 |

# Architecture Principles

| 原則 | 說明 |
|---|---|
| 單一職責 | 一份架構文件只負責一個主要架構主題 |
| 高內聚 | 同一份文件內的內容必須聚焦在同一模型層級 |
| 低耦合 | 各文件只保留必要依賴，不建立多餘橫向耦合 |
| 單一權威來源 | 正式責任、正式來源與正式模型只能有一份權威定義 |
| 分層架構 | 架構層只能位於 GDD 之下、Code 之上 |
| 模組化設計 | 每份文件都應可獨立維護、獨立引用、獨立審查 |
| DAG | 文件依賴必須形成有向無環圖 |
| 關注點分離 | 不同文件只處理自己的架構責任，不跨層混寫 |

# Architecture Model

| 模型名稱 | 說明 | 邊界 | 上游來源 |
|---|---|---|---|
| 正式事件模型 | 定義單一事件如何成為正式事件、如何排入 Queue、如何完成與收束 | 只處理事件本體，不處理事件內容 | `docs/spec/PRODUCT_SPECIFICATION.md`、`docs/decision/EVENT_DECISION.md`、`docs/gdd/EVENT_SYSTEM.md` |
| 事件佇列 | 定義正式事件的先後順序與目前事件的唯一性 | 只處理順序與推進，不處理內容細節 | `docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/TURN_SYSTEM.md` |
| 共享事件 | 定義需要多位玩家共同回覆或共同等待的正式事件層 | 只處理共享回覆與等待，不取代主事件本體 | `docs/decision/CARD_DECISION.md`、`docs/gdd/CARD_SYSTEM.md`、`docs/gdd/FAMILY_SYSTEM.md` |
| 在地事件流程 | 定義附屬於正式事件之下的局部處理流程 | 只在主事件內部存在，不能獨立成為新的正式事件 | `docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/BOARD_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md` |
| 完成與阻塞模型 | 定義事件何時阻塞回合、何時阻塞下一事件、何時可正式完成 | 只定義完成門檻，不定義產品規則本身 | `docs/decision/TURN_DECISION.md`、`docs/decision/EVENT_DECISION.md`、`docs/decision/BANK_DECISION.md`、`docs/decision/CARD_DECISION.md` |

撰寫原則如下：

- 必須說明本文件管理的是哪一種模型
- 必須說明此模型與其他模型的邊界
- 必須指出模型的正式上游來源
- 不得把產品規則重新寫成模型規則

# Data Ownership

| 資料項目 | 正式權威 | 所有權 | 生命週期 | 說明 |
|---|---|---|---|---|
| `eventQueue` | 正式事件模型 | 事件系統 | 事件來源成立到全部事件完成 | 保存待處理正式事件的順序，不允許在未完成前改變正式順序 |
| `currentEvent` | 正式事件模型 | 事件系統 | 佇列前端被取出到事件完成 | 同一時間只能有一個目前事件 |
| `eventLayer` | 正式事件模型 | 事件系統 | 事件建立時到事件收束 | 用於區分共享事件、共享事件樣態與在地事件流程 |
| `ownerPlayerId` | 正式事件模型 | 對應的玩家事件擁有者 | 事件建立到事件完成 | 表示哪一位玩家負責該事件的主要正式處理 |
| `sharedResponses` | 共享事件 | 符合資格的回覆玩家集合 | 共享事件建立到全部回覆完成 | 保存共同參與的正式回覆，不取代主事件所有權 |
| `blockingScope` | 完成與阻塞模型 | 事件系統 | 事件進行到事件完成 | 指出事件是阻塞回合、阻塞事件鏈，或僅阻塞自身完成 |
| `followUpEvents` | 事件鏈 | 原事件與後續事件系統 | 原事件結算到後續事件完成 | 表示同一正式事件鏈中的後續事件，不可被視為例外流程 |
| `completionResult` | 完成與收束模型 | 事件系統 | 事件完成後到下游承接完成 | 只保存正式結果，不作為新的產品規則來源 |
| `localEventState` | 在地事件流程 | 對應的主事件 | 主事件開始到主事件完成 | 只描述附屬流程狀態，不作為獨立正式事件來源 |

撰寫原則如下：

- 必須指出每一類資料的正式權威來源
- 必須指出資料由哪一層文件定義責任
- 必須指出資料從建立到結束的生命週期邊界
- 不得以本文件覆蓋上游已定義的正式來源

# State Model

| 狀態名稱 | 用途 | 進入條件 | 離開條件 | 正式來源 |
|---|---|---|---|---|
| 待建立 | 事件來源已成立，但尚未進入正式事件系統 | 正式事件來源成立 | 建立正式事件並排入佇列 | `docs/gdd/EVENT_SYSTEM.md` |
| 已排隊 | 事件已進入正式佇列等待處理 | 事件被正式加入 Queue | 取得目前事件處理權 | `docs/gdd/EVENT_SYSTEM.md` |
| 進行中 | 事件正在被正式處理 | 佇列前端事件被取為目前事件 | 進入揭示、結算、等待回覆或完成 | `docs/gdd/EVENT_SYSTEM.md` |
| 已揭示 | 事件內容已正式公開 | 事件要求先揭示且已完成揭示 | 進入結算或等待必要回覆 | `docs/gdd/CARD_SYSTEM.md`、`docs/gdd/MARKET_SYSTEM.md` |
| 等待回覆 | 共享事件仍在等待必要回覆 | 事件進入共享事件層且尚未收齊回覆 | 所有必要回覆完成 | `docs/gdd/FAMILY_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md` |
| 結算中 | 正式結果正在套用 | 揭示完成且開始套用結果 | 結算完成或進入後續事件等待 | `docs/gdd/CARD_SYSTEM.md`、`docs/gdd/FINANCIAL_SYSTEM.md` |
| 等待後續事件 | 原事件已產生正式後續事件鏈 | 結算後產生後續事件 | 所有後續事件完成 | `docs/gdd/CARD_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md` |
| 可完成 | 事件本體與必要後續皆已結束 | 所有必要條件成立 | 正式收束完成 | `docs/gdd/EVENT_SYSTEM.md` |
| 已完成 | 事件已正式結束 | 完成條件驗證通過且已收束 | 交還流程控制 | `docs/gdd/EVENT_SYSTEM.md` |

若本文件不涉及正式狀態，應明確註記「本文件不管理正式狀態模型」。

# Lifecycle

```text
開始
  ->
事件來源成立
  ->
建立正式事件
  ->
排入事件佇列
  ->
成為目前事件
  ->
若需要，先揭示
  ->
執行正式結算
  ->
若需要，共享事件等待回覆
  ->
若產生後續事件，排入並完成後續事件鏈
  ->
驗證完成條件
  ->
事件收束
  ->
推進下一事件或交還回合流程
  ->
完成
```

本文件的生命週期重點只有三個：

1. 事件必須先成為正式事件，才可進入 Queue。
2. 共享事件與在地事件流程都不能繞過正式事件本體。
3. 事件未完成前，回合不得因該事件而切換至下一位玩家。

# Dependency

## Upstream

| 文件 | 依賴原因 |
|---|---|
| `docs/architecture/ARCHITECTURE.md` | 提供整體架構分層、模組邊界與正式依賴方向 |
| `docs/architecture/STATE_MODEL.md` | 提供正式狀態分類、所有權與同步副本邊界 |
| `docs/spec/PRODUCT_SPECIFICATION.md` | 正式事件、回合阻塞、揭示與後續事件的唯一產品規格來源 |
| `docs/decision/TURN_DECISION.md` | 定義事件完成前不得切換下一位玩家的正式邊界 |
| `docs/decision/EVENT_DECISION.md` | 定義事件三層模型與正式 Queue 規則 |
| `docs/decision/CARD_DECISION.md` | 定義後續卡與家庭歷程作為正式事件鏈的一部分 |
| `docs/decision/BANK_DECISION.md` | 定義銀行事件與銀行服務窗口分層 |
| `docs/decision/FINANCIAL_DECISION.md` | 定義正式交易成立與里程碑分離 |
| `docs/decision/ASSET_DECISION.md` | 定義正式權威、所有權與附掛邊界 |
| `docs/decision/STATE_DECISION.md` | 定義正式權威與同步副本邊界 |
| `docs/decision/PROFESSION_DECISION.md` | 定義學校、職業與終身學習的正式邊界 |
| `docs/gdd/GDD_INDEX.md` | 確認事件模型在整體 GDD 中的位置與依賴順序 |
| `docs/gdd/TURN_SYSTEM.md` | 回合完成與阻塞規則 |
| `docs/gdd/EVENT_SYSTEM.md` | 事件模型、Queue 與完成規則 |
| `docs/gdd/CARD_SYSTEM.md` | 卡片事件、後續卡與家庭歷程邊界 |
| `docs/gdd/BANK_SYSTEM.md` | 銀行事件邊界 |
| `docs/gdd/FINANCIAL_SYSTEM.md` | 財務成立邊界 |
| `docs/gdd/BOARD_SYSTEM.md` | 棋盤事件入口邊界 |
| `docs/gdd/ASSET_SYSTEM.md` | 資產所有權與附掛邊界 |
| `docs/gdd/SCHOOL_SYSTEM.md` | 學校事件與考後幸福卡邊界 |
| `docs/gdd/HOSPITAL_SYSTEM.md` | 醫院事件與停回合邊界 |
| `docs/gdd/REPAIR_SYSTEM.md` | 維修廠事件與停回合邊界 |
| `docs/gdd/FAMILY_SYSTEM.md` | 共同參與、等待與收束邊界 |
| `docs/gdd/MARKET_SYSTEM.md` | 揭示後行情與市場更新邊界 |

## Downstream

| 文件 | 被依賴原因 |
|---|---|
| `docs/architecture/DATA_MODEL.md` | 事件的欄位責任需以正式事件模型為基礎 |
| `docs/architecture/MULTIPLAYER_MODEL.md` | 多人共享、等待與同步邊界需建立在正式事件模型之上 |

## Related

| 文件 | 關聯原因 |
|---|---|
| `docs/architecture/ARCHITECTURE.md` | 作為整體架構總覽，提供事件模型的上層定位 |
| `docs/architecture/STATE_MODEL.md` | 事件生命週期依賴正式狀態模型，但不反向定義其內容 |

撰寫原則如下：

- Upstream 只能列出正式上游來源
- Downstream 只能列出正式承接本文件的下游文件
- Related 只能列出需要交叉引用但不構成正式依賴的文件
- 不得讓依賴方向形成循環

# Edge Cases

| 情境 | 風險 | 正式處理方式 |
|---|---|---|
| 同一次移動或同一次卡片鏈同時產生多個事件 | 事件順序可能被打亂 | 必須依正式產生順序排入 Queue，前一事件未完成前後一事件不得開始 |
| 共享事件尚未收齊回覆 | 主事件可能被提早完成 | 來源事件必須維持阻塞，直到所有必要回覆完成 |
| 在地事件流程尚未結束 | 主事件可能誤判為完成 | 在地事件流程只要仍是完成必要條件，來源事件就不得完成 |
| 事件已完成但下游尚未承接 | 正式結果可能遺失 | 完成結果必須先固定，再交由下游 GDD 承接 |
| 玩家或流程試圖繞過事件佇列 | 事件順序與權責可能失真 | 不得繞過 Queue；所有正式事件都必須先進入正式事件模型 |
| 事件尚未完成但回合想切換 | 可能破壞回合邊界 | 只要事件仍阻塞，回合就不得切換至下一位玩家 |
| 遊戲已正式結束 | 仍可能嘗試建立新事件 | 所有事件入口立即封鎖，不再建立、揭示或結算任何事件 |

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
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/STATE_MODEL.md`

# Writing Rules

1. 不得重新定義 Product Specification。
2. 不得重新定義任何已確認決策。
3. 不得重新定義任何 Core GDD。
4. 不得重新定義任何 Domain GDD。
5. 不得新增產品玩法。
6. 不得新增產品規則。
7. 只能描述：
   - 架構
   - 模型
   - 狀態
   - 資料
   - 同步
   - 責任
   - 依賴
8. 不得描述具體實作技術、介面細節、同步機制、儲存方式或程式細節。
9. 不得把在地事件流程寫成正式事件本體。
10. 不得讓共享事件回覆機制取代主事件所有權。

# Modular Design Rules

- 本文件只負責正式事件模型，不承擔回合、資料模型或多人模型的全部責任。
- 事件佇列、目前事件、共享事件與在地事件流程必須維持清楚分層。
- 正式事件本體與下游結果承接必須清楚分離，不得混為同一層責任。
- 事件模型只能依賴上游正式來源，不得反向改寫任何 GDD。
- 所有事件依賴方向必須維持 DAG，不得形成循環依賴。

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

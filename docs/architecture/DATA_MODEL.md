# Metadata

| 項目 | 內容 |
|---|---|
| Status | Draft |
| Owner | 汪家慶 |
| Last Updated | 2026-07-02 |
| Related Specification | `docs/spec/PRODUCT_SPECIFICATION.md` |
| Related Decision | `docs/decision/DECISION_INDEX.md`、`docs/decision/ARCHITECTURE_DECISION.md`、`docs/decision/STATE_DECISION.md` |
| Related GDD | `docs/gdd/GDD_INDEX.md`、所有 Core GDD、所有 Domain GDD |
| Version | v1.0 |

# Purpose

本文件是 Architecture GDD 中負責正式資料模型的文件。

本文件只負責把已確認的上游正式規則整理成可維護、可引用、可追溯的資料模型，涵蓋以下範圍：

- Entity
- Relationship
- Aggregate
- Attachment
- Reference
- Identity
- Data Ownership

本文件不重新定義產品玩法，也不重新定義任何上游正式規則。

# Scope

## 本文件負責

- 定義正式 Entity 的資料邊界
- 定義正式 Relationship 的資料邊界
- 定義正式 Aggregate 的收斂邊界
- 定義正式 Attachment 的附掛邊界
- 定義正式 Reference 與 Identity 的指向方式
- 定義正式 Data Ownership 與 Source of Truth
- 定義正式同步副本與正式權威之間的邊界

## 本文件不負責

- 重新定義 Product Specification
- 重新定義任何 Confirmed Decision
- 重新定義任何 Core GDD
- 重新定義任何 Domain GDD
- 重新定義玩法、規則、流程或數值
- 描述具體實作技術、介面細節、同步機制或程式碼

## 邊界原則

- Product Specification 定義正式玩法與規則
- Decision 定義已確認的產品拍板結果
- Core GDD 與 Domain GDD 定義系統責任與正式語意
- Architecture GDD 只整理資料模型、責任邊界與權威來源

# Related Documents

## Product Specification

| 文件 | 用途 |
|---|---|
| `docs/spec/PRODUCT_SPECIFICATION.md` | 唯一正式產品規格來源 |

## Decision

| 文件 | 用途 |
|---|---|
| `docs/decision/DECISION_INDEX.md` | 已確認決策索引 |
| `docs/decision/ARCHITECTURE_DECISION.md` | 架構責任、同步邊界與權威順序的正式決策來源 |
| `docs/decision/STATE_DECISION.md` | Source of Truth、同步副本與 legacy 邊界的正式決策來源 |
| `docs/decision/TURN_DECISION.md` | 回合完成、切換與阻塞邊界的正式決策來源 |
| `docs/decision/EVENT_DECISION.md` | 事件層級、事件完成與事件鏈的正式決策來源 |
| `docs/decision/CARD_DECISION.md` | 卡片生命週期、後續卡與家庭歷程的正式決策來源 |
| `docs/decision/BANK_DECISION.md` | 銀行事件與銀行服務窗口分層的正式決策來源 |
| `docs/decision/FINANCIAL_DECISION.md` | 財務檢核、負債權威、價格權威與里程碑邊界的正式決策來源 |
| `docs/decision/ASSET_DECISION.md` | 資產所有權、附掛模型與市場資料結構的正式決策來源 |
| `docs/decision/PROFESSION_DECISION.md` | 職業、升等與學校邊界的正式決策來源 |

## Core GDD

| 文件 | 用途 |
|---|---|
| `docs/gdd/GDD_INDEX.md` | GDD 權威索引 |
| `docs/gdd/TURN_SYSTEM.md` | 回合資料與回合阻塞邊界來源 |
| `docs/gdd/EVENT_SYSTEM.md` | 事件資料、事件佇列與事件完成邊界來源 |
| `docs/gdd/CARD_SYSTEM.md` | 卡片資料、牌堆與卡片生命週期來源 |
| `docs/gdd/BANK_SYSTEM.md` | 銀行事件、服務窗口與金融入口邊界來源 |
| `docs/gdd/FINANCIAL_SYSTEM.md` | 財務交易、結算、負債與正式交易來源 |
| `docs/gdd/BOARD_SYSTEM.md` | 棋盤位置、格子入口與經過/停留邊界來源 |
| `docs/gdd/ASSET_SYSTEM.md` | 資產所有權、附掛狀態與正式來源邊界 |

## Domain GDD

| 文件 | 用途 |
|---|---|
| `docs/gdd/INSURANCE_SYSTEM.md` | 保險附掛、保費與理賠資料邊界來源 |
| `docs/gdd/LOAN_SYSTEM.md` | 貸款附掛、清償與自動償還資料邊界來源 |
| `docs/gdd/MARKET_SYSTEM.md` | 市場行情、價格與股利資料邊界來源 |
| `docs/gdd/SCHOOL_SYSTEM.md` | 學校事件與考後幸福卡資料邊界來源 |
| `docs/gdd/HOSPITAL_SYSTEM.md` | 醫院事件、醫療費與停回合資料邊界來源 |
| `docs/gdd/REPAIR_SYSTEM.md` | 維修廠事件、保養費與停回合資料邊界來源 |
| `docs/gdd/PROFESSION_SYSTEM.md` | 職業、職級、薪資與終身學習資料邊界來源 |
| `docs/gdd/DREAM_SYSTEM.md` | 人生夢想與里程碑資料邊界來源 |
| `docs/gdd/HAPPINESS_SYSTEM.md` | 幸福值、里程碑與最終評分資料邊界來源 |
| `docs/gdd/FAMILY_SYSTEM.md` | 家庭歷程、共同參與與回覆資料邊界來源 |
| `docs/gdd/REAL_ESTATE_SYSTEM.md` | 房屋、自住、出租、房貸與房屋保險資料邊界來源 |
| `docs/gdd/BUSINESS_SYSTEM.md` | 企業、收購、升級、現金流與企業貸款資料邊界來源 |

## Architecture

| 文件 | 用途 |
|---|---|
| `docs/architecture/ARCHITECTURE_INDEX.md` | Architecture Layer 索引 |
| `docs/architecture/ARCHITECTURE.md` | 整體架構總覽的正式上游文件 |
| `docs/architecture/STATE_MODEL.md` | 正式狀態模型的上游文件 |
| `docs/architecture/EVENT_MODEL.md` | 正式事件模型的上游文件 |
| `docs/architecture/MULTIPLAYER_MODEL.md` | 正式多人模型的下游承接文件 |

# Architecture Principles

| 原則 | 說明 |
|---|---|
| Single Responsibility | 一份 Architecture 文件只負責單一模型層級 |
| High Cohesion | 同一份文件內的內容必須聚焦於同一種資料責任 |
| Low Coupling | 各文件之間只保留必要依賴，不建立多餘橫向耦合 |
| Single Source of Truth | 正式資料與正式責任只能有一份權威來源 |
| Layered Architecture | 資料模型必須服從 Product Specification -> Decision -> GDD -> Architecture -> Code |
| Modular Design | 每份文件都應可獨立維護、獨立引用、獨立審查 |
| DAG | 文件依賴必須形成有向無環圖 |
| Separation of Concerns | 不同文件只處理自己的資料責任，不跨層混寫 |

# Architecture Model

| 模型名稱 | 說明 | 邊界 | 上游來源 |
|---|---|---|---|
| 身分與識別模型 | 以 Identity 管理玩家、事件、卡片、資產、貸款、市場標的與里程碑的唯一識別。 | Identity 只負責指向，不負責所有權；同一識別不得跨不同實體類型混用。 | `docs/decision/STATE_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md`、`docs/gdd/GDD_INDEX.md`、`docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md`、`docs/gdd/ASSET_SYSTEM.md` |
| 權威與副本模型 | 以 Data Ownership 區分 Source of Truth、同步副本、快取與衍生資料。 | 同步副本只可反映正式權威，不可反向成為正式資料來源。 | `docs/decision/STATE_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md`、`docs/gdd/FINANCIAL_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md`、`docs/gdd/MARKET_SYSTEM.md` |
| 事件與卡片模型 | 以 Aggregate 管理事件佇列、事件鏈、卡片事件與家庭事件的正式收斂。 | 事件聚合只承接正式事件責任；卡片聚合只承接卡片生命週期責任；家庭事件只承接共同參與與收束責任。 | `docs/gdd/TURN_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md`、`docs/gdd/FAMILY_SYSTEM.md` |
| 資產與附掛模型 | 以 Aggregate 管理資產所有權與附掛關係，並將保險與貸款視為附著於資產的正式關聯。 | 附掛只能掛在對應資產上；附件不可獨立取代資產所有權。 | `docs/gdd/ASSET_SYSTEM.md`、`docs/gdd/INSURANCE_SYSTEM.md`、`docs/gdd/LOAN_SYSTEM.md`、`docs/gdd/REAL_ESTATE_SYSTEM.md`、`docs/gdd/BUSINESS_SYSTEM.md` |
| 財務與交易模型 | 以 Transaction、Settlement、Debt 與 Financial Check 管理正式金額與結算結果。 | 交易紀錄是正式結果；結算摘要不是權威來源；負債與資產變動必須可追溯。 | `docs/gdd/FINANCIAL_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md`、`docs/gdd/LOAN_SYSTEM.md`、`docs/gdd/INSURANCE_SYSTEM.md`、`docs/gdd/PROFESSION_SYSTEM.md` |
| 市場與估值模型 | 以 Market Item、Current Price、Previous Price 與 Update Source 管理正式行情。 | 現行行情是正式權威；前次行情只作比較；市場資料不得改寫資產所有權。 | `docs/gdd/MARKET_SYSTEM.md`、`docs/gdd/ASSET_SYSTEM.md`、`docs/gdd/FINANCIAL_SYSTEM.md` |
| 幸福、夢想與家庭結果模型 | 以結果導向的 Reference 連結幸福值、人生夢想與家庭歷程的正式承接。 | 這些結果只承接正式結果，不重新定義上游玩法或最終評分來源。 | `docs/gdd/HAPPINESS_SYSTEM.md`、`docs/gdd/DREAM_SYSTEM.md`、`docs/gdd/FAMILY_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md` |

# Data Ownership

| 資料項目 | 正式權威 | 所有權 | 生命週期 | 說明 |
|---|---|---|---|---|
| 玩家身分與識別 | `docs/decision/STATE_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md` | 玩家本身的正式識別 | 建立 -> 驗證 -> 使用 -> 封存 | 只作為所有其他資料的 Identity，不代表資料內容本身 |
| 回合資料 | `docs/gdd/TURN_SYSTEM.md` | 當前回合玩家與回合系統 | 開始 -> 進行 -> 阻塞 -> 完成 -> 切換 | 回合資料只描述操作權，不描述其他系統結果 |
| 事件資料 | `docs/gdd/EVENT_SYSTEM.md` | 事件擁有者；共享事件的回覆屬各自回覆者 | 建立 -> 排隊 -> 執行 -> 完成 -> 收束 | 事件鏈、後續事件與共享回覆都屬同一正式事件責任 |
| 卡片資料 | `docs/gdd/CARD_SYSTEM.md` | 卡片事件擁有者；家庭卡的回覆屬各自參與者 | 抽牌 -> 揭示 -> 結算 -> 完成 -> 棄置 | 牌堆、卡片事件與後續卡都屬卡片系統資料 |
| 資產資料 | `docs/gdd/ASSET_SYSTEM.md` | 資產持有人 | 取得 -> 持有 -> 附掛 -> 出售/處分 -> 封存 | 只承認單一正式所有權；附掛關係從屬於資產 |
| 附掛資料 | `docs/gdd/ASSET_SYSTEM.md`、`docs/gdd/INSURANCE_SYSTEM.md`、`docs/gdd/LOAN_SYSTEM.md` | 對應資產的持有人 | 建立 -> 有效 -> 終止 -> 封存 | 保險與貸款皆以附掛方式存在，不獨立取代資產 |
| 財務交易資料 | `docs/gdd/FINANCIAL_SYSTEM.md` | 交易主體所屬玩家 | 檢核 -> 成立 -> 記錄 -> 封存 | 交易紀錄是正式結果，結算摘要只屬承接資料 |
| 負債資料 | `docs/gdd/FINANCIAL_SYSTEM.md`、`docs/gdd/LOAN_SYSTEM.md` | 借款人 | 成立 -> 還款 -> 清償 -> 封存 | 強制負債與一般貸款都必須可追溯正式來源 |
| 市場資料 | `docs/gdd/MARKET_SYSTEM.md` | 對應市場標的的正式權威 | 來源 -> 揭示 -> 更新 -> 生效 -> 封存 | 現行行情可被引用，前次行情只供比較 |
| 幸福資料 | `docs/gdd/HAPPINESS_SYSTEM.md` | 玩家幸福值的正式權威 | 變動 -> 記錄 -> 里程碑 -> 封存 | 幸福值是結果資料，不是其他系統的附屬副本 |
| 夢想資料 | `docs/gdd/DREAM_SYSTEM.md` | 玩家本人 | 建立 -> 進行 -> 完成 -> 封存 | 夢想完成是里程碑，不是遊戲結束權威 |
| 家庭事件資料 | `docs/gdd/FAMILY_SYSTEM.md`、`docs/gdd/CARD_SYSTEM.md`、`docs/gdd/EVENT_SYSTEM.md` | 家庭事件主責玩家；各參與者只擁有自己的回覆 | 建立 -> 等待 -> 收束 -> 完成 -> 封存 | 家庭結果必須先完成共同參與，才能交由下游承接 |
| 同步副本與快取資料 | `docs/decision/STATE_DECISION.md`、`docs/decision/ARCHITECTURE_DECISION.md` | 不擁有正式權威 | 同步 -> 暫存 -> 更新 -> 釋放 | 只能反映正式權威，不能取代正式資料 |

# State Model

本文件不管理正式狀態模型。

# Lifecycle

本文件不管理正式生命周期。

# Dependency

## Upstream

| 文件 | 依賴原因 |
|---|---|
| `docs/spec/PRODUCT_SPECIFICATION.md` | 正式資料語意的唯一產品來源 |
| `docs/decision/DECISION_INDEX.md` | 已確認決策的索引入口 |
| `docs/decision/ARCHITECTURE_DECISION.md` | 架構責任與同步邊界的正式決策來源 |
| `docs/decision/STATE_DECISION.md` | Source of Truth 與同步邊界的正式決策來源 |
| `docs/decision/TURN_DECISION.md` | 回合資料邊界的正式決策來源 |
| `docs/decision/EVENT_DECISION.md` | 事件資料與事件鏈的正式決策來源 |
| `docs/decision/CARD_DECISION.md` | 卡片資料與卡片生命週期的正式決策來源 |
| `docs/decision/BANK_DECISION.md` | 銀行資料與金融入口的正式決策來源 |
| `docs/decision/FINANCIAL_DECISION.md` | 財務資料、負債權威與價格權威的正式決策來源 |
| `docs/decision/ASSET_DECISION.md` | 資產、附掛與市場資料結構的正式決策來源 |
| `docs/decision/PROFESSION_DECISION.md` | 職業資料與學校邊界的正式決策來源 |
| `docs/gdd/GDD_INDEX.md` | Core GDD 與 Domain GDD 的權威索引 |
| `docs/gdd/TURN_SYSTEM.md` | 回合資料與回合完成邊界來源 |
| `docs/gdd/EVENT_SYSTEM.md` | 事件資料與事件完成邊界來源 |
| `docs/gdd/CARD_SYSTEM.md` | 卡片資料與卡片生命週期來源 |
| `docs/gdd/BANK_SYSTEM.md` | 銀行事件與金融入口來源 |
| `docs/gdd/FINANCIAL_SYSTEM.md` | 財務交易、結算與負債來源 |
| `docs/gdd/BOARD_SYSTEM.md` | 棋盤位置與格子入口來源 |
| `docs/gdd/ASSET_SYSTEM.md` | 資產所有權與附掛來源 |
| `docs/gdd/INSURANCE_SYSTEM.md` | 保險附掛與理賠來源 |
| `docs/gdd/LOAN_SYSTEM.md` | 貸款附掛與清償來源 |
| `docs/gdd/MARKET_SYSTEM.md` | 市場行情與估值引用來源 |
| `docs/gdd/SCHOOL_SYSTEM.md` | 學校事件與考後結果來源 |
| `docs/gdd/HOSPITAL_SYSTEM.md` | 醫院事件與醫療費來源 |
| `docs/gdd/REPAIR_SYSTEM.md` | 維修廠事件與保養費來源 |
| `docs/gdd/PROFESSION_SYSTEM.md` | 職業、升等與薪資來源 |
| `docs/gdd/DREAM_SYSTEM.md` | 人生夢想與里程碑來源 |
| `docs/gdd/HAPPINESS_SYSTEM.md` | 幸福值與最終評分來源 |
| `docs/gdd/FAMILY_SYSTEM.md` | 家庭歷程與共同參與來源 |
| `docs/gdd/REAL_ESTATE_SYSTEM.md` | 房屋、自住、出租、房貸與房屋保險來源 |
| `docs/gdd/BUSINESS_SYSTEM.md` | 企業、收購、升級、現金流與企業貸款來源 |
| `docs/architecture/ARCHITECTURE.md` | 整體架構總覽的正式上游文件 |
| `docs/architecture/STATE_MODEL.md` | 正式狀態模型的上游文件 |
| `docs/architecture/EVENT_MODEL.md` | 正式事件模型的上游文件 |

## Downstream

| 文件 | 被依賴原因 |
|---|---|
| `docs/architecture/MULTIPLAYER_MODEL.md` | 多人同步、一致性與等待條件必須承接本文件的資料權威與附掛邊界 |

## Related

| 文件 | 關聯原因 |
|---|---|
| `docs/architecture/ARCHITECTURE_INDEX.md` | Architecture Layer 的索引入口 |
| `docs/architecture/ARCHITECTURE_TEMPLATE.md` | 本文件的格式參考來源 |

# Edge Cases

| 情境 | 風險 | 正式處理方式 |
|---|---|---|
| 同一份資料同時出現在正式權威與同步副本 | 副本可能被誤認為權威 | 只承認正式權威；同步副本只能回寫或重建，不可反向定義資料 |
| 同一 Identity 被不同實體重複使用 | 可能混淆 Entity 邊界 | 以實體類型區分識別命名空間，跨實體關聯必須使用明確 Reference |
| Attachment 在資產移轉後仍殘留 | 可能出現懸掛關聯 | 附掛必須跟著資產所有權一起檢查與終止，不能獨立存活 |
| 共享資料與私人資料混寫 | 可能洩漏非擁有者資料 | 共享資料只承認共享欄位，私人資料只由擁有者或正式回覆者持有 |
| 後續事件或後續卡沿用原本識別 | 可能把新 Entity 與舊 Entity 混為一體 | 新事件或新卡必須有新 Identity，但仍可透過 Reference 指回來源 |
| 里程碑達成後仍有未完成資料變動 | 可能誤把里程碑當成封存點 | 里程碑只是一種正式結果，不會自動終止外層資料的生命週期 |
| 同一資料在不同文件被重複描述 | 可能出現權威衝突 | 只允許上游文件定義正式責任；本文件只做資料模型收斂與引用 |

# References

## Product Specification

- `docs/spec/PRODUCT_SPECIFICATION.md`

## Decision

- `docs/decision/DECISION_INDEX.md`
- `docs/decision/ARCHITECTURE_DECISION.md`
- `docs/decision/STATE_DECISION.md`
- `docs/decision/TURN_DECISION.md`
- `docs/decision/EVENT_DECISION.md`
- `docs/decision/CARD_DECISION.md`
- `docs/decision/BANK_DECISION.md`
- `docs/decision/FINANCIAL_DECISION.md`
- `docs/decision/ASSET_DECISION.md`
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
   - 所有權
   - 關聯
   - 依賴
8. 不得描述具體實作技術、介面細節、同步機制、儲存方式或程式細節。
9. 不得把同步副本、快取或衍生資料寫成正式權威。
10. 不得把附掛關係寫成獨立於主資產所有權之外的第二正式來源。

# Modular Design Rules

- 本文件只負責正式資料模型，不承擔事件流程或多人同步流程的全部責任。
- Entity、Relationship、Aggregate、Attachment、Reference 與 Identity 必須清楚分層。
- 正式權威與同步副本必須分離，不得形成雙重正式來源。
- 資料模型只能承接上游規則與 GDD，不得反向改寫它們。
- 所有資料依賴方向必須維持 DAG，不得形成循環依賴。

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

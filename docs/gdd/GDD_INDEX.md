# GDD Index

## 1. Purpose

本文件是《幸福流》整個專案的 GDD 索引文件。

它的用途只有三個：

- 整理目前已存在的正式 GDD
- 整理未來仍需建立的 GDD
- 說明各份 GDD 之間的依賴關係與建議閱讀順序

本文件不是 RFC，不負責討論現況問題。

本文件不是 Product Specification，不重新定義產品規則。

本文件不是 Decision，不負責記錄產品拍板過程。

本文件中的 GDD 定位如下：

- Product Specification：唯一正式產品規格
- Decision：產品拍板紀錄
- GDD：系統設計文件
- Code：實作

正式文件權威順序如下：

`Product Specification -> Decision -> GDD -> Code`

## 2. 文件依賴順序

整體文件依賴順序如下：

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

各層職責如下：

- Product Specification：定義玩家真正玩的正式規則
- Decision：記錄已確認的產品決策
- Core GDD：定義核心系統如何設計與彼此互動
- Domain GDD：定義各子系統的細部規則與資料結構
- Architecture GDD：定義整體系統模型、資料模型與多人同步設計
- Code：依據上述文件完成實作

## 3. Core GDD

目前已存在的 Core GDD 如下。

| 文件 | 用途 | 依賴哪些 GDD | 被哪些 GDD 依賴 |
|---|---|---|---|
| `TURN_SYSTEM.md` | 定義單一回合的正式流程、回合完成條件、切換條件與阻塞原則 | 無 | `EVENT_SYSTEM.md`、`BOARD_SYSTEM.md`、`BANK_SYSTEM.md`、`CARD_SYSTEM.md` |
| `EVENT_SYSTEM.md` | 定義正式事件模型、事件層級、完成條件與事件阻塞規則 | `TURN_SYSTEM.md` | `BOARD_SYSTEM.md`、`CARD_SYSTEM.md`、`BANK_SYSTEM.md`、`SCHOOL_SYSTEM.md`、`HOSPITAL_SYSTEM.md`、`REPAIR_SYSTEM.md`、`FAMILY_SYSTEM.md` |
| `CARD_SYSTEM.md` | 定義抽牌、揭示、結算、後續卡與家庭歷程卡片規則 | `TURN_SYSTEM.md`、`EVENT_SYSTEM.md`、`BOARD_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | `HAPPINESS_SYSTEM.md`、`FAMILY_SYSTEM.md`、`MARKET_SYSTEM.md`、`BUSINESS_SYSTEM.md` |
| `BANK_SYSTEM.md` | 定義銀行事件、月結餘、銀行服務窗口與金融功能權限 | `TURN_SYSTEM.md`、`EVENT_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | `BOARD_SYSTEM.md`、`ASSET_SYSTEM.md`、`INSURANCE_SYSTEM.md`、`LOAN_SYSTEM.md` |
| `FINANCIAL_SYSTEM.md` | 定義正式交易、現金、收入、支出、負債、財務檢核與自動償還 | 無 | `BANK_SYSTEM.md`、`CARD_SYSTEM.md`、`ASSET_SYSTEM.md`、`LOAN_SYSTEM.md`、`INSURANCE_SYSTEM.md`、`MARKET_SYSTEM.md`、`REAL_ESTATE_SYSTEM.md`、`BUSINESS_SYSTEM.md`、`DREAM_SYSTEM.md`、`PROFESSION_SYSTEM.md`、`HAPPINESS_SYSTEM.md` |
| `BOARD_SYSTEM.md` | 定義棋盤、移動、經過、停留、特殊格與棋盤事件入口 | `TURN_SYSTEM.md`、`EVENT_SYSTEM.md`、`BANK_SYSTEM.md` | `CARD_SYSTEM.md`、`SCHOOL_SYSTEM.md`、`HOSPITAL_SYSTEM.md`、`REPAIR_SYSTEM.md`、`MARKET_SYSTEM.md` |
| `ASSET_SYSTEM.md` | 定義正式資產類別、所有權、購買出售、估值與資產附掛狀態 | `BANK_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | `INSURANCE_SYSTEM.md`、`LOAN_SYSTEM.md`、`MARKET_SYSTEM.md`、`REAL_ESTATE_SYSTEM.md`、`BUSINESS_SYSTEM.md` |

## 4. Domain GDD

以下為 Domain GDD 清單，包含已建立文件與後續仍需建立的文件。

| 文件 | 用途 | 依賴 | 被依賴 |
|---|---|---|---|
| `INSURANCE_SYSTEM.md` | 定義醫療保險、房屋保險、汽車保險、保費與理賠 | `BANK_SYSTEM.md`、`FINANCIAL_SYSTEM.md`、`ASSET_SYSTEM.md` | `REAL_ESTATE_SYSTEM.md`、`REPAIR_SYSTEM.md` |
| `LOAN_SYSTEM.md` | 定義信用貸款、房貸、車貸、企業貸款、強制負債與還款規則 | `BANK_SYSTEM.md`、`FINANCIAL_SYSTEM.md`、`ASSET_SYSTEM.md` | `REAL_ESTATE_SYSTEM.md`、`BUSINESS_SYSTEM.md` |
| `MARKET_SYSTEM.md` | 定義股票市場、房市、企業市場、股利與市場變動 | `CARD_SYSTEM.md`、`FINANCIAL_SYSTEM.md`、`BOARD_SYSTEM.md`、`ASSET_SYSTEM.md` | `REAL_ESTATE_SYSTEM.md`、`BUSINESS_SYSTEM.md` |
| `SCHOOL_SYSTEM.md` | 定義學校事件、考試、升等與考後幸福卡 | `TURN_SYSTEM.md`、`EVENT_SYSTEM.md`、`BOARD_SYSTEM.md`、`CARD_SYSTEM.md` | `PROFESSION_SYSTEM.md` |
| `HOSPITAL_SYSTEM.md` | 定義醫院事件、醫療費、停回合與完成條件 | `TURN_SYSTEM.md`、`EVENT_SYSTEM.md`、`BOARD_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | 無 |
| `REPAIR_SYSTEM.md` | 定義維修廠事件、保養費、汽車判定與停回合 | `TURN_SYSTEM.md`、`EVENT_SYSTEM.md`、`BOARD_SYSTEM.md`、`FINANCIAL_SYSTEM.md`、`ASSET_SYSTEM.md` | 無 |
| `PROFESSION_SYSTEM.md` | 定義職業、薪資、職等、升等與職業成長規則 | `FINANCIAL_SYSTEM.md`、`SCHOOL_SYSTEM.md` | 無 |
| `DREAM_SYSTEM.md` | 定義人生夢想、完成條件與其評分意義 | `FINANCIAL_SYSTEM.md`、`HAPPINESS_SYSTEM.md` | 無 |
| `HAPPINESS_SYSTEM.md` | 定義幸福值來源、幸福項目、里程碑與最終計分 | `CARD_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | `DREAM_SYSTEM.md`、`FAMILY_SYSTEM.md` |
| `FAMILY_SYSTEM.md` | 定義家庭歷程、共同參與、等待條件與完成條件 | `EVENT_SYSTEM.md`、`CARD_SYSTEM.md`、`HAPPINESS_SYSTEM.md` | 無 |
| `REAL_ESTATE_SYSTEM.md` | 定義房屋、自住、出租、轉換、房屋保險與房市規則 | `ASSET_SYSTEM.md`、`FINANCIAL_SYSTEM.md`、`LOAN_SYSTEM.md`、`MARKET_SYSTEM.md`、`INSURANCE_SYSTEM.md` | 無 |
| `BUSINESS_SYSTEM.md` | 定義企業、收購、升級、現金流、企業貸款與企業卡規則 | `ASSET_SYSTEM.md`、`FINANCIAL_SYSTEM.md`、`LOAN_SYSTEM.md`、`MARKET_SYSTEM.md`、`CARD_SYSTEM.md` | 無 |

## 5. Architecture GDD

以下文件目前尚不存在，應列為未來 Architecture GDD。

| 文件 | 狀態 | 用途 |
|---|---|---|
| `ARCHITECTURE.md` | 未建立 | 定義整體系統分層、GDD 邊界與模組責任 |
| `STATE_MODEL.md` | 未建立 | 定義正式資料狀態模型、權威來源與同步副本邊界 |
| `EVENT_MODEL.md` | 未建立 | 定義事件模型、生命週期、完成條件與相依關係 |
| `DATA_MODEL.md` | 未建立 | 定義核心資料結構、欄位責任與正式資料模型 |
| `MULTIPLAYER_MODEL.md` | 未建立 | 定義多人同步規則、共享資料、等待條件與一致性要求 |

Architecture GDD 不應先於 Core GDD 與 Domain GDD 建立。

它們應在產品規則、核心系統與主要子系統已明確後，再作為整體整理文件。

## 6. 建議閱讀順序

建議閱讀順序如下。

此順序是閱讀與建立文件的建議順序，不代表系統只有單一路徑依賴。實際 GDD 依賴關係請以第 7 節的 DAG 依賴圖為準。

```text
PRODUCT_SPECIFICATION.md
  ->
TURN_SYSTEM.md
  ->
EVENT_SYSTEM.md
  ->
FINANCIAL_SYSTEM.md
  ->
BANK_SYSTEM.md
  ->
BOARD_SYSTEM.md
  ->
CARD_SYSTEM.md
  ->
ASSET_SYSTEM.md
  ->
INSURANCE_SYSTEM.md
  ->
LOAN_SYSTEM.md
  ->
MARKET_SYSTEM.md
  ->
SCHOOL_SYSTEM.md
  ->
HOSPITAL_SYSTEM.md
  ->
REPAIR_SYSTEM.md
  ->
PROFESSION_SYSTEM.md
  ->
HAPPINESS_SYSTEM.md
  ->
FAMILY_SYSTEM.md
  ->
DREAM_SYSTEM.md
  ->
REAL_ESTATE_SYSTEM.md
  ->
BUSINESS_SYSTEM.md
  ->
ARCHITECTURE.md
```

排序原則如下：

- 先讀產品規格，確認正式規則
- 再讀回合與事件，掌握整體流程
- 再讀棋盤、卡片、銀行、財務、資產，掌握主系統
- 再讀各子系統，掌握細部玩法
- 最後再讀整體架構模型

## 7. GDD Dependency Graph

GDD 依賴圖採用模組化 DAG（有向無環圖）思維，不採單一路徑依賴。

依賴圖如下：

```text
PRODUCT SPECIFICATION
│
├── TURN
│   ├── EVENT
│   │   ├── BOARD
│   │   │   ├── CARD
│   │   │   ├── SCHOOL
│   │   │   ├── HOSPITAL
│   │   │   ├── REPAIR
│   │   │   └── MARKET
│   │   ├── CARD
│   │   │   ├── HAPPINESS
│   │   │   ├── FAMILY
│   │   │   ├── MARKET
│   │   │   └── BUSINESS
│   │   ├── BANK
│   │   └── FAMILY
│   └── BANK
│
├── FINANCIAL
│   ├── BANK
│   ├── CARD
│   ├── ASSET
│   │   ├── INSURANCE
│   │   ├── LOAN
│   │   ├── MARKET
│   │   ├── REAL_ESTATE
│   │   └── BUSINESS
│   ├── HAPPINESS
│   ├── PROFESSION
│   └── DREAM
│
└── ARCHITECTURE GDD（最後整理）
    ├── ARCHITECTURE
    ├── STATE_MODEL
    ├── EVENT_MODEL
    ├── DATA_MODEL
    └── MULTIPLAYER_MODEL
```

主要依賴說明如下：

- `Product Specification -> 所有 GDD`
  - Product Specification 是唯一正式產品規格來源。
- `TURN -> EVENT`
  - 事件何時開始、何時完成、何時阻塞，先受回合規則約束。
- `TURN -> BANK`
  - 銀行事件仍屬回合中的正式事件步驟之一，不能脫離回合邊界。
- `EVENT -> BOARD`
  - 棋盤系統只負責建立事件入口，其後續完成模型由事件系統承接。
- `BANK -> BOARD`
  - 棋盤中的銀行格入口語意需引用銀行系統所定義的正式銀行事件與服務窗口邊界。
- `BOARD -> CARD / SCHOOL / HOSPITAL / REPAIR`
  - 卡片格與特殊格的入口都來自棋盤經過或停留判定。
- `EVENT -> CARD`
  - 卡片是正式事件的一種類型，必須遵守事件生命週期。
- `EVENT -> BANK`
  - 銀行事件作為正式事件，必須遵守事件系統的完成與阻塞模型。
- `CARD -> HAPPINESS / FAMILY / MARKET / BUSINESS`
  - 卡片可能觸發幸福、家庭、市場或企業相關效果。
- `FINANCIAL -> BANK`
  - 銀行事件中的月結餘、定存、保險、借款與還款都依財務規則成立。
- `FINANCIAL -> CARD`
  - 卡片中的金額、支付、資產與負債效果都需經過正式財務成立條件。
- `FINANCIAL -> ASSET`
  - 資產購買、出售、估值與負債都依財務規則結算。
- `ASSET -> INSURANCE / LOAN / MARKET / REAL_ESTATE / BUSINESS`
  - 保險、貸款、市場、房屋與企業都建立在正式資產模型上。
- `ARCHITECTURE GDD`
  - Architecture GDD 不重新定義產品規則，而是在 Core GDD 與 Domain GDD 穩定後整理整體架構。

依賴原則如下：

1. GDD 採模組化設計，不採單一路徑設計。
2. 一份 GDD 可以依賴多份上游 GDD。
3. 下游 GDD 不得反向修改上游 GDD 的正式規則。
4. Core GDD 可被 Domain GDD 引用。
5. Domain GDD 不得重新定義 Core GDD 的正式規則。
6. Product Specification 為所有 GDD 的唯一產品規格來源。
7. GDD 應形成有向無環圖（DAG），避免循環依賴。
8. 若發現循環依賴，應回到 GDD Index 或 Architecture GDD 重新定義責任邊界。

## 8. GDD 撰寫規範

所有 GDD 都必須遵守以下規則：

1. 不得重新定義產品規則。
   - 產品規則一律引用 `docs/spec/PRODUCT_SPECIFICATION.md`。
2. 不得重新討論 `Option`。
3. 不得保留 `Recommendation`。
4. 不得保留 `Need Confirmation`。
5. 不得保留 `Problem`。
6. 若產品規格或 Decision 已 Confirmed，必須直接作為正式規格使用。
7. 每份 GDD 至少必須包含以下章節：
   - `Purpose`
   - `Definitions`
   - `Data Model`
   - `State`
   - `Rules`
   - `Flow`
   - `State Machine`
   - `Edge Cases`
   - `References`

GDD 的任務是把已確認的產品規則轉成可設計、可落地、可實作的系統文件，而不是重新開啟規則討論。

## 9. 未來 GDD 建立順序

未來 GDD 建立順序如下：

1. `TURN_SYSTEM.md`
2. `EVENT_SYSTEM.md`
3. `FINANCIAL_SYSTEM.md`
4. `BANK_SYSTEM.md`
5. `BOARD_SYSTEM.md`
6. `CARD_SYSTEM.md`
7. `ASSET_SYSTEM.md`
8. `INSURANCE_SYSTEM.md`
9. `LOAN_SYSTEM.md`
10. `MARKET_SYSTEM.md`
11. `SCHOOL_SYSTEM.md`
12. `HOSPITAL_SYSTEM.md`
13. `REPAIR_SYSTEM.md`
14. `HAPPINESS_SYSTEM.md`
15. `FAMILY_SYSTEM.md`
16. `PROFESSION_SYSTEM.md`
17. `DREAM_SYSTEM.md`
18. `REAL_ESTATE_SYSTEM.md`
19. `BUSINESS_SYSTEM.md`
20. `ARCHITECTURE.md`

補充說明如下：

- 前 7 份屬於 Core GDD，目前已存在，但後續仍可依本索引重新整併與重建格式。
- 第 8 至 19 份屬於 Domain GDD，應依上位 GDD 已穩定之後再建立。
- `ARCHITECTURE.md` 應最後建立，作為整體結構整理文件，而不是先行規範文件。

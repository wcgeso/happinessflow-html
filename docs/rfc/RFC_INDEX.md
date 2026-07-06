# RFC Index

> 本文件整理目前 worktree 內已建立的 RFC 清單、用途、相依關係、是否可直接轉 GDD，以及建議的正式 GDD 建立順序。

## 1. 已建立 RFC 清單

| RFC | 用途 | 主要相依關係 | 可直接轉 GDD | 仍需產品決策 |
|---|---|---|---|---|
| `TURN_SYSTEM_RFC.md` | 定義回合、移動、事件收束與切手順序 | `STATE_MACHINE`、`PROJECT_OVERVIEW` | 否，已轉成 `TURN_SYSTEM.md` | 已完成主要決策 |
| `BANK_SYSTEM_RFC.md` | 整理銀行事件、銀行窗口、金融功能權限 | `TURN_SYSTEM_RFC`、`STATE_INVENTORY` | 否，已轉成 `BANK_SYSTEM.md` | 已完成主要決策 |
| `EVENT_SYSTEM_RFC.md` | 整理共享事件、事件樣態、事件佇列與事件完成規則 | `TURN_SYSTEM.md`、`BANK_SYSTEM.md` | 否，已轉成 `EVENT_SYSTEM.md` | 已完成主要決策 |
| `CARD_SYSTEM_RFC.md` | 整理牌堆、抽卡、揭露、結算、Follow-up、家庭歷程 | `EVENT_SYSTEM_RFC`、`TURN_SYSTEM.md` | 否，已轉成 `CARD_SYSTEM.md` | 已完成主要決策 |
| `FINANCIAL_SYSTEM_RFC.md` | 整理現金、收入、支出、資產、負債、財務檢核與自動償還 | `BANK_SYSTEM.md`、`TURN_SYSTEM.md` | 否，已轉成 `FINANCIAL_SYSTEM.md` | 已完成主要決策 |
| `BOARD_SYSTEM_RFC.md` | 整理棋盤布局、格子、移動、經過與停留規則 | `TURN_SYSTEM.md`、`CARD_SYSTEM.md`、`BANK_SYSTEM.md` | 否，已轉成 `BOARD_SYSTEM.md` | 已完成主要決策 |
| `ASSET_SYSTEM_RFC.md` | 整理正式資產種類、ownership、買賣與估值 | `BANK_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | 否，已轉成 `ASSET_SYSTEM.md` | 已完成主要決策 |
| `INSURANCE_SYSTEM_RFC.md` | 整理醫療 / 房屋 / 汽車保險的購買、保費與理賠現況 | `BANK_SYSTEM.md`、`ASSET_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | 否 | 是 |
| `LOAN_SYSTEM_RFC.md` | 整理信用貸款、房貸、車貸、企業貸款、強制負債與還款 | `BANK_SYSTEM.md`、`FINANCIAL_SYSTEM.md`、`ASSET_SYSTEM.md` | 否 | 是 |
| `MARKET_SYSTEM_RFC.md` | 整理股市、房市、企業市場、新聞卡與市場同步 | `CARD_SYSTEM.md`、`ASSET_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | 否 | 是 |
| `SCHOOL_SYSTEM_RFC.md` | 整理學校事件、升等、考試、幸福卡 follow-up | `TURN_SYSTEM.md`、`EVENT_SYSTEM.md`、`CARD_SYSTEM.md` | 否 | 是 |
| `HOSPITAL_SYSTEM_RFC.md` | 整理醫院事件、第二顆骰、醫藥費、停回合與同步 | `TURN_SYSTEM.md`、`EVENT_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | 否 | 是 |
| `REPAIR_SYSTEM_RFC.md` | 整理維修廠、保養費、skip turn、事件佇列與 GDD 衝突 | `TURN_SYSTEM.md`、`BOARD_SYSTEM.md`、`EVENT_SYSTEM.md` | 否 | 是 |
| `PROFESSION_SYSTEM_RFC.md` | 整理職業、薪資、升等、職等與職業資料 | `FINANCIAL_SYSTEM.md`、`SCHOOL_SYSTEM_RFC.md` | 否 | 是 |
| `DREAM_SYSTEM_RFC.md` | 整理夢想、夢想購買、費用、勝利條件與財務關係 | `FINANCIAL_SYSTEM.md`、`HAPPINESS_SYSTEM_RFC.md` | 否 | 是 |
| `HAPPINESS_SYSTEM_RFC.md` | 整理幸福值、幸福項目、幸福卡、完成事件與勝利條件 | `CARD_SYSTEM.md`、`FAMILY_SYSTEM_RFC.md`、`DREAM_SYSTEM_RFC.md` | 否 | 是 |
| `FAMILY_SYSTEM_RFC.md` | 整理家庭歷程、Join Prompt、共同參與與完成條件 | `CARD_SYSTEM.md`、`EVENT_SYSTEM.md`、`HAPPINESS_SYSTEM_RFC.md` | 否 | 是 |
| `REAL_ESTATE_SYSTEM_RFC.md` | 整理房屋、自住 / 出租、房貸、房屋保險、轉換與房市 | `ASSET_SYSTEM.md`、`MARKET_SYSTEM_RFC.md`、`LOAN_SYSTEM_RFC.md` | 否 | 是 |
| `BUSINESS_SYSTEM_RFC.md` | 整理企業、升級、收購、現金流、企業貸款與財務檢核 | `ASSET_SYSTEM.md`、`MARKET_SYSTEM_RFC.md`、`LOAN_SYSTEM_RFC.md` | 否 | 是 |

## 2. 相依關係總覽

### 2.1 基礎 RFC

這些 RFC 屬於上層規則基礎：

- `TURN_SYSTEM_RFC.md`
- `BANK_SYSTEM_RFC.md`
- `EVENT_SYSTEM_RFC.md`
- `CARD_SYSTEM_RFC.md`
- `FINANCIAL_SYSTEM_RFC.md`
- `BOARD_SYSTEM_RFC.md`
- `ASSET_SYSTEM_RFC.md`

### 2.2 中層子系統 RFC

這些 RFC 主要建立在上層規則之上：

- `INSURANCE_SYSTEM_RFC.md`
- `LOAN_SYSTEM_RFC.md`
- `MARKET_SYSTEM_RFC.md`
- `SCHOOL_SYSTEM_RFC.md`
- `HOSPITAL_SYSTEM_RFC.md`
- `REPAIR_SYSTEM_RFC.md`
- `PROFESSION_SYSTEM_RFC.md`
- `DREAM_SYSTEM_RFC.md`
- `HAPPINESS_SYSTEM_RFC.md`
- `FAMILY_SYSTEM_RFC.md`
- `REAL_ESTATE_SYSTEM_RFC.md`
- `BUSINESS_SYSTEM_RFC.md`

## 3. 哪些可直接轉 GDD

### 3.1 已可直接視為已完成 GDD 轉換的主系統

- `TURN_SYSTEM_RFC.md`
- `BANK_SYSTEM_RFC.md`
- `EVENT_SYSTEM_RFC.md`
- `CARD_SYSTEM_RFC.md`
- `FINANCIAL_SYSTEM_RFC.md`
- `BOARD_SYSTEM_RFC.md`
- `ASSET_SYSTEM_RFC.md`

原因：

- 這些主系統已經有對應 `docs/gdd/*.md`
- 產品決策已相對完整
- 可作為其餘子系統 GDD 的正式上位依據

### 3.2 尚不建議直接轉 GDD 的 RFC

- `INSURANCE_SYSTEM_RFC.md`
- `LOAN_SYSTEM_RFC.md`
- `MARKET_SYSTEM_RFC.md`
- `SCHOOL_SYSTEM_RFC.md`
- `HOSPITAL_SYSTEM_RFC.md`
- `REPAIR_SYSTEM_RFC.md`
- `PROFESSION_SYSTEM_RFC.md`
- `DREAM_SYSTEM_RFC.md`
- `HAPPINESS_SYSTEM_RFC.md`
- `FAMILY_SYSTEM_RFC.md`
- `REAL_ESTATE_SYSTEM_RFC.md`
- `BUSINESS_SYSTEM_RFC.md`

原因：

- 仍有不少流程需要產品裁定
- 多數 RFC 會直接受到既有 GDD 與現況實作衝突影響
- 若直接轉 GDD，容易把未定稿的規則過早固化

## 4. 哪些仍需產品決策

### 高優先

- `LOAN_SYSTEM_RFC.md`
  - 正式還款、自動還款、`liabilities` 與 `loans` 的最終切分
- `INSURANCE_SYSTEM_RFC.md`
  - 理賠條件、重複理賠阻擋、保險狀態與每月保費的正式規則
- `MARKET_SYSTEM_RFC.md`
  - 股價與市場事件的唯一權威、股利 / 減半 / 拆分流程
- `SCHOOL_SYSTEM_RFC.md`
  - 學校事件、升等、考試失敗 / 成功後續與 Happiness Card 關係
- `HOSPITAL_SYSTEM_RFC.md`
  - 第二顆骰、停回合、醫藥費與事件完成條件
- `REPAIR_SYSTEM_RFC.md`
  - 維修廠是否補成正式 queue event 以及完整事件結構

### 中優先

- `FAMILY_SYSTEM_RFC.md`
  - Join Prompt 的正式完成條件與多人同步結束點
- `HAPPINESS_SYSTEM_RFC.md`
  - 幸福總分、完成事件、幸福卡與勝利條件整合
- `REAL_ESTATE_SYSTEM_RFC.md`
  - 房市結構、自住 / 出租 / conversion 的正式規則
- `BUSINESS_SYSTEM_RFC.md`
  - 企業升級、收購、企業貸款與企業卡片整合

### 後續補強

- `PROFESSION_SYSTEM_RFC.md`
  - 職業資料、職等、薪資與升等的正式規格化
- `DREAM_SYSTEM_RFC.md`
  - Dream 的購買條件、費用與勝利關係

## 5. 建議正式 GDD 建立順序

建議順序如下：

1. `LOAN_SYSTEM.md`
   - 先鎖定負債、自動還款、強制負債與正式權威資料
2. `INSURANCE_SYSTEM.md`
   - 先把保險購買 / 保費 / 理賠 / 防重複理賠定稿
3. `MARKET_SYSTEM.md`
   - 鎖定市場價格權威、新聞卡與市場同步規則
4. `SCHOOL_SYSTEM.md`
   - 定稿學校事件、升等、考試與 Happiness follow-up
5. `HOSPITAL_SYSTEM.md`
   - 定稿醫院事件、醫療費與 skip turn
6. `REPAIR_SYSTEM.md`
   - 將維修廠補成正式事件規格
7. `FAMILY_SYSTEM.md`
   - 鎖定 Join Prompt、多人回覆與完成規則
8. `HAPPINESS_SYSTEM.md`
   - 整理幸福總分、幸福項目、勝利條件與 Family Milestone 關係
9. `REAL_ESTATE_SYSTEM.md`
   - 鎖定房屋 ownership、房市、房貸、保險與 conversion
10. `BUSINESS_SYSTEM.md`
   - 鎖定企業 ownership、升級、收購、貸款與 cashflow
11. `PROFESSION_SYSTEM.md`
   - 整理職業、薪資、升等、Rank 與 Profession Data
12. `DREAM_SYSTEM.md`
   - 最後補 Dream 與勝利條件、幸福與財務關係

## 6. 備註

- 目前 `docs/gdd` 已完成的主系統，可作為後續所有子系統 GDD 的正式上位依據。
- 所有尚未轉 GDD 的 RFC，在正式產品決策未完成前，仍應保持 RFC 身分，不應提前升格為正式規格。

# Bug Traceability Report

| Bug ID | 問題 | 類型 | Product Specification | Decision | GDD | 程式狀態 | 建議 |
|---------|------|------|-----------------------|----------|-----|----------|------|
| 1 | 執行師端決定下一回合 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 回合規則 | `TURN_DECISION.md` | `TURN_SYSTEM.md`、`EVENT_SYSTEM.md` | 已修正 | 直接修程式 |
| 2 | 事業夢想購買的條件，走格子 | B：規格缺漏（需先補規格） | `PRODUCT_SPECIFICATION.md` 事業 / 夢想規則未定義走格條件 | `FINANCIAL_DECISION.md` 僅定義里程碑，不含走格條件 | `DREAM_SYSTEM.md`、`BUSINESS_SYSTEM.md` | 未修正 | 先補 Product Specification |
| 3 | 醫院值骰子第二次可一直按 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 棋盤規則、事件規則 | `TURN_DECISION.md`、`EVENT_DECISION.md` | `HOSPITAL_SYSTEM.md`、`EVENT_SYSTEM.md` | 已修正 | 直接修程式 |
| 4 | 醫院停留回合機制修正 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 回合規則、棋盤規則 | `TURN_DECISION.md`、`EVENT_DECISION.md` | `HOSPITAL_SYSTEM.md`、`TURN_SYSTEM.md`、`BOARD_SYSTEM.md` | 已修正 | 直接修程式 |
| 5 | 點擊保險或定存按鈕，跳到對應頁面 | C：新功能（Feature） | 無正式頁面跳轉規則 | 無 | `BANK_SYSTEM.md` 僅定義入口與權限，不定義 UI 導頁 | 已修正 | 建立 Feature RFC |
| 6 | 幸福卡家庭重要歷程直骰畫面修正 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 事件規則、多人遊戲規則 | `CARD_DECISION.md`、`EVENT_DECISION.md` | `CARD_SYSTEM.md`、`FAMILY_SYSTEM.md`、`EVENT_SYSTEM.md` | 已修正 | 直接修程式 |
| 7 | 綁定關係，做對應卡片雙方增加幸福點（待確認） | B：規格缺漏（需先補規格） | 正式產品規格未定義綁定雙方加點規則 | 無已確認決策 | `FAMILY_SYSTEM.md`、`HAPPINESS_SYSTEM.md` 未定義此規則 | 未修正 | 先補 Decision |
| 8 | 卡片由執行端決定關閉和發送 | C：新功能（Feature） | 現行產品規格定義事件玩家擁有卡片操作權 | `CARD_DECISION.md`、`EVENT_DECISION.md` | `CARD_SYSTEM.md`、`EVENT_SYSTEM.md` | 部分修正 | 建立 Feature RFC |
| 9 | 銀行定存沒辦法隨時解除 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 銀行規則、資產規則 | `BANK_DECISION.md`、`ASSET_DECISION.md` | `BANK_SYSTEM.md`、`ASSET_SYSTEM.md` | 已修正 | 直接修程式 |
| 10 | 股票價格沒有更新 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 資產規則 | `FINANCIAL_DECISION.md` 股價權威 | `MARKET_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | 已修正 | 直接修程式 |
| 11 | 股票更新後銀行端歸零，不見了，但財報上有 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 資產規則 | `FINANCIAL_DECISION.md`、`STATE_DECISION.md` | `MARKET_SYSTEM.md`、`ASSET_SYSTEM.md` | 已修正 | 直接修程式 |
| 12 | 拾金不昧不用進入財務檢核 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 卡片規則、財務規則 | `CARD_DECISION.md`、`FINANCIAL_DECISION.md` | `CARD_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | 已修正 | 直接修程式 |
| 13 | 汽車不要放在銀行頁面裡，獨立開來 | C：新功能（Feature） | 正式產品規格只定義權限，不定義 UI 位置 | 無 | `BANK_SYSTEM.md`、`ASSET_SYSTEM.md` 不規範頁面結構 | 未修正 | 建立 Feature RFC |
| 14 | 賣出股票張數可以超過持有上限，需要修正 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 資產規則、財務規則 | `FINANCIAL_DECISION.md`、`ASSET_DECISION.md` | `ASSET_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | 已修正 | 直接修程式 |
| 15 | 沒有顯示餐飲居住類別 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 財務規則 | `FINANCIAL_DECISION.md` | `FINANCIAL_SYSTEM.md` | 部分修正 | 直接修程式 |
| 16 | 理賠按鈕可一直按 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 銀行規則、資產規則 | `ASSET_DECISION.md` | `INSURANCE_SYSTEM.md`、`FINANCIAL_SYSTEM.md` | 已修正 | 直接修程式 |
| 17 | 幸福歷程卡片階段有錯誤 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 幸福規則 | `CARD_DECISION.md` | `FAMILY_SYSTEM.md`、`CARD_SYSTEM.md`、`HAPPINESS_SYSTEM.md` | 已修正 | 直接修程式 |
| 18 | 增強職業等級走到學校應該是順時針到下一位 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 棋盤規則 | `PROFESSION_DECISION.md`、`TURN_DECISION.md` | `BOARD_SYSTEM.md`、`SCHOOL_SYSTEM.md`、`PROFESSION_SYSTEM.md` | 已修正 | 直接修程式 |
| 19 | 經過時依照順序執行，頭像也要先停留在當下執行動作的格子，旁邊顯示剩餘步數 | C：新功能（Feature） | 產品規格只定義依序處理事件，未定義停格演出與剩餘步數 UI | 無 | `BOARD_SYSTEM.md`、`EVENT_SYSTEM.md` 只定義流程，不定義此 UI | 部分修正 | 建立 Feature RFC |
| 20 | 買汽車後沒有兩顆骰子 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 棋盤規則 | `ASSET_DECISION.md` | `BOARD_SYSTEM.md`、`ASSET_SYSTEM.md` | 已修正 | 直接修程式 |
| 21 | 地圖視覺優化 | C：新功能（Feature） | 無正式視覺優化規格 | 無 | 無 | 部分修正 | 建立 Feature RFC |
| 22 | 各玩家端應該如何獨立行動，還是按照回合 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 回合規則、多人遊戲規則、銀行規則 | `TURN_DECISION.md`、`BANK_DECISION.md` | `TURN_SYSTEM.md`、`BANK_SYSTEM.md`、`MULTIPLAYER_MODEL.md` | 已修正 | 直接修程式 |
| 23 | 股票持倉在銀行介面消失 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 資產規則 | `STATE_DECISION.md`、`FINANCIAL_DECISION.md` | `ASSET_SYSTEM.md`、`MARKET_SYSTEM.md` | 已修正 | 直接修程式 |
| 24 | 股票賣出數量輸入無法操作 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 資產規則 | `FINANCIAL_DECISION.md` | `ASSET_SYSTEM.md`、`BANK_SYSTEM.md` | 已修正 | 直接修程式 |
| 25 | 回合順序錯亂 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 回合規則 | `TURN_DECISION.md`、`EVENT_DECISION.md` | `TURN_SYSTEM.md`、`EVENT_SYSTEM.md`、`BOARD_SYSTEM.md` | 已修正 | 直接修程式 |
| 26 | 幸福歷程卡未跳出選擇畫面 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 卡片規則、幸福規則 | `CARD_DECISION.md` | `CARD_SYSTEM.md`、`FAMILY_SYSTEM.md` | 已修正 | 直接修程式 |
| 27 | 財務檢核卡關 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 財務規則、銀行規則 | `FINANCIAL_DECISION.md` | `FINANCIAL_SYSTEM.md`、`BANK_SYSTEM.md`、`EVENT_SYSTEM.md` | 已修正 | 直接修程式 |
| 28 | 還款功能異常 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 財務規則、銀行規則 | `FINANCIAL_DECISION.md` | `LOAN_SYSTEM.md`、`FINANCIAL_SYSTEM.md`、`BANK_SYSTEM.md` | 已修正 | 直接修程式 |
| 29 | 房市購買按鈕無法進入 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 資產規則、卡片規則 | `ASSET_DECISION.md` | `REAL_ESTATE_SYSTEM.md`、`CARD_SYSTEM.md`、`ASSET_SYSTEM.md` | 已修正 | 直接修程式 |
| 30 | 主持人端新增玩家操作即時顯示 | C：新功能（Feature） | 產品規格未定義主持人監控面板即時回放規則 | 無 | 無 | 部分修正 | 建立 Feature RFC |
| 31 | 開場加入財務報表說明畫面 | C：新功能（Feature） | 產品規格未定義開場教學流程 | 無 | 無 | 未修正 | 建立 Feature RFC |
| 32 | 夢想目標需走到指定格子才能達成 | B：規格缺漏（需先補規格） | `PRODUCT_SPECIFICATION.md` 夢想規則未定義指定格完成條件 | 無已確認決策 | `DREAM_SYSTEM.md` 未定義指定格條件 | 未修正 | 先補 Product Specification |
| 33 | 卡片文字與數值不一致 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 卡片規則 | `CARD_DECISION.md` | `CARD_SYSTEM.md` | 已修正 | 直接修程式 |
| 34 | 保險 / 定存入口混淆 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 銀行規則 | `BANK_DECISION.md` | `BANK_SYSTEM.md` | 已修正 | 直接修程式 |
| 35 | 地圖畫面遮擋 | A：已有正式規格（直接修程式） | `PRODUCT_SPECIFICATION.md` 事件規則 | `EVENT_DECISION.md` | `EVENT_SYSTEM.md`、`CARD_SYSTEM.md` | 已修正 | 直接修程式 |

## 統計

1. A 類共有 **22 項**（可直接 Coding）
2. B 類共有 **3 項**（需先補規格）
3. C 類共有 **7 項**（新功能）

## 優先級整理

### P0（阻塞遊戲）

- Bug 1：執行師端決定下一回合
- Bug 3：醫院值骰子第二次可一直按
- Bug 4：醫院停留回合機制修正
- Bug 6：幸福卡家庭重要歷程直骰畫面修正
- Bug 9：銀行定存沒辦法隨時解除
- Bug 10：股票價格沒有更新
- Bug 11：股票更新後銀行端歸零，不見了，但財報上有
- Bug 12：拾金不昧不用進入財務檢核
- Bug 14：賣出股票張數可以超過持有上限，需要修正
- Bug 16：理賠按鈕可一直按
- Bug 17：幸福歷程卡片階段有錯誤
- Bug 20：買汽車後沒有兩顆骰子
- Bug 22：各玩家端應該如何獨立行動，還是按照回合
- Bug 23：股票持倉在銀行介面消失
- Bug 24：股票賣出數量輸入無法操作
- Bug 25：回合順序錯亂
- Bug 26：幸福歷程卡未跳出選擇畫面
- Bug 27：財務檢核卡關
- Bug 28：還款功能異常
- Bug 29：房市購買按鈕無法進入

### P1（影響體驗）

- Bug 2：事業夢想購買的條件，走格子
- Bug 5：點擊保險或定存按鈕，跳到對應頁面
- Bug 7：綁定關係，做對應卡片雙方增加幸福點（待確認）
- Bug 8：卡片由執行端決定關閉和發送
- Bug 13：汽車不要放在銀行頁面裡，獨立開來
- Bug 15：沒有顯示餐飲居住類別
- Bug 18：增強職業等級走到學校應該是順時針到下一位
- Bug 19：經過時依照順序執行，頭像也要先停留在當下執行動作的格子，旁邊顯示剩餘步數
- Bug 30：主持人端新增玩家操作即時顯示
- Bug 32：夢想目標需走到指定格子才能達成

### P2（優化）

- Bug 21：地圖視覺優化
- Bug 31：開場加入財務報表說明畫面

# 棋盤模式財務操作盤點（伺服器交易 vs 本機同步）

日期：2026-09-27　範圍：`src/views/game/GameView.tsx` 的 `applyResolvedBoardFinancialTx`、`src/hooks/useGameLogic.ts`、`src/context/GameContext.tsx`、`src/context/RoomContext.tsx`
方式：閱讀程式碼並對照送出資料的格式，**沒有逐一實測**。標「待確認」的項目是我沒有讀到最終落點。

## 兩條路徑

| | 伺服器交易（權威） | 本機同步（舊路徑） |
|---|---|---|
| 位置 | `RoomContext` 的 `complete*` / `buy*` / `apply*` 函式，經 `runRoomBoardMutation` | `useGameLogic.handleTransactionSubmit` → `setGameState` → `GameContext` 背景同步 |
| 寫入 | 現金、資產、負債、紀錄、事件狀態在**同一筆交易**，有指令編號防重複 | 先改本機，再由 `GameContext` 以「安全欄位補丁」寫回 `players/{uid}` |
| 風險 | 低 | 若同一欄位在等待期間被伺服器交易改過，補丁**靜默丟棄**；卡片事件進行中同步會被延後（`shouldDeferPlayerStateSync`）；本機與伺服器看到的資料可能暫時不同 |

`GameView` 的判斷順序（`applyResolvedBoardFinancialTx`）：家庭歷程 → 房產卡 → 創業貸款 → 醫療卡 → 房市 → 車損 → 共享投資 → 共享出售 → 目標企業 → 保險 → 定存 → 股票 → 信貸 → 還款 → 解約定存 → 汽車 → **其餘全部走本機 `handleTransactionSubmit`**。

## A. 已走伺服器交易（正確）

| 操作 | 進入條件 | 伺服器函式 |
|---|---|---|
| 家庭歷程財務結算 | `boardFlow:'family-milestone'` | `completeFamilyMilestoneAction` |
| 新聞卡買房（地產卡） | `board-card` + 新聞卡 `real_estate` | `buyCurrentRealEstateCard` |
| 房市公告板買房 | `real-estate-market` | `buyRealEstateFromMarket` |
| 創業貸款 N056～N058 | `startup-loan` | `completeStartupLoanAction` |
| 企業升級 | 升級視窗 | `rollStartupUpgradeDice` / `completeStartupUpgradeAction` |
| 機運醫療卡 | `board-card` + 醫療卡 | `completeMedicalBoardCardAction` |
| 車損 | `vehicle-loss` | `applyVehicleLoss` |
| 共享投資 N055 | `shared-card` + 企業資產 | `completeSharedInvestmentAction` |
| 共享出售資產 | `shared-card` + 已選資產 | `completeSharedAssetSaleAction` |
| 目標企業（達成事業成就） | 名稱含「達成事業成就」 | `completeTargetEnterprisePurchase` |
| 保險 | 有 `insuranceType` | `completeInsurancePurchase` |
| 定存買入 / 解約 | 資產類型「定存」/名稱「解約定存」 | `completeDepositPurchase` / `completeDepositWithdrawal` |
| 股票買賣 | 有 `stockList` | `completeStockTrade` |
| 信用貸款（v4.12 起） | `source:'loan'`+`usage:'cash'`+指令編號 `loan:` | `completeLoanBorrow` |
| 還款 | `usage:'liability'` | `completeLoanRepayment` |
| 買車 | `assetDetails.type==='汽車'` | `completeCarPurchase` |
| 純幸福點數卡（無現金） | `completeDirectHappinessCard` | 伺服器 |
| 逆向：全體月支出（他人部分） | `applyBoardExpenseToAllPlayers` | 伺服器（見 B-4 的重複套用風險） |

## B. 仍走本機同步路徑（**需要遷移**）

| # | 操作 | 產生位置 | 為何會走本機 | 風險 |
|---|---|---|---|---|
| B-1 | 有現金成本的**幸福卡**（`usage:'happiness_event'`，非家庭歷程） | `boardCardActions.ts` L464 | 沒有對應分支 | **高**：卡片事件期間同步被延後，期間伺服器欄位若被改（共享回覆、家庭歷程）補丁會被丟棄 |
| B-2 | **機運卡**現金支出（`usage:'expense'`） | `boardCardActions.ts` L626 | 沒有對應分支 | 高，同上 |
| B-3 | 機運卡**月支出調整**（`expense_update`） | `boardCardActions.ts` L718、L1044 | 沒有對應分支 | 中：只改 `expenses`，衝突機率較低 |
| B-4 | **全體月支出**（抽卡者本人部分） | `afterApply.affectsAllPlayersExpense` | 抽卡者走本機，其他人走伺服器 | 中：抽卡者與他人分兩條路徑，程式註解已承認要避免重複套用 |
| B-5 | 機運卡**終身學習**（`lifelong_learning`） | `boardCardActions.ts` L811 | 沒有對應分支 | 中 |
| B-6 | 新聞卡**現金股利**（`income`/`cash`） | `boardCardActions.ts` L1136 | `shared-card` 但非企業、無選資產 | **高**：現金本機入帳，共享回覆另一筆寫入，兩者**不是同一筆交易** |
| B-7 | 新聞卡**股票股息**（`stock_update`） | `boardCardActions.ts` L1174 | 同上 | 高，同 B-6 |
| B-8 | **全體支出調整**共享事件（`expense_adjustment`） | `handleSharedExpenseConfirm` | 同上 | 高，同 B-6 |
| B-9 | **醫院醫藥費** | `GameView.tsx` L2225（`boardFlow:'hospital'`） | 骰點走伺服器，付款走本機 | 中：現金扣款走本機 |
| B-10 | **維修廠保養費** | `GameView.tsx` L2255（`boardFlow:'repair'`） | 同上 | 中 |
| B-11 | **保險理賠**（`insurance-claim`） | `GameView.tsx` L354 | 沒有對應分支 | 中 |
| B-12 | **周轉借款 / 強制負債 / 賣資產周轉**（現金不足時） | `GameView.tsx` L306 `handleTransaction` 直接呼叫本機 | 專用彈窗直接 `handleTransactionSubmit` | **高**：這是所有現金不足情境的入口 |
| B-13 | **實現人生夢想**（`usage:'asset'/'expense'`） | `TargetAndDreamModals.tsx` | 名稱不是「達成事業成就」 | 中 |
| B-14 | **領取月結餘**（`executePayday`） | `useGameLogic.ts` L1216 | 只有本機實作 | 中 |
| B-15 | **升等考試報名費、終身學習費、考試結果** | `useGameLogic.ts` L1331 / L1416 / L1442 / L1492 | 只有本機實作 | 中 |
| B-16 | **房屋轉自住 / 出租**（改租金） | `FinancialStatement.tsx` L113 | 直接改本機 | 低到中：影響月現金流 |
| B-17 | 幸福清單勾選 / 新增 / 刪除 | `useGameLogic.ts` L1268～1307 | 本機 | 低：幸福點數，但會影響結算分數 |
| B-18 | 開發者加減現金（`addMoney`） | `useGameLogic.ts` L70 | 開發用 | 應在正式版關閉 |

## C. 待確認

- 家庭歷程 H011～H015 的「接受」財務檢核：走 `completeFamilyMilestoneAction`（A 類），但玩家「不是抽卡者」的參與流程另有 `pendingFamilyMilestoneJoinAction`，我沒有逐行驗證每個分支。
- 執行師端調整玩家現金 / 負債（`coachAdjustments`）：已寫入 `players/{uid}`，我沒有檢查與玩家本機補丁的競爭。
- 練習模式（非棋盤）：本機路徑是設計如此，不在遷移範圍。

## 建議的遷移順序（風險高 → 低）

1. **B-12 周轉借款 / 強制負債 / 賣資產**：所有現金不足都經過這裡，出錯影響最大。
2. **B-6、B-7、B-8 共享股利與全體支出**：現金與共享回覆要放進同一筆交易（可仿 `completeSharedInvestmentAction`）。
3. **B-1、B-2 幸福卡與機運卡的現金支出**：新增通用的「卡片現金交易」伺服器函式，涵蓋 B-1～B-5。
4. **B-9、B-10、B-11 醫院 / 維修 / 理賠**：骰點與扣款合併成一筆。
5. **B-14、B-15 月結餘與升等**：搭配審核請求流程一起處理。
6. **B-16、B-17**：最後處理，並關閉 B-18。

## 一個共通的設計缺口

`GameView` 用 `usage` 與 `source` 的組合來決定走哪條路，而 `BankingAppModal` 又會在送出前改寫這兩個欄位（例如信貸），兩邊沒有型別約束，才會出現信貸的死路。遷移時建議改成**明確的交易種類欄位**（例如 `kind: 'loan_borrow'`），由型別保證每一種都有處理函式，並加測試驗證「每一種交易種類都不會落到本機路徑」。

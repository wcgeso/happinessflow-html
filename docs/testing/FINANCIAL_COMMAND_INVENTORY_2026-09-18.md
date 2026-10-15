# 財務命令盤點（2026-09-18）

本文件只記錄目前 `dev` 工作樹的程式路徑，不代表正式雲端已驗收。

## 已經由棋盤 transaction 處理

| 功能 | 主要入口 |
|---|---|
| 家庭歷程階段結算 | `completeFamilyMilestoneAction()` |
| 房市購屋 | `buyRealEstateFromMarket()` |
| 抽卡不動產購買 | `buyCurrentRealEstateCard()` |
| 企業貸款 | `completeStartupLoanAction()` |
| 企業升級 | `completeStartupUpgradeAction()` |
| 目標企業購買 | `completeTargetEnterprisePurchase()` |
| 醫療卡與理賠 | `completeMedicalBoardCardAction()` |
| 車輛遭竊 | `applyVehicleLoss()` |
| 共享資產出售 | `completeSharedAssetSaleAction()` |
| 執行師調整、加速器、全體補助 | `RoomContext` 的 transaction 入口 |
| 直接幸福卡 | `completeDirectHappinessCard()` |
| 銀行保險購買 | `completeInsurancePurchase()` |
| 銀行定存辦理 | `completeDepositPurchase()` |
| 股票買入／賣出 | `completeStockTrade()` |
| 信貸借款 | `completeLoanBorrow()` |
| 負債還款 | `completeLoanRepayment()` |
| 定存解約 | `completeDepositWithdrawal()` |
| 汽車購買 | `completeCarPurchase()` |

## 仍經過本機狀態再由相容同步橋接

以下路徑仍由 `useGameLogic()` 先呼叫 `setGameState()`，再由 `GameContext` 的玩家同步 effect 寫回私人玩家文件：

- 一般銀行交易：一般資產買賣，以及非棋盤／相容模式的銀行交易仍走 legacy；棋盤房間的貸款、還款、定存解約與汽車購買已改走 transaction。
- 股票／保險／定存「辦理」在棋盤房間已改走 transaction；非棋盤或相容模式仍保留舊路徑。
- 一般卡片 fallback：`GameView.applyResolvedBoardFinancialTx()` 的最後 fallback。
- 醫院／維修廠／部分共享卡片財務動作。
- `executePayday()`、`executePromotionFee()`、`handleBizUpgrade()`、`executeLifelongFee()`、`applyLifelongResult()`、`applyExamResult()`。

## 本批次執行順序

1. 先抽出共用的純狀態轉換函式，保留既有交易與冪等欄位。
2. 讓 `RoomContext` 以最新私人玩家文件執行同一轉換，再一次寫入結果與歷史。
3. `GameView` 只在 transaction 回傳成功後更新畫面，不再把舊本機財務資料當成權威。
4. 每一組入口補單元測試與 Emulator 競態測試，通過後才移下一組。

## 暫不執行

- 不直接開放 RTDB 骰子展示規則；目前缺少可由 Rules 驗證的房間成員授權來源。
- 實機 transport A/B 與正式雲端壓力測試需在程式遷移通過後進行，不能用本地結果代替。

# Financial System RFC

> 文件定位：財務系統討論稿，不是正式 GDD。
>
> 分析依據：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/TURN_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md` 與目前 worktree 內的程式實作。
>
> 本文件只整理目前程式真正存在的財務系統、與 GDD 的可見衝突、以及需要確認的地方，不自行新增規則。

## Cash

### Current Implementation

- `cash` 是 `GameState` 的核心欄位，代表玩家可立即使用的現金。
- `useGameLogic.ts` 內所有交易會先改動 `cash`，再依交易類型更新資產、負債、收入、支出與歷史紀錄。
- `calculateFinancialSummary()` 會把 `cash` 納入 `totalAssets`。
- 現金變動會寫入 `history`，並在 `FinancialStatement` 與 `CashFlowLog` 顯示。

### Need Confirmation

- 現金是否允許在任何情況下為負，程式片段中未看到完整的全域限制規則。

## Income

### Current Implementation

- `calculateFinancialSummary()` 以三部分計算收入：
  - 職業薪資 `profession.salary`
  - 資產被動收入 `assets[].cashflow`
  - `income` 物件中的動態收入欄位
- `income.salary` 會被排除在 `dynamicIncome` 之外，避免重複計算。
- 被動收入會從資產資料動態算出，不是手填固定值。
- 不動產若不是自住，且擁有不動產能力加成，會額外加上能力帶來的月收入。
- `FinancialStatement` 會把收入拆成薪資、被動收入與其他動態收入來呈現。

### Need Confirmation

- `income` 物件中是否還有其他未被這次檢視到的固定欄位用途，尚未完全確認。

## Expense

### Current Implementation

- `calculateFinancialSummary()` 的支出包含：
  - 所得稅，為薪資的 5%
  - 基本生活支出
  - 交通與教育支出
  - 其他 / 醫療 / 育兒支出
  - 職等加成支出，每高一級加 10,000
  - 保險費，每張 2,000
  - 貸款利息
- 支出來源同時包含職業預設值與 `gameState.expenses` 的動態增減。
- `expense_update` 交易會直接調整 `gameState.expenses` 對應欄位。
- `happiness_event` 也可能帶入每月支出變動。
- `FinancialStatement` 會把支出拆成稅、生活、交通教育、其他醫療育兒、保險與利息等區塊。

### Need Confirmation

- `rankExpenseBonus` 是否應被視為獨立支出類別，或只是顯示層的合併結果，程式目前是直接算進總支出。

## Monthly Cashflow

### Current Implementation

- `monthlyCashflow` 由 `totalIncome - totalExpenses` 計算。
- `payday` 在 `calculateFinancialSummary()` 中與 `monthlyCashflow` 使用同一個數值。
- `useGameLogic.ts` 的 `executePayday(flow)` 會把這個數值直接加進 `cash`，並寫入一筆 `每月結餘` 交易。
- `FinancialStatement` 直接顯示 `monthlyCashflow`，而 `PaydayModal` 也用同一數值作為月結餘依據。

### Need Confirmation

- `monthlyCashflow < 0` 時的處理邊界，是否應與正式規格完全一致，仍需確認。

## Assets

### Current Implementation

- `Asset.type` 目前包含：
  - `現金`
  - `定存`
  - `股票`
  - `企業`
  - `不動產`
  - `飛行器`
  - `汽車`
- `calculateFinancialSummary()` 的 `totalAssets` 會把：
  - 現金加總進去
  - 股票依市場價或最近買入價估值
  - 其他資產依 `cost` 計算
- `useTransactionLogic.ts` 與 `useGameLogic.ts` 都會依交易內容新增、刪除或調整資產。
- `FinancialStatement` 會以資產清單與總資產值顯示。

### Current Asset Behaviors

- 股票交易會更新 `quantity` 與 `lastPurchasePrice`。
- 定存會有 `cashflow`，目前程式以 1% 月利息建模。
- 不動產可帶 `isSelfUse` 與 `houseType`。
- 企業資產可帶 `cashflow` 與升級標記。
- 汽車與舊資料中的飛行器，在程式裡被視為相容類型。

### Need Confirmation

- 股票估值是否應只以 `marketPrices` 為準，或保留 `lastPurchasePrice` 作為 fallback，現況是兩者並存。

## Liabilities

### Current Implementation

- `Liability.type` 目前包含：
  - `信用貸款`
  - `強制負債`
  - `飛行器貸款`
  - `汽車貸款`
  - `企業貸款`
  - `不動產貸款`
- `calculateFinancialSummary()` 會把 `liabilities[].totalOwed` 與舊版 `gameState.loans` 一起加總成 `totalLiabilities`。
- `FinancialStatement` 會列出負債總額與各類負債明細。
- `BankingView` 會把多筆信用貸款彙整成 `multiple_credit_loans` 供還款使用。

### Current Liability Behaviors

- 一般負債還款會依 `liabilityId` 直接減少 `totalOwed`。
- 多筆信用貸款可用 `multiple_credit_loans` 一次還。
- `強制負債` 的 `monthlyPayment` 固定為 0。
- 其他負債的月付金額會隨剩餘本金重算。

### Need Confirmation

- `loans` 是否只應保留相容舊存檔用途，仍需最終確認。

## Net Worth

### Current Implementation

- 淨資產在 UI 中以 `totalAssets - totalLiabilities` 顯示。
- `calculateFinancialSummary()` 已提供 `totalAssets` 與 `totalLiabilities`，`FinancialStatement` 直接用這兩個值計算 net worth。
- 目前淨資產不是獨立儲存欄位，而是即時計算結果。

### Need Confirmation

- 淨資產是否應在其他畫面或匯出資料中獨立保存，目前程式片段未確認有此需求。

## Forced Debt

### Current Implementation

- `usage === 'forced_debt'` 會建立 `type: '強制負債'` 的負債。
- `handleForcedBoardForceDebt()` 會在棋盤強制付款不足時，把差額記成強制負債。
- 這類負債的 `monthlyPayment` 設為 0。
- `applyAutoLiabilityRepayment()` 會在有正現金時優先償還 `強制負債`，再償還 `信用貸款`。
- `BankingView` 也把 `強制負債` 列入可還款目標。

### Need Confirmation

- 強制負債是否應只出現在棋盤強制付款流程，還是也可能由其他財務事件產生，程式目前只確認到棋盤流程。

## Financial Check

### Current Implementation

- 財務檢核在目前程式中是正式存在的交易確認步驟。
- `BoardFinancialCheckModal` 會根據 `expectedEntries` 與玩家輸入的 `userEntries` 比對。
- `BankingAppModal` 會把銀行交易轉成 `AccountEntry[]`，再交給財務檢核流程。
- `GameView` 中的棋盤付款、借款、強制負債、醫療費等事件，都會走財務檢核或至少產生對應的檢核條目。
- `BoardFinancialCheckModal` 目前可辨識的科目包含：
  - Assets
  - Liabilities
  - Income
  - Expenses

### Current Coverage

- 現金變動
- 股票買賣
- 定存買賣
- 借款與還款
- 保險
- 強制負債
- 棋盤醫療費

### Need Confirmation

- 是否所有財務交易都必須走財務檢核，或只有棋盤與銀行流程需要，目前程式片段未能完全證實。

## Transactions

### Current Implementation

- `TransactionData` 是交易入口資料結構。
- `useTransactionLogic.ts` 會依使用情境組出不同交易：
  - 資產購買
  - 股票買賣
  - 定存
  - 保險
  - 借款
  - 還款
  - 支出調整
  - 幸福事件
  - 股利發放
- `useGameLogic.ts` 的 `handleTransactionSubmit()` 會：
  - 更新 `cash`
  - 更新資產或負債
  - 寫入 `history`
  - 必要時啟動自動償還
- `Transaction` 會記錄：
  - `name`
  - `amount`
  - `sourceLabel`
  - `usageLabel`
  - `cashChange`
  - `balance`
  - `timestamp`
  - `details`
  - `flowType`

### Current Transaction Sources

- `source: 'cash'`
- `source: 'loan'`
- `source: 'income'`
- `usage: 'asset'`
- `usage: 'liability'`
- `usage: 'expense'`
- `usage: 'expense_update'`
- `usage: 'happiness_event'`
- `usage: 'stock_update'`
- `usage: 'forced_debt'`

### Need Confirmation

- `TransactionData` 中尚未檢視到的其他 `usage` 值是否仍有實際用途，需再確認完整型別與呼叫端。

## Transaction History

### Current Implementation

- `history` 是玩家完成交易後的流水紀錄。
- `GameContext` 與 `GameView` 都會讀取 `history`。
- `HistoryTable` 可顯示交易明細，並支援刪除。
- `CashFlowLog` 會從 `history` 篩出非零現金流紀錄。
- `GameContext` 在同步時會保留最近一段歷史資料，程式片段中可見有截斷處理。

### Need Confirmation

- `history` 截斷保留的上限是否應固定為目前程式片段所見的數量，還是未來會調整，需確認。

## Auto Repayment

### Current Implementation

- `applyAutoLiabilityRepayment()` 只在有正現金時執行。
- 優先順序是：
  1. `強制負債`
  2. `信用貸款`
  3. 舊版 `loans`
- 自動償還會直接扣掉現金，並同步減少對應負債本金。
- `handleTransactionSubmit()` 在正向現金流交易後會自動觸發。
- `executePayday()` 在月結餘為正時也會自動觸發。
- 醫療理賠與部分其他正向現金流流程也會觸發自動償還。
- 若有自動償還，系統會額外寫入一筆 `自動償還負債` 交易。

### Need Confirmation

- 除 `強制負債` 與 `信用貸款` 外，其他負債是否應加入自動償還優先序，目前程式沒有明確證據支持。

## Current Implementation

目前這個 worktree 的財務系統是分散在下列檔案中運作：

- `src/utils/gameUtils.ts`
  - 計算收入、支出、月現金流、資產、負債與淨資產
- `src/hooks/useGameLogic.ts`
  - 套用交易、更新 `cash` / `assets` / `liabilities` / `history`、執行月結餘與自動償還
- `src/hooks/useTransactionLogic.ts`
  - 組出各種交易與財務檢核預期條目
- `src/components/banking/BankingAppModal.tsx`
  - 銀行交易的檢核條目轉換與交易正規化
- `src/components/banking/BankingView.tsx`
  - 借款與還款介面
- `src/components/business/FinancialStatement.tsx`
  - 財務報表、月現金流、資產、負債與淨資產顯示
- `src/components/game/BoardFinancialCheckModal.tsx`
  - 財務檢核互動與答案驗證
- `src/views/game/GameView.tsx`
  - 棋盤事件、月結餘、強制負債、財務流程入口

從目前程式可直接確認的財務系統包含：

- 現金
- 收入
- 支出
- 月現金流
- 資產
- 負債
- 淨資產
- 強制負債
- 財務檢核
- 交易
- 交易歷史
- 自動償還

## Problem

1. `liabilities` 與 `loans` 仍同時存在於現行實作中，且 `calculateFinancialSummary()`、自動償還與部分借貸流程仍直接讀寫 `loans`，這與 `docs/gdd/BANK_SYSTEM.md` 中「`liabilities` 是唯一正式貸款資料權威；`loans` 只保留 Legacy 相容用途」的描述不完全一致。
2. 銀行相關流程目前由 `PaydayModal`、`BankingAppModal`、`BankingView` 與 `GameView` 分散處理，實作上可以看出 `Bank Event`、`Bank Service Window`、月結餘與 follow-up 的邊界，但完整失效時點與跨回合行為沒有在這次檢視中被完全確認。
3. `BankingView` 仍保留 legacy `bank_loan` 路徑，而 `useGameLogic.ts` 內也還有 `loans` 的特殊處理，這讓貸款資料模型仍是混合狀態。

## Option A

### 說明

保留目前的混合實作：

- `liabilities` 與 `loans` 共同存在
- 既有 `bank_loan` 與 legacy 邏輯繼續相容
- 月結餘與自動償還維持現在的寫法

### 優點

- 與現況完全相容
- 不需要立刻處理舊存檔與舊交易資料
- 現有 UI 與交易流程可以維持不動

### 缺點

- 貸款資料權威不單一
- 報表、還款與自動償還需要持續保留例外
- 與 `BANK_SYSTEM.md` 的資料權威描述不一致

## Option B

### 說明

把 `liabilities` 明確視為唯一正式負債來源，`loans` 只保留舊資料相容讀取用途，並逐步讓財務計算與還款邏輯只依賴 `liabilities`。

### 優點

- 與 `docs/gdd/BANK_SYSTEM.md` 的正式描述一致
- 報表與自動償還邏輯會更單一
- 後續文件較容易維持一致

### 缺點

- 需要處理舊存檔與舊流程的過渡
- 目前程式已有的 legacy 路徑需要被保留或整理

## Recommendation

較建議採 `Option B`。

理由很單純：目前程式已經可以完整表達財務系統，但 `loans` 與 `liabilities` 的雙軌存在，會讓財務報表、自動償還與銀行流程一直需要特別說明。若目標是讓金融資料模型對齊現有 GDD，應先把正式資料權威收斂到 `liabilities`。

## Need Confirmation

- `loans` 是否只做舊存檔相容，不再作為正式報表與自動償還來源。
- `bankServiceWindowActive` 的精確失效時點是否已在其他檔案定義，這次檢視尚未完全確認。
- 財務檢核是否涵蓋所有交易類型，或只涵蓋棋盤與銀行相關流程。
- 股票估值是否始終採市場價，或允許 `lastPurchasePrice` 作為 fallback。
- 自動償還是否只接受 `強制負債` 與 `信用貸款` 的優先序，或未來還要擴充到其他負債類型。

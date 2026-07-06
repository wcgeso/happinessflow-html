# Loan System RFC

> 文件定位：貸款系統討論稿，不是正式 GDD。
>
> 分析依據：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/FINANCIAL_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md`、`docs/gdd/ASSET_SYSTEM.md` 與目前 worktree 內的程式實作。
>
> 本文件只整理目前程式真正存在的貸款/負債/還款/利息/財務檢核行為，不自行新增玩法或規則。

## Current Implementation

### 1. 信用貸款

- `BankingView.tsx` 的「申請信貸」會送出 `usage: 'loan'` 的交易。
- `BankingAppModal.tsx` 會把 `usage: 'loan'` 轉成財務檢核條目，內容是 `Assets / 現金`、`Liabilities / 信用貸款`、`Expenses / 信貸利息`。
- `useGameLogic.ts` 的 `handleTransactionSubmit()` 在收到 `source: 'loan' && usage: 'cash'` 時，會新增一筆 `liabilities`，`type` 為 `信用貸款`。
- `useGameLogic.ts` 的 `applyAutoLiabilityRepayment()` 也會把 `type === '信用貸款'` 納入自動償還順序。
- `FinancialStatement.tsx` 會把 `信用貸款` 列在負債區，並把其月付/利息納入總支出。

### 2. 房貸

- `useTransactionLogic.ts` 在購買 `不動產` 時，會把 `loanAmount`、`loanInterest` 放進 `assetDetails`。
- `useGameLogic.ts` 在處理 `assetDetails.type === '不動產'` 時，會新增對應資產，並依 `loanAmount` 建立 `liabilities`，`type` 為 `不動產貸款`。
- 該筆負債的 `monthlyPayment` 直接使用 `loanInterest`。
- `useTransactionLogic.ts` 會把房貸購買的財務檢核條目列為 `現金`、`不動產`、`不動產貸款`、`不動產貸款利息`。
- `BankingView.tsx` 會把 `不動產貸款` 分組顯示在還款目標中。

### 3. 車貸

- `useTransactionLogic.ts` 的汽車購買流程同時接受 `飛行器` 與 `汽車`，但最後寫入的資產型別是 `汽車`。
- 車輛購買要求自備款與貸款合計為 `600,000`，且自備款不得低於 `120,000`。
- 車貸在 `useGameLogic.ts` 中會被寫成 `liabilities`，`type` 為 `汽車貸款`。
- `BankingView.tsx` 在還款分組中同時接受 `汽車貸款` 與 `飛行器貸款`。
- `FinancialStatement.tsx` 會把車貸列入負債，並把 `汽車貸款利息` 納入月支出。

### 4. 企業貸款

- `useTransactionLogic.ts` 的企業購買流程會收集 `bizLoan` 與 `bizInterest`。
- `useGameLogic.ts` 在處理 `assetDetails.type === '企業'` 時，會新增 `企業` 資產，並在 `loanAmount > 0` 時建立 `liabilities`，`type` 為 `企業貸款`。
- 該筆負債的 `monthlyPayment` 直接使用 `loanInterest`。
- `FinancialStatement.tsx` 與 `BankingView.tsx` 都會把 `企業貸款` 視為可列示與可償還的負債。

### 5. 強制負債

- `useGameLogic.ts` 在 `usage === 'forced_debt'` 時，會新增 `liabilities`，`type` 為 `強制負債`，`monthlyPayment` 為 `0`。
- `applyAutoLiabilityRepayment()` 會優先償還 `強制負債`。
- `BankingView.tsx` 也會把 `強制負債` 列為可償還目標。
- `FinancialStatement.tsx` 會把 `強制負債` 納入負債總額與明細。

### 6. liabilities 與 loans

- `src/types.ts` 同時定義了 `liabilities` 與 `loans`。
- `calculateFinancialSummary()` 會把 `liabilities[].totalOwed` 與 `gameState.loans` 一起加總成 `totalLiabilities`。
- `FinancialStatement.tsx` 會顯示 `liabilities` 明細，並另外把 `gameState.loans` 納入信用貸款利息計算。
- `useGameLogic.ts` 與 `HistoryView.tsx` / `ScoreView.tsx` 仍保留 `loans` 的序列化與還原路徑。
- `BankingView.tsx` 的借款與還款 UI 主要以 `liabilities` 為顯示來源，但 `useGameLogic.ts` 仍保留 `bank_loan`、`multiple_credit_loans` 等 legacy 分支。

### 7. 還款

- `BankingView.tsx` 支援兩種還款入口：
  - `multiple_credit_loans`
  - 單筆 `liability.id`
- `useGameLogic.ts` 在 `usage === 'liability'` 時，會：
  - 針對 `multiple_credit_loans` 批次減少信用貸款
  - 針對 `bank_loan` 減少 `gameState.loans`
  - 針對一般 `liabilities` 依 `liabilityId` 減少本金
- `useGameLogic.ts` 在刪除交易紀錄時，也會嘗試反向還原負債狀態。

### 8. 自動還款

- `applyAutoLiabilityRepayment()` 只在 `cash > 0` 時執行。
- 目前優先序是：
  1. `強制負債`
  2. `信用貸款`
  3. `gameState.loans`
- 自動還款會直接扣現金，並同步降低對應負債本金。
- `handleTransactionSubmit()` 在正向現金流後會觸發自動還款。
- `executePayday()` 在月結餘為正時會觸發自動還款。
- `executeMedicalClaim()` 與 `executeAircraftClaim()` 也會觸發自動還款。
- 若自動還款有實際金額，系統會補一筆 `自動償還負債` 的交易紀錄。

### 9. 利息

- `calculateFinancialSummary()` 會把下列項目列入支出：
  - `信用貸款` 的 `monthlyPayment`
  - `gameState.loans * 0.1`
  - `不動產貸款` 的 `monthlyPayment`
  - `企業貸款` 的 `monthlyPayment`
  - `汽車貸款` / `飛行器貸款` 的 `monthlyPayment`
- `getLiabilityMonthlyPayment()` 對 `信用貸款` 回傳 `10%`，對 `強制負債` 回傳 `0`，其他類型回傳 `0.5%`。
- 但現行建立負債時，`monthlyPayment` 也常直接被寫成交易輸入的 `loanInterest`。
- 也就是說，`monthlyPayment` 在現況中同時扮演「月付利息」與「結算時使用的利息金額」。

### 10. Financial Check

- `BoardFinancialCheckModal.tsx` 會要求玩家依 `expectedEntries` 填入相符的 `AccountEntry[]`。
- `BankingAppModal.tsx` 會把股票、貸款、還款、保險、定存等交易轉成財務檢核條目。
- `FinancialCheckBoard` 的科目目前包含 `Assets`、`Liabilities`、`Income`、`Expenses`。
- `useGameLogic.ts` 本身不驗證 `financialCheckEntries`，它只負責在交易被送進來之後更新 `gameState`。
- 也就是說，現行程式的財務檢核主要是 UI / 流程層的門檻，不是單一集中式資料層檢查。

## Problem

### 與 `docs/gdd` 的衝突

- `docs/gdd/BANK_SYSTEM.md` 與 `docs/gdd/FINANCIAL_SYSTEM.md` 都寫明 `liabilities` 是正式負債權威，`loans` 只保留 Legacy 相容用途；但目前程式仍在 `calculateFinancialSummary()`、`FinancialStatement.tsx`、`useGameLogic.ts` 與歷史紀錄流程中讀寫 `loans`。
- `docs/gdd/FINANCIAL_SYSTEM.md` 寫明只有 `Forced Debt` 會自動償還；但目前程式會在正向現金流、`Payday`、醫療理賠、汽車理賠後，自動償還 `強制負債`、`信用貸款` 與 legacy `loans`。
- `docs/gdd/FINANCIAL_SYSTEM.md` 要求所有正式交易都必須完成 `Financial Check`；但目前 `useGameLogic.ts` 的 state mutation 層不會主動檢查檢核條目，檢核主要由 `BoardFinancialCheckModal.tsx` 與 `BankingAppModal.tsx` 這些 UI 流程承擔。
- `docs/gdd/ASSET_SYSTEM.md` 要求車輛正式名稱統一為 `Vehicle / 汽車`；但目前程式仍同時接受 `飛行器`，且部分保險與貸款相容路徑仍使用 `aircraft` / `飛行器貸款`。

### 目前實作的結構性問題

- `monthlyPayment` 在不同負債類型上不是同一種語意：有時是輸入的月利息，有時是 `getLiabilityMonthlyPayment()` 算出的值，有時只是 legacy 還款分支的顯示欄位。
- `信用貸款` 同時存在於 `liabilities`、`FinancialStatement`、`BankingView`、`auto repayment` 與 `gameState.loans` 的 legacy 路徑中，資料來源不是單一來源。
- 房貸、車貸、企業貸款雖然都已寫進 `liabilities`，但建立時還是依賴 `assetDetails.loanAmount` / `loanInterest` 的交易 payload，和 `liability` 本身的結構不是完全一致。
- 還款行為存在三種路徑：
  - UI 的單筆 `liabilityId`
  - `multiple_credit_loans`
  - legacy `bank_loan`
- 自動還款順序目前也不是單一清楚規則，而是把 `強制負債`、`信用貸款`、`loans` 混在同一個迴圈中處理。

## Option A（維持目前）

### 說明

保留現況的雙軌做法：

- `liabilities` 與 `loans` 繼續同時存在
- `信用貸款`、`房貸`、`車貸`、`企業貸款` 由現行交易流程各自寫入
- `強制負債` 維持獨立類型
- 自動還款繼續優先處理 `強制負債`，接著處理 `信用貸款`，最後處理 legacy `loans`
- `Financial Check` 仍由 UI 流程維持現狀

### 優點

- 與目前 worktree 的程式實作最一致。
- 不需要先整理舊資料與 legacy 交易紀錄。
- 既有報表、歷史紀錄與還款 UI 不必先做語意收斂。

### 缺點

- `liabilities` 與 `loans` 的正式權威仍然混在一起。
- 自動還款規則與 `docs/gdd` 不一致。
- `monthlyPayment` 與 `Financial Check` 的責任邊界仍然模糊。
- 之後每份規格文件都還要額外說明 legacy 路徑。

## Option B（推薦）

### 說明

在 RFC 層先把負債模型收斂成：

- `liabilities` 是正式負債來源
- `loans` 只保留 Legacy 相容與歷史資料用途
- `信用貸款`、`房貸`、`車貸`、`企業貸款`、`強制負債` 都以 `liabilities` 作為正式紀錄
- `auto repayment` 的正式敘述只保留 `強制負債`
- `Financial Check` 的正式敘述以 UI 流程為準，但資料模型以 `liabilities` 為核心

### 優點

- 與 `docs/gdd` 的正式方向一致。
- 可以把現況中的 legacy 路徑明確標成過渡行為。
- 後續若要清理 `loans`、`bank_loan`、`aircraft` 等相容欄位，文件基準會更清楚。

### 缺點

- 這份 RFC 會明確暴露目前程式與正式規格之間的落差。
- 仍需另外處理既有資料與歷史紀錄中的 legacy 欄位。

## Recommendation

建議採 `Option B`。

理由是目前 worktree 已經有明顯的 `liabilities` 主表，但 `loans`、`bank_loan`、自動還款與財務摘要仍保留 legacy 路徑。RFC 若先收斂成 `liabilities` 為正式來源，才比較能把現況與 `docs/gdd` 放在同一個語意框架內。

## Decision Required

- [ ] A. 維持目前雙軌實作
- [ ] B. 以 `liabilities` 為正式來源、`loans` 只做 Legacy 相容

## Need Confirmation

1. `gameState.loans` 是否還要繼續參與正式財務摘要與還款流程，還是只保留舊存檔相容用途。
2. 自動還款是否應繼續包含 `信用貸款` 與 legacy `loans`，還是收斂成只處理 `強制負債`。
3. `monthlyPayment` 在房貸、車貸、企業貸款中是否代表固定月利息，還是只是 UI / 交易輸入的暫存欄位。
4. `Financial Check` 是否要成為所有貸款相關交易的唯一正式門檻，還是只要求經由現有 UI 入口的交易。
5. `飛行器` / `飛行器貸款` 是否仍要保留為正式相容名稱，還是只剩舊資料讀取用途。

# Insurance System RFC

> 本文件只整理目前 worktree 已存在的保險資料、購買入口、理賠、月支出、財務檢核與 Firestore 同步方式，不新增玩法。

## Current Implementation

### 1. 保險種類與資料落點

目前程式中可確認的保險分成三種：

- 醫療保險
- 房屋保險
- 汽車保險

可確認的資料落點如下：

| 類型 | 目前資料位置 | 相關檔案 |
|---|---|---|
| 醫療保險 | `gameState.medicalInsuranceCount` | `src/hooks/useGameLogic.ts`、`src/components/banking/WealthView.tsx`、`src/hooks/useTransactionLogic.ts` |
| 房屋保險 | `Asset.isInsured`，掛在 `Asset.type === '不動產'` 的資產上 | `src/hooks/useGameLogic.ts`、`src/hooks/useTransactionLogic.ts`、`src/components/business/FinancialStatement.tsx` |
| 汽車保險 | `Asset.isInsured`，掛在 `Asset.type === '汽車'` 與 legacy `飛行器` 上 | `src/hooks/useGameLogic.ts`、`src/hooks/useTransactionLogic.ts`、`src/components/business/FinancialStatement.tsx` |

### 2. 購買入口

目前保險購買入口是分散的，不是單一頁面：

- `src/components/banking/WealthView.tsx`
  - 直接提供醫療保險購買
  - 醫療保險按鈕在 UI 上會檢查 `medicalInsuranceCount >= 1`
- `src/hooks/useTransactionLogic.ts`
  - `insType` 分成 `medical`、`house`、`aircraft`
  - `medical` 會檢查是否已持有醫療保險
  - `house` 會要求選擇投保房屋
  - `aircraft` 會要求勾選汽車保險
- `src/components/banking/BankingAppModal.tsx`
  - 會把保險交易正規化成 `insuranceType` 與 `financialCheckEntries`
- `src/views/game/GameView.tsx`
  - `PaydayModal` 的 follow-up 會開 `openQuickTransaction('保險')` 或 `openQuickTransaction('定存')`
  - `openQuickTransaction` 受 `canUseBankProducts` 限制

### 3. 保費與每月支出

目前保費在程式中是固定的 2,000。

可確認的計算方式：

- `src/utils/gameUtils.ts`
  - 醫療保險張數 + 房屋保險數量 + 汽車保險數量，都各自以 `2,000` 估算月支出
- `src/components/business/FinancialStatement.tsx`
  - 以同樣方式顯示保險支出
  - 醫療保險、房屋保險、汽車保險分開列示

醫療保險的購買交易會帶 `expensePayload`，對應到 `otherMedicalChild` 類別。
房屋與汽車保險的購買交易則主要透過 `isInsured` 與摘要計算反映月支出。

### 4. 理賠流程

目前可確認的理賠流程只有醫療與汽車兩種，且都是直接落帳：

- `src/components/modals/MedicalClaimModal.tsx`
  - 同一個 modal 內提供 `medical` 與 `aircraft` 兩個 tab
  - 名稱雖是 `MedicalClaimModal`，但實際包含汽車理賠入口
- `src/hooks/useGameLogic.ts`
  - `confirmMedicalClaim()` -> `executeMedicalClaim()`
  - `confirmAircraftClaim()` -> `executeAircraftClaim()`
  - 兩者都直接增加 `cash`、寫入 `history`，再做自動償還
- `src/views/game/GameView.tsx`
  - `onModalMedicalConfirm()` 只是在醫療與汽車兩種理賠之間切換

目前沒有在 inspected code 中看到獨立的房屋理賠執行點。

### 5. 防止重複理賠

目前可確認的重複防護是「購買端」多於「理賠端」：

- 醫療保險購買有上限，UI 與 `useTransactionLogic.ts` 都會擋住重複購買
- 汽車保險購買會檢查是否已持有汽車
- 房屋保險會依選到的房屋清單建立投保狀態

但在理賠端，inspected code 沒有看到以下資料：

- claim id
- claimed / settled flag
- claim ledger
- Firestore claim history collection

因此目前的重複理賠防護主要依賴現有 UI 與當前 state，沒有看到獨立的理賠記錄欄位。

### 6. Financial Check

目前保險購買與理賠的 Financial Check 路徑不一樣：

- 保險購買
  - `src/hooks/useTransactionLogic.ts` 會組 `expectedEntries`
  - `src/components/banking/BankingAppModal.tsx` 會把交易送進財務檢核資料
  - `src/views/game/GameView.tsx` 會透過 `BoardFinancialCheckModal` 顯示檢核
- 理賠
  - `src/hooks/useGameLogic.ts` 的醫療與汽車理賠直接修改 `gameState`
  - 沒有先經過 `BoardFinancialCheckModal`

也就是說，現況是「保險購買走財務檢核，醫療與汽車理賠不走同一個檢核 UI」。

### 7. Firestore 同步

目前保險相關資料的同步，跟其他玩家狀態一樣，還是依賴整份 `gameState` 的同步：

- `src/context/GameContext.tsx`
  - 會將 `gameState` 寫入 `rooms/{roomId}.playerStates.{uid}`
  - 也會寫入 `player_sessions`
- `src/context/RoomContext.tsx`
  - 會監聽 `rooms/{roomId}` 的 snapshot
  - `playerStates`、`boardState`、`bankServiceWindowActive` 都從這裡同步
- `src/hooks/useGameLogic.ts`
  - 保險購買、理賠與月支出變更都先落到本地 `gameState`
  - 再由 `GameContext` 自動同步到 Firestore

目前沒有看到獨立的保險集合、理賠集合或 claim log。

## Problem

- `docs/gdd/BANK_SYSTEM.md` 把醫療、房屋、汽車保險都視為銀行窗口商品，但目前購買入口分散在 `WealthView.tsx`、`TransactionForm.tsx`、`BankingAppModal.tsx` 與 `GameView.tsx` 的 payday follow-up，沒有單一入口。
- `docs/gdd/ASSET_SYSTEM.md` 與 `docs/gdd/BANK_SYSTEM.md` 都希望汽車正式名稱統一，但目前程式仍同時使用 `aircraft`、`飛行器`、`汽車`。
- `docs/gdd/FINANCIAL_SYSTEM.md` 要求正式交易都走 `Financial Check`，但目前醫療與汽車理賠是直接在 `useGameLogic.ts` 落帳，不經同一個檢核 UI。
- 房屋保險目前只落在 `Asset.isInsured` 與摘要計算，沒有與醫療、汽車相同的理賠入口，因此房屋保險與卡片事件之間沒有一致的理賠流程。
- 目前沒有看到理賠 ledger、claim id、settled flag 或 Firestore claim history，所以防止重複理賠不是資料層保證。
- 保費與每月支出目前是部分由交易資料寫入、部分由 `gameUtils.ts` 與 `FinancialStatement.tsx` 直接推導，來源不只一個。
- `GameContext.tsx` 的 Firestore 同步是整份 `gameState` 同步，理賠與購買沒有獨立的原子寫入流程。

## Option A（維持目前）

說明：

- 保留現在的分散入口
- 醫療保險仍以 `medicalInsuranceCount` 為主
- 房屋與汽車保險仍以 `Asset.isInsured` 為主
- 醫療 / 汽車理賠維持直接落帳
- 月支出維持由摘要與報表推導

優點：

- 與目前程式完全一致
- 不需要重整現有交易、理賠、同步流程
- 既有 UI 與資料欄位都能原樣保留

缺點：

- 保險入口、理賠入口、財務檢核入口分散
- `aircraft` / `飛行器` / `汽車` 命名繼續並存
- 重複理賠沒有資料層保證
- 房屋保險沒有與醫療、汽車一致的理賠呈現方式

## Option B（推薦）

說明：

- 把保險視為一個完整子系統，保留現有三種類型，但用同一套規則描述購買、理賠、月支出與同步
- 購買、理賠與月支出都用一致的交易與狀態描述
- Firestore 只保留一個可追蹤的保險狀態來源
- 汽車保險正式名稱統一，`aircraft` 只保留相容用途

優點：

- 可以把目前已存在的醫療、房屋、汽車三條線收斂成同一個系統描述
- 理賠與月支出能有一致的資料來源
- 比較容易對齊 `docs/gdd/BANK_SYSTEM.md`、`docs/gdd/ASSET_SYSTEM.md` 與 `docs/gdd/FINANCIAL_SYSTEM.md`

缺點：

- 會明確暴露目前程式與正式 GDD 的差距
- 需要把現有的分散入口與相容名稱一起盤整

## Recommendation

較建議採 `Option B`。

理由只基於目前程式與文件的差異：

- 現況已經有醫療、房屋、汽車三種保險資料，但分散在不同元件與不同落帳方式
- 現況已經有財務檢核、月支出、理賠、Firestore 同步，但沒有同一個保險資料模型
- 若這份 RFC 要同時回答醫療、房屋、汽車、理賠、防重、同步與財務檢核，B 比 A 更能把現況與 GDD 衝突說清楚

## Decision Required

請選一個方向：

- [ ] A. 維持目前分散實作
- [ ] B. 收斂成單一保險子系統

## Need Confirmation

1. 房屋保險是否要保留目前只寫在 `Asset.isInsured` 的做法，還是需要獨立理賠狀態。
2. 汽車保險的正式名稱是否要統一成 `汽車`，`aircraft` 與 `飛行器` 是否只保留相容用途。
3. 醫療、房屋、汽車的理賠是否都要走同一條 `Financial Check` 與 Firestore 同步流程。
4. 是否需要補一個理賠層級的資料欄位來防止重複理賠。

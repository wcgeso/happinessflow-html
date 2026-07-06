# Real Estate System RFC

> 文件定位：房屋系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/ASSET_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md`、`docs/gdd/FINANCIAL_SYSTEM.md`，以及目前 worktree 內的程式實作。
>
> 本文件只整理目前程式真正存在的房屋、房市、自住、出租、房屋保險、房貸、房屋市場、Conversion、Cashflow 行為，不自行設計玩法，不建立正式 GDD。

## Current Implementation

### 1. 房屋

- 目前房屋資產以 `Asset.type === '不動產'` 表示，定義在 `src/types.ts`。
- 房屋常數來自 `src/constants.ts`，包含 `REAL_ESTATE_SYMBOLS`、`REAL_ESTATE_PRESETS`、`REAL_ESTATE_TYPES`。
- 主要購買入口有兩條：
  - `src/hooks/useTransactionLogic.ts` 的 `assetType === '不動產'`
  - `src/utils/boardCardActions.ts` 的 `newsCard.type === 'real_estate'`
- `src/hooks/useGameLogic.ts` 會把 `assetDetails.type === '不動產'` 寫入 `gameState.assets`，並在有貸款時建立對應的 `liabilities`。
- `src/components/business/FinancialStatement.tsx` 會把不動產列在資產區、房貸列在負債區。

### 2. 房市

- 目前程式中的房市新聞卡來源是 `src/constants/cards.ts` 裡的 `type: 'real_estate'`。
- `src/utils/boardCardActions.ts` 會把房市新聞卡轉成「自用購買」或「出租購買」的財務動作。
- 這條路徑會直接帶出 `assetDetails.type === '不動產'`、`loanAmount`、`loanInterest`、`cashflow` 與 `isSelfUse`。
- 所以目前的「房市」是房市新聞卡流程，不是獨立價格表。

### 3. 房屋市場

- 目前共享房屋市場存放在 `room.boardState.realEstateMarket`，型別是 `string[]`，定義在 `src/types.ts`。
- `src/context/RoomContext.tsx` 有 `abandonRealEstateCard(cardId)` 與 `buyRealEstateFromMarket(cardId)`。
- `src/views/game/GameView.tsx` 會在關閉房市新聞卡時，把 `cardId` 放進 `realEstateMarket`，再讓其他玩家從公告板購買。
- 目前房屋市場只存卡號，不存價格、持有人、貸款狀態或房屋條件。

### 4. 自住

- 自住狀態以 `Asset.isSelfUse` 表示。
- `src/hooks/useTransactionLogic.ts` 在買房時用 `reSelfUse` 決定是否寫入 `isSelfUse`。
- `src/utils/boardCardActions.ts` 的房市新聞卡也會依 `isSelfUse` 產生不同的 `txData`。
- `src/components/business/FinancialStatement.tsx` 的房屋卡片按鈕可切換顯示為 `自用` 或 `出租`。
- `src/utils/gameUtils.ts` 在計算 `passiveIncome` 時，只有 `!isSelfUse` 的不動產會被視為租金收入來源，並且能吃到不動產能力加成。

### 5. 出租

- 出租仍然是同一個 `Asset.type === '不動產'`，差別在 `isSelfUse === false`。
- `src/hooks/useTransactionLogic.ts` 的買房流程會把出租房的 `cashflow` 寫成輸入的租金。
- `src/utils/boardCardActions.ts` 的房市新聞卡會在出租時把 `cashflow` 設為 `newsCard.rent`。
- `src/components/business/FinancialStatement.tsx` 與 `src/utils/gameUtils.ts` 都以 `asset.cashflow` 計入月收入。

### 6. 房屋保險

- 房屋保險不是獨立資產，而是掛在房屋資產上的 `Asset.isInsured`。
- `src/hooks/useTransactionLogic.ts` 的 `assetType === '保險'` 且 `insType === 'house'` 會收集 `targetAssetIds`。
- `src/hooks/useGameLogic.ts` 會依 `insuranceType === 'house'` 對應房屋資產切換 `isInsured`。
- `src/components/business/FinancialStatement.tsx` 與 `src/utils/gameUtils.ts` 都用「已投保房屋數量 × 2000」計算月支出。

### 7. 房貸

- 房貸資料從 `assetDetails.loanAmount` 與 `assetDetails.loanInterest` 進入。
- `src/hooks/useGameLogic.ts` 會把房貸建立成 `type === '不動產貸款'` 的 `liabilities`。
- `src/hooks/useTransactionLogic.ts` 與 `src/utils/boardCardActions.ts` 都會把房貸列入財務檢核項目。
- `src/components/business/FinancialStatement.tsx` 會在負債區與貸款利息區顯示不動產貸款。
- 資產出售或還款流程會用資產名稱中的符號去對應相關貸款。

### 8. Conversion

- 房屋轉換在 `src/components/modals/HouseConversionModal.tsx` 與 `src/components/business/FinancialStatement.tsx` 中處理。
- `HouseConversionModal` 只允許每間房屋轉換一次，條件是 `conversionCount < 1`。
- `FinancialStatement.tsx` 的 `handleHouseConversion()` 會直接改 `asset.isSelfUse`、`asset.cashflow` 與 `asset.conversionCount`。
- 目前這個轉換流程不是交易提交流程，也沒有在這段程式裡看到 `Financial Check`。

### 9. Cashflow

- `src/utils/gameUtils.ts` 的 `calculateFinancialSummary()` 會把所有資產的 `cashflow` 加總成被動收入。
- 對不自用的不動產，`calculateFinancialSummary()` 會額外加上不動產能力加成。
- `src/components/business/FinancialStatement.tsx` 的收入支出表直接以 `asset.cashflow` 顯示定存、企業與不動產收入。
- 所以目前房屋的現金流來源是資產欄位與摘要計算，不是獨立的房屋 cashflow State。

## Problem

- `docs/gdd/ASSET_SYSTEM.md` 與 `docs/gdd/FINANCIAL_SYSTEM.md` 都把房屋購買、出售、轉換、自用切換與保險狀態變更視為正式財務流程的一部分，但目前 `src/components/business/FinancialStatement.tsx` 的房屋轉換是直接改 `gameState.assets`，沒有經過交易提交流程。
- `docs/gdd/ASSET_SYSTEM.md` 要求房屋市場應有正式資料結構，不應只依賴卡號清單；但目前 `room.boardState.realEstateMarket` 只是 `string[]`，沒有價格、持有人或條件資料。
- `docs/gdd/BANK_SYSTEM.md` 與 `docs/gdd/FINANCIAL_SYSTEM.md` 要求房屋保險與房貸等銀行交易走正式財務檢核；但目前房屋轉換沒有走同一條檢核流程，而房屋保險只落在 `Asset.isInsured` 與摘要計算。
- `docs/gdd/ASSET_SYSTEM.md` 要求 `GameState.assets` 是正式 ownership 來源；目前這點一致，但房屋的實際狀態又分散在 `isSelfUse`、`cashflow`、`conversionCount`、`isInsured`、貸款名稱比對與房市公告板，資料不是單一結構。
- `docs/gdd/FINANCIAL_SYSTEM.md` 對月現金流的定義是 `Total Income - Total Expense`；目前房屋現金流實作則分散在 `asset.cashflow`、`gameUtils.calculateFinancialSummary()`、`FinancialStatement.tsx` 與 `boardCardActions.ts`，各處都在推導同一個結果。
- `docs/gdd/BANK_SYSTEM.md` 對房屋保險要求是銀行服務窗口內的正式交易；目前程式雖有保險購買入口，但房屋保險本身沒有獨立理賠資料與交易權威。

## Option A（維持目前）

### 說明

- 維持目前的房屋實作方式：
  - 房屋 ownership 繼續放在 `gameState.assets`
  - 房貸繼續放在 `liabilities`
  - 房屋市場繼續用 `room.boardState.realEstateMarket`
  - 自住 / 出租繼續由 `Asset.isSelfUse` 與 `Asset.cashflow` 表示
  - 轉換繼續由 `FinancialStatement.tsx` 的直接 state mutation 處理

### 優點

- 與目前 worktree 的程式碼一致。
- 不需要先整理既有房卡、市場公告板、房貸名稱對應與歷史紀錄。
- 既有報表與卡片流程可以維持現況。

### 缺點

- 與 `docs/gdd` 的正式規格持續不一致。
- 房屋市場、轉換、保險與房貸的資料來源仍然分散。
- 房屋現金流仍然是多處推導，沒有單一正式來源。

## Option B（推薦）

### 說明

- 以現有 `GameState.assets` 與 `liabilities` 為核心，將房屋相關狀態收斂成單一正式房屋模型。
- 房屋市場不再只被視為卡號清單，而是應有可描述價格、條件與持有狀態的正式資料。
- 自住、出租、保險、房貸與轉換都應以同一套正式交易與財務檢核語意描述。
- `cashflow` 保留為資產層級的月收入結果，但其來源與變更入口需要一致描述。

### 優點

- 與 `docs/gdd/ASSET_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md`、`docs/gdd/FINANCIAL_SYSTEM.md` 的方向一致。
- 可以把現有的房屋、房貸、保險、轉換與房市公告板納入同一個語意框架。
- 後續若要處理舊資料相容，邊界會比較清楚。

### 缺點

- 會明確暴露目前程式與正式規格之間的差距。
- 需要同時面對房屋市場、轉換與房貸的 legacy 命名與分散資料。

## Recommendation

建議採 `Option B`。

理由很直接：目前程式已經有 `GameState.assets`、`liabilities`、`isSelfUse`、`isInsured`、`conversionCount`、`cashflow` 與 `realEstateMarket`，但它們分散在不同檔案與不同流程中。若 RFC 要對齊正式文件，先把房屋系統收斂成單一語意模型，比維持現況更能說清楚目前的實作與正式規格差距。

## Decision Required

- [ ] A. 維持目前分散式房屋實作
- [ ] B. 收斂成單一正式房屋模型

## Need Confirmation

1. 房屋市場是否要繼續維持 `room.boardState.realEstateMarket: string[]`，還是要補正式房市資料結構。
2. 房屋轉換是否允許繼續在報表介面直接切換，還是必須改成正式交易流程。
3. 自住與出租的 `cashflow` 是否繼續由資產欄位直接保存，還是只保留在摘要計算中。
4. 房屋保險是否只維持 `Asset.isInsured`，還是需要獨立的房屋保險狀態或理賠資料。
5. 房貸是否仍以房屋符號對應 `liabilities`，還是需要更明確的資產與貸款關聯欄位。

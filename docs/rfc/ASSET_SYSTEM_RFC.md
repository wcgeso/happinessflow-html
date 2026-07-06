# Asset System RFC

> 文件定位：資產系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/BANK_SYSTEM.md` 與目前程式實作。
>
> 本文件只整理目前程式真正存在的資產資料、交易、持有、出售、保險、折讓與同步方式，不新增玩法，不自行補齊規則。

## 1. Stock

### Current Implementation

目前股票以 `Asset.type === '股票'` 表示，資產資料放在每位玩家的 `GameState.assets` 內。

可確認的股票常數與顯示來源如下：

| 項目 | 內容 |
|---|---|
| 股票代碼 | `A10`, `A20`, `A30`, `A40`, `B50`, `B60`, `B70`, `B80` |
| 股票名稱 | `src/constants.ts` 的 `STOCK_NAMES` |
| 行情來源 | `room.marketPrices`，同步副本在 `gameState.marketPrices` |
| 前次行情 | `room.previousMarketPrices` 與 `gameState.previousMarketPrices` |
| 交易 UI | `components/banking/BrokerView.tsx`、`components/banking/BankingAppModal.tsx`、`components/business/FinancialStatement.tsx` |
| 實際寫入 | `hooks/useGameLogic.ts` 的 `handleTransactionSubmit()` |

股票資產本身會保存：

| 欄位 | 用途 |
|---|---|
| `quantity` | 持有張數 |
| `lastPurchasePrice` | 最近一次買入價格 |
| `cost` | 目前資產價值或持有成本的顯示值 |

目前股票買進與賣出都走交易資料：

- 買進時會寫入 `stockList`
- 賣出時會寫入 `stockList`
- `useGameLogic.ts` 依 `stockList` 增減 `quantity`
- `BrokerView.tsx` 直接以 `marketPrices` 計算本次交易金額

可確認的股票相關流程：

- `BankingAppModal.tsx` 會把股票顯示在 `broker` 分頁
- `FinancialStatement.tsx` 會用 `quantity * currentPrice` 顯示股票價值
- `GameContext.tsx` 會監聽房間行情更新並同步到 `gameState.marketPrices`
- 新聞卡 `stock_price` 會更新行情
- 新聞卡 `stock_dividend` 會增加股票張數
- 股票能力卡成功時會把現有股票張數翻倍
- 泡沫破裂時會把股票張數減半

### Ownership

股票沒有獨立的持有人表。持有關係就是玩家自己的 `GameState.assets` 裡存在對應股票資產。

### Problem

- `BANK_SYSTEM.md` 要求股價唯一正式來源是 `room.marketPrices`，但目前程式同時存在 `room.marketPrices`、`room.previousMarketPrices`、`gameState.marketPrices`，而且 `BankingAppModal.tsx` 也會再合併新聞卡行情覆蓋顯示。
- `FinancialStatement.tsx` 會直接用玩家本地 `gameState.marketPrices` 顯示股票價值，並不是只讀房間文件。

## 2. Deposit

### Current Implementation

目前定存以 `Asset.type === '定存'` 表示，仍然屬於 `GameState.assets`。

可確認的定存流程：

- `WealthView.tsx` 有「銀行定存」分頁
- `TransactionForm.tsx` 與 `BankingAppModal.tsx` 也能組出定存交易
- `useTransactionLogic.ts` 會把定存寫成 `assetDetails.type === '定存'`
- `useGameLogic.ts` 會把定存加進 `assets`
- `FinancialStatement.tsx` 會把多筆定存合併顯示為一個總額

目前定存的實作特徵：

| 項目 | 內容 |
|---|---|
| 月利率 | `1%`，由 `cashflow` 代表 |
| 交易方式 | 現金扣款後新增資產 |
| 解除方式 | 在賣出 / 解約流程中扣回定存金額 |
| 顯示方式 | 財務報表內合併顯示 |

`useGameLogic.ts` 中，定存解約會走 `usage === 'cash'` 且 `relatedAssetId` 的流程，並從所有 `type === '定存'` 的資產中扣除金額。

### Ownership

定存沒有獨立帳戶表，只有玩家 `assets` 裡的定存項目。

### Problem

- `WealthView.tsx` 把定存當成銀行商品顯示，但實際寫入仍然只是玩家資產陣列中的一筆 `Asset`。
- `BANK_SYSTEM.md` 要求定存辦理需 `Bank Service Window`，目前 board game 模式確實會被 `canUseBankProducts` 限制，但這是 UI gate，不是資產資料層權限。

## 3. Vehicle

### Current Implementation

目前車輛資產有兩個可見名稱：

- `汽車`
- `飛行器`

程式在多處把這兩者視為同一類相容資料：

- `types.ts` 的 `Asset.type`
- `types.ts` 的 `Liability.type`
- `GameContext.tsx` 的幸福項目自動勾選
- `RoomContext.tsx` 的 `hasCarAsset()`
- `GameView.tsx` 的 `hasCar`
- `FinancialStatement.tsx` 的保險與貸款分類

可確認的車輛流程：

| 項目 | 內容 |
|---|---|
| 購買 UI | `WealthView.tsx`、`TransactionForm.tsx`、`BankingAppModal.tsx` |
| 購買價格 | `600000` |
| 最低自備款 | `WealthView.tsx` 以 `20%` 為下限 |
| 車貸 | `汽車貸款`，也會兼容舊資料 `飛行器貸款` |
| 車輛保險 | `insuranceType === 'aircraft'`，但畫面文字多數顯示成汽車保險 |
| 擲骰效果 | `RoomContext.tsx` 的 `rollBoardDice()` 會因為有車而固定變成 `2` 顆骰子 |

`RoomContext.tsx` 內的 `rollBoardDice()` 直接根據 `hasCarAsset(playerState)` 決定 `diceCount`，沒有看到一回合選擇 1 顆或 2 顆骰子的分支。

`FinancialStatement.tsx` 也把車輛/飛行器列為資產與保險、貸款統計的一部分。

### Ownership

車輛沒有獨立 ownership table。是否持有車輛，就是 `GameState.assets` 是否存在 `type === '汽車'` 或 `type === '飛行器'` 的資產。

### Problem

- `BANK_SYSTEM.md` 要求汽車可不受 `Bank Service Window` 限制、且擁有後可自行決定擲 1 顆或 2 顆骰；目前程式是固定 2 顆骰，且 board game 模式下購買車輛會被 `canUseBankProducts` 的 UI gate 間接限制。
- 車輛保險在資料上仍使用 `aircraft` 這個舊名稱，與畫面文字不完全一致。

## 4. Insurance

### Current Implementation

目前保險分成三種實際可見資料：

- 醫療保險
- 房屋保險
- 汽車保險

但程式內部的交易 payload 仍會看到 `insuranceType === 'aircraft'`，這是車輛保險的相容名稱。

可確認的保險資料存法：

| 保險類型 | 存法 |
|---|---|
| 醫療保險 | `medicalInsuranceCount` |
| 房屋保險 | 對 `Asset.isInsured` 設定 `true/false` |
| 汽車保險 | 對 `Asset.type === '汽車' || '飛行器'` 的資產設 `isInsured` |

可確認的保險流程：

- `WealthView.tsx` 直接提供醫療保險購買
- `TransactionForm.tsx` 與 `BankingAppModal.tsx` 會依交易資料建構保險檢核
- `useGameLogic.ts` 在成功交易時更新 `medicalInsuranceCount` 或 `asset.isInsured`
- `FinancialStatement.tsx` 會依保險數量或 `isInsured` 狀態統計月支出

目前醫療保險在 UI 上有明確上限，程式會阻止重複購買。

### Ownership

保險不是獨立資產，醫療保險存在於計數器，房屋與汽車保險則直接掛在資產上。

### Problem

- `BANK_SYSTEM.md` 把汽車保險列為正式品類，但目前交易 payload 與部分 UI 文字仍沿用 `aircraft`。
- 房屋與汽車保險雖然有資料處理邏輯，但主要購買入口不是同一個單一頁面。

## 5. House

### Current Implementation

目前房屋資產以 `Asset.type === '不動產'` 表示。

可確認的房屋資料結構：

| 欄位 | 用途 |
|---|---|
| `name` | 顯示名稱，通常含代碼 |
| `houseType` | `1room` / `2room` / `3room` / `5room` / `store` 類別 |
| `isSelfUse` | 是否自用 |
| `conversionCount` | 轉換次數 |
| `isInsured` | 是否投保 |
| `cashflow` | 租金收入或自用後歸零 |

可確認的房屋常數：

- `REAL_ESTATE_SYMBOLS`
- `REAL_ESTATE_PRESETS`
- `REAL_ESTATE_TYPES`

房屋購買與持有流程：

- `useTransactionLogic.ts` 會建立 `assetDetails.type === '不動產'`
- 交易資料會帶 `symbol`、`houseType`、`isSelfUse`、`cashflow`、`loanAmount`、`loanInterest`
- `useGameLogic.ts` 會把它寫進 `assets`
- 若有貸款，會同時建立對應 `不動產貸款`

房屋顯示與轉換流程：

- `FinancialStatement.tsx` 會把不動產列成獨立分類
- `HouseConversionModal` 會切換自用 / 出租
- `handleHouseConversion()` 會改 `isSelfUse`、`cashflow`、`conversionCount`
- 自住房在 `GameContext.tsx` 會被自動勾選到幸福項目

房屋保險流程：

- `insuranceType === 'house'` 會把指定房屋的 `isInsured` 設成 `true`
- 退保時會把對應房屋的 `isInsured` 設回 `false`

房屋市場流程：

- `RoomContext.tsx` 有 `boardState.realEstateMarket`
- `abandonRealEstateCard(cardId)` 會把卡號加入市場
- `buyRealEstateFromMarket(cardId)` 會把卡號從市場移除
- `GameView.tsx` 會根據 `realEstateMarket` 顯示可買房卡片

### Ownership

房屋的持有關係直接存在於玩家 `assets` 陣列中，沒有獨立房屋 ownership map。

### Problem

- `BANK_SYSTEM.md` 把房屋保險、房屋購買、房屋市場區分得更正式，但目前程式是以資產陣列與房卡市場分散實作，沒有單一房屋 ownership 層。
- `conversionCount` 有資料欄位，但目前程式沒有看到統一的上限阻擋邏輯。

## 6. Business

### Current Implementation

目前企業資產以 `Asset.type === '企業'` 表示。

可確認的企業資料來源：

| 項目 | 內容 |
|---|---|
| 企業符號 | `N055` ~ `N060` |
| 企業常數 | `BUSINESS_PRESETS` |
| 顯示名稱 | `getBusinessAssetLabel()` |
| 資產欄位 | `isUpgraded`、`cashflow`、`downPayment`、`loanAmount`、`loanInterest` |

可確認的企業流程：

- `useTransactionLogic.ts` 會建立 `assetDetails.type === '企業'`
- `useGameLogic.ts` 會把企業寫進 `assets`
- 企業可能帶 `企業貸款`
- `FinancialStatement.tsx` 會把企業列為獨立資產與貸款分類
- `BizUpgradeModal` 與 `handleBizUpgrade()` 會處理兼職工作室升級

目前企業有兩種常見樣態：

- 一般企業
- 兼職工作室，升級後會變成較高收益企業

`handleBizUpgrade()` 會：

- 增加企業 `cashflow`
- 把 `isUpgraded` 設為 `true`
- 移除對應的 `企業貸款`

### Ownership

企業持有關係同樣只存在於玩家 `assets` 陣列，不另外拆出 owner 欄位。

### Problem

- `BANK_SYSTEM.md` 把企業資產與企業貸款放在正式規格裡，但目前程式的升級、收購、出售與房卡市場都分散在 `useGameLogic.ts`、`FinancialStatement.tsx`、`boardCardActions.ts` 與 `GameView.tsx`。

## 7. Asset Sale

### Current Implementation

目前「資產出售」有兩條主要路徑。

#### 7.1 手動出售

手動出售主要出現在交易與銀行 UI 內：

- 股票賣出：`BrokerView.tsx`
- 定存解約：`WealthView.tsx` 與交易流程
- 房屋、企業、汽車：可透過 `TransactionForm.tsx` / `BankingAppModal.tsx` / `FinancialStatement.tsx` 的相關流程做出出售或轉換

`useGameLogic.ts` 會依交易資料處理：

- `usage === 'cash' && source === 'income'`
- `relatedAssetId`
- `stockList`
- `batchSellList`

#### 7.2 卡片出售

機運卡裡的下列型別會轉成 `asset_sale`：

- `purchase_1room`
- `purchase_any_house`
- `purchase_store`
- `purchase_startup`
- `enterprise_acquisition`

`boardCardActions.ts` 會先找出可出售資產候選，再交給 `GameView.tsx` 組成 `BatchSellItem` 與財務檢核。

### Ownership / Collateral 影響

出售非股票資產時，`useGameLogic.ts` 會嘗試一併移除對應貸款：

- `不動產貸款`
- `企業貸款`
- `汽車貸款`

股票出售則直接減少 `quantity`。

定存解約則會從所有定存資產中扣減金額，不建立新的資產 ownership 狀態。

### Problem

- 同一個「出售」概念同時存在於手動交易、卡片驅動、批次出售三條流程裡。
- `purchase_*` 卡片在目前程式裡實際是「讓玩家出售符合條件的資產」，卡名與現實意義是收購，但資料層動作是 `asset_sale`。

## 8. Asset Purchase

### Current Implementation

目前資產購買有下列實作：

- 股票購買
- 定存購買
- 房屋購買
- 企業購買
- 目標企業購買
- 車輛購買
- 夢想購買

可確認的交易入口：

- `BrokerView.tsx`
- `BankingView.tsx`
- `WealthView.tsx`
- `TransactionForm.tsx`
- `BankingAppModal.tsx`
- `useTransactionLogic.ts`
- `GameView.tsx`

可確認的購買資料欄位：

- `assetDetails`
- `stockList`
- `liabilityChange`
- `insurancePayload`

股票、定存、房屋、企業、車輛的購買都會先形成交易資料，再由 `useGameLogic.ts` 寫入 `assets` 或 `liabilities`。

### Problem

- `BANK_SYSTEM.md` 把股票、借款、還款、定存、保險、汽車分成不同權限層，但目前程式購買路徑分散在多個 modal 與表單，不是單一資產購買入口。
- 車輛購買在 board game 模式下被 `canUseBankProducts` 的 UI gate 限制，與正式規格不一致。

## 9. Asset Ownership

### Current Implementation

目前沒有獨立的 asset ownership model。

可確認的持有判斷方式如下：

| 類型 | 持有判斷 |
|---|---|
| 股票 | 玩家 `assets` 內是否有 `type === '股票'`，並依 `quantity` 計算張數 |
| 定存 | 玩家 `assets` 內是否有 `type === '定存'` |
| 房屋 | 玩家 `assets` 內是否有 `type === '不動產'` |
| 企業 | 玩家 `assets` 內是否有 `type === '企業'` |
| 車輛 | 玩家 `assets` 內是否有 `type === '汽車'` 或 `type === '飛行器'` |

房屋、企業、車輛與保險都把狀態直接寫在資產物件上：

- `isSelfUse`
- `isInsured`
- `isUpgraded`
- `conversionCount`

多玩家同步時，每個玩家自己的完整 `GameState` 會寫到 `rooms/{roomCode}.playerStates.{uid}`。

`boardState.realEstateMarket` 只存卡號，不存所有權 owner。

### Problem

- 資產所有權、保險、升級與市場狀態散落在 `assets`、`liabilities`、`boardState`、`marketPrices` 幾個地方，沒有單一權威結構。

## 10. Current Implementation

### Main Files

| 檔案 | 作用 |
|---|---|
| `src/types.ts` | 定義 `Asset`、`Liability`、`TransactionData`、`GameState` |
| `src/constants.ts` | 股票、房地產、企業、車輛相關靜態資料 |
| `src/utils/assetLabels.ts` | 資產名稱顯示格式 |
| `src/utils/boardCardActions.ts` | 把卡片轉成金融、出售、行情、選擇動作 |
| `src/hooks/useTransactionLogic.ts` | 組交易表單與財務檢核資料 |
| `src/hooks/useGameLogic.ts` | 真正把交易寫進 `GameState` |
| `src/context/GameContext.tsx` | 玩家狀態、行情同步、歷史紀錄 |
| `src/context/RoomContext.tsx` | 房間棋盤、行情、車輛擲骰、房市市場 |
| `src/views/game/GameView.tsx` | 棋盤主流程與資產相關 modal 串接 |
| `src/components/business/FinancialStatement.tsx` | 資產負債表、房屋轉換、企業升級 |
| `src/components/banking/BankingAppModal.tsx` | 股票 / 銀行 / 財富三分頁整合 |
| `src/components/banking/BrokerView.tsx` | 股票買賣 |
| `src/components/banking/BankingView.tsx` | 借款與還款 |
| `src/components/banking/WealthView.tsx` | 醫療保險、定存、汽車 |

### Data Flow

1. UI 在 `GameView.tsx`、`BankingAppModal.tsx`、`FinancialStatement.tsx` 或各銀行分頁組出交易資料。
2. 交易資料進入 `useTransactionLogic.ts` 或直接進入 `handleTransactionSubmit()`。
3. `useGameLogic.ts` 依 `usage`、`stockList`、`assetDetails`、`liabilityId`、`insuranceType` 寫入 `assets`、`liabilities`、`cash`、`expenses`、`happiness`。
4. `GameContext.tsx` 將 `gameState` 同步到 localStorage、`player_sessions` 與房間中的 `playerStates`。
5. `RoomContext.tsx` 用房間行情與棋盤狀態影響後續資產顯示與交易入口。

## 11. Problem

### Conflicts With `BANK_SYSTEM.md`

以下衝突可直接從目前程式確認：

- 股票正式價格權威未收斂，程式同時讀寫 `room.marketPrices` 與 `gameState.marketPrices`。
- `liabilities` 與 `loans` 仍雙軌存在，`FinancialStatement.tsx`、`BankingView.tsx`、`useGameLogic.ts` 都還會讀 `loans`。
- 汽車在 board game 模式下會被 `canUseBankProducts` 的 UI gate 間接限制，與「任何時間可購買」不同。
- 汽車擁有後，`rollBoardDice()` 固定變成 2 顆骰，沒有一回合自選 1 顆或 2 顆骰的流程。
- 車輛保險內部仍使用 `aircraft` 這個舊名稱。
- 保險、定存、車輛與房屋的購買入口分散在不同 modal，不是單一銀行商品層。
- 房屋 / 企業 / 車輛出售會和對應貸款解除綁在一起，但判斷方式依賴名稱與類型匹配，不是單獨的關聯表。

### Implementation Gaps

- `BankingAppModal.tsx` 只在 `wealth` 分頁受 `canUseBankProducts` 影響，`broker` 與 `banking` 分頁仍可使用。
- `RoomContext.tsx` 的車輛判定把 `汽車` 與 `飛行器` 視為同類。
- `FinancialStatement.tsx` 會把多筆定存合併顯示，不顯示獨立存單列表。
- `boardState.realEstateMarket` 只存房卡卡號，沒有存價格、持有人或條件。

## 12. Option A

### Keep Current Implementation As The RFC Basis

這個選項以程式現況為準：

- 以 `assets`、`liabilities`、`boardState`、`marketPrices` 的現有結構描述資產系統
- 保留 `飛行器`、`aircraft`、`loans` 等相容欄位的存在
- 把 `BANK_SYSTEM.md` 與實作差異全部列入 `Problem`

### Result

- 優點：忠實描述目前程式真的做了什麼
- 缺點：RFC 會明確保留 legacy 與分散式結構

## 13. Option B

### Follow `BANK_SYSTEM.md` As The Doc Source Of Truth

這個選項以正式 GDD 草案為準：

- 把 `room.marketPrices` 視為唯一價格來源
- 把 `liabilities` 視為唯一貸款權威
- 把汽車視為常駐商品，不受銀行窗口限制
- 把保險與定存視為窗口型銀行商品

### Result

- 優點：文件會和正式規格方向一致
- 缺點：會和目前程式實作不一致，這份文件就不再是「現況盤點」

## 14. Recommendation

建議採 `Option A`。

理由只基於現況：

- 你要求的是整理「目前程式真正存在的資產系統」
- 目前程式仍有 `loans`、`飛行器`、`aircraft`、`gameState.marketPrices` 等 legacy 與同步副本
- 直接以現況為準，才能把 `BANK_SYSTEM.md` 的衝突準確放進 `Problem`

## 15. Need Confirmation

以下項目無法只靠目前程式確認規格意圖：

1. `飛行器` 是否只應視為 `汽車` 的舊資料相容名稱，還是仍是正式資產類型。
2. `loans` 是否仍要保留在資產系統內，還是只應視為舊資料相容欄位。
3. 汽車購買在棋盤模式下是否應保持 `canUseBankProducts` 限制，或應真的改成任何時間都可買。
4. 車輛是否應保留「擲 2 顆骰」的現況，或應改成每次可選 1 顆或 2 顆骰。
5. `room.marketPrices` 與 `gameState.marketPrices` 之間，哪一個才是未來唯一權威。
6. 房屋市場 `boardState.realEstateMarket` 是否只是卡號清單，或應補上更完整的資產市場資料。
7. 車輛保險的正式名稱是否要從 `aircraft` 改成 `car` / `汽車`，或保留相容名稱。

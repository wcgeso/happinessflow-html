# Market System RFC

> 文件定位：市場系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/rfc/*.md`、`docs/gdd/*.md` 與目前 worktree 內的程式實作。
>
> 本文件只整理目前程式真正存在的股票市場、房地產市場、企業市場、行情同步與新聞卡流程，不自行設計新玩法，也不建立正式 GDD。

## 1. Current Implementation

### 1.1 股票市場

目前股票市場的共享資料主要放在 `rooms/{roomCode}` 文件內：

- `room.marketPrices`
- `room.previousMarketPrices`
- `room.marketUpdates`

對應的程式路徑主要有：

- `src/context/RoomContext.tsx`
  - `updateMarket(updates, code, isBubble)`
  - `applyBoardMarketPrices(updates, code, isBubble)`
- `src/context/GameContext.tsx`
  - `updateMarketPrices(updates, code)`
  - `bubbleBurst(code)`
- `src/views/lobby/CoachGameView.tsx`
  - `handlePublishMarket()`
  - `executePublishMarket()`
- `src/views/game/GameView.tsx`
  - 監看 `room.marketPrices`
  - 監看 `room.marketUpdates`
  - 本地套用 board card 市場效果
- `src/components/banking/BankingAppModal.tsx`
  - 合併 room、玩家本地與 board card 的行情顯示
- `src/components/banking/BrokerView.tsx`
  - 用 `marketPrices` 與 `previousMarketPrices` 計算買賣與漲跌幅

目前的實際流程是：

1. 執行師在 `CoachGameView` 輸入股市代碼。
2. 程式從 `STOCK_DATA` 取出對應價格。
3. 若跌幅達門檻，`isBubble` 會被標成 true。
4. `updateMarket()` 寫入 `room.marketPrices`、`room.previousMarketPrices` 與 `room.marketUpdates`。
5. 玩家端 `GameContext` 與 `GameView` 監聽 `room.marketUpdates`，再把行情複製到本地 `gameState.marketPrices`。
6. `BrokerView` 與 `BankingAppModal` 使用這些價格做 UI 顯示與交易計算。

### 1.2 房地產市場

房地產市場目前不是價格表，而是公告板清單：

- `room.boardState.realEstateMarket`

對應程式路徑：

- `src/context/RoomContext.tsx`
  - `abandonRealEstateCard(cardId)`
  - `buyRealEstateFromMarket(cardId)`
- `src/views/game/GameView.tsx`
  - 房市公告板 modal
  - 關閉房市新聞卡時呼叫 `abandonRealEstateCard()`
  - 從公告板購買時呼叫 `buyRealEstateFromMarket()`

目前實際行為是：

- 房市新聞卡來源仍是 `NEWS_CARDS` 裡的 `type: 'real_estate'`
- 抽到房市新聞卡後，卡片會進入玩家的 board card 流程
- 關閉該卡時，`GameView` 會把該 `cardId` 加進 `boardState.realEstateMarket`
- 之後其他玩家可以從房市公告板讀到同一份共享清單並購買

### 1.3 企業市場

目前沒有獨立的企業行情表或企業價格同步欄位。

實作上和企業相關的是：

- `NEWS_CARDS` 的 `type: 'small_business'`
- `NEWS_CARDS` 的 `type: 'large_enterprise'`
- `src/utils/boardCardActions.ts`
  - `small_business` 會轉成企業貸款 / 收益的財務動作
  - `large_enterprise` 會轉成投資額度與月收益的財務動作
- `src/utils/boardCardDisplay.ts`
  - 只負責卡片顯示內容

目前程式中，企業沒有像股票那樣的：

- `room.enterprisePrices`
- `room.previousEnterprisePrices`
- `gameState.enterprisePrices`

### 1.4 room.marketPrices / previousMarketPrices

型別上兩邊都存在：

- `src/context/RoomContext.tsx`
- `src/types.ts`

實際使用上有三層：

1. 房間共享層
   - `room.marketPrices`
   - `room.previousMarketPrices`
2. 玩家本地層
   - `gameState.marketPrices`
   - `gameState.previousMarketPrices`
3. board card 顯示層
   - `BankingAppModal` 的 `boardCardMarketPrices`

目前 `previousMarketPrices` 主要是給 UI 看漲跌幅與前值，不是獨立市場權威。

### 1.5 market update

目前市場更新有兩個來源：

1. 執行師手動發布行情
   - `CoachGameView.handlePublishMarket()`
   - `CoachGameView.executePublishMarket()`
2. board card 套用行情
   - `GameView` 先本地套用
   - 再呼叫 `applyBoardMarketPrices()`

共享更新的寫入欄位是：

- `room.marketUpdates`
- `room.previousMarketPrices`
- `room.marketPrices`

玩家端同步邏輯有兩條：

- `GameContext` 監聽 `room.marketUpdates`
- `GameView` 監看 `room.marketPrices` 與 `room.marketUpdates`

### 1.6 新聞卡

`src/constants/cards.ts` 內的新聞卡分成：

- `stock_price`
- `cash_dividend`
- `stock_dividend`
- `real_estate`
- `small_business`
- `large_enterprise`

在 `src/utils/boardCardActions.ts` 中：

- `stock_price` 會被轉成 `kind: 'market'`
- `cash_dividend` 會轉成現金股利交易
- `stock_dividend` 會轉成股票張數增加交易
- `real_estate` 會轉成自用 / 出租購買選擇
- `small_business` 與 `large_enterprise` 會轉成企業投資或貸款財務動作

`src/utils/boardCardDisplay.ts` 只負責把卡片內容整理成顯示資料，不負責結算。

### 1.7 market sync

目前同步不是單一路徑，而是多個同步副本同時存在：

- `room.marketPrices`
- `room.previousMarketPrices`
- `room.marketUpdates`
- `gameState.marketPrices`
- `gameState.previousMarketPrices`
- `BankingAppModal` 的 board card 覆蓋行情

同步顯示上，`BankingAppModal` 的有效行情優先序是：

1. board card 覆蓋價格
2. local `marketPrices`
3. room `marketPrices`

這是目前程式真實存在的合併方式。

### 1.8 股利 / 股票拆分 / 股票減半

目前股利與持股變動有三種真實行為：

- 現金股利
  - `cash_dividend` 新聞卡
  - `useTransactionLogic.ts` 內的股利交易
- 股票股息
  - `stock_dividend` 新聞卡
  - `useTransactionLogic.ts` 內的配股交易
  - 以 `Math.ceil(currentShares * rate)` 增加張數
- 泡沫破裂 / 持股減半
  - `stock_price` 卡 `N002` 有 `specialRule: '所有持股數減半，不足1張捨去'`
  - `GameContext.bubbleBurst()` 對所有股票資產做 `Math.floor(quantity / 2)`

目前沒有額外的獨立 `stock split` 狀態或獨立市場表。

### 1.9 房市更新

房市更新目前是「公告板卡片清單」的同步，不是價格同步：

- `boardState.realEstateMarket` 存的是 `cardId[]`
- `abandonRealEstateCard()` 加入清單
- `buyRealEstateFromMarket()` 移出清單
- `GameView` 透過房市公告板讓玩家看到並購買這些卡

也就是說，房市目前是卡片市場，不是數值行情市場。

## 2. Problem

### 2.1 與正式文件的價格權威衝突

- `docs/gdd/ASSET_SYSTEM.md`、`docs/gdd/FINANCIAL_SYSTEM.md`、`docs/gdd/BANK_SYSTEM.md` 都要求 `room.marketPrices` 是唯一正式價格權威。
- 目前程式同時維持：
  - `room.marketPrices`
  - `room.previousMarketPrices`
  - `gameState.marketPrices`
  - `gameState.previousMarketPrices`
  - `BankingAppModal` 的 board card 覆蓋價格
- `GameView`、`GameContext`、`BankingAppModal` 都各自讀寫價格副本，沒有單一權威的實際執行面。

### 2.2 與正式文件的市場同步衝突

- `docs/gdd/CARD_SYSTEM.md` 要求 `Market Card` 的價格更新必須同步到所有玩家，且正式效果應以共享正式狀態為準。
- 目前 `GameView` 對 `kind === 'market'` 的卡片會先做本地 `applyLocalBoardMarketPrices()`，再呼叫 `applyBoardMarketPrices()` 寫回房間。
- 這代表效果套用是先本地、後共享，不是單一步驟的共享權威結算。

### 2.3 與正式文件的 reveal / event 順序衝突

- `docs/gdd/CARD_SYSTEM.md` 與 `docs/gdd/BOARD_SYSTEM.md` 都要求卡片效果要走正式 reveal / queue / complete 生命週期。
- 目前 `GameView` 會在偵測到 `activeBoardCardAction.kind === 'market'` 時直接套用行情，並不以 reveal 完成作為前置條件。

### 2.4 與正式文件的房地產市場衝突

- `docs/gdd/ASSET_SYSTEM.md` 與 `docs/gdd/BANK_SYSTEM.md` 要求資產市場與同步資料有正式結構，不能只靠卡號清單。
- 目前房市市場是 `boardState.realEstateMarket: string[]`，實作上只是釋出中的房市卡 ID 列表。
- 房屋的價格、貸款、租金與自用狀態仍由單張新聞卡資料承載，不是獨立房市權威層。

### 2.5 與正式文件的企業市場衝突

- 目前企業只有新聞卡驅動的投資 / 貸款流程，沒有獨立行情表或同步欄位。
- 若正式規格要把企業市場視為可同步的市場類別，現況沒有對應的共享權威資料結構。

### 2.6 與正式文件的股利 / 拆分 / 減半衝突

- `cash_dividend` 與 `stock_dividend` 已有實作，但它們是兩種不同的交易路徑，不是統一市場事件。
- 股票股息目前會以張數增加方式處理，沒有獨立的 `stock split` 事件類別。
- 泡沫破裂造成的持股減半是由 `isBubble` / `bubbleBurst()` 處理，和 `stock_dividend` 是兩條不同流程。

### 2.7 其他同步風險

- `GameContext` 與 `GameView` 都會同步市場資料到本地 state。
- `BankingAppModal` 再次合併 room / local / board card 三份行情。
- 這會讓「目前畫面上看到的價格」與「room 文件中的正式價格」在不同元件裡有不同計算基礎。

## 3. Option A（維持目前）

### Current Form

維持現有的多來源市場架構：

- `room.marketPrices` 作為 room 層同步來源
- `gameState.marketPrices` 作為玩家本地顯示副本
- board card 需要時再以本地 overlay 套用
- 房市維持 `boardState.realEstateMarket` 卡片清單
- 企業維持新聞卡投資流程，不建立獨立企業市場表

### 優點

- 與目前程式最貼近。
- `BrokerView`、`BankingAppModal`、`GameView` 都不需要先做大幅收斂。
- 房市公告板與 board card 行為可維持現況。

### 缺點

- 同一個市場概念有多份資料來源。
- `room.marketPrices` 不是唯一實際使用來源。
- board card 的價格套用順序與正式文件不一致。
- 後續若要寫正式驗收條件，會一直碰到同步副本不一致的問題。

## 4. Option B（推薦）

### Proposed Form

以正式文件所要求的單一權威方向收斂市場系統：

- `room.marketPrices` 只保留正式權威
- `gameState.marketPrices` 只保留同步副本
- `previousMarketPrices` 只保留 UI 差異顯示用途
- market card 走單一共享事件結算
- 房市與企業若要維持市場概念，改成各自有明確的共享權威資料結構

### 優點

- 與 `docs/gdd` 的正式說法一致。
- 市場同步、股利、房市與新聞卡的責任邊界更清楚。
- `BrokerView`、`GameView`、`BankingAppModal` 的價格來源可被明確定義。

### 缺點

- 需要收斂目前多個讀寫價格的地方。
- 需要整理 board card 與 market update 的同步邏輯。
- 房市與企業如果要成為正式市場，資料結構需要更明確。

## 5. Recommendation

建議採 `Option B`。

原因不是要重新設計玩法，而是目前程式已經有：

- room 層價格
- 玩家本地價格
- board card 覆蓋價格
- 房市公告板清單
- 企業新聞卡投資流程

若不先收斂權威來源，後續所有市場、股利、新聞卡與房市同步都會繼續分裂成不同版本的「看起來像市場，但不是同一個市場」。

## 6. Decision Required

1. 是否接受 `room.marketPrices` 作為正式唯一權威，而把 `gameState.marketPrices` 只保留成同步副本？
2. 是否接受 `previousMarketPrices` 只做 UI 顯示，不參與正式規則判定？
3. 是否接受房市目前只是 `boardState.realEstateMarket` 的卡片公告板，而不是獨立房價市場？
4. 是否接受企業目前仍只用新聞卡投資流程處理，而不是獨立企業行情表？

## 7. Need Confirmation

1. `stock_price` 新聞卡中的 `specialRule: '所有持股數減半，不足1張捨去'`，是否就是正式要表達的泡沫減半效果？
2. `stock_dividend` 是否要繼續視為「股票股息 / 配股」流程，而不是獨立的股票拆分機制？
3. 房地產更新是否只需要現有的房市公告板清單，還是要升級成正式房價同步資料？
4. 企業市場是否只保留 `small_business` / `large_enterprise` 的新聞卡投資流程即可？
5. 市場卡是否仍允許在 board card 流程中先本地套用再同步到 room？

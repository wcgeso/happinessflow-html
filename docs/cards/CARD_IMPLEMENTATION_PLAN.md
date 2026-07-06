# Card Implementation Plan

## Current Gap Summary

### 1. 資料來源分裂

- 目前執行期仍以 `src/constants/cards.ts` 的 `HAPPINESS_CARDS`、`OPPORTUNITY_CARDS`、`NEWS_CARDS` 為主。
- `src/data/cards/happiness.cards.json`、`src/data/cards/opportunity.cards.json`、`src/data/cards/news.cards.json` 已具備較完整規則，但尚未成為執行期正式來源。
- `RoomContext.tsx`、`boardCardActions.ts`、`boardCardDisplay.ts`、`GameView.tsx` 都仍直接依賴 legacy constant map。

### 2. Resolver 設計仍偏單玩家

- `resolveBoardCardAction()` 目前主要以 `currentEvent.playerUid` 對應的單一 `gameState` 產生 action。
- 多人卡片目前只有部分支援：
  - 家庭歷程共同參與：已有 `familyMilestoneJoinPrompt` 與 `pendingFamilyMilestoneJoinAction`
  - 通膨卡：已有 `applyBoardExpenseToAllPlayers()`
- 仍未完整支援：
  - 房屋 / 店面 / 企業收購卡的「所有符合條件玩家各自決定是否出售」
  - 股利 / 股息卡對所有持股玩家的正式 shared flow
  - `N055` 所有玩家投資
  - `N056-N058` 所有玩家接受創業貸款與後續銀行升級等待事件

### 3. 顯示層與規則層仍不同步

- `boardCardDisplay.ts` 只處理展示文案，尚未以 JSON 的 `conditions`、`choiceRequired`、`followUp`、`insurance` 等欄位驅動畫面。
- `GameView.tsx` 的 drawer / modal 流程仍依 `BoardCardActionDefinition` 的 legacy 分類運作。
- `H001-H010` 雖在卡片資料庫中已定義為「需故事分享並由執行端 / 主持人確認」，但程式中尚無正式確認狀態。

### 4. 市場與股票規則已有部分修補，但流程未完全資料化

- `RoomContext.applyBoardMarketPrices()` 已可把新聞卡價格寫入 `room.marketPrices`。
- `GameView.tsx` 已有從 `room.marketPrices` 同步到本地 `gameState.marketPrices` 的效果。
- 但股市新聞、股利、股息、交易開放期間仍未抽象成統一的 card resolver / shared event flow。

### 5. 財務檢核與保險條件散落在多處

- `boardCardActions.ts` 已對 `C039-C043` 做部分資產 / 保險 / 無效果判斷。
- `useGameLogic.ts` 承接 `TransactionData` 的正式套用與回滾。
- 但卡片資料庫中的 `insurance.canBlock`、`financialCheck`、`noEffectCondition` 尚未成為統一執行規則。

## Card Type to Resolver Mapping

### A. 幸福卡

| 卡片類型 | 代表卡 | 建議 Resolver / Handler | 目前狀態 |
|---|---|---|---|
| 幸福回憶 | `H001-H010` | `resolveBoardCardAction` 先回傳 `choice` / `effect` 類型，再由 `GameView` 進入主持人確認流程 | 尚未有正式主持人確認 state |
| 家庭重要歷程 | `H011-H020`、`H043-H046` | `resolveBoardCardAction` + `openFamilyMilestoneJoinPrompt` + `submitFamilyMilestoneJoinResponse` + `pendingFamilyMilestoneJoinAction` | 已有基礎流程，但仍為半資料化 |
| 消費型幸福卡 | `H021-H042` | `resolveBoardCardAction` 產生 `choice` / `financial` / `happiness` | 已支援大多數基本路徑 |

### B. 機運卡

| 卡片類型 | 代表卡 | 建議 Resolver / Handler | 目前狀態 |
|---|---|---|---|
| 終身學習 | `C001-C008` | `resolveBoardCardAction` 產生 `financial` + `afterApply.moveToSquare`，後續由學校事件處理成功效果 | 已支援基本財務與移動，效果仍依 legacy payload |
| 資產收購 | `C009-C034` | 新增 shared acquisition resolver；由 room 建立 eligible players queue / response flow | 現在只檢查當前玩家資產 |
| 醫療卡 | `C035-C037` | `resolveBoardCardAction` + 財務檢核 + 醫院事件 + 理賠流程 | 基礎存在，但 claim 與事件結束需再統一 |
| 汽車損失 | `C038-C040` | `resolveBoardCardAction` + vehicle condition / insurance + repair or claim flow | `C038` / `C040` 仍需專用流程 |
| 房屋修繕 | `C041-C043` | `resolveBoardCardAction` + house condition / insurance + financial check | `C042` 已有初步條件判斷 |
| 通膨卡 | `C045-C048` | `resolveBoardCardAction` 產生 `financial` + `afterApply.affectsAllPlayersExpense` | 已有 shared expense helper，但仍需完全對齊資料庫 |
| Follow-up / 社會獎懲 | `C049-C056` | `resolveBoardCardAction` + `drawBoardFollowupCard` + 故事分享 / 財務檢核 / 多人流程 | `C055`、`C056` 仍未完全資料化 |

### C. 新聞卡

| 卡片類型 | 代表卡 | 建議 Resolver / Handler | 目前狀態 |
|---|---|---|---|
| 股市新聞 | `N001-N026` | `resolveBoardCardAction(kind=market)` + `applyBoardMarketPrices()` + 後續 shared trade window | 目前只有價格更新，沒有正式全體交易完成條件 |
| 現金股利 | `N027` | 新增 shared dividend cash resolver | 現在只作用於 current player `gameState` |
| 股票股息 | `N028` | 新增 shared dividend stock resolver | 現在只作用於 current player `gameState` |
| 房市新聞 | `N029-N054` | `resolveBoardCardAction(real_estate)` + `abandonRealEstateCard()` / `buyRealEstateFromMarket()` + 財務檢核 | 已有市場公告板，但入口與 ownership 還是單玩家模式 |
| 大型企業投資 | `N055` | `resolveBoardCardAction(kind=investment)` 擴充為 shared participation flow | 現在只有抽卡玩家可輸入金額 |
| 創業貸款 | `N056-N058` | 新增 shared small_business loan resolver + pending bank-upgrade event | 目前尚未承接多人接受與 follow-up |

## Required Code Changes

### 1. `src/constants/cards.ts`

- 改為轉接層，不再手寫維護 160 張卡內容。
- 需要新增：
  - 從 `src/data/cards/*.json` 讀入並轉型
  - `HAPPINESS_CARD_MAP`、`OPPORTUNITY_CARD_MAP`、`NEWS_CARD_MAP` 改由 JSON 生成
- 需要保留：
  - 目前各模組已依賴的 map / array export 介面，避免第一批改動牽動太大

### 2. `src/utils/boardCardActions.ts`

- 這裡應維持為主 resolver，但需補強為「資料驅動 + shared / local 分流」。
- 需要修改的重點函式：
  - `resolveBoardCardAction()`
  - `isForcedBoardCard()`
  - `buildBoardAssetSaleFinancialAction()`
- 需要新增或拆出的 handler 類別：
  - `resolveHappinessMemoryAction`
  - `resolveFamilyMilestoneAction`
  - `resolveAcquisitionAction`
  - `resolveInsuranceConditionalDamageAction`
  - `resolveInflationAction`
  - `resolveStockMarketAction`
  - `resolveDividendAction`
  - `resolveRealEstateNewsAction`
  - `resolveLargeEnterpriseAction`
  - `resolveStartupLoanAction`
- 需要從「直接用 card.type + hardcode」改成「先讀 JSON 規則欄位，再映射成 action」。

### 3. `src/utils/boardCardDisplay.ts`

- 目前只把 legacy 卡片轉成標題 / 說明 / effectLines。
- 需要改成讀 JSON 欄位：
  - `conditions`
  - `targets`
  - `effects`
  - `insurance`
  - `followUp`
  - `noEffectCondition`
  - `completion`
- 對應專項：
  - `H001-H010` 顯示「需故事分享 + 主持人確認」
  - 家庭歷程顯示目前階段與共同參與規則
  - `C039-C043` 顯示「有資產才生效 / 有保險可理賠」
  - `N055` 顯示「所有玩家可參與投資」
  - `N056-N058` 顯示「所有玩家可接受創業貸款，後續需銀行擲骰升級」

### 4. `src/context/RoomContext.tsx`

- 這裡是 shared room state 的核心，卡片多人流程都必須從這裡補 state 與 mutation。
- 需要調整：
  - `buildHappinessCardMeta()`
  - `buildOpportunityCardMeta()`
  - `buildNewsCardMeta()`
  - `openFamilyMilestoneJoinPrompt()`
  - `submitFamilyMilestoneJoinResponse()`
  - `applyBoardExpenseToAllPlayers()`
  - `applyBoardMarketPrices()`
  - `buyRealEstateFromMarket()`
  - `abandonRealEstateCard()`
- 需要新增的 room-level action 類型：
  - shared acquisition prompt
  - shared dividend settlement
  - shared market trading window
  - shared N055 participation prompt
  - shared startup loan acceptance prompt
  - pending startup bank upgrade event

### 5. `src/views/game/GameView.tsx`

- 這裡是目前卡片 UI flow 的主要編排者。
- 需要調整的主要區段：
  - `shouldShowFamilyJoinModal` 與 family join close lifecycle
  - `handleBoardCardReveal()`
  - `handleApplyBoardInstantEffect()`
  - `applyResolvedBoardFinancialTx()`
  - `handleBoardInvestmentConfirm()`
  - 房市公告板 modal
  - 各類 shared card response modal
- 要新增的 UI flow：
  - 主持人確認故事分享
  - shared acquisition accept / reject
  - shared dividend close flow
  - stock news after-reveal trade window
  - `N055` 全體玩家投資金額輸入
  - `N056-N058` 全體玩家接受 / 拒絕與後續銀行升級等待

### 6. `src/hooks/useGameLogic.ts`

- 這裡負責正式交易套用。
- 需要補的不是 UI，而是 `TransactionData` 落地能力：
  - shared dividend cash payout
  - shared stock dividend quantity increase
  - 大型企業投資資產建立
  - 創業貸款建立與解除
  - 房租能力成長 / 股票倍增 / 職業升等等效果結果回寫
- 需要檢查與修正的既有邏輯：
  - `stockDividendPayload` 目前回滾邏輯看起來是扣減 `addedQty`，需確認正向 / 回滾方向一致
  - `usage === 'cash' && stockList` 被買入與賣出共用，需避免 card flow 接入後語義混亂
  - `assetDetails` 是否足夠描述 `N055`、`N056-N058`

## Data Model Changes

### 1. 卡片來源模型

- 建議正式執行來源改為：
  - `src/data/cards/happiness.cards.json`
  - `src/data/cards/opportunity.cards.json`
  - `src/data/cards/news.cards.json`
- `src/constants/cards.ts` 僅作 typed adapter。

### 2. `BoardCardActionDefinition` 擴充

- 現有類型：
  - `financial`
  - `happiness`
  - `effect`
  - `market`
  - `asset_sale`
  - `choice`
  - `investment`
  - `unsupported`
- 建議補充 action metadata：
  - `scope: self | all_players | eligible_players`
  - `requiresHostConfirmation`
  - `requiresRoomResponses`
  - `responseKind`
  - `sharedEventType`
  - `eligibleTargetResolver`

### 3. Room / Board State

- 目前已有：
  - `boardState.currentCard`
  - `boardState.currentEvent`
  - `boardState.pendingEvents`
  - `boardState.familyMilestoneJoinPrompt`
  - `boardState.realEstateMarket`
- 還需要補：
  - `boardState.storySharePrompt`
  - `boardState.sharedCardPrompt`
  - `boardState.sharedCardResponses`
  - `boardState.marketTradeWindow`
  - `boardState.startupUpgradePending`
- 目標是避免為每張多人卡各做一套平行 state。

### 4. Player State

- 目前已有：
  - `pendingFamilyMilestoneJoinAction`
  - `bankServiceWindowActive`
  - `bankServiceGrantedAtEventId`
- 還需要補：
  - `pendingSharedCardAction`
  - `pendingStoryShareConfirmation`
  - `pendingStartupUpgradeAction`
  - `marketTradeDecisionState`

### 5. TransactionData

- 需要確認並補齊 payload：
  - `storyShareRewardPayload`
  - `sharedDividendPayload`
  - `sharedStockDividendPayload`
  - `sharedAcquisitionPayload`
  - `largeEnterpriseInvestmentPayload`
  - `startupLoanPayload`
  - `startupUpgradePayload`

## UI Flow Changes

### 1. 幸福回憶卡 `H001-H010`

流程應改為：

1. 抽卡
2. Reveal
3. 玩家完成故事分享
4. 執行端 / 主持人確認發放
5. 套用幸福 +2
6. 事件完成

目前缺口：

- 沒有正式的「已分享、待確認、已發放」狀態
- 沒有主持人確認按鈕與 shared state

### 2. 家庭重要歷程 `H011-H020`、`H043-H046`

流程應保留現有架構，但補強：

1. 主玩家 Reveal
2. 主玩家接受 / 不接受
3. 若接受，先決定主玩家當前家庭階段
4. 同步打開其他符合資格玩家的 join prompt
5. 其他玩家擲骰後，本地結果至少保留 2-3 秒
6. 所有回覆完成
7. 對成功加入玩家執行 pending action
8. 所有必要財務檢核完成
9. 卡片完成

### 3. 收購卡 `C009-C034`

流程應改為：

1. 抽卡
2. 系統找出所有符合條件玩家
3. 各玩家收到自己的出售 / 放棄 prompt
4. 選擇出售者進入自己的財務檢核
5. 全部回覆完成後卡片結束

### 4. 醫療 / 車損 / 房屋修繕卡

流程需統一成：

1. 先判斷是否有對應資產 / 保險
2. 無資產：顯示無效果並可關閉
3. 有資產且有保險：顯示可理賠或由保險承擔
4. 有資產且無保險：進入付款 / 財務檢核
5. 如卡片要求移動到醫院 / 維修廠，付款完成後再進入對應事件

### 5. 股市新聞 `N001-N026`

流程應從單純「套價格」改為：

1. Reveal
2. 寫入 `room.marketPrices`
3. 開啟 shared trade window
4. 所有玩家買入 / 賣出 / 放棄
5. 全部完成後卡片結束

### 6. 股利 / 股息 `N027-N028`

流程應改為：

1. Reveal
2. 找出所有符合持股玩家
3. 無持股者直接顯示無效果
4. 有持股者套用現金股利或股票股息
5. 全部結算完成後事件結束

### 7. 房市 / 店面新聞 `N029-N054`

流程應保留現有房市公告板概念，但需明確：

1. 抽卡玩家打開市場
2. 房屋進入可購買清單
3. 玩家可購買 / 放棄
4. 購買才進財務檢核
5. 放棄直接關閉

### 8. `N055`

流程應改為：

1. Reveal
2. 所有玩家收到參與 / 不參與 prompt
3. 參與者輸入金額
4. 金額驗證
5. 個別財務檢核
6. 建立企業資產與收入
7. 全部回覆完成後事件結束

### 9. `N056-N058`

流程應改為：

1. Reveal
2. 所有玩家收到接受 / 拒絕 prompt
3. 接受者完成貸款建立與財務檢核
4. 系統建立 pending startup upgrade 狀態
5. 玩家後續經過銀行時觸發銀行擲骰升級
6. 升級成功後取消貸款 / 本利和並增加企業收入

## Multiplayer / Room State Changes

### 1. 共享卡片回覆機制需要統一

- 現在只有家庭歷程有共享回覆機制。
- 後續應抽象成可重用的 shared response model，供以下卡片共用：
  - `H011-H020`、`H043-H046`
  - `C009-C034`
  - `N001-N026` 交易窗口
  - `N027-N028`
  - `N055`
  - `N056-N058`

### 2. `room.marketPrices` 要維持唯一正式股價來源

- 股市新聞更新只能經由 `applyBoardMarketPrices()`
- 銀行與財報只能讀 `room.marketPrices`
- `gameState.marketPrices` 僅保留同步副本角色

### 3. shared event completion rule

- 多人卡片不得只依 current player 完成就結束。
- shared card 應在以下條件全部達成後才可 close：
  - 所有 eligible 玩家已回覆
  - 所有必要財務檢核已完成
  - 所有 follow-up / pending action 已建立或套用

## Test Plan

### 1. 單卡 resolver 測試

- `resolveBoardCardAction()` 對以下卡別逐張驗證：
  - `H001`
  - `H011`
  - `C009`
  - `C035`
  - `C039`
  - `C042`
  - `C048`
  - `N001`
  - `N027`
  - `N029`
  - `N055`
  - `N056`

### 2. Room shared flow 測試

- 家庭歷程多人 join
- 通膨全體套用
- 收購卡多玩家各自出售 / 放棄
- 股市新聞價格同步
- 股利 / 股息對全部持股玩家
- `N055` 多玩家投資
- `N056-N058` 多玩家接受貸款與 pending bank upgrade

### 3. 財務檢核整合測試

- 一次性支出
- 月支出增加 / 減少
- 理賠後現金更新
- 企業資產建立
- 不動產資產建立
- 股票數量 / 現金股利 / 股票股息更新

### 4. UI regression 測試

- 家庭歷程骰點結果不瞬間消失
- 無資產卡顯示無效果
- 房市新聞可放棄、不強制購買
- `N055` 可輸入投資金額
- `N056-N058` 不是只有抽卡玩家能操作

### 5. 三人房間測試腳本

- 玩家 A 抽家庭歷程
- 玩家 B / C 共同參與
- 玩家 A 抽股市新聞
- 玩家 A / B / C 分別進行股票操作或放棄
- 玩家 B 抽收購卡
- 玩家 A / C 分別選擇出售 / 不出售
- 玩家 C 抽 `N056`
- A / B / C 分別接受 / 拒絕，後續過銀行驗證升級流程

## Recommended Implementation Order

### 第 1 階段：資料源統一

1. 讓 `src/constants/cards.ts` 改為讀取 `src/data/cards/*.json`
2. 保留既有 export 介面，避免一次改爆 UI
3. 先確保 `RoomContext`、`boardCardActions`、`boardCardDisplay` 都已讀到同一份資料

### 第 2 階段：單玩家卡片規則補齊

1. `H001-H010` 主持人確認流程
2. `C039-C043` 資產 / 保險 / 無效果
3. 房市 / 店面新聞購買 / 放棄
4. `N055` 抽卡玩家金額輸入先對齊既有投資流程

### 第 3 階段：Shared card infrastructure

1. 抽象 shared prompt / response model
2. 家庭歷程改接這套模型
3. 收購卡改接這套模型
4. 股利 / 股息 / `N055` / `N056-N058` 改接這套模型

### 第 4 階段：市場與交易窗口

1. 股市新聞 Reveal 後寫入 `room.marketPrices`
2. 建立全體交易 / 放棄窗口
3. 結束條件改為所有玩家完成或放棄

### 第 5 階段：創業貸款 follow-up

1. `N056-N058` 貸款建立
2. pending bank upgrade event
3. 過銀行擲骰升級
4. 成功後取消貸款 / 本利和並升級企業

## 第一批應該先修的 10 個程式任務

1. 把 `src/constants/cards.ts` 改成從 `src/data/cards/*.json` 建立 card map 與 card list。
2. 更新 `RoomContext.tsx` 的 `buildHappinessCardMeta`、`buildOpportunityCardMeta`、`buildNewsCardMeta`，改讀 JSON schema。
3. 更新 `boardCardDisplay.ts`，改由 JSON 的 `conditions`、`effects`、`followUp`、`insurance` 產生顯示內容。
4. 在 `GameView.tsx` 為 `H001-H010` 新增故事分享待確認流程，避免直接發放幸福點。
5. 整理 `resolveBoardCardAction()` 的幸福卡分支，讓 `H011-H020`、`H043-H046` 只依家庭階段決定效果，不依卡號硬編。
6. 抽象 `GameView.tsx` 的 family join modal lifecycle，避免 response 寫入後立即關閉，並保留結果顯示。
7. 把 `C009-C034` 從「只讀 current player 資產」改成「建立 eligible players shared sell prompt」。
8. 把 `N027-N028` 從 current player 單人結算改成 shared dividend settlement。
9. 把 `N055` 從抽卡玩家單人 `investment` modal 改成所有玩家可參與並各自輸入金額。
10. 為 `N056-N058` 新增 shared acceptance state 與 pending bank-upgrade follow-up state。

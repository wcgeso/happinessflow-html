# 第二人生 Legacy System Inventory

本文件只做 Legacy 盤點，不評論程式碼品質，也不提出重寫方案。  
目的是回答：

> 如果完全重做這個遊戲，新版本不能漏掉哪些既有功能、規則、狀態與多人流程？

盤點依據：
- `src/data/cards/*.json`
- `src/constants/cards.ts`
- `src/utils/boardCardActions.ts`
- `src/hooks/useGameLogic.ts`
- `src/hooks/useTransactionLogic.ts`
- `src/context/GameContext.tsx`
- `src/context/RoomContext.tsx`
- `src/views/game/GameView.tsx`
- `src/types.ts`
- `services/firebase.ts`
- 相關 board / game / financial / business / family 元件

若程式、JSON、GDD、Product Specification 不一致，本文只列出衝突，不裁定哪個才是正確版本。

---

## 全域觀察

### 專案實際的主流程
1. 使用者登入
2. 建立或加入房間
3. 執行師開局
4. 玩家建立 / 同步個人 `GameState`
5. 棋盤房建立 `boardState`
6. 依 `boardState.currentTurnUid` 輪流操作
7. 當前玩家擲骰，產生 `movement`
8. 角色沿 52 格棋盤前進
9. 經過格與停留格建立 `pendingEvents` / `currentEvent`
10. 若是卡片，抽卡 → reveal → resolve
11. 若卡片或事件產生財務效果，進入 `BoardFinancialCheckModal`
12. 若事件為多人共享，等待 `familyMilestoneJoinPrompt` 或 `sharedCardPrompt` 全員回覆
13. 事件清空後，`advanceBoardEventQueue()` 才切下一位玩家
14. 房間結束後進入結算 / 記錄 / 排名畫面

### 專案實際的主權分布
- **房間 / 棋盤 / 共用事件主權**：`RoomContext`
- **玩家個人財務 / 幸福 / 個人歷程主權**：`GameContext`
- **卡片規則主權**：`boardCardActions.ts`
- **畫面流程主權**：`GameView.tsx`
- **財務計算主權**：`gameUtils.ts`、`useGameLogic.ts`、`useTransactionLogic.ts`、部分元件內即時計算

### 明確存在的主權衝突
- `marketPrices` 同時存在於 `room.marketPrices` 與 `gameState.marketPrices`
- `liabilities` 與 `loans` 同時存在
- `boardPosition` / `skipTurns` 同時存在於 `boardState` 與 `playerState`
- `familyMilestoneJoinPrompt` / `sharedCardPrompt` 同時存在於 Firestore 與 `GameView` 本地 snapshot
- `bankServiceWindowActive` 同時存在於個人狀態與棋盤事件流程

---

## 1. Game Loop

**System Name:** Game Loop  
**Purpose:** 串起從房間建立到遊戲結束的完整遊戲循環。  
**Current Owner:** `App.tsx`, `RoomContext.tsx`, `GameView.tsx`, `CoachGameView.tsx`  
**State Owned:** `room.status`, `boardState`, `gameState.isSetup`, `selectionStep`, `sessionId`  
**Rules Owned:** 房間要先進入 `playing` 才能開始正式回合；事件未完成不可切下一位。  
**Inputs:** 建房、加房、開局、玩家操作、執行師操作  
**Outputs:** room 狀態、玩家狀態、事件、結算結果  
**Side Effects:** Firestore `rooms`、`player_sessions`、localStorage  
**Dependencies:** Auth、Room、Turn、Board、Event、Financial、Settlement  
**Source of Truth:** Room + player local game state 混合  
**Shared Multiplayer Behavior:** 執行師開局後，所有玩家同步進入同一房間 session。  
**Known Hardcoded Rules:** 流程分支在 `App.tsx` 與 `GameView.tsx` 直接寫死；board mode 與 non-board mode 共存。  
**Known Duplicate Logic:** room 狀態與本地畫面切換同時控制流程。  
**Known Architecture Problems:** 遊戲循環沒有單一 state machine，實際分散在 `App`、`RoomContext`、`GameView`。  
**Reusable In New Version:** 流程順序與主要入口可保留。  
**Should Not Be Copied:** 本地 UI state 直接決定流程阻塞的做法。

---

## 2. Turn System

**System Name:** Turn System  
**Purpose:** 決定目前輪到誰、何時切下一位、如何處理 skip turn。  
**Current Owner:** `RoomContext.tsx` (`rollBoardDice`, `advanceBoardEventQueue`, `getNextTurnUid`)  
**State Owned:** `boardState.currentTurnUid`, `turnOrder`, `skipTurns`  
**Rules Owned:** 只有 `currentTurnUid` 可擲骰；若目標玩家有 `skipTurns`，輪到該玩家時先扣 1 再往下一位。  
**Inputs:** 玩家擲骰、事件完成、停回合事件  
**Outputs:** 下一位玩家 UID、skip 狀態更新  
**Side Effects:** Firestore `boardState` 更新  
**Dependencies:** Board Movement、Event Queue、Hospital、School、Repair、Family  
**Source of Truth:** `room.boardState`  
**Shared Multiplayer Behavior:** 所有人都從同一個 `currentTurnUid` 判斷目前輪到誰。  
**Known Hardcoded Rules:** `getNextTurnUid` 直接操作 skip map；結束條件綁在 queue 清空。  
**Known Duplicate Logic:** `skipTurns` 同時寫回 `playerState` 與 `boardState`。  
**Known Architecture Problems:** 回合切換強依賴 queue 與 prompt 是否清空，不是獨立狀態。  
**Reusable In New Version:** `currentTurnUid + turnOrder + skipTurns` 概念可保留。  
**Should Not Be Copied:** 同時維護兩份 skip / position 狀態。

---

## 3. Board Movement System

**System Name:** Board Movement System  
**Purpose:** 依骰點計算前進路徑、逐格經過、最後停留。  
**Current Owner:** `RoomContext.tsx` (`rollBoardDice`, `buildBoardMovementResolution`), `GameView.tsx`  
**State Owned:** `boardState.movement`, `playerPositions`, `lastRoll`, `playerState.boardPosition`  
**Rules Owned:** 棋盤固定 52 格、順時針移動；有汽車可擲兩顆骰，否則一顆。  
**Inputs:** 擲骰、汽車持有狀態  
**Outputs:** 路徑、落點、經過格摘要、停留格事件  
**Side Effects:** Firestore `boardState.movement`，之後再寫回 settled position  
**Dependencies:** Turn、Board、Bank、School、Repair、Card  
**Source of Truth:** `room.boardState.playerPositions`，但 `gameState.boardPosition` 是同步副本  
**Shared Multiplayer Behavior:** 所有人共享同一條 movement 事件與落點結果。  
**Known Hardcoded Rules:** 經過銀行、學校、維修廠的摘要訊息與保養費直接在 `rollBoardDice` 內產生。  
**Known Duplicate Logic:** 動畫位置、room position、player position 三者可能同時存在。  
**Known Architecture Problems:** movement 既是規則狀態，也是動畫狀態。  
**Reusable In New Version:** 52 格循環、兩骰汽車規則、path 概念。  
**Should Not Be Copied:** movement settle 靠 timeout + 再讀 Firestore 的方式。

---

## 4. Board Event Queue

**System Name:** Board Event Queue  
**Purpose:** 排隊處理經過格、停留格、follow-up、exam happiness 等事件。  
**Current Owner:** `RoomContext.tsx` (`advanceBoardEventQueue`, `activateBoardQueueEntry`, `shiftBoardQueue`)  
**State Owned:** `boardState.pendingEvents`, `currentEvent`, `currentCard`, `currentCardReveal`  
**Rules Owned:** 事件必須逐一處理；若有 shared prompt / family prompt 未完成，不可 advance。  
**Inputs:** 移動結算、抽卡、follow-up、多人回覆完成  
**Outputs:** 下一個事件、下一張卡、下一位玩家  
**Side Effects:** Firestore `boardState` 深度更新  
**Dependencies:** Turn、Card、Family、Shared Prompt、Financial Check  
**Source of Truth:** `room.boardState`  
**Shared Multiplayer Behavior:** 所有人看到同一個 `currentEvent`。  
**Known Hardcoded Rules:** `expectedType` 直接用字串比對；`alert()` 阻止推進。  
**Known Duplicate Logic:** `dismissBoardCard` 與 `advanceBoardEventQueue` 有相似推進邏輯。  
**Known Architecture Problems:** queue 推進混雜卡片 log、turn switch、prompt cleanup。  
**Reusable In New Version:** queue / currentEvent / pendingEvents 三層模型。  
**Should Not Be Copied:** UI handler 直接驅動 queue 完成條件。

---

## 5. Card System

**System Name:** Card System  
**Purpose:** 管理三個牌堆、抽卡、reveal、resolve、follow-up。  
**Current Owner:** `src/data/cards/*.json`, `src/constants/cards.ts`, `RoomContext.tsx`, `boardCardActions.ts`, `GameView.tsx`  
**State Owned:** `deckState`, `currentCard`, `currentCardReveal`, `cardLog`  
**Rules Owned:** 三個牌堆抽完會用 used deck 重洗；卡片種類分為幸福、機運、新聞。  
**Inputs:** 卡片格停留、考試後抽卡、卡片 follow-up  
**Outputs:** `BoardCardResult`, `BoardCardActionDefinition`  
**Side Effects:** Firestore card reveal、card log、shared prompt  
**Dependencies:** Board、Event Queue、Financial、Family、Market  
**Source of Truth:** 抽卡順序在 `boardState.deckState`；卡片規則同時散在 JSON 與 `boardCardActions.ts`  
**Shared Multiplayer Behavior:** 某些卡片是 self only，某些卡片會打開 shared prompt 影響多人。  
**Known Hardcoded Rules:** resolver 仍大量用 card type / card id 直接分支。  
**Known Duplicate Logic:** JSON 已描述條件與效果，但 `boardCardActions.ts` 再實作一次。  
**Known Architecture Problems:** 卡片資料層、顯示層、規則層還沒有完全分離。  
**Reusable In New Version:** 卡片 JSON、deck model、meta builder 方向。  
**Should Not Be Copied:** 讓畫面層直接知道太多卡號條件。

### 主要衝突
- **JSON**：已描述很多卡片條件、多人影響、follow-up
- **程式**：只有 resolver 中實作到的卡片會真的生效
- **文件**：部分 GDD 規格比程式更完整

---

## 6. Happiness System

**System Name:** Happiness System  
**Purpose:** 管理幸福值、幸福清單、幸福卡效果、家庭歷程完成度。  
**Current Owner:** `GameContext.tsx`, `gameUtils.ts`, `boardCardActions.ts`, `familyMilestones.ts`  
**State Owned:** `gameState.happiness`, `happinessTotal`, `completedHappinessEvents`, `hasShownWinAnimation`  
**Rules Owned:** 幸福項目有唯讀項與自訂項；家庭歷程與房屋自住、汽車等資產會同步更新幸福狀態。  
**Inputs:** 幸福卡、房屋自住、家庭歷程、事業、夢想  
**Outputs:** 幸福總分、ScoreView、Win animation  
**Side Effects:** localStorage、player sync、分數結算  
**Dependencies:** Card、Family、Asset、Settlement  
**Source of Truth:** `gameState.happiness` + `completedHappinessEvents`  
**Shared Multiplayer Behavior:** 幸福值主要是個人狀態，但家庭歷程可被其他玩家加入。  
**Known Hardcoded Rules:** `getInitialHappinessList()` 直接寫死項目；房屋幸福與資產類型綁定。  
**Known Duplicate Logic:** 幸福事件完成狀態同時靠 checked item 與 completed event ids。  
**Known Architecture Problems:** 幸福規則是資料與程式混合，不是單一表。  
**Reusable In New Version:** 幸福項目模型、分數概念。  
**Should Not Be Copied:** 以 UI checked 狀態兼當正式規則狀態。

---

## 7. Opportunity System

**System Name:** Opportunity System  
**Purpose:** 機運卡帶出能力提升、資產收購、醫療/車損/房修、通膨等事件。  
**Current Owner:** `opportunity.cards.json`, `constants/cards.ts`, `boardCardActions.ts`  
**State Owned:** resolver 輸出 action、本地 pending financial action、sharedCardPrompt  
**Rules Owned:** ability cards 會移動到學校；資產收購卡會建立 shared sell prompt；醫療/車損/房修會依資產與保險決定有無效果。  
**Inputs:** 抽到機運卡  
**Outputs:** financial action / asset sale action / choice / unsupported  
**Side Effects:** 可能移動到醫院 / 學校、開啟多人 prompt、調整月支出  
**Dependencies:** Card、School、Hospital、Asset、Insurance、Financial  
**Source of Truth:** 目前以 `boardCardActions.ts` 的 resolver 為準  
**Shared Multiplayer Behavior:** 求購 / 收購類、通膨類會影響多人  
**Known Hardcoded Rules:** `FORCED_OPPORTUNITY_TYPES`、費用分類、是否全體影響都在 code 裡  
**Known Duplicate Logic:** JSON 寫了條件，resolver 再重寫一次  
**Known Architecture Problems:** 機運卡是目前最重的 if/else 熱點之一  
**Reusable In New Version:** 類型分類與 JSON 欄位  
**Should Not Be Copied:** 讓每張卡直接滲透到 UI 與財務流程

---

## 8. News / Market System

**System Name:** News / Market System  
**Purpose:** 更新股價、發放股利股息、房市、店面、小型企業與大型企業投資事件。  
**Current Owner:** `news.cards.json`, `constants/cards.ts`, `boardCardActions.ts`, `RoomContext.tsx`, `GameContext.tsx`  
**State Owned:** `room.marketPrices`, `room.previousMarketPrices`, `room.marketUpdates`, `gameState.marketPrices`, `gameState.previousMarketPrices`  
**Rules Owned:** 股價新聞會更新全房股價；泡沫卡會減半持股；部分新聞卡建立 real estate / business / investment 流程。  
**Inputs:** 新聞卡、執行師手動更新市場、房市公告板  
**Outputs:** 行情更新、投資事件、購買事件  
**Side Effects:** Firestore room marketPrices、玩家本地 price sync  
**Dependencies:** Stock、Financial、Asset、Coach  
**Source of Truth:** 實際程式是 room 與 gameState 雙來源；`BankingAppModal` 已優先吃 room  
**Shared Multiplayer Behavior:** 股價更新是共享；房市/大型企業可擴散到多人  
**Known Hardcoded Rules:** `applyBoardMarketPrices` 權限判斷；`calculateFinancialSummary` 還用 `gameState.marketPrices` 算股票市值  
**Known Duplicate Logic:** 市場同步同時出現在 `RoomContext` 與 `GameView` 的 `useEffect`  
**Known Architecture Problems:** 正式價格來源沒有被所有模組一致採用  
**Reusable In New Version:** 市場更新模型、新聞卡價格表  
**Should Not Be Copied:** 雙主權價格設計

### 明確衝突
- **GDD / Decision**：`room.marketPrices` 應是唯一正式來源
- **程式**：`GameContext` / `gameUtils` 仍會使用 `gameState.marketPrices`

---

## 9. Financial System

**System Name:** Financial System  
**Purpose:** 管理現金、收入、支出、資產、負債、歷史、淨值與月現金流。  
**Current Owner:** `types.ts`, `gameUtils.ts`, `useGameLogic.ts`, `useTransactionLogic.ts`, `FinancialStatement.tsx`  
**State Owned:** `cash`, `income`, `expenses`, `assets`, `liabilities`, `loans`, `history`  
**Rules Owned:** 收入 = 薪資 + 被動收入 + 動態收入；支出 = 稅 + 基本支出 + 利息 + 保險 + 職等費；淨值 = 資產 - 負債。  
**Inputs:** 所有交易、月結餘、卡片事件、銀行操作  
**Outputs:** summary、score、報表、可否通過財務檢核  
**Side Effects:** localStorage、Firestore playerStates / history  
**Dependencies:** Asset、Loan、Insurance、Bank、Card、Settlement  
**Source of Truth:** `gameState`  
**Shared Multiplayer Behavior:** 財務本身是個人，但多人事件會同時改多位玩家財務。  
**Known Hardcoded Rules:** 信用貸款利息 `10%`、其他貸款 `0.5%`、保險每張 `2000`。  
**Known Duplicate Logic:** 利息、保險、股票市值在多處重算。  
**Known Architecture Problems:** 財務引擎沒有單一 transaction kernel。  
**Reusable In New Version:** 財務概念與欄位大多可保留。  
**Should Not Be Copied:** 同一筆交易在多處自行拼 impacts / expected entries。

---

## 10. Cash Flow System

**System Name:** Cash Flow System  
**Purpose:** 顯示與計算月結餘、被動收入、租金、定存利息、企業收益。  
**Current Owner:** `gameUtils.ts`, `FinancialStatement.tsx`, `PaydayModal`, `useGameLogic.ts`  
**State Owned:** `summary.monthlyCashflow`, `summary.passiveIncome`, `history`  
**Rules Owned:** 月結餘 = `totalIncome - totalExpenses`；payday 也直接使用這個結果。  
**Inputs:** income、expenses、assets、liabilities  
**Outputs:** 月結餘、財務安全 / 財務自由條件  
**Side Effects:** Payday 會改現金、可能觸發強制負債償還  
**Dependencies:** Financial、Bank、Asset、Liability  
**Source of Truth:** `calculateFinancialSummary(gameState)`  
**Shared Multiplayer Behavior:** 每個玩家獨立計算，但經過銀行同樣會被要求處理。  
**Known Hardcoded Rules:** 不動產能力每級額外加 `10000` 租金。  
**Known Duplicate Logic:** passive income 與 asset cashflow 顯示處處重算。  
**Known Architecture Problems:** cashflow 既是顯示結果，也是很多規則的判定來源。  
**Reusable In New Version:** 計算概念可保留。  
**Should Not Be Copied:** 讓元件自行重算部分月費與利息。

---

## 11. Asset System

**System Name:** Asset System  
**Purpose:** 管理股票、不動產、企業、定存、汽車等資產與其附加屬性。  
**Current Owner:** `types.ts`, `useTransactionLogic.ts`, `useGameLogic.ts`, `assetLabels.ts`, `FinancialStatement.tsx`  
**State Owned:** `gameState.assets`  
**Rules Owned:** 資產有 `type`, `cost`, `cashflow`, `isInsured`, `isSelfUse`, `houseType`, `isUpgraded`, `quantity`, `lastPurchasePrice` 等。  
**Inputs:** 購買、賣出、卡片效果、房屋轉換、企業升級  
**Outputs:** 財報資產、被動收入、保險附掛、幸福狀態  
**Side Effects:** 改幸福、改收入、改負債  
**Dependencies:** Financial、Insurance、Loan、Happiness、Market  
**Source of Truth:** `gameState.assets`  
**Shared Multiplayer Behavior:** 資產本身是個人，但卡片可能詢問其他玩家是否出售。  
**Known Hardcoded Rules:** `assetLabels.ts` 用名稱與代號推導類型；舊資料保留 `飛行器`。  
**Known Duplicate Logic:** 同一資產概念在 UI、transaction、resolver 各自組字串。  
**Known Architecture Problems:** Asset identity 不是嚴格 schema driven。  
**Reusable In New Version:** `Asset` 介面大部分欄位。  
**Should Not Be Copied:** 以 `name.includes()` 判斷資產種類。

---

## 12. Liability / Loan System

**System Name:** Liability / Loan System  
**Purpose:** 管理信用貸款、強制負債、房貸、企業貸款、車貸與其月付款。  
**Current Owner:** `types.ts`, `useTransactionLogic.ts`, `useGameLogic.ts`, `FinancialStatement.tsx`, `BankingView.tsx`  
**State Owned:** `liabilities`, `loans`  
**Rules Owned:** `liabilities` 內每筆有 `totalOwed` 與 `monthlyPayment`；`loans` 仍保留 legacy 信用貸款總額。  
**Inputs:** 借款、還款、資產購買、強制負債  
**Outputs:** 月利息、財報負債、還款入口  
**Side Effects:** 現金變動、支出變動  
**Dependencies:** Financial、Asset、Bank、Card  
**Source of Truth:** 程式實際上是 `liabilities + loans` 混用  
**Shared Multiplayer Behavior:** 借款是個人操作；共享事件可替多玩家建立不同貸款。  
**Known Hardcoded Rules:** `getLiabilityMonthlyPayment`：信用貸款 10%，強制負債 0，其他 0.5%。  
**Known Duplicate Logic:** 還款規則在 `BankingView`, `useTransactionLogic`, `useGameLogic` 各有處理。  
**Known Architecture Problems:** legacy `loans` 尚未清空，造成雙資料源。  
**Reusable In New Version:** Liability 結構與貸款類型列表。  
**Should Not Be Copied:** `liabilities` 和 `loans` 並存。

### 明確衝突
- **文件**：`liabilities` 是唯一正式來源，`loans` 僅 legacy
- **程式**：`calculateFinancialSummary` 與還款邏輯仍把 `loans` 算進去

---

## 13. Insurance System

**System Name:** Insurance System  
**Purpose:** 管理醫療、房屋、汽車保險的購買、月費、理賠。  
**Current Owner:** `WealthView.tsx`, `BoardFinancialCheckModal`, `MedicalClaimModal`, `boardCardActions.ts`, `useGameLogic.ts`  
**State Owned:** `medicalInsuranceCount`, `asset.isInsured`, claim-related local modal state  
**Rules Owned:** 每份保險每月 2000；醫療保險獨立 count；房屋/汽車保險掛在資產上。  
**Inputs:** 銀行購買、醫療/車損/房修卡、醫院事件  
**Outputs:** 月支出、理賠、免除部分卡片支出  
**Side Effects:** 改現金、改支出、改 pending request / claim UI  
**Dependencies:** Bank、Financial、Asset、Card  
**Source of Truth:** 醫療保險在 `medicalInsuranceCount`，其餘在資產附掛  
**Shared Multiplayer Behavior:** 無，都是個人保險；但共享事件可能對每位玩家各自判斷有無保險。  
**Known Hardcoded Rules:** 一律 2000 月保費；醫療理賠、汽車理賠、房屋修繕免付的邏輯分散。  
**Known Duplicate Logic:** 是否有保險在 `boardCardActions` 與各 UI 內都各自判斷。  
**Known Architecture Problems:** 保險不是獨立模型，跨資產與獨立 count 兩種實作共存。  
**Reusable In New Version:** 保險類型與基本附掛概念。  
**Should Not Be Copied:** 一半獨立欄位、一半附掛資產的雙模型。

---

## 14. Bank System

**System Name:** Bank System  
**Purpose:** 提供月結餘、貸款、保險、定存、汽車購買、股票入口。  
**Current Owner:** `RoomContext.tsx`, `GameView.tsx`, `BankingAppModal.tsx`, `PaydayModal.tsx`  
**State Owned:** `bankServiceWindowActive`, `bankServiceGrantedAtEventId`, `showPaydayModal`, banking modal local state  
**Rules Owned:** 經過銀行會觸發月結餘；銀行窗口期間可辦理部分服務；股票與部分操作可常駐進入。  
**Inputs:** 銀行格、銀行按鈕、卡片 / 財務流程  
**Outputs:** payday、交易、保險 / 定存 / 貸款 / 汽車購買  
**Side Effects:** playerState 現金流更新、room board event 推進  
**Dependencies:** Financial、Loan、Insurance、Deposit、Vehicle、Stock  
**Source of Truth:** room/playerState 混合  
**Shared Multiplayer Behavior:** 銀行事件是當前玩家事件，但股票 / 借貸入口在 UI 上可常駐打開。  
**Known Hardcoded Rules:** 經過銀行訊息、payday step、窗口開關條件分散。  
**Known Duplicate Logic:** canUseBankProducts 同時受 board mode、window state、local preset 控制。  
**Known Architecture Problems:** 銀行事件與銀行服務窗口不是同一層，卻混在 GameView / Banking modal。  
**Reusable In New Version:** 銀行功能切分、UI 入口。  
**Should Not Be Copied:** 讓交易入口與事件入口共用一堆隱性條件。

---

## 15. Stock System

**System Name:** Stock System  
**Purpose:** 買賣股票、顯示持股、市值、股利與股息。  
**Current Owner:** `BankingAppModal.tsx`, `BrokerView.tsx`, `useTransactionLogic.ts`, `boardCardActions.ts`, `gameUtils.ts`  
**State Owned:** 股票資產、`marketPrices`, `previousMarketPrices`  
**Rules Owned:** 股票以「張」為單位；買賣金額以市場價格計算；股利是現金，股息是股數增加。  
**Inputs:** 銀行頁買賣、新聞卡、執行師更新市場  
**Outputs:** 股票資產增減、現金增減、市值變化  
**Side Effects:** 財報、歷史、shared dividend prompt  
**Dependencies:** Market、Financial、Asset、Bank  
**Source of Truth:** 持股在 `assets`；價格在 room/gameState 雙來源  
**Shared Multiplayer Behavior:** 股價更新影響所有玩家；股利 / 股息事件也會影響符合條件玩家。  
**Known Hardcoded Rules:** `extractAssetSymbol` 與 symbol 推導；價格 fallback 到 `lastPurchasePrice`。  
**Known Duplicate Logic:** 股票市值、symbol 正規化、持股數量映射在多處存在。  
**Known Architecture Problems:** 市值、持股、價格來源沒有完全單一化。  
**Reusable In New Version:** 股票資產模型與市場事件類型。  
**Should Not Be Copied:** 用資產名稱正則抽股票代號。

---

## 16. Real Estate System

**System Name:** Real Estate System  
**Purpose:** 管理住宅、店面、自住/出租、房貸、房屋保險、房市新聞。  
**Current Owner:** `useTransactionLogic.ts`, `FinancialStatement.tsx`, `boardCardActions.ts`, `RoomContext.tsx`  
**State Owned:** `Asset(type='不動產')`, `houseType`, `isSelfUse`, `conversionCount`, 房貸 liability  
**Rules Owned:** 房屋可自住或出租；自住無租金、可加幸福；出租有租金收入；可保房屋保險。  
**Inputs:** 銀行購買、房市新聞、收購卡、房屋修繕卡、房屋轉換 modal  
**Outputs:** 資產、貸款、租金收入、幸福項目  
**Side Effects:** 幸福、自住/出租切換、負債更新  
**Dependencies:** Asset、Loan、Insurance、Happiness、News  
**Source of Truth:** `assets` + 對應 liability  
**Shared Multiplayer Behavior:** 房市求購卡可能詢問所有符合條件玩家是否出售。  
**Known Hardcoded Rules:** `REAL_ESTATE_TYPES`、`REAL_ESTATE_PRESETS`、名稱轉 label。  
**Known Duplicate Logic:** 房屋 label 與幸福對應在多處各自推導。  
**Known Architecture Problems:** 房屋市場、房屋 ownership、房屋幸福沒有單一 domain service。  
**Reusable In New Version:** 房型資料、房屋欄位。  
**Should Not Be Copied:** 由字串名稱控制 house type。

---

## 17. Business System

**System Name:** Business System  
**Purpose:** 管理企業 / 工作室購買、現金流、升級、企業貸款、投資。  
**Current Owner:** `useTransactionLogic.ts`, `boardCardActions.ts`, `BizUpgradeModal.tsx`, `useGameLogic.ts`  
**State Owned:** `Asset(type='企業')`, `isUpgraded`, 企業貸款 liability, `pendingStartupUpgradeAction`  
**Rules Owned:** 企業可購買、可升級；小型企業 / 工作室可透過新聞卡與銀行升級流程變化。  
**Inputs:** 交易表單、新聞卡 N055/N056-N058、企業收購卡、升級 modal  
**Outputs:** 企業資產、月收入、企業貸款、升級狀態  
**Side Effects:** 財報、負債、follow-up bank upgrade  
**Dependencies:** Financial、Loan、Asset、Bank、Card  
**Source of Truth:** `assets` + `liabilities` + pending upgrade state  
**Shared Multiplayer Behavior:** 大型企業投資與創業貸款可以是共享事件。  
**Known Hardcoded Rules:** 投資金額與每百萬回報、貸款金額與利息、升級結果流程分散。  
**Known Duplicate Logic:** 企業標籤與收益生成在多處手動組字串。  
**Known Architecture Problems:** 工作室、小型企業、大型企業其實是同一 domain，但實作被拆成多種卡片流。  
**Reusable In New Version:** 企業資產概念與新聞卡資料。  
**Should Not Be Copied:** 依卡片事件零散地創造不同企業子流程。

---

## 18. Profession System

**System Name:** Profession System  
**Purpose:** 管理職業、初始薪資、升等、稱號、職涯能力。  
**Current Owner:** `types.ts`, `useGameLogic.ts`, `PromotionModal.tsx`, `LifelongLearningModal.tsx`, `gameUtils.ts`  
**State Owned:** `profession`, `currentRankLevel`, `currentRankTitle`, `abilities.professionAbilityCount`  
**Rules Owned:** 職業有初始薪資、固定支出、升等表；終身學習成功後可升一級並加薪。  
**Inputs:** 選職業、學校考試、終身學習卡  
**Outputs:** 新薪資、新 rank、新能力  
**Side Effects:** 改收入、改支出、改稱號  
**Dependencies:** School、Financial、Happiness、Card  
**Source of Truth:** `gameState.profession` + rank fields  
**Shared Multiplayer Behavior:** 無；但共享事件可能讓多人各自進學校流程。  
**Known Hardcoded Rules:** 升等表直接在 profession data；成功條件由骰點比較。  
**Known Duplicate Logic:** rank title / salary 在 profession 物件與單獨 rank fields 同時存在。  
**Known Architecture Problems:** profession 原始資料與當前職涯狀態沒有完全拆分。  
**Reusable In New Version:** Profession 模型與 promotion 規則。  
**Should Not Be Copied:** 把 current rank 與 profession salary 分開又互相覆蓋。

---

## 19. Family System

**System Name:** Family System  
**Purpose:** 管理幸福家庭重要歷程、多玩家共同參與、孩子數與家庭幸福進度。  
**Current Owner:** `familyMilestones.ts`, `boardCardActions.ts`, `RoomContext.tsx`, `GameView.tsx`  
**State Owned:** `completedHappinessEvents`, `children`, `familyMilestoneJoinPrompt`, `pendingFamilyMilestoneJoinAction`  
**Rules Owned:** 家庭歷程按順序推進；其他玩家可擲骰加入；孩子最多兩個；完成階段會增加幸福與可能增加月支出。  
**Inputs:** H011-H020、H043-H046 幸福卡、其他玩家回覆  
**Outputs:** 歷程進度、幸福、月支出、孩子數  
**Side Effects:** shared prompt、pending action、財務檢核  
**Dependencies:** Happiness、Card、Financial、Multiplayer  
**Source of Truth:** 個人進度在 `gameState`; shared join prompt 在 `boardState`  
**Shared Multiplayer Behavior:** 有正式 join prompt；每位 target player 只能回一次。  
**Known Hardcoded Rules:** `FAMILY_MILESTONE_STAGES` 只定義 5 階段主資料，其他卡號會映射回當前階段。  
**Known Duplicate Logic:** 完成狀態同時看 `completedHappinessEvents` 與幸福項 checked 狀態。  
**Known Architecture Problems:** 個人歷程狀態與共享 join prompt 分成兩條流程，靠 `pendingFamilyMilestoneJoinAction` 重新接回。  
**Reusable In New Version:** 階段資料、join prompt 模型。  
**Should Not Be Copied:** 讓 modal snapshot 與 Firestore prompt 並存太久。

---

## 20. Player State

**System Name:** Player State  
**Purpose:** 保存單一玩家完整遊戲狀態。  
**Current Owner:** `GameContext.tsx`, `types.ts`  
**State Owned:** `GameState` 全部欄位  
**Rules Owned:** 玩家 setup 後會自動保存到 localStorage；非房主且已 setup 的玩家會 debounce 同步到 room.playerStates。  
**Inputs:** 全部玩家操作與事件結果  
**Outputs:** 財報、幸福、房間監控用 playerState snapshot  
**Side Effects:** localStorage、Firestore `rooms.playerStates`, `player_sessions`  
**Dependencies:** 幾乎全部系統  
**Source of Truth:** 實際是 local `gameState` 主導，再同步到 room  
**Shared Multiplayer Behavior:** coach 端透過 `room.playerStates` 讀所有玩家狀態。  
**Known Hardcoded Rules:** `happiness_game_state` localStorage key、800ms debounce。  
**Known Duplicate Logic:** room.playerStates 與 local gameState 高度重複。  
**Known Architecture Problems:** 單玩家正式狀態與多人同步副本沒有明確主副關係。  
**Reusable In New Version:** `GameState` 欄位清單很有參考價值。  
**Should Not Be Copied:** 本地 state 與雲端副本長期雙寫。

---

## 21. Room State

**System Name:** Room State  
**Purpose:** 保存房間整體狀態、成員、遊戲狀態、棋盤狀態、多人事件與市場。  
**Current Owner:** `RoomContext.tsx`, `types.ts`  
**State Owned:** `Room` 介面欄位  
**Rules Owned:** 房間有 `waiting / playing / finished`；host 可開局、結束、關房。  
**Inputs:** 建房、加房、開局、棋盤事件、執行師操作  
**Outputs:** 所有多人同步畫面  
**Side Effects:** Firestore `rooms/{id}` 單文件重度更新  
**Dependencies:** Auth、Game、Coach、Multiplayer、Board  
**Source of Truth:** Firestore room document  
**Shared Multiplayer Behavior:** 所有玩家與執行師都依賴這份 room 文件  
**Known Hardcoded Rules:** roomId 直接當房號；role 為 coach 的成員不進 `turnOrder`。  
**Known Duplicate Logic:** room 內 playerStates 與個人 local state 重疊。  
**Known Architecture Problems:** room 文件承載太多責任。  
**Reusable In New Version:** `Room` 介面可當欄位盤點。  
**Should Not Be Copied:** 把所有多人狀態塞進單一 room 文檔。

---

## 22. Multiplayer Shared Events

**System Name:** Multiplayer Shared Events  
**Purpose:** 讓多位玩家回覆同一張卡片或同一個家庭歷程加入請求。  
**Current Owner:** `RoomContext.tsx`, `GameView.tsx`, `boardCardActions.ts`  
**State Owned:** `familyMilestoneJoinPrompt`, `sharedCardPrompt`, 各自 `responses`  
**Rules Owned:** target players 全部回覆完成，事件才可結束；回覆狀態有 `passed/failed/declined` 或 `completed/declined/no_effect`。  
**Inputs:** 家庭歷程卡、求購卡、股利卡、大型企業投資、創業貸款  
**Outputs:** 回覆、各自財務 / 資產變動、事件完成  
**Side Effects:** Firestore prompt response deep update、pending action 標記  
**Dependencies:** Card、Turn、Financial、Market、Family  
**Source of Truth:** `boardState.familyMilestoneJoinPrompt`, `boardState.sharedCardPrompt`  
**Shared Multiplayer Behavior:** 這就是共享行為本身  
**Known Hardcoded Rules:** `kind` 只支援 `asset_sale`, `cash_dividend`, `stock_dividend`, `investment`, `startup_loan`。  
**Known Duplicate Logic:** GameView 內還要維護 prompt snapshot / dismissed ids / submitted ids。  
**Known Architecture Problems:** 共享 prompt 模型已存在，但畫面 lifecycle 仍靠本地 state 大量補強。  
**Reusable In New Version:** shared prompt 概念與 response schema。  
**Should Not Be Copied:** prompt close condition 混用 local snapshot 與 remote response。

---

## 23. Coach / Facilitator System

**System Name:** Coach / Facilitator System  
**Purpose:** 讓執行師建立遊戲、監控玩家、更新市場、審核請求、控制時間。  
**Current Owner:** `CoachDashboard.tsx`, `CoachGameView.tsx`, `RoomContext.tsx`  
**State Owned:** room timer state、pending requests、market update modal、selected player  
**Rules Owned:** coach 可開始遊戲、暫停/調整時間、更新股價、核准請求、結束遊戲。  
**Inputs:** 執行師按鈕操作、待審核請求  
**Outputs:** room timer、market updates、request status、room.status  
**Side Effects:** Firestore room updates、records 保存  
**Dependencies:** Room、Financial、Market、History、Auth  
**Source of Truth:** room document + coach local UI state  
**Shared Multiplayer Behavior:** coach 操作會即時影響所有玩家畫面與房間狀態。  
**Known Hardcoded Rules:** 待審請求只取時間最早的第一筆；room timer 每 10 秒同步一次。  
**Known Duplicate Logic:** 開局邏輯在 RoomContext 與 CoachGameView 都碰 room.status。  
**Known Architecture Problems:** coach system 既是監控台，也是部分遊戲規則的人工審核入口。  
**Reusable In New Version:** 執行師權限、監控需求、timer 需求。  
**Should Not Be Copied:** 讓主持 UI 直接 patch 正式遊戲狀態而沒有更清楚邊界。

---

## 24. Firebase Synchronization

**System Name:** Firebase Synchronization  
**Purpose:** 負責認證、房間即時同步、玩家狀態同步、記錄保存。  
**Current Owner:** `services/firebase.ts`, `AuthContext.tsx`, `GameContext.tsx`, `RoomContext.tsx`  
**State Owned:** Firebase app / auth / firestore / storage 連線  
**Rules Owned:** 使用 Firestore rooms 單文檔即時同步；玩家 local state 會 debounce 推回 room.playerStates。  
**Inputs:** 所有 room / player / coach 事件  
**Outputs:** snapshot、房間同步、玩家同步、歷史記錄  
**Side Effects:** `rooms`, `users`, `player_sessions`  
**Dependencies:** Auth、Room、Game、Coach、History  
**Source of Truth:** Firestore collections  
**Shared Multiplayer Behavior:** 所有多人同步都走 Firestore snapshot  
**Known Hardcoded Rules:** 啟用 `experimentalAutoDetectLongPolling`；可用 emulator env 開關。  
**Known Duplicate Logic:** local sync 與 snapshot sync 同時存在。  
**Known Architecture Problems:** 沒有把 shared state 與 per-player state 拆乾淨。  
**Reusable In New Version:** Firebase 專案、基本連線方式、auth 流程。  
**Should Not Be Copied:** 單 room 文檔承載所有高頻寫入。

---

## 25. Modal / Pending Interaction Flow

**System Name:** Modal / Pending Interaction Flow  
**Purpose:** 管理銀行、卡片、骰子、財務檢核、理賠、學校、醫院、家庭歷程等互動流程。  
**Current Owner:** `GameView.tsx`  
**State Owned:** 大量 local UI state，例如 `showTransactionModal`, `showPaydayModal`, `boardFinancialAction`, `pendingForcedBoardPayment`, `familyJoinPromptSnapshot`, `sharedCardPromptSnapshot`, `pendingSharedCardCompletion` 等  
**Rules Owned:** 某些 modal 必須在前一層完成後才能關；財務檢核完成後才能繼續事件；shared/family result 顯示需保留數秒。  
**Inputs:** 玩家點擊、snapshot 變更、事件結果  
**Outputs:** 下一個 modal、事件完成、交易提交  
**Side Effects:** 觸發 Firestore 寫入與本地流程跳轉  
**Dependencies:** 幾乎所有核心系統  
**Source of Truth:** 沒有單一 source；room state + GameView local state 共同控制  
**Shared Multiplayer Behavior:** shared prompt / family join modal 直接依賴 room prompt 與本地 snapshot  
**Known Hardcoded Rules:** `FAMILY_JOIN_RESULT_DISPLAY_MS = 2500`；多組 `handled...Keys` 陣列避免重複觸發。  
**Known Duplicate Logic:** prompt 是否顯示、是否已提交、是否已關閉在多個陣列和 snapshot 同時記錄。  
**Known Architecture Problems:** `GameView.tsx` 承擔大量規則流程編排。  
**Reusable In New Version:** 哪些互動節點需要 modal 很有參考價值。  
**Should Not Be Copied:** 以單一大頁面本地 state 編排全部核心流程。

---

## 26. Game Completion / Victory Conditions

**System Name:** Game Completion / Victory Conditions  
**Purpose:** 決定遊戲什麼時候算贏、什麼時候顯示結算、如何存檔與計分。  
**Current Owner:** `gameUtils.ts`, `GameContext.tsx`, `GameView.tsx`, `ScoreView.tsx`, `CoachGameView.tsx`  
**State Owned:** `scoreResult`, `happinessTotal`, `summary.passiveIncome`, `summary.totalExpenses`, `room.status`, `hasShownWinAnimation`  
**Rules Owned:** 幸福值達 100 會播放 win animation；room.status 變 `finished` 後進入結算畫面；`calculateScoreResult()` 會依幸福與財務條件算總分。  
**Inputs:** 執行師結束遊戲、幸福值達標、時間到  
**Outputs:** score view、records、排名  
**Side Effects:** `saveGameRecord`, `player_sessions`, leaderboard / records  
**Dependencies:** Happiness、Financial、Coach、History  
**Source of Truth:** room finished 狀態 + 本地 score calculation  
**Shared Multiplayer Behavior:** 結束由 room.status 廣播；每位玩家各自算自己的 final score。  
**Known Hardcoded Rules:** 幸福 10/30/60/80/100 給不同分數；財務安全/寬裕/自由用固定公式。  
**Known Duplicate Logic:** 勝利動畫與真正 room 結束是兩個不同概念。  
**Known Architecture Problems:** 「幸福 100」與「遊戲正式結束」不是同一個 state。  
**Reusable In New Version:** 計分條件、結算需求。  
**Should Not Be Copied:** 把 win animation 當成接近勝利的主要流程節點。

---

## 額外不可漏掉的 Legacy 規則

以下不是獨立系統，但在新版本若漏掉，玩法會直接失真：

1. **棋盤固定 52 格循環**
2. **學校同時是起點與事件格**
3. **銀行、學校、維修廠有經過與停留兩種層級**
4. **有汽車可選 1 顆或 2 顆移動骰**
5. **家庭歷程最多兩個孩子**
6. **醫療保險是獨立 count；房屋/汽車保險掛資產**
7. **股票、定存、房屋、企業、汽車都會改財報**
8. **shared prompt 與 family join prompt 需要全員回覆**
9. **執行師有市場發布、請求審核、時間控制權**
10. **玩家本地狀態會同步進房間，供執行師監看**

---

## 主要衝突清單

### 衝突 1：股票價格主權
- **程式**
  - `BankingAppModal` 優先用 `room.marketPrices`
  - `calculateFinancialSummary` 仍用 `gameState.marketPrices`
- **文件**
  - 多份 GDD / Decision 指向 `room.marketPrices` 為正式來源

### 衝突 2：貸款主權
- **程式**
  - `liabilities` 與 `loans` 同時參與計算
- **文件**
  - `liabilities` 應是唯一正式負債來源

### 衝突 3：幸福家庭歷程完成狀態
- **程式**
  - 同時看 `completedHappinessEvents` 與 `happiness.checked`
- **資料**
  - `familyMilestones.ts` 定義了五階段
- **文件**
  - 正式規格偏向明確階段推進

### 衝突 4：卡片資料已完整，但 resolver 未必完整落地
- **JSON**
  - 很多卡片已寫完整條件、多人影響、follow-up
- **程式**
  - 只有 `resolveBoardCardAction()` 支援到的才真正能執行

### 衝突 5：銀行事件與銀行服務窗口
- **程式**
  - 兩者都存在，但入口與可用條件分散在 `GameView` 和銀行 modal
- **文件**
  - 已明確拆成 Event 與 Window 兩層

---

## 最後結論

如果把目前專案當成 Legacy Reference，新版本至少不能漏掉以下五大塊：

1. **完整的棋盤回合循環**
   - 建房、開局、回合、擲骰、移動、經過 / 停留、事件、切下一位

2. **三層卡片流程**
   - 抽卡、reveal、resolve
   - self / shared / follow-up 三種事件型態

3. **完整財務域**
   - 現金、收入、支出、月現金流、資產、負債、理賠、定存、股市、房市、企業、還款、強制負債

4. **多人共享事件**
   - 家庭歷程 join prompt
   - shared card prompt
   - shared dividend / asset sale / investment / startup loan

5. **執行師與 Firebase 即時同步**
   - 房間管理、時間控制、股市更新、請求審核、監控 player state

這份 Legacy 專案的價值不在它的現有結構，而在它已經實際涵蓋了大部分玩法規則、流程節點與多人互動邊界。新版本若完全重做，以上內容都必須被重新承接。

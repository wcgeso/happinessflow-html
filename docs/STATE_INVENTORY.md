# State Inventory

> 盤點基準：`線上版0618` 工作樹目前內容，2026-07-01。
>
> 本文件只記錄目前程式已存在的 State，不提出新 State、不重構、不改變規則。`Firestore` 欄表示該 State 本身是否會寫入 Firestore；「間接」表示它是 Firestore State 的本地鏡像或處理旗標，但本身不寫入。

## State 層級總覽

| 層級 | 現有權威來源 | 持久性 |
|---|---|---|
| 使用者身分 | Firebase Auth、`users/{uid}` | 雲端 |
| 玩家遊戲資料 | `GameContext.gameState`、`rooms/{roomId}.playerStates.{uid}` | localStorage + Firestore |
| 房間與棋盤 | `rooms/{roomId}` | Firestore |
| 個人場次備份 | `player_sessions/{uid}/records/{sessionId}` | Firestore |
| 畫面與流程 | 各元件 `useState` / `useRef` | 記憶體；少數旗標另存 localStorage |

## 1. Game State

主要型別是 `GameState`，定義於 `src/types.ts`，由 `GameContext` 持有，交易規則主要由 `useGameLogic` 修改。

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `gameState` | 單一玩家整份遊戲狀態 | `src/context/GameContext.tsx`、`src/hooks/useGameLogic.ts`、`src/views/game/*`、多個 banking/business 元件 | 玩家操作、系統規則；執行師可透過雲端資料管理間接改變 | 是，房內寫入 `rooms.playerStates.{uid}`；另備份到 `player_sessions` | 否 |
| `profession`、`currentRankTitle`、`currentRankLevel` | 職業與升等狀態 | `src/types.ts`、`SelectionView.tsx`、`GameView.tsx`、`useGameLogic.ts` | 玩家選擇；玩家申請後由執行師核准；系統套用結果 | 是 | 否 |
| `selectedEnterprise`、`selectedDream` | 玩家開局選定企業與夢想 | `SelectionView.tsx`、`GameContext.tsx`、`useGameLogic.ts` | 玩家、開發者測試入口 | 是 | 否 |
| `expenses`、`income` | 收入與三類支出 | `useGameLogic.ts`、`gameUtils.ts`、`FinancialStatement.tsx`、卡片處理 | 玩家交易、卡片系統、發薪/事件流程 | 是 | 否 |
| `cash` | 玩家可用現金 | `useGameLogic.ts`、交易與銀行元件、財務報表 | 玩家交易、系統結算、卡片效果 | 是 | 否 |
| `assets`、`liabilities`、`loans` | 資產、明細負債與舊版信用貸款總額 | `useGameLogic.ts`、`BankingView.tsx`、`FinancialStatement.tsx`、`boardCardActions.ts` | 玩家交易、卡片系統 | 是 | 否 |
| `children`、`medicalInsuranceCount` | 子女數與醫療保險份數 | `useGameLogic.ts`、幸福卡/保險流程 | 玩家交易、卡片系統 | 是 | 否 |
| `history` | 已完成交易流水 | `useGameLogic.ts`、`HistoryTable.tsx`、`CashFlowLog.tsx` | 系統在交易完成後新增；玩家可觸發刪除 | 是 | 否 |
| `happiness`、`happinessTotal`、`completedHappinessEvents` | 幸福項目、總分及已完成事件 | `useGameLogic.ts`、`HappinessPanel.tsx`、`familyMilestones.ts` | 玩家、卡片系統、執行師核准流程 | 是 | 否 |
| `abilities` | 股票、不動產、職業能力次數 | `useGameLogic.ts`、終身學習流程 | 玩家申請、執行師核准、系統套用 | 是 | 否 |
| `isSetup`、`selectionStep` | 開局選擇是否完成及目前選擇步驟 | `GameContext.tsx`、`App.tsx`、`SelectionView.tsx`、`CoachGameView.tsx` | 玩家、系統重置 | 是 | 否 |
| `playerName`、`reportName`、`sessionId` | 場次識別與報告資料 | `App.tsx`、`GameContext.tsx`、`ScoreView.tsx` | 玩家、系統 | 是 | 否 |
| `hasShownWinAnimation` | 防止幸福達標動畫重複顯示 | `GameView.tsx`、`GameContext.tsx` | 系統 | 是，因為位於整份 `GameState` | 否；用途是 UI 防重，但儲存在遊戲資料內 |

## 2. Player State

目前沒有獨立 `PlayerState` 型別。程式以 `Record<string, GameState>` 表示房內每位玩家狀態。

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `room.playerStates` | 房間文件內的所有玩家完整 `GameState` | `RoomContext.tsx`、`GameContext.tsx`、`CoachGameView.tsx`、`BoardProjectionView.tsx` | 各玩家寫入自己的狀態；棋盤系統可批次更新；現行規則允許已登入者更新 room | 是 | 否 |
| `RoomContext.playerStates` | `room.playerStates` 的 React state 鏡像，供執行師與 UI 讀取 | `RoomContext.tsx`、`CoachGameView.tsx` | Firestore snapshot 系統 | 間接，只讀取同步結果 | 否 |
| `boardPosition`、`skipTurns`、`lastBoardEvent` | `GameState` 內的玩家棋盤輔助欄位 | `types.ts`、`RoomContext.tsx`、`GameView.tsx` | 棋盤系統 | 是 | 否 |
| `bankServiceWindowActive`、`bankServiceGrantedAtEventId` | 玩家經過銀行後的服務窗口 | `types.ts`、`RoomContext.tsx`、`GameView.tsx` | 棋盤系統、玩家完成銀行流程 | 是 | 否 |
| `pendingCardAction` | 玩家待處理卡片動作字串 | `types.ts`、`GameView.tsx` | 棋盤系統、玩家 | 是 | 否 |
| `pendingFamilyMilestoneJoinAction` | 共同參與成功後，指定玩家尚待執行的家庭歷程動作 | `types.ts`、`RoomContext.tsx`、`GameView.tsx` | 系統建立；玩家完成後清除 | 是 | 否 |

## 3. Room State

`Room` 定義於 `src/context/RoomContext.tsx`，Firestore 文件 `rooms/{roomId}` 是共享來源。

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `room` | 目前房間的本地鏡像 | `RoomContext.tsx`、`App.tsx`、Lobby/Game/Coach/Board 相關畫面 | Firestore snapshot；建房/加入時本地預設 | 間接 | 否 |
| `id`、`name`、`hostId`、`members`、`maxPlayers`、`createdAt` | 房間識別、房主、成員與容量 | `RoomContext.tsx`、`RoomView.tsx`、`CoachGameView.tsx` | 執行師建立；玩家加入/離開；房主關房 | 是 | 否 |
| `status` | `waiting` / `playing` / `finished` | `RoomContext.tsx`、`App.tsx`、Lobby/Game/Coach 畫面 | 執行師/房主 | 是 | 否 |
| `duration`、`startedAt`、`sessionId` | 房間設定時長與場次識別 | `RoomContext.tsx`、`CoachGameView.tsx`、紀錄畫面 | 執行師建立/開始遊戲；系統產生 ID | 是 | 否 |
| `isBoardGame`、`isPractice` | 棋盤模式與練習模式 | `CreateRoomModal.tsx`、`RoomContext.tsx`、`App.tsx`、`CoachGameView.tsx` | 執行師建立房間 | 是 | 否 |
| `isLoadingRoom`、`error` | RoomContext 載入與錯誤狀態 | `RoomContext.tsx`、Lobby 房間流程 | 系統 | 否 | 是 |

## 4. Board State

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `room.boardState` | 棋盤模式完整共享狀態 | `types.ts`、`RoomContext.tsx`、`GameView.tsx`、`BoardProjectionView.tsx` | 目前玩家、其他參與玩家、棋盤系統 | 是 | 否 |
| `currentTurnUid`、`turnOrder` | 回合順序與目前玩家 | `RoomContext.tsx`、`GameView.tsx`、`BoardProjectionView.tsx` | 系統在開始、結算移動及跳過回合時改變 | 是 | 否 |
| `playerPositions`、`skipTurns` | 所有玩家位置與停權回合數 | 同上 | 棋盤系統 | 是 | 否 |
| `lastRoll` | 最近一次擲骰者、骰值、合計、時間 | 同上 | 目前玩家呼叫擲骰；系統寫入 | 是 | 否 |
| `currentEvent`、`pendingEvents` | 目前事件與待處理事件佇列 | `types.ts`、`RoomContext.tsx`、`GameView.tsx`、投影畫面 | 棋盤系統；玩家完成事件後推進 | 是 | 否 |
| `realEstateMarket` | 被放棄、可供其他玩家購買的不動產卡 ID | `RoomContext.tsx`、`GameView.tsx` | 玩家放棄或購買 | 是 | 否 |
| `cardLog` | 棋盤抽卡紀錄，程式限制最多 40 筆 | `RoomContext.tsx`、`BoardCardLogPanel.tsx`、投影與玩家畫面 | 系統 | 是 | 否 |
| `updatedAt` | 棋盤最近更新時間 | `RoomContext.tsx` | 系統 | 是 | 否 |

## 5. Movement State

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `boardState.movement` | 共享棋子移動動畫與結算依據 | `types.ts`、`RoomContext.tsx`、`BoardProjectionView.tsx` | 目前玩家啟動；擲骰端或逾時補償系統結束 | 是 | 否 |
| `playerUid`、`startPosition`、`path`、`rollTotal`、`dice` | 移動者、起點、逐格路徑與骰值 | 同上 | 系統建立 | 是 | 否 |
| `startedAt`、`stepDurationMs`、`introDelayMs`、`landingDelayMs`、`isActive` | 跨裝置動畫時間基準與活動狀態 | 同上 | 系統建立/結算 | 是 | 否 |
| `animationNow` | 投影畫面計算當前動畫進度的本地時鐘 | `BoardProjectionView.tsx` | 系統 interval / animation frame | 否 | 是 |
| `dragStateRef`、`zoom` | 投影棋盤拖曳及縮放狀態 | `BoardProjectionView.tsx` | 操作投影畫面的人、系統自適應 | 否 | 是 |

## 6. Card State

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `boardState.deckState` | 三個牌堆的待抽與已抽卡 ID | `types.ts`、`constants/board.ts`、`RoomContext.tsx` | 系統抽卡及牌堆耗盡重洗 | 是 | 否 |
| `happiness` / `opportunity` / `news` | 尚未抽出的卡片 ID | 同上 | 系統 | 是 | 否 |
| `usedHappiness` / `usedOpportunity` / `usedNews` | 已抽出的卡片 ID | 同上 | 系統 | 是 | 否 |
| `boardState.currentCard` | 目前卡片的共享結果 | `types.ts`、`RoomContext.tsx`、`GameView.tsx`、`BoardProjectionView.tsx` | 系統抽卡/推進事件 | 是 | 否 |
| `boardState.currentCardReveal` | 卡片是否揭露、揭露時間與揭露者 | 同上 | 玩家揭露；系統清除 | 是 | 否 |
| `lastBoardCardKey`、`handledBoardCardKeys` | 玩家端卡片 UI 防重處理 | `GameView.tsx` | 系統 effect、玩家關閉卡片 | 否 | 是 |
| `isBoardCardDrawerOpen`、`isBoardCardRevealed` | 玩家端抽卡抽屜與揭露顯示 | `GameView.tsx` | 玩家、系統 | 否 | 是 |
| `pendingHandledBoardCard` | 財務流程完成前暫存待標記卡片 | `GameView.tsx` | 玩家流程、系統 | 否 | 是，亦是本地流程 State |
| `pendingMarketPurchaseCardId` | 從共享市場購買時暫存卡 ID | `GameView.tsx` | 玩家 | 否 | 是，亦是本地流程 State |

## 7. UI State

以下是純顯示、表單或本地流程 State；除表中特別註明，皆不寫入 Firestore。

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `currentView`、`targetHistoryUserId`、`sessionMeta` | 全站畫面切換、歷史目標及場次表單資料 | `src/App.tsx` | 玩家/執行師/管理員、系統 | 否 | 是 |
| `lobbyViewMode`、`isViewModeDropdownOpen`、`hasLobbyModalOpen` | 玩家/執行師/GM 大廳模式及選單 | `App.tsx` | 使用者 | 否 | 是 |
| `hasDevEnabled`、`isDevPortalOpen`、`showDevConfirm`、`isDevRouting`、`practiceRoomAutoOpen` | 開發者與練習入口流程 | `App.tsx`、`DeveloperPortal.tsx` | 管理員；部分持久化 localStorage | 否 | 是 |
| `lastProcessedStartTime` | 防止同一房間開始時間被重複處理 | `App.tsx` | 系統 | 否 | 是 |
| `currentStep`、`selectedProfessionId`、`selectedEnterpriseId`、`selectedDreamId` | 開局選擇 UI | `SelectionView.tsx` | 玩家 | 否；確認後才進 `gameState` | 是 |
| `phase`、`mode`、`assetType`、各 `*Input` / `*Amount` / `*Symbol` / `*Selected*` / `*SubMode`、`pendingTx`、`userEntries`、`correctEntries` | 財務檢核與交易表單完整流程 | `useTransactionLogic.ts` | 玩家 | 否；提交後才改 `gameState` | 是 |
| `happinessSubMode` | 幸福交易區子模式 | `useGameLogic.ts` | 玩家 | 否 | 是 |
| `view`、`isIncomeOpen`、`isBalanceOpen`、`showFullDetails`、`upgradingAsset`、`convertingHouse` | 財務報表分頁、展開及資產操作選擇 | `FinancialStatement.tsx` | 玩家/執行師 | 否 | 是 |
| `mode`、`tradeQuantities` | 股票買賣表單 | `BrokerView.tsx` | 玩家 | 否 | 是 |
| `productType`、`depositAmount`、`carCashAmount` | 財富商品表單 | `WealthView.tsx` | 玩家 | 否 | 是 |
| `actionType`、`amount`、`selectedRepayTargetId` | 借款/還款表單 | `BankingView.tsx` | 玩家 | 否 | 是 |
| `activeTab` | 銀行 App 分頁 | `BankingAppModal.tsx` | 玩家 | 否 | 是 |
| `reportName` | 建立報告名稱 | `CreateReportView.tsx` | 玩家 | 否；完成後進場次資料 | 是 |
| `activeCategory` | 成就篩選 | `AchievementsView.tsx` | 玩家 | 否 | 是 |
| `roomCodeInput`、`isJoiningRoom`、`joinError` | 加入房間表單 | `LobbyView.tsx` | 玩家、系統 | 否 | 是 |
| `systemStats`、`gmStats`、`allUsers`、`userMap`、`records` 等查詢結果 | 管理、報表及歷史畫面的資料鏡像 | Lobby/Report/History views、Leaderboard/Friends/Profile modals | Firestore 查詢系統；部分由管理員操作刷新 | 間接 | 是 |
| `search*`、`filter*`、`selected*`、`expanded*`、`loading` / `isLoading` / `isSaving` / `isDeleting` / `isUpdating` | 管理、報表、歷史、好友與個人資料畫面的表單/載入狀態 | 對應 views/components | 使用者、系統 | 否 | 是 |
| `copied`、`inviteCodeCopied`、`inviteLinkCopied`、`notification`、`message`、`bindFeedback` | 複製與操作回饋 | `RoomView.tsx`、`ProfileModal.tsx`、`FriendsModal.tsx`、`CoachDashboard.tsx` | 使用者、系統 timeout | 否 | 是 |
| `profileMenu`、`viewProfileUser`、`showReferralTree`、`referralChildren` | 個人資訊與推薦樹 UI | `RoomView.tsx`、`FriendsModal.tsx`、`ProfileModal.tsx` | 使用者、Firestore 查詢系統 | 查詢結果間接 | 是 |
| `show`、`deferredPrompt`、`platform` | PWA 安裝提示 | `InstallPromptBanner.tsx` | 瀏覽器系統、使用者 | 否；已關閉旗標存 localStorage | 是 |
| `imgSrc`、`hasError` | 圖片載入容錯 | `SafeImage.tsx` | 瀏覽器系統 | 否 | 是 |
| `centerIndex`、scroll refs | 選擇輪播位置 | `SelectionCarousel.tsx` | 使用者、系統 | 否 | 是 |

## 8. Modal / Dialog State

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `showTransactionModal`、`showTargetDreamModal`、`showHappinessModal`、`showPromotionModal`、`showLifelongModal`、`showPaydayModal`、`showMedicalClaimModal`、`showDiceModal` | 玩家遊戲主要 Modal 開關 | `GameView.tsx` | 玩家、系統事件 | 否 | 是 |
| `showRankListModal`、`showTutorial`、`showScoreView`、`showLeaveConfirm`、`showRealEstateMarketModal`、`showForcedBoardPaymentModal`、`showHospitalRollModal`、`showBoardCardLog` | 玩家附屬 Modal/畫面開關 | `GameView.tsx` | 玩家、系統事件 | 否 | 是 |
| `showProfileModal`、`showTutorialModal`、`showLetterModal`、`showCreateRoomModal`、`showLeaderboardModal`、`showFriendsModal`、`showCoachHistory`、`showCoachReport`、`showCoachSelfReport`、`showRoomRecords`、`showRoomView` | 大廳 Modal/子畫面 | `LobbyView.tsx` | 使用者 | 否 | 是 |
| `isPlayerListOpen`、`isStockModalOpen`、`isMarketViewOpen`、`isHappinessModalOpen`、`isTimerPanelOpen`、`showRoomInfo` | 執行師監控畫面面板/Modal | `CoachGameView.tsx` | 執行師 | 否 | 是 |
| `confirmPublishData`、`genericConfirm`、`showPublishSuccess`、`showSaveSuccess`、`showBubbleAlert` | 執行師確認與結果 Dialog | `CoachGameView.tsx` | 執行師、系統 | 否 | 是 |
| `showGMTools`、`showSyncConfirm`、`showClearScoresConfirm`、`showChangelog`、`showScoreEdit` | 管理員 Dialog | `CoachDashboard.tsx` | 管理員 | 否 | 是 |
| `isOpen` props | 各共用 Modal 是否顯示 | `components/modals/*`、`BoardCardDrawer.tsx`、`DiceRollContainer.tsx` | 父元件持有者 | 否 | 是 |
| Modal 內部 `step` / `currentStep` / `selectedId` / `claimType` / `targetType` | 教學、企業升級、房屋轉換、理賠、終身學習的內部流程 | 對應 modal 檔案 | 玩家、系統動畫 | 否 | 是 |
| `itemToDelete`、`confirmId`、`deleteTarget` | 刪除確認目標 | `FriendsModal.tsx`、`HistoryTable.tsx`、`RoomRecordsView.tsx` | 使用者 | 否 | 是 |

## 9. Request State

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `room.pendingRequests` | 房內所有待審核請求 map | `RoomContext.tsx`、`CoachGameView.tsx`、`GameView.tsx`、`useGameLogic.ts` | 玩家送出；執行師核准/拒絕；玩家或系統清除 | 是 | 否 |
| `PendingRequest.status` | `pending` / `approved` / `rejected` | 同上 | 建立時為 pending；執行師改結果 | 是 | 否 |
| `PendingRequest.type` | `payday` / `insurance` / `happiness` / `promotion` / `lifelong` | 同上 | 玩家流程決定 | 是 | 否 |
| `pendingRequest` | 執行師端從 map 排序取得的最早 pending request | `CoachGameView.tsx` | 系統衍生 | 否 | 是；衍生值 |
| `pendingForcedBoardPayment` | 強制卡片付款尚待玩家確認 | `GameView.tsx` | 系統卡片流程、玩家 | 否 | 是，本地流程 State |
| `pendingBoardStepAdvance`、`pendingBoardLifelongRoll`、`shouldResumeBankFollowup` | 棋盤事件後續流程暫存 | `GameView.tsx` | 系統、玩家 | 否 | 是，本地流程 State |

## 10. Market State

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `room.marketPrices`、`room.previousMarketPrices` | 房間共享目前/前次股價 | `RoomContext.tsx`、`CoachGameView.tsx`、`GameContext.tsx` | 執行師發布；棋盤新聞卡系統 | 是 | 否 |
| `room.marketUpdates` | 最近一次行情更新內容、卡號、泡沫旗標與時間 | `RoomContext.tsx`、`GameContext.tsx` | 執行師、棋盤系統 | 是 | 否 |
| `gameState.marketPrices`、`previousMarketPrices` | 每位玩家 `GameState` 內的行情副本 | `GameContext.tsx`、`useGameLogic.ts`、銀行/報表 UI | 房間 snapshot 同步；棋盤行情系統 | 是，作為 `playerStates` 一部分 | 否 |
| `marketPriceHistory`、`lastPublishedCode`、`lastMarketUpdateTimestamp` | 玩家行情歷史與最後更新識別 | `types.ts`、`GameContext.tsx`、`useGameLogic.ts` | 系統 | 是 | 否 |
| `stockCode`、`confirmPublishData`、`successCode`、`successPrices`、`isUpdatingMarket` | 執行師發布行情 UI | `CoachGameView.tsx` | 執行師、系統 | 否；確認發布後才寫入房間 | 是 |
| `appliedBoardMarketKeys`、`isApplyingBoardMarket` | 玩家端防止重複套用棋盤行情 | `GameView.tsx` | 系統 | 否 | 是 |

## 11. Family Milestone State

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `completedHappinessEvents` | 推算每位玩家已完成家庭歷程階段 | `types.ts`、`familyMilestones.ts`、`useGameLogic.ts` | 玩家完成卡片後由系統新增 | 是 | 否 |
| `FamilyMilestoneStatus`（函式回傳值） | 從玩家 State 計算目前階段、完成狀態與顯示列 | `familyMilestones.ts`、卡片顯示元件 | 系統衍生 | 否 | 否；衍生資料 |
| `boardState.familyMilestoneJoinPrompt` | 同時邀請其他玩家參與 | `types.ts`、`RoomContext.tsx`、`GameView.tsx` | 抽卡玩家/系統建立；參與玩家回覆；事件推進時清除 | 是 | 否 |
| `responses.{uid}` | 每位目標玩家的 passed / failed / declined、骰點及時間 | 同上 | 各參與玩家 | 是 | 否 |
| `pendingFamilyMilestoneJoinAction` | 通過後尚待套用到玩家的動作 | `types.ts`、`RoomContext.tsx`、`GameView.tsx` | 系統建立；玩家完成後清除 | 是 | 否 |
| `isSubmittingFamilyJoin`、`familyJoinRollValue`、`familyJoinResult`、`handledFamilyJoinActionKeys` | 參與玩家本地送出、骰值、結果及防重 | `GameView.tsx` | 玩家、系統 | 否 | 是 |

## 12. Timer State

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `room.duration` | 建房設定的遊戲分鐘數 | `CreateRoomModal.tsx`、`RoomContext.tsx` | 執行師建房 | 是 | 否 |
| `room.gameTimeLeft`、`room.isTimerPaused` | 房間共享剩餘秒數與暫停狀態 | `RoomContext.tsx`、`CoachGameView.tsx`、`GameHeader.tsx` | 執行師；執行師端 timer 系統週期寫回 | 是 | 否 |
| `timeLeft`、`isPaused` | 執行師端本地倒數鏡像 | `CoachGameView.tsx` | 執行師、interval、Firestore snapshot 校正 | 間接；透過 `updateRoomTimer` 回寫 | 否，屬本地控制 State |
| `GameHeader.timeLeft` | 玩家端格式化倒數顯示 | `GameHeader.tsx` | 系統根據 room timer 更新 | 否 | 是 |
| `prevTimeLeftRef` | 偵測倒數跨越指定門檻 | `CoachGameView.tsx` | 系統 | 否 | 是 |
| 各 `*TimeoutRef` / `timerRef` / `rollIntervalRef` | Alert、動畫、滾動、擲骰與提示的 timer handle | Context/hooks/components | 系統 | 否 | 是 |

## 13. Animation State

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| `isRolling`、`diceValue`、`examResult`、`examLog` | 一般升等/考試擲骰動畫與結果 | `useDiceRollLogic.ts`、`DiceRollContainer.tsx`、`DiceRollModal.tsx` | 玩家啟動、系統 timer 完成 | 否 | 是 |
| `isRollingBoardDice` | 棋盤擲骰按鈕與動畫防重 | `GameView.tsx` | 玩家、系統 | 否 | 是 |
| `isAnimating`、`diceResult`、`showLandingFace`、`diceControls` | `GameActions` 骰子動畫 | `GameActions.tsx` | 玩家、Framer Motion、系統 timer | 否 | 是 |
| `displayValue` | 骰子滾動時顯示面數 | `DiceFace.tsx` | 系統 interval/effect | 否 | 是 |
| `shake`、`showParticles` | 擲骰 Modal 震動與粒子效果 | `DiceRollModal.tsx` | 系統 | 否 | 是 |
| `phase`、`canClose`、`fireworkConfigs` | 幸福 100 分勝利動畫階段 | `HappinessWinAnimation.tsx` | 系統 timer；玩家在允許後關閉 | 否 | 是 |
| `showWinAnimation` | 是否掛載勝利動畫 | `GameView.tsx` | 系統、玩家 | 否 | 是 |
| `direction` | 執行師切換玩家時的轉場方向 | `CoachGameView.tsx` | 執行師 | 否 | 是 |
| `flash`、`prevValue` | 財務數值升降閃爍 | `FinancialStatement.tsx` | 系統 effect | 否 | 是 |

## 14. Network Sync State

專案沒有 Socket/WebSocket State。即時同步使用 Firestore listener。

| State 名稱 | 用途 | 使用檔案 | 可改變者 | Firestore | UI State |
|---|---|---|---|---|---|
| Auth `user`、`isLoadingAuth` | Firebase 身分鏡像與初始化狀態 | `AuthContext.tsx`、全站 | Firebase Auth 系統、使用者登入/登出 | `user` 資料另讀寫 `users`；loading 不同步 | `isLoadingAuth` 是 UI/網路狀態 |
| Room snapshot subscription | 監聽 `rooms/{roomId}`，更新 `room` / `playerStates` | `RoomContext.tsx` | Firestore 系統 | 是，來源即 Firestore | 否 |
| Game room snapshot subscription | 從房間的 `playerStates.{uid}` 恢復自己的 `gameState` | `GameContext.tsx` | Firestore 系統 | 是 | 否 |
| Score/session snapshot subscriptions | 同步正式紀錄與個人場次紀錄 | `GameContext.tsx`、History views | Firestore 系統 | 是 | 否 |
| Board projection snapshot | 未登入投影頁依房號監聽 room | `BoardProjectionView.tsx` | Firestore 系統 | 是 | 否 |
| Friends snapshot subscriptions | 好友與邀請即時同步 | `FriendsModal.tsx` | Firestore 系統、使用者 | 是 | 否 |
| `isLoadingRoom`、`isJoiningRoom`、`isSubmitting`、`isUploading`、`isSaving*`、`isRefreshing`、`isApplying*` | 各網路操作進行中狀態 | Context、views、components | 系統在 Promise 前後切換 | 否 | 是 |
| `uploadStatus` | 結算紀錄上傳狀態 | `ScoreView.tsx`、`CoachGameView.tsx` | 系統 | 否；成功旗標另存 localStorage | 是 |
| `error` / `errorMessage` / `joinError` / `alertInfo` | 網路或流程錯誤回饋 | Context、views、hooks、modals | 系統 catch、使用者重試/關閉 | 否 | 是 |
| `active_room_{uid}` | 重新載入後恢復 room listener 的房號 | `RoomContext.tsx` localStorage | 建房/加入/離開/房間刪除流程 | 否 | 否；本地持久化同步指標 |
| `happiness_game_state` | 遊戲狀態本地備份 | `GameContext.tsx` localStorage | 系統自動儲存、玩家離場清除 | 否 | 否 |
| `sessionIdRef`、`saveToPlayerSessionsRef` | 避免 autosave callback 使用過期場次/函式 | `GameContext.tsx` | 系統 | 否 | 否；網路流程 ref |

## 重複 State

| 重複內容 | 現有位置 | 風險 |
|---|---|---|
| 玩家完整狀態 | `GameContext.gameState`、localStorage `happiness_game_state`、`room.playerStates[uid]`、`player_sessions` | 多來源恢復順序或更新時機不同，可能覆蓋較新資料 |
| 玩家集合 | `room.playerStates` 與 `RoomContext.playerStates` | snapshot 正常時一致，但後者可能短暫保留上一份資料 |
| 市場價格 | `room.marketPrices`、每位 `gameState.marketPrices`、`marketUpdates.updates` | 發布與玩家 snapshot 套用非同一個原子流程，可能短暫或永久不一致 |
| 前次市場價格 | `room.previousMarketPrices`、每位 `gameState.previousMarketPrices` | 同上 |
| 棋盤位置/跳過回合 | `boardState.playerPositions` / `boardState.skipTurns` 與 `GameState.boardPosition` / `GameState.skipTurns` | 同一概念有房間級與玩家級副本 |
| 倒數時間 | `room.gameTimeLeft`、`CoachGameView.timeLeft`、`GameHeader.timeLeft` | 三份表示不同：秒數權威、本地秒數、格式化字串 |
| 卡片揭露 | `boardState.currentCardReveal.isRevealed` 與 `GameView.isBoardCardRevealed` | 雲端狀態與本地顯示旗標可能不同步 |
| 卡片處理防重 | `handledBoardCardKeys`、`lastBoardCardKey`、`pendingHandledBoardCard`、`pendingCardAction` | 多個局部機制共同判定是否已處理 |
| 家庭歷程進度 | `completedHappinessEvents`、衍生 `FamilyMilestoneStatus`、`pendingFamilyMilestoneJoinAction`、join prompt responses | 完成、邀請成功與待套用分散在不同層 |
| 貸款 | `GameState.loans` 與 `GameState.liabilities` 中各類貸款 | 舊總額與明細可能出現不一致 |
| Modal 開關 | 多個 `show*Modal` / `is*ModalOpen`，再傳成子元件 `isOpen` | 正常的父子鏡像，但命名及所有權分散 |
| 成功/防重旗標 | React `uploadStatus` 與 localStorage `score_recorded_*` / `score_incremented_*` | localStorage 與實際 Firestore 寫入結果可能脫節 |

## 命名不一致

| 概念 | 現有命名 |
|---|---|
| Modal 開關 | `showXModal`、`isXModalOpen`、`isOpen`、`showX` 混用 |
| 載入中 | `loading`、`isLoading`、`isLoadingRoom`、`isLoadingAuth`、`isSubmitting`、`isSaving`、`isUploading`、`isRefreshing`、`isApplying` |
| 錯誤 | `error`、`errorMessage`、`joinError`、`bindFeedback`、`alertInfo` |
| 玩家狀態集合 | Firestore 欄位 `playerStates` 與 RoomContext 本地 state 同名，來源層級不同 |
| 市場更新 | `updateMarket` 與 `applyBoardMarketPrices` 都改行情，但入口與權限不同 |
| 汽車 | 部分歷史欄位仍使用 `aircraft` / `飛行器`，目前 UI 與資產型別同時存在 `汽車` / `飛行器` |
| 貸款 | `loans` 表示舊版信用貸款總額，`liabilities` 表示明細；另有 `loanSubMode`、`actionType` |
| 房屋 | `re*`、`realEstate*`、`house*` 三種前綴並存 |
| 執行師 | 程式角色值是 `coach`，中文 UI 使用「執行師」 |
| 目前步驟 | `currentView`、`currentStep`、`selectionStep`、`phase`、`step` 分別表示不同狀態機層級 |

## 容易造成 Bug 的 State

1. `rooms/{roomId}` 是大型共享文件，多個客戶端以 `updateDoc` 改 nested map/整段物件，未普遍使用 transaction；同時操作可能最後寫入覆蓋前一筆。
2. `gameState` 有 localStorage、room playerStates、player_sessions 三個持久來源，重新載入或重新加入時可能由較舊資料覆蓋較新資料。
3. `loans` 與 `liabilities` 同時存在，還款、自動還款與報表若讀取不同欄位會不一致。
4. 市場價格同時存在 room 與每位玩家 GameState；某玩家錯過或重複處理 snapshot 時，銀行顯示可能不同。
5. `CoachGameView.timeLeft` 只在與 room 相差超過 2 秒時校正，且本地 interval 與 Firestore 回寫同時存在，切頁或多執行師開啟時可能漂移。
6. 棋盤移動有 Firestore `movement`、本地 `animationNow`、擲骰端延遲結算及逾時補償；兩個客戶端可能同時嘗試補完同一移動。
7. `currentCardReveal` 與玩家端 `isBoardCardRevealed` 是兩份揭露狀態；網路延遲、重掛載或快速推進事件可能短暫顯示錯卡。
8. 多個 `handled*Keys` 只存在當前 `GameView` 記憶體，重新整理後清空；是否重複執行取決於 Firestore 中其他欄位是否已同步完成。
9. 家庭歷程的完成依 `completedHappinessEvents` 推算，但共同參與結果先經 prompt response，再建立 `pendingFamilyMilestoneJoinAction`；中途離線可能留下待執行狀態。
10. `hasShownWinAnimation` 是 UI 防重旗標卻放在持久化 `GameState`，會跟著玩家資料同步及備份，可能影響下一次場次是否顯示。
11. `score_recorded_*`、`score_incremented_*` 等 localStorage 防重旗標只對單一瀏覽器有效，換裝置或清除儲存後無法防止重複寫入。
12. RoomContext 的 `room` 與 `playerStates` 分開 setState；房間 snapshot 更新的一個 render 期間可能讀到新 room 搭配舊 playerStates。
13. 多處以陣列保存 `handled*Keys`，沒有持久化及數量上限；長場次會持續增長。
14. Firestore Rules 允許任何已登入使用者更新任意 `rooms/{roomId}`，State 的「誰可以改變」目前主要由前端限制，不是資料層強制。

## Need Confirmation

1. `GameState.loans` 是否仍是正式規則的一部分，或只為舊資料相容保留；程式仍在讀寫，不能判定可移除。
2. `GameState.boardPosition` / `skipTurns` 與 `BoardState.playerPositions` / `skipTurns` 哪一份被視為正式權威；目前兩者都存在。
3. 房間市場價格與玩家 GameState 市場價格發生衝突時，產品規格預期以哪一份為準；程式通常由 room 同步到玩家，但未宣告不可逆權威。
4. `pendingCardAction` 的所有合法字串值沒有集中型別，無法由型別確認完整狀態集合。
5. `familyMilestoneStatus` 在 `BoardCardResult` 中型別為 `any`，無法確認持久化時允許的完整結構。
6. `isLeft` 成員是否應保留在 `members`，或離房時一律移除；型別支援 `isLeft`，一般離房流程使用 `arrayRemove`。
7. 是否允許同一房間同時開啟多個執行師控制畫面；這會直接影響 timer、行情與審核 State 的併發預期。
8. 大地圖 `?boardRoom=` 可在 App 登入判斷前直接監聽，但 Firestore Rules 要求 authenticated read；實際投影裝置是否預期先登入，程式碼無法確認。
9. localStorage 的 `score_recorded_*` / `score_incremented_*` 是否被產品定義為正式防重機制；目前沒有伺服器端唯一性流程可證實。
10. `aircraft` / `飛行器` 是否應視為汽車的舊名稱或另一種資產；目前保險、資產型別與 UI 文案混用。

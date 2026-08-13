# 第二人生 專案總覽

> 分析基準：`線上版0618` 工作樹的目前未提交狀態，2026-07-01。
>
> 本文件只描述程式碼中可確認的行為。專案沒有 Socket.IO、原生 WebSocket 或自建 HTTP 後端；多人即時同步全部由 Firebase Firestore `onSnapshot` 完成。

## 1. 專案定位與技術架構

這是一個 Vite + React 19 + TypeScript 的單頁應用（SPA），同一個前端同時提供玩家、執行師、管理員及大地圖投影介面。

| 層級 | 技術 / 位置 | 責任 |
|---|---|---|
| 啟動與路由 | `src/App.tsx` | Provider 組裝、登入判斷、以 React state 切換頁面、解析 `?boardRoom=` 投影模式 |
| UI | `src/views/`、`src/components/` | 玩家、執行師、管理員、棋盤、報表及各種交易介面 |
| 應用狀態 | `src/context/` | Auth、Game、Room 三個 React Context |
| 遊戲規則 | `src/hooks/`、`src/utils/` | 交易、擲骰、卡片效果、財務計算、家庭歷程等規則 |
| 靜態資料 | `src/constants.ts`、`src/constants/` | 職業、企業、夢想、股票、棋盤、卡牌、成就及版本 |
| 雲端服務 | `services/firebase.ts` | Firebase Auth、Firestore、Storage 初始化 |
| AI 服務 | `services/geminiService.ts` | Google Gemini 遊戲報告文字分析 |
| 維運腳本 | `scripts/` | 建立測試帳號、修補執行師紀錄 |
| 部署 | `vite.config.ts`、`vercel.json` | Vite 建置、Vercel SPA rewrite |

### 執行流程

```text
index.html
  -> src/App.tsx
     -> AuthProvider
        -> RoomProvider
           -> GameProvider
              -> AppContent / MainRouting
                 -> 玩家、執行師、管理員或大地圖介面
```

`App.tsx` 沒有使用 React Router。頁面由 `currentView` 狀態切換，因此網址除了 `?boardRoom={roomCode}` 之外，不代表目前頁面，也沒有瀏覽器路由歷史。

## 2. 主要模組

### Context

| 模組 | 主要責任 |
|---|---|
| `AuthContext.tsx` | Firebase 登入狀態、Email/Google/Apple 登入、註冊、登出、個人資料、邀請碼與推薦關係 |
| `RoomContext.tsx` | 房間生命週期、房間即時監聽、共享玩家狀態、行情、審核請求、棋盤回合與卡片事件 |
| `GameContext.tsx` | 單一玩家 `GameState`、初始化/重置、玩家存檔、遊戲紀錄與房間內玩家狀態同步 |

### Views

| 目錄 / 畫面 | 主要責任 |
|---|---|
| `views/auth` | 登入與註冊 |
| `views/lobby` | 大廳、房間、執行師控場、管理員後台、開發者入口 |
| `views/selection` | 選擇職業、企業與夢想 |
| `views/game` | 玩家主遊戲、結算與分數 |
| `views/board` | 大地圖投影，只靠房號直接監聽房間文件 |
| `views/history` | 玩家與執行師歷史紀錄 |
| `views/report` | 執行師報表及房間紀錄管理 |
| `views/achievements` | 成就列表 |
| `views/setup` | 建立遊戲報告基本資料 |

### Components

| 目錄 | 主要責任 |
|---|---|
| `components/banking` | 股票、銀行貸款、定存、保險、資產與夢想購買 |
| `components/business` | 收支表、資產負債表、交易歷史、幸福項目 |
| `components/game` | 玩家狀態、行動、擲骰、棋盤卡片與財務檢核 |
| `components/board` | 大地圖抽卡日誌 |
| `components/transaction` | 財務檢核、股票行情及目標達成 |
| `components/modals` | 房間、升職、終身學習、保險理賠、教學等對話框 |
| `components/common` | 圖片容錯、圖示、選擇器、錯誤邊界 |

### 規則與資料

| 模組 | 主要責任 |
|---|---|
| `useGameLogic.ts` | 所有交易落帳、資產負債變動、自動還款、發薪、保險、升職、企業升級與結算 |
| `useTransactionLogic.ts` | 財務檢核表單流程、交易模式與確認流程 |
| `useDiceRollLogic.ts` | 一般擲骰動畫與結果 |
| `boardCardActions.ts` | 將卡號解析成財務、幸福、行情、出售、選擇或不支援動作 |
| `familyMilestones.ts` | 五階段家庭重要歷程規則與每位玩家進度 |
| `gameUtils.ts` | 財務摘要、分數、金額格式、初始幸福清單 |
| `constants/cards.ts` | 幸福、機運、新聞卡完整資料及索引 |
| `constants/board.ts` | 棋盤格、初始牌堆、格子查詢 |
| `types.ts` | 遊戲、棋盤、交易、資產、負債、紀錄等共用型別 |

## 3. 遊戲狀態管理

### 三層狀態

1. **畫面暫態**：各 View/Component 的 `useState`，例如對話框開關、目前頁籤、卡片是否揭露。這些狀態不跨裝置同步。
2. **玩家遊戲狀態**：`GameContext.gameState`，型別為 `GameState`。包含現金、資產、負債、收入、支出、幸福、歷史交易、職業階級、能力及棋盤輔助旗標。
3. **房間共享狀態**：Firestore `rooms/{roomCode}`，包含 `members`、`playerStates`、`marketPrices`、`pendingRequests` 與 `boardState`。

### 玩家狀態寫入

```text
玩家操作
  -> useGameLogic / useTransactionLogic 計算新的 GameState
  -> GameContext.setGameState
  -> 更新本地 React state
  -> 若位於房間，updateDoc rooms/{roomCode}.playerStates.{uid}
  -> 其他用戶的 RoomContext onSnapshot 收到整份房間新狀態
```

`GameContext` 同時把玩家場次備份到 `player_sessions/{uid}/records/{sessionId}`。玩家重新加入時，優先使用房間中的 `playerStates[uid]` 恢復；`active_room_{uid}` localStorage 只保存目前房號，並非權威遊戲資料。

### 狀態權威來源

| 狀態 | 權威來源 |
|---|---|
| 身分與個人資料 | Firebase Auth + `users/{uid}` |
| 房間、回合、行情、棋盤 | `rooms/{roomCode}` |
| 房內玩家財務狀態 | `rooms/{roomCode}.playerStates.{uid}` |
| 玩家場次備份 | `player_sessions/{uid}/records/{sessionId}` |
| 正式結算紀錄 | `score_records/S1/records/{recordId}` |
| 執行師紀錄 | `coach_records/{recordId}` |
| 純 UI 偏好/防重旗標 | localStorage |

## 4. 多人同步流程

### 建房與加入

1. 執行師建立六位數房號並寫入 `rooms/{roomCode}`。
2. 玩家讀取房間文件，驗證房間存在、狀態及人數後，以 `arrayUnion` 加入 `members`。
3. 每個登入用戶的 `RoomContext` 對該房間建立一個 `onSnapshot`。
4. 每次文件改變，所有客戶端更新 `room` 與 `playerStates`。
5. 斷線重連依 localStorage 房號與雲端 `playerStates[uid]` 恢復。

### 開始與結束

執行師開始遊戲時，房間狀態改為 `playing`、清空舊 `playerStates` 與 `pendingRequests`、建立新 `sessionId`，棋盤模式另建立初始 `boardState`。結束時狀態改為 `finished`；關房則刪除房間文件，所有監聽端因文件不存在而退出。

### 玩家狀態同步

每位玩家只由自己的 `GameContext` 計算並提交自身 `GameState`。執行師介面與大地圖不重算玩家財務，而是讀取房間文件中的 `playerStates`。行情與棋盤事件則是房間級共享資料。

### 棋盤同步

```text
目前玩家 rollBoardDice()
  -> 寫入 boardState.lastRoll + movement
  -> 所有裝置播放相同 movement.path
  -> 擲骰端延遲到動畫結束後讀取最新房間
  -> buildBoardMovementResolution()
  -> 寫回位置、事件佇列、目前卡片、下一回合
  -> 若擲骰端中斷，房主或該玩家的 snapshot listener 可補完過期 movement
```

棋盤牌堆使用 `BoardDeckState` 的 `happiness`、`opportunity`、`news` 保存待抽卡，並以對應的 `usedHappiness`、`usedOpportunity`、`usedNews` 保存已抽卡；待抽陣列空時才把已抽陣列洗回。

### 同時參與家庭歷程

目前玩家揭露可共同參與的家庭歷程卡後，房間建立 `boardState.familyMilestoneJoinPrompt`，列出所有 eligible player。其他玩家的 `GameView` 同時從同一個 snapshot 收到 prompt，各自提交 `responses.{uid}`；結果不是依序傳遞。

### 審核請求

玩家把發薪、保險、幸福、升職或終身學習請求寫入 `pendingRequests.{requestId}`。執行師將其狀態改為 `approved` 或 `rejected`，玩家端收到 snapshot 後執行或取消本地流程，再清除該 request。

### 同步限制

- 房間大部分更新是「先讀取客戶端現有 room，再 `updateDoc`」，未使用 Firestore transaction；多人同時更新相同 map/array 時存在最後寫入者覆蓋風險。
- `rooms/{roomCode}` 集中存放所有玩家完整 `GameState`、棋盤、日誌及請求，文件會持續增大，受 Firestore 單一文件 1 MiB 限制。
- 棋盤擲骰由客戶端產生亂數並寫回；公平性依賴 Firestore Rules 與客戶端可信度。
- `firestore.rules` 對 `rooms/{roomId}` 允許任何已登入使用者 update，沒有檢查房間成員、房主或允許更新的欄位；目前權限規則無法阻止登入者直接改動其他房間狀態。

## 5. Firestore API 與資料集合

這裡的 API 是前端直接呼叫 Firebase SDK；專案沒有 `/api/*` server route。

| 集合 / 文件 | 操作 | 用途 |
|---|---|---|
| `users/{uid}` | get、query、set、update、batch | 個人資料、角色、經驗、排名、邀請與推薦關係 |
| `rooms/{roomCode}` | get、set、update、delete、onSnapshot | 房間及全部多人共享狀態 |
| `player_sessions/{uid}/records/{sessionId}` | set、query、onSnapshot | 玩家個別場次備份與歷史 |
| `score_records/S1/records/{recordId}` | get、query、set、update、delete、onSnapshot | 正式遊戲結算紀錄 |
| `coach_records/{recordId}` | get、query、set、delete、onSnapshot | 執行師報告與房間紀錄 |
| `friendships/{id}` | query、add、update、delete、onSnapshot | 好友邀請與好友狀態 |
| `audit_logs/{id}` | add | 執行師操作稽核 |
| `leaderboard/{document=**}` | 規則已定義，應用程式未直接讀寫 | Firestore Rules 保留的排行榜集合；目前排行榜 UI 實際查詢 `users` |
| Firebase Storage | upload、getDownloadURL | 玩家頭像上傳 |

### Firebase Auth API

- Email/password 登入與註冊
- Google popup 登入
- Apple OAuth popup 登入
- redirect result 處理
- 登出
- `onAuthStateChanged` 身分監聽
- 本地模式可用 `VITE_USE_EMULATOR=true` 連接 Auth `9099` 與 Firestore `8080`

### 外部 HTTP / AI API

| 位置 | API | 用途 |
|---|---|---|
| `services/geminiService.ts` | `@google/genai` `models.generateContent` | 根據遊戲資料產生分析報告 |
| `scripts/create-test-accounts.mjs` | Google Identity Toolkit `accounts:signUp` / `accounts:signInWithPassword` | 建立測試帳號 |
| `scripts/create-test-accounts.mjs` | Firestore REST documents API | 建立測試使用者文件 |
| `scripts/patch-coach-record.mjs` | Identity Toolkit + Firestore REST `documents` / `runQuery` | 修補執行師與場次紀錄 |

注意：README 要求設定 `GEMINI_API_KEY`，但 `geminiService.ts` 實際讀取 `process.env.API_KEY`；Vite 用戶端通常也不會直接提供 `process.env`。目前這個 AI 呼叫的金鑰設定與執行環境不一致，失敗時只會回傳 fallback 文字。

## 6. Socket Event / 即時邏輯事件

### Socket 結論

**Socket Event 數量：0。** 程式碼沒有 `socket.io-client`、`WebSocket`、`io()`、`emit()` 或 socket event handler。以下是由 Firestore 文件欄位承載的即時邏輯事件。

### 房間公開操作（RoomContext event API）

| 操作 | 方向 | 寫入 / 效果 |
|---|---|---|
| `createRoom(settings)` | 執行師 -> Firestore | 建立 `rooms/{code}` |
| `joinRoom(code)` | 玩家 -> Firestore | 加入 `members`，開始監聽 |
| `leaveRoom()` | 任一成員 -> Firestore | 從 `members` 移除自己 |
| `startRoomGame()` | 房主 -> 全房 | `status=playing`、重設場次 |
| `finishRoomGame()` | 房主 -> 全房 | `status=finished` |
| `closeRoom()` | 房主 -> 全房 | 刪除房間 |
| `updateMarket(updates, code, isBubble)` | 執行師 -> 全房 | 更新一般模式股價與 `marketUpdates` |
| `updateRoomTimer(timeLeft, isPaused)` | 執行師 -> 全房 | 更新倒數與暫停狀態 |
| `submitRequest(request)` | 玩家 -> 執行師 | 新增 `pendingRequests.{id}` |
| `approveRequest(id)` | 執行師 -> 玩家 | request 狀態改為 approved |
| `rejectRequest(id)` | 執行師 -> 玩家 | request 狀態改為 rejected |
| `clearRequest(id)` | 玩家/執行師 -> 全房 | 刪除 request 欄位 |
| `rollBoardDice()` | 當前玩家 -> 全房 | 寫入擲骰、移動路徑及結算事件 |
| `revealBoardCard(eventId, cardId)` | 玩家 -> 全房/大地圖 | 設定卡片已揭露與揭露者 |
| `dismissBoardCard(eventId, cardId)` | 玩家 -> 全房 | 關閉卡片並推進事件佇列 |
| `advanceBoardEventQueue(type?)` | 玩家 -> 全房 | 推進 `pendingEvents` |
| `drawPostExamHappinessCard(success)` | 玩家 -> 全房 | 考試後抽幸福卡或結束事件 |
| `drawBoardFollowupCard(deck, summary, detail?)` | 玩家 -> 全房 | 插入後續幸福/新聞卡事件 |
| `openFamilyMilestoneJoinPrompt(eventId, cardId)` | 抽卡玩家 -> 其他玩家 | 建立共同參與 prompt |
| `submitFamilyMilestoneJoinResponse(payload)` | 其他玩家 -> 全房 | 寫入 passed/failed/declined 與骰點 |
| `clearPendingFamilyMilestoneJoinAction(promptId)` | 玩家 -> 全房 | 清除自己的待執行參與結果 |
| `applyBoardExpenseToAllPlayers(payload)` | 卡片處理端 -> 全房 | 批次更新所有 `playerStates` 支出 |
| `moveCurrentPlayerToSquare(payload)` | 當前玩家 -> 全房 | 移動到指定學校/醫院/銀行格 |
| `applyBoardMarketPrices(updates, code, isBubble)` | 卡片處理端 -> 全房 | 更新棋盤模式行情及所有玩家行情 |
| `abandonRealEstateCard(cardId)` | 玩家 -> 全房 | 將房產加入共享市場 |
| `buyRealEstateFromMarket(cardId)` | 玩家 -> 全房 | 從共享市場移除房產 |

### `boardState.currentEvent.type`

目前事件型別為：`bank`、`school`、`hospital`、`card`、`exam_happiness`、`followup`。事件內容由 `currentEvent`、`currentCard`、`currentCardReveal`、`pendingEvents`、`movement`、`familyMilestoneJoinPrompt` 等欄位組合表達。

### `pendingRequests.type`

目前審核請求型別為：`payday`、`insurance`、`happiness`、`promotion`、`lifelong`。

## 7. 目前 TODO

在第一方原始碼中找到 5 個 TODO，全部位於 `src/constants/cards.ts`：

| 行 | TODO |
|---|---|
| 49 | 確認 H016-H020 的精確卡名與費用 |
| 57 | 確認一次性支出幸福卡的各卡費用（目前只知 6,000-50,000 範圍） |
| 70 | 確認月支出幸福卡的各卡金額（目前只知每月 2,000-3,000 範圍） |
| 76 | 確認 H036-H038 的精確卡名 |
| 89 | 確認另一組與 H011-H020 同系列卡片的精確卡名與費用 |

另有 `src/constants/cards.ts.new`，內含相同 TODO，但沒有被任何程式匯入，屬於殘留備份檔，不應視為第二套執行中規則。

搜尋範圍為 `src/`、`services/`、`scripts/`、README 與建置設定；排除 `node_modules`、`dist`、`.vercel/output` 等第三方或產物。

## 8. 新人建議閱讀順序

1. `src/types.ts`：先理解 `GameState`、`Room` 相關棋盤型別與 `TransactionData`。
2. `src/App.tsx`：理解角色、畫面與 Provider 組裝。
3. `src/context/GameContext.tsx`：理解單人狀態如何保存與同步。
4. `src/context/RoomContext.tsx`：理解房間、Firestore snapshot 與棋盤狀態機。
5. `src/hooks/useGameLogic.ts`：理解交易如何真正改動資產負債與現金。
6. `src/utils/boardCardActions.ts` 與 `src/constants/cards.ts`：理解卡片資料到財務動作的映射。
7. `src/views/game/GameView.tsx`：理解玩家 UI 如何協調上述狀態與事件。
8. `src/views/lobby/CoachGameView.tsx`、`src/views/board/BoardProjectionView.tsx`：理解執行師與大地圖如何消費共享狀態。

## 9. 架構摘要

第二人生 是一個以 Firebase 為後端即服務的前端單體應用。核心設計是：玩家本機負責計算自己的財務狀態，再把完整 `GameState` 寫入單一房間文件；所有玩家、執行師及大地圖透過同一份 Firestore snapshot 同步。這使部署簡單且即時畫面一致，但單文件集中、非交易式併發更新及客戶端權威是後續擴充多人規模時最需要優先處理的架構邊界。

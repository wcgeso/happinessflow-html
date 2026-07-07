# MULTIPLAYER EXPERIENCE AUDIT

審查日期：2026-07-07｜範圍：`.worktrees/線上模式0611`

## 總診斷

**同步層是完整的，但「感受層」幾乎不存在。** 資料面：整個房間（members/playerStates/turnOrder/boardState/cardLog）在單一 Firestore 文件用 onSnapshot 即時同步（`RoomContext.tsx:714-779`），玩家完整 GameState 防抖回寫 playerStates（`GameContext.tsx:130-158`）。技術上人人「看得到」彼此——但 UI 幾乎沒有演出來。**多人玩起來像各玩各的單機記帳 App，唯一共同體驗集中在投影幕（實體工作坊場景），純線上場次的彼此存在感趨近於零。**

## 現有的感知管道（僅三個）

1. **「房間玩家」清單**——藏在齒輪選單第 4 層（`GameHeader.tsx:282-291, 324-398`），且其中 `p.isReady ? '🟢 已準備' : '🟡 準備中...'`（:381）引用 RoomMember 上**不存在的欄位**（`RoomContext.tsx:36-48` 無 isReady），永遠顯示「準備中」——實際 bug（IMPLEMENTATION GAP）。
2. **抽卡日誌**——BoardCardLogPanel 顯示最近 12 筆（`GameView.tsx:2007-2031`；資料 `RoomContext.tsx:315-335`，上限 40 筆）。唯一近似 Activity Feed 的東西，但被動開啟，不推播。
3. **共享機制 Modal**——家庭歷程（`GameView.tsx:2033-2079`）與共享卡片（:2081-2098），但這些是**財務結算義務**，不是社交或慶祝。

## 關鍵缺失證據

- **回合感知單向**：只知道「是不是輪到我」（GameActions.tsx:292 tooltip、RoomContext.tsx:991 報錯）。「輪到誰」的名字只在投影幕（BoardProjectionView.tsx:574/654），玩家手機看不到、也看不到其他人棋子位置（playerPositions 只被 BoardProjectionView 消費）。
- **慶祝是單機的**：HappinessWinAnimation 只由本地 `gameState.happinessTotal >= 100` 觸發（GameView.tsx:225-229）——**別人達標時你的螢幕什麼都不會發生**。財務自由也只是自己 HUD 進度條變亮。
- **社交層為零**：全庫無 chat/emoji/reaction/ping；無旁觀模式；`types.ts:423` 有 `status?: 'online'|'offline'|'playing'` 型別但**無任何程式碼讀寫**——斷線玩家對其他人是無聲消失。

## MULTIPLAYER EXPERIENCE GAP LIST

| # | Gap | 佐證 | SEVERITY | CATEGORY |
|---|-----|------|----------|----------|
| M1 | 玩家端無「現在輪到 XXX」常駐指示，非自己回合只看到灰骰子，不知在等誰等多久 | GameActions.tsx:292；currentTurnName 僅 BoardProjectionView.tsx:574 | **P1** | MULTIPLAYER |
| M2 | 無 Activity Feed 推播（誰抽卡/買資產/升職/+幸福），僅被動抽卡日誌 | GameView.tsx:2007-2031 | **P1** | MULTIPLAYER |
| M3 | 他人達成幸福100/財務自由/夢想時，其他玩家螢幕零回饋，無 Shared Celebration | GameView.tsx:225-229（僅本地觸發） | **P1** | MULTIPLAYER |
| M4 | 玩家裝置看不到棋盤與其他玩家棋子；無投影幕的線上場次形同盲玩 | BoardProjectionView 僅走 ?boardRoom= 路由，App.tsx:116-123 | **P1** | MULTIPLAYER |
| M5 | 無回合交接演出：換人時無動畫無音效無提示 | RoomContext.tsx:337-356 純資料切換 | **P2** | MULTIPLAYER |
| M6 | 無表情符號/Reaction/快捷訊息/Ping | 全庫 grep 無結果 | **P2** | MULTIPLAYER |
| M7 | 其他玩家資訊藏齒輪選單深處，HUD 上完全沒有其他玩家的臉 | GameHeader.tsx:282-291 | **P2** | MULTIPLAYER |
| M8 | isReady 幽靈欄位，永遠顯示「🟡 準備中...」（bug） | GameHeader.tsx:381 vs RoomContext.tsx:36-48 | **P2** | MULTIPLAYER/TECHNICAL |
| M9 | 無 presence/心跳，斷線後他人無感；輪到斷線者時回合卡住等人（movement 過期有自動補完 RoomContext.tsx:719-735，但「不擲骰」無 timeout） | types.ts:423 未使用 | **P1** | MULTIPLAYER/TECHNICAL |
| M10 | 等待共享事件回覆只有 alert「還有玩家尚未完成…」，看不到缺誰 | RoomContext.tsx:1215-1218 | **P2** | MULTIPLAYER |

## PROGRESSION AUDIT

### 做得好的
- **長期雙目標常駐可視化**：HUD「幸福 /100」粉條＋「財務自由 %」綠條（GameHeader.tsx:182-227）——全 app 最好的 progression 設計；GameStats 愛心水位動畫（:33-65）。
- **職涯階梯**：RankListModal LV1-5、目前位置發光、升職條件（:45-87）。
- **幸福 100 演出**：HappinessWinAnimation 完整四階段。
- **成就系統存在**：`constants/achievements.ts` + AchievementsView（450+ 行）依歷史計算解鎖，從大廳進入（App.tsx:681-682）。
- **跨場次累積**：totalScore 累加 experience/rankScore（ScoreView.tsx:190-201），有全服排行榜與歷史紀錄。

### PROGRESSION GAP LIST

| # | Gap | 佐證 | SEVERITY |
|---|-----|------|----------|
| R1 | 遊戲進行中零成就回饋：AchievementsView 只在大廳離線計算，無「成就解鎖」toast | ScoreView.tsx:41 | **P2** |
| R2 | 無中期里程碑慶祝（幸福 25/50/75、財自 50%、首資產、升職）——只有 100 分一次大招 | GameHeader.tsx:182-227 | **P2** |
| R3 | 夢想/企業選定後無常駐進度視覺化 | gameState.selectedDream 無對應 HUD | **P2** |
| R4 | 無「本場遊戲摘要/人生歷程時間軸」——history 完整上傳（ScoreView.tsx:111-137）卻沒做成旅程回顧 | | **P1** |
| R5 | ScoreView「達成成就」通知實為積分細項換皮，且玩家端 showAchievements=false 看不到 | ScoreView.tsx:18, 39-62 | **P3** |
| R6 | 無收集/解鎖循環：卡片抽過即逝，無圖鑑 | cardLog 上限 40 筆僅日誌 | **P3** |

## GAME ENDING AUDIT

### 現況
結束流程：執行師按「遊戲結算」→ `finishRoomGame` 只寫 `status:'finished'`（RoomContext.tsx:1094-1103）→ 玩家端直接彈 ScoreView（GameView.tsx:52-53），按鈕全灰。

ScoreView（519 行）全部內容：獎盃 icon+「遊戲評分」+玩家名（:410-415）、**一張積分 checklist**（:423-442）+總分（:449-465）、執行師上傳按鈕與離開房間。

**連「Winner: XXX」都沒有**——玩家端看不到其他人分數與排名，無排名揭曉、無幸福排名、無夢想結果、無財務對比、無人生回顧。**素材都在**：上傳 payload 含每人完整 history/happinessItems/assets/liabilities/summary（:111-137），足以生成「你 35 歲買了第一間房、48 歲財務自由」的人生故事，但一行都沒渲染。時間到只彈 alert「⌛ 遊戲時間已到！」（GameView.tsx:109-113）。排名體驗外包給執行師口頭宣布。

### GAME END EXPERIENCE GAP LIST

| # | Gap | 佐證 | SEVERITY |
|---|-----|------|----------|
| E1 | 無全員排名/揭曉演出，玩家端連 winner 都看不到 | ScoreView.tsx 全檔僅單人積分 | **P1** |
| E2 | 無人生旅程回顧（職涯/家庭/資產/重大決策時間軸），資料齊備卻未使用 | ScoreView.tsx:111-137 | **P1** |
| E3 | 無 Final Transition：時間到＝alert；結算＝modal | GameView.tsx:109-113 | **P2** |
| E4 | 無夢想結果宣告、無幸福 vs 財務雙軸總結 | | **P2** |
| E5 | 無玩家間比較（幸福最高/資產最多/最會賺等趣味獎項） | | **P2** |
| E6 | 結算後無「再來一場」動線 | ScoreView.tsx:232-280 | **P3** |

**「這是我的人生故事」感：目前為 0，體驗停在「對帳單」層級。**

## 評分

| 維度 | 完成度 | 理由 |
|---|---:|---|
| Multiplayer Experience | 25% | 同步扎實，但存在感/回合感/共同慶祝全數缺席——沒有投影幕就是各玩各的單機記帳 |
| Progression | 45% | 雙進度條與職涯階梯是亮點，成就系統真的實作了，但全部回饋被推遲到大廳與結算 |
| Game End | 20% | 結局只是個人對帳單，連排名與 winner 都沒有；資料已齊卻沒講任何人生故事 |

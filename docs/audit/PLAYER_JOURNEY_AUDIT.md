# PLAYER JOURNEY AUDIT

審查日期：2026-07-07｜範圍：`.worktrees/線上模式0611`｜方式：唯讀走查全部玩家流程程式碼

## PLAYER JOURNEY MAP（實作對照）

| 階段 | 實作位置 | 主 CTA 清楚？ | 判定 |
|---|---|---|---|
| 登入→大廳 | `App.tsx:126-133`, `LobbyView.tsx` | ✅ | OK |
| 建房/加房 | `LobbyView.tsx:691`、CreateRoomModal | ✅ | OK |
| 房間等待 | `RoomView.tsx:239-434` | ⚠️ 開始條件隱形 | GAP-A1 |
| 選職業/企業/夢想 | `SelectionView.tsx:53-151` | ✅ 按鈕文案佳 | GAP-A2/A3 |
| 遊戲開始→理解 UI | `GameView.tsx:1947+`, TutorialModal | ⚠️ | GAP-A4 |
| 第一次擲骰 | `GameActions.tsx:270-352` | ⚠️ 只有發光暗示 | GAP-B1 |
| 移動/經過事件 | `RoomContext.tsx:1008-1022` alert 文字 | ⚠️ | GAP-A5 |
| 停留/抽卡/閱讀卡片 | `BoardCardDrawer.tsx:60-65` | ⚠️ 卡片內容不在手機上 | GAP-C1 |
| 財務檢核 | BoardFinancialCheckModal | ⚠️ | GAP-C3/C4 |
| 幸福變動 | `GameHeader.tsx:186-205` | ✅ | OK |
| 市場事件 | `GameView.tsx:78-98, 946-980` | ✅ 有 alert | 小 |
| 買資產/貸款/保險 | TransactionForm + GameActions | ⚠️ | GAP-A6 |
| 升職/學校 | PromotionModal, `GameView.tsx:992-999` | ✅ 自動彈出 | OK |
| 企業升級 | BizUpgradeModal | ✅ | OK |
| 家庭/共享事件 | `GameView.tsx:2033-2260` | ✅ modal 說明佳 | GAP-E2 |
| 夢想 | `GameActions.tsx:257-268`「目標」 | ⚠️ | GAP-A7 |
| 財務自由/幸福里程碑 | `GameHeader.tsx:207-226`, HappinessWinAnimation | ✅ | OK |
| 遊戲結束→排名 | `GameView.tsx:51-55`, ScoreView | ⚠️ 見 GAME-END 報告 | E1 |

## PLAYER JOURNEY GAP LIST

### GAP-A1｜房主無法在人數未滿時開局（疑似 Dead End）【P1 / GAME-UX】
- CURRENT：「開始遊戲」按鈕只在 `playerMembers.length >= room.maxPlayers` 時渲染，否則只顯示「等待玩家中 (n/max)」。
- PROBLEM：建房設 6 人但只來 4 人 → 永遠無法開始，無「提前開始」或「調整人數」入口。
- IMPACT：整團卡等待室，必須解散重建。
- EVIDENCE：`src/views/lobby/RoomView.tsx:297-309`
- DIRECTION：人數 ≥1 即顯示開始按鈕，未滿員附確認對話框；或允許房主調整 maxPlayers。

### GAP-A2｜選職業時關鍵決策資訊不足【P1 / ONBOARDING】
- CURRENT：職業卡只顯示 icon、職稱、名稱；企業/夢想卡都有金額明細，職業卡沒有薪資/起始存款/支出。
- PROBLEM：第一個且影響最大的決策是盲選。
- EVIDENCE：`SelectionView.tsx:67-77` vs `:104-116`
- DIRECTION：職業卡加「起薪/起始存款/月支出概況」。

### GAP-A3｜教學出現在所有初始決策之後【P1 / ONBOARDING】
- CURRENT：TutorialModal 只在進入 GameView 後首次彈出；選職業/企業/夢想階段無遊戲目標說明。
- PROBLEM：玩家在不知道「幸福值是勝負依據」「企業/夢想日後要花錢買」時就做完三個選擇。
- EVIDENCE：`GameView.tsx:218-223`、`SelectionView.tsx:57-59`
- DIRECTION：SelectionView 前插入 1 頁「遊戲目標卡」，企業/夢想頁標註「之後需存錢購買」。

### GAP-A4｜無「等待全員完成設定」柵欄，回合可能在他人尚未 setup 時開始【P1 / SPEC-GAP】
- CURRENT：`handleSelectionComplete` 直接進 game；`currentTurnUid` 開局即指派。首位完成者若是 turnOrder[0]，骰子立即可擲，其餘玩家還在選職業。
- PROBLEM：規格「玩家初始化→遊戲進行」之間無同步柵欄（GAME_OVERVIEW.md:231-243）；共享事件可能打到還在選擇畫面的玩家。
- EVIDENCE：`App.tsx:542-588`、`RoomContext.tsx:224-235`；CoachGameView:291 的 all-isSetup 檢查只用於執行師畫面。
- DIRECTION：玩家端加「等待全員完成設定 (n/m)」攔截層；rollBoardDice 加 all-isSetup 檢查。

### GAP-A5｜「經過維修廠」榮譽制【P1 / SPEC-GAP】※本審查期間已由工程另行修復（commit b1becc0），保留記錄
- CURRENT（審查當下）：經過維修廠只 push 文字「請自行登錄」。
- EVIDENCE：`RoomContext.tsx:1015-1017`（修復前）

### GAP-A6｜銀行服務窗口限制只在被拒時才得知【P2 / GAME-UX】
- CURRENT：保險/定存違反窗口時 alert「本回合尚未經過銀行…」。
- PROBLEM：規則只存在於錯誤訊息，新手反覆撞牆才學會。
- EVIDENCE：`GameView.tsx:1400-1403, :415`
- DIRECTION：TransactionForm 將保險/定存選項灰化並附「需經過銀行」badge（canUseBankProducts 已傳入，GameView.tsx:2860）。

### GAP-A7｜「目標」（買企業/夢想）按鈕語意薄弱【P3 / EXPERIENCE-GAP】
- CURRENT：底部 dock 一顆「目標」icon，無進度提示。
- EVIDENCE：`GameActions.tsx:257-268`、`GameView.tsx:3087-3095`
- DIRECTION：Header 或按鈕加「夢想進度 x%」徽章。

### GAP-A8｜「結算評分」入口玩家可自行觸發【P2 / GAME-UX】
- CURRENT：玩家設定選單有「結算評分」，點了直接開 ScoreView 蓋全畫面。
- PROBLEM：結束權在執行師/時間（SPEC §13），易誤觸造成「我以為遊戲結束了」。
- EVIDENCE：`GameHeader.tsx:269-272` → `GameView.tsx:1999`
- DIRECTION：改名「查看目前成績」，ScoreView 標註「遊戲仍在進行」。

## TURN CLARITY

### B1｜「現在誰的回合」在玩家手機上幾乎不可見【P1 / GAME-UX】
- 有：輪到自己時骰子發光+「點擊拋擲」（`GameActions.tsx:276-281`）；否則灰化 + `title="尚未輪到你"`（手機上 title 無效）。
- 無：GameView 與 GameHeader 全文沒有任何「目前回合：某某」元素。唯一顯示者是投影幕（`BoardProjectionView.tsx:654-655`）。
- DIRECTION：GameHeader 加回合狀態列「🎲 輪到 {name}（第 x/n 位）」，輪到自己全幅高亮。

### B2｜「為什麼不能擲骰」是被動揭示【P2 / GAME-UX】
- `getBoardRollBlockReason()` 覆蓋 11 種阻塞原因（`GameView.tsx:622-637`），點擊被擋時 alert 顯示——好設計，但只在點了才知道。
- DIRECTION：blockReason 常駐渲染在骰子下方 label。

### B3｜「結束回合」概念不可見【P2 / GAME-UX】
- 回合結束是隱式自動切換（`RoomContext.tsx:566-592`），玩家不知道自己「做完了」還是「還有事」。

### B4｜被跳過回合（停回合）零提示【P1 / GAME-UX + SPEC-GAP(資訊面)】
- `getNextTurnUid` 靜默消耗 skipTurns（`RoomContext.tsx:337-355`）；醫院 modal 未提「之後停回合」。玩家只覺得「怎麼一直沒輪到我」。

## EVENT CLARITY

### C1｜卡片正文不在手機上【P1 / EXPERIENCE-GAP】
- 手機翻牌後固定顯示「請看大地圖確認內容」（`BoardCardDrawer.tsx:60-65, 161-164`），決策畫面上無影響數字。財務類卡片按鈕有「（現金不足）」提示算部分補救（`GameView.tsx:2460-2508`）。
- DIRECTION：至少把 txData.impacts 摘要列在 actionArea 上方。

### C2｜共享事件說明好、即時效果弱【P2 / GAME-UX】
- 共享事件 modal 明說來源與規則（`GameView.tsx:2095-2098`）——全案 event clarity 最佳範例；即時效果卡只回「卡片效果已套用」（`GameView.tsx:1193`）不說套用了什麼。

### C3｜財務檢核答錯直接洩題【P1 / ONBOARDING + SPEC CONFLICT】
- 答錯時 errorPopup 逐條列出全部正確答案（`BoardFinancialCheckModal.tsx:186-211, 338-366`）。核心教學機制被一次性洩題摧毀；Tutorial 第4步宣稱「全部選對後交易才會成功執行！」（`TutorialModal.tsx:374`）與實際體驗矛盾。
- DIRECTION：第一次錯只提示「有 n 處錯誤」+高亮錯誤分類；第二次才給答案。

### C4｜「上一步」與「取消」同義不同詞【P3】
- EVIDENCE：`BoardFinancialCheckModal.tsx:246-252, 316-318`

### C5｜現金不足流程完整但層層疊 modal【P2 / GAME-UX】
- 三選一文案優秀（`GameView.tsx:2866-2908`），但檢核→不足→交易→回檢核的 modal 鏈對新手高負荷。

### C6｜幸福卡故事分享等待狀態有交代 ✅
- `GameView.tsx:2392-2394, :846-851`

## ONBOARDING AUDIT

### TutorialModal 涵蓋度（9 步，`TutorialModal.tsx:348-407`）

| 主題 | 涵蓋 |
|---|---|
| 遊戲目標＝幸福100 | ✅（但未講「結束時幸福最高者勝」） |
| 交易輸入/財務檢核/財報/被動收入/槓桿 | ✅ 品質高 |
| 夢想/家庭/幸福 | ⚠️ 一句帶過 |
| 擲骰/棋盤/回合 | ❌ 零 |
| 三種卡片 | ❌ 零 |
| 銀行事件/Payday/銀行窗口 | ❌ 零 |
| 學校/升職/終身學習 | ❌ |
| 醫院/維修/停回合 | ❌ |
| 保險/理賠 | ❌ |
| 家庭歷程/共享事件 | ❌ |
| 房市公告板 | ❌ |
| 回合怎麼結束/遊戲怎麼結束/排名 | ❌ |

**結論：現有教學是「財報教學」而非「遊戲教學」，棋盤模式核心循環 0% 涵蓋。**

### 缺少的機制
- First Turn Guide：無【P1】
- Contextual Tooltip：桌機 title only，行動端等於沒有【P2】
- Coach Mark / 首次事件說明：無（醫院公式說明是唯一例外）【P1】
- Glossary：無，名詞散落在錯誤訊息【P2】
- 教學可重看：✅ 有
- 教學觸發用全域 localStorage key，換帳號不再顯示【P3】

## WAITING UX

### E1｜等待他人回合＝空白等待【P1 / GAME-UX】
- 非自己回合時畫面＝財報+灰骰子，無「輪到 X」「X 正在處理卡片」。當前玩家耗時 3 分鐘時其他人畫面靜止，與斷線不可區分。
- DIRECTION：Header 常駐「輪到 {name}」＋ currentEvent 簡述（資料已在 Firestore）。

### E2｜共享事件「等別人」不點名【P2 / GAME-UX】
- 抽卡者被擋時只說「還有玩家尚未完成」，不說等誰（targetPlayerUids/responses 資料可算出名單，`GameView.tsx:444-447`）。

### E3｜擲骰同步等待有標示 ✅
### E4｜房間等待室有空位動畫，但房主側無「為什麼不能開始」說明（見 GAP-A1）

## 評分

| 維度 | 完成度 | 理由 |
|---|---:|---|
| 玩家旅程 | 72% | 主幹走得通無真死路，但 setup 柵欄/滿員開局/多層 modal 鏈是明顯斷裂 |
| Onboarding | 40% | 教學只教財報半套遊戲，實質仍是「需要執行師在場」的產品 |
| Turn/Event UX | 58% | 阻塞原因系統是亮點，但回合感與事件因果主要靠投影幕和主持人補完 |

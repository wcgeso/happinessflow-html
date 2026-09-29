# 第二人生 P0 Integration Handoff

## 2026-09-24 房間玩家欄位開放／關閉

- 執行師可在等待房間直接點選空玩家欄位開放或關閉；房間以 `maxPlayers` 保存目前開放數量，`closedPlayerSlots` 記錄關閉的欄位，舊房間缺少欄位資料時仍依原名額顯示。
- 關閉已有人使用的欄位、讓開放名額少於已加入人數，或關閉最後一個欄位都會被拒絕；遊戲開始後不可調整。
- 玩家加入改為 Firestore transaction 讀取最新房間及本人存檔後檢查開放名額，降低同時加入超出人數的競態。
- 驗證：`npm run typecheck`、`src/utils/roomPlayerSlots.test.ts`（3/3）、`npm run build`、`git diff --check` 通過；本機頁面已確認六個欄位正確呈現開放／關閉與點擊提示，未對目前房間實際切換欄位或加入測試玩家。
- 未更新版本、未部署；保留 dev 工作樹其他既有修改。
- 修改：`src/context/RoomContext.tsx`、`src/views/lobby/RoomView.tsx`、`src/utils/roomPlayerSlots.ts`、`src/utils/roomPlayerSlots.test.ts`。

## 2026-09-24 房間監聽權限錯誤不再清空本機房間

- 根因：房間文件 `onSnapshot` 遇到 `permission-denied` 時，舊處理把本機 `room` 清空並刪除房間指標；App 因而跳回大廳，表面上像房間被自動關閉。此錯誤本身不代表 Firestore 房間文件已刪除。
- 修正：只有明確 `not-found` 才清除本機房間；權限錯誤保留房間畫面並顯示「不代表房間已關閉」的提示。實際刪除房間仍只由執行師確認關房流程呼叫。
- 驗證：`RoomContext.test.ts` 63/63、`npm run typecheck`、目標檔案 `git diff --check` 通過；未執行雲端／瀏覽器實機回歸。
- 修改：`src/context/RoomContext.tsx`、`src/context/RoomContext.test.ts`。
- 風險：本次沒有取得使用者當下的 Firestore 錯誤碼；若雲端房間文件確實被刪除，仍需查明是哪個關房請求或外部清理程序造成。

## 2026-09-24 考試通過彈窗單畫面版面

- 考試成功結果使用緊湊版面：縮小骰子、彈窗留白與獎勵區間距，並保留至少 44px 的主要操作按鈕；擲骰前及動畫中的畫面維持原樣。
- 彈窗最大高度納入安全區，成功狀態採緊湊排版以避免一般手機畫面垂直溢出；尚未在實機瀏覽器截圖確認。
- 驗證：`npm run build` 與目標檔案 `git diff --check` 通過；本機 `localhost:5173` 無伺服器回應，因此未完成瀏覽器截圖確認。
- 未更新版本、未部署；保留 dev 工作樹既有修改。
- 修改：`src/components/modals/DiceRollModal.tsx`。

## 2026-09-23 新房／新局舊資料回溯修正

- 房間切換會先切換 listener token 與房間／場次 scope；舊房間 callback、舊私人玩家 listener 與上一場 `sessionId` 的玩家資料不再能覆蓋新房。
- 新場次可接受重新由 0 開始的棋盤 revision；同房號但不同 `sessionId` 不保留上一場私人玩家資料。
- `startRoomGame()` 改為單一 Firestore transaction，僅 `waiting` 可初始化；重複點擊開始只沿用既有場次，不重建 session 或再次刪除玩家資料。新局同步重設棋盤、計時器、市場、審核與私人玩家狀態。
- RTDB 最後離線時間改為依房間成員逐筆監聽，符合既有逐 UID 權限，避免登入／開房時持續出現 parent-path `permission_denied`。
- E2E 更新為目前的明確職業／企業／夢想選擇流程，並驗證計時器啟動、目前玩家可擲骰及投影棋子位置與 Firestore 一致。
- 驗證：RoomContext／GameContext 71/71、完整 Vitest 299 passed／30 skipped、Rules 30/30、TypeScript、正式 build、`git diff --check`，以及 1 執行師＋3 玩家＋大地圖 E2E 通過。
- 未 commit、push 或部署；保留 dev 工作樹其他既有修改。

## 2026-09-17 H002 故事分享首次送出權限錯誤修正

- 根因：玩家送出故事時，先以 transaction 讀取尚不存在的 `pendingRequests` 文件；Firestore Rules 只允許玩家讀取自己的既有請求，因此首次建立會被判定為權限不足。
- 修正：`submitRequest()` 改為直接建立子集合請求，保留固定 request ID；同場次的既有 pending／approved 請求視為冪等成功，沒有 `sessionId` 的舊房間則沿用 legacy 請求格式。
- 同時以 `cleanObject()` 移除未定義欄位，避免故事卡事件尚未帶 ID 時造成 Firestore 寫入失敗。
- 驗證：`npm run typecheck` 通過；`npm run test:rules` 因既有 Firestore Emulator 程序占用 8080 而未能啟動，未修改或終止該程序。
- 未 commit、push 或部署；保留 dev 工作樹其他既有修改。

## 2026-09-17 v4.5 家庭歷程面板優化與正式部署

- 對外版本更新為 `v4.5`，系統更新日誌加入家庭歷程同步擲骰面板可讀性、卡片避讓與收合／展開功能。
- 正式部署 `dpl_BEDq2BgXJbXrxP2dhCLydxSvn4KY` 已 Ready，專案 `2ife`，正式網址為 `https://2ife.vercel.app`。
- 驗證：`npm run typecheck`、`npm run build`、`git diff --check` 通過；正式網址 HTTP 200。Build 保留既有 Tailwind、動態／靜態匯入及 chunk 大小警告。
- 未 commit 或 push；保留 dev 工作樹其他既有修改。

## 2026-09-17 家庭歷程同步擲骰遮擋優化

- 家庭歷程卡片改為較短的投影高度，並在卡片固定層底部預留同步擲骰面板空間，避免卡片內容與操作區被底部面板遮住。
- 保留底部不透明深藍同步面板、多人同時顯示與卡片內部捲動，不修改同步流程或資料結構。
- 驗證：`npm run build`、`git diff --check` 通過；Build 僅有既有 Tailwind、動態／靜態匯入及 chunk 大小警告。
- 未 commit、push 或部署；保留 dev 工作樹其他既有修改。

## 2026-09-17 家庭歷程同步擲骰遮擋再優化

- 家庭歷程卡片投影層新增底部安全空間，並降低家庭歷程卡片最大高度，避免底部同步擲骰面板遮住卡片內容。
- 同步擲骰面板新增收合／展開控制；收合時保留玩家結果進度，讓執行師可在需要時查看完整玩家列。
- 驗證：`npm run typecheck`、`npm run build`、`git diff --check` 通過；Build 僅有既有 Tailwind、動態／靜態匯入及 chunk 大小警告。
- 未 commit、push 或部署；保留 dev 工作樹其他既有修改。

## 2026-09-17 家庭歷程同步擲骰面板可讀性優化

- 底部同步擲骰面板改用完全不透明的深藍背景，並提高陰影與外框對比，避免後方家庭歷程卡片透出造成文字與骰子難以辨識。
- 維持既有底部橫排、多人同步顯示與卡片位於面板上方的版面，不修改同步流程或資料結構。
- 驗證：`npm run build`、`git diff --check` 通過；Build 僅有既有 Tailwind、動態／靜態匯入及 chunk 大小警告。
- 未 commit、push 或部署；保留 dev 工作樹其他既有修改。

## 2026-09-16 故事分享審核同步優化

- 新故事／卡片審核請求改寫入 `rooms/{roomId}/pendingRequests/{requestId}`，不再把新請求寫入共用房間文件。
- 執行師只監聽目前 `sessionId` 的請求；玩家只監聽自己的請求。請求 ID 以場次、類型、玩家、事件與卡片建立，重送不會產生重複請求。
- 幸福故事核准使用單一 transaction 同時更新待審核狀態與玩家私有幸福資料；舊 `rooms.pendingRequests` 保留相容讀取與清除。
- 修改：`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx`、`src/views/lobby/CoachGameView.tsx`、`firestore.rules`、相關測試。
- 驗證：完整 Vitest 264 passed／27 skipped；獨立 Firestore Emulator Rules 27 passed；TypeScript、正式 build、`git diff --check` 通過。
- 未 commit、push 或部署；尚待三位玩家＋執行師真實跨裝置延遲前後比較。

## 2026-09-16 v4.3 正式部署

- 對外版本與系統更新日誌更新為 v4.3，內容涵蓋職業／企業／夢想點選清單、開始前摘要確認，以及 Firestore 開局設定交易保存。
- Vercel production deployment `dpl_G6dv8T4UBStCH4QRgkowYtGiJf66` 已 Ready，專案 `2ife`，別名 `https://2ife.vercel.app`。
- 正式網址 HTTP 200；已確認線上 bundle 含 `v4.3` 與 v4.3 更新日誌文案。
- 驗證：Vitest 258 passed／26 skipped；Firestore Rules 26/26；TypeScript、正式 build、`git diff --check` 通過。Build 仍有既有 Tailwind、動態／靜態匯入及 chunk 大小警告。
- 部署使用目前 dev 工作樹；未 commit 或 push。`.env*`、`dist`、`output/playwright` 依 `.vercelignore` 排除。
- 尚待實際多裝置手動回歸職業、企業、夢想選擇及開始後資料一致性。

## 2026-09-15 職業、企業與夢想選擇流程穩定化

- 根因：舊輪播在每次捲動時都呼叫選擇 callback，三份循環卡片與置中計算會讓瀏覽動作改變正式選擇；SelectionView 也會持續把父層雲端草稿與步驟寫回本機，舊快照可能覆蓋玩家當前選項。
- 修正：三步改為響應式卡片清單／網格，只有明確點選才選取；移除循環輪播、縮放置中與父層快照持續重設本機步驟／選項。夢想完成後新增三項摘要確認。
- 完成開局時，GameContext 以單一 Firestore transaction 寫入玩家完整設定與自己的公開完成狀態；驗證目前場次與房間成員，成功後才進入遊戲，失敗則留在摘要頁可重試。
- 驗證：選擇 UI 目標測試 2/2、完整 Vitest 43 files passed／1 skipped，258 passed／26 skipped；Firestore Rules 26/26、TypeScript、正式 build、`git diff --check` 通過。Build 僅有既有 Tailwind／chunk size 警告。
- 尚待 2～3 個實際玩家帳號手機與桌面同步操作回歸；本次未更新版本、部署、commit 或 push，保留 dev 工作樹其他修改。
- 修改：`src/components/common/SelectionOptionGrid.tsx`、`src/views/selection/SelectionView.tsx`、`src/context/GameContext.tsx`、`src/App.tsx` 及選擇／Firestore Rules 測試。

## 2026-09-12 正式環境回合與落點事件延遲修正

- 根因：所有棋盤操作仍以 Firestore 房間文件作為權威來源；多人同時操作會競爭同一份 transaction。移動結算另有一套在 transaction 完成後重新等待完整動畫時間的排程，與既有絕對截止時間排程重疊，正式網路延遲時會放大卡片出現時間並增加重複結算競爭。
- 修正：移除擲骰與分段事件恢復路徑的相對等待／重複結算，只保留依 `movement.startedAt + settleMs` 的 RoomContext 絕對截止時間排程。保留 command ID、revision 與 transaction retry 防護。
- 量測：房間 listener 對每個新的正式快照記錄 `board_listener_sync`（同步延遲、是否回合交接、revision、移動狀態）；`board_command` 增加 `retry_count`，可區分 Firestore transaction 競爭與 listener 延遲。
- Firestore 地區已由 Firebase CLI 只讀確認為 `asia-east1`，不是美國區域；目前未修改 `experimentalAutoDetectLongPolling`，待正式受影響網路 A/B 量測後再決定。
- 驗證：`npm run typecheck` 通過；完整 Vitest 250 passed／26 skipped；`npm run build` 通過；`git diff --check` 通過。正式部署 `dpl_4YQ2jZLNDDPPsBfnHs1FWpwStF29` 已 Ready，正式網址 HTTP 200，線上 bundle 已確認包含 `v3.9`、`board_listener_sync` 與本次更新日誌文字。
- 未 commit 或 push；保留 dev 工作樹所有既有未提交修改。尚未完成正式多人瀏覽器延遲前後比較，傳輸模式 A/B 仍待實機量測。
- 主要修改：`src/context/RoomContext.tsx`、`src/game/board/runBoardMutation.ts`、`src/views/lobby/CoachDashboard.tsx`、`DEBUG_HANDOFF.md`。

## 2026-09-11 v3.8 Vercel 正式部署

- Production deployment `dpl_BaLQjzDTMHjyTFAP8ie2CMwcf2eo` 狀態為 Ready，正式網址為 `https://2ife.vercel.app`。
- 正式網址回應 HTTP 200，production bundle 已確認包含 `v3.8` 與 `happinessflow-online`，不包含本地 Firestore Emulator 位址。
- 近一小時 deployment error logs 無紀錄；本次未 commit 或 push，保留 dev 工作樹所有既有修改。

## 2026-09-11 版本 v3.8 與系統更新日誌

- 對外版本由 `v3.7` 更新為 `v3.8`。
- 系統更新日誌新增家庭歷程同步與骰點揭示、H026、C041～C043、N056～N058 銀行升級，以及股票／負現金流修正。
- 日誌只列入已完成且已有自動化驗證的項目；尚未宣稱多人實機回歸完成。
- 部署前驗證完成：TypeScript 通過；完整 Vitest 244 passed／25 skipped；Firestore Rules 25 passed；正式 build 與 `git diff --check` 通過。

## 2026-09-11 N057 銀行第一骰事件快照修正

- 根因：第一骰已在 transaction 內讀取最新銀行事件，卻仍要求玩家畫面傳入的舊 `sourceEventId` 完全相同；listener 落後一個 revision 時，有效操作會在骰點寫入前被拒絕，大螢幕因此沒有事件。
- 修正：N056～N058 第一骰共用 transaction 的最新銀行事件作為權威判斷；仍限制目前回合與事件玩家，移除舊畫面事件 ID 的額外阻擋。
- 驗證：`RoomContext`／`BizUpgradeModal` 目標測試 35 passed；`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 尚待玩家手機＋大螢幕實機驗證；本次未 commit、push 或部署，既有工作樹修改均保留。

## 2026-09-11 家庭歷程手機端提前顯示骰點結果修正

- 根因：手機端在 `handleFamilyJoinRoll()` 收到 Firestore transaction 成功回傳後立即顯示結果；大螢幕則等收到 listener 快照後才播放家庭同步骰點動畫，兩端以不同起點計時。
- 修正：家庭骰點回覆新增可選的 `presentationReadyAt`，由交易寫入 `respondedAt + DICE_PRESENTATION_REVEAL_MS`。手機端的結果通知、通過後財務檢核與失敗結果顯示，均等到該共享時間點；大螢幕家庭骰點動畫也依每位玩家的同一 deadline 結束。
- 重送同一個家庭骰點 command 時，沿用已存在回覆的骰值、狀態與揭示時間，不會因本機重新產生亂數而出現不同結果。沒有新欄位的舊回覆以 `respondedAt + DICE_PRESENTATION_REVEAL_MS` 相容。
- 影響範圍：`src/types.ts`、`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx`、`src/components/board/DicePresentationOverlay.tsx`、`src/game/board/dicePresentation.ts`。
- 驗證：`npm run typecheck` 通過；完整 Vitest 41 files passed／1 skipped，242 passed／25 skipped；正式 build、`git diff --check` 通過。
- 尚未完成三位玩家＋執行師瀏覽器實機家庭歷程回歸；本次未 commit、push 或部署。保留工作樹內其他既有修改。

## 2026-09-11 N057 經過銀行第一骰無反應再次修正

- 根因：第一骰 command ID 綁定畫面所在的房間 revision，且 transaction 依賴畫面快照資產 ID；銀行確認後若玩家私有狀態、房間事件與畫面快照不同步，會在寫入 `business-upgrade` 骰點投影前被判定為等待狀態已更新。
- 修正：第一骰以本次銀行 `sourceEventId` 建立穩定冪等鍵；transaction 以最新私有玩家文件的待升級卡片代號解析未升級企業，並驗證目前銀行事件 ID。第二骰保留 revision 作為失敗重試鍵。
- `buildStartupUpgradeState()` 同樣容許舊畫面資產 ID 失效時依待升級卡片代號解析正確工作室，並拒絕誤用其他企業代號。
- 驗證：`npm run typecheck` 通過；完整 Vitest 41 files passed／1 skipped，241 passed／25 skipped；正式 build、`git diff --check` 通過。
- 尚未完成多人瀏覽器實機回歸、Rules 全量驗證；本次未 commit、push 或部署。

## 2026-09-11 C041～C043 修繕費依未投保房屋數量計算

- 根因：共用 `property_repair` resolver 只使用卡片 `cashLoss` 一次，未乘上未投保房屋數量。
- C041～C043 現在依每間未投保房屋計算修繕費；C041 3 間未投保房屋會收取 600,000 元，部分投保只計未投保房屋，全部投保不收費。
- `txData.amount`、`cashChange` 與影響摘要使用同一結果，財務檢核和結算路徑一致。
- 驗證：`npx vitest run src/utils/boardCardActions.test.ts` 62 passed；完整 Vitest 41 files passed、1 skipped，240 passed、25 skipped；TypeScript、正式 build、`git diff --check` 通過。
- Rules 全量與真實多人瀏覽器回歸本次未執行；本次未 commit、push 或部署。
- 保留工作樹內其他既有修改。

## 2026-09-11 H026 孩子才藝活動卡修正

- 根因：H014／H015 家庭歷程成功結算時未同步更新 `GameState.children`，H026 依子女數檢核時把已完成第一個孩子的玩家誤判為沒有孩子。
- `applyFamilyMilestoneStage()` 現在會在 child1／child2 成功套用時增加子女數，且保留原有冪等防重複；H026 同時相容已勾選／已完成 child milestone 的舊存檔。
- 有孩子時 H026 顯示「接受」並進入財務檢核；沒有孩子時維持無效果且只能關閉。
- 驗證：H026／家庭歷程目標測試 93 passed；完整 Vitest 41 files passed、1 skipped，239 passed、25 skipped；TypeScript、正式 build、`git diff --check` 通過。
- 本次未 commit、push 或部署；保留工作樹內其他既有修改。

## 2026-09-11 股票輸入、月現金流與家庭歷程回覆修正

- 股票「每檔張數」允許先清空再輸入；空值送出時仍安全回退為 1 張，不影響既有全部買入／賣出累加與賣出上限。
- 月現金流支出不再讓現金低於 0；現金不足的差額會建立零利息強制負債及財務歷史，補足當次支出。
- 家庭歷程玩家成功／失敗／略過回覆均以 prompt ID 記住已送出狀態，並以最新 prompt response 組出達標後的財務動作，避免舊快照讓骰子重開或再次出現同步失敗。
- 驗證：`npm run typecheck`、目標 Vitest 3 files／40 tests、`npm run build`、`git diff --check` 通過；Rules 全量與真實多玩家瀏覽器回歸尚未執行。
- 本次未 commit、push 或部署；保留工作樹內其他既有修改。

## 2026-09-10 v3.7 Firestore 優化正式部署

- 對外版本更新為 `v3.7`，執行師系統更新日誌已加入本次 Firestore 無效寫入、同步 transaction、原子翻牌／prompt、歷史讀取與投影優化。
- Vercel production deployment `dpl_Bjh1PKq345AXKcRLWPUSdXd6C4ch` 已 `READY`，正式網址為 `https://2ife.vercel.app`。
- 線上驗證：正式網址 HTTP 200；Production bundle 包含 `v3.7` 與 `happinessflow-online`，未包含 localhost 或 Firestore Emulator 端點。
- 發佈前驗證：TypeScript 通過；完整 Vitest 41 passed／1 skipped、237 passed／25 skipped；正式 build 通過；`git diff --check` 通過；E2E 啟動冒煙通過。
- 保留已知限制：Rules 全量測試受既有 8080 Emulator 佔用影響；完整 3／6 人多人實測、正式雲端讀寫前後比較、所有財務 caller transaction 遷移與 history load-more 尚未完成。
- 本次未 commit、push；保留工作樹既有未提交修改。

## 2026-09-10 Firestore 優化執行：第一至六項

- 本批僅修改同步／交易／投影與歷史讀取路徑，保留既有未提交內容。沒有新增服務、集合或套件，沒有 commit、push 或部署。
- `RoomContext`：逐一標記過期事件、已結案提示、無抽卡結果、未取得家庭參與資格等沒有資料變更的分支為 `commit: false`。不以 `result: false` 一概禁止提交，正常拒絕參與仍可寫入。
- 提示修復會真正移除舊 `family_milestone` 請求；沒有待修資料時不寫入。只寫需要清理的私人玩家文件，修復 command ID 依場次／提示／請求識別，不再依 revision 產生。
- `App` 的 `boardRoom` 路由在 RoomProvider／GameProvider 之前分流。保留 Auth 與投影頁自身的房間監聽；不啟動控制權 claim、玩家存檔與主持人修復副作用。
- 既有交易 telemetry 分開 committed／duplicate／skipped／failed，增加 callback attempts、最後一次 callback 排定的寫入數及單調時鐘耗時。這些不是帳單讀寫量；Analytics 失敗不影響交易結果。
- `GameContext`：玩家同步改為 transaction 合併最新私人文件，只套用相對於最後權威快照的本機欄位差異；歷史初次查詢限制最近 20 筆，草稿備份間隔維持 30 分鐘。
- `RoomContext`：翻牌與家庭／共享提示在同一個房間 transaction 建立；玩家私有資料、卡片日誌與 prompt 使用目前房間快照，避免先翻牌再建立提示的競態。
- `runRoomBoardMutation()`：即使 caller 忘記標記 `commit:false`，若 board 與 room 都沒有實際變更，也不消耗 revision 或寫入 command ID；投影幕移動取樣由 80ms 調整為 160ms。
- 執行紀錄頁改為初次讀取最近 20 筆並提供手動重新整理；E2E 測試統一使用 `playwright/test`，排除同版本 Playwright 重複載入。
- 測試新增原子翻牌／prompt、無效 command 零寫入與交易 telemetry 斷言；完整 Vitest 41 passed／1 skipped，237 passed／25 skipped；TypeScript、build、git diff --check 通過。
- Rules 測試仍未完成：既有本地 Firestore Emulator 佔用 8080，直接連線的 Rules test 在清理階段逾時；未宣稱 Rules／多人 Emulator／雲端實機或節費百分比已驗收。
- **仍待後續**：完整 history load-more、所有財務 caller 的單一 transaction 遷移，以及 3／6 玩家實機壓測。此次已降低確定的無效寫入與翻牌競態，但不宣稱正式環境共享延遲已完全排除。


## 2026-09-09 v3.6 正式部署與雲端 Firestore 保護

- 對外版本更新為 `v3.6`，執行師系統更新日誌已加入本次 Firestore 用量優化與正式環境連線保護；未宣稱尚未完成實機驗證的功能已修正。
- `services/firebase.ts` 改為只有 Vite 開發模式且 `VITE_USE_EMULATOR=true` 時才連接 Auth／Firestore／Realtime Database Emulator；Vercel Production／Preview build 一律使用 `happinessflow-online` 雲端 Firebase。
- Vercel project `2ife` production deployment `dpl_CucARXawLjPPZ29ytfFntW6TRgXR` 已 `READY`，正式網址為 `https://2ife.vercel.app`。
- 線上驗證：正式網址 HTTP 200；production asset 包含 `v3.6` 與 `happinessflow-online`，未包含本地 `localhost:8080`、`127.0.0.1:8080` 或 `172.20.10.3:8080` Emulator 端點；Production 環境變數目前為空。
- 驗證：`npm run typecheck` 通過；完整 Vitest `40 files passed / 1 skipped，229 passed / 25 skipped`；`npm run build` 通過；`git diff --check` 通過。建置仍有既有 Tailwind ambiguous class、dynamic import 與 chunk size 警告。
- `npm run test:rules` 仍受既有 8080 Emulator 佔用影響，未宣稱 Rules 全量驗證通過；本次未 commit、push。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`、`services/firebase.ts`、`CODEX_HANDOFF.md`
- 目前風險：尚未完成正式雲端 6 位玩家＋執行師的前後用量比較；正式站尚未進行本次版本的多人瀏覽器回歸。
- 下一個最安全任務：用正式測試帳號做 3 位玩家＋執行師冒煙，確認主要流程與雲端 Firestore 寫入正常，再另行處理長期 bundle 分割與 Rules Emulator 隔離。

## 2026-09-09 Firestore 第一階段用量優化

- `runRoomBoardMutation()` 不再為每個棋盤 command 額外寫入未被正式程式讀取的 `rooms/{roomId}/events/revision_*` 文件；保留房間 revision 與 command ID 冪等防護。
- 停止玩家診斷狀態的背景 RTDB 上傳與執行師監聽；一般 presence、斷線偵測與分頁控制權維持不變。
- 玩家同步前限制 `history` 最近 100 筆、`appliedBoardFinancialEventIds` 最近 200 筆及每個股票 `marketPriceHistory` 最近 100 筆；`player_sessions` 草稿備份間隔由 10 分鐘調整為 30 分鐘。
- 版本更新為 `v3.6`；`services/firebase.ts` 現在只允許本機 Vite 開發模式啟用 Emulator，正式／Preview build 一律使用 `happinessflow-online` 雲端 Firebase。
- 新增同步資料上限測試，避免長時間遊戲讓玩家文件持續膨脹。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/game/board/runBoardMutation.ts`、`src/context/GameContext.tsx`、`src/context/GameContext.test.ts`、`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx`
- 測試結果：`npm run typecheck` 通過；完整 Vitest `229 passed / 25 skipped`；目標測試 `9 passed`；production build 通過；選定檔案 `git diff --check` 通過。
- Rules 結果：既有 8080 Emulator 被占用，`npm run test:rules` 無法啟動新的 Emulator；直接對既有 Emulator 執行時 `22 passed / 3 hooks timeout`，失敗為 `clearFirestore` 環境逾時，非本次程式測試斷言失敗。
- 目前風險：尚未完成正式雲端 6 位玩家＋執行師的前後用量比較；Firestore prompt 尚未拆分，正式多人同時回覆仍可能競爭同一房間文件。
- 下一個最安全任務：在乾淨且獨立的 Firestore Emulator 執行 Rules 全量驗收，再以一場正式雲端多人測試比較 reads／writes 與共享視窗延遲。

## 2026-09-09 N056–N058 銀行第一骰無投影修正

- 根因：企業升級骰點與完成路徑未明確強制讀取玩家私有文件；房間殘留舊 `playerStates` 時，可能讀到沒有最新待升級工作室／待辦的共享快照，交易在寫入骰子投影前失敗。
- 修正：創業貸款完成、銀行第一骰及企業升級完成全部使用 `forcePrivatePlayerStates: true`，以 `rooms/{roomId}/players/{uid}` 作為玩家財務與待升級資料來源。
- 銀行第一骰 transaction 另驗證最新 `currentEvent` 屬於目前玩家的 `bank` 事件；只有驗證成功才追加 `business-upgrade` 到 `boardState.diceEvents`，大螢幕即可收到既有投影事件。
- 驗證：Room／Board mutation／骰子投影相關測試 36/36、`npm run typecheck`、`npm run build`、`git diff --check` 通過；本地伺服器 HTTP 200。
- 限制：`npm run test:rules` 因既有 Firestore Emulator 佔用 8080 未能啟動新實例；尚未完成 3 位玩家＋執行師瀏覽器實機回歸；未 commit、push 或部署。

## 2026-09-09 幸福歷程多人同步骰子與大螢幕網格

- 大螢幕家庭歷程改以目前 prompt 的 source／target 玩家名單建立同步骰子網格：2／3 位為 1 列、4 位為 2×2、5／6 位為 2×3；尚未擲骰者顯示等待狀態，結果不再一顆一顆排隊播放。
- 家庭骰點回覆不再追加共用 `diceEvents`，改由 prompt `responses` 作為大螢幕家庭骰點唯一來源，並避免普通骰子動畫覆蓋同步網格。
- 家庭歷程大螢幕對每位新收到的骰點獨立播放擲骰動畫，動畫完成後才顯示點數與「達標／未達標」；既有回覆在重新整理後不會重播。
- 家庭骰點格位的骰子展示區改為足以容納 128px 骰子的固定高度，卡片同步增加最小高度，避免骰子溢出覆蓋下方的「達標／未達標」文字。
- `openFamilyMilestoneJoinPrompt`、家庭擲骰回覆、參與結果、來源完成及結案交易都強制使用玩家私有文件；保留 Firestore transaction、revision 與 command ID 冪等機制，降低多人同時按骰造成的同步失敗與重按需求。
- 驗證：家庭骰點／投影相關測試 5 passed；`npm run typecheck`、`npm run build`、`git diff --check` 通過。完整 `npx vitest run src` 為 38 files passed、1 skipped，226 passed／25 skipped，另有既有 `BrokerView` 測試逾時 1 項；`npm run test:rules` 因既有 Firestore Emulator 佔用 `8080` 無法啟動新實例，未宣稱 Rules 驗證通過。
- 尚未 commit、push 或部署；尚未完成三個獨立瀏覽器的多人家庭歷程手動回歸。

## 2026-09-09 移除執行師玩家診斷狀態區塊

- 移除執行師遊戲頁面的「玩家診斷狀態」唯讀面板，保留玩家管理、財務調整、補助及其他執行師功能。
- 保留後端診斷同步資料，未修改資料結構、權限或玩家端狀態回報。
- 驗證：`npm run typecheck`、`git diff --check` 通過；尚未 commit、push 或部署。

## 2026-09-09 醫院第二次骰子動畫與醫藥費提示同步

- 玩家端收到醫院骰點後，改以該事件的骰點事件鍵等待完整 `DICE_PRESENTATION_DURATION_MS` 展示時間，再顯示醫藥費並啟用財務流程。
- 避免大螢幕骰子仍在播放時，玩家端提前看到金額或進入財務檢核；不同醫院事件不會沿用上一事件的本機骰點。
- 驗證：`npm run typecheck`、`dicePresentation.test.ts` 2/2、`git diff --check` 通過；尚未 commit、push 或部署。

## 2026-09-09 房市公告購買結果與區域網路崩潰修正

- 房市購買前的 attempt ID 改用 `globalThis.crypto.randomUUID()` 安全 fallback，並在 `GameView` 入口捕捉非同步錯誤；`http://172.20.10.3:5183` 不再因非安全內容缺少 `randomUUID()` 觸發 `Unhandled Promise Rejection`。
- `buyRealEstateFromMarket()` 強制使用玩家私有文件交易；`runRoomBoardMutation()` 同時修正空 `playerStates` 的儲存模式判斷，舊房間欄位只作被操作玩家的遷移 fallback，不把完整財務狀態寫回共享房間。
- 房屋從房市移除、玩家現金／資產／貸款更新與冪等 command 仍在同一個 Firestore transaction，並保留多人競買第一筆成功、後續顯示已售出的規則。
- 新增儲存模式單元測試；驗證：`npm run typecheck`、`npx vitest run src`（226 passed／25 skipped）、`npm run build`、`git diff --check` 通過。
- 尚未 commit、push 或部署；尚未完成三個獨立瀏覽器的多人房市競買實機回歸。

## 2026-09-09 H005 故事分享核准後幸福點被舊狀態覆蓋

- 根因：執行師核准已原子寫入玩家幸福結果，但玩家端只因公開玩家摘要變動就把尚未收到私人文件更新的舊 `gameState` 回寫，造成幸福點回退。
- 修正：`GameContext` 不再以公開摘要差異單獨觸發同步；保留本機狀態雜湊、初始化同步與保險資料變更的既有同步條件，所有 H001–H010 共用同一修正。
- 驗證：`npm run typecheck`、Room／Game Context 測試 35 項、`git diff --check` 通過；完整 Vitest 為 225 passed／25 skipped，另有既有 4 個 e2e suite 因 Playwright runner／未設定 Emulator 環境在收集階段失敗；尚未 commit、push 或部署。

## 2026-09-09 房市公告標題資訊簡化

- 房市公告將卡片代號移到每筆物件標題最左側，移除「不動產」前綴與重複副標，保留房屋主標、價格及交易資訊。
- 手機版標題列維持可換行，不影響房屋購買操作。
- 驗證：`npm run typecheck`、`npm run build`、`git diff --check` 通過；尚未 commit、push 或部署。

## 2026-09-09 房市公告顯示卡片代號

- 玩家端房市公告的每個不動產標題旁新增卡片代號標籤，例如 `N042`，手機版可自然換行且不擠壓價格與購買按鈕。
- 未修改房市交易、物件上架或購買判定。
- 驗證：`npm run typecheck`、`npm run build`、`git diff --check` 通過；尚未 commit、push 或部署。

## 2026-09-09 大螢幕房市資訊卡完整顯示

- 房市資訊卡改用較高的展示高度與較緊湊的資訊欄位間距，讓房屋總價、頭期款、貸款、利息、租金、幸福點及月淨收益完整落在可視區內。
- 右側資訊區新增明確的溢出邊界，內容超出小尺寸視窗時仍可在卡片內捲動；其他卡片高度與遊戲流程不變。
- 驗證：`boardProjectionLayout.test.ts` 7/7、`npm run typecheck`、`npm run build`、`git diff --check` 通過；尚未 commit、push 或部署。

## 2026-09-09 股市行情通知改為中央直接顯示

- 持續型「股市行情已更新」通知固定在畫面中央顯示，移除持續型通知的縮放／滑入動畫；一般短提示仍保留底部滑入效果。
- 保留原本行情去重、翻牌後才通知及手動關閉行為。
- 驗證：`npm run typecheck`、`git diff --check` 通過；未 commit、push 或部署。

## 2026-09-09 股票批量交易按鈕可重複套用

- 「全部買入／全部賣出」每次點擊會依輸入張數累加到目前交易數量；賣出自動限制在各股票實際持股，不會超賣。
- 保留原有清空張數、現金不足與交易送出檢核；未修改單檔股票調整或交易資料格式。
- 驗證：`BrokerView.test.tsx` 3/3、`npm run typecheck`、`git diff --check` 通過；尚未 commit、push 或部署。

## 2026-09-09 手機區域網路登入修正

- 原因：手機開啟 `172.20.10.3:5183` 時，前端仍使用 Emulator 預設 `localhost`；手機會把 `localhost` 視為自身，造成登入網路連線失敗。
- 修正：`firebase.json` 的 Auth／Firestore／Realtime Database Emulator 改綁 `0.0.0.0`；`.env.local` 改使用 `172.20.10.3:9099／8080／9000`，Vite 以 `0.0.0.0:5183` 重啟。
- 驗證：前端與三個 Emulator 的區域網路端點可連線；Vite Firebase 設定已確認為本地 IP；本地 Emulator 重啟後原測試資料可能已清空。

## 2026-09-09 區域網路手機測試伺服器

- Vite 已由僅限本機的 `127.0.0.1` 改以 `0.0.0.0:5183` 提供區域網路存取。
- 本機區域 IP 為 `172.20.10.3`，手機測試網址為 `http://172.20.10.3:5183/`；本地 Firebase Emulator 設定不變。
- 驗證：本機與區域網路網址均 HTTP 200；未 commit、push 或部署。

## 2026-09-09 本地伺服器與 Firebase Emulator

- `dev` 工作樹的 `.env.local` 已切換為 `VITE_USE_EMULATOR=true`，前端重新啟動於 `http://127.0.0.1:5183/`。
- 已確認 Firebase Emulator UI `4000`、Firestore `8080`、Auth `9099`、Realtime Database `9000` 均可連線；Vite 轉換後設定確認使用本地 Emulator。
- 本次未修改遊戲程式碼，未 commit、push 或部署。

## 2026-09-08 玩家端汽車骰子顯示優化與 v3.5

- 對外版本更新為 `v3.5`；有汽車時玩家端只顯示一顆骰子主圖，右上角保留 `x2` 能力標示。
- 單骰／雙骰選擇、送出與實際計算規則不變；執行師端與大地圖骰子顯示不變。
- 驗證：`npm run typecheck`、`GameActions.test.tsx` 7/7、`npm run build`、`git diff --check` 通過；Vercel deployment `dpl_9hjh4XrNTaJoSNPNvMUUED6mTkUK` 已 `READY`，`https://2ife.vercel.app` HTTP 200 且正式資產包含 `v3.5`。

## 2026-09-08 玩家端汽車骰子視覺簡化

- 有汽車時玩家端只顯示一顆骰子主圖，右上角保留 `x2` 能力標示；單骰／雙骰實際選擇、送出與計算規則不變。
- 驗證：`npm run typecheck`、`GameActions.test.tsx` 7/7、`git diff --check` 通過。
- 尚未 commit、push 或部署。

## 2026-09-08 背景音樂與音效控制拆分

- 玩家端設定選單與執行師大地圖控制列，已將原本共用的音訊開關拆成「背景音樂」與「音效」兩個獨立按鈕。
- `AudioSettings` 新增 `musicEnabled`／`soundEnabled`；舊版 `enabled` 設定仍可在讀取時轉換，背景音樂與遊戲音效各自依對應設定播放。
- 驗證：`npm run typecheck`、音訊設定測試 2/2、`git diff --check` 通過。
- 尚未 commit、push 或部署；尚未以實際玩家／執行師分頁進行聽覺回歸。

## 2026-09-08 多位玩家醫院暫停後恢復順序

- 根因：A、B 都有 `skipTurns` 時，`getNextBoardTurn()` 將暫停扣除後固定回傳原本的目前玩家 B，未回傳暫停等待順序中的第一位玩家。
- 修正：全員都被跳過時，改回傳本輪掃描到的第一位暫停玩家；A 先進醫院、B 後進醫院時，下一個可行動玩家會是 A。
- 依使用者要求未執行測試，待手動驗證兩人及多人醫院暫停情境。

## 2026-09-08 幸福回憶分享核准後未取得幸福點

- 根因是執行師核准與玩家幸福結果分開寫入，卡片結案觸發的舊玩家快照可能覆蓋尚未持久化的幸福點。
- H001–H010 已改為在執行師核准時，以單一 `runRoomBoardMutation()` 原子寫入核准狀態、玩家幸福點與歷史；同一事件重送不會重複加分。
- 驗證：TypeScript、完整 Vitest 225 passed／25 skipped、Firestore Rules 25/25、production build、`git diff --check` 通過。
- 尚未 commit、push 或部署；尚未以真實三玩家瀏覽器回歸核准流程。

## 2026-09-07 GM 用戶列表手機排版

- 手機版用戶列表由五欄表格改為逐位卡片，完整顯示名稱、信箱、權限、照片使用同意及編輯操作；桌面版維持原表格。
- `v3.4` 系統更新日誌已補上本項優化，對外版本號維持不變。
- 驗證：390px 實機瀏覽確認無橫向溢出或直排文字；typecheck、Vitest `224 passed / 25 skipped`、Firestore Rules `25/25`、production build、`git diff --check` 通過。
- 已部署至 `2ife` production：`dpl_BNpD89kBgzUie9vr91p7KKwAEdsy`，狀態 `READY`；`https://2ife.vercel.app` HTTP 200 且正式資產顯示 `v3.4`。

## 2026-09-07 照片與遊戲畫面推廣使用同意書

- 玩家、執行師與 GM 首次登入後會顯示不可略過的單選同意書；同意或不同意皆可繼續，選擇保存於既有 `users/{uid}.photoPromotionConsent`，同版本不重複詢問。
- 個人資料可修改選擇；GM 用戶列表可重新整理並區分「是／否／未填寫／待重新確認」。大地圖 `boardRoom` 投影路由不顯示同意書。
- 對外版本更新為 `v3.4`，執行師系統更新日誌已加入本次功能。
- 驗證：typecheck、Vitest `224 passed / 25 skipped`、Firestore Rules `25/25`、production build、`git diff --check` 通過；本機登入頁已顯示必要同意書，大地圖確認未顯示。
- 尚未 commit 或 push；正式對外使用前仍需法務確認同意書文字。

## 2026-08-31 玩家端卡片資訊回復簡潔版

- 玩家端 `BoardCardDrawer` 移除翻牌後顯示的完整卡片文案與效果／數據區塊，恢復為只顯示卡片標題、必要流程提示與操作區。
- 執行師端與大地圖的完整卡片資訊不變；卡片資料與結算規則不變。
- 驗證：全部 Vitest 203 passed、23 skipped；`npm run typecheck`、`npm run build` 與 `git diff --check` 通過。

## 2026-08-31 每局隨機初始股價

- 股票初始行情改由執行師開始新局時，從既有非泡沫新聞卡行情中隨機選一組，寫入房間 `marketPrices`；同一局所有玩家共用，不會因畫面重整或各自初始化而不同。
- `previousMarketPrices` 同步設為同一組，避免開局被誤判為行情上漲／下跌；舊的 `marketUpdates` 在新局清除。
- 玩家完成開局選擇時優先採用房間權威行情，練習或尚未收到房間行情才使用本地備援。
- 驗證：`src/constants.test.ts` 1/1 通過；全部 Vitest 203 passed、23 skipped；`npm run typecheck`、`npm run build` 與 `git diff --check` 通過。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/constants.ts`、`src/context/RoomContext.tsx`、`src/App.tsx`、`src/constants.test.ts`
- 測試結果：Vitest 203 passed／23 skipped、typecheck、build 與 diff check 通過
- 目前風險：尚未完成瀏覽器新局驗證；練習模式若沒有房間快照會使用本地隨機備援
- 下一個最安全任務：用新房間確認玩家端卡片已回復簡潔顯示，並確認八檔股價皆非 0

## 2026-08-30 v2.8 系統更新日誌與版本號

- 對外版本號更新為 `v2.8`；執行師端系統更新日誌置頂醫療理賠按鈕與 C035–C043 保險行為修正。
- `package.json` 維持既有 `0.0.0`，版本顯示仍由 `src/constants/version.ts` 的 `BASE_VERSION` 管理。
- 驗證：`npm run typecheck`、`npx vitest run src`（31 files、199 passed、23 skipped）、Firestore Rules `23/23`、`npm run build`、`git diff --check` 通過。
- 已部署至 `2ife` production：`dpl_AvLn7EDxj7tGs44NNa9dfwVQMjdf`，狀態 `READY`；正式網址 `https://2ife.vercel.app`，HTTP 200。
- 依使用者確認，已永久刪除舊 Vercel 專案 `happinessflow-online` 及其 deployments；舊網址回應 HTTP 404，`2ife.vercel.app` 回應 HTTP 200。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`
- 測試結果：typecheck、Vitest 31 files／199 passed／23 skipped、production build、git diff check 通過；既有 Rules 專測 23/23
- 目前風險：尚未以真實帳號確認正式站 v2.8 日誌內容與完整多人理賠流程。
- 下一個最安全任務：在 `https://2ife.vercel.app` 以測試帳號確認登入、執行師日誌與 C036 理賠流程。

## 2026-08-29 房市規則修訂版與 11 項異常修正

- 目前分支：`dev`（`15caa41`）；保留工作樹原有未提交修改，未執行 reset、clean 或覆寫其他既有變更。
- 房市交易改為所有仍在進行中的有效成員可購買；交易以 Firestore transaction 先成功者得標，Rules 僅允許移除一個既有物件、更新自己的公開摘要、revision 與 command ledger，禁止新增物件、多重移除、改回合或改他人資料。
- 房市 transaction 會重新驗證物件、房屋條件、最新現金與貸款資料；售出或條件過期不提交 revision／command／空白事件，UI 只停用被點擊物件並刷新房市。財務流程改用明確 `boardFlow`，不再從殘留狀態猜測來源。
- 工作室升級改為佇列，逐筆經銀行處理；升級收益為骰點 × 10,000，保留職業薪資，結果確認後才完成流程。汽車自備款可清空／輸入，確認時才驗證上下限。
- C038 改為同一筆原子處理：移除汽車、幸福值、投保理賠；原車貸保持不變，並以 command ID 防止重送。醫療保險維持抵免醫藥費、略過第二次骰子與付款檢核、仍暫停一回合；維修廠維持持車者經過或停留均收費。
- 玩家卡片抽屜補上完整敘述與效果，修正手機遮罩與捲動；共享卡片被暫時阻擋後沿用重新顯示流程。
- 驗證：`npm run typecheck` 通過；source Vitest `30 passed / 1 skipped`、`184 passed / 23 skipped`；Firestore Rules 直接連線測試 `23/23`；`npm run build` 與 `git diff --check` 通過。建置仍有既有 Tailwind ambiguous class、dynamic import 與 chunk size 警告。
- `npm run test:rules` 未能重啟本地 Emulator，因既有 Java 程序已佔用 `8080/9150`；未終止該程序，改用現有 Emulator 的 Rules 專測完成驗證。
- 尚未完成 3／6 位玩家的真實多人瀏覽器競買、同物件競爭、不同物件並購與重整／網路重送驗收；下一個最安全任務是啟動隔離的多人 E2E 環境逐項執行上述驗收。

## 2026-08-28 v2.7 系統更新日誌

- 對外版本號更新為 `v2.7`。
- 連線 presence 改由 Realtime Database 管理，每個分頁使用獨立連線節點與斷線自動清理，降低 Firestore 心跳寫入量。
- 關閉分頁、重新開啟或重新登入可依未完成房間恢復；同帳號多分頁由最新分頁取得操作權，舊分頁改為唯讀。
- 房間與玩家同步改以伺服器確認快照為準，避免舊快照覆蓋目前回合、事件與玩家資料；歷史與執行師診斷改為低頻或需要時讀取。
- 驗證：`npm run typecheck`、source Vitest `180 passed / 22 skipped`、Firestore Rules `22/22`、`npm run build` 與 `git diff --check` 通過；建置僅有既有 Tailwind／chunk size 警告。
- 已部署至 `happinessflow-online` production：`dpl_9hUhRaTZnzsYd4yoGTYfKZUXvt8c`，狀態 `READY`；正式網址 HTTP 200，production bundle 已確認包含 `v2.7`。
- 6 位玩家＋1 位執行師的長時間實機用量驗收仍未宣稱完成。

## 2026-08-28 Firebase 連線與用量優化執行結果

- 目前分支：`dev`；保留工作樹所有既有未提交修改。
- Auth 改為 `browserLocalPersistence`，並以使用者文件 `activeGame.roomId` 支援關閉重開／重新登入恢復未完成房間；遊戲中暫時離開只離開畫面、不移除座位。
- Presence 改為既有 RTDB：每個分頁建立 `roomConnections/{roomId}/{uid}/{clientId}`，斷線自動移除，`roomLastOnline` 保存最後離線時間；移除 Firestore heartbeat fallback。
- 玩家診斷改為 RTDB 暫時節點；Firestore room snapshot 使用 metadata，只有 server snapshot 才執行路由、成員清理與過期移動修復。
- 玩家同步移除同步前預讀，改為欄位白名單 merge；避免用舊 UI 快照回寫棋盤事件、位置與 prompt。
- 新增同帳號分頁控制權：最新分頁 claim，舊分頁的 board mutation 與主要直接寫入會被唯讀 guard 擋下。
- 大廳／結算歷史改一次性 `getDocs`，遊戲進行中不持續監聽；本地 Firebase Emulator 新增 RTDB `9000`。
- 驗證：`npm run typecheck` 通過；source Vitest `179 passed / 22 skipped`；Firestore Rules 既有 Emulator `22/22`；`npm run build`、`git diff --check` 通過。
- `npm run test:rules` 因既有 Firestore Emulator 佔用 8080 無法重啟；改以 `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx vitest run src/test/roomPermissions.test.ts` 完成，未終止既有程序。
- 尚未完成真實瀏覽器多人重連與 6+1、120 分鐘用量驗收；不能以本地 Emulator 數據直接代表 Firebase 雲端帳單。

## 2026-08-27 Firestore 用量優化第一階段

- 在 `dev` 工作樹保留既有未提交修改，完成 presence、同步、存檔、歷史讀取與診斷寫入的低成本優化。
- 正式環境 presence 改用既有 Realtime Database `roomConnections/{roomId}/{uid}/{clientId}` 連線節點與 `onDisconnect()`；Firestore Emulator 未配置 RTDB 時保留 Firestore fallback。
- 玩家狀態同步加入成功版本指紋，內容未變更時跳過讀取與回寫；玩家歷史草稿改為每 10 分鐘備份，執行師紀錄移除每分鐘全員重存。
- 歷史紀錄在遊戲進行中停止監聽，回到大廳／結算後恢復；診斷狀態改為 2 秒合併且相同內容不重送。交易、revision、command ID 與房間玩家文件權威來源不變。
- 新增與現有雲端格式一致的 `database.rules.json` 與 Firebase RTDB 設定；規則尚未直接發布，需由後續部署流程確認後發布。
- 驗證：`npm run typecheck`、`npx vitest run src`（30 files、179 passed、22 skipped）、既有 Firestore Rules 直接連線測試（22/22）、RTDB Emulator 規則啟動驗證、`npm run build`、`git diff --check` 通過。
- E2E 開房測試未執行：既有 `localhost:5183` 伺服器佔用 Playwright 需要的 port；未終止該程序。

## 2026-08-27 N058 創業貸款文案

- N058 說明改為先開設兼職工作室，再以該工作室申請創業貸款。
- 補充 5,000H 投入、600,000H 貸款、每月 3,000H 本利支出、經過銀行擲骰升級及升級後效果。
- 大地圖與共享卡片皆沿用 N058 `description` 欄位，因此會同步使用新文案。
- N057 文案保持原樣，避免相同格式卡片被誤改。
- 驗證：N058 文案回歸測試 5/5、`npm run typecheck`、`git diff --check` 通過；本次未部署。

## 2026-08-27 家庭歷程共用流程修正執行結果

- 目前分支：`dev`；保留工作樹內其他既有未提交修改。
- 已確認 14 張家庭歷程觸發卡共用同一套流程，五個家庭階段依各玩家自己的進度獨立推進。
- 已補上「3 位玩家、兩位擲骰失敗、抽卡玩家完成階段二後首次按下即結案」回歸測試與五階段效果測試。
- 驗證：source Vitest `176 passed / 22 skipped`、Firestore Rules `22 passed`、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- `.firebaserc` 預設 Firebase 專案已改為 `happinessflow-online`；新的 `firestore.rules` 已發布至正式專案。
- Vercel production 已部署並 Ready：`dpl_FU3NULLdjc5NQcKphKivJb4Mce4u`，網址 `https://happinessflow-online.vercel.app`，HTTP 200。
- 尚未完成三個真實帳號的瀏覽器回歸；部署後需用新房間驗證 H014／階段二第一次按下財務檢核即可完成，不需第二次點擊。

## 2026-08-27 家庭歷程階段二權限拒絕修正

- 修正抽卡玩家作為最後完成者時，財務檢核 transaction 同時更新玩家財務、來源完成狀態與清除家庭 prompt，卻不符合既有 Firestore 規則的問題。
- 改為先以原子 board transaction 提交自己的財務與 `sourceActionCompleted`，再以 `family-complete:{promptId}:{uid}` 冪等 command 清除 prompt 並推進事件；重試不會重複扣款。
- 新增 Firestore 規則回歸測試，涵蓋來源玩家先完成自身動作、再結束家庭事件。
- 驗證：source Vitest 171 passed／21 skipped；Firestore rules 21 passed；`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- `npm run test:rules` 因既存 Firestore Emulator 已占用 8080 無法重新啟動；已使用現有 8080 執行同一規則測試。
- 尚未進行真實多帳號瀏覽器回歸；本次未 commit、push 或部署。

## Current branch

- Branch: `dev`
- Worktree: `.worktrees/dev`
- Existing uncommitted changes were preserved.

## 2026-08-22 system changelog

- Updated the coach-facing v2.3 system update log with the new liability adjustment, monthly expense adjustment, and read-only player diagnostics features.
- Kept the public app version at `v2.3`; no deployment or version bump was requested.

## 2026-08-21 coach correction and player diagnostics

- Added coach-only transactional adjustment for an existing liability's principal and monthly payment, plus persistent monthly expense adjustments for the three existing expense categories.
- Every correction requires a reason and appends before/after values to the player's existing transaction history; negative values and zero-principal/nonzero-payment states are blocked.
- Added read-only `rooms/{roomId}/diagnostics/{playerUid}` status for player flow, screen, event, pending action, and recent error. Players publish only on flow/error changes; coaches can read, but cannot control the player.
- Added Firestore rules and regression coverage for diagnostic ownership, financial adjustment pure helpers, invalid negative values, liability removal, and expense category updates.
- Validation: `npx vitest run src` passed 155 tests (29 files, 1 skipped); Firestore Emulator rules suite passed 19 tests; `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Deliberately deferred: real-time screen sharing, remote control, arbitrary loan creation, and one-time expense deduction.

## 2026-08-19 changelog

- Updated the displayed app version and coach changelog to `v2.2`.
- Added the new 2ife transparent login logo and removed the duplicate login title text.
- Documented the family-milestone flow repair: stage persistence after reload, first-roll gating, coach approval, and duplicate-operation protection.
- Deployed the current `dev` worktree to `https://happinessflow-online.vercel.app/` as production deployment `dpl_3FspX42pyrDYHXizcy1h3BzHyPWi`.

## 2026-08-20 family milestone auto-completion

- Fixed the missing transition after the drawing player and all family-milestone participants finish: the source client now automatically retries the existing `dismissBoardCard()` flow when the active Firestore prompt is complete.
- The completion predicate requires the matching current event/card, the source player, completed source action, and every target response/action; incomplete prompts still block the turn.
- Kept the `完成卡片` button as a manual retry for write failures and added an event-level in-flight guard against duplicate dismissal.
- Validation: family/board focused tests 56/56, Firestore rules 15/15, `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Known risk: real three-account browser replay for both last-source and last-target completion remains pending.

## Completed P0 work

- Integrated the current board movement-effects, idempotent settlement, and flow-log changes.
- Added `BoardState.revision` and a bounded `processedCommandIds` ledger.
- Added transaction wrapper `runRoomBoardMutation` and applied it to dice, movement settlement/recovery, reveal, prompts, market effects, shared expenses, and forced movement.
- Added deterministic command guards to event advance, dismiss, follow-up draws, and end-turn writes.
- Added `memberUids` lifecycle updates for create/join/leave/start.
- Replaced open room Firestore writes with member/host/own-state/board-command checks.
- Added regression coverage for revision replay, foreign player-state writes, non-member reads, identity changes, and shared-card responses.
- Moved new-room player financial state to `rooms/{roomId}/players/{uid}` and kept only a public projection on the room document.
- Added automatic migration for legacy `room.playerStates` documents and private-state cleanup at game start.
- Replaced cross-player shared-expense writes with a public board event that each player applies to their own private state.
- Added a release-only `npm run typecheck` gate and cleared the formal application source errors.
- Verified H009 story sharing is approval-gated before awarding its 2 happiness points.

## Validation

- Targeted Vitest: 21 tests passed across card resolver and card schema regression suites.
- `npm run build`: passed.
- `npm run typecheck`: passed.
- Rules tests were updated for private player documents and malicious public-projection writes; the local dependency/emulator environment still needs to be available to execute them.
- `RoomContext.test.ts`: adds a three-player board-start regression (coach excluded; all three players appear in turn order).

## Follow-up gates

- Run a real three-player Firebase session and confirm Coach reaches `3/3`, first H009 completes, and turn ownership advances. This remains intentionally excluded from the current repair scope.
- Run the Firestore emulator permission suite after the missing local test dependency is restored.

## P2/P3 progress

- P2-1 completed: Tailwind now builds through local PostCSS instead of the CDN; existing colors and visual direction were preserved.
- P2-1 completed: mobile viewport no longer blocks user scaling, global focus-visible styles were added, and reduced-motion support covers both system preference and `data-motion="reduced"`.
- P2-1 completed: primary dice, turn, banking, medical, target, and real-estate controls now expose accessible labels.
- P2-1 validation: release typecheck passed, 38 focused tests passed, production build passed, and CSS/viewport baseline assertions passed.
- Visual redesign, bee-related assets, audience, and market pilot remain intentionally deferred.
- Next item: P2-2 native core audio with local settings and event de-duplication.

## P2/P3 completed scope

- P2-2 completed: native Web Audio cues cover local dice, card reveal, cash in/out, happiness, and local turn start; audio can be muted from the game settings and is stored in `hf_audio_settings_v1`.
- P2-3 completed: shared happiness ranking and life recap are available to players, Coach, and the board projection. Ties use shared ranks (`1, 1, 3`); private financial recap is not exposed to other players or projection.
- P2-4 completed: Player and projection card views now consume the shared `CardPresentationModel`; the asset manifest remains an empty fallback until the new visual direction is approved.
- P3-1 completed: player-only six-emoji reactions use `rooms/{roomId}/reactions/{uid}`, show for three seconds, and enforce one send per second in both client logic and Firestore rules.
- Explicitly deferred: visual art/color redesign, bee-related assets, audience, and Market Pilot.
- Validation after P2/P3 scope: `npm run typecheck` passed, 44 focused tests passed, `npm run build` passed, and Firestore Emulator loaded `firestore.rules` successfully.

## Firestore stability fix

- Replaced the non-rule local player-state sync transaction in `GameContext` with a latest-state read plus merge batch, so it no longer competes with board transactions through the Firestore transaction stream.
- Preserved board-owned fields while syncing financial state and kept the public player projection atomic with the private player write.
- Added error handling to family-milestone prompt cleanup so rejected transactions no longer become unhandled promise rejections.
- Validation: `npm run typecheck`, `npm run build`, and browser reload passed; the page mounted normally after the change.
- Known risk: Firebase SDK `ca9`/`b815` internal assertions are also reported upstream; if the error recurs after a clean reload, capture the exact listener action and browser SDK URL before changing more code.

## Coach player-entry sync fix

- Room hosts now subscribe to all private player-state documents based on room ownership, even if the cached account role is stale.
- Coach readiness and waiting progress now use `publicPlayerStates` per player, with private `playerStates` as a legacy fallback; financial reports still read private state.
- Validation: `npm run typecheck`, `npm run build`, and logged-in browser reload passed.
- Known risk: a live multi-account room replay is still needed to verify the exact coach/player timing path.

## Reaction bar removal

- Player emoji reactions were removed from the game UI and client code.

## Emoji removal and dice permission fix

- Removed the player reaction UI and its unused client utilities/tests.
- Tightened board command rules so an open shared prompt cannot be bypassed by the current-turn player.
- Added a Firestore regression test covering a player dice transaction across private player state, event log, and room board state.
- Deployed the current `firestore.rules` to the actual app project `happinessflow-online`; the CLI default project remains `happinessflow-63b2e`.
- Validation: `npm run typecheck`, `npm run test:rules` (9 tests passed), and `npm run build` passed.
- Next check: hard-refresh the game page and retry the current player's dice action in a fresh room.

## Player news-card copy

- Player-side news cards now show only the original map-view instruction; news descriptions and impact summaries remain on the projection screen.
- Validation: `npm run typecheck` and `npm run build` passed.

## C034 enterprise-acquisition crash

- C034 now tolerates legacy enterprise assets without `cashflow` and player states without `liabilities`, preventing the card drawer and shared response modal from crashing during render.
- Added a regression test for the legacy asset shape; `src/utils/boardCardActions.test.ts` passed 20 tests and `npm run typecheck` passed.
- Next check: replay C034 with two player accounts, select an enterprise, then test both `放棄` and `進入出售`.

## Firestore unhandled rejection during card reveal

- The card reveal handler was launching `revealBoardCard` and shared/family prompt writes through a detached async Promise without an outer error handler. A rejected Firestore transaction therefore surfaced as `Unhandled Promise Rejection` and could make the card flow appear to disappear.
- The reveal flow now awaits the family prompt write inside the same `try/catch`, handles shared-prompt creation and final card dismissal failures, and reports the error in the game UI instead of leaving a rejected Promise behind.
- Audio unlock rejection is also ignored as a non-critical effect so it cannot interrupt card handling.
- Validation: `npm run typecheck` passed, 23 targeted card tests passed, and `npm run build` passed.
- Live follow-up: reload the player page, reveal C034, then verify the shared popup buttons. If Firestore still reports an error, capture the Firebase error code/message shown by the new in-game error alert.

## Shared C034 prompt stayed disabled after response

- The shared prompt visibility check did not exclude a prompt already answered by the current player. After Firestore synced the response, the same modal remained visible with its `放棄` / `進入出售` buttons disabled.
- Shared prompts now close for the responding player while remaining visible for players who still need to reply.
- Validation: `npm run typecheck`, 23 targeted card tests, and `npm run build` passed.

## Room lookup on localhost:5174

- `5174` is a second Vite instance of the same worktree; the configured primary port remains `5173`.
- Authentication persistence is origin-specific, so a login on `localhost:5173` is not automatically available on `localhost:5174`.
- Room create/join reads and writes no longer use `safeAsync`, preventing local-only rooms and misleading `找不到此房間` errors when Firestore rejects the request.
- Waiting rooms are readable before membership is added; joining remains restricted to appending the caller's own UID. Rules were deployed to `happinessflow-online`.
- Waiting players may read only their own saved player document before joining; other player documents remain protected.
- Validation: `npm run typecheck`, Firestore permission tests (10 passed), `npm run build`, and scoped diff checks passed.

## Return players to lobby when room closes

- When the coach deletes a room, the room listener clears the player's room state. `LobbyView` now also closes its local room modal state when that room disappears, preventing an empty overlay from covering the lobby.
- The `room_waiting` route is included in the no-room redirect guard, so developer or restored waiting-room routes also return to the lobby after closure.
- The room listener now clears the stale `hf_practice_mode` flag when the room is deleted, membership is removed, or the room listener loses access; this prevents the practice-mode bypass from blocking the lobby redirect.
- `closeRoom` now awaits `deleteDoc` directly instead of swallowing a failed delete, and only clears the coach's local room after Firestore confirms deletion.
- Validation: `npm run typecheck` and `npm run build` passed. Build output contains only existing Tailwind/chunk-size warnings.
- Live multi-account close-room replay remains the final browser verification step.

## Nonexistent room message

- Room reads now allow an authenticated user to receive an empty snapshot for a missing room instead of a rules `permission-denied`; no existing room data becomes readable through this path.
- Join flow now reports `此房間不存在` when the room document is absent.
- Added a Firestore rules regression test for missing-room reads.
- Deployed the updated rules to Firebase project `happinessflow-online`.
- Validation: rules tests 11 passed, typecheck passed, production build passed, and `git diff --check` passed.

## Start game button no response

- `startRoomGame` no longer wraps the critical start transaction in `safeAsync`, which had swallowed Firestore failures without updating the UI.
- Missing-room and non-host conditions now return visible errors; successful starts immediately update the local room status to `playing` while the listener syncs the full room state.
- Replaced the start-game Firestore transaction with a latest-room read plus one batch commit, avoiding the SDK transaction stream that could remain pending and make the button appear unresponsive.

## Coach readiness stuck after player setup

- Main routing read `room.publicPlayerStates` to decide whether the coach should leave the waiting screen, but that field was missing from the effect dependencies.
- Added the dependency so the coach route re-evaluates when a player finishes profession, enterprise, and dream selection.
- The remaining monitor spinner came from a missing private player document, not the coach route. Completed setup now syncs immediately whenever the room still lacks the private financial state or public setup projection, while normal game updates keep their debounce.
- Player sync failures are now visible in the game UI instead of being swallowed by `safeAsync`.
- Added a Firestore Emulator regression that publishes completed setup and private state in the same batch; rules tests pass 12/12.
- Validation: `npm run test:rules`, `npm run typecheck`, `npm run build`, and a clean browser reload passed.
- Known risk: a live two-account room replay is still needed because the available browser tabs currently share the same GM login and are back in the lobby.

## Player sync undefined and dice quota symptom

- `toPublicPlayerState` now removes optional `undefined` fields before any Firestore write. This covers player sync, dice, movement, and card transactions through the shared helper.
- Added a regression test for the public projection shape.
- Validation: focused board/state tests 9 passed, Firestore rules tests 12 passed, typecheck passed, and production build passed.
- If Firebase still returns a literal `Quota exceeded` after a fresh reload, the project service quota must reset or be increased; the client cannot bypass that server-side limit.

## H013 family milestone card and player card drawer

- H013 player metadata now keeps the base title `幸福家庭的重要歷程`; the current family stage remains a separate player-facing field.
- Projection family-milestone content now scrolls inside the card so the introduction, stage costs, and status label are not clipped by the fixed card height.
- Player card drawers now support `收起卡片` / `展開卡片`. Collapsing only hides the card UI and keeps the card event pending, allowing the player to open credit or sell assets from the game action dock before returning to the card.
- Validation: `npm run typecheck`, 31 focused Vitest tests, `npm run build`, and `git diff --check` passed.

## Financial navigation placement

- The player game page now renders the `報表／金流／紀錄` switcher inline between the current-turn header and the income statement. Other financial-report views keep the original floating placement.
- Validation: `npm run typecheck`, 6 focused Vitest tests, `npm run build`, and `git diff --check` passed.

## Promotion dice polish

- Promotion and lifelong-learning dice now use explicit pip coordinates, one shared random-value source, and a restrained bounce animation instead of stacked spin, float, shimmer, and modal pulse effects.
- The roll surface is now an accessible button with Chinese status copy and a clear `點擊骰子開始` prompt.
- Validation: `npm run typecheck`, focused DiceFace and GameView tests, `npm run build`, and `git diff --check` passed. Browser-driven visual inspection was unavailable because the local browser-control runtime could not initialize; live exam replay remains the final visual check.

## Promotion result modal fit

- The promotion result modal now has a viewport-relative maximum height and internal scrolling, with smaller mobile padding and result-card spacing so the success details and close button stay reachable on short screens.
- Validation: `npm run typecheck`, 3 focused tests, `npm run build`, and `git diff --check` passed.

## H026 child eligibility

- H026's `requires_child_count_1` condition is now mapped into the happiness card model and enforced by the board-card action resolver.
- Players with no children now receive only a `關閉` action because the card has no effect; players with at least one child retain the existing `接受` / `不接受` flow and financial check.
- Validation: `npm run typecheck`, 30 focused tests, and `npm run build` passed.

## Player and projection sync latency

- Player private-state sync still writes the full private player document, but only updates `publicPlayerStates` when a public projection field actually changes. Financial-only changes no longer wake the projection screen or cause it to rerender from an unnecessary room-document update.
- Removed the player's duplicate room listener for market updates. Market changes now use the room snapshot already maintained by `RoomContext`, avoiding a second listener and repeated listener rebinding after each market timestamp update.
- Validation: `npm run typecheck`, 31 focused tests, `npm run build`, and `git diff --check` passed.
- Remaining check: replay one player plus projection window and confirm dice, movement, card reveal, and market update latency under the current emulator/network setup.

## Room creation stuck on loading

- Room-code lookup and room creation now have a 10-second timeout. A failed or unreachable Firestore connection no longer leaves the create modal stuck on `建立中...`; the existing error handler shows a usable connection error and resets the button.
- Normal room creation behavior is unchanged. Local Playwright replay with the seeded coach account successfully created a waiting room.

## Login and room creation spinner recovery

- The shared root cause was a hung orphaned Firestore Emulator process: port `8080` remained open, but document requests produced no response for more than 3 seconds. Vite and Auth Emulator were healthy.
- Preserved the local Auth accounts, stopped the stale emulator processes, and restarted Auth plus Firestore together. Re-seeded the four fixed local test users so the coach role document was restored.
- Post-restart health check: Vite and Auth responded in about 0.002 seconds; Firestore responded in about 0.09 seconds instead of timing out.
- Browser verification passed: the seeded coach logged in without console errors and created board-game room `104398`, reaching the waiting-room screen.

## Coach-controlled board start gate

- `room.status === 'playing'` only means players may enter setup; it does not prove the coach has pressed the monitor's central start button.
- Board action availability and the authoritative dice mutation now also reject rolls while `room.isTimerPaused === true`. The player sees `請等待執行師開始或繼續遊戲` until the coach starts the timer.
- No new start flag was added; the existing room timer state remains the source of truth.
- Validation: focused experience-state tests passed 4/4, `npm run typecheck` passed, `npm run build` passed, and scoped `git diff --check` passed.

## Pause-turn execution and projection notice

- Fixed the shared turn scanner: it no longer changes both the base index and offset after encountering a paused player. Two-player and three-player rooms now skip the correct player and decrement the counter exactly once.
- Turn changes now store a short `skippedTurnNotice` with the skipped player UIDs and next player. The projection shows a 2.6-second pause-turn message before revealing the next current-turn name.
- Completed the card write paths for every card with `missRounds`: C001-C008 move to school, C035-C037 move to hospital, and C039 moves to the repair shop; all write the pause count through `moveCurrentPlayerToSquare`.
- Hospital and repair board-square events continue to commit their pause count when the event is completed. `boardState.skipTurns` remains the single authoritative counter.
- Validation: focused turn/card tests passed 30/30, `npm run typecheck` passed, `npm run build` passed, and `git diff --check` passed.

## Purchase card without a saleable asset

- Shared purchase-card prompts now disable `進入出售` when the player has no matching sale candidates; `放棄` remains available to complete the prompt.
- The existing handler-side empty-list guard remains as a second safety net.
- Validation: focused board-card tests, typecheck, build, and diff check passed.

## C045 source player shared prompt

- Shared-card target construction now explicitly includes the card-drawing player, even if that player's member record is temporarily missing from the local member snapshot.
- The player view also accepts the prompt by `sourcePlayerUid`, so the source player receives the same C045 expense-adjustment window as other players.
- Validation: focused board-card and room-context tests, typecheck, build, and diff check passed.

## N027 no-stock player shared prompt

- Players without matching stock holdings no longer auto-submit `no_effect` and close the N027 shared prompt during render.
- The prompt remains visible so the player can explicitly choose `關閉`; players with holdings keep the existing financial-check flow.
- Validation: focused board-card and room-context tests, typecheck, build, and diff check passed.

## Shared prompt keeps source card visible

- The source player's card drawer is no longer closed when a shared prompt opens; the prompt appears above the card.
- Existing completion flow still closes the card after all shared responses and financial processing finish.
- Validation: focused board-card, room-context, and experience-state tests, typecheck, build, and diff check passed.

## All purchase cards shared prompt reliability

- The source player now marks a newly opened shared prompt visible immediately instead of waiting only for a later room snapshot effect.
- A stale local shared-prompt snapshot can no longer override a newer room prompt; cleared room prompts also clear the local snapshot.
- Data-driven coverage confirms all 26 purchase cards C009-C034 resolve to `asset_sale` and are classified as shared events.
- Validation: 37 focused tests, typecheck, build, and diff check passed.

## Family milestone source-card ownership

- Family milestone join rolls no longer advance or clear the source player's board event. The drawing player keeps control of the card until they explicitly finish it.
- A successful shared roll remains incomplete until that player accepts or declines the resulting family action; failed and declined rolls complete immediately.
- The completion guard is shared by all 14 family milestone cards rather than hard-coded for H011.
- Validation: 35 focused tests passed, `npm run typecheck` passed, `npm run build` passed, and `git diff --check` passed.

## Coach investment-income adjustment

- Added monthly investment-income decrease/increase controls beside the existing coach cash adjustment controls.
- Coach adjustments write to the player's private `income.investment` field and reject reductions below zero.
- Manual investment income is included once in passive income and appears as `執行師調整` in the financial statement.
- Validation: 8 focused tests passed, `npm run typecheck` passed, `npm run build` passed, and `git diff --check` passed. Live coach-room interaction remains unverified because no active coach room tab was available.

## Compact mobile financial check

- Reduced the financial-check modal width, header, prompt, footer, spacing, and control sizes for phone screens.
- Removed the fixed 240px empty area from every financial category; the 2x2 board now sizes to its selected content.
- Overflow remains available only as a safety fallback when a category contains many selected entries.
- Validation: financial-check tests passed 5/5, `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Mobile digital banking app

- The banking app now uses a full-screen phone layout with compact safe-area header, pinned cash row, four-column tab bar, and independently scrolling content.
- Stock cards use a two-column phone grid; loan, insurance, deposit, and vehicle panels use reduced mobile spacing, typography, cards, and controls while retaining desktop sizes at `sm` and above.
- Added an accessible close label and bottom safe-area padding; transaction behavior is unchanged.
- Validation: React best-practices review, `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Native number spinners

- Hid browser-native number input spinner controls globally; app-specific increment/decrement buttons remain unchanged.
- Validation: `git diff --check` and `npm run typecheck` passed.

## Compact stock trade action

- Removed the large stock trade summary container and replaced it with a compact total amount row and action button.
- Buy mode shows `購買總金額` and `購買`; sell mode keeps the corresponding sell action.
- Validation: `git diff --check` and `npm run typecheck` passed.

## N009 market sync loading

- Fixed the market-sync effect cancelling its own request when loading state changed, which left the N009 action stuck on `同步行情中...`.
- Success and failure now both clear the loading state.
- Validation: `git diff --check`, `npm run typecheck`, and `GameView.test.ts` passed.

## Batch stock financial check

- Consolidated batch stock purchases into one `股票` asset entry in financial checks instead of one entry per ticker.
- Transaction impacts and stock holdings still retain each ticker and amount as detail.
- Validation: `git diff --check` and `npm run typecheck` passed.

## H020 family source card visibility

- Removed automatic source-card completion when the last family milestone participant finishes responding.
- After the source player completes their own action, the card stays visible as `等待其他玩家完成`; once all responses finish, the source player explicitly presses `完成卡片`.
- The fix applies to every family milestone card, not only H020.
- Validation: 39 focused tests, `npm run typecheck`, `npm run build`, and `git diff --check` passed. Live multiplayer verification remains pending.

## Legacy room player sync permissions

- Firestore rules now treat a missing legacy `publicPlayerStates` field as an empty map while still allowing players to change only their own public projection.
- This prevents the player sync batch from falling through the room update rule and reaching the 1000-expression limit.
- Added a regression test for private player state plus public projection sync against a legacy room document.
- Validation: Firestore room permission tests passed 14/14 against the active emulator.

## Family milestone rejection unlocks end turn

- When the drawing player rejects H012 or another family milestone card, the matching family join prompt is cancelled and the board event advances immediately.
- Only the source player can use this path; other players and unrelated shared prompts remain blocked from early dismissal.
- Validation: focused family-card, room-context, and turn-state tests passed 41/41; typecheck and diff checks passed.

## Coach emergency board recovery

- Added `解除目前事件` and `強制結束回合` to the coach flow panel with confirmation dialogs.
- Both commands clear current card/event queues, movement, shared prompts, and stale player pending actions without reverting completed financial changes.
- Clear-event preserves the current player and roll state; force-end uses the existing skip-turn-aware next-player calculation.
- Validation: focused room and turn-state tests passed 10/10; typecheck, production build, and diff checks passed.

## H016 family milestone source completion permission

- Fixed Firestore rules so the current family-milestone source player can remove their matching family prompt and complete the board event after accepting or rejecting the card.
- The permission is tied to the current event ID, source card prompt, source player UID, and current turn; invited non-source players remain denied.
- The fix applies to all family milestone source cards rather than hard-coding H016.
- The player UI now marks the card handled only after the backend confirms dismissal; failed writes keep the card retryable instead of closing it locally.
- Fixed the remaining player-side guard so an explicit `不接受` from the source player reaches that backend path even while family participants are pending. Normal accepted-card completion still waits for participants.
- Validation: Firestore room permission tests passed 15/15; latest focused family, player-view, and room tests passed 39/39; typecheck, production build, and diff checks passed.

## Target enterprise financial check entries

- Target enterprise purchases now provide explicit financial check entries for cash decrease, `目標企業（名稱）` asset increase, and `企業收益` income increase.
- Target enterprise and dream purchases now provide completion impact summaries, so their transaction-complete screen matches the other transaction flows.
- The existing enterprise asset model and monthly income calculation remain unchanged.
- Validation: target/dream transaction regression tests, typecheck, production build, and diff checks passed.

## Projection city map visual refresh

- Added the foundation-only city map asset at `public/assets/projection-map/life-city-foundation.png` with its generation prompt beside it. Runtime-controlled tiles, labels, tokens, and HUD remain separate.
- Reworked the projection layout from a 14x14 square ring to a 16x12 rectangular ring while preserving the existing 52-square index order and game state contracts.
- Added live central landmark labels for residential, growth, wellness, family, finance, and dreams areas, plus a dark teal projection HUD that matches the new warm city palette.
- Validation: `npm run typecheck`, `npm run build`, and `git diff --check` passed. Source unit tests passed 21 suites / 112 tests. Full Vitest invocation still reports two pre-existing Playwright E2E loading/configuration failures.
- Risk: live projection screenshot verification needs an authenticated Firestore emulator session because the current rules deny unauthenticated room reads.

## Main-map background music

- Added a 120-second AAC/M4A background track at `public/audio/happinessflow-bgm-main-map.m4a` for the projection main map, using the approved city-stroll and warm wooden tabletop direction.
- Extended the existing native audio manager with looping background music, shared volume settings, autoplay-retry handling, and cleanup on projection unmount.
- Projection starts the music on load when allowed, retries on the first pointer or keyboard interaction, and stops/resets when leaving the map.
- Validation: `npm run typecheck`, `npx vitest run src/utils/audio.test.ts`, `npm run build`, and `git diff --check` passed. Audio metadata confirms a 120-second stereo AAC track.
- Risk: browser autoplay policy still determines whether sound starts before the first user interaction.

## Projection card editorial redesign

- Replaced the narrow projection card with a 16:9-style horizontal event stage: editorial story panel on the left, structured impact panel on the right, and a fixed status bar.
- Added three shared WebP collage assets for happiness, news, and opportunity cards. The assets contain no readable text, UI, bees, honeycombs, or insect motifs; total runtime size is about 533KB.
- Replaced 3D card flipping with a cover-slide reveal and `AnimatePresence mode="wait"`, preventing old and new card content from rendering together and producing text ghosts.
- Kept real-estate, stock-news, and family-milestone information branches. N045 now fits all seven fixed financial fields above the status bar at 1366×768.
- Validation: `npm run typecheck`, projection Vitest (11 tests), full three-player projection E2E, `npm run build`, and `git diff --check` passed.
- Risk: final projector color calibration should still be checked on the target hardware.

## Projection sound effects

- Extended the existing native Web Audio cue set with movement steps, special-square landing, shared prompt, pause-turn, and sync-warning sounds.
- Projection playback is driven by existing movement, event, card reveal, shared prompt, skipped-turn, and sync-state IDs; Firestore rerenders do not replay the same cue.
- Projection now unlocks Web Audio together with the existing BGM autoplay retry, so the first user interaction enables both music and effects.
- Validation: `npm run typecheck`, `npx vitest run src/utils/audio.test.ts`, `npm run build`, and `git diff --check` passed.
- Risk: final sound balance still needs verification on the actual projection speakers with Coach narration.

## P1 board movement sound effects

- Kept the existing per-step movement cue and added a normal landing cue for movement legs that finish without a special event.
- Replaced the shared special-square cue with distinct bank, school, hospital, and repair landing cues.
- Special landing playback uses `currentEvent.id`; movement and normal landing playback use `movement.startedAt` plus the path step, preventing Firestore rerenders from replaying audio.
- Validation: `npm run typecheck`, `npx vitest run src/utils/audio.test.ts`, `npm run build`, and `git diff --check` passed.
- Risk: final balance still needs one real projection replay across all four special squares.

## Projection audio autoplay recovery

- Fixed one-shot cues being marked as played before `AudioContext` was actually running; failed playback no longer consumes the event ID.
- Added a projection audio toggle that explicitly unlocks Web Audio and starts the main-map BGM from a user gesture when browser autoplay blocks initial playback.
- The toggle follows the existing `hf_audio_settings_v1` preference and updates when the shared audio setting event changes.
- Validation: `npm run typecheck`, `npx vitest run src/utils/audio.test.ts`, `npm run build`, and `git diff --check` passed.
- Risk: browser policy still requires the projection operator to click `啟用音效` when autoplay is blocked.

## Projection audio control placement

- Moved the projection audio control into the existing top HUD so it no longer overlays the central event stage.
- The top-right area now contains only the card-log control; audio state remains visible and clickable in the HUD.
- Validation: `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Dice sound polish

- Replaced the electronic square-wave dice cue with five irregular filtered noise impacts and a soft settling tone, matching a warm tabletop dice roll.
- Kept the existing Web Audio unlock, mute preference, and event timing unchanged; only the `dice` cue rendering changed.
- Validation: `npm run typecheck`, `npx vitest run src/utils/audio.test.ts`, `npm run build`, and `git diff --check` passed.
- Risk: final loudness and realism still need a live browser replay through the actual player/projection speakers.

## Player-side visual redesign

- Added the presentation-only `PlayerModalFrame` and applied the warm city palette to player HUD, turn controls, card drawer, financial check, banking, medical, promotion, payday, family/shared event, happiness, and real-estate surfaces.
- Kept Room, BoardState, Firestore writes, transaction builders, card action resolution, and existing callbacks unchanged. Player card content still directs players to the projection screen instead of showing full descriptions or impact summaries.
- Improved mobile layout boundaries: modal content scrolls inside the panel, actions stay visible, card log moves below the player action dock on small screens, and reduced-motion disables decorative animation.
- Validation so far: `npm run typecheck` passed after the shared frame, financial surfaces, banking surface, and event surface changes. Full build and focused tests remain to be run.
- Risk: final visual verification still needs authenticated player-session screenshots at the four requested viewport sizes.

## Player warm-theme contrast correction

- Fixed scoped warm-theme overrides that could place white text on cream inputs or dark text on green primary buttons.
- Added one shared `player-card-actions` scope so card choices, investment inputs, and asset-sale details use the same paper, ink, gold, success, and error colors as the card drawer.
- Darkened small muted and amber labels to meet readable contrast on cream surfaces while leaving projection and login styling untouched.
- Validation: typecheck, focused player tests, production build, and a signed-in local browser smoke check are required after this correction.

## Player visual consistency pass

- Unified leave-room, forced-payment, and hospital flows with the existing warm player modal frame without changing their callbacks or game-state behavior.
- Removed remaining purple and neon-blue states from promotion dice, goal purchases, digital-bank products, cash-flow labels, and transaction history.
- Updated the player lobby to the deep-teal, cream, gold, and semantic accent palette; removed the bee fallback avatar and inconsistent English subtitles.
- Validation: `npm run typecheck`, `npx vitest run src/views/game/GameView.test.ts`, `npm run build`, `git diff --check`, and a signed-in desktop lobby browser check passed.
- Risk: event modals still need a live multiplayer replay because the browser check covered the signed-in lobby rather than every board-event state.

## Career and happiness modal color correction

- Replaced the legacy dark career-rank popup with the shared warm player modal frame and clear current, unlocked, and locked rank states.
- Removed the nested background from the happiness list and aligned all checked, icon, and detail colors to the shared happiness coral palette.
- Validation: `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Happiness list surface correction

- Removed the legacy shared dark `Card` background that was overriding the warm happiness list surface.
- Locked items now stay readable on warm cream cards; only the checkbox and lock badge communicate the locked state instead of dimming the whole row.
- Child milestones use a fixed indent without scale or opacity changes.
- Validation: `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Settings menu opacity correction

- Changed the player settings dropdown to a solid cream surface and removed backdrop transparency so the game HUD cannot show through it.
- Kept the existing menu actions and updated the developer-settings hover state to the warm palette.
- Validation: `npm run typecheck` and `npm run build` passed; existing Vite warnings remain unrelated.

## Settings menu stacking correction

- Raised the player HUD stacking context above the current-turn prompt and assigned the settings dropdown its own higher layer.
- Kept the current-turn prompt visible below the menu while preserving pointer and touch interaction on the menu.
- Validation: `npm run typecheck` and `git diff --check` passed.

## Player financial tabs and card log

- Renamed the player financial navigation to `財務報表`、`現金流量表`、`交易紀錄`.
- Added `卡片日誌` as the fourth tab in the player board game view, using the existing `room.boardState.cardLog` data.
- Added an inline card-log presentation so the player view no longer opens a separate overlay; projection and history views keep their existing behavior.
- Validation: `npm run typecheck`, `npx vitest run src/components/board/BoardCardLogPanel.test.tsx`, `npm run build`, and `git diff --check` passed.
- Risk: final visual spacing should still be checked in an authenticated player session on a narrow phone viewport.

## Player financial tabs spacing

- Moved the player financial tabs up by 16px so they sit closer to the current-turn container.
- Validation: `npm run typecheck` and `git diff --check` passed.

## iPhone bottom safe-area correction

- Removed duplicate bottom safe-area padding from the player game root, action-dock wrapper, and waiting-room wrapper.
- The player action dock now keeps one non-additive Home Indicator clearance using `max(0.5rem, env(safe-area-inset-bottom))`.
- Standalone iPhone mode now uses `window.innerHeight` so the app background reaches the physical screen bottom; regular browser mode still follows `visualViewport.height`.
- Root viewport measurements confirmed the page already fills the screen; the remaining visible cutoff was the mismatched document/PWA background behind the iPhone Home Indicator.
- Document, theme, and manifest backgrounds now consistently use `#102f38`, with manifest cache version `v8`.
- Validation: `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Live follow-up: fully close and reopen the installed iPhone app, then confirm the bottom dock no longer leaves an oversized blank band.
- Replaced the mixed iPhone viewport calculation with the known working layout pattern: fixed document/App shell, native `100dvh`, no `viewport-fit=cover`, and no JavaScript viewport-height variable.
- The player action dock now uses a fixed bottom offset instead of safe-area padding. A `390x844` check confirmed every root layer reaches exactly `844px`.
- Raised the game tutorial overlay above `GameHeader` (`z-[10060]` vs `z-[120]`) so the opening tutorial is not covered by the top HUD.

## Tutorial and settlement surface correction

- Replaced the remaining dark full-screen tutorial, player settlement, inline settlement, and projection settlement backgrounds with the shared warm cream surface.
- Recolored the tutorial modal's embedded mock UI surfaces, borders, and text inside a scoped warm-preview region; semantic red and green buttons keep white labels.
- Forced the tutorial and player settlement cards to override the shared `Card` component's dark default background.
- Made the player settlement card the single vertical scroll owner and removed the nested score-detail scroll area.
- Removed the `GameView` root `touch-none` rule that prevented settlement scrolling on touch devices; normal game content keeps its existing `touch-pan-y` behavior.
- Validation: 9 focused tests passed, `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Risk: final iPhone verification should confirm the total-score and action area can be reached in a real completed game.

## Player utility dialogs

- Restored monthly cashflow, target and dream, digital banking, and medical screens as centered dialogs on mobile instead of full-screen pages.
- Target and dream purchase confirmation keeps the same dialog presentation after choosing an item.
- Dialog content remains internally scrollable on short screens; transaction and event callbacks are unchanged.
- Validation: focused modal and GameView tests 3/3, `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Player card back alignment

- Updated the player board-card back to match the projection card cover: deck editorial art, teal overlay, white inset frame, deck icon, deck name, and waiting-for-reveal label.
- Kept the existing card flip, reveal callback, and action flow unchanged.
- Validation: `npm run typecheck`, focused card/game tests, `npm run build`, and `git diff --check` passed.

## Player notification surface

- Unified transient and persistent player notifications with the warm modal language: cream surface, gold border, teal text, and semantic success/error/info accents.
- Persistent notifications keep the existing acknowledgement button and transient notifications keep the existing auto-dismiss behavior.
- Raised the notification layer above player dialogs so synchronization and action errors remain visible.
- Validation: 10 focused tests, `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Two-dice board roll flow

- Returned the authoritative `dice` array from `rollBoardDice` so the player UI can render both rolled dice instead of displaying only the sum as one die.
- Kept the server-authoritative total and movement path unchanged; projection now shows `die 1 + die 2 = total` when two dice are used.
- Synchronized the player dice animation duration with the board movement intro delay (`3500ms`) to avoid the player UI advancing early.
- Added a legacy fallback for rooms whose historical `lastRoll` has no dice array.
- Validation: typecheck passed; focused tests, production build, and `git diff --check` are next.

## Dice 3D landing correction

- Removed the landing-only flat result face; every die now keeps all six faces throughout rolling and landing.
- The authoritative result is assigned to the visible front face after the landing rotation resets, preserving the 3D cube silhouette.
- Validation: focused tests 10/10, typecheck, production build, and `git diff --check` passed.

## Cash-event and insurance repair pass

- Credit capacity is now `work income × 10`, calculated from outstanding credit principal plus legacy credit balance. Real-estate, business, and car loans do not consume this credit capacity.
- Credit borrowing is guarded in both the banking UI and the authoritative game transaction handler; repayment restores the available capacity.
- Player profession, enterprise, and dream selections now persist as a local draft and are restored only after private player-state hydration, preventing a mobile tab switch from restarting setup.
- Family milestone responses and action cleanup now return success/failure. The player UI only marks the action complete after Firestore cleanup succeeds, and direct happiness rewards carry an idempotent action key to prevent duplicate rewards after retry.
- Projection family milestone summaries now show only the introduction and stage costs/happiness; the current-stage label remains player-side only. The stage table scrolls inside its card.
- Large-enterprise shared investment input keeps the exact entered amount, validates the million-unit step, and no longer resets from a stale cash snapshot. Shared batch stock sales use one generic `股票` financial-check entry.
- Removed the generic enterprise option from financial-check asset categories.
- Added house and car insurance purchase actions in the bank. House insurance targets all uninsured houses in one transaction; car insurance updates eligible car/vehicle assets and both feed the existing monthly insurance calculation.
- Property repair fees are calculated per eligible uninsured rental property, with a fallback to all uninsured properties for legacy states. Hospital fees, repairs, board-card payments, promotion fees, and lifelong-learning fees now share the cash-shortfall recovery path for stock/asset sale, credit borrowing, or forced debt.
- The public projection guard now handles rooms missing `publicPlayerStates` without evaluating an undefined field, addressing the previous player-sync permission failure.
- Validation: `npm run typecheck`, `npx vitest run src` (26 files, 128 tests passed; rules suite skipped without emulator), `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run src/test/roomPermissions.test.ts` (15 passed), `npm run build`, and `git diff --check` passed. A plain `npm test -- --run` still incorrectly collects Playwright files under `e2e/`; use the scoped Vitest command for source tests.

## Coach game-flow controls

- Added `重複目前事件` to re-trigger the current board event for the player, with a confirmation warning and guards for active movement/shared prompts.
- Added `選擇下一回合` to let the coach choose an active player after the current flow is clear.
- Validation: `npm run typecheck`, `npx vitest run src/context/RoomContext.test.ts src/test/roomPermissions.test.ts src/views/board/boardProjectionStatus.test.ts` (6 passed; rules suite skipped), and `git diff --check` passed.

## H016 family milestone recovery and approval

- Persisted the source stage and source-action completion inside `familyMilestoneJoinPrompt`, so a pending H016 event no longer recalculates to the next stage after reload.
- Family join dice now chooses one authoritative result before animation, blocks rapid duplicate submissions, and excludes members marked as left from the waiting list.
- Added the existing `pendingRequests` approval path for source-player family milestone acceptance; coach approval is required before financial checking.
- Validation: `npm run typecheck`, `npm test -- --run src` (26 files, 131 passed; 15 rules tests skipped in the default run), `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx vitest run src/test/roomPermissions.test.ts` (15 passed), `npm run build`, browser smoke load, and `git diff --check` passed.
- Known risk: existing rooms created before this change have no persisted source-stage snapshot; validate new H016 rooms first, then add a recovery command if legacy-room migration is required.

## 2026-08-19 13-item封測流程修正

- Request processing now uses an event-scoped execution key instead of treating the player UID as the processed key. Story and board-share requests carry `boardEventId`.
- Family milestone prompts remain authoritative until source completion and every eligible participant response is complete. Stale family snapshots are discarded when the remote prompt disappears or changes.
- Shared target UIDs are calculated inside board transactions from the latest active room members; left players are excluded.
- Dice entitlement and startup-upgrade state read the latest private player document in the transaction. Store acquisition cards use `100 + purchasePercent` pricing.
- Market listings use latest-snapshot transactions and return an explicit conflict result. House insurance is now purchased one property per policy at 2,000 monthly.
- Validation: source unit tests 137 passed, Firestore rules emulator 15 passed, `npm run typecheck`, `npm run build`, and `git diff --check` passed. Plain full Vitest still collects Playwright files under `e2e/` and reports two pre-existing harness failures.

## 2026-08-20 7-item登入與幸福歷程同步修正

- Auth now uses `browserSessionPersistence`, so separate browser tabs can keep separate test accounts. Login, registration, and redirect initialization wait for the persistence promise.
- GameContext resets local game/session state on UID changes and blocks automatic player sync until the private state is hydrated, the user is still a room member, and the auth UID is unchanged.
- GameView rejects family/shared prompts whose event or card does not match the current board event. Coach room recovery transactionally removes stale prompts, matching pending actions, and same-event pending requests.
- Family source actions remain authoritative until the source player and every eligible participant complete; stale local snapshots cannot close or replace a newer remote event.
- Validation: same browser context with three player tabs passed; existing 3-player room join/setup/start/projection regression passed; source Vitest 138 passed with 15 rules tests skipped in the default run; Firestore emulator rules 15/15 passed; `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Remaining risk: all seven reported scenarios were not replayed end-to-end with real user actions in this pass; next safest task is browser regression for H016 approval, shared responses, refresh, and concurrent dice.

## 2026-08-20 雙骰拋擲動畫優化

- `GameActions` now keeps the roll button fixed and gives each die its own Framer Motion controller, lateral trajectory, rotation direction, height, and bounce.
- Double rolls land side by side without changing dice rules, authoritative totals, movement distance, `translateZ` geometry, or the 3500ms board synchronization delay.
- Result faces stay on the placeholder while the dice are airborne and are fixed only at the first landing; the landing controller stops before the idle rotation is applied, preventing a second rotation jump.
- Added `GameActions` regression coverage for two dice, one die, 3500ms single completion, and recovery after a failed roll.
- Validation: focused tests 5/5, `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Browser login was available at localhost, but an authenticated game room was not available for a final desktop/mobile visual replay; use a fresh room for the final visual check.

## 2026-08-20 family milestone per-player stage progression

- Fixed the family milestone rule so every player independently advances through the five ordered stages; the drawing player can choose directly, while other players must roll at least 4 before choosing to participate.
- Persisted the qualifying participant's own `stageProgressId` in the transaction response and pending action, so a later reload or source-player update cannot switch that participant to another player's stage.
- Passed rolls now close the dice result immediately and expose the participant choice. Failed rolls retain the existing result feedback delay.
- Remote private state is authoritative: a missing pending action is cleared locally instead of being resurrected from stale state. No pending action is created after all five stages are complete.
- Validation: focused tests 55/55 passed, Firestore rules emulator 15/15 passed, `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Known risk: no real three-account browser replay was performed for concurrent rolls plus refresh; use a fresh room for the final H016 regression.

## 2026-08-20 財務加速器第一版

- `rooms/{roomId}.financialAcceleration` 成為房間唯一倍率來源，支援 `×1／×1.5／×2／×3`；舊房間與未設定房間自動使用 `×1`。
- 月結、理財收入、薪資、定存、企業／兼職收入、租金與財務自由摘要套用倍率，支出與資產價值不放大。
- 一次性現金收益改用 `incomeMultiplierEligible` 明確標記；借款、出售、理賠、退款與全體補助不套用。交易紀錄保存原始金額、倍率與實際入帳金額。
- 執行師端新增倍率確認、最後修改者／時間、一次性全體補助；補助使用房間交易鎖定，每位有效玩家只入帳一次，遊戲結束後拒絕修改。
- 玩家端只顯示目前倍率與通知，沒有修改入口；財務報表明細與歷史／現金流紀錄同步顯示加速後數值。
- Firestore 規則新增倍率與補助的執行師限定欄位驗證。
- 驗證：`npx vitest run src`（28 files、150 passed、17 skipped）、`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run src/test/roomPermissions.test.ts`（17/17 passed）、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 注意：`npm test -- --run` 仍會誤收集 `e2e/` 的 Playwright 檔案；`npm run test:rules` 因 8080 已有既存 emulator 而無法接管，改連線該 emulator 完成規則驗證。
- 下一步：建立新測試房，用執行師與至少兩個玩家實際驗收切換倍率、月結、股利／卡片獎勵與全體補助後重整／重連。

## 2026-08-21 切回雲端 Firebase 與 production 部署

- `dev/.env.local` 已改為 `VITE_USE_EMULATOR=false`；本地 Vite 重啟後會使用 `happinessflow-online` 的雲端 Firebase，不再連接本地 Firestore/Auth Emulator。
- Production deployment `dpl_9vfnEyho56HgDt2356C1zTpgaTJT` 已部署至 `happinessflow-online.vercel.app`，狀態 Ready。
- 驗證：正式網址 HTTP 200、頁面標題為「第二人生」、首頁無 Vite error overlay 且沒有瀏覽器 console error。
- 本機 Firestore emulator 仍可能由既有測試程序監聽 8080，但目前應用程式設定不會使用它；Auth emulator 已停止。

## 2026-08-21 v2.3 更新與 production 部署

- 對外版本號更新為 `v2.3`，執行師端系統更新日誌新增本次多人同步、交易一致性、幸福歷程恢復、計時器與房間生命週期修正內容。
- 驗證：`npm run typecheck`、`npm run build`、`git diff --check` 通過；正式站登入頁顯示 `V2.3`，HTTP 200，無 Vite error overlay 或瀏覽器 console error。
- Production deployment `dpl_BhShNqZhH6ZLNpzYFSJ1WUiXwZ5h` 已部署至 `happinessflow-online.vercel.app`，狀態 Ready。

## 2026-08-21 線上測試 10 項異常修正

- `runRoomBoardMutation` 不再把讀取到但未變更的玩家私有資料整份寫回，避免企業貸款、定存、幸福點與其他財務結果被舊快照覆蓋。
- 房市購買改為同一個 Firestore board transaction 同時確認庫存、建立資產／貸款／幸福項目／交易紀錄並移除公告物件；多人競買只有第一筆成功。
- 企業升級待辦只更新 `pendingStartupUpgradeAction` 欄位，不再以舊玩家快照覆蓋剛完成的企業貸款；板卡財務操作加入事件級 operation key。
- 幸福歷程的來源完成、參與者回覆與最後結案統一依最新房間資料判定；最後完成者可結清 prompt，舊事件的本機快照／pending action 不會覆蓋新事件。
- 倒數改存開始時間基準，畫面自行計算秒數，停止每 10 秒寫入 Firestore；房間監聽加入切房／關房 token，避免上一局快照干擾下一局。
- 玩家同步錯誤保留 Firebase code 與原因，並在 UID、房間或成員資格已變更時忽略舊請求，便於判斷登入同步問題。
- Firestore 規則新增家庭歷程最後參與者結案與執行師財務設定的最小權限條件；沒有放寬一般玩家跨玩家財務寫入。

### Validation

- `npx vitest run src`：28 files、151 passed、18 skipped。
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run src/test/roomPermissions.test.ts`：18/18 passed。
- `npx vitest run src/context/RoomContext.test.ts src/utils/boardCardActions.test.ts src/utils/gameUtils.test.ts src/test/roomPermissions.test.ts`：59 passed、18 skipped。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。
- `npm run test:rules` 未接管 8080，原因是本機已有 Firestore emulator；改連線該 emulator 驗證規則成功。未宣稱已完成真實 6 位玩家加執行師的雲端瀏覽器回歸。

### Next safest task

- 使用新測試房完成 6 位玩家＋1 位執行師的瀏覽器回歸：企業貸款、定存月結、房市競買、幸福歷程最後一位完成、重新整理／重連與執行師開下一局。

## 2026-08-22 五項封測流程修正

- 家庭歷程五階段改由 Firestore transaction 以最新私有玩家資料原子結算，現金、幸福、prompt 完成與事件推進不再分兩次同步；重送使用事件級 command ID 防重複。
- 求婚等現金階段改由交易回傳 `applied／duplicate／insufficient／stale_event`，成功後不會再由舊本機現金顯示錯誤不足提示。
- 學校考試後抽幸福卡會驗證最新學校事件；所有事件結案恢復的分段移動統一由遠端 `movement.isActive` 安排冪等結算。
- 卡片翻牌會以 `eventId + cardId` 冪等補寫日誌；抽卡玩家自購不動產則在同一交易完成玩家財務與卡片結案，只有明確放棄才上架房市。
- 驗證：focused 67/67、source Vitest 159 passed／19 rules skipped、Firestore emulator rules 19/19、`npm run typecheck`、`npm run build`、`git diff --check` 通過；3 玩家帳號隔離與房間加入／設定／投影 Playwright 回歸通過。
- 未驗證：尚未有 6 玩家同時參與上述五種情境的瀏覽器自動化；下一步使用新房進行 6 玩家＋1 執行師人工回歸。

## 2026-08-25 六項封測同步與卡片流程修正

- Production deployment `dpl_FkgCYHqmK1rcCVDeezKMskwif9Uy` 已部署至 `happinessflow-online.vercel.app`，狀態 Ready；正式網址 HTTP 200、標題為「第二人生」，production bundle 已確認包含 2026-08-25 的 v2.3 更新日誌。
- 執行師端 `v2.3` 系統更新日誌日期更新為 2026-08-25，加入登入同步、家庭歷程權限、股市翻牌、房市上架與完整卡片日誌等對外說明。
- 房間共享快照不再清掉私人玩家狀態，避免登入完成後被反覆判定為缺少玩家資料；同步恢復成功時會清除舊的「玩家資料同步失敗」提示。
- 家庭歷程的一般玩家 transaction 只讀取自己的私人玩家文件，修正多人操作時因跨玩家讀取遭 Firestore 拒絕的同步失敗。若最後完成者不是移動玩家，執行師 listener 會以既有 transaction 冪等推進事件。
- 股市行情與更新通知改在玩家卡片翻面動畫完成後才生效，不再提前揭露卡片類型。
- 放棄不動產改為在同一個卡片結案 transaction 上架房市，移除結案後第二次寫入造成的漏上架窗口。
- 卡片結案會冪等補記當前卡片；投影與玩家日誌即使只有 1～3 筆，也可展開卡片說明與完整效果。
- 維修廠經過／停留收費符合已核准的 `REPAIR_SYSTEM.md`。現有保險規格未定義一般保養理賠，本次未擅自免除費用或發放理賠。
- 驗證：聚焦測試 17/17、source Vitest 163/163（另 19 項 rules 測試於一般 run 跳過）、既有 Firestore Emulator rules 19/19、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 下一步：以新房進行 6 玩家＋1 執行師回歸，重播登入、多人家庭歷程最後完成者、股市翻牌、放棄房屋與卡片日誌；另由產品決定汽車保險是否涵蓋一般維修廠保養費。

## 2026-08-26 四項跨場與交易一致性修正

- 新局玩家存檔改以 `boardGameStartedAt` 對齊 `room.startedAt`；舊局快照不能跳過三步選擇或帶入幸福值，同場重連仍可恢復。
- 不動產卡所有玩家主動關閉都走明確放棄 transaction，上架房市冪等去重；購買成功維持不入房市。
- 股市通知已讀時間改為單調遞增，延遲玩家快照不能讓同一行情重複通知。
- N056-N058 創業貸款改為單一 Firestore transaction 原子建立現金、企業資產、貸款、利息、歷史、待升級狀態與共享回覆；重送不重複入帳。
- 驗證：聚焦 66/66、source Vitest 169 passed、Firestore Emulator rules 20/20、三玩家並行貸款交易、TypeScript、production build、`git diff --check` 及 Playwright 多人開局 2/2 通過。
- 保留既有 Firestore 集合與狀態邊界，未新增服務、套件、集合、延遲重試；本次未 commit、push 或部署。
- 下一步：用新房進行 6 玩家＋1 執行師人工回歸，重播同房第二局、兩種房產放棄入口、連續兩張股市卡及 N056-N058 接受／重整／經過銀行升級。

## 2026-08-26 股市新聞卡揭示順序修正

- `GameContext` 不再在股市新聞卡的公開 `currentCardReveal.isRevealed` 尚未成立時顯示行情通知；避免其他裝置的共享行情寫入繞過玩家翻牌流程。
- `GameView` 同時確認本機翻牌 transition 與遠端揭示狀態，兩者完成後才套用行情。
- 驗證：`npx vitest run src/context/GameContext.test.ts` 4/4、完整 source Vitest 170 passed／20 skipped、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 本次未 commit、push 或部署；目前工作樹仍保留既有未提交修改。

## 2026-08-26 五項遊戲與執行師功能修正

- 家庭歷程抽卡者不再送出執行師核准請求；接受直接進入財務檢核，拒絕直接完成，普通故事分享仍走原核准流程。
- 家庭結算改用最新 Firestore 玩家資料並回傳 `applied／duplicate／requires_funding／failed`；現金不足才開啟周轉，過期事件與同步錯誤顯示具體原因，檢核答案可保留重試。
- 執行師玩家監控改為單一垂直捲動容器，移除財務報表內層捲動；未同步與未完成初始選擇都有明確狀態。
- 全體補助移除一次性限制，使用遞增 `sequence` 與 `房間＋sequence` 交易 ID；執行師可重複發放，遊戲結束與非執行師仍受限。

### Validation

- `npx vitest run src`：30 files、170 passed、20 skipped。
- Firestore Emulator rules：20/20 passed；連續補助、跳號與玩家權限案例通過。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。
- Playwright 本地頁面 smoke：390×844 與 1440×900 無水平溢出；未宣稱已完成登入後執行師手機版完整互動回歸。
- 未 commit、push 或部署；工作樹既有未提交修改均保留。

## 2026-08-26 3P＋執行師 50 回合壓力測試

- 新增 `e2e/board-50-turn-stress.spec.ts` 與 `docs/testing/BOARD_3P_50_TURN_STRESS_2026-08-26.md`。
- 修正測試啟動器避免誤接既有預覽服務，Playwright 改用 repo 內 `playwright/test` runner，並保留既有未提交功能修改。
- 本地前置檢查通過：typecheck、source Vitest 170 passed／20 skipped、build、替代 8081 Firestore Rules 20／20。
- 壓力測試實際完成 15／50 回合；第 16 回合發生 P1：卡片結案後玩家端仍顯示事件視窗，結束回合 disabled。已保存 JSON、trace 與失敗截圖。
- 因本地 P1，未執行正式站 3 回合冒煙測試、結算與第二局初始化；未 commit、push 或部署。

## 2026-08-26 七項封測問題修正

- 房市購買改用 `{ cardId, attemptId }` 與最新 Firestore 市場／玩家現金驗證；現金不足不消耗指令，直接購買抽到的不動產不會影響房市其他物件。
- 幸福歷程來源玩家的拒絕／完成等待原子結算結果，完成畫面不再只停留在本機狀態。
- 兼職工作室升級改由 `completeStartupUpgradeAction()` 單一 transaction 更新企業、收入、貸款、歷史與待辦，失敗保留流程可重試。
- 維修廠新增費用確認視窗；共享卡片改採遠端 prompt，其他流程進行中會保留待辦並提醒，完成後自動顯示。
- 驗證：source Vitest 171 passed／20 skipped、Firestore rules 20/20、typecheck、build、git diff --check；本地登入頁瀏覽器 smoke 通過且 console error 0。
- 本次未 commit、push 或部署；完整 3 玩家＋執行師多人回歸仍待新房驗證。

## 2026-08-27 v2.5 production 部署

- 已將 `dev` 工作樹的 `v2.5` 部署至 `happinessflow-online` production。
- Deployment：`dpl_7H4T7arFqD73Q5mVykuS1Js9C6yq`，狀態 `READY`。
- 正式網址 HTTP 200，production bundle 已確認包含 `v2.5`。
- 新增 `.vercelignore` 排除本機測試報告與暫存檔，避免超過 Vercel 上傳限制；未刪除任何檔案。

## 2026-08-27 開啟地圖免重複登入修正

- 根因：地圖按鈕以 `noopener,noreferrer` 開啟新分頁，阻止瀏覽器複製同源 `sessionStorage`，而 Firebase 使用分頁隔離的登入持久化，因此新地圖分頁被視為未登入。
- 修正：移除該開啟限制，讓同源地圖分頁沿用執行師登入 session；玩家不同分頁的帳號隔離設定不變。
- 驗證：`npm run typecheck`、`npm run build`、`git diff --check` 通過；建置僅有既有 Tailwind／chunk size 警告。
- 尚待：使用實際執行師帳號按「開啟地圖」完成新分頁登入延續與地圖同步回歸。

## 2026-08-27 幸福歷程失敗結果顯示修正

- 家庭歷程同步參與者擲骰未達門檻時，移除 2.5 秒自動關閉計時器。
- 失敗結果會保留在參與視窗，並改由玩家按「關閉」後才離開；成功、略過與同步失敗重試流程維持原行為。
- 驗證：`npx vitest run src`（171 passed／20 skipped）、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 尚待：以實際多人房驗證失敗結果停留、手動關閉及其他玩家同步不受影響。

## 2026-08-27 版本與系統更新日誌

- 對外版本號更新為 `v2.5`。
- 執行師端系統更新日誌新增房市交易、幸福家庭歷程、兼職工作室升級、維修廠確認與共享卡片同步修正說明。
- 驗證：`npm run typecheck`、`npm run build` 與 `git diff --check` 通過；建置僅有既有 Tailwind／chunk size 警告。
- 本次未 commit、push 或部署；完整 3 玩家＋執行師多人回歸仍待新房驗證。

## 2026-08-27 N058 文案顯示路徑修正

- 根因：大地圖在抽卡玩家私有資料尚未載入時直接使用房間內已保存的舊卡片描述；共享卡片事件則只顯示固定的簡短說明。
- 修正：新聞卡顯示一律依 `cardId` 從卡片 schema hydration；共享卡片事件同步顯示同一份完整文案。N058 現在明確說明先開設兼職工作室，再以該工作室申請創業貸款。
- 驗證：`npx vitest run src/utils/boardCardDisplay.test.ts src/test/cardCompletionCoverage.test.ts` 8/8、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 本次未 commit、push 或部署；本地 Vite 服務會透過 HMR 套用修改。

## 2026-08-28 v2.6 系統更新日誌與 production 部署

- 對外版本號更新為 `v2.6`；執行師端新增 v2.6 系統更新日誌，僅記錄目前程式與自動化測試已有依據的改善。
- 本地驗證：`npm run typecheck`、`npx vitest run src`（30 files、179 passed、22 skipped）、Firestore Rules（既有 Emulator，22/22）、`npm run build`、`git diff --check` 通過。
- `npm run test:rules` 因既有 Firestore Emulator 佔用 8080 無法重新啟動；改以 `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run src/test/roomPermissions.test.ts` 完成驗證，未終止既有程序。
- 已部署至 `happinessflow-online` production：`dpl_7vXSHRbcELHmM1fk2xBpARMGZUQ9`，狀態 `READY`；正式網址 HTTP 200，登入頁 DOM 顯示 `v2.6`，production bundle 已確認包含 `v2.6`。
- 保留工作樹既有未提交修改；未修改 `package.json` 的 `0.0.0`。

## 2026-08-29 醫療理賠按鈕與機運卡修正

- 根因：理賠按鈕只依賴目前仍開啟的棋盤卡片與事件 ID；C036 食物中毒完成付款、卡片關閉後，當前事件消失，因此彈窗判定為沒有可理賠事件。
- C035／C036／C037 完成醫療費財務檢核且有醫療保險時，會以 `pendingMedicalClaims` 保存待理賠事件；理賠按鈕可在之後重新開啟、重整後仍顯示，並以卡片固定理賠金額進入財務檢核。
- 待理賠事件以玩家狀態白名單同步，理賠交易使用 `insurance-claim`、卡片事件 ID 與既有 `appliedBoardFinancialEventIds` 防止重送；成功後移除待理賠事件。遊戲結算後按鈕保持不可申請。
- 移除舊的即時醫療／汽車理賠直接改本地現金路徑。C038 維持汽車移除、幸福值、原車貸與理賠的原子處理；C039／C040 投保時由保險支付維修費，不再出現錯誤汽車理賠分頁；C041／C042／C043 全部投保免付，含未投保房屋時每張卡只收一次固定修繕費。
- 理賠彈窗現在列出所有待申請醫療事件，C036 顯示固定 50,000H，不再以醫療保險張數乘算；財務檢核成功訊息與歷史標籤改為醫療保險理賠。
- 驗證：`npm run typecheck` 通過；source Vitest `31 files、199 passed／23 skipped`；Firestore Rules 直接連線測試 `23/23`；`npm run build` 與 `git diff --check` 通過。建置仍有既有 Tailwind ambiguous class、dynamic import 與 chunk size 警告。
- 本次未修改 Firestore Rules，未新增 Firebase 服務、集合或套件；未執行 reset、clean、commit、push 或部署。真實 3／6 玩家瀏覽器理賠流程仍待新房人工回歸。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/types.ts`、`src/context/GameContext.tsx`、`src/context/GameContext.test.ts`、`src/hooks/useGameLogic.ts`、`src/views/game/GameView.tsx`、`src/components/modals/MedicalClaimModal.tsx`、`src/components/modals/MedicalClaimModal.test.tsx`、`src/utils/boardCardActions.ts`、`src/utils/boardCardActions.test.ts`
- 測試結果：typecheck 通過；Vitest 31 files／199 passed／23 skipped；Firestore Rules 23/23；production build 通過；`git diff --check` 通過
- 目前風險：尚未以實際 3／6 玩家瀏覽器重播 C036 重整、連點、理賠財務檢核與 C038–C043 多玩家情境；本地測試未驗證雲端部署環境。
- 下一個最安全任務：使用隔離新房完成單玩家 C035–C043 理賠回歸，再以 3／6 玩家重播同卡競爭與重整流程；確認後才考慮部署。

## 2026-08-31 v2.9 十一項異常修正與 production 部署

- Firebase Auth 已加入並讀回確認 `2ife.vercel.app`；登入錯誤新增 `auth/unauthorized-domain` 明確訊息。正式站 Google Auth iframe 已以新網域初始化，無新 unauthorized-domain console error。
- 股票 UI、舊交易表單與交易套用入口都拒絕零／非有限價格、非正整數張數及總額不一致交易。
- `BoardFinancialFlow` 新增 `manual-bank`；一般銀行交易完成後不再結案目前卡片。定存／保險選項參照固定，N055 可先進信用貸款再回到共享投資提示。
- 學校視窗返回或關閉後可再次開啟；選擇頁移除外層 `touch-none`，保留原生水平捲動容器。
- 共享卡片沿用 120 秒 presence 門檻供房主排除失聯回覆；幸福歷程改用持久化 movement effects 原子恢復，不跨讀其他玩家私有資料。
- 結束回合新增提交中、防連點、耗時 telemetry 與 10 秒同步提示；既有 command ID 冪等邏輯不變。
- Firestore Rules 已發布至 `happinessflow-online`；Vercel production deployment `dpl_BcUaHXkPbzRE5J8ssrnAW8X6TCRc` READY，alias 為 `https://2ife.vercel.app/`，正式站顯示 v2.9、HTTP 200、console error 0。
- 驗證：source Vitest 32 passed／1 skipped（201 passed、23 skipped）；Firestore Rules 23/23；TypeScript、production build、`git diff --check` 通過。新增針對性測試 31/31 通過。
- 未完成：3 玩家 Playwright 受本地重複 Playwright runner 阻斷，6 玩家腳本與帳號尚不存在；因此未宣稱 3／6 玩家完整瀏覽器競買通過。已修正 E2E 臨時設定的 RTDB Rules 絕對路徑，未保留無效 runner 入口修改。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/types.ts`、`src/context/RoomContext.tsx`、`src/context/RoomContext.test.ts`、`src/views/game/GameView.tsx`、`src/views/lobby/CoachGameView.tsx`、`src/components/banking/BankingAppModal.tsx`、`src/components/banking/BrokerView.tsx`、`src/components/banking/BrokerView.test.tsx`、`src/components/common/SelectionCarousel.tsx`、`src/components/game/GameActions.tsx`、`src/components/game/GameActions.test.tsx`、`src/components/modals/PromotionModal.tsx`、`src/hooks/useGameLogic.ts`、`src/hooks/useTransactionLogic.ts`、`src/views/auth/AuthView.tsx`、`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`、`scripts/e2e/run.mjs`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：Vitest 201 passed／23 skipped；Rules 23/23；TypeScript、production build、diff check；正式站 HTTP 200、v2.9、console error 0
- 目前風險：3／6 玩家完整瀏覽器競買與登入後手機選擇頁實機滑動尚未閉環；Google 帳號選擇器在 in-app browser 以 Auth iframe 初始化，但未代替使用者完成帳號登入
- 下一個最安全任務：先統一 Playwright runner 依賴，再新增 6 玩家 seed 與同屋／異屋競買案例，使用隔離 emulator 完成 3／6 玩家回歸

## 2026-09-01 執行師卡片發送頁面

- 執行師頁面新增「卡片發送」，正式 Vercel 與本地環境都可指定玩家、搜尋並篩選全部幸福／機運／新聞卡。
- 觸發前必須點擊確認；有未完成遊戲流程時禁止觸發，並引導先完成或解除目前事件。觸發成功後保留卡片發送頁面，由執行師手動關閉。
- 測試觸發仍寫入既有 `boardState` 並使用 `runRoomBoardMutation`；不直接套用卡片結果，玩家端翻牌、共享、財務檢核、重連與結案都走正式流程。
- 只有執行師／GM 可見及使用；仍由 Context 驗證身份、有效玩家與最新交易狀態；未新增 Firebase 集合、服務或套件。
- 驗證：`npm run typecheck`、RoomContext 26/26、完整 Vitest 203 passed／23 skipped、`npm run build`、`git diff --check` 通過。既有 BrokerView 測試首次整批執行逾時，單獨重跑與完整重跑均通過。
- 瀏覽器目前是玩家帳號，未擅自切換登入執行師；尚待使用實際執行師帳號點擊卡片發送、確認彈窗與玩家端翻牌。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/components/coach/CardTestConsole.tsx`、`src/context/RoomContext.tsx`、`src/views/lobby/CoachGameView.tsx`、`CODEX_HANDOFF.md`
- 測試結果：typecheck 通過；Vitest 203 passed／23 skipped；production build 通過；`git diff --check` 通過
- 目前風險：未實際點擊執行師角色的全卡測試頁面；現有玩家頁可見 RTDB `roomLastOnline` permission denied 既有警告，與本次功能無關
- 下一個最安全任務：用執行師登入目前 Emulator 房間，觸發各牌組至少一張並確認玩家端、大地圖與結案流程

## 2026-09-01 本地三玩家全卡片矩陣驗收

- 測試分支／SHA：`dev`／`a1482f83aa7dc51a9a8861d56ef2dd91525bba4d`
- 測試環境：本地 Vite 5183、Auth 9099、Firestore 8080、RTDB 9000；3 位玩家＋1 位執行師；房間 `873253`
- 前置檢查：typecheck、Vitest `203 passed／24 skipped`、隔離 Firestore Rules `24/24`、build、`git diff --check` 通過
- 瀏覽器結果：開房／登入／三步開局通過；H001 翻牌及卡片日誌寫入後，操作／結案 120 秒未完成，判定 A 級 P1，停止矩陣測試
- 觀察證據：Firestore commit HTTP 400／409、stored version mismatch、Player1 `Maximum update depth exceeded`、RTDB presence／diagnostics `permission_denied`
- 覆蓋率：已執行 1／160，失敗 1（A）；未執行 159；不宣稱其餘卡片通過
- 正式報告：[BOARD_3P_ALL_160_CARDS_LOCAL_2026-09-01.md](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/dev/docs/testing/BOARD_3P_ALL_160_CARDS_LOCAL_2026-09-01.md)
- 下一個最安全任務：先修正 H001 的交易版本衝突與 React 更新深度錯誤，單卡通過後再恢復全卡片矩陣；不要以延長等待或自動重試掩蓋阻斷。

## 2026-09-01 H011 家庭歷程首次確認權限拒絕修正

- 根因：抽卡玩家完成家庭歷程時，舊流程先以 `family-action` 寫入自己的財務／完成狀態，再以 `family-complete` 另開 transaction 清除 prompt；第一筆成功、第二筆被規則或競態拒絕時，畫面就顯示 `Missing or insufficient permissions.`，再次點擊才會利用已提交的 command 完成結案。
- 修正：當所有參與者已完成時，`completeFamilyMilestoneAction()` 將抽卡玩家階段結果、自己的完成狀態、家庭歷程 prompt 清除與回合推進合併為同一筆 `family-action` transaction；保留舊版已提交 action 的冪等 `family-complete` 相容路徑。
- Firestore Rules 新增只允許目前回合抽卡玩家、目前事件、目標回覆數已齊全且 prompt 被清除的原子結案條件；未完成參與者或非當事玩家仍不可清除家庭歷程。
- 新增規則回歸案例：H011 兩位玩家失敗後，抽卡玩家一次 transaction 同時完成結果與事件結案。
- 驗證：`npm run typecheck`、完整 Vitest `33 files / 203 passed / 24 skipped`、Firestore Rules `24/24`（以隔離 18080 Emulator 驗證，因既有 dev Emulator 佔用 8080）、`npm run build`、`git diff --check` 通過。
- 本次未修改版本號、未 commit、push 或部署；未執行 3／6 玩家瀏覽器實測，正式雲端 Rules 尚未由本次變更發布。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/context/RoomContext.tsx`、`firestore.rules`、`src/test/roomPermissions.test.ts`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 既有工作樹修改：`src/App.tsx`、`src/components/game/BoardCardDrawer.tsx`、`src/constants.ts`、`src/context/RoomContext.test.ts`、`src/views/game/GameView.tsx`、`src/views/lobby/CoachGameView.tsx`、`src/components/coach/`、`src/constants.test.ts` 均保留
- 下一個最安全任務：先在本地 3 位玩家重播 H011／H014，確認首次財務檢核即可結案；再另行部署同步更新後的 Firestore Rules 與前端。

## 2026-09-01 v3.0 家庭歷程同步修正與 production 部署

- 對外版本更新為 `v3.0`；執行師系統更新日誌新增家庭歷程原子結案、多人同步／冪等保護與卡片發送功能。
- Firestore Rules 已發布至 Firebase project `happinessflow-online`，新增抽卡玩家在所有目標回覆完成時，以單一 transaction 同時完成自身結果與家庭歷程結案的權限條件。
- Vercel project `2ife` production deployment `dpl_HkCn5r8P3RHP8oqpLeMUQgi9DUwi` 已 Ready，正式別名為 `https://2ife.vercel.app`；HTTP 200，production bundle 已確認包含 `v3.0`。
- 驗證：`npm run typecheck`、完整 Vitest `33 files / 203 passed / 24 skipped`、`npm run build`、`git diff --check` 通過；Cloud Rules 發布成功。
- 建置仍有既有 Tailwind ambiguous class、dynamic import 與 chunk size 警告，未阻斷部署。
- 本次未完成本地 H011／H013／H014 三玩家瀏覽器實測；正式站也未進行多人流程冒煙，因此不宣稱家庭歷程實機驗收通過。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`，並同步更新交接／除錯紀錄
- 部署：Firebase Rules 已發布；Vercel `2ife` production Ready，`https://2ife.vercel.app` HTTP 200、v3.0
- 目前風險：H011／H013／H014 尚未用 3 個獨立瀏覽器帳號完成本地與正式站回歸；目前瀏覽器 5183 仍是 cloud mode，未切換 Emulator
- 下一個最安全任務：以統一本地 Emulator 重播三張代表卡，確認 H013 第一次財務檢核即可完成，再進行正式站三人冒煙

## 2026-09-01 家庭歷程 Rules 預算與假完成修正

- 確認反覆出現的家庭歷程「同步權限被拒絕」主因是 Firestore Rules 在大型真實房間更新時超過 1,000 expression 上限，不是玩家權限設定錯誤。
- `firestore.rules` 先依 `boardState` 是否變更分流權限判斷，避免每次交易都計算完整 OR 鏈；安全限制維持不變。
- `submitFamilyMilestoneJoinResponse()` 改為明確布林結果：重複 command 只有在 Firestore 已有玩家 response 時才成功；過期或缺少 response 時不寫入假 command。
- `GameView` 移除本機提交清單作為完成依據，Firestore prompt response 成為唯一真實來源；失敗後不會消失並讓全房永久等待。
- 驗證：typecheck；Vitest 33 files、203 passed／24 skipped；大型房間 Firestore Rules 24/24；production build；`git diff --check`。
- 本次未 commit、push 或部署；本地 Vite／Emulator 維持運行。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`firestore.rules`、`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx`、`src/test/roomPermissions.test.ts`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 目前風險：現有測試房已留下先前失敗造成的缺漏 response；需重送該玩家擲骰，或以新 H011／H013／H014 流程做三人瀏覽器回歸
- 下一個最安全任務：在本地新家庭歷程事件讓兩位玩家同時擲骰，再由抽卡玩家完成財務檢核，確認第一次即可結案

## 2026-09-01 強制負債單次完成財務交易

- 修正 `GameView` 強制負債流程：不再先寫入周轉借款再立即用舊狀態重套原交易；第一次點擊即完成差額補足與原交易。
- 新增 `TransactionData.forcedDebtAmount`，一般財務交易在同一個 `GameContext` state update 建立強制負債與原交易；家庭歷程傳入 `completeFamilyMilestoneAction()`，由同一個 Firestore transaction 原子完成。
- 家庭階段仍保留原本現金不足判定；強制負債只補足實際差額，月付金為 0，交易紀錄分別保留融資與原事件。
- 驗證：RoomContext 27/27；完整 Vitest 204 passed／24 skipped；typecheck、production build、`git diff --check` 通過。
- 本次未 commit、push 或部署；Vite 與 Firebase Emulator 仍在本地運行。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/types.ts`、`src/utils/familyMilestones.ts`、`src/hooks/useGameLogic.ts`、`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx`、`src/context/RoomContext.test.ts`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 目前風險：尚未用瀏覽器實際重播一個現金不足的非家庭卡片；本機純邏輯與家庭交易測試已通過
- 下一個最安全任務：在本地房間測試一般支出與家庭歷程各一次，確認第一次按「強制結束並計入負債」即顯示交易完成
# 2026-08-31 H013 家庭歷程抽卡玩家等待狀態修正

- 原因：家庭歷程抽卡玩家在財務檢核完成時，部分入口仍以一般 `board-card` 流程處理財務，再另外等待主玩家完成狀態；因此可能留下 `sourceActionCompleted` 未完成的共享 prompt，畫面持續顯示「等待其他玩家完成」。
- 修正：`GameView` 對目前卡片的家庭歷程抽卡玩家事件，統一改走 `completeFamilyMilestoneAction()`；該入口依最新 Firestore 狀態原子套用階段結果、標記主玩家完成並在所有玩家完成後結案。H013 與其他家庭歷程卡共用此修正。
- 驗證：`npm run typecheck` 通過；`boardCardActions.test.ts` 與 `RoomContext.test.ts` 共 86 項通過；完整 Vitest 203 passed／23 skipped、正式建置與 `git diff --check` 通過。瀏覽器三人回歸尚未執行。

## 2026-09-01 強制負債完成後清除舊錯誤彈窗

- 修正 `BoardFinancialCheckModal`：外部收到已完成狀態時清除先前現金不足流程留下的「交易尚未正式完成」popup。
- 驗證：相關測試 42/42、typecheck、production build、diff check 通過。
- 未 commit、push 或部署。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/components/game/BoardFinancialCheckModal.tsx`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：相關測試 42 passed；typecheck、build、diff check 通過
- 目前風險：尚未使用瀏覽器實際重播現金不足流程
- 下一個最安全任務：本地測試一次一般支出與一次家庭歷程的強制負債，確認成功畫面沒有舊錯誤彈窗

## 2026-09-01 銀行定存完成後無法結束回合

- 修正 `GameView.finalizeBoardFinancialFlow()`：銀行快速交易完成後恢復銀行後續選項；略過後呼叫既有 `advanceBoardEventQueue('bank')` 清除銀行事件，避免 `currentEvent` 殘留阻擋結束回合。
- 驗證：相關測試 37/37、typecheck、production build、diff check 通過。
- 未 commit、push 或部署。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/views/game/GameView.tsx`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：GameView／BoardFinancial／Room 相關測試 37 passed；typecheck、build、diff check 通過
- 目前風險：尚未以瀏覽器重播「踩銀行 → 辦理定存 → 略過後續 → 結束回合」
- 下一個最安全任務：在本地房間完成一次定存後略過銀行後續，確認銀行事件清除且可結束回合

## 2026-09-01 定存解約金額改為萬元選擇

- 修正 `WealthView`：每筆定存可用加減按鈕或輸入框選擇解約萬元數，預設整筆、上限為該筆定存可解約萬元數。
- 交易仍沿用既有 `relatedAssetId` 部分解約邏輯，實際金額為選擇萬元數 × 10,000。
- 驗證：銀行相關測試 11/11、typecheck、production build、diff check 通過。
- 未 commit、push 或部署。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/components/banking/WealthView.tsx`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：銀行相關測試 11 passed；typecheck、build、diff check 通過
- 目前風險：尚未以瀏覽器實際操作部分解約並確認資產餘額與每月利息更新
- 下一個最安全任務：本地建立一筆 50,000 定存，解約 2 萬後確認剩餘 30,000 與利息正確

## 2026-09-01 借用信貸單次完成原交易

- 修正 `handleForcedBoardBorrow()`：不再先獨立建立借款後重新送回原財務檢核；改用 `fundingLoanAmount` 一次套用。
- 一般卡片與家庭歷程均保留原本交易，新增信用貸款本金與 10% 月息，成功後不返回財務檢核。
- 未 commit、push 或部署。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/types.ts`、`src/utils/familyMilestones.ts`、`src/context/RoomContext.tsx`、`src/hooks/useGameLogic.ts`、`src/views/game/GameView.tsx`、`src/context/RoomContext.test.ts`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：相關測試 41 passed；typecheck、production build、`git diff --check` 通過
- 目前風險：尚未以瀏覽器實際重播現金不足 → 借用信貸 → 完成原交易
- 下一個最安全任務：本地測試一次一般卡片與一次家庭歷程的信貸周轉

## 2026-09-01 共享卡片重複入口：修正

- 根因：共享卡片事件建立後，抽卡玩家原本的卡片抽屜仍維持開啟，與共享視窗同時顯示。
- 修正：`GameView` 以目前事件、抽卡玩家、卡片 ID 與共享 prompt 同時比對；任何共享 prompt 出現時自動關閉並隱藏原卡片抽屜。N055 與其他共享出售、投資、股利、創業貸款及全體支出卡片共用此判斷。
- 驗證：GameView／boardCardActions／RoomContext 測試 90 passed；typecheck、production build、`git diff --check` 通過。
- 未 commit、push 或部署。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/views/game/GameView.tsx`、`CODEX_HANDOFF.md`
- 目前風險：尚未以瀏覽器實際觸發 N055 與其他共享卡片確認視覺層級
- 下一個最安全任務：本地開房各觸發一張共享出售與共享投資卡片，確認只顯示共享視窗

## 2026-09-01 股票批量交易張數與財務檢核提示：優化

- 股票買入／賣出新增「每檔張數」輸入；批量按鈕會將指定張數套用到全部股票，賣出時自動以各檔持有量為上限。
- 財務檢核錯誤提示改為「填寫正確」與「填寫錯誤或尚未完成」兩個區塊；第一次錯誤仍不揭露完整答案，第二次才顯示應填項目。
- 驗證：Broker／BoardFinancial／Banking／FinancialRules 測試 14 passed；typecheck、production build、`git diff --check` 通過。
- 未 commit、push 或部署。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/components/banking/BrokerView.tsx`、`src/components/banking/BrokerView.test.tsx`、`src/components/game/BoardFinancialCheckModal.tsx`、`src/components/game/BoardFinancialCheckModal.test.ts`、`CODEX_HANDOFF.md`
- 目前風險：尚未以瀏覽器實際操作手機尺寸的批量輸入與財務錯誤彈窗
- 下一個最安全任務：本地開啟銀行股票頁，確認批量買賣與錯誤提示在手機畫面不溢出

## 2026-09-01 骰子改由大螢幕統一呈現

- 棋盤移動、維修廠、醫院、家庭歷程參與、學校／終身學習與工作室升級，均以一次性 `diceEvents` 寫入房間 `boardState`；大地圖依序播放完整骰點與結果，最多保留最新 20 筆。
- 玩家端只送出擲骰指令，不再自行產生最終骰點或播放擲骰動畫；房間 transaction 仍負責權威骰點、事件結果與既有 command ID 防重複。
- 維修廠與醫院的費用骰、家庭歷程參與資格骰及升等／升級骰均沿用現有流程與資料結構，未新增服務、集合或套件。
- 驗證：Vitest 34 files、209 passed／24 skipped；相關骰子測試 39 passed；typecheck、production build、`git diff --check` 通過。建置保留既有 Tailwind ambiguous class、動態匯入與 chunk size 警告。
- 尚未以三個玩家＋執行師的實機瀏覽器投影連線驗證所有骰子事件依序播放；下一個最安全任務是開一間本地棋盤房，分別觸發移動、家庭參與、醫院／維修與升級骰，確認大螢幕顯示且玩家端只需點擊。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/types.ts`、`src/context/RoomContext.tsx`、`src/components/game/GameActions.tsx`、`src/components/game/GameActions.test.tsx`、`src/components/game/DiceRollContainer.tsx`、`src/components/modals/DiceRollModal.tsx`、`src/components/modals/BizUpgradeModal.tsx`、`src/views/game/GameView.tsx`、`src/views/board/BoardProjectionView.tsx`、`src/components/board/DicePresentationOverlay.tsx`、`src/game/board/dicePresentation.ts`、`src/game/board/dicePresentation.test.ts`、`CODEX_HANDOFF.md`
- 測試結果：Vitest 209 passed／24 skipped；typecheck、production build、`git diff --check` 通過
- 目前風險：尚未完成多帳號瀏覽器實機投影驗收；非棋盤模式仍保留原本本機骰點邏輯
- 下一個最安全任務：用本地 Firestore Emulator 建立 3 位玩家＋1 位執行師，逐項驗證大螢幕骰點佇列與重整後不重播舊事件

## 2026-09-01 版本 v3.1：骰子大螢幕同步

- 更新 `src/constants/version.ts` 對外版本為 `v3.1`。
- 更新執行師系統更新日誌，記錄骰子結果統一由大螢幕呈現、玩家端只負責點擊，以及各骰子流程的同步防重複處理。
- 驗證：版本與日誌來源已更新；沿用本次骰子功能已通過的 Vitest 209 passed／24 skipped、typecheck、production build、`git diff --check` 結果。
- 未 commit、push 或部署。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`、`CODEX_HANDOFF.md`
- 測試結果：版本檔案變更後 `npm run typecheck`、`npm run build`、`git diff --check` 通過；建置保留既有 Tailwind、動態匯入與 chunk size 警告
- 目前風險：尚未完成三位玩家＋執行師的瀏覽器實機投影驗收
- 下一個最安全任務：執行 typecheck、production build 與本地多人骰子投影驗收

## 2026-09-01 大螢幕骰子彈窗對比：優化

- 大螢幕骰子彈窗增加深色遮罩與輕微背景模糊，彈窗本體改為不透明深色底、實色金框及更明確陰影，避免棋盤內容穿透干擾骰點辨識。
- 未修改骰點、動畫時間、事件佇列或玩家操作流程。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/components/board/DicePresentationOverlay.tsx`、`CODEX_HANDOFF.md`
- 測試結果：typecheck、production build、`git diff --check` 通過；本地頁面 HTTP 200
- 目前風險：尚未在實際多人房間觸發骰子事件確認投影設備上的最終亮度
- 下一個最安全任務：在大地圖觸發一次單骰與一次雙骰，確認遮罩與文字對比

## 2026-09-01 換回合後骰子按鈕維持鎖定：修正

- 根因：骰子改由大螢幕播放後，玩家端 `GameActions` 的本機 `isAnimating` 仍在成功擲骰後保持 `true`；回合再次輪到該玩家時按鈕因此維持禁止狀態，重新整理才會清除。
- 修正：以 Firestore 權威回合狀態 `isBoardTurn` 為界；回合離開玩家時清除本機動畫旗標，下一次輪到該玩家可直接擲骰。
- 未修改骰點、回合交易、事件佇列或 Firestore 資料結構。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/components/game/GameActions.tsx`、`src/components/game/GameActions.test.tsx`、`CODEX_HANDOFF.md`
- 測試結果：GameActions／experienceState 12 passed；typecheck、production build、`git diff --check` 通過
- 目前風險：尚未以兩個真實玩家瀏覽器完成 A → B → A 的完整換回合實測
- 下一個最安全任務：本地兩位玩家各完成一回合，確認第三回合 A 不需重新整理即可擲骰

## 2026-09-01 玩家端擲骰圖示圓角與立體感：優化

- 玩家端骰面與核心圓角由 6px 提升為手機 11px／桌面 14px，補上真正的骰面邊框。
- 增加內亮、內暗、底部厚度與落地陰影，讓按鈕呈現圓潤實體感，同時避免旋轉六面造成接縫。
- 未修改骰子尺寸、骰點或操作邏輯。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/components/game/GameActions.tsx`、`CODEX_HANDOFF.md`
- 測試結果：GameActions 6 passed；typecheck、production build、`git diff --check` 通過；本地玩家畫面已確認
- 目前風險：不同實體手機的陰影濃度仍可能略有差異
- 下一個最安全任務：在手機與桌面各確認啟用、禁用兩種骰子狀態

## 2026-09-01 玩家端提前公布骰點：修正

- 根因：玩家端收到權威骰點後立即顯示結果彈窗，但大螢幕仍會播放 3.6 秒骰子動畫，兩邊沒有共用完成時間。
- 修正：移除玩家端重複骰點彈窗；大螢幕動畫、棋盤開始移動及玩家端「結束回合」解鎖共用 `DICE_PRESENTATION_DURATION_MS`。
- 玩家仍會立即送出且保存權威骰點，只有操作解鎖延後至大螢幕播放完成。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/game/board/dicePresentation.ts`、`src/components/board/DicePresentationOverlay.tsx`、`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx`、`CODEX_HANDOFF.md`
- 測試結果：骰子／GameActions／RoomContext 36 passed；typecheck、production build、`git diff --check` 通過
- 目前風險：尚未以玩家與大螢幕兩個實際分頁同步計時驗收
- 下一個最安全任務：玩家擲一次骰，確認大螢幕關閉後才顯示「結束回合」且玩家端不再跳骰點彈窗

## 2026-09-01 跳過下一位後同玩家骰子鎖定：修正

- 兩位玩家 A、B 時，若 B 暫停回合，權威回合會從 A 直接回到 A；舊邏輯只在玩家 UID 改變時清除本機骰子動畫鎖，因此 A 仍被鎖住。
- `GameActions` 現在同時依 `hasRolledThisTurn=false` 清除本機鎖；同一玩家直接取得新回合也能立刻擲骰。
- 未修改跳過回合、骰點或 Firestore transaction。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/components/game/GameActions.tsx`、`src/components/game/GameActions.test.tsx`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：GameActions／experienceState 13 passed；typecheck、production build、`git diff --check` 通過
- 目前風險：尚未以兩位真實玩家完成 A → 跳過 B → A 的瀏覽器實測
- 下一個最安全任務：本地將 B 設為暫停一回合，由 A 結束回合後確認 A 可直接再次擲骰

## 2026-09-01 版本 v3.2：骰子同步修正與正式部署

- 對外版本更新為 `v3.2`，系統更新日誌加入骰子顯示時機、換回合解鎖與視覺辨識度優化。
- 本地仍維持 `VITE_USE_EMULATOR=true`；目前 Firestore Emulator 載入工作樹的 `firestore.rules`。
- 已將同一份 `firestore.rules` 與 `database.rules.json` 發布至 Firebase 專案 `happinessflow-online`。
- 規則雜湊：Firestore `3c063df2b766561fd9e9416b6146fbc574ca8d1dbcce220ffd4dc2c79317cbdb`；Realtime Database `f3e85c60c82bbe5f4c6ceb0c7e02d1c92c97b0f2d8d0390a2700f0ec97211463`。
- Vercel production deployment `dpl_Dzni52shpfyY1yoZoeGtiYbEwYuq` 已 Ready，正式網址 `https://2ife.vercel.app/` 回應 HTTP 200，正式 JS 資產確認包含 `v3.2`。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`、`CODEX_HANDOFF.md`
- 測試結果：TypeScript 通過；Vitest 211 passed／24 skipped；Firestore rules 24 passed；production build、`git diff --check` 通過
- 部署結果：Firebase Firestore／Realtime Database 規則發布成功；Vercel 正式部署 Ready
- 目前風險：Firestore 規則編譯仍有既存的未使用函式及保留名稱警告；尚未完成兩位真實玩家 A → 跳過 B → A 的瀏覽器實測
- 下一個最安全任務：以本地 Emulator 完成兩位玩家跳過回合及玩家／大螢幕骰子同步實測

## 2026-09-02 定存存入單位統一：修正

- 定存存入改為以萬元為單位輸入，實際交易金額固定為 `10,000 × 單位數`，與解約規則一致。
- 保留原有銀行資格、現金上限與交易流程；非萬元倍數不會送出交易。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/components/banking/WealthView.tsx`、`src/components/banking/WealthView.test.tsx`
- 測試結果：定存元件測試 1 passed；typecheck、production build、`git diff --check` 通過
- 目前風險：正式多人銀行流程尚未以瀏覽器實測
- 下一個最安全任務：在本地銀行頁確認 1 萬、2 萬及現金不足 1 萬時的按鈕狀態

## 2026-09-02 執行師卡片發送版本衝突：修正

- `runRoomBoardMutation()` 遇到 Firestore 版本衝突時，沿用同一個 command ID 最多重試 3 次；權限與業務錯誤不重試。
- 執行師卡片發送耗盡重試仍失敗時，改顯示「房間正在同步，請稍候再試」，不再直接顯示 Firestore 英文錯誤。
- 更新 `DEBUG_HANDOFF.md`，記錄錯誤訊息、重現條件、根因與禁止重複的修法。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/game/board/runBoardMutation.ts`、`src/game/board/runBoardMutation.test.ts`、`src/context/RoomContext.tsx`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：交易重試 2 passed；房間／權限測試 28 passed；完整 Vitest 214 passed／24 skipped；typecheck、production build、`git diff --check` 通過
- 目前風險：尚未在正式多人房間實際重現並確認同時寫入時的最終成功率
- 下一個最安全任務：本地 3 位玩家＋1 位執行師同時操作時，測試卡片發送、回合切換與卡片結案

## 2026-09-05 共享兼職工作室效果未入帳：修正

- 根因：共享資產出售原本由 `handleTransactionSubmit()` 先改本機玩家資料，再用另一筆 `submitSharedCardPromptResponse()` 寫共享回覆；參與玩家的本機結果可能在防抖同步前被舊 Firestore 快照覆蓋。
- 修正：新增 `buildSharedAssetSalePromptMutation()` 與 `completeSharedAssetSaleAction()`；C027/C028 及同類共享資產出售，依 transaction 讀到的最新私人玩家資料重新計算售價、清償關聯貸款、移除資產、增加現金與歷史，並和玩家共享回覆放在同一筆 `runRoomBoardMutation()` transaction。
- 使用 `shared-asset-sale:{promptId}:{uid}` command ID 及既有 processed command ledger，重整、連點或重送不會重複入帳；prompt 只在所有目標玩家完成後結束。
- 沒有新增集合、服務、依賴或改動其他共享卡片的 UI；同一原子路徑涵蓋共享資產出售卡片，避免只修 C027。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/context/RoomContext.tsx`、`src/context/RoomContext.test.ts`、`src/test/roomPermissions.test.ts`、`src/views/game/GameView.tsx`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：完整 Vitest 240 passed；Firestore Emulator／Rules 25 passed；TypeScript、production build、`git diff --check` 通過
- 目前風險：尚未以三個真實瀏覽器同時完成 C027/C028 共享出售及重新整理回歸；正式環境尚未部署
- 下一個最安全任務：本地建立 3 位玩家房間，讓至少 2 位玩家出售兼職工作室並分別重整，確認兩份財務報表都更新且最後一位完成後才結束 prompt

## 2026-09-05 升等骰與結束回合阻斷：修正

- 遠端升等骰回傳後統一解除玩家端擲骰鎖，大螢幕顯示通過時玩家端不再停在「擲骰中」。
- 結束回合改由最新 Firestore 棋盤狀態直接交易驗證與切換，不再因本機共用鎖忙碌而靜默遺失，也會把真實失敗原因交回玩家畫面。
- 同一修正涵蓋一般回合及「天有不測風雲」保險理賠完成後的結束回合。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/hooks/useDiceRollLogic.ts`、`src/hooks/useDiceRollLogic.test.tsx`、`src/utils/experienceState.ts`、`src/utils/experienceState.test.ts`、`src/context/RoomContext.tsx`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：完整 Vitest／Firestore Emulator 243 passed；TypeScript、production build、`git diff --check` 通過
- 目前風險：尚未用真實玩家端＋大螢幕完成升等考試與理賠後結束回合的雙裝置手動回歸；未 commit、push 或部署
- 下一個最安全任務：本地雙分頁測試升等通過後關閉，以及 C035–C037 理賠完成後立即結束回合

## 2026-09-05 版本 v3.3 與系統更新日誌

- 對外版本由 `v3.2` 更新為 `v3.3`。
- 執行師系統更新日誌新增共享兼職工作室入帳、升等骰結果解鎖、回合切換及理賠後結束回合修正。
- 日誌只列入已完成且通過自動化驗證的項目；未宣稱雙裝置手動回歸已完成。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`、`CODEX_HANDOFF.md`
- 測試結果：版本與相關流程測試 12 passed；TypeScript、production build、`git diff --check` 通過
- 目前風險：尚未部署，正式站仍為舊版本
- 下一個最安全任務：完成 typecheck、版本內容測試及 production build 後再部署

## 2026-09-05 v3.3 Vercel 正式部署

- 首次部署因根目錄 `firestore-debug.log` 約 150 MB，超過 Vercel 100 MB 上傳限制；已在 `.vercelignore` 排除本地 `*.log`，未刪除本機紀錄。
- Production deployment `dpl_5TmemaywFwhp9vJ6BrdxkiXFKztv` 狀態 Ready，正式 alias 為 `https://2ife.vercel.app`。
- 正式網址回應 HTTP 200，production JS 資產確認包含 `v3.3`；近一小時 production error logs 無紀錄。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`.vercelignore`、`CODEX_HANDOFF.md`
- 測試結果：部署前 TypeScript、相關測試 12 passed、production build 通過；部署後 HTTP 200、v3.3 資產確認通過
- 目前風險：尚未以正式測試帳號完成升等考試及理賠後結束回合的多人操作回歸
- 下一個最安全任務：在正式測試房以玩家端＋大螢幕完成升等與 C035–C037 理賠流程冒煙測試
## 2026-09-11 N056～N058 第一骰舊資料相容修正

- 修正舊場次只保留「兼職工作室＋企業貸款」、卻缺少 `pendingStartupUpgradeAction` 時，第一骰無法送到大螢幕的問題。
- 補狀態與骰點事件同一筆 Firestore transaction 完成，且必須有相同卡號的企業貸款才允許修復。
- 驗證：相關 Vitest 36 項通過、`npm run typecheck` 通過、`git diff --check` 通過。

## 2026-09-11 N057 升級骰動畫時序與銀行結案：修正

- N057～N058 第一骰、第二骰改為先將骰點事件寫入 Firestore，再由玩家端等待大螢幕完整 `3.6 秒` 骰子動畫後才揭示結果。
- 玩家端在遠端骰點期間顯示「骰點已送出／請看大螢幕」，不再提前顯示結果；等待只由彈窗控制一次，避免重複等待造成額外延遲。
- 保留升級成功結果直到玩家按下「太棒了！」；確認後才推進銀行事件佇列，避免第二骰成功後銀行事件仍未結案、無法結束回合。
- 驗證：BizUpgradeModal、骰子投影、RoomContext 相關測試 41 項通過；`npm run typecheck`、`npm run build`、`git diff --check` 通過。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/components/modals/BizUpgradeModal.tsx`、`src/components/modals/BizUpgradeModal.test.tsx`、`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx`、`CODEX_HANDOFF.md`
- 測試結果：相關測試 41 passed；TypeScript、production build、`git diff --check` 通過
- 目前風險：尚未以實際玩家端與大螢幕雙分頁手動驗證雲端網路延遲下的動畫起訖時間
- 下一個最安全任務：使用本地或測試房實測 N057 第一骰、第二骰及按「太棒了！」後能否立即結束銀行事件

## 2026-09-11 家庭歷程並發擲骰與回合結束延遲：修正

- 「結束回合」顯示與可用性改由 Firestore 權威的移動、棋盤事件及共享回覆狀態決定，不再被玩家端骰子展示計時器額外延遲；動畫期間按鈕會保持不可用，權威狀態完成後立即可按。
- 棋盤交易遇到可重試的版本衝突時，改為短退避並最多重試 6 次；家庭歷程多位玩家同時擲骰仍各自以同一個 prompt、revision 與 command ID 原子寫入，不改成依序操作。
- 驗證：完整 Vitest `248 passed / 25 skipped`；TypeScript、`git diff --check` 通過。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/game/board/runBoardMutation.ts`、`src/game/board/runBoardMutation.test.ts`、`src/utils/experienceState.ts`、`src/utils/experienceState.test.ts`、`src/components/game/GameActions.tsx`、`src/components/game/GameActions.test.tsx`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：完整 Vitest `248 passed / 25 skipped`；TypeScript、`git diff --check` 通過
- 目前風險：尚未以兩個真實玩家瀏覽器同時完成家庭歷程擲骰，也尚未在雲端延遲下確認回合結束按鈕的實際等待時間
- 下一個最安全任務：使用目前 5183 伺服器開兩個玩家分頁，實測家庭歷程同時擲骰、移動結算與結束回合

## 2026-09-11 學校考試骰動畫時序：修正

- 學校考試的 `rollSkillDice()` 現在回傳大螢幕骰子動畫時長；玩家端 `useDiceRollLogic` 在動畫完成前維持「擲骰中」，完成後才更新考試結果與呼叫原本的結算回呼。
- 與 N056～N058 升級骰共用同一個呈現時序，不新增延遲流程或改動考試規則。
- 驗證：升等骰、企業升級、骰子投影及 RoomContext 相關測試 `43 passed`；TypeScript、`git diff --check` 通過。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/hooks/useDiceRollLogic.ts`、`src/hooks/useDiceRollLogic.test.tsx`、`src/context/RoomContext.tsx`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：相關測試 `43 passed`；TypeScript、`git diff --check` 通過
- 目前風險：尚未以實際玩家端與大螢幕雙分頁確認網路延遲下的動畫起訖時間
- 下一個最安全任務：在目前 5183 伺服器實測學校考試，確認大螢幕動畫完成後玩家端才顯示結果

## 2026-09-11 大螢幕骰子滾動隨機感：修正

- 骰子滾動期間不再固定顯示最終點數；`DiceFace` 每 90ms 更新 1～6 的隨機暫時骰面，停止滾動後才恢復權威結果。
- 保留原本的 3D 外觀與動畫，並將滾動中的無障礙名稱改為「骰子滾動中」。
- 驗證：DiceFace、GameActions、升等骰相關測試 `12 passed`；TypeScript、`git diff --check` 通過。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/components/game/DiceFace.tsx`、`src/components/game/DiceFace.test.tsx`、`CODEX_HANDOFF.md`
- 測試結果：相關測試 `12 passed`；TypeScript、`git diff --check` 通過
- 目前風險：尚未在實際大螢幕瀏覽器確認不同螢幕更新率下的視覺效果
- 下一個最安全任務：用 5183 大螢幕實測一般擲骰、學校考試及家庭歷程骰面

## 2026-09-11 家庭重要歷程共享玩家略過同步：修正

- 根因：共享玩家是最後一位回覆者時，原流程在同一筆 transaction 同時新增「略過」回覆並刪除家庭歷程提示；Firestore Rules 以寫入前資料驗證結案，因此回覆與刪除同時發生會被拒絕。
- 修正：先以既有 `prompt:family:response` transaction 寫入玩家自己的回覆，再以最新房間狀態執行 `prompt:family:finalize` transaction；只有所有玩家回覆完成且抽卡玩家已完成時才結案。未放寬 Rules，不新增資料結構。
- 回覆已存在但提示尚未結案時仍會重新檢查結案，避免重整後只剩等待狀態。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/context/RoomContext.tsx`、`src/test/roomPermissions.test.ts`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：家庭回覆／RoomContext 相關測試 `97 passed`；完整 Vitest `250 passed / 26 skipped`；Firestore Rules Emulator `26 passed`；TypeScript、production build、`git diff --check` 通過
- 目前風險：尚未以兩位以上真實玩家瀏覽器驗證同時擲骰、最後玩家略過及雲端延遲下的完整家庭歷程
- 下一個最安全任務：先執行 Rules regression 與相關 Vitest，再用目前本地伺服器手動測試共享玩家按「略過」後可正常結案

## 2026-09-11 v3.9 Vercel 正式部署

- 對外版本由 `v3.8` 更新為 `v3.9`。
- 系統更新日誌新增家庭重要歷程共享玩家「略過」同步修正；回覆與結案分開以最新房間狀態處理。
- Production deployment `dpl_Bee83dtpuPwGzGKFpD9rTzQgTzx4` 狀態為 `Ready`，正式網址為 `https://2ife.vercel.app`。
- 正式網址驗證 HTTP 200；部署前 TypeScript、相關測試、production build、`git diff --check` 通過。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`、`CODEX_HANDOFF.md`
- 測試結果：RoomContext／Rules 相關驗證通過；Production `Ready`、HTTP 200
- 目前風險：尚未以多個正式測試帳號完成家庭歷程「略過」實機回歸
- 下一個最安全任務：在正式測試房驗證共享玩家按「略過」後不再出現同步失敗

## 2026-09-12 建立新房時清除結束房間殘留：修正

- 根因：`createRoom()` 原本只檢查前端 `room` 是否存在；遊戲結束後為了保留結算畫面，`finished` 房間仍會留在本機狀態，導致建立新房時誤顯示「請先關閉目前房間」。
- 修正：建立新房前重新讀取目前房間文件；仍為 `waiting`／`playing` 或非本帳號房主時維持阻擋，已 `finished` 或已不存在的舊房則清除本機房號、React 房間狀態及相同的 `activeGame` 恢復指標後繼續建立。
- 保留有效房間的斷線重連與暫時離開行為，不刪除仍在進行中的房間。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/context/RoomContext.tsx`、`CODEX_HANDOFF.md`
- 測試結果：`src/context/RoomContext.test.ts` 35 passed；TypeScript typecheck 通過；`git diff --check` 通過
- 目前風險：尚未用瀏覽器實際完成「結束上一局後立即建立下一局」的本地與雲端回歸
- 下一個最安全任務：在本地開一局並結算後，直接建立第二局；再以同一執行師帳號重整確認不會恢復已結束房間

## 2026-09-12 系統更新日誌與正式部署

- 在現有 `v3.9` 系統更新日誌補充結算後舊房間狀態清理修正，版本號維持不變。
- Production deployment `dpl_Ehm1CCvaELCB5wKy9G9dRPHRsxep` 狀態為 `READY`，正式網址為 `https://2ife.vercel.app`。
- 正式網址 HTTP 200；部署建置完成，保留既有 Vercel chunk size 與 Tailwind class 警告。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/views/lobby/CoachDashboard.tsx`、`CODEX_HANDOFF.md`
- 測試結果：完整 Vitest `250 passed / 26 skipped`；TypeScript、production build、`git diff --check` 通過；Production `READY`、HTTP 200
- 目前風險：尚未以瀏覽器實際完成結算後立即建立第二局的回歸測試
- 下一個最安全任務：用同一執行師帳號在正式或本地測試房完成一局後，直接建立下一局確認舊房間不再阻擋

## 2026-09-12 家庭歷程、卡片升級與房屋彈窗：修正

- 家庭歷程共享回覆在最後一位玩家完成後，保留至大螢幕骰子結果播放截止時間，避免最後一位尚未播完就提前結案；每位玩家的骰子展示計時器不再因 Firestore 快照更新被取消。
- C004 類終身學習成功結果改由同一筆房間 transaction 原子更新玩家職業、能力與收入；避免先顯示成功、收入稍後才入帳。
- N056～N058 升級待辦以 `assetId` 排隊並使用資產識別的 command ID；多間工作室會逐間顯示升級視窗，未成功者可繼續處理，不互相覆蓋。
- 房屋狀態轉換彈窗提高層級、支援視窗內垂直捲動並改善標籤對比，避免被大地圖或外層容器裁切。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/utils/boardCardActions.ts`、`src/components/board/DicePresentationOverlay.tsx`、`src/context/RoomContext.tsx`、`src/types.ts`、`src/views/game/GameView.tsx`、`src/components/modals/HouseConversionModal.tsx`、相關測試檔
- 測試結果：`npm run typecheck` 通過；完整 Vitest `251 passed / 26 skipped`；production build 通過；`git diff --check` 通過
- Rules 測試：未完成；本機 `8080` 已被另一個指向不同專案 Rules 的 Firestore Emulator 占用，未終止不明程序，也未將其結果當成本次驗證
- 目前風險：尚未以多個真實玩家與大螢幕瀏覽器完成家庭歷程最後玩家動畫、C004 收入即時顯示及多間 N056～N058 逐項升級的實機回歸
- 下一個最安全任務：停止或切換已確認來源的舊 Emulator 後重跑 Rules，再用 3～4 位玩家本地房實測家庭歷程並行擲骰與多間工作室升級

## 2026-09-12 家庭歷程滿階段參與：修正

- 家庭歷程共享提示建立時，依每位玩家自己的進度排除已完成五個階段或已有第二個孩子的玩家，避免不必要的擲骰與等待。
- 若舊房間仍保留已完成玩家的共享提示，玩家端改顯示「家庭歷程已完成」，只能按「關閉」並送出不參與回覆，不再提供骰子按鈕。
- 抽卡玩家本身已完成全部家庭歷程時，不再建立共享參與提示。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/utils/familyMilestones.ts`、`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx`、`src/context/RoomContext.test.ts`、`CODEX_HANDOFF.md`
- 測試結果：家庭歷程／RoomContext／共享提示測試 `100 passed`；完整 Vitest `253 passed / 26 skipped`；TypeScript、production build、`git diff --check` 通過
- 目前風險：尚未以 3～4 位玩家瀏覽器實測滿階段玩家關閉提示及未完成玩家並行擲骰；Rules 測試仍因其他 Emulator 占用 `8080` 未完成
- 下一個最安全任務：部署後用本地或正式測試房確認滿階段玩家只可關閉，且其他玩家仍能正常參與並完成家庭歷程

## 2026-09-12 家庭歷程滿階段參與 Vercel 正式部署

- Production deployment `dpl_95kj52mwhVuWxLW8bzX4KxkXURgE` 狀態為 `Ready`。
- 正式網址已更新至 `https://2ife.vercel.app`，HTTP `200`。
- 部署內容包含已完成家庭歷程滿階段玩家資格過濾與舊提示關閉處理。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`CODEX_HANDOFF.md`
- 部署結果：Production `Ready`；正式網址 HTTP `200`
- 目前風險：尚未以正式多玩家房實測滿階段玩家不可擲骰的完整流程；Rules 測試仍因本機 `8080` 被其他 Emulator 占用而未完成
- 下一個最安全任務：使用 3～4 位玩家驗證已完成五階段玩家只可關閉，其他未完成玩家仍可並行擲骰

## 2026-09-12 v4.0 系統更新日誌

- 對外版本由 `v3.9` 更新為 `v4.0`。
- CoachDashboard 更新 `v4.0` 系統更新日誌，記錄家庭歷程骰子結案時序、C004 收入即時入帳、多間 N056～N058 升級佇列，以及房屋狀態彈窗優化。
- 本次日誌只列出已完成的程式修正，不宣稱尚未完成實機回歸的項目已全面驗收。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`、`CODEX_HANDOFF.md`
- 測試結果：沿用本次修正已通過的 TypeScript、完整 Vitest `251 passed / 26 skipped`、production build 與 `git diff --check`
- 目前風險：Firestore Rules 測試仍因其他 Emulator 占用 `8080` 未完成；本次未重新進行瀏覽器實機回歸
- 下一個最安全任務：確認 Emulator 來源後重跑 Rules，並以實際多人房驗證 v4.0 四項流程

## 2026-09-12 v4.0 Vercel 正式部署

- Production deployment `dpl_mfcx95WaHZZrmekXm7ySjrfcoV1d` 狀態為 `Ready`。
- 正式網址已更新至 `https://2ife.vercel.app`，HTTP `200`。
- 部署內容包含 v4.0 版本號與系統更新日誌，以及本次家庭歷程、C004、N056～N058 與房屋彈窗修正。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`CODEX_HANDOFF.md`
- 部署結果：Production `Ready`；正式網址 HTTP `200`
- 目前風險：Firestore Rules 測試仍因本機 `8080` 被其他 Emulator 占用而未完成；尚未進行多玩家正式站實機回歸
- 下一個最安全任務：先完成 Rules 驗證，再以 3～4 位玩家實測 v4.0 的家庭歷程與多間工作室升級流程

## 2026-09-13 開局企業選擇誤跳：修正

- 開局選擇頁的職業、企業、夢想共用同一個輪播元件，切換步驟時原本會沿用上一頁的滾動與選取內部狀態；卡片也沒有明確的點選事件，手機點擊與吸附可能被判成下一張選項。
- 每個選擇步驟改用獨立元件 key，切換時重新初始化輪播；卡片點擊／鍵盤操作只更新選取並將卡片置中，只有底部確認按鈕可以前往下一步。
- 新增輪播回歸測試，確認點選企業卡不會呼叫下一步。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/components/common/SelectionCarousel.tsx`、`src/views/selection/SelectionView.tsx`、`src/components/common/SelectionCarousel.test.tsx`
- 測試結果：選擇輪播與玩家狀態測試 `3 passed`；TypeScript、production build、`git diff --check` 通過
- 目前風險：尚未用真實帳號在手機尺寸完成職業 → 企業 → 夢想的瀏覽器回歸；本次未部署
- 下一個最安全任務：在本地開新房，確認點擊企業卡只選取企業，按底部確認後才進入夢想頁

## 2026-09-13 升等職業流程修正

- 一般升等骰改由 Firestore transaction 以目前玩家私有資料作為權威，交易內同時寫入升等報名費、考試結果、職業等級、薪資與財務歷史。
- 報名費使用 `school-fee:{schoolEventId}` 冪等鍵；重整、連點或交易重試不會重複扣款，且會保留現金不足與過期事件的明確錯誤。
- 玩家端不再用本機升等結果覆蓋棋盤房間資料；職業資料未同步或已達最高等級時，升等按鈕會停用並顯示原因。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/context/RoomContext.tsx`、`src/context/RoomContext.test.ts`、`src/hooks/useGameLogic.ts`、`src/views/game/GameView.tsx`、`src/components/modals/PromotionModal.tsx`、`CODEX_HANDOFF.md`
- 測試結果：完整 Vitest `255 passed / 26 skipped`；TypeScript、production build、`git diff --check` 通過
- 目前風險：尚未以實際多玩家瀏覽器完成學校格升等的 Firestore 競態與斷線重連回歸；本次未 commit、push 或部署
- 下一個最安全任務：使用本地 Firestore 開一場多玩家房，分別驗證現金足夠、現金不足周轉、考試成功／失敗及重新整理後重試

## 2026-09-14 雙骰資格與銀行工作室升級流程修正

- 棋盤擲骰現在在 transaction 內強制讀取 `rooms/{roomId}/players/{uid}` 最新私有玩家資料，汽車／飛行器持有狀態不再取自可能過期的房間快照；有車時保留單骰／雙骰選擇，預設雙骰，無車固定單骰。
- 玩家端骰子資格與 N056～N058 工作室清單改優先使用最新私有玩家狀態，避免遊戲進行一段時間後畫面退回單骰或銀行升級入口消失。
- 銀行事件結案與移動收尾同樣強制使用私有玩家資料；待升級工作室若保存失效的舊資產 ID，改依卡片代號找回同一筆未升級工作室，避免經過銀行時升級流程卡住。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx`、`src/context/RoomContext.test.ts`、`CODEX_HANDOFF.md`
- 測試結果：完整 Vitest `257 passed / 26 skipped`；TypeScript、production build、`git diff --check` 通過
- 目前風險：尚未以 3 位玩家與大螢幕瀏覽器完成長局雙骰及 N056～N058 銀行升級實機回歸；本次未 commit、push 或部署
- 下一個最安全任務：使用本地 Firestore 實測有車玩家後段回合仍可選雙骰，並逐一驗證 N056、N057、N058 經過銀行的第一骰、第二骰、升級成功與失敗重試

## 2026-09-14 v4.1 Vercel 正式部署

- 對外版本由 `v4.0` 更新為 `v4.1`。
- CoachDashboard 新增 `v4.1` 系統更新日誌，記錄後段雙骰資格、N056～N058 銀行升級，以及移動結算私有資料同步修正。
- Production deployment `dpl_3JmbadSzdhkunuBkuCtmmssWuSSn` 狀態為 `Ready`，正式網址為 `https://2ife.vercel.app`，HTTP `200`。
- 線上 bundle 已確認包含 `v4.1`；本次部署使用目前已連結的 Vercel 專案 `2ife`。
- 驗證：`npm run typecheck` 通過；完整 Vitest `257 passed / 26 skipped`；`npm run build` 通過；`git diff --check` 通過。
- Build 保留既有 Tailwind ambiguous class、dynamic import 與 chunk size 警告；未因警告阻擋部署。
- 本次未 commit、push；保留 dev 工作樹所有既有未提交修改。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`、`CODEX_HANDOFF.md`
- 目前風險：尚未以 3 位玩家與大螢幕瀏覽器完成長局雙骰及 N056～N058 銀行升級實機回歸；本次只完成自動化檢查與正式部署驗證
- 下一個最安全任務：使用實際測試房驗證 v4.1 後段雙骰與三張工作室升級流程

## 2026-09-14 v4.1 系統更新日誌

- 對外版本由 `v4.0` 更新為 `v4.1`。
- CoachDashboard 新增 `v4.1` 系統更新日誌，記錄後段雙骰資格、N056～N058 銀行升級，以及移動結算私有資料同步修正。
- 本次日誌只列出已完成的程式修正，不宣稱尚未完成實機多人回歸的項目已全面驗收。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`、`CODEX_HANDOFF.md`
- 測試結果：待本次版本修改後重新執行
- 目前風險：尚未以 3 位玩家與大螢幕瀏覽器完成長局雙骰及 N056～N058 銀行升級實機回歸
- 下一個最安全任務：完成版本驗證後，再以本地或正式測試房實測後段雙骰與三張工作室升級流程

## 2026-09-14 註冊表單與升等考試關閉流程修正

- 註冊表單統一暱稱上限與計數器為 8 字，Email 僅在註冊時使用原生格式檢查，密碼改為遮蔽輸入並要求至少 6 碼。
- 保留登入端的 GM0221 帳號別名相容性；註冊頁新增可選邀請碼欄位，URL `ref` 邀請連結仍會自動帶入。
- 升等考試關閉按鈕現在會透過既有 `advanceBoardEventQueue('school')` 結案；只有 Firestore 寫入成功才標記事件已處理，失敗時保留視窗並提示重試。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/views/auth/AuthView.tsx`、`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx`、`CODEX_HANDOFF.md`、`DEBUG_HANDOFF.md`
- 測試結果：`npm run typecheck` 通過；相關 Vitest `49 passed`；`npm run build` 通過；`git diff --check` 通過
- 目前風險：尚未以多個實際帳號瀏覽器回歸註冊邀請碼與學校升等關閉／重連流程；工作樹仍保留既有未提交修改
- 下一個最安全任務：使用本地測試房驗證註冊欄位、GM0221 登入別名、學校事件關閉後可結束回合，以及 Firestore 寫入失敗時可重試

## 2026-09-14 v4.2 Vercel 正式部署

- 對外版本由 `v4.1` 更新為 `v4.2`。
- CoachDashboard 新增 v4.2 系統更新日誌，記錄註冊欄位／邀請碼與升等考試關閉結案修正。
- Production deployment `dpl_7hyCD8No8Pcw4SnXx5PHFNREWvsu` 狀態為 `Ready`，正式網址為 `https://2ife.vercel.app`，HTTP `200`。
- 正式資產已確認包含 `v4.2`；本次部署使用目前已連結的 Vercel 專案 `2ife`。
- 驗證：完整 Vitest `257 passed / 26 skipped`；TypeScript、production build、`git diff --check` 通過。
- Build 保留既有 Tailwind ambiguous class、dynamic import 與 chunk size 警告；未因警告阻擋部署。
- 本次未 commit、push；保留 dev 工作樹所有既有未提交修改。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`、`CODEX_HANDOFF.md`
- 目前風險：註冊邀請碼與學校升等關閉流程尚未以多帳號瀏覽器完成實機回歸
- 下一個最安全任務：在本地測試房驗證 v4.2 註冊與升等流程，再進行多玩家正式站冒煙測試

## 2026-09-15 職業選取中央定位修正

- 修正職業選取輪播使用固定卡片寬度推算中央位置，導致手機實際卡片寬度不同時選到鄰近職業的問題。
- 改用實際 DOM 卡片中心判定目前選項，初始化依既有選取職業置中；點擊卡片立即置中，避免平滑滾動期間選取狀態反覆跳動。
- 新增窄版輪播中央選取回歸測試。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/components/common/SelectionCarousel.tsx`、`src/components/common/SelectionCarousel.test.tsx`、`CODEX_HANDOFF.md`、`DEBUG_HANDOFF.md`
- 測試結果：輪播測試 `2 passed`；TypeScript、`git diff --check` 通過
- 目前風險：尚未在實際手機瀏覽器完成職業 → 企業 → 夢想完整操作回歸
- 下一個最安全任務：使用 320px 與 390px 手機尺寸確認中央職業、滑動循環及確認按鈕選取結果一致

## 2026-09-16 終身學習財務檢核偶發錯誤頁修正

- 修正舊版／不完整 `localStorage` 玩家狀態在終身學習財務結算時缺少 `history`、`happiness`、`assets` 等陣列，可能造成 React ErrorBoundary 顯示通用錯誤頁的風險。
- 新增並重用 `normalizeGameState()`，套用於本機存檔還原、玩家權威快照合併、財務結算 updater 及終身學習效果處理。
- 財務檢核 modal 接住 `onApply` 的非同步例外，保留視窗並顯示可重試訊息。
- 驗證：完整 Vitest `260 passed / 26 skipped`；TypeScript、production build、`git diff --check` 通過。
- 限制：正式環境沒有保留當次 React stack，無法宣稱已取得該次實機例外的百分之百對應；尚未進行正式站多人實機回歸。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/context/GameContext.tsx`、`src/context/GameContext.test.ts`、`src/hooks/useGameLogic.ts`、`src/components/game/BoardFinancialCheckModal.tsx`、`src/components/game/BoardFinancialCheckModal.test.ts`、`CODEX_HANDOFF.md`、`DEBUG_HANDOFF.md`
- 目前風險：若正式站仍重現，需保留瀏覽器 console 第一個錯誤與 ErrorBoundary stack；尚未完成多人瀏覽器實機回歸
- 下一個最安全任務：以終身學習卡重現財務檢核成功、斷線／重整及交易失敗重試流程，確認畫面不再整頁崩潰

## 2026-09-16 保險交易誤入周轉流程修正

- 房屋／汽車保險維持 `cashChange: 0`、增加每月支出，改回正常財務檢核流程。
- 現金不足周轉分支只接受 `usage: cash` 且實際增加現金的收入／借款交易。
- 周轉資產出售流程取消時僅在強制出售 preset 下處理，避免一般銀行交易誤顯示「周轉完成」。
- 驗證：GameView、WealthView、BoardFinancialCheckModal 共 14 項測試通過；TypeScript、production build、`git diff --check` 通過。
- 限制：尚未完成多帳號瀏覽器實機回歸。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次直接修改：`src/views/game/GameView.tsx`、`src/views/game/GameView.test.ts`、`CODEX_HANDOFF.md`
- 目前風險：正式環境仍需確認房屋／汽車保險的財務檢核與月支出入帳。
- 下一個最安全任務：在本地測試房實際點擊兩種保險，確認不進周轉、可完成檢核且只增加月支出。

## 2026-09-16 C036／C004 卡片崩潰與重整恢復修正

- C004 終身學習成功結算改為容忍舊玩家文件缺少 `assets`、`abilities`、`history`，避免第一次結算進入 ErrorBoundary、重整後才成功。
- C036 等卡片在現金不足並使用強制負債／信貸周轉時，不再讀取未正規化的 `prev.history`。
- 斷線重連載入雲端玩家資料前統一正規化；Firestore cache 暫時找不到房間時不再清除 `active_room`，只有 server 確認房間不存在才回大廳。
- 新增 C004 舊快照回歸測試；TypeScript、完整 Vitest `263 passed / 26 skipped`、production build 通過。
- 尚未部署，且尚未用正式雲端多人房間重播 C036／C004。

## 2026-09-17 目標企業、多工作室與汽車雙骰一致性修正

- 目標企業購買改由 Firestore 權威 transaction 原子寫入，避免收益存在但企業資產遺失；收益只計入企業資產一次，舊版重複收益也會在報表去重。
- N056～N058 待升級清單會依未升級工作室與企業貸款補回完整佇列，第二間以自己的 `assetId` 擲骰與升級，不再受第一筆 pending 限制。
- 汽車骰子按鈕的 `x2` 改為固定雙骰，不再提供會造成顯示與實際骰數不一致的切換操作。
- 新增目標企業單次收益、多工作室第二筆及購車後立即雙骰的回歸測試。
- 舊帳號若曾只留下目標企業收益、遺失企業資產，載入時會在精確條件下補回企業資產並移除重複 income，不需再次扣款。
- 驗證：TypeScript、完整 Vitest `269 passed / 27 skipped`、production build、`git diff --check` 通過。
- 本次未部署；尚未完成三帳號＋執行師的瀏覽器實機回歸。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次核心修改：`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx`、`src/hooks/useGameLogic.ts`、`src/utils/gameUtils.ts`、`src/components/game/GameActions.tsx` 及相關測試
- 目前風險：需用既有舊資料帳號確認舊版重複收益顯示已去重，並實測兩間工作室連續升級視窗
- 下一個最安全任務：本地三玩家房依序購買目標企業、連續升級兩間工作室、購車後擲骰，核對 Firestore 私有玩家文件與畫面一致
## 2026-09-17 家庭歷程最後一骰動畫完整播放

- 修正家庭歷程最後一位玩家送出骰點後，系統以 1.2 秒結果揭示時間提早結案，導致大螢幕 3.6 秒骰子動畫被中途關閉。
- 家庭歷程回覆、玩家結果顯示與 Firestore 結案現在共用完整動畫截止時間；動畫結束後才允許移除共享 prompt。
- 沒有新增投影端快照或額外固定延遲，避免舊事件殘留。
- 驗證：家庭歷程與共享 prompt 針對性測試 `67 passed`；完整 Vitest `269 passed / 27 skipped`；TypeScript 通過。
- 本次未部署；尚未完成多帳號大螢幕實機回歸。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次核心修改：`src/game/board/dicePresentation.ts`、`src/game/board/dicePresentation.test.ts`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 目前風險：尚未以 3～4 位玩家同時擲骰，確認最後一顆骰子在大螢幕完整播完後才關閉
- 下一個最安全任務：本地 3 位玩家家庭歷程測試，讓最後一位玩家擲骰失敗與成功各一次，觀察共享視窗結案時間
## 2026-09-17 家庭歷程同步骰子改為底部橫排

- 大螢幕家庭歷程同步骰子移除全畫面遮罩與中央大型面板，改成固定於畫面底部的單排資訊列。
- 2～6 位玩家共用同一橫排；每格顯示玩家名稱、身分、回覆狀態及小型骰子，後方家庭歷程卡片保持可讀。
- 移除不再使用的家庭骰子網格欄數 helper 與舊版面測試。
- 驗證：TypeScript、骰子呈現測試 `3 passed`、production build、`git diff --check` 通過；build 僅保留既有 Tailwind 與 bundle size 警告。
- 本次未部署；尚未用 6 位玩家實際投影畫面確認最長姓名的截斷效果。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次核心修改：`src/components/board/DicePresentationOverlay.tsx`、`src/game/board/dicePresentation.ts`、`src/game/board/dicePresentation.test.ts`、`CODEX_HANDOFF.md`
- 目前風險：需在 1366×768 大螢幕以 6 位玩家確認單排內容可讀性
- 下一個最安全任務：建立 6 人家庭歷程共享事件，確認卡片不被遮擋且所有玩家骰點狀態維持一排
## 2026-09-17 重開房間後審核請求監聽權限錯誤

- 房間畫面已成功顯示新房間與成員，但 `pendingRequests` 子集合監聽可能在 cache／舊房間快照尚未切換完成時啟動，造成玩家看到 `permission-denied`。
- 修正 `RoomContext`：審核 query 只在房間 listener 進入 `synced`，且目前帳號已是房主、教練／GM 或房間成員後建立；切換房間時不再用未確認的快照啟動監聽。
- 已確認目前本地 `.env.local` 設定 `VITE_USE_EMULATOR=false`，因此 localhost:5173 實際連線到 `happinessflow-online` 雲端 Firestore。
- 型別檢查、房間同步／Rules 相關測試與完整 build 通過；完整 Vitest `268 passed / 27 skipped`。
- 嘗試部署雲端 Rules 時被安全審核拒絕，尚未更動雲端規則；若雲端 Rules 尚未包含目前 `pendingRequests` 子集合規則，仍需明確授權後單獨部署 Rules。

### 雲端部署結果

- 已獲使用者明確同意，將 `firestore.rules` 單獨部署至 `happinessflow-online`。
- Firebase 回報規則編譯成功並已 release；未部署前端、未修改遊戲資料。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次核心修改：`src/context/RoomContext.tsx`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：TypeScript、房間測試 `44 passed / 27 skipped`、完整 Vitest `268 passed / 27 skipped`、production build、`git diff --check` 通過
- 目前風險：尚未用重開房間的實際玩家帳號完成瀏覽器回歸；Rules 編譯時仍有既有未使用函式警告
- 下一個最安全任務：重開新房間並觀察玩家端是否不再顯示審核請求同步權限不足

## 2026-09-17 C037 醫療卡財務檢核崩潰修正

- 新增 `src/utils/gameState.ts`，集中 `createDefaultGameState()` 與 `normalizeGameState()`；`GameContext` 改為重用並對外保留原匯出。
- 新增 `src/utils/boardMedical.ts` 與測試；C035～C037 使用權威玩家資料及 `boardEventId`／command ID 原子處理醫療費、待理賠事件、歷史與重複送出。
- `RoomContext` 新增 `completeMedicalBoardCardAction()`；`GameView` 不再以本機醫療卡狀態先寫入，交易成功後才執行醫院移動與暫停回合。
- 驗證：完整 Vitest `272 passed / 27 skipped`、TypeScript、production build、`git diff --check` 通過；本次未部署。

## 2026-09-17 連線與 Firestore 優化第一階段

- `runRoomBoardMutation()` 追加既有 Analytics 的交易／文件量測，並在衝突重試加入小幅 jitter。
- 房間 listener 追加 snapshot 大小、cache／pending 狀態與同步延遲量測；GameContext 遠端快照無本機差異時不再觸發無效同步 transaction。
- RTDB 分頁控制權改為每分頁獨立 claim，關閉或斷線會由 `onDisconnect` 清除，避免舊分頁持有 stale controller。
- `VITE_FIRESTORE_TRANSPORT` 可選 `auto` 或 `default` 供實機 A/B；未設定時維持原本 `auto` 行為。
- 驗證：`npm run typecheck` 通過；核心 Vitest `61 passed`；Firestore Rules `27 passed`（使用目前已執行的 Emulator）；`npm run build` 通過；`git diff --check` 通過。

### 未完成與風險

- 本輪尚未把骰子短暫展示移至 RTDB，也未啟用多人事件 response 子集合 schema v2。
- 既有 `GameContext` 財務同步仍有相容性路徑，尚未宣稱已完成所有財務命令的單一 transaction 遷移。
- 尚未完成 3／6 玩家瀏覽器壓力測試、transport A/B 實機量測與 120 分鐘正式站驗收；因此本輪不部署、不 commit、不宣稱延遲門檻已達標。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次核心修改：`src/utils/gameState.ts`、`src/utils/boardMedical.ts`、`src/context/GameContext.tsx`、`src/context/RoomContext.tsx`、`src/views/game/GameView.tsx` 及相關測試
- 目前風險：尚未以正式雲端三人房重播 C035～C037 的有／無保險、連點與同步競態
- 下一個最安全任務：本地先重播 C037 有保險與無保險，再以正式測試帳號確認交易只入帳一次且完成後才移動

## 2026-09-18 多人共享回覆安全切片

- 新建立的棋盤房使用 `syncSchemaVersion: 2`；非財務共享回覆各自寫入 `events/{promptId}/responses/{uid}`，玩家只能建立自己的 `declined`／`no_effect` 文件。
- 執行師監聽完整 response 集合，回覆到齊後以既有 transaction、revision 與 command ID 一次結案；同一 prompt 的房間快照合併會保留已收到的 response。
- Rules Emulator `28 passed`；完整 Vitest `282 passed / 28 skipped`；TypeScript、production build、`git diff --check` 通過。
- 3 人壓力回歸到第 23 回合，N027 共享回覆已通過且未再出現先前 403；第 24 回合因測試腳本未處理實際銀行事件停止，50 回合與正式站驗收仍未完成。

【交接狀態】
- 本次核心修改：`src/context/RoomContext.tsx`、`src/types.ts`、`firestore.rules` 及相關測試
- 目前風險：schema v2 僅切入非財務共享回覆；財務共享回覆仍待完整遷移，壓力測試需先補特殊格流程分支
- 下一步：修正測試腳本的銀行／特殊格處理，再完成 50 回合並進入 6 人競態驗證

## 2026-09-18 開局同步競態修正與 50 回合壓力測試

- 確認前次壓力測試的 Firestore `FAILED_PRECONDITION` 根因：玩家選擇畫面的本機草稿仍透過舊同步橋接寫入私人玩家文件，與執行師開始新局時刪除／重建玩家文件同時發生，造成版本衝突；不是玩家文件不存在。
- `GameContext` 現在只在 `isSetup` 完成後同步正式玩家資料；職業、企業與夢想選擇期間保留在本機草稿，最後由既有 `completePlayerSetup()` 原子提交，避免跨場／跨流程回寫。
- 修正壓力測試的結算驗收定位：玩家端實際以 `遊戲結算` region 呈現，內部標題為 `遊戲評分`；只調整測試定位，沒有更改玩家產品畫面。
- 以隔離 Firebase Emulator 完成 3 位玩家＋1 位執行師的 50／50 正式回合，分布為 Player1 17、Player2 17、Player3 16；最終房間 `finished`、revision 250，錯誤 0。
- 壓力測試摘要：單回合最長 9,521 ms、回合切換同步最長 462 ms；完整測試期間未再出現 Firestore 400、同步失敗或瀏覽器錯誤。報告：`e2e/report/board-50-turn-stress.json`。
- 驗證：針對性 Vitest `70 passed`、完整 Vitest `282 passed / 28 skipped`、TypeScript、production build、`git diff --check` 通過。Build 僅保留既有 Tailwind 類名與 bundle size 警告。

### 連線優化計畫狀態

- 階段 0：程式 telemetry 已具備；不同手機／網路的實機 p50／p95 仍未取得。
- 階段 1：已修正本機選擇草稿與正式玩家資料的競態；所有財務呼叫端尚未完成單一 transaction 盤點與遷移。
- 階段 2：分頁 claim 已完成；骰子短暫展示仍使用 Firestore，尚未切換 RTDB。
- 階段 3：v2 response 子集合目前只涵蓋非財務共享回覆，財務回覆尚未完整遷移。
- 階段 4：Context／GM 分頁化尚未全面執行。
- 階段 5：transport A/B、6 人壓力測試及 120 分鐘正式站驗收尚未執行。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次核心修改：`src/context/GameContext.tsx`、`e2e/board-50-turn-stress.spec.ts`、`CODEX_HANDOFF.md`、`DEBUG_HANDOFF.md`
- 本次未 commit、未 push、未部署；50 回合測試使用 Emulator，不代表正式雲端驗收已完成
- 下一個最安全任務：先以 3 位玩家回歸測試實際家庭歷程／財務共享競態，再決定是否擴大到 6 人與正式站

## 2026-09-18 六位玩家壓力驗收與交易重試收斂

- `RoomContext` 的共享 response 結案、舊玩家資料搬移、turnOrder 補救及 v2 非財務回覆交易改用既有 `runBoardTransactionWithRetry()`；沒有新增服務或狀態系統。
- 6 位玩家＋1 位執行師＋大地圖在隔離 Emulator 完成 50／50 正式回合，分布 9／9／8／8／8／8；最終房間 `finished`、revision 249。
- 驗收腳本將 Firestore SDK 可處理的 `FAILED_PRECONDITION` 版本衝突獨立記錄為 retryable，不掩蓋其他 4xx、頁面錯誤或未處理例外；本次真正錯誤 0、可重試衝突 1 次，測試通過。
- 報告：`e2e/report/board-6p-50-turn-stress.json`；完整測試證據仍保留在 `test-results/`。

### 連線優化計畫目前狀態

- 階段 0：程式 telemetry 與本地 3／6 人基準已具備；不同手機／網路的實機 p50／p95 尚未取得。
- 階段 1：已完成開局草稿競態切斷、玩家私有同步拆分及交易重試補齊；所有財務命令的完整盤點仍未完成。
- 階段 2：分頁 claim 已完成；骰子短暫展示仍使用 Firestore，尚未切換 RTDB。
- 階段 3：v2 response 子集合已涵蓋非財務共享回覆；財務共享回覆尚未完整遷移。
- 階段 4：Context／GM 分頁化尚未全面執行。
- 階段 5：transport A/B、120 分鐘正式站驗收仍未完成。

【交接狀態】
- 本次未 commit、未 push、未部署；只完成 dev 工作樹的本地修正與驗收。
- 下一個安全步驟：先補 3／6 人家庭歷程與財務共享的瀏覽器競態劇本，再評估正式雲端冒煙；不要把本次安全卡片 50 回合結果當成完整卡庫通過。

## 2026-09-17 連線優化續驗

- `GameContext` 新增並使用純函式 `getSafePlayerStatePatch()`；延遲的本機快照若與最新 Firestore 權威欄位衝突，會被排除，不再覆蓋現金、資產等結果。
- 新增回歸測試覆蓋「權威現金更新後，舊本機現金不得寫回；其他未衝突欄位仍可同步」。
- 驗證通過：`npm run typecheck`、完整 Vitest `273 passed / 27 skipped`、Firestore Rules 直接測試 `27 passed`、`npm run build`（auto）、`VITE_FIRESTORE_TRANSPORT=default npm run build`、`git diff --check`。
- 階段 0／5 已具備可重現的程式量測與 transport build 切換；尚未取得不同手機／網路的實機 p50／p95，因此不宣稱完成 transport A/B。

### 仍待授權或實機條件

- 尚未將骰子展示移至 RTDB：目前缺少可供 RTDB Rules 驗證房間成員的安全權威；直接開放 `roomPresentation` 會讓已登入帳號偽造或讀取其他房間動畫。
- 尚未啟用多人 response 子集合 schema v2、完成所有財務呼叫端遷移，或執行 3／6 人瀏覽器壓力及 120 分鐘正式站驗收。
- 若要繼續 RTDB 通道，需先決定提供安全成員授權（例如受控 custom claims／後端寫入）或維持目前 Firestore 正式骰點展示通道。

## 2026-09-17 3 人＋執行師 50 回合壓力測試續驗

- 使用隔離 Firebase Emulator（Firestore 8092、Auth 9112、RTDB 9012、UI 4012）與 Vite 5183，完成開房、執行師及 3 位玩家登入／初始選擇。
- 實際完成 15 次正式回合，於第 16 回合停止；因此 50 回合、第二局初始化、6 人壓力及正式站冒煙均未完成。
- 本次未重現前次第 16 回合前的 Rules 403；trace 主要記錄 Firestore commit 的 `FAILED_PRECONDITION` 交易競態，代表共享房間文件仍是高競爭熱點，既有重試有時可恢復但仍造成延遲。
- 失敗時 Admin 讀到房間的 `currentEvent`、`movement`、`pendingEvents` 已清除，但玩家畫面仍保留卡片事件且「結束回合」 disabled；目前只能確認存在權威快照與玩家 UI 不一致，尚未把具體 stale UI 觸發路徑視為已修正。
- 報告：`e2e/report/board-50-turn-stress.json`（`failed`、15 turns）；證據：`test-results/board-50-turn-stress-3-位玩家＋1-位執行師完成-50-回合壓力測試-chromium/trace.zip` 及失敗截圖。
- 完整 Vitest `274 passed / 27 skipped`、TypeScript、`git diff --check` 通過；本次未部署、未 commit。

### 連線優化計畫目前狀態

- 階段 0：程式 telemetry 與 transport build 已具備；尚缺不同手機／網路的實測 p50／p95。
- 階段 1：已降低舊快照回寫與自動結算競爭；尚未完成所有財務呼叫端的單一 transaction 遷移。
- 階段 2：RTDB 骰子展示與分頁 claim 已評估／部分完成；骰子正式展示仍使用 Firestore，因 RTDB Rules 尚無安全房間成員權威。
- 階段 3：多人 response schema v2 尚未啟用。
- 階段 4：Context／GM 分頁化尚未全面執行。
- 階段 5：transport A/B 與 120 分鐘正式站驗收尚未執行。

## 2026-09-18 交易重試與 v2 共享回覆續修

- `RoomContext` 剩餘的啟動升級狀態、執行師財務調整、財務加速器、全體補助、幸福分享核准與斷線跳回合 transaction，統一改走既有 `runBoardTransactionWithRetry()`。
- schema v2 的共享回覆在 `runRoomBoardMutation()` 內讀取 `events/{promptId}/responses/{uid}`，財務完成回覆也與玩家私有資料及房間 revision 同一筆 transaction 寫入；房間內的 legacy response Map 不再因每位玩家回覆而競爭更新。
- Rules 允許目標玩家建立 `completed` response；執行師僅能在離線恢復路徑建立 `declined` response，玩家仍不可代寫其他 UID。
- 驗證：完整 Vitest `283 passed / 29 skipped`、Firestore Rules `29 passed`（隔離 8098 Emulator、載入工作樹 Rules）、TypeScript、production build、`git diff --check` 通過。

### 尚未完成與限制

- 本次只完成交易重試與共享回覆儲存切片；共享財務效果仍有既有 `GameContext` 本機表單→立即同步相容路徑，尚未全面抽成所有財務命令的純 transaction。
- 骰子短暫展示仍在 Firestore；未執行不同手機／網路 transport A/B、120 分鐘正式雲端驗收，也未部署或 commit。

## 2026-09-18 共享回覆結案邊界補強

- `runRoomBoardMutation()` 對 schema v2 回覆以 UID 去重，避免同一筆回覆同時由 mutation metadata 與 prompt 差異偵測重複寫入。
- 最後一位玩家完成且 prompt 立即移除時，仍會把最後一筆回覆寫入 `events/{promptId}/responses/{uid}`；新增單元測試鎖定此路徑。
- 驗證：`runBoardMutation.test.ts` 15 passed、完整 Vitest 284 passed／29 skipped、Rules 29 passed（隔離 8098 Emulator）、TypeScript、production build、`git diff --check` 通過。

### 尚未完成與限制

- 仍未將骰子短暫展示移至 RTDB，因尚缺可由 Rules 驗證的房間成員授權來源。
- 仍未完成所有財務命令的純 transaction 遷移、不同手機／網路 transport A/B、6 人 120 分鐘正式雲端驗收與 production 部署。

## 2026-09-18 家庭歷程回覆子集合續修

- schema v2 家庭歷程 prompt 現在同樣使用 `events/{promptId}/responses/{uid}`；玩家擲骰、接受／略過與完成階段的回覆，會和該玩家私有資料在同一個 board transaction 內處理。
- 房間快照會合併家庭歷程 child responses；執行師讀完整集合、玩家只讀自己的回覆，完成後依展示截止時間冪等結案。
- Firestore Rules 新增家庭歷程 response 欄位與 `passed`／`failed`／`declined` 驗證，玩家只能建立自己的 response。
- 驗證：完整 Vitest `284 passed／30 skipped`、Rules `30 passed`（隔離 8098 Emulator）、TypeScript、production build、`git diff --check` 通過。

### 尚未完成與限制

- 尚未將骰子展示移至 RTDB；仍需安全的房間成員授權來源。
- 所有非共享財務命令的純 transaction 遷移、transport A/B、正式雲端長時間驗收與 production 部署仍未完成。

## 2026-09-18 直接幸福卡財務命令切片

### 修正

- 新增 `buildDirectHappinessCardState()` 純狀態轉換，將直接幸福卡的現金、月支出、幸福歷程、幸福點與交易歷史一次套用。
- 棋盤直接幸福卡改由 `completeDirectHappinessCard()` 走既有 `runRoomBoardMutation()`；Firestore 私人玩家狀態與房間事件推進由同一筆交易處理。
- 以 `happiness-card:{sessionId}:{eventId}:{uid}:{cardId}` 作為 command ID；重整或重送不重複扣款、增加支出或幸福點。
- 交易失敗時保留卡片畫面，不先關閉 UI；只有 transaction 成功或已確認 duplicate 才關閉。
- 新增直接幸福卡的現金／支出／幸福／歷史及重送冪等測試，並建立財務命令盤點：`docs/testing/FINANCIAL_COMMAND_INVENTORY_2026-09-18.md`。

### 驗證

- `npm run typecheck` 通過。
- 完整 Vitest：`286 passed / 30 skipped`。
- Firestore Rules：`30 passed`，使用隔離 18080 Emulator，避免干擾目前 8080 本地 Emulator。
- `npm run build` 通過；保留既有 Tailwind arbitrary duration、動態／靜態 import 與大型 chunk 警告。
- `git diff --check` 通過。

### 尚未完成與限制

- 目前只完成直接幸福卡切片；一般銀行、股票、定存、保險、貸款等 legacy `GameContext` 表單回寫仍未全面遷移到同一 transaction。
- RTDB 骰子展示仍未切換；因尚缺安全的房間成員授權來源，不以放寬 RTDB Rules 取代設計。
- 不同手機／網路 transport A/B、正式雲端長時間壓力測試與 production 部署仍未執行。

## 2026-09-18 保險、定存與股票交易命令切片

### 修正

- 新增 `completeInsurancePurchase()`：棋盤房間的醫療、房屋及汽車保險購買，依最新私人玩家資料在 transaction 內更新保險狀態與歷史；不扣除購買當下現金。
- 新增 `completeDepositPurchase()`：辦理定存時在 transaction 內驗證現金、扣款、建立定存資產、寫入 1% 月收益與交易歷史；現金不足不提交。
- 新增 `completeStockTrade()`：股票買入／賣出在 transaction 內依最新持股驗證，並支援同張數的新交易再次送出；同一 command 重送仍冪等。
- `BrokerView` 為每次股票送出建立獨立 `commandId`，避免可重複交易按鈕被錯誤去重。
- 本地／相容模式仍保留原有 `useGameLogic()` 路徑；本批次只切換棋盤房間，降低一次性遷移風險。

### 驗證

- 相關測試：`62 passed`（RoomContext、GameView、BrokerView）。
- 完整 Vitest：`292 passed / 30 skipped`。
- Firestore Rules：`30 passed`，隔離 18080 Emulator。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。
- Build 仍有既有 Tailwind arbitrary duration、動態／靜態 import 與大型 chunk 警告，未因本批次新增。

### 尚未完成與限制

- 貸款、還款、定存解約、一般資產買賣、部分醫院／維修／卡片財務流程仍走 legacy 本機狀態相容路徑。
- RTDB 骰子展示仍未切換；不同手機／網路 transport A/B、正式雲端長時間壓力測試與 production 部署仍未執行。

## 2026-09-18 銀行複合交易續修

### 修正

- 新增 `buildLoanBorrowState()`、`buildLoanRepaymentState()`、`buildDepositWithdrawalState()` 與 `buildCarPurchaseState()`，都以最新私人玩家資料產生結果。
- 棋盤房間的信貸借款、負債還款、定存解約與汽車購買改由 `RoomContext` transaction 入口處理，成功後才更新畫面。
- Banking／Wealth 入口建立獨立 `commandId`；重整或重送同一意圖不重複扣款、建立負債或資產。
- 共用負債月付金規則集中到 `getLiabilityMonthlyPayment()`，避免借款與還款使用不同計算。

### 驗證

- 相關測試：`64 passed`（RoomContext、GameView、WealthView）。
- 完整 Vitest：`296 passed / 30 skipped`。
- Firestore Rules：`30 passed`，使用隔離 18080 Emulator。
- `npm run typecheck`、production build 與 `git diff --check` 通過；build 僅保留既有 Tailwind arbitrary duration、動態／靜態 import 與大型 chunk 警告。

### 尚未完成與限制

- 一般資產買賣、部分醫院／維修／卡片財務流程仍走 legacy 本機狀態相容路徑。
- RTDB 骰子展示仍未切換；不同手機／網路 transport A/B、正式雲端長時間壓力測試與 production 部署仍未執行。

## 2026-09-19 Firestore 優化階段 0 量測基準

### 已完成

- `src/utils/telemetry.ts` 新增僅開發／測試使用的 bounded in-memory debug buffer，並保留既有 Analytics；不新增 Firestore 診斷集合。
- `runRoomBoardMutation()` 的 `hf_board_command` 統一帶有 command／trace ID、transaction duration、讀寫文件數、retry count、room／board payload bytes。
- `RoomContext` 的房間 listener 新增 `hf_board_listener_sync` 與下一個 frame 的 `hf_board_ui_ready`，可串起 listener → UI-ready 量測。
- `board-50-turn-stress.spec.ts` 將教練端、投影端及玩家端 telemetry 寫入壓力測試 JSON。
- E2E 測試設定支援 `E2E_NO_ARTIFACTS=true`，在磁碟空間有限時停用 trace／影片／失敗截圖，不影響正式程式。

### 本地基準

- 3 位玩家＋執行師：50／50 回合通過；transaction p95 114ms、listener p95 78ms、UI-ready p95 52ms、retry 0、房間文件最大 44,412 bytes。
- 6 位玩家＋執行師：50／50 回合通過；transaction p95 438ms、listener p95 299ms、UI-ready p95 81ms、retry 0、房間文件最大 46,472 bytes。
- 詳細量測與限制：`docs/testing/FIRESTORE_STAGE0_BASELINE_2026-09-19.md`。

### 驗證

- `npm run typecheck` 通過。
- 完整 Vitest：`297 passed / 30 skipped`。
- Firestore Rules：`30 passed`，使用隔離 Emulator。
- `npm run build` 通過；保留既有 Tailwind arbitrary duration、動態／靜態 import 與大型 chunk 警告。
- `git diff --check` 通過。

### 尚未完成與限制

- 尚未取得真實手機在 Wi-Fi／行動網路下的 long-polling transport A/B p50／p95。
- 尚未完成真實裝置斷線 10 秒後重連量測。
- 尚未完成正式雲端 3 人短測、6 人＋執行師＋大地圖長時間基準與 Firestore 用量對照。
- RTDB 骰子展示、所有財務命令全面遷移及正式雲端壓力測試仍屬後續階段；本次未宣稱完成或部署。

## 2026-09-19 執行師開始遊戲計時器無反應修正

### 修正

- 計時器更新改由 Firestore transaction 讀取最新房間，確認目前帳號仍是房主執行師後再寫入，避免 RTDB 分頁控制權短暫未就緒時被靜默略過。
- 執行師開始／暫停計時器只在遠端寫入成功後更新本機畫面，避免本機顯示已開始但玩家仍被 `isTimerPaused` 擋住。
- 等待房間的舊開始入口改走 `startRoomGame()` 完整初始化棋盤，不再只寫 `status: playing` 造成缺少回合順序與目前玩家。

### 驗證

- `npm run typecheck` 通過。
- 完整 Vitest：`297 passed / 30 skipped`。
- `npm run build` 與 `git diff --check` 通過。
- 開房 Playwright 回歸未通過：避開既有 Emulator 埠後，測試在 `seedAccounts.mjs` 連線 Auth Emulator 時出現 `ECONNREFUSED`；未宣稱瀏覽器驗收通過。

### 目前風險

- 需要在可啟動 Vite／Emulator 的本機環境實測一次：開房、完成玩家三步選擇、執行師按開始、確認計時器欄位與玩家骰子按鈕。

## 2026-09-21 v4.9 版本與部署

- 對外版本由 `v4.8` 更新為 `v4.9`。
- 執行師計時器與開局棋盤初始化修正已加入系統更新日誌。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過；建置保留既有 Tailwind、dynamic/static import 與大型 chunk 警告。
- 已部署至 Vercel production：`https://2ife.vercel.app`。
- Deployment `dpl_Geuvbxn3Ha98A6fiF5q7nwaxBnyJ` 狀態為 `READY`；正式網址 HTTP 200。

## 2026-09-24 C024 共享卡片放棄回覆

- C024「放棄」使用 schema v2 共享 prompt 的 `declined` 回覆；子集合寫入遭 `permission-denied` 時，現在回退到既有受限房間交易，僅更新玩家自己的回覆。其他錯誤不會被當成成功。
- Firestore Rules 測試涵蓋子集合 `declined` 寫入、房間本人回覆回退權限及非本人拒絕。
- 驗證：`RoomContext.test.ts` + `roomPermissions.test.ts` 93/93 通過；`npm run typecheck`、`git diff --check` 通過。
- 風險：尚未在使用者實際雲端房間重播；本機檔案不能證明雲端 Rules 發布版本一致。未更新版本號、未部署。
- 下一步：在本地伺服器重播 C024「放棄」；若仍失敗，保留 Firestore 錯誤碼並核對雲端 Rules。

## 2026-09-24 C012 共享卡片放棄回覆修正

- 根因：C012 的 v2 共享回覆在子集合寫入遭拒後，沿用通用房間交易回退；該交易會讀取所有玩家 response 文件，但 Rules 僅允許玩家讀自己的文件，導致回退再次遭拒。
- 修正：回退只 transaction 讀取最新房間，冪等更新本人回覆與 revision，不讀其他玩家回覆、不由玩家結案；執行師端在房間回覆 Map 改變時重新判斷是否可結案。
- 驗證：`RoomContext.test.ts` 65/65、Firestore Rules Emulator `roomPermissions.test.ts` 31/31、TypeScript、`git diff --check` 通過。
- 風險：未在使用者實際雲端 C012 房間重播；雲端 Rules 發布狀態仍需實際環境確認。未更新版本、未部署。

## 2026-09-24 非本人回合仍可購買汽車

- 根因：汽車購買沿用有「目前回合」限制的棋盤命令入口，非本人回合時被拒絕；汽車購買本身只影響購買者財務，不需要推進棋盤回合。
- 修正：汽車購買改以 Firestore transaction 讀取最新房間與購買者私人玩家資料，只原子更新本人資產、現金、貸款與歷史；仍檢查房間成員、遊戲狀態、現金及單人限購，並保留 command ID 冪等防護。
- 驗證：`RoomContext.test.ts` 65/65、Firestore Rules Emulator `roomPermissions.test.ts` 31/31、TypeScript 通過；Rules 測試明確驗證非目前回合玩家只能更新自己的私人狀態。
- 未更新版本、未部署；尚未在多人雲端房間手動重播購車流程。
- 修改：`src/context/RoomContext.tsx`、`src/context/RoomContext.test.ts`、`src/test/roomPermissions.test.ts`。

## 2026-09-24 N055 投資完成後共享回覆失敗

- 根因：N055 投資先更新本機財務、再另送共享回覆；schema v2 的 `completed` 回覆走通用棋盤交易，該交易讀取所有玩家 response 文件，違反玩家只能讀本人回覆的 Firestore Rules。
- 修正：schema v2 所有共享回覆改走本人 response 文件；N055 投資與本人完成回覆同一 transaction 提交，使用卡片權威金額與最新玩家現金，command ID 防重複。舊版房間維持受限的本人回覆 Map 路徑。
- 測試：`RoomContext.test.ts` + `GameView.test.ts` 70/70、Firestore Rules Emulator 32/32、TypeScript、正式 build 與 `git diff --check` 通過。
- 風險／下一步：未以真實雲端多人房間重播或部署；請用至少兩位目標玩家測 N055，確認投資資產、現金、月收益及所有人回覆都同步，並在正式上線前核對雲端 Rules 版本。

## 2026-09-24 v4.10 版本與部署

- 對外版本更新至 `v4.10`；系統更新日誌列出新場次／舊資料隔離、共享卡片 C012／C024／N055、非本人回合汽車購買修正。
- 發布前檢查：TypeScript、完整 Vitest 307 passed／32 skipped、Firestore Rules Emulator 32/32、正式 build、`git diff --check` 通過。
- Vercel `2ife` production 部署 `dpl_CqxWQgbdukJnzoKKix287tP2cufU` 為 Ready；`https://2ife.vercel.app/` HTTP 200，正式資產含 `v4.10` 與 N055 更新日誌。
- 本次只部署 Vercel 網站，未發布 Firestore Rules；雲端 Rules 版本與真實多人 N055 流程仍待核對與實測。既有工作樹修改保留，未 commit 或 push。

## 2026-09-24 家庭歷程交易與共享回覆權限修正

- 行為與資料責任：家庭歷程由 `RoomContext` 處理命令；Firestore 房間保存事件、私人玩家文件保存財務、`events/{promptId}/responses/{uid}` 保存本人回覆。執行師讀全體回覆並結案；未新增集合、依賴或第二份財務狀態。
- 根因：v2 家庭命令沿用會讀取所有玩家 response 的通用 transaction，違反本人回覆讀取規則；通過擲骰後本人 response 又被 Rules 禁止更新，導致來源玩家交易與參與玩家完成交易均被拒。
- 修正：玩家家庭命令限讀本人 response；Rules 只允許本人 `passed` 回覆由未完成轉已完成。財務與完成回覆同筆 transaction，執行師維持完整回覆結案；不變的回覆快照不再造成 room 重設。
- 驗證：獨立 Firestore Emulator 33/33；完整 Vitest 307 passed／33 skipped；TypeScript、正式 build、`git diff --check` 通過。其他玩家 response 仍不可讀寫、重送不重複入帳。
- 風險／下一步：尚未在實際多人雲端房間重播；本地 `.firebaserc` 與 SDK 預設專案 ID 仍為 `happinessflow-online`，本次沒有發布 Firestore Rules 或 Vercel。正式驗收前須核對實際 Firebase 專案並同步 Rules。

## 2026-09-24 家庭歷程投影卡五階段資訊顯示

- 投影卡右側合併家庭歷程專屬標題、移除重複的小標題，並縮小五階段表格的內距與列高；其他卡片版面與底部同步面板不變。
- 驗證：`git diff --check` 通過；未執行測試或建置。未更新版本、未部署。
- 風險：極矮視窗仍保留內容區捲動，避免字體不可讀或資訊遭裁切。

## 2026-09-28 銀行後現金倒扣與幸福卡／骰子延遲

- 根因 1（現金倒扣）：`GameContext.tsx` 把 Firestore 私有玩家文件的權威資料同步回本機 `gameState` 時，會無條件把 `pendingLocalPlayerPatchRef` 暫存的本機差異蓋回剛收到的權威值；但寫入這個暫存差異的另一段 effect 在棋盤事件進行中會 defer、也只有在同一段裡才會清除。玩家一回合大部分時間都在移動／抽卡／事件進行中，暫存差異因此長時間卡著舊現金數字，之後每次收到新的權威現金（例如銀行入帳、機運卡扣款）都被這個舊數字蓋掉，重現「經過銀行後現金比正確結果少一次扣款」的畫面。
- 修正 1：`GameContext.tsx` 在套用暫存差異前，先比對「這次收到的權威值」跟「上一次收到的權威值」；只要某欄位的權威值在等待期間已經被伺服器另一筆交易改變過，就先丟棄該欄位的暫存差異，不再蓋回去。只有權威值真的沒變（純粹本機還沒同步上去）時才保留覆蓋，維持原本「保留未同步本機編輯」的用意。
- 根因 2（幸福卡／骰子延遲 ~1 分鐘）：大螢幕與玩家手機的卡片、骰子畫面都直接讀同一條 Firestore 房間文件的 `onSnapshot`；手機切到背景或網路不穩時，這條監聽串流的重連完全依賴 SDK 自己的 backoff，實測可拖到一分鐘以上才補上新快照。這是已知的架構限制（見本檔案 2122 行前後：RTDB 缺少可驗證房間成員的安全權威，暫不搬遷展示層），本次先做緩解，不做架構搬遷。
- 修正 2：`RoomContext.tsx` 新增 `forceFirestoreReconnect()`（`disableNetwork` → `enableNetwork`，5 秒節流）；Realtime Database `.info/connected` 從斷線恢復時，以及分頁 `visibilitychange` 變成可見／瀏覽器 `online` 事件時，主動觸發一次，強迫 Firestore 立刻重建監聽串流，不用乾等 SDK 自己的 backoff。新增 `firestore_reconnect_bounce` 遙測事件，供之後從實機數據核對效果。
- 驗證：`npm run typecheck` 通過；完整 Vitest `367 passed／33 skipped`；`npm run build` 通過（既有大型 chunk 警告不變）。
- 風險／下一步：尚未在實機（鎖螢幕、切背景一分鐘）驗證延遲改善幅度；RTDB 展示層搬遷需先決定安全的房間成員授權來源（Cloud Functions／custom claims），本次未動。
- 修改：`src/context/GameContext.tsx`、`src/context/RoomContext.tsx`、`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`（v4.20 更新日誌）。

## 2026-09-28 v4.20 版本與部署

- 對外版本由 `v4.19` 更新為 `v4.20`；系統更新日誌列出銀行現金倒扣修正與幸福卡／骰子延遲緩解。
- 發布前檢查：`npm run typecheck`、完整 Vitest `367 passed／33 skipped`、`npm run build` 通過。
- 已部署至 Vercel production：`vercel --prod`，Deployment `dpl_3iFcP78EL94rCSQpJYJwJaecggFz` 狀態 `READY`；`https://2ife.vercel.app/` HTTP 200，正式資產已確認含 `v4.20`。
- 本次只部署 Vercel 網站，未變更 Firestore／Realtime Database Rules。工作樹改動未 commit 或 push（延續本輪工作方式）。

## 2026-09-29 銀行服務窗口非本回合交易權限修正，並修正規則運算預算超限

- 根因 1（銀行服務窗口未被規則支援）：玩家經過銀行格後會取得私有玩家文件裡的 `bankServiceWindowActive`，允許在非本回合購買股票／保險／定存／汽車或辦理信貸還款；但 `firestore.rules` 的 `validBoardCommand()` 只允許目前回合玩家更新 `boardState`，完全沒有對應這個窗口，導致夥伴測試時出現「股票交易權限不足」「保險同步權限不足」。
- 修正 1：新增 `usesOwnBankServiceWindow()`，只在 `bankServiceWindowActive == true` 且本人未被家庭歷程卡／共享卡片指名要求回覆時放行，且僅允許異動 `revision`／`processedCommandIds`／`updatedAt`（真正的金額變動仍寫在私有玩家文件），加為 `validBoardStateUpdate()` 的最後一個分支。
- 根因 2（規則運算預算超限／評估錯誤，波及房市購買等其他功能）：`hasOwnSubcollectionResponseAfter()` 對同一份子集合回覆文件重複呼叫 `getAfter()` 四次，讓 `validBoardCommand()` 假路徑的運算成本大幅增加，容易撞上 Firestore 每次請求 1000 個運算式的硬上限；`respondsToOwnSubcollectionPrompt()` 又沒有先用 `'... in ...'` 檢查欄位是否存在就直接存取 `boardState.familyMilestoneJoinPrompt`／`sharedCardPrompt`，欄位不存在時規則評估直接丟錯誤。這兩個問題會連帶拖累 `validBoardCommand()` 之後才輪到的分支（例如 `updatesRealEstateMarketPurchase()` 房市公告板購買），造成類似「隨機權限不足」的症狀，不限於銀行交易。
- 修正 2：`hasOwnSubcollectionResponseAfter()` 改成只呼叫一次 `getAfter()`，把 `.data` 當參數傳給新增的 `matchesOwnSubcollectionResponse()` 重複使用；`respondsToOwnSubcollectionPrompt()` 改為先檢查欄位是否存在，比照檔案裡其他地方既有的寫法。
- 驗證：新增銀行服務窗口的規則測試案例（涵蓋窗口開啟成功、窗口關閉失敗、被卡片指名時失敗、動到其他棋盤欄位失敗），Firestore Rules Emulator `roomPermissions.test.ts` 由 7 個失敗回穩到 **34/34 全過**。
- 已部署：`firebase deploy --only firestore:rules --project happinessflow-online`，正式環境規則已更新；commit `9151e9f`（僅 `firestore.rules`、`src/test/roomPermissions.test.ts`，其餘 dev 工作樹既有修改維持未 commit）。
- 風險／下一步：未在真實雲端多人房間重播銀行服務窗口購買或房市購買流程；正式站程式碼（Vercel `2ife`，v4.20）與規則版本落差（規則最後一次發布是 2026-09-01）已由本次部署補上，但其餘累積一個月未隨規則發布的功能仍建議找時間逐項核對。
- 修改：`firestore.rules`、`src/test/roomPermissions.test.ts`。

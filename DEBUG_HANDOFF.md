# DEBUG_HANDOFF

## 2026-09-17 H002 故事分享首次送出被誤判為權限錯誤

### 現象

- H002 故事分享按下送出後顯示「故事送出分享失敗，請確認連線後再試一次」；再次操作有時又能成功。

### 根因

- `submitRequest()` 原本用 transaction 先讀取 `rooms/{roomId}/pendingRequests/{requestId}`。
- 首次送出時文件尚不存在，但 Firestore Rules 只允許玩家讀取自己的既有請求；這個不存在文件的讀取在真正 create 前就被拒絕，因此不是 H002 規則或玩家網路斷線。

### 修正

- 有 `sessionId` 的房間改為直接 `setDoc()` 建立請求，讓 Rules 以 `create` 驗證玩家、場次及 pending 狀態。
- 保留場次／類型／玩家／事件／卡片固定 request ID；連點或監聽延遲時，既有 pending／approved 請求視為冪等成功。
- 沒有 `sessionId` 的舊房間回退既有 `rooms.pendingRequests.{uid}` 格式；所有寫入先移除 undefined 欄位。

### 驗證

- `npm run typecheck` 通過。
- `npx vitest run src/context/RoomContext.test.ts src/views/game/GameView.test.ts`：48/48 通過。
- `npm run test:rules` 未執行成功，因既有 Firestore Emulator 已占用 8080；未終止或清除該程序。

## 2026-09-17 重開房間後審核請求同步權限不足

### 錯誤現象

- 玩家重新進入房間後，房間成員與房間碼可以正常顯示，但畫面底部出現「審核請求同步權限不足，請重新整理後再試一次」。
- 重新整理無法穩定排除問題。

### 目前錯誤訊息 / log

- `RoomContext` 的 `rooms/{roomId}/pendingRequests` `onSnapshot` 回呼收到 `permission-denied`。

### 已確認的風險

- 審核請求監聽原本只檢查 `room?.id` 與 `room?.sessionId`，可能在房間快取／舊快照尚未由 server 確認時建立 query。
- 子集合 Rules 的成員判定只使用 `roomData().memberUids`，與房間讀取的舊資料相容判定及私有玩家文件不一致；因此可能出現「畫面看得到自己已加入，但審核子集合沒有讀取權」的狀態。

### 根因假設與最小驗證

- 先等待房間 listener 進入 `synced`，並確認目前 UID 位於 `memberUids`、`members` 或既有私有玩家文件可識別的成員範圍，再建立審核 query。
- 子集合 Rules 與房間成員判定使用同一個可驗證的成員來源；Rules emulator 應允許有效成員讀取自己的請求、拒絕非成員讀取。

### 不准再重複的修法

- 不只把 `permission-denied` 紅字隱藏。
- 不用重新整理或固定延遲當作權限修正。
- 不放寬成所有登入者都能讀取房間內所有審核請求。

### 修正結果

- `RoomContext` 已改為等房間 server snapshot 同步完成，並確認目前帳號屬於房間後才啟動 `pendingRequests` listener。
- `firestore.rules` 已部署至 `happinessflow-online`；Firebase 回報規則編譯成功並已 release。
- 尚待用重開房間的實際玩家帳號驗證審核請求監聽不再出現權限錯誤。

## 2026-09-16 故事分享審核請求跨裝置延遲

### 錯誤現象

- 玩家接受故事分享卡片後，玩家端顯示已送出，但執行師端要過一段時間才出現審核請求。

### 根因確認

- 原流程把 `pendingRequests.{uid}` 寫在共用 `rooms/{roomId}` 文件；房間回合、卡片、玩家公開狀態與審核請求共用同一個 Firestore listener。
- 玩家端的 `updateDoc` 成功只代表請求寫入完成，執行師仍要等待整份房間文件跨連線推送並重新渲染。
- 這條路徑沒有額外 `setTimeout` 或 debounce；延遲主要來自共用熱文件的同步與跨裝置網路傳遞，不是故事卡規則要求等待。

### 修正

- 新請求改寫入 `rooms/{roomId}/pendingRequests/{requestId}`，並以 `sessionId + type + uid + boardEventId + boardCardId` 建立穩定請求 ID。
- 執行師只監聽目前場次的請求；玩家只監聽自己的請求。核准幸福故事時，以 transaction 同時更新請求狀態與玩家私有資料。
- 保留舊 `rooms.pendingRequests` 讀取與清除相容性，避免既有房間的請求消失。

### 驗證

- 新增請求 ID 單元測試與子集合 Firestore Rules 測試。
- 完整 Vitest：264 passed／27 skipped。
- 獨立 Firestore Emulator Rules：27 passed；未使用現有 8080 Emulator，避免清除使用者的本地測試資料。
- TypeScript、正式 build、`git diff --check` 通過。

### 後續風險

- 尚未完成三位玩家＋執行師的真實網路跨裝置延遲量測；需要以時間戳比較玩家送出、Firestore 確認、執行師收到快照與畫面顯示四個時間點。
- 舊房間仍可能保留 legacy 請求；新局會使用新的 `sessionId`，不會讀到舊請求。

## 2026-09-15 職業／企業／夢想選項閃動與結果錯置

### 現象與確認根因

- 玩家滑動職業、企業或夢想輪播時，選項會閃動、切換到鄰項，最後可能出現選 A、進遊戲卻是 B。
- 舊 `SelectionCarousel` 在每個 `scroll` 事件中以「最靠近畫面中央的卡片」呼叫 `onSelect`，所以單純瀏覽就一直改寫 `selectionDraft`；三組重複項目、循環位移與縮放效果進一步增加狀態變更。
- `SelectionView` 另有持續同步 `initialSelections` 與 `initialStep` 的 effect。Firestore 舊快照傳回時可能覆寫仍在操作中的本機選擇或步驟。
- 最後確認前只更新本機狀態，遊戲畫面立即切換，完成設定依賴稍後的背景防抖同步，缺少「選擇已正式儲存」的確認點。

### 修正與驗證

- 以手機單欄、桌面多欄的可捲動選項卡片取代輪播；只有點選卡片才更改選項，頁面捲動不觸發選擇。
- 選擇步驟與草稿只在 SelectionView 建立時由雲端資料初始化，不接受已掛載畫面後到達的舊 props 重置。選完夢想先顯示職業、企業、夢想摘要並可逐項修改。
- 最終確認透過 GameContext transaction 同步寫入玩家私有狀態與自己的公開完成狀態，且檢查 room.startedAt 與會員資格；交易成功才切換到遊戲，失敗留在摘要頁。
- 選擇元件／舊快照回歸 2/2；完整 Vitest 258 passed／26 skipped；Firestore Rules 26 passed；TypeScript、build、`git diff --check` 通過。
- 尚未由多個實際手機帳號同步操作驗證；若仍錯置，需保留確認摘要截圖及該玩家 `rooms/{roomId}/players/{uid}` 中的職業／企業／夢想欄位比對。

## 2026-09-12 正式環境回合與落點事件延遲

### 錯誤現象

- 玩家結束回合後，下一位玩家需要等待較久才可擲骰。
- 玩家走到格子後，卡片需要等待較久才出現。

### 根因假設與驗證方向

- 所有棋盤操作共用 `rooms/{roomId}` 的 Firestore transaction；多人同時操作時會競爭同一份房間文件，版本衝突會依既有 retry/backoff 重試。
- 移動結算同時存在「以 `startedAt` 絕對截止時間」與「transaction 完成後重新等待完整 `settleDelayMs`」兩套排程；正式網路較慢時，後者會把交易時間再加一次，且兩個排程可能同時發起相同結算 command。
- 卡片必須等移動結算 transaction 寫入 `currentEvent/currentCard` 後才會建立，因此上述排程競爭會直接反映為卡片延遲。
- `board_command` 已記錄 transaction 總時間與 attempts；本次補上房間 listener 的 `updatedAt` 到正式快照延遲，以及 turn handoff 標記，用來區分 transaction 慢與 listener 慢。

### 不採用的修法

- 不用前端樂觀解鎖下一位骰子；Firestore 尚未確認前允許操作會破壞回合權威性。
- 不直接移除 transaction retry 或放寬 revision／command guard；那會放大重複扣款與資料覆蓋風險。
- 不在本次直接切換 long polling；`experimentalAutoDetectLongPolling` 需在正式受影響網路做 A/B 量測後才決定。

### 最小修正

- 移除 `rollBoardDice()` 與分段事件恢復路徑中 transaction 完成後的相對等待與重複結算；統一由 RoomContext 的絕對 `movement.startedAt + settleMs` 排程負責。
- `runRoomBoardMutation()` telemetry 增加 command ID；房間 listener 對每個新的 server-confirmed `boardState.updatedAt` 記錄同步延遲。

## 2026-09-11 N057 經過銀行第一骰仍無反應

### 錯誤現象

- N057 兼職工作室玩家經過銀行後，點擊「開始擲骰子（第一骰）」沒有結果，大螢幕也沒有骰子事件。

### 根因假設與最小驗證

- 第一骰交易已在 transaction 內確認最新事件屬於目前玩家的銀行事件，卻又額外要求玩家畫面傳入的 `sourceEventId` 與最新事件 ID 完全一致。
- Firestore listener 落後一個 revision 時，舊畫面 ID 會讓有效的銀行骰點在 `appendDicePresentation()` 前被拒絕，因此大螢幕沒有任何事件可顯示。
- 最小驗證：目前回合與最新事件皆屬該玩家的銀行事件時，即使呼叫端帶舊事件 ID，仍應允許第一骰；非銀行事件或非目前玩家仍須拒絕。

### 不准再重複的修法

- 不增加等待秒數或要求玩家再點一次。
- 不放寬成只要持有 N057 就能在任意格擲升級骰。

### 修正與驗證結果

- 移除對呼叫端舊 `sourceEventId` 的精確比對；改由共用 `isCurrentPlayerBankEvent()` 只讀 transaction 內最新狀態，確認目前回合、銀行事件及事件玩家皆為同一人。
- N056～N058 共用相同第一骰路徑，因此同步套用此修正；非銀行事件與非目前玩家仍會被拒絕。
- 驗證：`RoomContext` 與 `BizUpgradeModal` 目標測試 35/35 通過、TypeScript、正式 build、`git diff --check` 通過。
- 尚未完成玩家手機＋大螢幕實機回歸；本次未 commit、push 或部署。

### 實機結果與假設淘汰

- 使用者再次實測仍完全無反應，大螢幕沒有骰點；因此「只有舊 `sourceEventId` 精確比對造成阻擋」不足以解釋目前故障。
- 下一個驗證必須取得實際 transaction 錯誤或最新私人玩家文件，確認是 `pendingStartupUpgradeAction`／資產不一致、權限拒絕，或按鈕事件根本未送出；未取得證據前不再放寬其他守門條件。

### N057 舊資料相容修正

- 畫面可由本機快照看到 N057 工作室並開啟升級視窗，但第一骰交易只讀 Firestore 私有玩家文件的 `pendingStartupUpgradeAction`；舊資料若只有工作室與對應企業貸款，會在建立大螢幕骰點事件前被拒絕。
- `resolveStartupUpgradeTarget()` 現在只在同時找到同卡號的未升級工作室與企業貸款時，才在第一骰 transaction 內補回待升級狀態；不會將其他企業誤判為 N057。
- 相關 BizUpgradeModal／RoomContext 測試 36 項通過，TypeScript 檢查通過。

## 2026-09-11 家庭歷程手機端提前顯示骰點結果

### 錯誤現象

- 參與家庭歷程的玩家擲骰後，手機端已顯示骰點結果，但大螢幕仍在播放骰子動畫。

### 已嘗試修法

- 家庭骰點已改由 `familyMilestoneJoinPrompt.responses` 同步，大螢幕也以家庭歷程專用網格呈現；但手機端仍直接使用交易回傳的 `status` 顯示結果。
- 目前兩端各自從收到快照的時間起算本機動畫，無法保證結果同時揭示。

### 新根因假設

- `handleFamilyJoinRoll()` 收到 Firestore transaction 回傳後立即更新手機結果；這把「權威結果已寫入」誤當成「大螢幕動畫已完成」。
- 家庭骰點回覆需要保存共同的遠端揭示時間，手機與大螢幕都依同一時間點揭示結果，不能各自從 listener 到達時間重新起算；此時間對齊大螢幕骰點揭示動畫，而不是整個投影視窗的關閉時間。

### 最小驗證

- 同一筆回覆在手機於 0／1／2 秒收到時，揭示時間仍固定為回覆的共同完成時間；完成時間前不顯示結果，完成後才顯示。
- 同時確認通過玩家的財務檢核不會在大螢幕動畫完成前開啟，失敗結果仍保留至玩家主動關閉。

### 下一步

- 在既有家庭歷程回覆加入共用 presentation deadline，並讓手機結果、財務檢核與大螢幕動畫共用這個 deadline。

### 修正與驗證結果

- 家庭骰點回覆現在保存 `presentationReadyAt`；交易重送時沿用既有回覆的骰值、結果與揭示時間，不會用新的本機骰值覆蓋。
- 大螢幕家庭骰點動畫依每位玩家自己的 `presentationReadyAt` 結束；手機端的結果通知、通過後財務檢核與失敗結果顯示也必須等同一時間點。
- 既有舊回覆沒有 deadline 時，以 `respondedAt + DICE_PRESENTATION_REVEAL_MS` 相容處理；不改變資料集合或遊戲規則。
- 驗證：`npm run typecheck`、完整 Vitest 41 files passed／1 skipped（242 passed／25 skipped）、`npm run build`、`git diff --check` 通過。
- 尚未完成三位玩家＋執行師瀏覽器實機回歸；本次未 commit、push 或部署。

## 2026-09-11 C041～C043 修繕費依未投保房屋數量計算

### 重現條件

- 玩家持有 3 間房屋，抽到 C041「天有不測風雲」且房屋皆未投保。
- 財務檢核只計算卡片的單間修繕費 200,000 元。

### 根因與修正結果

- 共用 `property_repair` 規則只使用卡片 `cashLoss` 一次，未乘上未投保房屋數量。
- C041～C043 現在依「未投保房屋數量 × 每間修繕費」計算；全部投保不收費，部分投保只計未投保房屋。
- `txData.amount`、`cashChange` 與影響摘要共用同一計算結果，財務檢核與結算不會再出現不同金額。
- 驗證：針對性測試 62 passed；完整 Vitest 41 files passed、1 skipped，240 passed、25 skipped；TypeScript、正式 build、`git diff --check` 通過。


## 2026-09-11 H026 孩子才藝卡資格判定

### 重現條件

- 玩家已完成 H014「擁有第一個孩子」，再抽到 H026「孩子的才藝活動」。
- 卡片抽屜只顯示「關閉」，沒有「接受」及財務檢核入口。

### 根因與修正結果

- H026 的資格判斷使用 `gameState.children`，但家庭歷程套用 H014／H015 時只更新幸福歷程與育兒月支出，沒有同步增加 `children`，導致實際已有孩子的玩家仍被判定為 0。
- `applyFamilyMilestoneStage()` 現在在 child1／child2 成功結算時同步增加子女數，並維持既有冪等判斷，不會因重送重複增加。
- H026 另兼容既有存檔中已勾選 `h_child1`／`h_child2` 或已完成 child milestone、但 `children` 尚未補寫的資料；有資格時提供「接受」並進入財務檢核，沒有孩子時仍只提供關閉。
- 驗證：H026／家庭歷程目標測試 93 passed；完整 Vitest 41 files passed、1 skipped，239 passed、25 skipped；TypeScript、build、`git diff --check` 通過。

## 2026-09-11 家庭歷程參與回覆重送與財務檢核未開啟

### 重現條件

- 家庭重要歷程 prompt 建立後，其他玩家擲骰達到 4 點以上。
- 第一次回覆已送出後，玩家端仍可能短暫使用舊的 prompt 快照，骰子按鈕再次可用。
- 點擊略過或再次操作時，畫面出現家庭歷程同步失敗；達標玩家也可能未進入財務檢核。

### 根因假設

- 回覆 transaction 已使用 prompt ID／玩家 UID 冪等，但 UI 的 `hasRespondedToFamilyJoin` 只看遠端快照；Firestore listener 尚未回來前，本機仍把同一玩家視為未回覆。
- 達標後的 pending family action 由私有玩家文件非同步回傳，若 UI 先關閉 prompt，短暫期間會同時出現舊骰子入口與尚未準備好的財務入口。
- 空白股票張數被受控 input 立即轉回 1；月結餘則直接以 `cash + flow` 寫入，尚未在同一個本機交易結果中建立強制負債。

### 修正方向

- UI 記住本次 prompt 已成功送出的玩家回覆，直到 prompt ID 改變；遠端資料仍是最終權威來源。
- 達標／略過都只送一次冪等回覆，不讓舊快照重新開啟骰子。
- 股票輸入允許暫時為空；月結餘扣款將現金鎖在 0，短缺額建立零利息強制負債。

### 修正與驗證結果

- 股票批量張數改為 `number | ''`，清空欄位後可直接輸入新數字；按下交易時仍以至少 1 張作為安全 fallback。
- 月現金流改在同一次本機狀態更新中計算短缺額：現金最低為 0，短缺額建立零利息「強制負債」，並留下對應財務歷史。
- 家庭歷程回覆成功後立即記住 prompt ID；達標玩家會依 prompt response／待處理動作進入財務流程，未達標或略過不會因舊快照重開骰子入口。
- 家庭參與交易仍由既有 Firestore transaction 及 prompt ID／玩家 UID 冪等鍵結算，沒有新增集合或服務。
- 驗證：`npm run typecheck`、目標 Vitest 3 files／40 tests、`npm run build`、`git diff --check` 通過；Rules 全量與真實多玩家瀏覽器回歸尚未執行。

## 2026-09-10 Firestore 用量優化第一至六項

- 交易共用入口現在會略過「board、roomPatch、私人玩家資料都沒有變更」的操作，不只依賴每個 caller 記得加 `commit:false`；這避免無效重送只為 command ID 消耗 revision／寫入。
- 玩家狀態同步改以 transaction 讀取目前房間及自己的私人文件，僅合併最後權威快照之後仍未被遠端改動的本機欄位；避免舊整份財務快照覆蓋正式交易結果。
- 翻牌與家庭／共享 prompt 建立合併成同一個房間 transaction；歷史初次查詢限制最近 20 筆，投影幕移動取樣由 80ms 降為 160ms。
- 驗證：完整 Vitest 41 passed／1 skipped、237 passed／25 skipped；TypeScript、build、git diff --check 通過。Rules 與 3／6 玩家真實競態尚未完成驗收。
- 注意：目前不是所有 `useGame().setGameState` 財務 caller 都已改成單一 transaction；後續仍需逐一遷移並用 Emulator 驗證交易結果，不能只依賴同步層的遠端勝出保護。

## 2026-09-09 N056–N058 經過銀行第一骰未投影

### 重現條件

- 玩家完成 N056–N058 創業貸款／工作室建立後，下一次經過銀行。
- 在「企業升級」視窗點擊「開始擲骰子（第一骰）」後，玩家端停在等待或錯誤狀態，大螢幕沒有出現骰子投影。
- 同一流程再次操作時可能恢復，顯示第一次操作未完成可靠的房間狀態同步。

### 根因假設與最小驗證

- `rollStartupUpgradeDice()` 及其後的 `completeStartupUpgradeAction()` 沒有明確要求使用玩家私有文件；`runRoomBoardMutation()` 在房間仍殘留舊的 `playerStates` 欄位時，可能讀到過期共享玩家資料。
- 交易在 `appendDicePresentation()` 寫入前就因找不到最新的待升級工作室／待辦而失敗，因此 `boardState.diceEvents` 沒有事件，大螢幕自然不會顯示骰子。
- 次要風險是第一骰未確認目前仍屬該玩家的銀行事件；延遲或舊視窗不應寫入新回合。
- 最小驗證：建立房間共享 `playerStates` 舊快照與 `rooms/{roomId}/players/{uid}` 最新待升級資料，執行銀行第一骰交易，確認私有資料被採用且 `diceEvents` 產生；再以非銀行事件確認交易被拒絕且不寫入骰點。

### 修正方向

- N056–N058 的銀行骰點、升級結算與貸款完成共用路徑強制讀取玩家私有文件，避免舊共享欄位覆蓋權威資料。
- 第一骰交易驗證最新棋盤事件仍是目前玩家的銀行事件，成功後才追加 `business-upgrade` 骰子投影。
- 保留既有 Firestore transaction、revision 與 command ID 冪等機制，不增加卡片專用例外或新資料集合。

### 修正與驗證結果

- `completeStartupLoanAction()`、`rollStartupUpgradeDice()` 與 `completeStartupUpgradeAction()` 已全部設定 `forcePrivatePlayerStates: true`，即使房間殘留舊的共享 `playerStates`，也會以 `rooms/{roomId}/players/{uid}` 的最新資料執行。
- 銀行第一骰在 transaction 內確認 `currentEvent.type === 'bank'` 且事件玩家為目前玩家；檢查失敗不寫入骰點事件，避免舊視窗誤操作。
- 成功交易仍由 `appendDicePresentation()` 寫入 `business-upgrade` 事件，大螢幕沿用既有 `DicePresentationOverlay` 顯示。
- 驗證：N056–N058 相關 Room／Board mutation／骰子投影測試 36/36 通過、`npm run typecheck`、`npm run build`、`git diff --check` 通過；本地伺服器 HTTP 200。
- `npm run test:rules` 因既有 Firestore Emulator 佔用 `8080` 無法啟動新實例，未宣稱 Rules 驗證通過；尚未完成三位玩家＋執行師的銀行第一骰瀏覽器實機回歸。

## 2026-09-09 幸福歷程多人同時擲骰同步失敗與大螢幕順序顯示

### 錯誤現象

- 家庭歷程中多位玩家同時按下擲骰，偶發顯示「家庭歷程同步失敗」，玩家需要再次按下才能完成。
- 大螢幕的骰子結果目前依 `diceEvents` 一個接一個播放，未以家庭歷程玩家名單同步呈現。

### 根因假設

- 大螢幕單一 `activeEvent` 只影響呈現，不負責寫入，因此不是同步失敗的直接原因。
- 每位玩家的回覆都會以 transaction 更新同一份 `rooms/{roomId}` 棋盤文件，且同時追加整個 `diceEvents` 陣列；多人同時寫入會提高 revision／版本競態，重試耗盡後才回傳同步失敗。
- 家庭回覆仍依共用房間 `playerStates` 是否存在選擇資料來源；舊房間殘留欄位可能使玩家讀到舊狀態。

### 最小驗證

- 以 3 位玩家建立同一個家庭歷程 prompt，讓兩位目標玩家同時送出骰點；檢查 prompt 的兩個 UID 回覆都保留、沒有重複按鈕需求，且私有玩家文件的參與待辦各自存在。
- 檢查大螢幕只依目前 prompt 的 `responses` 顯示 3 位玩家格位；不再依序播放家庭骰子事件。

### 修正方向

- 家庭骰點只寫入各自 prompt response，移除同一 transaction 的家庭 `diceEvents` 陣列追加，降低共用棋盤文件競態。
- 家庭回覆 transaction 強制使用玩家私有文件，仍以 prompt ID、玩家 UID 與 board revision 保護冪等及最新狀態。
- 大螢幕家庭歷程改為依玩家人數同步網格：2／3 人為 1 列，4 人為 2×2，5／6 人為 2×3；尚未擲骰者顯示等待狀態。

### 修正與驗證結果

- 大螢幕現在以目前家庭 prompt 的 source／target 玩家名單建立格位；2／3／4／5／6 位玩家分別使用 1×2、1×3、2×2、2×3、2×3，已完成與等待中的骰點同時顯示。
- 家庭骰點不再追加到共用 `diceEvents` 播放佇列，避免大螢幕按順序播放及額外放大房間文件競態；家庭骰點以 prompt `responses` 作為唯一顯示來源。
- 家庭相關交易全數強制載入玩家私有文件，仍保留 prompt ID、玩家 UID、revision 與 command ID 冪等保護；正常 transaction retry 會合併同時送出的最新 prompt 回覆，不需玩家重按。
- 大螢幕每位家庭歷程參與玩家的最新骰點會獨立播放擲骰動畫；動畫期間只顯示「擲骰中…」，動畫完成後才揭示點數與資格結果，重新整理載入既有回覆不重播。
- 若家庭同步仍失敗，應優先記錄 Firestore transaction 的實際錯誤碼與 Rules request，不能再歸因於大螢幕只顯示一顆骰子。
- 驗證：家庭骰點／投影相關測試 5 passed；`npm run typecheck`、`npm run build`、`git diff --check` 通過。完整 `npx vitest run src` 為 38 files passed、1 skipped，226 passed／25 skipped，另有既有 `BrokerView` 測試逾時 1 項；Rules 測試因既有 Firestore Emulator 佔用 `8080` 未能啟動新實例，未宣稱 Rules 驗證通過。
- 尚未完成三位以上獨立瀏覽器同時按骰的手動回歸；下一步應以本地 Emulator 建立 3 位玩家＋執行師，確認所有 response 都保留且沒有「家庭歷程同步失敗」。

## 2026-09-09 房市公告購買結果遺失與區域網路交易崩潰

### 錯誤現象

- 三位玩家從房市購買不同房屋時，部分玩家交易失敗；成功玩家的房屋未出現在私有財務報表。
- 以區域網路網址開啟時，點擊房市購買可能直接出現 `Unhandled Promise Rejection`，堆疊指向 `GameView.tsx` 的 `crypto.randomUUID()`。

### 根因確認

- `http://172.20.10.3:5183` 不是安全內容，瀏覽器不保證提供 `crypto.randomUUID()`；房市按鈕未攔截該 Promise 失敗，因此 `index.html` 的全域未處理 Promise 顯示器會取代整個頁面。
- `runRoomBoardMutation()` 只用共享房間 `playerStates` 是否為 truthy 判斷資料儲存模式。空物件或殘留舊欄位會讓房市交易讀／寫錯誤來源，造成交易結果與私有財務報表不同步。

### 最小重現

1. 以 `http://172.20.10.3:5183/` 登入三位玩家。
2. 開啟房市公告並點擊不同物件的購買按鈕。
3. 觀察非安全網域是否出現未處理 Promise，並檢查成功交易玩家的 `rooms/{roomId}/players/{uid}` 是否有不動產資產。

### 修正方向

- 房市交易識別碼改用既有安全 fallback，並在 UI 邊界捕捉錯誤。
- 房市購買強制使用玩家私有文件；若遇到舊房間欄位，第一次交易可從舊資料遷移被操作玩家，但不再把完整財務資料寫回共享房間。
- 空房間玩家狀態改正確判定為私有文件模式。

### 修正與驗證結果

- 房市交易識別碼已改用安全 fallback；區域網路非安全網址不再因 `crypto.randomUUID()` 缺失而產生未處理 Promise。
- 房市購買已強制從 `rooms/{roomId}/players/{uid}` 讀取並原子寫入玩家狀態，並保留舊房間欄位的單次遷移 fallback；房屋移除與玩家財務入帳仍在同一個 Firestore transaction。
- `runRoomBoardMutation()` 對空的 `playerStates` 正確使用私有玩家文件，不再把空物件誤判為舊資料模式。
- UI 購買入口已加入錯誤攔截，交易準備或同步失敗會留在遊戲頁並顯示提示，不會取代整個頁面。
- 驗證：`npm run typecheck`、`npx vitest run src`（226 passed／25 skipped）、`npm run build`、`git diff --check` 通過；build 僅有既有 Tailwind ambiguous class 與 chunk size 警告。
- 尚未使用三個瀏覽器重現 A／B／C 的完整房市競買流程；需在本地 Emulator 與正式雲端各做一次多人競買，確認成功玩家的私有財務報表都保留不動產。

## 2026-09-08 幸福回憶分享核准後未取得幸福點

### 錯誤現象

- 玩家抽到 H001–H010 分享故事類幸福卡並送出申請，執行師核准後，卡片可結案但玩家幸福點沒有增加。

### 根因假設與最小驗證

- 目前核准只更新房間 `pendingRequests`；幸福效果由玩家端 `handleTransactionSubmit()` 先改本機狀態，再等待一般防抖同步寫入玩家文件。
- 核准、清除請求與卡片結案會先觸發房間快照，可能把尚未寫入 Firestore 的本機幸福結果覆蓋掉。
- 最小驗證：把 H001–H010 的核准與玩家幸福資料放入同一個 `runRoomBoardMutation()`，測試首次核准增加 2 點、相同事件重送不重複增加、下一個事件仍可再次增加。

### 不准再重複的修法

- 不增加固定延遲等待玩家自動同步。
- 不只在玩家畫面補一次 `setGameState`。
- 不放寬 Firestore 通用寫入權限。

### 修正與驗證結果

- 根因確認：執行師核准與玩家幸福結果原本是兩條非原子寫入；房間快照可能先讓卡片結案，再由舊玩家快照覆蓋尚未持久化的幸福點。
- 修正：H001–H010 核准改由執行師在同一個 `runRoomBoardMutation()` 中寫入核准狀態、玩家幸福清單、幸福總分與歷史；玩家端只負責關閉已核准流程。
- 冪等鍵使用 `boardEventId + uid`，同一事件重送不重複加分，下一次新的分享事件仍可正常加分。
- 驗證：TypeScript、Room／Board mutation 測試 32 項、完整 Vitest 225 passed／25 skipped、Firestore Rules 25/25、production build 與 `git diff --check` 通過。

## 2026-08-28 v2.7 系統更新日誌

- 對外版本號更新為 `v2.7`。
- 連線 presence 改由 Realtime Database 管理，每個分頁使用獨立連線節點與斷線自動清理，降低 Firestore 心跳寫入量。
- 關閉分頁、重新開啟或重新登入可依未完成房間恢復；同帳號多分頁由最新分頁取得操作權，舊分頁改為唯讀。
- 房間與玩家同步改以伺服器確認快照為準，避免舊快照覆蓋目前回合、事件與玩家資料；歷史與執行師診斷改為低頻或需要時讀取。
- 驗證：`npm run typecheck`、source Vitest `180 passed / 22 skipped`、Firestore Rules `22/22`、`npm run build` 與 `git diff --check` 通過；建置僅有既有 Tailwind／chunk size 警告。
- 已部署至 `happinessflow-online` production：`dpl_9hUhRaTZnzsYd4yoGTYfKZUXvt8c`，狀態 `READY`；正式網址 HTTP 200，production bundle 已確認包含 `v2.7`。
- 6 位玩家＋1 位執行師的長時間實機用量驗收仍未宣稱完成。

## 2026-08-28 線上遊戲連線與 Firebase 用量優化

### 已執行

- Firebase Auth 改用 `browserLocalPersistence`；關閉分頁、瀏覽器重開或重新登入時，可依帳號 `activeGame.roomId` 找回未完成房間。
- Presence 改為 Realtime Database 每個分頁一個連線節點，使用 `onDisconnect().remove()` 與 `roomLastOnline` 保存最後離線時間；不再以 Firestore 30 秒 heartbeat 寫入。
- 執行師玩家診斷改寫入 RTDB 暫時連線節點，避免診斷畫面更新消耗 Firestore 讀寫。
- 房間監聽開啟 snapshot metadata；路由與自動修復只在 server snapshot 確認後執行，避免本機快取舊狀態觸發新局或事件切換。
- 玩家自動同步移除同步前 `getDoc(player)` 預讀，只寫入玩家端擁有的欄位；棋盤位置、事件與 prompt 留給房間 transaction 維護。
- 同帳號多分頁由最新分頁取得 `roomControllers/{roomId}/{uid}` 控制權，舊分頁的遊戲操作會被擋下並顯示唯讀提示。
- 大廳／結算歷史改為一次性讀取，不在遊戲進行中持續監聽。
- 本地 Firebase Emulator 新增 Realtime Database `9000` 設定，與 Firestore `8080` 一起測試。

### 驗證

- `npm run typecheck` 通過。
- `npx vitest run src`：30 files、179 passed、22 skipped；新增 RTDB 最後離線時間測試通過。
- Firestore Rules：既有 `127.0.0.1:8080` Emulator，22/22 passed；`npm run test:rules` 因 8080 已被既有 Emulator 佔用而未重啟，未終止該程序。
- `npm run build` 通過；僅有既有 Tailwind ambiguous class 與 chunk size 警告。
- `git diff --check` 通過。

### 尚待實測

- 需要在已啟動 RTDB Emulator 的本地環境，用 3 位玩家＋1 位執行師驗證關閉重開、重新登入、斷線重連、暫時離開、分頁接管及第二局初始化。
- 需要用 6 位玩家＋1 位執行師完成 120 分鐘前後用量比較；目前沒有把本地 Emulator 數據宣稱為 Firebase 雲端帳單數據。

## 2026-08-27 Firestore 讀寫量過高：第一階段修正

### 確認原因

- 目前雲端用量為約 50,053 次讀取、12,196 次寫入、13 次刪除；查詢讀取約 81.8%，寫入中約 3,889 次為 `UPDATE_NOOP`。
- 30 秒 Firestore presence 心跳會被所有房間成員的 presence listener 放大，且 Firestore Rules 讀取房間文件確認資格也會增加讀取。
- 玩家 `gameState` 防抖同步每次會先讀取再寫回整份玩家文件，沒有變更時仍可能送出更新。
- 玩家 `player_sessions` 與執行師紀錄每分鐘重複保存，歷史 listener 又會讀取這些草稿更新。
- 玩家診斷狀態以 150ms 延遲寫入，流程視窗切換會產生額外寫入。

### 第一階段修正

- 正式環境 presence 改為 RTDB 連線節點與 `onDisconnect()`；本地 Firestore Emulator 未配置 RTDB 時保留舊 presence fallback。
- 玩家同步增加成功狀態指紋；未變更時略過讀取／寫入。
- 玩家歷史草稿改為 10 分鐘一次，執行師移除每分鐘全員紀錄存檔；遊戲進行中停止歷史 listener，回到大廳／結算後恢復即時歷史。
- 玩家診斷改為 2 秒合併且相同內容不寫入，錯誤仍立即記錄。

### 未完成與驗證限制

- `database.rules.json` 已加入並通過 RTDB Emulator 規則語法驗證，內容已對齊雲端現有 `roomConnections`／`roomControllers` 格式，但尚未發布至雲端；發布前仍需走正式部署流程。
- 既有 `localhost:5183` 伺服器佔用 Playwright port，因此開房瀏覽器回歸未執行。
- 下一次驗收需先部署並驗證 RTDB 規則，再以 6 位玩家＋1 位執行師連續 120 分鐘比較讀寫量；目標維持每局讀取 ≤15,000、寫入 ≤3,000、`UPDATE_NOOP` <5%。

## 2026-08-27 家庭歷程修正執行結果

- Branch：`dev`；工作樹：`.worktrees/dev`。
- H011–H020、H043–H046 共 14 張家庭歷程觸發卡已確認共用同一套流程；五個階段仍由每位玩家自己的進度獨立決定。
- 已補上 3 位玩家、兩位擲骰失敗、抽卡玩家完成階段二後一次結案的 Rules 回歸測試，以及五階段效果測試。
- 驗證結果：source Vitest `176 passed / 22 skipped`；Firestore Rules `22 passed`；`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 已將 `.firebaserc` 預設目標修正為 `happinessflow-online`，並成功發布 `firestore.rules` 至該專案。
- 前端已部署至 Vercel production：`dpl_FU3NULLdjc5NQcKphKivJb4Mce4u`；正式網址 HTTP 200、狀態 Ready。
- 尚未使用三個真實帳號完整重播瀏覽器流程；雲端 Rules 與前端已同步，下一步應用新房間驗證首次按下財務檢核即可結案。

## 2026-08-27 H011 家庭歷程階段二財務檢核權限拒絕

### 錯誤現象

- 抽卡玩家在家庭歷程階段二完成財務檢核後，顯示 `Missing or insufficient permissions.`。
- 家庭歷程無法結束，重複按確認仍會重現。

### 最小重現步驟

1. 以抽卡玩家開啟家庭重要歷程並進入階段二。
2. 其他目標玩家完成回覆，讓抽卡玩家成為最後需要完成動作的人。
3. 抽卡玩家完成財務檢核並按「確認檢核答案」。

### 目前錯誤訊息 / log

- UI 顯示 `Missing or insufficient permissions.`。
- `localhost:5183` 目前使用 `VITE_USE_EMULATOR=false`，實際連線至 `happinessflow-online` Cloud Firestore。

### 根因假設

- `completeFamilyMilestoneAction()` 原本在同一個 board transaction 內，同時更新來源玩家財務、將 `sourceActionCompleted` 設為 true，並清除已完成的家庭 prompt。
- Firestore 規則的來源玩家結案條件只接受「交易前 `sourceActionCompleted` 已是 true」；另一個來源玩家更新條件只接受 prompt 仍存在、只改 `sourceActionCompleted`。
- 因此來源玩家作為最後完成者時，程式送出的合法遊戲操作不符合任一規則分支，整筆 transaction 被拒絕。

### 修正策略

- 保留財務與來源玩家完成狀態的原子 transaction。
- 來源玩家若是最後完成者，先提交 `sourceActionCompleted`，再用獨立且冪等的結案 command 清除 prompt 並推進事件；沿用既有規則，不放寬玩家直接清除未完成事件的權限。

### 不准再重複的修法

- 不用放寬通用玩家寫入權限來掩蓋家庭歷程結案問題。
- 不在財務檢核 UI 增加固定延遲或重試迴圈。
- 不把財務結果改回先寫本機、再等待同步的非原子流程。

### 2026-08-27 全部家庭歷程檢查與修正範圍

- 已確認 H011–H020、H043–H046 共 14 張卡都使用同一套家庭歷程流程；卡號是觸發卡，不直接代表五個階段。
- 五個階段由每位玩家自己的 `completedHappinessEvents`／幸福清單決定，依序為約會、求婚、婚禮、第一個孩子、第二個孩子；不同玩家不得共用階段進度。
- 保留兩段式安全流程：第一段原子套用玩家財務與 `sourceActionCompleted`，第二段以冪等 command 結案，避免第一次按下成功後需要第二次重送。
- 已將 `permission-denied` 轉為中文可操作提示，並將 Firebase 預設部署專案改為 `happinessflow-online`；部署前必須先通過 Rules 驗收。
- 已新增三位玩家、兩位擲骰失敗、抽卡玩家完成階段二後一次結案的回歸測試，以及五階段效果測試。

## 2026-08-26 股市通知仍早於新聞卡翻牌

### 錯誤現象

- 新聞卡尚未翻開時，玩家先看到「股市行情已更新」通知。

### 根因假設

- `GameView` 已等待本機翻牌動畫完成才呼叫行情更新，但 `GameContext` 仍會直接監聽房間的 `marketUpdates`。
- 其他裝置或延遲快照寫入行情後，`GameContext` 在公開 `currentCardReveal.isRevealed` 尚未成立時就顯示通知，繞過本機動畫 guard。

### 最小驗證步驟

1. 建立股市新聞卡事件，確認 `currentCardReveal.isRevealed === false` 時收到 `marketUpdates` 不顯示行情通知。
2. 將同一張卡的 `currentCardReveal.isRevealed` 改為 `true`，確認同一筆行情只顯示一次。

### 不准再重複的修法

- 不新增固定延遲來猜測翻牌完成時間。
- 不只在 `GameView` 補 guard 而忽略 `GameContext` 的共享行情通知來源。

### 修正與驗證結果

- `GameContext` 收到行情更新時，若目前是尚未揭示的股市新聞卡，先等待公開 `currentCardReveal.isRevealed`。
- `GameView` 同時確認本機翻牌 transition 與遠端揭示狀態，兩者完成後才可寫入行情。
- `src/context/GameContext.test.ts` 新增隱藏股市卡不顯示通知、翻牌後允許通知的回歸測試。
- 聚焦測試 4/4、完整 source Vitest 170 passed／20 skipped、TypeScript、正式建置與 `git diff --check` 通過。

## 2026-08-25 登入同步、幸福歷程、房市與卡片日誌

### 錯誤現象

- 登入與幸福歷程操作偶發顯示「玩家資料同步失敗」。
- 股市卡片尚未完成翻牌動畫，行情更新提示已先出現。
- 放棄購買的不動產偶發沒有進入房市。
- 抽卡日誌偶發漏記，且只有 1～3 筆時無法展開完整卡片內容。
- 經過維修廠會收費；已有汽車保險時沒有一般維修理賠入口。

### 根因假設

- 房間主文件快照直接取代 React room 狀態，會丟失由私人玩家文件 listener 合併的 `playerStates`；設定同步隨即判斷資料缺失並重寫，形成重複同步，幸福歷程也可能短暫讀不到自己的最新資料。
- 股市更新只等待 `isBoardCardRevealed`，沒有等待 700ms 翻牌動畫真正結束。
- 放棄不動產先結束卡片、再用第二個 transaction 上架房市；第二筆失敗時卡片已不可恢復。
- 卡片結案沒有保證補寫當前卡片日誌；日誌只有 1～3 筆時，介面刻意隱藏完整紀錄按鈕。
- `docs/gdd/REPAIR_SYSTEM.md` 明定經過或停留維修廠都要收費；`docs/gdd/INSURANCE_SYSTEM.md` 尚未定義一般保養是否可理賠，因此收費不是程式錯誤，理賠規則不可自行推定。

### 最小驗證步驟

1. 交錯送入房間主文件與私人玩家文件快照，確認主文件更新不再清掉 `playerStates`。
2. 三位玩家同時完成家庭歷程，確認私人結果都保留、事件只推進一次且無同步錯誤。
3. 翻開股市卡，確認行情更新只在翻牌 transition 完成後發生。
4. 放棄不動產時，在同一 transaction 完成卡片結案與房市上架。
5. 卡片結案補寫當前卡片日誌；僅一筆日誌也能切換完整資訊。

### 不准再重複的修法

- 不在登入頁或幸福歷程視窗增加重試 timeout 來遮蔽資料來源競態。
- 不再把卡片結案與房市上架拆成兩次寫入。
- 不以固定延遲猜測翻牌完成時間，使用既有 CSS transition 完成事件。
- 未確認保險規則前，不擅自免除維修費或發放理賠。

### 修正與驗證結果

- 房間主文件更新會保留已 hydrate 的私人 `playerStates`；成功同步後會清除舊的同步失敗通知。
- 家庭歷程玩家交易只讀寫自己的私人文件，不再嘗試讀取其他玩家而觸發 `permission-denied`；最後一位非抽卡玩家完成時，由執行師端以現有 transaction 冪等結案。
- 股市行情更新改為等待卡片 `transform` transition 完成。
- 放棄不動產的卡片結案與房市上架改為同一個 board transaction。
- 一般卡片、家庭歷程與共享流程結案前都會冪等補寫當前卡片日誌；一筆日誌也可展開完整內容。
- 聚焦測試 17/17、完整 source Vitest 163/163、Firestore Emulator rules 19/19、TypeScript、正式建置與差異格式檢查通過。
- 尚未在真實 6 玩家＋1 執行師房間重播；維修廠保險理賠仍等待產品規則確認。

## 錯誤現象

- 玩家完成職業、企業與夢想選擇並進入遊戲後，執行師監控區仍顯示「等待玩家進入遊戲」。
- 該文字只會在執行師已選到玩家、但 `rooms/{roomId}/players/{playerUid}` 沒有可讀狀態時出現。

## 最小重現步驟

1. 執行師建立房間並開始遊戲。
2. 玩家完成職業、企業與夢想選擇。
3. 執行師進入監控頁並選取該玩家。

## 目前錯誤訊息 / log

- UI 顯示「等待玩家進入遊戲」。
- 玩家同步原本使用 `safeAsync`，會把 Firestore 寫入錯誤只留在 console，畫面沒有錯誤提示。
- Firestore Emulator 已證明同一批次可成功建立私有財務文件並更新公開完成狀態，規則不是阻塞點。
- 現場錯誤：`WriteBatch.update() called with invalid data. Unsupported field value: undefined`，位置是 `publicPlayerStates.{uid}`。

## 已嘗試修法

- 執行師路由 effect 已加入 `room.publicPlayerStates` 依賴。
- 玩家完成設定時已改為缺少同步資料就立即寫入，並顯示同步錯誤。
- 公開狀態 helper 已改為先移除 optional `undefined` 欄位。

## 失敗原因

- 上一個修法只處理執行師端重新判斷，沒有證明玩家的私有財務文件確實寫入成功。

## 根因假設

- 玩家完成選擇後仍走一般 800ms 防抖同步；切換到遊戲頁後的連續狀態更新會取消前一個 timeout，造成首次私有財務文件與公開完成狀態延遲或未建立。
- 同步錯誤原本由 `safeAsync` 吞掉，玩家端沒有可見訊息。
- 公開狀態轉換 helper 仍直接保留 optional 欄位的 `undefined`，所以即時同步修法執行時仍然會被 Firestore 拒絕；同一 helper 也被棋盤擲骰交易使用。

## 下一個驗證步驟

- 已完成：公開狀態 helper 清除所有 optional `undefined` 欄位。
- 已完成：公開狀態單元測試 1/1、規則測試 12/12、型別檢查與正式建置。
- 待現場確認：以兩個不同登入帳號建立新房，完成選擇後確認執行師直接顯示財務報表。
- 若仍出現 literal `Quota exceeded`，需等待 Firebase 專案配額重置或調整方案。

## 不准再重複的修法

- 不再只增加執行師端 React effect 依賴。
- 在證明資料已寫入前，不再修改監控頁顯示條件。

## 2026-08-21 線上多人交易與幸福歷程阻斷

### 錯誤現象

- 房市提示已售出但買家仍取得房屋。
- 企業貸款、定存或幸福分享出現現金／資產／幸福點未完整入帳。
- 幸福歷程完成後仍卡住、視窗消失或必須重新整理。
- 執行師關房後重新開局可能卡在舊房間狀態。
- 同一台執行師裝置直播與操作時，遊戲倒數可能落後實際時間。

### 根因假設

- `runRoomBoardMutation` 會把所有讀入的私有玩家狀態重新寫回，舊快照可能覆蓋另一個操作剛提交的資料。
- 房市交易先更新本機財務，再另外移除市場物件，沒有原子交易保護。
- 共用彈窗與幸福歷程仍有本機可見／關閉狀態，且幸福歷程完成依賴來源玩家端 effect。
- 倒數由瀏覽器 `setInterval` 逐秒累減，受背景分頁與裝置負載影響。
- 關房、建立新房及舊房監聽 callback 沒有明確的場次生命週期防護。

### 最小驗證步驟

1. 兩位玩家同時購買同一房屋，確認只有一位取得資產且另一位現金不變。
2. 交易後立即推進棋盤事件，確認最新玩家私有資料不被舊快照覆寫。
3. 幸福歷程讓來源玩家、最後一位參與玩家及執行師分別完成，確認只完成一次。
4. 玩家重整／切換分頁後確認 prompt 仍可恢復，完成後不留下空白視窗。
5. 執行師關房後立即建立新房，確認舊 listener 不會清除新房。
6. 模擬瀏覽器背景五分鐘，確認計時以時間基準而不是 tick 次數計算。

### 不准再重複的修法

- 不再只在 GameView 增加 `setTimeout`、dismissed ID 或刷新後重新讀取的補丁。
- 不再先修改本機財務，再以另一個 Firestore 寫入補救交易結果。
- 不再讓來源玩家瀏覽器 effect 作為幸福歷程唯一收尾者。
- 不再把只讀取的玩家狀態整批寫回 Firestore。

## 2026-07-14 登入與建立房間持續轉圈

### 錯誤現象

- 登入按鈕與建立房間按鈕會一直顯示處理中，無法完成動作。

### 最小重現步驟

1. 開啟 `http://localhost:5173/`。
2. 登入本機測試帳號，或以執行師身分建立房間。
3. 按鈕持續轉圈，頁面沒有完成後續動作。

### 目前錯誤訊息 / log

- Vite `5173` 約 0.006 秒回應，Auth Emulator `9099` 約 0.005 秒回應。
- Firestore Emulator `8080` 雖占用連接埠，但測試請求超過 3 秒完全沒有回應。
- Firestore Java 程序已孤立執行超過 15 小時，無法正常處理讀寫。

### 已執行修法

- 匯出並保留本機 Auth 測試帳號。
- 強制停止失去回應的 Firestore 與舊 Auth Emulator。
- 將 Auth 與 Firestore Emulator 重新以同一組程序啟動。
- 重建本機固定測試帳號的 Firestore 角色文件。

### 確認根因

- Firestore Emulator 程序仍存活但已失去回應。登入後讀取使用者資料、建立房間讀寫資料庫都在等待該程序，因此多個按鈕同時持續轉圈。

### 驗證結果

- Firestore 重啟後約 0.09 秒回覆測試請求。
- Playwright 實測登入成功，無瀏覽器錯誤。
- Playwright 實測建立線上棋盤房間成功，建立房號 `104398` 並進入等待玩家頁。

### 不准再重複的修法

- 多個 Firestore 動作同時卡住時，不再先逐一增加按鈕 timeout；先檢查 `8080` 是否能實際回應，而不只是確認連接埠存在。

## 2026-07-14 執行師尚未正式開始時玩家仍可擲骰

### 錯誤現象

- 玩家完成職業、企業與夢想選擇後，即使執行師監控頁尚未按下中央的「開始遊戲」，玩家仍可擲骰。

### 已嘗試修法

- 玩家按鈕與 `rollBoardDice` 已限制 `room.status === 'playing'`。

### 失敗原因

- 等待房間的第一個「開始遊戲」會先把 `room.status` 改為 `playing`，用途是讓玩家進入選擇流程。
- 執行師監控頁的第二個「開始遊戲」實際上是把 `room.isTimerPaused` 從 `true` 改為 `false`。
- 因此只判斷 `status` 無法區分「玩家選擇中」與「執行師已正式開始」。

### 確認根因

- 正式遊戲是否已由執行師啟動的既有來源是 `room.isTimerPaused`，不是另一個 `status` 值。

### 下一個驗證步驟

- 共用擲骰可用條件與 Firestore mutation 都需在 `isTimerPaused === true` 時拒絕。
- 測試需證明 `status: playing` 但 `isTimerPaused: true` 仍不能擲骰，改為 `false` 後才可擲骰。

### 不准再重複的修法

- 不再只補 `room.status === 'playing'` 判斷。
- 不建立第三個「是否開始」狀態，沿用房間既有的 `isTimerPaused`。

## 2026-07-14 暫停回合沒有生效且投影幕無提示

### 錯誤現象

- 玩家取得暫停回合後，輪到該玩家時仍可照常行動。
- 投影幕會直接顯示目前回合，沒有說明哪位玩家被暫停。

### 確認根因

- `getNextTurnUid` 遇到暫停玩家時同時修改掃描起點與增加位移；兩人房會再次選中原本應跳過的玩家，三人以上也可能選錯下一位。
- C035–C037 與 C039 的卡片資料含 `goToSquare`、`missRounds`，但通用財務卡流程未執行移動與暫停效果。
- 回合交易只儲存最後的 `currentTurnUid` 與扣除後的 `skipTurns`，投影幕不知道中途略過了誰。

### 修正範圍

- 由共用回合計算一次產生下一位、扣除後計數與被暫停玩家清單。
- 醫療、維修與終身學習卡統一透過 `moveCurrentPlayerToSquare` 寫入 `boardState.skipTurns`。
- 回合狀態保存短暫的暫停通知，投影幕先顯示通知，再顯示下一位玩家。

### 下一個驗證步驟

- 兩位玩家：下一位有暫停 1 回合時，計數變 0 且回合留給未暫停玩家。
- 三位玩家：中間玩家暫停時，下一位必須是第三位。
- C035 與 C039 的完成動作需產生移動與暫停效果。

### 不准再重複的修法

- 不再只改玩家端提示；必須以 `boardState.skipTurns` 與共用換回合函式驗證。

### 驗證結果

- 兩人房暫停下一位：正確扣除為 0，回合留給未暫停玩家。
- 三人房暫停中間玩家：正確切換至第三位。
- C035 與 C039 測試確認會寫入指定棋格與暫停 1 回合；全部卡片／回合測試 30/30 通過。
- 型別檢查、正式建置與差異格式檢查通過。

## 2026-07-15 求購卡沒有標的仍可點進行出售

### 確認根因

- 共享求購彈窗會正確產生空的出售標的清單，但 `進入出售` 按鈕只檢查是否已回覆，沒有同步檢查清單是否為空。

### 修正範圍

- 在共享彈窗按鈕層加入空清單停用條件。
- 保留 `handleSharedAssetSaleConfirm` 的空清單處理，讓事件仍可透過 `放棄` 完成。

### 驗證結果

- 求購卡無符合標的時，出售按鈕不可點；有標的時維持原出售流程。

## 2026-07-15 C045 抽卡玩家沒有共享視窗

### 確認根因

- C045 的共享提示收件人依賴當下 `room.members` 快照；抽卡者在成員同步不完整時可能未被加入 `targetPlayerUids`，因此其他玩家看得到，抽卡者看不到。

### 修正範圍

- 建立共享提示時強制加入來源玩家 UID，並在玩家端以來源玩家 UID 作為第二層判斷。
- C045 的全體月支出套用與其他玩家同步流程不變。

### 驗證結果

- 成員快照缺少來源玩家時，共享提示目標仍包含來源玩家；相關測試、型別檢查、建置與差異格式檢查通過。

## 2026-07-15 N027 無持股玩家翻牌後視窗消失

### 確認根因

- N027 共享提示建立成功，但沒有對應股票的玩家會被畫面 effect 自動送出 `no_effect`，因此共享視窗立即關閉，看起來像卡片消失。

### 修正範圍

- 移除現金股利／股票股息共享提示的自動結案。
- 無持股玩家改由按鈕顯示 `關閉` 並自行完成回覆；有持股玩家仍可進入財務檢核。

### 驗證結果

- N027 無持股狀態不再自動關閉共享視窗；相關測試、型別檢查、建置與差異格式檢查通過。

## 2026-07-15 來源玩家共享視窗開啟後卡片消失

### 確認根因

- 共享提示建立成功後，來源玩家流程仍直接執行 `setIsBoardCardDrawerOpen(false)`，因此來源卡片被關閉。

### 修正範圍

- 移除共享提示開啟時的卡片抽屜關閉；改由共享回覆完成與財務結案流程統一關閉。

### 驗證結果

- 共享提示開啟後來源卡片保持顯示；相關測試、型別檢查、建置與差異格式檢查通過。

## 2026-07-15 C014 與求購卡來源玩家未顯示共享視窗

### 錯誤現象

- C014 翻牌後，來源玩家沒有顯示共享出售視窗。
- 同類問題可能影響 C009-C034 全部求購卡。

### 已嘗試修法

- 已確保來源玩家加入共享提示收件人。
- 已保留來源玩家卡片抽屜，避免共享提示建立後卡片直接消失。

### 根因假設

- 來源玩家仍只依賴房間快照 effect 設定 `visibleSharedCardPromptId`；同步時序或殘留的 `sharedCardPromptSnapshot` 可能讓新提示沒有切換成可見狀態。

### 確認根因

- 新共享提示建立成功後，來源玩家沒有立即設定可見提示 ID。
- `sharedCardPromptSnapshot ?? sharedCardPrompt` 會讓不同 ID 的舊 snapshot 優先於新的房間提示，導致新求購事件無法顯示。

### 下一個驗證步驟

- 共享提示建立成功時，來源玩家立即設定該提示 ID 為可見。
- 遠端已無共享提示時清除舊 snapshot。
- 以資料驅動測試確認 C009-C034 全部回傳 `asset_sale` 共享類型與出售動作。

### 不准再重複的修法

- 不再逐張硬編 C014 或其他卡號。
- 不再只調整彈窗 z-index；目前共享彈窗已高於卡片抽屜。

### 驗證結果

- 來源玩家建立共享提示成功時立即設定該提示 ID 為可見。
- 新房間提示會取代不同 ID 的舊 snapshot；房間提示清除時本機 snapshot 同步清除。
- C009-C034 共 26 張求購卡全部通過共享分類與出售動作測試。
- 相關測試 37/37、型別檢查、正式建置與差異格式檢查通過。

## 2026-07-15 H011 共享玩家擲骰後來源卡片消失

### 錯誤現象

- H011 的共享玩家擲完骰子後，抽卡玩家的家庭重要歷程卡片立即消失。
- 同一套共享流程會影響其他家庭重要歷程卡，不是 H011 單卡資料問題。

### 已嘗試修法

- 玩家畫面先前已限制：只有抽卡玩家已完成自己的處理時，才允許在共享回覆完成後自動結案。
- 問題仍存在，表示卡片不是由畫面自動關閉，而是房間事件狀態被提前推進。

### 確認根因

- `submitFamilyMilestoneJoinResponse` 在最後一位共享玩家送出骰子結果時，直接推進棋盤事件並清除 `familyMilestoneJoinPrompt`，造成抽卡玩家的目前卡片一起消失。
- 擲骰成功的回覆只代表取得參加資格，玩家仍要選擇參加或不參加；目前卻在骰完時就被視為完整回覆。

### 修正範圍

- 共享玩家的擲骰只記錄回覆與待處理動作，不再負責推進來源玩家的棋盤事件。
- 擲骰成功的回覆要等參加選擇完成後才算完整；失敗或主動放棄則立即完整。
- 抽卡玩家保留來源卡片，並由原本的卡片完成流程統一結案。
- 用資料驅動測試覆蓋全部家庭重要歷程卡。

### 下一個驗證步驟

- 驗證成功擲骰但尚未選擇參加時，共享提示仍為未完成。
- 驗證完成參加／不參加後，共享提示才允許來源玩家結案。
- 執行家庭歷程聚焦測試、型別檢查、正式建置與差異格式檢查。

### 不准再重複的修法

- 不針對 H011 卡號硬編條件。
- 不只補彈窗顯示或延長關閉時間；必須修正房間層事件所有權與完成條件。

### 驗證結果

- 最後一位共享玩家送出骰子結果時，只更新家庭歷程提示，不再推進或清除來源卡片事件。
- 擲骰成功後維持未完成，直到玩家完成參加／不參加；擲骰失敗或直接放棄則可立即完成回覆。
- 資料驅動測試確認 14 張家庭重要歷程卡都使用相同的共享選擇流程。
- 家庭歷程與房間聚焦測試 35/35、型別檢查、正式建置與差異格式檢查通過。

## 2026-07-15 H020 共享骰完後來源卡片仍消失

### 錯誤現象

- H020 的共享玩家完成骰子後，原抽卡玩家的卡片畫面消失。
- 房間層已不再由共享回覆直接推進事件，問題仍在玩家端結案時序。

### 根因假設

- 原玩家先完成自己的卡片選擇後，`pendingHandledBoardCard` 會等待共享回覆。
- 最後一位共享玩家完成回覆時，玩家端 effect 自動呼叫 `finalizeBoardFinancialFlow`，使卡片在原玩家沒有再次確認的情況下結案並消失。

### 確認根因

- 房間層的 `currentCard` 與共享提示更新均正常保留；消失是玩家端自動結案 effect 所造成。
- 原玩家進入等待狀態時，`markBoardCardHandled` 也會主動關閉卡片抽屜，使來源卡片的顯示權仍由本機暫存流程控制。

### 下一個驗證步驟

- 來源玩家等待共享回覆時，卡片必須保持顯示並鎖定為等待狀態。
- 共享回覆完成後，只把按鈕改為可完成，不得自動呼叫卡片結案。
- 執行家庭歷程與房間聚焦測試、型別檢查及差異格式檢查。

### 不准再重複的修法

- 不修改 `submitFamilyMilestoneJoinResponse` 已正確保留來源事件的邏輯。
- 不針對 H020 卡號加特例；修正全部家庭重要歷程共用的來源卡片完成流程。

### 驗證結果

- 來源玩家完成自己的動作後，卡片保持顯示並鎖定為「等待其他玩家完成」。
- 共享回覆全部完成後只解鎖「完成卡片」，不再自動結案。
- 家庭歷程與房間聚焦測試 39/39、型別檢查、正式建置與差異格式檢查通過。

## 2026-07-15 舊房間玩家資料同步被 Firestore 規則拒絕

### 錯誤現象

- 玩家同步時顯示 `PERMISSION_DENIED`。
- 規則錯誤同時包含 `publicPlayerStates is undefined` 與超過 1000 次運算上限。

### 根因假設

- 舊房間文件沒有 `publicPlayerStates`，但玩家公開資料規則直接讀取該欄位並做差異比對。
- 該規則分支發生錯誤後繼續評估其他較重的更新分支，最後超過規則運算上限。

### 下一個驗證步驟

- 建立缺少 `publicPlayerStates` 的舊房間，批次寫入玩家私有資料與自己的公開投影。
- 現行規則應重現拒絕；加入舊欄位空映射相容後，同一測試必須通過。

### 不准再重複的修法

- 不修改玩家同步資料內容或增加重試；寫入格式合法，問題在規則對舊房間的相容性。
- 不放寬玩家只能更新自己公開資料的安全限制。

### 確認根因與驗證結果

- 新增的舊房間回歸測試在修正前穩定重現相同的缺少欄位與運算上限錯誤。
- 規則將缺少的 `publicPlayerStates` 視為空映射後，同一批次同步成功。
- Firestore 房間權限測試 14/14 通過。

## 2026-07-15 H012 不接受後無法結束回合

### 錯誤現象

- H012 抽卡玩家點擊不接受／關閉後，卡片消失但結束回合仍被鎖住。

### 根因假設

- 家庭重要歷程翻牌時會建立其他玩家參與提示。
- 通用卡片關閉流程看到提示尚未完成就拒絕結案，沒有處理「主玩家不接受時整張卡立即無效果」的規則。

### 下一個驗證步驟

- 驗證只有來源玩家關閉同一事件、同一卡片時可取消家庭參與提示。
- 驗證其他玩家、不同事件或一般共享卡仍不得提前結案。

### 不准再重複的修法

- 不只在畫面上強制啟用結束回合按鈕；必須真正清除房間內的目前事件與家庭共享提示。
- 不針對 H012 卡號硬編，修正全部家庭重要歷程共用的拒絕流程。

### 確認根因與驗證結果

- `dismissBoardCard` 原本在任何共享提示未完成時都直接拒絕，主玩家的不接受也無法結案。
- 現在只有來源玩家關閉同一張家庭歷程卡時，會先取消該家庭共享提示再推進事件。
- 家庭卡、房間與回合聚焦測試 41/41 通過。

## 2026-07-15 執行師緊急回合解鎖

### 修正範圍

- 新增「解除目前事件」：清除棋盤流程與玩家等待動作，保留目前玩家及擲骰狀態。
- 新增「強制結束回合」：完成同一清理後直接換到下一位，並沿用暫停回合扣除規則。
- 兩項操作皆由執行師流程面板二次確認，不回滾已完成的財務異動。

### 驗證結果

- 共用流程清理函式保留 `currentTurnUid` 與 `hasRolledThisTurn`，並清除事件、卡片、移動、佇列及共享提示。
- 回合與房間聚焦測試 10/10、型別檢查、正式建置與差異檢查通過。

## 2026-07-15 H016 接受或關閉後仍無法結束回合

### 錯誤現象

- H016 抽卡玩家接受並完成處理，或直接不接受／關閉後，結束回合仍被鎖住。

### 確認根因

- 應用程式會清除來源卡片與家庭共享提示，但 Firestore 規則在提示存在時只允許受邀玩家更新回覆。
- 抽卡來源玩家不在 `targetPlayerUids`，因此來源玩家結束自己的家庭歷程事件時被拒絕，`currentEvent` 留在房間內。

### 下一個驗證步驟

- 建立 H016 來源事件及家庭共享提示，由來源玩家移除提示並結束目前事件。
- 現行規則應拒絕；修正後同一測試必須通過，且非來源玩家不得取得此權限。

### 不准再重複的修法

- 不再修改 H016 卡片按鈕或本機顯示狀態；真正失敗點是房間寫入權限。
- 不開放一般玩家任意清除共享提示，只允許目前事件的來源玩家完成同一事件。

### 驗證結果

- 修正前新增的 H016 來源玩家結案測試穩定重現 `PERMISSION_DENIED`。
- 規則現在允許目前回合來源玩家移除自己同一事件的家庭共享提示並完成事件。
- 受邀但非來源玩家的相同寫入仍被拒絕。
- 卡片現在只在後端確認結案後才標記已處理；寫入失敗會保留卡片供玩家重試。
- Firestore 房間權限測試 15/15、玩家流程聚焦測試 42/42、型別檢查、正式建置與差異檢查通過。

### 2026-07-15 不接受按鈕仍無法完成

- 已確認前端 `markBoardCardHandled` 在呼叫後端前，會先以未完成的家庭共享提示阻擋所有結案。
- H016 的「不接受」雖然正確解析成 `dismiss`，仍被上述前端條件提前返回，因此後端修正沒有機會執行。
- 修正必須只放行來源玩家明確選擇 `dismiss` 的家庭歷程事件；一般完成卡片仍須等待共享玩家完成。
- 回歸測試需同時確認：來源玩家明確不接受可結案、接受後的一般完成仍等待、非來源玩家仍不可結案。
- 已加入共用守門判斷，H016 來源玩家明確不接受時可呼叫既有後端結案；其餘共享等待限制維持不變。
- 家庭歷程、玩家畫面與房間聚焦測試 39/39、型別檢查及正式建置通過。

## 2026-07-16 iPhone 底部保留過多安全區

### 錯誤現象

- iPhone 開啟玩家頁面時，底部留下明顯的 Home Indicator 空白區，畫面看起來未滿版。
- 修正 `100vh` 與手機捲動容器後仍存在。

### 已嘗試修法

- `#root` 改用實際可視高度。
- 大廳與等待房間改為手機可捲動。
- 高度來源改為 `visualViewport.height`。

### 失敗原因

- 上述修改處理的是視窗高度與內容裁切，沒有處理遊戲底部操作列重複套用安全區。

### 確認根因

- `GameView` 根層套用一次 `pb-safe`。
- `GameActions` 外層再套一次 `pb-safe`。
- `GameActions` 內層又把 `safe-area-inset-bottom` 加進 padding，iPhone 因此保留兩到三倍底部安全距離。

### 下一個驗證步驟

- 遊戲根層不再保留底部安全 padding。
- 底部操作列只在內層保留一次 Home Indicator 安全距離。
- 搜尋確認 `GameView` 與 `GameActions` 不再重複套用安全區，並通過型別檢查與正式建置。

### 不准再重複的修法

- 不再調整 `100vh`、大廳捲動或增加額外 safe-area padding。
- 不完全移除 Home Indicator 安全距離，避免主要按鈕落在系統手勢區。

### 驗證結果

- `GameView` 與 `GameActions` 的外層重複 `pb-safe` 已移除。
- 底部操作列只保留 `max(0.5rem, env(safe-area-inset-bottom))` 一處安全距離，不再累加。
- 等待房間外層的重複安全區也已移除，由 `RoomView` 單一負責。
- `npm run typecheck`、`npm run build` 與 `git diff --check` 通過。

### 全螢幕模式後續根因

- iPhone 加入主畫面後以 `standalone` 模式啟動，`viewport-fit=cover` 已正確設定。
- 啟動腳本仍一律優先使用 `visualViewport.height`；iOS 全螢幕模式下此值可能已扣除底部安全區，使 `#root` 提前結束。
- 修正方向：全螢幕模式使用 `window.innerHeight`，一般瀏覽器才使用 `visualViewport.height`，不再增加額外 safe-area padding。
- 已依顯示模式分流高度來源，`npm run typecheck`、`npm run build` 與 `git diff --check` 通過；待實機完全關閉並重開主畫面 App 驗證。

### 第二次實測結論

- 以 `390x844` 手機尺寸讀取版面時，`html`、`body`、`#root` 與 `--app-height` 均完整為 `844px`，排除根容器提前結束。
- 實際斷層來自背景色：玩家頁使用 `#102f38`，但 `html`、`body`、安裝資訊與全螢幕主題仍使用深黑色或不同顏色。
- iPhone Home Indicator 區域會露出最底層背景，因此看起來像頁面被切掉；修正應統一底層與全螢幕主題背景，不再修改高度或增加 padding。
- 已將 `html`、`body`、PWA `background_color`、`theme_color` 統一為 `#102f38`，並更新 manifest 版本避免沿用舊快取。
- 修正後以 `390x844` 驗證三層高度均為 `844px`，底層背景與主題色均為 `#102f38`；型別檢查、正式建置與 `git diff --check` 通過。

### 正常版本對照結論

- 正常參考版不使用 `viewport-fit=cover`、JavaScript 視窗高度或 safe-area 底部補償。
- 正常參考版固定 `html/body` 與 App 外框，頁面直接使用原生 `100dvh`，底部工具列固定在可用視窗底部上方。
- 本次改為完整恢復這套單一高度來源，避免 JavaScript、Flex、動態視窗與 safe-area 同時計算。
- 已移除舊高度腳本與 `viewport-fit=cover`，恢復固定滿版外框、`100dvh` 及工具列固定底距。
- `390x844` 驗證 `html`、`body`、`#root`、App 外框均為 `844px`，App 底部為 `844px`；型別檢查、正式建置及差異檢查通過。

## 2026-07-16 教學與結算仍為深色、結算無法捲動

### 錯誤現象

- 教學彈窗與結算畫面的內容卡已改為暖色，但畫面外圍底色仍是深色。
- 結算內容超過手機高度後，底部總分與操作按鈕無法滑到。

### 已嘗試修法

- 只修改教學與結算內層卡片、文字及按鈕配色。
- 結算明細區保留自己的 `overflow-y-auto`。

### 失敗原因

- 教學與結算的全螢幕根容器仍明確使用 `#102f38` 深色背景。
- 投影幕結算另有一個獨立的 `bg-slate-950` 根容器。
- 結算同時使用外層固定高度、卡片 `overflow-hidden`、明細區獨立捲動，卡片本身沒有可靠的可用高度，內容因此被裁切。

### 根因假設

- 深色不是快取，而是兩個根容器仍存在的明確樣式。
- 結算應改為單一卡片捲動容器，移除內外層互相競爭的捲動與裁切設定。
- 玩家頁根容器的 `touch-none` 會阻止結算子層接收手機垂直滑動手勢。

### 下一個驗證步驟

- 搜尋確認兩個根容器改為暖色背景。
- 確認結算卡片具有視窗高度上限與 `overflow-y-auto`，明細區不再建立第二個捲動區。
- 確認玩家頁根容器不再禁止所有觸控手勢，結算容器明確使用 `touch-pan-y`。
- 執行型別檢查、正式建置與差異檢查。

### 不准再重複的修法

- 不再只修改內層卡片顏色。
- 不再增加新的巢狀捲動容器或額外固定高度。

### 驗證結果

- 教學、玩家結算、執行師內嵌結算與投影幕結算的根底色已統一為 `#f4e6d0`。
- 玩家結算卡片現在是唯一主要捲動區，明細不再建立第二層捲動。
- `GameView` 根層已移除 `touch-none`，手機結算可接收垂直滑動手勢。
- 相關測試 9/9、型別檢查、正式建置與 `git diff --check` 通過。

## 2026-08-13 玩家端 3D 骰子面出現接縫線

### 錯誤現象

- 玩家端骰子的上面與左側面出現白色或深色接縫，靜止時最明顯。
- 將六個面改成 `-inset-px` 並移除圓角後，接縫變成向外突出的尖線，問題更嚴重。

### 最小重現步驟

1. 開啟玩家遊戲畫面並進入棋盤模式。
2. 查看底部中央靜止骰子。
3. 以目前預設旋轉角度觀察骰子上方、左側與正面交界。

### 已嘗試修法

- 六個面由 `inset-0` 改成 `-inset-px`，希望用重疊遮住縫隙。
- 六個面與內核移除圓角，希望避免圓角透明區露出底色。

### 失敗原因

- 面板放大到 66px 後仍使用 64px 骰體的 `translateZ(31px)`，旋轉面彼此穿插並突出外框，因此產生更明顯的尖線。
- 單純放大面板或移除圓角沒有維持「面尺寸的一半 = Z 軸位移」的立方體幾何關係。

### 根因假設

- 接縫來自面尺寸、Z 軸位移與圓角三者不一致，而不是骰點、陰影或旋轉動畫。
- 恢復精確面尺寸，並令手機 `52px / 2 = 26px`、桌面 `64px / 2 = 32px`，可消除平面穿插；面板本身保持無圓角可避免透明角落。

### 下一個驗證步驟

- 先用瀏覽器截圖保存目前尖線狀態。
- 僅恢復 `inset-0` 並把 Z 軸位移改為 26px / 32px，再以相同畫面截圖比較上方與左側接縫。
- 通過型別檢查與差異檢查。

### 不准再重複的修法

- 不再使用負 inset 放大六個立體面。
- 不再只調整圓角或陰影而忽略面尺寸與 Z 軸位移。

### 使用者補充與第二次根因

- 使用者指的是彈窗內部底色，不是全螢幕外圍。
- 教學內容內的四組 UI 示意仍完整使用 `bg-slate-800/900/950`、`text-white` 與 `text-slate-*`。
- 教學與結算主卡使用共用 `Card`，該元件預設帶有 `bg-slate-800`；一般暖色 class 未明確保證覆蓋優先權。
- 下一次修正必須限定在教學示意範圍內轉換深色 slate，並以重要層級固定兩個主卡的暖色底。

### 第二次修正與驗證

- 教學彈窗的內嵌示意區新增限定範圍，只在該區將舊的深色 slate 背景、邊框與文字轉為暖色，不影響遊戲其他元件。
- 教學與結算主卡以明確優先權固定為米白底與金色邊框，避免共用 `Card` 的深色預設值覆蓋。
- 綠色與紅色操作按鈕仍保留白字，避免暖色文字覆寫降低對比。
- 相關測試 9/9、型別檢查、正式建置與 `git diff --check` 通過。

### 骰子幾何修正結果

- 六個面已恢復 `inset-0`，不再向外放大或互相穿插。
- Z 軸位移改為手機 26px、桌面 32px，精準等於骰面尺寸的一半。
- `npm run typecheck`、骰面測試 1/1 與 `git diff --check` 通過；玩家登入畫面仍需沿用使用者遊戲狀態做最終目視確認。

### 2026-08-13 骰子尖角後續

- 現象：接縫修正後六個面使用 `rounded-none`，外輪廓過於尖銳。
- 根因假設：尖角只來自骰面圓角被完全移除，立方體尺寸與深度不需再調整。
- 最小驗證：保持 `inset-0` 與 26px / 32px 深度不變，只將骰面改為 4px 小圓角，再通過型別、骰面測試與差異檢查。
- 不准重複：不再放大骰面、不再更動 Z 軸深度，也不恢復會產生明顯缺角的 8px 以上圓角。
- 驗證結果：已套用 4px 小圓角；型別檢查、骰面測試 1/1、差異檢查與正式建置通過。
- 使用者希望再圓一些；下一個最小調整是 6px，仍低於曾產生明顯缺角的 8px，且不改動立方體幾何。

## 2026-08-19 先行版封測 13 項流程阻斷問題

### 根因假設

- pending request 以玩家 UID 作為本機處理識別，導致同一玩家後續核准被當成舊請求；board share 也未完整綁定 boardEventId。
- familyMilestoneJoinPrompt 允許抽卡玩家在參與者尚未完成時直接清除，且 GameView 的 family snapshot 在遠端 prompt 消失後仍可能被使用。
- 共同行動目標名單在 transaction 外使用舊的 room.members 建立，造成離開玩家或漏同步玩家進入錯誤等待人數。
- 骰子與 startup upgrade 的交易前置資料來自舊的本機 playerStates；店面收購公式將加價百分比誤當成最終百分比。
- 房市移除使用舊快照 updateDoc 且吞掉錯誤；房屋保險一次送出全部物件，但規則是每棟一張保單。

### 修正驗證要求

- 同一玩家連續兩次分享核准、幸福歷程多玩家並發回覆、重整及切換分頁均必須維持同一 boardEventId。
- family prompt 只有在 sourceActionCompleted 且所有符合資格玩家完成後才能結案。
- C023-C026、雙骰、startup upgrade、房市競買與逐棟房屋保險需有回歸測試。

### 已完成修正

- 請求處理改用類型、玩家、事件、卡片與時間組成的執行鍵；故事分享與 board share 都綁定 boardEventId。
- family prompt 不再允許未完成時由來源玩家清除；來源拒絕改為先標記 sourceActionCompleted，規則與 transaction 都要求所有回覆完成。
- family snapshot 在遠端 prompt 消失或切換時清除；家庭視窗不再覆蓋房市、銀行及其他高優先流程。
- 共同行動名單在 transaction 內從最新 members 建立並排除離開玩家。
- 骰子與 startup upgrade 改讀 transaction 最新私人玩家狀態；C023-C026 店面收購改為原價加溢價。
- 房市移除改用最新 transaction 並回報競買失敗；房屋保險改為逐棟、每棟每月 2,000。

### 驗證結果

- 核心單元測試 60/60 通過。
- 完整 source Vitest 137/137 通過；`e2e/` 兩個 Playwright 檔案不應直接由 Vitest 收集，已知為測試命令設定問題。
- Firestore emulator rules 15/15 通過。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。

## 2026-08-20 先行版封測 7 項登入與幸福歷程問題

### 新增根因假設

- Firebase Auth 預設使用跨分頁持久化，同一個 Chrome 使用者在第二、第三分頁登入不同帳號時，會讓先前分頁的 Firebase UID 一起切換；因此房間 prompt 看似從一個帳號轉移到另一個帳號。
- `GameContext` 的本機狀態 hydrate ref 只在首次掛載後生效，UID 切換時可能沿用上一個帳號的 `completedHappinessEvents`、家庭階段與待同步資料。
- 玩家私有狀態尚未完成 hydrate 時，GameContext 的防抖同步仍可能先寫入 rooms/{roomId}/players/{uid} 及 publicPlayerStates，帳號切換或成員資料尚未完成時會產生同步異常視窗。
- 既有房間可能殘留 sourceEventId 與 currentEvent 不一致的 family/shared prompt；目前畫面雖部分阻擋顯示，但遠端殘留仍可能阻止下一回合。

### 最小驗證步驟

- 同一 Playwright browser context 建立三個 page，分別登入三個測試帳號，確認每頁 Firebase UID 與玩家名稱保持獨立。
- 在 UID A 切換至 UID B 的單元測試中，確認本機遊戲狀態、session ref 與同步錯誤不會跨帳號保留。
- 使用 Firestore Emulator 建立過期 family prompt，確認執行師恢復 transaction 只清除過期 prompt 與對應 pending action，不影響目前事件。
- 以三個玩家並發回覆及並發家庭骰測試，確認 response 合併且只有完整條件成立後才推進事件。

### 不准再重複的修法

- 不再以 `localStorage` 的單一 Firebase Auth 持久化支援同一瀏覽器多帳號分頁測試。
- 不再在 UID 尚未確認、私有玩家狀態尚未 hydrate 或目前玩家不是房間成員時執行 GameContext 自動同步。
- 不再只清除 React 本機 family snapshot 而保留與目前事件不一致的遠端 prompt。

### 2026-08-20 修正與驗證結果

- Auth 改用 `browserSessionPersistence`，每個分頁各自保存登入狀態；登入、註冊及 redirect 初始化都等待 persistence 完成。
- UID 變更時重置 GameContext 本機遊戲狀態、session、紀錄與提示；只有私有玩家狀態 hydrate 完成、仍是房間成員且 UID 未變更時才允許自動同步。
- GameView 只接受與目前 `currentEvent`／`currentCard` 相符的 family/shared prompt；執行師恢復房間時，會以 transaction 清理過期 prompt、對應 pending action 與同事件 request。
- 來源玩家的幸福歷程仍必須完成自己的動作，不能提前移除 prompt；多人回覆與並發擲骰仍由既有交易流程合併及判定。
- 同一 browser context 的 3 個玩家分頁驗收通過；3 玩家建立房間、加入、準備、開始及投影回歸通過。
- 完整 source Vitest：26 files、138 passed、15 rules tests skipped（另以 Firestore emulator 驗證 15/15）。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。

### 尚未涵蓋

- 尚未用真實 3 個帳號完整重播全部 7 個封測情境；本次已驗證根因修正、分頁隔離、多人房間流程及規則測試，下一步應針對 H016／共享回覆／重整逐項做瀏覽器劇本回歸。

## 2026-08-20 雙骰拋擲動畫黏成一體

### 錯誤現象

- 買車後選擇雙骰時，兩顆骰子共用同一個拋擲位移與旋轉，看起來像一個長方體翻滾。
- 落地過程共用旋轉重設計時器，可能在 3.5 秒動畫結束前突然跳回觀看角度。

### 最小重現步驟

1. 進入玩家棋盤遊戲並確認持有汽車。
2. 切換為雙骰，擲出權威結果，例如 `[2, 5]`。
3. 觀察 3500ms 動畫期間兩顆骰子的位移、旋轉與落地結果。

### 根因假設

- `GameActions` 目前以單一 `diceControls` 綁定整個 `motion.button`；雙骰只是同一容器內並排兩個骰體，因此兩顆骰子沒有獨立的軌跡或旋轉。
- 結果值在動畫開始前就寫入 `diceResults`，而共用落地計時器再重設整個容器，造成結果面與旋轉重設不同步。

### 修正前最小驗證

- 靜態檢查確認只有一個 `useAnimation()` 控制器，且 `motion.button` 直接承擔 `x/y/z/rotate/scale`。
- 測試需證明雙骰有兩個獨立動畫節點、結果在第一次落地後固定、3500ms 只通知一次；單骰與擲骰失敗仍可操作。

### 不准重複的修法

- 不再以同一個動畫 controller 控制兩顆骰子。
- 不再修改骰子面尺寸、`translateZ` 或購車／雙骰權威規則來掩蓋動畫問題。

## 2026-08-20 幸福家庭歷程完成後結束回合被鎖住

### 確認根因

- 家庭歷程的 source action 與所有參與者動作完成後，Firestore prompt 已具備完整結案條件，但玩家端沒有像共享卡流程一樣自動呼叫既有 `dismissBoardCard()`。
- `currentEvent` 因此仍保留在房間狀態；`getBoardActionAvailability()` 看到目前事件仍存在，正確阻擋「結束回合」。
- 問題不是直接放寬回合按鈕，而是缺少「完成條件成立 → 清除目前事件」的狀態轉換。

### 修正內容

- 新增家庭歷程完成判斷，要求目前事件／卡片、抽卡玩家、source action 及所有參與者狀態全部一致且完成。
- 抽卡玩家收到最後一個完成同步後，自動呼叫既有 `dismissBoardCard()`；加入事件級執行鎖，避免多人同步造成重複結案。
- 保留「完成卡片」作為寫入失敗時的手動重試入口；未完成的參與者仍會維持等待狀態。

### 驗證結果

- 家庭／棋盤相關單元測試：56/56 通過。
- Firestore 規則測試：15/15 通過；原本 npm wrapper 因 8080 已有既存 emulator 而無法啟動，改連線至該 emulator 後驗證成功。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。

### 尚未涵蓋

- 尚未使用真實 3 個帳號重播「抽卡者最後完成」及「其他玩家最後完成」的瀏覽器流程；下一步是建立新房重播 H016/H011，確認遠端事件清除後結束回合按鈕恢復可用。

## 2026-08-20 家庭歷程五階段個人進度修正

### 確認根因

- 其他玩家擲骰達到 4 點後，流程仍先等待 2.5 秒才關閉擲骰結果，造成參與選擇延遲或看似沒有觸發。
- 待處理參與動作只保存卡片與事件，沒有保存該玩家當下的階段；重整或前一階段完成後，畫面會重新計算下一階段，因而顯示錯誤階段或要求重複完成。
- 玩家端同步時以舊本機 pending action 回填遠端缺少的欄位，讓已完成／已清除的待處理動作再次出現。

### 修正內容

- 五個家庭階段仍依序處理，但每位玩家在 transaction 中從自己的最新玩家資料取得第一個未完成階段，並把 `stageProgressId` 固定寫入回覆與 pending action。
- 擲骰通過後立即進入該玩家自己的參與選擇；未通過仍保留原本的結果提示時間。
- 家庭階段 action resolver 使用保存的玩家階段快照，不再由抽卡玩家或目前畫面狀態推算；五階段皆完成時不再建立下一個參與 action。
- 遠端玩家狀態視為權威來源，明確清除不存在的 `pendingFamilyMilestoneJoinAction`，避免舊本機資料復活。

### 驗證結果

- 家庭流程與 GameView 相關測試：55/55 通過。
- Firestore rules emulator：15/15 通過。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。

### 尚未涵蓋

- 尚未使用三個真實帳號重播「兩位玩家同時擲骰、各自不同階段、重整後繼續」的完整瀏覽器流程；下一步使用新房間驗證 H016 五階段與結束回合。

## 2026-08-22 五項封測流程異常

### 根因假設

- 家庭歷程先由 `handleTransactionSubmit` 更新本機玩家資料，再以另一筆 Room transaction 標記 prompt 完成；最後一位玩家同時操作時，事件可能先推進，但私有玩家資料尚未寫入。
- 家庭歷程現金檢查讀取本機 `gameState.cash`，與 Firestore 最新玩家文件不是同一個一致性邊界，可能出現交易已套用但提示仍判定現金不足。
- 卡片結案可把分段移動恢復為 `movement.isActive`，但只有 `advanceBoardEventQueue` 會安排正式結算；`dismissBoardCard` 與家庭 prompt 自動結案缺少相同排程。
- 不動產新聞卡在通用 `markBoardCardHandled` 中無條件呼叫 `abandonRealEstateCard`，導致抽卡玩家已購買後仍被上架。
- 卡片日誌只依部分事件建立路徑寫入，翻牌交易沒有冪等補記。

### 最小驗證步驟

- 以最新玩家文件執行家庭歷程交易，驗證現金、幸福階段、prompt 完成與事件推進在同一 transaction 中提交。
- 由一般卡片與家庭 prompt 兩種結案入口恢復分段移動，確認相同 command ID 只結算一次並繼續落點事件。
- 驗證同一 `eventId + cardId` 多次翻牌只保留一筆日誌。
- 驗證抽卡玩家購買不動產後不進房市，只有明確放棄才上架。

### 不准再重複的修法

- 不再以放寬結束回合按鈕掩蓋未結案的棋盤事件。
- 不再讓家庭歷程先更新本機財務、再靠防抖同步補寫 Firestore。
- 不再把房市上架放在無法辨識購買結果的通用關卡函式。

### 修正與驗證結果

- 家庭歷程接受／拒絕改由單一 Room transaction 讀取最新私有玩家文件，同時更新現金、幸福階段、pending action、prompt 與事件推進；現金不足會中止整筆交易。
- 學校考試後抽卡加入最新事件驗證；所有 `movement.isActive` 由移動玩家依同一 command ID 自動結算。
- 翻牌交易以 `eventId + cardId` 冪等補寫卡片日誌。
- 抽卡玩家購買不動產改為原子交易並直接結案；通用卡片關閉不再自動上架，只有明確放棄才加入房市。
- 相關測試 67/67、完整 source 159/159、Firestore Rules 19/19、型別檢查、正式建置與差異檢查通過。
- 三玩家分頁帳號隔離及「執行師建立房間、3 玩家加入／設定、投影同步」Playwright 回歸通過。

### 尚未涵蓋

- 尚未建立 6 玩家同時完成家庭歷程、學校後續卡及不動產自購的完整瀏覽器自動化劇本；需用新測試房進行實際 6 人回歸。

## 2026-08-26 四項跨場與交易一致性異常

### 錯誤現象

- 同一房間開始新局時，玩家可能跳過職業、目標事業與人生夢想選擇，並帶入上一局的幸福值。
- 玩家放棄不動產新聞卡後，房屋未必進入房市。
- 同一筆股市行情更新通知會在後續玩家操作後反覆跳出。
- 玩家完成 N056-N058 創業貸款財務檢核後，現金、企業資產、貸款與利息可能未保留。

### 根因假設

- App 與 GameContext 只在寫回時檢查 `boardGameStartedAt`，讀取遠端玩家快照時仍會接受上一場資料；新局重設後若再收到舊快照，就會恢復 `isSetup` 與舊幸福值。
- 房產卡抽屜右上角關閉會標記明確放棄，但卡片內容中的「關閉」直接呼叫一般結案，沒有帶入房市上架意圖。
- `mergeAuthoritativePlayerState()` 以遠端完整覆蓋本機 `lastMarketUpdateTimestamp`；延遲快照可把已處理時間倒退，讓同一行情再次觸發。
- 創業貸款先由 `handleTransactionSubmit()` 更新本機，再以另一筆 transaction 寫入待升級狀態與共享回覆；該 transaction 觸發的舊玩家快照會在防抖同步前覆蓋本機財務結果。

### 最小驗證步驟

- 將上一場 `boardGameStartedAt` 的完成玩家狀態送入新場 `room.startedAt`，確認 App 不視為可恢復存檔，GameContext 也不合併。
- 從不動產卡片內按鈕與抽屜關閉兩條路徑放棄，確認兩者均由同一 transaction 上架且只保留一筆。
- 先把本機行情已讀時間設為新值，再合併較舊遠端值，確認時間不會倒退；更大的遠端值仍可前進。
- 三位玩家對同一創業貸款 prompt 送出接受，確認每人的財務、待升級狀態與回覆在單一 transaction 保留；同一玩家重送不得重複入帳。

### 不准再重複的修法

- 不以延遲、重試或第二次畫面重設掩蓋跨場快照污染。
- 不再由各個房產關閉按鈕自行判斷上架，統一走既有明確放棄入口。
- 不以關閉通知彈窗作為股市已讀權威，已讀時間必須維持單調遞增。
- 不再讓創業貸款先改本機、再等待一般防抖同步補寫 Firestore。

### 2026-08-26 修正與驗證結果

- App 與 GameContext 都只接受 `boardGameStartedAt === room.startedAt` 的玩家存檔；不同場次會重新走「職業 → 目標事業 → 人生夢想」，初始幸福固定為 0，同一場重連仍可恢復。
- 房產卡內容內的「關閉」與抽屜關閉統一走明確放棄入口；既有 transaction 會結案並用 Set 冪等上架，購買成功不會進房市。
- 玩家快照合併時，`lastMarketUpdateTimestamp` 取本機與遠端較大值，舊快照不會讓同一行情通知復活。
- N056-N058 接受流程改由 `completeStartupLoanAction()` 在單一 Room transaction 內讀取卡片規則，原子寫入現金、企業資產、企業貸款、利息、財務歷史、待升級狀態與共享回覆；`promptId + playerUid` 防止重複入帳。
- 聚焦測試 66/66、完整 source Vitest 169 passed／20 rules skipped、Firestore Emulator 規則 20/20、TypeScript、production build 與 `git diff --check` 通過。
- Firestore Emulator 另以三筆並行 transaction 驗證三位玩家結果皆保留且 prompt 只結束一次；規則權限仍由同檔 20 項測試獨立驗證。
- Playwright 驗收通過：執行師建立房間、3 玩家同時完成三步選擇、共用大地圖同步，以及同瀏覽器多分頁帳號隔離，共 2/2 passed。
- E2E 必須明確使用 `VITE_USE_EMULATOR=true`，且 Auth Emulator／seed／App 的 project ID 都需為 `happinessflow-online`；否則會錯連雲端或顯示找不到測試帳號。

## 2026-08-26 五項遊戲與執行師功能修正

### 根因確認

- 家庭歷程抽卡者原本仍建立 `family_milestone` 執行師核准請求，造成抽卡者與執行師等待不同步。
- 家庭財務檢核的交易失敗結果只用 boolean，現金不足、過期事件與同步失敗被混成同一個提示。
- 執行師端把財務報表放在第二層 `overflow-y-auto` 容器，手機高度不足時上方區塊把報表壓縮或裁切。
- 全體補助以 `financialSubsidy` 是否存在作一次性 guard，且所有玩家共用固定交易 ID。

### 修正結果

- 抽卡者接受／拒絕家庭歷程直接進入既有原子結算；一般故事分享仍保留執行師核准。舊 `family_milestone` 請求會從執行師待審核清單清除。
- 家庭交易回傳 `applied`、`duplicate`、`requires_funding` 或 `failed`；以 transaction 的最新玩家現金判定，失敗時保留財務檢核答案。
- 執行師選中玩家內容改為單一垂直捲動區，移除報表內層捲動；尚未同步或尚未完成初始選擇時顯示明確狀態。
- 全體補助以房間內遞增 `sequence` 建立 `room:sequence` 交易 ID，可重複發放；遊戲結束仍拒絕，Firestore 規則也禁止跳號與玩家寫入。

### 驗證

- `npx vitest run src`：30 files、170 passed、20 skipped。
- Firestore Emulator rules：20/20 passed；包含連續補助、跳號補助與玩家寫入拒絕。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。
- Playwright 本地登入頁：390×844、1440×900 均載入成功，水平 `scrollWidth` 等於 viewport；未以已登入執行師帳號完成完整手機版互動回歸。
- `npm run test:rules` 因既有 emulator 佔用 8080 無法接管，改連線該 emulator 完成同一組規則驗證。

## 2026-08-26 3 玩家＋執行師 50 回合壓力測試阻斷

### 實際結果

- 本地 Emulator 測試完成 15／50 回合，Player1／Player2／Player3 各 5 回合。
- 第 16 回合 Player1 卡片結案後，玩家端仍保留幸福卡事件視窗；執行師端顯示等待「卡片後續處理」。
- 玩家端「結束回合」持續 disabled，title 為「請先完成目前的棋盤事件」，10 秒內無法推進，依計畫判定 P1 並停止測試。

### 根因假設（尚未確認）

- Firestore／房間 listener 曾讀到事件已清除的過渡狀態，但玩家端 `GameView`／卡片 drawer 隨後仍套用或保留舊的 active card snapshot，造成遠端狀態與可操作狀態分裂。
- 目前尚不能判定是 listener 順序、卡片結案 transaction race 或前端 stale snapshot；不可用強制切回合或延遲掩蓋。

### 證據與下一步

- 報告：`docs/testing/BOARD_3P_50_TURN_STRESS_2026-08-26.md`
- JSON：`e2e/report/board-50-turn-stress.json`
- Trace：`test-results/board-50-turn-stress-3-位玩家＋1-位執行師完成-50-回合壓力測試-chromium/trace.zip`
- 使用新房重現第 16 回合卡片結案路徑，逐筆比對房間事件、玩家頁 snapshot 與 drawer 關閉條件後再修正。

## 2026-08-26 房市、家庭歷程、維修廠與共享卡片修正

### 根因與修正

- 房市購買意圖改為 `{ cardId, attemptId }`，交易 command ID 不再只綁玩家與卡號；現金不足不消耗指令，取消或失敗會清除意圖，避免後續 C053 等財務動作誤走房市購買。
- 抽卡不動產交易增加卡號一致性檢查，房市交易以最新市場清單與最新私人現金完成；直接購買抽到的店面不會修改房市庫存。
- 幸福歷程來源玩家的拒絕／完成改為等待 transaction 結果後才更新畫面，避免「已完成所有歷程」畫面停在本機狀態。
- 兼職工作室升級新增 `completeStartupUpgradeAction()` 原子交易，從最新玩家資料一次更新企業、收入、貸款、歷史與待辦；同步失敗時保留升級流程並可重試。
- 維修廠先顯示骰點與費用確認，再進入財務檢核；維持既有規則：有車經過／停留都收取骰點 × 2,000，停留另暫停一回合，未擅自加入一般保養理賠。
- 共享卡片改以目前 Firestore prompt 判斷待回覆狀態；遇到其他財務流程時顯示待辦提醒，流程結束後自動開啟，不再依賴舊的本機 prompt 快照。

### 驗證

- `npx vitest run src`：30 files、171 passed、20 skipped。
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run src/test/roomPermissions.test.ts`：20/20 passed；8080 為既有本專案 emulator，未終止。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 本地瀏覽器冒煙：`http://127.0.0.1:5183/` 登入頁正常載入，版本 `v2.4`，console error 0；未以三個正式玩家與執行師完成完整多人互動回歸。
- 本次未 commit、push 或部署；工作樹其他既有修改均保留。
## 2026-08-30 共享卡片與幸福歷程重複競態

### 已確認根因假設

- C027／C028 的目標名單包含所有尚未離房玩家，完成條件不看 presence；失聯玩家若未主動離房，事件會永久等待，而且主持人沒有沿用 120 秒離線門檻的排除入口。
- 幸福歷程由非來源玩家最後完成時，transaction 只載入最後完成者私有資料；既有結案函式若缺少來源／移動玩家狀態會回傳 `null`，因此只能等待房主之後的修復程序。

### 最小反證與修正邊界

- 先以目標名單與 Rules 測試證明：未達 120 秒不得排除，達門檻後主持人可將該玩家記為未參與，且不得改寫其他玩家私有資料。
- 以非來源玩家作最後完成者、來源玩家仍有待續移動的 transaction 測試，要求同一筆寫入清除 prompt 並恢復棋盤，不依賴房主 listener。
- 不加入延遲、不放寬玩家私有文件讀取權、不新增集合或 Cloud Function；若持久化 movement 已不足以安全恢復，停止並回報，而不是跨玩家讀取私有資料。

### 2026-08-31 驗證結論

- 假設成立：共享提示確實沒有失聯排除路徑；已復用 presence 120 秒門檻，僅房主能將尚未回覆者記為放棄，最後一人排除時同筆結案。
- 假設成立：幸福歷程結案不應跨讀來源玩家私有資料；movement 已保存維修效果，現改用該持久化效果切段，非來源玩家最後完成也能原子恢復。
- 最小測試通過：無來源玩家私有快照時，維修廠剩餘 movement 仍正確恢復；presence 門檻既有測試維持通過。
- 3 玩家 Playwright 流程未執行到案例：本地依賴同時載入兩份 Playwright runner；連續兩次入口調整仍為同一阻斷後停止，未用延遲或繞過宣稱通過。
# 2026-08-31 H013 家庭歷程抽卡玩家完成後仍顯示等待

## 重現條件

- 3 位玩家進入 H013 幸福家庭的重要歷程。
- 兩位參與玩家完成擲骰／失敗回覆，抽卡玩家完成自己的階段財務檢核。
- 抽卡玩家仍看到「等待其他玩家完成」，無法結束卡片。

## 可驗證根因假設

- 抽卡玩家目前可能先透過一般財務同步處理階段結果，再以另一個 command 寫入 `sourceActionCompleted`。
- 兩次寫入之間若收到舊玩家快照，家庭歷程 prompt 會保留在等待狀態；完成判定與玩家財務結果不是同一個原子結算入口。
- H013 與其他 H011–H020 家庭歷程共用同一套 prompt／結案邏輯，因此應修正共用抽卡玩家完成路徑，不針對單一卡片加例外。

## 驗證方式

- 以 H013 建立兩位 `failed` 回覆且 `actionCompleted=true` 的 target response。
- 抽卡玩家完成階段時，確認同一個 transaction 同時寫入財務結果、`sourceActionCompleted=true` 並結束 prompt／推進事件。
- 重送同一個 command 不得重複增加幸福或扣款。

## 2026-09-01 H011 家庭歷程首次確認權限拒絕：單一交易修正假設

- **重現條件：** H011 家庭歷程階段二，其他玩家完成或失敗後，抽卡玩家在財務檢核按下「確認檢核答案」；第一次顯示 `Missing or insufficient permissions.`，再次點擊通常成功。
- **目前假設：** 抽卡玩家原本先以 `family-action` 寫入自己的完成狀態，再以 `family-complete` 清除家庭歷程並推進回合。兩次 transaction 之間，房間 prompt／玩家快照可能被其他監聽更新或舊規則判定打斷，導致第二筆寫入先被 Firestore rules 拒絕；不是財務答案本身錯誤。
- **修正方向：** 當所有目標玩家已完成時，將抽卡玩家結果、prompt 結案及事件推進合併為單一 transaction；以既有 `promptId` command ID 保護連點與重整重送，保留既有來源玩家、參與玩家及執行師權限限制。
- **驗收重點：** H011／其他家庭歷程卡首次確認即可完成；多人同時完成時結果不互相覆蓋；交易失敗不得顯示成功或留下半套資料；相同 command 重送不重複扣款或推進回合。

### 2026-09-01 發布狀態

- 本機 Rules 回歸 `24/24` 通過，前端與 Rules 已部署；目前已排除「新版前端搭配舊雲端 Rules」的版本不一致。
- Vercel production 已更新為 v3.0，但尚未完成三個獨立瀏覽器的 H013 實機回歸；若正式站仍出現相同訊息，下一步只檢查登入 project、Rules release 與 transaction 實際 request，不再增加 UI 延遲或重試。

## 2026-09-01 家庭歷程同步權限被拒絕：確認根因與修正

- 本地 Firestore log 已確認實際錯誤為 Rules 單次更新超過 1,000 個 expression；後續玩家私有文件的 `get(room)` 因同一 commit 已耗盡規則預算而回報 `Service call error`。畫面的「權限被拒絕」不是玩家身分或財務答案錯誤。
- 真實房間包含完整牌庫、公開玩家狀態與全體補助資料，原本房間 `allow update` 會依序計算整條 OR 權限鏈；簡化測試資料未涵蓋此負載，因此過去規則測試未重現。
- 規則改為先依是否修改 `boardState` 分流，只評估棋盤交易或非棋盤交易所需權限；未放寬玩家、執行師或私有財務資料權限。
- 玩家端不再用本機 `submittedFamilyJoinPromptIds` 判定已回覆；只有 Firestore prompt 真的存在該玩家 response 才算完成。重複 command 也必須確認 response 已存在，否則回傳失敗並保留重試入口。
- 目前測試房曾出現一位玩家畫面已關閉、Firestore 卻沒有 response，導致全房等待；此狀態正是本機假完成造成，已由上述單一真實來源修正。
- 驗證：完整 Vitest 203 passed／24 skipped、Firestore Rules 24/24（加入完整牌庫、三位玩家與全體補助的大型房間案例）、TypeScript、production build、`git diff --check` 通過。

## 2026-09-01 強制計入負債需點擊兩次：修正

- 根因：強制負債按鈕先用 `handleTransactionSubmit()` 更新本機現金／負債，再立即用舊 closure 的玩家資料套用原交易；React 尚未完成狀態更新時，原交易仍判定現金不足，所以第一次點擊只完成周轉，第二次才成功。
- 修正：`forcedDebtAmount` 與原交易一起送入同一個本機狀態更新；一般交易一次建立負債、補足現金、套用原交易及寫入兩筆正確財務紀錄。家庭歷程則在同一個 Firestore transaction 內完成強制負債與階段結果。
- 保留安全性：仍使用現金不足差額、事件冪等 ID 及既有 transaction；失敗時不關閉流程，也不重複扣款。
- 驗證：新增家庭階段強制負債測試；完整 Vitest 204 passed／24 skipped、TypeScript、production build、`git diff --check` 通過。

## 2026-09-01 強制負債成功後仍顯示交易未完成：修正

- 根因：第一次財務檢核因現金不足回傳 `false`，`BoardFinancialCheckModal` 留下「交易尚未正式完成」錯誤彈窗；之後強制負債已成功，但 `isCompleted` 只切換完成畫面，未清除錯誤狀態。
- 修正：`isCompleted` 成立時同步清除 `errorPopup`，完成畫面不再被舊錯誤訊息覆蓋；不修改交易資料、Firestore Rules 或重試行為。
- 驗證：BoardFinancial／Game／Room 相關測試 42 passed；typecheck、production build、`git diff --check` 通過。

## 2026-09-01 本地全卡片矩陣 H001 阻斷

- 重現條件：本地 Auth／Firestore Emulator，3 位玩家＋1 位執行師建立新房間後，由執行師發送 H001「得獎經歷」。卡片可翻牌並寫入卡片日誌，但主要操作／結案在 120 秒內未完成。
- 客觀證據：Firestore `commit` 出現 HTTP 400／409，並出現 `the stored version (...) does not match the required base version (...)`；Player1 反覆出現 React `Maximum update depth exceeded`。最終快照仍保留 `currentCard`、`currentCardReveal`、`currentEvent`，流程未清除。
- 同場噪音：RTDB `/roomLastOnline`、`/roomDiagnostics` 出現 `permission_denied`。需與 Firestore 主阻斷分開處理，不能先假設是同一根因。
- 已排除的測試工具問題：矩陣測試已移除房間根節點 `playerStates` 私有資料寫入，改只植入各玩家私有文件，並寫入目前 `boardGameStartedAt`／`sessionId`；本次仍重現，因此不再歸因於舊測試 seed。
- 根因待確認：至少有競爭 transaction／過期版本寫入與 React Context 同步回寫迴圈；必須記錄實際 transaction request、呼叫來源與 revision 變更後才能定案。
- 驗證邊界：H001 失敗後依 P1 規則停止，只有 1／160 張執行，159 張未測；不可將未執行卡片標為通過。
- 下一步：先針對 `runRoomBoardMutation`、H001 事件結案呼叫鏈及 Room／Game Context effect 做最小追蹤；修正後先重跑 H001，再恢復 160 張矩陣。另修正本地 RTDB Rules／設定，避免 presence 權限錯誤干擾測試。

## 2026-09-01 銀行定存完成後無法結束回合：修正

- 根因：銀行事件中的定存交易完成後，財務結案只關閉檢核視窗，沒有回到銀行後續流程或呼叫 `advanceBoardEventQueue('bank')`；房間仍保留銀行 `currentEvent`，因此結束回合持續被事件鎖定。
- 修正：`manual-bank` 財務流程完成後，若是銀行快速交易就恢復「回合財務」後續選項；略過後才使用既有事件推進入口結束銀行事件。非銀行事件則直接嘗試依事件類型推進，不改定存交易資料與銀行規則。
- 驗證：GameView／BoardFinancial／Room 相關測試 37 passed；typecheck、production build、`git diff --check` 通過。

## 2026-09-01 定存解約金額無法選擇：修正

- 根因：`WealthView` 的每筆定存解約按鈕固定將整筆 `asset.cost` 送出，沒有提供部分解約金額。
- 修正：每筆定存新增以萬元為單位的數量輸入、加減控制與上限；解約交易只送出選定的萬元數 × 10,000，保留既有部分扣除及利息重算邏輯。
- 驗證：銀行相關測試 11 passed；typecheck、production build、`git diff --check` 通過。

## 2026-09-01 借用信貸後仍返回財務檢核：修正

- 根因：借用信貸先獨立寫入借款，再以舊畫面狀態套用原交易，造成原交易再次進入財務檢核或需要重試。
- 修正：新增 `fundingLoanAmount`，借用信貸與原交易在同一個本機狀態更新／家庭 Firestore transaction 套用；一次建立信用貸款、補足現金、完成原交易，避免重複入帳。
- 驗證：相關測試、typecheck、production build、`git diff --check` 通過。

## 2026-09-01 股票批量張數與財務檢核提示：優化

- 股票批量買入／賣出新增每檔張數輸入；賣出會依各檔實際持有量自動封頂。
- 財務檢核錯誤彈窗分成「填寫正確」及「填寫錯誤或尚未完成」，並保留第一次錯誤不直接揭露完整答案的規則。
- 驗證：相關測試、typecheck、production build、`git diff --check` 通過。

## 2026-09-01 共享卡片同時顯示兩個入口：修正

- 根因：共享 prompt 出現後，抽卡玩家原本的卡片抽屜仍保持開啟。
- 修正：共享事件確認為目前抽卡玩家的同一張卡片後，關閉並隱藏卡片抽屜，統一只保留共享視窗操作；所有共享卡片種類共用此判斷。
- 驗證：相關測試、typecheck、production build、`git diff --check` 通過。

## 2026-09-01 暫停下一位後同玩家骰子仍鎖定

### 錯誤現象

- 兩位玩家 A、B；A 結束回合時 B 有暫停回合，系統直接再次輪到 A，但 A 的骰子仍顯示禁止狀態，重新整理後才恢復。

### 已嘗試修法與失敗原因

- 先前只在 `isBoardTurn` 從 `true` 變成 `false` 時清除玩家端 `isAnimating`。
- B 被跳過時，Firestore 的 `currentTurnUid` 會由 A 直接回到 A，A 的 `isBoardTurn` 全程維持 `true`，所以該重設條件不會發生。

### 根因假設

- 新回合真正的權威訊號是 `boardState.hasRolledThisTurn` 由 `true` 重設為 `false`；玩家端應依這個欄位清除動畫鎖，不應只依 UID 是否改變。

### 下一個驗證步驟

- 元件先擲一次骰，再模擬同一玩家 `hasRolledBoardDice: true → false` 且 `isBoardTurn` 維持 `true`；第二次點擊必須送出新的擲骰指令。

### 不准再重複的修法

- 不再只監聽 `isBoardTurn`。
- 不使用延遲或要求玩家重新整理來清除本機鎖。

### 驗證結果

- 假設成立：同一玩家 UID 維持不變時，`hasRolledBoardDice: true → false` 可清除 `isAnimating`，第二次擲骰指令成功送出。
- GameActions／experienceState 13 項測試與 typecheck 通過。

## 2026-09-02 執行師發送卡片：Firestore 版本衝突

### 錯誤現象

- 執行師透過「卡片發送」觸發卡片時，偶發顯示 `the stored version (...) does not match the required base version (...)`，卡片未立即建立。
- 再次操作通常成功。

### 最小重現步驟

- 正式站 `2ife.vercel.app` 的棋盤房間中，執行師開啟「卡片發送」並確認觸發；同時房間存在其他玩家或背景棋盤寫入。

### 目前錯誤訊息 / log

- Firestore transaction version mismatch；此訊息不是卡片規則錯誤，也不是權限拒絕。

### 已嘗試修法

- 既有 `runRoomBoardMutation()` 使用 Firestore transaction 與 command ID，但只依賴 SDK 內部重試；外層失敗會直接把原始英文錯誤送到執行師畫面。

### 失敗原因

- 卡片發送交易讀取 `rooms/{roomId}` 後，提交前同一份房間文件被其他流程更新；本次提交的 base version 已過期。

### 根因假設

- 需要在共用棋盤交易入口對版本衝突做有限外層重試，並沿用同一個 command ID；不能重試權限、規則或業務條件錯誤。

### 下一個驗證步驟

- 模擬第一次交易拋出版本衝突、第二次成功，確認交易只執行一次結果；再確認一般錯誤只拋出一次、不會重試。

### 不准再重複的修法

- 不要求玩家反覆點擊作為修正。
- 不在單一卡片或 UI 元件各自新增交易重試。
- 不把版本衝突誤顯示為權限不足。

## 2026-09-05 共享兼職工作室效果未入帳

### 錯誤現象

- 抽卡玩家與其他玩家共同參與「兼職工作室」共享卡片時，只有抽卡玩家的財務報表出現卡片效果，其他完成財務檢核的參與玩家沒有入帳。

### 最小重現步驟

- 三位玩家進入共享資產出售卡片；抽卡玩家與至少一位持有未升級兼職工作室的玩家選擇出售，完成各自財務檢核後比對私人玩家資料與財務報表。

### 目前錯誤訊息 / log

- 未見固定的 Firestore 錯誤；症狀是參與玩家的本機出售效果未可靠寫入私人玩家文件。

### 已嘗試修法

- 共享回覆透過 `submitSharedCardPromptResponse()` 寫入房間，但 `playerStateUids` 為空；資產出售另由 `handleTransactionSubmit()` 先改本機，再依防抖同步寫入。

### 失敗原因

- 共享 prompt 回覆與玩家資產、負債、現金更新是兩條獨立路徑；舊的 Firestore 玩家快照可能在本機防抖寫入前覆蓋出售結果。

### 根因假設

- C027/C028 及同類共享資產出售，應以最新私人玩家資料重新計算出售項目，並在同一個 `runRoomBoardMutation()` transaction 同時寫入玩家財務結果與共享回覆。

### 下一個驗證步驟

- 新增純 mutation 測試及交易測試，確認多位參與玩家各自移除工作室／關聯負債、增加正確現金與歷史，回覆完成且重送不重複入帳。

### 不准再重複的修法

- 不只修正共享視窗或錯誤提示。
- 不依賴本機 `handleTransactionSubmit()` 加延遲同步處理共享財務效果。
- 不為單一卡片新增另一套與共用交易入口脫鉤的持久化流程。

### 驗證結果

- `buildSharedAssetSalePromptMutation()` 已讓 C027 兩位參與玩家各自依最新私人資料完成出售、現金與交易歷史入帳；若有關聯貸款也會在同一交易移除。
- Firestore Emulator／Rules 測試確認兩位玩家各自的私人文件都更新，最後一位回覆後 shared prompt 才結束；重送已完成玩家回覆回傳 `duplicate`，不會再次入帳。
- 完整 Vitest `240 passed`、Rules `25 passed`、TypeScript、production build、`git diff --check` 通過；尚未完成三個真實瀏覽器的多人 UI 回歸。

## 2026-09-05 升等骰永久轉動與結束回合操作遺失

### 錯誤現象

- 大螢幕已顯示升等考試通過，玩家畫面仍停在「擲骰中」且無法關閉。
- 玩家結束回合後偶發沒有立即切換；完成「天有不測風雲」保險理賠後也會出現按鈕再次亮起、回合未結束。

### 最小重現步驟

- 升等考試使用遠端骰點，等待 `rollSkillDice()` 成功回傳後檢查玩家端 `isRolling`。
- 在前一個棋盤操作仍持有 `executeWithLock()` 時點擊結束回合，檢查是否實際送出 Firestore transaction。

### 已確認根因假設

- `useDiceRollLogic()` 的遠端成功路徑更新骰點與考試結果後，漏掉 `setIsRolling(false)`；只有錯誤路徑會解除鎖定。
- `endTurn()` 被包在共用 `executeWithLock()`；鎖忙碌時函式直接回傳 `undefined`，沒有排隊、沒有錯誤，也沒有送出 transaction。
- `endTurn()` 另以 `safeAsync()` 吞掉 transaction 錯誤，玩家端無法分辨已切換與未提交。保險理賠本身不是這次的權威阻斷來源。

### 下一個驗證步驟

- 遠端升等骰成功後必須解除 `isRolling` 並顯示可關閉的結果畫面。
- 結束回合直接以最新 Firestore 棋盤狀態 transaction 驗證及切換；若仍有事件則回傳明確錯誤，不能靜默丟棄。

### 不准再重複的修法

- 不用計時器強制關閉升等視窗。
- 不要求玩家重按結束回合或重新整理。
- 不在保險卡片加入延遲來掩蓋共用回合提交問題。

### 驗證結果

- 遠端升等骰成功或失敗後皆會解除玩家端 `isRolling`；回歸測試確認成功結果畫面可進入關閉狀態。
- `endTurn()` 不再被共用 UI 操作鎖靜默丟棄，也不再透過 `safeAsync()` 吞掉失敗；交易以最新棋盤狀態驗證，成功立即切換，尚有事件則回傳明確原因。
- 完整 Vitest／Emulator 測試 `243 passed`、TypeScript、production build、`git diff --check` 通過；尚未完成真實玩家端與大螢幕雙裝置手動回歸。

## 2026-09-09 H005 核准後幸福點被舊本機狀態覆蓋

### 錯誤現象

H005 故事分享經執行師核准後，卡片結案但玩家幸福點未增加；執行師直接發卡正常。

### 根因假設與最小驗證

核准 transaction 已寫入私人玩家文件與公開玩家摘要。玩家端收到公開摘要後，GameContext 的自動同步只因公開摘要不同而觸發，隨後把尚未收到私人文件更新的舊 gameState 回寫，覆蓋已增加的幸福點。

最小驗證：核准後觀察 `rooms/{roomId}/players/{uid}` 與公開玩家摘要，確認先出現幸福點增加，再確認不會被舊本機狀態回退。

### 不准再重複的修法

- 不增加固定延遲等待同步。
- 不只在 H005 或玩家畫面補一次 `setGameState`。
- 不放寬 Firestore 通用寫入權限。

### 修正與驗證結果

- 修正 `GameContext` 自動同步：公開玩家摘要變動不再單獨觸發本機狀態回寫；只有本機狀態雜湊、初始化同步或保險資料真正變更時才寫入。
- 共享 H001–H010 故事分享核准流程沿用既有 transaction 與冪等處理，不增加 H005 專用例外。
- 驗證：`npm run typecheck`、`RoomContext.test.ts`／`GameContext.test.ts` 共 35 項、`git diff --check` 通過；完整 Vitest 為 225 passed／25 skipped，但既有 4 個 e2e suite 因 Playwright runner／未設定 Emulator 環境而在收集階段失敗，非本次變更失敗；尚未 commit、push 或部署。
# 2026-09-10 Firestore 優化：提示修復的無效提交

- 假設：殘留 `family_milestone` 核准請求會觸發修復，但沒有過期 prompt 時提前回傳，未清除請求且仍更新 revision，造成反覆修復與監聽通知。
- 驗證：僅有舊請求時應清除一次；已無待修資料時 `commit: false`；清理不應重寫未變更的私人玩家文件。
- 交易量測須區分 committed、duplicate、skipped、failed；SDK 重試次數與程式排定寫入數不是 Firebase 計費數。
- 不以延遲、放寬權限或停用所有玩家同步掩蓋問題。

本批結果：修復分支會清除舊請求且無變更時不提交；未變更的私人文件不再陪同重寫。修復 ID 不依 revision。交易與投影單元測試通過；尚未執行「修復後靜置 10 分鐘」多人實機驗證，不能視為全部同步問題已解決。
## 2026-09-11 N057 經過銀行第一骰再次無反應

### 錯誤現象

- 玩家持有 N057 建立的企業與企業貸款，經過銀行後開啟企業升級。
- 玩家點選「開始擲骰子（第一骰）」後沒有反應，大螢幕也沒有出現企業升級骰點畫面。

### 已嘗試修法

- 先前已讓 N056–N058 的升級貸款、第一骰與完成升級交易固定讀取私有玩家文件，並檢查目前銀行事件；相同症狀仍再次發生，因此單純切換私有玩家資料來源不足以解決問題。

### 新根因假設

- 升級彈窗仍以畫面快照的資產 ID／回合 revision 建立第一骰請求；銀行事件、私有玩家的待升級狀態與畫面狀態在銀行確認後可能不同步，交易因此在寫入骰點投影前被拒絕，或重送時變成不同 command。
- 需要在同一個 transaction 內以目前銀行事件及最新待升級工作室解析第一骰，並以銀行事件 ID 作為穩定冪等鍵；過期事件不得寫入骰點。

### 最小驗證

- 以目前銀行事件、N057 待升級狀態及私有玩家文件建立 transaction fixture，執行第一骰後必須新增 `business-upgrade` dice event。
- 以非銀行事件、過期銀行事件及重送相同銀行事件各驗證：不得錯誤寫入，或只保留一筆相同骰點事件。

### 下一步

- 已完成追查並修正第一骰共用入口；補充驗證後再交由實機測試確認。

### 修正結果

- `rollStartupUpgradeDice` 的第一骰 command ID 改以本次銀行事件 ID 固定識別，不再綁定容易過期的房間 revision；同一銀行事件重送只會回傳同一筆骰點結果。
- transaction 仍以最新私有玩家文件為準，且會依目前待升級卡片代號解析工作室；畫面快照的舊資產 ID 只作優先提示，不會阻擋正確工作室升級，也不會誤升級其他代號的企業。
- 第一／第二骰都驗證目前玩家、銀行事件與事件 ID；只有驗證成功才寫入 `business-upgrade` 骰點投影，讓大螢幕與玩家端使用同一筆權威結果。

### 驗證結果

- `npm run typecheck` 通過。
- `npx vitest run src/context/RoomContext.test.ts src/game/board/runBoardMutation.test.ts`：41 passed。
- `npx vitest run src`：41 files passed、1 skipped；241 passed、25 skipped。
- `npm run build` 與 `git diff --check` 通過。
- 尚未進行三位玩家＋執行師的瀏覽器實機回歸；本次未 commit、push 或部署。

## 2026-09-11 家庭歷程多人同時擲骰與回合結束延遲

### 錯誤現象

- 兩位玩家中，第二位結束回合後，結束回合按鈕延遲一段時間才可操作。
- 幸福家庭歷程中，多位玩家同時擲骰時偶發顯示家庭歷程同步失敗；重試後可能成功。

### 根因假設與最小驗證

- 家庭歷程的多位回覆都會更新同一份房間文件的 revision、prompt responses 與 processed command IDs；既有交易只重試 3 次，並發時可能耗盡重試，前端因此收到失敗。
- 回合結束可用性同時被本機骰子展示計時器與 Firestore 的 movement／事件狀態限制，動畫結束後仍可能多等一個本機固定計時。
- 最小驗證：讓交易連續遭遇多次版本衝突後仍成功；並確認已擲骰但 movement／事件已完成時，結束回合不再受本機 `isRollingDice` 阻擋。

### 下一個驗證步驟

- 將交易衝突重試改為短退避並提高上限，只在可重試的版本衝突使用。
- 讓結束回合只依權威 movement、事件及共享 prompt 狀態判定，骰子本機動畫僅控制擲骰按鈕與視覺呈現。

### 不准再重複的修法

- 不用固定延遲掩蓋家庭歷程同步競態。
- 不把家庭歷程玩家改成依序擲骰。
- 不停用 transaction、revision 或 command ID 驗證。

## 2026-09-11 學校考試玩家端提前顯示骰點結果

### 錯誤現象

- 大螢幕的學校考試骰子動畫尚未完成，玩家端已顯示考試結果。

### 根因假設與最小驗證

- `rollSkillDice()` 寫入大螢幕骰點事件後直接回傳；`useDiceRollLogic` 沒有等待投影動畫時間，立即更新玩家端 `examResult`。
- 最小驗證：遠端骰點回傳 `presentationDurationMs` 時，等待期間玩家端仍是「擲骰中」，計時完成後才呼叫 `onComplete`。

### 下一個驗證步驟

- 由學校骰點共用入口回傳目前大螢幕動畫時長，玩家端沿用既有升級骰等待邏輯。

### 不准再重複的修法

- 不在學校視窗另外加一套固定延遲。
- 不提前呼叫 `onComplete` 再用畫面遮罩掩蓋結果。

## 2026-09-11 家庭重要歷程共享玩家略過同步失敗

### 錯誤現象

- 家庭重要歷程中，共享玩家按下「略過」後顯示「家庭歷程同步失敗」；重試或其他玩家先完成後可能成功。

### 最小重現步驟

1. 建立一張家庭重要歷程卡，抽卡玩家已完成自己的動作。
2. 讓其他玩家只按「略過」，且該玩家是最後一位尚未回覆者。
3. 觀察玩家端同步失敗，家庭歷程仍停在等待狀態。

### 目前錯誤訊息 / log

- 玩家端：`家庭歷程回覆同步失敗，請再試一次`。
- Firestore：`Missing or insufficient permissions.`。

### 已嘗試修法

- 先前家庭歷程曾嘗試在同一個 transaction 內合併玩家結果、完成狀態與 prompt 結案。

### 失敗原因

- 當最後一位共享玩家略過時，同一筆 transaction 同時新增自己的 response 並刪除 prompt。現行 Rules 的回覆寫入只能驗證新增自己的 response；結案規則則以 transaction 前的完整 response 數量判斷，因此最後一筆回覆與刪除同時發生時兩條規則都不成立。

### 根因假設

- 問題是 Firestore Rules 對單筆更新前後狀態的驗證邊界，不是略過按鈕本身或玩家權限錯誤。

### 下一個驗證步驟

- 將共享玩家回覆拆成兩段原子 transaction：第一段只寫自己的略過 response；第二段在最新文件確認所有 response 完成且來源玩家已完成後，再由同一位共享玩家結案。以 Rules regression test 驗證兩段都可成功。

### 不准再重複的修法

- 不為玩家放寬通用房間寫入權限。
- 不把 `responses.size() + 1` 直接塞進結案規則以繞過前後狀態差異。
- 不用固定延遲或 UI 重試掩蓋 transaction 權限邊界。

### 修正結果與驗證

- `submitFamilyMilestoneJoinResponse` 現在先寫入共享玩家自己的 response；若回覆後已滿足結案條件，再用新的 `prompt:family:finalize` transaction 依最新房間資料刪除提示並推進事件。
- 已回覆但提示尚未結案時，重送 response command 仍會重新觸發結案檢查，避免重整後卡在完成提示。
- Rules 未放寬，新增的兩段寫入回歸案例與 Firestore Emulator `26/26` 通過；完整 Vitest `250 passed / 26 skipped`、TypeScript、production build、`git diff --check` 通過。
- 尚未完成多瀏覽器實機回歸；下一步以兩位以上玩家測試最後玩家略過、多人同時擲骰及雲端延遲。

## 2026-09-12 家庭歷程、大量升級與卡片／彈窗呈現問題（本次追查）

### 錯誤現象

- 幸福家庭歷程共享擲骰時，大螢幕骰子動畫可能持續顯示，最後一位玩家完成後畫面提前結束或無法結束回合。
- C004 職業能力卡完成後，薪資／收入在玩家端晚於卡片結果更新。
- 房屋狀態轉換彈窗可能被其他層級遮住，深色文字與背景對比不足。
- 同一玩家有多筆 N056～N058 兼職工作室待升級時，只呈現一筆升級流程。

### 根因假設與最小驗證

- `DicePresentationOverlay` 目前直接以 Firestore prompt 是否存在決定是否渲染；共享 prompt 在最後一筆回覆的 transaction 結案後消失，但大螢幕仍需要等最後一筆 `presentationReadyAt`。這會讓 overlay 被提早卸載，或在 responses／timer 重建時維持錯誤的滾動狀態。
- C004 的 board 遠端骰點只寫入 `diceEvents`，成功後由 `useGameLogic` 先改本機 GameState，再等待一般同步；薪資權威資料與畫面結果不是同一個完成邊界，因此報表可能延遲。最小修正應讓 board 成功結果在同一條已存在的同步入口立即合併，避免另寫第二套交易。
- `HouseConversionModal` 使用固定低 z-index，且內容外層沒有受控的 viewport 高度；在財務報表／其他 portal 同時存在時會被覆蓋。最小修正是提升自身層級、限制內容高度並改善固定文字顏色。
- `GameView` 只讀 `pendingStartupUpgradeAction`（單筆），雖然 `GameState` 已有 `pendingStartupUpgradeActions` 佇列與 RoomContext 的佇列維護，UI 仍只開一個 `BizUpgradeModal`。最小修正是消費佇列第一筆，成功或關閉後再呈現下一筆；不新增資料集合。

### 不准再重複的修法

- 不以固定延遲或前端直接刪除 prompt 解決家庭歷程結案；以 `presentationReadyAt` 與目前 prompt ID 綁定呈現生命週期。
- 不以畫面上的舊薪資／資產快照覆蓋 Firestore 權威玩家資料。
- 不放寬 Firestore 權限以繞過家庭歷程或升級競態。
- 不把多筆待升級工作室壓回單一 pending 欄位。

## 2026-09-14 一般職業升等玩家無法完成

### 錯誤現象

- 學校升等流程中，部分玩家可以進入骰子，但升等結果未穩定寫回，或因玩家端快照過期而無法完成升等。

### 最小重現步驟

1. 建立棋盤房間並完成職業選擇。
2. 玩家走到學校，開啟升等考試並擲骰。
3. 讓玩家端本機資料與 `rooms/{roomId}/players/{uid}` 私有資料不同步，或重複送出升等操作。
4. 觀察升等費用、職級、薪資與財務歷史是否只更新其中一部分。

### 目前錯誤訊息 / log

- 實機回報為「有玩家無法進行升級」；未提供固定錯誤文字或瀏覽器 log。

### 已嘗試修法

- 原流程由玩家端先扣除報名費，再由 `rollSkillDice()` 寫入棋盤骰點；一般升等結果再由 `useGameLogic.applyExamResult()` 本機補寫。

### 失敗原因

- 報名費、骰點事件與職業結果分屬不同更新邊界；玩家端舊快照同步時可能覆蓋新職級／薪資，且棋盤升等 transaction 原本沒有寫入一般升等的私有玩家資料。

### 根因假設

- 一般升等的唯一權威結果必須是同一筆棋盤 transaction 讀取最新私有玩家文件後，原子寫入報名費、考試結果、職級、薪資與歷史；前端只負責顯示結果。

### 下一個驗證步驟

- 使用本地 Firestore 開啟多玩家房，驗證現金足夠、現金不足完成財務檢核、考試成功／失敗、重整後重送，以及相同事件不重複扣款。

### 不准再重複的修法

- 不由 `applyExamResult()` 在棋盤模式直接補寫升等結果。
- 不以本機現金或職級快照作為棋盤升等交易的最終判定。
- 不用固定延遲或重複按鈕掩蓋 transaction 競態。

## 2026-09-14 雙骰後段退回單骰與 N056～N058 銀行升級卡住

### 錯誤現象

- 玩家遊戲進行到後段後，原本持有汽車／飛行器的玩家擲骰資格退回單骰。
- 持有 N056～N058 兼職工作室的玩家經過銀行時，工作室升級流程可能沒有正確開啟或在第一骰前卡住。

### 根因與修正

- `rollBoardDice()` 原本先以房間快照判斷車輛與骰子數量；舊版房間欄位或 listener 延遲會讓權威玩家資料已持有車，但交易仍依舊快照產生一顆骰子。現在擲骰 transaction 強制讀取私有玩家文件，並以 `resolveBoardDiceCount()` 統一驗證一骰／雙骰。
- 銀行結案與移動收尾原本仍可能走 legacy `room.playerStates`；現在相關 mutation 強制讀取私有玩家文件，並讓 GameView 的工作室入口使用同一份權威玩家資料。
- 舊待升級資料若只剩失效 `assetId`，現在會在相同 N056～N058 卡片代號下找回未升級工作室，保留原本的貸款／資產關聯檢查，不放寬到任意企業。

### 驗證限制

- 已完成 TypeScript、完整 Vitest `257 passed / 26 skipped`、production build 與 `git diff --check`。
- 尚未完成多玩家長局瀏覽器與 Firestore Emulator 競態驗證；不得將本次修正視為正式站實機驗收完成。

### 修正結果與驗證

- `rollSkillDice()` 現在強制讀取私有玩家文件，並在同一 transaction 寫入一般升等的報名費、職級、薪資與財務歷史；`school-fee:{schoolEventId}` 防止重複扣款。
- 已完成 TypeScript、完整 Vitest `255 passed / 26 skipped`、production build 與 `git diff --check`；尚未完成多玩家瀏覽器與 Firestore Emulator 競態實測。

## 2026-09-14 升等考試關閉按鈕無法結案

### 錯誤現象

- 玩家在學校升等考試視窗點擊「關閉」後，視窗可能無法真正結束，棋盤事件仍停留在 school，因而無法結束回合。

### 最小重現步驟

1. 玩家在棋盤房間走到學校並開啟升等考試視窗。
2. 不報名或不進行考試，直接點擊「關閉」。
3. 觀察視窗是否重開，以及 `currentEvent` 是否仍為同一個 school 事件。

### 根因假設

- 原關閉處理只清除 React 視窗狀態，沒有使用既有事件結案 transaction；同一個 `currentEvent` 仍符合自動開窗條件，且 `buildNextBoardTurnState` 會阻止未結案事件進入下一回合。

### 修正結果與驗證

- 關閉按鈕改走既有 `advanceBoardEventQueue('school')`，將學校事件與剩餘移動一次結案；該 mutation 回傳明確成功狀態，只有成功後才寫入本機已處理鍵。
- Firestore 寫入失敗時保留視窗並提示重試，不再產生假成功。
- `npm run typecheck`、相關 Vitest `49 passed`、`npm run build`、`git diff --check` 通過；尚未完成多玩家瀏覽器實機回歸。

## 2026-09-15 職業選取會跳到鄰近選項

### 錯誤現象

- 手機選取職業時，畫面中央的職業與實際被選取的職業不一致，選取狀態會跳到旁邊選項。

### 最小重現步驟

1. 以手機寬度開啟「選擇職業」。
2. 將某張職業卡置於畫面中央，或點擊一張非中央職業卡。
3. 觀察反白職業與確認後保存的職業 ID 是否跳到鄰近卡片。

### 根因與修正

- 原本用固定 `304px` 卡片間距與索引推算中央位置，但卡片在窄螢幕實際寬度為 `85vw`，且初始 scroll 未扣除置中偏移；平滑滾動期間的 scroll 事件也可能暫時改寫選取狀態。
- 現在以實際 DOM 卡片中心找最近選項，初始化依 `selectedId` 置中，點擊後立即置中，移除平滑滾動中間狀態覆蓋。

### 驗證結果

- 新增並通過窄版中央選取測試；輪播測試 `2 passed`、TypeScript 與 `git diff --check` 通過。
- 尚未完成實際手機瀏覽器回歸。

## 2026-09-16 終身學習財務檢核偶發整頁錯誤

### 錯誤現象

- 終身學習卡完成財務檢核後，瀏覽器偶爾顯示通用錯誤頁；重新整理後再次操作通常可成功。

### 根因確認範圍

- `ErrorBoundary` 只會顯示通用錯誤頁，既有程式沒有保存正式環境的 React stack，因此無法從回報畫面百分之百還原當次例外。
- 已確認一條可造成相同症狀的程式風險：舊版 `localStorage` 存檔可能缺少 `history`、`happiness`、`assets` 等陣列；終身學習財務結算與效果處理原本直接呼叫陣列方法，React state updater 例外會被 ErrorBoundary 接住。
- 財務檢核的 `onApply` 原本沒有 catch 非同步拒絕，交易失敗時也可能留下未處理 Promise。

### 修正結果

- `GameContext` 新增共用 `normalizeGameState()`，套用於本機存檔還原、權威玩家快照合併與財務 transaction updater，補齊舊存檔缺少的結算欄位。
- 終身學習效果共用函式同樣先正規化狀態，並安全處理缺少職業升等資料的舊存檔。
- 財務檢核 modal 接住 `onApply` 例外，保留檢核畫面並顯示可重試訊息，不再讓錯誤變成未處理拒絕。

### 驗證

- `npx vitest run src/context/GameContext.test.ts src/components/game/BoardFinancialCheckModal.test.ts`：`16 passed`。
- `npx vitest run src`：`260 passed / 26 skipped`。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 尚未取得正式環境的原始錯誤 stack，也尚未完成正式站多人實機回歸；若仍重現，下一步需保留瀏覽器 console 的第一個錯誤與 ErrorBoundary stack。

## 2026-09-16 C036 重整回大廳與 C004 整頁錯誤再次發生

### 錯誤現象

- 抽到 C036 時會進入要求重新整理的錯誤頁；重新整理後沒有回到原房間，而是停在大廳。
- 抽到 C004 並完成財務檢核後，仍可能進入通用錯誤頁；重新整理再操作一次才成功。

### 已知風險與根因假設

- 上一輪已正規化 GameContext 的本機與 listener 快照，但 App 的斷線重連路徑仍直接把 Firestore 玩家文件交給 `setGameState()`，可能繞過正規化，讓舊資料缺少陣列欄位後在卡片結算時拋錯。
- C004 的 Firestore transaction 仍直接使用權威玩家文件建立職業升等結果；若舊玩家文件缺少 `assets` 等欄位，仍可能在 transaction 內拋出例外。
- C036 重整後回大廳需另確認 `activeGame` 房間恢復是否被初始 `currentView = lobby` 提前吃掉；不能只靠 ErrorBoundary 重新整理按鈕繞過。

### 下一個驗證步驟

- 追蹤 `activeGame` listener 到 App 自動路由的完整順序。
- 讓舊版、不完整玩家快照分別通過重連與 C004 結算路徑，確認不再拋錯。
- 確認 C036 的待理賠資料在重整後仍存在，且恢復到同一場遊戲。

### 不可採用的假修正

- 不只攔截 ErrorBoundary 或把錯誤改成提示重試。
- 不要求玩家以重新整理或重做交易作為正常流程。

### 根因與修正結果

- App 的雲端重連確實直接套用原始玩家文件，現在統一先經過 `normalizeGameState()`；舊玩家資料缺少 `assets`、`history`、`abilities` 或待理賠陣列時，不再把不完整狀態送進卡片畫面。
- C004 成功骰點的權威 transaction 原本直接展開 `currentState.assets`，舊玩家文件會在第一次結算時拋錯；現在於共用成功結算函式補齊能力與資產預設值。
- C036 現金不足使用周轉時，財務 updater 雖已建立正規化狀態，交易 ID 卻仍讀取原始 `prev.history.length`，可能直接拋錯；現在只讀取正規化後的 `newState`。
- 房間 listener 原本在「快取尚未找到房間」時就刪除本機恢復指標；現在只有伺服器正式確認房間不存在才清除，重整不會因短暫 cache miss 回到大廳。

### 驗證結果

- 新增舊版不完整玩家快照執行 C004 成功結算的回歸測試。
- `npm run typecheck` 通過。
- `npx vitest run src`：`263 passed / 26 skipped`。
- `npm run build` 通過；僅保留既有 Tailwind 類名與 bundle size 警告。
- 尚未以正式雲端房間實際重播 C036、C004；本次沒有部署。

## 2026-09-16 目標企業、連續工作室升級與汽車雙骰狀態不一致

### 錯誤現象

- 購買目標企業後，不同帳號分別出現企業收益顯示兩倍，或月結餘已增加但資產／財務自由進度未增加。
- 同一玩家有兩間未升級工作室時，第一間可完成，但第二間可能無法擲骰或不再開窗；不同帳號結果不一致。
- 玩家已購買汽車且按鈕顯示 `x2`，實際交易只產生一顆骰子。

### 根因假設

- 目標企業交易仍先改本機 GameContext，再非同步寫入 Firestore；摘要可能同時計入 `income.investment` 與企業資產現金流，且遠端舊快照可在同步完成前覆蓋資產，造成「收益存在、資產不存在」或重複計算。
- 工作室第一骰 transaction 可能把完整 `pendingStartupUpgradeActions` 佇列縮成目前單筆；第一間完成後第二間因此遺失。UI 另可能持有第一間的 asset/card 快照，導致下一間使用舊 command key。
- 汽車按鈕的 `x2` 由 `hasCar` 顯示，但實際傳入交易的 `selectedDiceCount` 由 effect 延後更新；購車後立刻擲骰可能仍送出舊值 1。

### 最小驗證

- 目標企業：對同一份玩家狀態執行一次購買，檢查資產只新增一次、企業收益只計算一次，並以權威玩家文件重載後保持一致。
- 工作室：建立兩筆 pending upgrade，執行第一間第一骰與完成升級後，第二筆仍存在且可建立自己的骰點事件。
- 汽車：`hasCar` 從 false 切為 true 後不等待 effect，立即點擊擲骰，送出的骰子數仍必須是 2。

### 不准再重複的修法

- 不以延遲、重新整理或再次點擊作為解法。
- 不只修改儀表板顯示；企業資產、收益與進度必須來自同一份權威玩家狀態。
- 不為每間工作室建立獨立本機佇列；沿用 Firestore 玩家文件的既有 pending queue。

### 確認根因與修正結果

- 目標企業收益確實同時寫入企業資產 `cashflow` 與 `income[企業名稱]`，財務摘要因此把 450 萬加成 900 萬；購買又走本機欄位分段同步，競態時可能只留下收入、遺失企業資產。
- 棋盤房的目標企業購買改由單一 Firestore transaction 同時寫入現金、企業資產、收益、幸福進度、負債與交易紀錄；企業收益只保留在資產。舊資料若仍有重複 income，摘要會在對應企業資產存在時自動去重。
- 工作室交易層原本只接受 pending queue 第一筆；畫面切到第二間後可能被判定為過期。現在從未升級企業資產與對應企業貸款重建完整佇列，並按 `assetId` 處理指定工作室，不再把第二間誤判成第一間。
- 汽車 `x2` 原本是可切換元件，顯示與送出的骰數可能不一致；現在 `x2` 是固定雙骰標示，持有汽車時一律送出 2 顆骰子。

### 驗證結果

- 針對性測試：`60 passed`。
- 完整測試：`269 passed / 27 skipped`。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 尚未進行多帳號瀏覽器實機回歸，也未部署。
## 2026-09-17 家庭歷程最後一位玩家骰子動畫提前關閉

### 錯誤現象

- 家庭歷程共享流程中，最後一位玩家送出骰點後，大螢幕骰子尚未完成動畫，共享視窗就被結案關閉。

### 根因假設

- 家庭歷程回覆的 `presentationReadyAt` 使用 1.2 秒的結果揭示時間，但大螢幕完整骰子動畫為 3.6 秒。
- 最後一位玩家回覆後，結案排程依 `presentationReadyAt + 50ms` 移除 prompt，因而在完整動畫結束前關閉投影畫面。

### 最小驗證

- 家庭歷程的權威展示截止時間必須等於完整骰子動畫時間，而不是結果揭示時間。
- 最後一位玩家送出後，prompt 在完整動畫截止前保持未完成；截止後才允許結案。

### 不可採用的假修正

- 不在大螢幕元件另加一套本機固定延遲。
- 不複製家庭 prompt 快照來硬撐畫面，避免顯示已過期事件。

### 確認根因與修正結果

- `getFamilyDicePresentationReadyAt()` 原本使用 1.2 秒的揭示時間，而大螢幕完整動畫為 3.6 秒；最後一位玩家回覆後，結案排程因此提前移除家庭歷程 prompt。
- 共用權威展示截止時間已改為完整 3.6 秒動畫時間；玩家端、大螢幕與結案排程繼續共用同一個 timestamp，沒有新增第二套延遲。
- 針對性測試 `67 passed`；完整 Vitest `269 passed / 27 skipped`；TypeScript 通過。

## 2026-09-17 C037 醫療卡財務檢核崩潰

- C035～C037 的醫療卡財務結果改由 `completeMedicalBoardCardAction()` 在 Firestore transaction 內一次處理現金、醫療理賠待辦、交易紀錄與冪等事件標記。
- 權威玩家資料先經 `normalizeGameState()`；交易完成後才移動至醫院與暫停回合，避免本機狀態同步和棋盤移動互相覆蓋。
- 失敗或交易競態會保留財務檢核視窗並顯示可重試訊息，不再把未處理例外送進 ErrorBoundary；信貸額度也在同一筆交易內檢查。
- 驗證：完整 Vitest `272 passed / 27 skipped`、TypeScript、production build、`git diff --check` 通過；尚未做正式雲端多人實機回歸。

## 2026-09-17 連線與 Firestore 優化第一階段

- 房間命令 telemetry 新增讀取文件數、私有玩家讀寫數、房間／棋盤序列化大小、交易耗時、重試次數、revision 與 trace id；這些是既有 Analytics 指標，不新增 Firestore 診斷集合。
- transaction 衝突重試加入小幅 jitter，避免多人同時操作在相同時間點再次撞上同一份房間文件。
- 房間 listener 補記 cache／pending write 與 listener 延遲，能區分網路延遲、交易重試及畫面前的資料傳播延遲。
- 同一帳號的每個瀏覽器分頁改用 `roomControllers/{roomId}/{uid}/{clientId}` claim，並以 RTDB `onDisconnect` 清理；舊分頁只讀但仍可接收同步。
- GameContext 不再為遠端快照啟動無變更的玩家 transaction，降低不必要讀取。
- Firestore transport 可用 `VITE_FIRESTORE_TRANSPORT=auto|default` 做實機 A/B，預設維持 `auto`。

### 尚未啟用

- 尚未移除 `boardState.diceEvents`，也尚未切換至 RTDB 短暫展示通道。
- 尚未啟用 `syncSchemaVersion: 2` 或拆分多人 responses 子集合；避免半套 schema 在既有房間造成相容性問題。
- 尚未宣稱所有財務呼叫端已完全移除本機狀態回寫；目前仍保留既有交易流程，需逐一遷移並補上 Emulator 競態測試。

## 2026-09-17 壓力測試續驗結果

### 重現條件

- 隔離 Emulator、3 位玩家＋1 位執行師，使用 UI 進行開房、登入、初始選擇與回合操作。
- 第 16 回合前後，玩家頁面仍顯示已應由權威房間狀態清除的卡片事件；「結束回合」維持不可用。

### 新增證據

- `e2e/report/board-50-turn-stress.json`：本次完成 15 回合後失敗。
- `test-results/board-50-turn-stress-3-位玩家＋1-位執行師完成-50-回合壓力測試-chromium/trace.zip`：可看到玩家 UI 卡片／結束按鈕狀態與 Firestore commit `FAILED_PRECONDITION` 競態。

### 判定

- 前次的 Rules 403 在本次未再出現；目前仍有共享房間文件 transaction contention，造成重試與狀態傳播延遲。
- 另確認一條尚未結案的「權威房間已清除、玩家 UI 仍保留 stale 事件」路徑；不能以重新整理或增加固定延遲視為修正。
- 本次尚未完成 50 回合，也沒有完成 6 人、120 分鐘、正式站或 transport A/B 驗收。

## 2026-09-17 連線優化續驗

- 修正並抽出 `getSafePlayerStatePatch()`，將本機延遲同步限制在未被最新 Firestore 權威資料改動的欄位；避免舊快照回寫造成財務結果回溯。
- 完整 Vitest `273 passed / 27 skipped`、Rules 直接測試 `27 passed`、TypeScript、auto/default transport build 與 `git diff --check` 均通過。
- 尚未切換 RTDB 骰子展示或 schema v2 response；目前缺少可供 RTDB Rules 驗證房間成員的安全授權，不能用放寬規則的方式處理。
- 尚未完成 3／6 人瀏覽器壓力、不同手機網路 transport A/B 及 120 分鐘正式站驗收；後續須取得實機條件與授權後再進行。

## 2026-09-18 多人共享回覆競態安全切片

- 舊式共享事件把多位玩家回覆集中寫在房間 `responses` Map；新 v2 房間的非財務回覆改寫入各自的 `events/{promptId}/responses/{uid}` 文件，避免同一文件競爭。
- Rules 僅允許房間成員建立自己的 `declined`／`no_effect` 回覆；執行師讀完整集合後，以冪等 transaction 結案，沒有放寬房間規則。
- 驗證：Rules `28/28`、完整 Vitest `282 passed / 28 skipped`、TypeScript、build、diff check 通過；3 人回歸的 N027 已通過。
- 50 回合回歸於第 24 回合停止，原因是測試輔助器未涵蓋實際銀行事件；不可視為產品通過，也不可視為完整 schema v2 已完成。

## 2026-09-18 開局玩家資料競態與 50 回合驗收結果

### 重現與根因

- 50 回合測試在開局選擇完成、執行師開始遊戲的時間點，曾出現 Firestore 400 `FAILED_PRECONDITION`：玩家選擇草稿同步交易與開始新局刪除／重建私人玩家文件競爭同一份文件版本。
- 這不是玩家文件遺失，也不是單純網路延遲；舊同步橋接把尚未完成的選擇草稿當成正式玩家資料回寫，才會在新局初始化時撞版本。

### 修正結果

- `GameContext` 的通用同步在 `isSetup` 前直接停止；職業、企業、夢想選擇只保留本機草稿，完成時由 `completePlayerSetup()` 原子寫入正式玩家文件。
- 壓力測試的玩家結算檢查改驗證實際 `遊戲結算` region，避免將玩家端「遊戲評分」標題誤判為未結算。

### 驗證結果

- 隔離 Emulator 完成 3 玩家＋執行師 50／50 回合，Player1／Player2／Player3 為 17／17／16；房間最終 `finished`、revision 250。
- 測試錯誤 0；最長回合 9,521 ms，最長回合切換同步 462 ms。
- `npx vitest run src/context/GameContext.test.ts src/context/RoomContext.test.ts src/game/board/runBoardMutation.test.ts`：`70 passed`。
- `npx vitest run src`：`282 passed / 28 skipped`；`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 報告：`e2e/report/board-50-turn-stress.json`；本次未部署、未 commit。

### 尚未驗證

- 這次只完成 3 人本地壓力回歸；6 人、正式雲端、120 分鐘、transport A/B 仍未驗證。
- schema v2 仍只切入非財務 response；RTDB 骰子展示與完整財務命令遷移仍待後續階段。

## 2026-09-18 六位玩家壓力驗收補充

### 根因與修正

- 前次單筆執行師端 400 是 Firestore transaction 的 optimistic concurrency 版本衝突；交易本身有完成流程，但瀏覽器 network log 把可重試的 `FAILED_PRECONDITION` 顯示成 HTTP 400。
- 補齊 `RoomContext` 維護交易、共享 response 寫入及執行師共享事件結案的既有重試入口；測試也把可重試衝突與真正錯誤分開統計。

### 驗證結果

- 隔離 Emulator 完成 6 位玩家＋1 位執行師 50／50 回合，玩家分布 9／9／8／8／8／8，房間 `finished`、revision 249。
- 真正頁面／HTTP 錯誤 0；可重試版本衝突 1 次，低於 5% 門檻；報告：`e2e/report/board-6p-50-turn-stress.json`。

### 尚未完成

- 尚未做正式雲端 6 人 120 分鐘、不同手機／網路 transport A/B，未把骰子展示移至 RTDB，也未完成財務 response 子集合與所有財務命令遷移。

## 2026-09-18 交易重試與 schema v2 共享回覆續修

### 修正

- `RoomContext` 的直接 Firestore transaction 統一包在既有 `runBoardTransactionWithRetry()`，涵蓋執行師財務調整、全體補助、財務加速器、啟動升級等待狀態、幸福分享核准及斷線跳回合。
- `runRoomBoardMutation()` 對 `responseStorage: 'subcollection'` 的共享事件先讀取各 UID response 子文件，mutation 成功時只新增／更新個別 `events/{promptId}/responses/{uid}`；房間 prompt 的 legacy `responses` Map 保持穩定，避免多人同時回覆競爭房間熱點。
- Firestore Rules 將 v2 response 狀態擴充為 `completed`／`declined`／`no_effect`；玩家只能建立自己的 response，執行師只能建立離線排除用的 `declined` response。

### 驗證

- 完整 Vitest：`283 passed / 29 skipped`。
- Firestore Rules：`29 passed`，使用隔離 8098 Emulator 且確認載入工作樹 `firestore.rules`。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過；build 仍有既有 Tailwind arbitrary duration、動態／靜態 import 及大型 chunk 警告。

### 尚未完成

- 尚未將骰子展示移至 RTDB；目前沒有安全的 RTDB 房間成員授權來源，不能以放寬 Rules 取代設計。
- 尚未完成所有財務命令的單一 transaction 遷移、不同手機／網路 transport A/B、6 人 120 分鐘正式雲端驗收與 production 部署。

## 2026-09-18 共享回覆最後結案寫入補強

### 修正

- schema v2 prompt 若在最後一位玩家回覆後立即結案，`runRoomBoardMutation()` 不再只依前後 prompt 差異判斷，而是保留 mutation 回傳的最後一筆 `sharedResponse`。
- 回覆寫入以 `uid` 去重，避免同一位玩家在 metadata 與差異掃描都被排程一次。

### 驗證

- `runBoardMutation.test.ts`：15 passed，包含「prompt 移除仍寫入最後 response」案例。
- 完整 Vitest：284 passed／29 skipped；Rules：29 passed（隔離 8098 Emulator）；TypeScript、production build、`git diff --check` 通過。

### 尚未完成

- 這是共享回覆原子性切片，不代表所有財務命令都已改成純 transaction。
- RTDB 骰子展示、transport A/B、正式雲端長時間驗收仍待安全授權與實機條件。

## 2026-09-18 家庭歷程 response 子集合

### 修正

- 新建立的 schema v2 家庭歷程 prompt 加入 `responseStorage: subcollection`；擲骰結果與接受／略過狀態不再由多位玩家共同改寫房間 response Map。
- `runRoomBoardMutation()` 同時支援 shared card 與 family milestone child response hydration／去重／最後一筆回覆寫入。
- 家庭歷程 listener 與執行師結案流程改讀 child response，並保留 `presentationReadyAt`，避免動畫未完成就結案。

### 驗證

- Rules 新增家庭歷程 response 權限案例：30 passed。
- 完整 Vitest：284 passed／30 skipped；TypeScript、production build、`git diff --check` 通過。

### 尚未完成

- 舊房間仍使用原有 response Map，不做中途 schema 搬移；需新建房間才使用 v2。
- RTDB 骰子展示、非共享財務命令全面遷移、transport A/B 與正式雲端壓測仍未執行。

## 2026-09-19 執行師開始遊戲後計時器未啟動

### 重現條件

- 開房並完成玩家職業／企業／夢想選擇後，執行師按「開始遊戲」；本機畫面可能短暫顯示已開始，但玩家端仍無法擲骰，遊戲時間不下降。

### 根因

- `CoachGameView` 原先先更新本機 `isPaused=false`，`updateRoomTimer()` 再經 `canMutateCurrentRoom()` 檢查 RTDB 分頁控制權；控制權 snapshot 尚未回來或監聽異常時，函式直接 `return`，沒有 Firestore 寫入，也沒有錯誤回傳。
- 舊等待房間入口還會只寫 `status: playing`，沒有建立完整 `boardState.turnOrder`／`currentTurnUid`。

### 修正假設與驗證方式

- 計時器的真正授權以 Firestore 最新房間的 `hostId` 為準；RTDB 分頁控制權仍保留給其他遊戲操作，不再阻擋合法房主啟動計時器。
- 交易成功後才更新本機計時狀態；等待房間一律透過既有 `startRoomGame()` 初始化。
- 待在可用本機執行環境重新跑 `e2e/board-join-start.spec.ts`，並檢查計時器欄位及玩家骰子按鈕。

## 2026-09-22 新房／新局被舊房間與上一場玩家資料覆蓋

### 錯誤現象

- 執行師建立新房並開始遊戲後，畫面可能回到舊房間資料。
- 玩家加入新房後，可能載入前一場遊戲的職業、財務或棋盤紀錄。
- 連帶造成倒數未正確開始、目前玩家不正確或骰子無法操作。

### 最小重現步驟

1. 執行師與玩家帳號完成一局，保留瀏覽器本機狀態及舊房間 listener。
2. 執行師建立新房，玩家由相同瀏覽器加入。
3. 執行師開始棋盤遊戲；在網路延遲下重複點擊開始按鈕。
4. 觀察目前房號、`sessionId`、`startedAt`、私人玩家文件與計時器欄位。

### 根因假設

- 房間切換時沒有先使舊 listener token 失效；舊 callback 在 effect cleanup 前仍可把舊房間寫回 React state。
- 私人玩家 listener 沒有以捕捉到的房號／場次驗證 callback；舊玩家文件可短暫寫進新房。
- `mergeRoomSnapshotWithPrivateStates()` 只比較房號，沒有比較 `sessionId`，因此同房號新場次會保留上一場 `playerStates`。
- `startRoomGame()` 使用先讀後 batch，沒有在 transaction 內檢查 `waiting`；重複點擊可能重建場次並再次刪除玩家文件。

### 下一個驗證步驟

- 先新增單元測試：新 `sessionId` 不得保留舊私人玩家資料；新場次即使 revision 較低仍須接受。
- 將開局改為單一 transaction，第二次相同開始操作只能回傳既有場次，不得產生新 `startedAt`／`sessionId`。
- 執行 `RoomContext`／`GameContext` 測試、TypeScript、Rules、build，再跑執行師＋玩家開房瀏覽器流程。

### 不准再重複的修法

- 不以重新整理或清除 localStorage 當正式修正。
- 不在玩家頁另加固定延遲等待舊 listener 消失。
- 不只隱藏舊資料；必須在房間與場次權威邊界拒絕舊 callback／舊快照。

### 修正與驗證結果

- 建立／加入房間時先更新 listener token 與 room-session scope；舊房間 callback 無法再覆蓋新房。
- 私人玩家 listener 與快照合併皆驗證 `roomId + sessionId`，並拒絕 `boardGameStartedAt` 不屬於目前場次的資料。
- 棋盤快照比較加入 `sessionId`；新場次 revision 從 0 開始時不再被上一場較高 revision 擋掉。
- `startRoomGame()` 改為 transaction，只有 `waiting` 狀態初始化一次；重複開始為冪等，不改寫既有 `startedAt`／`sessionId`。
- 瀏覽器測試完成：執行師登入與開房、三位玩家加入及完成選擇、開始新局、倒數啟動、目前玩家擲骰、Firestore 與大地圖棋子位置同步，1/1 通過。
- 自動驗證：RoomContext／GameContext 71/71、完整 Vitest 299 passed／30 skipped、Firestore Rules 30/30、TypeScript、正式 build、`git diff --check` 通過。

## 2026-09-24 C024 共享資產出售按「放棄」回覆失敗

### 錯誤現象

- C024「求購各類型店面」共享彈窗中按「放棄」，玩家端顯示「共享卡片回覆尚未送出，請再試一次」。

### 根因假設與最小驗證

- schema v2 的 `declined` 回覆只寫 `events/{promptId}/responses/{uid}`；若雲端 Firestore Rules 未更新至允許共享 response 子集合，寫入會被拒，`GameView` 再顯示通用失敗訊息。
- 最小驗證：用目前 `firestore.rules` Emulator 測試目標玩家建立 `declined` response；並確認現有房間規則是否允許只更新本人的 `sharedCardPrompt.responses`，作為規則未同步時的安全回退。

### 已知限制與修正邊界

- 本機 Rules 允許目標玩家建立 `declined` response，但不能由本機檔案證明雲端發布版本一致。
- 不放寬玩家通用房間寫入權限；若採相容回退，只能更新本人回覆，並經現有 prompt／target 驗證。

### 修正與驗證結果

- schema v2 共享卡片回覆子集合遇到 `permission-denied` 時，改走既有 `runRoomBoardMutation()`；該路徑會重新讀取最新 prompt，且 Rules 只允許目標玩家修改自己的回覆。
- 網路錯誤、過期 prompt 或其他失敗不會觸發回退，避免把未同步的放棄誤當完成。
- Firestore Rules Emulator：目標玩家的子集合 `declined` 寫入與本人回覆 Map 相容路徑皆通過；非本人回覆仍拒絕。
- `RoomContext.test.ts` 與 `roomPermissions.test.ts`：93/93 通過；TypeScript 與 `git diff --check` 通過。
- 尚未用使用者實際的雲端房間重播；若仍失敗，需記錄 Firestore 錯誤碼並核對雲端 Rules 發布版本。

## 2026-09-24 C012 共享房屋收購「放棄」回覆仍失敗

### 可重現現象與根因假設

- C012「求購單間小套房」會建立 `asset_sale` 共享提示；目標玩家按「放棄」走 `submitSharedCardPromptResponse(status: declined)`。
- v2 子集合回覆若遭雲端 Rules 拒絕，現有回退呼叫 `runRoomBoardMutation()`；該共用交易會讀取提示內所有目標玩家的 response 文件。
- 現行 Rules 僅允許一般玩家讀取自己的 response 文件，因此非執行師的回退會因讀取其他玩家文件再次 `permission-denied`。這解釋了為何 C024 的舊回退未涵蓋所有玩家情境。
- 最小驗證：使用 Rules Emulator 驗證一般目標玩家不能讀其他人的 response 文件、但能更新自己在房間 `sharedCardPrompt.responses` 的回覆；再以純資料測試確認回退只增加本人回覆及單調遞增 revision/command ID。

### 修正邊界

- 僅在子集合建立回覆回傳 `permission-denied` 時，改用單一房間 transaction 讀取最新房間並更新自己的 response map；不讀其他 response 文件、不替玩家結案。
- 執行師的共享 response listener 在房間回覆 map 改變時重新合併資料，確保最後一位玩家走相容回退時仍能自動結案。
- 其他錯誤、過期 prompt、非目標玩家不得被當成成功；不放寬 Rules、不改卡片規則。

### 修正與驗證結果

- `permission-denied` 回退改為直接讀取最新房間，使用冪等 command 更新本人的回覆 Map；不再透過會讀取所有玩家 response 文件的通用 mutation。
- 執行師共享回覆監聽加入房間回覆 Map 指紋依賴；相容回退寫入最後一位玩家回覆時會重新檢查並結案。
- Emulator 驗證：玩家可讀自己的 response、不可讀他人 response；本人 room response 回退規則仍通過。`RoomContext.test.ts` 65/65、Rules 31/31、TypeScript、`git diff --check` 通過。
- 尚未用實際雲端房間重播 C012；若雲端尚未部署允許本人回覆 Map 的 Rules，需先同步 Rules 後才能使用相容回退。

## 2026-09-24 N055 投資入帳後共享結算回覆失敗

### 錯誤現象與最小重現

- 玩家完成 N055 投資財務檢核後，畫面顯示「共享卡片結算回覆送出失敗，請再試一次」；兩位目標玩家的情境可在 Rules Emulator 重現原權限邊界。
- 目前畫面先執行本機 `handleTransactionSubmit()`，再呼叫 `submitSharedCardPromptResponse(status: completed)`；兩者不是同一個交易。

### 根因假設與可否證檢查

- schema v2 的 `completed` 回覆被排除於本人子集合寫入路徑，改走 `runRoomBoardMutation()`；共用交易會讀取所有目標玩家的 response 文件，但 Firestore Rules 只允許玩家讀自己的文件，因此多玩家 N055 可能在交易完成後被拒絕回覆。
- 最小檢查：用 Firestore Rules Emulator 建立兩位目標玩家的 N055 prompt，確認一般玩家不可讀另一位 response；再驗證只讀房間、本人玩家文件與本人 response 的原子交易可一次完成投資和回覆，重送不重複入帳。

### 修正邊界

- 不把本機財務成功當作雲端完成；N055 投資結果與本人回覆必須同一交易提交。
- 不放寬其他玩家 response 的讀取權限，不以第二次點擊或固定延遲掩蓋失敗。

### 已確認根因與修正

- 原因確認：`completed` 被排除在 schema v2 的本人回覆文件路徑之外，舊共用交易讀取其他玩家回覆時遭 Rules 拒絕；而 N055 財務先改本機、回覆後送，才出現「交易完成卻回覆失敗」。
- 所有 schema v2 共享回覆（含 `completed`）改走本人 response 文件；N055 另外使用同一 Firestore transaction 驗證卡片金額、最新現金、場次與本人回覆，原子寫入玩家資產／現金／歷史與本人回覆。重送以 `promptId + uid` 去重，舊流程已入帳但未回覆時可補回覆而不再扣款。
- 不改 Firestore Rules、不讀其他玩家回覆、不用本機先入帳再背景同步 N055 投資。

### 驗證結果

- N055 金額／冪等單元測試及多人目標的 Firestore Emulator 原子提交測試通過；完整相關測試 70/70、完整 src Vitest 307 passed／32 skipped、Rules 32/32、TypeScript、正式 build、`git diff --check` 通過。
- 尚未用實際雲端多人房間重播 N055；本次未部署。

## 2026-09-24 家庭歷程交易與參與回覆遭權限拒絕

### 錯誤現象與根因假設

- 抽卡者確認財務檢核顯示「家庭歷程同步權限被拒絕」；其他玩家在共享視窗擲骰／略過時顯示參與結果同步失敗。
- 新房間的家庭歷程回覆使用 `events/{promptId}/responses/{uid}`。`runRoomBoardMutation()` 在執行任何家庭命令前會讀取所有目標玩家的回覆，而 Rules 只允許一般玩家讀自己的文件；因此源玩家與參與者均可能在讀取階段被拒絕。
- 通過骰點的玩家之後需要把自己的回覆由 `actionCompleted: false` 改為 `true`，但目前 response Rules 禁止所有更新。即使限制讀取範圍，財務交易仍可能在寫入階段被拒絕。

### 下一個可否證檢查

- 用 Firestore Rules Emulator 建立一位抽卡者、兩位參與者的 schema v2 家庭提示，分別重現抽卡者財務交易、參與者擲骰回覆，以及通過後完成階段；確認拒絕發生於跨玩家讀取或本人回覆更新。
- 修正後同一組測試須確認本人財務與完成回覆一次提交、他人回覆仍不可讀寫、重送不重複入帳，並由執行師端冪等結案。

### 修正邊界

- 正式玩家資料仍以 Firestore 私人文件為準；不放寬他人回覆的讀取權限，不以重試或延遲遮蔽固定的權限錯誤。
- schema v1 房間維持原有回覆 Map 路徑；schema v2 玩家只讀寫自己的 response，執行師讀完整目標名單並結案。

### 已確認根因與驗證

- 最小 Emulator 案例先在跨玩家 `get` 遭 `PERMISSION_DENIED`；限制玩家只讀本人 response 後，參與者完成財務檢核又在本人 response 的 `update` 遭拒。兩個失敗點皆由同一案例逐步證實。
- `runRoomBoardMutation()` 增加本人 response 讀取範圍；家庭擲骰、略過、抽卡者財務、參與者財務及清除待辦均使用該範圍。只有執行師結案命令讀完整回覆。
- Rules 僅允許本人已通過骰子的 response 從未完成改為完成，其他欄位除 command ID 外不可變更；其他玩家回覆仍不可讀寫。家庭回覆 listener 對未變更快照不再重設 room，避免重複訂閱。
- 驗證：獨立 Firestore Emulator 33/33（含抽卡者交易、玩家略過、擲骰成功後財務入帳、重送冪等與越權拒絕）；完整 Vitest 307 passed／33 skipped、TypeScript、正式 build、`git diff --check` 通過。
- 未在使用者當下的雲端房間重播；雲端 Firestore Rules 尚需與本地版本核對並發布至實際 Firebase 專案。


## 2026-09-30 一般抽卡測試的骰點種子

- 已付款 C003 的雲端 awaiting_roll 與玩家骰子視窗已取得證據；未把此畫面當成整張卡通過。
- 新一般抽卡 fixture 設定短 Math.random queue，但 SDK／UI 可能在按下之前消耗 queue，結果實際骰點是 [6,6]／[5,3]，走到學校／銀行，故找不到指定卡片。
- 下一個可測假設：只在按下擲骰的區間固定 Math.random=0，按下回傳後立即恢復；斷言雲端骰點全是 1，再開始卡片驗收。種子控制僅存在本地模擬器測試。
- 前輪已停止並正常收尾模擬器；失敗 report 與截圖保留。未修改正式資料。

## 2026-09-30 金融回歸兩項失敗定位
- 六人借款皆入帳；還款 fixture 送 usage=repay 與既有 builder 的 liability 不符，修正 fixture，不放寬正式驗證。
- 舊家庭歷程 fixture 只有 happinessTotal=2、happiness=[]。抽出的唯讀幸福同步把未變動清單的總分重算成0；恢復原本清單有變才重算行為，新增回歸。
- 前一輪 Rules 44/46，待重跑；上述錯誤不是以 permission retry 緩解。

## 2026-09-30 完整卡片回歸：醫療卡入帳後結案失敗
- C035/C036/C037：付款已入帳（C035 現金 50,000,000 → 49,980,000），財務視窗捕捉到後續 Firebase 權限錯誤；畫面已保存在 full-main-branches/081-C035 等資料夾。
- 可測假設：moveCurrentPlayerToSquare() 使用共用交易時未指定 playerStateUids；新格式 rooms.playerStates 為空，交易把 undefined 展開成僅有移動欄位的玩家文件，刪掉財務欄位，被 validFinancialCommit 擋下。這不是需要盲目重送的偶發拒絕。
- 根源修正：移動函式明確讀取本人私有文件，缺少資料即失敗；保留完整玩家資料，只修改移動 metadata。驗證 C035/C036/C037 普通抽卡、財務入帳、移動及結案各階段。
- 同輪 C039 也出現 Rules 拒絕，尚未定位，需獨立重現；完整 160 卡未通過。中斷測試後的瀏覽器已關閉失敗不能視為遊戲故障。

### 同輪修正驗證結果
- C035/C036/C037/C039 四張普通抽卡回歸全部通過（medical-move-root.json）；C039 也使用指定格移動的同一缺讀路徑，修正一起生效。
- 錯誤視窗保留實際 code/message；onApply 的 undefined 不再視為成功。E2E 有錯誤視窗即保存原因，測試中斷不繼續產生假故障列。
- 最新401單元、49規則與typecheck通過；完整160卡、500回合及正式多人驗收仍未通過。

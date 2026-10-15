# 第二人生：正式環境共享事件延遲與 Firestore 用量分析

檢查日期：2026-09-09；雲端監控查詢截止時間：台灣時間 22:43:58。

## 1. 結論

目前有明確優化空間。遊戲需要即時同步，但不代表需要目前這種集中更新房間、整份玩家狀態回寫、跨分頁重複啟動流程的方式。

實際雲端監控顯示，9/8 的寫入指標共 102,092 次，其中 100,130 次為 UPDATE_NOOP；9/9 截止檢查時共 16,094 次，其中 15,206 次為 UPDATE_NOOP。這種組成值得優先追查，不能只用增加額度解決。

**這些不是帳單上的確定寫入次數。** UPDATE_NOOP 同時可能包含相同內容回寫，以及 transaction 的純驗證操作；後者可能按讀取計費。現有監控沒有文件路徑或前端 command 標籤，不能把所有 NOOP 都歸因為某一段程式，也不能宣稱其中 94.5%／98.1% 都可直接省掉。

目前正式站是 v3.6。今天主要活動發生在部署之前，部署後僅有極小樣本，尚不能證明 v3.6 已解決用量或多人延遲。

## 2. 檢查範圍與證據強度

- 正式 Vercel deployment、正式 JS 資產、Firebase database metadata、正式 Firestore Rules，以及 Cloud Monitoring 近七日指標均以唯讀方式取得。
- 檢查 dev 工作樹的入口、三個 Context、交易共用函式、共享卡片／家庭歷程／骰子／回合、投影頁、歷史查詢、規則及遙測。
- 本次未進行登入開房、修改正式玩家資料、實際多人壓測或部署；只新增本報告。
- 本地工作樹有大量既有未提交內容。程式碼行號是本次檢查位置，不以 Git HEAD 單獨代表正式資產。
- 「已確認」指可由 API 或程式直接驗證；「風險／待驗證」指具體可重現的假設，尚未連結到使用者某一場操作的 trace。

## 3. 正式環境狀態

| 項目 | 實際確認結果 |
|---|---|
| 正式網址 | https://2ife.vercel.app |
| 部署 | dpl_CucARXawLjPPZ29ytfFntW6TRgXR，Ready |
| 部署時間 | 2026-09-09 15:16:32，台灣時間 |
| 正式主 JS | /assets/index-DiRYX--T.js，含 v3.6 |
| Firebase project | happinessflow-online |
| Firestore | (default)，FIRESTORE_NATIVE，STANDARD |
| Firestore 區域 | asia-east1 |
| Emulator | 正式 build 的 DEV 條件為 false；不啟用 Emulator；主資產未含本地 172.20.10.3:8080 端點 |
| 正式 Rules | 與 dev/firestore.rules 逐字相同 |
| Rules 發布時間 | 2026-09-01T15:13:37.250157Z |
| Rules SHA-256 | 3c063df2b766561fd9e9416b6146fbc574ca8d1dbcce220ffd4dc2c79317cbdb |

Vercel 提供前端靜態資產，瀏覽器直接連 Firestore。Vercel build 在哪個區域執行，不等於遊戲交易繞道該區域。此次沒有證據支持先搬資料庫；應先處理交易與前端同步流程。

## 4. 實際讀寫數

資料來自 Cloud Monitoring timeSeries API，project=happinessflow-online。查詢時間為 2026-09-02T16:00:00Z 至 2026-09-09T14:43:58Z；依每個 DELTA 點的 endTime 換算台灣日期加總。邊界附近可能受取樣週期影響，最新資料也有監控延遲。

主要使用 firestore.googleapis.com/document/read_ops_count、write_ops_count、delete_count；另交叉查詢舊 read_count／write_count。讀寫指標未同時相加，以免重複計算。

| 台灣日期 | 讀取操作指標 | CREATE | UPDATE | UPDATE_NOOP | 寫入指標合計 | NOOP 占比 | 刪除 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 09/03 | 861 | 14 | 32 | 435 | 481 | 90.4% | 3 |
| 09/04 | 5,573 | 289 | 580 | 19,157 | 20,026 | 95.7% | 4 |
| 09/05 | 319 | 2 | 0 | 0 | 2 | 0.0% | 無回傳資料 |
| 09/06 | 1,224 | 89 | 169 | 2,434 | 2,692 | 90.4% | 1 |
| 09/07 | 10,040 | 142 | 1,880 | 6,692 | 8,714 | 76.8% | 4 |
| 09/08 | 16,464 | 547 | 1,415 | 100,130 | 102,092 | 98.1% | 8 |
| 09/09，截至 22:43 | 9,105 | 269 | 619 | 15,206 | 16,094 | 94.5% | 5 |

9/9 舊 read_count 合計為 9,088，新 read_ops_count 為 9,105；相差 17。它們是不同指標，不應混成同一個精確帳單總數。

v3.6 部署後，以 15:17 至本次截止時間計，監控只回傳讀取 3、UPDATE 1、UPDATE_NOOP 12；這不構成一場遊戲驗收，亦不應據此宣稱節省比例。

### 如何理解「寫入比讀取多」

比例本身不能證明 Bug。無監聽的存檔、相同內容回寫、純驗證 transaction，以及不同監控計數方式，都可能造成此現象。此專案特別需要分清：

1. 真正更新相同值的寫入：沒有改變資料，仍可能計費，也可能不產生新的資料變更通知。
2. 只驗證文件存在或版本的操作：監控可列成 UPDATE_NOOP，計費可能歸讀取。
3. transaction 競爭重試：會增加讀取與等待，不能把每次嘗試都算成成功寫入。

官方說明：[監控與計費差異](https://firebase.google.com/docs/firestore/monitor-usage)、[帳單說明](https://docs.cloud.google.com/firestore/native/docs/billing-questions)。因此本報告不把 102,092 宣稱為 102,092 次計費寫入，也不把 1,962 次 CREATE+UPDATE 當成完整計費寫入。

台灣日期不是免費額度重置日；不可直接把上表除以每日免費額度計算還能玩幾場。目前缺少每場開始／結束時間、實際回合數及 Billing 對帳，不能準確換算每場成本或免費局數。

## 5. 目前專案結構

```text
Vercel：React / Vite 靜態前端
  AuthContext：帳號、users、跨裝置 activeGame
  RoomContext：房間監聽、控制權、棋盤、交易、共享 prompt、修復
    Firestore rooms/{id}：回合、事件、prompt/回覆、牌堆、骰點、公開摘要
    Firestore rooms/{id}/players/{uid}：私人財務／待辦
    RTDB：roomConnections、roomLastOnline、roomControllers
  GameContext：本機 gameState、localStorage、財務摘要、自動回寫與備份
  GameView：玩家互動、多種彈窗、翻牌後接續共享流程
  BoardProjectionView：獨立房間監聽、動畫與大地圖
```

`RoomContext.tsx` 約 5,252 行；`GameView.tsx` 約 3,803 行；`useGameLogic.ts` 約 1,547 行。檔案長度本身不會增加費用，但目前資料訂閱、狀態修復與交易責任集中，讓一次更新容易引起多個 effect 與 UI 重算。

`runRoomBoardMutationOnServer` 雖然名稱包含 Server，實際匯入的是瀏覽器內的 Firestore transaction 包裝，並沒有獨立權威遊戲伺服器。

## 6. 需要優先處理的問題

### A. 財務資料仍有兩條寫入路徑：高優先

位置：`src/context/GameContext.tsx:245`、`:276`、`:316`；`src/game/board/runBoardMutation.ts:134`。

交易會原子更新私人玩家文件；同時 GameContext 仍將 cash、assets、liabilities、income、expenses、happiness 等字段打包，在一般情況等待 800ms 後 batch.set 回寫。後者沒有 transaction 的版本條件。effect 可以取消未開始的 timer，卻不能取消已送出的 batch。

**已確認結構風險：**遠端交易成功時，舊本機資料仍可能在傳送中；即使有雜湊防重，也不能保證不覆蓋新交易。這會同時影響可靠性、交易競爭及額外操作數。尚不能由監控把 NOOP 精確歸因到此路徑。

建議：多人正式財務操作逐項統一走既有 transaction；通用同步先限定選擇草稿、名稱等玩家設定。不能直接刪除整個 effect，因為仍有操作依賴它。先列出每個本機財務修改 caller，再逐項遷移；遠端同步不可再觸發同一份財務原樣回寫。readonly 分頁也不應繼續自動財務同步，目前該 effect 未檢查 isController。

### B. 翻牌和共享事件是兩次交易：高優先

位置：`src/views/game/GameView.tsx:1281`；`src/context/RoomContext.tsx:2932`、`:3295`、`:3356`。

實際流程為「翻牌 transaction → 等待完成 → 本機標記已翻牌 → 另一次建立共享 prompt transaction → 其他玩家收到監聽」。至少多一次交易往返；若中間關頁、斷線或第二筆失敗，會留下已翻牌但無共享 prompt 的狀態。重按入口又有 isBoardCardRevealed guard，不能假定重按就能恢復。

建議：翻牌時同一 transaction 建立適用的共享／家庭事件，名單取最新有效成員，保留事件 ID 冪等。動畫只控制顯示時間，不負責產生正式事件。重連看到已翻牌但缺 prompt 的合法舊事件時，以同一冪等入口補齊。

### C. 全部共享回覆競爭同一個房間文件：高優先

位置：`src/game/board/runBoardMutation.ts:80`、`:157`；`RoomContext` 家庭／共享回覆函式。

所有 command 讀取房間，成功後更新整個 boardState。六人同時回覆，即使是不同 UID 的回覆，也更新同一份 rooms 文件；公開摘要更新也使交易的讀版本失效。Firestore 會重試，重試耗盡才失敗。[官方交易競爭說明](https://firebase.google.com/docs/firestore/transaction-data-contention)

先減少無效交易與不必要房間更新；即使改成更新不同 field path，只要仍在同文件且 transaction 讀取該文件，仍有競爭。若 6 人並行測試仍不達標，再提案將每位玩家的事件回覆獨立保存，玩家財務與本人回覆原子提交，最後由單一有權限的控制端結案。這一步涉及 schema／Rules 變更，不是單純搬檔案；須保留舊局相容與重連結案，不能倉促實作。

### D. 無變更結果仍可能更新 revision：高優先

位置：`src/game/board/runBoardMutation.ts:118`；`src/context/RoomContext.tsx:1681`、`:1737`、`:4701`；`src/game/board/boardRevision.ts`。

包裝器只有 commit:false 才跳過寫入；若 mutate 回傳原 boardState、result:false，仍新增 command、增加 revision 並更新房間。

具體可疑循環：healStaleBoardPrompts 因殘留 family_milestone request 進入，但沒有 stale prompt 時直接回傳原狀態，沒有清除舊 request、也沒 commit:false。修復 command ID 含 revision，因此下一次房間更新可能再次修復並寫入新 revision。是否在正式某房間發生尚未讀取房間個資驗證；這是可用 fixture 重現的明確風險。它會產生真正 revision 更新，不應直接拿 NOOP 總量等同這個循環。

建議：逐一審查失效事件／無變更分支，明確返回 commit:false；修復以穩定 event ID 去重且真正移除觸發條件。不能把所有 result:false 自動當成不提交，有些拒絕動作本身是合法狀態轉移。

### E. 投影頁仍啟動一般玩家 Provider：高優先

位置：`src/App.tsx:119`、`:819`；`src/views/board/BoardProjectionView.tsx:744`；`src/context/RoomContext.tsx:1545`、`:1939`。

boardRoom 路由在 AppContent 內判斷，外層 RoomProvider／GameProvider 已掛載；投影頁另開房間 listener。若執行師 activeGame／本機記錄恢復同房，投影頁的 Provider 仍可能監聽全部私人玩家文件、claim roomControllers，以及執行 host 自動修復。

同一 SDK 內相同查詢可能合併，不能直接斷言每個 onSnapshot 都多收一份費用。但額外分頁仍有獨立連線與前端更新；投影重開取得控制權，可能使操作分頁變 readonly，造成看似延遲的操作失败。

建議：投影路由使用只讀資料入口、保留登入與 Rules 驗證；不啟動玩家自動存檔、控制權競爭、全部私人財務監聽或 host 修復。執行師操作端維持控制權。

### F. 前端重算、metadata 與歷史查詢：中優先

- RoomContext 的 Provider value 直接建立；每份房間／私人快照更新，廣泛通知使用者。兩種快照目前合併成同一個 room，財務更新也影響只看棋盤的組件。先分開必要狀態訂閱，再衡量是否需要更細的 selector。
- 私人 listener 使用 includeMetadataChanges，回呼沒有資料相等判斷，每次重新建立 states。metadata-only callback 本身不等於一筆計費讀取，但會造成 React 重算；可保留必要連線狀態並避免重建未變更資料。
- 大地圖移動時每 80ms 更新整個頁面 animationNow；建議把動畫 tick 限縮到棋子／動畫組件。其是否已導致手機或直播裝置卡頓需要 profiler，不能僅由頻率斷言。
- GameContext 非遊戲時讀取所有該玩家歷史，沒有 limit；GM／報表多處 getDocs(users) 也是全量。建議歷史預設最近 20 筆加游標，管理列表分頁，摘要數量不下載全文件來計算。
- 當前主 JS 約 1.99 MB、gzip 約 459 KB（前次 build 紀錄）；首次進頁和低階裝置需留意。分包有助載入，不會直接降低 Firestore 寫入。

### G. 有限冪等記錄及狀態上限：中高優先

位置：`src/game/board/boardRevision.ts`、`src/context/GameContext.tsx:94`。

processedCommandIds 保留 100 筆、appliedBoardFinancialEventIds 保留 200 筆。這是有限視窗，不等於永久防重。其他 transaction 還可能寫入較長 history，100 筆限制只覆蓋通用玩家同步，尚非所有寫入共用限制。

建議：結案／財務操作先驗證當前場次、event ID 與持久化完成狀態，再處理最近 command 快取。先確保舊 command 被截掉後仍不能重放，再統一限制非必要歷史資料；不要為省空間隨意縮短財務冪等保護。

## 7. 已經合理的設計，應保留

- 正式使用雲端 Firestore；固定在線心跳已移至 RTDB 的連線／斷線機制。不能再以每 30 秒七人寫入計算目前 Firestore 心跳成本。
- 計時器顯示每秒本機計算，Firestore 更新集中在開始／暫停／調整等操作；沒有發現逐秒資料庫倒數寫入。
- 玩家主要監聽自己的私人財務文件；執行師監聽全部玩家是有用途的，需優化的是投影分頁額外啟動這套流程。
- 已移除每 command 額外寫 revision_* 文件；保留 transaction、版本與 command ID 的必要防護。
- 玩家備份間隔已是 30 分鐘；6 位玩家 120 分鐘約 24 次週期寫入，另加首次建立、結算與重新掛載。它不是目前上萬次寫入指標的直接量級來源。user 物件改變會重啟 effect，仍值得改為穩定身份依賴。
- Rules 正式與本地一致；不建議用放寬權限解決卡片延遲。登入持久化、activeGame、當局玩家資料與待辦恢復應保留。

## 8. 優化順序與驗收

| 階段 | 執行內容 | 驗收條件 |
|---|---|---|
| 1：先讓數字可歸因 | 在既有遙測記錄 command 種類、開始／完成時間、重試、duplicate/no_change、文件讀寫數；採樣，避免每筆再寫 Firestore | duplicate／commit:false 不再一律記 committed；可區分 UI 等待、transaction 等待與監聽傳遞 |
| 2：修正不必要流程 | 修正 heal 空轉、投影副作用、相同快照重算；縮減泛用財務回寫，逐項補 transaction | 靜置 10 分鐘沒有持續房間寫入；投影重整不奪取執行師控制權；並行操作財務不回退 |
| 3：可靠共享事件 | 翻牌與 prompt 原子建立；穩定冪等結案；重連恢復缺漏 | 翻牌後立即斷線／重開，共享事件仍完整；3／6 人同時回覆保留所有結果，結案一次 |
| 4：按實測再拆熱點 | 如仍不達標，再拆共享回覆文件、縮小房間訂閱與動畫更新、歷史分頁 | 相同劇本比較 p95 延遲、重試、read/write；不可只看讀取降低卻增加大量寫入 |

不新增 Firestore 診斷日誌集合。既有 src/utils/telemetry.ts 使用 Analytics，但目前 board_command 在 duplicate／不提交返回時仍記 result:committed，且沒有耗時或重試資訊；不能拿它當目前的成功交易計數器。

建議測試先以本地 Emulator 建立穩定 fixture，再用正式核准測試帳號執行一次 3 人短測、三場 6 位玩家＋1 位執行師 120 分鐘實測。大地圖另開一頁，總共 8 個頁面；讀寫估算需把投影算進去。

需涵蓋：同時擲骰／回覆、財務交易與主持補助重疊、來源玩家翻牌途中離線、一般玩家重整、重新登入、暫時離開、執行師與投影重整、跨裝置接管、結算與第二局初始化。只讀分頁不可回寫；暫離不刪座位；目前玩家離線不自動改順位。

量測時間點：點擊 → 提交開始 → transaction 完成 → 其他頁面收到 server snapshot → 視窗首次呈現。骰子設定有 1,200ms 揭示與 3,600ms 總展示時間，應把產品刻意動畫和額外網路延遲分開。

建議門檻（待實測，不是目前達成數字）：提交後 200ms 內顯示處理中；一般共享視窗額外同步延遲 p95 ≤2 秒、p99 ≤5 秒，扣除設計動畫；財務重複入帳、回退、永遠等待、資料外洩均為零容忍。靜置除預定備份外不應持續有房間寫入。

每局沿用讀取目標 ≤15,000／上限 20,000，寫入目標 ≤3,000／上限 4,000，刪除目標 ≤50／上限 100，但必須記錄口徑，將 UPDATE_NOOP 分列並和實際 Billing 對帳。不能拿本表監控寫入合計直接判定付費超額或每日局數。

## 9. 成本與架構決策

Firestore listener 隨資料變更產生讀取；快取 metadata 回呼不等於新增計費讀取，重連則依持久化條件可能重新計費。[Firestore 計費規則](https://firebase.google.com/docs/firestore/pricing)

縮短玩家文件會降低資料量與解析負擔，但在 Standard 文件計數模式下，寫同一文件仍是文件操作，不會因字段變少就按比例降低操作次數。合併不必要提交、避免無效回寫才會直接影響次數。拆文件也可能增加文件讀寫，所以必須測量收益。[效能建議](https://firebase.google.com/docs/firestore/best-practices)

目前建議保留 Firestore＋RTDB。首先排除無效操作與共享建立的兩段式流程，再決定是否拆資料。沒有證據顯示更換 BaaS、NAS 或提高額度本身會修正目前流程漏洞；同樣的資料競爭搬到別處仍需解決。

## 10. 本次尚未證實的事項

- UPDATE_NOOP 中「相同值回寫」與「純 transaction 驗證」的比例及各自來源。
- 使用者個別場次的確切讀寫與每局成本；監控含所有連到同 project 的頁面／管理工具，無法只用總量隔離遊戲。
- v3.6 多人雲端延遲是否改善；本次沒有足夠部署後遊戲樣本。
- 哪一個事件的 UI rendering、網路往返或 transaction 重試是最大耗時；尚缺對應 trace。

以上限制不影響已確認的兩段式共享建立、房間文件競爭、無變更仍提交、財務雙寫路徑與投影 Provider 副作用，這些可立即列入下一輪修正與回歸。

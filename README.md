# Firebase 遊戲後端試行｜v4.25.2-beta 已部署測試，尚未整合 dev

## 狀態

## 2026-10-08 效能優化分支 perf/production-ready（本機完成，未部署）

目標：正式環境延遲與「按鈕要按好幾次」。正式日誌顯示後端 gameCommand p95 約 97ms、0 失敗，問題在前端擋點擊、渲染過量與冷啟動。

**已完成**
- 點擊：最新分頁接手控制權（不再 30 秒唯讀）；不同操作排隊而非報錯；未確認指令以原 ID 自動重送；擲骰／結束回合不因 revision 落後被拒；送出按鈕即時「處理中…」。
- 後端：上課時段常駐（warmOnRoomCreated、maintainWarmPool，Cloud Run 服務層 minInstanceCount）；warmup 指令；落點結算由前端在動畫結束時送出，Cloud Tasks 退為備援且早到不再退避。
- 渲染：大螢幕只在棋子到下一格時重繪、40 格 memo；自動效能模式（精緻／流暢）；執行師倒數只更新文字；RoomContext 操作身分固定（useRoomActions／useRoomState）；財務報表與行動列 memo。
- 資料量：房間文件 38.6KB → 21.4KB（卡片日誌只存顯示的 12 筆）；靜態檔快取（雜湊檔一年 immutable）；徽章 WebP（4.9MB → 0.4MB）；移除 8 個未使用套件。
- 監控：server_command、command_rejected_client、frame_jank、client_error 遙測。
- 測試：e2e 新增後端模式 `E2E_SERVER_MODE=true FIREBASE_PROJECT_ID=demo-happinessflow-backend node scripts/e2e/run.mjs`。

**部署前置（尚未執行，需使用者確認）**
1. 函式執行帳號需有 `run.services.update`（常駐設定用），否則 warm pool 只記錄失敗、不影響遊戲。
2. 部署 Functions（新增 warmOnRoomCreated、maintainWarmPool 共 11 個函式；Scheduler 每 5 分鐘）與前端；Rules 未修改。
3. 先發布到 2ife-backend-test，看 GA4 的 server_command／command_rejected_client／frame_jank 再切正式。

**尚未完成**：前端直接寫入路徑全面移除（需先列出並結束舊格式房間）、processedCommandIds 移出房間文件、Cloud Logging 警示、實機 6 人＋投影驗收。
「不同帳號分頁隔離」e2e 在 v4.25.2-beta 原始碼即失敗（照片同意視窗），非本分支造成。

## 2026-10-07 v4.25.2-beta 前端發布

- 已發布至 https://2ife-backend-test.vercel.app，deployment dpl_GssxbUTtYdSEsGtvpQpzTp4caTkM，READY；前一版 dpl_3dcGpzdZacv4q9bmXx8Dgz1b1F3h 保留。
- 更新系統日誌及版本，包含家庭歷程未設定欄位清理、共享等待時返回棋盤、一般處理中提示隱藏、維修骰子展示期限同步。
- 94 檔 609 測試、TypeScript 與正式 build 通過。入口／版本／GameView／執行師及區域模組線上內容與本機建置相同，版本內 Rules 雜湊與正式啟用 Rules 一致。發布證據：output/release-v4.25.2-beta.json、release-v4.25.2-*.log。
- 前端連接正式 Firebase happinessflow-online，既有 gameCommand asia-east1 ACTIVE；此批未重新部署後端、Rules 或另一個正式前端。手機／投影、共享返回及維修動畫的實際多人驗收仍待使用者重測。

## 維修骰子呈現同步（2026-10-07，本地前端）

- 原維修視窗直接呈現雲端 repairFee，早於投影骰子展示結束。改為依相同 repair diceEvents 的 timestamp 與 2.4 秒展示期限顯示骰點／金額，並在展示完成前禁止進入財務檢核；命令、骰點及金額不變。
- 新 useDicePresentationReady 只管理綁定事件的顯示時間；晚收到已到期事件直接呈現結果，回前景／校時重新對齊，事件切換取消舊 timer。舊事件缺 dice history 時只等待一次，避免永久鎖住。
- output/repair-presentation-regression.log：15 項回歸通過，含晚收到、到期、事件切換、回前景與舊格式。TypeScript 通過；實際手機與投影仍待重測。未發布 Vercel。

## 共享等待時返回棋盤（2026-10-07，本地前端）

- 已完成財務檢核按「返回遊戲」時，共享仍未完成則只關閉財務／卡片視窗，保留來源卡片待結案資料；不提交提前結案，也不標記卡片已處理。
- 等待家庭歷程其他玩家時提供「返回遊戲」，卡片關閉亦只收起顯示；共享自動接續改成必要回覆與處理皆完成才嘗試。雲端事件／共享待辦仍阻擋結束回合。
- 變更僅在 GameView 呈現及接續入口；共用完成判斷、後端結案、財務與 Rules 保持既有權責。output/shared-return-regression.log：83 項既有回歸通過，typecheck 通過；實際多端返回／結案仍待重測。未發布 Vercel。

## 本地入口切換雲端（2026-10-07）

- 使用者授權將本地／區網入口連到正式 Firebase happinessflow-online；Auth、Firestore、RTDB 與 Callable 一起切換，Functions 區域 asia-east1，VITE_USE_EMULATOR=false。`.env.development.local` 保存本地預設，已忽略於版本控制。
- 原網址 127.0.0.1:5183／192.168.31.35:5184 重新啟動完成；以各入口實際 Vite 模組內容核對專案、區域、後端旗標及模擬器旗標。需重載後使用雲端帳號登入；模擬器帳號／房間不自動搬遷。
- Auth／App Check 加入 localhost、127.0.0.1、192.168.31.35，保留所有既有網域；allowAllDomains=false，未關閉後端 App Check 或變更 Rules／使用者權限。前後清單保存於 output/local-cloud-domains-*.json。
- 模擬器及其本地任務仍只處理 demo 資料，不會接管雲端排程。此為本地連線設定切換，未發布 Vercel；雲端登入、App Check 實際交換與遊玩仍待本地瀏覽器重測。

## 家庭歷程付款資料清理（2026-10-07，本地修正）

- 本地房 300404 的 H015 prompt／event ID 有效。家庭財務檢核會帶入 undefined 的 forcedDebtAmount／fundingLoanAmount；命令持久化會省略它們，但原始 Callable 傳輸未省略。Firebase SDK encode 將 undefined 轉成 null，後端合法金額驗證因此拒絕。
- 共用 Callable 邊界沿用既有 cleanObject，移除未設定欄位，讓傳輸與持久化內容一致；明確的 null、0 及金額仍保留並接受既有後端驗證。不改金額驗證、家庭規則或雲端資料。
- output/family-wire-regression.log：15 項命令／傳輸回歸通過，含未設定欄位、零額、借款額及非法 null；typecheck／build 通過。兩個本地 Vite 入口已熱更新，未發布正式環境；使用者家庭付款實際呈現仍待重試。

## 本地模擬器的延遲任務（2026-10-07）

- Firebase 模擬器不會自動排程執行 Cloud Tasks／Scheduler。只啟動 Functions 與 Vite 時，移動任務會保留 pending，導致落點事件及卡片未建立；本地房 300404 已確認此情況。
- 模擬器啟動後另執行 `npm run dev:tasks`，每秒依序呼叫既有移動復原與共享結案 handler；重新啟動會繼續處理持久化待辦，不新增遊戲判定邏輯。任務仍以既有命令防重。
- 執行器只接受 demo 專案與 loopback Firestore emulator，缺少設定立即拒絕。未修改正式排程、前端等待條件或 Rules，也未發布。
- `output/emulator-task-regression.log` 驗證到期移動自動建立幸福卡、重複執行只保留一張卡與一筆結算；原使用者房間實際落點為銀行，已建立銀行事件且只结算一次。實際手機／投影呈現仍待使用者重測。

## 2026-10-07 執行師／管理員開房權限修正

- 依使用者最新政策：users.role 為 coach／gm，或既有管理員 title 標記的帳號可直接開房。保留既有受信任 Auth 權限相容；不逐帳號配置新 claim。資格在開房交易內重新查核，撤銷角色後立即拒絕。
- Rules 保護 role 及管理員標記，只有管理員可授權／撤銷；一般玩家及執行師不能自行升權。子集合 wildcard 要求至少一個子文件，避免 Rules v2 零段匹配繞過主文件檢查；一般名稱、普通稱號及本人子集合既有操作保留。
- 驗證：前後端 typecheck／build、93 檔 605 單元測試、Firestore／RTDB 62 項回歸、角色與子集合專項、實際 Auth／Callable 六並行開房與完整房間生命週期通過。證據在 output/host-role-*.log。
- 部署目標為正式 Firebase happinessflow-online 與既有獨立測試站；發布結果記錄於 output/release-v4.25.1-beta.json。當前瀏覽器顯示未登入，尚未完成使用者 GM 的正式開房實測；整份方案與多端驗收仍未完成。
- 架構範圍：既有角色資料為開房資格來源、Rules 限制授權者、後端開房交易負責查核；不新增第二份角色同步或新相依套件。

## 2026-10-05 雲端候選版部署

- 使用者授權使用正式 Firebase happinessflow-online；候選前端部署至獨立 https://2ife-backend-test.vercel.app，Vercel deployment dpl_91wdhTwGCSL3QAWYWcNBdB6PxLnG 為 READY。原 2ife 正式前端未切換；測試網址共用正式 Auth／Firestore／RTDB，請建立新測試房。
- 九個 Gen2 Node 22 函式在 asia-east1 均 ACTIVE；兩個 Cloud Tasks queue RUNNING、每分鐘 recovery Scheduler ENABLED、索引 READY。正式啟用 Rules 與候選內容一致，SHA-256 f377bc0e3e7ecbd9ee7cb651c70e6c5d0726d9e083eac9aa885b31cb9be89ec8。原 Rules 及部署前設定已備份於 output/。
- 修正區域來源：一般 process.env 在部署分析時未載入專案 dotenv，導致宣告仍採預設區域。改用既有 SDK defineString，部署及 task queue 使用同一 GAME_FUNCTION_REGION；functions/.env.happinessflow-online 指定 asia-east1，scripts/checkDeploymentRegion.cjs 檢查九個匯出。先前本批誤建 asia-southeast1 的九個候選函式均已清理；部署前專案 Functions 清單為空。
- 初次 API／Eventarc 權限傳播及 Cloud Build 失敗均保留日誌，後續部署成功。App Check Enterprise 網站金鑰限定候選網址，Auth 授權網域保留原值並加入測試域；啟用必要 API 並核對 App Check service agent。沒有降低 score 門檻、關閉 enforceAppCheck 或啟用公開 debug token。
- 真實瀏覽器 App Check exchange 200；攜有效 token 的未登入 Callable 得 401「請先登入」，證實通過 App Check 且後端仍驗證登入。證據 output/playwright/appcheck-live-final.log；登入頁顯示 v4.25-beta。此為部署／驗證管線證據，不等於已登入開房或遊戲完整驗收。
- 此時採 claim 開房的策略已由 2026-10-07 使用者角色政策取代，見上方修正紀錄。已登入開房／遊玩、多端及手機仍未通過；整份方案未完成，未整合或 commit dev。
- 發布識別及線上／本機產物雜湊保存於 output/release-v4.25-beta.json。新模式房間已產生後，不應直接將 Rules／客戶端回退至不支援此 schema 的舊版；保留相容後端與規則以完成測試房接續。

## 2026-10-05 發布準備：v4.25-beta 與 App Check

- 候選版版本更新為 v4.25-beta，系統日誌列出後端模式、家庭／共享結案及持久接續；明確保留多端與雲端驗收狀態，未宣告整份方案完成。
- Firebase 初始化在 Auth／Firestore 前接入既有 Firebase SDK 的 ReCaptchaEnterpriseProvider，啟用 token 自動更新；本機模擬器不呼叫 App Check。雲端後端模式缺少 VITE_APPCHECK_SITE_KEY 時拒絕初始化，未關閉 Callable 的 enforceAppCheck。
- 網站金鑰必須與選定 Firebase Web app 的 App Check Enterprise 註冊一致，並允許測試網址網域。尚未指定測試專案或部署雲端金鑰，不能將本機初始化檢查當成雲端 token 驗證。
- 本批更新位於隔離候選版，未改 dev 或部署；待確認雲端目標後部署 Functions／必要 Rules／索引及前端，取得實際測試網址再驗證。

## 2026-10-03 接續：共享未確認結果與 36 張負向分支

- 確認 submitServerSharedAction catch 將所有錯誤轉成 failed 且不保留 code，與持久命令已保存原操作的狀態不一致。其他銀行／卡片入口僅列部分 Functions 錯誤碼，unknown／cancelled 亦可能被当成確定失敗。
- 直接匯出並沿用 pendingCommand 原有 isUncertainGameCommandError，未新增另一套重試。共享、銀行、家庭、學習、醫療、一般機運／幸福、分享財務及幸福清單 catch 統一使用同一分類；共享保留正規化 code。aborted／deadline-exceeded／unavailable／internal／unknown／cancelled 回 waiting，權限拒絕回 failed；持久 ID／查核與有限 aborted 重試原邏輯不變。
- verification-shared-uncertain-build-unit.log：完整 verify exit 0，前後端 typecheck、Functions build、92 檔／599 項單元及完整前端 build。實際 RoomProvider 測共享四種未確認錯誤仍 waiting／同 ID，permission-denied 明確 failed／原因且無客戶端寫入；銀行補 unknown／cancelled／無前綴傳輸碼仍 waiting。接續 verification-shared-uncertain-final-build-unit.log 完整 verify exit 0，92 檔／601 項單元，新增 unknown／cancelled 的實際 localStorage 跨重開保留、只查結果不寫入、原 ID 明確重試與 duplicate 清除回歸。
- verification-shared-all-negative-core.log：實際 Firestore 模擬器 561 項檢查 exit 0，原 36 卡接受／六人並行／舊命令檢查，加上每卡合法拒絕或強制拒絕受阻、無資產時 no_effect 資格／不合法 no_effect 拒絕、無財務副作用、必要回覆不足 finalizer waiting、合法完成結案。所有共享投資卡均驗證資金不足私有狀態／歷史／回覆／收據未寫，原事件保留，補合法貸款後一次付款與負債、防重及結案。
- 本批未修改後端效果或 Rules；只擴充後端測試與修正前端傳輸錯誤呈現。上一批完整 Auth／Callable／trigger 通過紀錄仍屬後端證據，本批新增的錯誤回報來自元件 mock，不當作真實斷線瀏覽器證據。未整合 dev／未發布；其餘完整卡片分支、舊管理／寫入、整合／雲端／多端與效能仍須完成。

## 2026-10-03 接續：家庭完成後的殘留待辦與幸福條件

- 確認後端 familyRespond 對成功參與者保存 pendingCardAction「家庭歷程參與付款待完成」，familyAction 原先只刪 pendingFamilyMilestoneJoinAction。付款／拒絕後的文字待辦仍在私有及公開摘要，coach 安全復原也會將它判定為未完成。verification-family-pending-repro.log 先以實際 Firestore 測試重現失敗（exit 1），不是只新增會通過的測試。
- familyAction 只在 pendingFamilyMilestoneJoinAction.promptId 等於目前命令時清除該 pending；只有值仍是此後端所建立的付款待完成文字才一起清除。來源玩家或其他事件文字不被清掉。資金不足保留全部待辦與原財務，付款／拒絕、私有／公開結果與完成回覆仍同交易提交。
- 家庭付款使用既有 withAutomaticHappiness 同交易更新自住房／孩子等已達成條件，避免條件已滿但 h_family 等要等下一筆其他交易才保存。沿用既有幸福家庭判斷（約會、求婚、婚禮、第一個孩子與自住房），不是另改成五個家庭歷程全部完成。
- verification-family-pending-stage-final.log：五個家庭階段共 155 項核心檢查 exit 0，涵蓋每階段接受／拒絕、六並行一次、現金不足不寫歷史與保留待辦、補周轉後一次扣款、孩子／支出／幸福效果、其他來源文字保留、全員完成結案與結案後重送。
- verification-family-pending-build-unit.log：完整 verify exit 0，前後端 typecheck、Functions build、92 檔／594 項單元及前端 build。verification-family-pending-callable.log：完整 Auth／Callable／trigger 回歸 exit 0，新增一般玩家待辦先存在、付款後消失、無執行師瀏覽器自動結案；既有六人共享、其他卡片／財務、開房至封存關房一起通過。
- 隨後新增合法 >=4 門檻未達分支：測試內暫時固定 Node randomInt 為 1，finally 還原，未新增正式隨機參數或後門；驗證失敗回覆、無付款待辦／扣款／歷史、原結果不重擲、非法付款被拒絕及正常結案。verification-family-pending-stage-and-failure.log：最新編譯 162 項核心檢查通過、exit 0（包括原五阶段回歸）。
- 未整合 dev／未發布，以上本機證據不等同於正式房間全部按鈕故障的唯一原因。仍須全卡片分支、多端畫面、剩餘舊管理／寫入、相容整合、雲端及效能驗收。

## 2026-10-03 接續：移除安裝橫幅的初始動畫套件載入

- scripts/analyzeBundle.mjs 使用既有 Vite／Rollup 模組資訊與 Node gzip 記錄各 chunk、靜態／動態依賴及模組 renderedLength，不新增依賴。renderedLength 是 minify 前模組估計，不當成最終單模組下載量；bytes／gzipBytes 是 generateBundle 時的 chunk 量測，與 Vite 最終輸出可能有少量後處理差異。
- 量測確認主入口大宗為 Firestore／React／Auth SDK，而不是報表匯出。InstallPromptBanner 為單一簡單進場動畫卻靜態引入完整 framer-motion，令 239 個 framer-motion／motion-dom 模組提前載入。
- 移除橫幅的 motion／AnimatePresence，沿用 tailwindcss-animate 原生 CSS 進場與 prefers-reduced-motion。關閉立即移除，省去原退出彈簧動畫；iOS 指引、瀏覽器 install prompt、持久關閉與事件 cleanup 保留，關閉按鈕補可讀名稱。其他遊戲動畫未修改。
- verification-bundle-before.json／verification-bundle-after.json：沿靜態 imports 遞迴計入整份初始 JS，1,202,311 → 1,072,817 bytes，gzip 322,541 → 279,836 bytes（減少約 13.2%）；初始 framer-motion／motion-dom 模組數 239 → 0，未只把主檔縮小卻保留相同初始依賴。最終 Vite build 主入口約 1,074 kB／gzip 281 kB，仍有 500 kB 警告，並非整個遊戲總下載量降到此值。
- verification-native-install-build-unit.log：完整 verify exit 0，前後端 typecheck、Functions build、92 檔／594 項單元及前端 build。新測試驗證 iOS 指引／持久關閉、Android 實際 prompt action／accepted 關閉／unmount cleanup、已安裝不顯示。
- 未整合 dev／未發布，未變更 Rules 或後端效果。實際手機／瀏覽器載入時間、P95／P99、其他效能範圍、全量卡片分支與舊管理入口仍未完成；建置減量不等於延遲目標達標。

## 2026-10-03 接續：過期管理命令的持久拒絕與復原

- 核對手動積分修改發現：首次逾時留下原命令後，重試遇到 expected score 不一致，只有拋出 failed-precondition；原草稿會一直待確認，阻止更新選擇。這不是成功操作，不能自行丟棄逾時草稿。
- 後端將過期 expectedExperience／expectedRankScore 保存為 rejected 收據，包含原選擇、原因及查核時的實際積分。重送／查核回原拒絕；即使後來積分又變回原值，同一命令也不能突然入帳。前端只接受符合原 target／score／expected values 的明確拒絕，清除已確認原草稿並顯示原因，之後可重新查詢以新命令修改。模糊或錯誤選擇的拒絕仍保留待確認。
- verification-admin-rejection-build-unit.log：完整 verify exit 0，前後端 typecheck、Functions build、91 檔／591 項單元及前端 build。新增首次逾時→原命令查核→原 ID 拒絕→重新查詢修改，以及錯誤拒絕內容不能清除草稿。
- verification-admin-rejection-core.log：Firestore 實際 transaction 核心 exit 0，包含拒絕保存、後來積分恢復時原拒絕仍不入帳、結果查核，及既有六並行／權限／原結果防重。verification-admin-rejection-callable.log：實際 Auth／Callable exit 0，簽章資格、過期值 rejected 查核、私人積分不變及原已成功結果回歸通過。沒有更改正式 claim／Rules，也沒有處理或發布任何正式積分。
- 全量積分重算／重置仍由 CoachDashboard 客戶端批次寫入，舊 settleGame 及 users 規則亦未完成相容移交。後續需持久、可接續的分批管理操作，並避免覆蓋同時結算的新積分；不能把本次手動操作復原當全域積分收尾完成。未整合 dev／未發布。


## 2026-10-03 接續：歷史報表保險與狀態還原

- 確認 HistoryView 評分視窗將 medicalInsuranceCount 固定為 0，會使已保存的正式積分與「財務安全」明細不一致；三個報表入口也以預設值取代能力、目標事業、職級與家庭資料。
- 後端私人結算明細增加目標事業／夢想、孩子、能力、已完成幸福事件及當時市場價格，保留原本保險與職級。GameContext 官方／自存歷史及 HistoryView 目標玩家載入保留這些資料；HistoryView／CoachHistoryView／RoomRecordsView 從已保存資料還原，不再固定保險為零。舊紀錄缺欄位維持既有預設值，沒有修改原資料或重新發積分。
- verification-report-state-build-unit.log：完整 verify exit 0，前後端 typecheck、Functions build、91 檔／589 項單元與前端 build。測試包含實際 ScoreModal 保險安全項目的得分／舊格式，以及本人 Provider／財務報表傳入的能力、事業、職級與保險。
- verification-report-state-lifecycle-final.log：Firestore 模擬器實際 finish／close 核心 exit 0，核對保存明細與私有玩家的事業、夢想、職級、孩子、保險、能力及完成歷程一致；既有六並行、防重、封存失敗保留與刪主文件後重送一併通過。初次受 sandbox 本機監聽 EPERM 的紀錄保留在 verification-report-state-lifecycle.log。
- React 檢查：本批不新增訂閱或串行讀取，沿用原 Promise.all 與取消過期請求，未更改遊戲提交／結算資格。仍未整合 dev／未發布；報表實際瀏覽器、全量卡片分支、剩餘管理／舊寫入、雲端与效能驗收尚未完成。

## 2026-10-03 接續：六人 500 個混合玩家回合

- verification-mixed-turns-500-final.log：Firestore-only 模擬器完整 500 回合通過，4,436 次命令；六位普通玩家各 83–84 回合，自然擲骰看到全部 160 張卡。包含接受／拒絕、共享付款、家庭回覆、銀行、醫院、學習及分享人工核准等混合操作；未使用執行師強制清除或強制換人。
- 最後重送前 60 個舊命令全部取回 duplicate，整份棋盤與六位私人玩家狀態保持不變。verification-mixed-turns-summary.json 與 verification-mixed-turns-trace.json 保存摘要及命令結果。首輪在第 406 回合等待合法企業升級選擇；測試工具補送 deferStartup 後重跑通過，原失敗／trace 保留，不將 waiting 當完成。
- test:backend:mixed 與 CI workflow 已加入可重跑門檻；失敗保存房間與命令診斷，源碼再補六位私有快照及完整 transactions 保存。這次 500 回合使用補快照之前的編譯版本，新增失敗保存分支尚未實際注入失敗驗證。
- 這是直接呼叫真正後端函式的測試，未經瀏覽器／Callable；人工審核由測試中的本場 host 送出合法命令。160 張自然抽卡不是所有接受／拒絕／不足／審核分支全覆蓋，也不是手機或效能驗收。未整合 dev／未發布。

## 2026-10-03 接續：卡片 requirements 實際行為與後端保護

- 原 requirements 映射已存在，但以物件屬性查值會把 toString／constructor／__proto__ 等繼承屬性當成支援。改為 Object.hasOwn；非陣列及非字串條件明確列為不支援，實際 resolveBoardCardAction 停止套用效果。
- 後端 revealCard 在建立共享／家庭提示或股市效果之前檢查不支援條件，拒絕新提交並保留事件。既有持久結果重送仍回原結果，不重新執行或修改既有已確認交易。
- 條件檢查增加實際約會／孩子資格（含歷程 ID 與已勾幸福項目）、缺車／缺房只允許關閉，以及所有資料的學費／骰子門檻／跳過回合／共享參數／分享／移動與投資輸入映射檢查；不是只搜尋函式名稱。
- verification-card-requirement-behavior.log：71 項解析與行為檢查通過。verification-card-requirement-reveal.log：實際 Firestore 模擬器 891 項翻牌不變條件通過，包含未知／繼承名稱條件時 revision／翻牌／提示／收據均未寫入，再回歸 160 張翻牌。
- verification-card-requirement-build-unit.log：verify exit 0，前後端 typecheck、Functions build、91 檔／588 項單元與完整前端 build。160 張翻牌通過不等於所有接受／拒絕／不足／審核分支完成，500 混合回合與多端／雲端／效能驗收仍未完成。未整合 dev／未發布。

## 2026-10-03 接續：可信手動積分管理

- CoachDashboard 手動改分由 adminSetScore 提交，不再直接 update users 或吞掉錯誤。Number／safe integer 驗證拒絕小數、負數、空字串與溢位，確認成功才更新顯示。
- 後端要求 Auth 簽章 gameAdmin:true，自行改 users.role:gm／coach 不授權。嚴格限制命令欄位，帳號必須存在；交易重新比較 expectedExperience／expectedRankScore，避免覆蓋畫面載入後新結算的積分。修改及包含 before／after 的持久管理收據同交易保存，六並行一次，舊命令重送回原結果而不改後來積分。
- 前端沿用既有持久命令／鎖與原結果查核，不新增另一套重試。逾時保留原設定與 command ID；不明確結果仍保留，未確認前不能換設定。管理結果查核僅簽章管理帳號自己的命令。Rules 阻止客戶端讀寫管理收據，既有固定 GM email 全域例外尚未移除。
- verification-admin-score-core.log：實際 Firestore 模擬器核心通過；verification-admin-score-client.log：三項前端檢查通過；verification-admin-score-callable.log：真實 Auth／Callable 的可改 role 拒絕、簽章 claim 接受、六並行、偽造／過期值拒絕與原結果查核通過。核心及 Callable 納入既有回歸 runner。
- verification-admin-score-rules.log：160 authority Rules 檢查 exit 0，包含一般玩家／coach／帶 gameAdmin claim 客戶端均不能偽造或直接讀取管理收據。verification-admin-score-build-unit.log：完整 verify exit 0，91 檔／584 項單元、前後端 typecheck、Functions 及前端 build；最後管理協定路由的 Functions typecheck／build 通過，真實 Callable 重跑存 verification-admin-score-callable-final.log。
- 仍未完成全量重算／重置、舊模式 settleGame 及 users 客戶端寫入規則的整體相容移交，不能稱全域積分防竄改已完成。正式 gameAdmin claim 配置未執行，現有正式管理功能未變；候選版啟用須配置與驗證可信權限。實際 Dashboard 瀏覽器操作尚未驗收。未整合 dev／未發布。

## 2026-10-03 接續：投影背景恢復與逾期提示

- BoardProjectionView 移動畫面在 visibilitychange／focus／online／hf-clock-sync 立即使用 serverNow 對齊原 movement.startedAt；背景不更新動畫，不從舊進度重新計時。換房／場次或事件 cleanup 取消 interval 與事件 listener。
- 跳過回合提示在回前景／校時後重新計算原 timestamp 剩餘期限；雲端刪除提示立即關閉，避免舊 timeout cleanup 後視窗永久殘留。到期不再重播提示。
- 實際投影元件測試：背景時計時已過但不更新畫面，回前景立即從四步追上零步，恢復連線保持結果；暫停提示逾期／來源移除立即消失。這是 jsdom 元件驗證，尚不是實機投影或正式房間證據。
- verification-projection-foreground-build-unit.log：完整 verify exit 0，前後端 typecheck、Functions build、90 檔／581 項單元與完整前端 build。接續增加 hf-clock-sync 訂閱後另外跑投影及骰子 overlay 回歸，紀錄 verification-projection-clock-resume.log；最新 typecheck 存 verification-projection-clock-typecheck.log。原骰子 overlay 已有背景／校時恢復，沿用既有實作。
- 未整合 dev／未發布；帳號積分及舊結算、全量流程與混合回合、實際瀏覽器／雲端／效能验收仍未完成。

## 2026-10-03 接續：本人歷史與帳號切換恢復

- GameContext 本人官方紀錄載入新格式私人明細，保存 professionData 與完整歷史來源；切換帳號先清除官方與自存紀錄，官方及自存請求 cleanup 後的結果／錯誤均不再套用。自存讀取不再只有 console 錯誤。
- 本人歷史以 historyLoadError／retryHistory 提供失敗原因與明確重試入口，HistoryView 呈現；不覆寫遊戲頁面或用全域警告替代復原。兩種紀錄可各自回報失敗，重試沿用目前帳號讀取。
- GameContext.history.test.tsx 使用實際 Provider 驗證本人明細現金／職業與來源、換帳號後晚到的官方與自存結果，以及失敗後重試。原 Context 效能回歸仍通過。
- loadScoreRecord 在讀私人文件前檢查摘要 UID 唯一性、名單一致及指定玩家存在；缺少指定玩家不再回傳未載入的摘要。新增 malformed／缺目標且零私有讀取檢查。
- verification-own-history-recovery-final.log：完整 verify exit 0，前後端 typecheck、Functions build、90 檔／578 項單元及完整前端 build。隨後身份檢查新增由 verification-history-identity-recovery.log 驗證：兩檔七項通過；最新 typecheck 另存 verification-history-identity-typecheck.log。實際瀏覽器與正式多人驗收尚未完成，未整合 dev／未發布；積分管理與舊結算、全量流程／混合回合、雲端及效能範圍保持未完成。

## 2026-10-03 接續：歷史報表錯誤恢復與過期請求

- 補齊 GameContext 本人官方歷史的分文件明細讀取，換帳號／場次後不套用舊請求；載入失敗保留錯誤原因。本人歷史完整 Provider／瀏覽器驗收仍待補齊。
- HistoryView 目標玩家切換時清除舊報表與視窗；請求失敗顯示原因及重試入口，不再由 safeAsync 吞掉。CoachHistoryView 的清單／明細以請求 generation 防止舊結果、錯誤或 finally 覆蓋新場次／帳號，切換先清除舊明細；失敗可重新整理或重試。
- RoomRecordsView 財務視窗保存可信結算摘要與完整歷史來源，提供錯誤及重試，取消過期請求；找不到新格式指定玩家時明確失敗，避免改讀全體明細。
- verification-report-recovery-build-unit.log：verify exit 0，前後端 typecheck、Functions build、88 檔／572 項單元與完整前端 build。接續新增 verification-report-modal-recovery.log：三項財務視窗元件測試通過，涵蓋保存的摘要／歷史來源、錯誤重試與切換紀錄舊錯誤忽略。不是實際瀏覽器或正式多人證據。
- 未整合 dev、未發布。帳號積分管理及舊結算、完整操作盤點、所有卡片分支／混合回合、瀏覽器、雲端及效能驗收仍未完成；500 kB 建置警告仍存在。

**閱讀方式**：以下日期章節保存各次進度；較舊章節的「尚未完成」可能已由較新的章節補齊。所有通過紀錄均為本機證據，不代表 dev 已整合或正式已啟用。完整方案目前仍未完成。

## 2026-10-03 接續：關房後完整歷史與六位已設定結算

- 既有 HistoryTable 以 sessionId＋timestamp desc 查原 transactions，先 100 筆、每次 50 筆；補上 COLLECTION 索引，未部署。來源保留完整歷史，沒有把快取當全量。
- transactions／commandResults 讀取在後端房間只允許本人及本場 host；關房後透過可信 archive 的 roomId／session／host 認定權限，不依賴已刪主文件或可自行修改的 users.role。舊格式歷史保留既有 coach 讀取。verification-closed-history-rules.log：151 authority Rules exit 0；160 筆原 transactions、刪主文件後本人與本場 host 100＋50 實際 query／cursor 成功，其他 coach 及偽造交易拒絕。模擬器不證明正式索引已啟用。
- HistoryTable 修正 StrictMode cleanup 後新請求也被舊取消 scope 忽略的問題：每次 effect 建立新的 generation，舊結果／錯誤／finally 不影響新來源，分頁同 generation 只一筆進行中。verification-history-table-recovery.log：三項元件測試通過（StrictMode、換玩家舊結果、100／50 與連點）；前端 typecheck 通過。不是實際瀏覽器視覺驗收。
- verification-six-player-settlement-callable.log：六位一般玩家全部真實 Auth setup，再六並行 finish／close，六份官方分數明細與 users 積分一致，關房與原命令重送不再加分、下一場不受舊操作影響，exit 0。先前僅一位設定的驗證限制已由本批補齊。
- 帳號積分寫入盤點發現 CoachDashboard 的手動修改／全量重算／重置，及旧模式 settleGame 仍直接寫 users experience／rankScore；全域防竄改未完成，需要可信管理命令與舊場相容一起移交，不能只封鎖既有功能或把自己可改的 role 當後端資格。

verification-closed-history-build-unit-final.log：完整 verify exit 0，前後端 typecheck、Functions build、86 檔／568 項單元及前端 build；500 kB 警告保留。仍未整合 dev、未發布；報表錯誤呈現／瀏覽器、積分管理／舊結算、全量卡片／500 混合回合、雲端／效能等完整範圍保持未完成。

## 2026-10-03 接續：可信積分結算及分文件報表

- finishRoom 現在在同一 Admin transaction 使用官方 calculateFinancialSummary／calculateScoreResult 計算已設定玩家，不接受客戶端積分。score_records 最終摘要、各玩家明細子文件、coach_records、users experience／rankScore、封存與房間 finished 一起保存。未設定者不發放遊玩分；缺帳號／無效財務／無效或溢位既有積分拒絕整筆。
- 固定場次與原命令結果防重；已有 scoreAppliedAt 或可信紀錄但缺少可重送的原命令時拒絕再次發放。closeRoom 不再次結算，直接關閉未結算房只保全資料。Player snapshots 與完整歷史來源仍保存；單一分數主文件只保留小摘要，recordSchemaVersion 2／playerStorage subcollection，私人明細個別文件保存既有快取。
- CoachGameView 後端模式的 saveRecords 不再直接寫 score／coach 或呼叫客戶端 settleGame；只有 confirmed finished 顯示已保存。舊／練習模式沿用既有流程。loadScoreRecord 已接 HistoryView、CoachHistoryView、RoomRecordsView；普通玩家讀本人明細，其他玩家保留摘要，舊平面紀錄不新增查詢，未知格式／缺漏明確失敗。歷史讀取並行，避免新增逐筆等待。
- Rules 禁止客戶端偽造 trustedSettlement、修改／刪除可信 score／coach 紀錄或寫玩家明細。本人及本場 coach 可讀其明細；不以自行修改 users.role 授權跨場明細。既有 users experience／rankScore 的寬鬆客戶端寫入規則尚須整體相容稽核，不能宣稱帳號全域積分防竄改已完成。
- verification-server-settlement-core-rules-final.log：lifecycle 核心通過，第一次 Rules 因 owner 讀取依賴缺失 role fixture 失敗；修正本場 coachId 讀取及 fixture 後 verification-server-settlement-rules-final.log 145 authority Rules 通過、exit 0。初次 core 因既有 default state 缺 income／expenses 序列化失敗，依原計算語意補空物件；失敗紀錄保留，沒有開啟忽略 undefined 或降低驗證。
- verification-server-settlement-callable.log：實際 Auth／Callable 建房／六人名單／開局／設定／六並行結算／關房／原命令重送／下一場通過。僅一位完成設定者發積分並有明細，其他未設定者保留封存但不發放；users 積分、可信報表與明細一致，close／重送後不再次發放。不是六位已設定玩家的完整結算驗收。
- verification-server-settlement-build-unit-final.log：verify exit 0，前後端 typecheck、Functions build、85 檔／565 項單元及完整前端 build。新增 loader 三項檢查涵蓋本人限定、coach 明細、舊紀錄、未知格式／缺失／識別不符。實際報表畫面仍須瀏覽器驗收；完整歷史在關房後的讀取權限與分页仍待補齊。

仍未整合 dev、未發布。全域帳號積分規則相容、六位已設定結算、報表／封存／全歷史呈現、全卡分支／500 混合回合、瀏覽器／雲端／效能等完整範圍保持未完成。

## 2026-10-03 接續：玩家快照及巢狀復原封存

- 核對實際報表路徑發現：CoachGameView.saveRecords 仍直接寫 score_records／coach_records，settleGame 仍由客戶端給 users 累加積分；讀取報表走這兩個集合，沒有使用 room_archives。這是未完成的可信結算／報表入口，不能因 finishRoom／closeRoom 已後端化便標記整體結算完成。
- 本批先補資料保全：finish／close 在原交易讀取每位普通成員私有玩家文件，完整快照分別存 archive.players；缺文件明列 missingPlayerSnapshotUids，不捏造預設資料。保存原私人 transactions 路徑，完整歷史來源保留；不把最近 100 筆快取當完整歷史。
- 同交易複製 boardRecoveries 與其 movementTasks／promptFinalizationTasks 子文件，主封存保存快照及復原數量。讀寫／大小失敗中止原交易保留房間。關房後玩家與復原資料可透過 archive 路徑取得，不依賴已刪主房間。
- 原 archive Rules 僅覆蓋一層子文件，已改為遞迴封存文件讀取；保留本場 host 授權與舊格式相容，任何客戶端封存子文件寫入仍拒絕。verification-archive-player-rules.log：132 authority Rules 檢查 exit 0，新增玩家與巢狀復原排程的 host／跨帳號／偽造／刪除案例。
- verification-archive-player-recovery-core.log：lifecycle 核心 exit 0，包含玩家完整快照、缺漏清單、復原及原排程內容、關房後保留、六並行防重與既有 1.2 MiB 診斷分文件／失敗整筆保留。verification-archive-player-build-unit.log：verify exit 0，前後端 typecheck、Functions build、84 檔／562 項單元與完整前端 build；bundle 警告未消除。

verification-archive-player-callable.log：實際 Auth／Callable 建房、六人名單／容量、開局、設定、六並行 finish／close、刪主文件後查核及下一場回歸 exit 0。核對六份玩家快照、無缺漏、設定玩家完整私有資料相同、原歷史來源及巢狀復原內容可由 archive 取得。可信積分結算、score／coach 紀錄產生及報表／全歷史讀取入口仍須接續完成，不能把本批資料快照當報表畫面已驗收。未整合 dev、未部署；完整分支／混合回合／瀏覽器／雲端／效能等範圍保留。

## 2026-10-03 接續：可信強制復原

- 後端模式的 clearCurrentBoardEvent／forceEndBoardTurn 已接 coachClearEvent／coachForceEnd，由本場 host、完整 schema、原事件／回合／revision 驗證並保存穩定命令結果。Context 不再直接清 private pending 或寫房間；waiting 不當成功。
- 未完成 continuation、家庭／共享提示、審核請求、玩家 pending、已繳費 schoolExam 或相關銀行／學習／服務／卡片效果收據拒絕強制解除，保留原流程。以原擲骰／交易／結案或重新呈現接續，不能把付費判定變成未處理。復原不改任何玩家私有狀態、金錢、資產、負債或能力。
- 可解除的未入帳流程先存 boardRecoveries 快照與結果，再取消 pending／scheduled 移動與提示工作，清除流程或用原 getNextBoardTurn 指定下一位；全部同一交易。相關排程原內容存於復原子文件。已完成 continuation 保留原資料。Rules 僅目前房間 host 可讀復原紀錄與子文件，客戶端不能新增、修改、刪除。關房刪主文件後該紀錄目前仍保留來源，但讀取呈現／封存入口仍待完整核對。
- verification-coach-recovery-core-rules-final.log：核心及 124 authority Rules 檢查 exit 0。含非法玩家、付款／待辦阻擋、六並行一次、私人資料不變、取消舊工作與保存快照、舊重送不改新 revision、force end、注入快照寫入失敗時保留回合／排程／無收據、房主讀取與偽造／跨帳號拒絕。
- verification-coach-recovery-ui.log：Context 28 項通過，包含兩種復原命令正確識別／revision、無客戶端寫入。verification-coach-recovery-build-unit.log：verify exit 0，前後端 typecheck、Functions build、84 檔／562 項單元與完整前端 build。bundle 警告仍存在，不宣稱效能達標。
- verification-coach-recovery-callable.log：實際 Auth／Callable／RTDB／trigger exit 0。普通玩家 C003 付款後 host 強制清除被拒絕、原 continuation／private state 保留；本人完成原 rollLearning／finishLearning 後，host 六並行 force end 一次，原財務結果不變、復原紀錄與原結果查核成功。既有離線、指定回合、發卡、重新呈現與共享結案一起回歸。

本批不代表所有畫面或雲端驗收完成。下一步仍須全面核對操作入口／封存報表及復原呈現、全卡分支／500 混合回合、dev 整合、瀏覽器／雲端與效能。未整合 dev、未部署。

## 2026-10-03 接續：保留原事件的重新呈現

- 舊 repeatCurrentBoardEvent 換事件 ID 的路徑在後端模式改為 coachReplayEvent。由本場 host、原事件、玩家、場次及 revision 驗證；原事件 ID／timestamp、翻牌、骰點、付款收據、共享與待接續全部保留，只新增 presentationReplayId 並原子保存 revision／持久結果。六並行只一次；舊重送不改新事件。
- GameView 顯示 scope 包含 replayId，清除該事件的本機顯示阻擋及銀行／學校／醫院／維修視窗已開啟標記；原卡片 handled 標記只針對該事件清理。雲端終身學習待判定 effect 接 replayId，確保重新呈現後恢復原待骰。未重新設定雲端翻牌、付款、骰點或流程完成狀態；投影持續讀取原已確認事件，不重擲或補播逾時骰子。
- verification-coach-replay-core.log：Firestore-only 核心 exit 0，包含 host／舊事件資格、六並行、保留原事件與 timestamp、翻牌、待接續、共享提示及私人財務，重送不重建已結束事件。
- verification-coach-replay-ui-final.log：Context 28 項通過，包含新命令路由／原 ID／revision，沒有客戶端寫入。GameView 的實際重開畫面仍須瀏覽器驗證，不能以 Context mock 宣稱完成。
- verification-coach-replay-callable.log：實際 Auth／Callable／RTDB／trigger exit 0。普通玩家測試發 C003、翻牌、付款（不足時用合法周轉）、host 六並行重新呈現，確認原事件／timestamp／翻牌／付款後 private state／continuation 一致，接續原 event 的 rollLearning 成功並完成判定。既有離線及指定回合回歸同時通過。此為模擬器固定卡片測試，不是正式自然抽卡多端證據。

verification-coach-replay-build-unit.log：完整 verify exit 0，前後端 typecheck、Functions build、84 檔／562 項單元及完整前端 build 通過；500 kB 警告仍存在，不代表效能達標。強制清除／結束仍須保留或明確封存待辦，不能沿用舊清除全部 pending 的實作。仍未整合 dev、未部署；完整卡片／500 混合回合、瀏覽器／雲端與效能等未完成範圍保持。

## 2026-10-03 接續：後端測試發卡

- coachTestCard 已接實際 RoomContext／gameCommand／coachBoard；以本場 host、場次、有效普通玩家及 revision 驗證。只接受卡片 ID，復用 buildBoardCardResultById 與本人私有狀態建立官方事件及未翻牌狀態；不能偽造金額或效果。穩定命令與事件 ID、防重收據原子保存，沒有改玩家財務或牌堆。
- 僅 FUNCTIONS_EMULATOR=true 允許強制測試發卡，符合測試工具只限模擬器的方案限制；正式後端拒絕。進行中的移動、事件、卡片、共享、排隊事件及未完成 continuation 均阻擋，避免丟失已付款待辦。
- verification-coach-test-card-core.log：Firestore-only 核心回歸 exit 0；新增正式模式拒絕、普通玩家拒絕、缺玩家／未知卡片拒絕、六並行一次、不能覆蓋新事件、改內容拒絕、舊命令重送不重建事件及私人財務不變。verification-coach-test-card-ui.log：實際 Context 28 項通過，包含只提交識別／revision、無客戶端寫入、waiting 保留；前後端 typecheck 及 Functions build 通過。

verification-coach-test-card-callable.log：實際 Auth／Callable／RTDB／trigger 串接 exit 0。普通玩家不能測試發卡、偽造效果欄位拒絕、六並行只發一次、存在事件時不能另發、改內容不能沿用命令、原結果可查核、玩家私有資料不變；既有離線、指定回合及普通玩家共享結案一起回歸。仍未整合 dev、未發布；重播、強制復原、全量分支／混合回合、瀏覽器／雲端與效能驗收等完整範圍仍待完成。

## 2026-10-03 接續：執行師離線處理與指定下一位

- skipDisconnectedTurn／skipDisconnectedSharedTarget 已由實際 Context 路由交给 coachBoard 後端，核對本場 host、完整 schema、回合 revision／事件與有效參與者。RTDB 在線狀態由後端讀取；仍在線、離線未滿 120 秒、缺失或無效紀錄都拒絕。五秒查核逾時中止交易、保留回合及原命令。
- verification-coach-offline-callable-canonical-final.log：實際 Auth／Callable／RTDB／trigger 通過。C034 asset_sale 使用普通抽卡者完成本人拒絕，host 排除另一離線參與者後由 trigger 結案；六並行只一次，私人財務沒有改動。不是自然抽卡完整多端驗收。初次 namespace 及錯誤卡種 fixture 失敗紀錄保留；修正本機設定／fixture，沒有放寬權限。
- setCoachNextTurn 已接上同一後端模組。只接受目標 UID、revision 與命令識別；待判定、移動、事件、卡片、共享或待處理事件阻擋切換。只改棋盤與持久結果，不讀 RTDB、不改財務；舊命令重送回原結果，不覆蓋新回合。
- verification-coach-next-turn-core-final.log：新增 host 權限、流程阻擋、六並行一次、過期 revision、改內容拒絕、後續 revision 的原結果重送檢查通過，並跑既有離線核心回歸，exit 0。verification-coach-next-turn-ui.log：實際 Context 28 項測試通過，包含路由與 waiting 不當成功；前後端 typecheck 通過。首次核心命令誤用輸出路徑的 MODULE_NOT_FOUND 紀錄保留，正確 lib 輸出重跑通過。
- verification-coach-next-turn-callable.log：实际模擬器 Auth／Callable／Firestore／RTDB／trigger exit 0。普通玩家與場外帳號不能指定回合；負 revision 拒絕；待判定時沒有結果收據；六並行指定一次、在線玩家亦可由合法 host 指定；不同內容沿用命令拒絕；後續 revision／回合不受舊命令重送影響；本人原結果查核成功。既有離線與普通玩家 C034 回覆／trigger 結案同時回歸。新增指定回合的 Callable 串接已補齊，仍不是正式雲端或瀏覽器驗收。
- verification-coach-offline-build-unit-final.log：前一批 verify 84 檔／562 項、完整前端及 Functions build 通過；不當成新增指定回合 Callable 的驗證，串接由下一筆實際 Callable 紀錄驗證。

仍未整合 dev、未部署。測試發卡、重播事件、強制清除／結束、完整卡片分支／500 混合回合、報表讀取、瀏覽器與雲端／效能驗收等完整範圍保持未完成。

## 2026-10-03 接續：完整前端建置與 CI 門檻

- 從目前 dev 補入缺少的入口 HTML／TSX、既有 PostCSS／Tailwind 配置、依賴 manifest／lockfile 及 public 靜態資產；沒有複製環境變數、Vercel 設定或改寫 dev。候選版首次完成完整 Vite build，dist 入口資產及 manifest／icon／隱私／條款檔案均存在。release typecheck 現在也涵蓋入口、services 與根 types。
- package scripts 提供 verify、test:rules、test:backend:core、test:backend。verify 串接前後端 typecheck、Functions build、全部非 Rules 單元及完整前端 build。Vite／Vitest 使用既有 runner loader，避免把配置暫存寫入唯讀共享 node_modules；初次 EPERM 紀錄保留，沒有申請改寫 dev 依賴。
- firebase.json 補入既有 RTDB Rules 與本機 9499 模擬器。test:rules 同時執行舊格式 Firestore／RTDB 測試及 116 項後端 authority Rules 檢查，verification-ci-rules-gate.log exit 0（59 項 Vitest Rules 測試＋116 authority 檢查）。規則拒絕的預期錯誤不當作遊戲操作通過。
- verification-candidate-build-gate-final.log：verify exit 0，84 檔／561 個單元通過。verification-frontend-entry-typecheck.log：擴大入口範圍後 typecheck 通過。manifest／lockfile 的依賴宣告一致。主入口仍約 1,203 kB／gzip 323 kB、GameView 約 280 kB、投影約 60 kB；500 kB 警告保留，不能宣稱效能已達標。
- scripts/testBackendCore.mjs 依序編譯／執行 25 個既有後端核心套件，先驗證 demo 專案及本機 Firestore endpoint；核心手動時間測試刻意不啟动 Functions。Auth／Callable／trigger 由獨立 test:backend 執行，避免背景 trigger 污染手動時間測試。
- .github/workflows/game-quality.yml 配置 Node 22／Java 21、兩份 lockfile 的 npm ci、verify、雙 Rules、全部核心及 Auth／Callable／trigger 門檻，read-only repo 權限，沒有部署步驟。YAML 已解析及核對；尚未 push／整合，因此不是 GitHub CI 已通過的證據。本機仍為 host Node 24。env.emulator.example 明確列出所有本機 endpoint 與 demo 專案，尚未載入此設定啟動瀏覽器。
- verification-source-integration-inventory.json 保存最新 dev c335f29 與候選 src／services 的來源雜湊：195 檔相同、40 檔不同、候選新增 34 檔，沒有 dev 來源檔缺漏。差異尚須逐一整合核對，不能拿此數量當合併完成。
- 入口盤點發現執行師離線跳過／共享目標跳過、測試發卡／重播／指定下一位及強制復原仍有舊客戶端寫入入口。需要接續移交或在新模式清楚限制其資格及操作；未標記全部操作移轉完成。

- verification-ci-backend-core-gate.log：25 個核心套件全部通過、exit 0，包含 160 張卡翻牌、36 張共享卡、學習成功／失敗、六並行、205 筆操作後重送及結算／關房。這不是全部卡片所有選擇分支或 500 個混合玩家回合的證據。
- verification-ci-callable-trigger-gate.log：新 test:backend 完整 Auth／Callable／trigger 指令通過、exit 0；含個人財務、卡片／審核／共享、執行師操作、協定及 create→join／leave／slots→start→setup→finish→archive→close→recreate。
- RTDB 診斷新增 uid 必須等於寫入路徑身分、updatedAt 必須是數字的驗證，禁止本人偽造其他玩家身分或字串時間。增加連線／診斷／控制權／未知集合的合法、非法及匿名測試。verification-ci-rules-gate-final.log：62 個 Firestore／RTDB Vitest 測試＋116 authority Rules 檢查全部通過、exit 0。未修改正式啟用規則。

仍未整合 dev、未部署；全量卡片分支／500 混合回合、剩餘入口、相容回退、瀏覽器／雲端與實機／效能驗收未完成。CI workflow 尚未在 GitHub 或乾淨 Node 22 安裝環境執行，不能宣稱遠端 CI 通過。

## 2026-10-03 接續：投影時間對齊與訂閱資格復原

- 骰子呈現以事件及房間 scope 綁定，依伺服器時間計算剩餘展示期限；晚到已過期事件直接呈現目前結果，回前景／重連／校時重新對齊。StrictMode 不再清除已選事件，舊計時器不能關掉新事件。家庭骰子同樣依展示期限恢復，房間／回合／提示切換清理舊狀態。
- 抽出既有 roomSnapshot 純函式；投影 root／公開玩家／回覆訂閱移到 useProjectionRoom。訂閱以 Auth UID／房號／場次／提示綁定，忽略舊回呼與較舊 revision，過期快取或未確認本機寫入不取代已確認後端棋盤。根文件無關 metadata 更新不重建公開摘要。投影斷線入口改為 hf-reconnect，不必刷新整頁。
- 共用 observeSnapshots 在 permission-denied 後，先以 getDocFromServer／getDocsFromServer 讀取同一文件／查詢，由實際 Rules 查核資格，沒有自行複製角色規則或讀 SDK 私有欄位。拒絕／離線保留原錯誤；同時觸發復原只執行一次查核。查核前後驗證原 Auth UID、generation、前景及 disposal，帳號切換後的快照與暫時錯誤計時器也不能復活旧訂閱。伺服器資格讀取不直接發布為遊戲快照。
- useSharedPromptResponses 在 server-prompts-v1 明確停止執行師自動 finalize；持續訂閱呈現回覆，由既有後端 trigger／task 結案。舊房間保留原 fallback，沒有修改正式資料或搬遷既有房間。
- verification-unit-projection-final.log：84 檔／554 tests 通過；前後端 typecheck、Functions build 通過。verification-unit-subscription-access-final.log：84 檔／561 tests 通過；前端 typecheck 通過。新增檢查包含資格拒絕／恢復、確切 query、同時恢復、帳號切換／取消／背景競爭、旧快照／重試，以及後端模式全員回覆時執行師不送結案命令。
- 投影／訂閱測試使用 SDK mock；骰子測試使用實際 DiceFace、mock 動畫層。這些證據不能代替瀏覽器視覺或實際雲端 listener／Tasks／效能驗收。本輪未更動後端效果或 Rules，未重新執行其模擬器專項。

仍未整合 dev、未部署。全量卡片分支／500 混合回合、其他操作畫面與診斷串接稽核、完整前端 build／CI、相容回退、雲端及實機與 P95／P99 驗收仍未完成，完整計畫保持未完成。

## 2026-10-03 接續：後端結算／關房與分文件封存

- 新增 finishRoom／closeRoom，只接受房號、場次及原命令 ID；由 Auth 與本場有效房主、完整後端模式驗證資格。結算凍結共同 deadline，封存未完成棋盤／接續與審核，不把未完成效果當完成或補發。
- 房間快照存於 room_archives/{sessionId}/state/room；診斷、待辦及待排程工作各存自己的文件。主封存保存格式 2、數量、快照位置、校時有效性、後端 runtime／可取得 build、同場診斷缺漏及關房收據。原診斷中的前端版本／build／Rules 雜湊保持原值，缺端不標成無錯誤。分文件避免多端摘要合併撞單文件大小限制；沒有刪減來源內容。
- 封存、取消待排程工作、清除仍指向本場的帳號／房主指派、持久結果與 finished／刪主文件同交易提交。讀寫失敗中止整筆，保留房間；新場指標不受舊命令重送影響。私人財務歷史與原結果子集合保留，不做 recursiveDelete。新後端建房排除已有封存的房號，避免覆蓋歷史子集合。
- 主文件刪除後仍可透過可信封存查核自己的原結果；關房／結算原命令重送回保存結果，不再次清除新場指標。前端從大廳也能查核原結算／關房草稿，重開／重連只查核；顯式重試沿用原 ID。未知或損壞草稿保留並顯示原因。結果格式異常或登入改變時保留原待辦，不覆蓋另一分頁的新命令。
- RoomContext 新模式不直接改 finished、清帳號或刪主文件；關房成功抑制舊登入指標重新恢復房間。執行師 ConfirmModal 等待 Promise、阻擋重複確認及取消，失敗留在畫面顯示原因。舊／練習模式保持原生命周期。
- Rules 禁止一般客戶端結束／刪除後端房與偽造／修改可信封存。可信封存及子文件僅本場房主可讀，不能以可自行修改的 coach 角色取得其他場封存；既有全域 GM 例外保留。舊格式封存沿用原權限。
- 結束時取消 pending／scheduled 移動與共享工作。已送出的舊移動任務遇 finished 回 stale；延遲 room trigger 不為 finished 房重新建移動工作。
- verification-lifecycle-core-final.log：六並行結算／關房、注入封存寫入失敗的整筆保留、1.2 MiB 診斷完整分文件保存、待辦／缺端旗標、新場指標、刪主文件後查核／重送及非法／過期／舊模式拒絕通過；含 finished 後舊移動回 stale，exit 0。
- verification-lifecycle-partition-rules-final.log：封存核心、45 項移動及 116 項 Rules 檢查通過，exit 0。verification-triggers-lifecycle-full.log：完整 Auth／Callable／trigger 回歸通過，含真實建房→加入／容量→開局／設定→六並行結算→六並行關房→原結果查核→下一場／舊命令重送，exit 0。
- verification-unit-lifecycle-ui-final.log：81 檔／540 tests 通過；前後端 typecheck、Functions build 通過。保留初次失敗紀錄：關房後舊指標重恢復已修正；核心測試重用同場舊收據及注入資料庫缺少 doc 方法的 fixture 問題已更正。

仍未整合 dev、未部署。本輪沒有完成瀏覽器多端畫面、雲端 Node 22／App Check／IAM／Tasks／Scheduler 或效能驗收；模擬器實際使用 host Node 24。全量操作／卡片分支、500 混合回合、訂閱／投影／診斷串接稽核、完整前端 build／CI、相容回退與正式驗收仍待完成。

## 2026-10-03 接續：可信名單／容量與離開失敗復原

- joinRoom／leaveRoom／setRoomSlot 使用 Auth 玩家、可信房間模式及場次驗證，名單、本人 activeGame 與持久結果同交易保存。新玩家只能加入 waiting 房，六人容量在交易內限制；已在場玩家可恢復 playing 房，暫時回大廳保留席位與待確認財務命令。
- 玩家角色由後端建立為 player，不採用可自行修改的全域 role 授權。只有本場有效執行師能調整 waiting 房容量；不能關閉已占用席位。重送舊容量命令只回原結果，不覆蓋新的容量。離開只清除仍指向本房的 activeGame，不抹除新場指標。
- getCommandResult 允許本人查離開後的名單收據及 waiting 房尚未確認的加入，仍禁止離場後查私人財務結果。Rules 禁止客戶端改後端房間名單／容量，舊房間保留原名單路徑。
- RoomView 等離開／關房成功才返回大廳；失敗保留確認視窗與原因。處理中禁止重複確認／取消。Context 保留離開失敗的 Room，回傳原因；離開／容量調整遇未知格式明確拒絕，不降級舊版寫入。關房資格失敗不再回傳假成功。
- verification-membership-rules.log：八人競爭六席、重送、離場查核權限、舊容量重送、遊戲中恢復及八次加入／開局競爭通過；13 項命令查核、5 項錯誤分類與 100 項 Rules 檢查通過。
- verification-triggers-membership.log：實際 Auth／Callable 建房→加入／離開／容量→開局→玩家設定專項通過，exit 0；含五個剩餘席位七人競爭、簽章資格、協定、非法參數、重送及現金不重設。
- verification-unit-membership-recovery.log：79 檔／531 tests 通過，包含實際 Context 和等待頁的失敗保留、忙碌、防重、成功導航與未知格式拒絕；前後端 typecheck、Functions build 通過。

尚須完成可信結算／關房生命週期：目前 finishRoomGame／closeRoom 仍有客戶端寫入及封存流程，不能稱已全部後端接管。verification-triggers-membership-full.log：完整 Auth／Callable／trigger 回歸通過，exit 0，涵蓋財務／卡片／六人共享結案、執行師操作、協定、開局／設定及建房／名單／容量。本機通過不代表正式雲端或實機驗收完成。dev 整合、完整前端 build／CI、全量卡片分支與混合回合、同步呈現／診斷封存稽核、效能及雲端／實機驗收仍未完成。未部署。

**最新進度（2026-10-02）**：後端翻牌與提示建立、家庭回覆／付款、共享機運／新聞本人交易與結案、銀行／企業、股票買賣、汽車購買、保險及定存／解約、不動產購買／拒絕／自住轉換、新聞股價／泡沫效果及結案、棋盤移動、C001–C008、一般學校、醫院／維修格、H009 幸福分享審核及 C056 分享後新聞抽卡、一般幸福卡與沒有共享提示的家庭歷程接受／拒絕、C035–C037 醫療付款／送醫／理賠已完成本機後端驗證。共用命令入口已補上持久保存、逾時結果查核及重新載入後的安全重試介面。下方各批次的「尚未完成」是當時紀錄，後續章節會更新範圍。一般機運卡已補實作（驗證見下方）；C054 已補後端審核及財務接續；人工財務與可信建房／開局入口亦已有後續實作；全量入口稽核、結算／關房接管、dev 整合及雲端／實機驗收仍未完成。不能啟用完整正式遊戲。

## 2026-10-03 接續：實際建房路由與畫面復原

- RoomContext 已接 createRoomOnServer；只有明確配置 VITE_SERVER_GAME_ROOMS=true 的新一般棋盤房使用後端開房。未配置／關閉時維持舊新房模式，練習模式仍用原流程。後端拒絕不降級為 client setDoc。正式環境尚未配置此旗標或 gameHost 權限，沒有啟用正式新房。
- 開房確認後使用 getDocFromServer 取得同一房號／場次／房主的最新 Room，再由 Context 設定 listener scope、房間恢復指標及呈現。若讀取失敗、登入改變或格式不支援，恢復原持久命令；不覆蓋另一分頁的新命令。下一次先查原結果再載入，不建立第二間房。
- 只有伺服器確認原房間不存在時解除原待辦並明確提示已關閉；離線／讀取失敗不得當作不存在。模糊／缺欄位結果也保留原命令，不能當成功。
- RoomCreationRecovery 在尚未進房時顯示處理狀態，三秒後提供查核／安全重試。重新載入、回前景及重連只自動查核，不自動重送開房。已確認者可直接載入原房間，不必重新整理。損壞草稿保留並顯示原因，StrictMode 取消舊 effect 不會卡住 busy 或讓舊錯誤覆蓋新查核。
- verification-unit-room-create-activation-final.log：77 檔／522 tests 通過。包含實際 Context 啟用路由、直接恢復、未啟用及練習房相容、後端拒絕不降級；原命令讀取失敗後接續、模糊結果、伺服器確認已刪除、不同分頁草稿、UI 延遲提示／查核／顯式重試及 StrictMode。前後端 typecheck、Functions build 通過。

### 本批架構邊界

開房命令、權限與防重仍由 Functions 擁有；serverRoomCreation 復用原持久命令／鎖並負責 SDK 提交與確認後載入，Context 只接命令並持有 Room，Recovery 元件只呈現待辦及使用者觸發。沒有新增依賴或第二套財務計算。新房啟用旗標不搬遷既有場次。

玩家加入／容量的可信流程與客戶端資格握手仍須核對補齊；本輪未執行完整瀏覽器或雲端多端驗收，也未重跑未更動的後端 Auth／Rules 專項。仍未整合 dev、未部署；完整卡片／混合回合、診斷封存、效能及正式雲端／實機驗收仍待完成。

## 2026-10-03 接續：可信建立房間與原命令恢復

- 新增 createRoom／getRoomCreationResult。房號由 crypto 產生六位數、場次 ID 由伺服器 UUID 預留；新房完整設定 schema／三項 authority／公開與財務子集合／最低協定。名稱、最多六人與時長由嚴格解析器檢查，不接受玩家指定角色、host、房號或效果。
- users/{uid}.role 目前允許本人修改，不能視為可信開房資格。新增入口只接受 Callable 驗證後的 Auth gameHost:true 自訂權限；既有角色文件不授權。正式權限配置仍未進行，測試僅在 demo Auth 以 Admin SDK 配置。
- 建房、執行師私人房間指派、帳號 activeGame 與持久結果同交易保存。同命令並行只建一間；不同命令遇到未結束房間拒絕。已結束房間可建立新場；舊命令重送不改新場指派。本人可查原結果，不揭露其他帳號的結果。新伺服器專用集合禁止一般客戶端讀寫。
- 前端 createRoomOnServer 復用既有持久命令／查核及鎖，開房前的暫存 scope 不作為實際房號送出。同時點擊共用原命令，重開先查原結果；尚待確認時不能改設定或創新命令，登入改變不呈現另一帳號房間。此 helper 尚未接入 Lobby／Context 建房路由與完整復原介面。
- verification-room-create-rules.log：可信權限、六並行、完整旗標、場次 UUID、一間有效房、私人原結果及 create→start 接續 core 檢查通過；93 項 Rules 檢查通過，exit 0。
- verification-triggers-room-create.log：實際模擬器 Auth／Callable 專項通過，含自行設定 role:coach 仍拒絕、Admin 簽發 gameHost 權限成功、協定要求、六並行防重、改設定拒絕與真實 create→start→setup；重送不重設現金。完整 Auth 腳本已加入此專項，本輪只執行新增專項。
- verification-unit-room-create-final.log：76 檔／510 tests 通過；前後端 typecheck 與 Functions build 通過。保留第一次 verification-unit-room-create.log：抓到持久鎖延後保存期間兩次點擊會產生不同 UUID，已改為共用既有 runLockedBoardCommand，測試通過。另保留 verification-unit-room-create-wait-helper-failed.log，該次使用不存在的測試 waitFor 匯出，已更正為 vi.waitFor。

尚須把新建房入口及復原介面接回實際前端，確認加入／容量流程，並在驗收環境配置簽章執行師資格；現有正式房間不可手動打旗標搬遷。未整合 dev、未部署；完整卡片／混合回合、診斷封存、效能及雲端／實機驗收仍待完成。

## 2026-10-03 接續：後端原子開始場次

- 新增 startRoom，僅本場有效執行師能操作；要求可信新房間已具備完整 schema／三項 authority／公開與財務子集合／最低協定。舊房間、練習房、已開始／結束或帶舊 startedAt 的房間均不轉換。新後端房間在建立時預留場次 ID，開始保留此 ID，讓提交逾時後仍可查原結果。
- 開始交易一次建立在場一般玩家（最多六位）的本場私人預設資料、初始公開摘要、棋盤／市場／暫停計時器與持久命令結果。排除執行師及已離場者；依房主身分區分玩家，不用帳號全域 role 排除參與者。缺玩家、重複 UID、非法容量或時長皆不部分建立。
- 將 createInitialBoardState 從 Context 移至純函式模組，既有呼叫與匯出維持相容。牌堆在 transaction 外生成，SDK 重試不重新洗牌；每次交易依最新有效名單建棋盤。
- RoomContext 開始後端房間僅在執行師明確操作時送原 start command；waiting 不顯示已開始，也不預先改畫面。完成狀態由雲端訂閱更新。Rules 禁止客戶端直接啟動後端 waiting 房、更改場次 ID／開始時間或退回 waiting，舊模式保留相容。
- verification-room-start-rules.log：六並行開局、六位玩家後接官方設定、完整三個牌堆、私有／摘要、逾時結果查核、非法／舊場次及重送不重設現金／revision 檢查全部通過；87 項 Rules 檢查通過，exit 0。
- verification-triggers-room-start.log：真實模擬器 Auth／Callable 開局＋設定專項通過，含六並行各一次、角色／偽造開始時間、保持場次 ID、原結果查核及已開始場次重送不重設玩家。完整 Auth 腳本已串入此專項，本輪只跑該專項。
- verification-unit-room-start-final.log：75 檔／505 tests 通過，包含實際 Context 不自動開局、等待確認、原 ID 重送與雲端呈現。前後端 typecheck、Functions build 通過。

可信建立房間入口仍未完成，因此目前仍不能從一般前端建立完整後端新房；不能在既有正式房間手動打旗標取代此步驟。尚未整合 dev、未部署；完整卡片／混合回合、診斷封存、效能及雲端／實機驗收仍待完成。

## 2026-10-03 接續：可信玩家初始設定

- 新增 setupPlayer 命令，只接受職業／事業／夢想 ID 與顯示名稱。沿用官方常數、既有初始幸福清單與預設狀態；前端選擇頁及後端共用 buildPlayerSetup。職業底薪與基本支出仍存於 profession，income／expenses 為既有額外調整欄位，保持空物件，避免重複計入。
- 後端確認 Auth 玩家、有效成員、場次／schema、後端財務模式及已初始化的本人文件。初始財務、公開摘要與原命令結果同交易保存；重送回原結果，不會重設遊戲中現金。不同命令不能重選已完成設定，同一命令不能換選擇或名稱。
- GameContext 後端模式只送選擇，不直接寫玩家文件；waiting 不視為成功。確認後讀取最新私有資料，避免拿設定收據還原初始現金；場次與登入改變時停止套用。練習／舊房間保留原流程，未知格式拒絕提交。
- verification-player-setup.log：189 項本機 Firestore 檢查通過，包含所有官方職業、六並行、初始幸福／摘要、原命令重送、非法玩家／選擇／過期場次。verification-triggers-player-setup.log：實際模擬器 Auth／Callable 六並行、防重、協定、偽造現金、角色及結果查核專項通過，exit 0。
- verification-unit-player-setup-passed.log：75 檔／504 tests 通過；前後端 typecheck、Functions build 通過。新增前端檢查涵蓋所有事業／夢想選擇、waiting、更新要求、過期場次、登入變更及原命令讀取最新現金。
- 保留 verification-unit-player-setup-final.log：第一次全套回歸發現 completePlayerSetup 依賴整個 Room 導致無關快照重新發布 Context。已改為場次／authority／相容原因等必要依賴，原效能檢查通過。完整 Auth 回歸腳本已加入設定專項；本輪只執行新增專項，未重跑整份 Auth 腳本。

可信新房間／開始場次初始化仍未完成：必須由後端原子建立本場玩家文件、初始公開摘要與固定協定／authority，不能直接啟用現有客戶端 startRoomGame。此輪仍未整合 dev、未部署；完整卡片／混合回合、診斷封存、效能與雲端／實機驗收仍待完成。

## 2026-10-03 接續：後端客戶端協定握手

- 共用 Callable 入口讀取 requiredClientProtocol；新房間可要求協定 1。SDK 只在送出封包時附 clientProtocolVersion，不更改持久待辦、原 command ID、玩家選擇或交易 fingerprint。舊房間未設定最低協定仍相容。
- 不符合最低版本／未知房間格式時，入口回傳明確 failed-precondition，停止送入效果處理。協定值不是身分／資格證明；每個交易仍在交易內依 Auth UID、場次、角色及事件驗證財務與流程。最低版本應固定於可信的新場次初始化，不在既有進行中的場次提高。
- getCommandResult 維持唯讀例外，版本升級後仍可查自己的原命令結果。修正查核器拒絕含 # 合法 command ID 的問題，roomId／sessionId 不放寬路徑字元。
- Rules 禁止客戶端建立／修改最低協定。新旗標仍只由可信後端設定，沒有啟用正式房間。
- verification-client-protocol-rules.log：13 項原結果／權限／識別值查核、5 項錯誤分類及 81 項 Rules 檢查通過，exit 0。verification-unit-client-protocol.log：74 檔／499 個單元測試通過；前後端 typecheck、Functions build 通過。
- verification-triggers-client-protocol.log：完整 Auth／Callable 回歸與協定专項通過，exit 0；含舊協定拒絕零效果、字串協定拒絕、有效協定一次入帳、重送不再發點、非成員拒絕、提高版本後仍可查原結果及移除門檻的舊房間相容。
- 入口新增一次房間讀取以核對最低版本，沒有快取可漂移的授權或相容狀態；正式延遲／冷啟動與讀取成本仍待量測，不能宣稱性能達標。

可信新房間／場次初始化、實際 client-capability 啟用流程與完整相容回退仍未完成；本輪未整合 dev、未部署。其餘完整流程、卡片、混合回合、診斷封存、雲端／實機驗收持續進行。

## 2026-10-03 接續：客戶端未知格式保護

- 共用 getRoomCompatibilityError 核對已實作的 sync／flow schema、共享／財務／移動 authority 與公開摘要儲存格式。舊房間及既有格式相容；未來值、錯誤布林／物件／陣列都不能被當成本機舊模式。
- RoomContext 的一般操作、共用棋盤寫入、銀行 gateway 與直接共享結案入口沿用此判斷。玩家／執行師／投影的 SubscriptionStatus 同樣依完整房間資料顯示更新要求；原因使用使用者可理解的中文，不暴露內部欄位名。
- 未確認命令仍可查核結果；未知格式不能安全重送。相容失敗發生在銀行鎖與持久命令建立之前，不留下假 busy；RoomContext 測試確認未知銀行 authority 不送後端或降級本機財務。
- verification-unit-room-compatibility.log：73 檔／497 個單元測試通過，前端 typecheck 通過；涵蓋六種未知格式、實際更新提示、舊房間、原命令恢復與 gateway 拒絕後恢復相容格式。

本批是更新後客戶端的格式判斷，不代表已能讓目前正式舊客戶端辨識新模式。可信新房間初始化、後端客戶端協定版本握手與最小版本限制仍須完成。未修改雲端、未整合 dev、未發布。

## 2026-10-03 接續：公開玩家摘要分散儲存

- 新的 publicPlayerStorage: subcollection 標記由可信後端設定。公開摘要改存 rooms/{roomId}/publicPlayers/{uid}，每筆帶 sessionId；財務／幸福效果、私人完整歷史、命令結果與必要公開摘要仍在同一交易提交。沒有該標記的旧房間保留主文件摘要。
- financeCommit 共用寫入器與 movement 都支援此模式；只有流程需要推進時才更新棋盤。十種夢想的六並行測試確認扣款／幸福／摘要一起完成、摘要沒有 cash／liabilities，且房間文件 updateTime 完全不變。
- usePublicPlayerStates hook 管理公開摘要訂閱；RoomContext 與投影共用。只接受本場有效玩家的本場文件，身分不符／離場／舊場次資料忽略；換場舊 callback 不覆蓋新資料，房間快照不覆蓋已收到的摘要，重複快照不更新 Room 或重建訂閱。舊模式不建立此訂閱。
- Rules 限定具房間讀取資格者可讀；一般玩家／執行師均不能寫摘要，也不能改儲存模式、偽造主文件摘要或由客戶端建立新模式。
- verification-public-player-storage.log：260 項個人銀行／夢想檢查、205 次操作後舊命令重送及 78 項 Rules 檢查通過，exit 0。verification-movement-public-player-storage.log：45 項移動／計時器檢查通過。verification-unit-public-player-storage-final.log：71 檔／486 個單元測試通過；前後端 typecheck、Functions build 通過。
- verification-triggers-public-player-storage.log：完整 Auth／Callable 整合及執行師專項通過，exit 0；六人共享與人工財務／夢想啟用新摘要模式，其餘案例保留舊模式以驗證相容。本機 120 筆成功／重複命令中位約 13ms、P95 約 3344ms、最大約 3781ms；仍未達正式體驗目標，不能以單次本機樣本宣稱正式效能改善。
- 保留 verification-triggers-public-player-storage-precheck-failed.log：曾把手動時間的 movement core 檢查與活躍 Functions 放一起，自動任務先結算而讓「手動結算一次」斷言失敗；現在 core 在 Firestore-only 執行，自動任務由獨立 Auth 整合驗證，未改低測試門檻。

### 本批架構邊界

財務／流程領域仍由現有命令模組擁有；來源為私有玩家文件與棋盤，公開摘要是衍生顯示資料。Admin 共用寫入器負責原子儲存，Rules 負責客戶端讀寫邊界，hook 負責訂閱，View 只呈現。沒有新依賴、沒有第二套財務規則；新舊儲存路徑由標記擇一。Context 只接 hook，沒有承接新的訂閱實作。變更限於上述後端寫入器／移動、Room 型別／合併、共用 hook／投影及 Rules；卡片數值、練習模式與正式設定未改。

新房間可信初始化與舊客戶端更新保護仍未完成，正式不能啟用此標記。尚未整合 dev、未發布；完整卡片／混合回合、诊斷封存、雲端及實機／效能驗收繼續進行。

## 2026-10-03 接續：交易讀取順序與完整登入回歸

- 銀行、家庭、一般幸福、學習、不動產、機運、醫療、醫院維修、移動、翻牌及個人幸福共 11 個入口改為先取得房間文件，再平行讀必要子文件；對齊已修正的共享命令與結案讀取順序。沒有增加全體回覆讀取，也沒有更改資格／效果／防重規則。
- verification-triggers-root-read-order.log：完整 Auth／Callable 回歸及後接人工財務專項通過，exit 0。包含家庭／共享、六人共享結案、學習、審核、新聞接續、銀行、股票、不動產、行情、醫療、醫院維修、機運、個人幸福、執行師調整與夢想付款。
- 本次本機日誌成功／重複命令樣本 120 筆，中位約 13ms、P95 約 3451ms、最大約 6732ms；sharedAction 13 筆中位 3410ms、最大 6732ms。此為本機混合回歸樣本，不能替代正式 P95/P99 量測，也不能宣稱延遲達標或改善。房間主文件寫入競爭仍需處理。
- 實際 TargetAndDreamModals 的企業／夢想產生器已加入官方選擇全量路由檢查；transactionRoute 18 個測試、前後端 typecheck 及 Functions build 通過。
- 手動股利／配股格式只存在目前未被引用的 useTransactionLogic；實際玩家股利走共享卡片後端命令。不新增沒有遊戲來源的任意領款命令。這項盤點不表示全部財務／特殊入口已盤點完畢。

仍在隔離試作目錄，未整合 dev、未發布。新房間啟用／舊客戶端保護、同步顯示恢復、診斷封存、完整卡片／混合回合、效能與正式雲端驗收均仍未完成。

## 2026-10-03 接續：事業表單入口及計時器截止時間

- 目標事業原本主畫面已呼叫 purchaseEnterprise；漏接的是 completePlayerOnlyTransaction／manual-bank 共用格式路由，且 Context 忽略表單原 commandId。共用路由現在沿用同一購買函式，以原 commandId 優先；後端既有官方價格／收益、付款及事業成就交易維持不變。
- GameView 事業成功只認 applied／duplicate，不再把其他未確認結果當成功。Context 路由測試驗證 waiting 保留、重送原 ID，以及偽造金額／現金／收益不送至後端。31 項相關測試通過。
- 明確 pause 命令若運行中房間缺失／無效共同 deadline，現在拒絕並提示執行師重新設定；不能採用各手機提供的秒數。合法 set 命令可修復，既有無 mode 的相容語意維持。
- verification-enterprise-timer-guards.log：42 項移動／計時器及 52 項銀行／企業模擬器檢查通過，exit 0；包含無效 deadline 不更新暫停狀態與明確重新設定恢復。verification-unit-enterprise-route.log：70 檔／481 個單元測試通過。前端及 Functions typecheck、Functions build 通過。

本輪未跑真實 Auth 新專項或實機驗收。仍未整合 dev、未發布；其他交易格式、新模式相容、整體效能與完整雲端驗收仍需完成。

## 2026-10-03 接續：夢想付款後端化

- purchaseDream 只接收夢想選擇 ID。後端由本人私有文件選擇及官方 DREAMS 核對；不信任客戶端名稱、價格、現金變更或幸福點數。付款、夢想完成、幸福總分、完整財務紀錄及持久命令結果同交易保存。
- 沿用既有交易純函式與官方夢想點數；完成後新命令拒絕再次付款，同一命令重送回原結果。個人夢想付款不推進棋盤，也不讀無關共享回覆。缺目標、錯誤點數、現金不足或選擇過期均保留資料。
- 實際「實現人生夢想：…」表單路由與 GameView 個人提交入口已接上；Context 僅送選擇 ID，等待確認保留原命令，沒有本機降級。
- verification-dream-purchase.log：十種官方夢想、六並行及既有銀行共 230 項檢查、205 次操作後舊命令重送、68 Rules 檢查全部通過，exit 0。包含偽造選擇內價格／點數、付款效果、已完成、資金不足與零部分入帳。
- verification-unit-dream-purchase.log：70 檔／478 個單元測試通過；前後端 typecheck、Functions build 通過。新增 Context 檢查只送官方選擇 ID，waiting 不當成功且重送沿用原 ID。
- verification-triggers-dream-purchase.log：一般玩家 Auth／Callable 真正通過付款、並行一次、價格不可偽造、完成後拒絕再買與本人命令查核；既有人工財務專項一併通過，exit 0。本輪未重跑全體 Auth 整合，正式雲端與實機仍未驗收。

仍未整合 dev、未部署。其他交易格式、相容啟用、完整流程／效能／雲端驗收繼續列為未完成。

## 2026-10-03 接續：幸福清單命令相容與出售貸款歧義

- 個人幸福清單預設命令 ID 會包含既有自訂項目的 `#`。後端原先只允許 itemId 使用此字元，導致正常切換／刪除在格式驗證被拒絕；commandId 現在同樣支援，roomId／sessionId 仍禁止 `#` 與路徑字元。
- generated identifier 專項 56 項通過；verification-happiness-command-identifiers.log 的 42 項模擬器檢查通過，含實際產生的項目 ID 組成命令、切換／刪除及重送原結果，exit 0。
- 共用貸款配對沿用原本「明確資產關聯優先、舊資料名稱／種類後備」規則；手動出售額外確認唯一貸款。多筆候選貸款時保留資產與負債、拒絕出售，避免只扣第一筆貸款。其他呼叫端的既有單筆選取契約維持相容。
- verification-asset-sale-loan-ambiguity.log：94 項個人銀行檢查及 205 次操作後舊命令重送通過，含明確關聯與舊資料後備的雙貸款情境，拒絕後零入帳／零歷史；exit 0。boardCardActions 的 66 個既有單元測試通過。
- 前後端 typecheck、Functions build 通過。本輪未重跑全部 Auth／Callable 整合，也未做實機驗收；成果仍隔離於本目錄，未整合 dev、未部署。剩餘交易、相容啟用與完整驗收繼續保留為未完成。

## 2026-10-02 接續：本人批次資產出售

- sellAssets 沿用銀行命令、防重、私人歷史與 commitFinance。前端只提交資產 ID／玩家填寫的售價；後端依最新本人資產與關聯貸款重算總額、淨入帳、移除資產／貸款及自動幸福，不接受前端現金、成本、收益或負債效果。
- 保留既有手動售價玩法，價格是玩家的明確選擇；這不是建立外部市場報價。共享收購卡仍由各卡官方報價與 sharedAction 處理。股票／定存繼續使用專用入口，不以批次出售繞過股價或存款餘額檢查。
- 沿用 buildBoardAssetSaleFinancialAction 與 applyBoardTransaction。前後端都使用 findRelatedLiability，優先 linkedAssetId，修正舊表單只用名稱／類型尋找貸款而可能對錯資產的問題。批次不能重複資產或共用同一筆貸款，售價必須高於最新貸款餘額。
- 本人非本回合且共享提示存在時仍可提交，不讀其他玩家回覆、不推進棋盤；銀行入口明確拒絕 host 冒充一般玩家。新 ID 再出售已售資產拒絕，原 ID 重送回持久結果，不重複入帳。
- GameView 手動出售接上本人命令，Context 僅傳選擇，不降級到本機。verification-asset-sale.log：88 項個人銀行檢查（另有 205 筆操作後舊命令重送）及 68 Rules 檢查通過，exit 0；含六並行出售一次、最新貸款扣除、偽造欄位、已售資產、貸款不足及棋盤不變。
- verification-unit-asset-sale-final.log：70 檔／475 tests 通過，包含實際出售格式路由及偽造資產／負債效果不傳至後端；前後端 typecheck、Functions build 通過。
- verification-triggers-asset-sale.log：一般玩家 Auth／Callable 出售汽車，清償其關聯貸款並保留其他負債，原結果查核／重送、已售拒絕及人工財務／補助／行情／倍率／計時器專項 PASS、exit 0。未重跑全部遊戲整合；完整瀏覽器財務檢核尚待驗收。

其他個人交易與恢復入口、相容啟用、dev 整合及整體效能／雲端／實機驗收仍未完成。未發布。

## 2026-10-02 接續：計時器命令與恢復

- setTimer 新增可選 mode：pause 擷取伺服器 deadline 的剩餘時間，已暫停則使用伺服器 gameTimeLeft；set 才指定新秒數／重設。沒有 mode 的既有命令保持原 fingerprint 與語意，避免已保存結果不能查回。
- CoachAction 保存 timer 的秒數、暫停選擇、mode 與 UUID 命令。每次已確認的新操作使用不同 ID；重開／不確定失敗重試原選擇與 ID，不以目前倒數秒數重新建立命令。
- 開始、切換、加減與重設全部 await 相同的執行師操作入口。加減／重設不再提前改本機時間或放任未處理 Promise；waiting 明確拋回並保留原待辦，安全接續入口也涵蓋計時器。
- verification-timer-recovery.log：34 項移動／計時器檢查通過，exit 0；含執行中重設為 3,600 秒、已暫停不被 999 秒舊畫面覆蓋、重新啟動及舊啟動命令不改新 deadline。
- verification-unit-timer-recovery-final.log：70 檔／474 tests 通過；包含 mode 草稿恢復、Context 只送選擇與 waiting 不宣告成功。前後端 typecheck、Functions build 通過。
- verification-triggers-timer-recovery.log：真實 Auth／Callable 的執行中重設、已暫停、再次啟動與原結果重送確認，以及人工財務／補助／行情／倍率專項 PASS、exit 0。未重跑全部遊戲整合；手機／瀏覽器背景及共同校時體驗仍待驗收。

其他個人交易、剩餘顯示／恢復入口、相容啟用、dev 整合及整體效能／雲端／實機驗收仍未完成。未發布。

## 2026-10-02 接續：收益倍率與計時器資格

- coachAcceleration 只接受 1／1.5／2／3，由後端驗證本場有效 host、場次與後端 schema。房間倍率、操作人／時間及持久命令同交易保存；不讀其他玩家私人資料、不回溯現金／历史、不推進棋盤。
- 同命令不能改倍率；重送舊命令只回原結果，不覆蓋新的倍率。相同倍率保存 changed:false 命令結果。前端沿用 CoachIntent 保存原選擇與 ID，重開或不確定錯誤保留待核對操作；Rules 阻擋後端模式客戶端直接寫倍率，舊模式仍可操作。
- 計時器先讀房間再讀命令，核對 host 同時仍是有效成員、schema 與場次。Callable 計時器成功／失敗接上共同命令日誌，保留原因與單調耗時。
- verification-coach-settings.log：121 項人工財務／補助／倍率、28 項移動／計時器及 68 Rules 檢查通過，exit 0。verification-unit-coach-settings-final.log：70 檔／473 tests 通過；包含倍率草稿恢復及 waiting 不宣告成功。前後端 typecheck、Functions build 通過。
- verification-triggers-coach-settings.log：真實 Auth／Callable 驗證倍率並行一次、非法倍率／非 host 拒絕、查核及旧倍率不覆蓋新設定，計時器原結果防重、已離場 host 拒絕，以及既有人工財務／補助／行情專項 PASS、exit 0。未重跑全部遊戲整合。

計時器前端仍有未完成項目：ID 由秒數／暫停／deadline 拼接，在相同狀態再次啟動時可能撞到舊命令；「暫停擷取剩餘時間」與「指定時間重設」尚未分開；加減與重設先改本機、未 await 提交仍須修正。下一批接續處理。其他個人交易、相容啟用、dev 整合及整體效能／雲端／實機驗收仍未完成。未發布。

## 2026-10-02 接續：執行師人工行情

- coachMarket 只接受官方 STOCK_DATA 行情代碼及原命令 ID，由 Auth／host／有效成員／場次與後端 schema 驗證資格；不接受前端價格、泡沫旗標或玩家效果。
- 保持既有人工行情的泡沫規則：N002，或與本場最新行情可比較的總額跌幅至少 65%。後端以最新資料判定；行情、全體在場一般玩家持股／歷史／持久結果與執行師命令原子提交，不依賴玩家頁面。
- 沿用 applyPublicFinancialEffect 與自動幸福函式；持股減半捨去不足一張、成本重算。共用 isValidMarketPlayerState 檢查也用於一般新聞翻牌，不另建一套股票計算。
- 不建立舊 financialEffects 待辦，避免再次由前端減半。原命令重送回原結果，不覆蓋之後發布的新股價；換代碼使用同 ID 明確拒絕。缺資料／非法持股時全體不變；棋盤 revision／事件不變。
- RoomContext 人工發布只送 code；等待確認會拋回原有執行師命令介面，保留原 ID。舊房間維持原流程。
- verification-coach-market.log：26 個官方代碼共 312 項人工行情、873 項既有翻牌及 66 Rules 檢查通過，exit 0；包含六並行、全體持股效果、跌幅觸發、舊行情重送及缺資料不部分入帳。
- verification-unit-coach-market.log：70 檔／472 tests 通過；前後端 typecheck、Functions build 通過。verification-coach-market-incomplete-fixture.log 保存第一次測試資料缺少 expenses 而被正確拒絕的紀錄，補齊測試資料後通過；沒有放寬驗證。

verification-triggers-coach-market.log：執行師與一般玩家實際 Auth／Callable、六人原子泡沫、缺資料拒絕、價格不可偽造、旧命令查核／重送及既有人工調整／補助專項 PASS、exit 0。全體整合腳本包含此專項，但本輪未重跑整份整合。其他個人交易、收益倍率／計時器入口完整恢復、相容啟用、dev 整合及整體效能／雲端／實機驗收仍未完成。未發布。

## 2026-10-02 接續：執行師全體補助

- coachSubsidy 沿用人工財務模組與 commitFinance。只接受補助金額與原命令 ID，由後端確認本場有效 host、場次、後端 schema、活躍一般玩家及完整私人資料。
- 六位玩家的現金、私人歷史、持久結果、房間補助序號及執行師命令同交易提交。任何一位資料缺漏／未設定／溢位皆整筆拒絕；離場玩家及執行師不領款，不推進棋盤。
- 不套用收益倍率，保持既有補助行為。相同命令原結果防重且不可換金額；新命令才代表下一次補助。RoomContext 不在 Callable 失敗後降級為客戶端交易，也不宣告 waiting 成功。
- Rules 禁止後端財務房間直接改 financialSubsidy 或偽造 coachCommands；未啟用的新舊房間相容檢查通過。
- verification-coach-subsidy.log：101 項人工調整／補助核心及 66 Rules 檢查通過，exit 0。包括六並行只發一次、六人入帳、缺資料／溢位不部分發放、3 倍收益不放大補助、序號及持久防重。
- verification-triggers-coach-subsidy.log：真實模擬器 Auth 身分及六位一般玩家驗證，缺資料後恢復、非 host 拒絕、兩個並行 Callable、六人完整歷史、命令查核及重送均 PASS、exit 0。
- verification-unit-coach-subsidy.log：70 檔／472 tests 通過；前後端 typecheck、Functions build 通過。全體整合腳本已包含上述專項，這輪僅跑新增專項，尚未重跑整份整合。

人工行情、其他個人交易、相容啟用、dev 整合及整體效能／雲端／實機驗收仍未完成。仍未發布。

## 2026-10-02 接續：執行師個人財務調整

- coachAdjustment 接管本場執行師對玩家的現金、理財收入、負債及三類每月支出調整。身分由 Auth 與房間 hostId／有效成員共同確認；不信任前端角色或財務效果。
- 沿用既有 coachAdjustments 純函式與 commitFinance。目標財務、完整私人歷史、操作人／原因稽核、私人持久結果及執行師命令結果同交易提交；不推進棋盤、不讀其他玩家的回覆。
- 相同命令不可更換金額／玩家；重送、六請求並行及有限快取清空後仍只入帳一次。拒絕負數餘額、超額清償、零本金仍有月付款、損壞資料及安全整數溢位。
- RoomContext 四個入口只提交選擇。waiting／未確認錯誤會拋回介面；CoachGameView 不再把 aborted 當作可刪除原命令的確定失敗，避免重試建立新 ID。
- verification-coach-adjustment.log：54 項核心及 63 Rules 檢查通過。verification-triggers-coach-adjustment.log：兩個真實 Auth 模擬器身分驗證四種 Callable 操作、非執行師拒絕、並行防重、命令衝突及只有操作人能查到原命令，PASS、exit 0。
- verification-unit-coach-adjustment.log：70 檔／472 tests 通過，包含四個前端入口與 waiting／unavailable 不宣告成功。前後端 typecheck、Functions build 通過。全體 Auth 回歸入口已加入此專項，但新增後的全體回歸尚未重跑。

此批仍未整合 dev、未部署。全體補助、執行師人工行情、其他個人交易、相容啟用、整體效能及雲端／實機驗收仍未完成。

## 2026-10-02 接續：既有資產／負債識別值相容

- createSequentialIdGenerator 既有格式為 seed#序號。銀行還款／解約／企業／房屋投保、不動產用途轉換及機運汽車損失的部分 parser 原本不接受 #，會拒絕合法既有資產。
- 僅資產、負債及衍生命令 ID 接受 #；room／session／event 等文件路徑仍保持原限制。執行師負債調整的預設命令 ID 改用 UUID，不嵌入資產識別值。
- assetIdentifiers 的 36 項 parser 往返檢查通過；非法路徑仍拒絕。個人銀行核心新增含 # 的負債還款與定存解約實際入帳檢查。
- verification-asset-identifiers.log：36 項 ID 往返、68 項個人銀行（另有 205 筆操作後舊命令重送）、52 項銀行／企業、178 項不動產及 303 項機運檢查全部通過，exit 0。此項不代表全部卡片分支或正式環境已驗收。

## 2026-10-02 接續：個人幸福清單與周轉路由

- personalHappiness 命令只操作登入者本人，沿用 applyHappinessToggle／Add／Remove 及自動幸福純函式。清單變更、本人持久結果及必要公開摘要同交易提交；不推進棋盤、不讀其他玩家回覆。
- 保留既有手動自訂項目行為。名稱不可空白且至多 160 字；點數為正整數且至多 1,000,000，並檢查總數安全範圍。既有 readOnly 項目拒絕勾選／移除；只有自訂項目可移除。這不是把內建事業／家庭／資產成就改為玩家自行給分。
- 勾選必須明確傳 checked，不使用會因重送而再次切換的隱含 toggle。不存在項目明確失敗，相同目標狀態回 applied＋changed:false；同 command 重送回原結果。手動清單操作不偽造現金交易歷史。新增項目的 ID 使用命令雜湊限制長度；讀取命令接受既有循序 ID 的 # 字元，避免新增後不能勾選／刪除。
- 修正 getPersonalFinancialHandler：舊 useTransactionLogic 信貸格式 source:loan＋usage:cash 即使沒有 loan: 前綴也走借款命令；「定存解約」與「解約定存」均路由到專用解約。原子卡片周轉 fundingLoanAmount 不誤路由成獨立借款。
- completePlayerOnlyTransaction／manual-bank 在後端模式共用上述路由，周轉只傳選擇，不信任 cashChange、利息或資產效果。其他尚未支援格式明確失敗，不降級到本機／客戶端交易。
- verification-personal-happiness.log：39 項核心檢查及 63 Rules 檢查通過；本人非本回合且共享提示存在時可操作、唯讀項目／非法身分／損壞資料拒絕、並行新增一次、舊命令不重新切換及超過有限快取後防重。
- verification-unit-personal-happiness.log：70 檔／471 tests 通過；包含幸福選擇、兩種周轉入口、舊信貸／解約格式與偽造 cashChange 不傳至後端。前後端 typecheck、Functions build 通過。

仍未整合 dev、未部署。執行師現金／收入／負債／支出與補助等人工入口、其他個人財務格式、相容啟用、dev 整合及正式驗收尚未完成。verification-triggers-personal-happiness.log 的全體整合因既有六人共享交易鎖逾時而失敗，不能標記通過。已將 shared.ts 的房間／回覆讀取順序對齊結案程式；verification-shared-read-order.log 的 241 項共享、39 項幸福及 63 Rules 檢查通過。verification-triggers-personal-read-order.log 的幸福入口專項及全體 Auth／Callable 整合 PASS、exit 0。此輪六人共享成功／重複回覆約 2,088–3,861 ms，沒有再次耗盡重試；仍不代表正式延遲驗收達標，共用文件競爭與其他交易的讀取順序仍需接續核對。

## 2026-10-02 接續：C054 分享審核與財務檢核

- 沿用 followup 分享命令與既有 pendingRequests／followupResults，不新增另一套審核儲存。C054 與 C056 的來源卡片識別分開驗證；C056 舊呼叫格式仍可使用。
- 玩家選擇接受後送出分享，執行師核准只保存 approved 待辦；保留原有財務檢核。玩家完成檢核時提交 applyFollowup，只送来源事件／卡片與命令 ID，後端驗證核准狀態並重算官方效果。
- 支出變更、完整財務歷史、持久結果、來源結案與必要續走排程同交易保存。重開、不同命令重送與舊關窗回覆均不重複減支出，不能關掉下一個事件。
- 已核准、未完成財務檢核時禁止清理唯一待辦；資料缺漏、其他待辦或未核准時保留事件。拒絕後可重新分享，舊審核 attempt 不能核准新批次；非本場執行師不能審核。
- 修正共用 getOpportunityMonthlyExpenseCategory：C054 的官方文字是其他支出減少 500，既有分類誤設 basicLiving；前後端改為 otherMedicalChild，減至 0 為止，其他類別不變。
- verification-recycling.log：75 項 C054／C056 檢查、63 Rules 檢查通過。verification-unit-recycling.log：70 檔／467 tests 通過。前後端 typecheck、Functions build 通過；包含前端分享、核准、拒絕、清理、來源財務提交及偽造金額不傳至後端。

本批仍在隔離目錄，未整合 dev、未部署。verification-triggers-recycling.log 的一般玩家／執行師 Auth Callable 整合 PASS、exit 0：核准未先減支出、財務檢核一次入帳、生活支出不變、偽造效果拒絕及舊關窗不關新事件。人工財務入口、相容啟用與正式驗收尚未完成。

## 2026-10-02 接續：一般機運卡與原子接續

- opportunityCard 共用命令處理 13 張個人機運卡：C038–C044、C049–C053、C055。卡片適用範圍與前端路由共用 isStandaloneOpportunityCard；學習、醫療、全體效果及分享審核使用各自入口。
- 後端沿用 resolveBoardCardAction、applyBoardTransaction、buildVehicleLossState 及自動幸福判定。付款／費用、汽車損失、周轉選擇、本人歷史、來源 receipt、移動／停回合或後續抽卡同交易提交；缺牌堆或尚有共享／接續待辦時不入帳。
- C051／C053 直接抽幸福卡；C055 接受時支出與抽卡同交易，拒絕不套用。後續卡片 ID 保存到雲端，重開不需依賴本機旗標。抽卡 RNG seed 在 SDK 重試外固定，換命令也不能多抽。
- 汽車損失保留既有貸款；修繕依本人未投保不動產數量計費。沒有適用資產可關閉，不能略過有實際效果的強制卡片。
- 前端付款、汽車損失、即時效果及結案接至此命令；後端模式跳過舊前端再次移動／抽卡。失敗重開來源視窗，舊 callback 只查來源 receipt，不關掉新卡。
- 命令及來源 receipt 同時限制已完成選擇，不能更換汽車或周轉金額。Rules 禁止客戶端偽造 opportunityResults。
- verification-opportunity-card.log：303 項／13 張卡檢查及 63 Rules 檢查通過，涵蓋投保／未投保、多房屋、無資產、空牌堆、未完成待辦、周轉、偽造欄位與並行抽卡。前後端 typecheck、Functions build 通過。前端新增路由測試，等待房間載入後才判定控制權，避免測試誤用初始值。

verification-unit-opportunity.log：70 檔／465 tests 通過。verification-triggers-opportunity.log：Auth／Callable 完整回歸 PASS、exit 0；一般玩家 C055 支出與抽卡一次完成、偽造金額拒絕、重開不多抽、舊結案不關新卡。

保留既有計算：C038 投保汽車理賠使用既有 400,000，卡片文字的購買價 80% 與程式仍有差異；其他車輛／房屋修繕投保沿用免付費，沒有額外現金收益。這些差異尚未作遊戲規則決策，不能宣稱資料文字已一致。C054 分享核准、其他人工財務入口、dev 整合、新模式啟用與雲端驗收仍未完成。未部署。

## 2026-10-02 接續：醫療卡付款、送醫及理賠

- payMedicalCard／finishMedicalCard／claimMedical 使用同一後端入口；金額、醫院位置、停回合及理賠均由官方卡片和本人資格決定，前端不提供效果。
- C035–C037 使用既有 buildMedicalBoardCardState：付款、周轉、理賠資格、最近順時針醫院落點、停回合、財務歷史、結果及結案同交易保存。移動不領銀行薪資、不再建立醫院收費；舊移動路徑取消，避免送醫後又走原路。
- 最近目標格計算抽到既有 movementResolution，舊前端移動與後端送醫共用。前端付款後跳過原先的再次移動；舊結案回覆只確認來源 receipt，不推進新事件。
- 理賠確認本場付款 receipt 與付款時的投保資格，重送只回原結果；未投保的舊事件不能因事後投保變成可理賠。理賠不限制必須本人回合，不推進棋盤；已付款後不再持有保險也不丟失既有資格。
- pendingMedicalClaims 中有紀錄並不足以發款，必須有真正的後端付款資格。不能用偽造待辦、金額或換 command ID 重複理賠。
- 財務視窗來源檢查收斂到 validateFinancialEvent，拒絕不符目前事件／卡片的舊回覆。前端表單只提交原來源 ID 與周轉選擇。
- verification-medical-card.log：467 項醫療卡檢查、62 Rules 檢查通過；涵蓋三張卡、四個落點、投保／未投保、信貸／強制負債、付款／理賠並行重送及不讀無關玩家資料。verification-unit-medical.log：70 檔／464 tests 通過；前後端 typecheck、Functions build 通過。

verification-triggers-medical.log 的 Auth／Callable 整合 PASS、exit 0：一般玩家 C036 付款一次、移到下一個醫院、停一回合、理賠一次且拒絕偽造金額；既有股票、不動產、行情、幸福、家庭、共享、學習及醫院／維修回歸通過。仍未合併 dev、未部署；其餘機運卡財務／特殊移動與正式驗收仍待接續。

## 2026-10-02 接續：一般幸福卡與獨自家庭歷程

- happinessCard 只接受來源事件／卡片、接受或關閉與可選信貸周轉；後端由官方卡片與本人最新資料重算效果，拒絕客戶端指定點數、現金效果與強制負債。
- 沿用 resolveBoardCardAction、applyBoardTransaction、buildDirectHappinessCardState 及自動幸福純函式；效果、完整歷史、來源 receipt、事件結案與必要續走排程原子提交。沒有其他待辦才入帳，不把成功付款留給瀏覽器收尾。
- 家庭歷程沒有共享提示時使用既有 applyFamilyMilestoneStage，依本人的下一階段判定花費、幸福與育兒；五階段及滿階關閉都有檢查。有共享提示或需要分享核准的卡片仍走專用後端流程，不能略過回覆／審核。
- 資金不足保留事件並回 requires_funding；周轉只能等於實際不足且受原信貸額度限制。來源持久 receipt 防止換 command ID 再扣款／發放，已結案的舊 callback 僅回原結果。
- 財務視窗建立時保存 boardSourceEventId／boardSourceCardId；後續提交使用原始識別，不用目前顯示卡片或家庭下一階段的卡片 ID 取代它。
- verification-happiness-card.log：425 項卡片檢查、60 項 Rules 檢查通過；包含 22 張一般幸福卡及無共享提示的家庭歷程五階段／滿階關閉。verification-unit-happiness.log：70 檔／462 tests 通過。verification-triggers-happiness-final.log：Auth／Callable 完整回歸 PASS、exit 0，包含 H023 付款／結案與 H020 獨自家庭歷程，沒有其他玩家私有文件也不阻擋這些本人操作。前後端 typecheck、Functions build 通過。

仍未整合 dev 或發布；一般機運卡財務／特殊移動、人工財務入口、新模式相容與正式雲端設定仍待接續。

## 2026-10-02 接續：不動產與競爭錯誤恢復

- purchaseRealEstate／declineRealEstate／convertHouse 已接至後端；官方資料決定頭期款、房貸、月付款、租金與幸福效果，市場購買不要求本人回合。
- 現金不足先回 requires_funding；同一來源事件的持久結果防止換命令重複購買／拒絕。市場競買僅一位取得物件；財務與移除物件／推進事件原子提交。
- 自住改出租沿用原純函式，修正把淨租金再扣一次房貸的計算；N038 的租金為 10,000、月付款 12,500，淨收入正確為 -2,500。後端維持一次用途轉換限制。
- gRPC 交易中止映射為 aborted，前端先查原命令結果，只對明確 aborted 使用同 ID／選擇有限重試。權限拒絕不盲目重送；其他不確定錯誤保留命令等待查核。
- verification-real-estate.log：178 項不動產檢查／26 官方卡片、59 Rules 檢查通過。verification-triggers-real-estate-final.log：登入玩家完整整合通過。

六人並行共享回覆曾有房間文件鎖競爭超過 10 秒。安全恢復後驗證財務效果只入帳一次，但這不是延遲達標；共用房間寫入競爭仍待優化。

## 2026-10-02 接續：新聞股價與泡沫

- 沿用 revealCard，在後端銀行模式中同交易提交官方股價、翻牌、所有在場一般玩家的私有效果／歷史／持久財務結果；無須其他玩家保持頁面在線。一般非市場卡片仍不讀所有玩家資料。
- 使用既有 applyPublicFinancialEffect 與自動幸福判定，泡沫持股減半、捨去不足一張及重算成本；不建立舊前端 financialEffects 待辦，避免再次套用。
- 必要玩家資料缺漏／持股格式不合法時整筆不提交；receipt 綁定來源事件，重開與換 command ID 不再次減半。
- finishMarket 確認已翻牌／入帳、目前事件與玩家，再同交易保存結案、卡片紀錄及必要續走 outbox；已完成的舊事件重送不關掉下一張卡。
- RoomContext 的市場更新入口在此模式只確認雲端資料，不直接寫股價；結案走後端，舊模式仍用原路徑。
- verification-market-reveal.log：873 項檢查通過，含 160 張卡片翻牌與全股價卡效果／結案；160 張並非全部卡片分支驗收。verification-unit-market.log：70 檔／461 tests 通過。前後端 typecheck、Functions build 通過。

仍未整合 dev、未部署。verification-triggers-market.log 的 Auth／Callable 市場整合已通過並以 exit 0 結束：一般玩家翻牌，離線持股者同時持股減半，單張持股捨去；重開／結案重送不重複入帳，既有共享、財務、學習與醫院回歸也通過。此結果仍不代表手機或正式雲端延遲驗收。

## 2026-10-02 接續：個人股票、汽車、保險及定存

- 沿用 banking 命令及 commitFinance 原子寫入，新增 tradeStock／purchaseCar／purchaseInsurance／purchaseDeposit／withdrawDeposit；RoomContext 五個對應入口已接線，不降級成本機同步，舊模式保留原路徑。
- 股票只提交買賣方向、種類、張數及預期價格，後端核對房間最新股價並重算總額，價格不符先拒絕而不扣款；不要求本人回合，也不读其他玩家的回覆或推進棋盤。
- 汽車依前後端共用的 600,000 車價與最低 120,000 自備款，後端重算貸款及每月付款；玩家不能偽造本金、利息或資產效果。保險沿用既有月支出計算，不誤扣一次性現金。
- 定存／解約採既有 10,000 單位及月利息 1%；後端核對本人存款與金額，保險／新定存須有銀行服務資格或合法銀行事件。解約、股票及汽車保留既有非本回合操作資格。
- 後端模式 Rules 同時保護銀行服務資格及房間市場價格，避免客戶端偽造資格或低價買入。共用銀行入口也拒絕同一進行中命令改內容，按房間／場次／玩家隔離。

證據：verification-personal-banking.log 中 64 項個人財務檢查、52 項既有銀行／企業回歸與 57 項 Rules 檢查通過；實際提交 205 筆新定存後重送舊股票命令，扣款與股數仍僅一次，完整歷史有 206 筆且最近快取限於 100 筆。包含資金不足、超額出售、舊股價、偽造欄位、汽車本金／月付款、部分解約、保險資格及損壞資料阻擋。

verification-triggers-personal-banking.log 使用 Auth 一般玩家完整 Callable 股票並行買入、汽車貸款、定存、部分解約及醫療保險，最終現金 858,000、汽車本金 480,000，棋盤 revision 不變，既有流程整合回歸通過。verification-unit-personal-banking.log：70 檔／456 tests 通過，包含五種前端路由只送選擇而不送財務效果。前後端 typecheck、Functions build 通過。

仍為隔離候選版本，未整合 dev、未部署。一般新聞股價更新、其他卡片／不動產／幸福操作尚未全部後端化，不能啟用完整正式遊戲；瀏覽器、手機及雲端延遲仍待驗收。

```sh
node functions/test/build.mjs personalBanking
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-happinessflow-backend --only firestore 'GCLOUD_PROJECT=demo-happinessflow-backend node functions/lib/personalBanking-test.cjs'
```

## 2026-10-02 接續：未確認命令的查核與恢復

- 共用 Callable 提交入口在送出前保存原 payload／command ID；同命令共用 Promise，不同操作忙碌時明確拒絕。保存失敗不送出交易。
- 逾時先經 getCommandResult 查核本人持久結果，查核不修改資料。查到已完成結果直接回傳；未知結果保留原操作，禁止以新 ID 另建交易。已確認的 waiting 與未確認的網路逾時分開處理。
- RoomProvider 中的恢復介面於重開、恢復連線與回前景時只查詢；超過三秒顯示待確認及查核／安全重試入口。只有使用者明確重試才重送原 payload，控制權不足時不能重試。損壞的本機資料保留並顯示原因。
- 查核驗證本人、成員資格及場次，不接受偽造 uid；舊查詢回傳不能刪除其他分頁保存的新命令。

證據：前端 70 檔／455 tests 通過，包含恢復介面、逾時確認、重新載入與過期查詢。命令查核 13 項 Firestore 模擬器檢查通過。verification-triggers-command-result.log 的 Auth／Callable 整合確認借款查核後現金仍為 501、未提交命令只回 waiting、偽造身分被拒絕；既有共享／家庭／移動／學校／審核／翻牌／醫院等回歸通過。前後端 typecheck 與 Functions build 通過。

這些是本機證據。尚未驗收真實瀏覽器重新開啟、手機前背景與正式雲端，未整合 dev、未部署。後續仍須完成其餘財務及一般卡片，才能驗收完整遊戲。

```sh
node functions/test/build.mjs commandResult
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-happinessflow-backend --only firestore 'GCLOUD_PROJECT=demo-happinessflow-backend node functions/lib/commandResult-test.cjs'
```

2026-10-02：隔離實作，未部署、未寫入正式 Firebase，也未啟用任何正式房間。
來源為主線 dev（HEAD `fa64e87`）的含未提交內容快照；主線 H020 修正仍由主線管理。
此目錄的 node_modules 目前連結至主線既有依賴，functions 有獨立 package-lock。
整合時只合併下列差異；不要整個覆蓋主線 src，也不要混入主線部署。

## 已實作

- Firebase 第二代 callable `gameCommand`，依類型接受共享結案、銀行、企业、移動、回合及計時器命令，逐一限制允許欄位；登入身分來自 Firebase Auth。
- 後端重新讀取房間資格及指定玩家的回覆文件，驗證回覆格式；未完成必要回覆、來源動作、展示期限或接續任務時保留事件。
- 結案、事件推進、卡片紀錄及持久結果在同一 Firestore transaction 提交。
- 持久 receipt 依場次＋prompt 防重；同一玩家的 command ID 不可改內容；前端重送回傳既有結果。
- Firestore 回覆／來源完成觸發器負責正常結案，不需要執行師瀏覽器持續執行。
- 展示尚未結束時保存 durable outbox，Cloud Tasks 到期再次檢查；重複觸發與任務重送不重複推進。
- 前端試行模式的兩個結案入口改走 callable，正常推進由後端觸發器負責；自癒程序不再搶家庭歷程結案。
- Rules 禁止客戶端改試行權限標記、刪除／換掉活躍提示或切換其事件，以及偽造命令結果、receipt 或排程。
- callable 記錄 command/session/event、結果、錯誤碼及單調耗時；壞資料阻擋自動結案時留下後端日誌並保留事件。

## 責任邊界

第一批接管共享／家庭歷程結案；第二批新增信用借款、貸款還款、銀行每月結餘及銀行結案的後端命令。
尚未移轉的共享財務、審核、投資、卡片接續及移動仍待後續批次；不能以本批測試宣稱正式信貸故障或 H009、C003/C005/C056 已修好。
RoomContext 呼叫既有純函式；事件佇列與卡片完成判定保持共用，只把 browser clock 換為後端時鐘。
投影仍為資料讀取端；本批不修改動畫、其他回合的完成條件或強制換人機制。

## 合併差異

新增 functions/、firebase.json 的 functions/emulator 設定、後端測試、`src/game/board/promptCompletion.ts`、`serverPromptCommand.ts`。
修改：firestore.rules、src/types.ts、src/context/RoomContext.tsx、src/game/board/runBoardMutation.ts、eventQueue.ts、familyTransition.ts、src/utils/boardCardActions.ts。
其餘 src/services/types/config 是支援獨立檢查的原始快照，不是要覆蓋主線的變更。

## 啟用門檻（目前保持關閉）

舊房間沒有 `promptCompletionAuthority`，沿用既有行為。
只有可信後端／管理程序能設定 `server-prompts-v1`；本批沒有新增正式啟用工具，也不搬遷既有房間。
試行前必須核对 Cloud Functions 與 Firestore region、IAM／Cloud Tasks enqueue 權限、App Check，以及全部裝置的客戶端版本。
正式 callable 強制 App Check；現有前端尚未在本批設定 App Check，不能直接拿此快照啟用正式模式。
預設 region `asia-southeast1` 是試行值，尚未核對正式資料庫位置；後端 GAME_FUNCTION_REGION 和前端 VITE_GAME_FUNCTION_REGION 必須一致。
Rules 保護後端權限，但其餘舊結案路徑及 UI 等待條件仍須在多端試行前完整盤點，避免遭 Rules 拒絕後卡畫面。

## 可重跑的檢查

只使用 `demo-happinessflow-backend`，測試程式會拒絕錯誤專案或缺少 emulator 設定。
核心測試與觸發器測試分開跑；同時啟用觸發器會搶先完成核心測試刻意保留的事件。

```sh
npm --prefix functions ci
npm --prefix functions run typecheck
npm --prefix functions run build
(cd functions && node test/build.mjs)
node node_modules/typescript/bin/tsc -p tsconfig.release.json --noEmit
node node_modules/vitest/vitest.mjs run src/utils/boardCardActions.test.ts src/context/RoomContext.test.ts
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-happinessflow-backend --only firestore 'GCLOUD_PROJECT=demo-happinessflow-backend node functions/lib/test.cjs && GCLOUD_PROJECT=demo-happinessflow-backend node functions/test/rules.cjs'
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-happinessflow-backend --only auth,firestore,functions 'GCLOUD_PROJECT=demo-happinessflow-backend node functions/test/triggers.cjs'
```

本機端口：Auth 9399、Functions 5301、Firestore 8482、websocket 9182、hub 4482、logging 4582。
測試結果：前端相關 135 tests、核心 20 invariants、Rules 8 checks、callable 登入與到期任務自動結案整合通過。
本機 Functions emulator 使用 host Node 24；建置 target／正式設定 Node 22，正式 Node 22 runtime、IAM 與 App Check 尚待 staging 驗證。
並行結案測試有八個請求，僅一個 applied；其餘 duplicate。整合測試包含四秒展示期限，完全未啟動執行師／玩家瀏覽器。
這些結果不是手機、多端延遲或正式環境的驗收。

## 接續批次

1. 完整盤點所有前端結案／關窗路徑，接上後端確認、等待原因與安全復原入口；試行 schema 不相容客戶端拒絕提交。
2. 借還款、銀行領款／結案的後端原型已實作；接續共享財務、審核、投資與終身學習／新聞抽卡，付款後可恢復且不重複扣款。
3. 骰子、移動結算與共同 deadline 移至後端；對齊投影、訂閱復原與場次封存。
4. 完整 emulator/卡片/多端驗收後才能候選部署。保持正式版本不變。

## 第二批：銀行與借還款（2026-10-02）

後端新增 `borrowLoan`、`repayLoan`、`collectPayday`、`finishBank`；前端對應入口只在銀行試行模式改走 callable。
金額由玩家選擇，額度、利息、本金、現金流與強制負債均由後端依最新本人資料計算，沿用原有純函式。
個人借還款不讀其他玩家的共享回覆、不推進棋盤，不限制必須本回合（與原有個人信貸資格相同）。

借還款的現金、負債、完整歷史及持久命令結果原子提交。相同 command 共用進行中的 Promise；另一筆操作回傳 busy 原因。
逾時／網路錯誤顯示等待確認，保留原 command 與選擇，不建立新交易或改寫本機現金。

銀行收款以「場次＋玩家＋銀行事件」的持久 receipt 防重，即使換 command ID 或清空有限長度的 ID 快取也不重領。
領款先保存 collected；後續銀行選擇仍由玩家操作。finishBank 必須確認領款、企業升級與接續已完成，才能原子推進事件並保存 completed。
本人文件的 bankSettlement 是當前事件的雲端呈現投影；重開後以它恢復 followup，舊事件的完整 receipt 另存 bankSettlements。
銀行結案失敗時只重試 finishBank，先前領款不受影響。

### 試行範圍與安全限制

另以可信後端設定 `bankingAuthority: server-banking-v1`；與第一批 promptCompletionAuthority 分開，預設兩者均未啟用。
要求 syncSchemaVersion=2、flowSchemaVersion=1、financialHistoryStorage=subcollection、主房間沒有私人 playerStates，且本人已完成設定。
本批未新增啟用／搬遷工具，不能直接把進行中正式房間轉為試行模式。

銀行試行模式下，Rules 拒絕客戶端財務改寫、偽造歷史／receipt、刪除本人資料，以及略過領款直接推進銀行事件。
其他尚未移轉的財務操作會明確失敗，沒有本機／舊交易降級；因此此模式目前只適用隔離銀行驗收，不能開完整正式遊戲。
企業升級未完成也不能銀行結案；其後端移轉仍待下一批。練習模式與沒有試行標記的舊房間維持原流程。

### 驗證

- 銀行核心 34 項檢查通過，包含非成員拒絕、現金不足還款、並行借款、超額、超額還款、清空快取後重送、換 command 重領、結案等待與恢復、負現金流強制負債。
- callable 整合使用一般匿名登入的房間玩家，驗證非本回合借款、並行只入帳一次、拒絕額外 cashChange 欄位。
- 既有 Firestore Rules 57 tests 通過；新增權限 Rules 17 checks 通過。
- 前端全體 445 個單元測試、前後端型別檢查與後端 bundle 建置通過。
- 尚未做真實手機、多端 UI 或正式 Node 22／IAM／App Check 驗收，未部署。

新增檢查指令（仍須分開執行核心與 trigger 測試）：

```sh
(cd functions && node test/build.mjs banking)
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-happinessflow-backend --only firestore 'GCLOUD_PROJECT=demo-happinessflow-backend node functions/lib/banking-test.cjs && GCLOUD_PROJECT=demo-happinessflow-backend node functions/test/rules.cjs'
node node_modules/vitest/vitest.mjs run --exclude 'src/test/*Permissions.test.ts'
```

第二批新增 functions/src/banking.ts、functions/test/banking.ts、src/game/finance/serverBankingCommand.ts 與其測試，並修改 gameCommand 分流、RoomContext、GameView、資料型別與 Rules。
快照另補了既有純報表腳本以便完整單元测试；roomPermissions fixture 專案改為 demo-happinessflow-backend，沒有修改其既有斷言。


## 2026-10-02 接續：企業、移動與共同計時器

仍為隔離候選版本，未整合 dev、未部署或啟用正式房間。這一段不是整份後端方案完成宣告。

### 已實作及驗證範圍

- 目標企業購買改走銀行 callable：從官方 ENTERPRISES 查價格／收益，玩家僅提供目標識別及周轉選擇。非本回合也可合法購買，不更新棋盤；並行同命令只有一次入帳。
- 企業升級两段骰點均由後端產生並保存；收入骰／財務套用分開保存，交易重試不重新產生骰點。偽造骰點及資產別名被拒絕。
- 本次銀行可選擇稍後升級，或未達標後完成銀行事件；未升級的企業保留到下一次銀行，下一次必須重新確認，不把待升級永久刪除。
- 抽離既有 movementResolution 純函式供前後端共用，RoomContext 保留舊 export，沒有重新寫另一套落點規則。
- `movementAuthority: server-movement-v1` 房間的棋盤擲骰、移動到期結算、玩家結束回合改走後端。棋盤骰點由 crypto RNG 產生，SDK 重試固定使用本次候選骰點；結算依既有路徑建立銀行、卡片、學校等事件。
- 移動提交與 movementTasks outbox 同交易保存；共享／銀行後端結案產生續走時也同交易建立 outbox。尚未移轉的前端接續路徑由 room trigger 補建，不能視為全部事件已後端原子接管。
- Cloud Tasks 到期結算，持久 movementResults 防重；舊場次／舊移動任務不修改新事件。低頻復原巡檢只查已到期 pending/scheduled 任務，每次最多 50 筆，索引已加入 firestore.indexes.json。
- 執行師計時器可由後端保存截止時間；玩家 GameHeader 依共同截止時間呈現，回前景／校時後立即更新。舊模式未保存 deadline 的房間仍保留舊格式相容，不宣稱已修復所有舊房間倒數。
- Rules 保護後端模式標記、移動／回合核心結果、計時器與 receipts，銀行模式保護目標及升級等待狀態，避免前端偽造。

### 本次已取得證據

- 前端完整單元測試 68 檔／445 tests 通過（排除需模擬器的 Permissions tests）。
- 前端及 Functions 型別檢查、Functions bundle build 通過。
- 共享核心 20、移動／計時器核心 27、權限 25 checks 通過；銀行／企業最終結果另見 verification-banking-final.log。
- Auth／Firestore／Functions／Cloud Tasks 模擬器整合通過：匿名一般玩家 callable 登入、防偽、重送、共享到期結案與沒有任何執行師／玩家瀏覽器的自動移動收尾。
- 紀錄：verification-core.log、verification-unit.log、verification-triggers.log、verification-banking-final.log。

### 尚未完成，不能啟用完整正式遊戲

1. 玩家共享／家庭回覆及其付款仍由客戶端交易提交，僅結案移交後端；後端銀行模式禁止直接寫財務，因此完整共享遊戲尚不可啟用。
2. C003/C005/C007 付款／學習判定，C056 核准／新聞接續及 H009 核准仍未移交後端。
3. 股票、汽車、保險、定存、共享投資、其他幸福卡、醫院／維修廠／學校等財務路徑仍待移轉。
4. 翻牌、一般卡片完成、事件推進及特殊移動尚有前端路徑；第三批只完成上述棋盤擲骰、到期結算與結束回合入口。
5. 後端結果查詢與跨重開保留未確認命令尚未統一，前端顯示 busy／waiting 的涵蓋不足；計時器／移動入口不能宣稱已完成全部逾時復原 UX。
6. 新模式的舊客戶端更新提示、可信新房間啟用工具、完整相容回退與主線合併尚未完成。
7. 正式區域、Node 22、App Check、IAM、Cloud Tasks、Scheduler、索引及發布前驗收待 staging；目前不部署。
8. 六玩家＋執行師＋投影實機測試與 P95/P99 量測尚未執行，不能宣稱體驗指標達標。

補充檢查：
```sh
(cd functions && node test/build.mjs movement)
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-happinessflow-backend --only firestore 'GCLOUD_PROJECT=demo-happinessflow-backend node functions/lib/movement-test.cjs'
```


## 2026-10-02 接續：家庭回覆與財務原子提交

- `familyRespond` 由後端產生及持久保存參與骰點，通過後保存待付款；前端不提供骰點或通過結果。
- `familyAction` 依本人目前家庭階段計算花費／幸福效果，付款、私有歷史、參與者完成或來源完成與持久 receipt 同交易保存；拒絕不扣款。
- `familyConfirm` 只查核已保存的結果；清除視窗等待狀態不能讓未付款流程完成。確認命令綁定固定 prompt，不依賴結案後已切換的事件。
- 家庭回覆、付款及確認入口已接入 callable 與 RoomContext。原有觸發器確認所有人完成後自動結案。
- 抽離原銀行私有財務寫入至 financeCommit，沿用既有格式，供家庭共用。
- Rules 禁止後端提示模式直接寫回覆、偽造 familyActions，以及直接更改活躍家庭提示；舊模式不強制遷移。

證據：verification-family.log 包含六位玩家並行、同命令連發、清空有限快取後換 ID 重送、拒絕、資金不足與周轉、非法玩家／場次，共 25 項家庭檢查；新增 Rules 檢查共 28 項通過。
verification-triggers-family.log 驗證一般玩家登入後經 callable 回覆與付款，沒有執行師瀏覽器仍自動結案；既有銀行／移動整合仍通過。
verification-unit-family.log：68 檔／445 tests 通過。前端／Functions 型別與後端 bundle 通過。
最新共用財務寫入回歸另見 verification-family-final.log。

**仍未完成**：共享機運／新聞回覆與付款、終身學習、審核／後續抽卡、其餘財務及事件路徑、統一跨重開命令確認、主線整合與雲端／實機驗收。上述新權限不能直接啟用完整正式遊戲；保持未部署。

## 2026-10-02 接續：C003／C005／C007 終身學習

- 新增後端 `payLearning`／`rollLearning`，已接入 Callable 與前端原有付款／擲骰入口；只在 server-banking-v1 房間啟用。
- 學費、學習種類、門檻、能力效果由目前已翻開的卡片取得；不接受客戶端傳入金額、骰點或能力結果。一般學校考試及 C001 沒有混用此流程，仍待移轉。
- 付款、完整私有歷史、待擲骰接續及移動到學校在同一交易提交；不足時不扣款、不建立待辦。周轉上限為實際短缺，不能借此增加額外現金。
- 判定原子保存成功／失敗、能力效果、歷史、雲端接續完成狀態與投影骰點。候選骰點在 SDK 重試期間固定。
- learningResults 以場次＋玩家＋來源事件持久防重；重開換命令 ID、清空有限快取或結果顯示逾時後重送，都取回原結果，不重扣、不重擲、不重複發效果。
- 沿用前端既有雲端接續恢復視窗；練習及舊模式仍相容。Rules 禁止客戶端偽造學習結果或改寫後端銀行模式的接續狀態。

驗證：verification-learning-final.log 有 97 項檢查通過，三張卡各驗證成功／失敗、付款／判定並行重送、重開及超過 200 次快取後恢復、周轉、職業薪資／股票数量／能力、非法玩家與舊場次。
verification-learning-integration.log：Callable/Auth、付款後恢復、投影骰點、防重與既有家庭／銀行／移動整合通過；30 項 Rules 檢查通過。
verification-unit-learning.log：68 檔／445 tests 通過；前後端 typecheck 及 Functions build 通過。

尚未完成：正常學校考試／C001、共享交易、H009／C056 審核及接續、其他財務／卡片完成路徑、統一命令逾時查核與跨重開識別、主線整合及雲端／實機驗收。正式環境未發布。

## 2026-10-02 接續：一般學校考試與考後抽卡

- `paySchool`／`rollSchool` 後端計算固定 1,000 報名費、職業升等門檻、薪資及成功／失敗；骰點保存在投影事件。
- 付費與判定各有持久結果；本人 schoolExam 保存 paid/completed 及結果。重開或有限歷史載入之外，仍可確認已繳費及恢复结果，不重扣／重擲。
- 尚未付款且現金充足時，可於 rollSchool 同交易完成報名費與考試。不足或最高職級時不入帳；周轉限定實際短缺。
- `finishSchool` 讀已保存結果，後端原子抽出考後幸福卡並保存持久完成結果。失敗保留考試待辦，重送只能補接續。牌堆用既有 drawBoardCard，重洗改為 Fisher-Yates；後端注入本次固定亂數序列，SDK 重試不重新決定牌序。
- `skipSchool` 保留未繳費時略過的玩家選擇；已繳費不能藉略過丟掉判定。接續移動的 outbox 與事件推進原子提交。
- 玩家端以雲端結果恢復骰子視窗；已付款不再因現金不足被要求重新檢核。考後抽卡確認成功才關閉結果視窗，失敗留在畫面安全重試。
- Rules 保護 schoolExam、骰點事件與學校事件推進；舊房間沒有模式標记仍維持既有流程。

證據：verification-school-final.log 包含學習與學校成功／失敗、重開、報名／判定／抽卡並行防重、空牌堆恢復、周轉與略過，145 項檢查及 31 項 Rules 檢查通過。
最新缺少命令類型的輸入驗證另見 verification-school-validated.log。
verification-school-integration.log：一般玩家 callable 考試及後續抽卡、投影骰點、重送與既有家庭／银行／移動整合通過。
verification-unit-school.log：68 檔／445 tests 通過；前後端 typecheck 及 Functions build 通過。

**界線**：這一批涵蓋 C001 到達學校後使用的一般考試；此前將 C001 到學校的入口判定為未移轉；此判斷已於下一批重新核對卡片資料及實際呼叫鏈後更正，請見下節。結果確認仍由玩家操作；沒有做實機／延遲驗收。
仍待完成共享交易、H009／C056、其他財務與卡片事件、統一命令查核／恢復、新模式啟用及相容、主線整合和雲端驗收。仍未部署。


## 2026-10-02 接續：C001–C008 全組與後端卡片結案

更正前次範圍判斷：現行 C001–C004 均為 ability_profession、C005–C006 為 ability_stock、C007–C008 為 ability_realestate。C001 不是一般學校考試；它走同一個 payLearning → 雲端學習接續 → rollLearning 路徑。原 payLearning 已同交易付費、移到下一學校並保存卡片規定的停回合，不需要新增另一套本機移動。

- 新增 finishLearning／declineLearning 與玩家關卡入口接線。未付費可拒絕；已付費不能略過判定；已完成判定才能結案。
- 完成來源卡片、清除雲端接續阻擋、建立下一排隊事件或接續移動 outbox，以及持久完成結果同交易保存。不需要執行師頁面代為結案。
- 換命令 ID 或重開後重送，沿用同一來源事件的完成結果；已完成選擇不能更改。
- 卡片紀錄同時保留來源及下一排隊卡，不用舊事件 callback 清理新事件。
- 八張卡各驗證成功／失敗、付款／骰子／結案並行重送、位置及停回合、能力與薪資／股票效果、重開及超過 200 筆快取、拒絕與已付款不得略過。

第一輪 verification-learning-all8.log：348 項學習／考試檢查通過。
最新排隊接續與 Callable／Rules 整合另見 verification-all8-final.log；前端 verification-unit-all8.log 有 68 檔／445 tests 通過。
本批仍為隔離候選版本，未合併 dev、未部署；真實手機及延遲量測未驗收。剩餘主要工作仍是共享交易、H009／C056、其他財務與事件、統一命令恢復、相容啟用及主線整合。

本批最終檢查：verification-all8-final.log 的 Callable 與 351 項學習／學校檢查通過；權限負向 fixtures 必須與 Functions trigger 隔離，避免不完整測試房間触發排程。獨立 verification-rules-all8.log 的 31 項 Rules 檢查通過。前後端 typecheck 再次通過。此為本機證據，不代表正式多端或延遲驗收。

## 2026-10-02 接續：H009 幸福故事分享與審核

- submitStory 從目前已翻開的幸福卡建立審核請求，金額／幸福值與名稱由卡片資料取得，不接受玩家傳入效果或他人身分。
- approveStory 由本場執行師核准；幸福值、私有財務歷史、審核結果、來源事件結案及下一事件同交易保存。不需要玩家頁面再補發幸福值或推進來源事件。
- rejectStory 保留拒絕結果；清除後重新送出會增加 attempt，上一批次的核准命令不能套用新請求。
- storyResults 持久保存結果。清除請求、重開或超過 200 筆本機快取後重送核准，仍回傳原结果，不能重複發放。
- RoomContext 已接入送出、核准、拒絕、清除及卡片關閉命令；Rules 禁止後端模式直接建立／核准／刪除幸福請求或偽造 storyApproval／storyResults。

驗證：verification-story.log 的 32 項核心檢查通過；verification-rules-story.log 的 36 項權限檢查通過。verification-triggers-story.log 使用兩位實際 Auth 模擬器登入者，驗證一般玩家送出、玩家無權核准、執行師並行核准只發一次、事件不靠玩家瀏覽器補結案，以及重開確認原結果；既有家庭／銀行／移動／學校整合也通過。

verification-unit-story.log：68 檔／445 tests 通過；前端與 Functions typecheck、Functions build 通過。這是本機模擬器證據，尚未做瀏覽器畫面、手機多端、正式 App Check／IAM 或延遲驗收。全部成果仍隔離於本目錄，未合併 dev、未部署。

可重跑新增檢查：
```sh
node functions/test/build.mjs story
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-happinessflow-backend --only firestore 'GCLOUD_PROJECT=demo-happinessflow-backend node functions/lib/story-test.cjs && GCLOUD_PROJECT=demo-happinessflow-backend node functions/test/rules.cjs'
```

## 2026-10-02 接續：C056 分享核准後抽新聞卡

- submitFollowup 從已翻開的 C056 建立固定分享請求，approveFollowup 同交易核准及建立 awaiting_draw 雲端接續；清除請求不能丟棄已核准的抽卡待辦。
- drawFollowup 驗證本人、場次、來源事件與核准結果，從既有新聞牌堆抽卡，抽卡／牌堆／來源紀錄／新事件／completed 接續與持久 followupResults 同交易提交。牌堆失敗保留待辦；換 command、重開或清除請求後重送仍回原結果。
- 候選重洗亂數在交易開始前固定，SDK 重試不能重新決定牌序。拒絕重送有 attempt 與本人 followupApproval 保護；舊批次審核不能套用新請求。
- 前端送出、核准、拒絕、清除、抽卡与不接受入口已接入後端。Rules 禁止後端模式直接寫 C056 分享請求、followupApproval 或 followupResults，其他未移轉卡片保留原路徑。

證據：verification-followup-final.log 的 30 項 C056 檢查與 41 項權限檢查通過；含空牌堆後恢復、六請求競爭只抽一次、未核准不能抽卡、提前清除等待與舊批次拒絕。verification-triggers-followup.log 使用一般 Auth 玩家與獨立執行師登入，確認核准後可抽新聞卡、並行與清除後重送不多抽；既有整合也通過。

verification-unit-followup.log：68 檔／445 tests 通過；前後端 typecheck、Functions build 通過。瀏覽器呈現、真實手機、正式雲端權限／區域及延遲未驗收，仍未合併 dev 或發布。

```sh
node functions/test/build.mjs followup
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-happinessflow-backend --only firestore 'GCLOUD_PROJECT=demo-happinessflow-backend node functions/lib/followup-test.cjs && GCLOUD_PROJECT=demo-happinessflow-backend node functions/test/rules.cjs'
```

## 2026-10-02 接續：共享機運／新聞本人操作

- sharedAction 接管資產出售、現金股利、股票配股、大型企業投資、創業貸款與全體月支出調整。後端驗證成員、場次、提示、翻牌及種類；只讀本人財務與本人回覆，不讀其他玩家回覆。
- 玩家只送接受／放棄／無效果、投資金額、出售資產識別與周轉選擇。後端沿用 resolveBoardCardAction、buildSharedInvestmentState、buildStartupLoanState、buildSharedAssetSalePromptMutation 及 applyBoardTransaction，以最新本人資產／卡片資料重算金額、股數、負債及效果，不接受客戶端效果或完成標記。
- 本人財務、完整歷史、回覆與持久 sharedActions 同交易保存；一般玩家各自完成後，既有後端 trigger 彙整結案。放棄不能改寫已完成選擇；強制全體月支出不能放棄。無效果由後端驗證。
- 重開、清空超過 200 筆快取、結案後換命令 ID 重送，仍回原結果。Rules 禁止客戶端偽造 sharedActions；後端提示模式的回覆直寫已受既有規則限制。
- RoomContext 五個共享提交入口改走 Callable，舊模式保持既有路徑。共享提示建立／一般翻牌與其他卡片財務尚未全部移轉，不可因此啟用完整正式遊戲。

證據：verification-shared-final2.log 有 241 項檢查、36 張共享卡片及六人並行檢查通過；包括股利／股數／投資／創業負債的實際數值、付款不足、周轉、非法欄位、舊場次、未翻牌、放棄與舊命令重送。verification-shared-final.log 的 42 項權限檢查通過。

verification-triggers-shared.log 使用六位 Auth 一般玩家及獨立執行師身分；每位並行兩個相同請求只領一次股利，私人歷史各一筆，全員完成後後端自動結案，沒有啟動任何玩家／執行師瀏覽器，結案後重送仍 duplicate。既有整合也通過。

verification-unit-shared.log：68 檔／445 tests 通過，前後端 typecheck 與 Functions build 通過。整合模擬器並行提交出現數秒等待，尚未達到正式延遲驗收；需後續量測共用房間讀寫競爭，不能將正確性通過視為 P95/P99 達標。全部成果仍未合併 dev、未發布。

```sh
node functions/test/build.mjs shared
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-happinessflow-backend --only firestore 'GCLOUD_PROJECT=demo-happinessflow-backend node functions/lib/shared-test.cjs && GCLOUD_PROJECT=demo-happinessflow-backend node functions/test/rules.cjs'
```

## 2026-10-02 接續：醫院與維修格

- rollService 由後端產生及保存骰點，費用依既有醫院 ×1,000／維修 ×2,000 規則計算。SDK 重試使用同一候選骰點；重開或換命令取回原結果，投影骰點同交易保存。
- payService 僅接受周轉選擇，金額從後端結果取得。費用、周轉負債、完整歷史、來源事件完成及下一事件／續走 outbox 同交易保存，不再依賴付款後關窗的前端補推進。
- finishService 只允許已完成的結果確認，或原落點已確認保險抵免／無車的免費事件；未付費不能略過。資金不足或其他待辦阻擋時不入帳，保留來源事件。
- RoomContext 擲骰、費用與免費事件入口已接 Callable。付款資料及後續關閉 callback 綁定來源事件 ID；舊 callback 不會結束下一個同類事件。既有事件切換清除顯示狀態仍保留。
- serviceResults 以場次＋玩家＋事件持久防重；超過 200 筆快取後重送不重扣，舊付款不推進新事件。Rules 禁止直接修改後端醫院／維修事件及偽造結果。

verification-service-final.log：74 項核心檢查與 47 項 Rules 檢查通過，含骰點兩端值、六並行請求、資金不足、信用／強制周轉、重開、保險／無車、排隊新事件及續走 outbox。verification-triggers-service.log 使用 Auth 一般玩家驗證兩種格子的完整擲骰、並行付款、金額、防重與舊關閉命令；既有家庭／銀行／學校／共享等整合也通過。

verification-unit-service.log：68 檔／445 tests 通過；前後端 typecheck、Functions build 通過。仍未合併 dev、未發布；瀏覽器畫面、真實手機與正式雲端／延遲未驗收。醫療卡片本身、其他財務／一般事件、统一命令恢復、相容啟用及主線整合仍待完成。

```sh
node functions/test/build.mjs serviceEvent
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-happinessflow-backend --only firestore 'GCLOUD_PROJECT=demo-happinessflow-backend node functions/lib/serviceEvent-test.cjs && GCLOUD_PROJECT=demo-happinessflow-backend node functions/test/rules.cjs'
```

## 2026-10-02 接續：後端翻牌及提示建立

- revealCard 驗證一般玩家、本回合、來源事件、官方卡片與本人設定，翻牌、家庭／共享提示及持久 cardReveals 同交易提交。前端 RoomContext 翻牌入口已接入 Callable，使用原本事件命令 ID。
- 沿用 buildBoardCardRevealState，不另造家庭或共享規則。家庭需要參與資格時只讀活躍必要玩家的私有階段；來源家庭已滿階或一般卡片不讀其他玩家資料。缺少必要資料時不翻牌，保留事件並回原因。
- 持久結果防止並行翻牌建立不同提示；重開或事件切換後重送原命令只回既有結果。其他玩家、執行師與不同來源卡片不能取代本人翻牌。
- Rules 在 server-prompts-v1 模式禁止客戶端直接改翻牌、核心卡片／事件及家庭／共享提示（包含新增提示和篡改參與者），防止繞過後端；未標記的舊房間保留原路徑。

verification-reveal-final.log：160 張卡片的 503 項翻牌檢查與 52 項 Rules 檢查通過，含家庭資格、來源滿階、缺少必要私有資料、普通卡片不依賴他人資料、並行重送及過期命令不改新事件。此清單只驗證翻牌／提示，不代表 160 張卡片的所有效果與分支已移轉。

verification-triggers-reveal.log：一般 Auth 玩家經 Callable 原子翻開 N027，建立六人共享提示，再各自收股利且後端自动結案；執行師不能代替玩家翻牌，重送只取回結果。既有家庭／銀行／學校／C056／醫院與維修整合通過。

verification-unit-reveal.log：68 檔／445 tests 通過，前後端 typecheck 與 Functions build 通過。整合並行交易仍有超過 10 秒的模擬器等待，尚未達體驗目標；統一等待確認與跨重開命令查核仍待完成。一般卡片效果／結案及其他財務尚未全部移轉，因此新模式不能啟用完整正式遊戲。仍未合併 dev、未發布，瀏覽器／正式雲端／實機驗收待完成。

```sh
node functions/test/build.mjs reveal
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-happinessflow-backend --only firestore 'GCLOUD_PROJECT=demo-happinessflow-backend node functions/lib/reveal-test.cjs && GCLOUD_PROJECT=demo-happinessflow-backend node functions/test/rules.cjs'
```

# MOTION & AUDIO AUDIT

審查日期：2026-07-07｜範圍：`.worktrees/線上模式0611`

## ☠️ P0 技術地雷（影響整份 Motion 評估）

**大量動畫 class 在 runtime 是「死的」。**【P0 / MOTION+UI / IMPLEMENTATION GAP】

- Tailwind 用 Play CDN 載入（`index.html:28`），`package.json` 無 tailwind 依賴（grep 0 筆）、無 `tailwind.config.*`、無 `postcss.config.*`。
- `src/styles/global.css`（定義 `dice-roll`、`dice-float`、`shake`、`success-pulse`、`shimmer`、`breath-light` 等全部自訂 keyframes，global.css:79-201）**沒有被任何檔案 import**（全專案 grep `import.*css` 零結果）。
- 後果一：`DiceFace.tsx:54` 的 `animate-dice-roll/dice-float`、`DiceRollModal.tsx:61-63` 的 `animate-success-pulse/shake`、`DiceFace.tsx:93` 的 shimmer 在瀏覽器**完全不動**。
- 後果二：全專案 31+ 處 `animate-in fade-in zoom-in-95` 屬於 `tailwindcss-animate` 外掛 class，Play CDN 未載入該外掛 → Modal「進場動畫」全是 no-op，Modal 瞬間彈出。
- 唯一確定活著的：核心 Tailwind 的 `animate-pulse/spin/ping/bounce`、framer-motion 驅動的、以及元件內嵌 `<style>` keyframes 的（HappinessWinAnimation.tsx:187-236）。
- **修復 CSS 管線（正式安裝 tailwind + tailwindcss-animate、import global.css）是所有 Motion 改善的前置條件，約半天工作量，能救活 30+ 個已寫好的動畫。**

## MOTION 盤點（✅有 / 🟡部分 / ❌無 / ☠️寫了但死掉）

| 事件 | 狀態 | 證據 |
|---|---|---|
| 頁面轉場（Lobby↔Game↔Score） | ❌ | AnimatePresence 只用於 dev modal（App.tsx:168-211）；view 切換硬切 |
| Modal 轉場 | ☠️ 大多死 | 31 處 animate-in；僅 GameHeader 房間資訊等少數用 framer-motion 真的會動 |
| 卡片翻牌 | ✅ | 兩處 3D rotateY 700ms（BoardCardDrawer.tsx:94-100、BoardProjectionView.tsx:282-291） |
| 骰子滾動（Dock） | ✅ 佳 | framer-motion 多關鍵幀拋物線+彈跳+落地換面（GameActions.tsx:215-233） |
| 骰子滾動（考試/升級） | ☠️ | animate-dice-roll keyframes 不存在（DiceFace.tsx:54） |
| 棋子移動（投影） | ✅ | movement path+80ms tick 逐格（BoardProjectionView.tsx:170-195）+spring（:763-777）；但格間是瞬移非平滑弧線 |
| 金錢變化 floating number | ❌ | **全專案無 floating +$**。僅 FinancialStatement NumericalValue 0.8s 變色 flash（:44-72）；HUD 現金瞬變（GameHeader.tsx:236） |
| 幸福變化 | 🟡 | 進度條 duration-1000 平滑（GameHeader.tsx:201）、愛心液面（GameStats.tsx:48-63）；勾選當下無 +N 飄字無粒子 |
| 資產購買 | ❌ | 僅 showAlert toast（GameView.tsx:1963） |
| 貸款 | ❌ | 同上 |
| 理賠 | ❌ | 無專屬動畫 |
| 升職/考試成敗 | 🟡→☠️ | DiceRollModal 有 success 粒子 state 與 shake（:41-52），但 class 全死 |
| 企業升級 | ☠️ | 依賴 DiceFace + 死掉的 zoom-in（BizUpgradeModal.tsx:116, 130） |
| 家庭事件 | ❌ | 卡面上只是表格 |
| 共享事件（新聞/股市） | ❌ | 只有 showAlert 文字（GameView.tsx:93-95） |
| 夢想完成 | ❌ | grep 無任何專屬動畫 |
| 財務自由 | 🟡 | 進度條變色發光（GameHeader.tsx:222），達成 100% 無儀式 |
| 幸福里程碑（Win） | ✅ 唯一完整 | HappinessWinAnimation：buildup→peak→main→outro 四階段、內嵌 keyframes 煙火+120 粒子——全 App 唯一具 ANTICIPATION→ACTION→IMPACT→RECOVERY 結構（9.5 秒偏長且不可跳過） |
| 遊戲結束/排名揭曉 | ❌ | ScoreView 靜態渲染 |

**結構評語**：除 Dock 骰子與 WinAnimation 外，所有活著的動畫都是單段 ease，無 anticipation 無 impact。

## MOTION GAP LIST

| P | 項目 |
|---|---|
| **P0** | 修復 CSS 管線——救活 30+ 已寫好的動畫 |
| **P0** | 金錢 floating number（+/-$ 飄向 HUD）＋ HUD 現金 count-up |
| **P1** | 排名揭曉/遊戲結束 podium 序列 |
| **P1** | 幸福勾選：+N 飄心＋進度條脈衝（為 100 分 Win 動畫鋪陳） |
| **P1** | Payday 金額滾動＋金幣粒子 |
| **P1** | Modal 統一 framer-motion AnimatePresence 進出場（棄用 animate-in） |
| **P2** | 棋子平滑弧線位移＋落格 squash；經過事件格的格子反應 |
| **P2** | 翻牌 anticipation（蓄力抖動）與 impact（光爆） |
| **P2** | 資產購買/升級的擁有儀式動畫 |
| **P3** | 頁面轉場（交叉溶接即可） |
| **P3** | 考試成功獎金彈出、失敗畫面降飽和 0.5s |

---

## AUDIO AUDIT

**【P0 / AUDIO】音效系統：完全不存在。** 全專案（src、index.html、public、package.json）grep `Audio|howler|.mp3|.wav|.ogg|WebAudio|vibrate` 零命中。無音效檔、無播放程式碼、無音量 UI。全程靜音。

### 必須有音效的事件（優先序）

| P | 事件 | 建議聲音性格 |
|---|---|---|
| P0 | 擲骰（搖動 loop+落地喀啦+定音） | 實體骰擬音，對齊 2.4s 動畫時間軸（GameActions.tsx:43） |
| P0 | 翻牌 | 紙牌 swoosh+snap |
| P0 | 金錢入帳/扣款 | 入帳＝輕快錢幣叮；扣款＝低沉短音（不刺耳） |
| P0 | 輪到你了（turn start） | 溫暖提示鐘——功能性音效，多人遊戲玩家常分心 |
| P1 | 考試/升級成敗 | 成功＝上行三音；失敗＝柔和下行（教學遊戲，失敗音切忌羞辱感） |
| P1 | 幸福 +N | 風鈴/水滴，每 +10 音高微升 |
| P1 | 幸福 100 Win | 完整 fanfare（配 9.5s 動畫分段） |
| P1 | 棋子移動 | 每格輕 tick（音高隨步數遞升，終格重音） |
| P2 | Modal 開關、按鈕 tap | 5-10ms 級微聲 |
| P2 | 排名揭曉 | 鼓 roll→揭曉 hit |
| P2 | 投影端 BGM | 輕爵士/馬林巴 lo-fi，僅投影幕播放 |

### 不應該有音效的事件（Audio Fatigue 防範）

- 財報摺疊/tab 切換/捲動/輸入——高頻低意義操作
- NumericalValue 每次 flash（報表重算會連環觸發）
- 倒數每秒 tick——只在最後 60 秒提示一次
- **其他玩家的例行操作**（見下方多人分流原則）

### 架構需求

1. **AudioManager 單例**：Master/BGM/SFX 三軌音量+全域 mute，存 localStorage；建議 howler.js。
2. **預載**：進 GameView 時 preload SFX sprite（單一 sprite 檔）；iOS PWA（index.html:9）需在首次手勢 unlock AudioContext。
3. **多人不同步（關鍵）**：狀態由 Firestore onSnapshot 廣播，若直接在 state 變化播音，8 人房會「別人領薪水我手機也叮」。原則：**本機只播「自己的行動」與「輪到你」；全場共視音效（骰子/移動/翻牌/揭曉）交給投影端播放**。以 `event.playerUid === myUid` 分流，event id 去重防 snapshot 重播。
4. 同 SFX 併發節流（50ms 內一次）+隨機 pitch ±5% 防機械感。

---

## GAME FEEL — CORE ACTION FEEDBACK MATRIX

| 行為 | 即時回饋 | 視覺變化 | 聲音 | 動畫 | 結果呈現 | 情緒 | 評分 |
|---|---|---|---|---|---|---|---|
| ROLL（Dock骰） | ✅ | ✅ 3D拋擲 | ❌ | ✅ 佳 | ✅ | 🟡 | **全場最佳** |
| MOVE（投影） | ✅ | ✅ | ❌ | 🟡 格間瞬移 | ✅ | 🟡 | 中上 |
| DRAW | ✅ | ✅ 翻牌 | ❌ | 🟡 單段 | ✅ | 🟡 | 中 |
| CHOOSE | ✅ | ❌ 無差異化預覽 | ❌ | ❌ | 🟡 toast | ❌ | 弱 |
| BUY | ✅ | 🟡 報表flash | ❌ | ❌ | 🟡 toast | ❌ **零擁有感** | **最缺Juice①** |
| SELL | ✅ | 🟡 | ❌ | ❌ | 🟡 | ❌ | 弱 |
| PAY | ✅ | 🟡 現金瞬變 | ❌ | ❌ 無失去感 | 🟡 | ❌ | **最缺Juice②** |
| EARN（Payday等） | ✅ | 🟡 靜態+$ | ❌ | ❌ | ✅ | 🟡 | **最缺Juice③（期望最高落差最大）** |
| UPGRADE | ✅ | 🟡 | ❌ | ☠️ 骰子已死 | ✅ | 🟡 | 中（待修） |
| COMPLETE（幸福/家庭/夢想） | ✅ | 🟡 checkbox變粉 | ❌ | ❌ | 🟡 | ❌ | **最缺Juice④（主題核心卻最平淡）** |
| WIN（幸福100） | ✅ | ✅ 全屏慶典 | ❌ | ✅ 四階段 | ✅ | ✅ | 佳（但無聲） |

**最缺 Juice：BUY / EARN / COMPLETE / 排名揭曉。共同病根：所有經濟行為的終點都是「toast 文字+報表數字默默改變」——遊戲把最頻繁的核心循環（賺→買→幸福）做成了記帳。**

## 評分

| 維度 | 完成度 | 理由 |
|---|---:|---|
| Motion | 35% | Dock 骰子與 Win 動畫證明有能力，但 CSS 管線斷裂讓大半動畫是死 class，經濟行為零動效 |
| Audio | 0% | 一行音效程式碼都沒有 |
| Game Feel | 30% | 擲骰一個動作撐起全部手感，核心情緒迴路完全沒有 juice |

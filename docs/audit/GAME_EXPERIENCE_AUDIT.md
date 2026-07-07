# GAME EXPERIENCE AUDIT — 總報告

| 項目 | 內容 |
|---|---|
| 審查日期 | 2026-07-07 |
| 審查範圍 | `.worktrees/線上模式0611`（分支 260706最新版） |
| 審查方式 | 虛擬審查團隊（Game Director / Game UX / UI Designer / Technical Artist / Audio Designer / Game Product Designer / QA Lead），純 READ/ANALYZE/AUDIT，未修改任何程式碼與規格 |
| 子報告 | PLAYER_JOURNEY_AUDIT.md、UI_UX_AUDIT.md、ART_DIRECTION_AUDIT.md、MOTION_AUDIO_AUDIT.md、MULTIPLAYER_EXPERIENCE_AUDIT.md、GAME_COMPLETENESS_MATRIX.md、GAME_POLISH_BACKLOG.md |

## 核心問題（一句話）

**HappinessFlow 目前是一個「同步做得扎實、規則齊備的財商教學工具」，但距離「正式遊戲」還缺三層皮：情緒回饋層（動畫/音效/慶祝）、多人存在感層、以及美術世界觀層。** 玩家 90% 的時間在看一張深色記帳報表，賺錢、買資產、獲得幸福這條核心情緒迴路的終點全是「toast 文字 + 數字默默改變」。

## 完成度總評

| 維度 | 完成度 | 一句理由 |
|---|---:|---|
| 目前遊戲完成度（整體） | **48%** | 規則與同步是產品級，體驗層是原型級 |
| 功能完成度 | **75%** | 核心玩法迴路全部走得通，缺斷線感知/音效/設定等外圍 |
| Game UX 完成度 | **58%** | 阻塞原因系統與共享事件 modal 是亮點；「現在輪到誰」在手機上不可見是最大洞 |
| UI 完成度 | **68%** | 工整的 fintech dashboard 等級，但像後台不像遊戲 |
| Art 完成度 | **18%** | 全遊戲僅 9 張職級徽章 PNG，卡片/棋盤/角色全靠 CSS 與通用 icon |
| Motion 完成度 | **35%** | CSS 管線斷裂（見 P0 技術地雷）導致大半動畫是死 class |
| Audio 完成度 | **0%** | 一行音效程式碼都沒有 |
| Multiplayer Experience 完成度 | **25%** | 同步扎實，存在感趨近於零，像各玩各的單機記帳 |
| Onboarding 完成度 | **40%** | 教學只教財報，棋盤模式核心循環 0% 覆蓋 |
| Game Feel 完成度 | **30%** | 擲骰一個動作撐起全部手感 |

## 全案最重大發現（跨報告彙整）

### ☠️ P0 技術地雷：大量動畫在 runtime 是死的
Tailwind 用 Play CDN 載入（`index.html:28`），`package.json` 無 tailwind 依賴、無 config；`src/styles/global.css`（定義 dice-roll/shake/success-pulse 等全部自訂 keyframes）**沒有被任何檔案 import**。後果：31+ 處 `animate-in fade-in zoom-in`（tailwindcss-animate 外掛 class）與考試骰子的 `animate-dice-roll` 全部是 no-op。修復 CSS 管線是所有 Motion 改善的前置條件，半天工作量能救活 30+ 個已寫好的動畫。

### 🔇 音效系統完全不存在
全專案 grep `Audio|howler|.mp3|.wav` 零命中。桌遊 Web App 全程靜音。

### 👤 玩家手機上看不到「現在輪到誰」
`currentTurnName` 只渲染在投影幕（`BoardProjectionView.tsx:654`）；玩家手機上只有灰掉的骰子，與「卡住/斷線」無法區分。

### 🃏 卡片正文不在手機上
手機端翻牌後固定顯示「請看大地圖確認內容」（`BoardCardDrawer.tsx:60-65`），玩家做接受/拒絕決策的畫面上沒有影響數字——沒有投影幕的純線上場次形同盲玩。

### 🏁 遊戲結束連 Winner 都沒顯示
ScoreView 只有個人積分 checklist，無排名、無揭曉、無人生回顧。諷刺的是完整 history 資料已上傳雲端，素材齊備卻一行都沒渲染。

### 🎨 兩套美術方向互相打架
玩家端是 slate 深色科技風（像加密貨幣交易所），投影端是米色暖紙質桌遊風（全案品質最高的畫面）。後者已自己給出 Art Direction 的答案，但沒有回頭統一前者。

## 標記統計

| 標記 | 數量（去重後主要項目） |
|---|---|
| SPEC GAP | 3（全員setup柵欄、經過維修廠榮譽制※本審查期間已另行修復、教學觸發時機無規格） |
| IMPLEMENTATION GAP | 4（isReady幽靈欄位、IS_DEV_VERSION寫死、font-cute死class、CSS管線斷裂） |
| SPEC CONFLICT | 1（Tutorial 宣稱「全對才成功」vs 實際「答錯即洩題」） |
| EXPERIENCE GAP | 50+（詳見 GAME_POLISH_BACKLOG.md） |

## 「目前最不像正式遊戲的 10 個地方」

1. **全程靜音** — 沒有任何音效，擲骰、翻牌、金錢、勝利全部無聲
2. **幸福值面板是待辦清單** — 遊戲的勝利資源長得像 Jira 子任務列表，勾選零慶祝
3. **遊戲結束是一張對帳單** — 無排名揭曉、無 winner、無人生故事，像月結報表
4. **手機上看不到棋盤也看不到輪到誰** — 沒有投影幕就是盲玩
5. **賺錢/買資產零回饋** — 沒有 floating number、沒有金幣、沒有擁有感，Payday 只是靜態 +$
6. **卡片沒有卡圖** — 純文字 + CSS 漸層卡背，桌遊的「臉」不存在
7. **他人達成里程碑時你的螢幕毫無反應** — 多人慶祝是單機的
8. **UI 是深色 fintech dashboard** — 與「蜜蜂/幸福/人生」主題完全割裂
9. **教學教的是記帳不是遊戲** — 棋盤、卡片、回合、銀行事件 0% 覆蓋
10. **Modal 瞬間彈出無轉場**（CSS 管線斷裂）＋ 換回合無任何演出

## 五階段路線圖

### PHASE 1 — PLAYABLE（讓純線上場次能自主遊玩）
- 修復 CSS 管線（P0 前置）
- Header 常駐「輪到 {name}」回合狀態列
- 卡片影響摘要顯示在手機端（不再依賴投影幕）
- 全員 setup 同步柵欄 + 房間未滿員可開局
- 斷線 presence 心跳 + 斷線者回合處理
- 修 isReady 幽靈欄位、IS_DEV_VERSION 寫死

### PHASE 2 — GAME FEEL（把記帳變成遊戲）
- 最小 AudioManager + 四組核心音效（骰子/翻牌/金錢/輪到你）
- 金錢 floating number + HUD 現金 count-up
- 幸福勾選慶祝（+N 飄心 + 進度條脈衝）
- Payday 金額滾動 + 金幣粒子
- Modal 統一 framer-motion 進出場
- 財務檢核答錯改階梯式提示（先提示錯誤數，再給答案）

### PHASE 3 — VISUAL POLISH（美術世界觀）
- 確立「蜂巢暖陽・紙上人生」Art Direction（以投影棋盤風格為母體）
- 22 張優先插畫（7 地格 + 3 卡背圖騰 + 12 職業蜜蜂角色）
- 卡面模板（上40%插畫+下60%文字）
- 幸福面板改「收藏冊」視覺
- 中文顯示字型 + design token + z-index 系統

### PHASE 4 — MULTIPLAYER EXPERIENCE（存在感）
- Player Activity Feed 推播（誰抽卡/買資產/升職/+幸福）
- 回合交接演出（Turn Transition）
- Shared Celebration（他人達標時全員畫面演出）
- 手機端迷你棋盤視圖（看得到所有棋子位置）
- 等待狀態點名（「等待：{names}」）
- Emoji Reaction（低成本社交層）

### PHASE 5 — RELEASE READY（正式上線）
- 遊戲結束 podium 排名揭曉序列 + 人生旅程回顧
- 完整 Onboarding（棋盤模式教學 + First Turn Guide + Coach Marks）
- Settings（音量/顯示）、Feedback 管道、Crash Reporting
- Accessibility 基本盤（aria、字級、對比）
- Analytics + 效能監控

## 「如果只能做 20 件事」— 優先清單

見 GAME_POLISH_BACKLOG.md 的 TOP 20 段落。

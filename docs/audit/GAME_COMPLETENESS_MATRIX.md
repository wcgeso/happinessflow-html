# GAME COMPLETENESS MATRIX

審查日期：2026-07-07｜範圍：`.worktrees/線上模式0611`｜標準：正式對外上線遊戲

| 項目 | 狀態 | 佐證 | SEVERITY |
|---|---|---|---|
| Settings（遊戲內設定選單） | ⚠️ 部分 — 齒輪選單只有結算/股市/教學/玩家/離開，非真設定 | GameHeader.tsx:256-303 | P2 |
| Audio Settings / 音效 | ❌ 不存在 — 全遊戲無任何音效實作 | grep Howl/Audio 零命中；types.ts:125 `volume?` 未用 | P2 |
| Display Settings | ❌ 不存在 | — | P3 |
| Accessibility（無障礙） | ❌ 幾乎不存在 — 全 GameView 僅 1 個 aria-label | GameView.tsx:2022 | P2 |
| Reconnect（重連） | ✅ 存在 — localStorage `active_room_` 自動重掛監聽＋憑雲端 playerStates 中途重進 | RoomContext.tsx:704-711, 880-896 | — |
| Disconnect Handling（斷線感知） | ❌ 不存在 — 無 presence/onDisconnect/心跳；他人無感、回合可能乾等 | types.ts:423 status 欄位未使用 | **P1** |
| Loading States | ⚠️ 部分 — Suspense+Spinner、上傳 spinner、isLoadingRoom；棋盤同步多以 alert 表達 | App.tsx:119-136 | P3 |
| Error Handling | ⚠️ 部分 — ErrorBoundary 通用「請重新整理」＋safeAsync 吞錯；錯誤未上報 | components/common/ErrorBoundary.tsx:27-49 | P2 |
| Save State | ✅ 存在 — 本地 `happiness_game_state` 自動存＋雲端 playerStates 防抖同步 | GameContext.tsx:59-60, 113-116 | — |
| Resume Game | ✅ 存在（依附上兩項） | RoomContext.tsx:880-896 | — |
| Room Recovery | ⚠️ 部分 — 過期 movement 自動補完；無房主轉移，房主刪房即全滅 | RoomContext.tsx:719-735, 1105-1117 | P2 |
| Tutorial | ✅ 存在 — TutorialModal（544 行），大廳＋遊戲內入口（但內容缺口見 PLAYER_JOURNEY_AUDIT） | LobbyView.tsx:873-876 | — |
| Rule Book | ⚠️ 部分 — 完整說明書為 repo 外 HTML/PDF，未連入 app | 專案根目錄 遊戲說明書.pdf | P3 |
| Help | ⚠️ 部分 — 等同 Tutorial 入口 | GameHeader.tsx:277 | P3 |
| Credits | ❌ 不存在 | — | P3 |
| Version 顯示 | ⚠️ 部分 — version.ts v2.0 只在 GM DeveloperPortal 顯示；且 `IS_DEV_VERSION = true` 寫死（bug，環境判斷邏輯形同虛設） | constants/version.ts 末行 | P3（bug 本身 P2） |
| Patch Notes | ⚠️ 部分 — CoachDashboard 內建 Changelog Modal（硬編碼），僅執行師可見 | CoachDashboard.tsx:1080-1120 | P3 |
| Privacy / Terms | ✅ 存在 — AuthView 與 Lobby 連外部 privacy.html/服務條款 | AuthView.tsx:383-397 | — |
| Feedback 管道 | ❌ 不存在（ProfileModal 的 bindFeedback 是推薦碼綁定，非意見回報） | ProfileModal.tsx:89 | P2 |
| Bug Report | ❌ 不存在 | — | P2 |
| Analytics | ❌ 不存在 | grep 無結果 | P3 |
| Crash Reporting | ❌ 不存在 — componentDidCatch 只 console.error | ErrorBoundary.tsx:23-25 | P2 |
| Performance Monitoring | ❌ 不存在 | grep 無結果 | P3 |
| 維護模式頁 | ✅ 存在（加分項） | App.tsx:95-113 | — |

## 統計

- ✅ 存在：6 項
- ⚠️ 部分存在：8 項
- ❌ 不存在：10 項

## 附帶發現的 IMPLEMENTATION GAP（可順手修）

1. `GameHeader.tsx:381` — `isReady` 幽靈欄位（RoomMember 無此欄位），玩家清單永遠顯示「🟡 準備中...」
2. `constants/version.ts` 末行 — `IS_DEV_VERSION = true` 寫死，上方環境判斷邏輯形同虛設
3. `HappinessWinAnimation.tsx:130` — `font-cute` class 全專案未定義
4. `index.html:28` — Tailwind Play CDN + global.css 未 import（詳見 MOTION_AUDIO_AUDIT.md P0）

## 整體判定

目前的完整度可支撐「**執行師帶場的工作坊工具**」（核心玩法/存檔重連/教學/隱私條款齊備），但距「**玩家自行遊玩的正式線上遊戲**」缺：斷線感知（P1）、音效、無障礙、錯誤上報、回饋管道。

整體正式遊戲完整度：**40%**

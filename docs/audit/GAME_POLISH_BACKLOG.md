# GAME POLISH BACKLOG

審查日期：2026-07-07｜彙整自全部子審查報告｜依嚴重度排序
複雜度標尺：S（<1天）/ M（1-3天）/ L（3-7天）/ XL（>1週）

---

## P0 — 無法正常遊玩級（或阻擋一切後續改善）

### PB-001
- CATEGORY: MOTION / TECHNICAL｜SEVERITY: P0｜SYSTEM: 建置管線｜SCREEN: 全部
- CURRENT EXPERIENCE: Modal 瞬間彈出、考試骰子只是數字亂跳、成功/失敗特效不動
- PROBLEM: Tailwind 用 Play CDN（index.html:28）、無 tailwindcss-animate、global.css（全部自訂 keyframes）未被 import——31+ 處 animate-in 與 dice-roll/shake/success-pulse 全是死 class
- PLAYER IMPACT: 已寫好的 30+ 個動畫全部不生效，遊戲感大量流失且開發者不自知
- EVIDENCE: index.html:28；package.json 無 tailwind；global.css:79-201 未 import；DiceFace.tsx:54；DiceRollModal.tsx:61-63
- RECOMMENDED DIRECTION: 正式安裝 tailwind + tailwindcss-animate + import global.css
- DEPENDENCY: 無（本項是其他 Motion 項目的前置）｜SPEC STATUS: IMPLEMENTATION GAP｜COMPLEXITY: S

### PB-002
- CATEGORY: AUDIO｜SEVERITY: P0（以正式遊戲標準）｜SYSTEM: 音效｜SCREEN: 全部
- CURRENT EXPERIENCE: 全程靜音
- PROBLEM: 音效系統完全不存在（全庫 grep 零命中）
- PLAYER IMPACT: 擲骰/翻牌/金錢/勝利全部無聲，是「像 Web App 不像遊戲」的最大單一因素之一
- EVIDENCE: grep Audio|howler|.mp3|.wav 零結果
- RECOMMENDED DIRECTION: AudioManager 單例（howler.js）+ 四組核心音效（骰子/翻牌/金錢/輪到你）+ Master/BGM/SFX 音量；多人分流原則見 MOTION_AUDIO_AUDIT.md
- DEPENDENCY: 無｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: M

---

## P1 — 嚴重破壞遊戲體驗

### PB-003
- CATEGORY: GAME-UX / MULTIPLAYER｜SEVERITY: P1｜SYSTEM: 回合｜SCREEN: GameHeader/GameView
- CURRENT EXPERIENCE: 非自己回合時只有灰骰子＋手機無效的 title tooltip
- PROBLEM: 「現在輪到誰」在玩家手機上不可見（currentTurnName 只在投影幕）
- PLAYER IMPACT: 不知在等誰、等多久，與卡住/斷線不可區分；一個元件可同時解 M1 與 E1 兩個 P1
- EVIDENCE: GameActions.tsx:292；BoardProjectionView.tsx:574/654；GameHeader 全文無回合元素
- RECOMMENDED DIRECTION: Header 常駐「🎲 輪到 {name}（第x/n位）＋當前事件簡述」，輪到自己全幅高亮
- DEPENDENCY: 無（boardState.currentTurnUid/currentEvent 已在 Firestore）｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: S

### PB-004
- CATEGORY: GAME-UX｜SEVERITY: P1｜SYSTEM: 卡片｜SCREEN: BoardCardDrawer
- CURRENT EXPERIENCE: 手機翻牌後固定顯示「請看大地圖確認內容」
- PROBLEM: 卡片正文與影響數字不在做決策的畫面上，投影幕是單點故障
- PLAYER IMPACT: 無投影幕的純線上場次形同盲玩
- EVIDENCE: BoardCardDrawer.tsx:60-65, 161-164
- RECOMMENDED DIRECTION: 把 txData.impacts 影響摘要渲染在 actionArea 上方（資料已存在）
- DEPENDENCY: 無｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: S

### PB-005
- CATEGORY: MULTIPLAYER / TECHNICAL｜SEVERITY: P1｜SYSTEM: 連線｜SCREEN: 全部
- CURRENT EXPERIENCE: 玩家斷線後其他人毫無感知，輪到斷線者時全場乾等
- PROBLEM: 無 presence/心跳/onDisconnect；types.ts:423 status 欄位從未使用
- PLAYER IMPACT: 一人斷線全場卡死，只能口頭聯繫或棄局
- EVIDENCE: grep presence/onDisconnect 零命中；RoomContext.tsx:719-735 僅 movement 過期補完
- RECOMMENDED DIRECTION: presence 心跳寫入 + 玩家清單顯示在線狀態 + 斷線者回合 timeout 跳過機制（跳過規則需先補 SPEC）
- DEPENDENCY: 跳過規則需產品拍板（SPEC GAP）｜SPEC STATUS: SPEC GAP + EXPERIENCE GAP｜COMPLEXITY: L

### PB-006
- CATEGORY: GAME-END｜SEVERITY: P1｜SYSTEM: 結算｜SCREEN: ScoreView
- CURRENT EXPERIENCE: 遊戲結束＝個人積分 checklist，連 winner 都不顯示
- PROBLEM: 無排名揭曉/無人生回顧；完整 history 資料已上傳卻一行未渲染
- PLAYER IMPACT: 多人桌遊的社交高潮（誰贏了）完全缺席，體驗停在對帳單
- EVIDENCE: ScoreView.tsx 全檔；資料在 :111-137
- RECOMMENDED DIRECTION: podium 排名揭曉序列（倒序揭曉→冠軍聚光）+ 人生旅程時間軸（用既有 history）
- DEPENDENCY: 平手排名規則已定案（FINANCIAL_DECISION DEC-005）｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: L

### PB-007
- CATEGORY: ONBOARDING｜SEVERITY: P1｜SYSTEM: 教學｜SCREEN: TutorialModal
- CURRENT EXPERIENCE: 教學 9 步全在教財報操作
- PROBLEM: 棋盤模式核心循環（擲骰/卡片/銀行/醫院/回合/結束）0% 覆蓋；教學又出現在三大初始決策之後
- PLAYER IMPACT: 沒有執行師在場就玩不起來，是「工作坊工具」與「正式遊戲」的分水嶺
- EVIDENCE: TutorialModal.tsx:348-407；GameView.tsx:218-223（觸發時機）
- RECOMMENDED DIRECTION: 補棋盤模式教學章節＋SelectionView 前置 1 頁遊戲目標卡＋First Turn coach mark
- DEPENDENCY: 無｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: M

### PB-008
- CATEGORY: MULTIPLAYER｜SEVERITY: P1｜SYSTEM: 共享慶祝｜SCREEN: GameView
- CURRENT EXPERIENCE: 他人達成幸福100/財務自由/夢想時你的螢幕零反應
- PROBLEM: HappinessWinAnimation 只由本地 happinessTotal 觸發
- PLAYER IMPACT: 多人遊戲最重要的共同情緒時刻是單機的
- EVIDENCE: GameView.tsx:225-229
- RECOMMENDED DIRECTION: 里程碑事件寫入 room 層 + 全員端觸發 Shared Celebration（他人版可較短）
- DEPENDENCY: 無｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: M

### PB-009
- CATEGORY: GAME-UX / SPEC-GAP｜SEVERITY: P1｜SYSTEM: 開局｜SCREEN: SelectionView/RoomView
- CURRENT EXPERIENCE: 首位完成選擇者骰子立即可擲，其餘玩家還在選職業；房間不滿員永遠無法開始
- PROBLEM: 無全員 setup 同步柵欄（GAP-A4）；開始按鈕只在滿員時渲染（GAP-A1）
- PLAYER IMPACT: 搶跑/漏事件/整團卡等待室
- EVIDENCE: App.tsx:542-588；RoomContext.tsx:224-235；RoomView.tsx:297-309
- RECOMMENDED DIRECTION: 「等待全員完成設定(n/m)」攔截層＋rollBoardDice 加 all-isSetup 檢查＋未滿員可開局（附確認）
- DEPENDENCY: 未滿員開局規則需確認（SPEC GAP）｜SPEC STATUS: SPEC GAP｜COMPLEXITY: M

### PB-010
- CATEGORY: MOTION / GAME-FEEL｜SEVERITY: P1｜SYSTEM: 財務回饋｜SCREEN: 全部
- CURRENT EXPERIENCE: 金錢變化＝HUD 數字瞬變＋報表 0.8s 變色
- PROBLEM: 全專案無 floating number、無 count-up——最頻繁的核心迴路（賺/花錢）零情緒
- PLAYER IMPACT: BUY/EARN/PAY 三大行為全部沒有 juice，遊戲變記帳
- EVIDENCE: GameHeader.tsx:236；FinancialStatement.tsx:44-72
- RECOMMENDED DIRECTION: +/-$ floating number 飄向 HUD + 現金 count-up 滾動
- DEPENDENCY: PB-001｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: M

### PB-011
- CATEGORY: ONBOARDING / GAME-UX｜SEVERITY: P1｜SYSTEM: 財務檢核｜SCREEN: BoardFinancialCheckModal
- CURRENT EXPERIENCE: 答錯直接列出全部正確答案
- PROBLEM: 核心教學機制被一次性洩題摧毀；與 Tutorial 宣稱「全對才成功」矛盾（SPEC CONFLICT）
- PLAYER IMPACT: 玩家學到的是「亂按→抄答案」，財商教學價值歸零
- EVIDENCE: BoardFinancialCheckModal.tsx:186-211, 338-366；TutorialModal.tsx:374
- RECOMMENDED DIRECTION: 階梯式提示：第一次錯只說「有n處錯誤」+高亮分類；第二次才給答案
- DEPENDENCY: 教學懲罰規則建議產品確認｜SPEC STATUS: SPEC CONFLICT｜COMPLEXITY: S

### PB-012
- CATEGORY: MULTIPLAYER｜SEVERITY: P1｜SYSTEM: 棋盤｜SCREEN: GameView
- CURRENT EXPERIENCE: 玩家手機上看不到棋盤與任何人的棋子位置
- PROBLEM: playerPositions 只被投影幕消費
- PLAYER IMPACT: 空間感/相對位置感/追趕感全部缺失
- EVIDENCE: App.tsx:116-123（?boardRoom= 專屬路由）
- RECOMMENDED DIRECTION: 手機端迷你棋盤視圖（簡化環形+棋子點位即可）
- DEPENDENCY: 無｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: L

### PB-013
- CATEGORY: ONBOARDING｜SEVERITY: P1｜SYSTEM: 選角｜SCREEN: SelectionView
- CURRENT EXPERIENCE: 職業卡只有 icon+職稱，無薪資/存款/支出
- PROBLEM: 影響最大的首個決策是盲選（企業/夢想卡反而有明細）
- EVIDENCE: SelectionView.tsx:67-77 vs :104-116
- RECOMMENDED DIRECTION: 職業卡補「起薪/起始存款/月支出概況」
- DEPENDENCY: 無｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: S

### PB-014
- CATEGORY: GAME-UX｜SEVERITY: P1｜SYSTEM: 回合｜SCREEN: GameView
- CURRENT EXPERIENCE: 被停回合（醫院/維修）的玩家無任何提示，靜默被跳過
- PROBLEM: getNextTurnUid 靜默消耗 skipTurns；醫院 modal 未提停回合
- PLAYER IMPACT: 「怎麼一直沒輪到我」的困惑與不信任感
- EVIDENCE: RoomContext.tsx:337-355；GameView.tsx:2979-2981
- RECOMMENDED DIRECTION: 停回合寫入時提示本人「下回合暫停」；被跳過當下全員可見「{name} 暫停一回合（住院中）」
- DEPENDENCY: PB-003（回合狀態列）｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: S

### PB-015
- CATEGORY: ART｜SEVERITY: P1｜SYSTEM: 美術｜SCREEN: 全部
- CURRENT EXPERIENCE: 全遊戲僅 9 張徽章 PNG；玩家端深色科技風與投影端暖紙質風互相打架
- PROBLEM: 無統一 Art Direction、零卡圖零棋盤圖零角色
- PLAYER IMPACT: 「像後台不像遊戲」的根本原因之一；品牌記憶點缺失
- EVIDENCE: public/ 盤點僅 15 圖；index.html:12 vs BoardProjectionView.tsx:641
- RECOMMENDED DIRECTION: 採「蜂巢暖陽・紙上人生」方向（見 ART_DIRECTION_AUDIT.md），首批 22 張插畫（7地格+3卡背+12職業蜂）
- DEPENDENCY: 需美術資源投入決策｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: XL

### PB-016
- CATEGORY: MULTIPLAYER｜SEVERITY: P1｜SYSTEM: 活動訊息｜SCREEN: GameView
- CURRENT EXPERIENCE: 只有被動開啟的抽卡日誌
- PROBLEM: 無 Activity Feed 推播（誰抽卡/買資產/升職/+幸福）
- PLAYER IMPACT: 其他玩家的人生進展完全不可見，存在感為零
- EVIDENCE: GameView.tsx:2007-2031
- RECOMMENDED DIRECTION: 輕量 toast feed（右上角滑入，3秒消失），資料源用既有 cardLog/history 事件
- DEPENDENCY: 無｜SPEC STATUS: EXPERIENCE GAP｜COMPLEXITY: M

---

## P2 — 明顯降低品質（摘要，完整細節見各子報告）

| ID | CATEGORY | 項目 | EVIDENCE | COMPLEXITY |
|---|---|---|---|---|
| PB-017 | GAME-FEEL | 幸福勾選零慶祝（+N飄心+粒子） | HappinessPanel.tsx:79-137 | S |
| PB-018 | GAME-FEEL | Payday 靜態+$（金額滾動+金幣粒子+標題中文化） | PaydayModal.tsx:43,76-78 | S |
| PB-019 | UI | 幸福面板改「收藏冊」視覺（脫離待辦清單） | HappinessPanel.tsx:56-141 | M |
| PB-020 | MOTION | Modal 統一 framer-motion 進出場 | 31 處 animate-in | M |
| PB-021 | MULTIPLAYER | 回合交接演出（Turn Transition 卡） | RoomContext.tsx:337-356 | S |
| PB-022 | MULTIPLAYER | 等待共享事件點名「等待：{names}」 | GameView.tsx:444-447 資料已可算 | S |
| PB-023 | MULTIPLAYER | isReady 幽靈欄位 bug 修正 | GameHeader.tsx:381 | S |
| PB-024 | MULTIPLAYER | HUD 顯示其他玩家頭像列（脫離齒輪選單） | GameHeader.tsx:282-291 | M |
| PB-025 | GAME-UX | 銀行窗口限制前置顯示（保險/定存灰化+badge） | GameView.tsx:1400-1403 | S |
| PB-026 | GAME-UX | 阻塞原因常駐顯示（骰子下方 label） | GameView.tsx:622-637 | S |
| PB-027 | GAME-UX | 「結算評分」改名「查看目前成績」防誤解 | GameHeader.tsx:269-272 | S |
| PB-028 | PROGRESSION | 遊戲中成就/里程碑 toast（幸福50/財自50%/首資產） | AchievementsView 僅大廳 | M |
| PB-029 | PROGRESSION | 夢想進度常駐徽章 | GameActions.tsx:257-268 | S |
| PB-030 | UI | 中文顯示字型 + design token + z-index 系統 | index.html:30；12種圓角 | M |
| PB-031 | MOTION | 棋子平滑弧線移動+落格squash | BoardProjectionView.tsx:170-195 | M |
| PB-032 | MOTION | 翻牌 anticipation+impact | BoardCardDrawer.tsx:94-100 | S |
| PB-033 | GAME-FEEL | 資產購買擁有儀式（報表列slide-in+glow+資產icon） | FinancialStatement.tsx | M |
| PB-034 | TECHNICAL | Crash Reporting + Feedback 管道 | ErrorBoundary.tsx:23-25 | M |
| PB-035 | ACCESSIBILITY | aria 基本盤+超小字修正（text-[8.5px]） | GameView 僅1個aria-label；GameHeader.tsx:212 | M |
| PB-036 | TECHNICAL | IS_DEV_VERSION 寫死修正+版本顯示 | constants/version.ts | S |
| PB-037 | GAME-END | 夢想結果宣告+趣味獎項（資產王/幸福王） | ScoreView | M |
| PB-038 | UI | 企業升級成功演出（工作室→大樓變形） | BizUpgradeModal.tsx:116-136 | M |
| PB-039 | TECHNICAL | 房主轉移機制（房主刪房即全滅） | RoomContext.tsx:1105-1117 | M |
| PB-040 | GAME-UX | 現金不足 modal 鏈簡化（檢核→不足→交易→回檢核） | GameView.tsx:2866-2908 | M |

## P3 — Polish（摘要）

| ID | 項目 |
|---|---|
| PB-041 | 頁面轉場交叉溶接 |
| PB-042 | Emoji Reaction/Ping 社交層 |
| PB-043 | 卡片圖鑑/收集 |
| PB-044 | 「再來一場」動線 |
| PB-045 | 教學觸發改 per-account |
| PB-046 | Rule Book 連入 app + Glossary |
| PB-047 | Credits/Patch Notes 玩家可見 |
| PB-048 | 投影端 BGM |
| PB-049 | 考試失敗畫面降飽和/成功獎金彈出 |
| PB-050 | font-cute 死 class 清理 |

---

# TOP 20 —「如果只能做 20 件事」

依「解鎖效果 × 成本效益」排序：

1. **PB-001 修復 CSS 管線**（S）— 半天救活 30+ 動畫，一切 Motion 的前置
2. **PB-003 回合狀態列**（S）— 一個元件解兩個 P1（不知輪到誰+等待焦慮）
3. **PB-004 卡片影響摘要上手機**（S）— 解除投影幕單點故障
4. **PB-002 最小音效系統**（M）— 骰子/翻牌/金錢/輪到你四組音，靜音→有聲是質變
5. **PB-010 金錢 floating number + count-up**（M）— 核心迴路的 juice 基礎
6. **PB-011 財務檢核階梯式提示**（S）— 救回教學核心價值
7. **PB-013 職業卡補決策資訊**（S）— 首個決策不再盲選
8. **PB-009 全員 setup 柵欄 + 未滿員開局**（M）— 開局體驗兩大洞
9. **PB-014 停回合提示**（S）— 消除「怎麼沒輪到我」困惑
10. **PB-017 幸福勾選慶祝**（S）— 主題核心行為的情緒回饋
11. **PB-018 Payday 演出**（S）— 最便宜的爽點投資
12. **PB-007 棋盤模式教學補完**（M）— 脫離「必須有執行師」
13. **PB-016 Activity Feed**（M）— 多人存在感最低成本方案
14. **PB-008 Shared Celebration**（M）— 共同情緒時刻
15. **PB-006 遊戲結束排名揭曉+人生回顧**（L）— 終幕體驗，資料已齊備
16. **PB-023 isReady bug + PB-036 版本旗標**（S）— 順手修的實際 bug
17. **PB-005 presence 斷線感知**（L）— 純線上場次的必要條件
18. **PB-021 回合交接演出**（S）— 節奏感
19. **PB-024 HUD 其他玩家頭像列**（M）— 看得見對手的臉
20. **PB-012 手機迷你棋盤**（L）— 空間感補完

（PB-015 Art Direction 為 XL 級投資，建議獨立立項，不佔用此 20 格）

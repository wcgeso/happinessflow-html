# UI / UX AUDIT

審查日期：2026-07-07｜範圍：`.worktrees/線上模式0611`

## 整體診斷

整體是**乾淨、工整的深色 SaaS Dashboard 語言**：`bg-slate-900` 卡片、`border-slate-700`、`rounded-2xl/3xl`、`backdrop-blur`、`text-[10px] uppercase tracking-widest` 英文小標（ScoreView.tsx:455 "Total Score"、PaydayModal.tsx:43 "Bank Action"）。2023-24 年 fintech app 美學，執行品質中上，但**它是「理財 App」不是「遊戲」**。

## 系統性問題

### Typography【P1 / UI】
- `index.html:30` 只載入 Inter（拉丁字體），中文全部 fallback 系統字——中文遊戲沒有中文顯示字型。
- `HappinessWinAnimation.tsx:130` 用了 `font-cute`，全專案無任何地方定義 → 死 class（IMPLEMENTATION GAP）。
- 標題層級靠 `font-black + text-2xl` 硬撐，缺 display font 的遊戲標題感。

### Color System【P1 / UI】
- 無 design token。顏色語意靠慣例（pink=幸福、emerald=金錢、rose=負、amber=分數），大致一致。
- `ui.tsx:18-22` Button 的 primary/success/amber 三個 variant 是同一 amber 色系，按鈕層級形同虛設。
- 實際上各元件幾乎不用共用 Button，內聯 30+ 種一次性按鈕樣式（GameActions.tsx:250 vs PaydayModal.tsx:82 vs ScoreView.tsx:383 各自為政）。

### 元件一致性【P1 / UI】
- `src/components/ui/ui.tsx` 僅 60 行 5 個元件，風格（rounded-xl/lg）與頁面主流（rounded-2xl/3xl/[32px]）脫節——UI kit 已被拋棄。
- 圓角至少 12 種：lg / xl / 2xl / 3xl / [14px] / [18px] / [24px] / [28px] / [31px] / [32px] / [2.5rem] / [3rem]。

### z-index 混亂【P2 / UI】
- z-40（GameHeader:152）→ z-[100] → z-[150] → z-[9999]（BizUpgradeModal:53）→ z-[10000] → z-[10002] → z-[10010] → z-[10020] → z-[10031]（BoardProjection:660）。無層級系統，靠加大數字互踩。

### 資訊密度【P2 / UI】
- 手機 HUD 大量 `text-[8.5px]`、`text-[9px]`、`text-[10px]`（GameHeader.tsx:212, 238），低於可讀性下限。

## 逐畫面審查

### 主 HUD（GameHeader.tsx:151-310）
- CURRENT：懸浮玻璃名片：職業 icon+星級、雙進度條（幸福粉/財務綠）、現金、齒輪選單。
- PROBLEM：資訊架構不錯，但視覺是「銀行 App 帳戶總覽」；職業頭像只是 lucide icon（:167）；「結算評分/離開房間」藏在齒輪 dropdown（:269-302）像後台 user menu。
- WHY IT MATTERS：HUD 是玩家盯最久的元素，決定第一印象；純數字條無法傳達「人生在成長」。
- DIRECTION：職業頭像換角色插畫；幸福條加脈動/蜂蜜滴落質感；現金變動 count-up 滾動。

### 財務報表（FinancialStatement.tsx，754 行）
- CURRENT：摺疊式資產負債表，NumericalValue（:44-72）有漲跌 flash。
- PROBLEM：全 App 最像會計後台的畫面；資產（不動產/企業/股票）只有文字列，零視覺化。
- WHY IT MATTERS：財商教具可以工整，但資產是情感投資——一間房子只是一行字時「擁有感」為零。
- DIRECTION：保留表格嚴謹性，資產列加小型插畫 icon，新增資產時該列 slide-in + glow。

### 幸福值面板（HappinessPanel.tsx:56-141）
- CURRENT：深色 checklist：checkbox + label + `+2`。
- PROBLEM：**最像待辦清單/後台表單的畫面**。勝利資源長得像 Jira 子任務（:79-137），勾選零慶祝。
- WHY IT MATTERS：主題是「幸福人生」，勾下一項幸福應該是最有情緒價值的瞬間，現在和勾「已回覆客戶信件」一樣。
- DIRECTION：改「幸福收藏冊」——每項是小卡/郵票/蜂巢格，達成時翻面點亮+粒子+心形飄升；總分改蜂巢逐格填滿。

### 棋盤投影（BoardProjectionView.tsx）
- CURRENT：**全 App 唯一暖色調畫面**：米色紙質桌面（:641）、7 種地格暖色主題（:27-115）、棋子 spring 動畫（:763-789）、移動浮條（:800-813）。
- PROBLEM：品質全案最高，但地格只有 lucide icon+文字（:750-754）無插畫；棋子是圓形頭像不是棋子；與手機端深色科技風**完全是兩個產品**。
- WHY IT MATTERS：投影幕是全桌共視的舞台，美術投資回報最高的表面。
- DIRECTION：以此暖色紙質風為全遊戲 Art Direction 基準；地格加等距小插畫；棋子加底座與落地 squash。

### 骰子
- CURRENT：兩套——Dock 3D 骰（GameActions.tsx:271-353，framer-motion 拋擲，佳）＋考試骰（DiceFace.tsx，動畫 class 全滅）。
- PROBLEM：Dock 骰是全 App 最好的 game feel；但 DiceFace 的 `animate-dice-roll` 死掉後，升職/企業升級的骰子只剩「數字每 80ms 亂跳」（DiceFace.tsx:17-19）。
- DIRECTION：修復 CSS 管線後統一兩套骰子；落地加微震。

### 卡片抽屜（BoardCardDrawer.tsx）
- CURRENT：底部抽屜+3D 翻牌（:94-100，700ms rotateY），三牌組漸層卡背（:17-36）。
- PROBLEM：翻牌結構對，但卡面純文字＋「請看大地圖」（:61-64）；卡背只有大字 label 無圖騰；翻牌無蓄力。
- WHY IT MATTERS：抽卡是桌遊心跳時刻；卡背是遊戲的品牌臉。
- DIRECTION：卡背加牌組專屬插畫圖騰；翻牌前 0.2s 抖動蓄力、翻完光暈爆點。

### 銀行（BankingAppModal.tsx）
- CURRENT：Tab 式 fintech modal（券商/銀行/財富/汽車）。
- PROBLEM：這裡「像銀行 App」反而是**優點**（擬真合理），無大問題。
- DIRECTION：保留，交易成功補音效與金額 fly-out。

### PaydayModal（PaydayModal.tsx:32-148）
- CURRENT：底部單卡：icon+金額大字+確認鈕。
- PROBLEM：「發薪日」是桌遊界招牌爽點（Cashflow 的 PAYDAY!），這裡只是靜態 `+$xxx`（:76-78），無滾動無錢幣無音效；標題還是英文 "Bank Action"（:43）。
- WHY IT MATTERS：Payday 是玩家最期待的正回饋節點，最便宜的 juice 投資點。
- DIRECTION：金額 count-up + 金幣粒子 + 收銀機音；負結餘用暗紅收縮+低沉音。

### 企業升級（BizUpgradeModal.tsx）
- CURRENT：兩段擲骰流程清楚，成敗有文案變色（:115-136）。
- PROBLEM：骰子動畫已死（P0）；成功只有死掉的 zoom-in+文字；成敗畫面重量幾乎相同。
- DIRECTION：修骰子；成功時「工作室→企業大樓」變形過場+收入數字彈跳。

### 遊戲結束（ScoreView.tsx）
- CURRENT：積分 checklist+總分卡+上傳按鈕；成就 toast 隊列（:345-363）。
- PROBLEM：**終幕是一張結算報表**：無排名揭曉、無勝者聚光、總分直接印出（:460-462）不滾動。
- WHY IT MATTERS：多人桌遊的結局是社交高潮——「誰贏了」的揭曉順序就是戲劇本身；現在等於電影直接播工作人員名單。
- DIRECTION：podium 流程：分項打字機式累加→總分滾動→排名倒序揭曉→冠軍聚光+彩帶。

## 「像後台不像遊戲」排名

1. 幸福值面板（HappinessPanel）— 待辦清單
2. 財務報表（FinancialStatement）— 會計後台（但可保留工整，加擁有感即可）
3. 遊戲結束（ScoreView）— 結算報表
4. 玩家設定選單（GameHeader dropdown）— 後台 user menu
5. 房間玩家清單 modal — 管理系統成員列表

## 評分

| 維度 | 完成度 | 理由 |
|---|---:|---|
| UI | 68% | 工整可用的 fintech dashboard 等級，但 design token/按鈕層級/z-index/中文字體缺失，像後台不像遊戲 |

# Profession System RFC

> 文件定位：職業系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/*.md`、`docs/rfc/*.md`，以及目前 `線上模式0611` 工作樹中的實作。
>
> 本文件只整理目前程式真正存在的職業、升等、薪資、職級、Promotion、Income、Expense、Career 與 `Profession Data`，不自行設計新玩法。

## Current Implementation

### 職業

- `src/constants.ts` 內的 `PROFESSIONS` 是目前職業資料的主要來源。
- `src/types.ts` 的 `Profession` 介面包含：
  - `id`
  - `title`
  - `initialRank`
  - `salary`
  - `savings`
  - `expenses`
  - `mortgageTotal`
  - `businessLoanTotal`
  - `creditLoanTotal`
  - `promotions`
- 目前共有 10 組職業資料，都是由 `SelectionView` 顯示並可供玩家選擇。
- `src/App.tsx` 的 `handleSelectionComplete()` 會把選到的職業物件直接放入 `GameState.profession`，並初始化：
  - `currentRankTitle = profession.initialRank`
  - `currentRankLevel = 1`
  - `cash = profession.savings`
  - `income = {}`
  - `expenses = {}`
  - `abilities = { stockAbilityCount: 0, realEstateAbilityCount: 0, professionAbilityCount: 0 }`

### 升等

- 目前升等的核心欄位是 `GameState.currentRankLevel` 與 `GameState.currentRankTitle`。
- `src/constants.ts` 的 `createPromotions()` 會為每個職業建立 4 級升等資料：
  - `rankTitle`
  - `condition`
  - `bonus`
- `src/hooks/useDiceRollLogic.ts` 會依 `promotionType` 決定骰子門檻：
  - `normal`：目標值是 `currentRankLevel + 1`
  - `enhance_profession` / `lifelong`：目標值是 2
  - `stock_ability` / `real_estate_ability`：目標值是 4
- `src/hooks/useGameLogic.ts` 的 `applyExamResult()` 在成功時會同時更新：
  - `profession.salary`
  - `currentRankLevel`
  - `currentRankTitle`
  - `history`
- `src/hooks/useGameLogic.ts` 的 `applyLifelongLearningEffect()` 在 `learningType === 'enhance_profession'` 成功時，也會更新：
  - `abilities.professionAbilityCount`
  - `currentRankLevel`
  - `currentRankTitle`
  - `profession.salary`
- `src/views/game/GameView.tsx` 的 `handlePromotionConfirm()` 會先扣除 1,000 報名費，再進入骰子流程。

### Salary

- 目前薪資的核心來源是 `GameState.profession.salary`。
- `src/utils/gameUtils.ts` 的 `calculateFinancialSummary()` 直接把 `profession.salary` 納入 `totalIncome`。
- `src/views/lobby/CoachGameView.tsx` 與 `src/views/history/CoachHistoryView.tsx` 在還原歷史資料時，會使用 `profession.salary` 或從 `income.salary` 補回薪資資訊。
- `src/hooks/useGameLogic.ts` 在升等成功時，會把 `bonus` 加到 `profession.salary`。
- `src/hooks/useGameLogic.ts` 在終身學習的 `enhance_profession` 成功時，也會把新的薪資寫回 `profession.salary`。

### Rank

- 目前職級是由 `currentRankLevel` 與 `currentRankTitle` 共同表示。
- `currentRankLevel` 在財務摘要中也會影響支出：
  - `calculateFinancialSummary()` 會計算 `rankExpenseBonus = (currentRankLevel - 1) * 10000`
- `currentRankTitle` 主要用於畫面顯示、結算紀錄與還原。
- `profession.promotions[currentRankLevel - 1]` 會被當作下一級升等的對應資料。

### Promotion

- `src/hooks/useDiceRollLogic.ts` 的 `PromotionType` 包含：
  - `normal`
  - `lifelong`
  - `enhance_profession`
  - `stock_ability`
  - `real_estate_ability`
- `src/views/game/GameView.tsx` 會用同一套骰子 UI 處理一般升等與終身學習。
- `src/context/RoomContext.tsx` 的 `PendingRequest.type` 也已預留：
  - `promotion`
  - `lifelong`
- 目前 inspected code 中，`handlePromotionConfirm()` 與 `handleLifelongConfirm()` 都是直接扣報名費，不是經過另一套職業資料流程。

### Income

- `src/utils/gameUtils.ts` 的 `calculateFinancialSummary()` 目前把收入拆成三部分：
  - `profession.salary`
  - `passiveIncome`
  - `dynamicIncome`
- `dynamicIncome` 來自 `GameState.income`，但會排除 `salary` 欄位。
- `passiveIncome` 會從資產的 `cashflow` 計算，且不動產能力加成會額外增加被動收入。
- `src/hooks/useGameLogic.ts` 在完成事業成就 `h_career` 時，會依 `selectedEnterprise` 與 `currentRankLevel` 計算企業收入加成，並寫入 `income[e.name]`。

### Expense

- `src/constants.ts` 內每個職業都帶有預設支出：
  - `tax`
  - `basicLiving`
  - `transportEdu`
  - `otherMedicalChild`
- `src/utils/gameUtils.ts` 的 `calculateFinancialSummary()` 會把職業預設支出與 `GameState.expenses` 的動態增減合併。
- `calculateFinancialSummary()` 也會加上：
  - 所得稅
  - 職級加成支出
  - 保險費
  - 各類貸款利息
- `src/hooks/useGameLogic.ts` 的 `expense_update` 與 `happiness_event` 會直接調整 `GameState.expenses`。

### Career

- 目前 `Career` 在程式裡主要對應到 `h_career` 這個幸福項目。
- `src/utils/gameUtils.ts` 的初始幸福清單會建立 `h_career`，內容綁定玩家選到的企業。
- `src/hooks/useGameLogic.ts` 在 `data.name.includes('達成事業成就')` 時，會把 `h_career` 勾選起來。
- 同一段邏輯也會依 `selectedEnterprise.relatedProfessionId` 與 `currentRankLevel` 計算企業收入加成。
- `src/views/achievements/AchievementsView.tsx` 與 `src/views/lobby/LobbyView.tsx` 都用 `h_career`、`currentRankLevel`、`profession` 來做成就判定。

### Profession Data

- `src/types.ts` 的 `Profession` 是目前職業資料的正式型別。
- `src/constants.ts` 的 `PROFESSIONS` 是主要靜態資料來源。
- `src/views/lobby/CoachGameView.tsx` 會在結算與歷史還原時保留 `professionData: state.profession`。
- `src/types.ts` 的 `GameRecord.professionData` 也已預留完整職業物件。
- `src/views/history/CoachHistoryView.tsx` 會優先使用 `professionData` 還原職業資訊，沒有時再從 `profession` 與 `income.salary` 補回。

## Problem

- `docs/gdd/Turn System.md`、`docs/gdd/Board System.md`、`docs/gdd/Card System.md` 與 `docs/gdd/Financial System.md` 都要求正式事件、財務檢核與回合切換有單一生命週期；目前職業升等流程卻是由 `GameView.tsx` 與 `useGameLogic.ts` 直接扣報名費、直接改 `profession.salary`、直接改 `currentRankLevel/currentRankTitle`，沒有獨立的職業事件佇列。
- `docs/gdd/Financial System.md` 要求正式交易必須經過 `Financial Check`；目前 `handlePromotionConfirm()` 與 `applyExamResult()` 都是直接改 state，`promotion` / `lifelong` 只在 UI 與 `history` 中留下交易記錄，沒有看到一個獨立且一致的職業財務流程。
- `docs/gdd/Card System.md` 與 `docs/gdd/Board System.md` 對 `Exam Happiness`、`Follow-up Card`、`Queue -> Current -> Complete` 有正式生命週期要求；目前職業升等與終身學習只是共用 `DiceRollModal` 與本地流程，並沒有被建模成正式共享事件。
- `GameState.profession.salary`、`GameState.income.salary`、`currentRankTitle`、`currentRankLevel` 同時存在，但角色不同；目前程式以 `profession.salary` 為計算來源，`income.salary` 則在歷史還原與部分畫面中補用，這讓薪資資料的正式權威不夠單一。
- `currentRankLevel` 同時影響薪資、支出加成與企業收入加成，但這些關係分散在 `calculateFinancialSummary()`、`applyExamResult()`、`applyLifelongLearningEffect()` 與 `h_career` 相關流程中，沒有集中定義。
- `PendingRequest.type` 已預留 `promotion` 與 `lifelong`，但 inspected code 中沒有看到另一套完整的職業審核或職業申請狀態機；這使得 `Promotion` 在程式裡同時像是 UI 動作、審核請求與升等結果，語意混在一起。

## Option A（維持目前）

### 說明

維持現有寫法，把職業系統視為：

- `PROFESSIONS` 提供開局資料
- `profession` 保存目前選到的職業
- `currentRankLevel/currentRankTitle` 表示當前職級
- `profession.salary` 表示可計算的薪資
- `income` 只承載額外動態收入
- `expenses` 只承載動態支出調整

### 優點

- 完全符合目前程式結構。
- 不需要重整現有的選職、升等、財務與歷史還原流程。
- `professionData`、`GameState` 與結算紀錄的既有資料都能沿用。

### 缺點

- `salary`、`rank`、`promotion`、`income`、`expense` 的邊界會持續分散在多個檔案。
- `profession.salary` 與 `income.salary` 的關係仍需要依情境理解。
- `promotion` 與 `lifelong` 在文件上會持續依賴上下文才看得出差異。

## Option B（推薦）

### 說明

把目前程式中的職業系統正式化成單一文件語言，並明確採用下列對應：

- `Profession` = 開局與還原用的職業資料
- `profession` = 玩家目前選擇的職業 snapshot
- `currentRankLevel/currentRankTitle` = 玩家目前職級
- `profession.salary` = 正式薪資來源
- `income` = 額外動態收入
- `expenses` = 職業預設支出 + 動態支出調整
- `promotion` / `lifelong` = 兩種不同的升等入口

### 優點

- 與目前程式最接近，不需要發明新玩法。
- 可以把職業、升等、薪資、支出、Career 與還原資料放進同一套語言。
- 後續若要對齊正式 GDD，會比較容易判斷哪些是資料定義、哪些是事件流程。

### 缺點

- 必須接受目前程式的直接 state mutation 作為現況。
- `income.salary` 仍只能視為相容與還原欄位，不會成為正式主來源。

## Recommendation

建議採 `Option B`。

理由是目前程式已經有完整的職業資料、職級狀態、升等骰、薪資變動、支出計算、Career 幸福項目與歷史還原欄位；現在最需要的是把這些既有行為對齊成一套一致的職業語言，而不是再維持多個彼此重疊的說法。

## Decision Required

□ A

□ B

請確認以下定義：

- `profession.salary` 是否是正式薪資來源。
- `income.salary` 是否只保留作為相容/還原欄位。
- `promotion` 是否只指一般升等考試，`lifelong` 是否應視為另一種獨立入口。
- `currentRankLevel` 與 `currentRankTitle` 是否都屬於正式職級狀態。
- `GameRecord.professionData` 是否必須保留完整職業物件以供歷史還原。

## Need Confirmation

1. `Career` 在正式文件中是否只代表 `h_career` 與企業收入加成，還是要包含更多職業衍生狀態。
2. `rankExpenseBonus` 是否應正式記錄為職級支出的一部分，或只屬財務摘要的計算結果。
3. `profession.promotions` 的 `condition` 欄位是否要成為正式規格的一部分，或只保留為顯示文字。
4. `professionData` 是否要在所有結算與歷史還原畫面中都視為優先資料來源。

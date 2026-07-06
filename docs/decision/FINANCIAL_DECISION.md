# Metadata

Status: Confirmed

Owner: 汪家慶

Last Updated: 2026-07-01

# Purpose

把與 Financial Check、交易成立點、現金、負債、股價權威、勝利條件相關的 Gap，整理成需要產品負責人拍板的決策項目。

# Related Gaps

- GAP-005
- GAP-008
- GAP-009
- GAP-013
- GAP-014

# Decision Items

## DEC-001：Financial Check 是否是所有正式交易的成立門檻

Decision ID: DEC-001

Related Gap:
- GAP-005

Related RFC:
- `FINANCIAL_SYSTEM_RFC.md`
- `BANK_SYSTEM_RFC.md`
- `BOARD_SYSTEM_RFC.md`
- `CARD_SYSTEM_RFC.md`

Related GDD:
- `FINANCIAL_SYSTEM.md`
- `BANK_SYSTEM.md`
- `ASSET_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 所有正式交易都被要求經過 Financial Check。
- Current GDD: `FINANCIAL_SYSTEM.md` 已明確要求所有正式交易都必須完成 Financial Check 後才正式成立。
- Current Implementation: 不同交易入口的 apply 點仍分散在 `useGameLogic.handleTransactionSubmit()`、Board modal `onApply` 與部分直接 state mutation 流程中。

Options:
- Option A
  - 優點: 保持目前各入口各自完成。
  - 缺點: 成立點不一致。
- Option B
  - 優點: 以 Financial Check 作為正式成立點。
  - 缺點: 需要把各入口都對齊。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-002：正式負債權威是否只使用 liabilities

Decision ID: DEC-002

Related Gap:
- GAP-008

Related RFC:
- `LOAN_SYSTEM_RFC.md`
- `FINANCIAL_SYSTEM_RFC.md`
- `ASSET_SYSTEM_RFC.md`

Related GDD:
- `FINANCIAL_SYSTEM.md`
- `BANK_SYSTEM.md`
- `ASSET_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: `liabilities` 與 `loans` 的正式 / legacy 邊界已經被反覆討論。
- Current GDD: `FINANCIAL_SYSTEM.md` 已把 `liabilities` 定為唯一正式負債來源，`loans` 只保留 legacy 相容用途。
- Current Implementation: `calculateFinancialSummary()` 仍同時計入 `liabilities` 與 `gameState.loans`。

Options:
- Option A
  - 優點: 維持雙軌相容。
  - 缺點: 正式權威不清楚。
- Option B
  - 優點: 只承認 `liabilities`。
  - 缺點: 需要清理 legacy 讀取點。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-003：股票價格正式權威是否只使用 room.marketPrices

Decision ID: DEC-003

Related Gap:
- GAP-009

Related RFC:
- `MARKET_SYSTEM_RFC.md`
- `BANK_SYSTEM_RFC.md`
- `ASSET_SYSTEM_RFC.md`

Related GDD:
- `BANK_SYSTEM.md`
- `ASSET_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 市場價格的正式來源與同步副本仍在被比較。
- Current GDD: `BANK_SYSTEM.md` 與 `ASSET_SYSTEM.md` 已把 `room.marketPrices` 定義為唯一正式權威。
- Current Implementation: 仍有 `gameState.marketPrices`、`room.marketPrices`、`gameState.previousMarketPrices` 並存，且 `BankingAppModal` 會再套用新聞卡價格覆蓋。

Options:
- Option A
  - 優點: 保留多份價格副本。
  - 缺點: 正式權威混亂。
- Option B
  - 優點: 只承認 `room.marketPrices`。
  - 缺點: 需要同步所有顯示與估值來源。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-004：正式區分人生里程碑與遊戲勝利條件

Decision ID: DEC-004

Related Gap:
- GAP-013
- GAP-014

Related RFC:
- `DREAM_SYSTEM_RFC.md`
- `HAPPINESS_SYSTEM_RFC.md`
- `FAMILY_SYSTEM_RFC.md`
- `FINANCIAL_SYSTEM_RFC.md`

Related GDD:
- `FINANCIAL_SYSTEM.md`
- `BOARD_SYSTEM.md`
- `CARD_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: Dream、Happiness、Family 與財務自由目前存在多種勝利語意。
- Current GDD: `BOARD_SYSTEM.md` 目前仍以 `Happiness >= 100` 作為棋盤勝利條件，`FINANCIAL_SYSTEM.md` 與結算流程則仍保留 `passiveIncome > Total Expenses` 的勝利語意。
- Current Implementation: `GameView` 以 `happinessTotal >= 100` 觸發勝利動畫，結算與 score 邏輯又以 `passiveIncome > totalExpenses` 表示 `isWin`。
- Product Decision: 正式規格區分「人生里程碑」與「遊戲結束條件」。幸福值 100、財務自由與完成人生夢想皆屬人生里程碑，不會直接結束遊戲；遊戲依照時間或主持人宣布結束，最終以幸福值最高者獲勝。

Options:
- Option A
  - 優點: 保持 Happiness、財務自由與遊戲結束三種語意並存。
  - 缺點: 勝利判定會持續混淆。
- Option B（採用）
  - 優點: 將人生里程碑與遊戲結束條件分離，幸福值 100、財務自由與完成人生夢想都可以保留意義，但不會提前中止遊戲。
  - 缺點: 需要後續 GDD 與程式把勝利動畫、結算紀錄與分數排名重新對齊。

Recommendation:
採用 Option B。

正式規格如下：
- `Happiness >= 100` 為人生里程碑，不會結束遊戲。
- `Passive Income > Total Expenses` 為財務里程碑，不會結束遊戲。
- 完成人生夢想屬於人生里程碑，不會結束遊戲。
- 遊戲依照預設時間結束，或由主持人 / 執行師宣布結束。
- 遊戲結束後，以幸福值最高者作為勝利者。
- 若幸福值相同，平手規則需由後續 GDD 補充。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

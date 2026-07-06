# Bank System RFC

> 文件定位：銀行系統討論稿，不是正式 GDD。
>
> 分析基準：`docs/PROJECT_OVERVIEW.md`、`docs/STATE_INVENTORY.md`、`docs/STATE_MACHINE.md`、`docs/gdd/TURN_SYSTEM.md` 與目前 `線上版0618` 程式。
>
> 本文件只整理目前程式真正存在的銀行相關規則、實作衝突與待決策項目，不直接決定最終規格。

## 1. Bank Event（銀行事件）

### Current Implementation

目前棋盤模式中，玩家經過銀行時會：

- 於移動結算中建立 `bank` 事件
- 將玩家 `bankServiceWindowActive` 設為 `true`
- 自動打開 `PaydayModal`
- 先處理月結餘，再進入 follow-up
- follow-up 只提供三種路徑：
  - 開保險交易
  - 開定存交易
  - 略過並 `advanceBoardEventQueue('bank')`

現況對應來源：

- `STATE_MACHINE` 第 5 節
- `RoomContext.buildBoardMovementResolution()`
- `GameView.tsx` 內 `showPaydayModal` / `paydayStep`

### Problem

- 銀行事件與銀行服務窗口不是同一件事，但目前被綁在一起。
- 銀行事件關閉後，窗口仍可能保持開啟。
- 事件 follow-up 只涵蓋保險與定存，不涵蓋股票、貸款、汽車。
- 程式中存在 `pendingRequests.type = payday`，但主流程沒有走 request approval。

### Option A（維持現況）

說明：

保留目前 `Payday Confirm -> Bank Follow-up -> Insurance/Deposit/Skip` 的事件流。

優點：

- 與現況最一致。
- 不需要先拆分 bank event 與 bank window。

缺點：

- 事件邊界不清楚。
- 與金融功能權限容易混淆。
- 之後文件化會持續依賴例外說明。

適合什麼情境。

短期只需要忠實描述現況，不急著統一銀行規則時。

### Option B（推薦）

說明：

保留現有事件內容，但在規格上明確拆成兩層：

- `Bank Event`：經過銀行後必處理的月結餘與 follow-up
- `Bank Service Window`：事件後仍可持續使用的窗口權限

優點：

- 最貼近現有程式的真實分層。
- 可以把事件流程與服務權限分開討論。
- 有助於釐清保險、定存、汽車的實際限制。

缺點：

- 文件會變得比較長。
- 需要接受目前實作本來就不是單一銀行狀態機。

適合什麼情境。

準備把銀行系統做成正式 GDD，但還不能直接重構程式時。

### Option C

說明：

把所有銀行相關操作都視為 `bank event` 的一部分，不再區分窗口。

優點：

- 文件最單純。
- 銀行流程看起來像單一事件。

缺點：

- 與目前程式不符。
- 無法解釋事件關閉後窗口仍存在的行為。

適合什麼情境。

只有在未來程式要大幅重寫銀行模組時才有意義。

### Recommendation

較建議採 `B`。這不是優化，而是目前程式確實同時存在 `bank event` 與 `bankServiceWindowActive` 兩層機制，RFC 應先如實拆開。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- `bank` 事件是否只在「經過銀行」建立，還是「停留銀行」也保證建立，目前需依棋盤格路徑與 `moveCurrentPlayerToSquare('bank')` 進一步確認。
- `payday` request type 是否為已廢棄流程，目前主遊戲找不到呼叫端。

## 2. Payday（月結餘）

### Current Implementation

目前月結餘由 `executePayday(flow)` 直接在玩家端套用，不經 request approval。

已確認行為：

- `PaydayModal` 先顯示 `confirm`
- 玩家確認後，`executePayday` 套用 `monthlyCashflow`
- 若月現金流為正，系統會優先自動償還：
  - `強制負債`
  - `信用貸款`
- 套用後進入 `followup`
- `followup` 可開保險、定存，或略過

相關來源：

- `STATE_MACHINE` Banking State Machine
- `GameView.tsx`
- `useGameLogic.ts` 內 `executePayday`

### Problem

- 月結餘是否允許現金變負，現有文件無法確認。
- 自動還款只明確提到 `強制負債` 與 `信用貸款`，其他貸款是否自動還款沒有同等證據。
- `PaydayModal` 文案說「也可以稍後在財務報表中操作」，這代表保險/定存不必在事件當下完成，但事件本身又有 follow-up。

### Option A（維持現況）

說明：

保留「月結餘先直接套用，再由玩家選 follow-up」。

優點：

- 現況明確存在。
- 與 `PaydayModal`、`executePayday` 一致。

缺點：

- 自動還款規則只對部分負債明確。
- 負現金處理邊界不夠清楚。

適合什麼情境。

先忠實盤點實作，不先裁剪流程時。

### Option B（推薦）

說明：

把 `Payday` 在規格上拆成三段描述：

- 月現金流套用
- 自動還款
- follow-up 選擇

優點：

- 可以精確標記哪些步驟已被程式證實。
- 後續較容易釐清負現金與各貸款優先序。

缺點：

- 仍無法單靠目前程式文件確認所有自動還款細節。

適合什麼情境。

希望 RFC 先把 payday 當成可獨立審查的子系統時。

### Option C

說明：

將 `Payday` 視為單一步驟，不再拆內部規則。

優點：

- 文件最短。

缺點：

- 會掩蓋自動還款與 follow-up 的真實差異。

適合什麼情境。

不建議。

### Recommendation

較建議採 `B`。目前程式至少已證實 `executePayday` 不是單純加減現金，而是還包含自動還款與後續窗口流程。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- `monthlyCashflow < 0` 時，現金若不足，是否應進入強制負債，目前 `STATE_MACHINE` 已標示無法確認。
- 除 `強制負債` 與 `信用貸款` 外，其他貸款是否參與 payday 自動還款，目前無法確認。

## 3. Bank Service Window（銀行服務窗口）

### Current Implementation

目前窗口由玩家 `GameState` / `room.playerStates[uid]` 中的：

- `bankServiceWindowActive`
- `bankServiceGrantedAtEventId`

共同表達。

已確認行為：

- 玩家經過銀行時，窗口會被打開。
- 棋盤模式下，若窗口未開：
  - `wealth` 分頁不可用
  - 會被切回 `broker`
- 窗口開啟後：
  - 保險、定存、汽車可從 `WealthView` 操作
- `rollBoardDice()` 開始新回合擲骰前，若自己窗口還開著，會先清掉
- `buildBoardMovementResolution()` 切換到下一位時，也會清除「下一位玩家舊的窗口」

因此目前可確認的有效期限比較接近：

- 從經過銀行後開始
- 持續到該玩家下一次棋盤擲骰前

### Problem

- `STATE_MACHINE` 與 `TURN_SYSTEM GDD` 的窗口期限不同；但就程式現況來看，期限是「下一次擲骰前」，不是「下一回合開始前」。
- 窗口 state 是寫在玩家資料裡，不是獨立房間事件，造成事件結束後窗口仍能存在。
- 汽車和保險、定存共用同一個 `wealth` gate，但股票、貸款不受影響。

### Option A（維持現況）

說明：

維持 `bankServiceWindowActive` 僅控制 `wealth` 分頁。

優點：

- 與程式最一致。
- 權限模型簡單直接。

缺點：

- 有效期限並不是單純事件結束。
- 汽車被綁在窗口內，與其他金融功能分層不對稱。

適合什麼情境。

銀行窗口只被當成 UI gate 使用時。

### Option B（推薦）

說明：

在 RFC 中將窗口定義為「玩家級持續性權限旗標」，而不是單一事件步驟。

優點：

- 最符合目前 `bankServiceWindowActive` 真實用途。
- 可清楚解釋為何事件結束後仍可再進 `wealth`。

缺點：

- 會暴露目前實作與正式規格可能不一致。

適合什麼情境。

需要忠實盤點實作的 RFC。

### Option C

說明：

把窗口視為只在 `Payday follow-up` 存在。

優點：

- 容易理解。

缺點：

- 與程式不符。
- 無法解釋「稍後在財務報表中操作」與事件外仍可開 `wealth`。

適合什麼情境。

不建議。

### Recommendation

較建議採 `B`。目前窗口其實是玩家級權限 state，不是單純的 event modal。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- `bankServiceGrantedAtEventId` 是否有除了防重顯示 prompt 之外的其他邏輯用途，從目前文件無法完全確認。

## 4. Stock（股票）

### Current Implementation

股票由 `BrokerView` 與 `BankingAppModal` 的 `broker` 分頁處理。

已確認行為：

- 不要求銀行服務窗口
- 棋盤模式下即使 `wealth` 被鎖，`broker` 仍可用
- 可買、可賣
- 使用 `marketPrices` / `previousMarketPrices`
- 市價來源可能同時來自：
  - `room.marketPrices`
  - `gameState.marketPrices`
  - 目前新聞卡覆蓋價格
- 提交後進入財務檢核，再套用交易

### Problem

- 市價資料有三份來源，存在短暫或永久不一致風險。
- 股票交易不依賴銀行窗口，但仍放在「銀行 App」裡，概念上可能混淆。
- 買賣股票與市場行情同步不是同一個原子流程。

### Option A（維持現況）

說明：

保持股票為常駐功能，並透過 `broker` 分頁操作。

優點：

- 程式目前已穩定存在這套模式。
- 與 `STATE_MACHINE` 結論一致。

缺點：

- 行情同步風險仍在。
- UI 名稱容易讓人誤以為需要銀行窗口。

適合什麼情境。

把股票視為銀行 App 內的常駐頁籤時。

### Option B（推薦）

說明：

RFC 明確記錄：股票在實作上是常駐交易功能，但使用銀行 App 介面承載。

優點：

- 不會錯把 UI 容器當成權限規則。
- 可把「功能權限」與「介面位置」分開。

缺點：

- 需要額外說明市場價格來源衝突。

適合什麼情境。

要盤點功能權限而不是重做 IA 時。

### Option C

說明：

把股票重新視為銀行窗口服務。

優點：

- 規則會變得更整齊。

缺點：

- 與目前程式不符。

適合什麼情境。

只有未來要重寫銀行權限時。

### Recommendation

較建議採 `B`。目前可以被證實的是「股票常駐，但 UI 寄宿於銀行 App」。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- `BrokerView` 是否在房間 `finished` 狀態下仍完全可互動，需再逐條核對 modal disabled 傳遞鏈。

## 5. Fixed Deposit（定存）

### Current Implementation

定存有兩種不同入口：

- `WealthView`：辦理定存
- `useTransactionLogic`：賣出 / `定存解約`

已確認行為：

- 辦理定存在 `wealth` 分頁中
- 棋盤模式下需要 `bankServiceWindowActive`
- 非棋盤模式不要求窗口
- 辦理定存會：
  - 現金減少
  - 新增 `定存` 資產
  - 增加 `定存利息` 收入
- `定存解約` 走 sell/withdraw 流程
- `定存解約` 直接對現金與資產做結算

### Problem

- 「辦理」與「解約」使用不同入口，容易被誤認為是兩套規則。
- 目前文件可證明辦理需要窗口，但對解約是否需要窗口，程式顯示似乎不需要；兩者權限不對稱。
- 定存資產在 `FinancialStatement` 中又會被合併顯示成 `定存總額`。

### Option A（維持現況）

說明：

保留「辦理在 wealth、解約在 sell/withdraw」的雙入口。

優點：

- 與現況一致。
- 已有可用流程。

缺點：

- 規則學習成本高。
- 文件很難用單一句話描述定存。

適合什麼情境。

先接受現況分流，不先整合 UX 時。

### Option B（推薦）

說明：

RFC 明確拆開記錄：

- `Deposit Open`：辦理定存
- `Deposit Close`：定存解約

並分別標示當前權限來源。

優點：

- 最符合真實程式。
- 可以直接揭露權限不對稱。

缺點：

- 文件會比其他產品更細。

適合什麼情境。

需要釐清目前定存到底有哪些入口時。

### Option C

說明：

把辦理與解約都當成同一個銀行事件功能。

優點：

- 規則看起來更統一。

缺點：

- 與目前程式不符。

適合什麼情境。

不建議。

### Recommendation

較建議採 `B`。目前定存最真實的狀態就是「辦理」與「解約」不走同一條路。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- 非棋盤模式下，定存解約是否永遠可用，目前從 `useTransactionLogic` 可推定如此，但仍需整體 UI 呼叫鏈最終確認。

## 6. Insurance（保險）

### Current Implementation

保險購買在 `WealthView` 中實作，目前可確認的是醫療保險。

已確認行為：

- 棋盤模式下需 `bankServiceWindowActive`
- 非棋盤模式不要求窗口
- 目前按鈕文案為 `購買醫療險`
- 上限為 1 份
- 交易本身不直接扣現金，而是：
  - `cashChange: 0`
  - 增加 `保險支出` 月支出 2,000
- 財務檢核 entries 為：
  - `現金 Decrease`
  - `保險支出 Increase`

### Problem

- UI 顯示是「購買保險」，但實際影響是增加月支出，不是一次性現金支出。
- `cashChange: 0` 與財務檢核要求 `現金 Decrease` 之間存在表述落差。
- 文件證據主要集中在醫療保險；房屋保險、汽車保險更多出現在報表與理賠邏輯，而不是同一購買流程。

### Option A（維持現況）

說明：

保留保險作為 `wealth` 分頁產品，棋盤模式需窗口。

優點：

- 與現在購買流程一致。

缺點：

- 付款語義不直觀。
- 保險品類不完全對稱。

適合什麼情境。

只先盤點已存在購買流程時。

### Option B（推薦）

說明：

RFC 中把保險區分為：

- `Insurance Purchase Flow`
- `Insurance Accounting Effect`

優點：

- 可清楚描述它是買保單還是增月支出。
- 能避免把理賠邏輯和購買邏輯混在一起。

缺點：

- 需要額外說明目前實作只明確證明醫療保險。

適合什麼情境。

要把保險從「按鈕名稱」轉成「真正交易效果」來分析時。

### Option C

說明：

將所有保險統一視為單一產品類型。

優點：

- 文件較簡單。

缺點：

- 目前程式證據不足。

適合什麼情境。

不建議。

### Recommendation

較建議採 `B`。目前對保險最真實的觀察不是「有幾種保險」，而是「購買流程與會計效果存在落差」。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- 是否存在與醫療保險相同入口的房屋保險或汽車保險購買流程，目前從現有證據無法確認。
- `cashChange: 0` 但財務檢核要現金減少，最終以哪邊為權威，需進一步確認。

## 7. Loan（貸款）

### Current Implementation

貸款由 `BankingView` 的 `banking` 分頁處理。

已確認行為：

- 不要求銀行服務窗口
- 可借款與還款
- 借款目前只建立 `信用貸款`
- 還款目標包含：
  - `信用貸款`
  - `強制負債`
  - `不動產貸款`
  - `企業貸款`
  - `汽車貸款`
- `liabilities` 是主要來源
- 但 `GameState.loans` 與 legacy `bank_loan` 仍存在

### Problem

- 程式同時存在：
  - `loans`
  - `liabilities`
  - `bank_loan (Legacy)`
- 還款 UI 看起來以 `liabilities` 為主，但整體報表又仍讀 `loans`。
- `useTransactionLogic.ts` 內有大量關於 legacy loan 的註解，表示作者自己也知道這裡存在過渡狀態。

### Option A（維持現況）

說明：

接受貸款目前是新舊資料雙軌並存。

優點：

- 與現在資料相容。

缺點：

- 很難定義唯一權威。
- 還款與報表可能讀不同欄位。

適合什麼情境。

正在做資料遷移期間。

### Option B（推薦）

說明：

RFC 中明確把貸款標記為「雙軌狀態」：

- `Loan UI Flow`
- `Loan Data Authority Conflict`

優點：

- 能如實反映目前風險。
- 不會在 RFC 階段假裝只有一套貸款系統。

缺點：

- 文件會暴露出資料模型未收斂。

適合什麼情境。

需要先決定未來要以哪套欄位為準之前。

### Option C

說明：

直接把 `liabilities` 視為唯一權威。

優點：

- 文件更乾淨。

缺點：

- 目前證據不足。
- 與報表和舊存檔相容性可能衝突。

適合什麼情境。

只有產品已明確決定要放棄 legacy 資料時。

### Recommendation

較建議採 `B`。貸款是目前銀行系統最明確存在資料權威衝突的地方，不應在 RFC 直接假定已解決。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- `GameState.loans` 是否仍是正式執行中的規則欄位，或只是舊資料相容殘留，目前無法確認。
- 借款時新增到 `liabilities` 與報表時讀 `loans` 的混用，哪一邊才是未來正式方向，需確認。

## 8. Vehicle（汽車）

### Current Implementation

汽車購買目前在 `WealthView` 的 `car` 分頁中。

已確認行為：

- 與保險、定存共用 `wealth` 分頁
- 棋盤模式下需 `bankServiceWindowActive`
- 非棋盤模式下不要求窗口
- 價格為 600,000
- 最低自備款為 20%
- 不足部分自動轉為 `汽車貸款`
- 已持有汽車時不可重複購買
- 買入後對棋盤效果的描述是「增加一顆骰子」

### Problem

- 汽車在權限上被歸到 `wealth`，但在遊戲效果上又直接影響棋盤擲骰。
- `rollBoardDice()` 目前不是「可選 1 或 2 顆」，而是有車就固定 2 顆。
- 汽車邏輯仍需相容舊的 `飛行器` 名稱。

### Option A（維持現況）

說明：

保留汽車是 `wealth` 產品、棋盤模式需窗口。

優點：

- 與現況一致。

缺點：

- 權限與棋盤效果耦合。
- 舊命名相容造成文件複雜。

適合什麼情境。

先忠實描述產品現況時。

### Option B（推薦）

說明：

RFC 中將汽車拆成兩個面向分析：

- `Vehicle Purchase Permission`
- `Vehicle Board Effect`

優點：

- 可清楚指出購買權限和棋盤效果不是同一件事。
- 能直接標示目前與 `TURN_SYSTEM GDD` 的衝突。

缺點：

- 需要跨引用 turn system 差異。

適合什麼情境。

後續要把銀行 RFC 與 Turn GDD 對齊時。

### Option C

說明：

把汽車直接納入貸款系統或純棋盤系統，不再當銀行產品。

優點：

- 介面分類更清楚。

缺點：

- 與目前 UI 不符。

適合什麼情境。

只有未來重做 banking IA 時。

### Recommendation

較建議採 `B`。目前汽車最關鍵的不是價格，而是它同時牽涉權限、貸款、資產與擲骰規則。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- 汽車保險是否存在與醫療保險平行的購買入口，目前無法確認。

## 9. Financial Check（財務檢核）

### Current Implementation

銀行相關交易最後都會走財務檢核，但來源不同：

- `BrokerView`：股票買賣
- `BankingView`：借款 / 還款
- `WealthView`：保險 / 定存 / 汽車
- `GameView`：棋盤銀行 follow-up 會開 quick transaction，再回到 bank follow-up

已確認行為：

- 交易資料會先被組成 `TransactionData`
- `BankingAppModal` 會補 `financialCheckEntries`
- `useTransactionLogic` 再進入對應確認流程
- 銀行事件中的財務檢核完成後，會回到 `Bank Follow-up`

### Problem

- 相同「銀行交易」其實來自四個不同入口。
- 保險的 `cashChange` 與 `financialCheckEntries` 表述不一致。
- 棋盤事件中的 board financial action 與一般 BankingApp 財務檢核不是完全同一條流程。

### Option A（維持現況）

說明：

接受財務檢核是共用層，但入口分散。

優點：

- 忠實對應現有程式。

缺點：

- 文件與測試案例會比較碎。

適合什麼情境。

先盤點架構而不先整併流程時。

### Option B（推薦）

說明：

RFC 中把財務檢核定義成「銀行系統共用結算層」，並列出所有入口。

優點：

- 可把差異收斂到同一節討論。
- 便於之後做 GDD 或實作修正。

缺點：

- 必須額外標記哪些入口會回到 bank follow-up、哪些不會。

適合什麼情境。

需要理解銀行系統內哪些功能共享同一套結算基礎時。

### Option C

說明：

把所有財務檢核都視為完全相同流程。

優點：

- 文件更簡單。

缺點：

- 與目前實作差異過大。

適合什麼情境。

不建議。

### Recommendation

較建議採 `B`。目前最準確的說法是「銀行功能共享財務檢核概念，但不共享完全相同的流程上下文」。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- Board financial flow 與一般 TransactionForm flow 是否可視為同一層狀態機，目前需更細核對。

## 10. Banking Permissions（各功能操作權限）

### Current Implementation

目前可確認的權限矩陣如下：

| 功能 | 棋盤模式需銀行窗口 | 非棋盤模式需銀行窗口 | 目前 UI 位置 |
|---|---|---|---|
| 股票 | 否 | 否 | `broker` |
| 貸款 | 否 | 否 | `banking` |
| 保險 | 是 | 否 | `wealth` |
| 定存辦理 | 是 | 否 | `wealth` |
| 定存解約 | 目前看起來否 | 否 | sell/withdraw |
| 汽車 | 是 | 否 | `wealth` |

### Problem

- 權限是依 `tab` 分組，不是依產品本質分組。
- 定存辦理與解約分屬不同權限。
- 汽車在棋盤模式下和保險、定存一起被 gate。
- `TURN_SYSTEM GDD` 已有正式規格，但目前程式與其不同；RFC 不能直接把 GDD 當現況。

### Option A（維持現況）

說明：

直接接受目前權限矩陣。

優點：

- 最真實。

缺點：

- 規則不對稱。

適合什麼情境。

本 RFC 的現況盤點用途。

### Option B（推薦）

說明：

RFC 額外明確區分兩種權限來源：

- `Window-gated`
- `Always-available`

優點：

- 可以快速看出哪些功能受 `bankServiceWindowActive` 控制。

缺點：

- 汽車與定存解約仍會顯得特別。

適合什麼情境。

要為後續規格決策做準備時。

### Option C

說明：

以 `TURN_SYSTEM GDD` 權限為準，回頭解釋現況。

優點：

- 便於直接進 GDD。

缺點：

- 不符合本 RFC 目的。

適合什麼情境。

不適用於本文件。

### Recommendation

較建議採 `B`。RFC 階段最重要的是把現況矩陣講清楚，而不是先套入未來規格。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- 定存解約在所有入口下是否都不受窗口限制，仍需最終確認 UI 呼叫鏈。

## 11. Multiplayer Behavior（多人同步）

### Current Implementation

目前銀行系統的多人同步特徵如下：

- 玩家自身財務狀態寫入 `room.playerStates.{uid}`
- 窗口權限 `bankServiceWindowActive` 也寫在該玩家 state
- 棋盤銀行事件寫在 `room.boardState.currentEvent / pendingEvents`
- 股票行情寫在：
  - `room.marketPrices`
  - `room.previousMarketPrices`
  - 每位玩家 `gameState.marketPrices`
- 所有同步都依賴 Firestore `onSnapshot`

### Problem

- 玩家財務、銀行窗口、棋盤事件、股價是分散同步，不是單一 transaction。
- `rooms/{roomId}` 允許任何已登入使用者 update，資料層防護薄弱。
- 市價與玩家資產不是原子更新，可能出現不同步。
- 棋盤銀行事件與玩家在非自己回合操作股票/貸款會同時存在，增加狀態交錯。

### Option A（維持現況）

說明：

維持以 Firestore 文件欄位組合表達銀行狀態。

優點：

- 與現在架構一致。

缺點：

- 同步邊界分散。
- 多人同時操作覆寫風險高。

適合什麼情境。

短期維持目前多人架構。

### Option B（推薦）

說明：

RFC 中將多人同步拆成四層看：

- 玩家資產負債同步
- 銀行窗口同步
- 棋盤銀行事件同步
- 股價同步

優點：

- 可精確標示哪一層容易衝突。
- 避免把「銀行系統同步」誤以為只有一個 state。

缺點：

- 文件比較技術性。

適合什麼情境。

要為之後的同步風險評估做準備時。

### Option C

說明：

將銀行多人同步簡化為「玩家各自同步自己的財務」。

優點：

- 文件短。

缺點：

- 無法解釋股價與棋盤銀行事件。

適合什麼情境。

不建議。

### Recommendation

較建議採 `B`。目前銀行系統不是單一多人 state，而是四層同步混合。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- 是否存在多位玩家同時交易股票時的最後寫入覆蓋實例，目前文件能推導風險，但沒有現成案例紀錄。

## 12. Edge Cases（特殊情況）

### Current Implementation

目前可直接確認的特殊情況包括：

- 銀行事件關閉後，窗口可能仍開著
- 非自己回合仍可交易股票與貸款
- 棋盤模式無窗口時，`wealth` 分頁會被鎖
- 有負現金流時，payday 是否進強制負債不明
- 貸款資料同時存在 `loans` 與 `liabilities`
- 汽車需相容舊名稱 `飛行器`

### Problem

- 這些 edge cases 不是局部 bug，而是整個銀行系統規則邊界的主要來源。

### Option A（維持現況）

說明：

RFC 全部照現況列出，不先收斂。

優點：

- 最保真。

缺點：

- 讀者會感受到規則分散。

適合什麼情境。

現況審查。

### Option B（推薦）

說明：

把 edge cases 分成四類：

- 權限例外
- 狀態期限例外
- 資料權威例外
- 同步例外

優點：

- 比較容易轉成後續決策項目。

缺點：

- 需要整理分類。

適合什麼情境。

準備讓產品逐項決策時。

### Option C

說明：

只列最嚴重的 2-3 個例外。

優點：

- 文件最短。

缺點：

- 容易漏掉真正造成規則歧義的邊界。

適合什麼情境。

不建議。

### Recommendation

較建議採 `B`。銀行系統目前的複雜度主要就來自例外分類。

### Decision Required

□ A

□ B

□ C

### Need Confirmation

- 醫療保險上限是否永遠為 1，還是只是目前 UI 限制，需確認資料層是否也有相同約束。

## 13. Current Implementation（目前程式如何運作）

目前程式中的銀行系統可總結為：

1. 銀行事件只在棋盤模式經過銀行時出現。
2. 銀行事件先處理 payday，再提供保險 / 定存 follow-up。
3. `bankServiceWindowActive` 是玩家級權限旗標，用來控制 `wealth` 分頁。
4. 股票與貸款不受銀行窗口限制。
5. 汽車在現況中與保險、定存同屬 `wealth` gate。
6. 定存辦理與定存解約走不同入口。
7. 保險購買目前明確證據集中在醫療保險。
8. 貸款資料存在 `loans` / `liabilities` 雙軌。
9. 股價存在房間級與玩家級雙副本。
10. 財務檢核是共用結算層，但入口分散。

## 14. Problem（目前規則問題）

目前銀行系統的核心問題如下：

- `Bank Event` 與 `Bank Service Window` 沒有被正式拆開。
- `wealth` gate 同時綁住保險、定存、汽車，產品本質不一致。
- 定存辦理與解約規則不對稱。
- 貸款資料模型雙軌並存，唯一權威不明。
- 保險購買效果與交易表述不完全一致。
- 股價同步不是單一權威來源。
- 棋盤銀行事件與常駐金融操作可同時存在，增加同步與權限複雜度。

## 15. Option A（維持現況）

說明：

RFC 完全以現況規則建模，不嘗試做額外抽象或整併。

優點：

- 最忠實於原始碼。
- 不會提前做設計決策。

缺點：

- 文件會保留大量不對稱與雙軌邏輯。
- 不利於直接轉成正式 GDD。

適合什麼情境。

先做現況盤點與衝突審查。

## 16. Option B（推薦方案）

說明：

RFC 仍以現況為基礎，但在文件層面做最小必要拆分：

- 拆開 `Bank Event` 與 `Bank Service Window`
- 拆開 `Deposit Open` 與 `Deposit Close`
- 拆開 `Loan UI Flow` 與 `Loan Data Authority`
- 拆開 `Vehicle Permission` 與 `Vehicle Dice Effect`
- 拆開 `Market UI` 與 `Market Price Authority`

優點：

- 不改規則，只提高可讀性。
- 能讓產品負責人逐項決策。
- 適合作為下一步 GDD 的前置文件。

缺點：

- 文件比純現況描述更長。

適合什麼情境。

希望在不修改程式的前提下，把銀行系統收斂成可決策的 RFC。

## 17. Option C（若適用）

說明：

直接以已批准的 `TURN_SYSTEM GDD` 銀行規格回推銀行 RFC。

優點：

- 可快速和正式規格對齊。

缺點：

- 會失去本 RFC 的主要目的。
- 會把「應該怎樣」誤寫成「現在怎樣」。

適合什麼情境。

不適用於本文件。

## 18. Recommendation

較建議採全局 `Option B`。

理由如下：

- 不會改寫目前程式的真實行為。
- 可把銀行系統最核心的幾個衝突拆開：
  - 事件 vs 窗口
  - 產品權限 vs UI 分頁
  - 交易流程 vs 資料權威
  - 單人操作 vs 多人同步
- 後續產品負責人可以逐項確認，而不是一次決定整套銀行系統。

## 19. Decision Required

請產品負責人至少逐項確認以下方向：

□ `Bank Event` 與 `Bank Service Window` 是否要視為兩層規則

□ 股票是否正式視為常駐功能

□ 貸款是否正式視為常駐功能

□ 定存辦理與定存解約是否要保留雙入口

□ 汽車是否仍屬 `wealth` gate

□ `loans` 與 `liabilities` 哪個才是未來唯一權威

□ 股價的正式權威來源是 room、player state、還是兩者同步副本

□ 保險購買是否應以「增加月支出」為正式會計效果

## 20. Need Confirmation

1. `payday` request approval 流程是否已正式停用；目前 request type 仍存在，但主流程沒有呼叫端。
2. 停留銀行是否一定會建立與經過銀行同型的 `bank` 事件，需再核對棋盤移動與特定卡片傳送行為。
3. 醫療保險之外，房屋保險與汽車保險是否有同等購買入口，目前證據不足。
4. 定存解約在所有 UI 入口下是否都不受銀行窗口限制，仍需最終確認。
5. `GameState.loans` 是否仍是正式規則欄位，或僅為 legacy 相容用途，無法確認。
6. 保險交易的 `cashChange: 0` 與財務檢核要求 `現金 Decrease`，哪一邊才是最終權威，需確認。
7. `bankServiceGrantedAtEventId` 是否只用於 prompt 防重，還有沒有其他規則用途，需確認。
8. `room.status === 'finished'` 時，股票 / 貸款 / 定存解約是否仍完全可互動，需最終確認 disabled 傳遞鏈。
9. 多位玩家同時做股票交易時，是否曾出現 room price / player price 顯示不一致的實例，目前只能確認風險，不能確認案例。

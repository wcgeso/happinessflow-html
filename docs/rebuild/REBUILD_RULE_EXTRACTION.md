# 第二人生 (第二人生) 遊戲規則萃取與重建評估報告

本文件旨在從目前的《第二人生》專案（基於 `0703` 分支狀態）中，完整萃取核心遊戲規則，並評估在「商業遊戲開發架構」下重寫或重構的技術路徑。

---

## 1. 可直接重用的規則 (Directly Reusable Rules)

這些是遊戲的核心玩法框架，其邏輯已在文檔與代碼中確立，無需變更：
*   **固定 52 格循環棋盤**：地圖共有 52 格，玩家以起點（亦為學校）為基準循環移動，地圖格的類型分佈（銀行、學校、醫院、維修廠、三類卡片格）為固定數值。
*   **經過/停留觸發機制**：
    *   **經過**銀行格強制觸發「月結餘確認」；經過學校格觸發「升等考試」；經過維修廠（且有車）觸發「車輛維修費」。
    *   **停留**在特殊格（醫院、學校、銀行、維修廠）或卡片格觸發對應的即時結算事件。
*   **骰子規則**：無車玩家預設擲 1 顆骰子（1-6 步）；有車玩家可自選擲 1 顆或 2 顆骰子。
*   **月結算公式**：
    $$\text{月現金流 (Monthly Cash Flow)} = \text{總收入} - \text{總支出}$$
    $$\text{總收入} = \text{薪資} + \text{被動收入 (租金、企業收益、定存利息等)}$$
    $$\text{總支出} = \text{基本生活費} + \text{交通教育費} + \text{其他醫療育兒費} + \text{貸款利息} + \text{所得稅} + \text{保險費}$$
*   **生存底線規則**：玩家現金不得為負值。若支付金額大於持有現金，必須立刻進行借款、資產變賣或轉為強制負債。
*   **終身學習與判定**：繳納學習學費後，玩家移動到學校格，暫停一回合，並進行擲骰判定（大於等於要求點數則獲得對應能力，如股票能力、職業能力或地產能力）。

---

## 2. 目前只存在程式碼中的隱性規則 (Implicit Rules in Code)

這部分規則沒有明確的文檔定義，而是直接寫死在程式碼的執行邏輯中：
*   **幸福卡月支出分類映射** (`boardCardActions.ts#L143-149`)：
    *   `['H028', 'H039', 'H040', 'H041', 'H042']` 固定增加 `otherMedicalChild`（其他醫療育兒）月支出。
    *   `['H030', 'H034', 'H038']` 固定增加 `basicLiving`（基本生活費）月支出。
    *   `['H031', 'H032', 'H033', 'H035', 'H036', 'H037']` 固定增加 `transportEdu`（交通教育費）月支出。
*   **全體影響機運卡分類** (`boardCardActions.ts#L470`)：
    *   機運卡中只有 `C047` 的全體月支出變更分類為 `transportEdu`，其餘影響全體的機運卡月支出變更一律歸類為 `basicLiving`。
*   **自動扣款與強制負債還款**：在月結算時，系統會自動扣除「強制負債」的金額，但一般銀行信用貸款、房屋貸款、企業貸款必須由玩家手動清償，且信用貸款月還款額預設為總額的 $10\%$。
*   **交易紀錄撤銷 (Undo) 逆向回滾機制** (`useGameLogic.ts#L149-234`)：
    *   系統支援刪除交易歷史紀錄來回滾玩家狀態。
    *   此機制的運作方式是解析 `Transaction.details` 欄位中的 JSON 字串，並比對 hardcode 的字串（如 `"兩房一廳住宅"`、`"自用住宅"`、`"企業"`、`"股票 "`），手動扣除對應的張數、資產物件、以及註銷貸款。

---

## 3. 已經資料化的卡片規則 (Data-based Card Rules)

以下屬性已完整儲存在 `src/data/cards/` 的 JSON 檔案中，可以作為資料庫種子直接匯入新架構：
*   **幸福卡 (`happiness.cards.json`)**：
    *   `happinessPoints` (幸福點數)
    *   `cashCost` (一次性現金花費)
    *   `monthlyExpenseIncrease` (月支出增加額)
    *   `childrenIncrease` (小孩出生數量)
    *   `otherPlayersCanJoin` / `joinDiceMin` (多人共同參與門檻)
*   **機運卡 (`opportunity.cards.json`)**：
    *   `purchasePrice` (買入價格) / `purchasePercent` (出售收購百分比)
    *   `acquisitionMultiple` (企業收購倍數)
    *   `cashLoss` / `cashGain` (現金增減)
    *   `schoolFee` / `diceRequirement` (學習費用與判定點數)
    *   `goToSquare` / `missRounds` (指定移動與暫停回合數)
*   **新聞卡 (`news.cards.json`)**：
    *   `prices` (股市價格變動表)
    *   `dividendPerShare` (股票現金股利) / `dividendRate` (股票股息率)
    *   `totalPrice` / `downPayment` / `loanAmount` / `monthlyPayment` / `rent` (房地產投資細節)

---

## 4. 仍 Hardcode 在程式碼中的規則 (Remaining Hardcoded Rules)

重建時必須予以資料化或封裝的 hardcode 邏輯：
*   **卡片效果派發器**：在 `boardCardActions.ts` 中，藉由大量的 `if (opportunityCard.type === '...')` 和 `if (newsCard.type === '...')` 來手動構建財務交易（`expectedEntries` 和 `txData`），這使得核心邏輯與 UI 結構（`BoardCardActionDefinition`）高度耦合。
*   **資產標籤生成** (`assetLabels.ts`)：利用正則表達式從資產名稱中擷取代號（例如 `[A-Z]\d+` 匹配股票代碼，或透過 `store`、`1room` 判斷房屋類型），並以此決定資產的分類與買賣限制。
*   **保險與資產附掛**：保險不是獨立實體，而是在資產購買時，寫死在特定欄位上（如 `asset.isInsured = true`）。理賠時，代碼手動掃描 `assets` 陣列來判斷是否豁免修繕費用。

---

## 5. 重寫時必須保留的遊戲流程 (Must-keep Game Flows)

新架構必須嚴格實現的業務流程：
1.  **回合完整性校驗 (Turn Completeness Guard)**：在切換下一位玩家前，必須確保當前玩家的所有棋盤事件（包括經過、停留）、後續衍生卡片事件、以及財務檢核（Financial Check）皆已提交並結算完畢。
2.  **多人同步事件處理 (Barrier Sync)**：若觸發「家庭重要歷程」或「共享決策」，所有符合資格的玩家必須完成「接受/拒絕/擲骰判定」的回覆，事件佇列才可移出該事件，並允許回合推進。
3.  **經過格優先處理**：角色移動時，若路徑跨越銀行格，必須先中斷移動動畫，彈出月結算視窗，完成財務確認後，才可繼續結算停留格效果。
4.  **執行師審核流水線 (Coach Pipeline)**：玩家發起大額金流變更時，必須寫入審核佇列，由執行師點擊「同意」或「拒絕」後，玩家端監聽到狀態改變才可落帳。

---

## 6. 重寫時不應照搬的壞架構 (Bad Architectural Patterns)

目前專案的技術債與架構缺陷：
*   **超大單一 Firestore 文件 (Big Single Document)**：
    將所有玩家的 `GameState`、整張棋盤狀態、全體行情、審核請求、以及日誌全部塞在 `rooms/{roomCode}` 一個 Doc 內。這會導致多人同時寫入時容易產生衝突與覆蓋（Merge Conflict），且隨遊戲進行，文件大小極易突破 Firestore 的 $1\text{MB}$ 限制。
*   **前端計算、後端完全無校驗 (No Server Authority)**：
    所有的財務公式、資產買賣利息扣除、甚至擲骰點數，都是由玩家本機的 React Code 計算後，直接 `updateDoc` 寫回雲端。這沒有安全防護，極易被客戶端惡意改動，且不同設備因網路延遲可能計算出不一致的結果。
*   **基於 JSON 字串解析的撤銷系統 (Fragile Undo System)**：
    撤銷交易不使用 Event Sourcing (事件溯源) 或 Command Pattern (命令模式)，而是把交易詳情轉成 JSON string 存入 `history`，撤銷時再把 string 轉回來「手動用 `if-else` 反向操作數值」。這在欄位調整時極易損壞。
*   **全域 UI 與業務狀態混雜**：
    `RoomContext` 內同時管理了 Firebase 連線、即時監聽、防重入鎖、UI 動畫延遲時間計算、以及卡牌效果派發。

---

## 7. 可直接搬到新架構的資料檔 (Portable Data Files)

可以直接搬移至新架構，做為 Seed Data 或靜態設定檔的檔案：
*   `src/data/cards/happiness.cards.json`
*   `src/data/cards/opportunity.cards.json`
*   `src/data/cards/news.cards.json`
*   `src/constants/board.ts` (定義 52 格棋盤格子的位置與類型)
*   `src/constants/achievements.ts` (成就清單與達成條件)

---

## 8. 需要重新設計的模組 (Modules to Redesign)

若要重寫核心，以下模組必須從零重新設計：
*   **狀態存儲結構 (Firestore DB Schema Redesign)**：
    *   將單一 `rooms` 文件打散。
    *   `rooms/{roomId}` 只保留基本中繼資料（狀態、成員列表、時間）。
    *   建立子集合 `rooms/{roomId}/players/{uid}` 儲存玩家個人財務狀態。
    *   建立子集合 `rooms/{roomId}/events/{eventId}` 儲存當前的事件佇列與多人的回應。
*   **確定性遊戲引擎 (Deterministic Game Core)**：
    *   將規則引擎（擲骰、經過判定、卡片效果結算）抽離成純函數（Pure Functions），輸入舊狀態與 Action，輸出新狀態，使其可以同時在前端與 Node.js/Cloud Functions 端執行以進行雙重校驗。
*   **命令與事件溯源系統 (Command / Event Sourcing)**：
    *   將所有玩家的操作定義為 `Command`（如 `BuyStockCommand`、`RollDiceCommand`）。
    *   遊戲狀態變更以 `Event` 紀錄，Undo 時只需回滾 Event 即可，不需人工手動寫逆向公式。
*   **同步狀態機 (Multiplayer State Machine)**：
    *   引入嚴格的伺服器狀態機（或以 Cloud Functions + Firestore Transactions 實現），明確定義回合狀態（`ROLLING`、`RESOLVING_PASS`、`RESOLVING_STAY`、`WAITING_SHARED_RESPONSES`、`FINANCIAL_CHECK`），避免狀態衝突。

---

## 9. 重寫成本預估 (Cost Estimation)

以 1 位資深全端/遊戲工程師 (Senior Fullstack/Game Engineer) 獨立開發為基準估算：
*   **階段一：後端資料結構拆分與 Firestore Rules 重寫**：約 5 工作天
*   **階段二：純 JS/TS 遊戲核心引擎開發 (GDD 規則模組化，不含 UI)**：約 10 工作天
*   **階段三：多人同步事件機制與命令系統 (Command Pattern)**：約 7 工作天
*   **階段四：前端 UI 重新接入新 Context / Engine API**：約 8 工作天
*   **階段五：整合測試與多人邊界案例測試**：約 5 工作天
*   **總時程預估**：約 **35 個工作天 (約 7 週)**。

---

## 10. 三大技術路線方案比較 (Option Comparison)

| 評估維度 | 方案 A：繼續 Hotfix 既有架構 | 方案 B：Firestore 資料拆分與局部重構 (推薦) | 方案 C：全面重寫 Game Core |
|---|---|---|---|
| **開發成本** | 極低 (現有狀態，僅需數天維護) | 中等 (約 1.5 ~ 2 週) | 高 (約 7 ~ 8 週) |
| **系統穩定度** | 低 (容易因為網路延遲與連點造成覆蓋) | 高 (衝突點被子集合與交易隔離) | 極高 (完全確定性的核心引擎) |
| **可擴充性** | 極低 (再加入新卡片或玩法會使 Context 膨脹) | 中等 (規則與資料已分離，易於擴充) | 極高 (隨時可移植到 WebSocket 或其他後端) |
| **Firestore 文件限制** | 存在致命風險 (隨人數增加逼近 $1\text{MB}$ 限制) | **無風險** (狀態已打散至子文件) | **無風險** |
| **多人同步體驗** | 偶發不同步，依賴手動修復鎖 | 穩定同步，交易衝突率大幅降低 | 完美同步，支援高併發 |
| **上線延遲風險** | 無 | 低 (保留了 $90\%$ 的前端 UI，不需重刻網頁) | 高 (整個專案生命週期需要重來) |

---

# Rebuild Decision Report (決策報告)

## 🎯 核心評估結論
1.  **不建議「全面重寫」整個專案**：
    因為《第二人生》目前的前端 UI 互動、報表視覺、執行師控制台及 AI 報告模組已經高度完備，這些與核心遊戲規則（如擲骰、買賣）無關，全面重寫會造成嚴重的資源浪費與上線延遲。
2.  **不建議「繼續 Hotfix 既有架構」**：
    目前的單一大文件 `rooms/{roomCode}` 設計是系統的不定時炸彈。只要玩家數量達到 6 人，或遊戲回合數拉長、日誌變多，**Firestore 文件隨時可能突破 $1\text{MB}$ 上限導致整場遊戲報銷**，且並發覆蓋問題無法徹底解決。

## 💡 明確建議方案：局部重構 Firestore 存儲結構 (方案 B)
我們強烈建議採用 **「不重刻前端 UI，僅局部重構資料庫結構與同步機制」** 的折衷安全路線。

### 🛡️ 最安全路線實作步驟
1.  **資料庫打散 (Sharding)**：
    保留前端 UI 組件，但在 `RoomContext` 內部寫入與監聽時，將 `playerStates` 從 `rooms/{roomCode}` 主文件中移出，改寫入獨立的 `rooms/{roomCode}/players/{uid}` 子集合。如此可立刻免除 $1\text{MB}$ 文件上限與多人同時寫入時對 `boardState` 的覆蓋威脅。
2.  **事件與回應解耦**：
    將 `sharedCardPrompt` 與 `familyMilestoneJoinPrompt` 移入 `rooms/{roomCode}/events/{eventId}` 子文件，玩家提交 response 時，只對該特定 event 文件進行 `updateDoc`，徹底杜絕主文件的 Merge 衝突。
3.  **重構 Rule Engine 到獨立 Utils**：
    將 `boardCardActions.ts` 中剩餘的 hardcode 卡片效果逐步收斂至 `src/data/cards/` 的 JSON 屬性中，讓前端 UI 只負責渲染，規則判定交給純函數。

這個路線能夠在 **1.5 週內** 徹底解決多人同步衝突與文件限制的致命傷，同時完整保留既有的視覺與 AI 報告等高價值模組，是目前最穩健、成本最低且最安全的商業化上線路線。

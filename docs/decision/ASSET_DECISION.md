# Metadata

Status: Confirmed

Owner: 汪家慶

Last Updated: 2026-07-06

# Purpose

把與 Asset Ownership、Insurance attachment、Loan attachment、Real Estate、Business 相關的 Gap，整理成需要產品負責人拍板的決策項目。

# Related Gaps

- GAP-006
- GAP-007
- GAP-008
- GAP-015
- GAP-016
- 無對應既有 Gap（DEC-006、DEC-007：由產品負責人於 GDD 完整度稽核後直接拍板）

# Decision Items

## DEC-001：資產 ownership 是否以 GameState.assets 為唯一正式來源

Decision ID: DEC-001

Related Gap:
- GAP-006

Related RFC:
- `ASSET_SYSTEM_RFC.md`
- `REAL_ESTATE_SYSTEM_RFC.md`
- `BUSINESS_SYSTEM_RFC.md`

Related GDD:
- `ASSET_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 資產 ownership 以 `GameState.assets` 為正式來源的方向已存在。
- Current GDD: `ASSET_SYSTEM.md` 已要求玩家資產 ownership 以 `GameState.assets` 為正式來源。
- Current Implementation: 房貸、車貸、房屋保險、企業升級等仍常靠名稱、符號或分散欄位推導。

Options:
- Option A
  - 優點: 保持多份 ownership 狀態。
  - 缺點: 正式權威不清楚。
- Option B
  - 優點: 只承認 `GameState.assets`。
  - 缺點: 需要把附件資料正式化。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-002：保險採用資產附掛模型

Decision ID: DEC-002

Related Gap:
- GAP-007

Related RFC:
- `INSURANCE_SYSTEM_RFC.md`
- `ASSET_SYSTEM_RFC.md`
- `BANK_SYSTEM_RFC.md`

Related GDD:
- `BANK_SYSTEM.md`
- `ASSET_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 醫療 / 房屋 / 汽車保險目前使用不同資料落點，需確認正式資料模型是否要統一為獨立 Insurance Object。
- Current GDD: `BANK_SYSTEM.md` 與 `ASSET_SYSTEM.md` 已定義保險購買權限與 attachment 方向，但尚未明確決定是否建立獨立 claim / insurance model。
- Current Implementation: 醫療保險用 `medicalInsuranceCount`，房屋與車輛保險用 `Asset.isInsured`。
- Product Decision: 正式規格採用資產附掛模型。醫療保險維持計數器；房屋保險與汽車保險附掛於對應資產，不建立獨立 Insurance Object 或獨立 Claim Ledger。

Options:
- Option A（採用）
  - 優點: 延續目前的資產附掛邏輯，醫療保險以計數器表示，房屋與汽車保險直接掛在對應資產上，與 Asset System 的 ownership 模型一致。
  - 缺點: 三種保險的資料落點不同，需要在 GDD 中明確說明。
- Option B
  - 優點: 建立獨立 Insurance Object 與 Claim Model，資料結構形式上更統一。
  - 缺點: 會額外增加資料模型與同步複雜度，且與目前 Asset ownership 模型不一定更一致。

Recommendation:
採用 Option A。

正式規格如下：
- 醫療保險以 `medicalInsuranceCount` 表示。
- 房屋保險附掛於對應不動產資產的 `Asset.isInsured`。
- 汽車保險附掛於對應汽車資產的 `Asset.isInsured`。
- 不建立獨立 `Insurance` Object。
- 不建立獨立 Claim Ledger。
- 理賠紀錄以 Transaction History 作為正式紀錄。
- `aircraft` / `飛行器` 僅為 Legacy 相容名稱，不屬正式規格。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

## DEC-003：貸款 attachment 與 asset sale 的正式關聯是否維持

Decision ID: DEC-003

Related Gap:
- GAP-008

Related RFC:
- `LOAN_SYSTEM_RFC.md`
- `REAL_ESTATE_SYSTEM_RFC.md`
- `BUSINESS_SYSTEM_RFC.md`
- `ASSET_SYSTEM_RFC.md`

Related GDD:
- `ASSET_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`
- `BANK_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 資產出售與貸款清償的對應關係已在 RFC 中被反覆提到。
- Current GDD: `ASSET_SYSTEM.md` 與 `FINANCIAL_SYSTEM.md` 都要求資產出售後若有對應貸款需依規則處理。
- Current Implementation: 資產出售仍靠名稱與類型對應負債。

Options:
- Option A
  - 優點: 保持名稱比對。
  - 缺點: 關聯關係不夠正式。
- Option B
  - 優點: 以正式關聯模型處理。
  - 缺點: 需要把 attachment 關係正式化。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-004：房屋市場採用正式資料結構

Decision ID: DEC-004

Related Gap:
- GAP-015

Related RFC:
- `REAL_ESTATE_SYSTEM_RFC.md`
- `MARKET_SYSTEM_RFC.md`
- `ASSET_SYSTEM_RFC.md`

Related GDD:
- `ASSET_SYSTEM.md`
- `BOARD_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 房屋市場是否只用 cardId 清單一直是待確認項目。
- Current GDD: `ASSET_SYSTEM.md` 已要求房屋市場需要正式資料結構。
- Current Implementation: `boardState.realEstateMarket` 仍只是 `string[]`，沒有價格、持有人、條件等欄位。
- Product Decision: 房屋市場採用正式資料結構，不再只以 cardId 清單作為正式規格。

Options:
- Option A
  - 優點: 維持 cardId 清單即可。
  - 缺點: 無法完整描述市場狀態與多人同步。
- Option B（採用）
  - 優點: 建立正式房屋市場資料結構，支援價格、來源、狀態與交易流程。
  - 缺點: 需要在 GDD 定義完整欄位。

Recommendation:
採用 Option B。

正式規格如下：
- 房屋市場不只保存 cardId。
- 每筆市場房屋至少包含：
  - marketItemId
  - cardId
  - houseType
  - price
  - sourcePlayerId（如適用）
  - status
  - createdAt
  - purchasedBy（如適用）
- 房屋市場屬於 Shared Board State。
- 市場購買必須通過 Financial Check。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

## DEC-005：企業系統正式收斂

Decision ID: DEC-005

Related Gap:
- GAP-016

Related RFC:
- `BUSINESS_SYSTEM_RFC.md`
- `CARD_SYSTEM_RFC.md`
- `ASSET_SYSTEM_RFC.md`

Related GDD:
- `ASSET_SYSTEM.md`
- `FINANCIAL_SYSTEM.md`
- `CARD_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 企業收購、升級、cashflow、unsupported business card 之間仍有未收斂問題。
- Current GDD: `ASSET_SYSTEM.md` 與 `CARD_SYSTEM.md` 只把企業列為正式資產，未把 unsupported business card 轉成正式玩法。
- Current Implementation: 企業取得與升級流程仍有 unsupported / acquisition / upgrade 語意分裂。
- Product Decision: 企業為正式資產系統，unsupported business card 不屬正式規格。

Options:
- Option A
  - 優點: 維持目前分散語意。
  - 缺點: 企業正式邊界不清楚。
- Option B（採用）
  - 優點: 將企業取得、升級、貸款與現金流統一納入 Business System。
  - 缺點: 需要在 GDD 完整定義流程。

Recommendation:
採用 Option B。

正式規格如下：
- 企業為正式資產。
- 企業取得、企業收購、企業升級、企業現金流、企業貸款皆屬正式 Business System。
- Business Card 不得作為 unsupported card 存在於正式規格。
- 尚未完成實作的卡片列為 Implementation Gap，而非正式玩法。
- 企業升級需定義：升級條件、升級成本、現金流變化、貸款影響、Transaction History。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

## DEC-006：夢想／企業購買是否需要棋盤格觸發條件

Decision ID: DEC-006

Related Gap:
- 無對應既有 Gap（`BUG_TRACEABILITY.md` Bug 2、Bug 32 標記為規格缺漏，B 類）

Related RFC:
- `DREAM_SYSTEM_RFC.md`
- `BUSINESS_SYSTEM_RFC.md`

Related GDD:
- `ASSET_SYSTEM.md`
- `DREAM_SYSTEM.md`
- `BUSINESS_SYSTEM.md`
- `BOARD_SYSTEM.md`

Status: Confirmed

Background:
- Current Bug: `BUG_TRACEABILITY.md` Bug 2「事業夢想購買的條件，走格子」與 Bug 32「夢想目標需走到指定格子才能達成」，皆因 `DREAM_SYSTEM.md`／`BUSINESS_SYSTEM.md` 未定義棋盤觸發條件而無法判定正確行為。
- Current GDD: 兩份文件的完成條件只描述財務門檻與跨系統承接，完全沒有描述棋盤位置或格子觸發條件。
- Product Decision: 夢想與企業的購買行為不需要棋盤格觸發，玩家可在自己回合內的財務安排階段隨時主動購買（只要符合各自完成條件的財務門檻）。

Options:
- Option A（採用）
  - 優點: 規則單純，玩家在自己回合內即可主動購買，不需要額外定義觸發格位、經過或停留判定，開發與教學成本最低。
  - 缺點: 無。
- Option B
  - 優點: 比照棋盤走格類玩法，增加沉浸感。
  - 缺點: 需要額外定義是哪些格子、經過或停留才算數，工作量大且非必要，也未見於現行 `PRODUCT_SPECIFICATION.md`。

Recommendation:
採用 Option A。

正式規格如下：
- 夢想購買與企業購買（含收購、升級）不需要玩家棋子停留或經過任何指定棋盤格。
- 玩家可在自己回合內的正式財務安排階段，主動發起夢想或企業購買，前提是通過對應的財務檢核與完成條件（見 `DREAM_SYSTEM.md`、`BUSINESS_SYSTEM.md` 完成規則）。
- 棋盤系統（`BOARD_SYSTEM.md`）不需要為夢想／企業購買新增任何格位或事件類型。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

## DEC-007：醫療保險是否可完全抵免醫院事件的醫療費

Decision ID: DEC-007

Related Gap:
- GAP-007
- 無對應既有 Gap（`MVP_PLAYABILITY_AUDIT.md` SC-02 標記為 Spec Conflict）

Related RFC:
- `INSURANCE_SYSTEM_RFC.md`
- `HOSPITAL_SYSTEM_RFC.md`

Related GDD:
- `ASSET_SYSTEM.md`
- `INSURANCE_SYSTEM.md`
- `HOSPITAL_SYSTEM.md`

Status: Confirmed

Background:
- Current Spec Conflict: `GAME_SYSTEM_MAP.md`（非正式文件）記載「若持有醫療保險則免付醫療費（保險次數 -1）」，但正式 GDD（`HOSPITAL_SYSTEM.md`、`INSURANCE_SYSTEM.md`）完全未提及保險抵免醫院費用的規則，`MVP_PLAYABILITY_AUDIT.md` SC-02 已列為未決衝突。
- Product Decision: 持有醫療保險時，醫院事件的醫療費可完全抵免（玩家不需支付該次醫療費），且此抵免**不消耗保險的使用次數／效期**，只要持有醫療保險即可反覆抵免。

Options:
- Option A
  - 優點: 比照 `GAME_SYSTEM_MAP.md` 現行描述，每次抵免消耗一次保險次數，較符合一般保險「有限理賠次數」的直覺。
  - 缺點: 與本次產品拍板結果不符。
- Option B（採用）
  - 優點: 規則單純：持有醫療保險 = 醫院醫療費永遠全免，不需要額外追蹤保險的抵免次數或消耗紀錄。
  - 缺點: 醫療保險的保費支出與其效益（無限次抵免）相比顯得單向有利，若日後要做保費／保額平衡調整需另外評估，但不影響本次規則本身的明確性。

Recommendation:
採用 Option B。

正式規格如下：
- 玩家持有醫療保險（`Asset` 附掛之醫療保險狀態為「有效」）時，醫院事件中的醫療費 100% 抵免，玩家不需支付。
- 此抵免不消耗醫療保險的任何次數或額度，保險狀態只要維持「有效」即可反覆抵免每一次醫院事件的醫療費。
- 停回合效果不受此抵免規則影響，仍依 `HOSPITAL_SYSTEM.md` 停回合規則正常執行。
- 醫療保險的購買、生效延遲（下一次月結算才生效）與終止規則，仍依 `INSURANCE_SYSTEM.md` 既有規則辦理，不受本決策影響。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

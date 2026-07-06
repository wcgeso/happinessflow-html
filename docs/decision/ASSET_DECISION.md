# Metadata

Status: Confirmed

Owner: 汪家慶

Last Updated: 2026-07-01

# Purpose

把與 Asset Ownership、Insurance attachment、Loan attachment、Real Estate、Business 相關的 Gap，整理成需要產品負責人拍板的決策項目。

# Related Gaps

- GAP-006
- GAP-007
- GAP-008
- GAP-015
- GAP-016

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

# Card Database Schema

## Purpose

本文件定義《幸福流》卡片資料庫第一階段正式欄位結構。

這份 Schema 只負責卡片資料整理與欄位語意，不改動既有卡片遊戲邏輯，也不重寫 Product Specification、Decision、GDD 或 Architecture。

## Source of Truth

第一階段卡片資料建立依據如下：

- `docs/cards/CARD_DATABASE_AUDIT.md`
- `src/constants/cards.ts`
- `src/utils/boardCardActions.ts`
- 既有正式規格文件（Product Specification / GDD / Architecture）

目前正式資料檔：

- `src/data/cards/happiness.cards.json`
- `src/data/cards/opportunity.cards.json`
- `src/data/cards/news.cards.json`

## Status Enum

| 值 | 說明 |
|---|---|
| `complete` | 規則、文案、條件與程式支援已對齊，可直接接入程式。 |
| `partial` | 規則存在，但程式支援、條件收束或效果落地仍不完整。 |
| `inconsistent` | 文案、數值、效果或程式邏輯之間存在不一致。 |
| `needs_product_confirmation` | 目前缺少足夠正式規則，需產品確認後才能完整落地。 |

## Record Shape

每張卡片資料使用以下欄位：

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---:|---|
| `id` | string | 是 | 卡片唯一識別碼，例如 `H011`、`C039`、`N055`。 |
| `title` | string | 是 | 卡片標題。 |
| `deck` | string enum | 是 | 只能是 `happiness`、`opportunity`、`news` 其中之一。 |
| `type` | string | 是 | 卡片效果類型；幸福卡以 `happiness` 表示，其餘沿用既有資料型別。 |
| `category` | string | 是 | 卡片類別或子類型。 |
| `description` | string | 是 | 卡面文案。 |
| `conditions` | object | 是 | 觸發條件、原始規則摘要與條件標記。 |
| `targets` | object | 是 | 影響對象與多人影響摘要。 |
| `effects` | object | 是 | 卡片效果摘要與結構化效果欄位。 |
| `amount` | object or null | 是 | 直接金額欄位，例如現金、貸款、頭期款、修繕費、股價。 |
| `multiplier` | object or null | 是 | 百分比、倍數、股利率、幸福點、投資報酬等倍率欄位。 |
| `financialCheck` | boolean | 是 | 是否需要正式財務檢核。 |
| `choiceRequired` | boolean | 是 | 是否需要玩家做出接受、購買、輸入或模式選擇。 |
| `insurance` | object | 是 | 保險是否可抵銷、對應保險類型與理賠金額。 |
| `followUp` | object | 是 | 是否需要 Follow-up，以及是否會帶出後續抽牌。 |
| `multiplayer` | object | 是 | 是否影響其他玩家、是否影響全體、是否允許共同參與。 |
| `noEffectCondition` | string | 是 | 不符合條件時，卡片應如何收束。 |
| `completion` | string | 是 | 卡片效果何時視為正式完成。 |
| `status` | status enum | 是 | 目前資料與規則成熟度。 |
| `sourceCodeReference` | string[] | 是 | 對應程式來源檔。 |
| `notes` | string[] | 是 | 補充說明、盤點警告或需注意事項。 |

## Conditions Object

`conditions` 物件固定包含：

- `trigger`：文字說明觸發時機
- `raw`：從盤點文件保留的原始規則摘要
- `requirements`：陣列，記錄結構化條件標記，例如：
  - `requires_story_sharing`
  - `requires_vehicle`
  - `requires_real_estate`
  - `requires_investment_amount_input`
  - `move_to_school`
  - `miss_rounds_1`

## Insurance Object

`insurance` 物件固定包含：

- `canBlock`：是否可被保險抵銷或理賠
- `summary`：文字摘要
- `type`：`medical_insurance`、`house_insurance`、`vehicle_insurance` 或 `null`
- `payoutAmount`：理賠金額；無則為 `null`

## Multiplayer Object

`multiplayer` 物件固定包含：

- `affectsOtherPlayers`
- `affectsAllPlayers`
- `otherPlayersCanJoin`
- `summary`

## Integration Rules

1. 這三份 JSON 是第一階段正式卡片資料庫。
2. 第一階段只建立資料層，不改寫既有卡片邏輯。
3. 當卡片邏輯日後接入 JSON 時，`room.marketPrices`、正式財務檢核、資產附掛、保險抵銷與多人事件規則仍以既有正式規格為準。
4. `needs_product_confirmation` 的卡片不得自行補規則。
5. H016-H020、H043-H046 為正式卡池成員，但目前資料成熟度應保留為 `needs_product_confirmation`。

## Example

```json
{
  "id": "N055",
  "title": "優質大型企業徵求合夥人",
  "deck": "news",
  "type": "large_enterprise",
  "category": "企業新訊",
  "description": "知名大型遊樂園將建設新館，計畫徵求合夥投資人。",
  "conditions": {
    "trigger": "抽到新聞卡",
    "raw": "觸發：抽到新聞卡<br>影響對象：所有玩家（依卡面可參與）<br>效果：最高投資額 50,000,000；每百萬月回報 200,000",
    "requirements": [
      "requires_investment_amount_input"
    ]
  },
  "targets": {
    "summary": "所有玩家（依卡面可參與）",
    "scope": "all_eligible_players",
    "affectsOtherPlayers": true,
    "raw": "所有玩家（依卡面可參與）"
  },
  "effects": {
    "summary": "最高投資額 50,000,000；每百萬月回報 200,000",
    "businessName": "遊樂園",
    "maxInvestment": 50000000,
    "monthlyReturnPerMillion": 200000
  },
  "amount": {
    "loanAmount": 0,
    "maxInvestment": 50000000
  },
  "multiplier": {
    "monthlyReturnPerMillion": 200000,
    "inputStep": 1000000
  },
  "financialCheck": true,
  "choiceRequired": true,
  "insurance": {
    "canBlock": false,
    "summary": "否",
    "type": null,
    "payoutAmount": null
  },
  "followUp": {
    "required": false,
    "summary": "不需要 Follow-up。",
    "drawCard": null
  },
  "multiplayer": {
    "affectsOtherPlayers": true,
    "affectsAllPlayers": true,
    "otherPlayersCanJoin": false,
    "summary": "所有符合資格的玩家都可被本卡影響或參與。"
  },
  "noEffectCondition": "若輸入金額不在範圍或現金不足，應無法成立",
  "completion": "投資金額確認並完成財務檢核後結束",
  "status": "complete",
  "sourceCodeReference": [
    "src/constants/cards.ts",
    "src/utils/boardCardActions.ts",
    "src/utils/boardCardDisplay.ts",
    "src/views/game/GameView.tsx",
    "src/context/RoomContext.tsx",
    "src/components/business/FinancialStatement.tsx"
  ],
  "notes": [
    "需要輸入投資金額，並依正式財務檢核 / 交易流程成立。",
    "N055 需先確認投資金額，再進入正式交易與財務檢核。"
  ]
}
```

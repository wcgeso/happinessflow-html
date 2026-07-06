# Metadata

Status: Confirmed

Owner: 汪家慶

Last Updated: 2026-07-06

# Purpose

把與 Reveal、Resolve、Follow-up Card、Unsupported Card、Family Card 相關的 Gap，整理成需要產品負責人拍板的決策項目。

# Related Gaps

- GAP-003
- GAP-014
- GAP-016
- 無對應既有 Gap（DEC-004、DEC-005、DEC-006：由產品負責人於 GDD 完整度稽核後直接拍板）

# Decision Items

## DEC-001：卡片是否必須遵守 Draw -> Reveal -> Resolve -> Complete

Decision ID: DEC-001

Related Gap:
- GAP-003

Related RFC:
- `CARD_SYSTEM_RFC.md`
- `EVENT_SYSTEM_RFC.md`
- `SCHOOL_SYSTEM_RFC.md`

Related GDD:
- `CARD_SYSTEM.md`
- `EVENT_SYSTEM.md`
- `TURN_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: 卡片事件被要求要先揭露再正式生效。
- Current GDD: `CARD_SYSTEM.md` 已要求所有卡片效果都必須依照 `Draw -> Reveal -> Resolve -> Complete`。
- Current Implementation: 部分卡片流程會直接進入後續效果，沒有完整經過正式生命週期。

Options:
- Option A
  - 優點: 保持部分卡片可直接套用效果。
  - 缺點: 生命週期不一致。
- Option B
  - 優點: 所有卡片都遵守正式流程。
  - 缺點: 需要完整拆分 Reveal / Resolve。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-002：Family Milestone 是否屬正式多人卡片事件

Decision ID: DEC-002

Related Gap:
- GAP-014

Related RFC:
- `FAMILY_SYSTEM_RFC.md`
- `HAPPINESS_SYSTEM_RFC.md`
- `CARD_SYSTEM_RFC.md`

Related GDD:
- `CARD_SYSTEM.md`
- `EVENT_SYSTEM.md`
- `TURN_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: Family Milestone 需要多人共同參與與回覆。
- Current GDD: `CARD_SYSTEM.md` 與 `EVENT_SYSTEM.md` 都要求 Family Milestone 是正式多人事件。
- Current Implementation: 目前混合 `completedHappinessEvents`、`happiness.checked`、`familyMilestoneJoinPrompt` 與本地 pending action。

Options:
- Option A
  - 優點: 只由主玩家處理，流程簡單。
  - 缺點: 不符合多人事件定義。
- Option B
  - 優點: 符合正式多人事件定義。
  - 缺點: 需要等待所有符合資格玩家回覆。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-003：Unsupported Card 是否只能留在 Implementation Gap

Decision ID: DEC-003

Related Gap:
- GAP-003
- GAP-016

Related RFC:
- `CARD_SYSTEM_RFC.md`
- `BUSINESS_SYSTEM_RFC.md`

Related GDD:
- `CARD_SYSTEM.md`
- `EVENT_SYSTEM.md`

Status: Confirmed

Background:
- Current RFC: unsupported card / unsupported action 仍被拿來討論其實作。
- Current GDD: `CARD_SYSTEM.md` 已明確要求 unsupported card 不得列為正式規格。
- Current Implementation: 程式與 RFC 仍存在 unsupported card / unsupported action 流程。

Options:
- Option A
  - 優點: 保留 unsupported card 作為正式規格的一部分。
  - 缺點: 與正式 GDD 衝突。
- Option B
  - 優點: 只保留在 Implementation Gap。
  - 缺點: 目前實作需另行補齊。

Recommendation:
建議採 Option B。

Decision Required:
No，正式 GDD 已經明確決定。

Need Confirmation:
無。

## DEC-004：C040（天有不測風雲／車禍卡）是否包含棋盤移動與停回合效果

Decision ID: DEC-004

Related Gap:
- 無對應既有 Gap（GDD 完整度稽核發現，`CARD_DATABASE_AUDIT.md` 標記為 Needs Product Confirmation）

Related RFC:
- 無

Related GDD:
- `CARD_SYSTEM.md`
- `BOARD_SYSTEM.md`
- `REPAIR_SYSTEM.md`

Status: Confirmed

Background:
- Current Audit: `CARD_DATABASE_AUDIT.md` 記載 C040 效果為「有汽車且無汽車保險時支付維修費 200,000；有汽車且有汽車保險時可申請理賠 200,000」，並註明「目前移動至維修廠／停回合正式規則仍需產品確認」。
- Current GDD: `CARD_SYSTEM.md` 的 Edge Cases 未涵蓋卡片效果本身要求移動棋子位置或疊加停回合的情境。
- Product Decision: C040 效果限定在財務層面（支付維修費或申請保險理賠），不觸發棋盤移動、不疊加停回合。

Options:
- Option A（採用）
  - 優點: 卡片效果只影響財務層，不牽動棋盤與回合系統，規則單純、不與其他棋盤規則衝突。
  - 缺點: 無。
- Option B
  - 優點: 比照維修廠事件完整體驗。
  - 缺點: 需額外定義「卡片觸發的移動」與「玩家自行移動」在同一套棋盤規則下如何處理，複雜度高。

Recommendation:
採用 Option A。

正式規格如下：
- C040 抽到後，依玩家是否持有汽車與汽車保險，判定支付維修費 200,000 或申請保險理賠 200,000。
- C040 不會移動玩家棋子位置，不建立維修廠事件，不疊加停回合。
- 財務效果仍須依 `CARD_SYSTEM.md` 結算規則，先完成財務檢核才正式成立。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

## DEC-005：N056-N058（創業貸款）銀行升級的正式生命週期

Decision ID: DEC-005

Related Gap:
- 無對應既有 Gap（GDD 完整度稽核發現，`CARD_DATABASE_AUDIT.md` 標記為 Partial）

Related RFC:
- `CARD_SYSTEM_RFC.md`
- `LOAN_SYSTEM_RFC.md`
- `BUSINESS_SYSTEM_RFC.md`

Related GDD:
- `CARD_SYSTEM.md`
- `LOAN_SYSTEM.md`
- `BUSINESS_SYSTEM.md`
- `BANK_SYSTEM.md`

Status: Confirmed

Background:
- Current Audit: N056-N058 完成條件僅寫到「所有接受玩家完成貸款建立與財務檢核後結束」，未涵蓋銀行擲骰升級的完成判定。
- Current GDD: `CARD_SYSTEM.md` 的後續卡規則要求後續事件走完整生命週期，但未定義「延遲到未來某次經過銀行才觸發判定」這種跨回合懸掛事件的正式機制。
- Product Decision: 保留現行玩法設計——玩家接受創業貸款後，之後每次經過銀行都可以擲骰嘗試升級，直到成功為止；成功後取消貸款與利息，並取得企業收入。此為正式規格，須建立對應的正式追蹤狀態（而非僅本地 pending state）。

Options:
- Option A
  - 優點: 抽到卡當下立即擲骰一次決定成敗，不需要跨回合追蹤。
  - 缺點: 改變現行玩法體驗。
- Option B（採用）
  - 優點: 保留現行「持續嘗試直到成功」的玩法趣味。
  - 缺點: 需要在 `LOAN_SYSTEM.md` 或 `BUSINESS_SYSTEM.md` 新增正式的跨回合懸掛事件定義，並確保此狀態屬於 Shared Room State，而非玩家本地 pending state。

Recommendation:
採用 Option B。

正式規格如下：
- 玩家接受創業貸款後，建立正式的「待升級」狀態，此狀態屬於該玩家的正式負債附屬資訊，需可被所有客戶端同步讀取。
- 玩家之後每次經過銀行（Bank Event），若該筆創業貸款仍處於待升級狀態，皆可執行一次正式擲骰判定。
- 擲骰結果 ≥ 5 視為升級成功：取消該筆貸款本金與利息、將兼職工作室升級為小型企業、依卡面定義增加企業收入。
- 擲骰結果 < 5 視為本次未成功，待升級狀態維持不變，貸款與利息依正常還款規則持續生效，玩家下次經過銀行可再次嘗試。
- 升級成功或本金依正常還款規則清償完畢前，該筆創業貸款事件不視為完成。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

## DEC-006：H016-H020、H043-H046 家庭歷程卡池定案狀態

Decision ID: DEC-006

Related Gap:
- 無對應既有 Gap（`CARD_DATABASE_SCHEMA.md`、`CARD_SYSTEM_RFC.md` 標記為 needs_product_confirmation，與 `CARD_DATABASE_AUDIT.md` 的 Complete 判定衝突）

Related RFC:
- `CARD_SYSTEM_RFC.md`

Related GDD:
- `CARD_SYSTEM.md`
- `FAMILY_SYSTEM.md`

Status: Confirmed

Background:
- Current Audit: `CARD_DATABASE_AUDIT.md` 將 H016-H020、H043-H046 標記為 Complete，內容與 H011-H015 完全相同，皆為「幸福家庭的重要歷程」推進卡。
- Current Schema/RFC: `CARD_DATABASE_SCHEMA.md` 與 `CARD_SYSTEM_RFC.md` 認為這批卡仍應標記為 needs_product_confirmation，形成文件間狀態矛盾。
- Product Decision: H011-H020、H043-H046 共 14 張卡皆為正式卡池成員，內容重複為刻意設計（提高抽到「家庭歷程推進」的機率），不需要另外撰寫獨立文案，維持現狀即可直接使用。

Options:
- Option A（採用）
  - 優點: 維持現狀，14 張卡皆保留且可直接上線，不需額外文案撰寫工作。
  - 缺點: 卡面文字重複，未來若要呈現卡片清單需注意重複卡名的顯示方式。
- Option B
  - 優點: 精簡張數、減少重複感。
  - 缺點: 需要決定砍掉哪幾張、新增什麼取代內容，工作量較大且非必要。

Recommendation:
採用 Option A。

正式規格如下：
- 幸福卡池中「幸福家庭的重要歷程」卡共 14 張（H011-H020、H043-H046），內容與規則完全相同。
- 此 14 張卡皆為正式卡池成員，狀態為 Complete，不再標記 needs_product_confirmation。
- `CARD_DATABASE_SCHEMA.md` 與 `CARD_SYSTEM_RFC.md` 中對這批卡的 needs_product_confirmation 標記應更新為已確認可用。

Decision Required:
No，產品規格已確認。

Need Confirmation:
無。

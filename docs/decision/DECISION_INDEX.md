# Decision Index

> 文件定位：Decision 索引，不是 RFC，不是 GDD。
>
> 本文件只整理 Decision 文件清單、各文件包含的 Gap、Confirmed / Pending 狀態，以及產品負責人優先處理順序。

## 1. Decision 文件清單

### Summary

- Total Decision Items: `33`
- Confirmed: `33`
- Pending: `0`

| File | Decision Items | Related Gaps | Confirmed | Pending |
|---|---:|---|---:|---:|
| `TURN_DECISION.md` | 3 | GAP-001, GAP-010, GAP-011 | 3 | 0 |
| `EVENT_DECISION.md` | 3 | GAP-002, GAP-003, GAP-010, GAP-011, GAP-014 | 3 | 0 |
| `CARD_DECISION.md` | 6 | GAP-003, GAP-014, GAP-016, 無對應 Gap（DEC-004/005/006） | 6 | 0 |
| `BANK_DECISION.md` | 2 | GAP-004 | 2 | 0 |
| `FINANCIAL_DECISION.md` | 5 | GAP-005, GAP-008, GAP-009, GAP-013, GAP-014, 無對應 Gap（DEC-005） | 5 | 0 |
| `ASSET_DECISION.md` | 7 | GAP-006, GAP-007, GAP-008, GAP-015, GAP-016, 無對應 Gap（DEC-006/007） | 7 | 0 |
| `STATE_DECISION.md` | 3 | GAP-008, GAP-009, GAP-018 | 3 | 0 |
| `ARCHITECTURE_DECISION.md` | 3 | GAP-017, GAP-018, GAP-019 | 3 | 0 |
| `PROFESSION_DECISION.md` | 1 | GAP-012 | 1 | 0 |

> 2026-07-06 更新：GDD 完整度稽核後，產品負責人直接拍板補上 6 項先前無正式決策的規格缺口（CARD_DECISION.md DEC-004~006、FINANCIAL_DECISION.md DEC-005、ASSET_DECISION.md DEC-006~007）。這些項目無對應既有 RFC_GAP_LIST.md 編號，故標記為「無對應 Gap」。

## 2. Gap 對應總覽

| Gap ID | Decision File(s) |
|---|---|
| GAP-001 | `TURN_DECISION.md` |
| GAP-002 | `EVENT_DECISION.md` |
| GAP-003 | `EVENT_DECISION.md`, `CARD_DECISION.md` |
| GAP-004 | `BANK_DECISION.md` |
| GAP-005 | `FINANCIAL_DECISION.md` |
| GAP-006 | `ASSET_DECISION.md` |
| GAP-007 | `ASSET_DECISION.md` |
| GAP-008 | `FINANCIAL_DECISION.md`, `ASSET_DECISION.md`, `STATE_DECISION.md` |
| GAP-009 | `FINANCIAL_DECISION.md`, `STATE_DECISION.md` |
| GAP-010 | `TURN_DECISION.md`, `EVENT_DECISION.md` |
| GAP-011 | `TURN_DECISION.md`, `EVENT_DECISION.md` |
| GAP-012 | `PROFESSION_DECISION.md` |
| GAP-013 | `FINANCIAL_DECISION.md` |
| GAP-014 | `EVENT_DECISION.md`, `CARD_DECISION.md`, `FINANCIAL_DECISION.md` |
| GAP-015 | `ASSET_DECISION.md` |
| GAP-016 | `CARD_DECISION.md`, `ASSET_DECISION.md` |
| GAP-017 | `ARCHITECTURE_DECISION.md` |
| GAP-018 | `STATE_DECISION.md`, `ARCHITECTURE_DECISION.md` |
| GAP-019 | `ARCHITECTURE_DECISION.md` |

## 3. Confirmed vs Pending

### Confirmed

- 所有 Decision 文件的所有項目皆為 `Confirmed`

### Pending

- 目前無 Pending Decision。

## 4. 建議產品負責人優先處理順序

1. `FINANCIAL_DECISION.md`
2. `ASSET_DECISION.md`
3. `STATE_DECISION.md`
4. `ARCHITECTURE_DECISION.md`
5. `PROFESSION_DECISION.md`
6. `TURN_DECISION.md`
7. `EVENT_DECISION.md`
8. `CARD_DECISION.md`
9. `BANK_DECISION.md`

> 說明：目前所有 Decision Items 都已 Confirmed；此順序僅保留作為後續複核與文件維護優先順序。

## 5. 補充

- 已 Confirmed 的項目，代表正式 GDD 已經明確定義。
- 目前沒有 Pending Decision Items。

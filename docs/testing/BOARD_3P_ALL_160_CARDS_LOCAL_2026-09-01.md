# 3 位玩家＋1 位執行師全卡片本地驗收報告

## 1. 測試摘要

- 測試日期：2026-09-01（Asia/Taipei）
- 分支：`dev`
- Git SHA：`a1482f83aa7dc51a9a8861d56ef2dd91525bba4d`
- 測試環境：本地 Vite `http://127.0.0.1:5183/`
- Firebase：Auth Emulator `127.0.0.1:9099`、Firestore Emulator `127.0.0.1:8080`、Realtime Database Emulator `127.0.0.1:9000`
- 測試角色：3 位玩家（390×844）＋1 位執行師（1440×900）
- 測試房間：`873253`
- 目標卡片：160 張（幸福 46、機運 56、新聞 58）
- 最終判定：**失敗（P1 阻斷）**

本次依「遇到 P1 即保存證據並停止」規則執行，因此不是 160 張全部通過，也不將未執行的 159 張列為通過。

## 2. 嚴重程度定義

- **A 級：** 阻斷遊戲流程、多人同步／交易競態、資料未正確結案，無法繼續驗收。
- **B 級：** 單一功能或規則結果錯誤，但不一定阻斷全場。
- **C 級：** 顯示、提示、動畫或待確認規則，不影響核心流程繼續。

## 3. 執行前檢查

| 項目 | 結果 | 備註 |
|---|---|---|
| TypeScript | 通過 | `npm run typecheck` |
| Vitest | 通過 | 33 files；203 passed；24 skipped |
| Firestore Rules | 通過 | 隔離 Emulator 24/24；避免與遊戲使用中的 8080 互相干擾 |
| Production build | 通過 | `npm run build`；保留既有警告 |
| Git diff check | 通過 | `git diff --check` |

## 4. 瀏覽器驗收結果

### 4.1 開局與環境連線

**通過：**

- 本地 Auth／Firestore 連線可用。
- 執行師與 3 位獨立玩家成功登入。
- 成功建立房間 `873253`。
- 三位玩家完成「職業 → 目標事業 → 人生夢想」並進入遊戲。
- 新局玩家幸福值為 0，玩家私有資料存在，未使用房間根節點的私有資料替代。

### 4.2 H001「得獎經歷」

- 卡片觸發：完成。
- 卡片翻牌：完成。
- 卡片日誌寫入：完成。
- 主要玩家操作／事件結案：**失敗，120 秒內未完成。**
- 分級：**A 級**。

結束快照仍保留 `currentCard`、`currentCardReveal` 與 `currentEvent`，且 `movement`、`familyMilestoneJoinPrompt`、`sharedCardPrompt` 沒有進入可繼續的完成狀態；代表卡片已進入遊戲狀態，但後續操作或清除結案沒有完成。

重現期間觀察到：

- Firestore `commit` 回應 HTTP 400／409。
- 畫面／對話框出現 `the stored version (...) does not match the required base version (...)`。
- Player1 反覆出現 React `Maximum update depth exceeded`。
- 本地 RTDB `/roomLastOnline`、`/roomDiagnostics` 出現 `permission_denied`。

這些錯誤與 H001 未能在期限內結案同時發生，符合多人同步／交易競態的 P1 阻斷特徵。

### 4.3 其餘卡片

因 H001 已達 P1 阻斷，依測試計畫立即停止：

- 已執行：1／160（H001）
- 未執行：159／160
- 幸福卡未執行：45 張
- 機運卡未執行：56 張
- 新聞卡未執行：58 張

未執行項目不代表功能通過或失敗，需在 H001 阻斷修正後重新執行。

## 5. 結果統計

| 結果 | 數量 |
|---|---:|
| A 級 | 1 |
| B 級 | 0 |
| C 級 | 0 |
| 已完成 | 0 |
| 失敗 | 1 |
| 未執行 | 159 |

## 6. 阻斷原因與建議

目前不能只增加重試或延長等待時間，因為快照已呈現事件未清除，且同時有 Firestore 交易版本衝突與 React 更新深度錯誤。建議依序處理：

1. 追查 H001 觸發、翻牌、玩家操作與結案期間的實際 Firestore transaction payload，找出造成 400／409 的競爭寫入者。
2. 檢查 `runRoomBoardMutation` 與 Room／Game Context 的同步回寫，避免收到遠端快照後再次原樣寫回房間。
3. 修正 Player1 的 `Maximum update depth exceeded`，確認 effect 依賴不會在每次快照後重複 setState／回寫。
4. 對齊本地 RTDB Rules 或在本地測試設定正確的 presence／diagnostics 權限，排除額外同步錯誤。
5. 先單獨重跑 H001；H001 能在 120 秒內完成且清除 `currentCard`／`currentEvent` 後，才恢復 160 張全卡片矩陣。

## 7. 證據與原始紀錄

- [Playwright JSON 報告](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/dev/e2e/report/board-card-matrix-local-2026-09-01.json)
- [H001 執行師截圖](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/dev/output/playwright/board-card-matrix-2026-09-01/001-H001/coach.png)
- [H001 Player1 截圖](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/dev/output/playwright/board-card-matrix-2026-09-01/001-H001/player-1.png)
- [H001 Player2 截圖](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/dev/output/playwright/board-card-matrix-2026-09-01/001-H001/player-2.png)
- [H001 Player3 截圖](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/dev/output/playwright/board-card-matrix-2026-09-01/001-H001/player-3.png)
- [H001 Firestore 最終快照](/Users/wcg/程式開發/蜂富人生HappinessFlow/.worktrees/dev/output/playwright/board-card-matrix-2026-09-01/001-H001/room-snapshot.json)

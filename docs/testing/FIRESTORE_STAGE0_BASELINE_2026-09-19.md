# Firestore 優化階段 0：量測基準

日期：2026-09-19  
分支：`dev`  
環境：Firebase Auth／Firestore／Realtime Database Emulator，Playwright Chromium，Vite DEV  
目的：建立本地多人基準，不改變遊戲規則、Firestore schema 或正式部署。

## 已完成

### 量測接點

- `hf_board_command`：命令、transaction duration、讀寫文件數、重試次數、房間／棋盤 payload 大小、trace ID。
- `hf_board_listener_sync`：Firestore snapshot 到達延遲、revision、cache／pending writes 狀態、payload 大小、trace ID。
- `hf_board_ui_ready`：listener 更新後下一個畫面 frame 可用的近似時間、revision、payload 大小、trace ID。
- E2E 報告會收集教練端、投影端及玩家端的 debug telemetry；資料只存在測試輸出的 JSON，不寫入 Firestore 新集合。
- 開發／測試環境使用 bounded in-memory telemetry buffer；正式環境未開啟此 buffer，既有 Analytics 事件仍維持。

### 本地 3 人基準

報告：`e2e/report/board-50-turn-stress.json`

| 指標 | 結果 |
|---|---:|
| 正式回合 | 50／50，通過 |
| telemetry records | 2,741 |
| transaction 命令 | 246 |
| transaction duration p50／p95／max | 60／114／206 ms |
| listener sync lag p50／p95／max | 28／78／7,112 ms |
| UI-ready p50／p95／max | 20／52／113 ms |
| transaction retry | 0 |
| 房間文件平均／最大 | 29,809／44,412 bytes |
| 棋盤 payload 最大 | 41,945 bytes |

### 本地 6 人基準

報告：`e2e/report/board-50-turn-stress-6p-2026-09-19.json`

| 指標 | 結果 |
|---|---:|
| 正式回合 | 50／50，通過 |
| telemetry records | 4,601 |
| transaction 命令 | 246 |
| transaction duration p50／p95／max | 133／438／4,114 ms |
| listener sync lag p50／p95／max | 71／299／14,349 ms |
| UI-ready p50／p95／max | 34／81／216 ms |
| transaction retry | 0 |
| 房間文件平均／最大 | 31,707／46,472 bytes |
| 棋盤 payload 最大 | 42,417 bytes |

## 判讀

- 在本地 Emulator，3 人與 6 人的核心命令沒有 transaction retry，房間文件仍低於 100 KB 目標。
- 6 人 p95 比 3 人上升，但仍低於目前階段 0 的本地觀察門檻；最大值是少數啟動／重連或測試切換樣本，不能直接當成正式網路延遲。
- 目前資料不足以判斷正式站的延遲究竟來自手機網路、Firestore 往返、React render 或短暫競爭；必須取得真實裝置的同一 trace ID。

## 尚未完成

1. 真實手機＋Wi-Fi 與行動網路的 transport A/B：保留與關閉 long polling，各至少 20 次結束回合、擲骰、卡片建立、故事送審及共享回覆。
2. 斷線 10 秒後重連的真實裝置量測，包含重新可操作時間。
3. 正式雲端 3 人短測，以及 6 人＋執行師＋大地圖的正式雲端基準；需使用核准測試帳號，不能以 Emulator 結果代替。
4. 正式雲端的 Firestore 讀取／寫入／刪除帳單數據與同時段其他活動分離。

以上未完成項目不應標記為「已完成階段 0」，也不應據此宣稱正式站已達成 p95 目標。

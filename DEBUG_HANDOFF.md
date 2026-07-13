# DEBUG_HANDOFF

## 錯誤現象

- 玩家完成職業、企業與夢想選擇並進入遊戲後，執行師監控區仍顯示「等待玩家進入遊戲」。
- 該文字只會在執行師已選到玩家、但 `rooms/{roomId}/players/{playerUid}` 沒有可讀狀態時出現。

## 最小重現步驟

1. 執行師建立房間並開始遊戲。
2. 玩家完成職業、企業與夢想選擇。
3. 執行師進入監控頁並選取該玩家。

## 目前錯誤訊息 / log

- UI 顯示「等待玩家進入遊戲」。
- 玩家同步原本使用 `safeAsync`，會把 Firestore 寫入錯誤只留在 console，畫面沒有錯誤提示。
- Firestore Emulator 已證明同一批次可成功建立私有財務文件並更新公開完成狀態，規則不是阻塞點。
- 現場錯誤：`WriteBatch.update() called with invalid data. Unsupported field value: undefined`，位置是 `publicPlayerStates.{uid}`。

## 已嘗試修法

- 執行師路由 effect 已加入 `room.publicPlayerStates` 依賴。
- 玩家完成設定時已改為缺少同步資料就立即寫入，並顯示同步錯誤。
- 公開狀態 helper 已改為先移除 optional `undefined` 欄位。

## 失敗原因

- 上一個修法只處理執行師端重新判斷，沒有證明玩家的私有財務文件確實寫入成功。

## 根因假設

- 玩家完成選擇後仍走一般 800ms 防抖同步；切換到遊戲頁後的連續狀態更新會取消前一個 timeout，造成首次私有財務文件與公開完成狀態延遲或未建立。
- 同步錯誤原本由 `safeAsync` 吞掉，玩家端沒有可見訊息。
- 公開狀態轉換 helper 仍直接保留 optional 欄位的 `undefined`，所以即時同步修法執行時仍然會被 Firestore 拒絕；同一 helper 也被棋盤擲骰交易使用。

## 下一個驗證步驟

- 已完成：公開狀態 helper 清除所有 optional `undefined` 欄位。
- 已完成：公開狀態單元測試 1/1、規則測試 12/12、型別檢查與正式建置。
- 待現場確認：以兩個不同登入帳號建立新房，完成選擇後確認執行師直接顯示財務報表。
- 若仍出現 literal `Quota exceeded`，需等待 Firebase 專案配額重置或調整方案。

## 不准再重複的修法

- 不再只增加執行師端 React effect 依賴。
- 在證明資料已寫入前，不再修改監控頁顯示條件。

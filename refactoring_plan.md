# 重構計畫報告

## 現狀分析
目前專案是一個基於 Vite + React + TypeScript 的單頁應用程式 (SPA)。
主要的核心邏輯大量集中在 `App.tsx` (超過 1600 行)，這導致了以下問題：
1.  **可讀性差**：`App.tsx` 包含了路由邏輯、狀態管理、業務邏輯、UI 渲染以及大量的模態框 (Modals)，使得代碼難以閱讀和導航。
2.  **維護困難**：修改一個小功能（如頭像選擇）可能需要在大文件中尋找相關代碼，容易引入副作用。
3.  **狀態耦合**：所有的狀態 (`gameState`, `currentView`, `user` 等) 都集中在頂層組件，導致不必要的渲染和狀態傳遞複雜化。
4.  **組件複用性低**：許多 UI 區塊（如各個視圖、模態框）是直接寫在 `App.tsx` 的 render 函數中，而非獨立組件。

## 重構目標
1.  **模組化**：將 `App.tsx` 拆分為多個職責單一的模組。
2.  **路由管理**：引入或模擬路由機制，將不同的頁面 (`views`) 拆分為獨立組件。
3.  **狀態管理**：使用 Context API 或簡單的狀態管理庫（如 Zustand）來管理全域狀態，避免 Prop Drilling。
4.  **UI 組件化**：將模態框和複雜的 UI 區塊提取為獨立組件。

## 重構步驟詳解

### 第一階段：目錄結構調整與基礎建設
建立更清晰的目錄結構，為拆分做準備。

*   **`src/components/common`**: 通用 UI 組件 (已部分存在 `components/ui.tsx`，可視情況拆分)。
*   **`src/components/layout`**: 佈局組件 (如 `Header`, `MainLayout`)。
*   **`src/components/modals`**: 所有的彈窗組件 (`AvatarModal`, `TransactionModal`, `PromotionModal` 等)。
*   **`src/views`**: 主要頁面組件 (`Lobby`, `Game`, `History`, `Auth`, `Setup` 等)。
*   **`src/context`**: 狀態管理 Context (`GameContext`, `AuthContext`)。
*   **`src/hooks`**: 自定義 Hooks (`useGameLogic`, `useAuth` 等)。

### 第二階段：提取組件 (逐步進行)

1.  **提取模態框 (Modals)**
    *   將 `showAvatarModal` 相關的 JSX 提取為 `AvatarModal.tsx`。
    *   將 `showTransactionModal` 相關的 JSX 提取為 `TransactionModal.tsx` (這部分邏輯較重，需小心處理 `onTransaction` 回調)。
    *   將其他簡單模態框 (`PaydayModal`, `MedicalClaimModal`, `PromotionModal` 等) 逐一提取。

2.  **提取頁面視圖 (Views)**
    *   **`AuthView`**: 包含 `auth_home`, `login`, `register` 的邏輯。
    *   **`LobbyView`**: 包含大廳顯示邏輯。
    *   **`SetupView`**: 包含 `create_report`, `profession_select`, `enterprise_select`, `dream_select` 的流程。
    *   **`GameView`**: 核心遊戲界面。
    *   **`HistoryView`**: 歷史紀錄界面。
    *   **`AchievementsView`**: 成就界面。

    *做法：* 每個 View 接收必要的 Props，或者通過 Context 獲取狀態。

### 第三階段：狀態管理優化 (Context API)

1.  **`GameProvider`**:
    *   將 `gameState`, `setGameState`, `gameHistory` 等核心遊戲狀態移入 `GameContext`。
    *   提供 `useGame` hook 供子組件存取數據。
    *   將複雜的邏輯函數 (如 `handleTransactionSubmit`) 移入 Hook 或 Context 中，或拆分為獨立的 Service 函數。

2.  **`AuthProvider`**:
    *   將 `user`, `auth` 相關邏輯移入 `AuthContext`。

### 第四階段：`App.tsx` 瘦身

*   `App.tsx` 最終應該只負責：
    *   Providers 的包裹 (`GameProvider`, `AuthProvider`)。
    *   頂層佈局控制 (Layout)。
    *   根據 `currentView` 渲染對應的 `View` 組件 (路由分發)。

## 具體行動建議 (Action Plan)

建議按照以下順序執行，以降低風險：

1.  **建立 Context (優先)**: 創建 `GameContext`，將 `gameState` 和主要操作函數搬移進去。這是最關鍵的一步，能解耦組件間的依賴。
2.  **拆分 Modals**: 這部分相對獨立，風險較低。先將 `AvatarModal` 等簡單組件拆出去。
3.  **拆分 Views**: 將 `return` 中的各個 `if (currentView === ...)` 區塊提取為獨立組件檔案。
4.  **邏輯抽離**: 將 `handleTransactionSubmit` 這種巨型函數抽離到 `src/logic/transactionLogic.ts` 或類似位置，保持 UI 組件純淨。

## 預期成果
*   `App.tsx` 行數減少至 200 行以內。
*   項目結構清晰，新功能開發只需關注特定的 View 或 Component。
*   代碼複用率提高，維護成本降低。

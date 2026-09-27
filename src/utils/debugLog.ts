/**
 * 可關閉的除錯記錄，取代散落在正式程式碼裡的追蹤用 console.log／console.warn。
 *
 * 開發環境（`vite dev`）預設輸出；正式環境預設安靜，但可在瀏覽器 console 執行
 * `localStorage.setItem('hf_debug_log', 'true')` 後重新整理頁面，不需重新部署
 * 就能臨時打開，方便協助排查正式環境問題。
 *
 * 注意：catch 區塊裡回報真正錯誤的 `console.error` 不受這個開關影響，維持原樣。
 */
const STORAGE_KEY = 'hf_debug_log';

export const isDebugLogEnabled = (): boolean => {
    if (import.meta.env.DEV) return true;
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};

export const debugLog = (...args: unknown[]): void => {
    if (!isDebugLogEnabled()) return;
    console.log(...args);
};

export const debugWarn = (...args: unknown[]): void => {
    if (!isDebugLogEnabled()) return;
    console.warn(...args);
};

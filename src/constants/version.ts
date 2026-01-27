/**
 * 版本號管理
 * 根據環境自動切換後綴：
 * 1. 正式版 (happinessflow.vercel.app): 無後綴
 * 2. 測試版 (Vercel Preview): -beta
 * 3. 開發/本地版 (localhost / happinessflow-dev.vercel.app): -dev
 */

const BASE_VERSION = 'v1.3.1';

/**
 * 在此手動切換對外網址的顯示後綴：
 * ''      => 正式版 (無後綴)
 * '-beta' => 測試版
 */
const MANUAL_SUFFIX: '' | '-beta' = '-beta'; 

export const APP_VERSION = (() => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  
  // 判斷是否為本地環境、手機區網或行動網路連線
  const isLocal = hostname === 'localhost' || 
                  hostname.startsWith('192.168.') || 
                  hostname.startsWith('172.') ||      // 某些手機熱點網段
                  hostname.startsWith('10.') ||       // 某些內網網段
                  hostname.startsWith('169.254.') ||  // 自連結網段 (常見於手機連線)
                  hostname.startsWith('127.0.0.1') ||
                  hostname.endsWith('.local');
  
  const isDevSite = hostname.includes('happinessflow-dev');
  
  // 本地環境、手機行動網路連線與開發專屬網址一律顯示 -dev
  if (isLocal || isDevSite) return `${BASE_VERSION}-dev`;
  
  // 其餘對外網址則根據上面的 MANUAL_SUFFIX 設定 (正式版或測試版)
  return `${BASE_VERSION}${MANUAL_SUFFIX}`;
})();

export const VERSION_DISPLAY = APP_VERSION;

// 新增版本類型判斷，方便 UI 顯示顏色
export const IS_DEV_VERSION = APP_VERSION.endsWith('-dev');

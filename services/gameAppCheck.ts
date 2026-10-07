import type { FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

export function initializeGameAppCheck(app: FirebaseApp) {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true') return;
  const siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
  if (!siteKey) {
    if (import.meta.env.VITE_SERVER_GAME_ROOMS === 'true') {
      throw new Error('後端模式尚未配置 App Check 網站金鑰，請完成部署設定');
    }
    return;
  }
  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

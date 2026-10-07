import { afterEach, expect, it, vi } from 'vitest';
import type { FirebaseApp } from 'firebase/app';
const sdk = vi.hoisted(() => ({ initialize: vi.fn(), provider: vi.fn(function(key: string) { return { key }; }) }));
vi.mock('firebase/app-check', () => ({ initializeAppCheck: sdk.initialize, ReCaptchaEnterpriseProvider: sdk.provider }));
import { initializeGameAppCheck } from '../../services/gameAppCheck';
const app = {} as FirebaseApp;
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it('initializes configured cloud App Check with automatic refresh', () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_APPCHECK_SITE_KEY', 'test-public-key');
  initializeGameAppCheck(app);
  expect(sdk.initialize).toHaveBeenCalledWith(app, { provider: { key: 'test-public-key' }, isTokenAutoRefreshEnabled: true });
});
it('never contacts App Check in a local emulator session', () => {
  vi.stubEnv('DEV', true); vi.stubEnv('VITE_USE_EMULATOR', 'true'); vi.stubEnv('VITE_APPCHECK_SITE_KEY', 'test-public-key');
  initializeGameAppCheck(app); expect(sdk.initialize).not.toHaveBeenCalled();
});
it('rejects missing cloud configuration for server rooms without disabling enforcement', () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_USE_EMULATOR', 'true'); vi.stubEnv('VITE_APPCHECK_SITE_KEY', ''); vi.stubEnv('VITE_SERVER_GAME_ROOMS', 'true');
  expect(() => initializeGameAppCheck(app)).toThrow('App Check'); expect(sdk.initialize).not.toHaveBeenCalled();
});
it('preserves legacy cloud mode without configured App Check', () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_APPCHECK_SITE_KEY', ''); vi.stubEnv('VITE_SERVER_GAME_ROOMS', 'false');
  initializeGameAppCheck(app); expect(sdk.initialize).not.toHaveBeenCalled();
});

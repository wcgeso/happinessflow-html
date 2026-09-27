import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debugLog, debugWarn, isDebugLogEnabled } from './debugLog';

describe('debugLog / debugWarn', () => {
  const originalDev = import.meta.env.DEV;

  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (import.meta.env as any).DEV = originalDev;
  });

  it('在開發環境（import.meta.env.DEV）永遠輸出', () => {
    (import.meta.env as any).DEV = true;
    expect(isDebugLogEnabled()).toBe(true);
    debugLog('hello');
    debugWarn('careful');
    expect(console.log).toHaveBeenCalledWith('hello');
    expect(console.warn).toHaveBeenCalledWith('careful');
  });

  it('正式環境預設安靜，開啟 localStorage 旗標後才輸出', () => {
    (import.meta.env as any).DEV = false;
    expect(isDebugLogEnabled()).toBe(false);
    debugLog('should not print');
    expect(console.log).not.toHaveBeenCalled();

    window.localStorage.setItem('hf_debug_log', 'true');
    expect(isDebugLogEnabled()).toBe(true);
    debugLog('now it prints');
    expect(console.log).toHaveBeenCalledWith('now it prints');
  });
});

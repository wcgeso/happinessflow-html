import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardMovementState } from '../types';
import { useMovementSettlement } from './useMovementSettlement';
vi.mock('../utils/serverClock', () => ({ serverNow: () => Date.now() }));
const movement = { playerUid: 'p1', startedAt: 1000, path: [6], stepDurationMs: 380,
    introDelayMs: 600, landingDelayMs: 600, isActive: true } as BoardMovementState;
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('movement recovery scheduling', () => {
    it('takes over on a timer while the host remains online and recovers after a failed attempt', async () => {
        vi.useFakeTimers(); vi.setSystemTime(1000);
        const settle = vi.fn().mockRejectedValueOnce({ code: 'permission-denied' }).mockResolvedValue(undefined);
        const { result, unmount } = renderHook(() => useMovementSettlement({ scope: 'room:leg1', movement,
            actorUid: 'p1', hostUid: 'host', enabled: true, settle }));
        await act(async () => { await vi.advanceTimersByTimeAsync(3829); });
        expect(settle).not.toHaveBeenCalled();
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(settle).toHaveBeenCalledTimes(1);
        expect(result.current.error).toContain('permission-denied');
        await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
        expect(settle).toHaveBeenCalledTimes(1);
        await act(async () => { window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0); });
        expect(settle).toHaveBeenCalledTimes(2);
        expect(result.current.error).toBeNull();
        unmount();
    });
    it('cancels old-event timers and never duplicates an in-flight retry', async () => {
        vi.useFakeTimers(); vi.setSystemTime(1000);
        let finish!: () => void;
        const settle = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
        const { result, rerender, unmount } = renderHook(({ active }) => useMovementSettlement({ scope: active ? 'leg1' : 'leg2',
            movement: active ? movement : null, actorUid: 'p1', hostUid: 'host', enabled: active, settle }), { initialProps: { active: true } });
        await act(async () => { await vi.advanceTimersByTimeAsync(3830); });
        await act(async () => { void result.current.retry(); });
        expect(settle).toHaveBeenCalledTimes(1);
        rerender({ active: false });
        await act(async () => { finish(); await vi.advanceTimersByTimeAsync(10000); });
        expect(result.current.error).toBeNull();
        expect(settle).toHaveBeenCalledTimes(1);
        unmount();
    });
});

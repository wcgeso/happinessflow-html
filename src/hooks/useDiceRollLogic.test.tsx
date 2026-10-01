import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDiceRollLogic } from './useDiceRollLogic';

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    gameState: {
      currentRankLevel: 1,
      currentRankTitle: '初階',
      profession: { promotions: [{ bonus: 1000, rankTitle: '進階' }] },
    },
  }),
}));

describe('useDiceRollLogic remote roll', () => {
  it('leaves the rolling state after the authoritative result returns', async () => {
    const onComplete = vi.fn();
    const remoteRoll = vi.fn().mockResolvedValue({
      roll: 6,
      target: 2,
      success: true,
      bonus: 1000,
      newTitle: '進階',
    });
    const { result } = renderHook(() => useDiceRollLogic(onComplete, String, 'normal', remoteRoll));

    await act(async () => {
      await result.current.handleDiceRoll();
    });

    expect(result.current.isRolling).toBe(false);
    expect(result.current.examResult).toBe('success');
    expect(onComplete).toHaveBeenCalledWith(true, 1000, '進階');
  });

  it('waits for the big-screen presentation before revealing a remote exam result', async () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      const remoteRoll = vi.fn().mockResolvedValue({
        roll: 6,
        target: 2,
        success: true,
        bonus: 1000,
        newTitle: '進階',
        presentationDurationMs: 1000,
      });
      const { result } = renderHook(() => useDiceRollLogic(onComplete, String, 'normal', remoteRoll));
      let rollPromise: Promise<void> | undefined;

      await act(async () => {
        rollPromise = result.current.handleDiceRoll();
        await Promise.resolve();
      });

      expect(result.current.isRolling).toBe(true);
      expect(result.current.examResult).toBe('idle');
      expect(onComplete).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(999);
      });
      expect(result.current.examResult).toBe('idle');

      await act(async () => {
        vi.advanceTimersByTime(1);
        await rollPromise;
      });
      expect(result.current.isRolling).toBe(false);
      expect(result.current.examResult).toBe('success');
      expect(onComplete).toHaveBeenCalledWith(true, 1000, '進階');
    } finally {
      vi.useRealTimers();
    }
  });
});

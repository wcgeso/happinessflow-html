import {act, renderHook} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {usePendingAction} from './usePendingAction';

it('marks the action pending at once and drops repeated taps until it settles', async () => {
  const {result} = renderHook(() => usePendingAction());
  let finish!: () => void;
  const submit = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const click = result.current.run('shared', submit);
  let first!: Promise<unknown>;
  act(() => { first = click(); void click(); void click(); });
  expect(submit).toHaveBeenCalledTimes(1);
  expect(result.current.isPending('shared')).toBe(true);
  await act(async () => { finish(); await first; });
  expect(result.current.isPending('shared')).toBe(false);
});

it('releases the button after a failure so the player can retry', async () => {
  const {result} = renderHook(() => usePendingAction());
  const submit = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce('ok');
  await act(async () => { await expect(result.current.run('card', submit)()).rejects.toThrow('unavailable'); });
  expect(result.current.isPending('card')).toBe(false);
  await act(async () => { await expect(result.current.run('card', submit)()).resolves.toBe('ok'); });
  expect(submit).toHaveBeenCalledTimes(2);
});

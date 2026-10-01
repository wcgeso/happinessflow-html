import { expect, it, vi } from 'vitest';
import { runLockedBoardCommand } from './commandLock';
it('shares same-command work, rejects another command, and releases after failure', async () => {
  const pending = new Map<string, Promise<unknown>>();
  let reject!: (error: Error) => void;
  const action = vi.fn(() => new Promise<boolean>((_, r) => { reject = r; }));
  const first = runLockedBoardCommand(pending, 'bank:1', action);
  expect(runLockedBoardCommand(pending, 'bank:1', action)).toBe(first);
  await expect(runLockedBoardCommand(pending, 'card:2', action)).rejects.toMatchObject({code: 'busy'});
  expect(action).toHaveBeenCalledTimes(1);
  reject(new Error('unavailable'));
  await expect(first).rejects.toThrow('unavailable');
  expect(pending.size).toBe(0);
  await expect(runLockedBoardCommand(pending, 'bank:1', async () => true)).resolves.toBe(true);
});

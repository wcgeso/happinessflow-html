import { expect, it, vi } from 'vitest';
import { MAX_LOCKED_COMMANDS, runLockedBoardCommand } from './commandLock';
it('shares same-command work, queues another command, and releases after failure', async () => {
  const pending = new Map<string, Promise<unknown>>();
  let reject!: (error: Error) => void;
  const action = vi.fn(() => new Promise<boolean>((_, r) => { reject = r; }));
  const first = runLockedBoardCommand(pending, 'bank:1', action);
  expect(runLockedBoardCommand(pending, 'bank:1', action)).toBe(first);
  const next = vi.fn(async () => 'card');
  const queued = runLockedBoardCommand(pending, 'card:2', next);
  await Promise.resolve();
  expect(action).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
  reject(new Error('unavailable'));
  await expect(first).rejects.toThrow('unavailable');
  await expect(queued).resolves.toBe('card');
  expect(next).toHaveBeenCalledTimes(1);
  expect(pending.size).toBe(0);
  await expect(runLockedBoardCommand(pending, 'bank:1', async () => true)).resolves.toBe(true);
});

it('runs queued commands in click order', async () => {
  const pending = new Map<string, Promise<unknown>>();
  const order: string[] = [];
  let release!: () => void;
  const first = runLockedBoardCommand(pending, 'roll:1', () => new Promise<void>(r => { release = () => { order.push('roll'); r(); }; }));
  const second = runLockedBoardCommand(pending, 'reveal:1', async () => { order.push('reveal'); });
  const third = runLockedBoardCommand(pending, 'turn-end:1', async () => { order.push('turn-end'); });
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  release();
  await Promise.all([first, second, third]);
  expect(order).toEqual(['roll', 'reveal', 'turn-end']);
});

it('still answers immediately for callers that pass onBusy, and caps the queue', async () => {
  const pending = new Map<string, Promise<unknown>>();
  const hang = () => new Promise<never>(() => undefined);
  void runLockedBoardCommand(pending, 'bank:1', hang);
  await expect(runLockedBoardCommand(pending, 'bank:2', hang, () => 'busy')).resolves.toBe('busy');
  for (let i = 2; i <= MAX_LOCKED_COMMANDS; i++) void runLockedBoardCommand(pending, `card:${i}`, hang);
  await expect(runLockedBoardCommand(pending, 'card:overflow', hang)).rejects.toMatchObject({ code: 'busy' });
});

import { describe, expect, it } from 'vitest';
import { applyBoardCommand, requireBoardRevision } from './boardRevision';

describe('board command guard', () => {
  it('advances once and treats a repeated command as a duplicate', () => {
    const first = applyBoardCommand<{ revision?: number }>({}, 'command-1');
    expect(first.boardState.revision).toBe(1);
    const second = applyBoardCommand(first.boardState, 'command-1');
    expect(second.duplicate).toBe(true);
    expect(second.boardState.revision).toBe(1);
  });

  it('rejects a stale revision', () => {
    expect(() => requireBoardRevision({ revision: 4 }, 3)).toThrow('棋盤狀態已更新');
  });
});

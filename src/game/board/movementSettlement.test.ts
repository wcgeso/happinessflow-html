import { describe, expect, it } from 'vitest';
import type { BoardMovementState, BoardState } from '../../types';
import { canSettleMovement, movementCommandId, movementEndsAt } from './movementSettlement';

describe('movement settlement eligibility', () => {
    const movement = { playerUid: 'p1', startedAt: 1000, path: [5, 6], introDelayMs: 600,
        stepDurationMs: 380, landingDelayMs: 600, isActive: true } as BoardMovementState;
    const board = { currentTurnUid: 'p1', movement } as BoardState;
    it('lets the host settle normally and the player take over after grace even while the host is online', () => {
        const end = movementEndsAt(movement);
        expect(canSettleMovement(board, movement, 'host', 'host', end)).toBe(true);
        expect(canSettleMovement(board, movement, 'p1', 'host', end + 1999)).toBe(false);
        expect(canSettleMovement(board, movement, 'p1', 'host', end + 2000)).toBe(true);
        expect(canSettleMovement(board, movement, 'p2', 'host', end + 2000)).toBe(false);
    });
    it('rejects expired turns, replaced movement and duplicate settlement', () => {
        expect(canSettleMovement({ ...board, currentTurnUid: 'p2' }, movement, 'p1', 'host', 10000)).toBe(false);
        expect(canSettleMovement({ ...board, movement: { ...movement, startedAt: 2 } }, movement, 'p1', 'host', 10000)).toBe(false);
        expect(canSettleMovement({ ...board, movement: null }, movement, 'host', 'host', 10000)).toBe(false);
        expect(movementCommandId(movement)).toBe(movementCommandId({ ...movement }));
    });
});

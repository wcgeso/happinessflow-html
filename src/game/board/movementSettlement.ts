import type { BoardMovementState, BoardState } from '../../types';

export const MOVEMENT_TAKEOVER_GRACE_MS = 2000;
export const movementCommandId = (movement: BoardMovementState) =>
    `movement:${movement.playerUid}:${movement.startedAt}:settle`;
export const movementEndsAt = (movement: BoardMovementState) => movement.startedAt
    + movement.introDelayMs + movement.path.length * movement.stepDurationMs + movement.landingDelayMs;

export const settlementDueAt = (movement: BoardMovementState, actorUid: string, hostUid: string) =>
    movementEndsAt(movement) + (actorUid === hostUid ? 0 : MOVEMENT_TAKEOVER_GRACE_MS);

export const canSettleMovement = (
    board: BoardState, expected: BoardMovementState, actorUid: string, hostUid: string, now: number,
) => {
    const movement = board.movement;
    return !!movement?.isActive && movement.playerUid === expected.playerUid
        && movement.startedAt === expected.startedAt && board.currentTurnUid === expected.playerUid
        && (actorUid === hostUid || actorUid === movement.playerUid)
        && now >= settlementDueAt(movement, actorUid, hostUid);
};

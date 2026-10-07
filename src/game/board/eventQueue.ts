import type {Room, BoardState, BoardQueuedEvent, BoardCardLogEntry, BoardCardResult, BoardEventLog} from '../../types';
import {serverNow} from '../../utils/serverClock';
import {cleanObject} from '../../utils/utils';
import {hasIncompleteSharedPrompts} from './promptCompletion';
import {getSquareByIndex} from '../../constants/board';
const BOARD_MOVE_CONTINUE_DELAY_MS = 500;
// Only the latest 12 entries are ever shown (player statement, big screen); storing more only
// grew the room document that every device downloads on each update.
export const BOARD_CARD_LOG_LIMIT = 12;

export const activateBoardQueueEntry = (entry?: BoardQueuedEvent | null) => ({
    currentEvent: entry?.event || null,
    currentCard: entry?.card || null,
    currentCardReveal: entry?.card ? {
        eventId: entry.event.id,
        cardId: entry.card.cardId,
        isRevealed: false
    } : null
});

export const splitMovementLeg = (
    steps: number[],
    effects: ReadonlyArray<{ squareIndex: number }> = []
): { legPath: number[]; remainingPath: number[] } => {
    const repairSquares = new Set(effects.map(effect => effect.squareIndex));
    for (let i = 0; i < steps.length - 1; i += 1) {
        const square = getSquareByIndex(steps[i]);
        if (
            square.type === 'bank' ||
            square.type === 'school' ||
            (square.type === 'repair' && repairSquares.has(steps[i]))
        ) {
            return { legPath: steps.slice(0, i + 1), remainingPath: steps.slice(i + 1) };
        }
    }
    return { legPath: steps, remainingPath: [] };
};

export const buildBoardEventAdvanceState = (roomData: Room) => {
    const boardState = roomData.boardState;
    if (!boardState) return null;

    if (hasIncompleteSharedPrompts(boardState) || (boardState.pendingContinuation && boardState.pendingContinuation.phase !== 'completed')) return null;

    const queue = [...(boardState.pendingEvents || [])];
    const nextEntry = queue.shift() || null;

    if (nextEntry) {
        return cleanObject({
            boardState: {
                ...boardState,
                ...activateBoardQueueEntry(nextEntry),
                familyMilestoneJoinPrompt: undefined,
                sharedCardPrompt: undefined,
                sharedExpenseEffect: null,
                pendingEvents: queue,
                updatedAt: serverNow()
            }
        });
    }

    // 事件佇列清空後，檢查這位玩家是不是還有上一段「經過事件」停靠後
    // 剩下的步數要繼續走（大富翁式的分段移動）；有的話直接接續下一段動畫，
    // 沒有的話回合改由玩家自己按「結束回合」才真正切換，currentTurnUid 維持不變。
    const pendingMovement = boardState.movement;
    if (pendingMovement && !pendingMovement.isActive && pendingMovement.path.length > 0) {
        const { legPath, remainingPath } = splitMovementLeg(pendingMovement.path, pendingMovement.effects);

        return cleanObject({
            boardState: {
                ...boardState,
                ...activateBoardQueueEntry(null),
                familyMilestoneJoinPrompt: undefined,
                sharedCardPrompt: undefined,
                sharedExpenseEffect: null,
                pendingEvents: [],
                movement: {
                    ...pendingMovement,
                    startPosition: boardState.playerPositions?.[pendingMovement.playerUid] ?? pendingMovement.startPosition,
                    path: legPath,
                    remainingPath: remainingPath.length > 0 ? remainingPath : undefined,
                    startedAt: serverNow(),
                    introDelayMs: BOARD_MOVE_CONTINUE_DELAY_MS,
                    isActive: true
                },
                updatedAt: serverNow()
            }
        });
    }

    return cleanObject({
        boardState: {
            ...boardState,
            ...activateBoardQueueEntry(null),
            familyMilestoneJoinPrompt: undefined,
            sharedCardPrompt: undefined,
            sharedExpenseEffect: null,
            pendingEvents: [],
            movement: null,
            updatedAt: serverNow()
        }
    });
};

export const appendBoardCardLog = (
    boardState: BoardState,
    card: BoardCardResult | null,
    event: BoardEventLog | null
) => {
    if (!card || !event) {
        return boardState.cardLog || [];
    }

    const nextEntry: BoardCardLogEntry = {
        ...card,
        id: `${event.id}_${card.cardId}`,
        eventId: event.id,
        playerUid: event.playerUid,
        playerName: event.playerName,
        summary: event.summary,
        drawnAt: event.timestamp
    };

    return [
        nextEntry,
        ...(boardState.cardLog || []).filter(entry => entry.id !== nextEntry.id)
    ].slice(0, BOARD_CARD_LOG_LIMIT);
};


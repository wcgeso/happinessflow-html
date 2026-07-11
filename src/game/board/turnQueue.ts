import { BoardQueuedEvent, BoardState } from '../../types';

export const activateBoardQueueEntry = (entry?: BoardQueuedEvent | null) => ({
    currentEvent: entry?.event || null,
    currentCard: entry?.card || null,
    currentCardReveal: entry?.card ? {
        eventId: entry.event.id,
        cardId: entry.card.cardId,
        isRevealed: false
    } : null
});

export const shiftBoardQueue = (boardState: BoardState) => {
    const queue = [...(boardState.pendingEvents || [])];
    const nextEntry = queue.shift() || null;

    return {
        ...activateBoardQueueEntry(nextEntry),
        pendingEvents: queue
    };
};

const getNextTurn = (boardState: BoardState) => {
    const skipTurns = { ...boardState.skipTurns };
    if (!boardState.turnOrder.length) {
        return { nextUid: boardState.currentTurnUid, skipTurns };
    }

    let index = boardState.currentTurnUid
        ? boardState.turnOrder.indexOf(boardState.currentTurnUid)
        : -1;

    for (let attempts = 0; attempts < boardState.turnOrder.length; attempts += 1) {
        index = (index + 1) % boardState.turnOrder.length;
        const nextUid = boardState.turnOrder[index];
        if ((skipTurns[nextUid] || 0) > 0) {
            skipTurns[nextUid] -= 1;
            continue;
        }
        return { nextUid, skipTurns };
    }

    return { nextUid: boardState.currentTurnUid, skipTurns };
};

export const commitTurnIfQueueEmpty = (boardState: BoardState): BoardState => {
    if (boardState.currentEvent || (boardState.pendingEvents?.length || 0) > 0) {
        return boardState;
    }

    const nextTurn = getNextTurn(boardState);
    return {
        ...boardState,
        currentTurnUid: nextTurn.nextUid,
        skipTurns: nextTurn.skipTurns
    };
};

export const completeCurrentEvent = (boardState: BoardState): BoardState => {
    if (!boardState.currentEvent && !(boardState.pendingEvents?.length || 0)) {
        return boardState;
    }

    return commitTurnIfQueueEmpty({
        ...boardState,
        ...shiftBoardQueue(boardState)
    });
};

import { describe, expect, it } from 'vitest';
import { commitTurnIfQueueEmpty, completeCurrentEvent } from './turnQueue';
import { BoardEventLog, BoardQueuedEvent, BoardState } from '../../types';

const event = (id: string): BoardEventLog => ({
    id,
    playerUid: 'player-a',
    playerName: 'Player A',
    type: 'card',
    summary: id,
    squareIndex: 1,
    timestamp: 1
});

const boardState = (currentEvent: BoardEventLog | null, pendingEvents: BoardQueuedEvent[] = []): BoardState => ({
    currentTurnUid: 'player-a',
    turnOrder: ['player-a', 'player-b'],
    playerPositions: { 'player-a': 1, 'player-b': 1 },
    skipTurns: { 'player-a': 0, 'player-b': 0 },
    lastRoll: null,
    currentCard: null,
    currentEvent,
    pendingEvents,
    deckState: { happiness: [], opportunity: [], news: [], usedHappiness: [], usedOpportunity: [], usedNews: [] },
    updatedAt: 1
});

describe('board turn queue', () => {
    it('keeps the current player while the next queued event becomes current', () => {
        const result = completeCurrentEvent(boardState(event('bank'), [{ event: event('card') }]));

        expect(result.currentTurnUid).toBe('player-a');
        expect(result.currentEvent?.id).toBe('card');
        expect(result.pendingEvents).toEqual([]);
    });

    it('switches turns only after the final event is completed', () => {
        const result = completeCurrentEvent(boardState(event('card')));

        expect(result.currentEvent).toBeNull();
        expect(result.pendingEvents).toEqual([]);
        expect(result.currentTurnUid).toBe('player-b');
    });

    it('does not switch a second time when an already empty queue is completed again', () => {
        const completed = completeCurrentEvent(boardState(event('card')));
        const repeated = completeCurrentEvent(completed);

        expect(repeated.currentTurnUid).toBe('player-b');
    });

    it('consumes a skipped next turn only when the queue is empty', () => {
        const withSkip = {
            ...boardState(event('card')),
            skipTurns: { 'player-a': 0, 'player-b': 1 }
        };

        const result = commitTurnIfQueueEmpty({ ...withSkip, currentEvent: null });

        expect(result.currentTurnUid).toBe('player-a');
        expect(result.skipTurns['player-b']).toBe(0);
    });
});

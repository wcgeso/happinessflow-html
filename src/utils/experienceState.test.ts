import { describe, expect, it } from 'vitest';
import type { BoardState } from '../types';
import { getBoardActionAvailability, selectExperienceState } from './experienceState';

const boardState = (overrides: Partial<BoardState> = {}): BoardState => ({
  currentTurnUid: 'p1',
  turnOrder: ['p1', 'p2'],
  playerPositions: { p1: 0, p2: 0 },
  skipTurns: { p1: 1, p2: 0 },
  hasRolledThisTurn: false,
  lastRoll: null,
  currentCard: null,
  currentEvent: null,
  pendingEvents: [],
  movement: null,
  deckState: {
    happiness: [],
    opportunity: [],
    news: [],
    usedHappiness: [],
    usedOpportunity: [],
    usedNews: [],
  },
  updatedAt: 1,
  ...overrides,
});

describe('experience state', () => {
  it('keeps turn summary and action permissions derived from board state', () => {
    const state = selectExperienceState({
      roomStatus: 'playing',
      isBoardGame: true,
      hostId: 'coach',
      currentUid: 'p1',
      members: [{ uid: 'p1', name: '玩家 A' }, { uid: 'p2', name: '玩家 B' }],
      boardState: boardState({ hasRolledThisTurn: true }),
    });

    expect(state.currentTurnName).toBe('玩家 A');
    expect(state.turnPosition).toBe(1);
    expect(state.participantCount).toBe(2);
    expect(state.pendingSkipTurns).toBe(1);
    expect(state.actionAvailability.canEndTurn).toBe(true);
    expect(state.actionAvailability.canRoll).toBe(false);
    expect(state.actionAvailability.rollBlocker?.code).toBe('already_rolled');
  });

  it('blocks ending a turn while a shared prompt is incomplete', () => {
    const availability = getBoardActionAvailability({
      roomStatus: 'playing',
      isBoardGame: true,
      currentUid: 'p1',
      boardState: boardState({
        hasRolledThisTurn: true,
        sharedCardPrompt: {
          id: 'prompt-1',
          kind: 'expense_adjustment',
          sourceEventId: 'event-1',
          sourceCardId: 'C047',
          sourcePlayerUid: 'p1',
          sourcePlayerName: '玩家 A',
          targetPlayerUids: ['p2'],
          responses: {},
          createdAt: 1,
        },
      }),
    });

    expect(availability.canEndTurn).toBe(false);
    expect(availability.endTurnBlocker).toEqual({
      code: 'shared_prompt_pending',
      message: '還有玩家尚未完成共享事件回覆',
    });
  });
});

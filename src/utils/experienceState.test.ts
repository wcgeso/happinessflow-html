import { describe, expect, it } from 'vitest';
import type { BoardState } from '../types';
import { clearBoardFlowState, getBoardActionAvailability, getNextBoardTurn, selectExperienceState } from './experienceState';

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
  it('clears blocking flow state without changing the current turn or roll result', () => {
    const current = boardState({
      hasRolledThisTurn: true,
      currentEvent: { id: 'event-1' } as BoardState['currentEvent'],
      pendingEvents: [{ event: { id: 'event-2' }, card: null } as BoardState['pendingEvents'][number]],
      movement: { isActive: true } as BoardState['movement'],
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
    });

    const cleared = clearBoardFlowState(current, 2);

    expect(cleared.currentTurnUid).toBe('p1');
    expect(cleared.hasRolledThisTurn).toBe(true);
    expect(cleared.currentEvent).toBeNull();
    expect(cleared.pendingEvents).toEqual([]);
    expect(cleared.movement).toBeNull();
    expect(cleared.sharedCardPrompt).toBeNull();
    expect(cleared.updatedAt).toBe(2);
  });

  it('skips paused players once and selects the next available player', () => {
    const twoPlayers = getNextBoardTurn(boardState({
      currentTurnUid: 'p1',
      turnOrder: ['p1', 'p2'],
      skipTurns: { p1: 0, p2: 1 },
    }));
    const threePlayers = getNextBoardTurn(boardState({
      currentTurnUid: 'p1',
      turnOrder: ['p1', 'p2', 'p3'],
      playerPositions: { p1: 0, p2: 0, p3: 0 },
      skipTurns: { p1: 0, p2: 1, p3: 0 },
    }));

    expect(twoPlayers).toEqual({
      nextUid: 'p1',
      skipTurns: { p1: 0, p2: 0 },
      skippedUids: ['p2'],
    });
    expect(threePlayers?.nextUid).toBe('p3');
    expect(threePlayers?.skippedUids).toEqual(['p2']);
  });

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

  it('blocks rolling and ending before the coach starts the game', () => {
    const availability = getBoardActionAvailability({
      roomStatus: 'waiting',
      isBoardGame: true,
      currentUid: 'p1',
      boardState: boardState(),
    });

    expect(availability.canRoll).toBe(false);
    expect(availability.canEndTurn).toBe(false);
    expect(availability.rollBlocker).toEqual({
      code: 'game_not_started',
      message: '請等待執行師開始遊戲',
    });
  });

  it('blocks rolling while the coach has not started the game timer', () => {
    const paused = getBoardActionAvailability({
      roomStatus: 'playing',
      isTimerPaused: true,
      isBoardGame: true,
      currentUid: 'p1',
      boardState: boardState(),
    });
    const started = getBoardActionAvailability({
      roomStatus: 'playing',
      isTimerPaused: false,
      isBoardGame: true,
      currentUid: 'p1',
      boardState: boardState(),
    });

    expect(paused.canRoll).toBe(false);
    expect(paused.rollBlocker).toEqual({
      code: 'game_paused',
      message: '請等待執行師開始或繼續遊戲',
    });
    expect(started.canRoll).toBe(true);
  });
});

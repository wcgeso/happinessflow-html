import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../types';
import { getProjectionActionState } from './boardProjectionStatus';

const state = (overrides: Partial<BoardState> = {}): BoardState => ({
  currentTurnUid: 'p1',
  turnOrder: ['p1', 'p2'],
  playerPositions: { p1: 0, p2: 0 },
  skipTurns: {},
  hasRolledThisTurn: false,
  lastRoll: null,
  currentCard: null,
  currentEvent: null,
  pendingEvents: [],
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

describe('getProjectionActionState', () => {
  it('uses the required display priority', () => {
    const boardState = state({
      skippedTurnNotice: { playerUids: ['p1'], nextTurnUid: 'p2', timestamp: 1 },
      movement: { playerUid: 'p1', startPosition: 0, path: [1], rollTotal: 1, dice: [1], startedAt: 1, stepDurationMs: 400, introDelayMs: 0, landingDelayMs: 0, isActive: true },
      currentCard: { deck: 'news', cardId: 'N001', title: '新聞', description: '' },
      currentEvent: { id: 'event', playerUid: 'p1', playerName: '玩家一', summary: '事件', squareIndex: 1, timestamp: 1 },
      hasRolledThisTurn: true,
    });

    expect(getProjectionActionState({ boardState, roomStatus: 'playing' }).kind).toBe('paused');
    expect(getProjectionActionState({ boardState: state({ ...boardState, skippedTurnNotice: null }), roomStatus: 'playing' }).kind).toBe('moving');
    expect(getProjectionActionState({ boardState: state({ ...boardState, skippedTurnNotice: null, movement: null }), roomStatus: 'playing' }).kind).toBe('card');
    expect(getProjectionActionState({ boardState: state({ ...boardState, skippedTurnNotice: null, movement: null, currentCard: null }), roomStatus: 'playing' }).kind).toBe('event');
  });

  it('shows shared waiting count, end turn, roll and waiting start', () => {
    const shared = state({
      sharedCardPrompt: {
        id: 'shared',
        kind: 'asset_sale',
        sourceEventId: 'event',
        sourceCardId: 'C001',
        sourcePlayerUid: 'p1',
        sourcePlayerName: '玩家一',
        targetPlayerUids: ['p1', 'p2'],
        responses: { p1: { playerUid: 'p1', playerName: '玩家一', status: 'declined', respondedAt: 1 } },
        createdAt: 1,
      },
    });

    expect(getProjectionActionState({ boardState: shared, roomStatus: 'playing' })).toMatchObject({ kind: 'shared', waitingCount: 1 });
    expect(getProjectionActionState({ boardState: state({ hasRolledThisTurn: true }), roomStatus: 'playing' }).kind).toBe('end_turn');
    expect(getProjectionActionState({ boardState: state(), roomStatus: 'playing' }).kind).toBe('roll');
    expect(getProjectionActionState({ boardState: state(), roomStatus: 'waiting' }).kind).toBe('waiting_start');
  });
});

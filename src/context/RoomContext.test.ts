import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import {
  hasEligibleCashDividend,
  hasEligibleStockDividend,
  createInitialBoardState,
  getSharedCardTargetPlayerUids,
  withPendingStartupUpgradeAction,
  withoutPendingStartupUpgradeAction
} from './RoomContext';

const baseState = (assets: GameState['assets']): GameState => ({
  name: '玩家',
  selectedProfessionId: '',
  selectedDreamId: '',
  rank: 1,
  experience: 0,
  income: { salary: 0, investment: 0, other: 0 },
  expenses: { tax: 0, basicLiving: 0, transportEdu: 0, otherMedicalChild: 0 },
  assets,
  liabilities: [],
  cash: 0,
  marketPrices: {},
  previousMarketPrices: {},
  gameAbilities: { stockAbilityCount: 0, realEstateAbilityCount: 0, professionAbilityCount: 0 },
  history: [],
  happiness: [],
  happinessTotal: 0,
  hasCar: false,
  childrenCount: 0,
  familyStage: 0,
  isSetup: true,
  stocks: {},
  loans: []
} as GameState);

describe('shared dividend eligibility', () => {
  it('only treats players with matching stock holdings as eligible', () => {
    const noStock = baseState([]);
    const withStock = baseState([
      {
        id: 's1',
        name: 'A10 蜜乳食品',
        cost: 1000,
        downPayment: 1000,
        cashflow: 0,
        type: '股票',
        quantity: 2
      }
    ]);

    expect(hasEligibleCashDividend(noStock, { A10: 5 })).toBe(false);
    expect(hasEligibleCashDividend(withStock, { A10: 5 })).toBe(true);
    expect(hasEligibleStockDividend(noStock, { A10: 0.1 })).toBe(false);
    expect(hasEligibleStockDividend(withStock, { A10: 0.1 })).toBe(true);
  });
});

describe('shared card target players', () => {
  it('keeps the source player in the response list during member sync', () => {
    expect(getSharedCardTargetPlayerUids([{ uid: 'p2' }], 'coach', 'p1')).toEqual(['p2', 'p1']);
  });
});

describe('startup upgrade pending state helpers', () => {
  it('writes and clears pending startup upgrade action on player state', () => {
    const state = baseState([]);
    const withPending = withPendingStartupUpgradeAction(state, { cardId: 'N057', symbol: 'N057' });
    expect(withPending.pendingStartupUpgradeAction).toEqual({ cardId: 'N057', symbol: 'N057' });

    const cleared = withoutPendingStartupUpgradeAction(withPending);
    expect(cleared.pendingStartupUpgradeAction).toBeUndefined();
  });
});

describe('board room initialization', () => {
  it('puts all three players in turn order and keeps the coach out of it', () => {
    const members = [
      { uid: 'coach', name: 'Coach', role: 'coach', joinedAt: 1 },
      { uid: 'p1', name: 'P1', role: 'player', joinedAt: 1 },
      { uid: 'p2', name: 'P2', role: 'player', joinedAt: 1 },
      { uid: 'p3', name: 'P3', role: 'player', joinedAt: 1 }
    ] as const;

    const board = createInitialBoardState([...members], 'coach');

    expect(board.turnOrder).toEqual(['p1', 'p2', 'p3']);
    expect(board.currentTurnUid).toBe('p1');
    expect(board.playerPositions).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(board.revision).toBe(0);
  });
});

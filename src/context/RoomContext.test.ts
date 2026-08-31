import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import {
  hasEligibleCashDividend,
  hasEligibleStockDividend,
  createInitialBoardState,
  appendBoardCardLog,
  addRealEstateCardToMarket,
  buildBoardEventAdvanceState,
  buildRealEstatePurchaseState,
  buildVehicleLossState,
  isCurrentRealEstatePurchase,
  buildStartupLoanPromptMutation,
  buildStartupLoanState,
  buildStartupUpgradeState,
  getSharedCardTargetPlayerUids,
  getPendingRequestExecutionKey,
  mergeRoomSnapshotWithPrivateStates,
  withPendingStartupUpgradeAction,
  withoutPendingStartupUpgradeAction
} from './RoomContext';
import { applyFamilyMilestoneStage, FAMILY_MILESTONE_STAGES } from '../utils/familyMilestones';

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

  it('does not wait for a player who already left the room', () => {
    expect(getSharedCardTargetPlayerUids([
      { uid: 'p2', isLeft: true },
      { uid: 'p3', isLeft: false }
    ], 'coach', 'p1')).toEqual(['p3', 'p1']);
  });

  it('keeps sequential approvals from the same player distinct by event', () => {
    const first = getPendingRequestExecutionKey({ id: 'p1', uid: 'p1', type: 'board_share', timestamp: 1, boardEventId: 'event-1', boardCardId: 'C056' });
    const second = getPendingRequestExecutionKey({ id: 'p1', uid: 'p1', type: 'board_share', timestamp: 2, boardEventId: 'event-2', boardCardId: 'C056' });
    expect(first).not.toBe(second);
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

describe('room snapshot hydration', () => {
  it('preserves private player states when the shared room snapshot updates', () => {
    const playerState = baseState([]);
    const current = { id: '123456', playerStates: { p1: playerState }, status: 'waiting' } as any;
    const snapshot = { id: '123456', status: 'playing', members: [] } as any;

    expect(mergeRoomSnapshotWithPrivateStates(snapshot, current)).toMatchObject({
      status: 'playing',
      playerStates: { p1: playerState }
    });
  });
});

describe('authoritative board transaction helpers', () => {
  it.each(FAMILY_MILESTONE_STAGES)(
    'applies the family milestone stage in order: $progressId',
    (stage) => {
      const state = baseState([]);
      state.cash = stage.cashCostAmount || 0;
      const result = applyFamilyMilestoneStage(state, stage, `family:test:${stage.progressId}`, 10);

      expect(result.status).toBe('applied');
      if (result.status !== 'applied') return;
      expect(result.state.completedHappinessEvents).toContain(stage.progressId);
      expect(result.state.happiness?.find(item => item.id === stage.happinessId)).toMatchObject({
        checked: true,
        points: stage.happinessPointsValue
      });
      if (stage.monthlyExpenseIncreaseAmount) {
        expect(result.state.expenses.otherMedicalChild).toBe(stage.monthlyExpenseIncreaseAmount);
      }
    }
  );

  it('applies a family cash stage once and rejects a one-dollar shortfall without mutation', () => {
    const proposal = FAMILY_MILESTONE_STAGES[1];
    const enough = baseState([]);
    enough.cash = 5000;
    enough.happiness = [{ id: proposal.happinessId, label: '難忘的求婚', points: 2, checked: false }];
    const applied = applyFamilyMilestoneStage(enough, proposal, 'family:event:p1:propose', 10);
    expect(applied.status).toBe('applied');
    expect(applied.state.cash).toBe(0);
    expect(applied.state.completedHappinessEvents).toContain('propose');

    const duplicate = applyFamilyMilestoneStage(applied.state, proposal, 'family:event:p1:propose', 11);
    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.state.history).toHaveLength(1);

    const short = baseState([]);
    short.cash = 4999;
    const insufficient = applyFamilyMilestoneStage(short, proposal, 'family:event:p2:propose', 12);
    expect(insufficient.status).toBe('insufficient');
    expect(insufficient.state).toBe(short);
  });

  it('upserts one card log entry per event and card', () => {
    const board = createInitialBoardState([{ uid: 'p1', role: 'player' } as any], 'coach');
    const card = { deck: 'happiness', cardId: 'H011', title: '第一次約會', description: '' } as any;
    const event = { id: 'event-1', playerUid: 'p1', playerName: 'P1', summary: '抽卡', squareIndex: 1, timestamp: 1 } as any;
    const first = appendBoardCardLog(board, card, event);
    const second = appendBoardCardLog({ ...board, cardLog: first }, card, event);
    expect(second).toHaveLength(1);
  });

  it('resumes persisted movement without reading another player private state', () => {
    const board = createInitialBoardState([{ uid: 'p1', role: 'player' } as any], 'coach');
    const result = buildBoardEventAdvanceState({
      isBoardGame: true,
      boardState: {
        ...board,
        currentEvent: { id: 'card-1', playerUid: 'p1' } as any,
        currentCard: { cardId: 'H011', deck: 'happiness' } as any,
        movement: {
          playerUid: 'p1', startPosition: 26, path: [27, 28], rollTotal: 2, dice: [2],
          startedAt: 1, stepDurationMs: 10, introDelayMs: 0, landingDelayMs: 0, isActive: false,
          effects: [{ type: 'repair_fee', squareIndex: 27, dice: 3, amount: 6000 }]
        }
      }
    } as any);
    expect(result?.boardState?.movement?.isActive).toBe(true);
    expect(result?.boardState?.movement?.path).toEqual([27]);
    expect(result?.boardState?.movement?.remainingPath).toEqual([28]);
  });

  it('builds a direct real-estate purchase without touching the market', () => {
    const state = baseState([]);
    state.cash = 10000;
    const next = buildRealEstatePurchaseState(state, {
      name: '購買住宅', amount: 100000, cashChange: -10000, source: 'loan', usage: 'asset',
      assetDetails: { type: '不動產', symbol: 'N001', downPayment: 10000, loanAmount: 90000, loanInterest: 450, cashflow: 0 }
    }, 'card-purchase:event:p1:N001', 10);
    expect(next.cash).toBe(0);
    expect(next.assets).toHaveLength(1);
    expect(next.liabilities).toHaveLength(1);
  });

  it('lists an abandoned house once', () => {
    expect(addRealEstateCardToMarket(['N001'], 'N002')).toEqual(['N001', 'N002']);
    expect(addRealEstateCardToMarket(['N001'], 'N001')).toEqual(['N001']);
  });

  it('accepts only the current catalog terms for a market purchase', () => {
    const txData = {
      name: '房市購買',
      amount: 1100000,
      cashChange: -100000,
      source: 'loan' as const,
      usage: 'asset' as const,
      assetDetails: {
        type: '不動產' as const,
        cashflow: 6500,
        downPayment: 100000,
        loanAmount: 1000000,
        loanInterest: 5000,
        symbol: 'N029',
        isSelfUse: false,
        houseType: '1room' as const,
        happyPoints: 0
      }
    };

    expect(isCurrentRealEstatePurchase('N029', txData)).toBe(true);
    expect(isCurrentRealEstatePurchase('N029', { ...txData, cashChange: -1 })).toBe(false);
  });

  it('removes one vehicle atomically while preserving its loan', () => {
    const state = baseState([{
      id: 'car-1', name: '汽車', cost: 600000, downPayment: 120000,
      cashflow: 0, type: '汽車', isInsured: true
    }]);
    state.cash = 1000;
    state.liabilities = [{
      id: 'car-loan', name: '汽車貸款', totalOwed: 480000,
      monthlyPayment: 2400, type: '汽車貸款', linkedAssetId: 'car-1'
    }];
    state.happiness = [{ id: 'h_plane', label: '擁有一台汽車', points: 4, checked: true }];

    const next = buildVehicleLossState(state, { assetId: 'car-1', claimAmount: 400000 }, 'vehicle-loss:event:p1', 10);

    expect(next.cash).toBe(401000);
    expect(next.assets).toHaveLength(0);
    expect(next.liabilities).toEqual(state.liabilities);
    expect(next.happiness[0].checked).toBe(false);
    expect(next.history[0]).toMatchObject({ cashChange: 400000, amount: 400000 });
  });

  it.each([
    ['N056', 500000, 3000, 1500],
    ['N057', 600000, 5000, 3000],
    ['N058', 600000, 5000, 3000]
  ])('applies startup loan %s once with its asset, liability, and pending upgrade', (cardId, loan, investment, interest) => {
    const state = baseState([]);
    state.cash = 10000;
    const commandId = `startup-loan:prompt-1:p1:${cardId}`;
    const applied = buildStartupLoanState(state, cardId, commandId, 10);
    const duplicate = buildStartupLoanState(applied, cardId, commandId, 20);

    expect(applied.cash).toBe(10000 + loan - investment);
    expect(applied.assets).toHaveLength(1);
    expect(applied.assets[0]).toMatchObject({ type: '企業', cost: investment, cashflow: 0 });
    expect(applied.liabilities).toHaveLength(1);
    expect(applied.liabilities[0]).toMatchObject({ type: '企業貸款', totalOwed: loan, monthlyPayment: interest });
    expect(applied.pendingStartupUpgradeAction).toEqual({ cardId, symbol: cardId });
    expect(applied.history).toHaveLength(1);
    expect(duplicate).toBe(applied);
  });

  it('keeps pending studio upgrades in order across multiple startup loans', () => {
    const state = baseState([]);
    const first = buildStartupLoanState(state, 'N057', 'startup-loan:first', 10);
    const second = buildStartupLoanState(first, 'N058', 'startup-loan:second', 20);

    expect(second.pendingStartupUpgradeActions).toEqual([
      { cardId: 'N057', symbol: 'N057' },
      { cardId: 'N058', symbol: 'N058' }
    ]);

    const upgraded = buildStartupUpgradeState(
      {
        ...second,
        assets: second.assets.map((asset, index) => index === 0 ? { ...asset, id: 'studio-1' } : asset),
        liabilities: second.liabilities.map((liability, index) => index === 0 ? { ...liability, linkedAssetId: 'studio-1' } : liability)
      },
      { assetId: 'studio-1', cardId: 'N057', diceRoll: 6 },
      'startup-upgrade:first',
      30
    );
    expect(upgraded.pendingStartupUpgradeAction).toEqual({ cardId: 'N058', symbol: 'N058' });
    expect(upgraded.pendingStartupUpgradeActions).toEqual([{ cardId: 'N058', symbol: 'N058' }]);
  });

  it('atomically upgrades the startup asset and removes its linked loan', () => {
    const state = baseState([{
      id: 'startup-asset',
      name: 'N057 兼職工作室',
      cost: 5000,
      downPayment: 5000,
      cashflow: 0,
      type: '企業',
      isUpgraded: false
    }]);
    state.pendingStartupUpgradeAction = { cardId: 'N057', symbol: 'N057' };
    state.liabilities = [{
      id: 'startup-loan',
      name: '企業貸款 (N057)',
      totalOwed: 600000,
      monthlyPayment: 3000,
      type: '企業貸款',
      linkedAssetId: 'startup-asset'
    }];

    const applied = buildStartupUpgradeState(
      state,
      { assetId: 'startup-asset', cardId: 'N057', diceRoll: 6 },
      'startup-upgrade:session:p1:startup-asset',
      10
    );
    const duplicate = buildStartupUpgradeState(
      applied,
      { assetId: 'startup-asset', cardId: 'N057', diceRoll: 6 },
      'startup-upgrade:session:p1:startup-asset',
      20
    );

    expect(applied.assets[0]).toMatchObject({ name: '小型企業 (N057)', cashflow: 60000, isUpgraded: true });
    expect(applied.liabilities).toHaveLength(0);
    expect(applied.pendingStartupUpgradeAction).toBeUndefined();
    expect(applied.history).toHaveLength(1);
    expect(duplicate).toBe(applied);
  });

  it('keeps all three startup-loan player results and closes the prompt once', () => {
    const members = [
      { uid: 'coach', name: 'Coach', role: 'coach', joinedAt: 1 },
      { uid: 'p1', name: 'P1', role: 'player', joinedAt: 1 },
      { uid: 'p2', name: 'P2', role: 'player', joinedAt: 1 },
      { uid: 'p3', name: 'P3', role: 'player', joinedAt: 1 }
    ] as any[];
    const board = createInitialBoardState(members, 'coach');
    board.currentEvent = { id: 'event-loan', playerUid: 'p1', playerName: 'P1', type: 'card', timestamp: 1 } as any;
    board.currentCard = { cardId: 'N057', deck: 'news', title: '創業貸款' } as any;
    board.sharedCardPrompt = {
      id: 'prompt-loan',
      kind: 'startup_loan',
      sourceEventId: 'event-loan',
      sourceCardId: 'N057',
      sourcePlayerUid: 'p1',
      sourcePlayerName: 'P1',
      targetPlayerUids: ['p1', 'p2', 'p3'],
      responses: {},
      createdAt: 1
    };
    let latestRoom: any = {
      id: 'room-loan',
      hostId: 'coach',
      status: 'playing',
      isBoardGame: true,
      members,
      boardState: board,
      playerStates: {
        p1: { ...baseState([]), cash: 10000 },
        p2: { ...baseState([]), cash: 10000 },
        p3: { ...baseState([]), cash: 10000 }
      }
    };

    for (const uid of ['p1', 'p2', 'p3']) {
      const mutation = buildStartupLoanPromptMutation(
        latestRoom,
        latestRoom.boardState,
        'prompt-loan',
        uid,
        uid.toUpperCase(),
        `startup-loan:prompt-loan:${uid}`
      );
      expect(mutation.result).toBe(true);
      latestRoom = {
        ...latestRoom,
        ...(mutation.roomPatch || {}),
        boardState: mutation.boardState,
        playerStates: {
          ...latestRoom.playerStates,
          ...((mutation.roomPatch as any)?.playerStates || {})
        }
      };
    }

    for (const uid of ['p1', 'p2', 'p3']) {
      expect(latestRoom.playerStates[uid]).toMatchObject({
        cash: 605000,
        pendingStartupUpgradeAction: { cardId: 'N057', symbol: 'N057' }
      });
      expect(latestRoom.playerStates[uid].assets).toHaveLength(1);
      expect(latestRoom.playerStates[uid].liabilities).toHaveLength(1);
    }
    expect(latestRoom.boardState.sharedCardPrompt).toBeUndefined();
    expect(latestRoom.boardState.currentEvent).toBeNull();
  });
});

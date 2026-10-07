import { describe, expect, it } from 'vitest';
import type { BoardState, GameState } from '../types';
import {
  hasEligibleCashDividend,
  hasEligibleStockDividend,
  createInitialBoardState,
  appendBoardCardLog,
  addRealEstateCardToMarket,
  buildBoardEventAdvanceState,
  buildBoardMovementLegResolution,
  buildRealEstatePurchaseState,
  buildVehicleLossState,
  isCurrentRealEstatePurchase,
  buildStartupLoanPromptMutation,
  buildSharedAssetSalePromptMutation,
  buildStartupLoanState,
  buildStartupUpgradeState,
  buildTargetEnterprisePurchaseState,
  buildSharedInvestmentState,
  getPendingStartupUpgradeActions,
  resolveStartupUpgradeTarget,
  getSharedCardTargetPlayerUids,
  buildSharedPromptResponseFallback,
  getPendingRequestExecutionKey,
  buildPendingRequestId,
  isPendingRequestDocumentId,
  applyApprovedHappinessStory,
  buildBoardCardResultById,
  buildDirectHappinessCardState,
  buildInsurancePurchaseState,
  buildDepositPurchaseState,
  buildStockTradeState,
  buildLoanBorrowState,
  buildLoanRepaymentState,
  buildDepositWithdrawalState,
  buildCarPurchaseState,
  getCarPurchaseGateError,
  mergeRoomSnapshotWithPrivateStates,
  withPendingStartupUpgradeAction,
  withoutPendingStartupUpgradeAction,
  buildBoardCardRevealState,
  isCurrentPlayerBankEvent,
  buildSchoolPromotionState,
  resolveBoardDiceCount,
  buildLifelongLearningSuccessState,
  shouldAcceptBoardSnapshot,
  selectActiveControllerClaim,
  shouldClearRoomAfterSnapshotError,
} from './RoomContext';
import { HAPPINESS_CARDS, NEWS_CARDS, OPPORTUNITY_CARDS } from '../constants/cards';
import { applyFamilyMilestoneStage, FAMILY_MILESTONE_STAGES, isFamilyMilestoneComplete } from '../utils/familyMilestones';

describe('room controller claims', () => {
  it('ignores a stale claim so a single reopened tab can take control', () => {
    expect(selectActiveControllerClaim([
      { clientId: 'old-tab', claimedAt: 1_000, lastSeenAt: 1_000 },
      { clientId: 'current-tab', claimedAt: 29_000, lastSeenAt: 29_000 }
    ], 32_000)?.clientId).toBe('current-tab');
    expect(selectActiveControllerClaim([
      { clientId: 'old-tab', claimedAt: 1_000, lastSeenAt: 1_000 }
    ], 31_001)).toBeNull();
  });
});

describe('room listener errors', () => {
  it('does not treat permission errors or network failures as a closed room', () => {
    expect(shouldClearRoomAfterSnapshotError('permission-denied')).toBe(false);
    expect(shouldClearRoomAfterSnapshotError('unavailable')).toBe(false);
    expect(shouldClearRoomAfterSnapshotError('not-found')).toBe(true);
  });
});

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

it('applies N055 investment once using the card terms and keeps insufficient cash unchanged', () => {
  const state = { ...baseState([]), cash: 2000000 };
  const first = buildSharedInvestmentState(state, 'N055', 1000000, 'shared-investment:prompt:p1', {}, 100);
  expect(first.status).toBe('applied');
  expect(first.state).toMatchObject({ cash: 1000000, assets: [{ cost: 1000000, cashflow: 200000 }] });
  expect(first.state?.history).toHaveLength(1);
  expect(buildSharedInvestmentState(first.state!, 'N055', 1000000, 'shared-investment:prompt:p1').status).toBe('duplicate');
  expect(buildSharedInvestmentState(state, 'N055', 3000000, 'another').status).toBe('requires_funding');
  expect(state.assets).toHaveLength(0);
});

describe('board dice count', () => {
  it('keeps car owners on two dice unless they explicitly choose one', () => {
    expect(resolveBoardDiceCount(true)).toBe(2);
    expect(resolveBoardDiceCount(true, 2)).toBe(2);
    expect(resolveBoardDiceCount(true, 1)).toBe(1);
    expect(resolveBoardDiceCount(false, 2)).toBe(1);
  });
});

describe('pending request identity', () => {
  it('keeps a board request stable for retries within the same session', () => {
    const request = { uid: 'player-1', type: 'happiness' as const, boardEventId: 'event-1', boardCardId: 'H009' };
    const first = buildPendingRequestId(request, 'room-session-1');
    const second = buildPendingRequestId(request, 'room-session-1');

    expect(first).toBe(second);
    expect(first).not.toBe(buildPendingRequestId(request, 'room-session-2'));
    expect(isPendingRequestDocumentId(first)).toBe(true);
  });
});

it('applies C004 lifelong learning to an old incomplete player snapshot', () => {
  const legacyState = {
    cash: 5000,
    currentRankLevel: 1,
    currentRankTitle: '初階',
    profession: { salary: 30000, promotions: [{ rankTitle: '進階', bonus: 5000 }] }
  } as GameState;

  const result = buildLifelongLearningSuccessState(legacyState, 'enhance_profession', 'c004:test', 1);

  expect(result.currentRankLevel).toBe(2);
  expect(result.profession?.salary).toBe(35000);
  expect(result.assets).toEqual([]);
  expect(result.history).toHaveLength(1);
});

describe('coach card test catalog', () => {
  it('can build every production card through the normal card metadata path', () => {
    const cardIds = [...HAPPINESS_CARDS, ...OPPORTUNITY_CARDS, ...NEWS_CARDS].map(card => card.id);
    expect(cardIds.length).toBeGreaterThan(0);
    expect(cardIds.every(cardId => buildBoardCardResultById(cardId))).toBe(true);
    expect(buildBoardCardResultById('UNKNOWN')).toBeNull();
  });
});

it('reveals a family card and creates its participant prompt atomically', () => {
  const members = [
    { uid: 'coach', role: 'coach', isLeft: false },
    { uid: 'p1', role: 'player', isLeft: false },
    { uid: 'p2', role: 'player', isLeft: false }
  ] as any;
  const card = HAPPINESS_CARDS.find(item => item.otherPlayersCanJoin)!;
  const initialBoard = createInitialBoardState(members, 'coach');
  const board = {
    ...initialBoard,
    currentEvent: { id: 'event-family-1', playerUid: 'p1', playerName: 'P1' },
    currentCard: { cardId: card.id, deck: 'happiness', title: card.title } as any
  } as any;
  const result = buildBoardCardRevealState({
    id: 'room-1', hostId: 'coach', status: 'playing', members, boardState: board,
    playerStates: { p1: baseState([]) }
  } as any, 'event-family-1', card.id, 'p1', 'P1', 100);

  expect(result.result.familyPrompt).toBe('opened');
  expect(result.boardState.currentCardReveal).toMatchObject({ eventId: 'event-family-1', cardId: card.id, isRevealed: true });
  expect(result.boardState.familyMilestoneJoinPrompt?.targetPlayerUids).toEqual(['p2']);
  expect(result.boardState.cardLog).toHaveLength(1);
});

it('does not add family-complete players to a family participation prompt', () => {
  const members = [
    { uid: 'coach', role: 'coach', isLeft: false },
    { uid: 'p1', role: 'player', isLeft: false },
    { uid: 'p2', role: 'player', isLeft: false }
  ] as any;
  const card = HAPPINESS_CARDS.find(item => item.otherPlayersCanJoin)!;
  const initialBoard = createInitialBoardState(members, 'coach');
  const board = {
    ...initialBoard,
    currentEvent: { id: 'event-family-complete-target', playerUid: 'p1', playerName: 'P1' },
    currentCard: { cardId: card.id, deck: 'happiness', title: card.title } as any
  } as any;
  const completeState = baseState([]);
  completeState.children = 2;
  completeState.completedHappinessEvents = FAMILY_MILESTONE_STAGES.map(stage => stage.progressId);

  expect(isFamilyMilestoneComplete(completeState)).toBe(true);
  const result = buildBoardCardRevealState({
    id: 'room-1', hostId: 'coach', status: 'playing', members, boardState: board,
    playerStates: { p1: baseState([]), p2: completeState }
  } as any, 'event-family-complete-target', card.id, 'p1', 'P1', 100);

  expect(result.result.familyPrompt).toBe('no_target');
  expect(result.boardState.familyMilestoneJoinPrompt).toBeNull();
});

it('does not open family participation when the card player already completed every stage', () => {
  const members = [
    { uid: 'coach', role: 'coach', isLeft: false },
    { uid: 'p1', role: 'player', isLeft: false },
    { uid: 'p2', role: 'player', isLeft: false }
  ] as any;
  const card = HAPPINESS_CARDS.find(item => item.otherPlayersCanJoin)!;
  const initialBoard = createInitialBoardState(members, 'coach');
  const board = {
    ...initialBoard,
    currentEvent: { id: 'event-family-complete-source', playerUid: 'p1', playerName: 'P1' },
    currentCard: { cardId: card.id, deck: 'happiness', title: card.title } as any
  } as any;
  const completeState = baseState([]);
  completeState.children = 2;
  completeState.completedHappinessEvents = FAMILY_MILESTONE_STAGES.map(stage => stage.progressId);

  const result = buildBoardCardRevealState({
    id: 'room-1', hostId: 'coach', status: 'playing', members, boardState: board,
    playerStates: { p1: completeState, p2: baseState([]) }
  } as any, 'event-family-complete-source', card.id, 'p1', 'P1', 100);

  expect(result.result.familyPrompt).toBe('no_target');
  expect(result.boardState.familyMilestoneJoinPrompt).toBeNull();
});

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

describe('approved happiness story', () => {
  it('adds happiness once per board event and allows the next story event', () => {
    const request = {
      uid: 'p1',
      boardEventId: 'event-1',
      boardCardId: 'H001',
      happinessLabel: '得獎經歷'
    };
    const first = applyApprovedHappinessStory(baseState([]), request, 2, 10);
    const duplicate = applyApprovedHappinessStory(first.state, request, 2, 11);
    const next = applyApprovedHappinessStory(duplicate.state, { ...request, boardEventId: 'event-2' }, 2, 12);

    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(next.state.happinessTotal).toBe(4);
    expect(next.state.history).toHaveLength(2);
  });
});

describe('direct board happiness card state', () => {
  it('applies cash, monthly expense, happiness and history atomically', () => {
    const state = baseState([]);
    state.cash = 10000;
    state.happiness = [{ id: 'h_child1', label: '擁有第一個孩子', points: 4, checked: false }];
    const txData = {
      name: '幸福卡：擁有第一個孩子',
      amount: 3000,
      cashChange: -3000,
      source: 'cash',
      usage: 'happiness_event',
      happinessEventPayload: {
        id: 'child1',
        name: '擁有第一個孩子',
        amount: 3000,
        points: 4,
        monthlyExpenseChange: 10000,
        expenseCategory: 'otherMedicalChild',
        progressId: 'child1',
        happinessItemId: 'h_child1',
        sourceCardId: 'H019'
      }
    } as any;

    const next = buildDirectHappinessCardState(state, txData, 'happiness-card:event-1:p1:H019', 100);

    expect(next.cash).toBe(7000);
    expect(next.expenses.otherMedicalChild).toBe(10000);
    expect(next.happinessTotal).toBe(4);
    expect(next.completedHappinessEvents).toEqual(expect.arrayContaining(['child1', 'H019']));
    expect(next.history).toHaveLength(1);
    expect(next.history[0].balance).toBe(7000);
  });

  it('returns the same state when the command is retried', () => {
    const state = baseState([]);
    const txData = {
      name: '幸福卡：第一次約會',
      amount: 3000,
      cashChange: -3000,
      source: 'cash',
      usage: 'happiness_event',
      happinessEventPayload: { id: 'date', name: '第一次約會', amount: 3000, points: 2, sourceCardId: 'H011' }
    } as any;
    const commandId = 'happiness-card:event-2:p1:H011';
    const first = buildDirectHappinessCardState(state, txData, commandId, 100);
    const retry = buildDirectHappinessCardState(first, txData, commandId, 200);

    expect(retry).toBe(first);
    expect(retry.history).toHaveLength(1);
  });
});

describe('insurance purchase state', () => {
  it('marks one selected house as insured without changing cash', () => {
    const state = baseState([
      { id: 'house-1', name: '兩房一廳', cost: 1000000, downPayment: 100000, cashflow: 10000, type: '不動產', isInsured: false } as any,
      { id: 'house-2', name: '三房兩廳', cost: 2000000, downPayment: 200000, cashflow: 20000, type: '不動產', isInsured: false } as any
    ]);
    state.cash = 5000;
    const txData = {
      name: '購買房屋保險（兩房一廳）',
      amount: 2000,
      cashChange: 0,
      source: 'cash',
      usage: 'insurance',
      insuranceType: 'house',
      insurancePayload: { targetAssetIds: ['house-1'] }
    } as any;

    const next = buildInsurancePurchaseState(state, txData, 'insurance:room:p1:house:house-1', 100);

    expect(next.cash).toBe(5000);
    expect(next.assets.find(asset => asset.id === 'house-1')?.isInsured).toBe(true);
    expect(next.assets.find(asset => asset.id === 'house-2')?.isInsured).toBe(false);
    expect(next.history).toHaveLength(1);
  });

  it('rejects a repeated medical insurance purchase', () => {
    const state = baseState([]);
    state.medicalInsuranceCount = 1;
    const txData = {
      name: '購買醫療保險',
      amount: 0,
      cashChange: 0,
      source: 'cash',
      usage: 'insurance',
      insuranceType: 'medical',
      insurancePayload: { medicalQty: 1 }
    } as any;

    expect(() => buildInsurancePurchaseState(state, txData, 'insurance:room:p1:medical:', 100)).toThrow('已持有醫療保險');
  });
});

describe('deposit purchase state', () => {
  it('moves cash into a fixed deposit and records its monthly return', () => {
    const state = baseState([]);
    state.cash = 50000;
    const txData = {
      name: '定存 30000',
      amount: 30000,
      cashChange: -30000,
      source: 'cash',
      usage: 'buy_asset',
      assetChange: {
        action: 'add',
        asset: { id: 'fixed_deposit_1', name: '定存', type: '定存', value: 30000, monthlyCashflow: 300 }
      }
    } as any;

    const next = buildDepositPurchaseState(state, txData, 'deposit:room:p1:fixed_deposit_1', 100);

    expect(next.cash).toBe(20000);
    expect(next.assets).toContainEqual(expect.objectContaining({
      id: 'fixed_deposit_1',
      type: '定存',
      cost: 30000,
      cashflow: 300
    }));
    expect(next.history[0]).toMatchObject({ cashChange: -30000, balance: 20000 });
  });

  it('does not allow a deposit that would make cash negative', () => {
    const state = baseState([]);
    state.cash = 1000;
    const txData = {
      name: '定存 30000',
      amount: 30000,
      cashChange: -30000,
      source: 'cash',
      usage: 'buy_asset',
      assetChange: { action: 'add', asset: { id: 'fixed_deposit_2', name: '定存', type: '定存', value: 30000 } }
    } as any;

    expect(() => buildDepositPurchaseState(state, txData, 'deposit:room:p1:fixed_deposit_2', 100)).toThrow('現金不足');
  });
});

describe('stock trade state', () => {
  it('supports repeated buy commands and keeps each command in history', () => {
    const state = baseState([]);
    state.cash = 100000;
    const firstTx = {
      commandId: 'stock:1',
      name: '買入股票 (A01)',
      amount: 10000,
      cashChange: -10000,
      source: 'cash',
      usage: 'asset',
      stockList: [{ symbol: 'A01', price: 10000, qty: 1 }]
    } as any;
    const secondTx = { ...firstTx, commandId: 'stock:2' };

    const first = buildStockTradeState(state, firstTx, 'stock:room:p1:stock:1', 100);
    const second = buildStockTradeState(first, secondTx, 'stock:room:p1:stock:2', 200);

    expect(second.cash).toBe(80000);
    expect(second.assets[0]).toMatchObject({ type: '股票', quantity: 2, shares: 2, cost: 20000 });
    expect(second.history).toHaveLength(2);
  });

  it('rejects selling more shares than the player owns', () => {
    const state = baseState([
      { id: 'stock-a01', name: 'A01 測試股票', cost: 10000, downPayment: 10000, cashflow: 0, type: '股票', quantity: 1, shares: 1, lastPurchasePrice: 10000 } as any
    ]);
    const txData = {
      name: '賣出股票 (A01)',
      amount: 20000,
      cashChange: 20000,
      source: 'income',
      usage: 'cash',
      stockList: [{ symbol: 'A01', price: 20000, qty: 2 }]
    } as any;

    expect(() => buildStockTradeState(state, txData, 'stock:room:p1:sell', 100)).toThrow('持有張數不足');
  });
});

describe('loan borrow state', () => {
  it('adds cash and one credit liability atomically', () => {
    const state = baseState([]);
    state.cash = 1000;
    const txData = {
      commandId: 'loan:1',
      name: '申請信用貸款',
      amount: 50000,
      cashChange: 50000,
      source: 'cash',
      usage: 'loan'
    } as any;

    const next = buildLoanBorrowState(state, txData, 'loan:room:p1:loan:1', 100);

    expect(next.cash).toBe(51000);
    expect(next.liabilities).toContainEqual(expect.objectContaining({
      type: '信用貸款',
      totalOwed: 50000,
      monthlyPayment: 5000
    }));
    expect(next.history[0]).toMatchObject({ cashChange: 50000, balance: 51000 });
  });
});

describe('loan repayment state', () => {
  it('repays the selected liability and updates cash atomically', () => {
    const state = baseState([]);
    state.cash = 50000;
    state.liabilities = [{ id: 'loan-1', name: '信用貸款', totalOwed: 30000, monthlyPayment: 3000, type: '信用貸款' }];
    const txData = {
      commandId: 'repay:1',
      name: '償還信用貸款',
      amount: 10000,
      cashChange: -10000,
      source: 'cash',
      usage: 'liability',
      liabilityId: 'loan-1'
    } as any;

    const next = buildLoanRepaymentState(state, txData, 'repay:room:p1:repay:1', 100);

    expect(next.cash).toBe(40000);
    expect(next.liabilities[0]).toMatchObject({ totalOwed: 20000, monthlyPayment: 2000 });
    expect(next.history[0]).toMatchObject({ cashChange: -10000, balance: 40000 });
  });
});

describe('deposit withdrawal state', () => {
  it('supports a partial withdrawal and preserves the remaining deposit', () => {
    const state = baseState([
      { id: 'deposit-1', name: '定存', cost: 50000, downPayment: 50000, cashflow: 500, type: '定存' } as any
    ]);
    state.cash = 1000;
    const txData = {
      commandId: 'deposit-withdrawal:1',
      name: '解約定存 20000',
      amount: 20000,
      cashChange: 20000,
      source: 'income',
      usage: 'cash',
      relatedAssetId: 'deposit-1'
    } as any;

    const next = buildDepositWithdrawalState(state, txData, 'deposit-withdrawal:room:p1:1', 100);

    expect(next.cash).toBe(21000);
    expect(next.assets).toContainEqual(expect.objectContaining({ id: 'deposit-1', cost: 30000, cashflow: 300 }));
    expect(next.history[0]).toMatchObject({ cashChange: 20000, balance: 21000 });
  });
});

describe('car purchase state', () => {
  it('allows an active room member to purchase a car off-turn', () => {
    const room = {
      status: 'playing',
      members: [{ uid: 'player', isLeft: false }],
      boardState: { currentTurnUid: 'player' }
    } as any;
    expect(getCarPurchaseGateError(room, 'player')).toBeNull();
    expect(getCarPurchaseGateError({ ...room, boardState: { currentTurnUid: 'other' } }, 'player'))
      .toBeNull();
    expect(getCarPurchaseGateError({
      ...room,
      boardState: { currentTurnUid: 'player', sharedCardPrompt: { id: 'prompt' } }
    } as any, 'player')).toBeNull();
    expect(getCarPurchaseGateError({ ...room, members: [{ uid: 'player', isLeft: true }] }, 'player'))
      .toContain('尚未同步為房間玩家');
    expect(getCarPurchaseGateError({ ...room, status: 'waiting' }, 'player'))
      .toContain('尚未開始或已結束');
  });

  it('creates the car and linked loan in one state transition', () => {
    const state = baseState([]);
    state.cash = 200000;
    const txData = {
      commandId: 'car-purchase:1',
      name: '買入汽車（增加一顆骰子）',
      amount: 600000,
      cashChange: -120000,
      source: 'loan',
      usage: 'asset',
      assetDetails: {
        type: '汽車',
        cashflow: 0,
        downPayment: 120000,
        loanAmount: 480000,
        loanInterest: 2400
      }
    } as any;

    const next = buildCarPurchaseState(state, txData, 'car-purchase:room:p1:1', 100);

    expect(next.cash).toBe(80000);
    expect(next.assets).toContainEqual(expect.objectContaining({ type: '汽車', cost: 600000 }));
    expect(next.liabilities).toContainEqual(expect.objectContaining({ type: '汽車貸款', totalOwed: 480000, monthlyPayment: 2400 }));
    expect(next.history[0]).toMatchObject({ cashChange: -120000, balance: 80000 });
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

  it('uses the latest bank event instead of a stale caller event id', () => {
    const board = {
      currentTurnUid: 'p1',
      currentEvent: { id: 'latest-bank-event', type: 'bank', playerUid: 'p1' }
    } as BoardState;

    expect(isCurrentPlayerBankEvent(board, 'p1')).toBe(true);
    expect(isCurrentPlayerBankEvent({ ...board, currentEvent: { ...board.currentEvent!, type: 'school' } }, 'p1')).toBe(false);
    expect(isCurrentPlayerBankEvent({ ...board, currentTurnUid: 'p2' }, 'p1')).toBe(false);
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
    const current = { id: '123456', sessionId: 'session-1', playerStates: { p1: playerState }, status: 'waiting' } as any;
    const snapshot = { id: '123456', sessionId: 'session-1', status: 'playing', members: [] } as any;

    expect(mergeRoomSnapshotWithPrivateStates(snapshot, current)).toMatchObject({
      status: 'playing',
      playerStates: { p1: playerState }
    });
  });

  it('drops private player states when the same room starts a new session', () => {
    const playerState = { ...baseState([]), boardGameStartedAt: 100, isSetup: true };
    const current = { id: '123456', sessionId: 'session-old', playerStates: { p1: playerState } } as any;
    const snapshot = { id: '123456', sessionId: 'session-new', status: 'playing', members: [] } as any;

    expect(mergeRoomSnapshotWithPrivateStates(snapshot, current).playerStates).toBeUndefined();
  });

  it('preserves v2 response documents while the room snapshot updates', () => {
    const current = {
      id: '123456',
      boardState: {
        sharedCardPrompt: {
          id: 'prompt-v2',
          responseStorage: 'subcollection',
          responses: { p1: { status: 'no_effect' } }
        }
      }
    } as any;
    const snapshot = {
      id: '123456',
      status: 'playing',
      boardState: {
        revision: 2,
        sharedCardPrompt: {
          id: 'prompt-v2',
          responseStorage: 'subcollection',
          responses: {}
        }
      }
    } as any;

    expect(mergeRoomSnapshotWithPrivateStates(snapshot, current).boardState?.sharedCardPrompt?.responses)
      .toEqual({ p1: { status: 'no_effect' } });
  });
});

describe('authoritative room snapshot ordering', () => {
  const snapshot = (revision: number, updatedAt: number, currentEvent: any = null, sessionId = 'session-1') => ({
    id: 'room-1', sessionId,
    boardState: { revision, updatedAt, currentEvent }
  } as any);

  it('rejects an older event snapshot after a newer event was accepted', () => {
    expect(shouldAcceptBoardSnapshot(snapshot(8, 200), snapshot(7, 300))).toBe(false);
    expect(shouldAcceptBoardSnapshot(snapshot(8, 200), snapshot(8, 199, { id: 'stale-event' }))).toBe(false);
  });

  it('accepts a newer revision even when client clocks are different', () => {
    expect(shouldAcceptBoardSnapshot(snapshot(8, 200), snapshot(9, 100))).toBe(true);
  });

  it('accepts the initial board snapshot of a new session', () => {
    expect(shouldAcceptBoardSnapshot(
      snapshot(25, 500, null, 'session-old'),
      snapshot(0, 100, null, 'session-new')
    )).toBe(true);
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

  it('keeps the child count in sync with child milestones', () => {
    const child1 = FAMILY_MILESTONE_STAGES.find(stage => stage.progressId === 'child1')!;
    const child2 = FAMILY_MILESTONE_STAGES.find(stage => stage.progressId === 'child2')!;
    const state = baseState([]);

    const first = applyFamilyMilestoneStage(state, child1, 'family:event:p1:child1', 10);
    expect(first.status).toBe('applied');
    if (first.status !== 'applied') return;
    expect(first.state.children).toBe(1);

    const second = applyFamilyMilestoneStage(first.state, child2, 'family:event:p1:child2', 11);
    expect(second.status).toBe('applied');
    if (second.status !== 'applied') return;
    expect(second.state.children).toBe(2);
  });

  it('applies forced debt and the family cash stage in one result', () => {
    const proposal = FAMILY_MILESTONE_STAGES[1];
    const state = baseState([]);
    state.cash = 4999;

    const result = applyFamilyMilestoneStage(state, proposal, 'family:event:p1:propose', 10, 1);

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.state.cash).toBe(0);
    expect(result.state.liabilities).toEqual([
      expect.objectContaining({ type: '強制負債', totalOwed: 1, monthlyPayment: 0 })
    ]);
    expect(result.state.history.map(item => item.usageLabel)).toEqual(['強制負債', '幸福事件']);
  });

  it('applies credit funding and the family cash stage in one result', () => {
    const proposal = FAMILY_MILESTONE_STAGES[1];
    const state = baseState([]);
    state.cash = 4999;
    state.profession = { salary: 30000 } as any;

    const result = applyFamilyMilestoneStage(state, proposal, 'family:event:p1:propose', 10, 0, 1);

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.state.cash).toBe(0);
    expect(result.state.liabilities).toEqual([
      expect.objectContaining({ type: '信用貸款', totalOwed: 1, monthlyPayment: 0 })
    ]);
    expect(result.state.history.map(item => item.usageLabel)).toEqual(['信用貸款', '幸福事件']);
  });

  it('upserts one card log entry per event and card', () => {
    const board = createInitialBoardState([{ uid: 'p1', role: 'player' } as any], 'coach');
    const card = { deck: 'happiness', cardId: 'H011', title: '第一次約會', description: '' } as any;
    const event = { id: 'event-1', playerUid: 'p1', playerName: 'P1', summary: '抽卡', squareIndex: 1, timestamp: 1 } as any;
    const first = appendBoardCardLog(board, card, event);
    const second = appendBoardCardLog({ ...board, cardLog: first }, card, event);
    expect(second).toHaveLength(1);
  });

  it('falls back to only the declining player response for a v2 C012 prompt', () => {
    const room = {
      id: 'room-1',
      boardState: {
        ...createInitialBoardState([{ uid: 'p1', role: 'player' } as any], 'coach'),
        sharedCardPrompt: {
          id: 'event-1_C012_shared',
          sourceCardId: 'C012',
          kind: 'asset_sale',
          responseStorage: 'subcollection',
          targetPlayerUids: ['p1', 'p2'],
          responses: {}
        }
      }
    } as any;
    const response = { playerUid: 'p1', status: 'declined', promptId: 'event-1_C012_shared' } as any;
    const fallback = buildSharedPromptResponseFallback(room, 'event-1_C012_shared', 'p1', response, 'decline:C012', 100);

    expect(fallback.status).toBe('applied');
    expect(fallback.boardState?.sharedCardPrompt?.responses).toEqual({ p1: response });
    expect(fallback.boardState?.revision).toBe(room.boardState.revision + 1);
    expect(buildSharedPromptResponseFallback(room, 'event-1_C012_shared', 'not-target', response, 'x').status).toBe('stale');
  });

  it('persists shared startup sales for every participant and closes once all respond', () => {
    const members = [
      { uid: 'coach', name: 'Coach', role: 'coach', joinedAt: 1 },
      { uid: 'p1', name: 'P1', role: 'player', joinedAt: 1 },
      { uid: 'p2', name: 'P2', role: 'player', joinedAt: 1 }
    ] as const;
    const board = {
      ...createInitialBoardState([...members], 'coach'),
      currentEvent: { id: 'event-1', playerUid: 'p1', playerName: 'P1', type: 'card', summary: '抽卡', squareIndex: 1, timestamp: 1 },
      currentCard: { deck: 'opportunity', cardId: 'C027', title: '收購獨特的創業點子', description: '' },
      sharedCardPrompt: {
        id: 'prompt-1',
        kind: 'asset_sale',
        sourceEventId: 'event-1',
        sourceCardId: 'C027',
        sourcePlayerUid: 'p1',
        sourcePlayerName: 'P1',
        targetPlayerUids: ['p1', 'p2'],
        responses: {},
        createdAt: 1
      }
    } as any;
    const p1 = baseState([{
      id: 'studio-p1',
      name: '兼職工作室 (C027)',
      cost: 5000,
      downPayment: 5000,
      cashflow: 0,
      type: '企業',
      isUpgraded: false
    } as any]);
    const p2 = baseState([{
      id: 'studio-p2',
      name: '兼職工作室 (C027)',
      cost: 5000,
      downPayment: 5000,
      cashflow: 0,
      type: '企業',
      isUpgraded: false
    } as any]);
    const room = {
      id: 'room-1',
      hostId: 'coach',
      status: 'playing',
      members,
      isBoardGame: true,
      playerStates: { p1, p2 },
      boardState: board
    } as any;

    const first = buildSharedAssetSalePromptMutation(room, board, 'prompt-1', 'p1', 'P1', ['studio-p1'], 'sale:p1', 10);
    expect(first.result.status).toBe('applied');
    expect(first.roomPatch?.playerStates?.p1.assets).toEqual([]);
    expect(first.roomPatch?.playerStates?.p1.cash).toBe(3000000);
    expect(first.boardState.sharedCardPrompt?.responses.p1).toMatchObject({ status: 'completed', selectedAssetIds: ['studio-p1'] });

    const roomAfterFirst = {
      ...room,
      playerStates: { p1: first.roomPatch?.playerStates?.p1, p2 },
      boardState: first.boardState
    } as any;
    const second = buildSharedAssetSalePromptMutation(roomAfterFirst, first.boardState, 'prompt-1', 'p2', 'P2', ['studio-p2'], 'sale:p2', 20);
    expect(second.result.status).toBe('applied');
    expect(second.roomPatch?.playerStates?.p2.assets).toEqual([]);
    expect(second.roomPatch?.playerStates?.p2.cash).toBe(3000000);
    expect(second.boardState.sharedCardPrompt).toBeUndefined();

    const duplicate = buildSharedAssetSalePromptMutation(roomAfterFirst, first.boardState, 'prompt-1', 'p1', 'P1', ['studio-p1'], 'sale:p1:retry', 30);
    expect(duplicate.result.status).toBe('duplicate');
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
          effects: [{ type: 'repair_fee', squareIndex: 27 }]
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
    expect(applied.pendingStartupUpgradeAction).toMatchObject({ cardId, symbol: cardId, assetId: `${commandId}:asset` });
    expect(applied.history).toHaveLength(1);
    expect(duplicate).toBe(applied);
  });

  it('keeps pending studio upgrades in order across multiple startup loans', () => {
    const state = baseState([]);
    const first = buildStartupLoanState(state, 'N057', 'startup-loan:first', 10);
    const second = buildStartupLoanState(first, 'N058', 'startup-loan:second', 20);

    expect(second.pendingStartupUpgradeActions).toEqual([
      { cardId: 'N057', symbol: 'N057', assetId: 'startup-loan:first:asset' },
      { cardId: 'N058', symbol: 'N058', assetId: 'startup-loan:second:asset' }
    ]);

    const upgraded = buildStartupUpgradeState(
      {
        ...second,
        pendingStartupUpgradeAction: { ...second.pendingStartupUpgradeActions![0], assetId: 'studio-1' },
        pendingStartupUpgradeActions: second.pendingStartupUpgradeActions!.map((action, index) => index === 0 ? { ...action, assetId: 'studio-1' } : action),
        assets: second.assets.map((asset, index) => index === 0 ? { ...asset, id: 'studio-1' } : asset),
        liabilities: second.liabilities.map((liability, index) => index === 0 ? { ...liability, linkedAssetId: 'studio-1' } : liability)
      },
      { assetId: 'studio-1', cardId: 'N057', diceRoll: 6 },
      'startup-upgrade:first',
      30
    );
    expect(upgraded.pendingStartupUpgradeAction).toEqual({ cardId: 'N058', symbol: 'N058', assetId: 'startup-loan:second:asset' });
    expect(upgraded.pendingStartupUpgradeActions).toEqual([{ cardId: 'N058', symbol: 'N058', assetId: 'startup-loan:second:asset' }]);
  });

  it('recovers every unupgraded studio and can upgrade the second queued asset directly', () => {
    const state = baseState([
      { id: 'studio-1', name: 'N057 兼職工作室', cost: 5000, downPayment: 5000, cashflow: 0, type: '企業', isUpgraded: false },
      { id: 'studio-2', name: 'N058 兼職工作室', cost: 5000, downPayment: 5000, cashflow: 0, type: '企業', isUpgraded: false }
    ]);
    state.pendingStartupUpgradeAction = { cardId: 'N057', symbol: 'N057', assetId: 'studio-1' };
    state.liabilities = [
      { id: 'loan-1', name: '企業貸款 (N057)', totalOwed: 600000, monthlyPayment: 3000, type: '企業貸款', linkedAssetId: 'studio-1' },
      { id: 'loan-2', name: '企業貸款 (N058)', totalOwed: 600000, monthlyPayment: 3000, type: '企業貸款', linkedAssetId: 'studio-2' }
    ];

    expect(getPendingStartupUpgradeActions(state)).toEqual([
      { cardId: 'N057', symbol: 'N057', assetId: 'studio-1' },
      { cardId: 'N058', symbol: 'N058', assetId: 'studio-2' }
    ]);

    const upgraded = buildStartupUpgradeState(
      state,
      { assetId: 'studio-2', cardId: 'N058', diceRoll: 4 },
      'startup-upgrade:second',
      30
    );
    expect(upgraded.assets.find(asset => asset.id === 'studio-2')).toMatchObject({ isUpgraded: true, cashflow: 40000 });
    expect(upgraded.pendingStartupUpgradeActions).toEqual([{ cardId: 'N057', symbol: 'N057', assetId: 'studio-1' }]);
  });

  it('buys a target enterprise once with its income stored only on the asset', () => {
    const state = baseState([]);
    state.cash = 10000000;
    state.currentRankLevel = 1;
    state.profession = { id: 'p1', title: '職業', initialRank: '初階', salary: 100000, savings: 0, expenses: { tax: 0, basicLiving: 0, transportEdu: 0, otherMedicalChild: 0 }, mortgageTotal: 0, businessLoanTotal: 0, creditLoanTotal: 0, promotions: [] };
    state.selectedEnterprise = { id: 'e1', name: '目標企業', cost: 5000000, income: 4500000, relatedProfessionId: 'other', relatedBonusPercent: 0, happyPoints: 10 };
    state.happiness = [{ id: 'h_career', label: '事業成就', points: 10, checked: false }];

    const result = buildTargetEnterprisePurchaseState(state, {
      name: '達成事業成就：目標企業', amount: 5000000, cashChange: -5000000,
      source: 'cash', usage: 'asset', assetDetails: { type: '企業', cashflow: 4500000, downPayment: 5000000, symbol: '目標企業' }
    }, 'target-enterprise:p1', 10);

    expect(result.status).toBe('applied');
    expect(result.state?.assets).toHaveLength(1);
    expect(result.state?.assets[0]).toMatchObject({ type: '企業', cashflow: 4500000 });
    expect(result.state?.income['目標企業']).toBeUndefined();
    expect(result.state?.happiness[0].checked).toBe(true);
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

  it('recovers a legacy N057 upgrade only when its matching studio loan still exists', () => {
    const state = baseState([{
      id: 'legacy-studio', name: 'N057 兼職工作室', cost: 5000, downPayment: 5000,
      cashflow: 0, type: '企業', isUpgraded: false
    }]);
    state.liabilities = [{
      id: 'legacy-loan', name: '企業貸款 (N057)', totalOwed: 600000,
      monthlyPayment: 3000, type: '企業貸款', linkedAssetId: 'legacy-studio'
    }];

    expect(resolveStartupUpgradeTarget(state, { assetId: 'legacy-studio', cardId: 'N057' }))
      .toMatchObject({ pending: { cardId: 'N057', symbol: 'N057' }, recovered: true });
    expect(resolveStartupUpgradeTarget({ ...state, liabilities: [] }, { assetId: 'legacy-studio', cardId: 'N057' }))
      .toBeNull();
  });

  it('resolves a stale startup asset id from the current pending card', () => {
    const state = {
      ...baseState([{
        id: 'authoritative-studio',
        name: 'N057 兼職工作室',
        cost: 5000,
        downPayment: 5000,
        cashflow: 0,
        type: '企業',
        isUpgraded: false
      }]),
      pendingStartupUpgradeAction: { cardId: 'N057', symbol: 'N057' }
    } as GameState;

    const upgraded = buildStartupUpgradeState(
      state,
      { assetId: 'stale-ui-id', cardId: 'N057', diceRoll: 5 },
      'startup-upgrade:stale-id',
      10
    );

    expect(upgraded.assets[0]).toMatchObject({ id: 'authoritative-studio', isUpgraded: true });
  });

  it('recovers when a stored pending asset id is stale', () => {
    const state = {
      ...baseState([{
        id: 'authoritative-studio',
        name: 'N057 兼職工作室',
        cost: 5000,
        downPayment: 5000,
        cashflow: 0,
        type: '企業',
        isUpgraded: false
      }]),
      pendingStartupUpgradeAction: { cardId: 'N057', symbol: 'N057', assetId: 'removed-asset' },
      liabilities: [{
        id: 'startup-loan', name: '企業貸款 (N057)', totalOwed: 600000,
        monthlyPayment: 3000, type: '企業貸款', linkedAssetId: 'authoritative-studio'
      }]
    } as GameState;

    const upgraded = buildStartupUpgradeState(
      state,
      { assetId: 'removed-asset', cardId: 'N057', diceRoll: 5 },
      'startup-upgrade:recovered',
      10
    );

    expect(upgraded.assets[0]).toMatchObject({ id: 'authoritative-studio', isUpgraded: true });
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

  it('builds a school promotion result from the latest player state', () => {
    const state = {
      ...baseState([]),
      cash: 9000,
      currentRankLevel: 1,
      currentRankTitle: '初階職員',
      profession: {
        id: 'profession-1', title: '職業', initialRank: '初階職員', salary: 30000, savings: 0,
        expenses: { tax: 0, basicLiving: 0, transportEdu: 0, otherMedicalChild: 0 },
        mortgageTotal: 0, businessLoanTotal: 0, creditLoanTotal: 0,
        promotions: [{ rankTitle: '進階職員', condition: '擲骰 ≥ 2', bonus: 5000 }]
      }
    } as GameState;

    const result = buildSchoolPromotionState(state, true, 'skill-roll:school-1', 100);

    expect(result.state).toMatchObject({
      cash: 9000,
      currentRankLevel: 2,
      currentRankTitle: '進階職員',
      profession: { salary: 35000 }
    });
    expect(result.state.history[0]).toMatchObject({ id: 'skill-roll:school-1', amount: 5000 });
    expect(result.bonus).toBe(5000);
  });
});

it('keeps controller ownership stable when another tab renews its heartbeat', () => {
  expect(selectActiveControllerClaim([
    {clientId:'owner',claimedAt:1000,lastSeenAt:29000},
    {clientId:'reader',claimedAt:2000,lastSeenAt:30000}
  ],30000)?.clientId).toBe('owner');
});

 it('keeps a paid continuation pending through every event advance caller', () => {
  const board = {currentTurnUid:'p1',turnOrder:['p1'],playerPositions:{p1:0},skipTurns:{p1:0},hasRolled:true,pendingEvents:[],revision:1} as BoardState;
  board.pendingContinuation = {sessionId:'s1',sourceEventId:'e1',cardId:'C003',playerUid:'p1',commandId:'pay1',kind:'lifelong-learning',phase:'awaiting_roll',learningType:'enhance_profession',requiredRoll:2,createdAt:1};
  expect(buildBoardEventAdvanceState({boardState:board} as any)).toBeNull();
  board.pendingContinuation = {...board.pendingContinuation,phase:'completed',result:{roll:1,target:2,success:false}};
  expect(buildBoardEventAdvanceState({boardState:board} as any)).not.toBeNull();
});


it('ties a final bank service window to the actual bank landing event without changing money', () => {
  const player = { ...baseState([]), boardPosition: 5, skipTurns: 0, cash: 10000 };
  const result = buildBoardMovementLegResolution({
    members: [{ uid: 'player', name: 'Player' }], playerStates: {player},
    boardState: { currentTurnUid: 'player', turnOrder: ['player'], playerPositions: {player: 5}, skipTurns: {player: 0},
      cardLog: [], movement: { playerUid: 'player', startPosition: 5, path: [6], dice: [1], rollTotal: 1,
        startedAt: 100, stepDurationMs: 380, introDelayMs: 3000, landingDelayMs: 600, isActive: true } }
  } as any, 'player')!;
  expect(result.boardState.currentEvent?.id).toBe('player_100_bank_land');
  expect(result.playerStates.player.bankServiceGrantedAtEventId).toBe(result.boardState.currentEvent?.id);
  expect(result.playerStates.player.cash).toBe(10000);
});

it('preserves authoritative public subscriptions across room snapshots but clears them for a new session',()=>{
 const current={id:'room',sessionId:'s',publicPlayerStorage:'subcollection',publicPlayerStates:{p:{uid:'p',happinessTotal:10}}} as any;
 const snapshot={...current,publicPlayerStates:{p:{uid:'p',happinessTotal:0}}};
 expect(mergeRoomSnapshotWithPrivateStates(snapshot,current).publicPlayerStates).toBe(current.publicPlayerStates);
 expect(mergeRoomSnapshotWithPrivateStates({...snapshot,sessionId:'next'},current).publicPlayerStates).toEqual({});
 expect(mergeRoomSnapshotWithPrivateStates({...snapshot,publicPlayerStorage:undefined},current).publicPlayerStates).toEqual(snapshot.publicPlayerStates);
});

import { describe, expect, it } from 'vitest';
import { GameState } from '../types';
import { isForcedBoardCard, resolveBoardCardAction } from './boardCardActions';

const createGameState = (overrides: Partial<GameState> = {}): GameState => ({
  profession: null,
  selectedEnterprise: null,
  selectedDream: null,
  expenses: {
    taxes: 0,
    mortgage: 0,
    studentLoan: 0,
    creditCard: 0,
    other: 0,
    basicLiving: 0,
    transportEdu: 0,
    otherMedicalChild: 0
  },
  income: {
    salary: 0,
    investment: 0,
    other: 0
  },
  currentRankTitle: '',
  currentRankLevel: 1,
  cash: 5000000,
  children: 0,
  medicalInsuranceCount: 0,
  assets: [],
  liabilities: [],
  loans: 0,
  isSetup: true,
  history: [],
  happiness: [],
  happinessTotal: 0,
  marketPrices: {},
  previousMarketPrices: {},
  lastPublishedCode: '',
  abilities: {
    stockAbilityCount: 0,
    realEstateAbilityCount: 0,
    professionAbilityCount: 0
  },
  completedHappinessEvents: [],
  ...overrides
});

describe('resolveBoardCardAction', () => {
  it('C042: no house means no payment flow', () => {
    const action = resolveBoardCardAction('C042', createGameState());
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    expect(action.options).toHaveLength(1);
    expect(action.options[0].action.kind).toBe('dismiss');
  });

  it('C042: insured house skips payment', () => {
    const action = resolveBoardCardAction('C042', createGameState({
      assets: [{
        id: 'house-1',
        name: 'N001 單間小套房',
        cost: 1000000,
        downPayment: 300000,
        cashflow: 10000,
        type: '不動產',
        isInsured: true
      }]
    }));
    expect(action.kind).toBe('choice');
  });

  it('C042: uninsured house enters financial flow', () => {
    const action = resolveBoardCardAction('C042', createGameState({
      assets: [{
        id: 'house-1',
        name: 'N001 單間小套房',
        cost: 1000000,
        downPayment: 300000,
        cashflow: 10000,
        type: '不動產'
      }]
    }));
    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.cashChange).toBe(-100000);
  });

  it('C039: no vehicle means no payment flow', () => {
    const action = resolveBoardCardAction('C039', createGameState());
    expect(action.kind).toBe('choice');
  });

  it('C039: insured vehicle skips payment', () => {
    const action = resolveBoardCardAction('C039', createGameState({
      assets: [{
        id: 'car-1',
        name: '汽車',
        cost: 600000,
        downPayment: 120000,
        cashflow: 0,
        type: '汽車',
        isInsured: true
      }]
    }));
    expect(action.kind).toBe('choice');
  });

  it('C039: legacy aircraft also counts as vehicle ownership', () => {
    const action = resolveBoardCardAction('C039', createGameState({
      assets: [{
        id: 'car-legacy',
        name: '飛行器',
        cost: 600000,
        downPayment: 120000,
        cashflow: 0,
        type: '飛行器'
      }]
    }));
    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.cashChange).toBe(-100000);
  });

  it('C048 keeps shared expense effect for all players', () => {
    const action = resolveBoardCardAction('C048', createGameState());
    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.afterApply?.affectsAllPlayersExpense).toEqual({
      amount: 1000,
      category: 'basicLiving',
      isIncrease: true
    });
  });

  it('C055 uses otherMedicalChild expense category', () => {
    const action = resolveBoardCardAction('C055', createGameState());
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    const acceptOption = action.options.find(option => option.id === 'accept');
    expect(acceptOption?.action.kind).toBe('financial');
    if (!acceptOption || acceptOption.action.kind !== 'financial') return;
    expect(acceptOption.action.txData.expensePayload).toEqual({
      category: 'otherMedicalChild',
      amount: 2000,
      isIncrease: true
    });
  });

  it('C054 requires accept before expense reduction', () => {
    const action = resolveBoardCardAction('C054', createGameState());
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    const acceptOption = action.options.find(option => option.id === 'accept');
    expect(acceptOption?.action.kind).toBe('financial');
    if (!acceptOption || acceptOption.action.kind !== 'financial') return;
    expect(acceptOption.action.txData.expensePayload).toEqual({
      category: 'basicLiving',
      amount: 500,
      isIncrease: false
    });
  });

  it('N055 creates investment input flow', () => {
    const action = resolveBoardCardAction('N055', createGameState());
    expect(action.kind).toBe('investment');
    if (action.kind !== 'investment') return;
    expect(action.minAmount).toBe(1000000);
    expect(action.maxAmount).toBe(50000000);
    expect(action.monthlyReturnPerStep).toBe(200000);
  });

  it('N057 uses investment amount as startup asset value, not loan amount', () => {
    const action = resolveBoardCardAction('N057', createGameState());
    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.amount).toBe(5000);
    expect(action.txData.cashChange).toBe(595000);
    expect(action.txData.assetDetails).toMatchObject({
      type: '企業',
      downPayment: 5000,
      loanAmount: 600000,
      loanInterest: 3000,
      symbol: 'N057'
    });
    expect(action.txData.impacts).toEqual([
      '現金 -5,000',
      '現金（企業貸款） +600,000',
      'N057 兼職工作室 +5,000',
      '企業貸款 +600,000',
      '企業貸款利息(月) +3,000'
    ]);
    expect(action.expectedEntries).toEqual([
      { category: 'Assets', name: '現金', direction: 'Decrease' },
      { category: 'Assets', name: '現金（企業貸款）', direction: 'Increase' },
      { category: 'Assets', name: 'N057 兼職工作室', direction: 'Increase' },
      { category: 'Liabilities', name: '企業貸款', direction: 'Increase' },
      { category: 'Expenses', name: '企業貸款利息', direction: 'Increase' }
    ]);
  });

  it('N056 and N058 follow the same startup loan structure', () => {
    const n056 = resolveBoardCardAction('N056', createGameState());
    const n058 = resolveBoardCardAction('N058', createGameState());

    expect(n056.kind).toBe('financial');
    expect(n058.kind).toBe('financial');

    if (n056.kind !== 'financial' || n058.kind !== 'financial') return;

    expect(n056.txData.assetDetails).toMatchObject({
      downPayment: 3000,
      loanAmount: 500000,
      loanInterest: 1500,
      symbol: 'N056'
    });
    expect(n058.txData.assetDetails).toMatchObject({
      downPayment: 5000,
      loanAmount: 600000,
      loanInterest: 3000,
      symbol: 'N058'
    });
  });

  it('C051 directly enters happiness follow-up flow', () => {
    const action = resolveBoardCardAction('C051', createGameState());
    expect(action.kind).toBe('effect');
    if (action.kind !== 'effect') return;
    expect(action.afterApply?.drawCard).toBe('happiness');
  });

  it('C053 directly enters happiness follow-up flow', () => {
    const action = resolveBoardCardAction('C053', createGameState());
    expect(action.kind).toBe('effect');
    if (action.kind !== 'effect') return;
    expect(action.afterApply?.drawCard).toBe('happiness');
  });

  it('C056 requires accept before news follow-up', () => {
    const action = resolveBoardCardAction('C056', createGameState());
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    const acceptOption = action.options.find(option => option.id === 'accept');
    expect(acceptOption?.action.kind).toBe('effect');
    if (!acceptOption || acceptOption.action.kind !== 'effect') return;
    expect(acceptOption.action.afterApply?.drawCard).toBe('news');
  });

  it('C051 and C053 are forced board cards', () => {
    expect(isForcedBoardCard('C051')).toBe(true);
    expect(isForcedBoardCard('C053')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { GameState, TransactionData } from '../../types';
import { normalizeGameState } from '../../utils/gameState';
import { applyBoardTransaction, applyPaydayCollection, createSequentialIdGenerator } from './applyBoardTransaction';

const state = (overrides: Partial<GameState> = {}): GameState => normalizeGameState({
  profession: { id: 'p1', name: '測試', salary: 60000, promotions: [] } as any,
  cash: 100000,
  liabilities: [],
  loans: 0,
  history: [],
  happiness: [],
  appliedBoardFinancialEventIds: [],
  ...overrides,
} as any);

const expense = (overrides: Partial<TransactionData> = {}): TransactionData => ({
  name: '機運卡：支出',
  usage: 'expense',
  source: 'cash',
  amount: 30000,
  cashChange: -30000,
  boardEventId: 'evt-1',
  ...overrides,
} as TransactionData);

const env = (seed = 'cmd-1') => ({ now: 1_800_000_000_000, generateId: createSequentialIdGenerator(seed) });

describe('applyBoardTransaction（伺服器交易使用）', () => {
  it('扣除現金並記錄 boardEventId，重送同一事件視為重複', () => {
    const first = applyBoardTransaction(state(), expense(), env());
    expect(first.status).toBe('applied');
    if (first.status !== 'applied') return;
    expect(first.state.cash).toBe(70000);
    expect(first.state.appliedBoardFinancialEventIds).toContain('evt-1');
    expect(first.state.history).toHaveLength(1);

    const second = applyBoardTransaction(first.state, expense(), env());
    expect(second.status).toBe('duplicate');
  });

  it('現金不足時回傳 insufficient_cash 與差額，不修改狀態', () => {
    const result = applyBoardTransaction(state({ cash: 10000 }), expense(), env());
    expect(result).toMatchObject({ status: 'error', code: 'insufficient_cash', shortfall: 20000 });
  });

  it('信貸周轉與主交易同一筆套用：現金、負債、月利息一起變動', () => {
    const result = applyBoardTransaction(
      state({ cash: 10000 }),
      expense({ fundingLoanAmount: 20000 }),
      env()
    );
    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.state.cash).toBe(0);
    expect(result.state.liabilities).toHaveLength(1);
    expect(result.state.liabilities[0]).toMatchObject({ type: '信用貸款', totalOwed: 20000, monthlyPayment: 2000 });
  });

  it('超過信貸上限時回傳 credit_limit', () => {
    const result = applyBoardTransaction(
      state({ cash: 0 }),
      expense({ fundingLoanAmount: 700000, cashChange: -30000, amount: 30000 }),
      env()
    );
    expect(result).toMatchObject({ status: 'error', code: 'credit_limit' });
  });

  it('伺服器重試時 id 由 commandId 衍生，結果完全相同', () => {
    const data = expense({
      name: '新聞卡：住宅',
      usage: 'asset',
      source: 'loan',
      amount: 300000,
      cashChange: -30000,
      assetDetails: { type: '不動產', cashflow: 0, downPayment: 30000, symbol: 'N001', loanAmount: 270000, loanInterest: 1350 },
    } as any);
    const a = applyBoardTransaction(state(), data, env('same'));
    const b = applyBoardTransaction(state(), data, env('same'));
    expect(a).toEqual(b);
    if (a.status !== 'applied') return;
    expect(a.state.assets[0].id).toBe('same#1');
  });

  it('信用貸款以正規化後的格式（source=loan）也能正確建立負債與現金', () => {
    const result = applyBoardTransaction(
      state(),
      { name: '申請信用貸款', usage: 'cash', source: 'loan', amount: 100000, cashChange: 100000, commandId: 'loan:1' } as any,
      env()
    );
    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.state.cash).toBe(200000);
    expect(result.state.liabilities[0]).toMatchObject({ type: '信用貸款', totalOwed: 100000, monthlyPayment: 10000 });
  });
});

describe('applyPaydayCollection（棋盤銀行事件的每月結餘）', () => {
  const withProfession = (overrides: Partial<GameState> = {}) => state({
    profession: { id: 'p1', name: '測試', salary: 60000, promotions: [] } as any,
    income: { salary: 60000, investment: 0, other: 0 } as any,
    expenses: { taxes: 0, mortgage: 0, studentLoan: 0, creditCard: 0, other: 0, basicLiving: 0, transportEdu: 0, otherMedicalChild: 0 } as any,
    assets: [],
    liabilities: [],
    ...overrides,
  });

  it('現金流為正時直接入帳，不產生強制負債', () => {
    const s = withProfession({ cash: 0 });
    const result = applyPaydayCollection(s, { multiplier: 1 }, 'bank-evt-1', env());
    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.forcedDebtAmount).toBe(0);
    expect(result.state.cash).toBeGreaterThan(0);
    expect(result.state.liabilities).toHaveLength(0);
  });

  it('現金不足支付月支出時自動計入強制負債，現金歸零', () => {
    const s = withProfession({
      cash: 0,
      profession: { id: 'p1', name: '測試', salary: 0, promotions: [] } as any,
      income: { salary: 0, investment: 0, other: 0 } as any,
      expenses: { taxes: 0, mortgage: 0, studentLoan: 0, creditCard: 0, other: 0, basicLiving: 30000, transportEdu: 0, otherMedicalChild: 0 } as any,
    });
    const result = applyPaydayCollection(s, { multiplier: 1 }, 'bank-evt-2', env());
    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.flow).toBe(-30000);
    expect(result.forcedDebtAmount).toBe(30000);
    expect(result.state.cash).toBe(0);
    expect(result.state.liabilities).toEqual([
      expect.objectContaining({ type: '強制負債', totalOwed: 30000 }),
    ]);
    expect(result.state.history.map((h) => h.name)).toEqual(['月結餘不足：強制計入負債', '每月結餘']);
  });

  it('同一個棋盤事件重送視為重複，不重複入帳', () => {
    const s = withProfession({ cash: 0 });
    const first = applyPaydayCollection(s, { multiplier: 1 }, 'bank-evt-3', env());
    expect(first.status).toBe('applied');
    if (first.status !== 'applied') return;
    const second = applyPaydayCollection(first.state, { multiplier: 1 }, 'bank-evt-3', env());
    expect(second).toEqual({ status: 'duplicate' });
  });
});

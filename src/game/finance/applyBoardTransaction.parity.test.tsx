import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState, TransactionData } from '../../types';
import { normalizeGameState as realNormalizeGameState } from '../../utils/gameState';
import { prepareBoardTransaction, reduceBoardTransaction } from './applyBoardTransaction';
import { useGameLogic } from '../../hooks/useGameLogic';

/**
 * 特徵測試（golden master）：快照是用「抽出純函式之前」的 `handleTransactionSubmit`
 * 產生的，之後每次修改都必須維持完全相同的狀態、提示訊息與回傳值。
 * 同時確認 hook 的結果與純函式 `prepare/reduce` 一致（伺服器交易會用同一份純函式）。
 */

let mockGame: any;
vi.mock('../../context/GameContext', async () => {
  const gameState = await import('../../utils/gameState');
  return {
    normalizeGameState: gameState.normalizeGameState,
    useGame: () => mockGame,
  };
});

const createState = (overrides: Partial<GameState> = {}): GameState => realNormalizeGameState({
  profession: { id: 'p1', name: '測試職業', salary: 60000, promotions: [] } as any,
  selectedEnterprise: null,
  selectedDream: null,
  expenses: { taxes: 0, mortgage: 0, studentLoan: 0, creditCard: 0, other: 0, basicLiving: 10000, transportEdu: 6000, otherMedicalChild: 4000 } as any,
  income: { salary: 60000, investment: 0, other: 0 } as any,
  currentRankTitle: '初階',
  currentRankLevel: 1,
  cash: 1_000_000,
  children: 0,
  medicalInsuranceCount: 0,
  assets: [
    { id: 'a-stock', name: '台積電 (TSMC)', cost: 100000, downPayment: 100000, cashflow: 0, type: '股票', quantity: 10, lastPurchasePrice: 10000 },
    { id: 'a-house', name: '不動產 N038', cost: 3000000, downPayment: 500000, cashflow: 12000, type: '不動產', isInsured: false },
    { id: 'a-deposit', name: '定存', cost: 200000, downPayment: 200000, cashflow: 2000, type: '定存' },
    { id: 'a-car', name: '汽車', cost: 600000, downPayment: 120000, cashflow: 0, type: '汽車', isInsured: false },
  ] as any,
  liabilities: [
    { id: 'l-credit-1', name: '信用貸款', totalOwed: 100000, monthlyPayment: 10000, type: '信用貸款' },
    { id: 'l-credit-2', name: '信用貸款', totalOwed: 50000, monthlyPayment: 5000, type: '信用貸款' },
    { id: 'l-house', name: '不動產貸款 (N038)', totalOwed: 2500000, monthlyPayment: 12500, type: '不動產貸款', linkedAssetId: 'a-house' },
  ] as any,
  loans: 30000,
  isSetup: true,
  history: [],
  happiness: [
    { id: 'h_date', label: '第一次約會', points: 2, checked: false },
    { id: 'h_career', label: '事業', points: 5, checked: false },
    { id: 'h_dream', label: '夢想', points: 5, checked: false },
    { id: 'h_house_self', label: '自用住宅', points: 0, checked: false },
    { id: 'h_single', label: '單間小套房', points: 3, checked: false },
  ] as any,
  happinessTotal: 0,
  marketPrices: {},
  previousMarketPrices: {},
  lastPublishedCode: '',
  abilities: { stockAbilityCount: 0, realEstateAbilityCount: 0, professionAbilityCount: 0 },
  completedHappinessEvents: [],
  appliedBoardFinancialEventIds: ['already-applied'],
  pendingMedicalClaims: [],
  ...overrides,
} as any);

const tx = (partial: Partial<TransactionData> & Pick<TransactionData, 'name' | 'usage' | 'source'>): TransactionData => ({
  amount: 0,
  cashChange: 0,
  ...partial,
} as TransactionData);

interface Case {
  name: string;
  data: TransactionData;
  state?: Partial<GameState>;
  acceleration?: any;
}

const cases: Case[] = [
  { name: '買入股票（已持有）', data: tx({ name: '買入股票', usage: 'asset', source: 'cash', amount: 20000, cashChange: -20000, stockList: [{ symbol: 'TSMC', price: 10000, qty: 2 }] }) },
  { name: '買入股票（新標的）', data: tx({ name: '買入股票', usage: 'asset', source: 'cash', amount: 30000, cashChange: -30000, stockList: [{ symbol: 'NEW', price: 15000, qty: 2 }] }) },
  { name: '賣出股票（部分）', data: tx({ name: '賣出股票', usage: 'cash', source: 'income', amount: 30000, cashChange: 30000, stockList: [{ symbol: 'TSMC', price: 15000, qty: 2 }] }) },
  { name: '賣出股票（全部）', data: tx({ name: '賣出股票', usage: 'cash', source: 'income', amount: 150000, cashChange: 150000, stockList: [{ symbol: 'TSMC', price: 15000, qty: 10 }] }) },
  { name: 'buy_asset 股票 → 正規化', data: tx({ name: '買股', usage: 'buy_asset', source: 'cash', amount: 10000, cashChange: -10000, assetChange: { action: 'add', asset: { name: '股票', type: '股票', symbol: 'TSMC', shares: 1, buyPrice: 10000 } } }) },
  { name: '買入定存', data: tx({ name: '買入定期存款', usage: 'asset', source: 'cash', amount: 100000, cashChange: -100000, assetDetails: { type: '定存', cashflow: 1000, downPayment: 100000 } }) },
  { name: '買入不動產（貸款＋自用幸福點）', data: tx({ name: '新聞卡：住宅', usage: 'asset', source: 'loan', amount: 3000000, cashChange: -300000, assetDetails: { type: '不動產', cashflow: 0, downPayment: 300000, symbol: 'N001', loanAmount: 2700000, loanInterest: 13500, isSelfUse: true, houseType: '1room', happyPoints: 3 } }) },
  { name: '買入不動產（第二間自用，幸福項目已勾）', state: { happiness: [{ id: 'h_single', label: '單間小套房', points: 3, checked: true }] as any }, data: tx({ name: '新聞卡：住宅', usage: 'asset', source: 'loan', amount: 3000000, cashChange: -300000, assetDetails: { type: '不動產', cashflow: 0, downPayment: 300000, symbol: 'N001', loanAmount: 2700000, loanInterest: 13500, isSelfUse: true, houseType: '1room', happyPoints: 3 } }) },
  { name: '買入企業（企業貸款）', data: tx({ name: '新聞卡：創業貸款', usage: 'asset', source: 'loan', amount: 3000, cashChange: 497000, assetDetails: { type: '企業', cashflow: 0, downPayment: 3000, symbol: 'N056', loanAmount: 500000, loanInterest: 1500 } }) },
  { name: '買入汽車', data: tx({ name: '買入汽車（增加一顆骰子）', usage: 'asset', source: 'cash', amount: 600000, cashChange: -120000, assetDetails: { type: '汽車', cashflow: 0, downPayment: 120000, loanAmount: 480000, loanInterest: 2400 } }) },
  { name: '信用貸款（銀行，正規化前 usage=loan）', data: tx({ name: '申請信用貸款', usage: 'loan', source: 'cash', amount: 100000, cashChange: 100000, liabilityChange: { action: 'add', liability: { id: 'bank_loan', name: '信用貸款 (Legacy)', type: '信用貸款', totalOwed: 100000, monthlyPayment: 10000 } } }) },
  { name: '信用貸款（已正規化 source=loan）', data: tx({ name: '申請信用貸款', usage: 'cash', source: 'loan', amount: 100000, cashChange: 100000 }) },
  { name: '信用貸款超過上限', data: tx({ name: '申請信用貸款', usage: 'cash', source: 'loan', amount: 900000, cashChange: 900000 }) },
  { name: '還款：多筆信用貸款（含舊 loans）', data: tx({ name: '償還信用貸款', usage: 'liability', source: 'cash', amount: 170000, cashChange: -170000, liabilityId: 'multiple_credit_loans' }) },
  { name: '還款：指定負債', data: tx({ name: '償還房貸', usage: 'liability', source: 'cash', amount: 500000, cashChange: -500000, liabilityId: 'l-house' }) },
  { name: '還款：舊 bank_loan', data: tx({ name: '償還信用貸款', usage: 'liability', source: 'cash', amount: 20000, cashChange: -20000, liabilityId: 'bank_loan' }) },
  { name: '還款：超過負債金額', data: tx({ name: '償還房貸', usage: 'liability', source: 'cash', amount: 9000000, cashChange: -9000000, liabilityId: 'l-house' }) },
  { name: '還款：現金不足', state: { cash: 1000 }, data: tx({ name: '償還房貸', usage: 'liability', source: 'cash', amount: 500000, cashChange: -500000, liabilityId: 'l-house' }) },
  { name: '強制負債', data: tx({ name: '強制負債', usage: 'forced_debt', source: 'loan', amount: 50000, cashChange: 50000 }) },
  { name: '幸福事件（既有項目）', data: tx({ name: '幸福卡：第一次約會', usage: 'happiness_event', source: 'cash', amount: 3000, cashChange: -3000, happinessEventPayload: { id: 'date', name: '第一次約會', amount: 3000, points: 2, progressId: 'date', happinessItemId: 'h_date', sourceCardId: 'H011' } }) },
  { name: '幸福事件（自訂項目＋月支出）', data: tx({ name: '幸福卡：其他', usage: 'happiness_event', source: 'cash', amount: 1000, cashChange: -1000, happinessEventPayload: { id: 'x1', name: '特別的事', amount: 1000, points: 1, monthlyExpenseChange: 2000, expenseCategory: 'basicLiving', sourceCardId: 'H099' } }) },
  { name: '月支出增加', data: tx({ name: '增加月支出', usage: 'expense_update', source: 'income', amount: 1000, cashChange: 0, expensePayload: { category: 'basicLiving', amount: 1000, isIncrease: true } }) },
  { name: '月支出減少（不低於 0）', data: tx({ name: '減少月支出', usage: 'expense_update', source: 'income', amount: 999999, cashChange: 0, expensePayload: { category: 'transportEdu', amount: 999999, isIncrease: false } }) },
  { name: '賣出資產：定存部分解約', data: tx({ name: '解約定存', usage: 'cash', source: 'income', amount: 50000, cashChange: 50000, relatedAssetId: 'a-deposit' }) },
  { name: '賣出資產：不動產（移除貸款）', data: tx({ name: '賣出不動產', usage: 'cash', source: 'income', amount: 3500000, cashChange: 3500000, relatedAssetId: 'a-house' }) },
  { name: '賣出資產：批次', data: tx({ name: '批次出售', usage: 'cash', source: 'income', amount: 500000, cashChange: 500000, batchSellList: [{ asset: { id: 'a-house' } as any, liability: { id: 'l-house' } as any, price: 3500000 } as any] }) },
  { name: '股票配股', data: tx({ name: '領取配股股利', usage: 'stock_update', source: 'income', amount: 0, cashChange: 0, stockDividendPayload: { items: [{ assetId: 'a-stock', addedQty: 2 }] } }) },
  { name: '保險：醫療', data: tx({ name: '購買醫療保險', usage: 'expense', source: 'cash', amount: 2000, cashChange: 0, insuranceType: 'medical', insurancePayload: { medicalQty: 1 }, expensePayload: { category: 'otherMedicalChild', amount: 2000, isIncrease: true } }) },
  { name: '保險：房屋', data: tx({ name: '購買房屋保險', usage: 'expense', source: 'cash', amount: 2000, cashChange: 0, insuranceType: 'house', insurancePayload: { targetAssetIds: ['a-house'] }, expensePayload: { category: 'basicLiving', amount: 2000, isIncrease: true } }) },
  { name: '保險：汽車', data: tx({ name: '購買汽車保險', usage: 'expense', source: 'cash', amount: 2000, cashChange: 0, insuranceType: 'aircraft', insurancePayload: { aircraft: true }, expensePayload: { category: 'transportEdu', amount: 2000, isIncrease: true } }) },
  { name: '保險 usage=insurance → 正規化', data: tx({ name: '購買醫療保險', usage: 'insurance', source: 'cash', amount: 0, cashChange: 0, insuranceType: 'medical', insurancePayload: { medicalQty: 1 }, expensePayload: { category: 'otherMedicalChild', amount: 2000, isIncrease: true } } as any) },
  { name: '達成事業成就', state: { selectedEnterprise: { id: 'e1', name: '咖啡店', cost: 500000, income: 20000, relatedProfessionId: 'p1' } as any, currentRankLevel: 3, income: { salary: 60000, investment: 0, other: 0, 咖啡店: 20000 } as any }, data: tx({ name: '達成事業成就：咖啡店', usage: 'asset', source: 'cash', amount: 500000, cashChange: -500000, assetDetails: { type: '企業', cashflow: 0, downPayment: 500000, symbol: '咖啡店' } }) },
  { name: '實現人生夢想', data: tx({ name: '實現人生夢想：環島', usage: 'expense', source: 'cash', amount: 100000, cashChange: -100000 }) },
  { name: '周轉：強制負債＋一般支出', state: { cash: 1000 }, data: tx({ name: '機運卡：支出', usage: 'expense', source: 'cash', amount: 50000, cashChange: -50000, forcedDebtAmount: 49000, boardEventId: 'evt-1' }) },
  { name: '周轉：信貸＋一般支出', state: { cash: 1000 }, data: tx({ name: '機運卡：支出', usage: 'expense', source: 'cash', amount: 50000, cashChange: -50000, fundingLoanAmount: 49000, boardEventId: 'evt-2' }) },
  { name: '周轉：兩種同時使用（錯誤）', data: tx({ name: '機運卡：支出', usage: 'expense', source: 'cash', amount: 5000, cashChange: -5000, forcedDebtAmount: 1000, fundingLoanAmount: 1000 }) },
  { name: '現金不足', state: { cash: 100 }, data: tx({ name: '機運卡：支出', usage: 'expense', source: 'cash', amount: 50000, cashChange: -50000 }) },
  { name: '收入加成', acceleration: { multiplier: 2 }, data: tx({ name: '賣出資產', usage: 'cash', source: 'income', amount: 10000, cashChange: 10000, incomeMultiplierEligible: true, relatedAssetId: 'a-car' }) },
  { name: '重複的 boardEventId', data: tx({ name: '機運卡：支出', usage: 'expense', source: 'cash', amount: 1000, cashChange: -1000, boardEventId: 'already-applied' }) },
  { name: '股票金額不一致（錯誤）', data: tx({ name: '買入股票', usage: 'asset', source: 'cash', amount: 1, cashChange: -1, stockList: [{ symbol: 'TSMC', price: 10000, qty: 2 }] }) },
  { name: '無效金額（錯誤）', data: tx({ name: '奇怪', usage: 'expense', source: 'cash', amount: -5, cashChange: 0 }) },
];

const FIXED_NOW = 1_800_000_000_000;

const seedRandom = () => {
  let n = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    n += 1;
    return (n * 0.137) % 1;
  });
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const runOld = (state: GameState, data: TransactionData, acceleration: any) => {
  const captured: { next?: GameState } = {};
  const alerts: Array<[string, string]> = [];
  mockGame = {
    gameState: state,
    setGameState: (updater: any) => { captured.next = typeof updater === 'function' ? updater(state) : updater; },
    setGameHistory: vi.fn(),
    gameHistory: [],
    summary: { monthlyCashflow: 0 },
    financialAcceleration: acceleration,
    scoreResult: { totalScore: 0, details: [] },
    alertInfo: null,
    showAlert: (message: string, type: string) => alerts.push([message, type]),
    hideAlert: vi.fn(),
    saveGameRecord: vi.fn(),
    requestImmediatePlayerSync: vi.fn(),
  };
  seedRandom();
  const { result } = renderHook(() => useGameLogic());
  const ok = result.current.handleTransactionSubmit(data);
  return { ok, next: captured.next, alerts };
};

describe('applyBoardTransaction 與舊 handleTransactionSubmit 行為一致', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  cases.forEach(({ name, data, state: overrides, acceleration }) => {
    it(name, () => {
      const state = createState(overrides);
      const fromHook = runOld(state, structuredClone(data), acceleration);
      // golden master：產生自抽出前的舊實作
      expect({ ok: fromHook.ok, alerts: fromHook.alerts, next: fromHook.next }).toMatchSnapshot();

      vi.restoreAllMocks();
      seedRandom();
      const prepared = prepareBoardTransaction(state, structuredClone(data), acceleration);
      if (prepared.status === 'error') {
        expect(fromHook.ok).toBe(false);
        expect(fromHook.alerts).toEqual([[prepared.message, 'error']]);
        expect(fromHook.next).toBeUndefined();
        return;
      }
      if (prepared.status === 'duplicate') {
        expect(fromHook.ok).toBe(true);
        expect(fromHook.alerts).toEqual([]);
        expect(fromHook.next).toBeUndefined();
        return;
      }
      const next = reduceBoardTransaction(state, prepared.prepared, { now: FIXED_NOW, generateId });
      expect(fromHook.ok).toBe(true);
      expect(fromHook.alerts).toEqual([[prepared.prepared.message, 'success']]);
      expect(next).toEqual(fromHook.next);
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  HAPPINESS_CARDS,
  NEWS_CARDS,
  OPPORTUNITY_CARDS,
  buildHappinessCardMetaFromSchema,
  buildNewsCardMetaFromSchema,
  buildOpportunityCardMetaFromSchema,
} from '../constants/cards';
import type { GameState } from '../types';
import { resolveBoardCardAction } from '../utils/boardCardActions';

const coverageGameState = (): GameState => ({
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
    otherMedicalChild: 0,
  },
  income: { salary: 100000, investment: 0, other: 0 },
  currentRankTitle: '測試玩家',
  currentRankLevel: 5,
  cash: 50000000,
  children: 2,
  medicalInsuranceCount: 2,
  assets: [
    { id: 'stock-a10', name: 'A10 股票', cost: 1000000, downPayment: 0, cashflow: 0, type: '股票', quantity: 100 },
    { id: 'house-1', name: 'N001 單間小套房', cost: 1000000, downPayment: 300000, cashflow: 10000, type: '不動產', houseType: '1room' },
    { id: 'house-2', name: 'N002 兩房住宅', cost: 3000000, downPayment: 900000, cashflow: 20000, type: '不動產', houseType: '2room' },
    { id: 'house-3', name: 'N003 三房住宅', cost: 6000000, downPayment: 1800000, cashflow: 30000, type: '不動產', houseType: '3room' },
    { id: 'house-5', name: 'N045 五房三廳豪宅', cost: 16000000, downPayment: 5000000, cashflow: 55000, type: '不動產', houseType: '5room' },
    { id: 'store', name: '店面', cost: 5000000, downPayment: 1500000, cashflow: 50000, type: '不動產', houseType: 'store_small' },
    { id: 'startup', name: '兼職工作室', cost: 500000, downPayment: 500000, cashflow: 100000, type: '企業' },
    { id: 'business', name: '優質企業', cost: 1000000, downPayment: 1000000, cashflow: 200000, type: '企業' },
    { id: 'car', name: '汽車', cost: 600000, downPayment: 120000, cashflow: 0, type: '汽車', isInsured: true },
  ],
  liabilities: [{ id: 'mortgage', name: '房貸', totalOwed: 1000000, monthlyPayment: 10000, type: '不動產貸款' }],
  loans: 0,
  isSetup: true,
  history: [],
  happiness: [],
  happinessTotal: 0,
  marketPrices: {},
  previousMarketPrices: {},
  lastPublishedCode: '',
  abilities: { stockAbilityCount: 1, realEstateAbilityCount: 1, professionAbilityCount: 1 },
  completedHappinessEvents: [],
});

const allCards = [
  ...HAPPINESS_CARDS.map(card => ({ ...card, deck: 'happiness' as const })),
  ...OPPORTUNITY_CARDS.map(card => ({ ...card, deck: 'opportunity' as const })),
  ...NEWS_CARDS.map(card => ({ ...card, deck: 'news' as const })),
];

describe('160 card completion coverage', () => {
  it('keeps the three decks complete and uniquely identified', () => {
    expect(HAPPINESS_CARDS).toHaveLength(46);
    expect(OPPORTUNITY_CARDS).toHaveLength(56);
    expect(NEWS_CARDS).toHaveLength(58);
    expect(new Set(allCards.map(card => card.id)).size).toBe(160);
  });

  it('provides an impact summary for every card', () => {
    const summaries = allCards.map(card => {
      if (card.deck === 'happiness') return buildHappinessCardMetaFromSchema(card.id);
      if (card.deck === 'opportunity') return buildOpportunityCardMetaFromSchema(card.id);
      return buildNewsCardMetaFromSchema(card.id);
    });

    summaries.forEach(summary => {
      expect(summary?.title).toBeTruthy();
      expect(summary?.description).toBeTruthy();
      expect(summary?.effectLines.length).toBeGreaterThan(0);
    });
  });

  it('keeps H013 player title as the family milestone card name', () => {
    expect(buildHappinessCardMetaFromSchema('H013')?.title).toBe('幸福家庭的重要歷程');
  });

  it('resolves every card to a completable action with a representative player state', () => {
    const state = coverageGameState();

    allCards.forEach(card => {
      const action = resolveBoardCardAction(card.id, state);
      expect(action, `${card.id} should resolve`).toBeTruthy();
      expect(action?.kind, `${card.id} should not be unsupported`).not.toBe('unsupported');

      if (action?.kind === 'choice') {
        expect(action.options.length, `${card.id} should have a choice`).toBeGreaterThan(0);
      }
      if (action?.kind === 'financial') {
        expect(action.txData.impacts.length, `${card.id} should describe impacts`).toBeGreaterThan(0);
      }
      if (action?.kind === 'asset_sale') {
        expect(action.items.length, `${card.id} should have a qualifying asset`).toBeGreaterThan(0);
      }
    });
  });
});

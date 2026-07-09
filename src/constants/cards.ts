import happinessCardsData from '../data/cards/happiness.cards.json';
import opportunityCardsData from '../data/cards/opportunity.cards.json';
import newsCardsData from '../data/cards/news.cards.json';
import { GameState } from '../types';
import { getFamilyMilestoneStageByCardId, getFamilyMilestoneStatus } from '../utils/familyMilestones';

// ============================================================
// 蜂富人生 Card Database Adapter
// ============================================================

type RawCardRecord = Record<string, any>;

export type HappinessCardCategory =
  | '幸福回憶'
  | '家庭重要歷程'
  | '追求家庭幸福'
  | '良好人際關係'
  | '幸福的社會';

export interface HappinessCard {
  id: string;
  title: string;
  category: HappinessCardCategory;
  happinessPoints: number;
  cashCost?: number;
  monthlyExpenseIncrease?: number;
  childrenIncrease?: number;
  requiresStorySharing?: boolean;
  otherPlayersCanJoin?: boolean;
  joinDiceMin?: number;
  description?: string;
}

export type OpportunityCardType =
  | 'ability_profession'
  | 'ability_stock'
  | 'ability_realestate'
  | 'purchase_1room'
  | 'purchase_any_house'
  | 'purchase_store'
  | 'purchase_startup'
  | 'enterprise_acquisition'
  | 'medical'
  | 'aircraft_damage'
  | 'property_repair'
  | 'theft'
  | 'inflation'
  | 'penalty'
  | 'reward';

export interface OpportunityCard {
  id: string;
  title: string;
  type: OpportunityCardType;
  category?: string;
  description: string;
  choiceRequired?: boolean;
  schoolFee?: number;
  diceRequirement?: number;
  abilityEffect?: string;
  purchasePrice?: number;
  purchasePercent?: number;
  acquisitionMultiple?: number;
  cashLoss?: number;
  cashGain?: number;
  monthlyExpenseChange?: number;
  happinessLoss?: number;
  goToSquare?: 'hospital' | 'school' | '4s_shop';
  missRounds?: number;
  noBankPassThisRound?: boolean;
  insurancePays?: number;
  affectsAllPlayers?: boolean;
  drawCard?: 'happiness' | 'news';
  requiresStorySharing?: boolean;
}

export interface StockSymbolPrices {
  [key: string]: number;
  A10: number;
  A20: number;
  A30: number;
  A40: number;
  B50: number;
  B60: number;
  B70: number;
  B80: number;
}

export interface StockPriceNewsCard {
  id: string;
  type: 'stock_price';
  subtype: '股市新訊';
  title: string;
  prices: StockSymbolPrices;
  specialRule?: string;
  description?: string;
}

export interface CashDividendNewsCard {
  id: string;
  type: 'cash_dividend';
  subtype: '股市新訊';
  title: string;
  dividendPerShare: StockSymbolPrices;
  description?: string;
}

export interface StockDividendNewsCard {
  id: string;
  type: 'stock_dividend';
  subtype: '股市新訊';
  title: string;
  dividendRate: StockSymbolPrices;
  description?: string;
}

export interface RealEstateNewsCard {
  id: string;
  type: 'real_estate';
  subtype: '房市新訊';
  title: string;
  description?: string;
  propertyLabel: string;
  houseType: '1room' | '2room' | '3room' | '5room' | 'store_small' | 'store_medium' | 'store_large';
  totalPrice: number;
  downPayment: number;
  loanAmount: number;
  monthlyPayment: number;
  rent: number;
  netRentIncome: number;
  happinessBonus: number;
  canSelfUse: boolean;
}

export interface SmallBusinessNewsCard {
  id: string;
  type: 'small_business';
  subtype: '企業新訊';
  title: string;
  loanAmount: number;
  investmentPerMonth: number;
  interestPerMonth: number;
  description?: string;
}

export interface LargeEnterpriseNewsCard {
  id: string;
  type: 'large_enterprise';
  subtype: '企業新訊';
  title: string;
  businessName: string;
  loanAmount: number;
  maxInvestment: number;
  monthlyReturnPerMillion: number;
  description?: string;
}

export type NewsCard =
  | StockPriceNewsCard
  | CashDividendNewsCard
  | StockDividendNewsCard
  | RealEstateNewsCard
  | SmallBusinessNewsCard
  | LargeEnterpriseNewsCard;

const happinessRawCards = happinessCardsData as RawCardRecord[];
const opportunityRawCards = opportunityCardsData as RawCardRecord[];
const newsRawCards = newsCardsData as RawCardRecord[];

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
};

const asNullableNumber = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  return asNumber(value);
};

const hasRequirement = (card: RawCardRecord, requirement: string) =>
  Array.isArray(card.conditions?.requirements) && card.conditions.requirements.includes(requirement);

const toStockSymbolPrices = (value: unknown): StockSymbolPrices => {
  const record = (value || {}) as Record<string, number>;
  return {
    A10: Number(record.A10 || 0),
    A20: Number(record.A20 || 0),
    A30: Number(record.A30 || 0),
    A40: Number(record.A40 || 0),
    B50: Number(record.B50 || 0),
    B60: Number(record.B60 || 0),
    B70: Number(record.B70 || 0),
    B80: Number(record.B80 || 0)
  };
};

const normalizeOpportunitySquare = (value: unknown): OpportunityCard['goToSquare'] => {
  if (value === 'hospital' || value === 'school') return value;
  if (value === '4s_shop' || value === 'repair_shop') return '4s_shop';
  return undefined;
};

const normalizeNewsSubtype = (category?: string): NewsCard['subtype'] => {
  if (category === '房市新訊') return '房市新訊';
  if (category === '企業新訊') return '企業新訊';
  return '股市新訊';
};

const rawEffectsSummary = (card: RawCardRecord) => normalizeCardCopy(card.effects?.summary);
// 投影幕的卡片規則文字優先取 description 裡「*」後半段的規則段落；
// 只有 description 沒有規則段落時，才用 effects.summary 補位，避免
// 同一條規則被講兩遍。
const hasDescriptionRuleSection = (card: RawCardRecord) => !!card.description?.includes('*');

export const HAPPINESS_CARDS: HappinessCard[] = happinessRawCards.map(card => ({
  id: card.id,
  title: normalizeCardCopy(card.title),
  category: card.category as HappinessCardCategory,
  happinessPoints: asNumber(card.effects?.happinessPoints) || asNumber(card.multiplier?.happinessPoints) || 0,
  cashCost: asNullableNumber(card.amount?.cashCost ?? card.effects?.cashCost),
  monthlyExpenseIncrease: asNullableNumber(card.amount?.monthlyExpenseIncrease ?? card.effects?.monthlyExpenseIncrease),
  childrenIncrease: asNullableNumber(card.effects?.childrenIncrease),
  requiresStorySharing: hasRequirement(card, 'requires_story_sharing'),
  otherPlayersCanJoin: !!(card.multiplayer?.otherPlayersCanJoin || card.effects?.otherPlayersCanJoin),
  joinDiceMin: asNullableNumber(card.multiplier?.joinDiceMin),
  description: normalizeCardCopy(card.description)
}));

export const OPPORTUNITY_CARDS: OpportunityCard[] = opportunityRawCards.map(card => ({
  id: card.id,
  title: normalizeCardCopy(card.title),
  type: card.type as OpportunityCardType,
  category: normalizeCardCopy(card.category),
  description: normalizeCardCopy(card.description),
  choiceRequired: !!card.choiceRequired,
  schoolFee: asNullableNumber(card.amount?.schoolFee),
  diceRequirement: asNullableNumber(card.multiplier?.diceRequirement),
  abilityEffect: card.effects?.abilityEffect || undefined,
  purchasePrice: asNullableNumber(card.amount?.purchasePrice),
  purchasePercent: asNullableNumber(card.multiplier?.purchasePercent),
  acquisitionMultiple: asNullableNumber(card.multiplier?.acquisitionMultiple),
  cashLoss: asNullableNumber(card.amount?.cashLoss ?? card.effects?.cashLoss),
  cashGain: asNullableNumber(card.amount?.cashGain ?? card.effects?.cashGain),
  monthlyExpenseChange: asNullableNumber(card.amount?.monthlyExpenseChange ?? card.effects?.monthlyExpenseChange),
  happinessLoss: asNullableNumber(card.effects?.happinessLoss),
  goToSquare: normalizeOpportunitySquare(card.effects?.goToSquare),
  missRounds: asNullableNumber(card.effects?.missRounds),
  noBankPassThisRound: !!card.effects?.noBankPassThisRound,
  insurancePays: asNullableNumber(card.insurance?.payoutAmount ?? card.amount?.insurancePays),
  affectsAllPlayers: !!(card.multiplayer?.affectsAllPlayers || card.effects?.affectsAllPlayers),
  drawCard: card.followUp?.drawCard || card.effects?.drawCard || undefined,
  requiresStorySharing: hasRequirement(card, 'requires_story_sharing')
}));

export const NEWS_CARDS: NewsCard[] = newsRawCards.map(card => {
  const common = {
    id: card.id,
    title: normalizeCardCopy(card.title),
    description: normalizeCardCopy(card.description)
  };

  if (card.type === 'stock_price') {
    return {
      ...common,
      type: 'stock_price',
      subtype: '股市新訊',
      prices: toStockSymbolPrices(card.effects?.prices ?? card.amount?.prices ?? card.prices),
      specialRule: normalizeCardCopy(card.effects?.specialRule ?? card.specialRule) || undefined
    } satisfies StockPriceNewsCard;
  }

  if (card.type === 'cash_dividend') {
    return {
      ...common,
      type: 'cash_dividend',
      subtype: '股市新訊',
      dividendPerShare: toStockSymbolPrices(card.effects?.dividendPerShare ?? card.amount?.dividendPerShare ?? card.dividendPerShare)
    } satisfies CashDividendNewsCard;
  }

  if (card.type === 'stock_dividend') {
    return {
      ...common,
      type: 'stock_dividend',
      subtype: '股市新訊',
      dividendRate: toStockSymbolPrices(card.effects?.dividendRate ?? card.amount?.dividendRate ?? card.dividendRate)
    } satisfies StockDividendNewsCard;
  }

  if (card.type === 'real_estate') {
    return {
      ...common,
      type: 'real_estate',
      subtype: '房市新訊',
      propertyLabel: normalizeCardCopy(card.propertyLabel || card.title),
      houseType: (card.houseType || card.effects?.houseType) as RealEstateNewsCard['houseType'],
      totalPrice: asNumber(card.amount?.totalPrice ?? card.totalPrice) || 0,
      downPayment: asNumber(card.amount?.downPayment ?? card.downPayment) || 0,
      loanAmount: asNumber(card.amount?.loanAmount ?? card.loanAmount) || 0,
      monthlyPayment: asNumber(card.amount?.monthlyPayment ?? card.monthlyPayment) || 0,
      rent: asNumber(card.amount?.rent ?? card.rent) || 0,
      netRentIncome: asNumber(card.amount?.netRentIncome ?? card.netRentIncome) || 0,
      happinessBonus: asNumber(card.effects?.happinessBonus ?? card.happinessBonus) || 0,
      canSelfUse: !!(card.effects?.canSelfUse ?? card.canSelfUse)
    } satisfies RealEstateNewsCard;
  }

  if (card.type === 'small_business') {
    return {
      ...common,
      type: 'small_business',
      subtype: '企業新訊',
      loanAmount: asNumber(card.amount?.loanAmount ?? card.effects?.loanAmount ?? card.loanAmount) || 0,
      investmentPerMonth: asNumber(card.amount?.investmentPerMonth ?? card.effects?.investmentPerMonth ?? card.investmentPerMonth) || 0,
      interestPerMonth: asNumber(card.amount?.interestPerMonth ?? card.effects?.interestPerMonth ?? card.interestPerMonth) || 0
    } satisfies SmallBusinessNewsCard;
  }

  return {
    ...common,
    type: 'large_enterprise',
    subtype: '企業新訊',
    businessName: normalizeCardCopy(card.effects?.businessName ?? card.businessName),
    loanAmount: asNumber(card.amount?.loanAmount ?? card.loanAmount) || 0,
    maxInvestment: asNumber(card.amount?.maxInvestment ?? card.maxInvestment) || 0,
    monthlyReturnPerMillion: asNumber(card.amount?.monthlyReturnPerMillion ?? card.effects?.monthlyReturnPerMillion ?? card.monthlyReturnPerMillion) || 0
  } satisfies LargeEnterpriseNewsCard;
});

export const HAPPINESS_CARD_MAP = Object.fromEntries(
  HAPPINESS_CARDS.map(c => [c.id, c])
) as Record<string, HappinessCard>;

export const OPPORTUNITY_CARD_MAP = Object.fromEntries(
  OPPORTUNITY_CARDS.map(c => [c.id, c])
) as Record<string, OpportunityCard>;

export const NEWS_CARD_MAP = Object.fromEntries(
  NEWS_CARDS.map(c => [c.id, c])
) as Record<string, NewsCard>;

export const STOCK_NEWS_CARDS = NEWS_CARDS.filter(
  (c): c is StockPriceNewsCard => c.type === 'stock_price'
);

export const REAL_ESTATE_NEWS_CARDS = NEWS_CARDS.filter(
  (c): c is RealEstateNewsCard => c.type === 'real_estate'
);

const happinessRawMap = Object.fromEntries(happinessRawCards.map(card => [card.id, card])) as Record<string, RawCardRecord>;
const opportunityRawMap = Object.fromEntries(opportunityRawCards.map(card => [card.id, card])) as Record<string, RawCardRecord>;
const newsRawMap = Object.fromEntries(newsRawCards.map(card => [card.id, card])) as Record<string, RawCardRecord>;

const formatAmount = (value: number) => value.toLocaleString();

const pushUniqueLine = (lines: string[], value?: string | null) => {
  const normalized = normalizeCardCopy(value);
  if (!normalized) return;
  if (!lines.includes(normalized)) {
    lines.push(normalized);
  }
};

export const buildHappinessCardMetaFromSchema = (cardId: string, playerState?: GameState | null) => {
  const card = HAPPINESS_CARD_MAP[cardId];
  const rawCard = happinessRawMap[cardId];
  if (!card || !rawCard) return null;

  const isFamilyMilestone = card.category === '家庭重要歷程';
  const stage = isFamilyMilestone ? getFamilyMilestoneStageByCardId(card.id) : null;
  const familyMilestoneStatus = playerState ? getFamilyMilestoneStatus(playerState) : null;
  const effectLines: string[] = [];

  if (isFamilyMilestone && familyMilestoneStatus) {
    familyMilestoneStatus.stageLines.forEach((line: string) => pushUniqueLine(effectLines, line));
    pushUniqueLine(effectLines, `目前進度：第 ${familyMilestoneStatus.currentStage} 階段`);
  }

  if (!hasDescriptionRuleSection(rawCard)) {
    pushUniqueLine(effectLines, rawEffectsSummary(rawCard));
  }
  pushUniqueLine(effectLines, `幸福 +${card.happinessPoints}`);
  if (card.cashCost) pushUniqueLine(effectLines, `一次性支出 ${formatAmount(card.cashCost)}`);
  if (card.monthlyExpenseIncrease) {
    pushUniqueLine(effectLines, `月支出 ${card.monthlyExpenseIncrease > 0 ? '+' : ''}${formatAmount(card.monthlyExpenseIncrease)}`);
  }
  if (card.childrenIncrease) pushUniqueLine(effectLines, `孩子數 +${card.childrenIncrease}`);
  if (card.otherPlayersCanJoin) pushUniqueLine(effectLines, `其他玩家可擲骰加入（至少 ${card.joinDiceMin || 0} 點）`);
  if (card.requiresStorySharing) pushUniqueLine(effectLines, '需要玩家分享故事');

  return {
    deck: 'happiness' as const,
    title: isFamilyMilestone && stage ? stage.label.replace(/^\d+\.\s*/, '') : card.title,
    subtitle: card.category,
    description: normalizeCardCopy(rawCard.description) || `${card.category}事件`,
    familyMilestoneStatus,
    effectLines
  };
};

export const buildOpportunityCardMetaFromSchema = (cardId: string) => {
  const card = OPPORTUNITY_CARD_MAP[cardId];
  const rawCard = opportunityRawMap[cardId];
  if (!card || !rawCard) return null;

  const effectLines: string[] = [];
  if (!hasDescriptionRuleSection(rawCard)) {
    pushUniqueLine(effectLines, rawEffectsSummary(rawCard));
  }
  if (card.schoolFee) pushUniqueLine(effectLines, `學費 ${formatAmount(card.schoolFee)}`);
  if (card.diceRequirement) pushUniqueLine(effectLines, `判定需求：至少 ${card.diceRequirement} 點`);
  if (card.purchasePrice) pushUniqueLine(effectLines, `收購價格 ${formatAmount(card.purchasePrice)}`);
  if (card.purchasePercent) pushUniqueLine(effectLines, `溢價比例 ${card.purchasePercent}%`);
  if (card.acquisitionMultiple) pushUniqueLine(effectLines, `收購倍率 ${card.acquisitionMultiple} 倍月收益`);
  if (card.cashLoss) pushUniqueLine(effectLines, `現金 -${formatAmount(card.cashLoss)}`);
  if (card.cashGain) pushUniqueLine(effectLines, `現金 +${formatAmount(card.cashGain)}`);
  if (card.monthlyExpenseChange !== undefined) {
    pushUniqueLine(effectLines, `月支出 ${card.monthlyExpenseChange > 0 ? '+' : ''}${formatAmount(card.monthlyExpenseChange)}`);
  }
  if (card.happinessLoss) pushUniqueLine(effectLines, `幸福 -${card.happinessLoss}`);
  if (card.goToSquare === 'hospital') pushUniqueLine(effectLines, '移動至醫院');
  if (card.goToSquare === 'school') pushUniqueLine(effectLines, '移動至學校');
  if (card.goToSquare === '4s_shop') pushUniqueLine(effectLines, '移動至維修廠');
  if (card.missRounds) pushUniqueLine(effectLines, `暫停 ${card.missRounds} 回合`);
  if (card.noBankPassThisRound) pushUniqueLine(effectLines, '本次移動經過銀行不領取月結餘');
  if (card.insurancePays) pushUniqueLine(effectLines, `保險理賠 ${formatAmount(card.insurancePays)}`);
  if (card.affectsAllPlayers) pushUniqueLine(effectLines, rawCard.multiplayer?.summary || '影響所有符合條件玩家');
  if (card.drawCard) pushUniqueLine(effectLines, `後續抽一張${card.drawCard === 'happiness' ? '幸福' : '新聞'}卡`);
  if (card.requiresStorySharing) pushUniqueLine(effectLines, '需要完成口頭分享');

  return {
    deck: 'opportunity' as const,
    title: card.title,
    subtitle: card.category || '機運卡',
    description: normalizeCardCopy(rawCard.description),
    effectLines
  };
};

export const buildNewsCardMetaFromSchema = (cardId: string) => {
  const card = NEWS_CARD_MAP[cardId];
  const rawCard = newsRawMap[cardId];
  if (!card || !rawCard) return null;

  const effectLines: string[] = [];
  if (!hasDescriptionRuleSection(rawCard)) {
    pushUniqueLine(effectLines, rawEffectsSummary(rawCard));
  }

  if (card.type === 'stock_price') {
    Object.entries(card.prices).forEach(([code, price]) => pushUniqueLine(effectLines, `${code}：${formatAmount(price)}`));
    pushUniqueLine(effectLines, card.specialRule);
  } else if (card.type === 'cash_dividend') {
    Object.entries(card.dividendPerShare).forEach(([code, dps]) => pushUniqueLine(effectLines, `${code}：每張配發 ${formatAmount(dps * 100)}`));
  } else if (card.type === 'stock_dividend') {
    Object.entries(card.dividendRate).forEach(([code, rate]) => pushUniqueLine(effectLines, `${code}：配股率 ${(rate * 100).toLocaleString()}%`));
  } else if (card.type === 'real_estate') {
    pushUniqueLine(effectLines, `總價：${formatAmount(card.totalPrice)}`);
    pushUniqueLine(effectLines, `頭期款：${formatAmount(card.downPayment)}`);
    pushUniqueLine(effectLines, `貸款：${formatAmount(card.loanAmount)}`);
    pushUniqueLine(effectLines, `貸款利息（月）：${formatAmount(card.monthlyPayment)}`);
    pushUniqueLine(effectLines, `租金收入（月）：${formatAmount(card.rent)}`);
    pushUniqueLine(effectLines, `淨收益（月）：${card.netRentIncome > 0 ? '+' : ''}${formatAmount(card.netRentIncome)}`);
    if (card.canSelfUse) pushUniqueLine(effectLines, `自用幸福：+${card.happinessBonus}`);
  } else if (card.type === 'small_business') {
    pushUniqueLine(effectLines, `投資金額：${formatAmount(card.investmentPerMonth)}`);
    pushUniqueLine(effectLines, `貸款金額：${formatAmount(card.loanAmount)}`);
    pushUniqueLine(effectLines, `企業貸款利息（月）：-${formatAmount(card.interestPerMonth)}`);
  } else if (card.type === 'large_enterprise') {
    pushUniqueLine(effectLines, `最高投資額度：${formatAmount(card.maxInvestment)}`);
    pushUniqueLine(effectLines, `投資報酬率：每投資 1,000,000，月收益 +${formatAmount(card.monthlyReturnPerMillion)}`);
  }

  return {
    deck: 'news' as const,
    title: card.title,
    subtitle: card.subtype,
    description: normalizeCardCopy(rawCard.description) || '請依卡片內容處理。',
    effectLines
  };
};

export function normalizeCardCopy(text?: string | null): string {
  return text
    ? text
      .replaceAll('飛行器', '汽車')
      .replace('《二、不獲得幸福點2點。', '')
      .replace('二、不獲得幸福點2點。', '')
      .trim()
    : '';
}

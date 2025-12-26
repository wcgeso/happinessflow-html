
export interface Asset {
  id: string;
  name: string;
  cost: number;
  downPayment: number;
  cashflow: number; // Positive monthly income
  type: '現金' | '定存' | '股票' | '企業' | '不動產' | '飛行器';
  isSelfUse?: boolean;
  houseType?: string;
  quantity?: number;
  isInsured?: boolean;
  isUpgraded?: boolean; // New: for enterprise upgrade
  lastPurchasePrice?: number; // New: To track latest purchase price instead of average cost
}

export interface Liability {
  id: string;
  name: string;
  totalOwed: number;
  monthlyPayment: number;
  type: '信用貸款' | '飛行器貸款' | '企業貸款' | '不動產貸款';
}

export interface ExpenseDetails {
  tax: number;
  basicLiving: number;
  transportEdu: number;
  otherMedicalChild: number;
}

export interface PromotionRule {
  rankTitle: string;
  condition: string;
  bonus: number;
}

export interface Profession {
  id: string;
  title: string;
  initialRank: string;
  salary: number;
  savings: number;

  expenses: ExpenseDetails;

  mortgageTotal: number;
  businessLoanTotal: number;
  creditLoanTotal: number;

  promotions: PromotionRule[];
}

export interface Enterprise {
  id: string;
  name: string;
  cost: number;
  income: number;
  relatedProfessionId: string;
  relatedBonusPercent: number;
  happyPoints: number;
}

export interface Dream {
  id: string;
  name: string;
  cost: number;
  happyPoints: number;
  description?: string;
}

export interface Transaction {
  id: string;
  round?: number;
  name: string;
  amount: number;
  sourceLabel: string;
  usageLabel: string;
  cashChange: number;
  balance: number;
  timestamp: number;
  details?: string; // New: for listing sub-details
}

export interface HappinessItem {
  id: string;
  label: string;
  points: number;
  checked: boolean;
  isCustom?: boolean;
  readOnly?: boolean;
  code?: string;
  description?: string;
  parentId?: string;
}

export interface IncomeDetails {
  salary?: number;
  investment?: number;
  other?: number;
  [key: string]: number | undefined;
}

export interface ExpenseDetailsType {
  taxes?: number;
  mortgage?: number;
  studentLoan?: number;
  creditCard?: number;
  other?: number;
  [key: string]: number | undefined;
}

export interface GameAbilities {
  stockAbilityCount: number;
  realEstateAbilityCount: number;
  professionAbilityCount: number;
}

export interface GameState {
  profession: Profession | null;
  selectedEnterprise: Enterprise | null;
  selectedDream: Dream | null;
  expenses: ExpenseDetailsType;
  income: IncomeDetails;

  currentRankTitle: string;
  currentRankLevel: number;
  cash: number;
  children: number;
  medicalInsuranceCount: number;
  assets: Asset[];
  liabilities: Liability[];
  loans: number;
  isSetup: boolean;
  history: Transaction[];
  happiness: HappinessItem[];
  happinessTotal: number;
  marketPrices: Record<string, number>;
  abilities: GameAbilities;
  completedHappinessEvents: string[];
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  monthlyCashflow: number;
  passiveIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  payday: number;
}

export interface GameRecord {
  id: string;
  date: string;
  playerName: string;
  profession: string;
  finalScore: number;
  happinessScore: number;
  maxRankLevel?: number;
  isWin?: boolean;
  financialSummary: FinancialSummary;
  gameStateSnapshot: {
    assets: Asset[];
    liabilities: Liability[];
    income: IncomeDetails;
    expenses: ExpenseDetailsType;
    history: Transaction[];
    happiness: HappinessItem[];
    cash: number;
    loans: number;
  };
}

export interface GameSessionMeta {
  reportName: string;
  playerName: string;
  createdAt: string;
}

// Transaction Related Types
export type SourceType = 'cash' | 'loan' | 'income' | 'storage';
export type UsageType = 'asset' | 'liability' | 'expense' | 'storage' | 'cash' | 'stock_update' | 'expense_update' | 'insurance' | 'happiness_event';
export type AssetType = '股票' | '不動產' | '企業' | '定存' | '保險' | '飛行器' | '目標企業' | '心儀夢想';

export interface StockTransactionItem {
  symbol: string;
  price: number;
  qty: number;
}

export interface TransactionData {
  name: string;
  amount: number;
  source: SourceType;
  usage: UsageType;
  cashChange: number;
  assetDetails?: {
    cashflow: number;
    type: AssetType;
    downPayment: number;
    symbol?: string;
    quantity?: number;
    loanAmount?: number;
    loanInterest?: number;
    isSelfUse?: boolean;
    houseType?: string;
  };
  liabilityId?: string;
  relatedAssetId?: string;
  sellQuantity?: number;
  stockList?: StockTransactionItem[];
  happinessEventPayload?: {
    id: string;
    name: string;
    amount: number;
    points: number;
    monthlyExpenseChange?: number;
    expenseCategory?: string;
  };
  insuranceType?: string;
  insurancePayload?: {
    medicalQty?: number;
    targetAssetIds?: string[];
    aircraft?: boolean;
  };
  stockDividendPayload?: {
    items: { assetId: string, addedQty: number }[];
  };
  stockFluctuationPayload?: {
    type: 'rise_fall' | 'bubble_burst';
    updates?: { assetId: string, newPrice: number, oldPrice?: number }[];
    bubbleDetails?: { assetId: string, oldQty: number }[];
  };
  expensePayload?: {
    category: 'tax' | 'basicLiving' | 'transportEdu' | 'otherMedicalChild';
    amount: number;
    isIncrease: boolean;
  };
  impacts?: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'happiness' | 'asset' | 'event' | 'dream' | 'career' | 'gameplay' | 'finance';
  icon?: string;
}

export type AccountCategory = 'Assets' | 'Liabilities' | 'Income' | 'Expenses';
export type ChangeDirection = 'Increase' | 'Decrease';

export interface AccountEntry {
  category: AccountCategory;
  name: string;
  direction: ChangeDirection;
}

export type Mode = 'loan' | 'buy' | 'sell' | 'dividend' | 'event' | 'expense';
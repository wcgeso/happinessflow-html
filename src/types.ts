
export interface Asset {
  id: string;
  name: string;
  cost: number;
  downPayment: number;
  cashflow: number; // Positive monthly income
  // Keep legacy '飛行器' for old saves; new data should use '汽車'.
  type: '現金' | '定存' | '股票' | '企業' | '不動產' | '飛行器' | '汽車';
  isSelfUse?: boolean;
  houseType?: string;
  conversionCount?: number; // New: tracking real estate conversion (max 1)
  quantity?: number;
  isInsured?: boolean;
  isUpgraded?: boolean; // New: for enterprise upgrade
  lastPurchasePrice?: number; // New: To track latest purchase price instead of average cost
  marketValue?: number; // New: For settlement display
}

export interface Liability {
  id: string;
  name: string;
  totalOwed: number;
  monthlyPayment: number;
  // Keep legacy '飛行器貸款' for old saves; new data should use '汽車貸款'.
  type: '信用貸款' | '強制負債' | '飛行器貸款' | '汽車貸款' | '企業貸款' | '不動產貸款';
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
  flowType?: '生活' | '投資' | '融資' | '其它'; // New: for cash flow classification
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

export interface StockPricePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface GameAbilities {
  stockAbilityCount: number;
  realEstateAbilityCount: number;
  professionAbilityCount: number;
}

export type BoardSquareType =
  | 'school'
  | 'bank'
  | 'hospital'
  | 'repair'
  | 'happiness'
  | 'opportunity'
  | 'news';

export interface BoardSquare {
  id: string;
  index: number;
  label: string;
  type: BoardSquareType;
  x: number;
  y: number;
  trigger: string;
  pauseTurns?: number;
}

export interface BoardCardResult {
  deck: 'happiness' | 'opportunity' | 'news';
  cardId: string;
  title: string;
  description: string;
  subtitle?: string;
  assetSymbol?: string;
  effectLines?: string[];
  familyMilestoneStatus?: any;
}

export interface BoardCardLogEntry extends BoardCardResult {
  id: string;
  eventId: string;
  playerUid: string;
  playerName: string;
  summary?: string;
  drawnAt: number;
}

export interface BoardDeckState {
  happiness: string[];
  opportunity: string[];
  news: string[];
  usedHappiness: string[];
  usedOpportunity: string[];
  usedNews: string[];
}

export interface BoardEventLog {
  id: string;
  playerUid: string;
  playerName: string;
  type?: 'bank' | 'school' | 'hospital' | 'repair' | 'card' | 'exam_happiness' | 'followup';
  summary: string;
  detail?: string;
  squareIndex: number;
  timestamp: number;
  rollTotal?: number;
  repairRoll?: number;
  repairFee?: number;
  repairHasCar?: boolean;
}

export interface BoardQueuedEvent {
  event: BoardEventLog;
  card?: BoardCardResult | null;
}

export interface BoardCardRevealState {
  eventId: string;
  cardId: string;
  isRevealed: boolean;
  revealedAt?: number;
  revealedBy?: string;
}

export interface BoardMovementState {
  playerUid: string;
  startPosition: number;
  path: number[];
  rollTotal: number;
  dice: number[];
  startedAt: number;
  stepDurationMs: number;
  introDelayMs: number;
  landingDelayMs: number;
  isActive: boolean;
}

export interface FamilyMilestoneJoinResponse {
  playerUid: string;
  playerName: string;
  status: 'passed' | 'failed' | 'declined';
  roll?: number;
  respondedAt: number;
}

export interface FamilyMilestoneJoinPrompt {
  id: string;
  sourceEventId: string;
  sourceCardId: string;
  sourcePlayerUid: string;
  sourcePlayerName: string;
  requiredRoll: number;
  targetPlayerUids: string[];
  responses: Record<string, FamilyMilestoneJoinResponse>;
  createdAt: number;
}

export interface SharedCardPromptResponse {
  playerUid: string;
  playerName: string;
  status: 'completed' | 'declined' | 'no_effect';
  amount?: number;
  selectedAssetIds?: string[];
  note?: string;
  respondedAt: number;
}

export interface SharedCardPrompt {
  id: string;
  kind: 'asset_sale' | 'cash_dividend' | 'stock_dividend' | 'investment' | 'startup_loan';
  sourceEventId: string;
  sourceCardId: string;
  sourcePlayerUid: string;
  sourcePlayerName: string;
  targetPlayerUids: string[];
  responses: Record<string, SharedCardPromptResponse>;
  createdAt: number;
}

export interface BoardState {
  currentTurnUid: string | null;
  turnOrder: string[];
  playerPositions: Record<string, number>;
  skipTurns: Record<string, number>;
  lastRoll: {
    uid: string;
    dice: number[];
    total: number;
    timestamp: number;
  } | null;
  currentCard: BoardCardResult | null;
  currentCardReveal?: BoardCardRevealState | null;
  currentEvent: BoardEventLog | null;
  pendingEvents?: BoardQueuedEvent[];
  movement?: BoardMovementState | null;
  familyMilestoneJoinPrompt?: FamilyMilestoneJoinPrompt | null;
  sharedCardPrompt?: SharedCardPrompt | null;
  deckState: BoardDeckState;
  realEstateMarket?: string[];
  cardLog?: BoardCardLogEntry[];
  updatedAt: number;
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
  selectionStep?: 'profession' | 'enterprise' | 'dream' | 'completed';
  history: Transaction[];
  happiness: HappinessItem[];
  happinessTotal: number;
  marketPrices: Record<string, number>;
  previousMarketPrices: Record<string, number>;
  marketPriceHistory?: Record<string, StockPricePoint[]>;
  lastPublishedCode: string;
  lastMarketUpdateTimestamp?: number;
  abilities: GameAbilities;
  completedHappinessEvents: string[];
  hasShownWinAnimation?: boolean;
  playerName?: string;
  reportName?: string;
  sessionId?: string;
  boardPosition?: number;
  skipTurns?: number;
  lastBoardEvent?: string;
  pendingCardAction?: string;
  bankServiceWindowActive?: boolean;
  bankServiceGrantedAtEventId?: string;
  pendingFamilyMilestoneJoinAction?: {
    promptId: string;
    cardId: string;
    sourcePlayerUid: string;
  };
  pendingStartupUpgradeAction?: {
    cardId: string;
    symbol: string;
  };
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
  reportName: string;
  profession: string;
  roomId?: string;
  status?: 'draft' | 'completed';
  finalRankTitle?: string;
  finalScore: number;
  happinessScore: number;
  maxRankLevel?: number;
  isWin?: boolean;
  financialSummary: FinancialSummary;
  professionData?: Profession; // New: for full report restore
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
  allPlayers?: {
    name: string;
    happiness: number;
    totalScore: number;
    profession: string;
  }[];
}

export interface CoachRecord {
  id: string;
  date: string;
  roomCode: string;
  roomName?: string;
  playerCount: number;
  playTime: number; // in minutes
  totalRounds: number;
  duration?: number;
  coachId: string;
  coachName: string;
  timestamp: number;
  players?: {
    name: string;
    profession: string;
    happiness: number;
    score: number;
    isWin?: boolean;
  }[];
}

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: 'pending' | 'accepted';
  createdAt: string;
  updatedAt: string;
}

export interface UserPublicInfo {
  uid: string;
  name: string;
  photoURL?: string;
  photoPosition?: string;
  photoScale?: string;
  title?: string;
  experience?: number;
  rankScore?: number;
  status?: 'online' | 'offline' | 'playing';
}

export interface GameSessionMeta {
  reportName: string;
  playerName: string;
  createdAt: string;
}

// Transaction Related Types
export type SourceType = 'cash' | 'loan' | 'income' | 'storage';
export type UsageType =
  | 'asset'
  | 'liability'
  | 'expense'
  | 'storage'
  | 'cash'
  | 'stock_update'
  | 'expense_update'
  | 'insurance'
  | 'happiness_event'
  | 'lifelong_learning'
  | 'buy_asset'
  | 'sell_asset'
  | 'loan'
  | 'loan_repayment'
  | 'forced_debt';
// Keep legacy '飛行器' for old transaction payloads; new UI should use '汽車'.
export type AssetType = '股票' | '不動產' | '企業' | '定存' | '保險' | '飛行器' | '汽車' | '目標企業' | '心儀夢想' | '現金';

export interface StockTransactionItem {
  symbol: string;
  price: number;
  qty: number;
}

export interface BatchSellItem {
  asset: Asset;
  price: number;
  liability?: Liability;
}

export interface TransactionData {
  name: string;
  amount: number;
  source: SourceType;
  usage: UsageType;
  cashChange: number;
  financialCheckEntries?: AccountEntry[];
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
    happyPoints?: number;
  };
  liabilityId?: string;
  relatedAssetId?: string;
  sellQuantity?: number;
  stockList?: StockTransactionItem[];
  batchSellList?: BatchSellItem[];
  happinessEventPayload?: {
    id: string;
    name: string;
    amount: number;
    points: number;
    monthlyExpenseChange?: number;
    expenseCategory?: string;
    progressId?: string;
    happinessItemId?: string;
    sourceCardId?: string;
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
  lifelongLearningPayload?: {
    learningType: 'enhance_profession' | 'stock_ability' | 'real_estate_ability';
    requiredRoll: number;
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
  flowType?: '經營' | '投資' | '籌資' | '其它';
  assetChange?: {
    action: 'add' | 'remove';
    asset: {
      id?: string;
      name: string;
      type: AssetType;
      value?: number;
      symbol?: string;
      shares?: number;
      buyPrice?: number;
      monthlyCashflow?: number;
    };
  };
  liabilityChange?: {
    action: 'add' | 'repay';
    liability?: {
      id: string;
      name: string;
      type: Liability['type'];
      totalOwed: number;
      monthlyPayment: number;
    };
    liabilityId?: string;
    amount?: number;
  };
  sellAssetPayload?: {
    type: 'stock';
    symbol: string;
    sharesToSell: number;
    currentPrice: number;
  };
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

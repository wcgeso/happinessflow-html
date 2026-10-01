
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
  // Legacy brokerage fields still present in saved game data.
  symbol?: string;
  shares?: number;
  buyPrice?: number;
  value?: number;
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
  linkedAssetId?: string;
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
  boardEventId?: string; // 棋盤事件 ID，用於財務檢核流程的事件級防重複套用
  incomeMultiplierEligible?: boolean; // 明確標記可套用房間收益倍率的一次性收入
  originalAmount?: number; // 套用倍率前的金額
  appliedMultiplier?: number; // 實際入帳時使用的倍率
}

export type FinancialAccelerationMultiplier = 1 | 1.5 | 2 | 3;

export interface FinancialAccelerationState {
  multiplier: FinancialAccelerationMultiplier;
  updatedAt?: number;
  updatedByUid?: string;
  updatedByName?: string;
}

export interface FinancialSubsidyState {
  sequence: number;
  amount: number;
  grantedAt: number;
  grantedByUid: string;
  grantedByName?: string;
  playerUids: string[];
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
  hospitalRoll?: number;
  hospitalFee?: number;
  repairHasCar?: boolean;
  hospitalSkipTurns?: number;
  hospitalFeeCoveredByInsurance?: boolean;
  repairSkipTurns?: number;
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

export interface BoardMovementEffect {
  type: 'repair_fee';
  squareIndex: number;
}

export interface SettlementPlayerInput {
  uid: string;
  totalScore: number;
}

export type SettlementResult = 'applied' | 'already_applied';
export interface BoardMovementState {
  playerUid: string;
  startPosition: number;
  path: number[];
  // 大富翁式分段移動：這段路徑走完後，還沒走的剩餘步數（沒有就代表這段已經是終點）。
  remainingPath?: number[];
  rollTotal: number;
  dice: number[];
  startedAt: number;
  stepDurationMs: number;
  introDelayMs: number;
  landingDelayMs: number;
  isActive: boolean;
  effects?: BoardMovementEffect[];
}

export interface FamilyMilestoneJoinResponse {
  playerUid: string;
  playerName: string;
  status: 'passed' | 'failed' | 'declined';
  // A passed roll only grants the option to join. The response is complete
  // after the player accepts or declines the resulting card action.
  actionCompleted?: boolean;
  stageProgressId?: string;
  roll?: number;
  respondedAt: number;
  // All clients reveal the result from this shared deadline instead of from
  // the time each client receives the Firestore snapshot.
  presentationReadyAt?: number;
}

export interface FamilyMilestoneJoinPrompt {
  id: string;
  sourceEventId: string;
  sourceCardId: string;
  sourcePlayerUid: string;
  sourcePlayerName: string;
  sourceStageProgressId?: string;
  sourceActionCompleted?: boolean;
  requiredRoll: number;
  targetPlayerUids: string[];
  responses: Record<string, FamilyMilestoneJoinResponse>;
  responseStorage?: 'room' | 'subcollection';
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
  kind: 'asset_sale' | 'cash_dividend' | 'stock_dividend' | 'investment' | 'startup_loan' | 'expense_adjustment';
  sourceEventId: string;
  sourceCardId: string;
  sourcePlayerUid: string;
  sourcePlayerName: string;
  targetPlayerUids: string[];
  responses: Record<string, SharedCardPromptResponse>;
  responseStorage?: 'room' | 'subcollection';
  createdAt: number;
}

export interface SharedExpenseEffect {
  id: string;
  sourcePlayerUid: string;
  amount: number;
  category: 'basicLiving' | 'transportEdu' | 'otherMedicalChild';
  isIncrease: boolean;
  summary: string;
  detail?: string;
  timestamp: number;
}

export interface SkippedTurnNotice {
  playerUids: string[];
  nextTurnUid: string;
  timestamp: number;
}

export type PendingBoardContinuation = {
  sessionId: string;
  sourceEventId: string;
  cardId: string;
  playerUid: string;
  commandId: string;
  createdAt: number;
  phase: 'awaiting_roll' | 'awaiting_draw' | 'completed';
} & ({
  kind: 'lifelong-learning';
  learningType: 'enhance_profession' | 'stock_ability' | 'real_estate_ability';
  requiredRoll: number;
  result?: { roll: number; target: number; success: boolean; bonus?: number; newTitle?: string };
} | {
  kind: 'followup-card';
  deck: 'happiness' | 'news';
  result?: { eventId: string; cardId: string };
});

export interface BoardState {
  pendingContinuation?: PendingBoardContinuation | null;
  currentTurnUid: string | null;
  turnOrder: string[];
  revision?: number;
  processedCommandIds?: string[];
  playerPositions: Record<string, number>;
  skipTurns: Record<string, number>;
  // 這一回合（currentTurnUid 這位玩家）是否已經擲過骰子。每次結束回合換人
  // 時重設為 false，避免玩家忘記按「結束回合」而在同一回合內重複擲骰。
  hasRolledThisTurn?: boolean;
  lastRoll: {
    uid: string;
    dice: number[];
    total: number;
    timestamp: number;
  } | null;
  diceEvents?: DicePresentationEvent[];
  currentCard: BoardCardResult | null;
  currentCardReveal?: BoardCardRevealState | null;
  currentEvent: BoardEventLog | null;
  pendingEvents?: BoardQueuedEvent[];
  movement?: BoardMovementState | null;
  familyMilestoneJoinPrompt?: FamilyMilestoneJoinPrompt | null;
  sharedCardPrompt?: SharedCardPrompt | null;
  sharedExpenseEffect?: SharedExpenseEffect | null;
  skippedTurnNotice?: SkippedTurnNotice | null;
  deckState: BoardDeckState;
  realEstateMarket?: string[];
  cardLog?: BoardCardLogEntry[];
  updatedAt: number;
}

export interface DicePresentationEvent {
  id: string;
  sequence: number;
  playerUid: string;
  playerName: string;
  kind: 'board-movement' | 'repair' | 'family-participation' | 'hospital-fee' | 'school-exam' | 'lifelong-learning' | 'business-upgrade';
  sourceEventId?: string;
  dice: number[];
  total: number;
  target?: number;
  success?: boolean;
  resultLabel?: string;
  detail?: string;
  bonus?: number;
  newTitle?: string;
  timestamp: number;
}

export interface BoardBlocker {
  code: string;
  message: string;
}

export interface BoardActionAvailability {
  canRoll: boolean;
  canEndTurn: boolean;
  canOpenEvent?: boolean;
  eventBlocker?: BoardBlocker | null;
  rollBlocker: BoardBlocker | null;
  endTurnBlocker: BoardBlocker | null;
}

export interface ExperienceState {
  phase: 'waiting' | 'playing' | 'finished' | 'idle';
  currentTurnUid: string | null;
  currentTurnName: string | null;
  turnPosition: number | null;
  participantCount: number;
  isMyTurn: boolean;
  pendingSkipTurns: number;
  eventSummary: string | null;
  actionAvailability: BoardActionAvailability;
}

export type PresenceStatus = 'online' | 'offline';

export interface PresenceState {
  uid: string;
  status: PresenceStatus;
  sessionId: string;
  source?: 'firestore' | 'realtime';
  lastSeenAt?: number | { toMillis: () => number };
}

export type CoachExpenseCategory = 'basicLiving' | 'transportEdu' | 'otherMedicalChild';

export interface PlayerDiagnosticState {
  uid: string;
  sessionId: string;
  flow: string;
  screen: string;
  activeModal?: string | null;
  boardEventId?: string | null;
  cardId?: string | null;
  pendingAction?: string | null;
  errorMessage?: string | null;
  errorAt?: number | null;
  updatedAt?: number | { toMillis: () => number };
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
  selectionDraft?: {
    professionId?: string | null;
    enterpriseId?: string | null;
    dreamId?: string | null;
  };
  history: Transaction[];
  happiness: HappinessItem[];
  happinessTotal: number;
  marketPrices: Record<string, number>;
  previousMarketPrices: Record<string, number>;
  marketPriceHistory?: Record<string, StockPricePoint[]>;
  lastPublishedCode: string;
  lastMarketUpdateTimestamp?: number;
  lastSharedExpenseSyncedAt?: number;
  lastSharedExpenseEventId?: string;
  lastPublicEffectTimestamp?: number;
  lastPublicEffectId?: string;
  lastFinancialCommandId?: string;
  lastFinancialReceiptId?: string;
  // 標記這份 gameState 是為了「哪一場」棋盤遊戲（room.startedAt）而重設/建立的。
  // 用來擋掉跨場遊戲的殘留本地狀態被誤同步進新房間（見稽核報告 C2）：只有
  // stamp 對得上目前房間 startedAt 的 gameState，才會被同步寫回 Firestore。
  boardGameStartedAt?: number;
  abilities: GameAbilities;
  completedHappinessEvents: string[];
  appliedBoardFinancialEventIds?: string[];
  pendingMedicalClaims?: PendingMedicalClaim[];
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
    stageProgressId?: string;
  };
  pendingStartupUpgradeAction?: {
    cardId: string;
    symbol: string;
    assetId?: string;
  };
  pendingStartupUpgradeActions?: Array<{
    cardId: string;
    symbol: string;
    assetId?: string;
  }>;
}

export interface PendingMedicalClaim {
  id: string;
  sourceEventId: string;
  sourceCardId: string;
  createdAt: number;
}

export interface PublicPlayerState {
  uid: string;
  playerName?: string;
  isSetup: boolean;
  selectionStep?: GameState['selectionStep'];
  happinessTotal: number;
  boardPosition?: number;
  skipTurns?: number;
  lastBoardEvent?: string;
  pendingCardAction?: string;
  currentRankTitle?: string;
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
  historySource?: { roomId: string; uid: string; sessionId: string };
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

export type BoardFinancialFlow =
  | 'manual-bank'
  | 'board-card'
  | 'family-milestone'
  | 'shared-card'
  | 'startup-loan'
  | 'real-estate-market'
  | 'hospital'
  | 'repair'
  | 'vehicle-loss'
  | 'insurance-claim';
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
  commandId?: string;
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
  incomeMultiplierEligible?: boolean;
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
  boardEventId?: string; // 棋盤事件 ID，用於財務檢核流程的事件級防重複套用
  boardFlow?: BoardFinancialFlow;
  /** 內部周轉流程：按下強制計入負債時，與原交易同一筆套用。 */
  forcedDebtAmount?: number;
  /** 內部周轉流程：按下借用信貸時，與原交易同一筆套用。 */
  fundingLoanAmount?: number;
  medicalClaimId?: string;
  pendingMedicalClaim?: PendingMedicalClaim;
  vehicleLossPayload?: {
    assetId?: string;
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

export type BoardFinancialMutationResult = {
    status: 'applied' | 'duplicate' | 'requires_funding' | 'waiting' | 'failed';
    shortfall?: number;
    message?: string;
    code?: string;
};


export interface RoomMember {
    uid: string;
    name: string;
    photoURL?: string;
    email?: string;
    title?: string;
    experience?: number;
    role: 'coach' | 'player' | 'gm';
    joinedAt: any;
    isLeft?: boolean;
    photoPosition?: string;
    photoScale?: string;
    isReady?: boolean;
}

export interface PendingRequest {
    id: string;
    uid: string;
    playerName: string;
    type: 'payday' | 'insurance' | 'happiness' | 'promotion' | 'lifelong' | 'board_share' | 'family_milestone';
    amount: number;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
    insuranceType?: 'medical' | 'aircraft';
    happinessLabel?: string;
    promotionType?: string;
    boardCardId?: string;
    shareLabel?: string;
    boardEventId?: string;
    familyStageProgressId?: string;
    sessionId?: string;
}

export interface Room {
    id: string; // 房間碼 (6位數)
    name?: string; // 房間標題
    hostId: string;
    status: 'waiting' | 'playing' | 'finished';
    members: RoomMember[];
    memberUids?: string[];
    createdAt: any;
    maxPlayers: number;
    closedPlayerSlots?: number[];
    duration?: number; // 遊戲時長 (分鐘)
    gameTimeLeft?: number; // 剩餘秒數
    isTimerPaused?: boolean; // 計時器是否暫停
    timerEndsAtMs?: number | null; // 執行師控制的計時基準，避免依賴瀏覽器 tick
    // Legacy only: new rooms store full states in rooms/{roomId}/players/{uid}.
    // RoomContext hydrates this field locally with only the states the caller may read.
    playerStates?: Record<string, GameState>;
    publicPlayerStates?: Record<string, PublicPlayerState>;
    startedAt?: number; // 遊戲開始時間戳
    sessionId?: string; // 穩定的遊戲場次 ID
    syncSchemaVersion?: number;
    flowSchemaVersion?: number;
    financialHistoryStorage?: 'subcollection';
    isBoardGame?: boolean; // 棋盤遊戲模式
    isPractice?: boolean; // 練習模式（不計分）
    marketPrices?: Record<string, number>; // 股市價格
    previousMarketPrices?: Record<string, number>; // 前一次股市價格
    marketUpdates?: {
        updates: Record<string, number>;
        code: string;
        isBubble: boolean;
        timestamp: number;
    };
    pendingRequests?: Record<string, PendingRequest>;
    boardState?: BoardState | null;
    presenceStates?: Record<string, PresenceState>;
    financialAcceleration?: FinancialAccelerationState;
    financialSubsidy?: FinancialSubsidyState;
}

export type BoardCardRevealResult = {
    familyPrompt: 'opened' | 'no_target' | 'not_required';
    sharedPrompt: 'opened' | 'no_target' | 'not_required';
};

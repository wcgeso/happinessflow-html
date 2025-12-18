
export interface Asset {
  id: string;
  name: string;
  cost: number;
  downPayment: number;
  cashflow: number; // Positive monthly income
  type: '現金' | '定存' | '股票' | '企業' | '不動產';
  isSelfUse?: boolean; 
  houseType?: string;  
  quantity?: number;   
  isInsured?: boolean; 
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

export interface GameState {
  profession: Profession | null;
  selectedEnterprise: Enterprise | null;
  selectedDream: Dream | null;
  
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
  isWin: boolean; 
  financialSummary: {
    passiveIncome: number;
    totalExpenses: number;
    totalAssets: number;
  }
}
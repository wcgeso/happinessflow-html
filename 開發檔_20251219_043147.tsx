
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Wallet, 
  Baby, 
  Briefcase, 
  Plus, 
  LayoutDashboard,
  Heart,
  X,
  ArrowRight,
  Award,
  Plane,
  Stethoscope,
  Palette,
  Hammer,
  Calculator,
  ShoppingBag,
  Wrench,
  BookOpen,
  Coffee,
  Scissors,
  CheckCircle2,
  GraduationCap,
  Dices,
  Play,
  FileText,
  Calendar,
  User,
  Star,
  AlertCircle,
  Building2,
  TreePine,
  Globe2,
  FerrisWheel,
  Leaf,
  Landmark,
  Accessibility,
  Ambulance,
  Home,
  Rocket,
  Trophy,
  History,
  LogOut,
  ChevronLeft,
  Crown,
  Mail,
  DollarSign,
  List,
  Coins,
  ShieldCheck,
  Check,
  Bell
} from 'lucide-react';

import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from './services/firebase';

import { GameState, Profession, Asset, Liability, FinancialSummary, HappinessItem, Transaction, Enterprise, Dream, GameRecord } from './types';
import { PROFESSIONS, ENTERPRISES, DREAMS } from './constants';
import { Button, Card, Input } from './components/ui';
import { FinancialStatement } from './components/FinancialStatement';
import { TransactionForm, TransactionData } from './components/TransactionForm';
import { HappinessPanel } from './components/HappinessPanel';


const DiceFace = ({ value, rolling }: { value: number, rolling: boolean }) => {
    return (
        <div className={`w-24 h-24 bg-white rounded-2xl shadow-xl border-4 border-slate-300 relative ${rolling ? 'animate-bounce' : ''}`}>
             <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-3 gap-1">
                {value === 1 && <div className="col-start-2 row-start-2 bg-black rounded-full w-full h-full" />}
                
                {value === 2 && <>
                    <div className="col-start-1 row-start-1 bg-black rounded-full w-full h-full" />
                    <div className="col-start-3 row-start-3 bg-black rounded-full w-full h-full" />
                </>}
                
                {value === 3 && <>
                    <div className="col-start-1 row-start-1 bg-black rounded-full w-full h-full" />
                    <div className="col-start-2 row-start-2 bg-black rounded-full w-full h-full" />
                    <div className="col-start-3 row-start-3 bg-black rounded-full w-full h-full" />
                </>}
                
                {value === 4 && <>
                    <div className="col-start-1 row-start-1 bg-black rounded-full w-full h-full" />
                    <div className="col-start-3 row-start-1 bg-black rounded-full w-full h-full" />
                    <div className="col-start-1 row-start-3 bg-black rounded-full w-full h-full" />
                    <div className="col-start-3 row-start-3 bg-black rounded-full w-full h-full" />
                </>}
                
                {value === 5 && <>
                    <div className="col-start-1 row-start-1 bg-black rounded-full w-full h-full" />
                    <div className="col-start-3 row-start-1 bg-black rounded-full w-full h-full" />
                    <div className="col-start-2 row-start-2 bg-black rounded-full w-full h-full" />
                    <div className="col-start-1 row-start-3 bg-black rounded-full w-full h-full" />
                    <div className="col-start-3 row-start-3 bg-black rounded-full w-full h-full" />
                </>}

                {value === 6 && <>
                    <div className="col-start-1 row-start-1 bg-black rounded-full w-full h-full" />
                    <div className="col-start-3 row-start-1 bg-black rounded-full w-full h-full" />
                    <div className="col-start-1 row-start-2 bg-black rounded-full w-full h-full" />
                    <div className="col-start-3 row-start-2 bg-black rounded-full w-full h-full" />
                    <div className="col-start-1 row-start-3 bg-black rounded-full w-full h-full" />
                    <div className="col-start-3 row-start-3 bg-black rounded-full w-full h-full" />
                </>}
             </div>
        </div>
    );
};

const renderStars = (level: number) => {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star 
          key={i} 
          size={10} 
          className={i <= level ? "fill-yellow-400 text-yellow-400" : "text-slate-700 fill-slate-800/50"} 
        />
      ))}
    </div>
  );
};

interface GameSessionMeta {
    reportName: string;
    playerName: string;
    createdAt: string;
}

const SelectionCarousel = ({ 
    title, 
    headerText,
    subtitle, 
    items, 
    selectedId, 
    onSelect, 
    renderItem, 
    onNext,
    btnLabel,
    sessionMeta,
    shape = 'rectangle',
    showSliderPrompt = true,
}: any) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isCircle = shape === 'circle';

    const displayItems = useMemo(() => {
        return [...items, ...items, ...items];
    }, [items]);

    const initialOffsetSet = useRef(false);

    useEffect(() => {
        if (scrollRef.current && !initialOffsetSet.current) {
            const itemWidth = 280 + 24; 
            const centerIndex = items.length;
            scrollRef.current.scrollLeft = centerIndex * itemWidth;
            initialOffsetSet.current = true;
        }
    }, [items.length]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        const itemWidth = 280 + 24;
        const listWidth = items.length * itemWidth;

        if (container.scrollLeft < listWidth / 2) {
            container.scrollLeft += listWidth;
        } else if (container.scrollLeft > listWidth * 2) {
            container.scrollLeft -= listWidth;
        }
    };

    return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-500 z-50">
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10">
         <div>
            <h1 className="text-xl font-black text-white leading-tight">蜂富人生</h1>
            <p className="text-[10px] text-slate-400">{title} | 玩家: {sessionMeta.playerName}</p>
         </div>
      </div>
      
      <div className="flex-1 relative flex flex-col justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950">
        
        {headerText && (
            <div className="absolute top-8 left-0 right-0 text-center z-20">
                <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg tracking-wide">{headerText}</h2>
                <div className="w-16 h-1 bg-emerald-500 mx-auto mt-2 rounded-full"></div>
            </div>
        )}

        <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="w-full flex items-center overflow-x-auto snap-x snap-mandatory gap-6 pb-4 pt-16 scrollbar-hide"
            style={{ 
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}
            css={{
              '&::-webkit-scrollbar': {
                display: 'none',
                width: 0,
                height: 0,
              },
              '&::-webkit-scrollbar-track': {
                display: 'none',
              },
              '&::-webkit-scrollbar-thumb': {
                display: 'none',
              }
            }}
        >
            {displayItems.map((item: any, idx: number) => {
              const actualId = item.id;
              const isSelected = selectedId === actualId;
              return (
                <div 
                    key={`${actualId}-${idx}`} 
                    onClick={() => onSelect(actualId)}
                    className={`snap-center shrink-0 transition-all duration-300 ease-out cursor-pointer flex flex-col relative z-10 
                      ${isCircle ? 'w-[75vw] max-w-[280px] aspect-square' : 'w-[85vw] max-w-[280px] h-[55vh]'} 
                      ${isSelected ? 'scale-105' : 'scale-90 opacity-60 hover:opacity-100'}`}
                >
                    <div className={`w-full h-full bg-slate-900 border-2 overflow-hidden flex flex-col shadow-2xl relative transition-colors duration-300 
                      ${isCircle ? 'rounded-full items-center justify-center' : 'rounded-2xl'} 
                      ${isSelected ? 'border-emerald-500 shadow-emerald-500/30' : 'border-slate-700'}`}>
                        <div className={`flex-1 flex flex-col items-center text-center space-y-4 overflow-hidden ${isCircle ? 'justify-center p-8' : 'p-6'}`} style={{ maxHeight: '100%' }}>
                            {renderItem(item, isSelected)}
                        </div>
                    </div>
                </div>
              );
            })}
        </div>
        {showSliderPrompt && (
            <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-slate-500 animate-pulse pointer-events-none">
                ← 左右滑動選擇 →
            </div>
        )}
      </div>

      <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900 safe-area-bottom">
        <Button 
            variant="primary"
            disabled={!selectedId}
            onClick={onNext}
            className={`w-full py-3.5 text-base font-bold shadow-lg transition-all ${selectedId ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
        >
            {selectedId ? btnLabel : subtitle}
        </Button>
      </div>
    </div>
    );
};

type AppView = 'auth_home' | 'login' | 'register' | 'lobby' | 'history' | 'create_report' | 'profession_select' | 'enterprise_select' | 'dream_select' | 'game';

const MOCK_HISTORY: GameRecord[] = [
    { id: '1', date: '2023/10/01', playerName: 'DemoUser', profession: '釀蜜師', finalScore: 8, happinessScore: 85, isWin: false, financialSummary: { passiveIncome: 25000, totalExpenses: 40000, totalAssets: 1500000 } },
    { id: '2', date: '2023/10/05', playerName: 'DemoUser', profession: '飛行員', finalScore: 12, happinessScore: 100, isWin: true, financialSummary: { passiveIncome: 65000, totalExpenses: 50000, totalAssets: 5000000 } },
];

// 檢查是否為本地環境
const isLocalEnv = false;  

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('auth_home');
  const [user, setUser] = useState<{email: string, name: string} | null>(isLocalEnv ? { email: 'local@example.com', name: '本地測試用戶' } : null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(!isLocalEnv);
  const [sessionMeta, setSessionMeta] = useState<GameSessionMeta>({ 
    reportName: '本地測試報告', 
    playerName: '本地玩家', 
    createdAt: new Date().toISOString().split('T')[0]
  });
  
  const [gameHistory, setGameHistory] = useState<GameRecord[]>(MOCK_HISTORY);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPlayerName, setAuthPlayerName] = useState('本地玩家'); 
  const [authError, setAuthError] = useState('');
  const [inputReportName, setInputReportName] = useState('我的本地遊戲');
  const [formError, setFormError] = useState(''); 
  const [selectedProfessionId, setSelectedProfessionId] = useState<string | null>(isLocalEnv ? 'beekeeper' : null);
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState<string | null>(null);
  const [selectedDreamId, setSelectedDreamId] = useState<string | null>(null);
  
  // 店內 Alert 系統狀態
  const [alertInfo, setAlertInfo] = useState<{message: string, type: 'info' | 'error' | 'success'} | null>(null);
  const [showNoInsuranceAlert, setShowNoInsuranceAlert] = useState(false);

  const [gameState, setGameState] = useState<GameState>({
    profession: null,
    selectedEnterprise: null,
    selectedDream: null,
    currentRankTitle: '',
    currentRankLevel: 1,
    cash: 0,
    children: 0,
    medicalInsuranceCount: 0,
    assets: [],
    liabilities: [],
    loans: 0,
    isSetup: false,
    history: [],
    happiness: [],
    happinessTotal: 0,
  } as any);

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showHappinessModal, setShowHappinessModal] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showMaxLevelModal, setShowMaxLevelModal] = useState(false);
  const [showAircraftTooltip, setShowAircraftTooltip] = useState(false);
  const [showRankListModal, setShowRankListModal] = useState(false);
  const [showSettlementConfirm, setShowSettlementConfirm] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [showPaydayModal, setShowPaydayModal] = useState(false);
  const [showMedicalClaimModal, setShowMedicalClaimModal] = useState(false);
  
  const [showDiceModal, setShowDiceModal] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [diceValue, setDiceValue] = useState(1);
  const [examResult, setExamResult] = useState<'idle' | 'success' | 'failure'>('idle');
  const [examLog, setExamLog] = useState<{target: number, bonus: number, newTitle: string} | null>(null);

  // 店內 Alert 觸發器
  const showAlert = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setAlertInfo({ message, type });
    setTimeout(() => setAlertInfo(null), 3000);
  };

  const handleDeleteTransactionRecord = (id: string) => {
    setGameState(prev => {
      const index = prev.history.findIndex(tx => tx.id === id);
      if (index === -1) return prev;

      // 目前僅支援刪除「最新一筆」交易，以確保現金與結餘一致
      if (index !== 0) {
        showAlert('目前僅能刪除最後一筆交易紀錄。', 'info');
        return prev;
      }

      const newHistory = prev.history.slice(1);
      const newCash = newHistory.length > 0 ? newHistory[0].balance : 0;

      return { ...prev, history: newHistory, cash: newCash };
    });
  };

  useEffect(() => {
    if (!auth) { 
      setIsLoadingAuth(false); 
      return; 
    }
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({ 
          email: firebaseUser.email || '', 
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Player' 
        });
        // 註解掉自動跳轉的代碼
        // if (currentView === 'auth_home' || currentView === 'login' || currentView === 'register') { 
        //   setCurrentView('lobby'); 
        // }
      } else {
        setUser(null);
        // 確保停留在登入頁面
        setCurrentView('login');
      }
      setIsLoadingAuth(false);
    });
    
    return () => unsubscribe();
  }, []);

  const formatMoney = (amount: number) => `${amount.toLocaleString()} H`;

  const getProfessionIcon = (id: string, props: { className?: string; size?: number | string } = {}) => {
    switch(id) {
      case 'pilot': return <Plane {...props} />;
      case 'doctor': return <Stethoscope {...props} />;
      case 'artist': return <Palette {...props} />;
      case 'nest_builder': return <Hammer {...props} />;
      case 'accountant': return <Calculator {...props} />;
      case 'clerk': return <ShoppingBag {...props} />;
      case 'technician': return <Wrench {...props} />;
      case 'teacher': return <BookOpen {...props} />;
      case 'honey_brewer': return <Coffee {...props} />;
      case 'fashion_designer': return <Scissors {...props} />;
      default: return <Briefcase {...props} />;
    }
  };

  const getEnterpriseIcon = (id: string, props: { className?: string; size?: number | string } = {}) => {
    switch(id) {
      case 'C01': return <Coffee {...props} />;
      case 'C02': return <Scissors {...props} />;
      case 'C03': return <Building2 {...props} />;
      case 'C04': return <Plane {...props} />;
      case 'C05': return <Baby {...props} />;
      case 'C06': return <Palette {...props} />;
      case 'C07': return <Stethoscope {...props} />;
      case 'C08': return <Landmark {...props} />;
      case 'C09': return <Wrench {...props} />;
      case 'C10': return <ShoppingBag {...props} />;
      default: return <Building2 {...props} />;
    }
  };

  const getDreamIcon = (id: string, props: { className?: string; size?: number | string } = {}) => {
    switch(id) {
      case 'D01': return <TreePine {...props} />;
      case 'D02': return <Globe2 {...props} />;
      case 'D03': return <FerrisWheel {...props} />;
      case 'D04': return <Leaf {...props} />;
      case 'D05': return <Landmark {...props} />;
      case 'D06': return <Trophy {...props} />;
      case 'D07': return <Accessibility {...props} />;
      case 'D08': return <Ambulance {...props} />;
      case 'D09': return <Home {...props} />;
      case 'D10': return <Rocket {...props} />;
      default: return <Star {...props} />;
    }
  };

  const hasAircraft = gameState.assets.some(a => a.type === '飛行器' as any);

  const summary: FinancialSummary = useMemo(() => {
    if (!gameState.profession) return { totalIncome: 0, totalExpenses: 0, monthlyCashflow: 0, passiveIncome: 0, totalAssets: 0, totalLiabilities: 0, payday: 0 };
    const passiveIncome = gameState.assets.reduce((sum, a) => sum + a.cashflow, 0);
    const totalIncome = gameState.profession.salary + passiveIncome;
    
    // 符合第 2 點：信貸利息為 10%
    const creditLoanPrincipal = gameState.liabilities.filter(l => l.type === '信用貸款').reduce((sum, l) => sum + l.totalOwed, 0) + gameState.loans; 
    const creditLoanInterest = creditLoanPrincipal * 0.1; 
    
    const aircraftLoanPrincipal = gameState.liabilities.filter(l => l.type === '飛行器貸款').reduce((sum, l) => sum + l.totalOwed, 0);
    const aircraftLoanInterest = aircraftLoanPrincipal * 0.005;
    
    const businessLoanPrincipal = gameState.liabilities.filter(l => l.type === '企業貸款').reduce((sum, l) => sum + l.totalOwed, 0);
    const businessLoanInterest = businessLoanPrincipal * 0.005; 
    
    const realEstateLoanPrincipal = gameState.liabilities.filter(l => l.type === '不動產貸款').reduce((sum, l) => sum + l.totalOwed, 0);
    const realEstateLoanInterest = realEstateLoanPrincipal * 0.005; 

    const p = gameState.profession;
    const baseExpenses = p.expenses.tax + p.expenses.basicLiving + p.expenses.transportEdu + p.expenses.otherMedicalChild;
    const rankIncrease = Math.max(0, gameState.currentRankLevel - 1);
    const otherExpensesBonus = rankIncrease * 10000;
    const totalInsuranceCount = (gameState.medicalInsuranceCount || 0) + gameState.assets.filter(a => a.isInsured).length;
    const insuranceCost = totalInsuranceCount * 2000; 
    
    const totalExpenses = baseExpenses + otherExpensesBonus + creditLoanInterest + aircraftLoanInterest + businessLoanInterest + realEstateLoanInterest + insuranceCost;
    
    return { 
        totalIncome, 
        totalExpenses, 
        monthlyCashflow: totalIncome - totalExpenses, 
        passiveIncome, 
        totalAssets: gameState.assets.reduce((sum, a) => sum + a.cost, 0) + gameState.cash, 
        totalLiabilities: gameState.liabilities.reduce((sum, l) => sum + l.totalOwed, 0) + gameState.loans, 
        payday: totalIncome - totalExpenses 
    };
  }, [gameState]);

  const scoreResult = useMemo(() => {
      const h = gameState.happinessTotal;
      const reserve = gameState.cash + gameState.assets.filter(a => a.type === '定存').reduce((s, a) => s + a.cost, 0);
      const isReserveOk = reserve > summary.totalExpenses;
      const isInsured = (gameState.medicalInsuranceCount || 0) >= 1; 
      const isCashflowOk = summary.monthlyCashflow > 0;
      const validInvestmentTypes = new Set(['股票', '不動產', '企業', '定存']);
      const playerAssetTypes = new Set(gameState.assets.map(a => a.type).filter(t => validInvestmentTypes.has(t as string)));
      
      const criteriaList = [
        { label: '遊玩積分', points: 2, achieved: true },
        { label: '幸福指數達 10', points: 1, achieved: h >= 10 },
        { label: '幸福指數達 30', points: 1, achieved: h >= 30 },
        { label: '幸福指數達 60', points: 2, achieved: h >= 60 },
        { label: '幸福指數達 80', points: 3, achieved: h >= 80 },
        { label: '幸福指數達 100', points: 5, achieved: h >= 100 },
        { label: '達到財務安全 (預備金/保險/收支平衡)', points: 1, achieved: isReserveOk && isInsured && isCashflowOk },
        { label: '達到財務寬裕 (擁有多種資產)', points: 2, achieved: playerAssetTypes.size >= 2 },
        { label: '達到財務自由 (資產收入 > 總支出)', points: 3, achieved: summary.passiveIncome > summary.totalExpenses },
      ];

      const totalScore = criteriaList.reduce((sum, c) => sum + (c.achieved ? c.points : 0), 0);
      return { totalScore, details: criteriaList };
  }, [gameState, summary]);

  const userStats = useMemo(() => {
      if (gameHistory.length === 0) return { totalGames: 0, winRate: 0, totalScore: 0 };
      const totalGames = gameHistory.length;
      const wins = gameHistory.filter(g => g.isWin).length;
      const totalScore = gameHistory.reduce((sum, g) => sum + g.finalScore, 0);
      return { totalGames, winRate: Math.round((wins / totalGames) * 100), totalScore };
  }, [gameHistory]);

  useEffect(() => {
    if (!gameState.isSetup) return;
    let updatedHappiness = [...gameState.happiness];
    let changed = false;
    
    // 符合第 3 點：實現幸福財務自動勾選 (唯讀鎖定)
    if (summary.passiveIncome > summary.totalExpenses) {
        const item = updatedHappiness.find(h => h.id === 'h_finance');
        if (item && !item.checked) { 
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_finance' ? { ...h, checked: true } : h); 
            changed = true; 
        }
    } else {
        const item = updatedHappiness.find(h => h.id === 'h_finance');
        if (item && item.checked) {
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_finance' ? { ...h, checked: false } : h);
            changed = true;
        }
    }

    const houseSubIds: Record<string, string> = { '1room': 'h_house_1', '2room': 'h_house_2', '3room': 'h_house_3', '5room': 'h_house_5' };
    const ownedTypes = new Set(
      gameState.assets
        .filter(a => a.houseType && a.isSelfUse)
        .map(a => a.houseType)
    );
    Object.entries(houseSubIds).forEach(([typeKey, itemId]) => {
         const shouldBeChecked = ownedTypes.has(typeKey);
         const item = updatedHappiness.find(h => h.id === itemId);
         if (item && item.checked !== shouldBeChecked) { updatedHappiness = updatedHappiness.map(h => h.id === itemId ? { ...h, checked: shouldBeChecked } : h); changed = true; }
    });
    const hasAnyHouseType = gameState.assets.some(
      a => a.type === '不動產' && a.houseType && a.isSelfUse
    );
    const houseItem = updatedHappiness.find(h => h.id === 'h_house_self');
    if (houseItem && houseItem.checked !== hasAnyHouseType) { updatedHappiness = updatedHappiness.map(h => h.id === 'h_house_self' ? { ...h, checked: hasAnyHouseType } : h); changed = true; }
    const hasDate = updatedHappiness.find(h => h.id === 'h_date')?.checked;
    const hasProposal = updatedHappiness.find(h => h.id === 'h_proposal')?.checked;
    const hasWedding = updatedHappiness.find(h => h.id === 'h_wedding')?.checked;
    const hasChild1 = updatedHappiness.find(h => h.id === 'h_child1')?.checked;
    if (hasDate && hasProposal && hasWedding && hasChild1 && hasAnyHouseType) {
         const familyItem = updatedHappiness.find(h => h.id === 'h_family');
         if (familyItem && !familyItem.checked) { updatedHappiness = updatedHappiness.map(h => h.id === 'h_family' ? { ...h, checked: true } : h); changed = true; }
    }
    const planeItem = updatedHappiness.find(h => h.id === 'h_plane');
    if (planeItem && planeItem.checked !== hasAircraft) { updatedHappiness = updatedHappiness.map(h => h.id === 'h_plane' ? { ...h, checked: hasAircraft } : h); changed = true; }
    if (changed) { setGameState(prev => ({ ...prev, happiness: updatedHappiness, happinessTotal: updatedHappiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0) })); }
  }, [summary.passiveIncome, summary.totalExpenses, gameState.assets, gameState.isSetup, gameState.happiness]);

  const handleLogin = async () => {
      setAuthError('');
      setIsLoadingAuth(true);
      try {
          // 本地開發模式：直接登入，不需要驗證
          setUser({ 
              email: authEmail.trim() || 'local@example.com', 
              name: authPlayerName || authEmail.split('@')[0] || '本地測試用戶' 
          });
          setCurrentView('lobby');
          setAuthEmail('');
          setAuthPassword('');
      } catch (error) {
          console.error('登入錯誤:', error);
          setAuthError('登入時發生錯誤');
      } finally {
          setIsLoadingAuth(false);
      }
  };

  const handleRegister = async () => {
      setAuthError('');
      if(authEmail.trim() && (authPassword.trim() || !auth)) {
          if (auth) {
              try {
                  const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
                  const nickname = authPlayerName.trim() || authEmail.split('@')[0];
                  await updateProfile(userCredential.user, { displayName: nickname });
                  setAuthEmail(''); setAuthPassword(''); setAuthPlayerName('');
              } catch (error: any) { setAuthError(error.message || '註冊失敗'); }
          } else { setUser({ email: authEmail, name: authPlayerName || authEmail.split('@')[0] }); setCurrentView('lobby'); }
      } else { setAuthError('請輸入完整資訊'); }
  };

  const handleLogout = async () => { if (auth) { try { await signOut(auth); } catch (error) { console.error(error); } } else { setUser(null); setCurrentView('auth_home'); } };

  const handleCreateReport = () => {
      setFormError('');
      if (!inputReportName) { setFormError("請輸入報表名稱"); return; }
      const now = new Date();
      const dateStr = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
      setSessionMeta({ reportName: inputReportName, playerName: user?.name || 'Guest', createdAt: dateStr });
      setCurrentView('profession_select');
  };

  const finalizeSetup = () => {
    const prof = PROFESSIONS.find(p => p.id === selectedProfessionId);
    const enterprise = ENTERPRISES.find(e => e.id === selectedEnterpriseId);
    const dream = DREAMS.find(d => d.id === selectedDreamId);
    if (!prof || !enterprise || !dream) return;
    const initTx: Transaction = { id: 'init', name: '初始資金', amount: prof.savings, sourceLabel: '起始儲蓄', usageLabel: '現金 (資產)', cashChange: prof.savings, balance: prof.savings, timestamp: Date.now() };
    const happinessList: HappinessItem[] = [
        { id: 'h_finance', label: '實現幸福財務 (資產收入>總支出)', points: 30, checked: false, readOnly: true }, // 符合第 3 點：鎖定
        { id: 'h_family', label: '實現幸福家庭 (完成5項)', points: 20, checked: false, readOnly: true },
        { id: 'h_date', label: '1. 第一次約會', points: 2, checked: false },
        { id: 'h_proposal', label: '2. 難忘的求婚', points: 2, checked: false },
        { id: 'h_wedding', label: '3. 浪漫的婚禮', points: 4, checked: false },
        { id: 'h_child1', label: '4. 擁有第一個孩子', points: 4, checked: false },
        { id: 'h_house_self', label: '5. 擁有自住的房子', points: 0, checked: false, readOnly: true }, 
        { id: 'h_house_1', label: '單間小套房', points: 2, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_house_2', label: '兩室一廳', points: 4, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_house_3', label: '三室兩廳', points: 6, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_house_5', label: '五室三廳', points: 8, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_child2', label: '擁有第二個孩子', points: 4, checked: false },
        { id: 'h_plane', label: '擁有一架飛行器', points: 4, checked: false, readOnly: true },
        { id: 'h_career', label: `事業成就 (${enterprise.name})`, code: enterprise.id, description: `投資額: ${formatMoney(enterprise.cost)} | 月收: +${formatMoney(enterprise.income)}`, points: 10, checked: false, readOnly: true },
        { id: 'h_dream', label: `完成夢想 (${dream.name})`, code: dream.id, description: `花費: ${formatMoney(dream.cost)} ${dream.description ? '| ' + dream.description : ''}`, points: 10, checked: false, readOnly: true },
    ];
    setGameState({ profession: prof, selectedEnterprise: enterprise, selectedDream: dream, currentRankTitle: prof.initialRank, currentRankLevel: 1, cash: prof.savings, children: 0, medicalInsuranceCount: 0, assets: [], liabilities: [], loans: 0, isSetup: true, history: [initTx], happiness: happinessList, happinessTotal: 0 } as any);
    setCurrentView('game');
  };

  const handleFinishGame = () => { setShowSettlementConfirm(true); };
  
  const confirmToScorePage = () => {
      setShowSettlementConfirm(false);
      setShowSettlementModal(true);
  };

  const confirmFinishGame = () => {
      const newRecord: GameRecord = { id: Date.now().toString(), date: new Date().toLocaleDateString(), playerName: sessionMeta.playerName, profession: gameState.profession?.title || 'Unknown', finalScore: scoreResult.totalScore, happinessScore: gameState.happinessTotal, isWin: scoreResult.totalScore >= 10, financialSummary: { passiveIncome: summary.passiveIncome, totalExpenses: summary.totalExpenses, totalAssets: summary.totalAssets } };
      setGameHistory([newRecord, ...gameHistory]);
      setShowSettlementModal(false);
      setCurrentView('lobby');
  };

  const handlePaydayConfirm = () => {
      handleTransactionSubmit({ name: summary.monthlyCashflow >= 0 ? '領取月結餘' : '支付月損益', amount: Math.abs(summary.monthlyCashflow), source: summary.monthlyCashflow >= 0 ? 'income' : 'cash', usage: summary.monthlyCashflow >= 0 ? 'cash' : 'expense', cashChange: summary.monthlyCashflow });
      setShowPaydayModal(false);
  };

  const handleMedicalClaim = () => {
      const insuranceCount = gameState.medicalInsuranceCount || 0;
      if (insuranceCount <= 0) { setShowNoInsuranceAlert(true); return; }
      setShowMedicalClaimModal(true);
  };

  const confirmMedicalClaim = () => {
      const insuranceCount = gameState.medicalInsuranceCount || 0;
      const totalClaim = insuranceCount * 50000;
      handleTransactionSubmit({ name: `醫療保險理賠 (${insuranceCount}張)`, amount: totalClaim, source: 'income', usage: 'cash', cashChange: totalClaim });
      setShowMedicalClaimModal(false);
  };

  const handleTransactionSubmit = (data: TransactionData) => {
      setGameState(prev => {
          let newCash = prev.cash;
          let newAssets = [...prev.assets];
          let newLiabilities = [...prev.liabilities];
          let newLoans = prev.loans; 
          let newChildren = prev.children;
          let newMedicalInsuranceCount = prev.medicalInsuranceCount || 0;
          let newProfession = prev.profession ? { ...prev.profession } : null;
          let newHappiness = [...prev.happiness];
          let cashChange = 0;
          const txId = Math.random().toString(36).substr(2, 9);
          let sourceLabel = ""; let usageLabel = ""; let finalName = data.name;
          let detailsText = "";

          if (data.usage === 'stock_update' && data.stockDividendPayload) {
              data.stockDividendPayload.items.forEach(item => {
                  const idx = newAssets.findIndex(a => a.id === item.assetId);
                  if (idx !== -1) { 
                      const a = newAssets[idx];
                      newAssets[idx] = { ...a, quantity: item.addedQty }; 
                      detailsText += `${a.name}: 新張數 ${item.addedQty} | `;
                  }
              });
              sourceLabel = "股票發股利"; usageLabel = "資產更新";
          }
          else if (data.usage === 'expense_update' && data.expensePayload && newProfession) {
              const { category, amount, isIncrease } = data.expensePayload;
              const change = isIncrease ? amount : -amount;
              newProfession.expenses = { ...newProfession.expenses, [category]: Math.max(0, (newProfession.expenses as any)[category] + change) };
              sourceLabel = isIncrease ? "增加月支出" : "減少月支出"; usageLabel = "財報更新";
              detailsText = `${isIncrease ? '增加' : '減少'}金額: ${amount.toLocaleString()}`;
          }
          else if (data.source === 'income' && data.usage === 'cash' && data.stockList) {
              data.stockList.forEach(item => {
                  const assetIndex = newAssets.findIndex(a => a.name.includes(item.symbol));
                  if (assetIndex !== -1) {
                      const asset = newAssets[assetIndex];
                      detailsText += `${item.symbol} x ${item.qty} (@${item.price}) | `;
                      if (item.qty >= (asset.quantity || 0)) { newAssets.splice(assetIndex, 1); } 
                      else {
                          const remaining = (asset.quantity || 0) - item.qty;
                          const costPerUnit = asset.cost / (asset.quantity || 1);
                          newAssets[assetIndex] = { ...asset, quantity: remaining, cost: Math.floor(costPerUnit * remaining) };
                      }
                  }
              });
              newCash += data.amount; cashChange = data.amount; sourceLabel = "出售股票"; usageLabel = "現金";
          }
          else if (data.source === 'income' && data.usage === 'cash' && data.relatedAssetId) {
               const assetIndex = newAssets.findIndex(a => a.id === data.relatedAssetId);
               if (assetIndex !== -1) {
                   const asset = newAssets[assetIndex];
                   if (asset.type === '定存') {
                       if (data.amount >= asset.cost) { newAssets.splice(assetIndex, 1); } 
                       else { const remainingCost = asset.cost - data.amount; const newInterest = Math.floor(remainingCost * 0.005); newAssets[assetIndex] = { ...asset, cost: remainingCost, cashflow: newInterest }; }
                   } else { newAssets.splice(assetIndex, 1); }
                   newCash += data.amount; cashChange = data.amount; sourceLabel = "出售資產"; usageLabel = "現金";
                   detailsText = `資產: ${asset.name}`;
               }
          }
          else if (data.source === 'cash' && data.usage === 'asset' && data.stockList) {
              const stockDetails = data.stockList.map(s => `${s.symbol} x ${s.qty}`).join(', ');
              finalName = `購買股票 (${stockDetails})`;
              data.stockList.forEach(s => {
                  const existingIdx = newAssets.findIndex(a => a.type === '股票' && a.name.includes(s.symbol));
                  if (existingIdx !== -1) {
                      const old = newAssets[existingIdx];
                      const totalQty = (old.quantity || 0) + s.qty;
                      const totalCost = totalQty * s.price;
                      newAssets[existingIdx] = { 
                          ...old, 
                          quantity: totalQty, 
                          cost: totalCost, 
                          downPayment: old.downPayment + (s.price * s.qty),
                          lastPurchasePrice: s.price 
                      };
                  } else {
                      newAssets.push({ 
                          id: `stock-${Math.random().toString(36).substr(2, 6)}`, 
                          name: `股票 ${s.symbol}`, 
                          type: '股票', 
                          cost: s.price * s.qty, 
                          quantity: s.qty, 
                          downPayment: s.price * s.qty, 
                          cashflow: 0,
                          lastPurchasePrice: s.price
                      });
                  }
              });
              newCash -= data.amount; cashChange = -data.amount; sourceLabel = "現金"; usageLabel = "購買股票";
          }
          else if (data.source === 'loan' && data.usage === 'cash' && data.assetDetails?.loanAmount) {
              const amount = data.assetDetails.loanAmount;
              newCash += amount; cashChange = amount;
              newLiabilities.push({ id: `credit-loan-${txId}`, name: '信用貸款', totalOwed: amount, monthlyPayment: Math.floor(amount * 0.1), type: '信用貸款' });
              sourceLabel = "申請信貸"; usageLabel = "現金";
              detailsText = `貸得金額: ${amount.toLocaleString()}`;
          }
          else if (data.usage === 'liability' && data.liabilityId) {
              const liabIndex = newLiabilities.findIndex(l => l.id === data.liabilityId);
              if (liabIndex !== -1) {
                  const liab = newLiabilities[liabIndex];
                  newCash -= data.amount; cashChange = -data.amount;
                  if (data.amount >= liab.totalOwed) { newLiabilities.splice(liabIndex, 1); } 
                  else { newLiabilities[liabIndex] = { ...liab, totalOwed: liab.totalOwed - data.amount }; }
                  sourceLabel = "現金"; usageLabel = `償還 ${liab.name}`;
                  detailsText = `還款金額: ${data.amount.toLocaleString()}`;
              }
          }
          else {
              const details = data.assetDetails;
              const isInsurance = details?.type === '保險' || data.insuranceType !== undefined;
              
              if (isInsurance) {
                  // 符合第 1 點：購買保險需支付現金
                  if (data.amount > 0) {
                      newCash -= data.amount;
                      cashChange = -data.amount;
                  }
                  
                  if (data.insuranceType === 'medical') { 
                    newMedicalInsuranceCount += (data.insurancePayload?.medicalQty || 0); 
                    detailsText = `張數: ${data.insurancePayload?.medicalQty}`; 
                  } 
                  else if (data.insurancePayload?.targetAssetIds) { 
                      newAssets = newAssets.map(a => { if (data.insurancePayload?.targetAssetIds?.includes(a.id)) { return { ...a, isInsured: true }; } return a; }); 
                      detailsText = `投保資產數: ${data.insurancePayload?.targetAssetIds?.length}`;
                  }
                  usageLabel = data.name;
              }
              else if (data.usage === 'asset' && details) {
                  const newAsset: Asset = { id: Math.random().toString(36).substr(2, 9), name: data.name.replace('購買 ', '').replace('投資 ', '').replace('收購目標企業: ', ''), cost: data.amount, downPayment: details.downPayment, cashflow: details.cashflow, type: details.type as any, isSelfUse: details.isSelfUse, houseType: details.houseType, quantity: details.quantity };
                  newAssets.push(newAsset);
                  detailsText = `總值: ${data.amount.toLocaleString()} | 月收: ${details.cashflow.toLocaleString()}`;
                  
                  if (details.type === '目標企業') {
                      newHappiness = newHappiness.map(h => h.id === 'h_career' ? { ...h, checked: true } : h);
                  }

                  if (details.loanAmount && details.loanAmount > 0) {
                      // Fix for Logic 4: Use calculated cashChange from TransactionForm
                      newCash += data.cashChange;
                      cashChange = data.cashChange;
                      
                      let liabilityType: Liability['type'] = '信用貸款'; let liabilityName = '貸款'; let monthlyPay = 0;
                      if (details.type === '不動產') { liabilityType = '不動產貸款'; liabilityName = `房貸 (${details.symbol})`; monthlyPay = details.loanInterest || 0; } 
                      else if (details.type === '企業' || details.type === '目標企業' as any) { liabilityType = '企業貸款'; liabilityName = `企貸 (${details.symbol})`; monthlyPay = details.loanInterest || 0; } 
                      else if (details.type === '飛行器' as any) { liabilityType = '飛行器貸款'; liabilityName = '飛行器貸款'; monthlyPay = details.loanInterest || 0; }
                      newLiabilities.push({ id: `loan-${txId}`, name: liabilityName, totalOwed: details.loanAmount, monthlyPayment: monthlyPay, type: liabilityType });
                  } else {
                      newCash -= data.amount; 
                      cashChange = -data.amount;
                  }
                  sourceLabel = "現有現金";
                  usageLabel = "購買資產";
              } else if (data.usage === 'expense') { 
                  newCash -= data.amount;
                  cashChange = -data.amount;
                  sourceLabel = "現有現金";
                  usageLabel = data.name; 
                  detailsText = `支付金額: ${data.amount.toLocaleString()}`; 
                  
                  if (data.name.includes('實現夢想')) {
                      newHappiness = newHappiness.map(h => h.id === 'h_dream' ? { ...h, checked: true } : h);
                  }
              } else if (data.source === 'income') {
                  newCash += data.amount;
                  cashChange = data.amount;
                  sourceLabel = "收入";
              }
          }
          if (data.name.includes('孩子') || data.name.includes('生子')) { newChildren = Math.min(3, newChildren + 1); }
          const newTx: Transaction = { id: txId, name: finalName, amount: data.amount, sourceLabel, usageLabel, cashChange: cashChange, balance: newCash, timestamp: Date.now(), details: detailsText };
          return { ...prev, profession: newProfession, cash: newCash, assets: newAssets, liabilities: newLiabilities, loans: newLoans, children: newChildren, medicalInsuranceCount: newMedicalInsuranceCount, history: [newTx, ...prev.history], happiness: newHappiness };
      });
      setShowTransactionModal(false);
      showAlert("交易已成功記錄！", 'success');
  };

  const handleToggleHappiness = (id: string) => {
      setGameState(prev => {
          const item = prev.happiness.find(h => h.id === id);
          if (item?.readOnly && !item.checked) return prev; 
          const newHappiness = prev.happiness.map(h => h.id === id ? { ...h, checked: !h.checked } : h);
          const newTotal = newHappiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0);
          return { ...prev, happiness: newHappiness, happinessTotal: newTotal };
      });
  };
  
  const handleAddHappinessItem = (label: string, points: number) => {
      setGameState(prev => {
          const newItem: HappinessItem = { id: `custom_${Date.now()}`, label, points, checked: true, isCustom: true };
          const newHappiness = [...prev.happiness, newItem];
          const newTotal = newHappiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0);
          return { ...prev, happiness: newHappiness, happinessTotal: newTotal };
      });
  };

  const handleRemoveHappinessItem = (id: string) => {
      setGameState(prev => {
          if (!prev.happiness.find(h => h.id === id)) return prev;
          const newHappiness = prev.happiness.filter(h => h.id !== id);
          const newTotal = newHappiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0);
          return { ...prev, happiness: newHappiness, happinessTotal: newTotal };
      });
  };

  const handlePromotionConfirm = () => {
      const currentLevelIndex = gameState.currentRankLevel - 1;
      const promotions = gameState.profession?.promotions || [];
      if (currentLevelIndex >= promotions.length) { setShowMaxLevelModal(true); setShowPromotionModal(false); return; }
      if (gameState.cash < 1000) { showAlert("錯誤：您的現金不足 1,000 H，無法參加考試！", 'error'); return; }
      handleTransactionSubmit({ name: '升等考試費用', amount: 1000, cashChange: -1000, source: 'cash', usage: 'expense' });
      setShowPromotionModal(false); setExamResult('idle'); setDiceValue(1); setShowDiceModal(true);
  };

  const handleDiceRoll = () => {
      if (isRolling || examResult === 'success') return; 
      setIsRolling(true); setExamResult('idle');
      let count = 0;
      const interval = setInterval(() => {
          setDiceValue(Math.floor(Math.random() * 6) + 1); count++;
          if (count > 10) { clearInterval(interval); finishRoll(); }
      }, 100);
  };

  const finishRoll = () => {
      const finalRoll = Math.floor(Math.random() * 6) + 1;
      setDiceValue(finalRoll); setIsRolling(false);
      const currentLevelIndex = gameState.currentRankLevel - 1;
      const promotionRule = gameState.profession?.promotions[currentLevelIndex];
      const targetRoll = currentLevelIndex + 2; 
      setExamLog({ target: targetRoll, bonus: promotionRule?.bonus || 0, newTitle: promotionRule?.rankTitle || '未知職稱' });
      if (finalRoll >= targetRoll) {
          setExamResult('success');
          setTimeout(() => {
              setGameState(prev => {
                  if (!prev.profession || !promotionRule) return prev;
                  return { ...prev, currentRankLevel: prev.currentRankLevel + 1, currentRankTitle: promotionRule.rankTitle, profession: { ...prev.profession, salary: prev.profession.salary + promotionRule.bonus }, history: [ { id: `promo-${Date.now()}`, name: `晉升: ${promotionRule.rankTitle}`, amount: promotionRule.bonus, sourceLabel: '升等加薪', usageLabel: '勞務收入增加', cashChange: 0, balance: prev.cash, timestamp: Date.now() }, ...prev.history ] };
              });
          }, 500);
      } else { setExamResult('failure'); }
  };

  if (isLoadingAuth) { return ( <div className="min-h-screen bg-slate-950 flex items-center justify-center"> <div className="text-emerald-500 animate-pulse">載入中...</div> </div> ); }

  if (currentView === 'auth_home') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]" />
        </div>
        <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-700 flex flex-col items-center z-10">
          <div className="mb-12 text-center relative">
             <div className="inline-block p-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 mb-6 shadow-xl shadow-amber-500/20"> <span className="text-6xl drop-shadow-md">🐝</span> </div>
             <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-yellow-400 to-amber-600 mb-4 tracking-tight"> 蜂富人生 </h1>
            <p className="text-slate-400 text-lg font-light tracking-widest uppercase">The Happiness Flow Game</p>
          </div>
          <div className="flex flex-col gap-4 w-full px-8">
              <button onClick={() => setCurrentView('login')} className="w-full py-4 bg-white text-black text-xl font-bold rounded-xl shadow-2xl hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-300"> 登入帳號 </button>
              <button onClick={() => setCurrentView('register')} className="w-full py-4 bg-slate-800 text-white text-xl font-bold rounded-xl border border-slate-700 hover:border-emerald-500 hover:scale-105 transition-all duration-300"> 註冊帳號 </button>
          </div>
          <p className="mt-8 text-xs text-slate-600 font-mono">v1.3.0 • 財商模擬系統</p>
        </div>
      </div>
    );
  }

  if (currentView === 'login' || currentView === 'register') {
      const isLogin = currentView === 'login';
      return (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
              <Card className="w-full max-sm bg-slate-900 border-slate-700 shadow-2xl p-8 animate-in zoom-in-95">
                  <div className="mb-6 text-center"> <h2 className="text-2xl font-bold text-white mb-2">{isLogin ? '歡迎回來' : '建立帳號'}</h2> <p className="text-slate-400 text-sm">請輸入您的帳號資訊</p> </div>
                  <div className="space-y-4">
                      {authError && ( <div className="bg-rose-900/30 text-rose-400 text-sm p-3 rounded border border-rose-800 flex items-center gap-2"> <AlertCircle size={16} /> {authError} </div> )}
                      <div> <label className="text-sm text-slate-300 mb-1 block">電子信箱 (帳號)</label> <div className="relative"> <Mail className="absolute left-3 top-2.5 text-slate-500" size={16} /> <Input className="pl-10" type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="name@example.com" /> </div> </div>
                      {!isLogin && ( <div> <label className="text-sm text-slate-300 mb-1 block">玩家名稱 (暱稱)</label> <div className="relative"> <User className="absolute left-3 top-2.5 text-slate-500" size={16} /> <Input className="pl-10" value={authPlayerName} onChange={e => setAuthPlayerName(e.target.value)} placeholder="設定您的遊戲暱稱" /> </div> </div> )}
                      <div> <label className="text-sm text-slate-300 mb-1 block">密碼</label> <Input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Password" /> </div>
                      <Button onClick={isLogin ? handleLogin : handleRegister} className="w-full py-3 mt-4 text-lg"> {isLogin ? '登入' : '註冊'} </Button>
                      <button onClick={() => setCurrentView('auth_home')} className="w-full text-center text-slate-500 text-sm mt-2 hover:text-white"> 返回 </button>
                  </div>
              </Card>
          </div>
      );
  }

  if (currentView === 'lobby') {
      return (
          <div className="min-h-screen bg-slate-950 p-6 flex flex-col">
              <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3"> <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-bold text-xl shadow-lg"> {user?.name.charAt(0).toUpperCase()} </div> <div> <h2 className="text-xl font-bold text-white">{user?.name}</h2> <div className="flex items-center gap-1 text-xs text-slate-400"> <Crown size={12} className="text-yellow-500" /> 等級: {Math.floor(userStats.totalScore / 10) + 1} </div> </div> </div>
                  <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"> <LogOut size={20} /> </button>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-8">
                  <Card className="p-4 bg-slate-900 border-slate-700 flex flex-col items-center justify-center gap-2"> <div className="text-slate-400 text-xs uppercase tracking-wider">總積分</div> <div className="text-3xl font-black text-yellow-400">{userStats.totalScore}</div> </Card>
                  <Card className="p-4 bg-slate-900 border-slate-700 flex flex-col items-center justify-center gap-2"> <div className="text-slate-400 text-xs uppercase tracking-wider">勝率</div> <div className="text-3xl font-black text-emerald-400">{userStats.winRate}%</div> </Card>
                  <Card className="p-4 bg-slate-900 border-slate-700 flex flex-col items-center justify-center gap-2"> <div className="text-slate-400 text-xs uppercase tracking-wider">遊玩局數</div> <div className="text-3xl font-black text-blue-400">{userStats.totalGames}</div> </Card>
              </div>
              <div className="flex-1 flex flex-col gap-4 max-w-md mx-auto w-full justify-center">
                  <button onClick={() => setCurrentView('create_report')} className="group relative p-6 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center justify-between"> <div className="flex flex-col text-left"> <span className="text-2xl font-bold text-white mb-1">開始新冒險</span> <span className="text-emerald-100 text-sm">建立新報表並開始遊戲</span> </div> <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"> <Play size={24} className="text-white fill-white" /> </div> </button>
                  <button onClick={() => setCurrentView('history')} className="p-6 bg-slate-800 border border-slate-700 rounded-2xl hover:bg-slate-700 transition-all flex items-center justify-between group"> <div className="flex flex-col text-left"> <span className="text-xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">歷史紀錄</span> <span className="text-slate-400 text-sm">查看過往財報與分數</span> </div> <History size={24} className="text-slate-500 group-hover:text-emerald-400 transition-colors" /> </button>
              </div>
          </div>
      );
  }

  if (currentView === 'history') {
      return (
          <div className="min-h-screen bg-slate-950 p-6 flex flex-col">
              <div className="flex items-center gap-4 mb-6"> <button onClick={() => setCurrentView('lobby')} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white"> <ChevronLeft size={20} /> </button> <h2 className="text-2xl font-bold text-white">歷史紀錄</h2> </div>
              <div className="space-y-4">
                  {gameHistory.length === 0 ? ( <div className="text-center text-slate-500 py-10">尚無遊玩紀錄</div> ) : ( gameHistory.map(record => ( <Card key={record.id} className="p-4 bg-slate-900 border-slate-700 flex flex-col gap-3"> <div className="flex justify-between items-start border-b border-slate-800 pb-3"> <div> <div className="font-bold text-white text-lg flex items-center gap-2"> {record.profession} {record.isWin && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/50">勝利</span>} </div> <div className="text-xs text-slate-500">{record.date}</div> </div> <div className="text-right"> <div className="text-sm text-slate-400">總積分</div> <div className="text-2xl font-black text-emerald-400">{record.finalScore}</div> </div> </div> <div className="grid grid-cols-2 gap-2 text-sm"> <div className="flex justify-between p-2 bg-slate-800 rounded"> <span className="text-slate-400">幸福指數</span> <span className="text-pink-400 font-bold">{record.happinessScore}</span> </div> <div className="flex justify-between p-2 bg-slate-800 rounded"> <span className="text-slate-400">資產收入</span> <span className="text-emerald-400 font-mono">{formatMoney(record.financialSummary.passiveIncome)}</span> </div> <div className="flex justify-between p-2 bg-slate-800 rounded"> <span className="text-slate-400">總資產</span> <span className="text-blue-400 font-mono">{formatMoney(record.financialSummary.totalAssets)}</span> </div> <div className="flex justify-between p-2 bg-slate-800 rounded"> <span className="text-slate-400">總支出</span> <span className="text-rose-400 font-mono">{formatMoney(record.financialSummary.totalExpenses)}</span> </div> </div> </Card> )) )}
              </div>
          </div>
      );
  }

  if (currentView === 'create_report') {
      const today = new Date(); const dateStr = `${today.getFullYear()}/${(today.getMonth()+1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}`;
      return (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
              <Card className="max-w-lg w-full bg-slate-900 border-slate-700 shadow-2xl p-8 animate-in zoom-in-95">
                  <div className="mb-6 border-b border-slate-800 pb-4"> <h2 className="text-2xl font-bold text-white flex items-center gap-3"> <FileText className="text-emerald-400" /> 新增財務報表 </h2> <p className="text-slate-400 text-sm mt-1">設定您的報表基本資訊以開始遊戲</p> </div>
                  <div className="space-y-6">
                      <div> <label className="text-sm font-bold text-slate-300 mb-2 block flex items-center gap-2"> <FileText size={16} /> 報表名稱 </label> <Input placeholder="例如: 週末聚會第一局" value={inputReportName} onChange={e => { setInputReportName(e.target.value); if (formError) setFormError(''); }} autoFocus /> </div>
                      <div> <label className="text-sm font-bold text-slate-300 mb-2 block flex items-center gap-2"> <User size={16} /> 玩家名稱 </label> <div className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-bold"> {user?.name || 'Guest'} </div> </div>
                      <div> <label className="text-sm font-bold text-slate-300 mb-2 block flex items-center gap-2"> <Calendar size={16} /> 建立日期 (自動) </label> <div className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-400 font-mono"> {dateStr} </div> </div>
                      <div className="pt-4 flex flex-col gap-3"> {formError && ( <div className="bg-rose-900/30 border border-rose-500/30 text-rose-400 text-sm p-3 rounded-lg flex items-center justify-center gap-2 animate-pulse"> <AlertCircle size={16} /> {formError} </div> )} <div className="flex gap-3"> <Button variant="secondary" onClick={() => setCurrentView('lobby')} className="flex-1"> 取消 </Button> <Button onClick={handleCreateReport} className="flex-1 py-3 text-lg"> 下一步：選擇職業 <ArrowRight size={18} /> </Button> </div> </div>
                  </div>
              </Card>
          </div>
      )
  }

  if (currentView === 'profession_select') {
      return (
          <SelectionCarousel
              title="選擇職業"
              subtitle="請選擇一個職業"
              btnLabel="確認選擇並前往：選擇企業"
              items={PROFESSIONS}
              selectedId={selectedProfessionId}
              onSelect={setSelectedProfessionId}
              onNext={() => setCurrentView('enterprise_select')}
              sessionMeta={sessionMeta}
              shape="circle"
              renderItem={(p: Profession, isSelected: boolean) => (
                  <>
                      <div className={`shrink-0 w-24 h-24 rounded-full flex items-center justify-center border-4 transition-colors duration-300 ${isSelected ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-lg' : 'bg-slate-800 border-slate-600 text-slate-500'}`}> {getProfessionIcon(p.id, { size: 56 })} </div>
                      <div className="space-y-1"> <div className="text-sm text-white font-black tracking-widest">{p.initialRank}</div> <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">{p.title}</div> </div>
                  </>
              )}
          />
      );
  }

  if (currentView === 'enterprise_select') {
      return (
          <SelectionCarousel 
              title="選擇企業" 
              headerText="請選擇適合的企業" 
              subtitle="請選擇心儀的企業" 
              btnLabel="確認選擇並前往：選擇夢想" 
              items={ENTERPRISES} 
              selectedId={selectedEnterpriseId} 
              onSelect={setSelectedEnterpriseId} 
              onNext={() => setCurrentView('dream_select')} 
              sessionMeta={sessionMeta}
              showSliderPrompt={true} 
              renderItem={(e: Enterprise, isSelected: boolean) => {
                  const relatedProf = PROFESSIONS.find(p => p.id === e.relatedProfessionId)?.title || '未知';
                  return (
                      <>
                        <div className={`shrink-0 w-20 h-20 rounded-full flex items-center justify-center border-4 transition-colors duration-300 ${isSelected ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'bg-slate-800 border-slate-600 text-slate-500'}`}> {getEnterpriseIcon(e.id, { size: 40 })} </div>
                        <h3 className="text-xl font-bold text-white flex flex-col gap-1"> <span>{e.name}</span> <span className="text-sm font-mono text-slate-500">{e.id}</span> </h3>
                        <div className="w-full bg-slate-800/50 rounded-xl p-4 flex flex-col gap-3 border border-slate-700/50 text-sm">
                            <div className="flex justify-between"> <span className="text-slate-400">投資金額</span> <span className="text-emerald-400 font-mono">{formatMoney(e.cost)}</span> </div>
                            <div className="flex justify-between"> <span className="text-slate-400">月收入增加</span> <span className="text-emerald-400 font-mono">+{formatMoney(e.income)}</span> </div>
                            <div className="border-t border-slate-700 pt-2 mt-1 space-y-1">
                                <div className="text-xs text-slate-500">相關職業加成</div>
                                <div className="text-blue-300 font-bold">{relatedProf}</div>
                                <div className="text-blue-400 text-xs">
                                    <div>月收入增加 10~50%</div>
                                    <div>(根據職業等級)</div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-2"> <span className="text-slate-400">幸福點數</span> <span className="text-pink-400 font-bold">+{e.happyPoints}</span> </div>
                        </div>
                      </>
                  );
              }}
          />
      );
  }

  if (currentView === 'dream_select') {
    return (
        <SelectionCarousel
            title="選擇夢想"
            headerText="請選擇心儀的夢想"
            subtitle="請選擇您的夢想"
            btnLabel="確認選擇並開始遊戲"
            items={DREAMS}
            selectedId={selectedDreamId}
            onSelect={setSelectedDreamId}
            onNext={finalizeSetup}
            sessionMeta={sessionMeta}
            renderItem={(d: Dream, isSelected: boolean) => (
                <>
                  <div className={`shrink-0 w-20 h-20 rounded-full flex items-center justify-center border-4 transition-colors duration-300 ${isSelected ? 'bg-purple-500/10 border-purple-500 text-purple-500' : 'bg-slate-800 border-slate-600 text-slate-500'}`}> {getDreamIcon(d.id, { size: 40 })} </div>
                  <h3 className="text-xl font-bold text-white flex flex-col gap-1"> <span>{d.name}</span> <span className="text-sm font-mono text-slate-500">{d.id}</span> </h3>
                  {d.description && <p className="text-slate-400 text-sm italic">{d.description}</p>}
                  <div className="w-full bg-slate-800/50 rounded-xl p-4 flex flex-col gap-3 border border-slate-700/50 text-sm mt-4">
                      <div className="flex justify-between"> <span className="text-slate-400">花費</span> <span className="text-rose-400 font-mono">{formatMoney(d.cost)}</span> </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-700 mt-2"> <span className="text-slate-400">幸福點數</span> <span className="text-pink-400 font-bold">+{d.happyPoints}</span> </div>
                  </div>
                </>
            )}
        />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20 overflow-x-hidden animate-in fade-in duration-500">
      {/* 店內 Alert - 修正位置至按鈕上方 (符合第 7 點) */}
      {alertInfo && (
        <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-4 border ${
          alertInfo.type === 'error' ? 'bg-rose-900 border-rose-500 text-rose-100' : 
          alertInfo.type === 'success' ? 'bg-emerald-900 border-emerald-500 text-emerald-100' : 
          'bg-slate-800 border-slate-600 text-white'
        }`}>
          {alertInfo.type === 'error' ? <AlertCircle size={18} /> : alertInfo.type === 'success' ? <CheckCircle2 size={18} /> : <Bell size={18} />}
          <span className="font-bold">{alertInfo.message}</span>
        </div>
      )}

      {/* 無保險警示 - 視窗中央排版優化 */}
      {showNoInsuranceAlert && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <Card className="w-full max-sm bg-slate-900 border-rose-600 shadow-rose-900/20 shadow-2xl animate-in zoom-in-95 p-8 text-center">
                  <div className="w-20 h-20 bg-rose-900/30 rounded-full flex items-center justify-center mx-auto text-rose-500 mb-6 border-2 border-rose-500/30">
                      <AlertCircle size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2">無法申請理賠</h3>
                  <p className="text-slate-400 mb-8 leading-relaxed">
                      您目前尚未持有任何醫療保險。<br/>
                      請先透過交易功能購買保險，<br/>
                      才能在發生意外時獲得經濟補償。
                  </p>
                  <Button variant="secondary" className="w-full py-3 font-bold" onClick={() => setShowNoInsuranceAlert(false)}>
                      了解
                  </Button>
              </Card>
          </div>
      )}

      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-yellow-500 to-amber-600 p-2 rounded-lg text-black shadow-lg shadow-yellow-500/20 cursor-pointer hover:scale-105 transition-transform" onClick={() => setShowRankListModal(true)}> {gameState.profession ? getProfessionIcon(gameState.profession.id) : <Wallet size={24} />} </div>
            <div>
              <h1 className="font-bold text-white hidden sm:block">蜂富人生</h1>
              <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap"> <div className="flex flex-col items-start justify-center gap-0.5 leading-none"> {renderStars(gameState.currentRankLevel)} <span className="text-white font-bold text-[10px] flex items-center gap-1"> {gameState.currentRankTitle} </span> </div> </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
             <div className={`relative transition-all duration-300 ${hasAircraft ? 'cursor-pointer hover:scale-110' : 'opacity-30 grayscale'}`} onTouchStart={() => hasAircraft && setShowAircraftTooltip(true)} onTouchEnd={() => hasAircraft && setShowAircraftTooltip(false)} onMouseDown={() => hasAircraft && setShowAircraftTooltip(true)} onMouseUp={() => hasAircraft && setShowAircraftTooltip(false)} onMouseLeave={() => hasAircraft && setShowAircraftTooltip(false)} onClick={() => hasAircraft && setShowAircraftTooltip(!showAircraftTooltip)}>
                  <div className={`p-2 rounded-lg shadow-lg transition-colors ${hasAircraft ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-slate-800 text-slate-500'}`}> <Plane size={16} /> </div>
                  {showAircraftTooltip && hasAircraft && ( <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-32 bg-slate-800 text-white text-[10px] p-2 rounded border border-slate-600 z-50 shadow-xl animate-in fade-in zoom-in-95 pointer-events-none"> 遊玩時可擲兩顆骰子 </div> )}
             </div>
             <Button onClick={() => setShowPromotionModal(true)} className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-2 shadow-lg shadow-purple-900/20 z-50"> <GraduationCap size={16} /> 升等考試 </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 pt-20">
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 relative overflow-hidden bg-slate-900 border-slate-700 cursor-pointer hover:border-pink-500/50 transition-all group min-h-[140px]" onClick={() => setShowHappinessModal(true)}>
                <div className="relative z-10 flex flex-col justify-between h-full"> <div> <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2"> 幸福指數 </h3> <div className="text-5xl font-black text-white tracking-tighter mb-2"> {gameState.happinessTotal} </div> <div className="w-32 bg-slate-800 h-1.5 rounded-full overflow-hidden"> <div className="h-full bg-pink-500 transition-all duration-1000" style={{ width: `${Math.min((gameState.happinessTotal / 100) * 100, 100)}%` }} /> </div> </div> <div className="text-[10px] text-slate-500 font-mono mt-2"> 目標: 100點 </div> </div>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2"> <div className="relative w-16 h-16"> <Heart size={64} className="text-slate-600 absolute inset-0 z-10" strokeWidth={1.5} /> <div className="absolute bottom-0 left-0 w-full overflow-hidden transition-all duration-1000 ease-out z-0" style={{ height: `${Math.min((gameState.happinessTotal / 100) * 100, 100)}%` }}> <div className="absolute bottom-0 left-0 w-16 h-16"> <Heart size={64} className="text-pink-500 fill-pink-500" strokeWidth={1.5} /> </div> </div> </div> <span className="text-[10px] font-bold text-pink-500 font-mono"> 達成率: {Math.min((gameState.happinessTotal / 100) * 100, 100).toFixed(0)}% </span> </div>
            </Card>
            <Card className="p-4 bg-slate-900 border-slate-700">
                <div className="grid grid-cols-2 gap-4 h-full">
                    <div className="flex flex-col justify-between border-r border-slate-800 pr-2"> 
                        <div>
                            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">現金</h3> 
                            <div className="text-xl sm:text-2xl font-black text-white truncate"> {formatMoney(gameState.cash)} </div> 
                        </div>
                        <div className="mt-2 border-t border-slate-800 pt-2">
                            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">資產收入</h3>
                            <div className="text-xl sm:text-2xl font-black text-emerald-400 truncate">+{formatMoney(summary.passiveIncome)}</div>
                        </div>
                    </div>
                    <div className="flex flex-col justify-between pl-2"> 
                        <div>
                            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">月損益</h3> 
                            <div className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 truncate"> {summary.monthlyCashflow >= 0 ? ( <span className="text-emerald-400">+{formatMoney(summary.monthlyCashflow)}</span> ) : ( <span className="text-rose-400">-{formatMoney(Math.abs(summary.monthlyCashflow))}</span> )} </div> 
                        </div>
                        <div className="mt-2 border-t border-slate-800 pt-2">
                            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">權益</h3>
                            <div className="text-xl sm:text-2xl font-black text-blue-400 truncate">{formatMoney(summary.totalAssets - summary.totalLiabilities)}</div>
                        </div>
                    </div> 
                </div>
            </Card>
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300"> 
                <FinancialStatement 
                    gameState={gameState} 
                    summary={summary} 
                    onShowAlert={showAlert}
                    onRemoveAsset={(id) => { const asset = gameState.assets.find(a => a.id === id); if(asset) { showAlert(`請使用「+」功能中的「賣出資產」來出售 ${asset.name}`, 'info'); } }} 
                    onRepayLiability={() => showAlert("請使用「+」功能中的「借貸/還款」來記錄還款。", 'info')} 
                    onDeleteTransaction={handleDeleteTransactionRecord}
                /> 
            </div>
        </div>
        <div className="hidden lg:block space-y-6 h-[600px]"> <HappinessPanel items={gameState.happiness} total={gameState.happinessTotal} onToggle={handleToggleHappiness} onAddCustomItem={handleAddHappinessItem} onRemoveCustomItem={handleRemoveHappinessItem} /> </div>
      </main>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
          <button onClick={handleMedicalClaim} className="w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border-4 border-slate-900" title="醫療理賠"> <Ambulance size={24} strokeWidth={2} /> </button>
          <button onClick={() => setShowTransactionModal(true)} className="w-16 h-16 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border-4 border-slate-900"> <Plus size={32} strokeWidth={3} /> </button>
          <button onClick={() => setShowPaydayModal(true)} className="w-12 h-12 bg-yellow-600 hover:bg-yellow-500 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border-4 border-slate-900" title="領取月損益"> <DollarSign size={24} strokeWidth={3} /> </button>
      </div>

      <div className="fixed bottom-4 right-4 z-40">
        <Button
          variant="secondary"
          onClick={handleFinishGame}
          className="bg-slate-800 border border-slate-700 shadow-xl"
        >
          <Trophy size={16} /> 結束遊戲
        </Button>
      </div>

      {showTransactionModal && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"> <TransactionForm profession={gameState.profession} selectedEnterprise={gameState.selectedEnterprise} selectedDream={gameState.selectedDream} cash={gameState.cash} salary={gameState.profession?.salary || 0} assets={gameState.assets} happiness={gameState.happiness} liabilities={gameState.liabilities.concat(gameState.loans > 0 ? [{id: 'bank_loan', name: '信用貸款 (Legacy)', totalOwed: gameState.loans, monthlyPayment: gameState.loans*0.1, type: '信用貸款'}] : [])} onTransaction={handleTransactionSubmit} onCancel={() => setShowTransactionModal(false)} /> </div> )}
      
      {showPaydayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <Card className="w-full max-sm bg-slate-900 border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 p-6 text-center">
                  <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto text-yellow-400 mb-4"> <DollarSign size={32} /> </div>
                  <h3 className="text-xl font-bold text-white mb-2">{summary.monthlyCashflow >= 0 ? '領取月結餘' : '支付月損益'}</h3>
                  <p className="text-slate-400 mb-4">{summary.monthlyCashflow >= 0 ? '確認領取本月現金流？' : '需支付月損益給銀行，是否確認支付？'}</p>
                  <div className={`text-3xl font-black font-mono mb-6 ${summary.monthlyCashflow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}> {summary.monthlyCashflow >= 0 ? '+' : ''}{formatMoney(summary.monthlyCashflow)} </div>
                  <div className="flex gap-3"> <Button variant="secondary" className="flex-1" onClick={() => setShowPaydayModal(false)}> 取消 </Button> <Button className={`flex-1 text-white ${summary.monthlyCashflow >= 0 ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-rose-600 hover:bg-rose-500'}`} onClick={handlePaydayConfirm}> 確認{summary.monthlyCashflow >= 0 ? '領取' : '支付'} </Button> </div>
              </Card>
          </div>
      )}

      {showMedicalClaimModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <Card className="w-full max-sm bg-slate-900 border-blue-600 shadow-blue-900/20 shadow-2xl animate-in zoom-in-95 p-6 text-center">
                  <div className="w-20 h-20 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-400 mb-6 border-2 border-blue-500/30"> <Ambulance size={40} /> </div>
                  <h3 className="text-2xl font-bold text-white mb-4">醫療理賠申請</h3>
                  <div className="space-y-3 mb-8">
                      <div className="flex justify-between text-slate-400 bg-slate-800/50 p-2 rounded"> <span>持有醫療保險張數:</span> <span className="text-white font-bold">{gameState.medicalInsuranceCount} 張</span> </div>
                      <div className="flex justify-between text-slate-400 bg-slate-800/50 p-2 rounded"> <span>預計獲得理賠總額:</span> <span className="text-emerald-400 font-black">{formatMoney(gameState.medicalInsuranceCount * 50000)}</span> </div>
                  </div>
                  <div className="flex gap-3"> <Button variant="secondary" className="flex-1" onClick={() => setShowMedicalClaimModal(false)}> 取消 </Button> <Button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold" onClick={confirmMedicalClaim}> 確認申請 </Button> </div>
              </Card>
          </div>
      )}

      {showRankListModal && gameState.profession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => { if(e.target === e.currentTarget) setShowRankListModal(false); }}>
              <Card className="w-full max-w-xs bg-slate-900 border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 p-6">
                  <div className="text-center mb-4"> <h3 className="text-xl font-bold text-white mb-1">{gameState.profession.title}</h3> <p className="text-slate-400 text-xs">職業等級一覽</p> </div>
                  <div className="space-y-2 relative">
                      <div className={`relative px-4 p-2 rounded transition-colors ${gameState.currentRankTitle === gameState.profession.initialRank ? 'bg-emerald-900/30 border border-emerald-500/50' : ''}`}>
                          <span className={`text-sm ${gameState.currentRankTitle === gameState.profession.initialRank ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}> LV1 {gameState.profession.initialRank} </span>
                      </div>
                      {gameState.profession.promotions.map((p, idx) => {
                          const isCurrent = gameState.currentRankTitle === p.rankTitle;
                          return (
                              <div key={idx} className={`relative px-4 p-2 rounded transition-colors ${isCurrent ? 'bg-emerald-900/30 border border-emerald-500/50' : ''}`}>
                                  <span className={`text-sm ${isCurrent ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}> LV{idx + 2} {p.rankTitle} </span>
                              </div>
                          );
                      })}
                  </div>
                  <Button variant="secondary" className="w-full mt-6" onClick={() => setShowRankListModal(false)}> 關閉 </Button>
              </Card>
          </div>
      )}

      {showPromotionModal && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"> <Card className="max-w-xs w-full bg-slate-900 border-slate-700 shadow-2xl animate-in fade-in zoom-in-95"> <div className="p-6 text-center space-y-4"> <div className="w-16 h-16 bg-purple-900/30 rounded-full flex items-center justify-center mx-auto text-purple-400"> <GraduationCap size={32} /> </div> <div> <h3 className="text-xl font-bold text-white">參加升等考試</h3> <p className="text-slate-400 mt-2 text-sm">報名需支付考試費用</p> <p className="text-emerald-400 font-bold font-mono text-xl mt-1">1,000 H</p> </div> <div className="flex gap-3 pt-2"> <Button variant="secondary" onClick={() => setShowPromotionModal(false)} className="flex-1"> 取消 </Button> <Button onClick={handlePromotionConfirm} className="flex-1 bg-purple-600 hover:bg-purple-500"> 確認報名 </Button> </div> </div> </Card> </div> )}
      {showMaxLevelModal && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"> <Card className="max-w-xs w-full bg-slate-900 border-slate-700 shadow-2xl animate-in fade-in zoom-in-95"> <div className="p-6 text-center space-y-4"> <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto text-yellow-400"> <Award size={32} /> </div> <div> <h3 className="text-xl font-bold text-white">恭喜！</h3> <p className="text-slate-300 mt-2">職業等級已為最高等</p> <p className="text-slate-400 text-sm mt-1">無需再進行考試</p> </div> <Button onClick={() => setShowMaxLevelModal(false)} className="w-full mt-2"> 太棒了 </Button> </div> </Card> </div> )}
      {showDiceModal && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"> <div className="flex flex-col items-center gap-6 animate-in zoom-in duration-300"> <h2 className="text-2xl font-black text-white uppercase tracking-widest text-center"> {isRolling ? '考試進行中...' : examResult === 'idle' ? '點擊骰子開始考試' : examResult === 'success' ? '考試通過！' : '考試失敗'} </h2> <div onClick={handleDiceRoll} className={`cursor-pointer transition-transform ${isRolling ? 'scale-90' : 'hover:scale-105 active:scale-95'}`}> <div className="relative"> <DiceFace value={diceValue} rolling={isRolling} /> {!isRolling && examResult === 'idle' && ( <div className="absolute inset-0 flex items-center justify-center pointer-events-none"> <div className="bg-black/50 rounded-full p-2 animate-pulse"> <Dices className="text-white" size={32} /> </div> </div> )} </div> </div> {examResult !== 'idle' && examLog && ( <div className="text-center space-y-2 animate-in slide-in-from-bottom-4"> <p className="text-slate-400"> 目標點數: <span className="font-bold text-white">{examLog.target}</span> | 你的點數: <span className={`font-bold ${examResult === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{diceValue}</span> </p> {examResult === 'success' && ( <div className="bg-emerald-900/30 border border-emerald-500/30 p-4 rounded-xl mt-4"> <p className="text-emerald-400 font-bold text-lg">晉升成功！</p> <p className="text-white">職稱: {examLog.newTitle}</p> <p className="text-emerald-300 font-mono">勞務收入 +{formatMoney(examLog.bonus)}</p> </div> )} {examResult === 'failure' && ( <div className="bg-rose-900/30 border border-rose-500/30 p-4 rounded-xl mt-4"> <p className="text-rose-400 font-bold">下次再接再利！</p> <p className="text-xs text-slate-400 mt-1">考試費用已扣除</p> </div> )} <Button className="mt-6 w-full" variant={examResult === 'success' ? 'primary' : 'secondary'} onClick={() => setShowDiceModal(false)}> {examResult === 'success' ? '太棒了！' : '關閉'} </Button> </div> )} </div> </div> )}
      {showHappinessModal && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => { if(e.target === e.currentTarget) setShowHappinessModal(false); }}> <div className="w-full max-md bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]"> <div className="p-3 bg-slate-800 flex justify-between items-center border-b border-slate-700 shrink-0"> <h3 className="font-bold text-white flex items-center gap-2"> <Heart className="text-pink-400 fill-pink-400" size={18} /> 幸福指數清單 </h3> <button onClick={() => setShowHappinessModal(false)} className="text-slate-400 hover:text-white"> <X size={20} /> </button> </div> <div className="flex-1 overflow-y-auto"> <HappinessPanel items={gameState.happiness} total={gameState.happinessTotal} onToggle={handleToggleHappiness} onAddCustomItem={handleAddHappinessItem} onRemoveCustomItem={handleRemoveHappinessItem} /> </div> <div className="p-3 bg-slate-800 border-t border-slate-700 text-center shrink-0"> <p className="text-xs text-slate-400 mb-2">達成 100 點即可獲得勝利</p> <Button variant="secondary" onClick={() => setShowHappinessModal(false)} className="w-full">關閉</Button> </div> </div> </div> )}
      
      {showSettlementConfirm && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={(e) => { if(e.target === e.currentTarget) setShowSettlementConfirm(false); }}> <Card className="w-full max-sm bg-slate-900 border-slate-700 shadow-2xl animate-in zoom-in-95 p-6 text-center"> <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" /> <h3 className="text-xl font-bold text-white mb-2">確認結算</h3> <p className="text-slate-400 mb-6">您確定要結束遊戲並進行結算嗎？</p> <div className="flex gap-3"> <Button variant="secondary" className="flex-1" onClick={() => setShowSettlementConfirm(false)}>取消</Button> <Button className="flex-1 bg-yellow-600 hover:bg-yellow-500" onClick={confirmToScorePage}>確認</Button> </div> </Card> </div> )}

      {showSettlementModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
            <div className="max-w-lg w-full h-full max-h-[90vh] flex flex-col py-4 overflow-hidden no-scrollbar">
                <Card className="bg-slate-900 border-emerald-500 shadow-2xl shadow-emerald-500/10 flex flex-col overflow-hidden animate-in zoom-in-95 no-scrollbar">
                    <div className="shrink-0 p-6 bg-emerald-900/20 border-b border-emerald-500/30 text-center">
                        <Trophy size={40} className="mx-auto text-yellow-400 mb-2" />
                        <h2 className="text-2xl font-black text-white">遊戲結算評分</h2>
                        <p className="text-emerald-400 font-mono text-xs mt-1">玩家: {sessionMeta.playerName}</p>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none no-scrollbar">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">最終總積分</p>
                                <div className="text-5xl font-black text-white">{scoreResult.totalScore}</div>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">幸福指數</p>
                                <div className="text-3xl font-black text-pink-500">{gameState.happinessTotal}</div>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                                <List size={14} className="text-emerald-400" /> 積分細項
                            </h3>
                            <div className="space-y-2">
                                {scoreResult.details.map((detail, idx) => (
                                    <div key={idx} className={`flex justify-between items-center text-xs py-2 border-b border-slate-700/50 last:border-0 ${detail.achieved ? 'text-slate-300' : 'text-slate-600'}`}>
                                        <div className="flex items-center gap-2">
                                            {detail.achieved ? (
                                              <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                                <Check size={10} className="text-emerald-500" />
                                              </div>
                                            ) : (
                                              <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                                <X size={10} className="text-slate-700" />
                                              </div>
                                            )}
                                            {detail.label}
                                        </div>
                                        <span className={`font-bold ${detail.achieved ? 'text-emerald-400' : 'text-slate-700'}`}>+{detail.points}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">資產收入</p>
                                <p className="text-base font-black text-emerald-400">{formatMoney(summary.passiveIncome)}</p>
                            </div>
                            <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">總資產</p>
                                <p className="text-base font-black text-blue-400">{formatMoney(summary.totalAssets)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 p-4 bg-slate-900 border-t border-slate-800">
                        <Button className="w-full py-3 text-lg font-black bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-600/20" onClick={confirmFinishGame}>
                            確認並存檔
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
      )}

    </div>
  );
};

export default App;

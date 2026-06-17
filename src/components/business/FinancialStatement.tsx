import React, { useState, useEffect, useRef } from 'react';
import { GameState, FinancialSummary, Asset } from '../../types';
import { STOCK_NAMES, REAL_ESTATE_PRESETS } from '../../constants';
import { TrendingUp, Building, ChevronDown, ShieldCheck, ArrowUpCircle, ExternalLink, Wallet, Landmark, BarChart3, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { HistoryTable } from './HistoryTable';
import { CashFlowLog } from './CashFlowLog';
import { BizUpgradeModal } from '../modals/BizUpgradeModal';
import { HouseConversionModal } from '../modals/HouseConversionModal';
import { cn } from '../../utils/gameUtils';
import { useGame } from '../../context/GameContext';

interface FinancialStatementProps {
  gameState: GameState;
  summary: FinancialSummary;
  onShowAlert?: (message: string, type: 'info' | 'error' | 'success', persist?: boolean) => void;
  onDeleteTransaction?: (id: string) => void;
  onUpgradeBiz?: (assetId: string, diceRoll: number) => void;
  hideSummary?: boolean;
  defaultShowDetails?: boolean;
  hideNav?: boolean;
  isMasked?: boolean;
  disabled?: boolean;
  showDashboard?: boolean;
}

const formatMoney = (amount: number, isMasked?: boolean) => {
  if (isMasked) return '**** H';
  return `${amount.toLocaleString()} H`;
};

const reHouseTypeMap: Record<string, string> = {
  '1room': '單間小套房',
  '2room': '兩房一廳',
  '3room': '三房兩廳',
  '5room': '五房三廳',
  'store': '店面'
};

const getAssetDisplayName = (asset: Asset) => {
  if (asset.type === '不動產' && asset.houseType) {
    const symbolMatch = asset.name.match(/[A-Z]\d+/);
    const symbol = symbolMatch ? symbolMatch[0] : asset.name;
    return `${symbol} (${reHouseTypeMap[asset.houseType] || asset.houseType})`;
  }
  if (asset.type === '企業') {
    const match = asset.name.match(/[A-Z]\d+/);

    // 如果沒有代號（目標企業），直接顯示企業名稱，移除「企業」前綴
    if (!match) {
      const enterpriseName = asset.name.replace(/^企業\s*/, '');
      return <span className="text-slate-200">{enterpriseName}</span>;
    }

    // 有代號的企業（N056, N058等），顯示代號和類型標籤
    const symbol = match[0];
    const isPartTime = (symbol === 'N056' || symbol === 'N058') && !asset.isUpgraded;
    const bizTypeLabel = isPartTime ? '兼職工作室' : (asset.isUpgraded ? '小型企業' : '優質企業');
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-slate-200">{symbol}</span>
        <span className={cn(
          "text-[9px] font-bold px-1 rounded-sm",
          isPartTime ? "bg-amber-900/30 text-amber-500/80" : "bg-emerald-900/30 text-emerald-500/80"
        )}>
          {bizTypeLabel}
        </span>
      </div>
    );
  }
  if (asset.type === '股票') {
    const match = asset.name.match(/([A-Z]\d+)/);
    const symbol = match ? match[1] : asset.name;
    const stockName = STOCK_NAMES[symbol] || '';
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-slate-200">{symbol}</span>
        {stockName && <span className="text-[10px] text-slate-500 font-medium">{stockName}</span>}
      </div>
    );
  }
  return asset.name;
};

// Animated numerical value with flash effect
const NumericalValue: React.FC<{ value: number, colorClass?: string, prefix?: string, isMasked?: boolean }> = ({ value, colorClass = "text-white text-[11px]", prefix = "", isMasked = false }) => {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (isMasked) return;
    if (prevValue.current < value) {
      setFlash('up');
      const timer = setTimeout(() => setFlash(null), 800);
      prevValue.current = value;
      return () => clearTimeout(timer);
    } else if (prevValue.current > value) {
      setFlash('down');
      const timer = setTimeout(() => setFlash(null), 800);
      prevValue.current = value;
      return () => clearTimeout(timer);
    }
  }, [value, isMasked]);

  return (
    <span className={cn(
      "font-mono transition-all duration-300 inline-block",
      flash === 'up' ? "text-emerald-400 scale-110 font-bold" :
        flash === 'down' ? "text-rose-400 scale-110 font-bold" : colorClass
    )}>
      {prefix}{formatMoney(value, isMasked)}
    </span>
  );
};

export const FinancialStatement: React.FC<FinancialStatementProps> = ({
  gameState,
  summary,
  onShowAlert,
  onDeleteTransaction,
  onUpgradeBiz,
  hideSummary = false,
  defaultShowDetails = false,
  hideNav = false,
  isMasked = false,
  disabled = false,
  showDashboard = true,
}) => {
  const [view, setView] = useState<'financial' | 'cashflow' | 'history'>('financial');
  const [isIncomeOpen, setIsIncomeOpen] = useState(defaultShowDetails);
  const [isBalanceOpen, setIsBalanceOpen] = useState(defaultShowDetails);
  const [showFullDetails, setShowFullDetails] = useState(defaultShowDetails);
  const [upgradingAsset, setUpgradingAsset] = useState<Asset | null>(null);
  const [convertingHouse, setConvertingHouse] = useState<Asset | null>(null);

  const { setGameState } = useGame();

  const handleHouseConversion = (assetId: string, toSelfUse: boolean) => {
    setGameState(prev => {
      const updatedAssets = prev.assets.map(asset => {
        if (asset.id === assetId) {
          const symbolMatch = asset.name.match(/[A-Z]\d+/);
          const symbol = symbolMatch ? symbolMatch[0] : '';
          const preset = REAL_ESTATE_PRESETS[symbol];

          return {
            ...asset,
            isSelfUse: toSelfUse,
            cashflow: toSelfUse ? 0 : (preset?.cashflow || 0),
            conversionCount: (asset.conversionCount || 0) + 1
          };
        }
        return asset;
      });

      return {
        ...prev,
        assets: updatedAssets
      };
    });
  };

  const realEstate = (gameState.assets || []).filter(a => a.type === '不動產');
  const businesses = (gameState.assets || []).filter(a => a.type === '企業');
  const stocks = (gameState.assets || []).filter(a => a.type === '股票');

  // 合併定存項目
  const rawCds = (gameState.assets || []).filter(a => a.type === '定存');
  const cds: Asset[] = rawCds.length > 0 ? [{
    id: 'merged-cd',
    name: '定存總額',
    type: '定存',
    cost: rawCds.reduce((sum, a) => sum + a.cost, 0),
    downPayment: rawCds.reduce((sum, a) => sum + a.downPayment, 0),
    cashflow: rawCds.reduce((sum, a) => sum + a.cashflow, 0),
    isInsured: false
  }] : [];

  const creditLoans = (gameState.liabilities || []).filter(l => l.type === '信用貸款');
  const realEstateLoans = (gameState.liabilities || []).filter(l => l.type === '不動產貸款');
  const businessLoans = (gameState.liabilities || []).filter(l => l.type === '企業貸款');
  const aircraftLoans = (gameState.liabilities || []).filter(l => l.type === '飛行器貸款');

  const creditLoanInterest = ((gameState.liabilities || []).filter(l => l.type === '信用貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0)) + ((gameState.loans || 0) * 0.1);
  const realEstateLoanInterest = (gameState.liabilities || []).filter(l => l.type === '不動產貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
  const businessLoanInterest = (gameState.liabilities || []).filter(l => l.type === '企業貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
  const aircraftLoanInterest = (gameState.liabilities || []).filter(l => l.type === '飛行器貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);

  const totalMonthlyInterest = creditLoanInterest + realEstateLoanInterest + businessLoanInterest + aircraftLoanInterest;

  const medicalInsuranceCount = gameState.medicalInsuranceCount || 0;
  const houseInsuranceCount = (gameState.assets || []).filter(a => a.type === '不動產' && a.isInsured).length;
  const aircraftInsuranceCount = (gameState.assets || []).some(a => (a.type as any) === '飛行器' && a.isInsured) ? 1 : 0;

  const medicalInsCost = medicalInsuranceCount * 2000;
  const houseInsCost = houseInsuranceCount * 2000;
  const aircraftInsCost = aircraftInsuranceCount * 2000;

  const netAssets = summary.totalAssets - summary.totalLiabilities;

  return (
    <div className={cn("space-y-4 no-scrollbar", !hideNav && "pb-[100px]")}>
      {!hideNav && (
        <div className="space-y-4">
          {/* Asset Dashboard (Stats Bar) */}
          {showDashboard && (
            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
              {/* 現金 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-lg shadow-black/20">
                <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                  <Wallet size={16} className="text-blue-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter leading-none mb-1">現金</span>
                  <span className="text-sm font-black text-white leading-tight truncate">
                    <NumericalValue isMasked={isMasked} value={gameState.cash} colorClass="text-white" />
                  </span>
                </div>
              </div>

              {/* 理財收入 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-lg shadow-black/20">
                <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                  <Landmark size={16} className="text-emerald-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter leading-none mb-1">理財收入</span>
                  <span className="text-sm font-black text-emerald-400 leading-tight truncate">
                    <NumericalValue isMasked={isMasked} value={summary.passiveIncome} colorClass="text-emerald-400" prefix="+" />
                  </span>
                </div>
              </div>

              {/* 月結餘 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-lg shadow-black/20">
                <div className="p-2 bg-purple-500/10 rounded-lg shrink-0">
                  <BarChart3 size={16} className="text-purple-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter leading-none mb-1">月結餘</span>
                  <span className={cn(
                    "text-sm font-black leading-tight truncate",
                    summary.monthlyCashflow >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    <NumericalValue 
                      isMasked={isMasked} 
                      value={summary.monthlyCashflow} 
                      colorClass={summary.monthlyCashflow >= 0 ? "text-emerald-400" : "text-rose-400"} 
                      prefix={summary.monthlyCashflow >= 0 ? "+" : ""} 
                    />
                  </span>
                </div>
              </div>

              {/* 淨資產 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-lg shadow-black/20">
                <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
                  <PieChart size={16} className="text-amber-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter leading-none mb-1">淨資產</span>
                  <span className={cn(
                    "text-sm font-black leading-tight truncate",
                    netAssets >= 0 ? "text-blue-400" : "text-rose-400"
                  )}>
                    <NumericalValue 
                      isMasked={isMasked} 
                      value={netAssets} 
                      colorClass={netAssets >= 0 ? "text-blue-400" : "text-rose-400"} 
                    />
                  </span>
                </div>
              </div>
            </div>
          )}
      </div>
    )}

      {view === 'financial' && (
        <div className="space-y-6 animate-in fade-in duration-500">

          {/* Summary Panel */}
          {!hideSummary && (
            <section className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl overflow-hidden relative">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">財務摘要</h3>
                  {gameState.reportName && <p className="text-[10px] text-emerald-500 font-bold">{gameState.reportName}</p>}
                </div>
                <button
                  onClick={() => setShowFullDetails(!showFullDetails)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold transition-all border border-emerald-500/20"
                >
                  <ExternalLink size={12} />
                  {showFullDetails ? '隱藏詳情' : '顯示詳情'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/30">
                    <span className="text-[10px] font-bold text-emerald-500/80">總收入</span>
                    <NumericalValue isMasked={isMasked} value={summary.totalIncome} colorClass="text-emerald-400 text-xs font-black" />
                  </div>
                  <div className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/30">
                    <span className="text-[10px] font-bold text-orange-500/80">總支出</span>
                    <NumericalValue isMasked={isMasked} value={summary.totalExpenses} colorClass="text-orange-400 text-xs font-black" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/30">
                    <span className="text-[10px] font-bold text-blue-500/80">總資產</span>
                    <NumericalValue isMasked={isMasked} value={summary.totalAssets} colorClass="text-blue-400 text-xs font-black" />
                  </div>
                  <div className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/30">
                    <span className="text-[10px] font-bold text-rose-500/80">總負債</span>
                    <NumericalValue isMasked={isMasked} value={summary.totalLiabilities} colorClass="text-rose-400 text-xs font-black" />
                  </div>
                </div>
              </div>
            </section>
          )}

          {(showFullDetails || hideSummary) && (
            <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
              {/* Income Statement Panel */}
              <section className="group overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl shadow-2xl transition-all duration-500">
                <button
                  onClick={() => setIsIncomeOpen(!isIncomeOpen)}
                  className="w-full p-4 flex justify-between items-center bg-gradient-to-r from-slate-800/40 to-transparent hover:from-slate-800/60 transition-all border-b border-slate-700/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <TrendingUp size={18} />
                    </div>
                    <h3 className="font-black tracking-widest text-slate-100 uppercase text-sm">收入支出表</h3>
                  </div>
                  <ChevronDown className={cn("text-slate-500 transition-transform duration-300", isIncomeOpen ? "rotate-180" : "")} />
                </button>
                <div className={cn("transition-all duration-500 ease-in-out", isIncomeOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden")}>
                  <div className="grid grid-cols-2 gap-px bg-slate-700/30">
                    {/* Left: Income */}
                    <div className="p-4 bg-slate-900/20">
                      <div className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest mb-4 flex justify-between items-center gap-2">
                        <span className="shrink-0">收入項目</span>
                        <span className="shrink-0">金額</span>
                      </div>
                      <div className="space-y-4">
                        <TAccountItem
                          label="工作收入"
                          subLabel="(穩固的收入才是幸福人生的基礎)"
                          value={gameState.profession?.salary || 0}
                          color="text-emerald-400"
                          isMasked={isMasked}
                        />
                        <div className="pt-2 border-t border-slate-800/50 space-y-2">
                          <div className="text-xs text-slate-400 leading-tight break-all whitespace-nowrap text-left">理財收入</div>
                          {cds.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                              <div className="text-[9px] font-black uppercase tracking-widest text-orange-300 flex justify-between items-center">
                                <span>定存利息</span>
                                <span className="text-slate-500 font-normal lowercase">(利息0.5%)</span>
                              </div>
                              {cds.map(cd => <TAccountSubItem key={cd.id} label={getAssetDisplayName(cd)} value={cd.cashflow} isMasked={isMasked} />)}
                            </div>
                          )}
                          {businesses.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                              <div className="text-[9px] font-black uppercase tracking-widest text-purple-300">企業收益</div>
                              {businesses.map(b => <TAccountSubItem key={b.id} label={getAssetDisplayName(b)} value={b.cashflow} isMasked={isMasked} />)}
                            </div>
                          )}
                          {realEstate.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                              <div className="text-[9px] font-black uppercase tracking-widest text-blue-300">不動產租金</div>
                              {realEstate.filter(r => !r.isSelfUse && r.cashflow > 0).map(r => {
                                const symbolMatch = r.name.match(/[A-Z]\d+/);
                                const symbol = symbolMatch ? symbolMatch[0] : r.name;
                                let income = r.cashflow;
                                const abilityCount = gameState.abilities?.realEstateAbilityCount || 0;
                                const hasBonus = !r.isSelfUse && abilityCount > 0;
                                if (hasBonus) {
                                  income += 10000 * abilityCount;
                                }
                                return (
                                  <TAccountSubItem key={r.id} label={
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-slate-500 leading-tight">{symbol}</span>
                                      {hasBonus && (
                                        <span className="text-[8px] text-amber-500/80 font-bold">
                                          能力加成 +{10 * abilityCount}k {abilityCount > 1 && `(x${abilityCount})`}
                                        </span>
                                      )}
                                    </div>
                                  } value={income} isMasked={isMasked} />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Right: Expense */}
                    <div className="p-4 bg-slate-900/20">
                      <div className="text-[10px] font-black text-orange-500/70 uppercase tracking-widest mb-4 flex justify-between items-center gap-2">
                        <span className="shrink-0">支出項目</span>
                        <span className="shrink-0">金額</span>
                      </div>
                      <div className="space-y-3">
                        <TAccountItem label="餐飲、服飾、居住類" value={Math.max(0, (gameState.profession?.expenses.basicLiving || 0) + (gameState.expenses?.basicLiving || 0))} color="text-slate-300" isMasked={isMasked} />
                        <TAccountItem label="交通、教育、娛樂類" value={Math.max(0, (gameState.profession?.expenses.transportEdu || 0) + (gameState.expenses?.transportEdu || 0))} color="text-slate-300" isMasked={isMasked} />
                        <TAccountItem
                          label="其他、醫療、育兒類"
                          subLabel="(職等每提升一級，增加10000H)"
                          value={Math.max(0, (gameState.profession?.expenses.otherMedicalChild || 0) + (Math.max(0, gameState.currentRankLevel - 1) * 10000) + (gameState.expenses?.otherMedicalChild || 0))}
                          color="text-slate-300"
                          isMasked={isMasked}
                        />
                        <div className="pt-2 border-t border-slate-800/50 space-y-2">
                          <div className="text-xs text-slate-400 leading-tight break-all whitespace-nowrap text-left">保險支出</div>
                          {medicalInsCost > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                              <div className="text-[9px] font-black uppercase tracking-widest text-emerald-300">醫療保險</div>
                              <TAccountSubItem label={
                                <div className="flex items-center gap-1">
                                  <span>醫療保險</span>
                                  <span className="text-[9px] opacity-70">({gameState.medicalInsuranceCount}張)</span>
                                </div>
                              } value={medicalInsCost} isMasked={isMasked} />
                            </div>
                          )}
                          {houseInsCost > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                              <div className="text-[9px] font-black uppercase tracking-widest text-blue-300">房屋保險</div>
                              {(gameState.assets || []).filter(a => a.type === '不動產' && a.isInsured).map(house => (
                                <div key={house.id} className="flex items-center justify-between pl-2 border-l border-slate-700 mb-1">
                                  <span className="text-[10px] text-slate-500 leading-tight">
                                    {house.name.match(/[A-Z]\d+/)?.[0] || house.name}
                                  </span>
                                  <NumericalValue value={2000} colorClass="text-[12px] text-white" isMasked={isMasked} />
                                </div>
                              ))}
                            </div>
                          )}
                          {aircraftInsCost > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                              <div className="text-[9px] font-black uppercase tracking-widest text-yellow-300">飛行器保險</div>
                              <TAccountSubItem label="飛行器保險" value={aircraftInsCost} isMasked={isMasked} />
                            </div>
                          )}
                        </div>
                        <div className="pt-2 border-t border-slate-800/50 space-y-2">
                          <div className="text-xs text-slate-400 leading-tight break-all whitespace-nowrap text-left">貸款利息</div>
                          {(creditLoans.length > 0 || (gameState.loans || 0) > 0) && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                              <div className="text-[9px] font-black uppercase tracking-widest text-orange-300">信用貸款</div>
                              <TAccountSubItem label="信用貸款利息" value={creditLoans.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0)} isMasked={isMasked} />
                              {(gameState.loans || 0) > 0 && <TAccountSubItem label="銀行貸款利息" value={(gameState.loans || 0) * 0.1} isMasked={isMasked} />}
                            </div>
                          )}
                          {realEstateLoans.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                              <div className="text-[9px] font-black uppercase tracking-widest text-blue-300">不動產貸款</div>
                              {realEstateLoans.map(l => {
                                const loanSymbol = l.name.match(/\(([^)]+)\)/)?.[1] || l.name;
                                return (
                                  <TAccountSubItem key={l.id} label={
                                    <span className="text-[10px] text-slate-500 leading-tight">{loanSymbol}</span>
                                  } value={l.monthlyPayment} isMasked={isMasked} />
                                );
                              })}
                            </div>
                          )}
                          {businessLoans.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                              <div className="text-[9px] font-black uppercase tracking-widest text-purple-300">企業貸款</div>
                              {businessLoans.map(l => <TAccountSubItem key={l.id} label={l.name.match(/\(([^)]+)\)/)?.[1] || l.name} value={l.monthlyPayment} isMasked={isMasked} />)}
                            </div>
                          )}
                          {aircraftLoans.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                              <div className="text-[9px] font-black uppercase tracking-widest text-yellow-300">飛行器貸款利息</div>
                              {aircraftLoans.map(l => <TAccountSubItem key={l.id} label={l.name.match(/\(([^)]+)\)/)?.[1] || l.name} value={l.monthlyPayment} isMasked={isMasked} />)}
                            </div>
                          )}
                        </div>
                        <TAccountItem
                          label="所得稅務"
                          subLabel="(勞務收入x5%)"
                          value={Math.floor((gameState.profession?.salary || 0) * 0.05)}
                          color="text-slate-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Income Statement Footer: Always visible */}
                <div className="bg-slate-700/30 border-t border-slate-700/50">
                  <div className="grid grid-cols-2 gap-px">
                    <div className="p-3 bg-slate-800/40 flex justify-between items-center">
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">總收入</span>
                      <NumericalValue value={summary.totalIncome} colorClass="text-emerald-400 text-[11px] font-black" />
                    </div>
                    <div className="p-3 bg-slate-800/40 flex justify-between items-center">
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">總支出</span>
                      <NumericalValue value={summary.totalExpenses} colorClass="text-orange-400 text-[11px] font-black" />
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 flex justify-between items-center border-t border-slate-700/30">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">月結餘 (總收入-總支出)</span>
                    <NumericalValue
                      value={summary.monthlyCashflow}
                      colorClass={cn(
                        "text-xs font-black",
                        summary.monthlyCashflow >= 0 ? "text-emerald-400" : "text-orange-400"
                      )}
                      prefix={summary.monthlyCashflow >= 0 ? "+" : ""}
                    />
                  </div>
                </div>
              </section>

              {/* Balance Sheet Panel */}
              <section className="group overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl shadow-2xl transition-all duration-500">
                <button
                  onClick={() => setIsBalanceOpen(!isBalanceOpen)}
                  className="w-full p-4 flex justify-between items-center bg-gradient-to-r from-slate-800/40 to-transparent hover:from-slate-800/60 transition-all border-b border-slate-700/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <Building size={18} />
                    </div>
                    <h3 className="font-black tracking-widest text-slate-100 uppercase text-sm">資產負債表</h3>
                  </div>
                  <ChevronDown className={cn("text-slate-500 transition-transform duration-300", isBalanceOpen ? "rotate-180" : "")} />
                </button>
                <div className={cn("transition-all duration-500 ease-in-out", isBalanceOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden")}>
                  <div className="grid grid-cols-2 gap-px bg-slate-700/30">
                    {/* Left: Assets */}
                    <div className="p-4 bg-slate-900/20">
                      <div className="text-[10px] font-black text-blue-500/70 uppercase tracking-widest mb-4 flex justify-between items-center gap-2">
                        <span className="shrink-0">資產項目</span>
                        <span className="shrink-0">價值</span>
                      </div>
                      <div className="space-y-4">
                        <TAccountItem label="現金" value={gameState.cash || 0} color="text-emerald-400" />
                        {cds.length > 0 && <AssetCategoryList title="定存" items={cds} color="text-orange-300" disabled={disabled} />}
                        {stocks.length > 0 && <AssetCategoryList title="股票" items={stocks} color="text-yellow-300" isStock marketPrices={gameState.marketPrices || {}} previousMarketPrices={gameState.previousMarketPrices || {}} disabled={disabled} />}
                        {businesses.length > 0 && (
                          <AssetCategoryList
                            title="企業"
                            items={businesses}
                            color="text-emerald-300"
                            onUpgradeClick={setUpgradingAsset}
                            onShowAlert={onShowAlert}
                            disabled={disabled}
                          />
                        )}
                        {realEstate.length > 0 && <AssetCategoryList title="不動產" items={realEstate} color="text-blue-300" onShowAlert={onShowAlert} onHouseClick={setConvertingHouse} disabled={disabled} />}
                      </div>
                    </div>
                    {/* Right: Liabilities */}
                    <div className="p-4 bg-slate-900/20">
                      <div className="text-[10px] font-black text-rose-500/70 uppercase tracking-widest mb-4 flex justify-between items-center gap-2">
                        <span className="shrink-0">負債項目</span>
                        <span className="shrink-0">餘額</span>
                      </div>
                      <div className="space-y-4">
                        {(creditLoans.length > 0 || (gameState.loans || 0) > 0) && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                            <div className="text-[9px] font-black uppercase tracking-widest text-orange-300">信用貸款</div>
                            <TAccountSubItem label="信用貸款總額" value={creditLoans.reduce((sum, l) => sum + l.totalOwed, 0)} />
                            {(gameState.loans || 0) > 0 && <TAccountSubItem label="銀行貸款" value={gameState.loans || 0} />}
                          </div>
                        )}
                        {realEstateLoans.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                            <div className="text-[9px] font-black uppercase tracking-widest text-blue-300">不動產貸款</div>
                            {realEstateLoans.map(l => {
                              const loanSymbol = l.name.match(/\(([^)]+)\)/)?.[1] || l.name;
                              return (
                                <TAccountSubItem key={l.id} label={
                                  <span className="text-[10px] text-slate-500 leading-tight">{loanSymbol}</span>
                                } value={l.totalOwed} />
                              );
                            })}
                          </div>
                        )}
                        {businessLoans.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                            <div className="text-[9px] font-black uppercase tracking-widest text-purple-300">企業貸款</div>
                            {businessLoans.map(l => <TAccountSubItem key={l.id} label={l.name.match(/\(([^)]+)\)/)?.[1] || l.name} value={l.totalOwed} />)}
                          </div>
                        )}
                        {aircraftLoans.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                            <div className="text-[9px] font-black uppercase tracking-widest text-yellow-300">飛行器貸款</div>
                            {aircraftLoans.map(l => <TAccountSubItem key={l.id} label="飛行器" value={l.totalOwed} />)}
                          </div>
                        )}
                        {(gameState.liabilities || []).length === 0 && (gameState.loans || 0) === 0 && (
                          <div className="text-center py-8 text-slate-600 text-[10px] uppercase font-bold tracking-[0.2em] italic">
                            無任何負債
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balance Sheet Footer: Always visible */}
                <div className="bg-slate-700/30 border-t border-slate-700/50">
                  <div className="grid grid-cols-2 gap-px">
                    <div className="p-3 bg-slate-800/40 flex justify-between items-center">
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">總資產</span>
                      <NumericalValue value={summary.totalAssets} colorClass="text-blue-400 text-[11px] font-black" isMasked={isMasked} />
                    </div>
                    <div className="p-3 bg-slate-800/40 flex justify-between items-center">
                      <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">總負債</span>
                      <NumericalValue value={summary.totalLiabilities} colorClass="text-rose-400 text-[11px] font-black" isMasked={isMasked} />
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 flex justify-between items-center border-t border-slate-700/30">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">淨資產 (總資產-總負債)</span>
                    <NumericalValue
                      value={summary.totalAssets - summary.totalLiabilities}
                      colorClass={cn(
                        "text-xs font-black",
                        (summary.totalAssets - summary.totalLiabilities) >= 0 ? "text-blue-400" : "text-rose-400"
                      )}
                      isMasked={isMasked}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {view === 'cashflow' && <div className="animate-in fade-in zoom-in-95 duration-300"><CashFlowLog history={gameState.history || []} /></div>}
      {view === 'history' && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <HistoryTable
            history={gameState.history || []}
            onDeleteTransaction={onDeleteTransaction}
            disabled={disabled}
          />
        </div>
      )}

      {upgradingAsset && (
        <BizUpgradeModal
          isOpen={!!upgradingAsset}
          onClose={() => setUpgradingAsset(null)}
          asset={upgradingAsset}
          onUpgrade={(diceRoll) => {
            onUpgradeBiz?.(upgradingAsset.id, diceRoll);
          }}
        />
      )}

      {convertingHouse && (
        <HouseConversionModal
          isOpen={!!convertingHouse}
          onClose={() => setConvertingHouse(null)}
          asset={convertingHouse}
          onConvert={handleHouseConversion}
        />
      )}

      {/* 底部 Tab 切換 (藥丸式懸浮切換器) */}
      {!hideNav && (
        <div className="fixed bottom-[130px] left-0 right-0 z-[60] px-4 pointer-events-none flex justify-center">
          <div className="relative flex items-center bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-full border border-slate-700/60 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] pointer-events-auto">
            {[
              { id: 'financial', label: '報表' },
              { id: 'cashflow', label: '金流' },
              { id: 'history', label: '紀錄' }
            ].map((v) => {
              const isActive = view === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setView(v.id as any)}
                  className={cn(
                    "relative px-6 py-2.5 rounded-full text-xs font-black tracking-widest transition-colors z-10",
                    isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="pill-active-bg"
                      className="absolute inset-0 bg-emerald-600 rounded-full shadow-[0_0_15px_rgba(5,150,105,0.6)] -z-10"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-20">{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const TAccountItem = ({ label, subLabel, value, color = "text-white", isMasked = false }: { label: React.ReactNode, subLabel?: React.ReactNode, value: number, color?: string, isMasked?: boolean }) => (
  <div className="flex flex-col w-full py-0.5 gap-0.5">
    <span className="text-xs text-slate-400 leading-tight break-all whitespace-nowrap text-left">{label}</span>
    {subLabel && <span className="text-[10px] text-slate-500 leading-tight break-all whitespace-nowrap text-left">{subLabel}</span>}
    <div className="text-right"><NumericalValue value={value} colorClass={cn(color, "text-[14px]")} isMasked={isMasked} /></div>
  </div>
);

const TAccountSubItem = ({ label, value, isMasked = false }: { label: React.ReactNode, value: number, isMasked?: boolean }) => (
  <div className="flex flex-col pl-2 border-l border-slate-700 mb-2">
    <span className="text-[10px] text-slate-500 leading-tight break-all whitespace-normal mb-0.5">{label}</span>
    <div className="text-right"><NumericalValue value={value} colorClass="text-[14px] text-white" isMasked={isMasked} /></div>
  </div>
);

const AssetCategoryList = ({ title, items, color, isStock = false, marketPrices = {}, previousMarketPrices = {}, onUpgradeClick, onHouseClick, onShowAlert, isMasked = false, disabled = false }: any) => (
  <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
    <div className={cn("text-[9px] font-black uppercase tracking-widest", color)}>{title}</div>
    {items.map((item: any) => {
      // For stocks, try to get price from marketPrices using the ticker (e.g., "股票 A01" -> "A01")
      let currentPrice = item.lastPurchasePrice || Math.floor(item.cost / item.quantity);
      let ticker = null;
      if (isStock) {
        const tickerMatch = item.name.match(/[A-Z]\d+/);
        ticker = tickerMatch ? tickerMatch[0] : null;
        if (ticker && marketPrices[ticker]) {
          currentPrice = marketPrices[ticker];
        }
      }

      // For stocks, the value should be quantity * currentPrice
      const displayValue = isStock ? (item.quantity * currentPrice) : item.cost;

      // Check for upgrade eligibility (N056, N058 and not yet upgraded)
      const symbolMatch = item.name.match(/[A-Z]\d+/);
      const symbol = symbolMatch ? symbolMatch[0] : '';
      const isEligibleForUpgrade = item.type === '企業' && (symbol === 'N056' || symbol === 'N058') && !item.isUpgraded;

      return (
        <div key={item.id} className="flex flex-col gap-0.5 pl-2 border-l border-slate-800 mb-2">
          <div className="flex flex-col group/item">
            <div className="flex items-center gap-1 leading-tight flex-wrap whitespace-normal break-all mb-0.5">
              {item.type === '不動產' ? (
                <>
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-[11px] text-slate-200 font-bold">
                      {item.name.match(/[A-Z]\d+/)?.[0] || item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      ({reHouseTypeMap[item.houseType] || item.houseType})
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!disabled) onHouseClick?.(item);
                      }}
                      disabled={disabled}
                      className={cn(
                        "text-[9px] font-black px-1.5 py-0.5 rounded transition-all",
                        item.isSelfUse
                          ? "bg-amber-500/20 text-amber-500 border border-amber-500/30 hover:bg-amber-500/30"
                          : "bg-blue-500/20 text-blue-500 border border-blue-500/30 hover:bg-blue-500/30",
                        disabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {item.isSelfUse ? "自用" : "出租"}
                    </button>
                    {item.isInsured && <ShieldCheck size={10} className="text-emerald-400 shrink-0" />}
                  </div>
                </>
              ) : (
                <>
                  {isStock ? (
                    <div className="flex justify-between items-start w-full">
                      <div className="mt-0.5">
                        <span className="text-[11px] text-slate-200 font-bold">{getAssetDisplayName(item)}</span>
                      </div>

                      <div className="flex flex-col items-end gap-0.5 text-right">
                        <span className="text-[10px] text-slate-500 font-medium">{item.quantity} 張</span>
                        <span className="text-[10px] text-slate-500 font-medium">{formatMoney(currentPrice, isMasked)}</span>
                        <NumericalValue value={displayValue} colorClass="text-[12px] text-white" isMasked={isMasked} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="text-[11px] text-slate-200 font-bold">{getAssetDisplayName(item)}</span>
                      {item.isInsured && <ShieldCheck size={10} className="text-emerald-400 shrink-0" />}
                      {isEligibleForUpgrade && !disabled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpgradeClick?.(item);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors border border-emerald-500/20"
                          title="升級企業"
                        >
                          升級
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {!isStock && <div className="text-right"><NumericalValue value={displayValue} colorClass="text-[12px] text-white" isMasked={isMasked} /></div>}
        </div>
      );
    })}
  </div >
);

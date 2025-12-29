import React, { useState, useEffect, useRef } from 'react';
import { GameState, FinancialSummary, Asset } from '../../types';
import { STOCK_NAMES } from '../../constants';
import { TrendingUp, Building, ChevronDown, ShieldCheck, ArrowUpCircle } from 'lucide-react';
import { HistoryTable } from './HistoryTable';
import { CashFlowLog } from './CashFlowLog';
import { BizUpgradeModal } from '../modals/BizUpgradeModal';
import { cn } from '../../utils/gameUtils';

interface FinancialStatementProps {
  gameState: GameState;
  summary: FinancialSummary;
  onShowAlert?: (message: string, type: 'info' | 'error' | 'success') => void;
  onDeleteTransaction?: (id: string) => void;
  onUpgradeBiz?: (assetId: string, diceRoll: number) => void;
}

const formatMoney = (amount: number) => `${amount.toLocaleString()} H`;

const reHouseTypeMap: Record<string, string> = {
  '1room': '單間小套房',
  '2room': '兩室一廳',
  '3room': '三室兩廳',
  '5room': '五室三廳',
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
      const symbol = match ? match[0] : asset.name;
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
      const match = asset.name.match(/[A-Z]\d+/);
      const symbol = match ? match[0] : asset.name;
      return symbol;
    }
  return asset.name;
};

// Animated numerical value with flash effect
const NumericalValue: React.FC<{ value: number, colorClass?: string, prefix?: string }> = ({ value, colorClass = "text-white text-[11px]", prefix = "" }) => {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
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
  }, [value]);

  return (
    <span className={cn(
      "font-mono transition-all duration-300 inline-block",
      flash === 'up' ? "text-emerald-400 scale-110 font-bold" :
        flash === 'down' ? "text-rose-400 scale-110 font-bold" : colorClass
    )}>
      {prefix}{formatMoney(value)}
    </span>
  );
};

export const FinancialStatement: React.FC<FinancialStatementProps> = ({
  gameState,
  summary,
  onShowAlert,
  onDeleteTransaction,
  onUpgradeBiz,
}) => {
  const [view, setView] = useState<'financial' | 'cashflow' | 'history'>('financial');
  const [isIncomeOpen, setIsIncomeOpen] = useState(true);
  const [isBalanceOpen, setIsBalanceOpen] = useState(true);
  const [upgradingAsset, setUpgradingAsset] = useState<Asset | null>(null);

  const realEstate = gameState.assets.filter(a => a.type === '不動產');
  const businesses = gameState.assets.filter(a => a.type === '企業');
  const stocks = gameState.assets.filter(a => a.type === '股票');
  
  // 合併定存項目
  const rawCds = gameState.assets.filter(a => a.type === '定存');
  const cds: Asset[] = rawCds.length > 0 ? [{
    id: 'merged-cd',
    name: '定存總額',
    type: '定存',
    cost: rawCds.reduce((sum, a) => sum + a.cost, 0),
    downPayment: rawCds.reduce((sum, a) => sum + a.downPayment, 0),
    cashflow: rawCds.reduce((sum, a) => sum + a.cashflow, 0),
    isInsured: false
  }] : [];

  const creditLoans = gameState.liabilities.filter(l => l.type === '信用貸款');
  const realEstateLoans = gameState.liabilities.filter(l => l.type === '不動產貸款');
  const businessLoans = gameState.liabilities.filter(l => l.type === '企業貸款');
  const aircraftLoans = gameState.liabilities.filter(l => l.type === '飛行器貸款');

  const creditLoanInterest = (gameState.liabilities.filter(l => l.type === '信用貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0)) + (gameState.loans * 0.1);
  const realEstateLoanInterest = gameState.liabilities.filter(l => l.type === '不動產貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
  const businessLoanInterest = gameState.liabilities.filter(l => l.type === '企業貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
  const aircraftLoanInterest = gameState.liabilities.filter(l => l.type === '飛行器貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);

  const totalMonthlyInterest = creditLoanInterest + realEstateLoanInterest + businessLoanInterest + aircraftLoanInterest;

  const medicalInsuranceCount = gameState.medicalInsuranceCount || 0;
  const houseInsuranceCount = gameState.assets.filter(a => a.type === '不動產' && a.isInsured).length;
  const aircraftInsuranceCount = gameState.assets.some(a => (a.type as any) === '飛行器' && a.isInsured) ? 1 : 0;

  const medicalInsCost = medicalInsuranceCount * 500;
  const houseInsCost = houseInsuranceCount * 500;
  const aircraftInsCost = aircraftInsuranceCount * 1000;

  return (
    <div className="space-y-4 pb-24 no-scrollbar">
      <div className="flex w-full bg-slate-800/50 backdrop-blur-md p-1 rounded-xl border border-slate-700/50">
        {[
          { id: 'financial', label: '財務報表' },
          { id: 'cashflow', label: '現金流量表' },
          { id: 'history', label: '紀錄' }
        ].map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id as any)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-black tracking-widest transition-all ${view === v.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'financial' && (
        <div className="space-y-6 animate-in fade-in duration-500">

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
                    />
                    <div className="pt-2 border-t border-slate-800/50 space-y-2">
                      <div className="text-xs text-slate-400 leading-tight break-all whitespace-nowrap text-left">理財收入</div>
                      {cds.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                          <div className="text-[9px] font-black uppercase tracking-widest text-orange-300 flex justify-between items-center">
                            <span>定存利息</span>
                            <span className="text-slate-500 font-normal lowercase">(利息0.5%)</span>
                          </div>
                          {cds.map(cd => <TAccountSubItem key={cd.id} label={getAssetDisplayName(cd)} value={cd.cashflow} />)}
                        </div>
                      )}
                      {businesses.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                          <div className="text-[9px] font-black uppercase tracking-widest text-purple-300">企業收益</div>
                          {businesses.map(b => <TAccountSubItem key={b.id} label={getAssetDisplayName(b)} value={b.cashflow} />)}
                        </div>
                      )}
                      {realEstate.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                          <div className="text-[9px] font-black uppercase tracking-widest text-blue-300">不動產租金</div>
                          {realEstate.map(r => {
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
                              } value={income} />
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
                    <TAccountItem label="餐飲、服飾、居住類" value={Math.max(0, (gameState.profession?.expenses.basicLiving || 0) + (gameState.expenses?.basicLiving || 0))} color="text-slate-300" />
                    <TAccountItem label="交通、教育、娛樂類" value={Math.max(0, (gameState.profession?.expenses.transportEdu || 0) + (gameState.expenses?.transportEdu || 0))} color="text-slate-300" />
                    <TAccountItem 
                      label="其他、醫療、育兒類" 
                      subLabel="(職等每提升一級，增加10000H)"
                      value={Math.max(0, (gameState.profession?.expenses.otherMedicalChild || 0) + (Math.max(0, gameState.currentRankLevel - 1) * 10000) + (gameState.expenses?.otherMedicalChild || 0))} 
                      color="text-slate-300" 
                    />
                    <div className="pt-2 border-t border-slate-800/50 space-y-2">
                      <div className="text-xs text-slate-400 leading-tight break-all whitespace-nowrap text-left">保險支出</div>
                      {medicalInsCost > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                          <div className="text-[9px] font-black uppercase tracking-widest text-emerald-300">醫療保險</div>
                          <TAccountSubItem label={
                            <div className="flex flex-col">
                              <span>醫療保險</span>
                              <span className="text-[9px] opacity-70">({gameState.medicalInsuranceCount}張)</span>
                            </div>
                          } value={medicalInsCost} />
                        </div>
                      )}
                      {houseInsCost > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                          <div className="text-[9px] font-black uppercase tracking-widest text-blue-300">房屋保險</div>
                          {gameState.assets.filter(a => a.type === '不動產' && a.isInsured).map(house => (
                            <TAccountSubItem key={house.id} label={house.name.match(/[A-Z]\d+/)?.[0] || house.name} value={2000} />
                          ))}
                        </div>
                      )}
                      {aircraftInsCost > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                          <div className="text-[9px] font-black uppercase tracking-widest text-yellow-300">飛行器保險</div>
                          <TAccountSubItem label="飛行器保險" value={aircraftInsCost} />
                        </div>
                      )}
                    </div>
                    <div className="pt-2 border-t border-slate-800/50 space-y-2">
                      <div className="text-xs text-slate-400 leading-tight break-all whitespace-nowrap text-left">貸款利息</div>
                      {(creditLoans.length > 0 || gameState.loans > 0) && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                          <div className="text-[9px] font-black uppercase tracking-widest text-orange-300">信用貸款</div>
                          {creditLoans.map(l => (
                            <TAccountSubItem key={l.id} label={l.name.match(/\(([^)]+)\)/)?.[1] || l.name} value={l.monthlyPayment} />
                          ))}
                          {gameState.loans > 0 && <TAccountSubItem label="銀行貸款利息" value={gameState.loans * 0.1} />}
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
                              } value={l.monthlyPayment} />
                            );
                          })}
                        </div>
                      )}
                      {businessLoans.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                          <div className="text-[9px] font-black uppercase tracking-widest text-purple-300">企業貸款</div>
                          {businessLoans.map(l => <TAccountSubItem key={l.id} label={l.name.match(/\(([^)]+)\)/)?.[1] || l.name} value={l.monthlyPayment} />)}
                        </div>
                      )}
                      {aircraftLoans.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                          <div className="text-[9px] font-black uppercase tracking-widest text-yellow-300">飛行器貸款利息</div>
                          {aircraftLoans.map(l => <TAccountSubItem key={l.id} label={l.name.match(/\(([^)]+)\)/)?.[1] || l.name} value={l.monthlyPayment} />)}
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
                    <TAccountItem label="現金" value={gameState.cash} color="text-emerald-400" />
                    {cds.length > 0 && <AssetCategoryList title="定存" items={cds} color="text-orange-300" />}
                    {stocks.length > 0 && <AssetCategoryList title="股票" items={stocks} color="text-yellow-300" isStock marketPrices={gameState.marketPrices} />}
                    {businesses.length > 0 && (
                      <AssetCategoryList 
                        title="企業" 
                        items={businesses} 
                        color="text-purple-300" 
                        onUpgradeClick={(asset: Asset) => setUpgradingAsset(asset)}
                      />
                    )}
                    {realEstate.length > 0 && <AssetCategoryList title="不動產" items={realEstate} color="text-blue-300" onShowAlert={onShowAlert} />}
                  </div>
                </div>
                {/* Right: Liabilities */}
                <div className="p-4 bg-slate-900/20">
                  <div className="text-[10px] font-black text-rose-500/70 uppercase tracking-widest mb-4 flex justify-between items-center gap-2">
                    <span className="shrink-0">負債項目</span>
                    <span className="shrink-0">餘額</span>
                  </div>
                  <div className="space-y-4">
                    {(creditLoans.length > 0 || gameState.loans > 0) && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                        <div className="text-[9px] font-black uppercase tracking-widest text-orange-300">信用貸款</div>
                        {creditLoans.map(l => <TAccountSubItem key={l.id} label={l.name.match(/\(([^)]+)\)/)?.[1] || l.name} value={l.totalOwed} />)}
                        {gameState.loans > 0 && <TAccountSubItem label="銀行貸款" value={gameState.loans} />}
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
                    {gameState.liabilities.length === 0 && gameState.loans === 0 && (
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
                  <NumericalValue value={summary.totalAssets} colorClass="text-blue-400 text-[11px] font-black" />
                </div>
                <div className="p-3 bg-slate-800/40 flex justify-between items-center">
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">總負債</span>
                  <NumericalValue value={summary.totalLiabilities} colorClass="text-rose-400 text-[11px] font-black" />
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
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {view === 'cashflow' && <div className="animate-in fade-in zoom-in-95 duration-300"><CashFlowLog history={gameState.history} /></div>}
      {view === 'history' && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <HistoryTable
            history={gameState.history}
            onDeleteTransaction={onDeleteTransaction}
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
            setUpgradingAsset(null);
          }}
        />
      )}


    </div>
  );
};

const TAccountItem = ({ label, subLabel, value }: { label: React.ReactNode, subLabel?: React.ReactNode, value: number, color?: string }) => (
  <div className="flex flex-col w-full py-0.5 gap-0.5">
    <span className="text-xs text-slate-400 leading-tight break-all whitespace-nowrap text-left">{label}</span>
    {subLabel && <span className="text-[10px] text-slate-500 leading-tight break-all whitespace-nowrap text-left">{subLabel}</span>}
    <div className="text-right"><NumericalValue value={value} colorClass="text-white text-[14px]" /></div>
  </div>
);

const TAccountSubItem = ({ label, value }: { label: React.ReactNode, value: number }) => (
  <div className="flex flex-col pl-2 border-l border-slate-700 mb-2">
    <span className="text-[10px] text-slate-500 leading-tight break-all whitespace-normal mb-0.5">{label}</span>
    <div className="text-right"><NumericalValue value={value} colorClass="text-[14px] text-white" /></div>
  </div>
);

const AssetCategoryList = ({ title, items, color, isStock = false, marketPrices = {}, onUpgradeClick }: any) => (
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
                  <div className="flex items-center gap-1 w-full">
                    <span className="text-[11px] text-slate-200 font-bold">
                      {item.name.match(/[A-Z]\d+/)?.[0] || item.name}
                    </span>
                    {item.isInsured && <ShieldCheck size={10} className="text-emerald-400 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight break-all whitespace-normal w-full">
                    {reHouseTypeMap[item.houseType] || item.houseType}
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-[11px] text-slate-200 font-bold">{getAssetDisplayName(item)}</span>
                    {item.isInsured && <ShieldCheck size={10} className="text-emerald-400 shrink-0" />}
                    {isEligibleForUpgrade && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpgradeClick?.(item);
                        }}
                        className="p-1 rounded-full hover:bg-emerald-500/20 text-emerald-500 transition-colors group/upgrade"
                        title="升級企業"
                      >
                        <ArrowUpCircle size={14} className="group-hover/upgrade:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="text-right"><NumericalValue value={displayValue} colorClass="text-[12px] text-white" /></div>
          </div>
          {isStock && (
            <div className="flex justify-between text-[9px] text-slate-500">
              <div className="flex gap-1.5">
                <span className="text-slate-400 font-medium">{ticker && STOCK_NAMES[ticker]}</span>
                <span>{item.quantity} 張</span>
              </div>
              <span>目前股價 {currentPrice > 0 ? formatMoney(currentPrice) : '尚未開盤'}</span>
            </div>
          )}
        </div>
      );
    })}
  </div>
);



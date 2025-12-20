
import React, { useState } from 'react';
import { GameState, FinancialSummary, Asset } from '../types';
import { Card } from './ui';
import { TrendingUp, TrendingDown, Wallet, Building, PieChart, List, FileText, ChevronDown, ShieldCheck } from 'lucide-react';
import { HistoryTable } from './HistoryTable';
import { CashFlowLog } from './CashFlowLog';

interface FinancialStatementProps {
  gameState: GameState;
  summary: FinancialSummary;
  onRemoveAsset: (id: string) => void;
  onRepayLiability: (id: string, amount: number) => void;
  onShowAlert?: (message: string, type: 'info' | 'error' | 'success') => void;
  onDeleteTransaction?: (id: string) => void;
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
    if (asset.type === '股票' || asset.type === '企業') {
        const match = asset.name.match(/[A-Z]\d+/);
        return match ? match[0] : asset.name;
    }
    return asset.name;
};

export const FinancialStatement: React.FC<FinancialStatementProps> = ({
  gameState,
  summary,
  onShowAlert,
  onRemoveAsset,
  onRepayLiability,
  onDeleteTransaction,
}) => {
  const [view, setView] = useState<'income' | 'balance' | 'cashflow' | 'history'>('income');
  const [showInsDetail, setShowInsDetail] = useState(false);
  const [showLoanDetail, setShowLoanDetail] = useState(false);

  const realEstate = gameState.assets.filter(a => a.type === '不動產');
  const businesses = gameState.assets.filter(a => a.type === '企業');
  const stocks = gameState.assets.filter(a => a.type === '股票');
  const cds = gameState.assets.filter(a => a.type === '定存');
  
  const creditLoans = gameState.liabilities.filter(l => l.type === '信用貸款');
  const creditLoanPrincipal = creditLoans.reduce((sum, l) => sum + l.totalOwed, 0) + gameState.loans;
  const creditLoanInterest = creditLoanPrincipal * 0.1;

  const realEstateLoans = gameState.liabilities.filter(l => l.type === '不動產貸款');
  const realEstateLoanInterest = realEstateLoans.reduce((sum, l) => sum + l.totalOwed, 0) * 0.005;

  const businessLoans = gameState.liabilities.filter(l => l.type === '企業貸款');
  const businessLoanInterest = businessLoans.reduce((sum, l) => sum + l.totalOwed, 0) * 0.005;

  const aircraftLoans = gameState.liabilities.filter(l => l.type === '飛行器貸款');
  const aircraftLoanInterest = aircraftLoans.reduce((sum, l) => sum + l.totalOwed, 0) * 0.005;

  const totalLoanInterest = creditLoanInterest + realEstateLoanInterest + businessLoanInterest + aircraftLoanInterest;

  const medicalInsCost = (gameState.medicalInsuranceCount || 0) * 2000;
  const insuredHouses = gameState.assets.filter(a => a.type === '不動產' && a.isInsured);
  const houseInsCost = insuredHouses.length * 2000;
  const aircraftInsured = gameState.assets.find(a => a.type === '飛行器' as any && a.isInsured);
  const aircraftInsCost = aircraftInsured ? 2000 : 0;
  const totalInsuranceCost = medicalInsCost + houseInsCost + aircraftInsCost;

  // 符合第 4 點：設置分類
  const passiveIncomeBreakdown = {
    cd: cds.reduce((sum, a) => sum + a.cashflow, 0),
    business: businesses.reduce((sum, a) => sum + a.cashflow, 0),
    realEstate: realEstate.reduce((sum, a) => sum + a.cashflow, 0)
  };

  return (
    <div className="space-y-4">
      <div className="flex w-full bg-slate-800 p-1 rounded-xl">
        {['income', 'balance', 'cashflow', 'history'].map((v: any) => (
          <button key={v} onClick={() => setView(v)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${view === v ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
            {v === 'income' ? '損益表' : v === 'balance' ? '資產負債' : v === 'cashflow' ? '現金流' : '紀錄'}
          </button>
        ))}
      </div>

      {view === 'income' && (
        <div className="space-y-4 animate-in fade-in duration-300">
           {/* 符合第 4 點：設置分類 勞務收入、資產收入 */}
           <Card className="bg-slate-800 overflow-hidden">
              <div className="p-3 bg-emerald-900/30 flex justify-between items-center border-b border-emerald-800/50">
                <h3 className="font-bold text-emerald-400">總月收入額</h3>
                <span className="text-emerald-400 font-bold">{formatMoney(summary.totalIncome)}</span>
              </div>
              <div className="divide-y divide-slate-700/50">
                  <div className="p-3 bg-slate-800/40">
                    <div className="flex justify-between items-center text-sm font-bold text-slate-100">
                      <span>勞務收入</span>
                      <span className="text-emerald-400">+{formatMoney(gameState.profession?.salary || 0)}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex justify-between items-center text-sm font-bold text-slate-100 mb-2">
                      <span>資產收入</span>
                      <span className="text-emerald-400">+{formatMoney(summary.passiveIncome)}</span>
                    </div>
                    {/* 子類別顯示 */}
                    <div className="space-y-1.5 pl-4 border-l-2 border-emerald-800/50 ml-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>定存利息</span>
                        <span>{formatMoney(passiveIncomeBreakdown.cd)}</span>
                      </div>
                      
                      {/* 企業收益細項 */}
                      {businesses.length > 0 ? (
                          businesses.map(b => (
                              <div key={b.id} className="flex justify-between text-xs text-slate-400">
                                <span>企業收益 {getAssetDisplayName(b)}</span>
                                <span>{formatMoney(b.cashflow)}</span>
                              </div>
                          ))
                      ) : (
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>企業收益</span>
                            <span>{formatMoney(passiveIncomeBreakdown.business)}</span>
                          </div>
                      )}

                      {/* 不動產收入細項 */}
                      {realEstate.length > 0 ? (
                          realEstate.map(r => (
                              <div key={r.id} className="flex justify-between text-xs text-slate-400">
                                <span>不動產收入 {getAssetDisplayName(r)}</span>
                                <span>{formatMoney(r.cashflow)}</span>
                              </div>
                          ))
                      ) : (
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>不動產收入</span>
                            <span>{formatMoney(passiveIncomeBreakdown.realEstate)}</span>
                          </div>
                      )}
                    </div>
                  </div>
              </div>
           </Card>

           <Card className="bg-slate-800 overflow-hidden">
              <div className="p-3 bg-rose-900/30 flex justify-between items-center border-b border-rose-800/50">
                <h3 className="font-bold text-rose-400">總月支出額</h3>
                <span className="text-rose-400 font-bold">{formatMoney(summary.totalExpenses)}</span>
              </div>
              <div className="divide-y divide-slate-700/50 text-sm">
                  <ExpenseItem label="餐飲、服飾、居住類" amount={gameState.profession?.expenses.basicLiving || 0} />
                  <ExpenseItem label="交通、教育、娛樂類" amount={gameState.profession?.expenses.transportEdu || 0} />
                  <ExpenseItem 
                    label={<div className="flex flex-col"><span>其他、醫療、育兒類</span><span className="text-[10px] text-slate-500 font-normal">（隨職等提升增加）</span></div>} 
                    amount={(gameState.profession?.expenses.otherMedicalChild || 0) + (Math.max(0, gameState.currentRankLevel - 1) * 10000)} 
                  />
                  
                  <div className="cursor-pointer bg-slate-800/40 hover:bg-slate-700/40 transition-colors" onClick={() => setShowInsDetail(!showInsDetail)}>
                      <div className="p-3 flex justify-between items-center">
                          <div className="flex items-center gap-1 text-slate-300">保險費用 <ChevronDown size={12} className={`transition-transform ${showInsDetail ? 'rotate-180' : ''}`} /></div>
                          <span className="text-slate-200 font-mono">{formatMoney(totalInsuranceCost)}</span>
                      </div>
                      {showInsDetail && (
                          <div className="px-6 pb-3 space-y-1 animate-in slide-in-from-top-1 duration-200">
                              {gameState.medicalInsuranceCount > 0 && <div className="flex justify-between text-[11px] text-slate-500"><span>醫療保險 ({gameState.medicalInsuranceCount}張)</span><span>{formatMoney(medicalInsCost)}</span></div>}
                              {aircraftInsured && <div className="flex justify-between text-[11px] text-slate-500"><span>飛行器保險</span><span>{formatMoney(aircraftInsCost)}</span></div>}
                              {insuredHouses.map(h => (
                                  <div key={h.id} className="flex justify-between text-[11px] text-slate-500"><span>房屋保險 ({getAssetDisplayName(h)})</span><span>$2,000 H</span></div>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="cursor-pointer bg-slate-800/40 hover:bg-slate-700/40 transition-colors" onClick={() => setShowLoanDetail(!showLoanDetail)}>
                      <div className="p-3 flex justify-between items-center">
                          <div className="flex items-center gap-1 text-orange-400 font-bold">貸款利息 <ChevronDown size={12} className={`transition-transform ${showLoanDetail ? 'rotate-180' : ''}`} /></div>
                          <span className="text-orange-400 font-mono font-bold">{formatMoney(totalLoanInterest)}</span>
                      </div>
                      {showLoanDetail && (
                          <div className="px-6 pb-3 space-y-2 animate-in slide-in-from-top-1 duration-200">
                              <div className="flex justify-between text-[11px] text-slate-500"><span>信貸利息（貸款金額x10%）</span><span>{formatMoney(creditLoanInterest)}</span></div>
                              {realEstateLoans.length > 0 && (
                                  <div className="space-y-1">
                                      <div className="text-[10px] text-slate-600 font-bold border-b border-slate-700/50 pb-0.5">不動產貸款 (x0.5%)</div>
                                      {realEstateLoans.map(l => (
                                          <div key={l.id} className="flex justify-between text-[11px] text-slate-400 pl-2"><span>{l.name}</span><span>{formatMoney(l.totalOwed * 0.005)}</span></div>
                                      ))}
                                  </div>
                              )}
                              {businessLoans.length > 0 && (
                                  <div className="space-y-1">
                                      <div className="text-[10px] text-slate-600 font-bold border-b border-slate-700/50 pb-0.5">企業貸款 (x0.5%)</div>
                                      {businessLoans.map(l => (
                                          <div key={l.id} className="flex justify-between text-[11px] text-slate-400 pl-2"><span>{l.name}</span><span>{formatMoney(l.totalOwed * 0.005)}</span></div>
                                      ))}
                                  </div>
                              )}
                              {aircraftLoans.length > 0 && (
                                  <div className="space-y-1">
                                      <div className="text-[10px] text-slate-600 font-bold border-b border-slate-700/50 pb-0.5">飛行器貸款 (x0.5%)</div>
                                      {aircraftLoans.map(l => (
                                          <div key={l.id} className="flex justify-between text-[11px] text-slate-400 pl-2"><span>{l.name}</span><span>{formatMoney(l.totalOwed * 0.005)}</span></div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      )}
                  </div>

                  {/* 符合第 1 點：稅務標籤更新 */}
                  <ExpenseItem label="稅務 (勞務收入x5%)" amount={gameState.profession?.expenses.tax || 0} />
              </div>
           </Card>
        </div>
      )}

      {view === 'balance' && (
        <div className="space-y-4 animate-in fade-in duration-300">
           <Card className="bg-slate-800 overflow-hidden">
              <div className="p-3 bg-blue-900/30 flex justify-between items-center"><h3 className="font-bold text-blue-400">資產</h3><span className="text-blue-400 font-bold">{formatMoney(summary.totalAssets)}</span></div>
              <div className="p-3 space-y-2">
                 <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 flex justify-between items-center">
                    <div className="text-xs font-bold text-emerald-400 uppercase">現金</div>
                    <span className="text-emerald-400 font-bold text-xs">{formatMoney(gameState.cash)}</span>
                 </div>
                 {realEstate.length > 0 && <AssetGroup title="不動產" color="text-blue-300" items={realEstate} onShowAlert={onShowAlert} />}
                 {businesses.length > 0 && <AssetGroup title="企業" color="text-purple-300" items={businesses} />}
                 {stocks.length > 0 && <AssetGroup title="股票" color="text-yellow-300" items={stocks} isStock />}
                 
                 {/* 定存整合顯示 */}
                 {cds.length > 0 && (
                     <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                         <div className="flex justify-between items-center text-xs p-2">
                             <span className="text-orange-300 font-bold">定存</span>
                             <span className="text-emerald-400 font-bold">
                                 {formatMoney(cds.reduce((sum, cd) => sum + cd.cost, 0))}
                             </span>
                         </div>
                     </div>
                 )}
              </div>
           </Card>
           <Card className="bg-slate-800 overflow-hidden">
              <div className="p-3 bg-orange-900/30 flex justify-between items-center"><h3 className="font-bold text-orange-400">負債</h3><span className="text-orange-400 font-bold">{formatMoney(summary.totalLiabilities)}</span></div>
              <div className="p-3 space-y-2">
                  {gameState.liabilities.map(l => (
                      <div key={l.id} className="bg-slate-900/50 p-2 rounded flex justify-between text-sm">
                          <span>{l.name}</span>
                          <span className="text-rose-400 font-mono">{formatMoney(l.totalOwed)}</span>
                      </div>
                  ))}
              </div>
           </Card>
        </div>
      )}
      {view === 'cashflow' && <CashFlowLog history={gameState.history} />}
      {view === 'history' && (
        <HistoryTable
          history={gameState.history}
          onDeleteTransaction={onDeleteTransaction}
        />
      )}
    </div>
  );
};

const ExpenseItem = ({ label, amount, isDebt = false }: any) => (
    <div className="p-3 flex justify-between items-center">
        <div className="text-slate-300">{label}</div>
        <span className={`font-mono ${isDebt ? 'text-orange-400' : 'text-slate-200'}`}>{formatMoney(amount)}</span>
    </div>
);

const AssetGroup = ({ title, color, items, isStock = false, onShowAlert }: any) => (
    <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700">
        <div className={`text-[10px] font-bold ${color} mb-1 uppercase`}>{title}</div>
        <div className="space-y-1">
            {items.map((item: any) => (
                <div key={item.id} className="bg-slate-800 p-2 rounded border border-slate-700">
                     <div className="flex justify-between items-center text-xs font-bold text-slate-200 mb-1">
                        <div className="flex items-center gap-1">
                            <span>{getAssetDisplayName(item)}</span>
                            {item.isInsured && (
                                <ShieldCheck 
                                    size={10} 
                                    className="text-emerald-400 cursor-pointer" 
                                    onClick={() => onShowAlert ? onShowAlert("已投保房屋保險", 'success') : alert("已投保房屋保險")}
                                />
                            )}
                        </div>
                        <span className="text-emerald-400">價值 {formatMoney(Math.abs(item.cost))}</span>
                     </div>
                     {isStock && (
                         <div className="text-[10px] text-slate-400 flex justify-between border-t border-slate-700/50 pt-1 mt-1">
                            <span>每張股價: {formatMoney(item.lastPurchasePrice || Math.floor(item.cost / (item.quantity || 1)))}</span>
                            <span>{item.quantity}張</span>
                         </div>
                     )}
                </div>
            ))}
        </div>
    </div>
);

import React from 'react';
import { Asset, Profession, Enterprise, Dream, HappinessItem, TransactionData } from '../../types';
import { STOCK_SYMBOLS } from '../../constants';
import { Button, Card } from '../ui/ui';
import { Wallet, HelpCircle, CheckCircle2, Plus, AlertCircle, Star, X } from 'lucide-react';
import { useTransactionLogic } from '../../hooks/useTransactionLogic';

// UI Components
import { TransactionModeTabs } from '../transaction/TransactionModeTabs';
import { AssetTypeSelector } from '../transaction/AssetTypeSelector';
import { StockBuyForm } from '../transaction/StockBuyForm';
import { AssetBuyForms } from '../transaction/AssetBuyForms';
import { GoalAchievementCard } from '../transaction/GoalAchievementCard';
import { InsuranceForm } from '../transaction/InsuranceForm';
import { SellForm } from '../transaction/SellForm';
import { LoanForm } from '../transaction/LoanForm';
import { DividendForm } from '../transaction/DividendForm';
import { EventForm } from '../transaction/EventForm';
import { ExpenseForm } from '../transaction/ExpenseForm';
import { FinancialCheckBoard } from '../transaction/FinancialCheckBoard';
import { TransactionSuccess } from '../transaction/TransactionSuccess';

interface TransactionFormProps {
  profession: Profession | null;
  selectedEnterprise: Enterprise | null;
  selectedDream: Dream | null;
  cash: number;
  salary: number;
  assets?: Asset[];
  happiness?: HappinessItem[];
  completedHappinessEvents?: string[];
  happinessSubMode: 'history' | 'pay' | 'inc_exp';
  setHappinessSubMode: (v: 'history' | 'pay' | 'inc_exp') => void;
  liabilities: any[];
  currentRankLevel: number;
  marketPrices?: Record<string, number>;
  onTransaction: (data: TransactionData) => void;
  onCancel: () => void;
  onShowAlert?: (message: string, type: 'info' | 'error' | 'success') => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = (props) => {
  const {
    phase, setPhase, mode, setMode, assetType, setAssetType,
    stockInputs, setStockInputs, reSelfUse, setReSelfUse, reSymbol, setReSymbol,
    reDownPayment, setReDownPayment, reLoan, setReLoan, reInterest, setReInterest,
    reIncome, setReIncome, reHouseType, setReHouseType,
    bizSymbol, setBizSymbol, bizCost, setBizCost, bizLoan, setBizLoan, bizInterest, setBizInterest, bizIncome, setBizIncome,
    cdAmount, setCdAmount, insType, setInsType, insMedicalQty, setInsMedicalQty,
    insSelectedHouses, setInsSelectedHouses, insAircraftSelected, setInsAircraftSelected,
    showInsAircraftError, setShowInsAircraftError, aircraftCash, setAircraftCash, aircraftLoan, setAircraftLoan,
    sellCat, setSellCat, sellStockDetails, setSellStockDetails, repayInputs, setRepayInputs,
    withdrawAmount, setWithdrawAmount, loanSubMode, setLoanSubMode, repayType, setRepayType,
    borrowAmount, setBorrowAmount, repayAmount, setRepayAmount, divMode, setDivMode, divInputs, setDivInputs,
    eventSubMode, setEventSubMode,
    eventPayType, setEventPayType, eventAmount, setEventAmount,
    eventCustomName, setEventCustomName, eventExpCategory, setEventExpCategory,
    eventTab, setEventTab,
    selectedExpense, setSelectedExpense, expenseAmount, setExpenseAmount, expenseCategorySelect, setExpenseCategorySelect,
    userEntries, errorMessage, setErrorMessage, pendingTx,
    stockAssets, cdTotal, uninsuredHouses, hasAircraftAsset,
    handlePhase1Submit, checkAnswers, completeTransaction, toggleEntry, formatMoney, resetFormStates
  } = useTransactionLogic({
    ...props,
    assets: props.assets || [],
    happiness: props.happiness || [],
    completedHappinessEvents: props.completedHappinessEvents || [],
    onShowAlert: props.onShowAlert
  });

  const { onCancel, happiness = [], assets = [], liabilities = [], selectedEnterprise, selectedDream, cash, salary, marketPrices } = props;

  const handleCancel = () => {
    resetFormStates();
    onCancel();
  };

  const handleCompleteTransaction = () => {
    completeTransaction();
    resetFormStates();
  };

  return (
    <Card className="bg-slate-900 border-slate-600 shadow-2xl max-w-4xl w-full mx-auto animate-in zoom-in-95 overflow-hidden flex flex-col h-[85vh]">
      <div className="border-b border-slate-700 bg-slate-800 shrink-0">
        <div className="p-4 pb-3 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            {phase === 1 ? <><Wallet className="text-emerald-400" /> 交易資料輸入</> : phase === 2 ? <><HelpCircle className="text-yellow-400" /> 財務檢核</> : <><CheckCircle2 className="text-emerald-400" /> 交易完成</>}
          </h3>
          {phase === 3 ? (
            <button onClick={handleCompleteTransaction} className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
              <X size={24} />
            </button>
          ) : (
            <button onClick={handleCancel} className="text-slate-400 hover:text-white transition-colors font-medium">取消</button>
          )}
        </div>
        
        {phase === 1 && (
          <div className="px-4 pb-2 -mt-1.5">
            <div className="bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Wallet size={12} className="text-emerald-400" />
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">目前持有現金</span>
              </div>
              <span className="text-base font-mono font-black text-white tracking-tight">{formatMoney(cash)}</span>
            </div>
          </div>
        )}
      </div>

      <div className={`flex-1 ${phase === 3 ? 'overflow-hidden p-0' : 'overflow-y-auto p-6'} no-scrollbar`}>
        {phase === 1 && (
          <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
            <TransactionModeTabs currentMode={mode} onModeChange={setMode} />

            {mode === 'buy' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-1">一般資產 / 保險</label>
                  <AssetTypeSelector
                    assetTypes={['股票', '不動產', '企業', '定存', '保險', '飛行器']}
                    currentType={assetType}
                    onTypeChange={setAssetType}
                    happiness={happiness}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-amber-500/80 font-bold uppercase tracking-widest pl-1 flex items-center gap-1.5">
                    <Star size={12} className="fill-amber-500/40 text-amber-400" /> 成就目標
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['目標企業', '心儀夢想'] as const).map((t) => {
                      const isSelected = assetType === t;
                      const isAchieved =
                        (t === '目標企業' && happiness.find((h) => h.id === 'h_career')?.checked) ||
                        (t === '心儀夢想' && happiness.find((h) => h.id === 'h_dream')?.checked);

                      return (
                        <button
                          key={t}
                          onClick={() => setAssetType(t as any)}
                          className={`relative py-3.5 rounded-xl border flex flex-col items-center justify-center transition-all overflow-hidden group shadow-lg ${isSelected
                            ? 'bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-amber-500 shadow-amber-900/20'
                            : 'bg-slate-900 border-slate-700 hover:border-amber-500/40'
                            } ${isAchieved ? 'opacity-40 grayscale-50' : ''}`}
                        >
                          <span className={`text-sm font-black tracking-widest uppercase ${isSelected ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-500/70'}`}>
                            {t}
                          </span>
                          {isAchieved && (
                            <span className="text-[9px] text-amber-600 font-bold mt-0.5">已達成</span>
                          )}
                          {isSelected && (
                            <div className="absolute top-0 right-0 p-1.5 animate-in zoom-in-50 duration-300">
                              <CheckCircle2 size={12} className="text-amber-400" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
                  {assetType === '股票' && <StockBuyForm stockInputs={stockInputs} setStockInputs={setStockInputs} marketPrices={marketPrices} stockAssets={stockAssets} />}
                  {(['不動產', '企業', '定存', '飛行器'] as any).includes(assetType) && (
                    <AssetBuyForms
                      assetType={assetType} reSymbol={reSymbol} setReSymbol={setReSymbol} reSelfUse={reSelfUse} setReSelfUse={setReSelfUse}
                      reDownPayment={reDownPayment} setReDownPayment={setReDownPayment} reLoan={reLoan} setReLoan={setReLoan}
                      reInterest={reInterest} setReInterest={setReInterest} reIncome={reIncome} setReIncome={setReIncome}
                      reHouseType={reHouseType} setReHouseType={setReHouseType} bizSymbol={bizSymbol} setBizSymbol={setBizSymbol}
                      bizCost={bizCost} setBizCost={setBizCost} bizLoan={bizLoan} setBizLoan={setBizLoan} 
                      bizInterest={bizInterest} setBizInterest={setBizInterest}
                      bizIncome={bizIncome} setBizIncome={setBizIncome}
                      cdAmount={cdAmount} setCdAmount={setCdAmount} aircraftCash={aircraftCash} setAircraftCash={setAircraftCash} aircraftLoan={aircraftLoan} setAircraftLoan={setAircraftLoan}
                    />
                  )}
                  {assetType === '保險' && (
                    <InsuranceForm
                      insType={insType} setInsType={setInsType} insMedicalQty={insMedicalQty} setInsMedicalQty={setInsMedicalQty}
                      uninsuredHouses={uninsuredHouses} insSelectedHouses={insSelectedHouses} setInsSelectedHouses={setInsSelectedHouses}
                      hasAircraftAsset={hasAircraftAsset} insAircraftSelected={insAircraftSelected} setInsAircraftSelected={setInsAircraftSelected}
                      showInsAircraftError={showInsAircraftError} setShowInsAircraftError={setShowInsAircraftError} setErrorMessage={setErrorMessage}
                    />
                  )}
                  {assetType === '目標企業' && (
                    <GoalAchievementCard
                      type="enterprise"
                      goal={selectedEnterprise}
                      happiness={happiness}
                      currentCash={cash}
                      playerProfessionId={props.profession?.id}
                      currentRankLevel={props.currentRankLevel}
                    />
                  )}
                  {assetType === '心儀夢想' && <GoalAchievementCard type="dream" goal={selectedDream} happiness={happiness} currentCash={cash} />}
                </div>
              </div>
            )}

            {mode === 'sell' && (
              <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
                <AssetTypeSelector 
                  assetTypes={['股票', '不動產', '企業', '定存']} 
                  currentType={sellCat} 
                  onTypeChange={setSellCat} 
                  happiness={happiness} 
                  cols={4}
                />
                <SellForm
                  sellCat={sellCat} assets={assets} sellStockDetails={sellStockDetails} setSellStockDetails={setSellStockDetails}
                  withdrawAmount={withdrawAmount} setWithdrawAmount={setWithdrawAmount} repayInputs={repayInputs} setRepayInputs={setRepayInputs} cdTotal={cdTotal}
                  marketPrices={marketPrices}
                />
              </div>
            )}

            {mode === 'loan' && (
              <LoanForm
                loanSubMode={loanSubMode} setLoanSubMode={setLoanSubMode} repayType={repayType} setRepayType={setRepayType}
                salary={salary} cash={cash} liabilities={liabilities} borrowAmount={borrowAmount} setBorrowAmount={setBorrowAmount}
                repayAmount={repayAmount} setRepayAmount={setRepayAmount} repayInputs={repayInputs} setRepayInputs={setRepayInputs} formatMoney={formatMoney}
              />
            )}

            {mode === 'dividend' && <DividendForm divMode={divMode} setDivMode={setDivMode} stockAssets={stockAssets} divInputs={divInputs} setDivInputs={setDivInputs} />}

            {mode === 'event' && (
              <EventForm
                eventSubMode={eventSubMode} setEventSubMode={setEventSubMode}
                eventPayType={eventPayType} setEventPayType={setEventPayType}
                eventCustomName={eventCustomName} setEventCustomName={setEventCustomName} eventAmount={eventAmount} setEventAmount={setEventAmount}
                eventExpCategory={eventExpCategory} setEventExpCategory={setEventExpCategory} setErrorMessage={setErrorMessage}
                eventTab={eventTab}
                setEventTab={setEventTab}
                happinessSubMode={props.happinessSubMode}
                setHappinessSubMode={props.setHappinessSubMode}
                completedHappinessEvents={props.completedHappinessEvents || []}
                happiness={happiness}
              />
            )}

            {mode === 'expense' && (
              <ExpenseForm
                selectedExpense={selectedExpense} setSelectedExpense={setSelectedExpense} expenseAmount={expenseAmount} setExpenseAmount={setExpenseAmount}
                expenseCategorySelect={expenseCategorySelect} setExpenseCategorySelect={setExpenseCategorySelect} cash={cash}
              />
            )}

            <Button
              className="w-full py-4 text-lg font-black shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30"
              onClick={handlePhase1Submit}
              disabled={
                (assetType === '目標企業' && happiness.find(h => h.id === 'h_career')?.checked === true) ||
                (assetType === '心儀夢想' && happiness.find(h => h.id === 'h_dream')?.checked === true)
              }
            >
              {(assetType === '目標企業' && happiness.find(h => h.id === 'h_career')?.checked) || (assetType === '心儀夢想' && happiness.find(h => h.id === 'h_dream')?.checked)
                ? '已達成，不可重複購買'
                : '下一步：財務檢核'}
            </Button>
            {errorMessage && <div className="hidden"> <AlertCircle size={14} /> {errorMessage} </div>}
          </div>
        )}

        {phase === 2 && (
          <div className="h-full flex flex-col animate-in fade-in duration-300 -mt-2">
            <div className="bg-blue-900/20 border border-blue-900/50 p-2 rounded-lg mb-3 text-center animate-pulse">
              <p className="text-blue-200 font-bold text-base">請問此筆交易如何影響財務報表？</p>
            </div>
            <FinancialCheckBoard
              possibleItemsAssets={['現金', '現金（企業貸款）',
                ...(mode === 'buy' ? (
                  assetType === '定存' ? ['定存'] :
                    assetType === '股票' ? ['股票'] :
                      assetType === '不動產' ? [`不動產 (${reSymbol})`] :
                        assetType === '企業' ? [`企業 (${bizSymbol})`] :
                          assetType === '目標企業' && selectedEnterprise ? [`企業 (${selectedEnterprise.name})`] :
                            assetType === '飛行器' ? ['飛行器'] : []
                ) : mode === 'sell' ? (
                  sellCat === '股票' ? ['股票'] :
                    sellCat === '定存' ? ['定存'] : assets.filter(a => a.type === sellCat).map(a => a.name)
                ) : mode === 'dividend' && divMode === 'stock' ? ['股票'] : [])
              ]}
              possibleItemsIncome={['租金收入', '企業收益', '定存利息', '理財收入']}
              possibleItemsLiabilities={['信用貸款', '不動產貸款', '企業貸款', '飛行器貸款', ...liabilities.map(l => l.name)]}
              possibleItemsExpenses={['信貸利息', '不動產貸款利息', '企業貸款利息', '飛行器貸款利息', '保險支出', '餐飲、服飾、居住類', '交通、教育、娛樂類', '其他、醫療、育兒類']}
              userEntries={userEntries}
              onToggle={toggleEntry}
            />
            <div className="mt-3 flex gap-3 shrink-0">
              <Button variant="secondary" onClick={() => setPhase(1)} className="flex-1 py-2.5 text-sm">上一步</Button>
              <Button onClick={checkAnswers} className="flex-[1.5] py-2.5 text-sm bg-emerald-600 hover:bg-emerald-500 font-bold">確認檢核答案</Button>
            </div>
          </div>
        )}

        {phase === 3 && (
          <div className="h-full flex flex-col items-center overflow-hidden">
            <div className="flex-1 w-full flex flex-col items-center justify-center">
              <TransactionSuccess pendingTx={pendingTx} formatMoney={formatMoney} />
            </div>
            <div className="w-full max-w-md px-6 py-6 shrink-0 border-t border-slate-800/50">
              <Button onClick={handleCompleteTransaction} className="w-full py-4 text-xl bg-emerald-600 hover:bg-emerald-500 font-black tracking-widest shadow-2xl shadow-emerald-900/50 active:scale-95 transition-all">返回報表</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

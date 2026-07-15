import React, { useEffect, useMemo, useState } from 'react';
import { Car, PiggyBank, Shield, ShieldCheck } from 'lucide-react';
import { Asset, TransactionData } from '../../types';

interface WealthViewProps {
  cash: number;
  salary: number;
  medicalInsuranceCount: number;
  assets: Asset[];
  initialProductType?: 'insurance' | 'deposit' | 'car';
  allowedProductTypes?: Array<'insurance' | 'deposit' | 'car'>;
  canUseBankProducts: boolean;
  onTransaction: (data: TransactionData) => void;
}

export const WealthView: React.FC<WealthViewProps> = ({
  cash,
  salary,
  medicalInsuranceCount,
  assets,
  initialProductType = 'insurance',
  allowedProductTypes = ['insurance', 'deposit', 'car'],
  canUseBankProducts,
  onTransaction
}) => {
  const carPrice = 600000;
  const minCarDownPayment = Math.floor(carPrice * 0.2);
  const [productType, setProductType] = useState<'insurance' | 'deposit' | 'car'>(initialProductType);
  const [depositAmount, setDepositAmount] = useState<number>(10000);
  const [carCashAmount, setCarCashAmount] = useState<number>(Math.min(Math.max(minCarDownPayment, 0), Math.min(cash, carPrice)));

  const insuranceCost = salary * 0.1;
  const hasCarAsset = assets.some(asset => asset.type === '汽車' || asset.type === '飛行器');
  const depositAssets = useMemo(
    () => assets.filter(asset => asset.type === '定存' && asset.cost > 0),
    [assets]
  );
  const availableProductTypes = useMemo(
    () => allowedProductTypes.length > 0 ? allowedProductTypes : ['insurance', 'deposit', 'car'],
    [allowedProductTypes]
  );
  const maxAffordableCarCash = Math.min(cash, carPrice);
  const normalizedCarCash = Math.min(Math.max(carCashAmount, minCarDownPayment), maxAffordableCarCash);
  const carLoanAmount = carPrice - normalizedCarCash;
  const carLoanInterest = Math.floor(carLoanAmount * 0.005);
  const canAffordMinDownPayment = cash >= minCarDownPayment;

  useEffect(() => {
    if (availableProductTypes.includes(initialProductType)) {
      setProductType(initialProductType);
      return;
    }

    setProductType(availableProductTypes[0] as 'insurance' | 'deposit' | 'car');
  }, [availableProductTypes, initialProductType]);

  const handleBuyInsurance = () => {
    if (!canUseBankProducts) return;
    // 保險費用由 medicalInsuranceCount 即時計算（見 calculateFinancialSummary 的 insuranceCost），
    // 不需要另外疊加 expensePayload，否則會與保險費用公式重複計算。
    onTransaction({
      name: '購買醫療險',
      amount: 0,
      cashChange: 0,
      source: 'cash',
      usage: 'insurance',
      insuranceType: 'medical',
      insurancePayload: { medicalQty: 1 }
    });
  };

  const handleBuyDeposit = () => {
    if (!canUseBankProducts || depositAmount <= 0) return;
    onTransaction({
      name: `定存 ${depositAmount.toLocaleString()}`,
      amount: depositAmount,
      cashChange: -depositAmount,
      source: 'cash',
      usage: 'buy_asset',
      assetChange: {
        action: 'add',
        asset: {
          id: `fixed_deposit_${Date.now()}`,
          name: '定存',
          type: '定存',
          value: depositAmount,
          monthlyCashflow: depositAmount * 0.01 // 1%
        }
      }
    });
    setDepositAmount(10000);
  };

  const handleWithdrawDeposit = (asset: Asset) => {
    const withdrawAmount = asset.cost || asset.value || 0;
    if (withdrawAmount <= 0) return;

    onTransaction({
      name: `解約定存 ${withdrawAmount.toLocaleString()}`,
      amount: withdrawAmount,
      cashChange: withdrawAmount,
      source: 'income',
      usage: 'cash',
      relatedAssetId: asset.id,
      impacts: [
        `現金 +${withdrawAmount.toLocaleString()}`,
        `定存 -${withdrawAmount.toLocaleString()}`,
        '定存利息(月) 減少'
      ],
      financialCheckEntries: [
        { category: 'Assets', name: '現金', direction: 'Increase' },
        { category: 'Assets', name: '定存', direction: 'Decrease' },
        { category: 'Income', name: '定存利息', direction: 'Decrease' }
      ]
    });
  };

  const handleBuyCar = () => {
    if (hasCarAsset) return;
    if (!canAffordMinDownPayment) return;

    const cashPortion = Math.min(Math.max(carCashAmount, minCarDownPayment), maxAffordableCarCash);
    const loanPortion = carPrice - cashPortion;

    onTransaction({
      name: '買入汽車（增加一顆骰子）',
      amount: carPrice,
      cashChange: -cashPortion,
      source: loanPortion > 0 ? 'loan' : 'cash',
      usage: 'asset',
      assetDetails: {
        type: '汽車',
        cashflow: 0,
        downPayment: cashPortion,
        loanAmount: loanPortion,
        loanInterest: Math.floor(loanPortion * 0.005)
      },
      impacts: [
        `現金 -${cashPortion.toLocaleString()}`,
        `汽車資產 +${carPrice.toLocaleString()}`,
        ...(loanPortion > 0 ? [`汽車貸款 +${loanPortion.toLocaleString()}`, `汽車貸款利息(月) +${Math.floor(loanPortion * 0.005).toLocaleString()}`] : [])
      ],
      financialCheckEntries: [
        { category: 'Assets', name: '汽車', direction: 'Increase' },
        ...(cashPortion > 0 ? [{ category: 'Assets' as const, name: '現金', direction: 'Decrease' as const }] : []),
        ...(loanPortion > 0
          ? [
              { category: 'Liabilities' as const, name: '汽車貸款', direction: 'Increase' as const },
              { category: 'Expenses' as const, name: '汽車貸款利息', direction: 'Increase' as const }
            ]
          : [])
      ]
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 text-white sm:space-y-6">
      {availableProductTypes.length > 1 && (
        <div className="flex rounded-xl border border-slate-800 bg-slate-900/80 p-1 sm:rounded-2xl sm:p-1.5">
          {availableProductTypes.includes('insurance') && (
            <button
              onClick={() => setProductType('insurance')}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2.5 text-xs font-black tracking-wide transition-all sm:gap-2 sm:rounded-xl sm:py-3 sm:text-[14px] sm:tracking-widest ${productType === 'insurance' ? 'bg-indigo-600/20 text-indigo-400 shadow-inner border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Shield size={16} /> 醫療保險
            </button>
          )}
          {availableProductTypes.includes('deposit') && (
            <button
              onClick={() => setProductType('deposit')}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2.5 text-xs font-black tracking-wide transition-all sm:gap-2 sm:rounded-xl sm:py-3 sm:text-[14px] sm:tracking-widest ${productType === 'deposit' ? 'bg-indigo-600/20 text-indigo-400 shadow-inner border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <PiggyBank size={16} /> 銀行定存
            </button>
          )}
          {availableProductTypes.includes('car') && (
            <button
              onClick={() => setProductType('car')}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2.5 text-xs font-black tracking-wide transition-all sm:gap-2 sm:rounded-xl sm:py-3 sm:text-[14px] sm:tracking-widest ${productType === 'car' ? 'bg-indigo-600/20 text-indigo-400 shadow-inner border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Car size={16} /> 購買汽車
            </button>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3 shadow-xl sm:rounded-3xl sm:p-6">
        {productType === 'insurance' && (
          <div className="space-y-3 sm:space-y-6">
            <div className="mb-2 flex items-center gap-3 sm:mb-4 sm:gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/50 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 text-indigo-400 sm:h-16 sm:w-16 sm:rounded-2xl">
                <ShieldCheck size={26} />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-wide text-white sm:text-xl">醫療險</h3>
                <p className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">遇到醫療支出時，可全額理賠</p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:space-y-4 sm:rounded-2xl sm:p-5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">目前持有保單</span>
                <span className="text-lg font-black text-indigo-400">{medicalInsuranceCount} 份</span>
              </div>
              <div className="h-px w-full bg-slate-800" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">購買費用 (月支出增加)</span>
                <span className="text-xl font-black text-white sm:text-2xl">$2,000</span>
              </div>
            </div>

            <button
              onClick={handleBuyInsurance}
              disabled={medicalInsuranceCount >= 1 || !canUseBankProducts}
              className={`min-h-11 w-full rounded-xl py-2.5 text-sm font-black tracking-wide transition-all sm:rounded-2xl sm:py-4 sm:text-[16px] sm:tracking-widest ${
                medicalInsuranceCount >= 1 || !canUseBankProducts
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]'
              }`}
            >
              {medicalInsuranceCount >= 1 ? '已達購買上限 (1份)' : !canUseBankProducts ? '需先經過銀行' : '確認購買保險'}
            </button>
          </div>
        )}

        {productType === 'deposit' && (
          <div className="space-y-3 sm:space-y-6">
            <div className="mb-2 flex items-center gap-3 sm:mb-4 sm:gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/50 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 text-emerald-400 sm:h-16 sm:w-16 sm:rounded-2xl">
                <PiggyBank size={26} />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-wide text-white sm:text-xl">銀行定期存款</h3>
                <p className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">每月可獲得 1% 穩定利息收入</p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:space-y-5 sm:rounded-2xl sm:p-5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">目前可用現金</span>
                <span className="text-lg font-black text-emerald-400">${cash.toLocaleString()}</span>
              </div>
              
              <div className="space-y-3">
                <span className="text-sm font-bold text-slate-400 block">輸入定存金額</span>
                <div className="flex items-center gap-2 sm:gap-4">
                  <button 
                    onClick={() => setDepositAmount(Math.max(10000, depositAmount - 10000))}
                    className="h-11 w-11 shrink-0 rounded-xl bg-slate-800 text-xl font-black text-slate-300 hover:bg-slate-700 sm:h-12 sm:w-12"
                  >-</button>
                  <input
                    type="number"
                    value={depositAmount || ''}
                    onChange={(e) => setDepositAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 text-center text-lg font-black tracking-wide text-white sm:h-12 sm:text-xl sm:tracking-wider"
                  />
                  <button 
                    onClick={() => setDepositAmount(Math.min(cash, depositAmount + 10000))}
                    className="h-11 w-11 shrink-0 rounded-xl bg-slate-800 text-xl font-black text-slate-300 hover:bg-slate-700 sm:h-12 sm:w-12"
                  >+</button>
                </div>
              </div>

              <div className="h-px w-full bg-slate-800" />
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">預期每月利息收入 (1%)</span>
                <span className="text-xl font-black text-emerald-400">+${(depositAmount * 0.01).toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={handleBuyDeposit}
              disabled={!canUseBankProducts || depositAmount <= 0 || cash < depositAmount}
              className={`min-h-11 w-full rounded-xl py-2.5 text-sm font-black tracking-wide transition-all sm:rounded-2xl sm:py-4 sm:text-[16px] sm:tracking-widest ${
                !canUseBankProducts || depositAmount <= 0 || cash < depositAmount
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]'
              }`}
            >
              {!canUseBankProducts ? '需先經過銀行' : '確認辦理定存'}
            </button>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:rounded-2xl sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-400">目前定存</span>
                <span className="text-sm font-black text-emerald-300">{depositAssets.length} 筆</span>
              </div>
              <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                {depositAssets.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-4 text-sm font-bold text-slate-500">
                    目前沒有可解約的定存
                  </div>
                ) : (
                  depositAssets.map(asset => (
                    <div key={asset.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-4">
                      <div>
                        <div className="text-sm font-black text-white">定存 {asset.cost.toLocaleString()}</div>
                        <div className="mt-1 text-xs font-bold text-slate-500">每月利息 +${Math.floor((asset.cost || 0) * 0.01).toLocaleString()}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleWithdrawDeposit(asset)}
                        className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-400"
                      >
                        解約
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {productType === 'car' && (
          <div className="space-y-3 sm:space-y-6">
            <div className="mb-2 flex items-center gap-3 sm:mb-4 sm:gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/50 bg-gradient-to-br from-amber-500/30 to-orange-500/30 text-amber-300 sm:h-16 sm:w-16 sm:rounded-2xl">
                <Car size={26} />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-wide text-white sm:text-xl">汽車資產</h3>
                <p className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">購買後可增加一顆骰子，總價 60 萬，自備款至少 2 成</p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:space-y-5 sm:rounded-2xl sm:p-5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">資產價格</span>
                <span className="text-2xl font-black text-white">${carPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">目前可用現金</span>
                <span className="text-lg font-black text-emerald-400">${cash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">最低自備款</span>
                <span className="text-lg font-black text-amber-300">${minCarDownPayment.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">持有狀態</span>
                <span className={`text-base font-black ${hasCarAsset ? 'text-amber-300' : 'text-slate-200'}`}>
                  {hasCarAsset ? '已持有汽車' : '尚未持有'}
                </span>
              </div>

              <div className="h-px w-full bg-slate-800" />

              <div className="space-y-3">
                <span className="text-sm font-bold text-slate-400 block">現金支付金額</span>
                <div className="flex items-center gap-2 sm:gap-4">
                  <button
                    onClick={() => setCarCashAmount(Math.max(minCarDownPayment, normalizedCarCash - 10000))}
                    disabled={hasCarAsset || !canAffordMinDownPayment}
                    className="h-11 w-11 shrink-0 rounded-xl bg-slate-800 text-xl font-black text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:w-12"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={normalizedCarCash || ''}
                    onChange={(e) => setCarCashAmount(Math.max(minCarDownPayment, Math.min(carPrice, parseInt(e.target.value) || 0)))}
                    disabled={hasCarAsset || !canAffordMinDownPayment}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 text-center text-lg font-black tracking-wide text-white disabled:opacity-50 sm:h-12 sm:text-xl sm:tracking-wider"
                  />
                  <button
                    onClick={() => setCarCashAmount(Math.min(maxAffordableCarCash, normalizedCarCash + 10000))}
                    disabled={hasCarAsset || !canAffordMinDownPayment}
                    className="h-11 w-11 shrink-0 rounded-xl bg-slate-800 text-xl font-black text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:w-12"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs font-medium text-slate-500">
                  {canAffordMinDownPayment
                    ? `可輸入 ${minCarDownPayment.toLocaleString()} 到 ${maxAffordableCarCash.toLocaleString()}，不足部分自動轉為汽車貸款。`
                    : `現金至少需達 ${minCarDownPayment.toLocaleString()} 才能購車。`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:rounded-2xl sm:p-4">
                  <div className="text-sm font-bold text-slate-400">現金支出</div>
                  <div className="mt-1 truncate text-lg font-black text-rose-400 sm:mt-2 sm:text-2xl">-${normalizedCarCash.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:rounded-2xl sm:p-4">
                  <div className="text-sm font-bold text-slate-400">汽車貸款</div>
                  <div className="mt-1 truncate text-lg font-black text-amber-300 sm:mt-2 sm:text-2xl">${carLoanAmount.toLocaleString()}</div>
                  <div className="mt-1 text-xs font-medium text-slate-500">每月利息 +${carLoanInterest.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <button
              onClick={handleBuyCar}
              disabled={hasCarAsset || !canAffordMinDownPayment}
              className={`min-h-11 w-full rounded-xl py-2.5 text-sm font-black tracking-wide transition-all sm:rounded-2xl sm:py-4 sm:text-[16px] sm:tracking-widest ${
                hasCarAsset || !canAffordMinDownPayment
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.35)]'
              }`}
            >
              {hasCarAsset
                ? '已持有汽車，無法重複購買'
                : !canAffordMinDownPayment
                  ? `現金未達最低自備款 ${minCarDownPayment.toLocaleString()}`
                  : carLoanAmount === 0
                    ? '確認現金買車'
                    : '確認貸款買車'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

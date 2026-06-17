import React, { useState } from 'react';
import { Shield, PiggyBank, ShieldCheck } from 'lucide-react';
import { Asset, TransactionData } from '../../types';

interface WealthViewProps {
  cash: number;
  salary: number;
  medicalInsuranceCount: number;
  assets: Asset[];
  onTransaction: (data: TransactionData) => void;
}

export const WealthView: React.FC<WealthViewProps> = ({ cash, salary, medicalInsuranceCount, assets, onTransaction }) => {
  const [productType, setProductType] = useState<'insurance' | 'deposit'>('insurance');
  const [depositAmount, setDepositAmount] = useState<number>(10000);

  const insuranceCost = salary * 0.1;

  const handleBuyInsurance = () => {
    onTransaction({
      name: '購買醫療險',
      amount: 0,
      cashChange: 0,
      source: 'cash',
      usage: 'insurance',
      insuranceType: 'medical',
      insurancePayload: { medicalQty: 1 },
      expensePayload: { category: 'otherMedicalChild', amount: 2000, isIncrease: true }
    });
  };

  const handleBuyDeposit = () => {
    if (depositAmount <= 0) return;
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

  return (
    <div className="space-y-6 text-white max-w-2xl mx-auto">
      <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
        <button
          onClick={() => setProductType('insurance')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl font-black tracking-widest text-[14px] transition-all ${productType === 'insurance' ? 'bg-indigo-600/20 text-indigo-400 shadow-inner border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Shield size={16} /> 醫療保險
        </button>
        <button
          onClick={() => setProductType('deposit')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl font-black tracking-widest text-[14px] transition-all ${productType === 'deposit' ? 'bg-indigo-600/20 text-indigo-400 shadow-inner border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <PiggyBank size={16} /> 銀行定存
        </button>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-xl">
        {productType === 'insurance' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-wide text-white">醫療險</h3>
                <p className="text-sm font-medium text-slate-400 mt-1">遇到醫療支出時，可全額理賠</p>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">目前持有保單</span>
                <span className="text-lg font-black text-indigo-400">{medicalInsuranceCount} 份</span>
              </div>
              <div className="h-px w-full bg-slate-800" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">購買費用 (月支出增加)</span>
                <span className="text-2xl font-black text-white">$2,000</span>
              </div>
            </div>

            <button
              onClick={handleBuyInsurance}
              disabled={medicalInsuranceCount >= 1}
              className={`w-full py-4 rounded-2xl font-black tracking-widest text-[16px] transition-all ${
                medicalInsuranceCount >= 1
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]'
              }`}
            >
              {medicalInsuranceCount >= 1 ? '已達購買上限 (1份)' : '確認購買保險'}
            </button>
          </div>
        )}

        {productType === 'deposit' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                <PiggyBank size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-wide text-white">銀行定期存款</h3>
                <p className="text-sm font-medium text-slate-400 mt-1">每月可獲得 1% 穩定利息收入</p>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800 space-y-5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">目前可用現金</span>
                <span className="text-lg font-black text-emerald-400">${cash.toLocaleString()}</span>
              </div>
              
              <div className="space-y-3">
                <span className="text-sm font-bold text-slate-400 block">輸入定存金額</span>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setDepositAmount(Math.max(10000, depositAmount - 10000))}
                    className="w-12 h-12 rounded-xl bg-slate-800 text-slate-300 font-black text-xl hover:bg-slate-700"
                  >-</button>
                  <input
                    type="number"
                    value={depositAmount || ''}
                    onChange={(e) => setDepositAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 h-12 bg-slate-950 border border-slate-700 rounded-xl text-center text-xl font-black tracking-wider text-white"
                  />
                  <button 
                    onClick={() => setDepositAmount(Math.min(cash, depositAmount + 10000))}
                    className="w-12 h-12 rounded-xl bg-slate-800 text-slate-300 font-black text-xl hover:bg-slate-700"
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
              disabled={depositAmount <= 0 || cash < depositAmount}
              className={`w-full py-4 rounded-2xl font-black tracking-widest text-[16px] transition-all ${
                depositAmount <= 0 || cash < depositAmount
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]'
              }`}
            >
              確認辦理定存
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

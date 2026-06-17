import React, { useState } from 'react';
import { Landmark, ArrowRight, Wallet } from 'lucide-react';
import { TransactionData } from '../../types';

interface BankingViewProps {
  cash: number;
  liabilities: any[];
  onTransaction: (data: TransactionData) => void;
}

export const BankingView: React.FC<BankingViewProps> = ({ cash, liabilities, onTransaction }) => {
  const bankLoan = liabilities.find(l => l.type === '信用貸款' || l.id === 'bank_loan');
  const currentLoan = bankLoan ? bankLoan.totalOwed : 0;
  
  const [actionType, setActionType] = useState<'borrow' | 'repay'>('borrow');
  const [amount, setAmount] = useState<number>(100000);

  const interestRate = 0.1; // 10%
  const maxRepay = Math.min(cash, currentLoan);

  const handleTransact = () => {
    if (amount <= 0) return;
    
    if (actionType === 'borrow') {
      onTransaction({
        name: '銀行借款',
        amount: amount,
        cashChange: amount,
        source: 'cash',
        usage: 'loan',
        liabilityChange: {
          action: 'add',
          liability: {
            id: 'bank_loan',
            name: '信用貸款 (Legacy)',
            type: '信用貸款',
            totalOwed: amount,
            monthlyPayment: amount * interestRate
          }
        }
      });
    } else {
      onTransaction({
        name: '償還借款',
        amount: amount,
        cashChange: -amount,
        source: 'cash',
        usage: 'loan_repayment',
        liabilityChange: {
          action: 'repay',
          liabilityId: bankLoan?.id || 'bank_loan',
          amount: amount
        }
      });
    }
    setAmount(0);
  };

  return (
    <div className="space-y-6 text-white max-w-2xl mx-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/40 border border-slate-700/80 rounded-3xl p-5 shadow-inner flex flex-col justify-between">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Wallet size={16} />
            <span className="text-[13px] font-black tracking-widest">目前現金</span>
          </div>
          <div className="text-2xl font-black text-emerald-400">${cash.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/80 rounded-3xl p-5 shadow-inner flex flex-col justify-between">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Landmark size={16} />
            <span className="text-[13px] font-black tracking-widest">目前信貸總額</span>
          </div>
          <div className="text-2xl font-black text-rose-400">${currentLoan.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex bg-slate-900/80 p-1.5 rounded-2xl mb-8 border border-slate-800">
          <button
            onClick={() => { setActionType('borrow'); setAmount(100000); }}
            className={`flex-1 py-3 rounded-xl font-black tracking-widest text-[14px] transition-all ${actionType === 'borrow' ? 'bg-indigo-600/20 text-indigo-400 shadow-inner border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            我要借款
          </button>
          <button
            onClick={() => { setActionType('repay'); setAmount(Math.min(100000, currentLoan)); }}
            className={`flex-1 py-3 rounded-xl font-black tracking-widest text-[14px] transition-all ${actionType === 'repay' ? 'bg-emerald-600/20 text-emerald-400 shadow-inner border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            我要還款
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <span className="text-sm font-bold text-slate-400">交易金額</span>
            {actionType === 'repay' && (
              <button 
                onClick={() => setAmount(maxRepay)}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-900/30 px-3 py-1 rounded-lg"
              >
                最大還款額: ${maxRepay.toLocaleString()}
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setAmount(Math.max(0, amount - 10000))}
              className="w-14 h-14 rounded-2xl bg-slate-700 text-slate-300 font-black text-2xl flex items-center justify-center hover:bg-slate-600"
            >-</button>
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
              className="flex-1 h-14 bg-slate-900 border border-slate-700 rounded-2xl text-center text-3xl font-black tracking-wider text-white"
            />
            <button 
              onClick={() => setAmount(actionType === 'repay' ? Math.min(maxRepay, amount + 10000) : amount + 10000)}
              className="w-14 h-14 rounded-2xl bg-slate-700 text-slate-300 font-black text-2xl flex items-center justify-center hover:bg-slate-600"
            >+</button>
          </div>

          <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
            {actionType === 'borrow' ? (
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-400">每月新增利息負擔 (10%)</span>
                <span className="text-lg font-black text-rose-400">-${(amount * interestRate).toLocaleString()}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-400">每月減輕利息負擔</span>
                <span className="text-lg font-black text-emerald-400">+${(amount * interestRate).toLocaleString()}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleTransact}
            disabled={amount <= 0 || (actionType === 'repay' && amount > maxRepay)}
            className={`w-full py-4 rounded-2xl font-black tracking-widest text-[16px] transition-all flex items-center justify-center gap-2 ${
              amount <= 0 || (actionType === 'repay' && amount > maxRepay)
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : actionType === 'borrow' 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]'
            }`}
          >
            確認{actionType === 'borrow' ? '借款' : '還款'}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

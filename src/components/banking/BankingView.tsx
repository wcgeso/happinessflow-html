import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Landmark, Wallet } from 'lucide-react';
import { TransactionData } from '../../types';

interface BankingViewProps {
  cash: number;
  liabilities: any[];
  onTransaction: (data: TransactionData) => void;
}

const getLiabilityInterestLabel = (type: string) => {
  if (type === '強制負債') return null;
  if (type === '不動產貸款') return '不動產貸款利息';
  if (type === '企業貸款') return '企業貸款利息';
  if (type === '汽車貸款' || type === '飛行器貸款') return '汽車貸款利息';
  return '信貸利息';
};

const getLiabilityRate = (type: string) => (
  type === '信用貸款' ? 0.1 : type === '強制負債' ? 0 : 0.005
);

export const BankingView: React.FC<BankingViewProps> = ({ cash, liabilities, onTransaction }) => {
  const creditLiabilities = useMemo(
    () => liabilities.filter(l => l.type === '信用貸款'),
    [liabilities]
  );

  const currentLoan = creditLiabilities.reduce((sum, l) => sum + (l.totalOwed || 0), 0);
  const currentCreditInterest = creditLiabilities.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);

  const repayTargets = useMemo(() => {
    const targets: Array<{
      id: string;
      name: string;
      type: string;
      totalOwed: number;
      monthlyPayment: number;
    }> = [];

    if (currentLoan > 0) {
      targets.push({
        id: 'multiple_credit_loans',
        name: '信用貸款總額',
        type: '信用貸款',
        totalOwed: currentLoan,
        monthlyPayment: currentCreditInterest
      });
    }

    liabilities
      .filter(l => l.type !== '信用貸款' && l.totalOwed > 0)
      .forEach(liability => {
        targets.push({
          id: liability.id,
          name: liability.name,
          type: liability.type,
          totalOwed: liability.totalOwed,
          monthlyPayment: liability.monthlyPayment || 0
        });
      });

    return targets;
  }, [currentCreditInterest, currentLoan, liabilities]);

  const groupedRepayTargets = useMemo(() => {
    const groups = [
      { key: 'credit', title: '信用貸款', items: repayTargets.filter(target => target.type === '信用貸款') },
      { key: 'forced', title: '強制負債', items: repayTargets.filter(target => target.type === '強制負債') },
      { key: 'real_estate', title: '不動產貸款', items: repayTargets.filter(target => target.type === '不動產貸款') },
      { key: 'business', title: '企業貸款', items: repayTargets.filter(target => target.type === '企業貸款') },
      { key: 'car', title: '汽車貸款', items: repayTargets.filter(target => target.type === '汽車貸款' || target.type === '飛行器貸款') }
    ];

    return groups.filter(group => group.items.length > 0);
  }, [repayTargets]);

  const [actionType, setActionType] = useState<'borrow' | 'repay'>('borrow');
  const [amount, setAmount] = useState<number>(100000);
  const [selectedRepayTargetId, setSelectedRepayTargetId] = useState<string>('multiple_credit_loans');

  useEffect(() => {
    if (repayTargets.length === 0) {
      setSelectedRepayTargetId('');
      return;
    }

    if (!repayTargets.some(target => target.id === selectedRepayTargetId)) {
      setSelectedRepayTargetId(repayTargets[0].id);
    }
  }, [repayTargets, selectedRepayTargetId]);

  const selectedRepayTarget = repayTargets.find(target => target.id === selectedRepayTargetId) || null;
  const maxRepay = actionType === 'repay'
    ? Math.min(cash, selectedRepayTarget?.totalOwed || 0)
    : 0;

  const handleTransact = () => {
    if (amount <= 0) return;

    if (actionType === 'borrow') {
      onTransaction({
        name: '申請信用貸款',
        amount,
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
            monthlyPayment: amount * 0.1
          }
        }
      });
      setAmount(0);
      return;
    }

    if (!selectedRepayTarget) return;
    if (amount > cash) return;
    if (amount > selectedRepayTarget.totalOwed) return;

    const interestLabel = getLiabilityInterestLabel(selectedRepayTarget.type);
    const liabilityLabel = selectedRepayTarget.type === '信用貸款'
      ? '信用貸款'
      : selectedRepayTarget.type === '強制負債'
        ? '強制負債'
      : selectedRepayTarget.type === '飛行器貸款'
        ? '汽車貸款'
        : selectedRepayTarget.type;

    onTransaction({
      name: selectedRepayTarget.id === 'multiple_credit_loans'
        ? '償還信用貸款'
        : `償還 ${selectedRepayTarget.name}`,
      amount,
      cashChange: -amount,
      source: 'cash',
      usage: 'liability',
      liabilityId: selectedRepayTarget.id,
      impacts: [
        `現金 -${amount.toLocaleString()}`,
        `${liabilityLabel} -${amount.toLocaleString()}`,
        ...(interestLabel ? [`${interestLabel} 減少`] : [])
      ],
      financialCheckEntries: [
        { category: 'Assets', name: '現金', direction: 'Decrease' },
        { category: 'Liabilities', name: liabilityLabel, direction: 'Decrease' },
        ...(interestLabel ? [{ category: 'Expenses', name: interestLabel, direction: 'Decrease' as const }] : [])
      ]
    });
    setAmount(0);
  };

  const repayRate = selectedRepayTarget ? getLiabilityRate(selectedRepayTarget.type) : 0;
  const totalDebt = liabilities.reduce((sum, liability) => sum + (liability.totalOwed || 0), 0);
  const disableConfirm = amount <= 0 || (actionType === 'repay' && (!selectedRepayTarget || amount > maxRepay));

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
            <span className="text-[13px] font-black tracking-widest">目前貸款總額</span>
          </div>
          <div className="text-2xl font-black text-rose-400">${totalDebt.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex bg-slate-900/80 p-1.5 rounded-2xl mb-8 border border-slate-800">
          <button
            onClick={() => { setActionType('borrow'); setAmount(100000); }}
            className={`flex-1 py-3 rounded-xl font-black tracking-widest text-[14px] transition-all ${actionType === 'borrow' ? 'bg-indigo-600/20 text-indigo-400 shadow-inner border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            申請信貸
          </button>
          <button
            onClick={() => { setActionType('repay'); setAmount(Math.min(100000, Math.min(cash, selectedRepayTarget?.totalOwed || 0))); }}
            className={`flex-1 py-3 rounded-xl font-black tracking-widest text-[14px] transition-all ${actionType === 'repay' ? 'bg-emerald-600/20 text-emerald-400 shadow-inner border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            償還各類貸款
          </button>
        </div>

        <div className="space-y-6">
          {actionType === 'repay' && (
              <div className="space-y-3">
                <div className="text-sm font-bold text-slate-400">選擇要償還的貸款</div>
                <div className="grid gap-3">
                {groupedRepayTargets.length > 0 ? groupedRepayTargets.map(group => (
                  <div key={group.key} className="space-y-2">
                    <div className="px-1 text-xs font-black tracking-[0.18em] text-slate-500">{group.title}</div>
                    {group.items.map(target => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => {
                          setSelectedRepayTargetId(target.id);
                          setAmount(Math.min(100000, Math.min(cash, target.totalOwed)));
                        }}
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                          selectedRepayTargetId === target.id
                            ? 'border-emerald-500/60 bg-emerald-500/10'
                            : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-base font-black text-white">{target.name}</div>
                            <div className="mt-1 text-xs font-bold text-slate-400">{target.type === '飛行器貸款' ? '汽車貸款' : target.type}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-black text-rose-400">${target.totalOwed.toLocaleString()}</div>
                            <div className="text-xs font-medium text-slate-500">月利息 ${target.monthlyPayment.toLocaleString()}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )) : (
                  <div className="rounded-2xl border border-slate-700 bg-slate-900/40 px-4 py-5 text-sm font-bold text-slate-500">
                    目前沒有可償還的貸款
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-end">
            <span className="text-sm font-bold text-slate-400">交易金額</span>
            {actionType === 'repay' && selectedRepayTarget && (
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
                <span className="text-lg font-black text-rose-400">-${(amount * 0.1).toLocaleString()}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-400">
                  {selectedRepayTarget ? `每月減輕${selectedRepayTarget.type === '飛行器貸款' ? '汽車' : selectedRepayTarget.type}利息` : '每月減輕利息負擔'}
                </span>
                <span className="text-lg font-black text-emerald-400">+${Math.floor(amount * repayRate).toLocaleString()}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleTransact}
            disabled={disableConfirm}
            className={`w-full py-4 rounded-2xl font-black tracking-widest text-[16px] transition-all flex items-center justify-center gap-2 ${
              disableConfirm
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : actionType === 'borrow'
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]'
            }`}
          >
            確認{actionType === 'borrow' ? '申請貸款' : '償還貸款'}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Landmark, Wallet } from 'lucide-react';
import { TransactionData } from '../../types';
import { getCreditLimit, getOutstandingCreditPrincipal, getRemainingCreditCapacity } from '../../utils/financialRules';

interface BankingViewProps {
  cash: number;
  salary: number;
  liabilities: any[];
  legacyLoans?: number;
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

export const BankingView: React.FC<BankingViewProps> = ({ cash, salary, liabilities, legacyLoans = 0, onTransaction }) => {
  const creditLiabilities = useMemo(
    () => liabilities.filter(l => l.type === '信用貸款'),
    [liabilities]
  );

  const currentLoan = creditLiabilities.reduce((sum, l) => sum + (l.totalOwed || 0), 0) + legacyLoans;
  const currentCreditInterest = creditLiabilities.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0) + Math.floor(legacyLoans * 0.1);
  const creditLimit = getCreditLimit(salary);
  const creditUsed = getOutstandingCreditPrincipal(liabilities, legacyLoans);
  const remainingCredit = getRemainingCreditCapacity(salary, liabilities, legacyLoans);

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
      if (amount > remainingCredit) return;
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
        ...(interestLabel ? [{ category: 'Expenses' as const, name: interestLabel, direction: 'Decrease' as const }] : [])
      ]
    });
    setAmount(0);
  };

  const repayRate = selectedRepayTarget ? getLiabilityRate(selectedRepayTarget.type) : 0;
  const totalDebt = liabilities.reduce((sum, liability) => sum + (liability.totalOwed || 0), 0) + legacyLoans;
  const disableConfirm = amount <= 0 ||
    (actionType === 'borrow' && amount > remainingCredit) ||
    (actionType === 'repay' && (!selectedRepayTarget || amount > maxRepay));

  return (
    <div className="mx-auto max-w-2xl space-y-3 text-white sm:space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="flex flex-col justify-between rounded-2xl border border-slate-700/80 bg-slate-800/40 p-3 shadow-inner sm:rounded-3xl sm:p-5">
          <div className="mb-1 flex items-center gap-1.5 text-slate-400 sm:mb-2 sm:gap-2">
            <Wallet size={16} />
            <span className="text-[11px] font-black tracking-wide sm:text-[13px] sm:tracking-widest">目前現金</span>
          </div>
          <div className="truncate text-lg font-black text-emerald-400 sm:text-2xl">${cash.toLocaleString()}</div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-slate-700/80 bg-slate-800/40 p-3 shadow-inner sm:rounded-3xl sm:p-5">
          <div className="mb-1 flex items-center gap-1.5 text-slate-400 sm:mb-2 sm:gap-2">
            <Landmark size={16} />
            <span className="text-[11px] font-black tracking-wide sm:text-[13px] sm:tracking-widest">目前貸款總額</span>
          </div>
          <div className="truncate text-lg font-black text-rose-400 sm:text-2xl">${totalDebt.toLocaleString()}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/80 bg-slate-800/40 p-3 text-xs sm:rounded-3xl sm:p-5 sm:text-sm">
        <div className="flex items-center justify-between gap-3 font-black text-slate-300">
          <span>信貸額度（工作收入 × 10）</span>
          <span className="text-cyan-300">${creditLimit.toLocaleString()}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 font-bold text-slate-400">
          <span>已使用／剩餘</span>
          <span>${creditUsed.toLocaleString()} ／ ${remainingCredit.toLocaleString()}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3 shadow-xl sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex rounded-xl border border-slate-800 bg-slate-900/80 p-1 sm:mb-8 sm:rounded-2xl sm:p-1.5">
          <button
            onClick={() => { setActionType('borrow'); setAmount(100000); }}
            className={`flex-1 rounded-lg py-2.5 text-xs font-black tracking-wide transition-all sm:rounded-xl sm:py-3 sm:text-[14px] sm:tracking-widest ${actionType === 'borrow' ? 'bg-indigo-600/20 text-indigo-400 shadow-inner border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            申請信貸
          </button>
          <button
            onClick={() => { setActionType('repay'); setAmount(Math.min(100000, Math.min(cash, selectedRepayTarget?.totalOwed || 0))); }}
            className={`flex-1 rounded-lg py-2.5 text-xs font-black tracking-wide transition-all sm:rounded-xl sm:py-3 sm:text-[14px] sm:tracking-widest ${actionType === 'repay' ? 'bg-emerald-600/20 text-emerald-400 shadow-inner border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            償還各類貸款
          </button>
        </div>

        <div className="space-y-3 sm:space-y-6">
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
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all sm:rounded-2xl sm:px-4 sm:py-4 ${
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
                          <div className="text-base font-black text-rose-400 sm:text-lg">${target.totalOwed.toLocaleString()}</div>
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

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setAmount(Math.max(0, amount - 10000))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-xl font-black text-slate-300 hover:bg-slate-600 sm:h-14 sm:w-14 sm:rounded-2xl sm:text-2xl"
            >-</button>
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 text-center text-xl font-black tracking-wide text-white sm:h-14 sm:rounded-2xl sm:text-3xl sm:tracking-wider"
            />
            <button
              onClick={() => setAmount(actionType === 'repay' ? Math.min(maxRepay, amount + 10000) : amount + 10000)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-xl font-black text-slate-300 hover:bg-slate-600 sm:h-14 sm:w-14 sm:rounded-2xl sm:text-2xl"
            >+</button>
          </div>
          {actionType === 'borrow' && amount > remainingCredit && (
            <div className="text-xs font-bold text-rose-300">超過剩餘信貸額度，最多可借 ${remainingCredit.toLocaleString()}</div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:rounded-2xl sm:p-4">
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
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black tracking-wide transition-all sm:rounded-2xl sm:py-4 sm:text-[16px] sm:tracking-widest ${
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

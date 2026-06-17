import React, { useMemo, useState } from 'react';
import { CheckCircle2, X, HelpCircle } from 'lucide-react';
import { AccountCategory, AccountEntry, ChangeDirection, TransactionData } from '../../types';
import { FinancialCheckBoard } from '../transaction/FinancialCheckBoard';
import { Button } from '../ui/ui';

interface BoardFinancialCheckModalProps {
  title: string;
  txData: TransactionData;
  expectedEntries: AccountEntry[];
  onApply: (txData: TransactionData) => void;
  onClose: () => void;
}

const DEFAULT_ITEMS = {
  Assets: ['現金', '股票', '定存', '飛行器', '不動產', '企業', '現金（企業貸款）'],
  Liabilities: ['信用貸款', '不動產貸款', '企業貸款', '飛行器貸款'],
  Income: ['租金收入', '企業收益', '定存利息'],
  Expenses: ['信貸利息', '不動產貸款利息', '企業貸款利息', '飛行器貸款利息', '保險支出', '餐飲、服飾、居住類', '交通、教育、娛樂類', '其他、醫療、育兒類']
};

export const BoardFinancialCheckModal: React.FC<BoardFinancialCheckModalProps> = ({
  title,
  txData,
  expectedEntries,
  onApply,
  onClose
}) => {
  const [userEntries, setUserEntries] = useState<AccountEntry[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedSummary = useMemo(() => {
    return userEntries.map(entry => ({
      key: `${entry.category}_${entry.name}_${entry.direction}`,
      label: `${entry.name}${entry.direction === 'Increase' ? '增加' : '減少'}`,
      tone: entry.direction === 'Increase'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
    }));
  }, [userEntries]);

  const impactSummary = useMemo(() => {
    return (txData.impacts || []).slice(0, 4).map((impact, index) => {
      const isNegative = impact.includes('-');
      const isPositive = impact.includes('+');
      return {
        key: `${impact}_${index}`,
        text: impact,
        tone: isNegative
          ? 'border-rose-500/25 bg-rose-500/10 text-rose-100'
          : isPositive
            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
            : 'border-slate-700 bg-slate-900/80 text-slate-100'
      };
    });
  }, [txData.impacts]);

  const possibleItems = useMemo(() => {
    const merge = (category: AccountCategory, defaults: string[]) => {
      const fromExpected = expectedEntries
        .filter(entry => entry.category === category)
        .map(entry => entry.name);
      return Array.from(new Set([...defaults, ...fromExpected]));
    };

    return {
      assets: merge('Assets', DEFAULT_ITEMS.Assets),
      liabilities: merge('Liabilities', DEFAULT_ITEMS.Liabilities),
      income: merge('Income', DEFAULT_ITEMS.Income),
      expenses: merge('Expenses', DEFAULT_ITEMS.Expenses)
    };
  }, [expectedEntries]);

  const toggleEntry = (category: AccountCategory, direction: ChangeDirection, name: string) => {
    setUserEntries(prev => {
      const idx = prev.findIndex(entry => entry.category === category && entry.name === name);
      if (idx !== -1) {
        if (prev[idx].direction === direction) return prev.filter((_, index) => index !== idx);
        const next = [...prev];
        next[idx] = { ...next[idx], direction };
        return next;
      }
      return [...prev, { category, name, direction }];
    });
  };

  const handleVerify = () => {
    const isCorrect =
      expectedEntries.length === userEntries.length &&
      expectedEntries.every(expected =>
        userEntries.some(entry =>
          entry.category === expected.category &&
          entry.name === expected.name &&
          entry.direction === expected.direction
        )
      );

    if (!isCorrect) {
      const missingCount = Math.max(expectedEntries.length - userEntries.length, 0);
      setErrorMessage(
        missingCount > 0
          ? `還有 ${missingCount} 個項目尚未完成，請再檢查一次。`
          : '方向或項目仍有錯誤，請再檢查現金、收入或負債變化。'
      );
      return;
    }

    setErrorMessage(null);
    setIsVerified(true);
  };

  return (
    <div className="fixed inset-0 z-[10020] bg-slate-950 text-white animate-in fade-in duration-200">
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-slate-800 bg-slate-950/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-slate-300 transition-colors hover:text-white"
              title="關閉"
            >
              <X size={20} />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Financial Check</div>
              <h3 className="mt-1 flex items-center justify-center gap-2 text-lg font-black text-white">
                <HelpCircle className="text-yellow-400" size={18} /> 財務檢核
              </h3>
            </div>
            <div className="w-11" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-36 no-scrollbar">
          {!isVerified ? (
            <div className="animate-in fade-in duration-300">
              <div className="mb-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center gap-2 text-blue-200">
                  <HelpCircle size={16} />
                  <span className="text-sm font-bold">請問這張卡會如何影響財務報表？</span>
                </div>
                <div className="mt-3 text-sm font-bold leading-relaxed text-slate-100">{title}</div>
                {txData.impacts && txData.impacts.length > 0 && (
                  <>
                    <div className="mt-4 text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">事件重點</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {impactSummary.map(item => (
                        <div
                          key={item.key}
                          className={`rounded-2xl border px-3 py-3 text-sm font-bold leading-snug ${item.tone}`}
                        >
                          {item.text}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {selectedSummary.length > 0 && (
                <div className="mb-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">目前已選</div>
                    <div className="text-xs font-bold text-slate-400">{selectedSummary.length} 項</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedSummary.map(item => (
                      <div
                        key={item.key}
                        className={`rounded-full border px-3 py-1.5 text-xs font-black ${item.tone}`}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <FinancialCheckBoard
                possibleItemsAssets={possibleItems.assets}
                possibleItemsIncome={possibleItems.income}
                possibleItemsLiabilities={possibleItems.liabilities}
                possibleItemsExpenses={possibleItems.expenses}
                userEntries={userEntries}
                onToggle={toggleEntry}
              />

              {errorMessage && (
                <div className="mt-4 rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-300">
                  {errorMessage}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
              <div className="rounded-full bg-emerald-500/15 p-4 text-emerald-400">
                <CheckCircle2 size={40} />
              </div>
              <div className="mt-5 text-2xl font-black text-white">檢核完成</div>
              <div className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
                已完成這次財務檢核，關閉後會回到遊戲流程。
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-800 bg-slate-950/95 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur-xl">
          {!isVerified ? (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1 py-3 text-sm">
                取消
              </Button>
              <Button onClick={handleVerify} className="flex-[1.4] bg-emerald-600 py-3 text-sm font-bold hover:bg-emerald-500">
                確認檢核答案
              </Button>
            </div>
          ) : (
            <div className="flex">
              <Button onClick={() => onApply(txData)} className="w-full bg-cyan-400 py-3 font-black text-slate-950 hover:bg-cyan-300">
                關閉
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

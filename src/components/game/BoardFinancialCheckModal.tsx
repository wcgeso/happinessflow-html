import React, { useEffect, useMemo, useState } from 'react';
import { X, HelpCircle, PartyPopper } from 'lucide-react';
import { AccountCategory, AccountEntry, ChangeDirection, TransactionData } from '../../types';
import { FinancialCheckBoard } from '../transaction/FinancialCheckBoard';
import { Button } from '../ui/ui';

interface BoardFinancialCheckModalProps {
  title: string;
  txData: TransactionData;
  expectedEntries: AccountEntry[];
  onApply: (txData: TransactionData) => Promise<boolean | void> | boolean | void;
  onClose: () => void;
  isCompleted?: boolean;
}

const DEFAULT_ITEMS = {
  Assets: ['現金', '定存', '汽車', '企業', '現金（企業貸款）'],
  Liabilities: ['信用貸款', '不動產貸款', '企業貸款', '汽車貸款'],
  Income: ['租金收入', '企業收益', '定存利息'],
  Expenses: ['信貸利息', '不動產貸款利息', '企業貸款利息', '汽車貸款利息', '保險支出', '餐飲、服飾、居住類', '交通、教育、娛樂類', '其他、醫療、育兒類']
};

export const BoardFinancialCheckModal: React.FC<BoardFinancialCheckModalProps> = ({
  title,
  txData,
  expectedEntries,
  onApply,
  onClose,
  isCompleted = false
}) => {
  const [userEntries, setUserEntries] = useState<AccountEntry[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setUserEntries([]);
    setIsVerified(false);
    setIsApplied(false);
    setIsApplying(false);
    setErrorMessage(null);
  }, [title, txData.name]);

  useEffect(() => {
    if (isCompleted) {
      setIsApplied(true);
    }
  }, [isCompleted]);

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
          : '方向或項目仍有錯誤，請再檢查各欄位的增減變化。'
      );
      return;
    }

    setErrorMessage(null);
    setIsVerified(true);
    void handleApply();
  };

  const handleApply = async () => {
    if (isApplying) return;
    setIsApplying(true);
    try {
      const result = await onApply(txData);
      if (result !== false) {
        setIsApplied(true);
      } else {
        setIsVerified(false);
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10020] bg-black/92 text-white animate-in fade-in duration-200">
      <div className="flex h-full items-center justify-center px-4 py-6 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="flex h-full max-h-[920px] w-full max-w-[870px] flex-col overflow-hidden rounded-[30px] border border-[#4c5a73] bg-[#171f33] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
          <div className="shrink-0 border-b border-[#3b4760] bg-[#283247] px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-yellow-400/50 bg-[#202a3d] text-yellow-400">
                  <HelpCircle size={24} />
                </div>
                <h3 className="text-[clamp(1.8rem,2.5vw,2.4rem)] font-black tracking-tight text-white">
                  財務檢核
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-[clamp(1.25rem,1.9vw,1.8rem)] font-black text-slate-400 transition-colors hover:text-white"
                title="取消"
              >
                取消
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">
          {!isApplied ? (
            <div className="animate-in fade-in duration-300">
              <div className="mb-5 rounded-[22px] border border-[#243665] bg-[#1d2740] px-6 py-5 text-center">
                <div className="text-[clamp(1.1rem,1.6vw,1.6rem)] font-black tracking-tight text-[#93a4c7]">
                  請問此筆交易如何影響財務報表？
                </div>
              </div>

              <FinancialCheckBoard
                possibleItemsAssets={possibleItems.assets}
                possibleItemsIncome={possibleItems.income}
                possibleItemsLiabilities={possibleItems.liabilities}
                possibleItemsExpenses={possibleItems.expenses}
                userEntries={userEntries}
                onToggle={toggleEntry}
              />

              {errorMessage && (
                <div className="mt-4 rounded-[18px] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-300">
                  {errorMessage}
                </div>
              )}
              {isApplying && (
                <div className="mt-4 rounded-[18px] border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-100">
                  正在套用交易，請稍候...
                </div>
              )}
              {isVerified && !isApplying && !isApplied && (
                <div className="mt-4 rounded-[18px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100">
                  請先完成周轉，再回來重新確認並套用交易。
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
              <div className="rounded-full bg-cyan-400/15 p-4 text-cyan-300">
                <PartyPopper size={40} />
              </div>
              <div className="mt-5 text-2xl font-black text-white">交易完成</div>
              <div className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
                這筆交易已經完成，財務狀態也已同步更新。
              </div>
              {txData.impacts && txData.impacts.length > 0 && (
                <div className="mt-5 grid w-full max-w-md gap-2">
                  {txData.impacts.map((impact, index) => (
                    <div
                      key={`${impact}_${index}`}
                      className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-100"
                    >
                      {impact}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 max-w-md text-xs leading-relaxed text-slate-500">
                關閉後會依照事件順序繼續下一個流程。
              </div>
            </div>
          )}
          </div>

          <div className="shrink-0 border-t border-[#313d57] bg-[#171f33] px-6 py-5">
          {!isApplied ? (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1 rounded-[18px] bg-[#44526b] py-4 text-lg font-black text-white hover:bg-[#50607c]" disabled={isApplying}>
                上一步
              </Button>
              <Button
                onClick={handleVerify}
                disabled={isApplying}
                className="flex-[1.4] rounded-[18px] bg-[#21c488] py-4 text-lg font-black text-white hover:bg-[#29d394] disabled:opacity-60"
              >
                {isApplying ? '處理中...' : '確認檢核答案'}
              </Button>
            </div>
          ) : (
            <div className="flex">
              <Button onClick={onClose} className="w-full rounded-[18px] bg-[#21c488] py-4 text-lg font-black text-white hover:bg-[#29d394]">
                返回遊戲
              </Button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

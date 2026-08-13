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
  Assets: ['現金', '定存', '汽車', '現金（企業貸款）'],
  Liabilities: ['信用貸款', '不動產貸款', '企業貸款', '汽車貸款'],
  Income: ['租金收入', '企業收益', '定存利息'],
  Expenses: ['信貸利息', '不動產貸款利息', '企業貸款利息', '汽車貸款利息', '保險支出', '餐飲、服飾、居住類', '交通、教育、娛樂類', '其他、醫療、育兒類']
};

const ENTRY_LABEL: Record<ChangeDirection, string> = {
  Increase: '增加',
  Decrease: '減少'
};

const CATEGORY_LABEL: Record<AccountCategory, string> = {
  Assets: '資產',
  Liabilities: '負債',
  Income: '收入',
  Expenses: '支出'
};

const STARTUP_LOAN_SYMBOLS = new Set(['N056', 'N057', 'N058']);

const expenseCategoryLabel = (category: 'basicLiving' | 'transportEdu' | 'otherMedicalChild') => {
  if (category === 'basicLiving') return '餐飲、服飾、居住類';
  if (category === 'transportEdu') return '交通、教育、娛樂類';
  return '其他、醫療、育兒類';
};

const normalizeExpenseEntry = (
  normalized: AccountEntry[],
  category: 'basicLiving' | 'transportEdu' | 'otherMedicalChild',
  direction: ChangeDirection
) => {
  const inferredExpenseEntry: AccountEntry = {
    category: 'Expenses',
    name: expenseCategoryLabel(category),
    direction
  };

  const withoutMismatchedExpenseEntries = normalized.filter(entry => !(
    entry.category === 'Expenses' &&
    entry.direction === inferredExpenseEntry.direction &&
    entry.name !== inferredExpenseEntry.name &&
    DEFAULT_ITEMS.Expenses.includes(entry.name)
  ));

  normalized.length = 0;
  normalized.push(...withoutMismatchedExpenseEntries);

  if (!normalized.some(entry =>
    entry.category === inferredExpenseEntry.category &&
    entry.name === inferredExpenseEntry.name &&
    entry.direction === inferredExpenseEntry.direction
  )) {
    normalized.push(inferredExpenseEntry);
  }
};

export const normalizeExpectedEntries = (entries: AccountEntry[], txData: TransactionData) => {
  const normalized = [...entries];

  if (txData.expensePayload) {
    if (txData.expensePayload.category !== 'tax') {
      normalizeExpenseEntry(
        normalized,
        txData.expensePayload.category,
        txData.expensePayload.isIncrease ? 'Increase' : 'Decrease'
      );
    }
  }

  if (txData.happinessEventPayload?.monthlyExpenseChange && txData.happinessEventPayload.expenseCategory) {
    const category = txData.happinessEventPayload.expenseCategory;
    if (category === 'basicLiving' || category === 'transportEdu' || category === 'otherMedicalChild') {
      normalizeExpenseEntry(
        normalized,
        category,
        'Increase'
      );
    }
  }

  const symbol = txData.assetDetails?.symbol || txData.name.match(/N\d{3}/)?.[0];
  const isStartupLoan =
    txData.source === 'loan' &&
    txData.usage === 'asset' &&
    txData.assetDetails?.type === '企業' &&
    !!symbol &&
    STARTUP_LOAN_SYMBOLS.has(symbol);

  if (!isStartupLoan) {
    return normalized;
  }

  const startupLoanEntries: AccountEntry[] = [
    { category: 'Assets', name: '現金', direction: 'Decrease' },
    { category: 'Assets', name: '現金（企業貸款）', direction: 'Increase' },
    { category: 'Assets', name: `${symbol} 兼職工作室`, direction: 'Increase' },
    { category: 'Liabilities', name: '企業貸款', direction: 'Increase' },
    { category: 'Expenses', name: '企業貸款利息', direction: 'Increase' }
  ];

  startupLoanEntries.forEach(entry => {
    if (!normalized.some(item =>
      item.category === entry.category &&
      item.name === entry.name &&
      item.direction === entry.direction
    )) {
      normalized.push(entry);
    }
  });

  return normalized;
};

export const getFinancialCheckFeedback = (
  expectedEntries: AccountEntry[],
  userEntries: AccountEntry[],
  attempt: number
) => {
  const entryKey = (entry: AccountEntry) => `${entry.category}:${entry.name}:${entry.direction}`;
  const expectedKeys = new Set(expectedEntries.map(entryKey));
  const userKeys = new Set(userEntries.map(entryKey));
  const missingEntries = expectedEntries.filter(entry => !userKeys.has(entryKey(entry)));
  const unexpectedEntries = userEntries.filter(entry => !expectedKeys.has(entryKey(entry)));
  const affectedCategories = Array.from(new Set(
    [...missingEntries, ...unexpectedEntries].map(entry => entry.category)
  ));
  const wrongCount = missingEntries.length + unexpectedEntries.length;

  if (wrongCount === 0) {
    return { isCorrect: true, wrongCount: 0, affectedCategories, lines: [] as string[] };
  }

  if (attempt <= 1) {
    return {
      isCorrect: false,
      wrongCount,
      affectedCategories,
      lines: [
        `目前有 ${wrongCount} 處錯誤，請重新檢查。`,
        `需要檢查的分類：${affectedCategories.map(category => CATEGORY_LABEL[category]).join('、')}`
      ]
    };
  }

  return {
    isCorrect: false,
    wrongCount,
    affectedCategories,
    lines: expectedEntries.length > 0
      ? expectedEntries.map(entry => `${CATEGORY_LABEL[entry.category]}：${entry.name}（${ENTRY_LABEL[entry.direction]}）`)
      : ['方向或項目仍有錯誤，請再檢查各欄位的增減變化。']
  };
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
  const [errorPopup, setErrorPopup] = useState<{ title: string; lines: string[] } | null>(null);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [highlightedCategories, setHighlightedCategories] = useState<AccountCategory[]>([]);
  const normalizedExpectedEntries = useMemo(
    () => normalizeExpectedEntries(expectedEntries, txData),
    [expectedEntries, txData]
  );

  useEffect(() => {
    setUserEntries([]);
    setIsVerified(false);
    setIsApplied(false);
    setIsApplying(false);
    setErrorPopup(null);
    setVerificationAttempts(0);
    setHighlightedCategories([]);
  }, [title, txData, expectedEntries]);

  useEffect(() => {
    if (isCompleted) {
      setIsApplied(true);
    }
  }, [isCompleted]);

  const possibleItems = useMemo(() => {
    const merge = (category: AccountCategory, defaults: string[]) => {
      const fromExpected = normalizedExpectedEntries
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
  }, [normalizedExpectedEntries]);

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
    const attempt = verificationAttempts + 1;
    setVerificationAttempts(attempt);
    const feedback = getFinancialCheckFeedback(normalizedExpectedEntries, userEntries, attempt);

    if (!feedback.isCorrect) {
      setErrorPopup({
        title: attempt <= 1 ? '財務檢核需要再確認' : '財務檢核答案錯誤',
        lines: feedback.lines
      });
      setHighlightedCategories(feedback.affectedCategories);
      return;
    }

    setErrorPopup(null);
    setHighlightedCategories([]);
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
        setErrorPopup({
          title: '交易尚未正式完成',
          lines: ['請先排除現金不足或前一步流程阻塞後再重新檢核。']
        });
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10050] bg-[#102f38]/90 text-[#293a38] animate-in fade-in duration-200">
      <div className="h-full">
        <div className="flex h-full w-full flex-col overflow-hidden bg-[#f7f0e3]">
          <div className="shrink-0 border-b border-[#d8c29a] bg-[#fffaf2] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] sm:px-5 sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d8c29a] bg-[#f4e6d0] text-[#8c5b2b] sm:h-10 sm:w-10">
                  <HelpCircle size={20} />
                </div>
                <h3 className="text-xl font-black tracking-tight text-[#293a38] sm:text-2xl">
                  財務檢核
                </h3>
              </div>
              <button
                onClick={onClose}
                className="min-h-10 rounded-xl px-3 text-base font-black text-[#76573a] transition-colors hover:bg-[#f4e6d0] sm:text-lg"
                title="取消"
              >
                取消
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 no-scrollbar sm:px-5 sm:py-4">
          {!isApplied ? (
            <div className="flex min-h-full flex-col animate-in fade-in duration-300">
              <div className="mb-2 rounded-2xl border border-[#e5cfac] bg-[#fffaf2] px-3 py-2.5 text-center sm:mb-3 sm:py-3">
                <div className="text-sm font-black tracking-tight text-[#76573a] sm:text-base">
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
                highlightedCategories={highlightedCategories}
              />

              {isApplying && (
                <div className="mt-4 rounded-[18px] border border-[#7dcbb1] bg-[#e7f5ed] px-4 py-3 text-sm font-bold text-[#286a59]">
                  正在套用交易，請稍候...
                </div>
              )}
              {isVerified && !isApplying && !isApplied && (
                <div className="mt-4 rounded-[18px] border border-[#e3bd78] bg-[#fff2d8] px-4 py-3 text-sm font-bold text-[#8c5b2b]">
                  請先完成周轉，再回來重新確認並套用交易。
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
              <div className="rounded-full bg-[#dff3eb] p-4 text-[#168269]">
                <PartyPopper size={40} />
              </div>
              <div className="mt-5 text-2xl font-black text-[#293a38]">交易完成</div>
              <div className="mt-3 max-w-md text-sm leading-relaxed text-[#765f47]">
                這筆交易已經完成，財務狀態也已同步更新。
              </div>
              {txData.impacts && txData.impacts.length > 0 && (
                <div className="mt-5 grid w-full max-w-md gap-2">
                  {txData.impacts.map((impact, index) => (
                    <div
                      key={`${impact}_${index}`}
                      className="rounded-2xl border border-[#a8dcc8] bg-[#e7f5ed] px-4 py-3 text-sm font-bold text-[#286a59]"
                    >
                      {impact}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 max-w-md text-xs leading-relaxed text-[#7a6958]">
                關閉後會依照事件順序繼續下一個流程。
              </div>
            </div>
          )}
          </div>

          <div className="shrink-0 border-t border-[#d8c29a] bg-[#fffaf2] px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:px-5 sm:pt-4">
          {!isApplied ? (
            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-[#d8c29a] bg-[#f4e6d0] py-2.5 text-sm font-black text-[#76573a] hover:bg-[#ead7b8] sm:text-base" disabled={isApplying}>
                上一步
              </Button>
              <Button
                onClick={handleVerify}
                disabled={isApplying}
                className="min-h-11 flex-[1.4] rounded-xl bg-[#168269] py-2.5 text-sm font-black text-white hover:bg-[#106b58] disabled:opacity-60 sm:text-base"
              >
                {isApplying ? '處理中...' : '確認檢核答案'}
              </Button>
            </div>
          ) : (
            <div className="flex">
              <Button onClick={onClose} className="min-h-11 w-full rounded-xl bg-[#168269] py-2.5 text-base font-black text-white hover:bg-[#106b58]">
                返回遊戲
              </Button>
            </div>
          )}
        </div>
        </div>
      </div>

      {errorPopup && (
        <div className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-[#e7a3a8] bg-[#fffaf2] p-6 shadow-2xl">
            <div className="text-center">
              <div className="text-lg font-black text-[#b54155]">{errorPopup.title}</div>
              <div className="mt-3 text-sm font-bold leading-relaxed text-[#765f47]">
                請依下列正確答案重新檢查：
              </div>
            </div>
            <ul className="mt-5 space-y-2">
              {errorPopup.lines.map((line, index) => (
                <li
                  key={`${line}_${index}`}
                    className="rounded-2xl border border-[#ead6b9] bg-[#f8eee0] px-4 py-3 text-sm font-bold leading-relaxed text-[#5f4933]"
                >
                  <span className="mr-2 text-[#b54155]">•</span>
                  {line}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setErrorPopup(null)}
              className="mt-6 w-full rounded-2xl bg-[#b54155] px-4 py-3 text-base font-black text-white transition hover:bg-[#943446]"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

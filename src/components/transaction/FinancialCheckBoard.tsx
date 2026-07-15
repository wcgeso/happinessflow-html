import React, { useState } from 'react';
import { X, PieChart, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { AccountEntry, AccountCategory, ChangeDirection } from '../../types';

interface QuadrantProps {
    title: string;
    color: string;
    icon: React.ReactNode;
    items: string[];
    userEntries: AccountEntry[];
    onToggle: (item: string, direction: ChangeDirection) => void;
    isHighlighted: boolean;
}

const Quadrant: React.FC<QuadrantProps> = ({ title, color, icon, items, userEntries, onToggle, isHighlighted }) => {
    const [internalSelected, setInternalSelected] = useState<string>('');
    const selectedItem = items.includes(internalSelected) ? internalSelected : (items[0] || '');

    return (
        <section className={`flex min-h-0 flex-col rounded-2xl border p-2 sm:p-3 ${color} ${isHighlighted ? 'ring-2 ring-[#d49a3a] shadow-[0_0_20px_rgba(212,154,58,0.24)]' : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'}`}>
            <div className="flex items-start justify-between gap-2 border-b border-[#e5cfac] pb-1.5 sm:pb-2">
                <div className="flex items-center gap-2 text-[#293a38]">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f4e6d0] sm:h-8 sm:w-8">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-black sm:text-base">{title}</div>
                        {isHighlighted && <div className="mt-1 text-[10px] font-black text-[#8c5b2b]">請重新檢查此分類</div>}
                    </div>
                </div>
            </div>

            <div className="mt-2 min-h-8 flex-1 overflow-y-auto sm:min-h-10">
                {userEntries.length > 0 && (
                    <div className="space-y-1">
                        {userEntries.map((entry, idx) => (
                            <div
                                key={idx}
                                className="flex min-h-8 items-center gap-1.5 rounded-lg border border-[#ead6b9] bg-[#fffaf2] px-2 py-1 text-[11px] animate-in slide-in-from-top-1 sm:text-xs"
                            >
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className="truncate font-bold text-[#5f4933]">{entry.name}</span>
                                    <span className={`shrink-0 text-base font-black leading-none ${
                                        entry.direction === 'Increase' ? 'text-[#168269]' : 'text-[#b54155]'
                                    }`}>
                                        {entry.direction === 'Increase' ? '↑' : '↓'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => onToggle(entry.name, entry.direction)}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#dbc39d] bg-[#f4e6d0] text-[#7a6958] transition-colors hover:text-[#293a38]"
                                    aria-label={`移除 ${entry.name}`}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-2 border-t border-[#e5cfac] pt-2">
                <div className="relative">
                    <div className="flex min-h-10 w-full items-center justify-between rounded-xl border border-[#dbc39d] bg-[#fffaf2] px-2.5 py-2">
                        <div className="min-w-0">
                            <div className="truncate text-xs font-black text-[#5f4933] sm:text-sm">
                                {selectedItem || '請選擇欄位'}
                            </div>
                        </div>
                        <div className="text-sm font-black text-[#7a6958]">▼</div>
                    </div>
                    <select
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        value={selectedItem}
                        onChange={e => setInternalSelected(e.target.value)}
                    >
                        {items.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                        onClick={() => onToggle(selectedItem, 'Increase')}
                        className="min-h-10 rounded-xl border border-[#7dcbb1] bg-[#e7f5ed] px-2 py-2 text-xs font-black text-[#168269] transition-colors hover:bg-[#d4eee2] sm:text-sm"
                    >
                        增加
                    </button>
                    <button
                        onClick={() => onToggle(selectedItem, 'Decrease')}
                        className="min-h-10 rounded-xl border border-[#e7a3a8] bg-[#fff0f0] px-2 py-2 text-xs font-black text-[#b54155] transition-colors hover:bg-[#fbe1e2] sm:text-sm"
                    >
                        減少
                    </button>
                </div>
            </div>
        </section>
    );
};

interface FinancialCheckBoardProps {
    possibleItemsAssets: string[];
    possibleItemsIncome: string[];
    possibleItemsLiabilities: string[];
    possibleItemsExpenses: string[];
    userEntries: AccountEntry[];
    onToggle: (category: AccountCategory, direction: ChangeDirection, name: string) => void;
    highlightedCategories?: AccountCategory[];
}

export const FinancialCheckBoard: React.FC<FinancialCheckBoardProps> = ({
    possibleItemsAssets,
    possibleItemsIncome,
    possibleItemsLiabilities,
    possibleItemsExpenses,
    userEntries,
    onToggle,
    highlightedCategories = []
}) => {
    return (
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 sm:gap-3">
            <Quadrant
                title="資產"
                color="border-[#9fc8d5] bg-[#edf6f6]"
                icon={<PieChart size={18} className="text-[#36798a]" />}
                items={possibleItemsAssets}
                userEntries={userEntries.filter(e => e.category === 'Assets')}
                onToggle={(i, d) => onToggle('Assets', d, i)}
                isHighlighted={highlightedCategories.includes('Assets')}
            />

            <Quadrant
                title="負債"
                color="border-[#e7a3a8] bg-[#fff0f0]"
                icon={<TrendingDown size={18} className="text-[#b54155]" />}
                items={possibleItemsLiabilities}
                userEntries={userEntries.filter(e => e.category === 'Liabilities')}
                onToggle={(i, d) => onToggle('Liabilities', d, i)}
                isHighlighted={highlightedCategories.includes('Liabilities')}
            />

            <Quadrant
                title="收入"
                color="border-[#7dcbb1] bg-[#e7f5ed]"
                icon={<TrendingUp size={18} className="text-[#168269]" />}
                items={possibleItemsIncome}
                userEntries={userEntries.filter(e => e.category === 'Income')}
                onToggle={(i, d) => onToggle('Income', d, i)}
                isHighlighted={highlightedCategories.includes('Income')}
            />

            <Quadrant
                title="支出"
                color="border-[#e3bd78] bg-[#fff2d8]"
                icon={<Wallet size={18} className="text-[#8c5b2b]" />}
                items={possibleItemsExpenses}
                userEntries={userEntries.filter(e => e.category === 'Expenses')}
                onToggle={(i, d) => onToggle('Expenses', d, i)}
                isHighlighted={highlightedCategories.includes('Expenses')}
            />
        </div>
    );
};

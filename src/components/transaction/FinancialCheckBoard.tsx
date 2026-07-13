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
        <section className={`rounded-[28px] border p-4 ${color} ${isHighlighted ? 'ring-2 ring-amber-300/90 shadow-[0_0_24px_rgba(252,211,77,0.28)]' : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'}`}>
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-slate-100">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-950/70">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <div className="text-base font-black">{title}</div>
                        {isHighlighted && <div className="mt-1 text-[10px] font-black text-amber-200">請重新檢查此分類</div>}
                    </div>
                </div>
            </div>

            <div className="mt-3 min-h-[240px]">
                {userEntries.length > 0 && (
                    <div className="space-y-2">
                        {userEntries.map((entry, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-2 rounded-2xl border border-white/8 bg-slate-950/70 px-3 py-2.5 text-sm animate-in slide-in-from-top-1"
                            >
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className="truncate font-bold text-white">{entry.name}</span>
                                    <span className={`shrink-0 text-base font-black leading-none ${
                                        entry.direction === 'Increase' ? 'text-emerald-400' : 'text-rose-400'
                                    }`}>
                                        {entry.direction === 'Increase' ? '↑' : '↓'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => onToggle(entry.name, entry.direction)}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-slate-400 transition-colors hover:text-white"
                                    aria-label={`移除 ${entry.name}`}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-3 border-t border-white/10 pt-3">
                <div className="relative">
                    <div className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-black text-white">
                                {selectedItem || '請選擇欄位'}
                            </div>
                        </div>
                        <div className="text-sm font-black text-slate-500">▼</div>
                    </div>
                    <select
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        value={selectedItem}
                        onChange={e => setInternalSelected(e.target.value)}
                    >
                        {items.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                        onClick={() => onToggle(selectedItem, 'Increase')}
                        className="rounded-2xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-3.5 text-sm font-black text-emerald-300 transition-colors hover:bg-emerald-500/25"
                    >
                        增加
                    </button>
                    <button
                        onClick={() => onToggle(selectedItem, 'Decrease')}
                        className="rounded-2xl border border-rose-500/35 bg-rose-500/15 px-4 py-3.5 text-sm font-black text-rose-300 transition-colors hover:bg-rose-500/25"
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
        <div className="grid grid-cols-2 gap-3">
            <Quadrant
                title="資產"
                color="border-blue-500/35 bg-blue-950/20"
                icon={<PieChart size={18} className="text-blue-300" />}
                items={possibleItemsAssets}
                userEntries={userEntries.filter(e => e.category === 'Assets')}
                onToggle={(i, d) => onToggle('Assets', d, i)}
                isHighlighted={highlightedCategories.includes('Assets')}
            />

            <Quadrant
                title="負債"
                color="border-rose-500/35 bg-rose-950/20"
                icon={<TrendingDown size={18} className="text-rose-300" />}
                items={possibleItemsLiabilities}
                userEntries={userEntries.filter(e => e.category === 'Liabilities')}
                onToggle={(i, d) => onToggle('Liabilities', d, i)}
                isHighlighted={highlightedCategories.includes('Liabilities')}
            />

            <Quadrant
                title="收入"
                color="border-emerald-500/35 bg-emerald-950/20"
                icon={<TrendingUp size={18} className="text-emerald-300" />}
                items={possibleItemsIncome}
                userEntries={userEntries.filter(e => e.category === 'Income')}
                onToggle={(i, d) => onToggle('Income', d, i)}
                isHighlighted={highlightedCategories.includes('Income')}
            />

            <Quadrant
                title="支出"
                color="border-orange-500/35 bg-orange-950/20"
                icon={<Wallet size={18} className="text-orange-300" />}
                items={possibleItemsExpenses}
                userEntries={userEntries.filter(e => e.category === 'Expenses')}
                onToggle={(i, d) => onToggle('Expenses', d, i)}
                isHighlighted={highlightedCategories.includes('Expenses')}
            />
        </div>
    );
};

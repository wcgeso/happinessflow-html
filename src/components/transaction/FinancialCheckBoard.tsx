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
}

const Quadrant: React.FC<QuadrantProps> = ({ title, color, icon, items, userEntries, onToggle }) => {
    const [internalSelected, setInternalSelected] = useState<string>('');
    const selectedItem = items.includes(internalSelected) ? internalSelected : (items[0] || '');

    return (
        <div className={`rounded-xl border-2 p-3 flex flex-col ${color} transition-all shadow-inner`}>
            <div className="flex items-center gap-2 font-bold text-slate-200 mb-3 border-b border-white/10 pb-2">
                {icon} {title}
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar max-h-32">
                {userEntries.map((entry, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-900/80 px-2 py-1.5 rounded border border-white/5 text-[12px] animate-in slide-in-from-top-1">
                        <span className="text-white truncate max-w-[70px]">{entry.name}</span>
                        <div className="flex items-center gap-0.5">
                            <span className={`font-black px-1 rounded ${entry.direction === 'Increase' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {entry.direction === 'Increase' ? '↑' : '↓'}
                            </span>
                            <button
                                onClick={() => onToggle(entry.name, entry.direction)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 shrink-0">
                <div className="relative mb-2">
                    <div className="w-full bg-slate-900 border border-slate-600 rounded px-1 py-1 flex items-center justify-between min-h-[20px]">
                        <span className="text-white font-medium truncate leading-none" style={{ fontSize: '12px' }}>
                            {selectedItem}
                        </span>
                        <div className="text-slate-500 scale-75">▼</div>
                    </div>
                    <select
                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                        value={selectedItem}
                        onChange={e => setInternalSelected(e.target.value)}
                    >
                        {items.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-1">
                    <button
                        onClick={() => onToggle(selectedItem, 'Increase')}
                        className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-[12px] py-1 rounded border border-emerald-500/30 transition-colors"
                    >
                        增加
                    </button>
                    <button
                        onClick={() => onToggle(selectedItem, 'Decrease')}
                        className="bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 text-[12px] py-1 rounded border border-rose-500/30 transition-colors"
                    >
                        減少
                    </button>
                </div>
            </div>
        </div>
    );
};

interface FinancialCheckBoardProps {
    possibleItemsAssets: string[];
    possibleItemsIncome: string[];
    possibleItemsLiabilities: string[];
    possibleItemsExpenses: string[];
    userEntries: AccountEntry[];
    onToggle: (category: AccountCategory, direction: ChangeDirection, name: string) => void;
}

export const FinancialCheckBoard: React.FC<FinancialCheckBoardProps> = ({
    possibleItemsAssets,
    possibleItemsIncome,
    possibleItemsLiabilities,
    possibleItemsExpenses,
    userEntries,
    onToggle
}) => {
    return (
        <div className="grid grid-cols-2 gap-3 flex-1">
            <Quadrant
                title="資產"
                color="border-blue-500 bg-blue-900/10"
                icon={<PieChart size={14} className="text-blue-400" />}
                items={possibleItemsAssets}
                userEntries={userEntries.filter(e => e.category === 'Assets')}
                onToggle={(i, d) => onToggle('Assets', d, i)}
            />

            <Quadrant
                title="負債"
                color="border-rose-500 bg-rose-900/10"
                icon={<TrendingDown size={14} className="text-rose-400" />}
                items={possibleItemsLiabilities}
                userEntries={userEntries.filter(e => e.category === 'Liabilities')}
                onToggle={(i, d) => onToggle('Liabilities', d, i)}
            />

            <Quadrant
                title="收入"
                color="border-emerald-500 bg-emerald-900/10"
                icon={<TrendingUp size={14} className="text-emerald-400" />}
                items={possibleItemsIncome}
                userEntries={userEntries.filter(e => e.category === 'Income')}
                onToggle={(i, d) => onToggle('Income', d, i)}
            />

            <Quadrant
                title="支出"
                color="border-orange-500 bg-orange-900/10"
                icon={<Wallet size={14} className="text-orange-400" />}
                items={possibleItemsExpenses}
                userEntries={userEntries.filter(e => e.category === 'Expenses')}
                onToggle={(i, d) => onToggle('Expenses', d, i)}
            />
        </div>
    );
};

import React from 'react';
import { Mode } from '../../types';

interface TransactionModeTabsProps {
    currentMode: Mode;
    onModeChange: (mode: Mode) => void;
}

export const TransactionModeTabs: React.FC<TransactionModeTabsProps> = ({ currentMode, onModeChange }) => {
    const modes: { id: Mode; label: string }[] = [
        { id: 'buy', label: '購買' },
        { id: 'sell', label: '賣出' },
        { id: 'loan', label: '信貸/還款' },
        { id: 'dividend', label: '發放股利' },
        { id: 'event', label: '遊戲事件' },
    ];

    return (
        <div className="grid grid-cols-5 gap-1 bg-slate-800 p-1 rounded-lg">
            {modes.map((m) => (
                <button
                    key={m.id}
                    onClick={() => onModeChange(m.id)}
                    className={`py-2 rounded font-bold text-[11px] transition-all ${currentMode === m.id
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                            : 'text-slate-400 hover:bg-slate-800'
                        }`}
                >
                    {m.label}
                </button>
            ))}
        </div>
    );
};

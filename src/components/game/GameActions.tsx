import React from 'react';
import { ShieldPlus, CirclePlus, Coins } from 'lucide-react';

interface GameActionsProps {
    onShowMedical: () => void;
    onShowTransaction: () => void;
    onShowPayday: () => void;
    onShowSettlement: () => void;
}

export const GameActions: React.FC<GameActionsProps> = ({ onShowMedical, onShowTransaction, onShowPayday, onShowSettlement }) => {
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6">
            {/* 保險理賠 */}
            <button
                onClick={onShowMedical}
                className="group relative flex flex-col items-center gap-2"
                title="保險理賠"
            >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-full shadow-[0_8px_20px_-6px_rgba(59,130,246,0.5)] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1 group-active:scale-95 border-2 border-white/20">
                    <ShieldPlus size={24} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider transition-all group-hover:text-blue-300">理賠</span>
            </button>

            {/* 交易輸入 */}
            <button
                onClick={onShowTransaction}
                className="group relative flex flex-col items-center gap-2"
                title="交易資料輸入"
            >
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-full shadow-[0_10px_25px_-8px_rgba(16,185,129,0.6)] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1 group-active:scale-95 border-2 border-white/30">
                    <CirclePlus size={32} strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest transition-all group-hover:text-emerald-300">交易輸入</span>
            </button>

            {/* 月結餘 */}
            <button
                onClick={onShowPayday}
                className="group relative flex flex-col items-center gap-2"
                title="月結餘 (領取月損益)"
            >
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 text-white rounded-full shadow-[0_8px_20px_-6px_rgba(245,158,11,0.5)] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1 group-active:scale-95 border-2 border-white/20">
                    <Coins size={24} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider transition-all group-hover:text-amber-300">月結餘</span>
            </button>
        </div>
    );
};

import React from 'react';
import { CheckCircle2, TrendingUp, TrendingDown, Coins } from 'lucide-react';
import { TransactionData } from '../../types';

interface TransactionSuccessProps {
    pendingTx: TransactionData | null;
    formatMoney: (val: number) => string;
}

export const TransactionSuccess: React.FC<TransactionSuccessProps> = ({ pendingTx, formatMoney }) => {
    if (!pendingTx) return null;

    const isPositive = pendingTx.cashChange >= 0;

    return (
        <div className="flex flex-col items-center justify-center space-y-4 pt-6 pb-2 animate-in zoom-in-95 duration-500 w-full">
            <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full"></div>
                <CheckCircle2 size={72} className="text-emerald-500 relative" />
            </div>

            <div className="text-center space-y-2 relative">
                <h4 className="text-2xl font-black text-white tracking-widest">交易成功</h4>
                <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 p-4 rounded-xl shadow-xl min-w-[300px]">
                    <div className="text-slate-400 text-xs mb-1 uppercase tracking-widest font-bold">本次現金變動</div>
                    <div className={`text-3xl font-black flex items-center justify-center gap-2 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
                        {isPositive ? '+' : '-'}{formatMoney(pendingTx.cashChange)}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <div className="text-slate-200 font-bold mb-3 flex items-center justify-center gap-2 text-base">
                            <Coins size={18} className="text-yellow-400" /> {pendingTx.name}
                        </div>

                        {pendingTx.impacts && pendingTx.impacts.length > 0 && (
                            <div className="text-left space-y-1.5">
                                <div className="text-slate-500 text-[10px] uppercase font-bold pl-1 tracking-wider">交易影響明細</div>
                                <div className="space-y-1 max-h-[160px] overflow-y-auto no-scrollbar pr-1">
                                    {pendingTx.impacts.map((impact, idx) => (
                                        <div key={idx} className="bg-slate-900/50 px-3 py-1.5 rounded-lg text-xs text-slate-300 flex items-center gap-2 border border-white/5">
                                            <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                            {impact}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

import React from 'react';
import { DollarSign, ChevronDown, ShieldCheck, PiggyBank, ArrowRight } from 'lucide-react';

interface PaydayModalProps {
    isOpen: boolean;
    onClose: () => void;
    step?: 'confirm' | 'followup';
    monthlyCashflow: number;
    formatMoney: (amount: number) => string;
    onOpenInsurance?: () => void;
    onOpenDeposit?: () => void;
    onSkipFollowup?: () => void;
    disabled?: boolean;
}

export const PaydayModal: React.FC<PaydayModalProps> = ({
    isOpen,
    onClose,
    step = 'confirm',
    monthlyCashflow,
    formatMoney,
    onOpenInsurance,
    onOpenDeposit,
    onSkipFollowup,
    disabled = false
}) => {
    if (!isOpen) return null;

    const isPositive = monthlyCashflow >= 0;
    const isFollowup = step === 'followup';

    return (
        <div className="fixed inset-x-0 bottom-0 z-[10010] flex flex-col justify-end pointer-events-none">
            {/* Backdrop Blur & Gradient */}
            <div className="absolute inset-0 -top-20 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-500 pointer-events-auto" onClick={onClose} />
            <div className={`absolute inset-0 -top-20 bg-gradient-to-t ${isPositive ? 'from-emerald-900/20' : 'from-rose-900/20'} to-transparent transition-colors duration-700`} />
            
            <div className="relative w-full pb-safe pointer-events-auto transition-transform duration-500 translate-y-0">
                <div className="mx-auto w-full max-w-md px-4 pb-6 pt-4">
                    {/* Header Controls */}
                    <div className="mb-4 flex items-center justify-between px-2">
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-white/50">Bank Action</div>
                            <div className="mt-1 text-sm font-bold text-white/90">
                                {isFollowup ? '月結餘已完成' : isPositive ? '領取月結餘' : '支付月結餘'}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full bg-white/10 p-2.5 text-white/70 backdrop-blur-md transition-all hover:bg-white/20 hover:text-white active:scale-95"
                        >
                            <ChevronDown size={20} />
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="overflow-hidden rounded-[32px] bg-slate-900/80 p-[1px] backdrop-blur-xl shadow-2xl shadow-black/50">
                        {/* Inner Border Layer */}
                        <div className="h-full w-full rounded-[31px] bg-gradient-to-b from-white/10 to-transparent">
                            <div className="px-6 py-8">
                                {!isFollowup ? (
                                    /* Step 1: Cashflow Reveal */
                                    <div className="flex flex-col items-center text-center">
                                        <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${isPositive ? 'from-emerald-400/20 to-emerald-600/40 shadow-[0_0_30px_rgba(52,211,153,0.3)]' : 'from-rose-400/20 to-rose-600/40 shadow-[0_0_30px_rgba(251,113,133,0.3)]'}`}>
                                            <DollarSign size={32} className={isPositive ? 'text-emerald-300' : 'text-rose-300'} />
                                        </div>
                                        
                                        <h2 className="text-2xl font-black tracking-wide text-white">
                                            {isPositive ? '本月結餘入帳' : '本月需支付結餘'}
                                        </h2>
                                        <p className="mt-2 text-sm text-slate-400">
                                            {isPositive ? '已自動加入你的現金餘額。' : '已自動從你的現金中扣除。'}
                                        </p>

                                        <div className="mt-8 mb-6 w-full rounded-2xl bg-slate-950/50 py-6 border border-white/5">
                                            <div className={`text-5xl font-black tracking-tight font-mono drop-shadow-md ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {isPositive ? '+' : ''}{formatMoney(monthlyCashflow)}
                                            </div>
                                        </div>

                                        <button
                                            className={`w-full rounded-2xl py-4 text-[15px] font-black tracking-widest text-white transition-all active:scale-[0.98] ${isPositive ? 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_20px_rgba(5,150,105,0.4)]' : 'bg-rose-600 hover:bg-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.4)]'}`}
                                            onClick={onClose}
                                            disabled={disabled}
                                        >
                                            {disabled ? '遊戲已結算' : '確認收訖'}
                                        </button>
                                    </div>
                                ) : (
                                    /* Step 2: Follow-up Options */
                                    <div className="flex flex-col">
                                        <h2 className="text-2xl font-black tracking-wide text-white mb-2">下一步行動</h2>
                                        <p className="text-sm text-slate-400 mb-8">
                                            月結餘已處理完畢。是否要接著購買保險或定存？你也可以稍後在財務報表中操作。
                                        </p>

                                        <div className="grid gap-4 mb-6">
                                            <button 
                                                onClick={onOpenInsurance}
                                                className="group relative flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-blue-900/40 to-blue-800/20 p-4 border border-blue-500/20 transition-all hover:border-blue-400/40 active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                                                        <ShieldCheck size={24} />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-[15px] font-black text-white">購買保險</div>
                                                        <div className="text-xs text-blue-200/60 mt-0.5">多一份保障，減少意外損失</div>
                                                    </div>
                                                </div>
                                                <div className="text-blue-400 opacity-50 transition-transform group-hover:translate-x-1 group-hover:opacity-100">
                                                    <ArrowRight size={20} />
                                                </div>
                                            </button>

                                            <button 
                                                onClick={onOpenDeposit}
                                                className="group relative flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-cyan-900/40 to-cyan-800/20 p-4 border border-cyan-500/20 transition-all hover:border-cyan-400/40 active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                                                        <PiggyBank size={24} />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-[15px] font-black text-white">購買定存</div>
                                                        <div className="text-xs text-cyan-200/60 mt-0.5">穩定獲利，增加被動收入</div>
                                                    </div>
                                                </div>
                                                <div className="text-cyan-400 opacity-50 transition-transform group-hover:translate-x-1 group-hover:opacity-100">
                                                    <ArrowRight size={20} />
                                                </div>
                                            </button>
                                        </div>

                                        <button 
                                            className="w-full rounded-2xl py-3.5 text-[14px] font-bold text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                                            onClick={onSkipFollowup || onClose}
                                        >
                                            稍後再說
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


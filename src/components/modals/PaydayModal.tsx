import React from 'react';
import { DollarSign, ShieldCheck, PiggyBank, ArrowRight } from 'lucide-react';
import { PlayerModalFrame } from '../common/PlayerModalFrame';

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
        <PlayerModalFrame
            eyebrow="回合財務"
            title={isFollowup ? '月結餘已完成' : isPositive ? '領取月結餘' : '支付月結餘'}
            description={isFollowup ? '月結餘已處理完畢，可選擇下一步理財行動。' : '本回合的月結餘已完成結算。'}
            accent="finance"
            onClose={onClose}
            footer={!isFollowup ? (
                <button className={`min-h-11 w-full rounded-2xl py-3.5 text-[15px] font-black tracking-widest text-white transition-all active:scale-[0.98] ${isPositive ? 'bg-[#2e806d] hover:bg-[#246c5c]' : 'bg-[#c9655a] hover:bg-[#b6544b]'}`} onClick={onClose} disabled={disabled}>
                    {disabled ? '遊戲已結算' : '確認收訖'}
                </button>
            ) : (
                <button className="min-h-11 w-full rounded-2xl border border-[#d8c29a] bg-[#f4e6d0] py-3.5 text-[14px] font-black text-[#7a6958] transition hover:bg-[#ead7b8]" onClick={onSkipFollowup || onClose}>
                    稍後再說
                </button>
            )}
        >
                                {!isFollowup ? (
                                    /* Step 1: Cashflow Reveal */
                                    <div className="flex flex-col items-center text-center">
                                        <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#d8c29a] ${isPositive ? 'bg-[#e0f0e5]' : 'bg-[#f5d9d0]'}`}>
                                            <DollarSign size={32} className={isPositive ? 'text-[#2e806d]' : 'text-[#b6544b]'} />
                                        </div>
                                        
                                        <p className="text-sm font-bold text-[#7a6958]">
                                            {isPositive ? '已自動加入你的現金餘額。' : '已自動從你的現金中扣除。'}
                                        </p>

                                        <div className="mt-8 mb-2 w-full rounded-2xl border border-[#ead7b8] bg-[#f4e6d0] py-6">
                                            <div className={`font-mono text-5xl font-black tracking-tight ${isPositive ? 'text-[#2e806d]' : 'text-[#b6544b]'}`}>
                                                {isPositive ? '+' : ''}{formatMoney(monthlyCashflow)}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Step 2: Follow-up Options */
                                    <div className="flex flex-col">
                                        <div className="grid gap-4">
                                            <button 
                                                onClick={onOpenInsurance}
                                                className="group relative flex w-full items-center justify-between rounded-2xl border border-[#b9d9d0] bg-[#e5f1eb] p-4 transition-all hover:border-[#5da58e] active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#d8e9e5] text-[#2e6570]">
                                                        <ShieldCheck size={24} />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-[15px] font-black text-[#293a38]">購買保險</div>
                                                        <div className="text-xs text-[#6f6253] mt-0.5">多一份保障，減少意外損失</div>
                                                    </div>
                                                </div>
                                                <div className="text-[#2e6570] opacity-60 transition-transform group-hover:translate-x-1 group-hover:opacity-100">
                                                    <ArrowRight size={20} />
                                                </div>
                                            </button>

                                            <button 
                                                onClick={onOpenDeposit}
                                                className="group relative flex w-full items-center justify-between rounded-2xl border border-[#d8c29a] bg-[#fff2de] p-4 transition-all hover:border-[#d6a94e] active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0dfc9] text-[#a9643a]">
                                                        <PiggyBank size={24} />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-[15px] font-black text-[#293a38]">購買定存</div>
                                                        <div className="text-xs text-[#6f6253] mt-0.5">穩定獲利，增加被動收入</div>
                                                    </div>
                                                </div>
                                                <div className="text-[#a9643a] opacity-60 transition-transform group-hover:translate-x-1 group-hover:opacity-100">
                                                    <ArrowRight size={20} />
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                )}
        </PlayerModalFrame>
    );
};

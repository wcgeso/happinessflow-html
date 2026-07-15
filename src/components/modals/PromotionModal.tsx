import React from 'react';
import { GraduationCap, BookOpen, BrainCircuit, CheckCircle2, ChevronRight } from 'lucide-react';
import { PlayerModalFrame } from '../common/PlayerModalFrame';
import { cn } from '../../utils/gameUtils';

interface PromotionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBack: () => void;
    onConfirm: (type: 'normal' | 'lifelong') => void;
    currentRankLevel: number;
    disabled?: boolean;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({
    isOpen,
    onClose,
    onBack,
    onConfirm,
    currentRankLevel,
    disabled = false
}) => {
    if (!isOpen) return null;

    return (
        <PlayerModalFrame
            eyebrow="職業成長"
            title="升等考試報名"
            description="提升職業等級，獲取更多工作收入加成。"
            accent="opportunity"
            onClose={onClose}
            footer={(
                <div className="flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={() => onConfirm('normal')}
                        disabled={disabled}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#d6a94e] to-[#a9643a] py-3.5 text-lg font-black text-white shadow-[0_12px_24px_-14px_rgba(169,100,58,0.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <span>{disabled ? '遊戲已結算' : '確認報名'}</span>
                        {!disabled && <ChevronRight size={20} />}
                    </button>
                    <button type="button" onClick={onClose} className="min-h-11 w-full rounded-2xl border border-[#d8c29a] bg-[#f4e6d0] py-3 text-sm font-black text-[#7a6958] transition hover:bg-[#ead7b8]">
                        關閉
                    </button>
                </div>
            )}
        >
                    <div className="mb-6 text-center">
                        <div className="mx-auto flex h-20 w-20 rotate-12 items-center justify-center rounded-3xl border border-[#d8c29a] bg-[#f0dfc9] text-[#a9643a] transition-transform hover:rotate-0">
                            <GraduationCap size={44} strokeWidth={1.5} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Normal Exam */}
                        <div className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border-2 border-[#d6a94e] bg-[#fff2de] p-5 text-left transition-all duration-300 shadow-[0_12px_26px_-20px_rgba(169,100,58,0.75)]">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#d6a94e] bg-[#d6a94e] text-white shadow-lg">
                                <BookOpen size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[#293a38] font-black text-lg leading-tight">一般考試</div>
                                <div className="text-[#7a6958] text-xs mt-1">下一階目標：擲骰子 ≥ {currentRankLevel + 1} 點</div>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                                <div className="text-[#2e806d] font-mono font-black text-xl">1,000</div>
                                <CheckCircle2 size={16} className="text-[#b88a43] mt-1" />
                            </div>
                        </div>
                    </div>
        </PlayerModalFrame>
    );
};

import React, { useState } from 'react';
import { GraduationCap, TrendingUp, Building2, ChevronRight, ArrowLeft } from 'lucide-react';
import { PlayerModalFrame } from '../common/PlayerModalFrame';
import { cn } from '../../utils/gameUtils';
import { GameState } from '../../types';

interface LifelongLearningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBack: () => void;
    onConfirm: (type: string, cost: number) => void;
    gameState: GameState;
    disabled?: boolean;
}

export const LifelongLearningModal: React.FC<LifelongLearningModalProps> = ({
    isOpen,
    onClose,
    onBack,
    onConfirm,
    gameState,
    disabled = false
}) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    if (!isOpen) return null;

    const options = [
        {
            id: 'enhance_profession',
            title: '增強職業能力',
            description: '透過進修無條件晉升一級。',
            cost: 5000,
            requirement: '擲骰子 ≥ 2 點',
            icon: <GraduationCap size={20} />,
            color: 'blue',
            disabled: gameState.currentRankLevel >= (gameState.profession?.promotions.length || 0) + 1
        },
        {
            id: 'stock_ability',
            title: '投資股票的能力',
            description: '提升市場洞察，現有股票張數翻倍。',
            cost: 10000,
            requirement: '擲骰子 ≥ 4 點',
            icon: <TrendingUp size={20} />,
            color: 'emerald',
            disabled: false
        },
        {
            id: 'real_estate_ability',
            title: '投資不動產的能力',
            description: '精進物件管理，\n所有現有及未來出租房產租金 +10,000H。',
            cost: 10000,
            requirement: '擲骰子 ≥ 4 點',
            icon: <Building2 size={20} />,
            color: 'amber',
            disabled: false
        }
    ];

    const handleConfirm = () => {
        const selected = options.find(opt => opt.id === selectedId);
        if (selected) {
            onConfirm(selected.id, selected.cost);
        }
    };

    return (
        <PlayerModalFrame
            eyebrow="能力與財富增益"
            title="終身學習"
            description="投資自己，獲得永久的能力與財富增益。"
            accent="finance"
            onClose={onClose}
            footer={(
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        disabled={!selectedId || disabled}
                        onClick={handleConfirm}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2e6570] to-[#5da58e] py-3 font-black text-white shadow-[0_12px_24px_-14px_rgba(46,101,112,0.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <span>{disabled ? '遊戲已結算' : '確認學習'}</span>
                        {!disabled && <ChevronRight size={18} />}
                    </button>
                    <button type="button" onClick={onBack} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#d8c29a] bg-[#f4e6d0] py-3 text-sm font-black text-[#7a6958] transition hover:bg-[#ead7b8]">
                        <ArrowLeft size={16} />
                        <span>上一頁</span>
                    </button>
                </div>
            )}
        >
                    <div className="mb-6 text-center">
                        <div className="mx-auto flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl border border-[#d8c29a] bg-gradient-to-br from-[#d6a94e] to-[#a9643a] text-white shadow-[0_0_25px_-8px_rgba(169,100,58,0.7)] transition-transform hover:rotate-0">
                            <TrendingUp size={36} strokeWidth={2.5} className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                        {options.map((opt) => (
                            <button
                                key={opt.id}
                                disabled={opt.disabled}
                                onClick={() => setSelectedId(opt.id)}
                                className={cn(
                                    "group relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left overflow-hidden border-2",
                                    selectedId === opt.id 
                                        ? "bg-[#fff2de] border-[#d6a94e] shadow-[0_0_20px_-8px_rgba(169,100,58,0.45)]"
                                        : "bg-[#fffaf2] border-[#ead7b8] hover:border-[#d8c29a]",
                                    opt.disabled && "opacity-50 grayscale cursor-not-allowed"
                                )}
                            >
                                <div className={cn(
                                    "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all border shadow-lg",
                                    selectedId === opt.id 
                                        ? "bg-[#d6a94e] text-white border-[#d6a94e]"
                                        : "bg-[#f4e6d0] text-[#7a6958] border-[#d8c29a]"
                                )}>
                                    {opt.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={cn(
                                        "font-bold text-sm leading-tight whitespace-nowrap transition-colors",
                                        selectedId === opt.id 
                                            ? "text-[#a9643a]"
                                            : "text-[#293a38]"
                                    )}>
                                        {opt.title}
                                    </div>
                                    <div className={cn(
                                        "text-[10px] mt-0.5 leading-normal whitespace-pre-line transition-colors",
                                        selectedId === opt.id ? "text-[#6f6253]" : "text-[#8b7b68]"
                                    )}>
                                        {opt.description}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={cn(
                                            "text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors",
                                            selectedId === opt.id 
                                                ? "bg-[#f0dfc9] text-[#a9643a]"
                                                : "bg-[#f4e6d0] text-[#8b7b68]"
                                        )}>
                                            {opt.requirement}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className={cn(
                                        "font-mono font-black text-base transition-colors",
                                        selectedId === opt.id 
                                            ? opt.color === 'blue' ? "text-blue-400"
                                              : opt.color === 'emerald' ? "text-emerald-400"
                                              : "text-[#a9643a]"
                                            : "text-[#7a6958]"
                                    )}>
                                        {opt.cost.toLocaleString()}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

        </PlayerModalFrame>
    );
};

import React, { useState } from 'react';
import { X, GraduationCap, TrendingUp, Building2, ChevronRight, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button, Card } from '../ui/ui';
import { cn } from '../../utils/gameUtils';
import { GameState } from '../../types';

interface LifelongLearningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBack: () => void;
    onConfirm: (type: string, cost: number) => void;
    gameState: GameState;
}

export const LifelongLearningModal: React.FC<LifelongLearningModalProps> = ({
    isOpen,
    onClose,
    onBack,
    onConfirm,
    gameState
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
            icon: <GraduationCap size={24} />,
            color: 'blue',
            disabled: gameState.currentRankLevel >= (gameState.profession?.promotions.length || 0) + 1
        },
        {
            id: 'stock_ability',
            title: '投資股票的能力',
            description: '提升市場洞察，現有股票張數翻倍。',
            cost: 10000,
            requirement: '擲骰子 ≥ 4 點',
            icon: <TrendingUp size={24} />,
            color: 'emerald',
            disabled: false
        },
        {
            id: 'real_estate_ability',
            title: '投資不動產的能力',
            description: '精進物件管理，所有出租房產租金 +10,000H。',
            cost: 10000,
            requirement: '擲骰子 ≥ 4 點',
            icon: <Building2 size={24} />,
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
            {/* 裝飾背景 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[100px]" />
            </div>

            <Card className="max-w-md w-full bg-slate-900 border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 space-y-8 relative">
                    {/* Close Button */}
                    <button 
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-all z-20"
                    >
                        <X size={24} />
                    </button>

                    <div className="text-center space-y-3">
                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center mx-auto text-indigo-400 border border-indigo-500/30 -rotate-6 transition-transform hover:rotate-0 duration-500">
                            <TrendingUp size={44} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl font-black text-white tracking-tight">終身學習</h3>
                        <p className="text-slate-500 text-sm">投資自己，獲得永久的能力與財富增益</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {options.map((opt) => (
                            <button
                                key={opt.id}
                                disabled={opt.disabled}
                                onClick={() => setSelectedId(opt.id)}
                                className={cn(
                                    "group relative flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left overflow-hidden border-2",
                                    selectedId === opt.id 
                                        ? "bg-indigo-500/10 border-indigo-500 shadow-[0_0_20px_-5px_rgba(99,102,241,0.4)]" 
                                        : "bg-slate-950/40 border-slate-800 hover:border-slate-600",
                                    opt.disabled && "opacity-50 grayscale cursor-not-allowed"
                                )}
                            >
                                <div className={cn(
                                    "shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all border shadow-lg",
                                    selectedId === opt.id 
                                        ? "bg-indigo-500 text-white border-indigo-400" 
                                        : "bg-slate-800 text-slate-400 border-slate-700"
                                )}>
                                    {opt.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-bold text-base leading-tight whitespace-nowrap">
                                        {opt.title}
                                    </div>
                                    <div className="text-slate-500 text-[11px] mt-0.5 leading-normal">{opt.description}</div>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                                            {opt.requirement}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className={cn(
                                        "font-mono font-black text-lg",
                                        selectedId === opt.id ? "text-emerald-400" : "text-slate-400"
                                    )}>
                                        {opt.cost.toLocaleString()}<span className="text-[10px] ml-0.5">H</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <Button
                            disabled={!selectedId}
                            onClick={handleConfirm}
                            className="w-full py-4 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-900/40 disabled:opacity-50 disabled:shadow-none"
                        >
                            <span>確認學習</span>
                            <ChevronRight size={20} className="animate-in slide-in-from-left-2" />
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={onBack}
                            className="w-full py-4 text-slate-400 font-bold hover:text-white transition-colors border-none flex items-center justify-center gap-2"
                        >
                            <ArrowLeft size={18} />
                            <span>上一頁</span>
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

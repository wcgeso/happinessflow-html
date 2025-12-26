import React, { useState } from 'react';
import { GraduationCap, BookOpen, BrainCircuit, CheckCircle2, ChevronRight, X, ArrowLeft } from 'lucide-react';
import { Button, Card } from '../ui/ui';
import { cn } from '../../utils/gameUtils';

interface PromotionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBack: () => void;
    onConfirm: (type: 'normal' | 'lifelong') => void;
    currentRankLevel: number;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({
    isOpen,
    onClose,
    onBack,
    onConfirm,
    currentRankLevel
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
            {/* 裝飾背景 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[100px]" />
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
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto text-purple-400 border border-purple-500/30 rotate-12 transition-transform hover:rotate-0 duration-500">
                            <GraduationCap size={44} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl font-black text-white tracking-tight">升等考試報名</h3>
                        <p className="text-slate-500 text-sm">提升職業等級，獲取更多工作收入加成</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Normal Exam */}
                        <div className="group relative flex items-center gap-4 p-5 rounded-2xl transition-all duration-300 text-left overflow-hidden border-2 bg-purple-500/10 border-purple-500 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)]">
                            <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all border shadow-lg bg-purple-500 text-white border-purple-400">
                                <BookOpen size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-white font-bold text-lg leading-tight">一般考試</div>
                                <div className="text-slate-500 text-xs mt-1">下一階目標：擲骰子 ≥ {currentRankLevel + 1} 點</div>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                                <div className="text-emerald-400 font-mono font-black text-xl">
                                    1,000<span className="text-[10px] ml-1">H</span>
                                </div>
                                <CheckCircle2 size={16} className="text-purple-500 mt-1 animate-in zoom-in" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <Button
                            onClick={() => onConfirm('normal')}
                            className="w-full py-4 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/40"
                        >
                            <span>確認報名</span>
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

import React from 'react';
import { Card, Button } from '../ui/ui';
import { cn } from '../../utils/gameUtils';
import { GraduationCap, X } from 'lucide-react';

interface RankListModalProps {
    profession: any;
    currentRankTitle: string;
    onClose: () => void;
    onShowPromotion: () => void;
    onShowLifelong: () => void;
    currentRankLevel: number;
    disabled?: boolean;
}

export const RankListModal: React.FC<RankListModalProps> = ({ 
    profession, 
    currentRankTitle, 
    onClose,
    onShowPromotion,
    onShowLifelong,
    currentRankLevel,
    disabled = false
}) => {
    if (!profession) return null;

    const canPromote = currentRankLevel < (profession.promotions?.length || 0) + 1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-safe pb-safe bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <Card className="w-full max-w-xs bg-slate-900 border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 p-6 relative">
                {/* 關閉按鈕 */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-1">{profession.title}</h3>
                    <p className="text-slate-400 text-xs">職業等級一覽</p>
                </div>
                
                <div className="space-y-3 relative mb-8">
                    <div className={cn("relative px-4 py-3 rounded-xl transition-all border", 
                        currentRankTitle === profession.initialRank 
                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]' 
                        : 'bg-slate-800/50 border-slate-700/50')}>
                        <div className="flex justify-between items-center">
                            <span className={cn("text-sm font-bold", currentRankTitle === profession.initialRank ? 'text-emerald-400' : 'text-slate-400')}>
                                LV1 {profession.initialRank}
                            </span>
                            {currentRankTitle === profession.initialRank && (
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                        </div>
                    </div>
                    {profession.promotions.map((p: any, idx: number) => {
                        const isCurrent = currentRankTitle === p.rankTitle;
                        const isUnlocked = currentRankLevel > idx + 1;
                        
                        return (
                            <div key={idx} className={cn("relative px-4 py-3 rounded-xl transition-all border", 
                                isCurrent 
                                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]' 
                                : isUnlocked ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-950/30 border-slate-800/50 opacity-50')}>
                                <div className="flex justify-between items-center">
                                    <span className={cn("text-sm font-bold", isCurrent ? 'text-emerald-400' : 'text-slate-400')}>
                                        LV{idx + 2} {p.rankTitle}
                                    </span>
                                    {isCurrent && (
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    )}
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                    <div className="text-[10px] text-slate-500">
                                        工作收入加成: +{p.bonus.toLocaleString()} H
                                    </div>
                                    <div className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[9px] font-black text-purple-400 uppercase tracking-tighter">
                                         擲骰子 ≥ {idx + 2} 點
                                     </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {!disabled && (
                    <div className="space-y-3">
                        {canPromote ? (
                            <>
                                <Button 
                                    onClick={() => {
                                        onClose();
                                        onShowPromotion();
                                    }}
                                    className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                    <GraduationCap size={18} />
                                    參加升等考試
                                </Button>
                                <Button 
                                    variant="secondary"
                                    onClick={() => {
                                        onClose();
                                        onShowLifelong();
                                    }}
                                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                    <GraduationCap size={18} />
                                    終身學習
                                </Button>
                            </>
                        ) : (
                            <Button 
                                variant="secondary"
                                onClick={() => {
                                    onClose();
                                    onShowLifelong();
                                }}
                                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <GraduationCap size={18} />
                                終身學習
                            </Button>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};

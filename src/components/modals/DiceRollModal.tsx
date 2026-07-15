import React, { useEffect, useState } from 'react';
import { Dices, Trophy, XCircle, Target, ArrowRight } from 'lucide-react';
import { Button } from '../ui/ui';
import { DiceFace } from '../game/DiceFace';
import { cn } from '../../utils/gameUtils';

import { PromotionType } from '../../hooks/useDiceRollLogic';

interface ExamLog {
    target: number;
    bonus: number;
    newTitle: string;
}

interface DiceRollModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRoll: () => void;
    isRolling: boolean;
    diceValue: number;
    examResult: 'idle' | 'success' | 'failure';
    examLog: ExamLog | null;
    formatMoney: (amount: number) => string;
    promotionType?: PromotionType | null;
}

export const DiceRollModal: React.FC<DiceRollModalProps> = ({
    isOpen,
    onClose,
    onRoll,
    isRolling,
    diceValue,
    examResult,
    examLog,
    formatMoney,
    promotionType
}) => {
    const [shake, setShake] = useState(false);
    const [showParticles, setShowParticles] = useState(false);

    useEffect(() => {
        if (examResult === 'failure') {
            setShake(true);
            const timer = setTimeout(() => setShake(false), 500);
            return () => clearTimeout(timer);
        }
        if (examResult === 'success') {
            setShowParticles(true);
            const timer = setTimeout(() => setShowParticles(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [examResult]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-slate-950 p-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl sm:items-center sm:p-6">
            {/* 彈出視窗主體 */}
            <div className={cn(
                "relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[2.5rem] border border-white/10 bg-slate-900 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] transition-all duration-500",
                "animate-in zoom-in-95",
                shake && "animate-shake"
            )}>
                {/* 背景裝飾效果 (限縮在視窗內) */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className={cn(
                        "absolute -top-24 -left-24 w-64 h-64 rounded-full blur-[80px] transition-colors duration-1000",
                        examResult === 'success' ? "bg-emerald-600/20" : 
                        examResult === 'failure' ? "bg-rose-600/20" : "bg-purple-600/10"
                    )} />
                    <div className={cn(
                        "absolute -bottom-24 -right-24 w-64 h-64 rounded-full blur-[80px] transition-colors duration-1000",
                        examResult === 'success' ? "bg-yellow-600/20" : 
                        examResult === 'failure' ? "bg-orange-600/20" : "bg-emerald-600/10"
                    )} />
                </div>

                {/* 內容容器 */}
                <div className="relative z-10 flex flex-col items-center gap-6 p-6 sm:gap-8 sm:p-10">
                    {/* 狀態標題 */}
                    <div className="flex w-full flex-col items-center justify-center space-y-2 text-center">
                        <div className="relative h-10 w-full flex items-center justify-center">
                            {isRolling ? (
                                <h2 key="rolling" className="text-2xl font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse absolute inset-0 flex items-center justify-center">
                                    擲骰中...
                                </h2>
                            ) : (
                                <h2 key="result" className={cn(
                                    "text-2xl font-black uppercase tracking-[0.3em] absolute inset-0 flex items-center justify-center transition-all duration-300",
                                    examResult === 'success' ? "text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" : 
                                    examResult === 'failure' ? "text-rose-500" : "text-white"
                                )}>
                                    {examResult === 'idle' ? (promotionType === 'normal' ? '升等考試' : '終身學習') : 
                                     examResult === 'success' ? '考試通過' : '未通過'}
                                </h2>
                            )}
                        </div>
                        
                        <div className="relative h-4 w-full flex items-center justify-center">
                            {isRolling ? (
                                <p key="sub-rolling" className="text-slate-500 text-[10px] font-bold tracking-widest uppercase absolute inset-0 flex items-center justify-center">
                                    命運轉動中
                                </p>
                            ) : (
                                <p key="sub-result" className="text-slate-500 text-[10px] font-bold tracking-widest uppercase absolute inset-0 flex items-center justify-center">
                                    {examResult === 'idle' ? '「自己」是最重要的資產' : 
                                     examResult === 'success' ? 
                                        (promotionType === 'normal' ? '恭喜通過考試，職業等級晉升一階！' : '恭喜學習成功，獲得新能力！') : 
                                        '下次一定可以'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 骰子區域 */}
                    <div className="relative group">
                        {/* 托盤背景 */}
                        <div className={cn(
                            "absolute -inset-5 bg-slate-950/60 rounded-[2.5rem] border border-white/5 transition-all duration-500",
                            "shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]",
                            isRolling && "scale-95 opacity-80"
                        )} />

                        <button
                            type="button"
                            disabled={isRolling || examResult !== 'idle'}
                            onClick={() => !isRolling && examResult === 'idle' && onRoll()} 
                            className={cn(
                                "relative z-10 flex flex-col items-center gap-6 rounded-3xl p-7 transition-transform duration-200 disabled:cursor-default",
                                examResult === 'idle' && !isRolling ? "cursor-pointer hover:scale-105 active:scale-90" : "cursor-default"
                            )}
                        >
                            <DiceFace value={diceValue} rolling={isRolling} size="lg" />
                            {!isRolling && examResult === 'idle' && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black tracking-widest text-slate-300">
                                    點擊骰子開始
                                </span>
                            )}
                        </button>

                        {/* 狀態裝飾光 */}
                        <div className={cn(
                            "absolute inset-0 blur-[40px] transition-all duration-1000 -z-10",
                            isRolling ? "bg-indigo-500/20 animate-pulse" :
                            examResult === 'success' ? "bg-yellow-400/20 scale-125" :
                            examResult === 'failure' ? "bg-rose-500/10" : "bg-white/5"
                        )} />
                    </div>

                    {/* 目標與結果資訊 */}
                    <div className="w-full space-y-4">
                        {examLog && (
                            <div className="flex justify-center items-center gap-4 text-lg font-bold">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">需 ≥</span>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/50 rounded-xl border border-white/5">
                                        <Target size={14} className="text-slate-400" />
                                        <span className="text-white text-sm">{examLog.target}</span>
                                    </div>
                                </div>
                                <ArrowRight className="text-slate-700 mt-4" size={16} />
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">投擲</span>
                                    <div className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 bg-slate-950/50 rounded-xl border transition-all duration-300",
                                        isRolling ? "border-white/5" :
                                        examResult === 'success' ? "border-emerald-500/30 text-emerald-400" :
                                        examResult === 'failure' ? "border-rose-500/30 text-rose-400" : "border-white/5"
                                    )}>
                                        <Dices size={14} className={isRolling ? "animate-spin" : ""} />
                                        <span className="text-sm">{isRolling ? '?' : diceValue}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 結果詳細卡片 */}
                        {examResult !== 'idle' && !isRolling && (
                            <div className={cn(
                                "w-full rounded-2xl border p-4 transition-all duration-500 animate-in fade-in slide-in-from-bottom-2",
                                examResult === 'success' 
                                    ? "bg-emerald-500/10 border-emerald-500/20" 
                                    : "bg-rose-500/10 border-rose-500/20"
                            )}>
                                {examResult === 'success' ? (
                                    <div className="space-y-3 text-center">
                                    <div className="flex justify-center">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20">
                                            <Trophy className="text-emerald-500" size={18} />
                                            </div>
                                        </div>
                                        {promotionType === 'stock_ability' || promotionType === 'real_estate_ability' ? (
                                            <div className="space-y-2">
                                                <div>
                                                    <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">獲得能力</p>
                                                    <p className="text-lg font-black text-white">
                                                        {promotionType === 'stock_ability' ? '投資股票的能力' : '投資不動產的能力'}
                                                    </p>
                                                </div>
                                                <div className="h-px bg-white/5" />
                                                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-2.5">
                                                    <p className="text-[10px] text-emerald-400/90 leading-relaxed font-medium">
                                                        {promotionType === 'stock_ability' 
                                                            ? '✨ 恭喜！你持有的所有股票張數已翻倍！' 
                                                            : '✨ 恭喜！你所有出租房產的月租金收入已增加 10,000H！'}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">
                                                        {promotionType === 'enhance_profession' ? '能力提升成功' : '晉升職稱'}
                                                    </p>
                                                    <p className="text-lg font-black text-white">{examLog?.newTitle}</p>
                                                </div>
                                                <div className="h-px bg-white/5" />
                                                <div>
                                                    <p className="text-[9px] text-emerald-500/70 font-bold uppercase mb-0.5">收入獎勵</p>
                                                    <p className="text-xl font-black text-emerald-400">+{formatMoney(examLog?.bonus || 0)}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2 text-center">
                                        <div className="flex justify-center">
                                            <div className="w-10 h-10 bg-rose-500/20 rounded-full flex items-center justify-center">
                                                <XCircle className="text-rose-500" size={20} />
                                            </div>
                                        </div>
                                        <p className="text-white font-bold text-sm">差了一點點！</p>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            再接再厲，累積經驗會讓你下次更強大。
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 按鈕區域 */}
                    {!isRolling && examResult !== 'idle' && (
                        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                            <Button
                                onClick={onClose}
                                className={cn(
                                    "w-full py-3.5 font-black rounded-2xl shadow-xl transition-all active:scale-95",
                                    examResult === 'success' 
                                        ? "bg-amber-600 hover:bg-amber-500 text-white" 
                                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                )}
                            >
                                {examResult === 'success' ? '領取獎勵並關閉' : '回首頁'}
                            </Button>
                        </div>
                    )}
                </div>

                {/* 成功粒子效果 (限縮在視窗內) */}
                {showParticles && (
                    <div className="absolute inset-0 pointer-events-none z-20">
                        {[...Array(15)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-1.5 h-1.5 rounded-full animate-[particle-fade-out_1s_ease-out_forwards]"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    backgroundColor: ['#fbbf24', '#10b981', '#3b82f6', '#f472b6'][i % 4],
                                    '--tw-translate-x': `${(Math.random() - 0.5) * 300}px`,
                                    '--tw-translate-y': `${(Math.random() - 0.5) * 300}px`,
                                } as React.CSSProperties}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

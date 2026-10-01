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
    remoteMode?: boolean;
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
    promotionType,
    remoteMode = false
}) => {
    const [shake, setShake] = useState(false);
    const [showParticles, setShowParticles] = useState(false);
    const compactResult = examResult === 'success' && !isRolling;

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
        <div className={cn(
            "fixed inset-0 z-[10050] flex justify-center overflow-y-auto bg-[#102f38]/90 backdrop-blur-xl",
            compactResult
                ? "items-center p-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:p-6"
                : "items-start p-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:items-center sm:p-6"
        )}>
            {/* 彈出視窗主體 */}
            <div className={cn(
                "relative w-full max-w-md rounded-[2.5rem] border border-[#d8c29a] bg-[#fffaf2] text-[#293a38] shadow-[0_32px_64px_-12px_rgba(36,54,49,0.35)] transition-all duration-500",
                compactResult
                    ? "max-h-[calc(100dvh-1rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] overflow-y-auto"
                    : "max-h-[calc(100dvh-1.5rem)] overflow-y-auto",
                "animate-in zoom-in-95",
                shake && "animate-shake"
            )}>
                {/* 背景裝飾效果 (限縮在視窗內) */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className={cn(
                        "absolute -top-24 -left-24 w-64 h-64 rounded-full blur-[80px] transition-colors duration-1000",
                        examResult === 'success' ? "bg-emerald-600/20" : 
                        examResult === 'failure' ? "bg-rose-600/20" : "bg-[#d9a267]/15"
                    )} />
                    <div className={cn(
                        "absolute -bottom-24 -right-24 w-64 h-64 rounded-full blur-[80px] transition-colors duration-1000",
                        examResult === 'success' ? "bg-yellow-600/20" : 
                        examResult === 'failure' ? "bg-orange-600/20" : "bg-emerald-600/10"
                    )} />
                </div>

                {/* 內容容器 */}
                <div className={cn(
                    "relative z-10 flex flex-col items-center",
                    compactResult ? "gap-3 p-3 sm:gap-4 sm:p-6" : "gap-6 p-6 sm:gap-8 sm:p-10"
                )}>
                    {/* 狀態標題 */}
                    <div className="flex w-full flex-col items-center justify-center space-y-2 text-center">
                        <div className="relative h-10 w-full flex items-center justify-center">
                            {isRolling ? (
                                <h2 key="rolling" className="absolute inset-0 flex items-center justify-center text-2xl font-black uppercase tracking-[0.3em] text-[#2e6570] animate-pulse">
                                    擲骰中...
                                </h2>
                            ) : (
                                <h2 key="result" className={cn(
                                    "font-black uppercase absolute inset-0 flex items-center justify-center transition-all duration-300",
                                    compactResult ? "text-xl tracking-[0.18em]" : "text-2xl tracking-[0.3em]",
                                    examResult === 'success' ? "text-[#8c5b2b]" :
                                    examResult === 'failure' ? "text-[#b54155]" : "text-[#293a38]"
                                )}>
                                    {examResult === 'idle' ? (promotionType === 'normal' ? '升等考試' : '終身學習') : 
                                     examResult === 'success' ? '考試通過' : '未通過'}
                                </h2>
                            )}
                        </div>
                        
                        <div className="relative h-4 w-full flex items-center justify-center">
                            {isRolling ? (
                                <p key="sub-rolling" className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-[#7a6958]">
                                    命運轉動中
                                </p>
                            ) : (
                                <p key="sub-result" className="text-[#7a6958] text-[10px] font-bold tracking-widest uppercase absolute inset-0 flex items-center justify-center">
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
                            "absolute bg-[#f4e6d0]/80 border border-[#d8c29a] transition-all duration-500",
                            compactResult ? "-inset-3 rounded-3xl" : "-inset-5 rounded-[2.5rem]",
                            "shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]",
                            isRolling && "scale-95 opacity-80"
                        )} />

                        <button
                            type="button"
                            disabled={isRolling || examResult !== 'idle'}
                            onClick={() => !isRolling && examResult === 'idle' && onRoll()} 
                            className={cn(
                                "relative z-10 flex flex-col items-center rounded-3xl transition-transform duration-200 disabled:cursor-default",
                                compactResult ? "gap-2 p-2" : "gap-6 p-7",
                                examResult === 'idle' && !isRolling ? "cursor-pointer hover:scale-105 active:scale-90" : "cursor-default"
                            )}
                        >
                            {remoteMode ? (
                                <div className="flex h-36 w-48 items-center justify-center rounded-3xl border-2 border-dashed border-[#d8c29a] bg-[#f4e6d0] px-5 text-center text-sm font-black leading-relaxed text-[#76573a]">
                                    {isRolling ? '骰點已送出\n請看大螢幕' : `大螢幕顯示骰點\n目前結果：${diceValue} 點`}
                                </div>
                            ) : <DiceFace value={diceValue} rolling={isRolling} size={compactResult ? 'md' : 'lg'} />}
                            {!isRolling && examResult === 'idle' && (
                                <span className="rounded-full border border-[#d8c29a] bg-[#fffaf2] px-4 py-2 text-xs font-black tracking-widest text-[#76573a]">
                                    點擊骰子開始
                                </span>
                            )}
                        </button>

                        {/* 狀態裝飾光 */}
                        <div className={cn(
                            "absolute inset-0 blur-[40px] transition-all duration-1000 -z-10",
                            isRolling ? "bg-[#5da58e]/20 animate-pulse" :
                            examResult === 'success' ? "bg-yellow-400/20 scale-125" :
                            examResult === 'failure' ? "bg-rose-500/10" : "bg-white/5"
                        )} />
                    </div>

                    {/* 目標與結果資訊 */}
                    <div className={cn("w-full", compactResult ? "space-y-2" : "space-y-4")}>
                        {examLog && (
                            <div className="flex justify-center items-center gap-4 text-lg font-bold">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[9px] text-[#7a6958] uppercase tracking-wider">需 ≥</span>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f4e6d0] rounded-xl border border-[#d8c29a]">
                                        <Target size={14} className="text-[#8c5b2b]" />
                                        <span className="text-[#293a38] text-sm">{examLog.target}</span>
                                    </div>
                                </div>
                                <ArrowRight className="mt-4 text-[#9a8166]" size={16} />
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[9px] text-[#7a6958] uppercase tracking-wider">投擲</span>
                                    <div className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 bg-[#f4e6d0] rounded-xl border transition-all duration-300",
                                        isRolling ? "border-[#d8c29a]" :
                                        examResult === 'success' ? "border-[#5da58e] text-[#168269]" :
                                        examResult === 'failure' ? "border-[#d9919d] text-[#b54155]" : "border-[#d8c29a]"
                                    )}>
                                        <Dices size={14} className={isRolling ? "animate-spin" : ""} />
                                        <span className="text-sm text-[#293a38]">{isRolling ? '?' : diceValue}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 結果詳細卡片 */}
                        {examResult !== 'idle' && !isRolling && (
                            <div className={cn(
                                "w-full rounded-2xl border transition-all duration-500 animate-in fade-in slide-in-from-bottom-2",
                                compactResult ? "p-3 sm:p-4" : "p-4",
                                examResult === 'success' 
                                    ? "bg-emerald-500/10 border-emerald-500/20" 
                                    : "bg-rose-500/10 border-rose-500/20"
                            )}>
                                {examResult === 'success' ? (
                                    <div className="space-y-3 text-center">
                                    <div className="flex justify-center">
                                        <div className={cn("flex items-center justify-center rounded-full bg-emerald-500/20", compactResult ? "h-7 w-7" : "h-9 w-9")}>
                                            <Trophy className="text-emerald-500" size={18} />
                                            </div>
                                        </div>
                                        {promotionType === 'stock_ability' || promotionType === 'real_estate_ability' ? (
                                            <div className="space-y-2">
                                                <div>
                                                    <p className="mb-0.5 text-[9px] uppercase tracking-widest text-[#7a6958]">獲得能力</p>
                                                    <p className="text-lg font-black text-[#293a38]">
                                                        {promotionType === 'stock_ability' ? '投資股票的能力' : '投資不動產的能力'}
                                                    </p>
                                                </div>
                                                <div className="h-px bg-[#ead7b8]" />
                                                <div className="rounded-xl border border-[#b9d9d0] bg-[#e0f0e5] p-2.5">
                                                    <p className="text-[10px] font-medium leading-relaxed text-[#168269]">
                                                        {promotionType === 'stock_ability' 
                                                            ? '✨ 恭喜！你持有的所有股票張數已翻倍！' 
                                                            : '✨ 恭喜！你所有出租房產的月租金收入已增加 10,000H！'}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={cn(compactResult ? "space-y-2" : "space-y-3")}>
                                                <div>
                                                    <p className="mb-0.5 text-[9px] uppercase tracking-widest text-[#7a6958]">
                                                        {promotionType === 'enhance_profession' ? '能力提升成功' : '晉升職稱'}
                                                    </p>
                                                    <p className={cn("font-black text-[#293a38]", compactResult ? "text-base sm:text-lg" : "text-lg")}>{examLog?.newTitle}</p>
                                                </div>
                                                <div className="h-px bg-[#ead7b8]" />
                                                <div>
                                                    <p className="text-[9px] text-emerald-500/70 font-bold uppercase mb-0.5">收入獎勵</p>
                                                    <p className={cn("font-black text-[#168269]", compactResult ? "text-lg sm:text-xl" : "text-xl")}>+{formatMoney(examLog?.bonus || 0)}</p>
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
                                        <p className="text-[#293a38] font-bold text-sm">差了一點點！</p>
                                        <p className="text-[11px] text-[#765f47] leading-relaxed">
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
                                    "min-h-11 w-full font-black rounded-2xl shadow-xl transition-all active:scale-95",
                                    compactResult ? "py-2.5" : "py-3.5",
                                    examResult === 'success'
                                        ? "bg-[#168269] hover:bg-[#106b58] text-white"
                                        : "bg-[#f4e6d0] hover:bg-[#ead7b8] text-[#76573a]"
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
                                    backgroundColor: ['#d6a94e', '#168269', '#2e6570', '#d94f83'][i % 4],
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

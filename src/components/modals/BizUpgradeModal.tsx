import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUpCircle, Dice5, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/ui';
import { Asset } from '../../types';
import { DiceFace } from '../game/DiceFace';
import { cn, formatMoney } from '../../utils/gameUtils';

type StartupUpgradeRollResult = {
    roll: number;
    eligible?: boolean;
    presentationDurationMs?: number;
};

interface BizUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset;
    onUpgrade: (diceRoll: number) => Promise<boolean> | boolean;
    onRollFirst?: () => Promise<StartupUpgradeRollResult>;
    onRollSecond?: () => Promise<StartupUpgradeRollResult>;
    onRollError?: (error: unknown) => void;
}

export const BizUpgradeModal: React.FC<BizUpgradeModalProps> = ({ isOpen, onClose, asset, onUpgrade, onRollFirst, onRollSecond, onRollError }) => {
    const [step, setStep] = useState<'intro' | 'rolling1' | 'result1' | 'rolling2' | 'result2'>('intro');
    const [dice1Value, setDice1Value] = useState(1);
    const [dice2Value, setDice2Value] = useState(1);
    const [isEligible, setIsEligible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [upgradeFailed, setUpgradeFailed] = useState(false);

    if (!isOpen) return null;

    const symbolMatch = asset.name.match(/[A-Z]\d+/);
    const symbol = symbolMatch ? symbolMatch[0] : asset.name;

    const remoteMode = !!onRollFirst || !!onRollSecond;

    const waitForPresentation = async (durationMs?: number) => {
        const duration = Math.max(0, durationMs ?? 0);
        if (!duration) return;
        await new Promise<void>(resolve => window.setTimeout(resolve, duration));
    };

    const handleStartRoll1 = async () => {
        setStep('rolling1');
        if (onRollFirst) {
            try {
                const result = await onRollFirst();
                await waitForPresentation(result.presentationDurationMs);
                setDice1Value(result.roll);
                setIsEligible(result.eligible ?? result.roll >= 5);
                setStep('result1');
            } catch (error) {
                setStep('intro');
                onRollError?.(error);
            }
            return;
        }
        setTimeout(() => {
            const val = Math.floor(Math.random() * 6) + 1;
            setDice1Value(val);
            setIsEligible(val >= 5);
            setStep('result1');
        }, 2000);
    };

    const handleStartRoll2 = async () => {
        if (isSubmitting) return;
        setStep('rolling2');
        setUpgradeFailed(false);
        if (onRollSecond) {
            setIsSubmitting(true);
            try {
                const result = await onRollSecond();
                await waitForPresentation(result.presentationDurationMs);
                setDice2Value(result.roll);
                setUpgradeFailed(!(await onUpgrade(result.roll)));
                setStep('result2');
            } catch (error) {
                setStep('result1');
                onRollError?.(error);
            } finally {
                setIsSubmitting(false);
            }
            return;
        }
        setTimeout(async () => {
            const val = Math.floor(Math.random() * 6) + 1;
            setDice2Value(val);
            setIsSubmitting(true);
            try {
                setUpgradeFailed(!(await onUpgrade(val)));
                setStep('result2');
            } finally {
                setIsSubmitting(false);
            }
        }, 2000);
    };

    const handleClose = () => {
        onClose();
    };


    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-2 pt-safe pb-safe bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300 sm:p-4">
            <div className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-y-auto overscroll-contain rounded-3xl border-2 border-slate-700 bg-slate-900 shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="absolute right-2 top-2 z-10 rounded-full p-2 text-slate-400 transition-colors hover:text-white sm:right-4 sm:top-4"
                >
                    <X size={24} />
                </button>

                <div className="flex flex-col items-center space-y-4 p-4 text-center sm:space-y-6 sm:p-8">
                    {/* Header Icon */}
                    <div className={cn(
                        "flex h-16 w-16 shrink-0 items-center justify-center rounded-full transition-colors duration-500 sm:h-20 sm:w-20",
                        step === 'result2' ? "bg-emerald-500/20 text-emerald-500" :
                        step === 'result1' && !isEligible ? "bg-rose-500/20 text-rose-500" :
                        "bg-amber-500/20 text-amber-500"
                    )}>
                        <ArrowUpCircle size={48} />
                    </div>

                    <div className="space-y-1 sm:space-y-2">
                        <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">企業升級：{symbol}</h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            兼職工作室將升等為小型企業
                        </p>
                    </div>

                    {/* Content Area */}
                    <div className="w-full space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:space-y-4 sm:p-6">
                        {step === 'intro' && (
                            <div className="space-y-4">
                                <div className="text-left space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">第一骰：升級判定</h4>
                                    <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                                            <Dice5 size={20} />
                                        </div>
                                        <span className="text-sm text-slate-200 font-medium">擲骰子 ≥ 5 才能升級</span>
                                    </div>
                                </div>
                                <div className="text-left space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">第二骰：收入決定</h4>
                                    <ul className="space-y-2 text-sm text-emerald-400 font-bold">
                                        <li className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                                            <span>貸款與利息全數取消</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                                            <span className="whitespace-nowrap">企業收入增加 (第二骰點數 × 10,000)</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {(step === 'rolling1' || step === 'result1') && (
                            <div className="flex flex-col items-center justify-center space-y-3 py-2 sm:space-y-4 sm:py-4">
                                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">第一骰：升級判定</div>
                                {remoteMode ? (
                                    <div className="flex h-24 w-40 items-center justify-center rounded-3xl border-2 border-dashed border-slate-700 bg-slate-950/70 px-4 text-center text-sm font-black leading-relaxed text-slate-300 sm:h-32 sm:w-44">
                                        {step === 'rolling1' ? '骰點已送出\n請看大螢幕' : `${dice1Value} 點`}
                                    </div>
                                ) : <DiceFace value={dice1Value} rolling={step === 'rolling1'} size="lg" />}
                                {step === 'result1' && (
                                    <div className={cn(
                                        "text-xl font-black tracking-tight animate-in zoom-in duration-300",
                                        isEligible ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {isEligible ? `${dice1Value} 點・符合升級！` : `${dice1Value} 點・未達標，下次再試`}
                                    </div>
                                )}
                            </div>
                        )}

                        {(step === 'rolling2' || step === 'result2') && (
                            <div className="flex flex-col items-center justify-center space-y-3 py-2 sm:space-y-4 sm:py-4">
                                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">第二骰：收入決定</div>
                                {remoteMode ? (
                                    <div className="flex h-24 w-40 items-center justify-center rounded-3xl border-2 border-dashed border-slate-700 bg-slate-950/70 px-4 text-center text-sm font-black leading-relaxed text-slate-300 sm:h-32 sm:w-44">
                                        {step === 'rolling2' ? '骰點已送出\n請看大螢幕' : `${dice2Value} 點`}
                                    </div>
                                ) : <DiceFace value={dice2Value} rolling={step === 'rolling2'} size="lg" />}
                                {step === 'result2' && (
                                    <div className="flex flex-col items-center gap-2 animate-in zoom-in duration-300">
                                        {upgradeFailed ? (
                                            <>
                                                <div className="text-xl font-black text-rose-400">升級同步失敗</div>
                                                <div className="text-sm text-slate-300 font-bold">資料未完成更新，請重新擲第二骰。</div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-xl font-black text-emerald-400">升級成功！</div>
                                                <div className="w-full space-y-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-left text-sm font-bold text-slate-200 sm:p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <span className="text-slate-400">資產狀態</span>
                                                        <span className="text-right text-emerald-300">已升級為小型企業</span>
                                                    </div>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <span className="text-slate-400">企業收入</span>
                                                        <span className="text-right text-emerald-300">+{formatMoney(dice2Value * 10000)}／月</span>
                                                    </div>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <span className="text-slate-400">企業貸款</span>
                                                        <span className="text-right text-emerald-300">本金與利息已取消</span>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="w-full pt-2">
                        {step === 'intro' && (
                            <Button
                                onClick={handleStartRoll1}
                                className="min-h-12 w-full rounded-2xl bg-emerald-600 py-3 text-base font-black text-white shadow-lg shadow-emerald-900/40 transition-all hover:bg-emerald-500 active:scale-95 sm:py-4 sm:text-lg"
                            >
                                開始擲骰子（第一骰）
                            </Button>
                        )}
                        {step === 'result1' && isEligible && (
                            <Button
                                onClick={handleStartRoll2}
                                className="min-h-12 w-full rounded-2xl bg-emerald-600 py-3 text-base font-black text-white shadow-lg shadow-emerald-900/40 transition-all hover:bg-emerald-500 active:scale-95 sm:py-4 sm:text-lg"
                            >
                                擲骰子決定收入（第二骰）
                            </Button>
                        )}
                        {step === 'result1' && !isEligible && (
                            <Button
                                onClick={handleClose}
                                className="min-h-12 w-full rounded-2xl bg-slate-700 py-3 text-base font-black text-white shadow-lg shadow-slate-900/40 transition-all hover:bg-slate-600 active:scale-95 sm:py-4 sm:text-lg"
                            >
                                關閉
                            </Button>
                        )}
                        {step === 'result2' && (
                            <Button
                                onClick={upgradeFailed ? handleStartRoll2 : handleClose}
                                disabled={isSubmitting}
                                className={`min-h-12 w-full rounded-2xl py-3 text-base font-black text-white shadow-lg shadow-emerald-900/40 transition-all active:scale-95 disabled:opacity-60 sm:py-4 sm:text-lg ${upgradeFailed ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                            >
                                {isSubmitting ? '同步中...' : upgradeFailed ? '重新擲第二骰' : '太棒了！'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

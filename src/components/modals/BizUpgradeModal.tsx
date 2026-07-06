import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUpCircle, Dice5, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/ui';
import { Asset } from '../../types';
import { DiceFace } from '../game/DiceFace';
import { cn, formatMoney } from '../../utils/gameUtils';

interface BizUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset;
    onUpgrade: (diceRoll: number) => void;
}

export const BizUpgradeModal: React.FC<BizUpgradeModalProps> = ({ isOpen, onClose, asset, onUpgrade }) => {
    const [step, setStep] = useState<'intro' | 'rolling1' | 'result1' | 'rolling2' | 'result2'>('intro');
    const [dice1Value, setDice1Value] = useState(1);
    const [dice2Value, setDice2Value] = useState(1);
    const [isEligible, setIsEligible] = useState(false);

    if (!isOpen) return null;

    const symbolMatch = asset.name.match(/[A-Z]\d+/);
    const symbol = symbolMatch ? symbolMatch[0] : asset.name;

    const handleStartRoll1 = () => {
        setStep('rolling1');
        setTimeout(() => {
            const val = Math.floor(Math.random() * 6) + 1;
            setDice1Value(val);
            setIsEligible(val >= 5);
            setStep('result1');
        }, 2000);
    };

    const handleStartRoll2 = () => {
        setStep('rolling2');
        setTimeout(() => {
            const val = Math.floor(Math.random() * 6) + 1;
            setDice2Value(val);
            onUpgrade(val);
            setStep('result2');
        }, 2000);
    };

    const handleClose = () => {
        onClose();
    };


    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pt-safe pb-safe bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900 border-2 border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
                >
                    <X size={24} />
                </button>

                <div className="p-8 flex flex-col items-center text-center space-y-6">
                    {/* Header Icon */}
                    <div className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center transition-colors duration-500",
                        step === 'result2' ? "bg-emerald-500/20 text-emerald-500" :
                        step === 'result1' && !isEligible ? "bg-rose-500/20 text-rose-500" :
                        "bg-amber-500/20 text-amber-500"
                    )}>
                        <ArrowUpCircle size={48} />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-white tracking-tight">企業升級：{symbol}</h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            兼職工作室將升等為小型企業
                        </p>
                    </div>

                    {/* Content Area */}
                    <div className="w-full bg-slate-950/50 rounded-2xl p-6 space-y-4 border border-slate-800">
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
                            <div className="flex flex-col items-center justify-center py-4 space-y-4">
                                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">第一骰：升級判定</div>
                                <DiceFace value={dice1Value} rolling={step === 'rolling1'} size="lg" />
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
                            <div className="flex flex-col items-center justify-center py-4 space-y-4">
                                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">第二骰：收入決定</div>
                                <DiceFace value={dice2Value} rolling={step === 'rolling2'} size="lg" />
                                {step === 'result2' && (
                                    <div className="flex flex-col items-center gap-2 animate-in zoom-in duration-300">
                                        <div className="text-xl font-black text-emerald-400">升級成功！</div>
                                        <div className="text-sm text-slate-300 font-bold">
                                            企業收入增加 +{formatMoney(dice2Value * 10000)}
                                        </div>
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
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
                            >
                                開始擲骰子（第一骰）
                            </Button>
                        )}
                        {step === 'result1' && isEligible && (
                            <Button
                                onClick={handleStartRoll2}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
                            >
                                擲骰子決定收入（第二骰）
                            </Button>
                        )}
                        {step === 'result1' && !isEligible && (
                            <Button
                                onClick={handleClose}
                                className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-black text-lg rounded-2xl shadow-lg shadow-slate-900/40 transition-all active:scale-95"
                            >
                                關閉
                            </Button>
                        )}
                        {step === 'result2' && (
                            <Button
                                onClick={handleClose}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
                            >
                                太棒了！
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

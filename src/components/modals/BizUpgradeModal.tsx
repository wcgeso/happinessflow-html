import React, { useState, useEffect } from 'react';
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
    const [step, setStep] = useState<'intro' | 'rolling' | 'result'>('intro');
    const [diceValue, setDiceValue] = useState(1);
    const [isSuccess, setIsSuccess] = useState(false);

    if (!isOpen) return null;

    const symbolMatch = asset.name.match(/[A-Z]\d+/);
    const symbol = symbolMatch ? symbolMatch[0] : asset.name;

    const handleStartRoll = () => {
        setStep('rolling');
        // Roll for 2 seconds
        setTimeout(() => {
            const finalValue = Math.floor(Math.random() * 6) + 1;
            setDiceValue(finalValue);
            setIsSuccess(finalValue >= 5);
            setStep('result');
        }, 2000);
    };

    const handleConfirm = () => {
        if (isSuccess) {
            onUpgrade(diceValue);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
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
                        step === 'result' 
                            ? (isSuccess ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500")
                            : "bg-amber-500/20 text-amber-500"
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
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">升級條件</h4>
                                    <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                                            <Dice5 size={20} />
                                        </div>
                                        <span className="text-sm text-slate-200 font-medium">經過銀行時，擲骰子 ≥ 5</span>
                                    </div>
                                </div>
                                <div className="text-left space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">成功獎勵</h4>
                                    <ul className="space-y-2 text-sm text-emerald-400 font-bold">
                                        <li className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                                            <span>貸款與利息全數取消</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                                            <span>企業收入增加 (骰子點數 × 10,000 H)</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {(step === 'rolling' || step === 'result') && (
                            <div className="flex flex-col items-center justify-center py-4 space-y-6">
                                <DiceFace 
                                    value={diceValue} 
                                    rolling={step === 'rolling'} 
                                    size="lg" 
                                />
                                {step === 'result' && (
                                    <div className={cn(
                                        "text-xl font-black tracking-tight animate-in zoom-in duration-300",
                                        isSuccess ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {isSuccess ? "升級成功！" : "升級失敗，下次再試"}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="w-full pt-2">
                        {step === 'intro' && (
                            <Button 
                                onClick={handleStartRoll}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
                            >
                                開始擲骰子
                            </Button>
                        )}
                        {step === 'result' && (
                            <Button 
                                onClick={handleConfirm}
                                className={cn(
                                    "w-full py-4 text-white font-black text-lg rounded-2xl shadow-lg transition-all active:scale-95",
                                    isSuccess 
                                        ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40" 
                                        : "bg-slate-700 hover:bg-slate-600 shadow-slate-900/40"
                                )}
                            >
                                {isSuccess ? "太棒了！" : "關閉"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

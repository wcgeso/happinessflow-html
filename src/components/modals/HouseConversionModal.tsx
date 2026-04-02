import React, { useState } from 'react';
import { X, Home, Key, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Asset } from '../../types';
import { REAL_ESTATE_PRESETS } from '../../constants';
import { cn, formatMoney } from '../../utils/gameUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface HouseConversionModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset;
    onConvert: (assetId: string, toSelfUse: boolean) => void;
}

export const HouseConversionModal: React.FC<HouseConversionModalProps> = ({
    isOpen,
    onClose,
    asset,
    onConvert
}) => {
    const [step, setStep] = useState<'options' | 'confirm'>('options');
    const [targetType, setTargetType] = useState<boolean | null>(null);

    const symbolMatch = asset.name.match(/[A-Z]\d+/);
    const symbol = symbolMatch ? symbolMatch[0] : '';
    const preset = REAL_ESTATE_PRESETS[symbol];
    
    const canConvert = (asset.conversionCount || 0) < 1;
    const isCurrentlySelfUse = !!asset.isSelfUse;

    const handleStartConfirm = (toSelfUse: boolean) => {
        setTargetType(toSelfUse);
        setStep('confirm');
    };

    const handleFinalConfirm = () => {
        if (targetType !== null) {
            onConvert(asset.id, targetType);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-safe pb-safe bg-slate-950/90 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-slate-900 border-2 border-slate-700 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-xl">
                            <Home className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white tracking-tight">房屋狀態轉換</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{symbol} 房產管理</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <AnimatePresence mode="wait">
                        {step === 'options' ? (
                            <motion.div 
                                key="options"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-6"
                            >
                                {/* Current Status */}
                                <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-slate-400">目前狀態</span>
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg",
                                            isCurrentlySelfUse ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/30" : "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                                        )}>
                                            {isCurrentlySelfUse ? '自用房屋' : '出租房屋'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-400">剩餘轉換次數</span>
                                        <span className={cn(
                                            "text-xs font-black",
                                            canConvert ? "text-emerald-400" : "text-rose-400"
                                        )}>
                                            {1 - (asset.conversionCount || 0)} 次
                                        </span>
                                    </div>
                                </div>

                                {!canConvert ? (
                                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3">
                                        <AlertCircle className="text-rose-500 shrink-0" size={20} />
                                        <p className="text-xs text-rose-200/80 leading-relaxed font-medium">
                                            此房屋已經進行過一次轉換，遊戲規則規定每間房屋僅能轉換一次狀態。
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        <button
                                            onClick={() => handleStartConfirm(true)}
                                            disabled={isCurrentlySelfUse}
                                            className={cn(
                                                "w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2",
                                                isCurrentlySelfUse 
                                                    ? "bg-slate-800/20 border-slate-800 text-slate-600 grayscale" 
                                                    : "bg-yellow-500/10 border-yellow-500/20 hover:border-yellow-500/50 text-yellow-500 group"
                                            )}
                                        >
                                            <Home size={24} className={cn(isCurrentlySelfUse ? "" : "group-hover:scale-110 transition-transform")} />
                                            <span className="font-black text-sm tracking-widest">轉為自用</span>
                                            <span className="text-[10px] opacity-60 font-bold">自用可獲得幸福點數，但不產生租金收入</span>
                                        </button>

                                        <button
                                            onClick={() => handleStartConfirm(false)}
                                            disabled={!isCurrentlySelfUse}
                                            className={cn(
                                                "w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2",
                                                !isCurrentlySelfUse 
                                                    ? "bg-slate-800/20 border-slate-800 text-slate-600 grayscale" 
                                                    : "bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50 text-blue-500 group"
                                            )}
                                        >
                                            <Key size={24} className={cn(!isCurrentlySelfUse ? "" : "group-hover:scale-110 transition-transform")} />
                                            <span className="font-black text-sm tracking-widest">轉為出租</span>
                                            <span className="text-[10px] opacity-60 font-bold">出租可獲得每月租金，但不會計入自用幸福感</span>
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="confirm"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6 text-center"
                            >
                                <div className="mx-auto w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mb-4">
                                    <AlertCircle className="text-amber-500" size={32} />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xl font-black text-white">確定要轉換嗎？</h4>
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        您即將將此房屋轉換為 <span className={cn("font-bold", targetType ? "text-yellow-400" : "text-blue-400")}>{targetType ? '自用' : '出租'}</span> 狀態。<br/>
                                        <span className="text-rose-400 font-black">注意：此動作無法復原，且每間房僅限轉換一次。</span>
                                    </p>
                                </div>

                                <div className="flex flex-col gap-3 pt-4">
                                    <button
                                        onClick={handleFinalConfirm}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 size={20} />
                                        確認轉換
                                    </button>
                                    <button
                                        onClick={() => setStep('options')}
                                        className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-all"
                                    >
                                        取消
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

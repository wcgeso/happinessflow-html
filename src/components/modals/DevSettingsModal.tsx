
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, Settings, ShieldCheck } from 'lucide-react';
import { Button, Input } from '../ui/ui';
import { formatMoney } from '../../utils/gameUtils';

interface DevSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddMoney: (amount: number) => void;
    currentCash: number;
}

export const DevSettingsModal: React.FC<DevSettingsModalProps> = ({
    isOpen,
    onClose,
    onAddMoney,
    currentCash
}) => {
    const [amount, setAmount] = useState<string>('100000');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = Number(amount);
        if (!isNaN(numAmount) && numAmount !== 0) {
            onAddMoney(numAmount);
            // 不關閉視窗，方便連續操作，但可以給個提示
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm z-[120] px-4"
                    >
                        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 p-5 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/20">
                                        <ShieldCheck size={20} className="text-slate-900" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black tracking-tight">開發者設定</h3>
                                        <p className="text-[10px] text-amber-500/70 font-bold uppercase tracking-widest">Developer Mode Only</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                                >
                                    <X size={18} className="text-slate-400" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <DollarSign size={14} className="text-amber-500" />
                                            增加金錢
                                        </label>
                                        <span className="text-[10px] font-mono text-slate-500">
                                            目前: {formatMoney(currentCash)}
                                        </span>
                                    </div>
                                    
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                placeholder="輸入金額 (正數增加，負數減少)"
                                                className="pl-4 py-4 text-lg font-black bg-slate-800/50 border-slate-700 focus:border-amber-500 transition-all"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            {[10000, 50000, 100000, 500000].map((val) => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setAmount(val.toString())}
                                                    className="py-2 text-[10px] font-black bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/50 transition-all active:scale-95"
                                                >
                                                    +{formatMoney(val)}
                                                </button>
                                            ))}
                                        </div>

                                        <Button 
                                            type="submit"
                                            variant="amber"
                                            className="w-full py-4 rounded-2xl shadow-lg shadow-amber-900/20 font-black tracking-wider"
                                        >
                                            執行調整
                                        </Button>
                                    </form>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 bg-slate-950/50 border-t border-white/5">
                                <p className="text-[9px] text-center text-slate-500 font-medium">
                                    此操作將直接修改本地遊戲狀態，僅供開發測試使用。
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

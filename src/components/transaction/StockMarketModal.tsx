import React, { useState } from 'react';
import { X, TrendingUp, AlertCircle } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { STOCK_SYMBOLS, STOCK_NAMES } from '../../constants';
import { Button, Input } from '../ui/ui';

interface StockMarketModalProps {
    onClose: () => void;
}

export const StockMarketModal: React.FC<StockMarketModalProps> = ({ onClose }) => {
    const context = useGame();
    if (!context) return null;
    const { gameState, updateMarketPrices, bubbleBurst } = context;
    const [updates, setUpdates] = useState<Record<string, string>>({});
    const [showBubbleBurstConfirm, setShowBubbleBurstConfirm] = useState(false);
    const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
    const [showInputError, setShowInputError] = useState(false);

    const handleUpdate = () => {
        const numericUpdates: Record<string, number> = {};
        Object.entries(updates).forEach(([symbol, value]) => {
            if (value && !isNaN(Number(value))) {
                numericUpdates[symbol] = Number(value);
            }
        });

        if (Object.keys(numericUpdates).length === 0) {
            setShowInputError(true);
            return;
        }

        updateMarketPrices(numericUpdates);
        setShowUpdateConfirm(false);
        onClose();
    };

    const handleBubbleBurst = () => {
        bubbleBurst();
        setShowBubbleBurstConfirm(false);
        onClose();
    };

    const preCheckUpdate = () => {
        const hasUpdates = Object.values(updates).some(v => v !== '' && !isNaN(Number(v)));
        if (!hasUpdates) {
            setShowInputError(true);
            return;
        }
        setShowUpdateConfirm(true);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
            {showInputError && (
                <div className="absolute inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 border-2 border-amber-500/50 w-full max-w-sm rounded-3xl shadow-[0_0_50px_-12px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col">
                        <div className="p-8 text-center space-y-6">
                            <div className="mx-auto w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center">
                                <AlertCircle className="text-amber-500" size={48} />
                            </div>
                            
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white tracking-tight">請輸入價格</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    您必須至少輸入一個有效的股票價格，才能進行行情更新。
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <Button 
                                    onClick={() => setShowInputError(false)}
                                    className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-amber-900/40 transition-all active:scale-95"
                                >
                                    我知道了
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showUpdateConfirm && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 border-2 border-emerald-500/50 w-full max-w-sm rounded-3xl shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)] overflow-hidden flex flex-col">
                        <div className="p-8 text-center space-y-6">
                            <div className="mx-auto w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                <TrendingUp className="text-emerald-500" size={48} />
                            </div>
                            
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white tracking-tight">確認更新行情</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    您即將調整市場價格，這將即時反應在所有玩家的資產價值中。
                                </p>
                            </div>

                            <div className="max-h-40 overflow-y-auto custom-scrollbar bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-2">
                                {Object.entries(updates).map(([symbol, price]) => {
                                    const oldPrice = gameState.marketPrices[symbol] || 0;
                                    const newPrice = Number(price);
                                    const isRise = newPrice > oldPrice;
                                    
                                    return (
                                        <div key={symbol} className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0">
                                            <span className="text-xs font-black text-slate-400">{symbol}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-mono text-slate-600 line-through">{oldPrice}</span>
                                                <div className={`flex items-center gap-1 font-mono font-bold ${isRise ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    <span>{newPrice}</span>
                                                    <span className="text-[8px] uppercase">H</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <Button 
                                    onClick={handleUpdate}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
                                >
                                    確認並發布行情
                                </Button>
                                <button 
                                    onClick={() => setShowUpdateConfirm(false)}
                                    className="w-full py-3 text-slate-400 hover:text-white font-bold text-sm transition-colors"
                                >
                                    取消
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showBubbleBurstConfirm && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 border-2 border-rose-500/50 w-full max-w-sm rounded-3xl shadow-[0_0_50px_-12px_rgba(225,29,72,0.5)] overflow-hidden flex flex-col animate-bounce-in">
                        <div className="p-8 text-center space-y-6">
                            <div className="mx-auto w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center animate-pulse">
                                <AlertCircle className="text-rose-500" size={48} />
                            </div>
                            
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white tracking-tight">泡沫化風暴來襲！</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    這是一場毀滅性的金融危機。確定要觸發嗎？
                                </p>
                            </div>

                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-left space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                    <p className="text-[12px] text-rose-200/80 font-medium">所有持有股票張數將 <span className="text-rose-400 font-bold underline">立即減半</span></p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                    <p className="text-[12px] text-rose-200/80 font-medium">不滿 1 張的部分將無條件捨去</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                    <p className="text-[12px] text-rose-200/80 font-medium">數量歸 0 的股票將被 <span className="text-rose-400 font-bold underline">強制下市</span> (移除)</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <Button 
                                    onClick={handleBubbleBurst}
                                    className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-rose-900/40 transition-all active:scale-95"
                                >
                                    確定觸發風暴
                                </Button>
                                <button 
                                    onClick={() => setShowBubbleBurstConfirm(false)}
                                    className="w-full py-3 text-slate-400 hover:text-white font-bold text-sm transition-colors"
                                >
                                    我再想想 (取消)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <TrendingUp className="text-emerald-500" size={20} />
                        </div>
                        <h2 className="text-xl font-black text-white tracking-tight">股票市場行情</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    <div className="grid grid-cols-3 gap-4 px-2 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                        <span>代號</span>
                        <span className="text-center">目前股價</span>
                        <span className="text-right">更新價格</span>
                    </div>

                    <div className="space-y-2">
                        {STOCK_SYMBOLS.map((symbol) => {
                            const currentPrice = (gameState.marketPrices && gameState.marketPrices[symbol]) || 0;
                            return (
                                <div key={symbol} className="grid grid-cols-3 gap-4 items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:border-emerald-500/30 transition-colors group">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">{symbol}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">{STOCK_NAMES[symbol]}</span>
                                    </div>
                                    <div className="text-center">
                                        <span className="text-sm font-mono font-bold text-slate-300">
                                            {currentPrice > 0 ? `${currentPrice.toLocaleString()} H` : '尚未開盤'}
                                        </span>
                                    </div>
                                    <Input
                                        type="number"
                                        placeholder="新價格"
                                        className="h-9 text-xs text-right bg-slate-950 border-slate-700 focus:ring-emerald-500/50"
                                        value={updates[symbol] || ''}
                                        onChange={(e) => setUpdates({ ...updates, [symbol]: e.target.value })}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-3 bg-amber-900/10 border border-amber-500/20 rounded-lg flex gap-3">
                        <AlertCircle className="text-amber-500 shrink-0" size={16} />
                        <p className="text-[11px] text-amber-200/70 leading-relaxed">
                            提示：更新市場價格後，所有持有該股票的玩家其資產價值將根據新價格重新計算。
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-slate-900/80 border-t border-slate-800 space-y-3">
                    <Button 
                        onClick={() => setShowBubbleBurstConfirm(true)} 
                        className="w-full py-3 text-sm font-bold bg-rose-900/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <AlertCircle size={16} />
                        觸發泡沫化風暴
                    </Button>
                    <Button 
                        onClick={preCheckUpdate} 
                        className="w-full py-4 text-lg font-black bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-900/20 transition-all active:scale-95"
                    >
                        更新市場行情
                    </Button>
                </div>
            </div>
        </div>
    );
};

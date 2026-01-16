import React, { useState } from 'react';
import { X, TrendingUp, AlertCircle, ShoppingCart, LineChart } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { STOCK_SYMBOLS, STOCK_NAMES } from '../../constants';
import { Button } from '../ui/ui';

interface StockMarketModalProps {
    onClose: () => void;
    onOpenTrade?: () => void;
    onOpenStockCodes?: () => void;
    marketPrices?: Record<string, number>;
    previousMarketPrices?: Record<string, number>;
}

export const StockMarketModal: React.FC<StockMarketModalProps> = ({ 
    onClose, 
    onOpenTrade, 
    onOpenStockCodes,
    marketPrices, 
    previousMarketPrices 
}) => {
    const { gameState } = useGame();
    const [showEventResult, setShowEventResult] = useState(false);

    // 優先使用傳入的價格（執行師模式），否則使用 gameState（玩家模式）
    const currentMarketPrices = marketPrices || gameState.marketPrices;
    const currentPreviousMarketPrices = previousMarketPrices || gameState.previousMarketPrices;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
            {showEventResult && (
                <div className="absolute inset-0 z-[130] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                    <div className="bg-slate-900 border-2 border-rose-500/50 w-full max-w-sm rounded-3xl shadow-[0_0_80px_-12px_rgba(244,63,94,0.4)] overflow-hidden flex flex-col">
                        <div className="p-8 text-center space-y-6">
                            <div className="mx-auto w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center animate-pulse">
                                <AlertCircle className="text-rose-500" size={56} />
                            </div>
                            
                            <div className="space-y-3">
                                <h3 className="text-3xl font-black text-white tracking-tighter">泡沫化風暴來襲！</h3>
                                <p className="text-rose-200/60 text-sm leading-relaxed">
                                    市場發生劇烈動盪，資產正在縮水...
                                </p>
                            </div>

                            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 space-y-4">
                                <div className="flex items-start gap-4 text-left">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 mt-2 shrink-0" />
                                    <p className="text-sm text-rose-100/90 font-medium">所有持有股票張數 <span className="text-rose-400 font-bold underline">立即減半</span></p>
                                </div>
                                <div className="flex items-start gap-4 text-left">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 mt-2 shrink-0" />
                                    <p className="text-sm text-rose-100/90 font-medium">不滿 1 張的部分將無條件捨去</p>
                                </div>
                                <div className="flex items-start gap-4 text-left">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 mt-2 shrink-0" />
                                    <p className="text-sm text-rose-100/90 font-medium">數量歸 0 的股票將被 <span className="text-rose-400 font-bold underline">強制下市</span></p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button 
                                      onClick={() => {
                                          setShowEventResult(false);
                                      }}
                                      className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xl rounded-2xl shadow-lg shadow-rose-900/40 transition-all active:scale-95"
                                  >
                                      接受現實
                                  </Button>
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
                    <div className="flex items-center gap-2">
                        {onOpenStockCodes && (
                            <button
                                onClick={onOpenStockCodes}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                            >
                                <LineChart size={14} />
                                股市代碼
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>



                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    <div className="grid grid-cols-4 gap-4 px-2 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                        <span>代號</span>
                        <span className="text-center">前值</span>
                        <span className="text-right">目前股價</span>
                        <span className="text-right">漲幅%</span>
                    </div>

                    <div className="space-y-2">
                        {STOCK_SYMBOLS.map((symbol) => {
                            const currentPrice = (currentMarketPrices && currentMarketPrices[symbol]) || 0;
                            const prevPrice = (currentPreviousMarketPrices && currentPreviousMarketPrices[symbol]) || 0;
                            const isRise = currentPrice > prevPrice;
                            const isFall = currentPrice < prevPrice;

                            // 計算漲幅 %
                            let changePercent = 0;
                            if (prevPrice > 0) {
                                changePercent = ((currentPrice - prevPrice) / prevPrice) * 100;
                            }

                            return (
                                <div key={symbol} className="grid grid-cols-4 gap-4 items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:border-emerald-500/30 transition-colors group">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">{symbol}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">{STOCK_NAMES[symbol]}</span>
                                    </div>
                                    <div className="text-center">
                                        <span className="text-sm font-mono font-bold text-slate-500">
                                            {prevPrice > 0 ? prevPrice.toLocaleString() : '-'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-sm font-mono font-bold ${isRise ? 'text-emerald-400' : isFall ? 'text-rose-400' : 'text-slate-300'}`}>
                                            {currentPrice > 0 ? currentPrice.toLocaleString() : '尚未開盤'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs font-mono font-black ${isRise ? 'text-emerald-400' : isFall ? 'text-rose-400' : 'text-slate-500'}`}>
                                            {prevPrice > 0 ? (
                                                <>
                                                    {isRise ? '+' : ''}{changePercent.toFixed(1)}%
                                                </>
                                            ) : '-'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </div>

                <div className="p-4 bg-slate-900/80 border-t border-slate-800 space-y-3 shrink-0">
                    <div className="flex gap-3">
                        {onOpenTrade && (
                            <Button 
                                onClick={onOpenTrade}
                                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-amber-900/40 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <ShoppingCart size={20} />
                                前往交易
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

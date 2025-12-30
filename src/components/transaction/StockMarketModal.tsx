import React, { useState, useEffect } from 'react';
import { X, TrendingUp, AlertCircle, History, Search, ShoppingCart } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { STOCK_SYMBOLS, STOCK_NAMES, STOCK_DATA, BUBBLE_BURST_CODES } from '../../constants';
import { Button, Input } from '../ui/ui';

interface StockMarketModalProps {
    onClose: () => void;
    onOpenTrade?: () => void;
}

export const StockMarketModal: React.FC<StockMarketModalProps> = ({ onClose, onOpenTrade }) => {
    const context = useGame();
    if (!context) return null;
    const { gameState, updateMarketPrices, bubbleBurst } = context;
    const [stockCode, setStockCode] = useState('');
    const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
    const [showInputError, setShowInputError] = useState(false);
    const [showDoublePublishError, setShowDoublePublishError] = useState(false);
    const [showEventResult, setShowEventResult] = useState(false);

    // 計算大盤點數：8 支股票價格總和 / 8
    const calculateMarketIndex = (prices: Record<string, number>) => {
        if (!prices) return 0;
        const sum = STOCK_SYMBOLS.reduce((acc, symbol) => acc + (prices[symbol] || 0), 0);
        return sum / STOCK_SYMBOLS.length;
    };

    const handleUpdate = () => {
        const upperCode = stockCode.toUpperCase();
        
        // 1. 取得更新數據
        const numericUpdates = STOCK_DATA[upperCode];
        
        if (numericUpdates) {
            // 計算當前大盤點數 (目前市場價格)
            const currentPrices = gameState.marketPrices || {};
            const currentIndex = calculateMarketIndex(currentPrices);
            
            // 計算更新後的大盤點數
            const newIndex = calculateMarketIndex(numericUpdates);
            
            // 判斷跌幅是否超過 70%
            // 如果是第一次發布行情 (currentIndex 為 0)，不觸發大盤跌幅泡沫化
            const dropRate = currentIndex > 0 ? (newIndex - currentIndex) / currentIndex : 0;
            const isMarketCrash = dropRate < -0.7;

            // 執行更新
            updateMarketPrices(numericUpdates, upperCode);

            // 觸發泡沫化條件：大盤跌幅超過 70% OR 代碼在 BUBBLE_BURST_CODES 中
            if (isMarketCrash || BUBBLE_BURST_CODES.includes(upperCode)) {
                bubbleBurst(upperCode);
                setShowUpdateConfirm(false);
                setShowEventResult(true);
                return;
            }
        } else if (BUBBLE_BURST_CODES.includes(upperCode)) {
            // 處理純事件代碼
            bubbleBurst(upperCode);
            setShowUpdateConfirm(false);
            setShowEventResult(true);
            return;
        }

        setShowUpdateConfirm(false);
        setStockCode(''); // 清空輸入框
    };

    const handleCodeChange = (code: string) => {
        const upperCode = code.toUpperCase();
        setStockCode(upperCode);
        if (STOCK_DATA[upperCode] || BUBBLE_BURST_CODES.includes(upperCode)) {
            setShowInputError(false);
            if (upperCode !== gameState.lastPublishedCode) {
                setShowDoublePublishError(false);
            }
        }
    };

    const preCheckUpdate = () => {
        const upperCode = stockCode.toUpperCase();
        
        // 檢查是否為當下已發布的行情
        if (upperCode === gameState.lastPublishedCode) {
            setShowDoublePublishError(true);
            return;
        }

        if (BUBBLE_BURST_CODES.includes(upperCode) || STOCK_DATA[upperCode]) {
            setShowUpdateConfirm(true);
            return;
        }
        setShowInputError(true);
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
                                <h3 className="text-2xl font-black text-white tracking-tight">無效的代碼</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    請輸入有效的股市代碼（例如：N001, N025 等）。
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

            {showDoublePublishError && (
                <div className="absolute inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 border-2 border-rose-500/50 w-full max-w-sm rounded-3xl shadow-[0_0_50px_-12px_rgba(244,63,94,0.3)] overflow-hidden flex flex-col">
                        <div className="p-8 text-center space-y-6">
                            <div className="mx-auto w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center">
                                <AlertCircle className="text-rose-500" size={48} />
                            </div>
                            
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white tracking-tight">重複發布行情</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    代碼 <span className="text-rose-400 font-bold">{gameState.lastPublishedCode}</span> 是目前正在生效的行情，請輸入其他代碼。
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <Button 
                                    onClick={() => setShowDoublePublishError(false)}
                                    className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-rose-900/40 transition-all active:scale-95"
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
                                    您確定要發布代碼 <span className="text-emerald-400 font-bold">{stockCode}</span> 的行情嗎？
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <Button 
                                    onClick={handleUpdate}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
                                >
                                    確認發布 {stockCode}
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
                                          setStockCode(''); // 清空輸入框
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
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 bg-slate-950/30 border-b border-slate-800 shrink-0">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="text-slate-500" size={16} />
                        </div>
                        <Input
                            placeholder="輸入股市代碼 (如: N001)"
                            className="pl-10 h-12 bg-slate-950 border-slate-700 focus:ring-emerald-500/50 text-white font-bold"
                            value={stockCode}
                            onChange={(e) => handleCodeChange(e.target.value)}
                        />
                        {stockCode && (STOCK_DATA[stockCode.toUpperCase()] || BUBBLE_BURST_CODES.includes(stockCode.toUpperCase())) && (
                            <div className="absolute right-3 inset-y-0 flex items-center">
                                <div className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/30 text-[10px] text-emerald-400 font-bold animate-in fade-in scale-in-95">
                                    有效代碼
                                </div>
                            </div>
                        )}
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
                            const currentPrice = (gameState.marketPrices && gameState.marketPrices[symbol]) || 0;
                            const prevPrice = (gameState.previousMarketPrices && gameState.previousMarketPrices[symbol]) || 0;
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

                    <div className="p-3 bg-amber-900/10 border border-amber-500/20 rounded-lg flex gap-3">
                        <AlertCircle className="text-amber-500 shrink-0" size={16} />
                        <p className="text-[11px] text-amber-200/70 leading-relaxed">
                            提示：輸入股市代碼後點擊「發布行情」，系統將自動帶入對應的股價數據。
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-slate-900/80 border-t border-slate-800 space-y-3 shrink-0">
                    <div className="flex gap-3">
                        <Button 
                            onClick={preCheckUpdate} 
                            disabled={!stockCode || (!STOCK_DATA[stockCode.toUpperCase()] && !BUBBLE_BURST_CODES.includes(stockCode.toUpperCase()))}
                            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                        >
                            發布行情
                        </Button>
                        {onOpenTrade && (
                            <Button 
                                onClick={onOpenTrade}
                                className="px-6 py-4 bg-amber-600 hover:bg-amber-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-amber-900/40 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <ShoppingCart size={20} />
                                立即交易
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

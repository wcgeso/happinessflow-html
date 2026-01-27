import React from 'react';
import { Input, Button } from '../ui/ui';
import { Asset } from '../../types';
import { STOCK_SYMBOLS, STOCK_NAMES } from '../../constants';
import { TrendingUp, PlusCircle } from 'lucide-react';

interface StockBuyFormProps {
    stockInputs: Record<string, { price: string; qty: string }>;
    setStockInputs: (val: Record<string, { price: string; qty: string }>) => void;
    marketPrices?: Record<string, number>;
    previousMarketPrices?: Record<string, number>;
    stockAssets: Asset[];
    onShowMarket?: () => void;
}

export const StockBuyForm: React.FC<StockBuyFormProps> = ({ 
    stockInputs, setStockInputs, marketPrices, previousMarketPrices, stockAssets, onShowMarket 
}) => {
    const handleBuyAllOne = () => {
        const newInputs = { ...stockInputs };
        STOCK_SYMBOLS.forEach(symbol => {
            const currentQty = parseInt(newInputs[symbol]?.qty || '0');
            const currentPrice = marketPrices?.[symbol] || 0;
            newInputs[symbol] = {
                price: currentPrice.toString(),
                qty: (currentQty + 1).toString()
            };
        });
        setStockInputs(newInputs);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Button 
                    onClick={handleBuyAllOne}
                    className="h-8 py-0 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-lg shadow-lg shadow-indigo-900/40 transition-all active:scale-95 flex items-center gap-1.5"
                >
                    <PlusCircle size={14} />
                    一鍵全買一張
                </Button>
                
                {onShowMarket && (
                    <Button 
                        onClick={onShowMarket}
                        className="h-8 py-0 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg shadow-lg shadow-emerald-900/40 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <TrendingUp size={14} />
                        查看行情
                    </Button>
                )}
            </div>
            
            <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 px-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>代號</span>
                    <span className="text-center">目前股價</span>
                    <span className="text-center">持有張數</span>
                    <span className="text-center">買入張數</span>
                </div>
                {STOCK_SYMBOLS.map((symbol) => {
                    const currentPrice = marketPrices?.[symbol] || 0;
                    const prevPrice = previousMarketPrices?.[symbol] || 0;
                    const isRise = currentPrice > prevPrice;
                    const isFall = currentPrice < prevPrice;

                    let changePercent = 0;
                    if (prevPrice > 0) {
                        changePercent = ((currentPrice - prevPrice) / prevPrice) * 100;
                    }

                    const holdingAsset = stockAssets.find(a => a.type === '股票' && a.name?.includes(symbol));
                    const holdingQty = holdingAsset?.quantity || 0;
                    
                    return (
                        <div key={symbol} className="grid grid-cols-4 gap-2 items-center bg-slate-900/40 p-2 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                            <div className="flex flex-col pl-1">
                                <span className="text-sm font-black text-slate-200">{symbol}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{STOCK_NAMES[symbol]}</span>
                            </div>
                            <div className="flex justify-center">
                                <div className="flex flex-col items-start">
                                    <div className="text-white font-mono text-sm font-bold">
                                        {currentPrice > 0 ? (
                                            <>
                                                {currentPrice.toLocaleString()}<span className="text-[10px] ml-0.5 opacity-70">H</span>
                                            </>
                                        ) : (
                                            <span className="text-slate-500 text-[10px]">尚未開盤</span>
                                        )}
                                    </div>
                                    {prevPrice > 0 && (
                                        <div className={`text-[9px] font-mono font-black ${isRise ? 'text-emerald-400' : isFall ? 'text-rose-400' : 'text-slate-500'}`}>
                                            {isRise ? '↑' : isFall ? '↓' : ''}{changePercent.toFixed(1)}%
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-slate-400 font-bold text-sm text-center">
                                {holdingQty}
                            </div>
                        <div className="flex flex-col items-end gap-1">
                            <Input
                                type="number"
                                placeholder="0"
                                className="h-9 text-xs text-center bg-slate-950/50 border-slate-700/50 focus:border-emerald-500/50 rounded-lg pr-1"
                                value={stockInputs[symbol]?.qty || ''}
                                onChange={(e) =>
                                    setStockInputs({
                                        ...stockInputs,
                                        [symbol]: { ...stockInputs[symbol], qty: e.target.value, price: currentPrice.toString() },
                                    })
                                }
                            />
                            {Number(stockInputs[symbol]?.qty || 0) > 0 && (
                                <div className="text-[9px] text-rose-400 font-bold whitespace-nowrap">
                                    預計花費: {(Number(stockInputs[symbol].qty) * currentPrice).toLocaleString()} H
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
    );
};

import React from 'react';
import { Input } from '../ui/ui';
import { Asset, StockTransactionItem } from '../../types';
import { STOCK_SYMBOLS, STOCK_NAMES } from '../../constants';

interface StockBuyFormProps {
    stockInputs: Record<string, { price: string; qty: string }>;
    setStockInputs: (val: Record<string, { price: string; qty: string }>) => void;
    marketPrices?: Record<string, number>;
    stockAssets: Asset[];
}

export const StockBuyForm: React.FC<StockBuyFormProps> = ({ stockInputs, setStockInputs, marketPrices, stockAssets }) => {
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2 px-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <span>代號</span>
                <span className="text-center">目前股價</span>
                <span className="text-center">持有張數</span>
                <span className="text-center">購買張數</span>
            </div>
            {STOCK_SYMBOLS.map((symbol) => {
                const currentPrice = marketPrices?.[symbol] || 0;
                const holdingAsset = stockAssets.find(a => a.name === `股票 (${symbol})`);
                const holdingQty = holdingAsset?.quantity || 0;
                
                return (
                    <div key={symbol} className="grid grid-cols-4 gap-2 items-center bg-slate-900/40 p-2 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                        <div className="flex flex-col pl-1">
                            <span className="text-sm font-black text-slate-200">{symbol}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{STOCK_NAMES[symbol]}</span>
                        </div>
                        <div className="text-emerald-400 font-mono text-sm text-center font-bold">
                            {currentPrice > 0 ? (
                                <>
                                    {currentPrice.toLocaleString()}<span className="text-[10px] ml-0.5 opacity-70">H</span>
                                </>
                            ) : (
                                <span className="text-slate-500 text-[10px]">尚未開盤</span>
                            )}
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
    );
};

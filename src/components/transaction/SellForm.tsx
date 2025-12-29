import React from 'react';
import { Asset, StockTransactionItem } from '../../types';
import { Input } from '../ui/ui';
import { STOCK_NAMES } from '../../constants';

interface SellFormProps {
    sellCat: string;
    assets: Asset[];
    sellStockDetails: Record<string, { price: string; qty: string }>;
    setSellStockDetails: (val: any) => void;
    withdrawAmount: string;
    setWithdrawAmount: (val: string) => void;
    repayInputs: Record<string, string>;
    setRepayInputs: (val: any) => void;
    cdTotal: number;
    marketPrices?: Record<string, number>;
}

const formatMoney = (amount: number) => `${amount.toLocaleString()} H`;

export const SellForm: React.FC<SellFormProps> = ({
    sellCat, assets, sellStockDetails, setSellStockDetails,
    withdrawAmount, setWithdrawAmount, repayInputs, setRepayInputs, cdTotal,
    marketPrices
}) => {
    const filteredAssets = assets.filter(a => a.type === sellCat);

    if (sellCat === '股票') {
        return (
            <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 px-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>代號</span>
                    <span className="text-center">目前股價</span>
                    <span className="text-center">持有張數</span>
                    <span className="text-center">賣出張數</span>
                </div>
                {filteredAssets.length > 0 ? filteredAssets.map(asset => {
                    const symbol = asset.name.replace('股票 ', '');
                    const currentPrice = marketPrices?.[symbol] || 0;
                    
                    return (
                        <div key={asset.id} className="grid grid-cols-4 gap-2 items-center bg-slate-900/40 p-2 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-colors">
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
                                {asset.quantity}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Input
                                    type="number"
                                    placeholder="0"
                                    className="h-9 text-xs text-center bg-slate-950/50 border-slate-700/50 focus:border-rose-500/50 rounded-lg pr-1"
                                    value={sellStockDetails[asset.id]?.qty || ''}
                                    onChange={e => setSellStockDetails({ 
                                        ...sellStockDetails, 
                                        [asset.id]: { ...sellStockDetails[asset.id], qty: e.target.value, price: currentPrice.toString() } 
                                    })}
                                />
                                {Number(sellStockDetails[asset.id]?.qty || 0) > 0 && (
                                    <div className="text-[9px] text-emerald-400 font-bold whitespace-nowrap">
                                        預計領取: {(Number(sellStockDetails[asset.id].qty) * currentPrice).toLocaleString()} H
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }) : <p className="text-center text-slate-500 py-6 italic text-sm">手頭目前無持有股票</p>}
            </div>
        );
    }

    if (sellCat === '定存') {
        return (
            <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400 mb-2"><span>目前定存總額</span><span>{formatMoney(cdTotal)}</span></div>
                <label className="text-xs text-slate-400 block mb-1">解約金額</label>
                <div className="flex items-center gap-2">
                    <Input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="flex-1" />
                    <span className="text-sm font-bold text-slate-300">萬元</span>
                </div>
                {Number(withdrawAmount) > 0 && <div className="text-[10px] text-emerald-400 font-bold mt-1">預計領取: {(Number(withdrawAmount) * 10000).toLocaleString()} H</div>}
            </div>
        );
    }

    return (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {filteredAssets.length > 0 ? filteredAssets.map(asset => (
                <div key={asset.id} className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-700">
                    <div className="flex flex-col"><span className="text-sm font-bold text-white">{asset.name}</span><span className="text-[10px] text-slate-500">原值: {formatMoney(asset.cost)}</span></div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="w-32"><Input type="number" placeholder="售價" className="h-9 text-xs" value={repayInputs[asset.id] || ''} onChange={e => setRepayInputs({ [asset.id]: e.target.value })} /></div>
                        {Number(repayInputs[asset.id]) > 0 && <div className="text-[10px] text-emerald-400 font-bold">預計領取: {Number(repayInputs[asset.id]).toLocaleString()} H</div>}
                    </div>
                </div>
            )) : <p className="text-center text-slate-500 py-4 italic text-sm">尚無持有此類資產</p>}
        </div>
    );
};

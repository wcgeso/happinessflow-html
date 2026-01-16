import React from 'react';
import { Asset } from '../../types';
import { Input, Button } from '../ui/ui';
import { STOCK_NAMES } from '../../constants';
import { TrendingUp } from 'lucide-react';

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
    liabilities?: any[];
    marketPrices?: Record<string, number>;
    previousMarketPrices?: Record<string, number>;
    onShowMarket?: () => void;
}

const formatMoney = (amount: number) => `${amount.toLocaleString()} H`;

export const SellForm: React.FC<SellFormProps> = ({
    sellCat, assets, sellStockDetails, setSellStockDetails,
    withdrawAmount, setWithdrawAmount, repayInputs, setRepayInputs, cdTotal,
    liabilities = [],
    marketPrices, previousMarketPrices, onShowMarket
}) => {
    const filteredAssets = assets.filter(a => a.type === sellCat);

    if (sellCat === '股票') {
        return (
            <div className="space-y-4">
                {onShowMarket && (
                    <div className="flex justify-end">
                        <Button 
                            onClick={onShowMarket}
                            className="h-8 py-0 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg shadow-lg shadow-emerald-900/40 transition-all active:scale-95 flex items-center gap-1.5"
                        >
                            <TrendingUp size={14} />
                            查看行情
                        </Button>
                    </div>
                )}
                <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 px-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        <span>代號</span>
                        <span className="text-center">目前股價</span>
                        <span className="text-center">持有張數</span>
                        <span className="text-center">賣出張數</span>
                    </div>
                    {filteredAssets.length > 0 ? filteredAssets.map(asset => {
                        const symbol = asset.name.replace('股票 ', '').replace('(', '').replace(')', '').trim();
                        const currentPrice = marketPrices?.[symbol] || 0;
                        const prevPrice = previousMarketPrices?.[symbol] || 0;
                        const isRise = currentPrice > prevPrice;
                        const isFall = currentPrice < prevPrice;

                        let changePercent = 0;
                        if (prevPrice > 0) {
                            changePercent = ((currentPrice - prevPrice) / prevPrice) * 100;
                        }
                        
                        return (
                            <div key={asset.id} className="grid grid-cols-4 gap-2 items-center bg-slate-900/40 p-2 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-colors">
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
            {filteredAssets.length > 0 ? filteredAssets.map(asset => {
                // 查找該資產對應的貸款
                const assetSymbol = asset.name.match(/[A-Z]\d+/)?.[0];
                const relatedLoan = liabilities.find(l => 
                    (asset.type === '不動產' && l.type === '不動產貸款' && assetSymbol && l.name.includes(assetSymbol)) ||
                    (asset.type === '企業' && l.type === '企業貸款' && assetSymbol && l.name.includes(assetSymbol)) ||
                    (asset.type === '飛行器' && l.type === '飛行器貸款')
                );

                return (
                    <div key={asset.id} className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-700">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{asset.name}</span>
                                {asset.type === '不動產' && (
                                     <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shadow-sm ${
                                         asset.isSelfUse 
                                             ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20' 
                                             : 'bg-blue-500/20 text-blue-500 border border-blue-500/20'
                                     }`}>
                                         {asset.isSelfUse ? '自用' : '出租'}
                                     </span>
                                 )}
                            </div>
                            <div className="flex flex-col gap-0.5 mt-1">
                                <span className="text-[10px] text-slate-400">價值: {formatMoney(asset.cost)}</span>
                                {asset.type === '企業' && asset.cashflow !== undefined && (
                                    <span className="text-[10px] text-emerald-400 font-bold">
                                        企業收益: +{formatMoney(asset.cashflow)} / 月
                                    </span>
                                )}
                                {relatedLoan && (
                                    <span className="text-[10px] text-rose-400 font-medium">
                                        貸款金額: {formatMoney(relatedLoan.totalOwed)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="w-32"><Input type="number" placeholder="售價" className="h-9 text-xs" value={repayInputs[asset.id] || ''} onChange={e => setRepayInputs({ ...repayInputs, [asset.id]: e.target.value })} /></div>
                            {Number(repayInputs[asset.id]) > 0 && <div className="text-[10px] text-emerald-400 font-bold">預計領取: {Number(repayInputs[asset.id]).toLocaleString()} H</div>}
                        </div>
                    </div>
                );
            }) : <p className="text-center text-slate-500 py-4 italic text-sm">尚無持有此類資產</p>}
        </div>
    );
};

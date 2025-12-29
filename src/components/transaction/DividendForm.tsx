import React from 'react';
import { Asset } from '../../types';
import { Input } from '../ui/ui';
import { STOCK_NAMES } from '../../constants';

interface DividendFormProps {
    divMode: 'cash' | 'stock';
    setDivMode: (v: 'cash' | 'stock') => void;
    stockAssets: Asset[];
    divInputs: Record<string, string>;
    setDivInputs: (v: any) => void;
}

export const DividendForm: React.FC<DividendFormProps> = ({ divMode, setDivMode, stockAssets, divInputs, setDivInputs }) => {
    if (stockAssets.length > 0) {
        return (
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4 animate-in slide-in-from-bottom-2">
                <div className="flex bg-slate-900 p-1 rounded-lg">
                    <button onClick={() => { setDivMode('cash'); setDivInputs({}); }} className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${divMode === 'cash' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>領取現金股利</button>
                    <button onClick={() => { setDivMode('stock'); setDivInputs({}); }} className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${divMode === 'stock' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>領取配股股利</button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {stockAssets.map(asset => {
                        const symbol = asset.name.replace('股票 ', '');
                        const inputVal = Number(divInputs[asset.id] || 0);
                        
                        // 計算邏輯：
                        // 現金股利 = 持有張數 * 100 * 每股發放金額
                        // 配股股利 = 持有張數 * (輸入百分比 / 100)，不足一張以一張計 (Math.ceil)
                        const calculated = divMode === 'cash' 
                            ? Math.floor((asset.quantity || 0) * 100 * inputVal)
                            : Math.ceil((asset.quantity || 0) * (inputVal / 100));

                        return (
                            <div key={asset.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700 hover:bg-slate-900">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white">{symbol}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">{STOCK_NAMES[symbol]}</span>
                                    <span className="text-[10px] text-slate-500">
                                        持有: {asset.quantity} 張
                                    </span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                                        {divMode === 'cash' ? '每股發放金額 (H)' : '配股比例 (%)'}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <div className="w-20">
                                            <Input
                                                type="number"
                                                step="any"
                                                placeholder="0"
                                                className="h-8 text-xs text-right"
                                                value={divInputs[asset.id] || ''}
                                                onChange={e => setDivInputs({ ...divInputs, [asset.id]: e.target.value })}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400">{divMode === 'cash' ? 'H' : '%'}</span>
                                    </div>
                                    {inputVal > 0 && (
                                        <div className="text-[10px] text-emerald-400 font-bold">
                                            預計領取: {divMode === 'cash' ? `${calculated.toLocaleString()} H` : `${calculated} 張`}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return <p className="text-center text-slate-500 py-6 italic text-sm">手頭目前無持有股票</p>;
};

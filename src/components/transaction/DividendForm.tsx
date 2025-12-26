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
    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4 animate-in slide-in-from-bottom-2">
            <div className="flex bg-slate-900 p-1 rounded-lg">
                <button onClick={() => { setDivMode('cash'); setDivInputs({}); }} className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${divMode === 'cash' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>領取現金股利</button>
                <button onClick={() => { setDivMode('stock'); setDivInputs({}); }} className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${divMode === 'stock' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>領取配股股利</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {stockAssets.length > 0 ? stockAssets.map(asset => {
                    const symbol = asset.name.replace('股票 ', '');
                    const inputVal = Number(divInputs[asset.id] || 0);
                    // Update calculation: cash dividend = per share amount * 100 * quantity
                    const calculated = divMode === 'cash' ? inputVal * 100 * (asset.quantity || 0) : Math.floor((asset.quantity || 0) * inputVal);

                    return (
                        <div key={asset.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700 hover:bg-slate-900">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-white">{symbol}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{STOCK_NAMES[symbol]}</span>
                                <span className="text-[10px] text-slate-500">持有: {asset.quantity} 張</span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                                    {divMode === 'cash' ? '每股發放金額 (1張=100股)' : '每股發放配息率 (1張=100股)'}
                                </label>
                                <div className="w-28">
                                    <Input
                                        type="number"
                                        step="any"
                                        placeholder={divMode === 'cash' ? "輸入金額" : "例如 0.1"}
                                        className="h-8 text-xs text-right"
                                        value={divInputs[asset.id] || ''}
                                        onChange={e => setDivInputs({ ...divInputs, [asset.id]: e.target.value })}
                                    />
                                </div>
                                {inputVal > 0 && (
                                    <div className="text-[10px] text-emerald-400 font-bold">
                                        預計領取: {divMode === 'cash' ? `${calculated.toLocaleString()} H` : `${calculated} 張`}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }) : <p className="text-center text-slate-500 py-6 italic text-sm">手頭目前無持有股票</p>}
            </div>
        </div>
    );
};

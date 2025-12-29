import React, { useEffect } from 'react';
import { Input } from '../ui/ui';
import { REAL_ESTATE_SYMBOLS, BUSINESS_SYMBOLS, REAL_ESTATE_TYPES } from '../../constants';
import { AssetType } from '../../types';

interface AssetBuyFormsProps {
    assetType: AssetType;
    reSymbol: string; setReSymbol: (v: string) => void;
    reSelfUse: boolean; setReSelfUse: (v: boolean) => void;
    reDownPayment: string; setReDownPayment: (v: string) => void;
    reLoan: string; setReLoan: (v: string) => void;
    reInterest: string; setReInterest: (v: string) => void;
    reIncome: string; setReIncome: (v: string) => void;
    reHouseType: string; setReHouseType: (v: string) => void;
    bizSymbol: string; setBizSymbol: (v: string) => void;
    bizCost: string; setBizCost: (v: string) => void;
    bizLoan: string; setBizLoan: (v: string) => void;
    bizInterest: string; setBizInterest: (v: string) => void;
    bizIncome: string; setBizIncome: (v: string) => void;
    cdAmount: string; setCdAmount: (v: string) => void;
    aircraftCash: string; setAircraftCash: (v: string) => void;
    aircraftLoan: string; setAircraftLoan: (v: string) => void;
}

export const AssetBuyForms: React.FC<AssetBuyFormsProps> = ({
    assetType, reSymbol, setReSymbol, reSelfUse, setReSelfUse, reDownPayment, setReDownPayment,
    reLoan, setReLoan, reInterest, setReInterest, reIncome, setReIncome, reHouseType, setReHouseType,
    bizSymbol, setBizSymbol, bizCost, setBizCost, bizLoan, setBizLoan, bizInterest, setBizInterest, bizIncome, setBizIncome,
    cdAmount, setCdAmount, aircraftCash, setAircraftCash, aircraftLoan, setAircraftLoan
}) => {
    useEffect(() => {
        if (assetType === '不動產') {
            // 自動計算本利和
            const loanNum = Number(reLoan) || 0;
            const calculatedInterest = Math.floor(loanNum * 0.005);
            const interestStr = loanNum > 0 ? calculatedInterest.toString() : '';
            if (interestStr !== reInterest) {
                setReInterest(interestStr);
            }

            // 自動顯示房屋類型
            if (reSymbol && REAL_ESTATE_TYPES[reSymbol]) {
                const autoType = REAL_ESTATE_TYPES[reSymbol].type;
                if (autoType !== reHouseType) {
                    setReHouseType(autoType);
                }

                // 如果是店面類型，強制取消自用選項
                if (autoType === 'store' && reSelfUse) {
                    setReSelfUse(false);
                }
            }
        }

        if (assetType === '企業') {
            // 自動計算企業貸款利息 (0.5%)
            const loanNum = Number(bizLoan) || 0;
            const calculatedInterest = Math.floor(loanNum * 0.005);
            const interestStr = loanNum > 0 ? calculatedInterest.toString() : '';
            if (interestStr !== bizInterest) {
                setBizInterest(interestStr);
            }
        }
    }, [reLoan, assetType, setReInterest, reInterest, reSymbol, reHouseType, setReHouseType, reSelfUse, setReSelfUse, bizLoan, bizInterest, setBizInterest]);

    if (assetType === '不動產') {
        const currentTypeLabel = reSymbol && REAL_ESTATE_TYPES[reSymbol] 
            ? REAL_ESTATE_TYPES[reSymbol].label 
            : '未選擇';

        const isStore = reHouseType === 'store';

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">不動產項目</label>
                        <select 
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" 
                            value={reSymbol} 
                            onChange={e => setReSymbol(e.target.value)}
                        >
                            {REAL_ESTATE_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">房屋類型</label>
                        <div className="w-full bg-slate-800/50 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-300 font-medium">
                            {currentTypeLabel}
                        </div>
                    </div>
                </div>

                {isStore ? (
                    <div className="bg-amber-900/20 p-2 rounded-lg border border-amber-800/30">
                        <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            店面類型僅供出租使用
                        </span>
                    </div>
                ) : (
                    <div className="flex gap-4 items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={reSelfUse} 
                                onChange={e => setReSelfUse(e.target.checked)} 
                                className="w-4 h-4 accent-emerald-500" 
                            />
                            <span className="text-sm font-bold text-slate-200">設定為自用 (可增加幸福點數)</span>
                        </label>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">首付</label>
                        <Input type="number" value={reDownPayment} onChange={e => setReDownPayment(e.target.value)} />
                         {Number(reDownPayment) > 0 && <div className="text-[10px] text-rose-400 font-bold mt-1">預計花費: {Number(reDownPayment).toLocaleString()} H</div>}
                     </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">房貸金額</label>
                        <Input type="number" value={reLoan} onChange={e => setReLoan(e.target.value)} />
                        {Number(reLoan) > 0 && <div className="text-[10px] text-rose-400 font-bold mt-1">預計增加負債: {Number(reLoan).toLocaleString()} H</div>}
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">每月本利和 (自動計算 0.5%)</label>
                        <Input 
                            type="number" 
                            value={reInterest} 
                            readOnly 
                            className="bg-slate-800/50 text-slate-400 cursor-not-allowed"
                            onChange={e => setReInterest(e.target.value)} 
                        />
                        {Number(reInterest) > 0 && <div className="text-[10px] text-rose-400 font-bold mt-1">預計每月支出: {Number(reInterest).toLocaleString()} H</div>}
                    </div>
                    {!reSelfUse && (
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">租金收入</label>
                            <Input type="number" value={reIncome} onChange={e => setReIncome(e.target.value)} />
                            {Number(reIncome) > 0 && <div className="text-[10px] text-emerald-400 font-bold mt-1">預計每月收入: {Number(reIncome).toLocaleString()} H</div>}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (assetType === '企業') {
        const isPartTime = bizSymbol === 'N056' || bizSymbol === 'N058';
        const bizTypeLabel = isPartTime ? '兼職工作室' : '優質企業';

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">企業項目</label>
                        <select 
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white" 
                            value={bizSymbol} 
                            onChange={e => setBizSymbol(e.target.value)}
                        >
                            {BUSINESS_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">企業類型</label>
                        <div className={`w-full border rounded px-3 py-2 text-sm font-bold transition-colors ${
                            isPartTime 
                                ? 'bg-amber-900/20 border-amber-800/50 text-amber-400' 
                                : 'bg-emerald-900/20 border-emerald-800/50 text-emerald-400'
                        }`}>
                            {bizTypeLabel}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div>
                         <label className="text-xs text-slate-400 block mb-1">投資金額</label>
                         <Input type="number" value={bizCost} onChange={e => setBizCost(e.target.value)} />
                         {Number(bizCost) > 0 && <div className="text-[10px] text-rose-400 font-bold mt-1">預計花費: {Number(bizCost).toLocaleString()} H</div>}
                     </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">企業貸款</label>
                            <Input type="number" value={bizLoan} onChange={e => setBizLoan(e.target.value)} />
                            {Number(bizLoan) > 0 && (
                                <div className="space-y-1 mt-1">
                                    <div className="text-[10px] text-rose-400 font-bold">預計增加負債: {Number(bizLoan).toLocaleString()} H</div>
                                    <div className="text-[10px] text-emerald-400 font-bold">預計增加現金: {Number(bizLoan).toLocaleString()} H</div>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">每月貸款利息 (0.5%)</label>
                            <Input 
                                type="number" 
                                value={bizInterest} 
                                readOnly 
                                className="bg-slate-800/50 text-slate-400 cursor-not-allowed"
                                onChange={e => setBizInterest(e.target.value)} 
                            />
                            {Number(bizInterest) > 0 && <div className="text-[10px] text-rose-400 font-bold mt-1">預計每月支出: {Number(bizInterest).toLocaleString()} H</div>}
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-slate-400 block mb-1">每月收益</label>
                            <Input type="number" value={bizIncome} onChange={e => setBizIncome(e.target.value)} />
                            {Number(bizIncome) > 0 && <div className="text-[10px] text-emerald-400 font-bold mt-1">預計每月收入: {Number(bizIncome).toLocaleString()} H</div>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (assetType === '定存') {
        return (
            <div className="space-y-2">
                <label className="text-xs text-slate-400 block mb-1">存入金額</label>
                <div className="flex items-center gap-2">
                    <Input 
                        type="number" 
                        placeholder="請輸入金額" 
                        value={cdAmount} 
                        onChange={e => setCdAmount(e.target.value)} 
                        className="flex-1"
                    />
                    <span className="text-sm font-bold text-slate-300 whitespace-nowrap">萬元</span>
                </div>
                {Number(cdAmount) > 0 && (
                    <div className="text-[10px] text-emerald-400 font-bold mt-1">
                        預計存入: {(Number(cdAmount) * 10000).toLocaleString()} H
                    </div>
                )}
            </div>
        );
    }

    if (assetType === '飛行器') {
        return (
            <div className="space-y-4">
                <div className="bg-emerald-900/20 p-3 rounded-lg border border-emerald-800/30 flex justify-between items-center">
                    <span className="text-xs text-emerald-300">飛行器總金額</span>
                    <span className="text-sm font-bold text-emerald-300">500,000 H</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">支付現金</label>
                        <Input type="number" value={aircraftCash} onChange={e => setAircraftCash(e.target.value)} />
                        {Number(aircraftCash) > 0 && <div className="text-[10px] text-rose-400 font-bold mt-1">預計花費: {Number(aircraftCash).toLocaleString()} H</div>}
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">貸款額度</label>
                        <Input type="number" value={aircraftLoan} onChange={e => setAircraftLoan(e.target.value)} />
                        {Number(aircraftLoan) > 0 && <div className="text-[10px] text-rose-400 font-bold mt-1">預計增加負債: {Number(aircraftLoan).toLocaleString()} H</div>}
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

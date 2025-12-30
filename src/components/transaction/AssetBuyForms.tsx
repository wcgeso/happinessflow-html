import React, { useEffect } from 'react';
import { Input } from '../ui/ui';
import { REAL_ESTATE_SYMBOLS, BUSINESS_SYMBOLS, REAL_ESTATE_TYPES, REAL_ESTATE_PRESETS, BUSINESS_PRESETS } from '../../constants';
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

const DisplayField = ({ label, value, colorClass = "text-white" }: { label: string, value: string | number, colorClass?: string }) => (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-2.5 flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
        <span className={`text-sm font-mono font-bold ${colorClass}`}>
            {typeof value === 'number' ? `${value.toLocaleString()} H` : value}
        </span>
    </div>
);

export const AssetBuyForms: React.FC<AssetBuyFormsProps> = ({
    assetType, reSymbol, setReSymbol, reSelfUse, setReSelfUse, reDownPayment, setReDownPayment,
    reLoan, setReLoan, reInterest, setReInterest, reIncome, setReIncome, reHouseType, setReHouseType,
    bizSymbol, setBizSymbol, bizCost, setBizCost, bizLoan, setBizLoan, bizInterest, setBizInterest, bizIncome, setBizIncome,
    cdAmount, setCdAmount, aircraftCash, setAircraftCash, aircraftLoan, setAircraftLoan
}) => {
    // 當不動產代號改變時，自動填入預設資料
    useEffect(() => {
        if (assetType === '不動產' && reSymbol && REAL_ESTATE_PRESETS[reSymbol]) {
            const preset = REAL_ESTATE_PRESETS[reSymbol];
            setReDownPayment(preset.downPayment.toString());
            setReLoan(preset.loanAmount.toString());
            setReInterest(preset.loanInterest.toString());
            // 租金收入 = 預設收益 + 房貸利息 (因為 UI 上租金收入是總收入，收益是扣除利息後的淨額)
            setReIncome((preset.cashflow + preset.loanInterest).toString());
        }
    }, [reSymbol, assetType, setReDownPayment, setReLoan, setReInterest, setReIncome]);

    // 當企業代號改變時，自動填入預設資料
    useEffect(() => {
        if (assetType === '企業' && bizSymbol && BUSINESS_PRESETS[bizSymbol]) {
            // N055, N057, N059, N060 現在改為手動輸入，不自動填入預設資料
            if (['N055', 'N057', 'N059', 'N060'].includes(bizSymbol)) {
                setBizCost('');
                setBizLoan('');
                setBizInterest('');
                setBizIncome('');
                return;
            }
            const preset = BUSINESS_PRESETS[bizSymbol];
            // 投資金額在 UI 上顯示的是首付 (總成本 - 貸款)
            setBizCost((preset.cost - preset.loanAmount).toString());
            setBizLoan(preset.loanAmount.toString());
            setBizInterest(preset.loanInterest.toString());
            setBizIncome(preset.income.toString());
        }
    }, [bizSymbol, assetType, setBizCost, setBizLoan, setBizInterest, setBizIncome]);

    useEffect(() => {
        if (assetType === '不動產') {
            // 自動計算本利和 (如果沒有預設資料時的備用邏輯)
            if (!REAL_ESTATE_PRESETS[reSymbol]) {
                const loanNum = Number(reLoan) || 0;
                const calculatedInterest = Math.floor(loanNum * 0.005);
                const interestStr = loanNum > 0 ? calculatedInterest.toString() : '';
                if (interestStr !== reInterest) {
                    setReInterest(interestStr);
                }
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
            // 自動計算企業貸款利息 (0.5%) (如果沒有預設資料時的備用邏輯，或是 N055/N057/N059/N060 手動輸入時)
            const isManualOrSpecific = !BUSINESS_PRESETS[bizSymbol] || ['N055', 'N057', 'N059', 'N060'].includes(bizSymbol);
            if (isManualOrSpecific) {
                const loanNum = Number(bizLoan) || 0;
                const calculatedInterest = Math.floor(loanNum * 0.005);
                const interestStr = loanNum > 0 ? calculatedInterest.toString() : '';
                if (interestStr !== bizInterest) {
                    setBizInterest(interestStr);
                }
            }
        }
    }, [reLoan, assetType, setReInterest, reInterest, reSymbol, reHouseType, setReHouseType, reSelfUse, setReSelfUse, bizLoan, bizInterest, setBizInterest]);

    if (assetType === '不動產') {
        const currentTypeLabel = reSymbol && REAL_ESTATE_TYPES[reSymbol] 
            ? REAL_ESTATE_TYPES[reSymbol].label 
            : '未選擇';

        const isStore = reHouseType === 'store';
        const happyPoints = REAL_ESTATE_PRESETS[reSymbol]?.happyPoints;

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
                            <span className="text-sm font-bold text-slate-200">設定為自用</span>
                        </label>
                        {happyPoints && (
                            <div className="ml-auto pr-2">
                                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    可獲得 {happyPoints} 點幸福點數
                                </span>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                    <DisplayField label="首付" value={Number(reDownPayment)} colorClass="text-rose-400" />
                    <DisplayField label="房貸金額" value={Number(reLoan)} colorClass="text-rose-400" />
                    {!reSelfUse && (
                        <DisplayField label="租金收入" value={Number(reIncome)} colorClass="text-emerald-400" />
                    )}
                    <DisplayField label="每月本利和 (0.5%)" value={Number(reInterest)} colorClass="text-rose-400" />
                </div>
            </div>
        );
    }

    if (assetType === '企業') {
        const isPartTime = bizSymbol === 'N056' || bizSymbol === 'N058';
        const isManual = ['N055', 'N057', 'N059', 'N060'].includes(bizSymbol);
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
                                : (isManual ? 'bg-blue-900/20 border-blue-800/50 text-blue-400' : 'bg-emerald-900/20 border-emerald-800/50 text-emerald-400')
                        }`}>
                            {bizTypeLabel}
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                        {isManual ? (
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">投資金額</label>
                                <Input type="number" value={bizCost} onChange={e => setBizCost(e.target.value)} placeholder="請輸入投資金額" />
                            </div>
                        ) : (
                            <DisplayField label="投資金額" value={Number(bizCost)} colorClass="text-rose-400" />
                        )}
                    </div>
                    {isManual ? (
                        <>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">企業貸款</label>
                                <Input type="number" value={bizLoan} onChange={e => setBizLoan(e.target.value)} placeholder="請輸入貸款額度" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">企業貸款利息</label>
                                <Input type="number" value={bizInterest} readOnly className="bg-slate-800/50" placeholder="自動計算" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-slate-400 block mb-1">企業收益</label>
                                <Input type="number" value={bizIncome} onChange={e => setBizIncome(e.target.value)} placeholder="請輸入每月收益" />
                            </div>
                        </>
                    ) : (
                        <>
                             <DisplayField label="企業貸款" value={Number(bizLoan)} colorClass="text-rose-400" />
                             <DisplayField label="企業貸款利息" value={Number(bizInterest)} colorClass="text-rose-400" />
                             <div className="col-span-2">
                                 <DisplayField label="企業收益" value={Number(bizIncome)} colorClass="text-emerald-400" />
                             </div>
                         </>
                    )}
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

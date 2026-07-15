
import React from 'react';
import { Transaction } from '../../types';
import { cn } from '../../utils/gameUtils';

interface CashFlowLogProps {
    history: Transaction[];
}

const formatMoney = (amount: number) => amount.toLocaleString();

export const CashFlowLog: React.FC<CashFlowLogProps> = ({ history }) => {
    // 計算累積現金流
    const cashFlowData = history
        .filter(tx => tx.cashChange !== 0) // 不會造成現金流動的交易不用記錄
        .reduce((acc, tx, index) => {
            const previousBalance = index > 0 ? acc[index - 1].balance : 0;
            const newBalance = tx.balance; // Use the balance stored in tx directly

            acc.push({
                round: tx.round,
                name: tx.name,
                cashChange: tx.cashChange,
                balance: newBalance,
                timestamp: tx.timestamp,
                flowType: tx.flowType
            });

            return acc;
        }, [] as { round: number; name: string; cashChange: number; balance: number; timestamp: number; flowType?: string }[]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-white">現金流量記錄</h3>
                        <p className="text-xs text-slate-400 mt-1">追蹤每筆交易的現金變化</p>
                    </div>
                    <div className="flex gap-2">
                        <span className="rounded border border-[#9fc8d5] bg-[#d8e9e5] px-1.5 py-0.5 text-[10px] text-[#36798a]">生活</span>
                        <span className="rounded border border-[#b9d9d0] bg-[#e0f0e5] px-1.5 py-0.5 text-[10px] text-[#168269]">投資</span>
                        <span className="rounded border border-[#d8c29a] bg-[#f4e6d0] px-1.5 py-0.5 text-[10px] text-[#a9643a]">融資</span>
                    </div>
                </div>

                <div className="overflow-hidden">
                    <table className="w-full text-xs table-fixed">
                        <thead className="bg-slate-900/50 border-b border-slate-700">
                            <tr>
                                <th className="px-2 py-3 text-left font-bold text-slate-400">分類 / 詳情</th>
                                <th className="px-2 py-3 text-right font-bold text-slate-400 w-32">現金餘額</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {cashFlowData.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                                        尚無交易記錄
                                    </td>
                                </tr>
                            ) : (
                                cashFlowData.slice().reverse().map((item, index) => (
                                    <tr key={index} className="transition-colors hover:bg-[#f3e4cc]">
                                        <td className="px-2 py-3">
                                            <div className="text-slate-200 font-bold text-xs leading-relaxed mb-1" title={item.name}>{item.name}</div>
                                            <div className={`text-[10px] font-bold whitespace-nowrap ${item.cashChange > 0 ? 'text-emerald-400' : item.cashChange < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                                {item.cashChange > 0 ? '+' : ''}{formatMoney(item.cashChange)}
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 text-right align-top">
                                            <div className="flex flex-col items-end gap-1.5">
                                                <div className="font-mono font-bold text-white whitespace-nowrap">
                                                    {formatMoney(item.balance)}
                                                </div>
                                                {item.flowType && (
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 text-[9px] rounded font-bold leading-none",
                                                        item.flowType === '生活' ? "border border-[#9fc8d5] bg-[#d8e9e5] text-[#36798a]" :
                                                            item.flowType === '投資' ? "border border-[#b9d9d0] bg-[#e0f0e5] text-[#168269]" :
                                                                item.flowType === '融資' ? "border border-[#d8c29a] bg-[#f4e6d0] text-[#a9643a]" :
                                                                    "bg-[#ead7b8] text-[#7a6958]"
                                                    )}>
                                                        {item.flowType}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

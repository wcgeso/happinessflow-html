
import React from 'react';
import { Transaction } from '../../types';

interface CashFlowLogProps {
    history: Transaction[];
}

const formatMoney = (amount: number) => `${amount.toLocaleString()} H`;

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
                timestamp: tx.timestamp
            });

            return acc;
        }, [] as { round: number; name: string; cashChange: number; balance: number; timestamp: number }[]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                <div className="p-4 bg-slate-900/50 border-b border-slate-700">
                    <h3 className="font-bold text-white">現金流量記錄</h3>
                    <p className="text-xs text-slate-400 mt-1">追蹤每筆交易的現金變化</p>
                </div>

                <div className="overflow-hidden">
                    <table className="w-full text-xs table-fixed">
                        <thead className="bg-slate-900/50 border-b border-slate-700">
                            <tr>
                                <th className="px-2 py-3 text-left font-bold text-slate-400 w-10">回合</th>
                                <th className="px-2 py-3 text-left font-bold text-slate-400">交易詳情</th>
                                <th className="px-2 py-3 text-right font-bold text-slate-400 w-24">現金餘額</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {cashFlowData.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                                        尚無交易記錄
                                    </td>
                                </tr>
                            ) : (
                                cashFlowData.slice().reverse().map((item, index) => (
                                    <tr key={index} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-2 py-3 text-slate-300 font-mono">R{item.round}</td>
                                        <td className="px-2 py-3">
                                            <div className="text-slate-200 font-medium break-words" title={item.name}>{item.name}</div>
                                            <div className={`text-[10px] font-bold break-words ${item.cashChange > 0 ? 'text-emerald-400' : item.cashChange < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                                {item.cashChange > 0 ? '+' : ''}{formatMoney(item.cashChange)}
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 text-right font-mono font-bold text-white">
                                            {formatMoney(item.balance)}
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

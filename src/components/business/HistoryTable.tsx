
import React, { useState } from 'react';
import { Transaction } from '../../types';
import { Trash2 } from 'lucide-react';
import { ConfirmModal } from '../modals/ConfirmModal';

interface HistoryTableProps {
    history: Transaction[];
    onDeleteTransaction?: (id: string) => void;
    reportName?: string;
    disabled?: boolean;
}

const formatMoney = (amount: number) => amount.toLocaleString();

export const HistoryTable: React.FC<HistoryTableProps> = ({ history, onDeleteTransaction, reportName, disabled = false }) => {
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const handleDeleteClick = (id: string) => {
        setConfirmId(id);
    };

    const handleConfirmDelete = () => {
        if (confirmId && onDeleteTransaction) {
            onDeleteTransaction(confirmId);
            setConfirmId(null);
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                <div className="p-4 bg-slate-900/50 border-b border-slate-700">
                    <h3 className="font-bold text-white">交易歷史記錄 {reportName && <span className="text-emerald-400 ml-2">({reportName})</span>}</h3>
                    <p className="text-xs text-slate-400 mt-1">所有交易的詳細記錄</p>
                </div>

                <div className="overflow-hidden">
                    <table className="w-full text-xs table-fixed">
                        <thead className="bg-slate-900/50 border-b border-slate-700">
                            <tr>
                                <th className="px-2 py-3 text-left font-bold text-slate-400">交易詳情</th>
                                <th className="px-2 py-3 text-right font-bold text-slate-400 w-32">現金變動</th>
                                {onDeleteTransaction && (
                                    <th className="px-1 py-3 text-center font-bold text-slate-400 w-8"></th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={onDeleteTransaction ? 3 : 2} className="px-4 py-8 text-center text-slate-500">
                                        尚無交易記錄
                                    </td>
                                </tr>
                            ) : (
                                [...history].reverse().map((tx) => {
                                    return (
                                        <tr key={tx.id} className="transition-colors hover:bg-[#f3e4cc]">
                                            <td className="px-2 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <div className="break-words text-[10px] font-bold uppercase tracking-tight text-[#36798a]">
                                                        {tx.sourceLabel} → {tx.usageLabel}
                                                    </div>
                                                    <div className="text-slate-200 font-bold text-xs leading-relaxed break-words" title={tx.name}>{tx.name}</div>
                                                </div>
                                            </td>
                                            <td className={`px-2 py-3 text-right font-mono font-bold whitespace-nowrap ${tx.cashChange > 0 ? 'text-emerald-400' : tx.cashChange < 0 ? 'text-rose-400' : 'text-slate-400'
                                                }`}>
                                                {tx.cashChange > 0 ? '+' : ''}{formatMoney(tx.cashChange)}
                                            </td>
                                            {onDeleteTransaction && !disabled && (
                                                <td className="px-1 py-3 text-center">
                                                    <button
                                                        onClick={() => handleDeleteClick(tx.id)}
                                                        className="text-rose-400 hover:text-rose-300 transition-colors"
                                                        title="刪除交易"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {confirmId && (
                <ConfirmModal
                    title="確認刪除交易記錄？"
                    description="刪除後系統將自動嘗試撤銷該筆交易對現金、資產、負債及支出的影響，財務報表也將同步更新。"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setConfirmId(null)}
                    confirmText="執行刪除"
                    cancelText="取消"
                    type="danger"
                />
            )}
        </div>
    );
};

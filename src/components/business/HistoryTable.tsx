import {collection,query,where,orderBy,limit,startAfter,getDocs,type QueryDocumentSnapshot} from 'firebase/firestore';
import {db} from '../../../services/firebase';

import React, { useState, useEffect, useRef } from 'react';
import { Transaction } from '../../types';
import { Trash2 } from 'lucide-react';
import { ConfirmModal } from '../modals/ConfirmModal';

interface HistoryTableProps {
    history: Transaction[];
    onDeleteTransaction?: (id: string) => void;
    reportName?: string;
    disabled?: boolean;
    source?: {roomId:string;uid:string;sessionId:string};
}

const formatMoney = (amount: number) => amount.toLocaleString();

export const HistoryTable: React.FC<HistoryTableProps> = ({ history, onDeleteTransaction, reportName, disabled = false,source }) => {
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const [older,setOlder]=useState<Transaction[]>([]),[loading,setLoading]=useState(false),[hasMore,setHasMore]=useState(false),[loadError,setLoadError]=useState('');
    const cursor=useRef<QueryDocumentSnapshot|null>(null),scope=useRef('');
    const key=source ? `${source.roomId}:${source.uid}:${source.sessionId}` : '';
    scope.current=key;
    const load=async(first=false)=>{
        if(!source)return;
        const requested=key;setLoading(true);setLoadError('');
        try {
            const pageSize=first?100:50;
            const page=await getDocs(query(collection(db,'rooms',source.roomId,'players',source.uid,'transactions'),
                where('sessionId','==',source.sessionId),orderBy('timestamp','desc'),...(cursor.current&&!first?[startAfter(cursor.current)]:[]),limit(pageSize)));
            if(scope.current!==requested)return;
            cursor.current=page.docs.at(-1)||cursor.current;
            setOlder(previous=>first?page.docs.map(row=>row.data() as Transaction):[...previous,...page.docs.map(row=>row.data() as Transaction)]);
            setHasMore(page.size===pageSize);
        } catch(error:any) {if(scope.current===requested)setLoadError(`歷史載入失敗：${error.code || error.message}`);}
        finally {if(scope.current===requested)setLoading(false);}
    };
    useEffect(()=>{cursor.current=null;setOlder([]);setHasMore(false);if(source)void load(true);return()=>{scope.current='';};},[key]);
    const rows=[...new Map([...older,...history].map(entry=>[entry.id,entry])).values()].sort((a,b)=>b.timestamp-a.timestamp);

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
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={onDeleteTransaction ? 3 : 2} className="px-4 py-8 text-center text-slate-500">
                                        尚無交易記錄
                                    </td>
                                </tr>
                            ) : (
                                rows.map((tx) => {
                                    return (
                                        <tr key={tx.id} className="transition-colors hover:bg-[#f3e4cc]">
                                            <td className="px-2 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <div className="break-words text-[10px] font-bold uppercase tracking-tight text-[#36798a]">
                                                        {tx.sourceLabel} → {tx.usageLabel}
                                                    </div>
                                                    <div className="text-slate-200 font-bold text-xs leading-relaxed break-words" title={tx.name}>{tx.name}</div>
                                                    {tx.incomeMultiplierEligible && tx.originalAmount !== undefined && tx.appliedMultiplier && tx.appliedMultiplier > 1 && (
                                                        <div className="text-[10px] font-bold text-amber-300">
                                                            {formatMoney(tx.originalAmount)} ×{tx.appliedMultiplier}＝{formatMoney(tx.cashChange)}
                                                        </div>
                                                    )}
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

            {source && <div className="text-center text-sm">
                {loadError && <p role="alert" className="text-rose-300">{loadError}</p>}
                {(hasMore||loadError) && <button disabled={loading} onClick={()=>void load(!cursor.current)} className="px-4 py-2 text-slate-200 disabled:opacity-50">{loading?'載入中…':loadError?'重試載入':'載入較早 50 筆'}</button>}
            </div>}
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

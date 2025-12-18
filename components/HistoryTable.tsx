
import React from 'react';
import { Transaction } from '../types';
import { Card } from './ui';
import { Trash2 } from 'lucide-react';

interface HistoryTableProps {
  history: Transaction[];
  onDeleteTransaction?: (id: string) => void;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ history, onDeleteTransaction }) => {
  const formatMoney = (amount: number) => 
    `${amount.toLocaleString()} H`;

  // 確保 history 是按時間降序排列
  const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <Card className="overflow-hidden border-slate-700 bg-slate-900 h-full flex flex-col">
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 font-bold text-white flex justify-between items-center shadow-md z-10">
        <span className="flex items-center gap-2">
            <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
            綜合交易紀錄表
        </span>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-300 relative border-collapse">
          <thead className="text-xs text-slate-400 uppercase bg-slate-800/90 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
            <tr>
              <th className="px-4 py-3 font-semibold">交易項目</th>
              <th className="px-4 py-3 text-right font-semibold">金額</th>
              <th className="px-4 py-3 text-center font-semibold">摘要</th>
              <th className="px-4 py-3 text-center font-semibold">類型</th>
              <th className="px-4 py-3 text-center font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sortedHistory.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500 italic">
                  尚未有交易紀錄。
                </td>
              </tr>
            ) : (
              sortedHistory.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="px-4 py-3 border-r border-slate-800/30">
                    <div className="font-medium text-white">{tx.name}</div>
                    <div className="text-[10px] text-slate-500 italic">{tx.details}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400 border-r border-slate-800/30">{formatMoney(tx.amount)}</td>
                  <td className="px-4 py-3 text-center border-r border-slate-800/30">
                    <span className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded text-[10px] border border-blue-800/50 inline-block min-w-[60px]">
                      {tx.sourceLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-purple-900/30 text-purple-300 px-2 py-1 rounded text-[10px] border border-purple-800/50 inline-block min-w-[60px]">
                      {tx.usageLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {onDeleteTransaction && (
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-900/40 text-rose-300 border border-rose-700/70 hover:bg-rose-700/70 hover:text-white transition-colors text-xs"
                        title="刪除這筆交易"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

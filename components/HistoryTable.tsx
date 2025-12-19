
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
      <div className="flex-1 overflow-y-auto">
        {sortedHistory.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-500 italic">
            尚未有交易紀錄。
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {sortedHistory.map((tx) => (
              <div key={tx.id} className="group hover:bg-slate-800/50 transition-colors">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{tx.name}</div>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center text-sm">
                        <span className="text-emerald-400 font-mono">{formatMoney(tx.amount)}</span>
                      </div>
                      <div className="flex items-center text-xs text-slate-400 space-x-2">
                        <span>來源: {tx.sourceLabel}</span>
                        <span className="text-slate-600">|</span>
                        <span>用途: {tx.usageLabel}</span>
                      </div>
                      {tx.details && (
                        <div className="text-xs text-slate-500 italic truncate">
                          {tx.details}
                        </div>
                      )}
                    </div>
                  </div>
                  {onDeleteTransaction && (
                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(tx.id)}
                      className="ml-2 flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-900/40 text-rose-300 border border-rose-700/70 hover:bg-rose-700/70 hover:text-white transition-colors text-xs opacity-0 group-hover:opacity-100"
                      title="刪除這筆交易"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

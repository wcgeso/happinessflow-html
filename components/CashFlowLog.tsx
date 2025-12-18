
import React from 'react';
import { Transaction } from '../types';
import { Card } from './ui';

interface CashFlowLogProps {
  history: Transaction[];
}

export const CashFlowLog: React.FC<CashFlowLogProps> = ({ history }) => {
  const formatMoney = (amount: number) => 
    `${amount.toLocaleString()} H`;

  return (
    <Card className="overflow-hidden border-slate-700 bg-slate-900 h-full flex flex-col">
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 font-bold text-white flex justify-between items-center shadow-md z-10">
        <span className="flex items-center gap-2">
            <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
            現金流量記錄
        </span>
      </div>
      <div className="overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        <table className="w-full text-sm border-collapse relative">
          <thead className="bg-slate-800/90 text-slate-400 font-semibold sticky top-0 z-10 backdrop-blur-sm shadow-sm">
            <tr>
              <th className="px-4 py-3 text-left w-[40%]">交易事項</th>
              <th className="px-4 py-3 text-right w-[30%]">現金流變動</th>
              <th className="px-4 py-3 text-right w-[30%]">結餘</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {history.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-slate-500 italic">
                  尚未有任何現金交易紀錄
                </td>
              </tr>
            ) : (
              history.map((tx, index) => (
                <tr key={tx.id} className={`transition-colors ${index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'} hover:bg-slate-800`}>
                  <td className="px-4 py-3 font-medium text-slate-200 border-r border-slate-800/50">
                      {tx.name}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-bold border-r border-slate-800/50`}>
                    <div className={`flex items-center justify-end ${tx.cashChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.cashChange > 0 ? '+' : ''}{formatMoney(tx.cashChange)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-white">
                    {formatMoney(tx.balance)}
                  </td>
                </tr>
              ))
            )}
            {history.length < 5 && history.length > 0 && Array.from({ length: 5 - history.length }).map((_, i) => (
               <tr key={`empty-${i}`}>
                 <td className="px-4 py-3 border-r border-slate-800/50">&nbsp;</td>
                 <td className="px-4 py-3 border-r border-slate-800/50">&nbsp;</td>
                 <td className="px-4 py-3">&nbsp;</td>
               </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

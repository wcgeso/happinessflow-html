import React from 'react';
import { X, Target, Star, ArrowRight } from 'lucide-react';
import { Enterprise, Dream, HappinessItem, TransactionData } from '../../types';

interface PurchaseModalProps {
  type: 'enterprise' | 'dream';
  item: Enterprise | Dream | null;
  cash: number;
  happiness: HappinessItem[];
  onTransaction: (data: TransactionData) => void;
  onClose: () => void;
}

export const TargetAndDreamModal: React.FC<PurchaseModalProps> = ({ type, item, cash, happiness, onTransaction, onClose }) => {
  if (!item) return null;

  const isEnterprise = type === 'enterprise';
  const Icon = isEnterprise ? Target : Star;
  const title = isEnterprise ? '購買目標企業' : '實現心儀夢想';
  const colorClass = isEnterprise ? 'indigo' : 'fuchsia';

  const cost = item.cost;
  const canAfford = cash >= cost;
  const alreadyAchieved = happiness.find(h => h.id === (isEnterprise ? 'h_career' : 'h_dream'))?.checked;

  const handlePurchase = () => {
    if (!canAfford || alreadyAchieved) return;

    if (isEnterprise) {
      const ent = item as Enterprise;
      onTransaction({
        name: `達成事業成就：${ent.name}`,
        amount: ent.cost,
        cashChange: -ent.cost,
        source: 'cash',
        usage: 'asset',
        assetDetails: {
          type: '企業',
          cashflow: ent.income,
          downPayment: ent.cost,
          symbol: ent.name
        }
      });
    } else {
      const dream = item as Dream;
      onTransaction({
        name: `實現人生夢想：${dream.name}`,
        amount: dream.cost,
        cashChange: -dream.cost,
        source: 'cash',
        usage: 'expense'
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className={`w-full max-w-md bg-slate-900 border ${isEnterprise ? 'border-indigo-500/30' : 'border-fuchsia-500/30'} rounded-3xl shadow-2xl overflow-hidden`}>
        <div className={`flex flex-col items-center justify-center p-8 ${isEnterprise ? 'bg-gradient-to-br from-indigo-900/40 to-slate-900' : 'bg-gradient-to-br from-fuchsia-900/40 to-slate-900'} border-b border-slate-800 relative`}>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className={`w-20 h-20 rounded-full ${isEnterprise ? 'bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.3)]' : 'bg-fuchsia-500/20 border-fuchsia-500/50 shadow-[0_0_30px_rgba(217,70,239,0.3)]'} flex items-center justify-center border-2 mb-4`}>
            <Icon size={40} className={isEnterprise ? 'text-indigo-400' : 'text-fuchsia-400'} />
          </div>
          
          <h2 className="text-2xl font-black text-white tracking-widest">{title}</h2>
          <p className={`text-sm font-bold mt-2 ${isEnterprise ? 'text-indigo-400 bg-indigo-950/50 border-indigo-500/30' : 'text-fuchsia-400 bg-fuchsia-950/50 border-fuchsia-500/30'} px-4 py-1 rounded-full border`}>
            {item.name}
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
              <span className="text-sm font-bold text-slate-400">目前現金</span>
              <span className="text-xl font-black text-emerald-400">${cash.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
              <span className="text-sm font-bold text-slate-400">所需{isEnterprise ? '頭期款' : '花費'}</span>
              <span className="text-2xl font-black text-white">${cost.toLocaleString()}</span>
            </div>
          </div>
          
          {isEnterprise && (
            <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 flex justify-between items-center">
              <span className="text-sm font-bold text-indigo-300">每月可創造現金流</span>
              <span className="text-lg font-black text-emerald-400">+${(item as Enterprise).income.toLocaleString()}</span>
            </div>
          )}

          {alreadyAchieved && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold text-center">
              {isEnterprise ? '您已達成此事業成就，不可重複買入' : '您已實現此人生夢想，不可重複實現'}
            </div>
          )}

          {!alreadyAchieved && !canAfford && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold text-center">
              現金不足，無法購買！
            </div>
          )}

          <button
            onClick={handlePurchase}
            disabled={!canAfford || alreadyAchieved}
            className={`w-full py-4 rounded-2xl font-black tracking-widest text-[16px] transition-all flex items-center justify-center gap-2 ${
              !canAfford || alreadyAchieved
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : isEnterprise ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'bg-fuchsia-600 text-white hover:bg-fuchsia-500 hover:shadow-[0_0_20px_rgba(217,70,239,0.4)]'
            }`}
          >
            確認購買 <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Target, Star, X } from 'lucide-react';
import { Dream, Enterprise, HappinessItem, TransactionData } from '../../types';
import { TargetAndDreamModal } from './TargetAndDreamModals';

interface TargetDreamSelectorModalProps {
  enterprise: Enterprise | null;
  dream: Dream | null;
  cash: number;
  happiness: HappinessItem[];
  onTransaction: (data: TransactionData) => void;
  onClose: () => void;
}

export const TargetDreamSelectorModal: React.FC<TargetDreamSelectorModalProps> = ({
  enterprise,
  dream,
  cash,
  happiness,
  onTransaction,
  onClose
}) => {
  const [selectedType, setSelectedType] = useState<'enterprise' | 'dream' | null>(null);

  if (selectedType) {
    return (
      <TargetAndDreamModal
        type={selectedType}
        item={selectedType === 'enterprise' ? enterprise : dream}
        cash={cash}
        happiness={happiness}
        onTransaction={(data) => {
          onTransaction(data);
          onClose(); // Close both after transaction
        }}
        onClose={() => setSelectedType(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="p-8 text-center border-b border-slate-800">
          <h2 className="text-2xl font-black text-white tracking-widest">目標與夢想</h2>
          <p className="text-slate-400 mt-2 text-sm font-medium">請選擇您要實現的項目</p>
        </div>

        <div className="p-6 space-y-4">
          <button
            onClick={() => setSelectedType('enterprise')}
            disabled={!enterprise}
            className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 ${
              !enterprise 
                ? 'bg-slate-800/50 border-slate-800 opacity-50 cursor-not-allowed' 
                : 'bg-indigo-900/20 border-indigo-500/30 hover:bg-indigo-900/40 hover:border-indigo-500/60 group'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <Target size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-black tracking-wide text-white">購買目標企業</h3>
              <p className="text-xs text-slate-400 mt-1">{enterprise ? enterprise.name : '尚未設定'}</p>
            </div>
          </button>

          <button
            onClick={() => setSelectedType('dream')}
            disabled={!dream}
            className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 ${
              !dream 
                ? 'bg-slate-800/50 border-slate-800 opacity-50 cursor-not-allowed' 
                : 'bg-fuchsia-900/20 border-fuchsia-500/30 hover:bg-fuchsia-900/40 hover:border-fuchsia-500/60 group'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <Star size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-black tracking-wide text-white">實現心儀夢想</h3>
              <p className="text-xs text-slate-400 mt-1">{dream ? dream.name : '尚未設定'}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

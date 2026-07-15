import React, { useState } from 'react';
import { Target, Star } from 'lucide-react';
import { Dream, Enterprise, HappinessItem, TransactionData } from '../../types';
import { TargetAndDreamModal } from './TargetAndDreamModals';
import { PlayerModalFrame } from '../common/PlayerModalFrame';

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
    <PlayerModalFrame eyebrow="人生目標" title="目標與夢想" description="請選擇你要實現的項目。" accent="opportunity" onClose={onClose}>
        <div className="space-y-4">
          <button
            onClick={() => setSelectedType('enterprise')}
            disabled={!enterprise}
            className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 ${
              !enterprise
                ? 'bg-[#f4e6d0] border-[#ead7b8] opacity-50 cursor-not-allowed'
                : 'bg-[#fff2de] border-[#d6a94e] hover:bg-[#f4e6d0] hover:border-[#a9643a] group'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#f0dfc9] text-[#a9643a] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <Target size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-black tracking-wide text-[#293a38]">購買目標企業</h3>
              <p className="text-xs text-[#7a6958] mt-1">{enterprise ? enterprise.name : '尚未設定'}</p>
            </div>
          </button>

          <button
            onClick={() => setSelectedType('dream')}
            disabled={!dream}
            className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 ${
              !dream
                ? 'bg-[#f4e6d0] border-[#ead7b8] opacity-50 cursor-not-allowed'
                : 'bg-[#e5f1eb] border-[#b9d9d0] hover:bg-[#d8e9e5] hover:border-[#2e6570] group'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#d8e9e5] text-[#2e6570] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <Star size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-black tracking-wide text-[#293a38]">實現心儀夢想</h3>
              <p className="text-xs text-[#7a6958] mt-1">{dream ? dream.name : '尚未設定'}</p>
            </div>
          </button>
        </div>
    </PlayerModalFrame>
  );
};

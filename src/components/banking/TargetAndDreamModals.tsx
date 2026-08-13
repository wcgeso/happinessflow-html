import React from 'react';
import { Target, Star, ArrowRight } from 'lucide-react';
import { Enterprise, Dream, HappinessItem, TransactionData } from '../../types';
import { PlayerModalFrame } from '../common/PlayerModalFrame';

interface PurchaseModalProps {
  type: 'enterprise' | 'dream';
  item: Enterprise | Dream | null;
  cash: number;
  happiness: HappinessItem[];
  onTransaction: (data: TransactionData) => void;
  onClose: () => void;
}

export const buildTargetEnterpriseTransaction = (enterprise: Enterprise): TransactionData => ({
  name: `達成事業成就：${enterprise.name}`,
  amount: enterprise.cost,
  cashChange: -enterprise.cost,
  source: 'cash',
  usage: 'asset',
  financialCheckEntries: [
    { category: 'Assets', name: '現金', direction: 'Decrease' },
    { category: 'Assets', name: `目標企業（${enterprise.name}）`, direction: 'Increase' },
    { category: 'Income', name: '企業收益', direction: 'Increase' }
  ],
  impacts: [
    `現金 -${enterprise.cost.toLocaleString()}`,
    `目標企業（${enterprise.name}） +${enterprise.cost.toLocaleString()}`,
    `每月企業收益 +${enterprise.income.toLocaleString()}`
  ],
  assetDetails: {
    type: '企業',
    cashflow: enterprise.income,
    downPayment: enterprise.cost,
    symbol: enterprise.name
  }
});

export const buildDreamTransaction = (dream: Dream): TransactionData => ({
  name: `實現人生夢想：${dream.name}`,
  amount: dream.cost,
  cashChange: -dream.cost,
  source: 'cash',
  usage: 'expense',
  financialCheckEntries: [
    { category: 'Assets', name: '現金', direction: 'Decrease' }
  ],
  impacts: [
    `現金 -${dream.cost.toLocaleString()}`,
    `成功實現夢想：${dream.name}`
  ]
});

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
      onTransaction(buildTargetEnterpriseTransaction(ent));
    } else {
      const dream = item as Dream;
      onTransaction(buildDreamTransaction(dream));
    }
    onClose();
  };

  return (
    <PlayerModalFrame
      eyebrow={isEnterprise ? '目標事業' : '人生藍圖'}
      title={title}
      description={item.name}
      accent={isEnterprise ? 'opportunity' : 'happiness'}
      layout="dialog"
      onClose={onClose}
      footer={(
        <button
          onClick={handlePurchase}
          disabled={!canAfford || alreadyAchieved}
          className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-black tracking-widest text-[16px] transition-all ${
            !canAfford || alreadyAchieved
              ? 'cursor-not-allowed bg-[#eadfca] text-[#a99a87]'
              : isEnterprise ? 'bg-[#a9643a] text-white hover:bg-[#8f5231]' : 'bg-[#c9655a] text-white hover:bg-[#b6544b]'
          }`}
        >
          確認購買 <ArrowRight size={18} />
        </button>
      )}
    >
        <div className="mb-6 flex justify-center">
          <div className={`flex h-20 w-20 items-center justify-center rounded-full border-2 ${isEnterprise ? 'border-[#d6a94e] bg-[#f0dfc9] text-[#a9643a]' : 'border-[#e2b2bf] bg-[#f7d5df] text-[#bd4f73]'}`}>
            <Icon size={40} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-[#ead7b8] bg-[#fffaf2] p-4">
              <span className="text-sm font-bold text-[#7a6958]">目前現金</span>
              <span className="text-xl font-black text-[#2e806d]">${cash.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center justify-between rounded-2xl border border-[#ead7b8] bg-[#fffaf2] p-4">
              <span className="text-sm font-bold text-[#7a6958]">所需{isEnterprise ? '頭期款' : '花費'}</span>
              <span className="text-2xl font-black text-[#293a38]">${cost.toLocaleString()}</span>
            </div>
          </div>
          
          {isEnterprise && (
            <div className="flex items-center justify-between rounded-2xl border border-[#b9d9d0] bg-[#e5f1eb] p-4">
              <span className="text-sm font-bold text-[#2e6570]">每月可創造現金流</span>
              <span className="text-lg font-black text-[#2e806d]">+${(item as Enterprise).income.toLocaleString()}</span>
            </div>
          )}

          {alreadyAchieved && (
            <div className="rounded-xl border border-[#e2b2bf] bg-[#f7d5df] p-3 text-center text-sm font-bold text-[#b6544b]">
              {isEnterprise ? '您已達成此事業成就，不可重複買入' : '您已實現此人生夢想，不可重複實現'}
            </div>
          )}

          {!alreadyAchieved && !canAfford && (
            <div className="rounded-xl border border-[#e2b2bf] bg-[#f7d5df] p-3 text-center text-sm font-bold text-[#b6544b]">
              現金不足，無法購買！
            </div>
          )}

        </div>
    </PlayerModalFrame>
  );
};

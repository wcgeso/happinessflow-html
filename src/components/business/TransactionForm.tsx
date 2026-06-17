import React from 'react';
import { Asset, Dream, Enterprise, HappinessItem, Profession, TransactionData } from '../../types';
import { BankingAppModal } from '../banking/BankingAppModal';

interface TransactionFormProps {
  profession: Profession | null;
  selectedEnterprise: Enterprise | null;
  selectedDream: Dream | null;
  cash: number;
  salary: number;
  assets?: Asset[];
  happiness?: HappinessItem[];
  completedHappinessEvents?: string[];
  happinessSubMode: 'history' | 'pay' | 'inc_exp';
  setHappinessSubMode: (v: 'history' | 'pay' | 'inc_exp') => void;
  liabilities: any[];
  currentRankLevel: number;
  medicalInsuranceCount?: number;
  marketPrices?: Record<string, number>;
  previousMarketPrices?: Record<string, number>;
  onTransaction: (data: TransactionData) => void;
  onCancel: () => void;
  onShowMarket?: () => void;
  onShowAlert?: (message: string, type: 'info' | 'error' | 'success', persist?: boolean) => void;
  disabled?: boolean;
  initialTab?: 'broker' | 'banking' | 'wealth';
  initialMode?: 'buy' | 'sell' | 'loan' | 'dividend' | 'event' | 'expense' | 'insurance' | 'deposit';
  initialAssetType?: '保險' | '定存' | '股票' | '不動產' | '企業';
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  cash,
  salary,
  assets,
  liabilities,
  medicalInsuranceCount,
  marketPrices,
  previousMarketPrices,
  onTransaction,
  onCancel,
  initialTab,
  initialMode,
  initialAssetType
}) => {
  // Map old modes to new tabs
  let resolvedTab: 'broker' | 'banking' | 'wealth' = initialTab || 'broker';
  
  if (!initialTab) {
      if (initialMode === 'buy' || initialMode === 'sell') {
        if (initialAssetType === '保險' || initialAssetType === '定存') {
          resolvedTab = 'wealth';
        } else {
          resolvedTab = 'broker';
        }
      } else if (initialMode === 'loan') {
        resolvedTab = 'banking';
      } else if (initialMode === 'insurance' || initialMode === 'deposit') {
        resolvedTab = 'wealth';
      }
  }

  return (
    <BankingAppModal
      cash={cash}
      salary={salary}
      assets={assets}
      liabilities={liabilities}
      marketPrices={marketPrices}
      previousMarketPrices={previousMarketPrices}
      medicalInsuranceCount={medicalInsuranceCount}
      initialTab={resolvedTab}
      onTransaction={onTransaction}
      onClose={onCancel}
    />
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { X, TrendingUp, Landmark, ShieldCheck } from 'lucide-react';
import { AccountEntry, Asset, TransactionData } from '../../types';
import { getStockAssetLabel } from '../../utils/assetLabels';
import { BrokerView } from './BrokerView';
import { BankingView } from './BankingView';
import { WealthView } from './WealthView';
import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';
import { NEWS_CARD_MAP } from '../../constants/cards';

export type BankingTab = 'broker' | 'banking' | 'wealth';

export interface BankingAppModalProps {
  cash: number;
  salary: number;
  assets?: Asset[];
  liabilities: any[];
  marketPrices?: Record<string, number>;
  previousMarketPrices?: Record<string, number>;
  medicalInsuranceCount?: number;
  initialTab?: BankingTab;
  canUseBankProducts?: boolean;
  onTransaction: (data: TransactionData) => void;
  onClose: () => void;
}

export const BankingAppModal: React.FC<BankingAppModalProps> = ({
  cash = 0,
  salary = 0,
  assets = [],
  liabilities = [],
  marketPrices = {},
  previousMarketPrices = {},
  medicalInsuranceCount = 0,
  initialTab = 'broker',
  canUseBankProducts = true,
  onTransaction,
  onClose
}) => {
  const { room } = useRoom();
  const { user } = useAuth();
  const safeInitialTab = initialTab === 'wealth' && !canUseBankProducts ? 'broker' : initialTab;
  const [activeTab, setActiveTab] = useState<BankingTab>(safeInitialTab);

  useEffect(() => {
    if (!canUseBankProducts && activeTab === 'wealth') {
      setActiveTab('broker');
    }
  }, [activeTab, canUseBankProducts]);

  const brokerAssets = useMemo(
    () => assets.map(asset => {
      if (asset.type !== '股票') return asset;

      const symbolFromName = asset.name.replace(/^股票\s*/, '').trim();
      return {
        ...asset,
        symbol: symbolFromName,
        shares: asset.quantity || 0,
        buyPrice: asset.lastPurchasePrice || 0
      };
    }),
    [assets]
  );

  const boardCardMarketPrices = useMemo(() => {
    const currentCard = room?.boardState?.currentCard;
    const currentEvent = room?.boardState?.currentEvent;
    if (!currentCard || currentCard.deck !== 'news') return null;
    if (currentEvent?.playerUid && user?.uid && currentEvent.playerUid !== user.uid) return null;

    const newsCard = NEWS_CARD_MAP[currentCard.cardId];
    if (!newsCard || newsCard.type !== 'stock_price') return null;

    return newsCard.prices;
  }, [room?.boardState?.currentCard, room?.boardState?.currentEvent, user?.uid]);

  const effectiveMarketPrices = useMemo(
    () => ({
      ...(room?.marketPrices || {}),
      ...(marketPrices || {}),
      ...(boardCardMarketPrices || {})
    }),
    [room?.marketPrices, marketPrices, boardCardMarketPrices]
  );

  const effectivePreviousMarketPrices = useMemo(
    () => ({
      ...(room?.previousMarketPrices || {}),
      ...(previousMarketPrices || {})
    }),
    [room?.previousMarketPrices, previousMarketPrices]
  );

  const buildFinancialCheckEntries = (data: TransactionData): AccountEntry[] => {
    if (data.financialCheckEntries && data.financialCheckEntries.length > 0) {
      return data.financialCheckEntries;
    }

    if (data.usage === 'insurance' || data.insuranceType) {
      return [
        { category: 'Assets', name: '現金', direction: 'Decrease' },
        { category: 'Expenses', name: '保險支出', direction: 'Increase' }
      ];
    }

    if (data.usage === 'buy_asset' && data.assetChange?.asset.type === '定存') {
      return [
        { category: 'Assets', name: '現金', direction: 'Decrease' },
        { category: 'Assets', name: '定存', direction: 'Increase' },
        { category: 'Income', name: '定存利息', direction: 'Increase' }
      ];
    }

    if (data.usage === 'buy_asset' && data.assetChange?.asset.type === '股票') {
      return [
        { category: 'Assets', name: '現金', direction: 'Decrease' },
        { category: 'Assets', name: '股票', direction: 'Increase' }
      ];
    }

    if (data.usage === 'asset' && data.stockList?.length) {
      return [
        { category: 'Assets', name: '現金', direction: 'Decrease' },
        ...data.stockList.map(item => ({ category: 'Assets', name: getStockAssetLabel(item.symbol), direction: 'Increase' as const }))
      ];
    }

    if (data.usage === 'sell_asset' && data.sellAssetPayload?.type === 'stock') {
      return [
        { category: 'Assets', name: '現金', direction: 'Increase' },
        { category: 'Assets', name: getStockAssetLabel(data.sellAssetPayload.symbol), direction: 'Decrease' }
      ];
    }

    if (data.usage === 'cash' && data.stockList?.length) {
      return [
        { category: 'Assets', name: '現金', direction: 'Increase' },
        ...data.stockList.map(item => ({ category: 'Assets', name: getStockAssetLabel(item.symbol), direction: 'Decrease' as const }))
      ];
    }

    if (data.usage === 'loan') {
      return [
        { category: 'Assets', name: '現金', direction: 'Increase' },
        { category: 'Liabilities', name: '信用貸款', direction: 'Increase' },
        { category: 'Expenses', name: '信貸利息', direction: 'Increase' }
      ];
    }

    if (data.usage === 'loan_repayment') {
      return [
        { category: 'Assets', name: '現金', direction: 'Decrease' },
        { category: 'Liabilities', name: '信用貸款', direction: 'Decrease' },
        { category: 'Expenses', name: '信貸利息', direction: 'Decrease' }
      ];
    }

    return [];
  };

  const normalizeTransactionForGame = (data: TransactionData): TransactionData => {
    const nextData: TransactionData = {
      ...data,
      financialCheckEntries: buildFinancialCheckEntries(data)
    };

    if (nextData.usage === 'insurance' || nextData.insuranceType) {
      const insuranceAmount = nextData.amount || nextData.expensePayload?.amount || 2000;
      const insuranceLabel = nextData.insuranceType === 'medical'
        ? '醫療保險'
        : nextData.insuranceType === 'house'
          ? '房屋保險'
          : '汽車保險';

      return {
        ...nextData,
        name: nextData.name || `購買${insuranceLabel}`,
        amount: insuranceAmount,
        cashChange: nextData.cashChange === 0 ? -insuranceAmount : nextData.cashChange,
        impacts: nextData.impacts || [
          `保險支出(月) +${insuranceAmount.toLocaleString()} H`
        ]
      };
    }

    if (nextData.usage === 'buy_asset' && nextData.assetChange?.asset.type === '定存') {
      const depositAmount = nextData.amount || nextData.assetChange.asset.value || 0;
      const monthlyInterest = Math.floor(depositAmount * 0.005);
      return {
        ...nextData,
        impacts: nextData.impacts || [
          `現金 -${depositAmount.toLocaleString()} H`,
          `定存 +${depositAmount.toLocaleString()} H`,
          `定存利息(月) +${monthlyInterest.toLocaleString()} H`
        ]
      };
    }

    if (nextData.usage === 'buy_asset' && nextData.assetChange?.asset.type === '股票') {
      const total = nextData.amount || 0;
      const symbol = nextData.assetChange.asset.symbol || nextData.assetChange.asset.name;
      return {
        ...nextData,
        impacts: nextData.impacts || [
          `現金 -${total.toLocaleString()} H`,
          `${getStockAssetLabel(symbol)} +${total.toLocaleString()} H`
        ]
      };
    }

    if (nextData.usage === 'asset' && nextData.stockList?.length) {
      const total = nextData.amount || 0;
      return {
        ...nextData,
        impacts: nextData.impacts || [
          `現金 -${total.toLocaleString()} H`,
          ...nextData.stockList.map(item => `${getStockAssetLabel(item.symbol)} +${(item.price * item.qty).toLocaleString()} H`)
        ]
      };
    }

    if (nextData.usage === 'sell_asset' && nextData.sellAssetPayload?.type === 'stock') {
      const total = nextData.amount || 0;
      return {
        ...nextData,
        impacts: nextData.impacts || [
          `現金 +${total.toLocaleString()} H`,
          `${getStockAssetLabel(nextData.sellAssetPayload.symbol)} -${total.toLocaleString()} H`
        ]
      };
    }

    if (nextData.usage === 'cash' && nextData.stockList?.length) {
      const total = nextData.amount || 0;
      return {
        ...nextData,
        impacts: nextData.impacts || [
          `現金 +${total.toLocaleString()} H`,
          ...nextData.stockList.map(item => `${getStockAssetLabel(item.symbol)} -${(item.price * item.qty).toLocaleString()} H`)
        ]
      };
    }

    if (nextData.usage === 'loan') {
      const loanAmount = nextData.amount || 0;
      const interest = Math.floor(loanAmount * 0.1);
      return {
        ...nextData,
        impacts: nextData.impacts || [
          `現金 +${loanAmount.toLocaleString()} H`,
          `信用貸款 +${loanAmount.toLocaleString()} H`,
          `信貸利息(月) +${interest.toLocaleString()} H`
        ]
      };
    }

    if (nextData.usage === 'loan_repayment') {
      const repayAmount = nextData.amount || 0;
      return {
        ...nextData,
        impacts: nextData.impacts || [
          `現金 -${repayAmount.toLocaleString()} H`,
          `信用貸款 -${repayAmount.toLocaleString()} H`,
          '信貸利息(月) 減少'
        ]
      };
    }

    return nextData;
  };

  const tabs = [
    { id: 'broker', label: '股票交易', icon: <TrendingUp size={16} /> },
    { id: 'banking', label: '信用貸款', icon: <Landmark size={16} /> },
    { id: 'wealth', label: '理財商品', icon: <ShieldCheck size={16} /> }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[90vh] md:h-[650px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Landmark className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide">數位理財 App</h2>
              <p className="text-xs text-indigo-300 font-medium">Happiness Digital Banking</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area - Row layout for desktop, Col for mobile */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          
          {/* Sidebar Tabs */}
          <div className="w-full sm:w-56 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-slate-800 bg-slate-900/50 p-3 sm:p-4 overflow-x-auto sm:overflow-y-auto no-scrollbar hide-scrollbar">
            <div className="flex sm:flex-col gap-2">
              {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                const isLocked = tab.id === 'wealth' && !canUseBankProducts;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (isLocked) return;
                      setActiveTab(tab.id as BankingTab);
                    }}
                    disabled={isLocked}
                    className={`flex items-center gap-3 px-4 py-3 sm:py-3.5 rounded-2xl transition-all whitespace-nowrap sm:whitespace-normal font-black tracking-wider text-[14.5px] ${
                      isActive 
                        ? 'bg-indigo-600/20 text-indigo-400 shadow-inner ring-1 ring-indigo-500/50' 
                        : isLocked
                          ? 'text-slate-600 cursor-not-allowed'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}{isLocked ? ' (需先經過銀行)' : ''}
                  </button>
                );
              })}
            </div>
            
            <div className="hidden sm:block mt-8 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50">
              <div className="text-[11px] font-bold text-slate-500 mb-1">可用餘額</div>
              <div className="text-lg font-black text-emerald-400">${cash.toLocaleString()}</div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-900 p-4 sm:p-6 ">
            {!canUseBankProducts && activeTab !== 'broker' && activeTab !== 'banking' && (
              <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-200">
                本回合尚未經過銀行，保險與定存會在經過銀行後開放，並持續到你下一次回合開始前。
              </div>
            )}
            {activeTab === 'broker' && (
              <BrokerView
                cash={cash}
                assets={brokerAssets}
                marketPrices={effectiveMarketPrices}
                previousMarketPrices={effectivePreviousMarketPrices}
                onTransaction={(data) => onTransaction(normalizeTransactionForGame(data))}
              />
            )}
            {activeTab === 'banking' && (
              <BankingView
                cash={cash}
                liabilities={liabilities}
                onTransaction={(data) => onTransaction(normalizeTransactionForGame(data))}
              />
            )}
            {activeTab === 'wealth' && (
              <WealthView
                cash={cash}
                salary={salary}
                medicalInsuranceCount={medicalInsuranceCount}
                assets={assets}
                onTransaction={(data) => onTransaction(normalizeTransactionForGame(data))}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, TrendingUp, Landmark, ShieldCheck } from 'lucide-react';
import { Asset, TransactionData } from '../../types';
import { BrokerView } from './BrokerView';
import { BankingView } from './BankingView';
import { WealthView } from './WealthView';

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
  onTransaction,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<BankingTab>(initialTab);

  const tabs = [
    { id: 'broker', label: '證券交易', icon: <TrendingUp size={16} /> },
    { id: 'banking', label: '銀行服務', icon: <Landmark size={16} /> },
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
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as BankingTab)}
                    className={`flex items-center gap-3 px-4 py-3 sm:py-3.5 rounded-2xl transition-all whitespace-nowrap sm:whitespace-normal font-black tracking-wider text-[14.5px] ${
                      isActive 
                        ? 'bg-indigo-600/20 text-indigo-400 shadow-inner ring-1 ring-indigo-500/50' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
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
            {activeTab === 'broker' && (
              <BrokerView 
                cash={cash} 
                assets={assets} 
                marketPrices={marketPrices} 
                previousMarketPrices={previousMarketPrices} 
                onTransaction={onTransaction} 
              />
            )}
            {activeTab === 'banking' && (
              <BankingView 
                cash={cash} 
                liabilities={liabilities} 
                onTransaction={onTransaction} 
              />
            )}
            {activeTab === 'wealth' && (
              <WealthView 
                cash={cash} 
                salary={salary}
                medicalInsuranceCount={medicalInsuranceCount}
                assets={assets}
                onTransaction={onTransaction} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

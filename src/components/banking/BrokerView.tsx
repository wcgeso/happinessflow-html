import React, { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Asset, TransactionData } from '../../types';
import { STOCK_SYMBOLS } from '../../constants';

interface BrokerViewProps {
  cash: number;
  assets: Asset[];
  marketPrices: Record<string, number>;
  previousMarketPrices: Record<string, number>;
  onTransaction: (data: TransactionData) => void;
}

export const BrokerView: React.FC<BrokerViewProps> = ({ cash, assets, marketPrices, previousMarketPrices, onTransaction }) => {
  const [selectedStock, setSelectedStock] = useState<string>('A10');
  const [actionType, setActionType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<number>(0);

  const price = marketPrices[selectedStock] || 0;
  const prevPrice = previousMarketPrices[selectedStock] || price;
  const isUp = price >= prevPrice;

  // Calculate held shares
  const stockAssets = assets.filter(a => a.type === '股票' && a.symbol === selectedStock);
  const totalShares = stockAssets.reduce((sum, a) => sum + (a.shares || 0), 0);

  const maxBuy = Math.floor(cash / price);
  const maxSell = totalShares;

  const handleTransact = () => {
    if (amount <= 0) return;
    
    if (actionType === 'buy') {
      onTransaction({
        name: `買進 ${selectedStock} 股票`,
        amount: price * amount,
        cashChange: -(price * amount),
        source: 'cash',
        usage: 'buy_asset',
        assetChange: {
          action: 'add',
          asset: {
            id: `stock_${selectedStock}_${Date.now()}`,
            name: `${selectedStock} 股票`,
            type: '股票',
            value: price * amount,
            symbol: selectedStock,
            shares: amount,
            buyPrice: price,
            monthlyCashflow: 0
          }
        }
      });
    } else {
      onTransaction({
        name: `賣出 ${selectedStock} 股票`,
        amount: price * amount,
        cashChange: price * amount,
        source: 'cash',
        usage: 'sell_asset',
        sellAssetPayload: {
          type: 'stock',
          symbol: selectedStock,
          sharesToSell: amount,
          currentPrice: price
        }
      });
    }
    setAmount(0);
  };

  return (
    <div className="space-y-6 text-white">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STOCK_SYMBOLS.map(sym => {
          const symPrice = marketPrices[sym] || 0;
          const symPrevPrice = previousMarketPrices[sym] || symPrice;
          const symIsUp = symPrice > symPrevPrice;
          const symIsDown = symPrice < symPrevPrice;
          const symShares = assets.filter(a => a.type === '股票' && a.symbol === sym).reduce((sum, a) => sum + (a.shares || 0), 0);
          
          let changePercent = 0;
          if (symPrevPrice > 0) {
              changePercent = ((symPrice - symPrevPrice) / symPrevPrice) * 100;
          }
          
          return (
            <button
              key={sym}
              onClick={() => { setSelectedStock(sym); setAmount(0); }}
              className={`p-3 rounded-2xl border text-left transition-all ${selectedStock === sym ? 'bg-indigo-600/20 border-indigo-500 shadow-inner ring-1 ring-indigo-500/50' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-black text-[15px] tracking-widest">{sym}</span>
                <span className={`text-[10px] font-black ${symIsUp ? 'text-emerald-400' : symIsDown ? 'text-rose-400' : 'text-slate-500'}`}>
                    {symPrevPrice > 0 ? (
                        <>{symIsUp ? '+' : ''}{changePercent.toFixed(1)}%</>
                    ) : '-'}
                </span>
              </div>
              <div className={`font-bold text-lg ${symIsUp ? 'text-emerald-400' : symIsDown ? 'text-rose-400' : 'text-slate-200'}`}>${symPrice}</div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] text-slate-500">前值: ${symPrevPrice}</span>
                {symShares > 0 && <span className="text-[11px] text-indigo-300 font-bold">持有 {symShares}</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-slate-800/40 border border-slate-700 rounded-3xl p-5 sm:p-6">
        <div className="flex bg-slate-900/80 p-1.5 rounded-2xl mb-6 border border-slate-800">
          <button
            onClick={() => { setActionType('buy'); setAmount(0); }}
            className={`flex-1 py-2.5 rounded-xl font-black tracking-widest text-[14px] transition-all ${actionType === 'buy' ? 'bg-emerald-600/20 text-emerald-400 shadow-inner border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            買進
          </button>
          <button
            onClick={() => { setActionType('sell'); setAmount(0); }}
            className={`flex-1 py-2.5 rounded-xl font-black tracking-widest text-[14px] transition-all ${actionType === 'sell' ? 'bg-rose-600/20 text-rose-400 shadow-inner border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            賣出
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between text-sm font-bold text-slate-400 mb-2">
            <span>交易數量 (張)</span>
            <span>最多可{actionType === 'buy' ? '買' : '賣'}: <span className="text-slate-200">{actionType === 'buy' ? maxBuy : maxSell}</span></span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setAmount(Math.max(0, amount - 1))}
              className="w-12 h-12 rounded-2xl bg-slate-700 text-slate-300 font-black text-xl flex items-center justify-center hover:bg-slate-600"
            >-</button>
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
              className="flex-1 h-12 bg-slate-900 border border-slate-700 rounded-2xl text-center text-xl font-black tracking-wider text-white"
            />
            <button 
              onClick={() => setAmount(Math.min(actionType === 'buy' ? maxBuy : maxSell, amount + 1))}
              className="w-12 h-12 rounded-2xl bg-slate-700 text-slate-300 font-black text-xl flex items-center justify-center hover:bg-slate-600"
            >+</button>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500">預估總額</div>
              <div className="text-2xl font-black text-white">${(price * amount).toLocaleString()}</div>
            </div>
            
            <button
              onClick={handleTransact}
              disabled={amount <= 0 || (actionType === 'buy' && amount > maxBuy) || (actionType === 'sell' && amount > maxSell)}
              className={`px-8 py-3 rounded-2xl font-black tracking-widest text-[15px] transition-all ${
                amount <= 0 || (actionType === 'buy' && amount > maxBuy) || (actionType === 'sell' && amount > maxSell)
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : actionType === 'buy' 
                    ? 'bg-emerald-500 text-white hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : 'bg-rose-500 text-white hover:bg-rose-400 hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]'
              }`}
            >
              確認{actionType === 'buy' ? '買進' : '賣出'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

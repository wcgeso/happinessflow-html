import React, { useMemo, useState } from 'react';
import { STOCK_NAMES } from '../../constants';
import { Asset, TransactionData } from '../../types';
import { extractAssetSymbol } from '../../utils/assetLabels';

const STOCK_COLUMNS = [
  ['A10', 'A20', 'A30', 'A40'],
  ['B50', 'B60', 'B70', 'B80']
] as const;

type TradeMode = 'buy' | 'sell';

interface BrokerViewProps {
  cash: number;
  assets: Asset[];
  marketPrices: Record<string, number>;
  previousMarketPrices: Record<string, number>;
  onTransaction: (data: TransactionData) => void;
}

const EMPTY_QTY_MAP = Object.fromEntries(
  STOCK_COLUMNS.flat().map(symbol => [symbol, 0])
) as Record<string, number>;

export const BrokerView: React.FC<BrokerViewProps> = ({ cash, assets, marketPrices, previousMarketPrices, onTransaction }) => {
  const [mode, setMode] = useState<TradeMode>('buy');
  const [tradeQuantities, setTradeQuantities] = useState<Record<string, number>>(EMPTY_QTY_MAP);

  const holdingsBySymbol = useMemo(
    () => STOCK_COLUMNS.flat().reduce<Record<string, number>>((acc, symbol) => {
      acc[symbol] = assets
        .filter(asset => asset.type === '股票' && extractAssetSymbol(asset.symbol || asset.name) === symbol)
        .reduce((sum, asset) => sum + (asset.shares || asset.quantity || 0), 0);
      return acc;
    }, {}),
    [assets]
  );

  const resetQuantities = () => {
    setTradeQuantities({ ...EMPTY_QTY_MAP });
  };

  const setQuantity = (symbol: string, nextValue: number) => {
    const cappedValue = mode === 'sell'
      ? Math.min(Math.max(0, nextValue), holdingsBySymbol[symbol] || 0)
      : Math.max(0, nextValue);

    setTradeQuantities(prev => ({
      ...prev,
      [symbol]: cappedValue
    }));
  };

  const applyBulkOneShare = (nextMode: TradeMode) => {
    setMode(nextMode);
    setTradeQuantities(prev => STOCK_COLUMNS.flat().reduce<Record<string, number>>((acc, symbol) => {
      const currentValue = prev[symbol] || 0;
      if (nextMode === 'buy') {
        acc[symbol] = currentValue + 1;
      } else {
        const maxSellable = holdingsBySymbol[symbol] || 0;
        acc[symbol] = Math.min(maxSellable, currentValue + (maxSellable > 0 ? 1 : 0));
      }
      return acc;
    }, {}));
  };

  const tradeItems = useMemo(
    () => STOCK_COLUMNS.flat()
      .map(symbol => {
        const qty = tradeQuantities[symbol] || 0;
        const price = marketPrices[symbol] || 0;
        return { symbol, qty, price, total: qty * price };
      })
      .filter(item => item.qty > 0),
    [tradeQuantities, marketPrices]
  );

  const totalTradeAmount = tradeItems.reduce((sum, item) => sum + item.total, 0);
  const hasOverSell = mode === 'sell' && tradeItems.some(item => item.qty > (holdingsBySymbol[item.symbol] || 0));
  const cannotAffordBuy = mode === 'buy' && totalTradeAmount > cash;
  const canSubmit = tradeItems.length > 0 && !hasOverSell && !cannotAffordBuy;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (mode === 'sell' && tradeItems.some(item => item.qty > (holdingsBySymbol[item.symbol] || 0))) {
      return;
    }

    const stockList = tradeItems.map(item => ({
      symbol: item.symbol,
      price: item.price,
      qty: item.qty
    }));
    const tickerNames = stockList.map(item => item.symbol).join(', ');

    if (mode === 'buy') {
      onTransaction({
        name: `買入股票 (${tickerNames})`,
        amount: totalTradeAmount,
        cashChange: -totalTradeAmount,
        source: 'cash',
        usage: 'asset',
        stockList,
        assetDetails: {
          type: '股票',
          cashflow: 0,
          downPayment: totalTradeAmount
        }
      });
    } else {
      onTransaction({
        name: `賣出股票 (${tickerNames})`,
        amount: totalTradeAmount,
        cashChange: totalTradeAmount,
        source: 'income',
        usage: 'cash',
        stockList
      });
    }

    resetQuantities();
  };

  const renderStockCard = (symbol: string) => {
    const currentPrice = marketPrices[symbol] || 0;
    const previousPrice = previousMarketPrices[symbol] || currentPrice;
    const heldShares = holdingsBySymbol[symbol] || 0;
    const quantity = tradeQuantities[symbol] || 0;
    const lineTotal = quantity * currentPrice;
    const isUp = currentPrice > previousPrice;
    const isDown = currentPrice < previousPrice;
    const changePercent = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;

    return (
      <div key={symbol} className="rounded-[18px] border border-slate-700/60 bg-slate-800/40 p-2.5 shadow-inner">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-black text-[14px] tracking-widest text-white">{symbol}</div>
            <div className="mt-0.5 text-[10px] font-bold text-slate-500">
              {STOCK_NAMES[symbol] || '未命名股票'}
            </div>
          </div>
          <div className={`text-[10px] font-black ${isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-slate-500'}`}>
            {previousPrice > 0 ? `${isUp ? '+' : ''}${changePercent.toFixed(1)}%` : '-'}
          </div>
        </div>

        <div className={`mt-1.5 text-base font-black ${isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-slate-200'}`}>
          ${currentPrice.toLocaleString()}
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] font-bold">
          <span className="text-slate-500">前值 ${previousPrice.toLocaleString()}</span>
          <span className="text-indigo-300">持有 {heldShares}</span>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity(symbol, quantity - 1)}
            className="h-9 w-9 rounded-xl bg-slate-700 text-base font-black text-slate-200 transition-colors hover:bg-slate-600"
          >
            -
          </button>
          <input
            type="number"
            min={0}
            value={quantity || ''}
            onChange={(event) => setQuantity(symbol, parseInt(event.target.value, 10) || 0)}
            className="h-9 flex-1 rounded-xl border border-slate-700 bg-slate-900 text-center text-sm font-black text-white"
            placeholder="0"
          />
          <button
            type="button"
            onClick={() => setQuantity(symbol, quantity + 1)}
            className="h-9 w-9 rounded-xl bg-slate-700 text-base font-black text-slate-200 transition-colors hover:bg-slate-600"
          >
            +
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
          <span className="text-slate-500">本次{mode === 'buy' ? '買進' : '賣出'} {quantity} 張</span>
          <span className="text-white">${lineTotal.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-white">
      <div className="rounded-3xl border border-slate-700 bg-slate-800/40 p-5 sm:p-6">
        <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => { setMode('buy'); resetQuantities(); }}
            className={`flex-1 py-2.5 rounded-xl font-black tracking-widest text-[14px] transition-all ${mode === 'buy' ? 'bg-emerald-600/20 text-emerald-400 shadow-inner border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            買進
          </button>
          <button
            type="button"
            onClick={() => { setMode('sell'); resetQuantities(); }}
            className={`flex-1 py-2.5 rounded-xl font-black tracking-widest text-[14px] transition-all ${mode === 'sell' ? 'bg-rose-600/20 text-rose-400 shadow-inner border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            賣出
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => applyBulkOneShare('buy')}
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-black text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            全部購買一張
          </button>
          <button
            type="button"
            onClick={() => applyBulkOneShare('sell')}
            className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-black text-rose-300 transition-colors hover:bg-rose-500/20"
          >
            全部出售一張
          </button>
          <button
            type="button"
            onClick={resetQuantities}
            className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-black text-slate-300 transition-colors hover:bg-slate-800"
          >
            清空張數
          </button>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {STOCK_COLUMNS.map((columnSymbols, columnIndex) => (
          <div key={`stock-column-${columnIndex}`} className="grid gap-3">
            {columnSymbols.map(renderStockCard)}
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-700 bg-slate-800/40 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Stock Trade</div>
            <div className="mt-1 text-lg font-black text-white">股票交易</div>
            <div className="mt-1 text-sm font-bold text-slate-400">
              每張股票都可單獨輸入張數，確認後一次完成{mode === 'buy' ? '買進' : '賣出'}。
            </div>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-6 py-3 rounded-2xl font-black tracking-widest text-[15px] transition-all ${
              !canSubmit
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : mode === 'buy'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                  : 'bg-rose-500 text-white hover:bg-rose-400 hover:shadow-[0_0_20px_rgba(244,63,94,0.35)]'
            }`}
          >
            一次確認{mode === 'buy' ? '買進' : '賣出'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 text-sm font-bold text-slate-400 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            可用現金
            <div className="mt-1 text-lg font-black text-emerald-400">${cash.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            已選股票
            <div className="mt-1 text-lg font-black text-white">{tradeItems.length} 檔</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            預估總額
            <div className="mt-1 text-lg font-black text-white">${totalTradeAmount.toLocaleString()}</div>
          </div>
        </div>

        {(cannotAffordBuy || hasOverSell) && (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-200">
            {cannotAffordBuy
              ? '現金不足，請減少買進張數後再送出。'
              : '賣出張數超過持有數量，請修正後再送出。'}
          </div>
        )}
      </div>
    </div>
  );
};

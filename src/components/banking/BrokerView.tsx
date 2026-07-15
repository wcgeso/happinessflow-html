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
      <div key={symbol} className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-2 shadow-inner sm:p-2.5">
        <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
          <span className="shrink-0 text-[13px] font-black tracking-wide text-white">{symbol}</span>
          <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-500">
            {STOCK_NAMES[symbol] || '未命名股票'}
          </span>
          <span className={`shrink-0 text-sm font-black ${isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-slate-200'}`}>
            ${currentPrice.toLocaleString()}
          </span>
          <span className="shrink-0 text-[9px] font-bold text-slate-500">
            前值 ${previousPrice.toLocaleString()}
          </span>
          <span className={`shrink-0 text-[9px] font-black ${isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-slate-500'}`}>
            {previousPrice > 0 ? `${isUp ? '+' : ''}${changePercent.toFixed(1)}%` : '-'}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1.5 sm:mt-2.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setQuantity(symbol, quantity - 1)}
            className="h-9 w-9 shrink-0 rounded-xl bg-slate-700 text-base font-black text-slate-200 transition-colors hover:bg-slate-600"
          >
            -
          </button>
          <input
            type="number"
            min={0}
            value={quantity || ''}
            onChange={(event) => setQuantity(symbol, parseInt(event.target.value, 10) || 0)}
            className="h-9 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 text-center text-sm font-black text-white"
            placeholder="0"
          />
          <button
            type="button"
            onClick={() => setQuantity(symbol, quantity + 1)}
            className="h-9 w-9 shrink-0 rounded-xl bg-slate-700 text-base font-black text-slate-200 transition-colors hover:bg-slate-600"
          >
            +
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
          <span className="text-slate-500">持有 {heldShares} · 本次{mode === 'buy' ? '買進' : '賣出'} {quantity} 張</span>
          <span className="text-white">${lineTotal.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 text-white sm:space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-3 sm:rounded-3xl sm:p-6">
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

        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:mt-4 sm:flex sm:flex-wrap sm:gap-3">
          {mode === 'buy' ? (
            <button
              type="button"
              onClick={() => applyBulkOneShare('buy')}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-2 text-[10px] font-black text-emerald-300 transition-colors hover:bg-emerald-500/20 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
            >
              全部購買一張
            </button>
          ) : (
            <button
              type="button"
              onClick={() => applyBulkOneShare('sell')}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-1.5 py-2 text-[10px] font-black text-rose-300 transition-colors hover:bg-rose-500/20 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
            >
              全部出售一張
            </button>
          )}
          <button
            type="button"
            onClick={resetQuantities}
            className="rounded-xl border border-slate-700 bg-slate-900/70 px-1.5 py-2 text-[10px] font-black text-slate-300 transition-colors hover:bg-slate-800 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
          >
            清空張數
          </button>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        {STOCK_COLUMNS.map((columnSymbols, columnIndex) => (
          <div key={`stock-column-${columnIndex}`} className="grid gap-2 sm:gap-3">
            {columnSymbols.map(renderStockCard)}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-700/70 pt-3 sm:gap-5 sm:pt-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black tracking-wide text-slate-500 sm:text-xs">
            {mode === 'buy' ? '購買總金額' : '出售總金額'}
          </div>
          <div className="mt-1 truncate text-lg font-black text-white sm:text-2xl">
            ${totalTradeAmount.toLocaleString()}
          </div>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`shrink-0 rounded-xl px-3 py-2.5 text-xs font-black tracking-wide transition-all sm:rounded-2xl sm:px-6 sm:py-3 sm:text-[15px] sm:tracking-widest ${
            !canSubmit
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : mode === 'buy'
                ? 'bg-emerald-500 text-white hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                : 'bg-rose-500 text-white hover:bg-rose-400 hover:shadow-[0_0_20px_rgba(244,63,94,0.35)]'
          }`}
        >
          {mode === 'buy' ? '購買' : '出售'}
        </button>
      </div>
      {(cannotAffordBuy || hasOverSell) && (
        <div className="text-xs font-bold text-amber-300">
          {cannotAffordBuy
            ? '現金不足，請減少買進張數後再送出。'
            : '賣出張數超過持有數量，請修正後再送出。'}
        </div>
      )}
    </div>
  );
};

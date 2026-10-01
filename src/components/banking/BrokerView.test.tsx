import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrokerView } from './BrokerView';

describe('BrokerView', () => {
  it('rejects a stock purchase when the market price is missing', () => {
    const onTransaction = vi.fn();
    render(<BrokerView cash={100000} assets={[]} marketPrices={{}} previousMarketPrices={{}} onTransaction={onTransaction} />);

    fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);

    expect(screen.getByRole('button', { name: '購買' })).toBeDisabled();
    expect(screen.getByText('股票價格尚未同步，暫時不能交易')).toBeInTheDocument();
    expect(onTransaction).not.toHaveBeenCalled();
  });

  it('adds the custom quantity on each bulk buy click', () => {
    const onTransaction = vi.fn();
    const marketPrices = Object.fromEntries(
      ['A10', 'A20', 'A30', 'A40', 'B50', 'B60', 'B70', 'B80'].map(symbol => [symbol, 1000])
    );
    render(<BrokerView cash={100000} assets={[]} marketPrices={marketPrices} previousMarketPrices={marketPrices} onTransaction={onTransaction} />);

    const bulkInput = screen.getByRole('spinbutton', { name: '全部交易每檔張數' });
    fireEvent.change(bulkInput, { target: { value: '' } });
    expect(bulkInput).toHaveValue(null);
    fireEvent.change(bulkInput, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '全部買入 3 張' }));
    fireEvent.click(screen.getByRole('button', { name: '全部買入 3 張' }));
    fireEvent.click(screen.getByRole('button', { name: '購買' }));

    expect(onTransaction).toHaveBeenCalledWith(expect.objectContaining({
      stockList: expect.arrayContaining([
        expect.objectContaining({ symbol: 'A10', qty: 6 }),
        expect.objectContaining({ symbol: 'B80', qty: 6 })
      ])
    }));
  });

  it('caps bulk selling at each stock holding', () => {
    const onTransaction = vi.fn();
    const marketPrices = Object.fromEntries(
      ['A10', 'A20', 'A30', 'A40', 'B50', 'B60', 'B70', 'B80'].map(symbol => [symbol, 1000])
    );
    render(
      <BrokerView
        cash={0}
        assets={[{ id: 'asset-a10', name: 'A10 股票', symbol: 'A10', type: '股票', shares: 2 } as any]}
        marketPrices={marketPrices}
        previousMarketPrices={marketPrices}
        onTransaction={onTransaction}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '賣出' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: '全部交易每檔張數' }), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: '全部賣出 5 張' }));
    fireEvent.click(screen.getByRole('button', { name: '全部賣出 5 張' }));
    fireEvent.click(screen.getByRole('button', { name: '出售' }));

    expect(onTransaction).toHaveBeenCalledWith(expect.objectContaining({
      stockList: [{ symbol: 'A10', price: 1000, qty: 2 }]
    }));
  });
});

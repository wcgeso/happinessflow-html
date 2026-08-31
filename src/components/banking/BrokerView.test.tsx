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
});

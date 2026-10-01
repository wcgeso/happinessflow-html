import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WealthView } from './WealthView';

describe('WealthView fixed deposits', () => {
  it('accepts deposits only in ten-thousand-dollar units', () => {
    const onTransaction = vi.fn();

    render(
      <WealthView
        cash={25000}
        salary={100000}
        medicalInsuranceCount={0}
        assets={[]}
        initialProductType="deposit"
        allowedProductTypes={['deposit']}
        canUseBankProducts
        onTransaction={onTransaction}
      />
    );

    const amountInput = screen.getByRole('spinbutton', { name: '定存金額（萬元）' });
    fireEvent.change(amountInput, { target: { value: '1.5' } });
    expect(amountInput).toHaveValue(1);

    fireEvent.click(screen.getByRole('button', { name: '確認辦理定存' }));
    expect(onTransaction).toHaveBeenCalledWith(expect.objectContaining({
      amount: 10000,
      cashChange: -10000,
      assetChange: expect.objectContaining({
        asset: expect.objectContaining({ value: 10000, monthlyCashflow: 100 })
      })
    }));
  });
});

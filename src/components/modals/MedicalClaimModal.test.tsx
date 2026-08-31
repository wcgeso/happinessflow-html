import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MedicalClaimModal } from './MedicalClaimModal';

const formatMoney = (amount: number) => amount.toLocaleString();

describe('MedicalClaimModal', () => {
  it('shows no claimable event when the pending queue is empty', () => {
    render(
      <MedicalClaimModal
        isOpen
        claims={[]}
        formatMoney={formatMoney}
        onConfirm={() => undefined}
        onClose={() => undefined}
      />
    );

    expect(screen.getByText('目前沒有可申請的醫療事件')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '確認申請' })).toBeDisabled();
  });

  it('submits the selected pending medical event instead of using insurance count', () => {
    const onConfirm = vi.fn();
    render(
      <MedicalClaimModal
        isOpen
        claims={[{ id: 'claim-c036', sourceEventId: 'event-1', sourceCardId: 'C036', createdAt: 1 }]}
        formatMoney={formatMoney}
        onConfirm={onConfirm}
        onClose={() => undefined}
      />
    );

    expect(screen.getByText('待申請事件（1）')).toBeInTheDocument();
    expect(screen.getAllByText('50,000')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '確認申請' }));

    expect(onConfirm).toHaveBeenCalledWith('claim-c036');
  });
});

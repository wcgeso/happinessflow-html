import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BizUpgradeModal } from './BizUpgradeModal';

describe('BizUpgradeModal', () => {
  it('waits for the projected dice presentation before showing a remote result', async () => {
    vi.useFakeTimers();
    try {
      render(
        <BizUpgradeModal
          isOpen
          asset={{
            id: 'studio-1',
            name: 'N057 兼職工作室',
            cost: 5000,
            downPayment: 5000,
            cashflow: 0,
            type: '企業',
            isUpgraded: false
          }}
          onClose={vi.fn()}
          onUpgrade={vi.fn().mockResolvedValue(true)}
          onRollFirst={async () => ({ roll: 5, eligible: true, presentationDurationMs: 1000 })}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '開始擲骰子（第一骰）' }));
      await act(async () => { await Promise.resolve(); });

      expect(screen.getByText(/骰點已送出/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '擲骰子決定收入（第二骰）' })).not.toBeInTheDocument();

      await act(async () => { vi.advanceTimersByTime(999); });
      expect(screen.queryByRole('button', { name: '擲骰子決定收入（第二骰）' })).not.toBeInTheDocument();

      await act(async () => { vi.advanceTimersByTime(1); });
      expect(screen.getByRole('button', { name: '擲骰子決定收入（第二骰）' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the successful upgrade result visible until the player confirms', async () => {
    const onClose = vi.fn();
    const onUpgrade = vi.fn().mockResolvedValue(true);

    render(
      <BizUpgradeModal
        isOpen
        asset={{
          id: 'studio-1',
          name: 'N057 兼職工作室',
          cost: 5000,
          downPayment: 5000,
          cashflow: 0,
          type: '企業',
          isUpgraded: false
        }}
        onClose={onClose}
        onUpgrade={onUpgrade}
        onRollFirst={async () => ({ roll: 5, eligible: true })}
        onRollSecond={async () => ({ roll: 4 })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '開始擲骰子（第一骰）' }));
    fireEvent.click(await screen.findByRole('button', { name: '擲骰子決定收入（第二骰）' }));

    expect(await screen.findByText('升級成功！')).toBeInTheDocument();
    expect(screen.getByText('已升級為小型企業')).toBeInTheDocument();
    expect(screen.getByText('+40,000／月')).toBeInTheDocument();
    expect(screen.getByText('本金與利息已取消')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '太棒了！' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onUpgrade).toHaveBeenCalledWith(4);
  });
});

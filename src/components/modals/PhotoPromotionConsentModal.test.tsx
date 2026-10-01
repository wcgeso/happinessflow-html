import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoPromotionConsentModal } from './PhotoPromotionConsentModal';

describe('PhotoPromotionConsentModal', () => {
  it('requires one choice and submits decline without blocking participation', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PhotoPromotionConsentModal isOpen required onSubmit={onSubmit} />);

    expect(screen.queryByRole('button', { name: '關閉同意書' })).toBeNull();
    expect(screen.getByRole('button', { name: '確認選擇' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /不同意/ }));
    fireEvent.click(screen.getByRole('button', { name: '確認選擇' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('declined'));
  });

  it('keeps the modal open and reports a failed write', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('offline'));
    render(<PhotoPromotionConsentModal isOpen required onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('radio', { name: /^同意/ }));
    fireEvent.click(screen.getByRole('button', { name: '確認選擇' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('同意選擇尚未儲存');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('allows an existing choice to be changed from the profile', () => {
    const onClose = vi.fn();
    render(
      <PhotoPromotionConsentModal
        isOpen
        initialChoice="agreed"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('radio', { name: /^同意/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '關閉同意書' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

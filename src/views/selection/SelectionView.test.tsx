import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectionView } from './SelectionView';

describe('SelectionView', () => {
    it('keeps the current step and selected choice when an older cloud snapshot arrives', () => {
        const props = {
            sessionMeta: { playerName: '測試玩家', reportName: '測試' },
            initialStep: 'profession' as const,
            onComplete: vi.fn(),
            onBackToLobby: vi.fn(),
            onSelectionChange: vi.fn(),
        };
        const { rerender } = render(<SelectionView {...props} initialSelections={{ professionId: 'nest_builder' }} />);

        fireEvent.click(screen.getByRole('button', { name: '選擇店員系列' }));
        expect(screen.getByRole('button', { name: '選擇店員系列' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: '確認選擇並前往：選擇企業' }));
        expect(screen.getByText('選擇企業')).toBeInTheDocument();

        rerender(<SelectionView {...props} initialStep="profession" initialSelections={{ professionId: 'accountant' }} />);

        expect(screen.getByText('選擇企業')).toBeInTheDocument();
    });
});

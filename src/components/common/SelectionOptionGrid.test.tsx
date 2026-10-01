import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectionOptionGrid } from './SelectionOptionGrid';

describe('SelectionOptionGrid', () => {
    it('changes the selection only after an explicit card click', () => {
        const onSelect = vi.fn();
        const onNext = vi.fn();

        render(
            <SelectionOptionGrid
                title="選擇企業"
                subtitle="請選擇心儀的企業"
                btnLabel="確認並前往下一步"
                items={[{ id: 'C01', name: '企業一' }, { id: 'C02', name: '企業二' }]}
                selectedId="C01"
                onSelect={onSelect}
                onNext={onNext}
                sessionMeta={{ playerName: '測試玩家' }}
                renderItem={item => <span>{item.name}</span>}
            />
        );

        fireEvent.scroll(screen.getByRole('main'));
        expect(onSelect).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: '選擇企業二' }));
        expect(onSelect).toHaveBeenCalledWith('C02');
        expect(onNext).not.toHaveBeenCalled();
    });
});

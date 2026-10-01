import { renderToStaticMarkup } from 'react-dom/server';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiceFace } from './DiceFace';

describe('DiceFace', () => {
  it('places all six pips at explicit grid coordinates', () => {
    const markup = renderToStaticMarkup(<DiceFace value={6} rolling={false} />);

    expect(markup.match(/grid-column-start:/g)).toHaveLength(6);
    expect(markup).toContain('grid-column-start:3;grid-row-start:3');
  });

  it('cycles random faces while rolling and restores the authoritative value after rolling', () => {
    vi.useFakeTimers();
      const random = vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999);
    try {
      const { rerender } = render(<DiceFace value={6} rolling />);

      expect(screen.getByRole('img')).toHaveAccessibleName('骰子滾動中');
      expect(screen.getByRole('img')).toHaveAttribute('data-die-value', '1');

      act(() => { vi.advanceTimersByTime(90); });
      expect(screen.getByRole('img')).toHaveAttribute('data-die-value', '6');

      rerender(<DiceFace value={6} rolling={false} />);
      expect(screen.getByRole('img')).toHaveAccessibleName('骰子 6 點');
      expect(screen.getByRole('img')).toHaveAttribute('data-die-value', '6');
    } finally {
      random.mockRestore();
      vi.useRealTimers();
    }
  });
});

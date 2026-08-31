import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardCardDrawer } from './BoardCardDrawer';

describe('BoardCardDrawer reveal animation', () => {
  it('reports completion only after the flip transform finishes', () => {
    const onComplete = vi.fn();
    const { container } = render(
      <BoardCardDrawer
        card={{ deck: 'news', cardId: 'N001', title: '股市更新', description: '' }}
        isOpen
        isRevealed
        onReveal={() => undefined}
        onRevealAnimationComplete={onComplete}
        onClose={() => undefined}
      />
    );
    const rotatingCard = container.querySelector<HTMLElement>('[style*="preserve-3d"]');
    expect(rotatingCard).not.toBeNull();

    fireEvent.transitionEnd(rotatingCard!, { propertyName: 'opacity' });
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.transitionEnd(rotatingCard!, { propertyName: 'transform' });
    expect(onComplete).toHaveBeenCalledOnce();
  });
});

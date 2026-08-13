import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerModalFrame } from './PlayerModalFrame';

describe('PlayerModalFrame', () => {
  it('keeps dialog layout inside the mobile viewport', () => {
    render(
      <PlayerModalFrame title="測試彈窗" layout="dialog">
        內容
      </PlayerModalFrame>
    );

    expect(screen.getByRole('dialog')).toHaveClass('max-h-[calc(100dvh-1.5rem)]', 'rounded-[24px]');
  });
});

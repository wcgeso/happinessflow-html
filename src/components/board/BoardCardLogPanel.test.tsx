import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardCardLogPanel } from './BoardCardLogPanel';
import type { BoardCardLogEntry } from '../../types';

const entries: BoardCardLogEntry[] = Array.from({ length: 5 }, (_, index) => ({
  id: `log-${index}`,
  eventId: `event-${index}`,
  playerUid: `player-${index}`,
  playerName: `玩家${index + 1}`,
  deck: index % 2 === 0 ? 'happiness' : 'news',
  cardId: `C00${index + 1}`,
  title: `卡片${index + 1}`,
  description: `完整敘述${index + 1}`,
  effectLines: [`結果${index + 1}`],
  drawnAt: index,
}));

describe('BoardCardLogPanel projection variant', () => {
  it('shows three summaries by default and expands to the latest twelve entries', () => {
    render(<BoardCardLogPanel entries={entries} variant="projection" />);

    expect(screen.getByText('卡片1')).toBeInTheDocument();
    expect(screen.getByText('卡片3')).toBeInTheDocument();
    expect(screen.queryByText('卡片4')).not.toBeInTheDocument();
    expect(screen.queryByText('完整敘述1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看完整紀錄（5）' }));

    expect(screen.getByText('卡片5')).toBeInTheDocument();
    expect(screen.getByText('完整敘述1')).toBeInTheDocument();
  });

  it('matches the projection summary toggle in the inline card-log tab', () => {
    render(<BoardCardLogPanel entries={entries} variant="inline" />);

    expect(screen.getByText('卡片1')).toBeInTheDocument();
    expect(screen.getByText('卡片3')).toBeInTheDocument();
    expect(screen.queryByText('卡片4')).not.toBeInTheDocument();
    expect(screen.queryByText('完整敘述1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看完整紀錄（5）' }));

    expect(screen.getByText('卡片5')).toBeInTheDocument();
    expect(screen.getByText('完整敘述1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起摘要' })).toBeInTheDocument();
  });

  it('keeps the default player-facing presentation unchanged', () => {
    render(<BoardCardLogPanel entries={entries.slice(0, 1)} />);

    expect(screen.getByText('完整敘述1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /查看完整紀錄/ })).not.toBeInTheDocument();
  });
});

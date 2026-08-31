import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameActions } from './GameActions';

const createProps = (overrides: Partial<React.ComponentProps<typeof GameActions>> = {}) => ({
  onRollBoardDice: vi.fn().mockResolvedValue({ total: 7, dice: [2, 5], position: 4 }),
  onRollAnimationComplete: vi.fn(),
  onShowMedical: vi.fn(),
  onShowTransaction: vi.fn(),
  onShowPayday: vi.fn(),
  onShowSettlement: vi.fn(),
  onShowTargetDream: vi.fn(),
  canRoll: true,
  isBoardTurn: true,
  ...overrides
});

const getRollButton = () => screen.getByRole('button', { name: /^擲骰子/ });

describe('GameActions board dice animation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders two independent dice and fixes the authoritative faces at landing', async () => {
    const props = createProps({ hasCar: true });
    render(<GameActions {...props} />);

    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
    });

    expect(props.onRollBoardDice).toHaveBeenCalledWith(2);
    expect(screen.getAllByTestId('board-die')).toHaveLength(2);
    expect(screen.getAllByTestId('board-die').map(die => die.getAttribute('data-die-value'))).toEqual(['5', '5']);

    await act(async () => {
      vi.advanceTimersByTime(849);
    });
    expect(screen.getAllByTestId('board-die').map(die => die.getAttribute('data-die-value'))).toEqual(['5', '5']);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getAllByTestId('board-die').map(die => die.getAttribute('data-die-value'))).toEqual(['2', '5']);
  });

  it('keeps a single die when the player has no car', async () => {
    const props = createProps({ hasCar: false });
    render(<GameActions {...props} />);

    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
    });

    expect(props.onRollBoardDice).toHaveBeenCalledWith(1);
    expect(screen.getAllByTestId('board-die')).toHaveLength(1);
  });

  it('disables duplicate end-turn submissions while syncing', () => {
    render(<GameActions {...createProps({ onEndTurn: vi.fn(), hasRolledBoardDice: true, canEndTurn: true, isEndingTurn: true })} />);
    expect(screen.getByRole('button', { name: '結束回合' })).toBeDisabled();
    expect(screen.getByText('提交中')).toBeInTheDocument();
  });

  it('calls the animation completion callback once after 3500ms', async () => {
    const props = createProps({ hasCar: true });
    render(<GameActions {...props} />);

    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(3499);
    });
    expect(props.onRollAnimationComplete).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(props.onRollAnimationComplete).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3500);
    });
    expect(props.onRollAnimationComplete).toHaveBeenCalledTimes(1);
  });

  it('restores the roll control after the authoritative roll fails', async () => {
    const onRollBoardDice = vi.fn().mockRejectedValue(new Error('roll failed'));
    const props = createProps({ onRollBoardDice });
    render(<GameActions {...props} />);

    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
    });

    expect(onRollBoardDice).toHaveBeenCalledTimes(2);
  });
});

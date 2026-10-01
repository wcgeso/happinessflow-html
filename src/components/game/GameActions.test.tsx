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

describe('GameActions board dice control', () => {
  it('disables the native roll button when cloud or controller qualification blocks the action', () => {
    const props=createProps({canRoll:false});
    const {rerender}=render(<GameActions {...props}/>);
    expect(getRollButton()).toBeDisabled();fireEvent.click(getRollButton());
    expect(props.onRollBoardDice).not.toHaveBeenCalled();
    rerender(<GameActions {...props} canRoll/>);expect(getRollButton()).toBeEnabled();
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the player control static while the projection owns the result', async () => {
    const props = createProps({ hasCar: true });
    render(<GameActions {...props} />);

    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
    });

    expect(props.onRollBoardDice).toHaveBeenCalledWith(2);
    expect(screen.getAllByTestId('board-die')).toHaveLength(1);
    expect(screen.getByText('x2')).toBeInTheDocument();
    expect(screen.getAllByTestId('board-die').map(die => die.getAttribute('data-die-value'))).toEqual(['5']);
    expect(props.onRollAnimationComplete).toHaveBeenCalledWith({ total: 7, dice: [2, 5], position: 4 });
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

  it('uses two dice immediately after a car appears in the authoritative state', async () => {
    const props = createProps({ hasCar: false });
    const { rerender } = render(<GameActions {...props} />);
    rerender(<GameActions {...props} hasCar />);

    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
    });

    expect(props.onRollBoardDice).toHaveBeenCalledWith(2);
  });

  it('disables duplicate end-turn submissions while syncing', () => {
    render(<GameActions {...createProps({ onEndTurn: vi.fn(), hasRolledBoardDice: true, canEndTurn: true, isEndingTurn: true })} />);
    expect(screen.getByRole('button', { name: '結束回合' })).toBeDisabled();
    expect(screen.getByText('提交中')).toBeInTheDocument();
  });

  it('shows end turn while the local dice presentation is still running', () => {
    const props = createProps({
      onEndTurn: vi.fn(),
      hasRolledBoardDice: true,
      isRollingBoardDice: true,
      canEndTurn: false,
    });
    render(<GameActions {...props} />);

    expect(screen.getByRole('button', { name: '結束回合' })).toBeDisabled();
  });

  it('notifies the game immediately after the authoritative roll returns', async () => {
    const props = createProps({ hasCar: true });
    render(<GameActions {...props} />);

    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
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

  it('restores the roll control when the turn leaves and returns to the player', async () => {
    const props = createProps();
    const { rerender } = render(<GameActions {...props} />);

    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
    });

    rerender(<GameActions {...props} isBoardTurn={false} canRoll={false} />);
    rerender(<GameActions {...props} isBoardTurn canRoll />);

    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
    });

    expect(props.onRollBoardDice).toHaveBeenCalledTimes(2);
  });

  it('restores the roll control when skipped players return the turn to the same player', async () => {
    const props = createProps();
    const { rerender } = render(<GameActions {...props} />);

    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
    });

    rerender(<GameActions {...props} hasRolledBoardDice canRoll={false} />);
    rerender(<GameActions {...props} hasRolledBoardDice={false} canRoll />);

    await act(async () => {
      fireEvent.click(getRollButton());
      await Promise.resolve();
    });

    expect(props.onRollBoardDice).toHaveBeenCalledTimes(2);
  });
});

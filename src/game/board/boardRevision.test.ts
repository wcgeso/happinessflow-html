import { describe, expect, it } from 'vitest';
import { applyBoardCommand, mergeBoardMarketPrices, requireBoardRevision, requireCurrentBoardEvent } from './boardRevision';

describe('board revision', () => {
    it('initializes a legacy board at revision one', () => {
        expect(applyBoardCommand({}, 'command-1')).toEqual({
            duplicate: false,
            boardState: { revision: 1, processedCommandIds: ['command-1'] }
        });
    });

    it('does not advance revision for a repeated command', () => {
        expect(applyBoardCommand({ revision: 3, processedCommandIds: ['command-1'] }, 'command-1')).toEqual({
            duplicate: true,
            boardState: { revision: 3, processedCommandIds: ['command-1'] }
        });
    });

    it('keeps only the newest one hundred command ids', () => {
        const ids = Array.from({ length: 100 }, (_, index) => `command-${index}`);
        const result = applyBoardCommand({ revision: 8, processedCommandIds: ids }, 'command-100');

        expect(result.duplicate).toBe(false);
        expect(result.boardState.revision).toBe(9);
        expect(result.boardState.processedCommandIds).toHaveLength(100);
        expect(result.boardState.processedCommandIds[0]).toBe('command-1');
        expect(result.boardState.processedCommandIds.at(-1)).toBe('command-100');
    });

    it('rejects stale events and cards before a mutation is applied', () => {
        const board = { currentEvent: { id: 'event-2' }, currentCard: { cardId: 'card-2' } };

        expect(() => requireCurrentBoardEvent(board, 'event-1')).toThrow('棋盤事件已更新');
        expect(() => requireCurrentBoardEvent(board, 'event-2', 'card-1')).toThrow('棋盤卡片已更新');
        expect(() => requireCurrentBoardEvent(board, 'event-2', 'card-2')).not.toThrow();
    });

    it('merges market updates into the latest transaction snapshot', () => {
        expect(mergeBoardMarketPrices({ AAA: 10, BBB: 20 }, { AAA: 15 })).toEqual({ AAA: 15, BBB: 20 });
    });

    it('rejects a command based on a stale board revision', () => {
        expect(() => requireBoardRevision({ revision: 4 }, 3)).toThrow('棋盤狀態已更新');
        expect(() => requireBoardRevision({}, 0)).not.toThrow();
    });
});

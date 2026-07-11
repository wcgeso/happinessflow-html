import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runRoomBoardMutation } from '../game/board/runBoardMutation';

const firestore = vi.hoisted(() => ({
    doc: vi.fn(() => 'room-ref'),
    runTransaction: vi.fn()
}));

vi.mock('firebase/firestore', () => firestore);

const baseBoard = {
    revision: 2,
    processedCommandIds: [] as string[],
    currentTurnUid: 'player-a',
    turnOrder: ['player-a', 'player-b'],
    playerPositions: { 'player-a': 0, 'player-b': 1 },
    skipTurns: {},
    lastRoll: null,
    currentCard: null,
    currentEvent: null,
    pendingEvents: [],
    movement: null,
    deckState: { happiness: [], opportunity: [], news: [] },
    updatedAt: 1
} as any;

describe('Room board transaction boundary', () => {
    const update = vi.fn();
    const get = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        firestore.runTransaction.mockImplementation(async (_db, callback) => callback({ get, update }));
    });

    it('reads the latest Room and commits one revision', async () => {
        const latestRoom = {
            isBoardGame: true,
            boardState: baseBoard,
            playerStates: { 'player-a': { cash: 999 }, 'player-b': { cash: 200, newer: true } },
            marketPrices: { AAA: 10, BBB: 20 }
        };
        get.mockResolvedValue({ exists: () => true, data: () => latestRoom });

        await runRoomBoardMutation<string, typeof latestRoom>({
            db: {} as any, roomId: 'room-1', commandId: 'command-1', expectedRevision: 2,
            onDuplicate: () => 'duplicate',
            mutate: room => ({
                boardState: room.boardState!,
                roomPatch: {
                    playerStates: { ...room.playerStates, 'player-a': { ...room.playerStates['player-a'], cash: 500 } },
                    marketPrices: { ...room.marketPrices, AAA: 15 }
                },
                result: 'applied'
            })
        });

        expect(get).toHaveBeenCalledWith('room-ref');
        expect(update).toHaveBeenCalledWith('room-ref', expect.objectContaining({
            boardState: expect.objectContaining({ revision: 3, processedCommandIds: ['command-1'] }),
            playerStates: {
                'player-a': { cash: 500 },
                'player-b': { cash: 200, newer: true }
            },
            marketPrices: { AAA: 15, BBB: 20 }
        }));
    });

    it('returns duplicate success without updating', async () => {
        const duplicateBoard = {
            ...baseBoard,
            processedCommandIds: ['command-1'],
            playerPositions: { ...baseBoard.playerPositions, 'player-a': 7 },
            lastRoll: { uid: 'player-a', dice: [4], total: 4, timestamp: 10, detail: '經過銀行' }
        };
        get.mockResolvedValue({ exists: () => true, data: () => ({ isBoardGame: true, boardState: duplicateBoard }) });
        const mutate = vi.fn();

        const result = await runRoomBoardMutation({
            db: {} as any, roomId: 'room-1', commandId: 'command-1', expectedRevision: 1,
            onDuplicate: room => ({
                position: room.boardState!.playerPositions['player-a'],
                total: room.boardState!.lastRoll!.total,
                detail: room.boardState!.lastRoll!.detail
            }), mutate
        });

        expect(result).toEqual({ position: 7, total: 4, detail: '經過銀行' });
        expect(mutate).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('rejects a stale expected revision before mutation', async () => {
        get.mockResolvedValue({ exists: () => true, data: () => ({ isBoardGame: true, boardState: baseBoard }) });
        const mutate = vi.fn();

        await expect(runRoomBoardMutation({
            db: {} as any, roomId: 'room-1', commandId: 'command-2', expectedRevision: 1,
            onDuplicate: () => undefined, mutate
        })).rejects.toThrow('棋盤狀態已更新');

        expect(mutate).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });
});

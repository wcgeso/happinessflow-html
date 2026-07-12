import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
    doc: vi.fn(),
    increment: vi.fn(),
    runTransaction: vi.fn(),
    serverTimestamp: vi.fn()
}));

vi.mock('firebase/firestore', () => firestore);
vi.mock('../../../services/firebase', () => ({ db: {} }));

import { settleGame } from './settleGame';

const input = {
    roomId: 'room-1',
    settlementId: 'session-1',
    coachUid: 'coach-1',
    players: [{ uid: 'player-1', totalScore: 120 }]
};

const snapshot = (exists: boolean, data: Record<string, unknown> = {}) => ({
    exists: () => exists,
    data: () => data
});

describe('settleGame', () => {
    const transaction = {
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        firestore.doc.mockImplementation((_db: unknown, ...path: string[]) => path.join('/'));
        firestore.increment.mockImplementation((value: number) => ({ increment: value }));
        firestore.serverTimestamp.mockReturnValue('server-time');
        firestore.runTransaction.mockImplementation(async (_db: unknown, callback: (tx: typeof transaction) => unknown) => callback(transaction));
        transaction.get.mockImplementation(async (ref: string) => snapshot(true, ref.startsWith('users/') ? {} : {}));
    });

    it('applies each player score and writes the record marker once', async () => {
        await expect(settleGame(input)).resolves.toBe('applied');

        expect(transaction.update).toHaveBeenCalledWith('users/player-1', {
            experience: { increment: 120 },
            rankScore: { increment: 120 }
        });
        expect(transaction.set).toHaveBeenCalledWith(
            'score_records/S1/records/session-1',
            { scoreAppliedAt: 'server-time', scoreAppliedBy: 'coach-1' },
            { merge: true }
        );
    });

    it('does not apply scores again when the settlement marker exists', async () => {
        transaction.get.mockImplementation(async (ref: string) => snapshot(true, ref.startsWith('score_records/') ? { scoreAppliedAt: 'already-applied' } : {}));

        await expect(settleGame(input)).resolves.toBe('already_applied');

        expect(transaction.update).not.toHaveBeenCalled();
        expect(transaction.set).not.toHaveBeenCalled();
    });

    it('does not write the marker when a player record is missing', async () => {
        transaction.get.mockImplementation(async (ref: string) => snapshot(!ref.startsWith('users/'), {}));

        await expect(settleGame(input)).rejects.toThrow('玩家資料不存在');

        expect(transaction.update).not.toHaveBeenCalled();
        expect(transaction.set).not.toHaveBeenCalled();
    });
});

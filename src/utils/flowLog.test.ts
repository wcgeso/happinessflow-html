import { afterEach, describe, expect, it, vi } from 'vitest';
import { flowLog } from './flowLog';

describe('flowLog', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    afterEach(() => {
        info.mockClear();
    });

    it('writes the permitted event fields in one stable payload', () => {
        flowLog({
            name: 'board.roll.requested',
            roomId: 'room-1',
            sessionId: 'session-1',
            eventId: 'event-1',
            phase: 'waiting_for_roll',
            result: 'requested',
            timestamp: 1_700_000_000_000
        });

        expect(info).toHaveBeenCalledExactlyOnceWith('[HappinessFlow]', {
            name: 'board.roll.requested',
            roomId: 'room-1',
            sessionId: 'session-1',
            eventId: 'event-1',
            phase: 'waiting_for_roll',
            result: 'requested',
            timestamp: 1_700_000_000_000
        });
    });

    it('drops private fields supplied by a caller', () => {
        flowLog({
            name: 'board.movement.settled',
            roomId: 'room-1',
            sessionId: 'session-1',
            result: 'applied',
            timestamp: 1_700_000_000_001,
            cash: 200_000,
            email: 'player@example.com',
            assets: [{ name: 'house' }],
            privateDecision: { option: 'buy' }
        } as never);

        const payload = info.mock.calls[0][1] as Record<string, unknown>;
        expect(payload).not.toHaveProperty('cash');
        expect(payload).not.toHaveProperty('email');
        expect(payload).not.toHaveProperty('assets');
        expect(payload).not.toHaveProperty('privateDecision');
    });

    it('keeps only a stable error code for failures', () => {
        flowLog({
            name: 'board.event.advance',
            roomId: 'room-1',
            sessionId: 'session-1',
            result: 'failed',
            errorCode: 'permission-denied',
            timestamp: 1_700_000_000_002
        });

        expect(info).toHaveBeenCalledExactlyOnceWith('[HappinessFlow]', {
            name: 'board.event.advance',
            roomId: 'room-1',
            sessionId: 'session-1',
            result: 'failed',
            errorCode: 'permission-denied',
            timestamp: 1_700_000_000_002
        });
    });
});

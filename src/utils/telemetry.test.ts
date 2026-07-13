import { describe, expect, it } from 'vitest';
import { normalizeTelemetryEventName, normalizeTelemetryParams } from './telemetry';

describe('telemetry normalization', () => {
    it('creates Analytics-safe event names', () => {
        expect(normalizeTelemetryEventName('board.roll.requested')).toBe('hf_board_roll_requested');
        expect(normalizeTelemetryEventName('')).toBe('hf_event');
    });

    it('keeps only scalar, bounded parameters', () => {
        expect(normalizeTelemetryParams({
            result: 'committed',
            retry: true,
            revision: 3,
            privateData: { cash: 100 },
            longText: 'x'.repeat(120)
        })).toEqual({
            result: 'committed',
            retry: true,
            revision: 3,
            longText: 'x'.repeat(100)
        });
    });
});

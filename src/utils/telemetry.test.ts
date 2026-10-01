import { describe, expect, it, vi } from 'vitest';
import * as analytics from 'firebase/analytics';
vi.mock('firebase/analytics',()=>({isSupported:vi.fn(async()=>false),getAnalytics:vi.fn(),logEvent:vi.fn()}));
import { normalizeTelemetryEventName, normalizeTelemetryParams, trackGameEvent } from './telemetry';

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

    it('keeps emulator diagnostics without loading production Analytics',async()=>{
        vi.stubEnv('DEV',true);vi.stubEnv('VITE_USE_EMULATOR','true');
        const supported=vi.mocked(analytics.isSupported).mockClear().mockResolvedValue(true);
        try{
            window.__hfTelemetry?.clear();
            await trackGameEvent('board_timeline',{command_id:'emulator-command'});
            expect(supported).not.toHaveBeenCalled();
            expect(window.__hfTelemetry?.drain()[0].params.command_id).toBe('emulator-command');
        }finally{supported.mockResolvedValue(false);vi.unstubAllEnvs();}
    });

    it('preserves full command identifiers in diagnostics while keeping Analytics bounded',async()=>{
        const commandId='payment:'+ 'x'.repeat(250);
        window.__hfTelemetry?.clear();
        await trackGameEvent('board_timeline',{command_id:commandId});
        expect(window.__hfTelemetry?.drain()[0].params.command_id).toBe(commandId);
        expect(normalizeTelemetryParams({command_id:commandId}).command_id).toHaveLength(100);
    });

    it('keeps a bounded debug trace buffer without adding a database write', async () => {
        window.__hfTelemetry?.clear();
        await trackGameEvent('board.listener.received', { trace_id: 'room:3:100', revision: 3 });
        expect(window.__hfTelemetry?.drain()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                event: 'hf_board_listener_received',
                params: { trace_id: 'room:3:100', revision: 3 }
            })
        ]));
    });
});

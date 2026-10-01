import { getAnalytics, isSupported, logEvent, type Analytics } from 'firebase/analytics';
import { app } from '../../services/firebase';
import type { BoardState } from '../types';
import { APP_VERSION } from '../constants/version';
import { clockMetadata, serverNow } from './serverClock';

const TELEMETRY_EVENT_MAX_LENGTH = 40;
const TELEMETRY_PARAM_MAX_LENGTH = 100;
const TELEMETRY_DEBUG_BUFFER_LIMIT = 500;

export interface DebugTelemetryRecord {
    event: string;
    params: Record<string, string | number | boolean>;
    timestamp: number;
    monotonicMs: number;
}

declare global {
    interface Window {
        __hfTelemetry?: {
            drain: () => DebugTelemetryRecord[];
            clear: () => void;
        };
    }
}

let analyticsPromise: Promise<Analytics | null> | null = null;
const debugTelemetryBuffer: DebugTelemetryRecord[] = [];
const telemetrySubscribers=new Set<(record:DebugTelemetryRecord)=>void>();
export const subscribeTelemetry=(fn:(record:DebugTelemetryRecord)=>void)=>{telemetrySubscribers.add(fn);return()=>{telemetrySubscribers.delete(fn);};};
export const recentBoardTelemetry=(roomId:string)=>debugTelemetryBuffer.filter(record=>record.event==='hf_board_timeline'&&record.params.room_id===roomId).slice(-20);

const isDebugTelemetryEnabled = () => (
    typeof window !== 'undefined'
    && (import.meta.env.DEV || import.meta.env.VITE_TELEMETRY_DEBUG === 'true')
);

const recordDebugTelemetry = (
    event: string,
    params: Record<string, string | number | boolean>
) => {
    if (!isDebugTelemetryEnabled() && event !== 'hf_board_timeline') return;
    debugTelemetryBuffer.push({
        event,
        params,
        timestamp: Date.now(),
        monotonicMs: typeof performance !== 'undefined' ? performance.now() : Date.now()
    });
    telemetrySubscribers.forEach(fn=>fn(debugTelemetryBuffer[debugTelemetryBuffer.length-1]));
    if (debugTelemetryBuffer.length > TELEMETRY_DEBUG_BUFFER_LIMIT) {
        debugTelemetryBuffer.splice(0, debugTelemetryBuffer.length - TELEMETRY_DEBUG_BUFFER_LIMIT);
    }
};

if (typeof window !== 'undefined') {
    window.__hfTelemetry = {
        drain: () => debugTelemetryBuffer.splice(0, debugTelemetryBuffer.length),
        clear: () => { debugTelemetryBuffer.length = 0; }
    };
}

export const normalizeTelemetryEventName = (name: string): string => {
    const normalized = name
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^\d+/, '')
        .slice(0, TELEMETRY_EVENT_MAX_LENGTH);

    return `hf_${normalized || 'event'}`.slice(0, TELEMETRY_EVENT_MAX_LENGTH);
};

export const normalizeTelemetryParams = (
    params: Record<string, unknown>,valueMaxLength=TELEMETRY_PARAM_MAX_LENGTH
): Record<string, string | number | boolean> => {
    const normalized: Record<string, string | number | boolean> = {};
    Object.entries(params).forEach(([key, value]) => {
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return;
        const normalizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, TELEMETRY_PARAM_MAX_LENGTH);
        if (!normalizedKey) return;
        normalized[normalizedKey] = typeof value === 'string'
            ? value.slice(0, valueMaxLength)
            : value;
    });
    return normalized;
};

const getAnalyticsIfSupported = (): Promise<Analytics | null> => {
    if (typeof window === 'undefined' || (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true')) return Promise.resolve(null);
    if (!analyticsPromise) {
        analyticsPromise = isSupported()
            .then(supported => supported ? getAnalytics(app) : null)
            .catch(() => null);
    }
    return analyticsPromise;
};

export const trackGameEvent = async (
    name: string,
    params: Record<string, unknown> = {}
): Promise<void> => {
    const normalizedName = normalizeTelemetryEventName(name);
    const normalizedParams = normalizeTelemetryParams(params);
    // Analytics has a 100-character limit; diagnostics need the complete operation identifier.
    recordDebugTelemetry(normalizedName, normalizeTelemetryParams(params,1500));
    const analytics = await getAnalyticsIfSupported();
    if (!analytics) return;

    logEvent(analytics, normalizedName, normalizedParams);
};

export const trackBoardStage = (stage: string, roomId: string, board?: BoardState | null, details: Record<string, unknown> = {}) => {
    void trackGameEvent('board_timeline', {
        stage, room_id: roomId, event_id: board?.currentEvent?.id || board?.diceEvents?.at(-1)?.id || '',
        turn_id: `${board?.currentTurnUid || ''}:${board?.lastRoll?.timestamp || 0}`,
        command_id: board?.processedCommandIds?.at(-1) || '', revision: board?.revision || 0,
        client_time_ms: Math.round(serverNow()), monotonic_ms: Math.round(performance.now()),
        visibility: typeof document === 'undefined' ? 'unknown' : document.visibilityState,
        app_version: APP_VERSION, ...clockMetadata(), ...details,
    }).catch(() => undefined);
};

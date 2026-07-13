import { getAnalytics, isSupported, logEvent, type Analytics } from 'firebase/analytics';
import { app } from '../../services/firebase';

const TELEMETRY_EVENT_MAX_LENGTH = 40;
const TELEMETRY_PARAM_MAX_LENGTH = 100;

let analyticsPromise: Promise<Analytics | null> | null = null;

export const normalizeTelemetryEventName = (name: string): string => {
    const normalized = name
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^\d+/, '')
        .slice(0, TELEMETRY_EVENT_MAX_LENGTH);

    return `hf_${normalized || 'event'}`.slice(0, TELEMETRY_EVENT_MAX_LENGTH);
};

export const normalizeTelemetryParams = (
    params: Record<string, unknown>
): Record<string, string | number | boolean> => {
    const normalized: Record<string, string | number | boolean> = {};
    Object.entries(params).forEach(([key, value]) => {
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return;
        const normalizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, TELEMETRY_PARAM_MAX_LENGTH);
        if (!normalizedKey) return;
        normalized[normalizedKey] = typeof value === 'string'
            ? value.slice(0, TELEMETRY_PARAM_MAX_LENGTH)
            : value;
    });
    return normalized;
};

const getAnalyticsIfSupported = (): Promise<Analytics | null> => {
    if (typeof window === 'undefined') return Promise.resolve(null);
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
    const analytics = await getAnalyticsIfSupported();
    if (!analytics) return;

    logEvent(analytics, normalizeTelemetryEventName(name), normalizeTelemetryParams(params));
};

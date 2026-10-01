import { onValue, ref } from 'firebase/database';
import { realtimeDb } from '../../services/realtime';

let sample: { serverMs: number; monotonicMs: number; offsetMs: number } | null = null;
let subscribers = 0;
let unsubscribe: (() => void) | undefined;

// Firebase's offset calibrates the wall clock. Do not extrapolate deadlines
// indefinitely with performance.now(): its clock can drift relative to request.time.
// Elapsed diagnostics still use performance.now() independently.
export const serverNow = () => Math.round(Date.now() + (sample?.offsetMs || 0));
export const clockMetadata = () => ({
    clock_basis: sample ? 'server_offset_estimate' : 'uncalibrated',
    clock_error_ms: -1,
    clock_offset_ms: sample?.offsetMs || 0,
    clock_sample_age_ms: sample ? Math.round(performance.now()-sample.monotonicMs) : -1,
    clock_wall_drift_ms: sample ? Math.round(sample.serverMs+performance.now()-sample.monotonicMs-(Date.now()+sample.offsetMs)) : 0,
});
const refreshClockAnchor = () => {
    if(document.visibilityState==='hidden' || !sample)return;
    sample={...sample,serverMs:Date.now()+sample.offsetMs,monotonicMs:performance.now()};
    window.dispatchEvent(new Event('hf-clock-sync'));
};
export const subscribeServerClock = () => {
    if (subscribers++ === 0) {
        window.addEventListener('online',refreshClockAnchor);
        document.addEventListener('visibilitychange',refreshClockAnchor);
        unsubscribe = onValue(ref(realtimeDb, '.info/serverTimeOffset'), snapshot => {
            const offsetMs = snapshot.val();
            if (typeof offsetMs !== 'number' || !Number.isFinite(offsetMs)) return;
            sample = { serverMs: Date.now() + offsetMs, monotonicMs: performance.now(), offsetMs };
            window.dispatchEvent(new Event('hf-clock-sync'));
        }, () => { sample = null; });
    }
    return () => { if (--subscribers === 0) { unsubscribe?.(); unsubscribe = undefined; sample = null; window.removeEventListener('online',refreshClockAnchor); document.removeEventListener('visibilitychange',refreshClockAnchor); } };
};

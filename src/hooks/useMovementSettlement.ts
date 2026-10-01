import { useEffect, useRef, useState } from 'react';
import type { BoardMovementState } from '../types';
import { settlementDueAt } from '../game/board/movementSettlement';
import { serverNow } from '../utils/serverClock';

export function useMovementSettlement({ scope, movement, actorUid, hostUid, enabled, settle }: {
    scope: string; movement?: BoardMovementState | null; actorUid: string; hostUid: string;
    enabled: boolean; settle: () => Promise<void>;
}) {
    const callback = useRef(settle);
    callback.current = settle;
    const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null);
    const [busyScope, setBusyScope] = useState<string | null>(null);
    const inFlight = useRef<string | null>(null);
    const run = async () => {
        if (!enabled || !movement?.isActive || inFlight.current === scope) return;
        inFlight.current = scope;
        setBusyScope(scope);
        try {
            await callback.current();
            setFailure(current => current?.scope === scope ? null : current);
        } catch (error) {
            const detail = error as { code?: string; message?: string };
            setFailure({ scope, message: `移動結算未完成：${detail.code || detail.message || '未知錯誤'}` });
        } finally {
            if (inFlight.current === scope) inFlight.current = null;
            setBusyScope(current => current === scope ? null : current);
        }
    };
    const runRef = useRef(run);
    runRef.current = run;
    useEffect(() => {
        if (!enabled || !movement?.isActive) return;
        let timer: number;
        const schedule = () => {
            window.clearTimeout(timer);
            if (navigator.onLine === false) return;
            timer = window.setTimeout(() => void runRef.current(), Math.max(0,
                // The RTDB offset is an estimate; avoid submitting on the strict Rules boundary.
                settlementDueAt(movement, actorUid, hostUid) + 250 - serverNow()));
        };
        const resume = () => { if (document.visibilityState === 'visible') schedule(); };
        schedule();
        window.addEventListener('online', schedule);
        window.addEventListener('hf-clock-sync', schedule);
        document.addEventListener('visibilitychange', resume);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('online', schedule);
            window.removeEventListener('hf-clock-sync', schedule);
            document.removeEventListener('visibilitychange', resume);
        };
    }, [scope, enabled, actorUid, hostUid]);
    return { error: failure?.scope === scope ? failure.message : null, busy: busyScope === scope, retry: run };
}

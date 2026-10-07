import {useCallback, useRef, useState} from 'react';

/**
 * Immediate tap feedback for buttons that submit to the server. The ref drops a second tap in the
 * same frame (before React re-renders); the state lets the button show "處理中" and disable itself.
 */
export function usePendingAction() {
  const running = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const run = useCallback(<A extends unknown[], R>(key: string, action: (...args: A) => R | Promise<R>) =>
    async (...args: A): Promise<R | undefined> => {
      if (running.current.has(key)) return undefined;
      running.current.add(key);
      setPending(new Set(running.current));
      try {
        return await action(...args);
      } finally {
        running.current.delete(key);
        setPending(new Set(running.current));
      }
    }, []);
  const isPending = useCallback((key: string) => pending.has(key), [pending]);
  return {run, isPending};
}

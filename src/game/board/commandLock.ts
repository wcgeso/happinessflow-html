import {reportClientRejection} from '../../utils/clientRejection';
// Bounds rapid tapping: one running command plus a few queued ones.
export const MAX_LOCKED_COMMANDS = 4;
/**
 * Same command shares its Promise. A different command waits for the earlier ones (FIFO)
 * instead of failing, so a tap during a slow request is not lost. Callers that need an
 * immediate answer pass onBusy.
 */
export const runLockedBoardCommand = <T>(
  inFlight: Map<string, Promise<unknown>>, key: string, action: () => Promise<T>, onBusy?: () => T
): Promise<T> => {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  if (inFlight.size && onBusy) return Promise.resolve(onBusy());
  if (inFlight.size >= MAX_LOCKED_COMMANDS) {
    reportClientRejection('busy', key);
    return Promise.reject(Object.assign(new Error('操作太頻繁，請等目前的操作完成'), { code: 'busy' }));
  }
  const earlier = Promise.allSettled([...inFlight.values()]);
  const pending = earlier.then(action).finally(() => { inFlight.delete(key); });
  inFlight.set(key, pending);
  return pending;
};

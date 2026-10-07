import {reportClientRejection} from '../../utils/clientRejection';
/** Same command shares its Promise; a different command fails visibly. */
export const runLockedBoardCommand = <T>(
  inFlight: Map<string, Promise<unknown>>, key: string, action: () => Promise<T>, onBusy?: () => T
): Promise<T> => {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  if (inFlight.size && onBusy) return Promise.resolve(onBusy());
  if (inFlight.size) {reportClientRejection('busy',key);return Promise.reject(Object.assign(new Error('另一個操作正在處理，請稍後安全重試'), { code: 'busy' }));}
  const pending = Promise.resolve().then(action).finally(() => { inFlight.delete(key); });
  inFlight.set(key, pending);
  return pending;
};

import type { PresenceState } from '../types';

export const PRESENCE_HEARTBEAT_MS = 30_000;
export const PRESENCE_STALE_MS = 60_000;
export const PRESENCE_SKIP_AFTER_MS = 120_000;

export const getPresenceTimestamp = (presence?: PresenceState | null): number | null => {
  const value = presence?.lastSeenAt;
  if (typeof value === 'number') return value;
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  return null;
};

export const getPresenceAgeMs = (presence?: PresenceState | null, now = Date.now()): number | null => {
  const lastSeenAt = getPresenceTimestamp(presence);
  return lastSeenAt === null ? null : Math.max(0, now - lastSeenAt);
};

export const isPresenceOnline = (presence?: PresenceState | null, now = Date.now()): boolean => {
  const age = getPresenceAgeMs(presence, now);
  return presence?.status === 'online' && age !== null && age < PRESENCE_STALE_MS;
};

export const canSkipDisconnectedPlayer = (presence?: PresenceState | null, now = Date.now()): boolean => {
  const age = getPresenceAgeMs(presence, now);
  return age !== null && age >= PRESENCE_SKIP_AFTER_MS;
};

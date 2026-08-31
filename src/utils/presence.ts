import type { PlayerDiagnosticState, PresenceState } from '../types';

export const PRESENCE_STALE_MS = 60_000;
export const PRESENCE_SKIP_AFTER_MS = 120_000;

const getRealtimeTimestamp = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const mapRealtimePresenceValue = (root: unknown, lastOnlineRoot: unknown = {}): Record<string, PresenceState> => {
  const connectionRoot = root && typeof root === 'object' ? root as Record<string, any> : {};
  const lastOnlineValues = lastOnlineRoot && typeof lastOnlineRoot === 'object'
    ? lastOnlineRoot as Record<string, unknown>
    : {};
  const states: Record<string, PresenceState> = {};
  const uids = new Set([...Object.keys(connectionRoot), ...Object.keys(lastOnlineValues)]);
  uids.forEach(uid => {
    const value = connectionRoot[uid];
    if (value !== undefined && value !== null && typeof value !== 'object') return;

    const connections = Object.values((value || {}) as Record<string, any>)
      .filter(connection => connection && typeof connection === 'object');
    const onlineConnections = connections
      .filter(connection => connection?.status === 'online')
      .sort((a, b) => (getRealtimeTimestamp(b?.lastSeenAt) || 0) - (getRealtimeTimestamp(a?.lastSeenAt) || 0));
    const latestConnection = onlineConnections[0];
    const fallbackLastSeenAt = connections
      .map(connection => getRealtimeTimestamp(connection?.lastSeenAt))
      .filter((timestamp): timestamp is number => timestamp !== undefined)
      .sort((a, b) => b - a)[0];

    if (latestConnection) {
      states[uid] = {
        uid,
        status: 'online',
        sessionId: String(latestConnection.sessionId || `${uid}:realtime`),
        source: 'realtime',
        lastSeenAt: getRealtimeTimestamp(latestConnection.lastSeenAt) || Date.now(),
      };
      return;
    }

    const lastOnline = getRealtimeTimestamp(lastOnlineValues[uid]);
    const resolvedLastSeenAt = Math.max(fallbackLastSeenAt || 0, lastOnline || 0) || undefined;
    if (resolvedLastSeenAt !== undefined) {
      states[uid] = {
        uid,
        status: 'offline',
        sessionId: String(connections[0]?.sessionId || `${uid}:realtime`),
        source: 'realtime',
        lastSeenAt: resolvedLastSeenAt,
      };
    }
  });

  return states;
};

export const mapRealtimeDiagnosticsValue = (root: unknown): Record<string, PlayerDiagnosticState> => {
  if (!root || typeof root !== 'object') return {};
  const diagnostics: Record<string, PlayerDiagnosticState> = {};
  Object.entries(root as Record<string, unknown>).forEach(([uid, value]) => {
    if (!value || typeof value !== 'object') return;
    const latest = Object.values(value as Record<string, any>)
      .filter(entry => entry && typeof entry === 'object')
      .sort((a, b) => (getRealtimeTimestamp(b.updatedAt) || 0) - (getRealtimeTimestamp(a.updatedAt) || 0))[0];
    if (latest) diagnostics[uid] = { ...latest, uid } as PlayerDiagnosticState;
  });
  return diagnostics;
};

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
  if (presence?.source === 'realtime') return presence.status === 'online';
  const age = getPresenceAgeMs(presence, now);
  return presence?.status === 'online' && age !== null && age < PRESENCE_STALE_MS;
};

export const canSkipDisconnectedPlayer = (presence?: PresenceState | null, now = Date.now()): boolean => {
  const age = getPresenceAgeMs(presence, now);
  return age !== null && age >= PRESENCE_SKIP_AFTER_MS;
};

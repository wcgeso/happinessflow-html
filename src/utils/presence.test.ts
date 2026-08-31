import { describe, expect, it } from 'vitest';
import type { PresenceState } from '../types';
import { canSkipDisconnectedPlayer, isPresenceOnline, mapRealtimePresenceValue } from './presence';

const presence = (overrides: Partial<PresenceState> = {}): PresenceState => ({
  uid: 'p1',
  status: 'online',
  sessionId: 'session-1',
  lastSeenAt: 100_000,
  ...overrides,
});

describe('presence', () => {
  it('treats a fresh heartbeat as online and a stale one as offline', () => {
    expect(isPresenceOnline(presence(), 100_001)).toBe(true);
    expect(isPresenceOnline(presence(), 160_001)).toBe(false);
  });

  it('only allows timeout handling after 120 seconds without a heartbeat', () => {
    expect(canSkipDisconnectedPlayer(presence(), 219_999)).toBe(false);
    expect(canSkipDisconnectedPlayer(presence(), 220_000)).toBe(true);
  });

  it('aggregates multiple realtime connections without marking an active tab stale', () => {
    const states = mapRealtimePresenceValue({
      p1: {
        first: { status: 'online', sessionId: 's1', lastSeenAt: 100_100 },
        second: { status: 'online', sessionId: 's2', lastSeenAt: 100_200 },
      },
    });

    expect(states.p1.sessionId).toBe('s2');
    expect(states.p1.source).toBe('realtime');
    expect(isPresenceOnline(states.p1, 999_999)).toBe(true);
  });

  it('keeps the last online time after onDisconnect removes the connection node', () => {
    const states = mapRealtimePresenceValue({}, { p1: 100_000 });

    expect(states.p1.status).toBe('offline');
    expect(canSkipDisconnectedPlayer(states.p1, 220_000)).toBe(true);
  });
});

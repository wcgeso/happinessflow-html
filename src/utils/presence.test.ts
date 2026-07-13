import { describe, expect, it } from 'vitest';
import type { PresenceState } from '../types';
import { canSkipDisconnectedPlayer, isPresenceOnline } from './presence';

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
});

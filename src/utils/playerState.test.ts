import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { hasPublicPlayerStateChanged, toPublicPlayerState } from './playerState';

describe('toPublicPlayerState', () => {
  it('removes optional undefined values before Firestore writes', () => {
    const state = {
      playerName: 'Player',
      isSetup: true,
      selectionStep: 'completed',
      happinessTotal: 4,
      currentRankTitle: '助理'
    } as GameState;

    const publicState = toPublicPlayerState('player-1', state);

    expect(publicState).toEqual({
      uid: 'player-1',
      playerName: 'Player',
      isSetup: true,
      selectionStep: 'completed',
      happinessTotal: 4,
      currentRankTitle: '助理'
    });
    expect(Object.values(publicState)).not.toContain(undefined);
  });

  it('detects only meaningful public projection changes', () => {
    const previous = toPublicPlayerState('player-1', {
      playerName: 'Player',
      isSetup: true,
      happinessTotal: 4
    } as GameState);

    expect(hasPublicPlayerStateChanged(previous, { ...previous })).toBe(false);
    expect(hasPublicPlayerStateChanged(previous, { ...previous, happinessTotal: 5 })).toBe(true);
  });
});

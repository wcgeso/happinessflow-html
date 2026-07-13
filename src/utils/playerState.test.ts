import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { toPublicPlayerState } from './playerState';

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
});

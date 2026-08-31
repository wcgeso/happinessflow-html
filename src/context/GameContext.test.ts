import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { isHiddenStockNewsCard, isPlayerStateForBoardGame, mergeAuthoritativePlayerState } from './GameContext';

describe('private player state synchronization', () => {
  it('clears a stale family join action when Firestore removes it', () => {
    const previous = {
      pendingFamilyMilestoneJoinAction: {
        promptId: 'prompt-1',
        cardId: 'H016',
        sourcePlayerUid: 'source-player',
        stageProgressId: 'date'
      }
    } as GameState;
    const remote = {} as GameState;

    expect(mergeAuthoritativePlayerState(previous, remote).pendingFamilyMilestoneJoinAction).toBeUndefined();
  });

  it('keeps pending medical claims in the authoritative player state', () => {
    const claim = {
      id: 'medical-claim:event-1:C036',
      sourceEventId: 'event-1',
      sourceCardId: 'C036',
      createdAt: 1
    };

    expect(mergeAuthoritativePlayerState({} as GameState, { pendingMedicalClaims: [claim] } as GameState).pendingMedicalClaims)
      .toEqual([claim]);
    expect(mergeAuthoritativePlayerState({ pendingMedicalClaims: [claim] } as GameState, {} as GameState).pendingMedicalClaims)
      .toEqual([claim]);
  });

  it('rejects a private player snapshot from another board game', () => {
    const stale = { boardGameStartedAt: 100, isSetup: true, happinessTotal: 2 } as GameState;

    expect(isPlayerStateForBoardGame(stale, 200)).toBe(false);
    expect(isPlayerStateForBoardGame(stale, 100)).toBe(true);
  });

  it('never moves the processed market update timestamp backwards', () => {
    const previous = { lastMarketUpdateTimestamp: 200 } as GameState;
    const staleRemote = { lastMarketUpdateTimestamp: 100 } as GameState;
    const newerRemote = { lastMarketUpdateTimestamp: 300 } as GameState;

    expect(mergeAuthoritativePlayerState(previous, staleRemote).lastMarketUpdateTimestamp).toBe(200);
    expect(mergeAuthoritativePlayerState(previous, newerRemote).lastMarketUpdateTimestamp).toBe(300);
  });

  it('waits for a stock news card to be revealed before allowing its notice', () => {
    const room = {
      isBoardGame: true,
      boardState: {
        currentEvent: { id: 'event-1' },
        currentCard: { deck: 'news', cardId: 'N001' },
        currentCardReveal: { eventId: 'event-1', cardId: 'N001', isRevealed: false }
      }
    };

    expect(isHiddenStockNewsCard(room)).toBe(true);
    expect(isHiddenStockNewsCard({
      ...room,
      boardState: {
        ...room.boardState,
        currentCardReveal: { eventId: 'event-1', cardId: 'N001', isRevealed: true }
      }
    })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { getSafePlayerStatePatch, isHiddenStockNewsCard, isPlayerStateForBoardGame, limitPlayerSyncHistory, mergeAuthoritativePlayerState, normalizeGameState, shouldDeferPlayerStateSync } from './GameContext';

describe('private player state synchronization', () => {
  it('fills missing transaction collections when restoring a legacy partial state', () => {
    const restored = normalizeGameState({ cash: 12000 } as Partial<GameState>);

    expect(restored.cash).toBe(12000);
    expect(restored.happiness).toEqual([]);
    expect(restored.history).toEqual([]);
    expect(restored.assets).toEqual([]);
    expect(restored.liabilities).toEqual([]);
    expect(restored.abilities).toEqual({ stockAbilityCount: 0, realEstateAbilityCount: 0, professionAbilityCount: 0 });
  });

  it('restores a legacy completed target enterprise whose income survived without its asset', () => {
    const restored = normalizeGameState({
      selectedEnterprise: { id: 'e1', name: '目標企業', cost: 5000000, income: 4500000, relatedProfessionId: '', relatedBonusPercent: 0, happyPoints: 10 },
      income: { '目標企業': 4500000 },
      assets: [],
      happiness: [{ id: 'h_career', label: '事業成就', points: 10, checked: true }]
    } as Partial<GameState>);

    expect(restored.assets).toContainEqual(expect.objectContaining({ name: '目標企業', cashflow: 4500000, type: '企業' }));
    expect(restored.income['目標企業']).toBeUndefined();
  });

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

  it('does not overwrite an authoritative field with a delayed local value', () => {
    const baseline = { cash: 1000, happinessTotal: 2 } as Partial<GameState>;
    const desired = { cash: 500, happinessTotal: 4 } as Partial<GameState>;

    expect(getSafePlayerStatePatch(baseline, { cash: 1000, happinessTotal: 2 }, desired))
      .toEqual({ cash: 500, happinessTotal: 4 });
    expect(getSafePlayerStatePatch(baseline, { cash: 5000, happinessTotal: 2 }, desired))
      .toEqual({ happinessTotal: 4 });
  });

  it('defers the legacy player bridge while a board command is active', () => {
    expect(shouldDeferPlayerStateSync({
      isBoardGame: true,
      status: 'playing',
      boardState: { currentEvent: { id: 'event-1' } }
    })).toBe(true);
    expect(shouldDeferPlayerStateSync({
      isBoardGame: true,
      status: 'playing',
      boardState: { movement: { isActive: true } }
    })).toBe(true);
    expect(shouldDeferPlayerStateSync({
      isBoardGame: true,
      status: 'playing',
      boardState: { currentEvent: null, movement: null }
    })).toBe(false);
  });

  it('bounds growing history before player state sync', () => {
    const history = Array.from({ length: 120 }, (_, index) => ({ id: index }));
    const appliedBoardFinancialEventIds = Array.from({ length: 220 }, (_, index) => `event-${index}`);
    const result = limitPlayerSyncHistory({ history, appliedBoardFinancialEventIds });

    expect(result.history).toHaveLength(100);
    expect(result.history?.[0]).toEqual({ id: 20 });
    expect(result.appliedBoardFinancialEventIds).toHaveLength(200);
    expect(result.appliedBoardFinancialEventIds?.[0]).toBe('event-20');
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

 it('defers the legacy sync for active board events', () => {
   expect(shouldDeferPlayerStateSync({isBoardGame:true,status:'playing',boardState:{currentEvent:{id:'e'}}})).toBe(true);
 });

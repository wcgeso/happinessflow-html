import type { GameState, PublicPlayerState } from '../types';
import { cleanObject } from './utils';

export const toPublicPlayerState = (uid: string, state: GameState): PublicPlayerState => cleanObject({
  uid,
  playerName: state.playerName,
  isSetup: !!state.isSetup,
  selectionStep: state.selectionStep,
  happinessTotal: state.happinessTotal || 0,
  boardPosition: state.boardPosition,
  skipTurns: state.skipTurns,
  lastBoardEvent: state.lastBoardEvent,
  pendingCardAction: state.pendingCardAction,
  currentRankTitle: state.currentRankTitle
}) as PublicPlayerState;

export const hasPublicPlayerStateChanged = (
  previous: PublicPlayerState | undefined,
  next: PublicPlayerState
) => JSON.stringify(previous) !== JSON.stringify(next);

export const toPublicPlayerStates = (states: Record<string, GameState>) =>
  Object.fromEntries(Object.entries(states).map(([uid, state]) => [uid, toPublicPlayerState(uid, state)]));

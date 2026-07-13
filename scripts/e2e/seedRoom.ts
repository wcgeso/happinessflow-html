// Emulator-only room seeder for the board-multiplayer acceptance suite.
//
// Directly writes a fully-formed `rooms/{roomCode}` document via the Admin
// SDK (bypassing Firestore rules entirely, since Admin SDK always does),
// pre-populated with a "playing" board game, 3 players who have already
// completed profession setup, and a deterministic (unshuffled) deck so that
// `forceNextCard` can reliably control what gets drawn next.
//
// Run directly: `tsx scripts/e2e/seedRoom.ts` seeds the default room 900001.
// Import `seedRoom` from Playwright specs for full control over overrides.

import { getEmulatorDb } from './adminClient.mjs';
import { seedAccounts } from './seedAccounts.mjs';
import { PROFESSIONS, ENTERPRISES, DREAMS, STOCK_SYMBOLS } from '../../src/constants';
import { getInitialHappinessList } from '../../src/utils/gameUtils';
import type { GameState, BoardState, BoardDeckState } from '../../src/types';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_ROOM_CODE = '900001';

const readCardIds = (file: string): string[] => {
  const jsonPath = path.join(__dirname, '../../src/data/cards', file);
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  return raw.map((card: { id: string }) => card.id);
};

const HAPPINESS_IDS = readCardIds('happiness.cards.json');
const OPPORTUNITY_IDS = readCardIds('opportunity.cards.json');
const NEWS_IDS = readCardIds('news.cards.json');

export const buildDeterministicDeckState = (): BoardDeckState => ({
  happiness: [...HAPPINESS_IDS],
  opportunity: [...OPPORTUNITY_IDS],
  news: [...NEWS_IDS],
  usedHappiness: [],
  usedOpportunity: [],
  usedNews: [],
});

// Mirrors the shape produced by handleSelectionComplete() in src/App.tsx once
// a player finishes the profession/enterprise/dream setup wizard, so seeded
// players look exactly like ones who set up through the real UI.
export const buildDefaultPlayerGameState = (overrides: Partial<GameState> = {}): GameState => {
  const profession = PROFESSIONS[0];
  const enterprise = ENTERPRISES[0];
  const dream = DREAMS[0];
  const marketPrices = STOCK_SYMBOLS.reduce((acc: Record<string, number>, symbol: string) => {
    acc[symbol] = 0;
    return acc;
  }, {} as Record<string, number>);

  const base: GameState = {
    profession,
    selectedEnterprise: enterprise,
    selectedDream: dream,
    currentRankTitle: profession.initialRank,
    currentRankLevel: 1,
    cash: profession.savings,
    children: 0,
    medicalInsuranceCount: 0,
    assets: [],
    liabilities: [],
    loans: 0,
    isSetup: true,
    selectionStep: 'completed',
    expenses: {},
    income: {},
    history: [],
    happiness: getInitialHappinessList(enterprise, dream),
    happinessTotal: 0,
    marketPrices,
    previousMarketPrices: marketPrices,
    lastPublishedCode: '',
    abilities: {
      stockAbilityCount: 0,
      realEstateAbilityCount: 0,
      professionAbilityCount: 0,
    },
    completedHappinessEvents: [],
    playerName: '',
    reportName: '我的財報',
  };

  return { ...base, ...overrides };
};

export interface SeedRoomOptions {
  roomCode?: string;
  turnOrder?: string[];
  playerPositions?: Record<string, number>;
  currentTurnUid?: string;
  playerStateOverrides?: Record<string, Partial<GameState>>;
  deckState?: Partial<BoardDeckState>;
}

export const seedRoom = async (options: SeedRoomOptions = {}) => {
  const roomCode = options.roomCode ?? DEFAULT_ROOM_CODE;
  const accounts = await seedAccounts();
  const coach = accounts.coach;
  const players = [accounts.p1, accounts.p2, accounts.p3];
  const turnOrder = options.turnOrder ?? players.map((p) => p.uid);

  const playerPositions = options.playerPositions ??
    Object.fromEntries(turnOrder.map((uid) => [uid, 0]));

  const playerStates: Record<string, GameState> = {};
  for (const player of players) {
    playerStates[player.uid] = buildDefaultPlayerGameState({
      playerName: player.name,
      ...(options.playerStateOverrides?.[player.uid] ?? {}),
    });
  }

  const boardState: BoardState = {
    currentTurnUid: options.currentTurnUid ?? turnOrder[0] ?? null,
    turnOrder,
    playerPositions,
    skipTurns: Object.fromEntries(turnOrder.map((uid) => [uid, 0])),
    hasRolledThisTurn: false,
    lastRoll: null,
    currentCard: null,
    currentCardReveal: null,
    currentEvent: null,
    pendingEvents: [],
    movement: null,
    familyMilestoneJoinPrompt: null,
    sharedCardPrompt: null,
    deckState: { ...buildDeterministicDeckState(), ...(options.deckState ?? {}) },
    realEstateMarket: [],
    cardLog: [],
    updatedAt: Date.now(),
  };

  const members = [
    { uid: coach.uid, name: coach.name, email: coach.email, role: 'coach' as const, joinedAt: Date.now() },
    ...players.map((p) => ({ uid: p.uid, name: p.name, email: p.email, role: 'player' as const, joinedAt: Date.now() })),
  ];

  const db = getEmulatorDb();
  await db.collection('rooms').doc(roomCode).set({
    id: roomCode,
    name: 'E2E 驗收房',
    hostId: coach.uid,
    status: 'playing',
    members,
    createdAt: Date.now(),
    maxPlayers: 3,
    isBoardGame: true,
    isPractice: false,
    publicPlayerStates: Object.fromEntries(Object.entries(playerStates).map(([uid, state]) => [uid, {
      uid,
      playerName: state.playerName,
      isSetup: state.isSetup,
      selectionStep: state.selectionStep,
      happinessTotal: state.happinessTotal,
      currentRankTitle: state.currentRankTitle,
      boardPosition: state.boardPosition,
      skipTurns: state.skipTurns,
      lastBoardEvent: state.lastBoardEvent,
      pendingCardAction: state.pendingCardAction
    }])),
    startedAt: Date.now(),
    pendingRequests: {},
    boardState,
  });

  await Promise.all(Object.entries(playerStates).map(([uid, state]) =>
    db.collection('rooms').doc(roomCode).collection('players').doc(uid).set(state)
  ));

  return { roomCode, coach, players, accounts };
};

const isMain = process.argv[1] && process.argv[1].endsWith('seedRoom.ts');
if (isMain) {
  seedRoom()
    .then(({ roomCode, coach, players }) => {
      console.log(`[e2e/seedRoom] Seeded room ${roomCode}`);
      console.log(`  coach: ${coach.email} (${coach.uid})`);
      players.forEach((p, i) => console.log(`  p${i + 1}: ${p.email} (${p.uid})`));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[e2e/seedRoom] Failed:', err);
      process.exit(1);
    });
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
let testEnv: RulesTestEnvironment;

const roomRef = (uid: string, roomId = 'room-p0') =>
  doc(testEnv.authenticatedContext(uid).firestore(), 'rooms', roomId);

const boardState = (currentTurnUid: string | null = 'coach') => ({
  currentTurnUid,
  turnOrder: ['player'],
  playerPositions: { player: 0 },
  skipTurns: { player: 0 },
  hasRolledThisTurn: false,
  revision: 0,
  processedCommandIds: [],
  updatedAt: 1
});

const room = (overrides: Record<string, unknown> = {}) => ({
  id: 'room-p0',
  hostId: 'coach',
  status: 'waiting',
  members: [{ uid: 'coach', name: 'Coach', role: 'coach' }],
  memberUids: ['coach'],
  playerStates: {},
  isBoardGame: true,
  boardState: boardState(),
  ...overrides
});

const rulesDescribe = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

rulesDescribe('Firestore room P0 permissions', () => {
  beforeEach(async () => {
    if (!testEnv) {
      testEnv = await initializeTestEnvironment({
        projectId: 'happinessflow-p0',
        firestore: { rules }
      });
    }
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it('requires the creator to be the first member', async () => {
    const db = testEnv.authenticatedContext('coach').firestore();
    await assertSucceeds(setDoc(doc(db, 'rooms/room-p0'), room()));
    await assertFails(setDoc(doc(db, 'rooms/room-p0-bad'), room({ id: 'room-p0-bad', memberUids: [] })));
  });

  it('allows a player to join and leave only their own membership', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(updateDoc(doc(playerDb, 'rooms/room-p0'), {
      members: arrayUnion({ uid: 'player', name: 'Player', role: 'player' }),
      memberUids: arrayUnion('player')
    }));
    await assertFails(updateDoc(doc(testEnv.authenticatedContext('stranger').firestore(), 'rooms/room-p0'), {
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Changed', role: 'player' }]
    }));
  });

  it('allows only the owner of a player state to change it', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }, { uid: 'other', name: 'Other', role: 'player' }],
      memberUids: ['coach', 'player', 'other'],
      playerStates: { player: { cash: 1 }, other: { cash: 1 } }
    }));
    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(updateDoc(doc(playerDb, 'rooms/room-p0'), { 'playerStates.player': { cash: 2 } }));
    await assertFails(updateDoc(doc(playerDb, 'rooms/room-p0'), { 'playerStates.coach': { cash: 999999 } }));
  });

  it('requires revision and command ledger for board writes', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      boardState: boardState('player'),
      memberUids: ['coach', 'player'],
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }]
    }));
    const db = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(updateDoc(doc(db, 'rooms/room-p0'), {
      boardState: { ...boardState('player'), revision: 1, processedCommandIds: ['cmd-1'] }
    }));
    await assertFails(updateDoc(doc(db, 'rooms/room-p0'), {
      boardState: { ...boardState('player'), revision: 2, processedCommandIds: ['cmd-2'] },
      'playerStates.other': { cash: 999999 }
    }));
  });

  it('does not expose a playing room to a non-member', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      memberUids: ['coach', 'player'],
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }],
      playerStates: { player: {} }
    }));
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('player').firestore(), 'rooms/room-p0')));
    await assertFails(getDoc(doc(testEnv.authenticatedContext('stranger').firestore(), 'rooms/room-p0')));
  });

  it('keeps room identity immutable for members', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertFails(updateDoc(doc(testEnv.authenticatedContext('coach').firestore(), 'rooms/room-p0'), { hostId: 'stranger' }));
  });

  it('allows a shared-card target to submit only their own response', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    const promptBoard = {
      ...boardState('player'),
      sharedCardPrompt: {
        id: 'prompt-1',
        targetPlayerUids: ['player'],
        responses: {}
      }
    };
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      boardState: promptBoard,
      memberUids: ['coach', 'player'],
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }]
    }));
    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(updateDoc(doc(playerDb, 'rooms/room-p0'), {
      'boardState.sharedCardPrompt.responses.player': { status: 'completed' },
      'boardState.updatedAt': 2
    }));
    await assertFails(updateDoc(doc(playerDb, 'rooms/room-p0'), {
      'boardState.sharedCardPrompt.responses.other': { status: 'completed' },
      'boardState.updatedAt': 3
    }));
  });
});

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
  runTransaction,
  setDoc,
  serverTimestamp,
  updateDoc,
  deleteField,
  writeBatch
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
  publicPlayerStates: {},
  pendingRequests: {},
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

  it('allows a waiting player to read only their own saved state before joining', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(setDoc(doc(testEnv.authenticatedContext('coach').firestore(), 'rooms/room-p0/players/player'), { cash: 1 }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(getDoc(doc(playerDb, 'rooms/room-p0')));
    await assertSucceeds(getDoc(doc(playerDb, 'rooms/room-p0/players/player')));
    await assertFails(getDoc(doc(playerDb, 'rooms/room-p0/players/other')));
  });

  it('allows a signed-in player to confirm a room does not exist', async () => {
    const snapshot = await assertSucceeds(
      getDoc(doc(testEnv.authenticatedContext('player').firestore(), 'rooms/missing-room'))
    );
    expect(snapshot.exists()).toBe(false);
  });

  it('allows only the owner of a player state to change it', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }, { uid: 'other', name: 'Other', role: 'player' }],
      memberUids: ['coach', 'player', 'other'],
      publicPlayerStates: { player: { uid: 'player', isSetup: true }, other: { uid: 'other', isSetup: true } }
    }));
    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(setDoc(doc(playerDb, 'rooms/room-p0/players/player'), { cash: 1, expenses: {} }));
    await assertSucceeds(updateDoc(doc(playerDb, 'rooms/room-p0/players/player'), { cash: 2 }));
    await assertFails(updateDoc(doc(playerDb, 'rooms/room-p0/players/other'), { cash: 999999 }));
    await assertFails(getDoc(doc(playerDb, 'rooms/room-p0/players/other')));
  });

  it('allows a player to publish completed setup with private state', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }],
      memberUids: ['coach', 'player']
    }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    const batch = writeBatch(playerDb);
    batch.set(doc(playerDb, 'rooms/room-p0/players/player'), {
      playerName: 'Player',
      isSetup: true,
      selectionStep: 'completed'
    }, { merge: true });
    batch.update(doc(playerDb, 'rooms/room-p0'), {
      'publicPlayerStates.player': {
        uid: 'player',
        playerName: 'Player',
        isSetup: true,
        selectionStep: 'completed',
        happinessTotal: 0
      }
    });

    await assertSucceeds(batch.commit());
    const coachDb = testEnv.authenticatedContext('coach').firestore();
    expect((await getDoc(doc(coachDb, 'rooms/room-p0/players/player'))).data()?.isSetup).toBe(true);
    expect((await getDoc(doc(coachDb, 'rooms/room-p0'))).data()?.publicPlayerStates?.player?.isSetup).toBe(true);
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
      'publicPlayerStates.other': { uid: 'other', isSetup: true }
    }));
  });

  it('allows a player dice transaction to write private state and event log', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      boardState: boardState('player'),
      memberUids: ['coach', 'player'],
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }]
    }));
    const db = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(setDoc(doc(db, 'rooms/room-p0/players/player'), { cash: 1 }));
    await assertSucceeds(setDoc(doc(db, 'rooms/room-p0/events/revision_1'), {
      roomId: 'room-p0',
      sessionId: 'room-p0',
      commandType: 'roll',
      revision: 1,
      result: 'committed',
      recordedAt: serverTimestamp()
    }));
    await assertSucceeds(updateDoc(doc(db, 'rooms/room-p0'), {
      boardState: { ...boardState('player'), hasRolledThisTurn: true, revision: 1, processedCommandIds: ['roll:player:0'] }
    }));

    await assertSucceeds(runTransaction(db, async transaction => {
      const roomDocument = doc(db, 'rooms/room-p0');
      const playerDocument = doc(db, 'rooms/room-p0/players/player');
      await transaction.get(roomDocument);
      await transaction.get(playerDocument);
      transaction.set(playerDocument, { cash: 1, skipTurns: 0 });
      transaction.update(roomDocument, {
        boardState: { ...boardState('player'), hasRolledThisTurn: false, revision: 2, processedCommandIds: ['roll:player:0', 'roll:player:1'] }
      });
    }));
  });

  it('does not expose a playing room to a non-member', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      memberUids: ['coach', 'player'],
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }],
      publicPlayerStates: { player: { uid: 'player', isSetup: true } }
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
      boardState: {
        ...promptBoard,
        revision: 1,
        processedCommandIds: ['response-1'],
        sharedCardPrompt: {
          ...promptBoard.sharedCardPrompt,
          responses: { player: { status: 'completed' } }
        },
        updatedAt: 2
      }
    }));
    await assertFails(updateDoc(doc(playerDb, 'rooms/room-p0'), {
      boardState: {
        ...promptBoard,
        revision: 2,
        processedCommandIds: ['response-2'],
        sharedCardPrompt: {
          ...promptBoard.sharedCardPrompt,
          responses: { other: { status: 'completed' } }
        },
        updatedAt: 3
      }
    }));
  });

  it('allows the final shared-card response to remove the completed prompt', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    const promptBoard = {
      ...boardState('player'),
      sharedCardPrompt: {
        id: 'prompt-final',
        targetPlayerUids: ['player'],
        responses: {}
      }
    };
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      boardState: promptBoard,
      memberUids: ['coach', 'player'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' }
      ]
    }));
    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(updateDoc(doc(playerDb, 'rooms/room-p0'), {
      'boardState.revision': 1,
      'boardState.processedCommandIds': ['response-final'],
      'boardState.sharedCardPrompt': deleteField(),
      'boardState.updatedAt': 2
    }));
  });

  it('allows H009 approval requests only for the requesting player', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      memberUids: ['coach', 'player'],
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }]
    }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(updateDoc(doc(playerDb, 'rooms/room-p0'), {
      'pendingRequests.player': { uid: 'player', status: 'pending', type: 'happiness' }
    }));
    await assertFails(updateDoc(doc(playerDb, 'rooms/room-p0'), {
      'pendingRequests.other': { uid: 'other', status: 'pending', type: 'happiness' }
    }));
    await assertSucceeds(updateDoc(doc(playerDb, 'rooms/room-p0'), {
      'pendingRequests.player': deleteField()
    }));
  });
});

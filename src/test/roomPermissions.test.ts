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
import type { GameState } from '../types';
import { buildStartupLoanPromptMutation, type Room } from '../context/RoomContext';
import { runRoomBoardMutation } from '../game/board/runBoardMutation';

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

const startupLoanPlayerState = (playerName: string): GameState => ({
  profession: null,
  selectedEnterprise: null,
  selectedDream: null,
  expenses: {},
  income: {},
  currentRankTitle: '',
  currentRankLevel: 1,
  cash: 10000,
  children: 0,
  medicalInsuranceCount: 0,
  assets: [],
  liabilities: [],
  loans: 0,
  isSetup: true,
  selectionStep: 'completed',
  history: [],
  happiness: [],
  happinessTotal: 0,
  marketPrices: {},
  previousMarketPrices: {},
  lastPublishedCode: '',
  abilities: { stockAbilityCount: 0, realEstateAbilityCount: 0, professionAbilityCount: 0 },
  completedHappinessEvents: [],
  playerName
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

  it('allows the room operator to change acceleration once and blocks players', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }],
      memberUids: ['coach', 'player'],
      financialAcceleration: { multiplier: 1 }
    }));

    await assertSucceeds(updateDoc(roomRef('coach'), {
      financialAcceleration: { multiplier: 2, updatedAt: 1, updatedByUid: 'coach' }
    }));
    await assertFails(updateDoc(roomRef('player'), {
      financialAcceleration: { multiplier: 3, updatedAt: 2, updatedByUid: 'player' }
    }));
  });

  it('allows sequential operator subsidies and blocks player subsidy writes', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }],
      memberUids: ['coach', 'player']
    }));

    await assertSucceeds(updateDoc(roomRef('coach'), {
      financialSubsidy: { sequence: 1, amount: 10000, grantedAt: 1, grantedByUid: 'coach', playerUids: ['player'] }
    }));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      financialSubsidy: { sequence: 2, amount: 5000, grantedAt: 2, grantedByUid: 'coach', playerUids: ['player'] }
    }));
    await assertFails(updateDoc(roomRef('coach'), {
      financialSubsidy: { sequence: 4, amount: 5000, grantedAt: 3, grantedByUid: 'coach', playerUids: ['player'] }
    }));
    await assertFails(updateDoc(roomRef('player'), {
      financialSubsidy: { sequence: 3, amount: 10000, grantedAt: 4, grantedByUid: 'player', playerUids: ['player'] }
    }));
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

  it('allows a legacy room without public player states to publish player setup', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }],
      memberUids: ['coach', 'player'],
      publicPlayerStates: deleteField()
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

  it('allows a non-current active player to remove exactly one market property', async () => {
    const marketBoard = {
      ...boardState('player-1'),
      turnOrder: ['player-1', 'player-2'],
      playerPositions: { 'player-1': 0, 'player-2': 0 },
      skipTurns: { 'player-1': 0, 'player-2': 0 },
      realEstateMarket: ['N029', 'N030', 'N031']
    };
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      boardState: marketBoard,
      memberUids: ['coach', 'player-1', 'player-2'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player-1', name: 'P1', role: 'player' },
        { uid: 'player-2', name: 'P2', role: 'player' }
      ]
    }));

    const playerTwoDb = testEnv.authenticatedContext('player-2').firestore();
    await assertSucceeds(updateDoc(doc(playerTwoDb, 'rooms/room-p0'), {
      boardState: {
        ...marketBoard,
        realEstateMarket: ['N030', 'N031'],
        revision: 1,
        processedCommandIds: ['market-purchase:player-2:N029'],
        updatedAt: 2
      },
      'publicPlayerStates.player-2': { uid: 'player-2', happinessTotal: 0 }
    }));

    await assertFails(updateDoc(doc(playerTwoDb, 'rooms/room-p0'), {
      boardState: {
        ...marketBoard,
        realEstateMarket: [],
        revision: 2,
        processedCommandIds: ['market-purchase:player-2:N029', 'market-purchase:player-2:N030'],
        updatedAt: 3
      }
    }));
    await assertFails(updateDoc(doc(playerTwoDb, 'rooms/room-p0'), {
      boardState: {
        ...marketBoard,
        currentTurnUid: 'player-2',
        realEstateMarket: ['N030'],
        revision: 1,
        processedCommandIds: ['market-purchase:player-2:N029'],
        updatedAt: 4
      }
    }));
    await assertFails(updateDoc(doc(testEnv.authenticatedContext('spectator').firestore(), 'rooms/room-p0'), {
      boardState: {
        ...marketBoard,
        realEstateMarket: ['N030'],
        revision: 1,
        processedCommandIds: ['market-purchase:spectator:N029'],
        updatedAt: 5
      }
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

  it('allows the source player to finish their own family milestone event', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    const familyBoard = {
      ...boardState('player'),
      currentCard: { cardId: 'H016', deck: 'happiness' },
      currentEvent: { id: 'event-1', playerUid: 'player' },
      familyMilestoneJoinPrompt: {
        id: 'family-1',
        sourceEventId: 'event-1',
        sourceCardId: 'H016',
        sourcePlayerUid: 'player',
        sourceActionCompleted: true,
        targetPlayerUids: ['other'],
        responses: { other: { status: 'declined' } }
      }
    };
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      boardState: familyBoard,
      memberUids: ['coach', 'player', 'other', 'spectator'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' },
        { uid: 'other', name: 'Other', role: 'player' },
        { uid: 'spectator', name: 'Spectator', role: 'player' }
      ]
    }));

    const completedBoard = {
      ...familyBoard,
      currentCard: null,
      currentEvent: null,
      familyMilestoneJoinPrompt: null,
      revision: 1,
      processedCommandIds: ['dismiss:event-1:H016'],
      updatedAt: 2
    };
    const spectatorDb = testEnv.authenticatedContext('spectator').firestore();
    await assertFails(updateDoc(doc(spectatorDb, 'rooms/room-p0'), { boardState: completedBoard }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(updateDoc(doc(playerDb, 'rooms/room-p0'), { boardState: completedBoard }));
  });

  it('allows the source player to commit their action before finalizing the family event', async () => {
    const familyBoard = {
      ...boardState('player'),
      currentCard: { cardId: 'H016', deck: 'happiness' },
      currentEvent: { id: 'event-family-source', playerUid: 'player' },
      familyMilestoneJoinPrompt: {
        id: 'family-source',
        sourceEventId: 'event-family-source',
        sourceCardId: 'H016',
        sourcePlayerUid: 'player',
        sourceActionCompleted: false,
        targetPlayerUids: ['other'],
        responses: { other: { status: 'declined', actionCompleted: true } }
      }
    };
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      boardState: familyBoard,
      memberUids: ['coach', 'player', 'other'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' },
        { uid: 'other', name: 'Other', role: 'player' }
      ]
    }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    const playerStateRef = doc(playerDb, 'rooms/room-p0/players/player');
    await assertSucceeds(setDoc(playerStateRef, startupLoanPlayerState('Player')));

    await assertSucceeds(runRoomBoardMutation<boolean, Room>({
      db: playerDb,
      roomId: 'room-p0',
      commandId: 'family-action:family-source:player:accept',
      playerStateUids: ['player'],
      onDuplicate: () => true,
      mutate: (latestRoom, latestBoard) => {
        const state = latestRoom.playerStates?.player;
        if (!state) throw new Error('missing player state');
        return {
          boardState: {
            ...latestBoard,
            familyMilestoneJoinPrompt: {
              ...latestBoard.familyMilestoneJoinPrompt!,
              sourceActionCompleted: true
            }
          },
          roomPatch: {
            playerStates: {
              player: { ...state, cash: 7000, completedHappinessEvents: ['date'] }
            }
          },
          result: true
        };
      }
    }));

    await assertSucceeds(runRoomBoardMutation<boolean, Room>({
      db: playerDb,
      roomId: 'room-p0',
      commandId: 'family-complete:family-source:player',
      playerStateUids: ['player'],
      onDuplicate: () => true,
      mutate: (latestRoom, latestBoard) => ({
        boardState: {
          ...latestBoard,
          currentCard: null,
          currentEvent: null,
          familyMilestoneJoinPrompt: null
        },
        result: true
      })
    }));

    const finalRoom = (await getDoc(doc(playerDb, 'rooms/room-p0'))).data();
    expect(finalRoom?.boardState.familyMilestoneJoinPrompt).toBeNull();
    expect((await getDoc(playerStateRef)).data()).toMatchObject({
      cash: 7000,
      completedHappinessEvents: ['date']
    });
  });

  it('allows a three-player family event with two failed rolls to finalize on the first source completion', async () => {
    const familyBoard = {
      ...boardState('player'),
      currentCard: { cardId: 'H014', deck: 'happiness' },
      currentEvent: { id: 'event-family-h014', playerUid: 'player' },
      familyMilestoneJoinPrompt: {
        id: 'family-h014',
        sourceEventId: 'event-family-h014',
        sourceCardId: 'H014',
        sourcePlayerUid: 'player',
        sourceStageProgressId: 'propose',
        sourceActionCompleted: false,
        targetPlayerUids: ['other-1', 'other-2'],
        responses: {
          'other-1': { status: 'failed', actionCompleted: true },
          'other-2': { status: 'failed', actionCompleted: true }
        }
      }
    };
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      boardState: familyBoard,
      memberUids: ['coach', 'player', 'other-1', 'other-2'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' },
        { uid: 'other-1', name: 'Other 1', role: 'player' },
        { uid: 'other-2', name: 'Other 2', role: 'player' }
      ]
    }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    const playerStateRef = doc(playerDb, 'rooms/room-p0/players/player');
    await assertSucceeds(setDoc(playerStateRef, startupLoanPlayerState('Player')));

    await assertSucceeds(runRoomBoardMutation<boolean, Room>({
      db: playerDb,
      roomId: 'room-p0',
      commandId: 'family-action:family-h014:player:accept',
      playerStateUids: ['player'],
      onDuplicate: () => true,
      mutate: (latestRoom, latestBoard) => ({
        boardState: {
          ...latestBoard,
          familyMilestoneJoinPrompt: {
            ...latestBoard.familyMilestoneJoinPrompt!,
            sourceActionCompleted: true
          }
        },
        roomPatch: {
          playerStates: {
            player: {
              ...latestRoom.playerStates!.player,
              cash: 5000,
              completedHappinessEvents: ['propose']
            }
          }
        },
        result: true
      })
    }));

    await assertSucceeds(runRoomBoardMutation<boolean, Room>({
      db: playerDb,
      roomId: 'room-p0',
      commandId: 'family-complete:family-h014:player',
      playerStateUids: [],
      onDuplicate: () => true,
      mutate: (_latestRoom, latestBoard) => ({
        boardState: {
          ...latestBoard,
          currentCard: null,
          currentEvent: null,
          familyMilestoneJoinPrompt: null
        },
        result: true
      })
    }));

    expect((await getDoc(doc(playerDb, 'rooms/room-p0'))).data()?.boardState.familyMilestoneJoinPrompt).toBeNull();
    expect((await getDoc(playerStateRef)).data()).toMatchObject({
      cash: 5000,
      completedHappinessEvents: ['propose']
    });
  });

  it('allows the final family participant to remove a completed prompt', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    const familyBoard = {
      ...boardState('player'),
      currentCard: { cardId: 'H016', deck: 'happiness' },
      currentEvent: { id: 'event-family-final', playerUid: 'player' },
      familyMilestoneJoinPrompt: {
        id: 'family-final',
        sourceEventId: 'event-family-final',
        sourceCardId: 'H016',
        sourcePlayerUid: 'player',
        sourceActionCompleted: true,
        targetPlayerUids: ['other'],
        responses: { other: { status: 'declined', actionCompleted: true } }
      }
    };
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      boardState: familyBoard,
      memberUids: ['coach', 'player', 'other'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' },
        { uid: 'other', name: 'Other', role: 'player' }
      ]
    }));

    const otherDb = testEnv.authenticatedContext('other').firestore();
    const otherStateRef = doc(otherDb, 'rooms/room-p0/players/other');
    await assertSucceeds(setDoc(otherStateRef, { cash: 10000 }));
    await assertSucceeds(runTransaction(otherDb, async transaction => {
      const roomDocument = doc(otherDb, 'rooms/room-p0');
      await transaction.get(roomDocument);
      await transaction.get(otherStateRef);
      transaction.update(otherStateRef, { cash: 5000 });
      transaction.update(roomDocument, {
        boardState: {
          ...familyBoard,
          currentCard: null,
          currentEvent: null,
          familyMilestoneJoinPrompt: null,
          revision: 1,
          processedCommandIds: ['family-final-complete'],
          updatedAt: 2
        }
      });
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

  it('keeps three concurrent startup loans and closes the prompt once', async () => {
    const members = [
      { uid: 'coach', name: 'Coach', role: 'coach', joinedAt: 1 },
      { uid: 'p1', name: 'P1', role: 'player', joinedAt: 1 },
      { uid: 'p2', name: 'P2', role: 'player', joinedAt: 1 },
      { uid: 'p3', name: 'P3', role: 'player', joinedAt: 1 }
    ] as any[];
    const startupBoard = {
      ...boardState('p1'),
      turnOrder: ['p1', 'p2', 'p3'],
      playerPositions: { p1: 0, p2: 0, p3: 0 },
      skipTurns: { p1: 0, p2: 0, p3: 0 },
      currentCard: { cardId: 'N057', deck: 'news', title: '創業貸款', description: '' },
      currentEvent: {
        id: 'event-loan',
        playerUid: 'p1',
        playerName: 'P1',
        type: 'card',
        summary: '創業貸款',
        squareIndex: 0,
        timestamp: 1
      },
      pendingEvents: [],
      movement: null,
      cardLog: [],
      sharedCardPrompt: {
        id: 'prompt-loan',
        kind: 'startup_loan',
        sourceEventId: 'event-loan',
        sourceCardId: 'N057',
        sourcePlayerUid: 'p1',
        sourcePlayerName: 'P1',
        targetPlayerUids: ['p1', 'p2', 'p3'],
        responses: {},
        createdAt: 1
      }
    } as any;

    await assertSucceeds(setDoc(roomRef('coach', 'startup-room'), room({ id: 'startup-room' })));
    await assertSucceeds(updateDoc(roomRef('coach', 'startup-room'), {
      status: 'playing',
      members,
      memberUids: members.map(member => member.uid),
      sessionId: 'startup-session',
      publicPlayerStates: Object.fromEntries(['p1', 'p2', 'p3'].map(uid => [uid, {
        uid,
        playerName: uid.toUpperCase(),
        isSetup: true,
        selectionStep: 'completed',
        happinessTotal: 0,
        currentRankTitle: ''
      }])),
      boardState: startupBoard
    }));
    const coachDb = testEnv.authenticatedContext('coach').firestore();
    await Promise.all(['p1', 'p2', 'p3'].map(uid =>
      assertSucceeds(setDoc(doc(coachDb, `rooms/startup-room/players/${uid}`), startupLoanPlayerState(uid.toUpperCase())))
    ));

    await testEnv.withSecurityRulesDisabled(async context => {
      const emulatorDb = context.firestore();
      await Promise.all(['p1', 'p2', 'p3'].map(uid => {
        const commandId = `startup-loan:prompt-loan:${uid}`;
        return runRoomBoardMutation<boolean, Room>({
          db: emulatorDb,
          roomId: 'startup-room',
          commandId,
          playerStateUids: [uid],
          onDuplicate: () => true,
          mutate: (latestRoom, latestBoard) => buildStartupLoanPromptMutation(
            latestRoom,
            latestBoard,
            'prompt-loan',
            uid,
            uid.toUpperCase(),
            commandId
          )
        });
      }));
    });

    const finalRoom = (await getDoc(doc(coachDb, 'rooms/startup-room'))).data();
    expect(finalRoom?.boardState.sharedCardPrompt).toBeUndefined();
    expect(finalRoom?.boardState.currentEvent).toBeNull();
    for (const uid of ['p1', 'p2', 'p3']) {
      const state = (await getDoc(doc(coachDb, `rooms/startup-room/players/${uid}`))).data();
      expect(state).toMatchObject({
        cash: 605000,
        pendingStartupUpgradeAction: { cardId: 'N057', symbol: 'N057' }
      });
      expect(state?.assets).toHaveLength(1);
      expect(state?.liabilities).toHaveLength(1);
    }
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

  it('allows a player to publish diagnostics while keeping them coach-readable only', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      memberUids: ['coach', 'player'],
      members: [{ uid: 'coach', name: 'Coach', role: 'coach' }, { uid: 'player', name: 'Player', role: 'player' }]
    }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(setDoc(doc(playerDb, 'rooms/room-p0/diagnostics/player'), {
      uid: 'player',
      sessionId: 'session-1',
      flow: 'family-milestone',
      screen: 'game',
      activeModal: 'family',
      updatedAt: serverTimestamp()
    }));

    const coachDb = testEnv.authenticatedContext('coach').firestore();
    expect((await assertSucceeds(getDoc(doc(coachDb, 'rooms/room-p0/diagnostics/player')))).data()?.flow).toBe('family-milestone');
    await assertFails(getDoc(doc(playerDb, 'rooms/room-p0/diagnostics/player')));
    await assertFails(setDoc(doc(playerDb, 'rooms/room-p0/diagnostics/other'), {
      uid: 'other',
      sessionId: 'session-1',
      flow: 'idle',
      screen: 'game',
      updatedAt: serverTimestamp()
    }));
  });
});

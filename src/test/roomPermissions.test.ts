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
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import type { GameState } from '../types';
import { buildCarPurchaseState, buildSharedAssetSalePromptMutation, buildSharedInvestmentState, buildStartupLoanPromptMutation, type Room } from '../context/RoomContext';
import { runRoomBoardMutation } from '../game/board/runBoardMutation';
import { createInitialDeckState } from '../constants/board';

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

  it('allows an off-turn player to change only their own private state', async () => {
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
    const setupRoomRef = doc(playerDb, 'rooms/room-p0');
    const setupPlayerRef = doc(playerDb, 'rooms/room-p0/players/player');
    await assertSucceeds(runTransaction(playerDb, async transaction => {
      await Promise.all([transaction.get(setupRoomRef), transaction.get(setupPlayerRef)]);
      transaction.set(setupPlayerRef, {
        playerName: 'Player',
        isSetup: true,
        selectionStep: 'completed'
      }, { merge: true });
      transaction.update(setupRoomRef, {
        'publicPlayerStates.player': {
          uid: 'player',
          playerName: 'Player',
          isSetup: true,
          selectionStep: 'completed',
          happinessTotal: 0
        }
      });
    }));
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

  it('allows an off-turn player with an open bank service window to bump the room revision only', async () => {
    const offTurnBoard = {
      ...boardState('player-1'),
      turnOrder: ['player-1', 'player-2'],
      playerPositions: { 'player-1': 0, 'player-2': 0 },
      skipTurns: { 'player-1': 0, 'player-2': 0 }
    };
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      boardState: offTurnBoard,
      memberUids: ['coach', 'player-1', 'player-2'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player-1', name: 'P1', role: 'player' },
        { uid: 'player-2', name: 'P2', role: 'player' }
      ]
    }));

    const coachDb = testEnv.authenticatedContext('coach').firestore();
    await assertSucceeds(setDoc(doc(coachDb, 'rooms/room-p0/players/player-2'), {
      cash: 1,
      bankServiceWindowActive: true
    }));

    const playerTwoDb = testEnv.authenticatedContext('player-2').firestore();

    // 不是自己回合，但銀行服務窗口仍開啟：只異動 revision／processedCommandIds／
    // updatedAt（真正的股票／保險金額變動寫在私有玩家文件），應該成功。
    await assertSucceeds(updateDoc(doc(playerTwoDb, 'rooms/room-p0'), {
      boardState: {
        ...offTurnBoard,
        revision: 1,
        processedCommandIds: ['stock-buy:player-2:1'],
        updatedAt: 2
      }
    }));

    // 銀行服務窗口關閉時，同樣的非本回合更新應該被拒絕。
    await assertSucceeds(setDoc(doc(coachDb, 'rooms/room-p0/players/player-2'), {
      cash: 1,
      bankServiceWindowActive: false
    }));
    await assertFails(updateDoc(doc(playerTwoDb, 'rooms/room-p0'), {
      boardState: {
        ...offTurnBoard,
        revision: 2,
        processedCommandIds: ['stock-buy:player-2:1', 'stock-buy:player-2:2'],
        updatedAt: 3
      }
    }));

    // 銀行服務窗口重新開啟，但同時有一張指名自己回覆的家庭歷程卡片時，
    // 不能被銀行服務窗口繞過，仍應該被拒絕。
    await assertSucceeds(setDoc(doc(coachDb, 'rooms/room-p0/players/player-2'), {
      cash: 1,
      bankServiceWindowActive: true
    }));
    const blockedBoard = {
      ...offTurnBoard,
      familyMilestoneJoinPrompt: {
        sourcePlayerUid: 'player-1',
        sourceEventId: 'evt-1',
        targetPlayerUids: ['player-2'],
        responses: {}
      }
    };
    await assertSucceeds(updateDoc(roomRef('coach'), { boardState: blockedBoard }));
    await assertFails(updateDoc(doc(playerTwoDb, 'rooms/room-p0'), {
      boardState: {
        ...blockedBoard,
        revision: 3,
        processedCommandIds: ['stock-buy:player-2:3'],
        updatedAt: 4
      }
    }));

    // 銀行服務窗口開啟，但更新內容除了 revision 等欄位外還動到其他棋盤欄位，
    // 已經超出銀行服務窗口允許的範圍，應該被拒絕。
    await assertSucceeds(updateDoc(roomRef('coach'), { boardState: offTurnBoard }));
    await assertFails(updateDoc(doc(playerTwoDb, 'rooms/room-p0'), {
      boardState: {
        ...offTurnBoard,
        currentTurnUid: 'player-2',
        revision: 1,
        processedCommandIds: ['stock-buy:player-2:1'],
        updatedAt: 2
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

  it('allows an active room member to purchase a car through the private-state transaction', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      sessionId: 'session-1',
      syncSchemaVersion: 2,
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' }
      ],
      memberUids: ['coach', 'player'],
      boardState: boardState('player')
    }));
    const coachDb = testEnv.authenticatedContext('coach').firestore();
    await assertSucceeds(setDoc(doc(coachDb, 'rooms/room-p0/players/player'), {
      ...startupLoanPlayerState('Player'),
      cash: 200000
    }));

    const db = testEnv.authenticatedContext('player').firestore();
    const commandId = 'car-purchase:session-1:player:event-1';
    const txData = {
      name: '買入汽車',
      amount: 600000,
      cashChange: -120000,
      source: 'loan',
      usage: 'asset',
      assetDetails: { type: '汽車', downPayment: 120000, loanAmount: 480000, loanInterest: 2400 }
    } as any;
    await assertSucceeds(runRoomBoardMutation<boolean, Room>({
      db,
      roomId: 'room-p0',
      commandId,
      playerStateUids: ['player'],
      forcePrivatePlayerStates: true,
      onDuplicate: () => true,
      mutate: (latestRoom, latestBoard) => ({
        boardState: latestBoard,
        roomPatch: {
          playerStates: {
            player: buildCarPurchaseState(latestRoom.playerStates?.player, txData, commandId, 1)
          }
        },
        result: true
      })
    }));

    const savedState = (await getDoc(doc(coachDb, 'rooms/room-p0/players/player'))).data();
    expect(savedState?.cash).toBe(80000);
    expect(savedState?.assets).toContainEqual(expect.objectContaining({ type: '汽車', cost: 600000 }));
    expect(savedState?.liabilities).toContainEqual(expect.objectContaining({ type: '汽車貸款', totalOwed: 480000 }));
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

  it('allows a schema v2 target to fall back to their own declined room response', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    const promptBoard = {
      ...boardState('player'),
      sharedCardPrompt: {
        id: 'prompt-1',
        responseStorage: 'subcollection',
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
          responses: { player: { playerUid: 'player', status: 'declined' } }
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
          responses: { other: { playerUid: 'other', status: 'declined' } }
        },
        updatedAt: 3
      }
    }));
  });

  it('allows a schema v2 non-financial target to create only their own response document', async () => {
    const promptId = 'prompt-v2';
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      memberUids: ['coach', 'player', 'player2'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' },
        { uid: 'player2', name: 'Player 2', role: 'player' }
      ],
      syncSchemaVersion: 2,
      boardState: {
        ...boardState('player'),
        sharedCardPrompt: {
          id: promptId,
          responseStorage: 'subcollection',
          targetPlayerUids: ['player', 'player2'],
          responses: {}
        }
      }
    }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(setDoc(doc(playerDb, `rooms/room-p0/events/${promptId}/responses/player`), {
      promptId,
      playerUid: 'player',
      playerName: 'Player',
      status: 'no_effect',
      note: '沒有符合條件',
      respondedAt: 1,
      commandId: `prompt:shared:response:${promptId}:player`
    }));
    const secondPlayerDb = testEnv.authenticatedContext('player2').firestore();
    await assertSucceeds(setDoc(doc(secondPlayerDb, `rooms/room-p0/events/${promptId}/responses/player2`), {
      promptId,
      playerUid: 'player2',
      playerName: 'Player 2',
      status: 'declined',
      note: '玩家選擇不參與',
      respondedAt: 2,
      commandId: `prompt:shared:response:${promptId}:player2`
    }));
    await assertSucceeds(getDoc(doc(playerDb, `rooms/room-p0/events/${promptId}/responses/player`)));
    await assertFails(getDoc(doc(playerDb, `rooms/room-p0/events/${promptId}/responses/player2`)));
    await assertFails(setDoc(doc(playerDb, `rooms/room-p0/events/${promptId}/responses/other`), {
      promptId,
      playerUid: 'other',
      playerName: 'Other',
      status: 'no_effect',
      respondedAt: 2,
      commandId: `prompt:shared:response:${promptId}:other`
    }));
  });

  it('allows a schema v2 target to create a completed financial response document', async () => {
    const promptId = 'prompt-v2-financial';
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      memberUids: ['coach', 'player'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' }
      ],
      syncSchemaVersion: 2,
      boardState: {
        ...boardState('player'),
        sharedCardPrompt: {
          id: promptId,
          responseStorage: 'subcollection',
          targetPlayerUids: ['player'],
          responses: {}
        }
      }
    }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(setDoc(doc(playerDb, `rooms/room-p0/events/${promptId}/responses/player`), {
      promptId,
      playerUid: 'player',
      playerName: 'Player',
      status: 'completed',
      amount: 1000,
      note: '股利已結算',
      respondedAt: 1,
      commandId: `prompt:shared:response:${promptId}:player`
    }));
  });

  it('commits N055 player finances and their own reply together without reading another reply', async () => {
    const promptId = 'event-n055_N055_shared';
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing', sessionId: 'session-n055', syncSchemaVersion: 2,
      memberUids: ['coach', 'player', 'player2'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' },
        { uid: 'player2', name: 'Player 2', role: 'player' }
      ],
      boardState: {
        ...boardState('player'),
        sharedCardPrompt: {
          id: promptId, kind: 'investment', sourceCardId: 'N055', sourceEventId: 'event-n055',
          responseStorage: 'subcollection', targetPlayerUids: ['player', 'player2'], responses: {}
        }
      }
    }));
    const coachDb = testEnv.authenticatedContext('coach').firestore();
    await assertSucceeds(setDoc(doc(coachDb, 'rooms/room-p0/players/player'), {
      ...startupLoanPlayerState('Player'), cash: 2000000
    }));
    const otherDb = testEnv.authenticatedContext('player2').firestore();
    await assertSucceeds(setDoc(doc(otherDb, `rooms/room-p0/events/${promptId}/responses/player2`), {
      promptId, playerUid: 'player2', playerName: 'Player 2', status: 'declined',
      respondedAt: 1, commandId: `prompt:shared:response:${promptId}:player2`
    }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    const playerRef = doc(playerDb, 'rooms/room-p0/players/player');
    const responseRef = doc(playerDb, `rooms/room-p0/events/${promptId}/responses/player`);
    const commandId = `shared-investment:${promptId}:player`;
    await assertSucceeds(runTransaction(playerDb, async tx => {
      const [roomSnap, playerSnap, responseSnap] = await Promise.all([
        tx.get(doc(playerDb, 'rooms/room-p0')), tx.get(playerRef), tx.get(responseRef)
      ]);
      expect(roomSnap.exists()).toBe(true);
      expect(responseSnap.exists()).toBe(false);
      const result = buildSharedInvestmentState(playerSnap.data() as GameState, 'N055', 1000000, commandId);
      expect(result.status).toBe('applied');
      tx.set(playerRef, result.state!);
      tx.set(responseRef, {
        promptId, playerUid: 'player', playerName: 'Player', status: 'completed',
        amount: 1000000, respondedAt: 2, commandId
      });
    }));
    const playerState = (await getDoc(playerRef)).data() as GameState;
    expect(playerState.cash).toBe(1000000);
    expect(playerState.assets).toHaveLength(1);
    expect((await getDoc(responseRef)).data()?.status).toBe('completed');
    await assertFails(getDoc(doc(playerDb, `rooms/room-p0/events/${promptId}/responses/player2`)));
  });

  it('allows a schema v2 family milestone target to create only its own response document', async () => {
    const promptId = 'prompt-v2-family';
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      memberUids: ['coach', 'player'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' }
      ],
      syncSchemaVersion: 2,
      boardState: {
        ...boardState('player'),
        familyMilestoneJoinPrompt: {
          id: promptId,
          responseStorage: 'subcollection',
          sourceEventId: 'event-family',
          sourceCardId: 'H011',
          sourcePlayerUid: 'player',
          sourcePlayerName: 'Player',
          requiredRoll: 4,
          targetPlayerUids: ['player'],
          responses: {},
          sourceActionCompleted: false
        }
      }
    }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(setDoc(doc(playerDb, `rooms/room-p0/events/${promptId}/responses/player`), {
      promptId,
      playerUid: 'player',
      playerName: 'Player',
      status: 'failed',
      actionCompleted: true,
      roll: 2,
      respondedAt: 1,
      commandId: `prompt:family:response:${promptId}:player`
    }));
    await assertFails(setDoc(doc(playerDb, `rooms/room-p0/events/${promptId}/responses/other`), {
      promptId,
      playerUid: 'other',
      playerName: 'Other',
      status: 'failed',
      actionCompleted: true,
      roll: 2,
      respondedAt: 2,
      commandId: `prompt:family:response:${promptId}:other`
    }));
  });

  it('commits a schema v2 family source action and participant result without reading another player response', async () => {
    const promptId = 'family-v2-transaction';
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing', syncSchemaVersion: 2,
      memberUids: ['coach', 'player', 'other-1', 'other-2'],
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' },
        { uid: 'other-1', name: 'Other 1', role: 'player' },
        { uid: 'other-2', name: 'Other 2', role: 'player' }
      ],
      boardState: {
        ...boardState('player'),
        currentCard: { cardId: 'H013', deck: 'happiness' },
        currentEvent: { id: 'event-family-v2', playerUid: 'player' },
        familyMilestoneJoinPrompt: {
          id: promptId, sourceEventId: 'event-family-v2', sourceCardId: 'H013',
          sourcePlayerUid: 'player', sourcePlayerName: 'Player',
          sourceActionCompleted: false, requiredRoll: 4,
          targetPlayerUids: ['other-1', 'other-2'],
          responses: {}, responseStorage: 'subcollection'
        }
      }
    }));

    const coachDb = testEnv.authenticatedContext('coach').firestore();
    await assertSucceeds(setDoc(doc(coachDb, 'rooms/room-p0/players/player'), startupLoanPlayerState('Player')));
    await assertSucceeds(setDoc(doc(coachDb, 'rooms/room-p0/players/other-1'), startupLoanPlayerState('Other 1')));
    const other2Db = testEnv.authenticatedContext('other-2').firestore();
    const declinedResponse = {
      playerUid: 'other-2', playerName: 'Other 2', status: 'declined' as const,
      actionCompleted: true, respondedAt: 1
    };
    await assertSucceeds(runRoomBoardMutation<boolean, Room>({
      db: other2Db, roomId: 'room-p0',
      commandId: `prompt:family:response:${promptId}:other-2`,
      responseReadUid: 'other-2', onDuplicate: () => true,
      mutate: (_latestRoom, latestBoard) => ({
        boardState: {
          ...latestBoard,
          familyMilestoneJoinPrompt: {
            ...latestBoard.familyMilestoneJoinPrompt!,
            responses: { ...latestBoard.familyMilestoneJoinPrompt!.responses, 'other-2': declinedResponse }
          }
        },
        sharedResponse: { uid: 'other-2', response: declinedResponse },
        result: true
      })
    }));

    const playerDb = testEnv.authenticatedContext('player').firestore();
    const sourceRef = doc(playerDb, 'rooms/room-p0/players/player');
    await assertSucceeds(runRoomBoardMutation<boolean, Room>({
      db: playerDb, roomId: 'room-p0',
      commandId: `family-action:${promptId}:player:accept`,
      playerStateUids: ['player'], forcePrivatePlayerStates: true,
      responseReadUid: 'player', onDuplicate: () => true,
      mutate: (latestRoom, latestBoard) => ({
        boardState: {
          ...latestBoard,
          familyMilestoneJoinPrompt: { ...latestBoard.familyMilestoneJoinPrompt!, sourceActionCompleted: true }
        },
        roomPatch: { playerStates: { player: { ...latestRoom.playerStates!.player, cash: 7000, happinessTotal: 2 } } },
        result: true
      })
    }));

    const other1Db = testEnv.authenticatedContext('other-1').firestore();
    const other1Ref = doc(other1Db, 'rooms/room-p0/players/other-1');
    const responseRef = doc(other1Db, `rooms/room-p0/events/${promptId}/responses/other-1`);
    const response = {
      playerUid: 'other-1', playerName: 'Other 1', status: 'passed' as const,
      actionCompleted: false, stageProgressId: 'propose', roll: 5, respondedAt: 2
    };
    await assertSucceeds(runRoomBoardMutation<boolean, Room>({
      db: other1Db, roomId: 'room-p0',
      commandId: `prompt:family:response:${promptId}:other-1`,
      responseReadUid: 'other-1', onDuplicate: () => true,
      mutate: (_latestRoom, latestBoard) => ({
        boardState: {
          ...latestBoard,
          familyMilestoneJoinPrompt: {
            ...latestBoard.familyMilestoneJoinPrompt!,
            responses: { ...latestBoard.familyMilestoneJoinPrompt!.responses, 'other-1': response }
          }
        },
        sharedResponse: { uid: 'other-1', response },
        result: true
      })
    }));
    await assertFails(getDoc(doc(other1Db, `rooms/room-p0/events/${promptId}/responses/other-2`)));

    const completeAction = () => runRoomBoardMutation<boolean, Room>({
      db: other1Db, roomId: 'room-p0',
      commandId: `family-action:${promptId}:other-1:accept`,
      playerStateUids: ['other-1'], forcePrivatePlayerStates: true,
      responseReadUid: 'other-1', onDuplicate: () => true,
      mutate: (latestRoom, latestBoard) => {
        const nextResponse = { ...latestBoard.familyMilestoneJoinPrompt!.responses['other-1'], actionCompleted: true };
        return {
          boardState: {
            ...latestBoard,
            familyMilestoneJoinPrompt: {
              ...latestBoard.familyMilestoneJoinPrompt!,
              responses: { ...latestBoard.familyMilestoneJoinPrompt!.responses, 'other-1': nextResponse }
            }
          },
          roomPatch: { playerStates: { 'other-1': { ...latestRoom.playerStates!['other-1'], cash: 5000, happinessTotal: 2 } } },
          sharedResponse: { uid: 'other-1', response: nextResponse },
          result: true
        };
      }
    });
    await assertSucceeds(completeAction());
    await assertSucceeds(completeAction());

    expect((await getDoc(sourceRef)).data()).toMatchObject({ cash: 7000, happinessTotal: 2 });
    expect((await getDoc(other1Ref)).data()).toMatchObject({ cash: 5000, happinessTotal: 2 });
    expect((await getDoc(responseRef)).data()).toMatchObject({ status: 'passed', actionCompleted: true });
    await assertFails(updateDoc(responseRef, { roll: 6 }));
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

  it('allows the final family participant to skip first, then remove the completed prompt', async () => {
    const familyBoard = {
      ...boardState('player'),
      currentCard: { cardId: 'H011', deck: 'happiness' },
      currentEvent: { id: 'event-family-skip', playerUid: 'player' },
      familyMilestoneJoinPrompt: {
        id: 'family-skip',
        sourceEventId: 'event-family-skip',
        sourceCardId: 'H011',
        sourcePlayerUid: 'player',
        sourceActionCompleted: true,
        targetPlayerUids: ['other'],
        responses: {}
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

    const otherDb = testEnv.authenticatedContext('other').firestore();
    const roomDocument = doc(otherDb, 'rooms/room-p0');
    await assertSucceeds(updateDoc(roomDocument, {
      boardState: {
        ...familyBoard,
        familyMilestoneJoinPrompt: {
          ...familyBoard.familyMilestoneJoinPrompt,
          responses: {
            other: { status: 'declined', actionCompleted: true }
          }
        },
        revision: 1,
        processedCommandIds: ['family-response'],
        updatedAt: 2
      }
    }));

    await assertSucceeds(updateDoc(roomDocument, {
      boardState: {
        ...familyBoard,
        familyMilestoneJoinPrompt: null,
        revision: 2,
        processedCommandIds: ['family-response', 'family-finalize'],
        updatedAt: 3
      }
    }));
  });

  it('allows the source player to atomically finish their family event with their result', async () => {
    const familyBoard = {
      ...boardState('player'),
      deckState: createInitialDeckState(),
      pendingEvents: [],
      realEstateMarket: [],
      cardLog: [],
      currentCard: { cardId: 'H011', deck: 'happiness' },
      currentEvent: { id: 'event-family-atomic', playerUid: 'player' },
      familyMilestoneJoinPrompt: {
        id: 'family-atomic',
        sourceEventId: 'event-family-atomic',
        sourceCardId: 'H011',
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
    await assertSucceeds(setDoc(roomRef('coach'), room({
      financialAcceleration: { multiplier: 1 },
      financialSubsidy: {
        sequence: 1,
        amount: 1000000,
        grantedAt: 1,
        grantedByUid: 'coach',
        playerUids: ['player', 'other-1', 'other-2']
      },
      publicPlayerStates: {
        player: { uid: 'player', isSetup: true, happinessTotal: 0 },
        'other-1': { uid: 'other-1', isSetup: true, happinessTotal: 0 },
        'other-2': { uid: 'other-2', isSetup: true, happinessTotal: 0 }
      }
    })));
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
      commandId: 'family-action:family-atomic:player:accept',
      playerStateUids: ['player'],
      onDuplicate: () => true,
      mutate: (latestRoom, latestBoard) => ({
        boardState: {
          ...latestBoard,
          currentCard: null,
          currentEvent: null,
          familyMilestoneJoinPrompt: null
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

    const finalRoom = (await getDoc(doc(playerDb, 'rooms/room-p0'))).data();
    expect(finalRoom?.boardState.familyMilestoneJoinPrompt).toBeNull();
    expect((await getDoc(playerStateRef)).data()).toMatchObject({
      cash: 5000,
      completedHappinessEvents: ['propose']
    });
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

  it('persists shared studio sales for each participant under the room rules', async () => {
    const members = [
      { uid: 'coach', name: 'Coach', role: 'coach', joinedAt: 1 },
      { uid: 'p1', name: 'P1', role: 'player', joinedAt: 1 },
      { uid: 'p2', name: 'P2', role: 'player', joinedAt: 1 }
    ] as any[];
    const saleBoard = {
      ...boardState('p1'),
      turnOrder: ['p1', 'p2'],
      playerPositions: { p1: 0, p2: 0 },
      skipTurns: { p1: 0, p2: 0 },
      currentCard: { cardId: 'C027', deck: 'opportunity', title: '收購獨特的創業點子', description: '' },
      currentEvent: {
        id: 'event-sale',
        playerUid: 'p1',
        playerName: 'P1',
        type: 'card',
        summary: '收購獨特的創業點子',
        squareIndex: 0,
        timestamp: 1
      },
      pendingEvents: [],
      movement: null,
      cardLog: [],
      sharedCardPrompt: {
        id: 'prompt-sale',
        kind: 'asset_sale',
        sourceEventId: 'event-sale',
        sourceCardId: 'C027',
        sourcePlayerUid: 'p1',
        sourcePlayerName: 'P1',
        targetPlayerUids: ['p1', 'p2'],
        responses: {},
        createdAt: 1
      }
    };
    const playerState = (uid: string): GameState => ({
      ...startupLoanPlayerState(uid.toUpperCase()),
      assets: [{
        id: `studio-${uid}`,
        name: '兼職工作室 (C027)',
        cost: 5000,
        downPayment: 5000,
        cashflow: 0,
        type: '企業',
        isUpgraded: false
      } as any]
    });

    const coachDb = testEnv.authenticatedContext('coach').firestore();
    await assertSucceeds(setDoc(roomRef('coach', 'sale-room'), room({ id: 'sale-room' })));
    await assertSucceeds(updateDoc(doc(coachDb, 'rooms/sale-room'), {
      status: 'playing',
      members,
      memberUids: members.map(member => member.uid),
      publicPlayerStates: { p1: { uid: 'p1', isSetup: true }, p2: { uid: 'p2', isSetup: true } },
      boardState: saleBoard
    }));
    await Promise.all(['p1', 'p2'].map(uid =>
      assertSucceeds(setDoc(doc(coachDb, `rooms/sale-room/players/${uid}`), playerState(uid)))
    ));

    for (const uid of ['p1', 'p2']) {
      const playerDb = testEnv.authenticatedContext(uid).firestore();
      await assertSucceeds(runRoomBoardMutation<unknown, Room>({
        db: playerDb,
        roomId: 'sale-room',
        commandId: `shared-asset-sale:prompt-sale:${uid}`,
        playerStateUids: [uid],
        onDuplicate: () => ({ status: 'duplicate' }),
        mutate: (latestRoom, latestBoard) => buildSharedAssetSalePromptMutation(
          latestRoom,
          latestBoard,
          'prompt-sale',
          uid,
          uid.toUpperCase(),
          [`studio-${uid}`],
          `shared-asset-sale:prompt-sale:${uid}`,
          10
        )
      }));
    }

    const finalRoom = (await getDoc(doc(coachDb, 'rooms/sale-room'))).data();
    expect(finalRoom?.boardState.sharedCardPrompt).toBeUndefined();
    for (const uid of ['p1', 'p2']) {
      const state = (await getDoc(doc(coachDb, `rooms/sale-room/players/${uid}`))).data();
      expect(state).toMatchObject({ cash: 3010000 });
      expect(state?.assets).toEqual([]);
      expect(state?.history).toHaveLength(1);
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

  it('isolates new approval requests in the room subcollection', async () => {
    await assertSucceeds(setDoc(roomRef('coach'), room()));
    await assertSucceeds(updateDoc(roomRef('coach'), {
      status: 'playing',
      sessionId: 'session-1',
      members: [
        { uid: 'coach', name: 'Coach', role: 'coach' },
        { uid: 'player', name: 'Player', role: 'player' },
        { uid: 'other', name: 'Other', role: 'player' }
      ],
      memberUids: ['coach', 'player', 'other']
    }));

    const requestId = 'request_session-1_happiness_player_event-1_H009';
    const request = {
      id: requestId,
      uid: 'player',
      playerName: 'Player',
      type: 'happiness',
      amount: 1,
      timestamp: 1,
      status: 'pending',
      boardEventId: 'event-1',
      boardCardId: 'H009',
      sessionId: 'session-1'
    };
    const playerDb = testEnv.authenticatedContext('player').firestore();
    await assertSucceeds(setDoc(doc(playerDb, `rooms/room-p0/pendingRequests/${requestId}`), request));
    await assertSucceeds(getDoc(doc(playerDb, `rooms/room-p0/pendingRequests/${requestId}`)));
    await assertFails(getDoc(doc(playerDb, 'rooms/room-p0/pendingRequests/other-request')));

    const coachDb = testEnv.authenticatedContext('coach').firestore();
    await assertSucceeds(updateDoc(doc(coachDb, `rooms/room-p0/pendingRequests/${requestId}`), { status: 'approved' }));
    await assertFails(updateDoc(doc(playerDb, `rooms/room-p0/pendingRequests/${requestId}`), { status: 'rejected' }));
    await assertSucceeds(deleteDoc(doc(playerDb, `rooms/room-p0/pendingRequests/${requestId}`)));
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

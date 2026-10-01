import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getPromptResponseFieldPatch, isRetryableBoardTransactionError, runBoardTransactionWithRetry, runRoomBoardMutation, shouldUsePrivatePlayerStates } from './runBoardMutation';
import type { BoardState } from '../../types';
import type { Firestore } from 'firebase/firestore';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), readServer:vi.fn(), set: vi.fn(), update: vi.fn(), track: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => args.slice(1).join('/'),
  getDocFromServer:mocks.readServer,
  runTransaction: (_db: unknown, callback: (tx: typeof mocks) => unknown) => callback(mocks)
}));
vi.mock('../../utils/telemetry', () => ({ trackGameEvent: mocks.track, trackBoardStage: vi.fn() }));

describe('board mutation outcomes', () => {
  const board = { revision: 1, processedCommandIds: [] } as unknown as BoardState;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readServer.mockRejectedValue({code:"unavailable"});
    mocks.track.mockResolvedValue(undefined);
    mocks.get.mockResolvedValue({ exists: () => true, data: () => ({ isBoardGame: true, boardState: board }) });
  });
  it.each(['skipped', 'committed', 'duplicate'] as const)('reports %s without inventing writes', async outcome => {
    const commandId = 'repair:test';
    if (outcome === 'duplicate') mocks.get.mockResolvedValue({
      exists: () => true,
      data: () => ({ isBoardGame: true, boardState: { ...board, processedCommandIds: [commandId] } })
    });
    const mutate = vi.fn((_room, latest: BoardState) => ({
      boardState: outcome === 'committed' ? { ...latest, updatedAt: 2 } : latest,
      commit: outcome !== 'skipped',
      result: true
    }));
    await runRoomBoardMutation({ db: {} as Firestore, roomId: 'test', commandId, onDuplicate: () => true, mutate });
    expect(mocks.update).toHaveBeenCalledTimes(outcome === 'committed' ? 1 : 0);
    expect(mocks.set).not.toHaveBeenCalled();
    if (outcome === 'duplicate') expect(mutate).not.toHaveBeenCalled();
    expect(mocks.track).toHaveBeenCalledWith('board_command', expect.objectContaining({
      result: outcome, attempts: 1, scheduled_writes: outcome === 'committed' ? 1 : 0
    }));
  });
  it('preserves transaction errors even if analytics fails', async () => {
    const error = new Error('permission denied');
    mocks.get.mockRejectedValue(error);
    mocks.track.mockRejectedValue(new Error('analytics offline'));
    await expect(runRoomBoardMutation({
      db: {} as Firestore, roomId: 'test', commandId: 'repair:test', onDuplicate: () => false,
      mutate: () => ({ boardState: board, result: true })
    })).rejects.toBe(error);
    expect(mocks.track).toHaveBeenCalledWith('board_command', expect.objectContaining({ result: 'failed' }));
  });
  it('retries an explicitly allowed concurrent shared-response rejection', async () => {
    mocks.get.mockRejectedValueOnce({ code: 'permission-denied', message: 'evaluation error at L399' });
    mocks.get.mockResolvedValue({ exists: () => true, data: () => ({ isBoardGame: true, boardState: board }) });

    await runRoomBoardMutation({
      db: {} as Firestore,
      roomId: 'test',
      commandId: 'prompt:shared:response:test:player-1',
      retryOnPermissionDenied: true,
      onDuplicate: () => true,
      mutate: () => ({ boardState: { ...board, updatedAt: 2 }, result: true })
    });

    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
  it('retries numeric Firestore permission-denied codes', async () => {
    mocks.get.mockRejectedValueOnce({ code: 7, status: 403 });
    mocks.get.mockResolvedValue({ exists: () => true, data: () => ({ isBoardGame: true, boardState: board }) });

    await runRoomBoardMutation({
      db: {} as Firestore,
      roomId: 'test',
      commandId: 'prompt:shared:response:test:player-1',
      retryOnPermissionDenied: true,
      onDuplicate: () => true,
      mutate: () => ({ boardState: { ...board, updatedAt: 2 }, result: true })
    });

    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
  it('skips an implicit no-op without consuming a board revision', async () => {
    const mutate = vi.fn(() => ({ boardState: board, roomPatch: {}, result: true }));
    await runRoomBoardMutation({
      db: {} as Firestore,
      roomId: 'test',
      commandId: 'noop:test',
      onDuplicate: () => true,
      mutate
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.track).toHaveBeenCalledWith('board_command', expect.objectContaining({
      result: 'skipped',
      scheduled_writes: 0
    }));
  });
  it('writes only the new shared response instead of replacing the response map', async () => {
    const previousBoard = {
      ...board,
      sharedCardPrompt: {
        id: 'prompt-1',
        kind: 'cash_dividend',
        sourceEventId: 'event-1',
        sourceCardId: 'N027',
        sourcePlayerUid: 'source',
        sourcePlayerName: '玩家',
        targetPlayerUids: ['player-1', 'player-2'],
        responses: { 'player-1': { status: 'no_effect' } },
        createdAt: 1
      }
    } as unknown as BoardState;
    mocks.get.mockResolvedValue({ exists: () => true, data: () => ({ isBoardGame: true, boardState: previousBoard }) });

    await runRoomBoardMutation({
      db: {} as Firestore,
      roomId: 'test',
      commandId: 'prompt:shared:response:prompt-1:player-2',
      onDuplicate: () => true,
      mutate: (_room, latestBoard) => ({
        boardState: {
          ...latestBoard,
          revision: (latestBoard.revision || 0) + 1,
          sharedCardPrompt: {
            ...latestBoard.sharedCardPrompt!,
            responses: {
              ...latestBoard.sharedCardPrompt!.responses,
              'player-2': { status: 'no_effect' }
            }
          }
        },
        result: true
      })
    });

    expect(mocks.update).toHaveBeenCalledWith('rooms/test', expect.objectContaining({
      'boardState.sharedCardPrompt.responses.player-2': { status: 'no_effect' },
      'boardState.revision': 3
    }));
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('boardState');
  });

  it('writes schema v2 shared responses to the response subcollection', async () => {
    const previousBoard = {
      ...board,
      sharedCardPrompt: {
        id: 'prompt-v2',
        kind: 'cash_dividend',
        sourceEventId: 'event-v2',
        sourceCardId: 'N027',
        sourcePlayerUid: 'source',
        sourcePlayerName: '玩家',
        targetPlayerUids: ['player-1', 'player-2'],
        responses: {},
        responseStorage: 'subcollection',
        createdAt: 1
      }
    } as unknown as BoardState;
    mocks.get.mockImplementation(async (ref: string) => {
      if (ref === 'rooms/test') {
        return { exists: () => true, data: () => ({ isBoardGame: true, syncSchemaVersion: 2, boardState: previousBoard }) };
      }
      if (ref.endsWith('/player-1')) {
        return { exists: () => true, data: () => ({ playerUid: 'player-1', status: 'declined' }) };
      }
      return { exists: () => false, data: () => undefined };
    });

    await runRoomBoardMutation({
      db: {} as Firestore,
      roomId: 'test',
      commandId: 'prompt:shared:response:prompt-v2:player-2',
      onDuplicate: () => true,
      mutate: (_room, latestBoard) => ({
        boardState: {
          ...latestBoard,
          revision: (latestBoard.revision || 0) + 1,
          sharedCardPrompt: {
            ...latestBoard.sharedCardPrompt!,
            responses: {
              ...latestBoard.sharedCardPrompt!.responses,
              'player-2': { status: 'completed', amount: 1000 }
            }
          }
        },
        result: true
      })
    });

    expect(mocks.set).toHaveBeenCalledWith(
      'rooms/test/events/prompt-v2/responses/player-2',
      expect.objectContaining({ promptId: 'prompt-v2', playerUid: 'player-2', status: 'completed' })
    );
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('boardState.sharedCardPrompt.responses.player-2');
  });

  it('writes the final schema v2 response even when the prompt closes', async () => {
    const previousBoard = {
      ...board,
      sharedCardPrompt: {
        id: 'prompt-final',
        kind: 'cash_dividend',
        sourceEventId: 'event-final',
        sourceCardId: 'N027',
        sourcePlayerUid: 'source',
        sourcePlayerName: '玩家',
        targetPlayerUids: ['player-1'],
        responses: {},
        responseStorage: 'subcollection',
        createdAt: 1
      }
    } as unknown as BoardState;
    mocks.get.mockImplementation(async (ref: string) => {
      if (ref === 'rooms/test') {
        return { exists: () => true, data: () => ({ isBoardGame: true, syncSchemaVersion: 2, boardState: previousBoard }) };
      }
      return { exists: () => false, data: () => undefined };
    });

    await runRoomBoardMutation({
      db: {} as Firestore,
      roomId: 'test',
      commandId: 'prompt:shared:response:prompt-final:player-1',
      onDuplicate: () => true,
      mutate: (_room, latestBoard) => ({
        boardState: { ...latestBoard, revision: (latestBoard.revision || 0) + 1, sharedCardPrompt: undefined },
        sharedResponse: {
          uid: 'player-1',
          response: { playerUid: 'player-1', playerName: '玩家', status: 'completed', respondedAt: 2 }
        },
        result: true
      })
    });

    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith(
      'rooms/test/events/prompt-final/responses/player-1',
      expect.objectContaining({ promptId: 'prompt-final', playerUid: 'player-1', status: 'completed' })
    );
  });
});

describe('board transaction retries', () => {
  it('retries a version conflict with the same logical operation', async () => {
    let attempts = 0;
    const commandId = 'coach-card-test:H013:player-1:operation-1';

    const result = await runBoardTransactionWithRetry(async () => {
      attempts += 1;
      expect(commandId).toBe('coach-card-test:H013:player-1:operation-1');
      if (attempts === 1) {
        throw { code: 'failed-precondition', message: 'the stored version does not match the required base version' };
      }
      return 'committed';
    });

    expect(result).toBe('committed');
    expect(attempts).toBe(2);
  });

  it('survives several concurrent version conflicts before committing', async () => {
    let attempts = 0;

    const result = await runBoardTransactionWithRetry(async () => {
      attempts += 1;
      if (attempts < 6) {
        throw { code: 'failed-precondition', message: 'the stored version does not match the required base version' };
      }
      return 'committed';
    });

    expect(result).toBe('committed');
    expect(attempts).toBe(6);
  });

  it('retries a Firestore failed-precondition without a version message', async () => {
    let attempts = 0;
    await expect(runBoardTransactionWithRetry(async () => {
      attempts += 1;
      if (attempts === 1) throw { code: 'failed-precondition' };
      return 'committed';
    })).resolves.toBe('committed');
    expect(attempts).toBe(2);
  });

  it('does not retry non-version errors', async () => {
    let attempts = 0;
    const error = new Error('目前玩家不在房間內');

    await expect(runBoardTransactionWithRetry(async () => {
      attempts += 1;
      throw error;
    })).rejects.toBe(error);

    expect(attempts).toBe(1);
    expect(isRetryableBoardTransactionError(error)).toBe(false);
  });

  it('uses private player documents for empty or explicitly migrated room state', () => {
    expect(shouldUsePrivatePlayerStates(undefined)).toBe(true);
    expect(shouldUsePrivatePlayerStates({})).toBe(true);
    expect(shouldUsePrivatePlayerStates({ player1: {} })).toBe(false);
    expect(shouldUsePrivatePlayerStates({ player1: {} }, true)).toBe(true);
  });
});

it('does not read unrelated responses for dice/reveal/settlement commands', async () => {
  vi.clearAllMocks();
  const board = { revision: 0, processedCommandIds: [], sharedCardPrompt: { id: 'p', responseStorage: 'subcollection', targetPlayerUids: ['other'], responses: {} } } as unknown as BoardState;
  mocks.get.mockResolvedValue({ exists: () => true, data: () => ({ isBoardGame: true, boardState: board }) });
  await runRoomBoardMutation({ db: {} as Firestore, roomId: 'test', commandId: 'roll:p:0', readPromptResponses: false,
    onDuplicate: () => true, mutate: () => ({ boardState: board, commit: false, result: true }) });
  expect(mocks.get).toHaveBeenCalledTimes(1);
  expect(mocks.get).toHaveBeenCalledWith('rooms/test');
});

it.each([undefined, 'player'])('does not read unrelated response documents (own scope %s)', async ownUid => {
  vi.clearAllMocks();
  const board = { revision: 0, processedCommandIds: [], sharedCardPrompt: {
    id: 'shared', responseStorage: 'subcollection', targetPlayerUids: ['player', 'other'], responses: {}
  }} as unknown as BoardState;
  mocks.get.mockImplementation(async (path: string) => {
    if (path === 'rooms/scoped') return {exists:()=>true,data:()=>({isBoardGame:true,boardState:board})};
    if (path.endsWith('/other')) throw {code:'permission-denied'};
    return {exists:()=>false};
  });
  await expect(runRoomBoardMutation({db:{} as Firestore,roomId:'scoped',commandId:'loan:test',
    responseReadUid:ownUid,onDuplicate:()=>true,mutate:()=>({boardState:board,commit:false,result:true})})).resolves.toBe(true);
  expect(mocks.get).toHaveBeenCalledTimes(ownUid ? 2 : 1);
});

it.each(['deadline-exceeded','permission-denied'])('recovers a committed board command after %s by reading the server result',async(code)=>{
 const board={revision:2,processedCommandIds:['advance:bank']} as unknown as BoardState;
 mocks.get.mockRejectedValue({code});
 mocks.readServer.mockResolvedValue({exists:()=>true,data:()=>({sessionId:'s',isBoardGame:true,boardState:board})});
 const duplicate=vi.fn(()=>true),mutate=vi.fn();
 expect(await runRoomBoardMutation({db:{} as Firestore,roomId:'test',sessionId:'s',commandId:'advance:bank',onDuplicate:duplicate,mutate})).toBe(true);
 expect(duplicate).toHaveBeenCalledTimes(1);expect(mutate).not.toHaveBeenCalled();
 expect(mocks.track).toHaveBeenCalledWith('board_command',expect.objectContaining({result:'duplicate'}));
});

it.each([false, true])('hydrates family replies only for an explicit finalizer (read all: %s)', async readPromptResponses => {
  vi.clearAllMocks();
  const board = { revision: 0, processedCommandIds: [], familyMilestoneJoinPrompt: {
    id: 'family', responseStorage: 'subcollection', sourceActionCompleted: true,
    targetPlayerUids: ['peer1', 'peer2'], responses: {}
  }} as unknown as BoardState;
  mocks.get.mockImplementation(async (path: string) => path === 'rooms/family-room'
    ? { exists: () => true, data: () => ({ isBoardGame: true, boardState: board }) }
    : { id: path.split('/').at(-1), exists: () => true, data: () => ({ status: 'failed', actionCompleted: true }) });
  const completed = await runRoomBoardMutation({ db: {} as Firestore, roomId: 'family-room',
    commandId: 'prompt:family:finalize:family:coach', readPromptResponses,
    onDuplicate: () => true, mutate: (_room, latest) => ({ boardState: latest, commit: false,
      result: latest.familyMilestoneJoinPrompt!.targetPlayerUids.every(uid => latest.familyMilestoneJoinPrompt!.responses[uid]?.actionCompleted === true) }) });
  expect(completed).toBe(readPromptResponses);
  expect(mocks.get).toHaveBeenCalledTimes(readPromptResponses ? 3 : 1);
});

it('commits a family reply without advancing the board, and rejects board changes in that scope', async () => {
  vi.clearAllMocks();
  const board = { revision: 5, processedCommandIds: [], familyMilestoneJoinPrompt: {
    id: 'family', responseStorage: 'subcollection', targetPlayerUids: ['peer'], responses: {}
  }} as unknown as BoardState;
  mocks.get.mockImplementation(async (path: string) => path === 'rooms/reply-only'
    ? { exists: () => true, data: () => ({ isBoardGame: true, boardState: board }) }
    : { id: 'peer', exists: () => true, data: () => ({ status: 'passed', actionCompleted: false }) });
  const params = { db: {} as Firestore, roomId: 'reply-only', commandId: 'family-action:peer',
    responseReadUid: 'peer', writeBoardState: false, onDuplicate: () => true };
  await runRoomBoardMutation({ ...params, mutate: (_room, latest) => ({ boardState: latest,
    sharedResponse: { uid: 'peer', response: { ...latest.familyMilestoneJoinPrompt!.responses.peer, actionCompleted: true } }, result: true }) });
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.set).toHaveBeenCalledWith('rooms/reply-only/events/family/responses/peer', expect.objectContaining({ actionCompleted: true }));
  await expect(runRoomBoardMutation({ ...params, commandId: 'invalid',
    mutate: (_room, latest) => ({ boardState: { ...latest, updatedAt: 9 }, result: true })
  })).rejects.toThrow('回覆交易不可變更棋盤狀態');
});

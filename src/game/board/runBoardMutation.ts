import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import { BoardState, FamilyMilestoneJoinResponse, SharedCardPromptResponse } from '../../types';
import { cleanObject } from '../../utils/utils';
import { hasPublicPlayerStateChanged, toPublicPlayerState } from '../../utils/playerState';
import { trackGameEvent } from '../../utils/telemetry';
import { applyBoardCommand, requireBoardRevision } from './boardRevision';

const setNestedValue = (target: Record<string, any>, path: string[], value: unknown) => {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  return { ...target, [key]: rest.length ? setNestedValue(target?.[key] || {}, rest, value) : value };
};

const sameSerializedValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const serializedByteLength = (value: unknown): number => {
  const serialized = JSON.stringify(value);
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(serialized).length;
  return serialized.length;
};

export interface BoardRoomSnapshot {
  hostId?: string;
  members?: Array<{ uid: string; isLeft?: boolean }>;
  status?: 'waiting' | 'playing' | 'finished';
  isTimerPaused?: boolean;
  sessionId?: string;
  isBoardGame?: boolean;
  boardState?: BoardState | null;
  playerStates?: Record<string, any>;
  marketPrices?: Record<string, number>;
  previousMarketPrices?: Record<string, number>;
  marketUpdates?: {
    updates: Record<string, number>;
    code: string;
    isBubble?: boolean;
    timestamp?: number;
  };
  publicPlayerStates?: Record<string, unknown>;
  pendingRequests?: Record<string, { boardEventId?: string; type?: string }>;
  syncSchemaVersion?: number;
}

export interface RunRoomBoardMutationParams<T, R extends BoardRoomSnapshot> {
    db: Firestore;
    roomId: string;
    commandId: string;
    /** Stable trace shared by the UI intent and its transaction telemetry. */
    traceId?: string;
  expectedRevision?: number;
  playerStateUids?: string[];
  /** Player commands may read only their own v2 prompt response; the coach omits this to finalize all responses. */
  responseReadUid?: string;
  /** Use private player documents even while a legacy room field is present. */
  forcePrivatePlayerStates?: boolean;
  /** Retry the legacy shared-response map after a concurrent Rules rejection. */
  retryOnPermissionDenied?: boolean;
  onDuplicate: (latestRoom: R) => T;
  mutate: (latestRoom: R, boardState: BoardState) => {
    boardState: BoardState;
    roomPatch?: Record<string, unknown>;
    sharedResponse?: { uid: string; response: SharedCardPromptResponse | FamilyMilestoneJoinResponse | Record<string, unknown> };
    commit?: boolean;
    result: T;
  };
}

export const shouldUsePrivatePlayerStates = (
  playerStates: Record<string, unknown> | undefined,
  forcePrivate = false
): boolean => forcePrivate || !playerStates || Object.keys(playerStates).length === 0;

const BOARD_TRANSACTION_MAX_ATTEMPTS = 6;
const BOARD_TRANSACTION_RETRY_DELAYS_MS = [50, 100, 200, 400, 800];

export const isRetryableBoardTransactionError = (error: unknown): boolean => {
  const candidate = error as { code?: unknown; message?: unknown };
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  return candidate?.code === 'aborted'
    || (candidate?.code === 'failed-precondition' && (!message || /stored version|base version/i.test(message)));
};

const isPermissionDeniedBoardTransactionError = (error: unknown): boolean => {
  const candidate = error as { code?: unknown; status?: unknown };
  return candidate?.code === 'permission-denied' || candidate?.code === 7 || candidate?.status === 403;
};

type PromptResponseBoardKey = 'familyMilestoneJoinPrompt' | 'sharedCardPrompt';

/**
 * Keep concurrent response writes field-scoped. Updating the whole legacy
 * response map lets one player's stale transaction erase another player's
 * response and is correctly rejected by the Rules.
 */
export const getPromptResponseFieldPatch = (
  previousBoard: BoardState,
  nextBoard: BoardState
): Record<string, unknown> | null => {
  const boardWithoutCommandMetadata = (board: BoardState) => {
    const { revision: _revision, processedCommandIds: _processedCommandIds, updatedAt: _updatedAt, ...rest } = board;
    return rest;
  };

  for (const key of ['familyMilestoneJoinPrompt', 'sharedCardPrompt'] as PromptResponseBoardKey[]) {
    const previousPrompt = previousBoard[key];
    const nextPrompt = nextBoard[key];
    if (!previousPrompt || !nextPrompt || previousPrompt.id !== nextPrompt.id) continue;

    const previousResponses = previousPrompt.responses || {};
    const nextResponses = nextPrompt.responses || {};
    const addedUids = Object.keys(nextResponses).filter(uid => !(uid in previousResponses));
    if (addedUids.length !== 1) continue;
    if (Object.keys(previousResponses).some(uid => !sameSerializedValue(previousResponses[uid], nextResponses[uid]))) continue;

    const previousComparable = {
      ...boardWithoutCommandMetadata(previousBoard),
      [key]: { ...previousPrompt, responses: undefined }
    };
    const nextComparable = {
      ...boardWithoutCommandMetadata(nextBoard),
      [key]: { ...nextPrompt, responses: undefined }
    };
    if (!sameSerializedValue(previousComparable, nextComparable)) continue;

    const [uid] = addedUids;
    return cleanObject({
      [`boardState.${key}.responses.${uid}`]: nextResponses[uid],
      'boardState.revision': nextBoard.revision,
      'boardState.processedCommandIds': nextBoard.processedCommandIds,
      'boardState.updatedAt': nextBoard.updatedAt
    });
  }

  return null;
};

export const runBoardTransactionWithRetry = async <T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean = isRetryableBoardTransactionError
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= BOARD_TRANSACTION_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === BOARD_TRANSACTION_MAX_ATTEMPTS) throw error;
      // Avoid synchronizing all players on the same retry boundary after a hot
      // room document conflict. The jitter is intentionally small so normal
      // commands still complete within the existing retry budget.
      const baseDelay = BOARD_TRANSACTION_RETRY_DELAYS_MS[attempt - 1] || 800;
      const jitter = Math.floor(Math.random() * Math.max(1, Math.round(baseDelay * 0.25)));
      await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
    }
  }
  throw lastError;
};

export const runRoomBoardMutation = async <T, R extends BoardRoomSnapshot>(params: RunRoomBoardMutationParams<T, R>): Promise<T> => {
  const startedAt = performance.now();
  const traceId = params.traceId || params.commandId;
  let attempts = 0;
  let outcome = 'failed';
  let scheduledWrites = 0;
  let readDocs = 0;
  let privateStateReads = 0;
  let privateStateWrites = 0;
  let roomBytes = 0;
  let boardBytes = 0;
  let transactionDurationMs = 0;
  let schemaVersion = 1;
  try {
  const result = await runBoardTransactionWithRetry(
    () => runTransaction(params.db, async transaction => {
  const transactionStartedAt = performance.now();
  attempts += 1;
  scheduledWrites = 0;
  readDocs = 0;
  privateStateReads = 0;
  privateStateWrites = 0;
  outcome = 'failed';
  try {
  const roomRef = doc(params.db, 'rooms', params.roomId);
  const snapshot = await transaction.get(roomRef);
  readDocs += 1;
  if (!snapshot.exists()) throw new Error('房間不存在');

  const latestRoom = snapshot.data() as R;
  schemaVersion = Number(latestRoom.syncSchemaVersion) || 1;
  roomBytes = serializedByteLength(latestRoom);
  boardBytes = serializedByteLength(latestRoom.boardState);
  const latestBoard = latestRoom.boardState;
  if (!latestRoom.isBoardGame || !latestBoard) throw new Error('棋盤房間尚未準備完成');

  // New rooms keep full player state in private subcollection documents. Load the
  // states needed by the board command into the mutation view, then write them
  // back without ever putting full financial data on the shared room document.
  // Market purchases explicitly use this path so a stale legacy room field cannot
  // make the financial result disappear from the player's private report.
  const usesPrivatePlayerStates = shouldUsePrivatePlayerStates(
    latestRoom.playerStates,
    params.forcePrivatePlayerStates
  );
  const privatePlayerStates: Record<string, any> = {};
  if (usesPrivatePlayerStates) {
    for (const uid of params.playerStateUids || []) {
      const playerSnapshot = await transaction.get(doc(params.db, 'rooms', params.roomId, 'players', uid));
      readDocs += 1;
      privateStateReads += 1;
      if (playerSnapshot.exists()) {
        privatePlayerStates[uid] = playerSnapshot.data();
      } else if (params.forcePrivatePlayerStates && latestRoom.playerStates?.[uid]) {
        // Legacy fallback lets the first forced-private mutation migrate the
        // touched player without writing the full state back to the room.
        privatePlayerStates[uid] = latestRoom.playerStates[uid];
      }
    }
  }
  const mutationRoom = usesPrivatePlayerStates
    ? ({ ...latestRoom, playerStates: privatePlayerStates } as R)
    : latestRoom;

  const command = applyBoardCommand(latestBoard, params.commandId);
  if (params.expectedRevision !== undefined && !command.duplicate) requireBoardRevision(latestBoard, params.expectedRevision);

  // v2 shared/family prompts keep each reply in its own document. Hydrate the
  // mutation view from those documents, then persist only newly-added replies
  // below. The room document remains the authoritative board/revision record,
  // but no longer becomes a response-map write hotspot.
  const subcollectionPrompt = latestBoard.sharedCardPrompt?.responseStorage === 'subcollection'
    ? { key: 'sharedCardPrompt' as const, prompt: latestBoard.sharedCardPrompt }
    : latestBoard.familyMilestoneJoinPrompt?.responseStorage === 'subcollection'
      ? { key: 'familyMilestoneJoinPrompt' as const, prompt: latestBoard.familyMilestoneJoinPrompt }
      : null;
  let mutationBoard = latestBoard;
  if (subcollectionPrompt) {
    const responseUids = params.responseReadUid
      ? subcollectionPrompt.prompt.targetPlayerUids.filter(uid => uid === params.responseReadUid)
      : subcollectionPrompt.prompt.targetPlayerUids;
    const responseSnapshots = await Promise.all(
      responseUids.map(uid =>
        transaction.get(doc(params.db, 'rooms', params.roomId, 'events', subcollectionPrompt.prompt.id, 'responses', uid))
      )
    );
    readDocs += responseSnapshots.length;
    const persistedResponses = Object.fromEntries(
      responseSnapshots
        .filter(snapshot => snapshot.exists())
        .map(snapshot => [snapshot.id, snapshot.data() as SharedCardPromptResponse | FamilyMilestoneJoinResponse])
    );
    mutationBoard = {
      ...latestBoard,
      [subcollectionPrompt.key]: {
        ...subcollectionPrompt.prompt,
        responses: { ...(subcollectionPrompt.prompt.responses || {}), ...persistedResponses }
      }
    } as BoardState;
  }

  if (command.duplicate) {
    // A retried command must see the persisted subcollection replies too;
    // otherwise onDuplicate cannot find the player's own response and the
    // caller reports a sync failure even though the reply was saved.
    outcome = 'duplicate';
    return params.onDuplicate({ ...mutationRoom, boardState: mutationBoard } as R);
  }

  const mutation = params.mutate(mutationRoom, mutationBoard);
  if (mutation.commit === false) {
    outcome = 'skipped';
    return mutation.result;
  }
  // A stale retry or an already-completed UI action can legitimately return the
  // current state without a patch. Do not consume a revision just to remember
  // a command that had no effect; callers with a real side effect still return
  // a changed board or an explicit roomPatch.
  const hasRoomPatch = !!mutation.roomPatch && Object.keys(mutation.roomPatch).length > 0;
  if (sameSerializedValue(latestBoard, mutation.boardState) && !hasRoomPatch) {
    outcome = 'skipped';
    return mutation.result;
  }
  const responseWritesByUid = new Map<string, { uid: string; response: SharedCardPromptResponse | FamilyMilestoneJoinResponse | Record<string, unknown> }>();
  if (subcollectionPrompt && mutation.sharedResponse) {
    responseWritesByUid.set(mutation.sharedResponse.uid, mutation.sharedResponse);
  }
  let boardForCommit = mutation.boardState;
  if (subcollectionPrompt && mutation.boardState[subcollectionPrompt.key]?.id === subcollectionPrompt.prompt.id) {
    const previousResponses = (mutationBoard[subcollectionPrompt.key] as any)?.responses || {};
    const nextPrompt = mutation.boardState[subcollectionPrompt.key] as any;
    const nextResponses = nextPrompt?.responses || {};
    Object.entries(nextResponses).forEach(([uid, response]) => {
      if (!response || sameSerializedValue(previousResponses[uid], response)) return;
      responseWritesByUid.set(uid, { uid, response: response as unknown as SharedCardPromptResponse | FamilyMilestoneJoinResponse });
    });
    // Keep the legacy field stable for Rules compatibility. The response
    // listener merges the child documents back into the local prompt view.
    boardForCommit = {
      ...mutation.boardState,
      [subcollectionPrompt.key]: {
        ...nextPrompt,
        responses: subcollectionPrompt.prompt.responses || {}
      }
    } as BoardState;
  }
  const committedBoard = applyBoardCommand(boardForCommit, params.commandId).boardState as BoardState;
  const roomPatch = { ...(mutation.roomPatch || {}) } as Record<string, any>;
  const privateWrites: Array<{ uid: string; state: any }> = [];

  if (usesPrivatePlayerStates) {
    const nextPlayerStates = { ...privatePlayerStates };
    const changedPlayerStateUids = new Set<string>();
    if (roomPatch.playerStates && typeof roomPatch.playerStates === 'object') {
      Object.entries(roomPatch.playerStates as Record<string, unknown>).forEach(([uid, state]) => {
        if (!state) return;
        nextPlayerStates[uid] = state;
        changedPlayerStateUids.add(uid);
      });
      delete roomPatch.playerStates;
    }

    Object.entries(roomPatch)
      .filter(([key]) => key.startsWith('playerStates.'))
      .forEach(([key, value]) => {
        const [, uid, ...path] = key.split('.');
        if (!uid) return;
        nextPlayerStates[uid] = path.length === 0
          ? value
          : setNestedValue(nextPlayerStates[uid] || {}, path, value);
        changedPlayerStateUids.add(uid);
        delete roomPatch[key];
      });

    changedPlayerStateUids.forEach(uid => {
      const state = nextPlayerStates[uid];
      if (!state) return;
      if (!sameSerializedValue(privatePlayerStates[uid], state)) privateWrites.push({ uid, state });
      const nextPublicState = toPublicPlayerState(uid, state);
      const previousPublicState = latestRoom.publicPlayerStates?.[uid] as any;
      if (hasPublicPlayerStateChanged(previousPublicState, nextPublicState)) {
        roomPatch[`publicPlayerStates.${uid}`] = nextPublicState;
      }
    });
  }

  const boardChanged = !sameSerializedValue(latestBoard, committedBoard);
  const promptResponsePatch = !('boardState' in roomPatch) && boardChanged
    ? getPromptResponseFieldPatch(latestBoard, committedBoard)
    : null;
  const cleanRoomPatch = cleanObject({
    ...roomPatch,
    ...(promptResponsePatch || { boardState: committedBoard })
  });
  const roomFieldsChanged = Object.keys(cleanRoomPatch).some(key => key !== 'boardState');
  if (!boardChanged && !roomFieldsChanged && privateWrites.length === 0) {
    outcome = 'skipped';
    return mutation.result;
  }

  privateWrites.forEach(({ uid, state }) => {
    transaction.set(doc(params.db, 'rooms', params.roomId, 'players', uid), cleanObject(state));
    scheduledWrites += 1;
    privateStateWrites += 1;
  });
  responseWritesByUid.forEach(({ uid, response }) => {
    transaction.set(
      doc(params.db, 'rooms', params.roomId, 'events', subcollectionPrompt!.prompt.id, 'responses', uid),
      cleanObject({ ...response, promptId: subcollectionPrompt!.prompt.id, playerUid: uid, commandId: params.commandId })
    );
    scheduledWrites += 1;
  });
  transaction.update(roomRef, cleanRoomPatch);
  scheduledWrites += 1;
  outcome = 'committed';
  return mutation.result;
  } finally {
    transactionDurationMs = Math.round(performance.now() - transactionStartedAt);
  }
    }),
    error => isRetryableBoardTransactionError(error) || (
      params.retryOnPermissionDenied &&
      isPermissionDeniedBoardTransactionError(error)
    )
  );
  return result;
  } catch (error) {
    outcome = 'failed';
    throw error;
  } finally {
  // These are client transaction attempts and queued writes, not billing counters.
  void trackGameEvent('board_command', {
    command_type: params.commandId.split(':')[0] || 'unknown',
    result: outcome,
    command_id: params.commandId,
  attempts,
    retry_count: Math.max(0, attempts - 1),
    scheduled_writes: scheduledWrites,
    duration_ms: Math.round(performance.now() - startedAt),
    transaction_ms: transactionDurationMs,
    read_docs: readDocs,
    private_state_reads: privateStateReads,
    private_state_writes: privateStateWrites,
    room_bytes: roomBytes,
    board_bytes: boardBytes,
    schema_version: schemaVersion,
    trace_id: traceId
  }).catch(() => { /* Analytics must never change a financial transaction's outcome. */ });
  }
};

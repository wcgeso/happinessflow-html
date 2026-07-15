import { doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import { BoardState } from '../../types';
import { cleanObject } from '../../utils/utils';
import { toPublicPlayerState } from '../../utils/playerState';
import { trackGameEvent } from '../../utils/telemetry';
import { applyBoardCommand, requireBoardRevision } from './boardRevision';

const setNestedValue = (target: Record<string, any>, path: string[], value: unknown) => {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  return { ...target, [key]: rest.length ? setNestedValue(target?.[key] || {}, rest, value) : value };
};

const getBoardCommandType = (commandId: string): string => commandId.split(':')[0] || 'unknown';

export interface BoardRoomSnapshot {
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
}

export const runRoomBoardMutation = async <T, R extends BoardRoomSnapshot>(params: {
  db: Firestore;
  roomId: string;
  commandId: string;
  expectedRevision?: number;
  playerStateUids?: string[];
  onDuplicate: (latestRoom: R) => T;
  mutate: (latestRoom: R, boardState: BoardState) => {
    boardState: BoardState;
    roomPatch?: Record<string, unknown>;
    result: T;
  };
}): Promise<T> => {
  const result = await runTransaction(params.db, async transaction => {
  const roomRef = doc(params.db, 'rooms', params.roomId);
  const snapshot = await transaction.get(roomRef);
  if (!snapshot.exists()) throw new Error('房間不存在');

  const latestRoom = snapshot.data() as R;
  const latestBoard = latestRoom.boardState;
  if (!latestRoom.isBoardGame || !latestBoard) throw new Error('棋盤房間尚未準備完成');

  // New rooms keep full player state in private subcollection documents. Load the
  // states needed by the board command into the mutation view, then write them
  // back without ever putting full financial data on the shared room document.
  const usesPrivatePlayerStates = !latestRoom.playerStates;
  const privatePlayerStates: Record<string, any> = {};
  if (usesPrivatePlayerStates) {
    for (const uid of params.playerStateUids || []) {
      const playerSnapshot = await transaction.get(doc(params.db, 'rooms', params.roomId, 'players', uid));
      if (playerSnapshot.exists()) privatePlayerStates[uid] = playerSnapshot.data();
    }
  }
  const mutationRoom = usesPrivatePlayerStates
    ? ({ ...latestRoom, playerStates: privatePlayerStates } as R)
    : latestRoom;

  const command = applyBoardCommand(latestBoard, params.commandId);
  if (command.duplicate) return params.onDuplicate(mutationRoom);
  if (params.expectedRevision !== undefined) requireBoardRevision(latestBoard, params.expectedRevision);

  const mutation = params.mutate(mutationRoom, latestBoard);
  const committedBoard = applyBoardCommand(mutation.boardState, params.commandId).boardState as BoardState;
  const roomPatch = { ...(mutation.roomPatch || {}) } as Record<string, any>;

  if (usesPrivatePlayerStates) {
    const nextPlayerStates = { ...privatePlayerStates };
    if (roomPatch.playerStates && typeof roomPatch.playerStates === 'object') {
      Object.assign(nextPlayerStates, roomPatch.playerStates);
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
        delete roomPatch[key];
      });

    Object.entries(nextPlayerStates).forEach(([uid, state]) => {
      if (!state) return;
      transaction.set(doc(params.db, 'rooms', params.roomId, 'players', uid), cleanObject(state));
      roomPatch[`publicPlayerStates.${uid}`] = toPublicPlayerState(uid, state);
    });
  }

  transaction.set(doc(params.db, 'rooms', params.roomId, 'events', `revision_${committedBoard.revision}`), {
    roomId: params.roomId,
    sessionId: latestRoom.sessionId || params.roomId,
    commandType: getBoardCommandType(params.commandId),
    revision: committedBoard.revision,
    result: 'committed',
    recordedAt: serverTimestamp()
  }, { merge: true });

  transaction.update(roomRef, cleanObject({ ...roomPatch, boardState: committedBoard }));
  return mutation.result;

  });
  void trackGameEvent('board_command', {
    command_type: getBoardCommandType(params.commandId),
    result: 'committed'
  });
  return result;
};

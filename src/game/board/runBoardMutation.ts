import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import { BoardState } from '../../types';
import { cleanObject } from '../../utils/utils';
import { applyBoardCommand, requireBoardRevision } from './boardRevision';

export interface BoardRoomSnapshot {
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
}

export const runRoomBoardMutation = async <T, R extends BoardRoomSnapshot>(params: {
  db: Firestore;
  roomId: string;
  commandId: string;
  expectedRevision?: number;
  onDuplicate: (latestRoom: R) => T;
  mutate: (latestRoom: R, boardState: BoardState) => {
    boardState: BoardState;
    roomPatch?: Record<string, unknown>;
    result: T;
  };
}): Promise<T> => runTransaction(params.db, async transaction => {
  const roomRef = doc(params.db, 'rooms', params.roomId);
  const snapshot = await transaction.get(roomRef);
  if (!snapshot.exists()) throw new Error('房間不存在');

  const latestRoom = snapshot.data() as R;
  const latestBoard = latestRoom.boardState;
  if (!latestRoom.isBoardGame || !latestBoard) throw new Error('棋盤房間尚未準備完成');

  const command = applyBoardCommand(latestBoard, params.commandId);
  if (command.duplicate) return params.onDuplicate(latestRoom);
  if (params.expectedRevision !== undefined) requireBoardRevision(latestBoard, params.expectedRevision);

  const mutation = params.mutate(latestRoom, latestBoard);
  const committedBoard = applyBoardCommand(mutation.boardState, params.commandId).boardState as BoardState;
  transaction.update(roomRef, cleanObject({ ...(mutation.roomPatch || {}), boardState: committedBoard }));
  return mutation.result;
});

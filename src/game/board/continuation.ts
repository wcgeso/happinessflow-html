import type { BoardState, PendingBoardContinuation, TransactionData } from '../../types';
import { OPPORTUNITY_CARD_MAP } from '../../constants/cards';
import { BOARD_SQUARES } from '../../constants/board';
import type { GameState } from '../../types';

export const buildPaidLearningContinuation = (
  room: { sessionId?: string; flowSchemaVersion?: number; boardState?: BoardState | null },
  playerUid: string, tx: TransactionData, commandId: string, now: number
): PendingBoardContinuation | null => {
  if (room.flowSchemaVersion !== 1 || tx.usage !== 'lifelong_learning' || tx.boardFlow !== 'board-card') return null;
  const board = room.boardState;
  const card = board?.currentCard ? OPPORTUNITY_CARD_MAP[board.currentCard.cardId] : null;
  const types = { ability_profession: 'enhance_profession', ability_stock: 'stock_ability', ability_realestate: 'real_estate_ability' } as const;
  const learningType = card && types[card.type as keyof typeof types];
  if (!room.sessionId || !board?.currentEvent || board.currentEvent.playerUid !== playerUid || board.currentTurnUid !== playerUid ||
      !learningType || tx.lifelongLearningPayload?.learningType !== learningType || Number(tx.amount) !== Number(card.schoolFee || 0)) {
    throw new Error('終身學習付款與目前卡片不符，請重新同步');
  }
  if (board.pendingContinuation && board.pendingContinuation.phase !== 'completed' && board.pendingContinuation.commandId !== commandId) throw new Error('尚有未完成的卡片接續');
  return { sessionId: room.sessionId, sourceEventId: board.currentEvent.id, cardId: card.id,
    playerUid, commandId, kind: 'lifelong-learning', phase: 'awaiting_roll', learningType,
    requiredRoll: card.diceRequirement || 2, createdAt: now };
};

export const getContinuationRollResult = (pending: PendingBoardContinuation | null | undefined, uid: string, kind: string, sourceEventId?: string) =>
  pending?.kind === 'lifelong-learning' && pending.phase === 'completed' && pending.playerUid === uid && pending.learningType === kind && pending.sourceEventId === sourceEventId ? pending.result : undefined;

export const completeLearningContinuation = (pending: PendingBoardContinuation | null | undefined, uid: string, kind: string, sourceEventId: string | undefined,
  result: {roll: number; target: number; success: boolean; bonus?:number; newTitle?:string}): PendingBoardContinuation | null => {
  if (!pending) return null;
  if (pending.kind !== 'lifelong-learning' || pending.playerUid !== uid || pending.learningType !== kind || pending.sourceEventId !== sourceEventId) throw new Error('終身學習判定不屬於此事件');
  if (pending.phase === 'completed') return pending;
  return { ...pending, phase: 'completed', result };
};

export const applyPaidLearningMove = (board: BoardState, state: GameState, pending: PendingBoardContinuation) => {
  const position = board.playerPositions?.[pending.playerUid] || 0;
  const school = BOARD_SQUARES.filter(s => s.type === 'school' && s.index !== position)
    .sort((a,b) => (a.index-position+BOARD_SQUARES.length)%BOARD_SQUARES.length - (b.index-position+BOARD_SQUARES.length)%BOARD_SQUARES.length)[0];
  if (!school) throw new Error('找不到終身學習學校');
  const skip = Math.max(board.skipTurns?.[pending.playerUid] || 0, OPPORTUNITY_CARD_MAP[pending.cardId].missRounds || 0);
  return { boardState: {...board, pendingContinuation:pending,
    playerPositions:{...board.playerPositions,[pending.playerUid]:school.index},skipTurns:{...board.skipTurns,[pending.playerUid]:skip}},
    state:{...state,boardPosition:school.index,skipTurns:skip,bankServiceWindowActive:false} };
};

export const buildApprovedDrawContinuation = (room: {sessionId?:string;flowSchemaVersion?:number;boardState?:BoardState|null},
  request: {uid:string;boardEventId?:string;boardCardId?:string}, now:number): PendingBoardContinuation | null => {
  if (room.flowSchemaVersion !== 1) return null;
  const board=room.boardState, card=request.boardCardId ? OPPORTUNITY_CARD_MAP[request.boardCardId] : null;
  if (!card?.drawCard) return null;
  if (!room.sessionId || board?.currentEvent?.id !== request.boardEventId || board.currentEvent.playerUid !== request.uid || board.currentCard?.cardId !== request.boardCardId) throw new Error('分享審核對應的卡片已更新');
  return {sessionId:room.sessionId,sourceEventId:request.boardEventId!,cardId:request.boardCardId!,playerUid:request.uid,
    commandId:`draw-followup:${request.boardEventId}:${card.drawCard}`,kind:'followup-card',phase:'awaiting_draw',deck:card.drawCard,createdAt:now};
};

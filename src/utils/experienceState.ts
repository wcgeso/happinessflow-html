import type {
  BoardActionAvailability,
  BoardBlocker,
  BoardState,
  ExperienceState,
} from '../types';

export interface ExperienceStateInput {
  roomStatus?: 'waiting' | 'playing' | 'finished';
  isTimerPaused?: boolean;
  isBoardGame?: boolean;
  hostId?: string;
  members?: Array<{ uid: string; name?: string }>;
  currentUid?: string;
  boardState?: BoardState | null;
  isRollingDice?: boolean;
  isProcessingEvent?: boolean;
  rollBlocker?: BoardBlocker | null;
}

const blocker = (code: string, message: string): BoardBlocker => ({ code, message });

export const clearBoardFlowState = (boardState: BoardState, updatedAt = Date.now()): BoardState => ({
  ...boardState,
  currentCard: null,
  currentCardReveal: null,
  currentEvent: null,
  pendingEvents: [],
  movement: null,
  familyMilestoneJoinPrompt: null,
  sharedCardPrompt: null,
  sharedExpenseEffect: null,
  skippedTurnNotice: null,
  updatedAt,
});

export const getNextBoardTurn = (boardState: Pick<BoardState, 'currentTurnUid' | 'turnOrder' | 'skipTurns'>) => {
  if (!boardState.turnOrder.length) return null;
  if (!boardState.currentTurnUid) {
    return { nextUid: boardState.turnOrder[0], skipTurns: boardState.skipTurns, skippedUids: [] as string[] };
  }

  const currentIndex = boardState.turnOrder.indexOf(boardState.currentTurnUid);
  const skipTurns = { ...boardState.skipTurns };
  const skippedUids: string[] = [];

  for (let offset = 1; offset <= boardState.turnOrder.length; offset += 1) {
    const nextUid = boardState.turnOrder[(currentIndex + offset) % boardState.turnOrder.length];
    const remainingSkips = skipTurns[nextUid] || 0;
    if (remainingSkips > 0) {
      skipTurns[nextUid] = remainingSkips - 1;
      skippedUids.push(nextUid);
      continue;
    }
    return { nextUid, skipTurns, skippedUids };
  }

  return { nextUid: boardState.currentTurnUid, skipTurns, skippedUids };
};

export const getBoardActionAvailability = ({
  roomStatus,
  isTimerPaused = false,
  isBoardGame = false,
  currentUid,
  boardState,
  isRollingDice = false,
  isProcessingEvent = false,
  rollBlocker: localRollBlocker = null,
}: ExperienceStateInput): BoardActionAvailability => {
  if (!isBoardGame || !boardState) {
    const unavailable = blocker('room_not_ready', '棋盤房間尚未同步完成');
    return { canRoll: false, canEndTurn: false, rollBlocker: unavailable, endTurnBlocker: unavailable };
  }

  if (roomStatus === 'finished') {
    const finished = blocker('game_finished', '本局已結算');
    return { canRoll: false, canEndTurn: false, rollBlocker: finished, endTurnBlocker: finished };
  }

  if (roomStatus !== 'playing') {
    const notStarted = blocker('game_not_started', '請等待執行師開始遊戲');
    return { canRoll: false, canEndTurn: false, rollBlocker: notStarted, endTurnBlocker: notStarted };
  }

  if (isTimerPaused) {
    const paused = blocker('game_paused', '請等待執行師開始或繼續遊戲');
    return { canRoll: false, canEndTurn: false, rollBlocker: paused, endTurnBlocker: paused };
  }

  const isMyTurn = boardState.currentTurnUid === currentUid;
  const sharedPromptPending = !!(
    boardState.sharedCardPrompt &&
    Object.keys(boardState.sharedCardPrompt.responses || {}).length < boardState.sharedCardPrompt.targetPlayerUids.length
  );
  const movementActive = !!boardState.movement?.isActive;
  const queuedEvent = !!(boardState.currentEvent || boardState.pendingEvents?.length);

  const rollBlocker = localRollBlocker || (
    !isMyTurn ? blocker('not_my_turn', '現在不是你的回合') :
    isRollingDice ? blocker('rolling', '骰子仍在同步中') :
    boardState.hasRolledThisTurn ? blocker('already_rolled', '這回合已經擲過骰子了，請按「結束回合」換下一位') :
    movementActive ? blocker('movement_active', '棋偶仍在移動中') :
    isProcessingEvent ? blocker('event_incomplete', '請先完成目前事件') :
    null
  );

  const endTurnBlocker = (
    !isMyTurn ? blocker('not_my_turn', '現在不是你的回合') :
    !boardState.hasRolledThisTurn ? blocker('not_rolled', '請先擲骰後才能結束回合') :
    movementActive ? blocker('movement_active', '移動尚未完成，無法結束回合') :
    queuedEvent ? blocker('event_incomplete', '請先完成目前的棋盤事件') :
    sharedPromptPending ? blocker('shared_prompt_pending', '還有玩家尚未完成共享事件回覆') :
    isProcessingEvent ? blocker('event_incomplete', '請先完成目前事件') :
    isRollingDice ? blocker('rolling', '骰子仍在同步中') :
    null
  );

  return {
    canRoll: !rollBlocker,
    canEndTurn: !endTurnBlocker,
    rollBlocker,
    endTurnBlocker,
  };
};

export const selectExperienceState = (input: ExperienceStateInput): ExperienceState => {
  const boardState = input.boardState;
  const currentTurnUid = boardState?.currentTurnUid || null;
  const turnOrder = boardState?.turnOrder || [];
  const currentTurnMember = input.members?.find(member => member.uid === currentTurnUid);
  const turnIndex = currentTurnUid ? turnOrder.indexOf(currentTurnUid) : -1;
  const actionAvailability = getBoardActionAvailability(input);

  return {
    phase: !input.isBoardGame || !boardState
      ? 'idle'
      : input.roomStatus === 'finished'
        ? 'finished'
        : input.roomStatus === 'waiting'
          ? 'waiting'
          : 'playing',
    currentTurnUid,
    currentTurnName: currentTurnMember?.name || null,
    turnPosition: turnIndex >= 0 ? turnIndex + 1 : null,
    participantCount: turnOrder.length || input.members?.filter(member => member.uid !== input.hostId).length || 0,
    isMyTurn: currentTurnUid === input.currentUid,
    pendingSkipTurns: currentTurnUid ? boardState?.skipTurns?.[currentTurnUid] || 0 : 0,
    eventSummary: boardState?.currentEvent?.playerUid === currentTurnUid
      ? boardState.currentEvent.summary
      : null,
    actionAvailability,
  };
};

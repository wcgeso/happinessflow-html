import type {
  BoardActionAvailability,
  BoardBlocker,
  BoardState,
  ExperienceState,
} from '../types';
import { hasIncompleteSharedPrompts } from './boardCardActions';

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
  eventBlocker?: BoardBlocker | null;
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

  // 所有玩家都在暫停中時，不能讓目前玩家重複取得回合；
  // 依本輪掃描順序恢復最早等待的玩家（兩人局即為先進醫院者）。
  return { nextUid: skippedUids[0] || boardState.currentTurnUid, skipTurns, skippedUids };
};

export const buildNextBoardTurnState = (
  boardState: BoardState,
  playerUid: string,
  updatedAt = Date.now()
): BoardState => {
  if (boardState.currentTurnUid !== playerUid) throw new Error('目前已不是你的回合');
  if (boardState.pendingContinuation && boardState.pendingContinuation.phase !== 'completed') throw new Error('等待卡片接續完成，無法結束回合');
  if (boardState.movement) throw new Error('移動尚未完成，無法結束回合');
  if (!boardState.hasRolledThisTurn) throw new Error('請先擲骰後才能結束回合');
  if (boardState.currentEvent || boardState.pendingEvents?.length) {
    throw new Error('請先完成目前的棋盤事件，才能結束回合');
  }
  if (hasIncompleteSharedPrompts(boardState)) {
    throw new Error('還有玩家尚未完成共享事件回覆，請等待所有人完成後再結束回合');
  }

  const nextTurn = getNextBoardTurn(boardState);
  const nextTurnUid = nextTurn?.nextUid || playerUid;
  return {
    ...boardState,
    currentTurnUid: nextTurnUid,
    hasRolledThisTurn: false,
    skipTurns: nextTurn?.skipTurns || boardState.skipTurns,
    skippedTurnNotice: nextTurn?.skippedUids.length ? {
      playerUids: nextTurn.skippedUids,
      nextTurnUid,
      timestamp: updatedAt,
    } : null,
    updatedAt,
  };
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
  eventBlocker = null,
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
  ) || !!(boardState.familyMilestoneJoinPrompt &&
    hasIncompleteSharedPrompts({ ...boardState, sharedCardPrompt: null }));
  const movementActive = !!boardState.movement;
  const queuedEvent = !!(boardState.currentEvent || boardState.pendingEvents?.length);

  const rollBlocker = localRollBlocker || (
    !isMyTurn ? blocker('not_my_turn', '現在不是你的回合') :
    isRollingDice ? blocker('rolling', '骰子仍在同步中') :
    boardState.hasRolledThisTurn ? blocker('already_rolled', '這回合已經擲過骰子了，請按「結束回合」換下一位') :
    movementActive ? blocker('movement_active', '棋偶仍在移動中') :
    eventBlocker ? eventBlocker :
    isProcessingEvent ? blocker('event_incomplete', '請先完成目前事件') :
    null
  );

  const endTurnBlocker = (
    !isMyTurn ? blocker('not_my_turn', '現在不是你的回合') :
    !boardState.hasRolledThisTurn ? blocker('not_rolled', '請先擲骰後才能結束回合') :
    boardState.pendingContinuation?.phase === 'awaiting_roll' ? blocker('learning_pending', '等待終身學習判定') :
    boardState.pendingContinuation?.phase === 'awaiting_draw' ? blocker('followup_pending', '等待後續抽卡完成') :
    movementActive ? blocker('movement_active', '移動尚未完成，無法結束回合') :
    sharedPromptPending ? blocker('shared_prompt_pending', '還有玩家尚未完成共享事件回覆') :
    eventBlocker ? eventBlocker :
    queuedEvent ? blocker('event_incomplete', '請先完成目前的棋盤事件') :
    isProcessingEvent ? blocker('event_incomplete', '請先完成目前事件') :
    null
  );

  return {
    canRoll: !rollBlocker,
    canEndTurn: !endTurnBlocker,
    canOpenEvent: !boardState.movement?.isActive && !isRollingDice && !eventBlocker,
    eventBlocker: boardState.movement?.isActive ? blocker('movement_active', '等待移動結算')
      : isRollingDice ? blocker('rolling', '正在播放本事件動畫') : eventBlocker,
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

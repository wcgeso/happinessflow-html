import type { BoardState } from '../../types';

export type ProjectionActionKind =
  | 'paused'
  | 'moving'
  | 'card'
  | 'event'
  | 'shared'
  | 'end_turn'
  | 'roll'
  | 'waiting_start';

export interface ProjectionActionState {
  kind: ProjectionActionKind;
  label: string;
  waitingCount: number;
}

const getSharedWaitingCount = (boardState: BoardState) => {
  const shared = boardState.sharedCardPrompt;
  if (shared) {
    return shared.targetPlayerUids.filter(uid => !shared.responses?.[uid]).length;
  }

  const family = boardState.familyMilestoneJoinPrompt;
  if (!family) return 0;
  return family.targetPlayerUids.filter(uid => {
    const response = family.responses?.[uid];
    return !response || (response.status === 'passed' && !response.actionCompleted);
  }).length;
};

export const getProjectionActionState = ({
  boardState,
  roomStatus,
  isTimerPaused,
}: {
  boardState: BoardState;
  roomStatus: 'waiting' | 'playing' | 'finished';
  isTimerPaused?: boolean;
}): ProjectionActionState => {
  if (boardState.skippedTurnNotice || isTimerPaused) {
    return { kind: 'paused', label: isTimerPaused ? '遊戲暫停，等待執行師繼續' : '暫停回合處理中', waitingCount: 0 };
  }
  if (boardState.movement?.isActive) {
    return { kind: 'moving', label: '棋偶移動中', waitingCount: 0 };
  }
  if (boardState.currentCard) {
    return { kind: 'card', label: `處理卡片：${boardState.currentCard.title}`, waitingCount: 0 };
  }
  if (boardState.currentEvent) {
    return { kind: 'event', label: boardState.currentEvent.summary || '處理目前事件', waitingCount: 0 };
  }

  const waitingCount = getSharedWaitingCount(boardState);
  if (waitingCount > 0) {
    return { kind: 'shared', label: `等待共享回覆（尚有 ${waitingCount} 人）`, waitingCount };
  }
  if (boardState.hasRolledThisTurn) {
    return { kind: 'end_turn', label: '等待目前玩家結束回合', waitingCount: 0 };
  }
  if (roomStatus === 'playing') {
    return { kind: 'roll', label: '等待目前玩家擲骰', waitingCount: 0 };
  }
  return { kind: 'waiting_start', label: '等待執行師開始遊戲', waitingCount: 0 };
};

import type {BoardState, FamilyMilestoneJoinPrompt, SharedCardPrompt} from '../../types';

export type SharedPromptBoardState = Pick<BoardState, 'sharedCardPrompt' | 'familyMilestoneJoinPrompt'> &
  Partial<Pick<BoardState, 'currentEvent' | 'currentCard'>>;

export const isBoardPromptForCurrentEvent = (
  prompt: Pick<FamilyMilestoneJoinPrompt | SharedCardPrompt, 'sourceEventId' | 'sourceCardId'> | null | undefined,
  boardState: Partial<Pick<BoardState, 'currentEvent' | 'currentCard'>> | null | undefined
) => !!prompt &&
  prompt.sourceEventId === boardState?.currentEvent?.id &&
  prompt.sourceCardId === boardState?.currentCard?.cardId;

// 非抽卡玩家不一定持有抽卡者的 currentCard 投影；共享提示以事件 ID 為準。
export const isBoardPromptVisibleForCurrentEvent = (
  prompt: Pick<FamilyMilestoneJoinPrompt | SharedCardPrompt, 'sourceEventId'> | null | undefined,
  boardState: Partial<Pick<BoardState, 'currentEvent'>> | null | undefined
) => !!prompt && prompt.sourceEventId === boardState?.currentEvent?.id;

export const hasIncompleteSharedPrompts = (
  boardState: SharedPromptBoardState | null | undefined,
  now = Date.now()
): boolean => {
  if (!boardState) return false;
  const hasEventContext = 'currentEvent' in boardState || 'currentCard' in boardState;

  const sharedPrompt = boardState.sharedCardPrompt;
  if (sharedPrompt && (!hasEventContext || isBoardPromptForCurrentEvent(sharedPrompt, boardState)) &&
    !sharedPrompt.targetPlayerUids.every(uid => !!sharedPrompt.responses?.[uid])) {
    return true;
  }

  const familyPrompt = boardState.familyMilestoneJoinPrompt;
  if (familyPrompt && (!hasEventContext || isBoardPromptForCurrentEvent(familyPrompt, boardState)) && (
    !familyPrompt.targetPlayerUids.every(uid => {
      const response = familyPrompt.responses?.[uid];
      if (!response) return false;
      if (response.presentationReadyAt && response.presentationReadyAt > now) return false;
      return response.status !== 'passed' || response.actionCompleted === true;
    }) || familyPrompt.sourceActionCompleted !== true
  )) {
    return true;
  }

  return false;
};

import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import type { BoardState, FamilyMilestoneJoinPrompt, FamilyMilestoneJoinResponse, GameState } from '../../types';
import { getFamilyMilestoneStatus } from '../../utils/familyMilestones';
import { cleanObject } from '../../utils/utils';
import { getFamilyDicePresentationReadyAt } from './dicePresentation';
import { runBoardTransactionWithRetry } from './runBoardMutation';

interface FamilyResponseRoom {
  status?: string;
  boardState?: BoardState | null;
}

interface SubmitFamilyMilestoneResponseParams {
  db: Firestore;
  roomId: string;
  promptId: string;
  uid: string;
  playerName: string;
  cardId: string;
  status: FamilyMilestoneJoinResponse['status'];
  roll?: number;
}

export const submitFamilyMilestoneResponse = async ({
  db,
  roomId,
  promptId,
  uid,
  playerName,
  cardId,
  status,
  roll
}: SubmitFamilyMilestoneResponseParams): Promise<{
  response: FamilyMilestoneJoinResponse;
  prompt: FamilyMilestoneJoinPrompt | null;
}> => {
  if (roll !== undefined && (!Number.isInteger(roll) || roll < 1 || roll > 6)) {
    throw new Error('擲骰結果無效');
  }

  const roomRef = doc(db, 'rooms', roomId);
  const responseRef = doc(db, 'rooms', roomId, 'events', promptId, 'responses', uid);
  const playerRef = doc(db, 'rooms', roomId, 'players', uid);
  const commandId = `prompt:family:response:${promptId}:${uid}`;

  return runBoardTransactionWithRetry(() => runTransaction(db, async transaction => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) throw new Error('房間不存在');
    const latestRoom = roomSnapshot.data() as FamilyResponseRoom;
    const latestPrompt = latestRoom.boardState?.familyMilestoneJoinPrompt || null;

    const responseSnapshot = await transaction.get(responseRef);
    if (responseSnapshot.exists()) {
      const response = responseSnapshot.data() as FamilyMilestoneJoinResponse & { commandId?: string };
      if (response.commandId !== commandId) throw new Error('這張家庭歷程已回覆');
      return { response, prompt: latestPrompt };
    }

    if (latestPrompt?.responses?.[uid]) {
      return { response: latestPrompt.responses[uid], prompt: latestPrompt };
    }
    if (
      latestRoom.status !== 'playing' ||
      !latestPrompt ||
      latestPrompt.id !== promptId ||
      latestPrompt.responseStorage !== 'subcollection' ||
      !latestPrompt.targetPlayerUids.includes(uid) ||
      latestPrompt.sourceCardId !== cardId
    ) {
      throw new Error('家庭歷程提示已更新或目前玩家不在參與名單內');
    }

    let latestPlayerState: GameState | undefined;
    if (status === 'passed') {
      const playerSnapshot = await transaction.get(playerRef);
      if (!playerSnapshot.exists()) throw new Error('玩家資料尚未同步完成，請稍後再擲一次');
      latestPlayerState = playerSnapshot.data() as GameState;
    }

    const familyStatus = latestPlayerState ? getFamilyMilestoneStatus(latestPlayerState) : null;
    const participantStage = familyStatus && familyStatus.currentStageIndex >= 0
      ? familyStatus.stages[familyStatus.currentStageIndex]
      : null;
    const respondedAt = Date.now();
    const response = cleanObject({
      playerUid: uid,
      playerName: playerName || '玩家',
      status,
      actionCompleted: status !== 'passed' || !participantStage,
      stageProgressId: participantStage?.progressId,
      roll,
      respondedAt,
      presentationReadyAt: roll !== undefined
        ? getFamilyDicePresentationReadyAt(respondedAt)
        : undefined,
      promptId,
      commandId
    }) as FamilyMilestoneJoinResponse;

    transaction.set(responseRef, response);

    if (status === 'passed' && participantStage && latestPlayerState) {
      transaction.set(playerRef, cleanObject({
        ...latestPlayerState,
        pendingFamilyMilestoneJoinAction: {
          promptId,
          cardId: latestPrompt.sourceCardId,
          sourcePlayerUid: latestPrompt.sourcePlayerUid,
          stageProgressId: participantStage.progressId
        },
        pendingCardAction: `${latestPrompt.sourcePlayerName} 抽到家庭重要歷程，你擲出 ${roll} 點並成功加入。`,
        lastBoardEvent: '家庭重要歷程同步參與'
      }));
    }

    return { response, prompt: latestPrompt };
  }));
};

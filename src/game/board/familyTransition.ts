import type {Room, BoardState, FamilyMilestoneJoinPrompt} from '../../types';
import {serverNow} from '../../utils/serverClock';
import {hasIncompleteSharedPrompts} from './promptCompletion';
import {appendBoardCardLog, buildBoardEventAdvanceState} from './eventQueue';

export const buildCompletedFamilyTransition = (
    latestRoom: Room,
    latestBoard: BoardState,
    prompt: FamilyMilestoneJoinPrompt
) => {
    const completedPromptBoard = { ...latestBoard, familyMilestoneJoinPrompt: prompt };
    if (hasIncompleteSharedPrompts(completedPromptBoard)) return null;
    const currentCardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
    const nextState = buildBoardEventAdvanceState({
        ...latestRoom,
        boardState: { ...completedPromptBoard, familyMilestoneJoinPrompt: undefined, cardLog: currentCardLog }
    } as Room);
    if (!nextState) return null;

    const { boardState: nextBoardState, playerStates, ...roomPatch } = nextState as any;
    const nextBoard = nextBoardState || latestBoard;
    return {
        boardState: {
            ...nextBoard,
            cardLog: nextBoard.currentCard
                ? appendBoardCardLog({ ...latestBoard, cardLog: currentCardLog }, nextBoard.currentCard, nextBoard.currentEvent)
                : currentCardLog,
            updatedAt: serverNow()
        },
        roomPatch: {
            ...roomPatch,
            ...(playerStates ? { playerStates } : {})
        }
    };
};


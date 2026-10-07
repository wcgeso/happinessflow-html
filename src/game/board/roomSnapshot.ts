import type {Room} from '../../types';

export const shouldAcceptBoardSnapshot = (
    previous: Pick<Room, 'id' | 'sessionId' | 'boardState'> | null | undefined,
    next: Pick<Room, 'id' | 'sessionId' | 'boardState'>
): boolean => {
    if (!previous || previous.id !== next.id || !previous.boardState || !next.boardState) return true;
    if (previous.sessionId !== next.sessionId) return true;

    const previousRevision = Number(previous.boardState.revision);
    const nextRevision = Number(next.boardState.revision);
    if (Number.isFinite(previousRevision) && Number.isFinite(nextRevision)) {
        if (nextRevision < previousRevision) return false;
        if (nextRevision > previousRevision) return true;
    }

    const previousUpdatedAt = Number(previous.boardState.updatedAt);
    const nextUpdatedAt = Number(next.boardState.updatedAt);
    return !Number.isFinite(previousUpdatedAt) ||
        !Number.isFinite(nextUpdatedAt) ||
        nextUpdatedAt >= previousUpdatedAt;
};

export const mergeRoomSnapshotWithPrivateStates = (snapshotRoom: Room, currentRoom: Room | null): Room => {
    const isSameRoomSession = currentRoom?.id === snapshotRoom.id &&
        currentRoom.sessionId === snapshotRoom.sessionId;
    const snapshotPrompt = snapshotRoom.boardState?.sharedCardPrompt;
    const currentPrompt = currentRoom?.boardState?.sharedCardPrompt;
    const snapshotFamilyPrompt = snapshotRoom.boardState?.familyMilestoneJoinPrompt;
    const currentFamilyPrompt = currentRoom?.boardState?.familyMilestoneJoinPrompt;
    const preserveSubcollectionResponses = isSameRoomSession &&
        snapshotPrompt?.id === currentPrompt?.id &&
        snapshotPrompt?.responseStorage === 'subcollection';
    const preserveFamilySubcollectionResponses = isSameRoomSession &&
        snapshotFamilyPrompt?.id === currentFamilyPrompt?.id &&
        snapshotFamilyPrompt?.responseStorage === 'subcollection';
    const boardState = snapshotRoom.boardState && (preserveSubcollectionResponses || preserveFamilySubcollectionResponses)
        ? {
            ...snapshotRoom.boardState,
            ...(preserveSubcollectionResponses && snapshotPrompt && currentPrompt ? {
                sharedCardPrompt: {
                    ...snapshotPrompt,
                    responses: {
                        ...(snapshotPrompt.responses || {}),
                        ...(currentPrompt.responses || {})
                    }
                }
            } : {}),
            ...(preserveFamilySubcollectionResponses && snapshotFamilyPrompt && currentFamilyPrompt ? {
                familyMilestoneJoinPrompt: {
                    ...snapshotFamilyPrompt,
                    responses: {
                        ...(snapshotFamilyPrompt.responses || {}),
                        ...(currentFamilyPrompt.responses || {})
                    }
                }
            } : {})
        }
        : snapshotRoom.boardState;

    return {
        ...snapshotRoom,
        ...(snapshotRoom.publicPlayerStorage==='subcollection'?{publicPlayerStates:isSameRoomSession?currentRoom?.publicPlayerStates||{}:{}}:{}),
        ...(boardState ? { boardState } : {}),
        ...(isSameRoomSession && currentRoom?.playerStates
            ? { playerStates: currentRoom.playerStates }
            : {})
    };
};

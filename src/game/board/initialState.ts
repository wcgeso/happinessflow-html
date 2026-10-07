import type {RoomMember,GameState,BoardState} from '../../types';
import {createInitialDeckState} from '../../constants/board';
import {serverNow} from '../../utils/serverClock';

export const createInitialBoardState = (members: RoomMember[], hostId: string, playerStates?: Record<string, GameState>, now=serverNow(), deckState=createInitialDeckState()): BoardState => {
    // 棋盤上該顯示誰，判斷依據是「是不是這個房間的主持人」，而不是帳號的
    // 全域角色（role）。執行師帳號也可能以參與者身分加入別人開的房間，
    // 這種情況下他就是玩家，理應出現在棋盤上；只有真正主持這場遊戲的人
    // （room.hostId）才不需要棋偶。
    const playerMembers = members.filter(member => member.uid !== hostId);
    const turnOrder = playerMembers.map(member => member.uid);
    const positions = Object.fromEntries(turnOrder.map(uid => [uid, 0]));
    const skipTurns = Object.fromEntries(turnOrder.map(uid => [uid, playerStates?.[uid]?.skipTurns || 0]));

    return {
        currentTurnUid: turnOrder[0] || null,
        turnOrder,
        playerPositions: positions,
        skipTurns,
        hasRolledThisTurn: false,
        revision: 0,
        processedCommandIds: [],
        lastRoll: null,
        currentCard: null,
        currentCardReveal: null,
        currentEvent: null,
        pendingEvents: [],
        movement: null,
        familyMilestoneJoinPrompt: null,
        sharedCardPrompt: null,
        deckState,
        realEstateMarket: [],
        cardLog: [],
        updatedAt: now
    };
};

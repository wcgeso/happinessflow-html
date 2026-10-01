import type {Room, RoomMember, BoardState, BoardCardRevealResult, SharedCardPrompt, SharedCardPromptResponse, GameState, Transaction} from '../../types';
import {serverNow} from '../../utils/serverClock';
import {cleanObject} from '../../utils/utils';
import {applyBoardCommand} from './boardRevision';
import {buildStartupLoanState} from '../finance/cardState';
import {appendBoardCardLog, buildBoardEventAdvanceState} from './eventQueue';
import {hasIncompleteSharedPrompts, getSharedOpportunityKind, resolveBoardCardAction} from '../../utils/boardCardActions';
import {HAPPINESS_CARD_MAP, NEWS_CARD_MAP, OPPORTUNITY_CARDS, NEWS_CARDS} from '../../constants/cards';
import {isFamilyMilestoneComplete, getFamilyMilestoneStatus} from '../../utils/familyMilestones';

export const getSharedCardTargetPlayerUids = (
    members: ReadonlyArray<Pick<RoomMember, 'uid' | 'isLeft'>>,
    hostId: string,
    sourcePlayerUid: string
) => Array.from(new Set([
    ...members.filter(member => member.uid !== hostId && !member.isLeft).map(member => member.uid),
    ...(sourcePlayerUid !== hostId ? [sourcePlayerUid] : [])
]));

export const buildSharedPromptResponseFallback = (
    room: Room,
    promptId: string,
    uid: string,
    response: SharedCardPromptResponse,
    commandId: string,
    now = serverNow()
): { status: 'applied' | 'duplicate' | 'stale'; boardState?: BoardState } => {
    const board = room.boardState;
    const prompt = board?.sharedCardPrompt;
    if (!board || !prompt || prompt.id !== promptId || !prompt.targetPlayerUids.includes(uid)) {
        return { status: 'stale' };
    }
    if (prompt.responses?.[uid]) return { status: 'duplicate', boardState: board };

    const command = applyBoardCommand(board, commandId);
    if (command.duplicate) return { status: 'stale' };
    return {
        status: 'applied',
        boardState: {
            ...command.boardState,
            sharedCardPrompt: {
                ...prompt,
                responses: { ...(prompt.responses || {}), [uid]: response }
            },
            updatedAt: now
        }
    };
};

export const buildBoardCardRevealState = (
    latestRoom: Room,
    eventId: string,
    cardId: string,
    revealedBy: string,
    revealedByName: string,
    now = serverNow()
): { boardState: BoardState; result: BoardCardRevealResult } => {
    const latestBoard = latestRoom.boardState;
    if (!latestBoard) throw new Error('棋盤房間尚未準備完成');

    const familyCard = HAPPINESS_CARD_MAP[cardId];
    const opportunityCard = OPPORTUNITY_CARDS.find(card => card.id === cardId);
    const newsCard = NEWS_CARDS.find(card => card.id === cardId);
    const familyRequired = familyCard?.category === '家庭重要歷程' && !!familyCard.otherPlayersCanJoin;
    let sharedKind: SharedCardPrompt['kind'] | null = null;
    if (opportunityCard) sharedKind = getSharedOpportunityKind(cardId);
    else if (newsCard?.type === 'cash_dividend') sharedKind = 'cash_dividend';
    else if (newsCard?.type === 'stock_dividend') sharedKind = 'stock_dividend';
    else if (newsCard?.type === 'large_enterprise') sharedKind = 'investment';
    else if (newsCard?.type === 'small_business') sharedKind = 'startup_loan';

    let nextBoard: BoardState = {
        ...latestBoard,
        currentCardReveal: { eventId, cardId, isRevealed: true, revealedAt: now, revealedBy },
        cardLog: appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent),
        updatedAt: now
    };
    let familyPrompt: BoardCardRevealResult['familyPrompt'] = familyRequired ? 'no_target' : 'not_required';
    let sharedPrompt: BoardCardRevealResult['sharedPrompt'] = sharedKind ? 'no_target' : 'not_required';

    if (familyRequired) {
        const latestSourceState = latestRoom.playerStates?.[revealedBy];
        const sourceHasCompletedFamily = isFamilyMilestoneComplete(latestSourceState);
        const targetPlayerUids = (latestRoom.members || [])
            .filter(member => member.uid !== latestRoom.hostId && member.uid !== revealedBy && !member.isLeft)
            .filter(member => !isFamilyMilestoneComplete(latestRoom.playerStates?.[member.uid]))
            .map(member => member.uid);
        if (!sourceHasCompletedFamily && targetPlayerUids.length > 0) {
            const latestFamilyStatus = latestSourceState ? getFamilyMilestoneStatus(latestSourceState) : null;
            const currentStage = latestFamilyStatus && latestFamilyStatus.currentStageIndex >= 0
                ? latestFamilyStatus.stages[latestFamilyStatus.currentStageIndex]
                : undefined;
            nextBoard = {
                ...nextBoard,
                familyMilestoneJoinPrompt: {
                    id: `${eventId}_${cardId}_family_join`,
                    sourceEventId: eventId,
                    sourceCardId: cardId,
                    sourcePlayerUid: revealedBy,
                    sourcePlayerName: latestBoard.currentEvent?.playerName || revealedByName || '玩家',
                    sourceStageProgressId: currentStage?.progressId,
                    sourceActionCompleted: false,
                    requiredRoll: familyCard.joinDiceMin || 4,
                    targetPlayerUids,
                    responses: {},
                    responseStorage: latestRoom.syncSchemaVersion === 2 ? 'subcollection' : 'room',
                    createdAt: now
                }
            };
            familyPrompt = 'opened';
        }
    }

    if (sharedKind) {
        const targetPlayerUids = getSharedCardTargetPlayerUids(latestRoom.members || [], latestRoom.hostId || '', revealedBy);
        if (targetPlayerUids.length > 0) {
            nextBoard = {
                ...nextBoard,
                sharedCardPrompt: {
                    id: `${eventId}_${cardId}_shared`,
                    kind: sharedKind,
                    sourceEventId: eventId,
                    sourceCardId: cardId,
                    sourcePlayerUid: revealedBy,
                    sourcePlayerName: latestBoard.currentEvent?.playerName || revealedByName || '玩家',
                    targetPlayerUids,
                    responses: {},
                    responseStorage: latestRoom.syncSchemaVersion === 2 ? 'subcollection' : 'room',
                    createdAt: now
                }
            };
            sharedPrompt = 'opened';
        }
    }

    return { boardState: nextBoard, result: { familyPrompt, sharedPrompt } };
};

export const buildStartupLoanPromptMutation = (
    latestRoom: Room,
    latestBoard: BoardState,
    promptId: string,
    playerUid: string,
    playerName: string,
    commandId: string
) => {
    const prompt = latestBoard.sharedCardPrompt;
    if (
        !prompt ||
        prompt.id !== promptId ||
        prompt.kind !== 'startup_loan' ||
        !prompt.targetPlayerUids.includes(playerUid) ||
        prompt.responses?.[playerUid]?.status === 'declined'
    ) {
        return { boardState: latestBoard, commit: false, result: false };
    }

    const currentState = latestRoom.playerStates?.[playerUid];
    if (!currentState) throw new Error('玩家資料尚未同步完成');

    const card = NEWS_CARD_MAP[prompt.sourceCardId];
    if (!card || card.type !== 'small_business') throw new Error('創業貸款事件資料已更新');

    const nextPlayerState = buildStartupLoanState(currentState, card.id, commandId);
    const response: SharedCardPromptResponse = {
        playerUid,
        playerName,
        status: 'completed',
        amount: card.investmentPerMonth,
        note: '創業貸款已建立',
        respondedAt: serverNow()
    };
    const nextPrompt: SharedCardPrompt = {
        ...prompt,
        responses: {
            ...(prompt.responses || {}),
            [playerUid]: response
        }
    };
    const playerStates = {
        ...(latestRoom.playerStates || {}),
        [playerUid]: nextPlayerState
    };

    if (hasIncompleteSharedPrompts({ ...latestBoard, sharedCardPrompt: nextPrompt })) {
        return {
            boardState: { ...latestBoard, sharedCardPrompt: nextPrompt, updatedAt: serverNow() },
            roomPatch: { playerStates: { [playerUid]: nextPlayerState } },
            sharedResponse: { uid: playerUid, response },
            result: true
        };
    }

    const currentCardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
    const nextState = buildBoardEventAdvanceState({
        ...latestRoom,
        playerStates,
        boardState: { ...latestBoard, sharedCardPrompt: undefined, cardLog: currentCardLog }
    });
    if (!nextState?.boardState) throw new Error('創業貸款事件無法結案');

    const { boardState: nextBoardState, playerStates: advancedPlayerStates, ...roomPatch } = nextState;
    return {
        boardState: {
            ...nextBoardState,
            cardLog: nextBoardState.currentCard
                ? appendBoardCardLog({ ...latestBoard, cardLog: currentCardLog }, nextBoardState.currentCard, nextBoardState.currentEvent)
                : currentCardLog,
            updatedAt: serverNow()
        },
        roomPatch: {
            ...roomPatch,
            playerStates: advancedPlayerStates || { [playerUid]: nextPlayerState }
        },
        sharedResponse: { uid: playerUid, response },
        result: true
    };
};

export const buildSharedAssetSalePromptMutation = (
    latestRoom: Room,
    latestBoard: BoardState,
    promptId: string,
    playerUid: string,
    playerName: string,
    selectedAssetIds: string[],
    commandId: string,
    now = serverNow()
) => {
    const prompt = latestBoard.sharedCardPrompt;
    if (
        !prompt ||
        prompt.id !== promptId ||
        prompt.kind !== 'asset_sale' ||
        !prompt.targetPlayerUids.includes(playerUid)
    ) {
        return {
            boardState: latestBoard,
            commit: false,
            result: { status: 'failed' as const, message: '共享出售事件已更新，請重新開啟卡片' }
        };
    }

    if (prompt.responses?.[playerUid]) {
        return { boardState: latestBoard, commit: false, result: { status: 'duplicate' as const } };
    }

    const currentState = latestRoom.playerStates?.[playerUid];
    if (!currentState) throw new Error('玩家資料尚未同步完成');

    const action = resolveBoardCardAction(prompt.sourceCardId, currentState);
    if (action.kind !== 'asset_sale') throw new Error('共享出售卡片資料已更新');

    const uniqueSelectedAssetIds = Array.from(new Set(selectedAssetIds));
    const selectedItems = action.items.filter(item => uniqueSelectedAssetIds.includes(item.id));
    if (
        uniqueSelectedAssetIds.length === 0 ||
        selectedItems.length !== uniqueSelectedAssetIds.length ||
        selectedItems.some(item => !item.selectable)
    ) {
        return {
            boardState: latestBoard,
            commit: false,
            result: { status: 'failed' as const, message: '出售資產已變更，請重新選擇後再試' }
        };
    }

    const totalSellPrice = selectedItems.reduce((sum, item) => sum + item.price, 0);
    const totalLoanBalance = selectedItems.reduce((sum, item) => sum + item.loanBalance, 0);
    const totalCashChange = selectedItems.reduce((sum, item) => sum + item.netCash, 0);
    const selectedLiabilityIds = new Set(
        selectedItems.map(item => item.liability?.id).filter((id): id is string => !!id)
    );
    const nextCash = (Number(currentState.cash) || 0) + totalCashChange;
    const nextPlayerState = cleanObject({
        ...currentState,
        cash: nextCash,
        assets: (currentState.assets || []).filter(asset => !uniqueSelectedAssetIds.includes(asset.id)),
        liabilities: (currentState.liabilities || []).filter(liability => !selectedLiabilityIds.has(liability.id)),
        appliedBoardFinancialEventIds: Array.from(new Set([
            ...(currentState.appliedBoardFinancialEventIds || []),
            commandId
        ])),
        history: [
            ...(currentState.history || []),
            {
                id: commandId,
                timestamp: now,
                name: `卡片出售：${prompt.sourceCardId}`,
                amount: totalSellPrice,
                sourceLabel: '投資回收',
                usageLabel: '解約或出售資產',
                cashChange: totalCashChange,
                balance: nextCash,
                details: JSON.stringify({
                    boardEventId: commandId,
                    sourceCardId: prompt.sourceCardId,
                    totalSellPrice,
                    totalLoanBalance,
                    batchSellList: selectedItems.map(item => ({
                        asset: item.asset,
                        price: item.price,
                        liability: item.liability
                    }))
                }),
                flowType: '投資'
            } satisfies Transaction
        ]
    }) as GameState;

    const response: SharedCardPromptResponse = {
        playerUid,
        playerName,
        status: 'completed',
        amount: totalCashChange,
        selectedAssetIds: uniqueSelectedAssetIds,
        note: '資產出售已完成',
        respondedAt: now
    };
    const nextPrompt: SharedCardPrompt = {
        ...prompt,
        responses: {
            ...(prompt.responses || {}),
            [playerUid]: response
        }
    };

    if (hasIncompleteSharedPrompts({ ...latestBoard, sharedCardPrompt: nextPrompt })) {
        return {
            boardState: { ...latestBoard, sharedCardPrompt: nextPrompt, updatedAt: now },
            roomPatch: { playerStates: { [playerUid]: nextPlayerState } },
            sharedResponse: { uid: playerUid, response },
            result: { status: 'applied' as const }
        };
    }

    const currentCardLog = appendBoardCardLog(latestBoard, latestBoard.currentCard, latestBoard.currentEvent);
    const nextState = buildBoardEventAdvanceState({
        ...latestRoom,
        playerStates: { ...(latestRoom.playerStates || {}), [playerUid]: nextPlayerState },
        boardState: { ...latestBoard, sharedCardPrompt: undefined, cardLog: currentCardLog }
    });
    if (!nextState?.boardState) throw new Error('共享出售事件無法結案');

    const { boardState: nextBoardState, playerStates, ...roomPatch } = nextState as Room;
    return {
        boardState: {
            ...nextBoardState,
            cardLog: nextBoardState.currentCard
                ? appendBoardCardLog({ ...latestBoard, cardLog: currentCardLog }, nextBoardState.currentCard, nextBoardState.currentEvent)
                : currentCardLog,
            updatedAt: now
        },
        roomPatch: {
            ...roomPatch,
            playerStates: playerStates || { [playerUid]: nextPlayerState }
        },
        sharedResponse: { uid: playerUid, response },
        result: { status: 'applied' as const }
    };
};


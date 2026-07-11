export interface BoardCommandState {
    revision?: number;
    processedCommandIds?: string[];
}

export const requireCurrentBoardEvent = (
    boardState: { currentEvent?: { id: string } | null; currentCard?: { cardId: string } | null },
    eventId?: string,
    cardId?: string
) => {
    if (eventId && boardState.currentEvent?.id !== eventId) throw new Error('棋盤事件已更新');
    if (cardId && boardState.currentCard?.cardId !== cardId) throw new Error('棋盤卡片已更新');
};

export const requireBoardRevision = (boardState: BoardCommandState, expectedRevision: number) => {
    if ((boardState.revision || 0) !== expectedRevision) throw new Error('棋盤狀態已更新，請重試');
};

export const mergeBoardMarketPrices = (
    currentPrices: Record<string, number> | undefined,
    updates: Record<string, number>
) => ({ ...(currentPrices || {}), ...updates });

export const applyBoardCommand = <T extends BoardCommandState>(boardState: T, commandId: string) => {
    const processedCommandIds = boardState.processedCommandIds || [];
    if (processedCommandIds.includes(commandId)) {
        return { duplicate: true, boardState };
    }

    return {
        duplicate: false,
        boardState: {
            ...boardState,
            revision: (boardState.revision || 0) + 1,
            processedCommandIds: [...processedCommandIds, commandId].slice(-100)
        }
    };
};

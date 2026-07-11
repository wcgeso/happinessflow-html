export interface BoardCommandState {
  revision?: number;
  processedCommandIds?: string[];
}

export const requireBoardRevision = (boardState: BoardCommandState, expectedRevision: number) => {
  if ((boardState.revision || 0) !== expectedRevision) throw new Error('棋盤狀態已更新，請重試');
};

export const applyBoardCommand = <T extends BoardCommandState>(boardState: T, commandId: string) => {
  const processedCommandIds = boardState.processedCommandIds || [];
  if (processedCommandIds.includes(commandId)) return { duplicate: true, boardState };

  return {
    duplicate: false,
    boardState: {
      ...boardState,
      revision: (boardState.revision || 0) + 1,
      processedCommandIds: [...processedCommandIds, commandId].slice(-100)
    }
  };
};

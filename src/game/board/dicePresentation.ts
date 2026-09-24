import { BoardState, DicePresentationEvent } from '../../types';

export const MAX_DICE_PRESENTATION_EVENTS = 20;
export const DICE_PRESENTATION_REVEAL_MS = 800;
export const DICE_PRESENTATION_DURATION_MS = 2400;

export const getFamilyDicePresentationReadyAt = (respondedAt: number): number => (
    respondedAt + DICE_PRESENTATION_DURATION_MS
);

export const appendDicePresentation = (
    boardState: BoardState,
    event: DicePresentationEvent
): BoardState => ({
    ...boardState,
    diceEvents: [...(boardState.diceEvents || []), event].slice(-MAX_DICE_PRESENTATION_EVENTS)
});

export const getDicePresentationLabel = (kind: DicePresentationEvent['kind']): string => {
    switch (kind) {
        case 'board-movement': return '棋盤移動';
        case 'repair': return '維修廠保養費';
        case 'family-participation': return '家庭歷程參與資格';
        case 'hospital-fee': return '醫院醫藥費';
        case 'school-exam': return '學校升等考試';
        case 'lifelong-learning': return '終身學習';
        case 'business-upgrade': return '工作室升級';
        default: return '擲骰';
    }
};

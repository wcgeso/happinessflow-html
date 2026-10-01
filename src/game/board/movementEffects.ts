import { getSquareByIndex } from '../../constants/board';
import { BoardMovementEffect } from '../../types';

export const buildMovementEffects = (
    path: number[],
    hasCar: boolean
): BoardMovementEffect[] => {
    if (!hasCar) return [];

    return [...new Set(path)]
        .filter(squareIndex => getSquareByIndex(squareIndex).type === 'repair')
        .map(squareIndex => ({ type: 'repair_fee' as const, squareIndex }));
};

export const describeMovementEffects = (effects: BoardMovementEffect[]): string[] => {
    return effects.map(() => '經過維修廠，請擲骰決定汽車保養費');
};

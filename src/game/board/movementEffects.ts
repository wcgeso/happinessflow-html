import { getSquareByIndex } from '../../constants/board';
import { BoardMovementEffect } from '../../types';

export const buildMovementEffects = (
    path: number[],
    hasCar: boolean,
    rollDie: () => number
): BoardMovementEffect[] => {
    if (!hasCar) return [];

    return [...new Set(path)]
        .filter(squareIndex => getSquareByIndex(squareIndex).type === 'repair')
        .map(squareIndex => {
            const dice = rollDie();
            return {
                type: 'repair_fee' as const,
                squareIndex,
                dice,
                amount: dice * 2000
            };
        });
};

export const describeMovementEffects = (effects: BoardMovementEffect[]): string[] => {
    return effects.map(effect => `經過維修廠，汽車保養費 ${effect.amount}，請自行登錄`);
};

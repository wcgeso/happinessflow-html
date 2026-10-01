import { describe, expect, it, vi } from 'vitest';
import { buildMovementEffects, describeMovementEffects } from './movementEffects';

describe('movement effects', () => {
    it('does not create a repair fee when the player has no car', () => {
        const rollDie = vi.fn(() => 4);

        expect(buildMovementEffects([26, 27, 28], false)).toEqual([]);
        expect(rollDie).not.toHaveBeenCalled();
    });

    it('stores only a repair prompt marker until the player rolls', () => {
        const rollDie = vi.fn(() => 4);
        const effects = buildMovementEffects([26, 27, 28], true);

        expect(rollDie).not.toHaveBeenCalled();
        expect(effects).toEqual([
            { type: 'repair_fee', squareIndex: 27 }
        ]);
        expect(describeMovementEffects(effects)).toEqual([
            '經過維修廠，請擲骰決定汽車保養費'
        ]);
    });

    it('stores one prompt when the path contains the same repair square twice', () => {
        expect(buildMovementEffects([27, 28, 27], true)).toEqual([
            { type: 'repair_fee', squareIndex: 27 }
        ]);
    });
});

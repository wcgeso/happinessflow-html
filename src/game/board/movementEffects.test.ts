import { describe, expect, it, vi } from 'vitest';
import { buildMovementEffects, describeMovementEffects } from './movementEffects';

describe('movement effects', () => {
    it('does not create a repair fee when the player has no car', () => {
        const rollDie = vi.fn(() => 4);

        expect(buildMovementEffects([26, 27, 28], false, rollDie)).toEqual([]);
        expect(rollDie).not.toHaveBeenCalled();
    });

    it('rolls one stored repair fee for a movement that passes the repair square', () => {
        const rollDie = vi.fn(() => 4);
        const effects = buildMovementEffects([26, 27, 28], true, rollDie);

        expect(rollDie).toHaveBeenCalledTimes(1);
        expect(effects).toEqual([
            { type: 'repair_fee', squareIndex: 27, dice: 4, amount: 8000 }
        ]);
        expect(describeMovementEffects(effects)).toEqual([
            '經過維修廠，汽車保養費 8000，請自行登錄'
        ]);
    });

    it('uses the stored effect without another dice roll', () => {
        const rollDie = vi.fn(() => 6);
        const effects = buildMovementEffects([27], true, rollDie);

        describeMovementEffects(effects);

        expect(rollDie).toHaveBeenCalledTimes(1);
        expect(effects[0].amount).toBe(12000);
    });
});

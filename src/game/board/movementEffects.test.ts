import {getNextBoardSquare} from './movementResolution';
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

it('selects the next hospital clockwise, skipping the current square and wrapping',()=>{
 expect(getNextBoardSquare(0,'hospital').index).toBe(13);
 expect(getNextBoardSquare(13,'hospital').index).toBe(39);
 expect(getNextBoardSquare(39,'hospital').index).toBe(13);
 expect(getNextBoardSquare(51,'hospital').index).toBe(13);
 expect(()=>getNextBoardSquare(-1,'hospital')).toThrow('位置無效');
});

import { describe, expect, it } from 'vitest';
import { BoardState, DicePresentationEvent } from '../../types';
import { getDicePresentationTiming, appendDicePresentation, getDicePresentationLabel, getFamilyDicePresentationReadyAt, DICE_PRESENTATION_DURATION_MS, DICE_PRESENTATION_REVEAL_MS, MAX_DICE_PRESENTATION_EVENTS } from './dicePresentation';

const boardState = { diceEvents: [], updatedAt: 0 } as unknown as BoardState;
const event = (id: string, sequence: number): DicePresentationEvent => ({
    id,
    sequence,
    playerUid: 'player-1',
    playerName: '玩家一',
    kind: 'board-movement',
    dice: [4],
    total: 4,
    timestamp: sequence
});

describe('dice presentation events', () => {
    it('keeps only the latest bounded events for the projection', () => {
        const result = Array.from({ length: MAX_DICE_PRESENTATION_EVENTS + 1 }, (_, index) => index + 1)
            .reduce((state, index) => appendDicePresentation(state, event(`roll-${index}`, index)), boardState);

        expect(result.diceEvents).toHaveLength(MAX_DICE_PRESENTATION_EVENTS);
        expect(result.diceEvents?.[0].id).toBe('roll-2');
        expect(result.diceEvents?.at(-1)?.id).toBe(`roll-${MAX_DICE_PRESENTATION_EVENTS + 1}`);
    });

    it('labels each supported dice flow', () => {
        expect(getDicePresentationLabel('family-participation')).toBe('家庭歷程參與資格');
        expect(getDicePresentationLabel('business-upgrade')).toBe('工作室升級');
    });

    it('keeps the family prompt alive until the full dice presentation finishes', () => {
        const readyAt = getFamilyDicePresentationReadyAt(10_000);

        expect(readyAt).toBe(10_000 + DICE_PRESENTATION_DURATION_MS);
        expect(readyAt).toBeGreaterThan(10_000 + DICE_PRESENTATION_REVEAL_MS);
    });
});

describe('late dice presentation', () => {
    it('catches up instead of replaying a full animation', () => {
        expect(getDicePresentationTiming(1000, 2000)).toEqual({ revealInMs: 0, closeInMs: 1400, expired: false });
        expect(getDicePresentationTiming(1000, 4000)).toEqual({ revealInMs: 0, closeInMs: 0, expired: true });
    });
});

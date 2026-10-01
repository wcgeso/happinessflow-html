import { describe, expect, it } from 'vitest';
import { buildMedicalBoardCardState } from './boardMedical';

const txData = (overrides: Record<string, unknown> = {}) => ({
    name: '機運卡：天有不測風雲',
    amount: 20000,
    cashChange: -20000,
    source: 'cash' as const,
    usage: 'expense' as const,
    boardFlow: 'board-card' as const,
    ...overrides
});

describe('buildMedicalBoardCardState', () => {
    it('applies C037 to a legacy partial player state without crashing', () => {
        const result = buildMedicalBoardCardState({
            currentState: { cash: 100000 },
            cardId: 'C037',
            eventId: 'event-1',
            commandId: 'medical-card:room:event-1:player:C037',
            txData: txData(),
            now: 100
        });

        expect(result.status).toBe('applied');
        expect(result.state.cash).toBe(80000);
        expect(result.state.history).toHaveLength(1);
        expect(result.state.pendingMedicalClaims).toEqual([]);
        expect(result.state.appliedBoardFinancialEventIds).toContain('medical-card:room:event-1:player:C037');
    });

    it('creates exactly one pending claim when the player has medical insurance', () => {
        const result = buildMedicalBoardCardState({
            currentState: { cash: 100000, medicalInsuranceCount: 1 },
            cardId: 'C037',
            eventId: 'event-2',
            commandId: 'medical-card:room:event-2:player:C037',
            txData: txData(),
            now: 200
        });

        expect(result.status).toBe('applied');
        expect(result.state.pendingMedicalClaims).toEqual([{
            id: 'medical-claim:event-2:C037',
            sourceEventId: 'event-2',
            sourceCardId: 'C037',
            createdAt: 200
        }]);
    });

    it('is idempotent when the same command is submitted again', () => {
        const commandId = 'medical-card:room:event-3:player:C037';
        const first = buildMedicalBoardCardState({
            currentState: { cash: 100000, medicalInsuranceCount: 1 },
            cardId: 'C037',
            eventId: 'event-3',
            commandId,
            txData: txData()
        });
        const second = buildMedicalBoardCardState({
            currentState: first.state,
            cardId: 'C037',
            eventId: 'event-3',
            commandId,
            txData: txData()
        });

        expect(first.status).toBe('applied');
        expect(second.status).toBe('duplicate');
        expect(second.state.cash).toBe(80000);
        expect(second.state.history).toHaveLength(1);
        expect(second.state.pendingMedicalClaims).toHaveLength(1);
    });

    it('leaves the state untouched when the medical fee cannot be funded', () => {
        const result = buildMedicalBoardCardState({
            currentState: { cash: 1000 },
            cardId: 'C037',
            eventId: 'event-4',
            commandId: 'medical-card:room:event-4:player:C037',
            txData: txData()
        });

        expect(result.status).toBe('requires_funding');
        expect(result.shortfall).toBe(19000);
        expect(result.state.cash).toBe(1000);
        expect(result.state.history).toEqual([]);
        expect(result.state.pendingMedicalClaims).toEqual([]);
    });
});

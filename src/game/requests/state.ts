import type {GameState, PendingRequest} from '../../types';
import {serverNow} from '../../utils/serverClock';

const PENDING_REQUEST_DOCUMENT_PREFIX = 'request_';

const sanitizePendingRequestIdPart = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

export const buildPendingRequestId = (
    request: Pick<PendingRequest, 'uid' | 'type' | 'boardEventId' | 'boardCardId'>,
    sessionId?: string
) => [
    PENDING_REQUEST_DOCUMENT_PREFIX,
    sessionId || 'room',
    request.type,
    request.uid,
    request.boardEventId || 'no-event',
    request.boardCardId || 'no-card'
].map(sanitizePendingRequestIdPart).join('_');

export const isPendingRequestDocumentId = (requestId: string) => requestId.startsWith(PENDING_REQUEST_DOCUMENT_PREFIX);

export const getPendingRequestExecutionKey = (request: Pick<PendingRequest, 'id' | 'uid' | 'type' | 'timestamp' | 'boardEventId' | 'boardCardId'>) =>
    [request.type, request.uid, request.boardEventId || 'no-event', request.boardCardId || 'no-card', request.timestamp || request.id].join(':');

export const applyApprovedHappinessStory = (
    state: GameState,
    request: Pick<PendingRequest, 'uid' | 'boardEventId' | 'boardCardId' | 'happinessLabel'>,
    points: number,
    timestamp = serverNow()
): { state: GameState; duplicate: boolean } => {
    const operationId = `happiness-share:${request.boardEventId}:${request.uid}`;
    if ((state.appliedBoardFinancialEventIds || []).includes(operationId)) {
        return { state, duplicate: true };
    }
    const happiness = [...(state.happiness || []), {
        id: operationId,
        label: request.happinessLabel || '幸福回憶',
        points,
        checked: true,
        isCustom: true
    }];
    const nextState: GameState = {
        ...state,
        happiness,
        happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
        completedHappinessEvents: Array.from(new Set([
            ...(state.completedHappinessEvents || []),
            ...(request.boardCardId ? [request.boardCardId] : [])
        ])),
        appliedBoardFinancialEventIds: [...(state.appliedBoardFinancialEventIds || []), operationId],
        history: [...(state.history || []), {
            id: operationId,
            timestamp,
            name: `幸福卡：${request.happinessLabel || '幸福回憶'}`,
            amount: points,
            sourceLabel: '幸福卡',
            usageLabel: '幸福事件',
            cashChange: 0,
            balance: state.cash,
            boardEventId: operationId,
            details: JSON.stringify({ usage: 'happiness_event', boardEventId: operationId, sourceCardId: request.boardCardId }),
            flowType: '生活'
        }]
    };
    return { state: nextState, duplicate: false };
};


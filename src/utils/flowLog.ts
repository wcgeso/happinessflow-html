import { trackGameEvent } from './telemetry';

export interface FlowLogEvent {
    name: string;
    roomId: string;
    sessionId: string;
    commandId?: string;
    eventId?: string;
    phase?: string;
    revision?: number;
    actorUidHash?: string;
    result: string;
    errorCode?: string;
    timestamp: number;
}

const FLOW_LOG_KEYS: Array<keyof FlowLogEvent> = [
    'name',
    'roomId',
    'sessionId',
    'commandId',
    'eventId',
    'phase',
    'revision',
    'actorUidHash',
    'result',
    'errorCode',
    'timestamp'
];

export const flowLog = (event: FlowLogEvent): void => {
    const payload = Object.fromEntries(
        FLOW_LOG_KEYS
            .filter(key => event[key] !== undefined)
            .map(key => [key, event[key]])
    );

    console.info('[HappinessFlow]', payload);
    void trackGameEvent('flow_event', {
        event_name: event.name,
        phase: event.phase,
        result: event.result,
        error_code: event.errorCode
    });
};

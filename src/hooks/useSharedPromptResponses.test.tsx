import { useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Room } from '../types';

const listeners = vi.hoisted(() => ({ entries: [] as { path: string; next: (snapshot: any) => void; stop: ReturnType<typeof vi.fn> }[] }));
vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    collection: (_db: unknown, ...parts: string[]) => parts.join('/'),
    doc: (_db: unknown, ...parts: string[]) => parts.join('/')
}));
vi.mock('../utils/recoveringSnapshot', () => ({ observeSnapshots: () => (path: string, next: (snapshot: any) => void) => {
    const entry = { path, next, stop: vi.fn() };
    listeners.entries.push(entry);
    return entry.stop;
} }));
import { useSharedPromptResponses } from './useSharedPromptResponses';

const initialRoom = () => ({ id: '123456', sessionId: 'session', hostId: 'coach', syncSchemaVersion: 2,
    boardState: { sharedCardPrompt: { id: 'prompt', responseStorage: 'subcollection', targetPlayerUids: ['p1','p2'], responses: {} } }
}) as Room;
const response = (uid: string) => ({ id: uid, data: () => ({ playerUid: uid, status: 'declined' }) });
const emit = (index: number, uids: string[]) => act(() => listeners.entries[index].next({ docs: uids.map(response) }));
function harness(uid = 'coach') {
    const finalize = vi.fn(async () => {});
    const hook = renderHook(() => {
        const [room, setRoom] = useState<Room | null>(initialRoom);
        const [, setError] = useState<string | null>(null);
        useSharedPromptResponses({ room, setRoom, setError, user: {uid, role: uid === 'coach' ? 'coach' : 'player'}, finalize });
        return {room, setRoom};
    });
    return {...hook, finalize};
}
afterEach(() => { cleanup(); listeners.entries.length = 0; });

it('keeps one subscription through response updates and finalizes once without metadata rerenders', () => {
    const {result, finalize, unmount} = harness();
    const empty = result.current.room;
    emit(0, []);
    expect(result.current.room).toBe(empty);
    emit(0, ['p1']);
    const first = result.current.room;
    emit(0, ['p1']);
    expect(result.current.room).toBe(first);
    expect(finalize).not.toHaveBeenCalled();
    emit(0, ['p1', 'p2']);
    const complete = result.current.room;
    emit(0, ['p1', 'p2']);
    expect(result.current.room).toBe(complete);
    expect(listeners.entries).toHaveLength(1);
    expect(finalize).toHaveBeenCalledExactlyOnceWith('123456', 'prompt');
    unmount();
    expect(listeners.entries[0].stop).toHaveBeenCalledOnce();
});

it('detects a room fallback response without rebuilding the subscription', () => {
    const {result, finalize} = harness();
    emit(0, ['p1']);
    act(() => result.current.setRoom(previous => ({...previous!, boardState: {...previous!.boardState!, sharedCardPrompt: {
        ...previous!.boardState!.sharedCardPrompt!, responses: { ...previous!.boardState!.sharedCardPrompt!.responses, p2: response('p2').data() }
    }}} as Room)));
    expect(finalize).toHaveBeenCalledExactlyOnceWith('123456', 'prompt');
    expect(listeners.entries).toHaveLength(1);
});

it('replaces subscriptions on event and session changes and ignores late old callbacks', () => {
    const {result, finalize} = harness();
    act(() => result.current.setRoom(previous => ({...previous!, boardState: {...previous!.boardState!, sharedCardPrompt: {
        ...previous!.boardState!.sharedCardPrompt!, id: 'next', responses: {}
    }}})));
    expect(listeners.entries[0].stop).toHaveBeenCalledOnce();
    expect(listeners.entries[1].path).toBe('rooms/123456/events/next/responses');
    const next = result.current.room;
    emit(0, ['p1','p2']);
    expect(result.current.room).toBe(next);
    expect(finalize).not.toHaveBeenCalled();
    act(() => result.current.setRoom(previous => ({...previous!,sessionId:'new-session'})));
    expect(listeners.entries[1].stop).toHaveBeenCalledOnce();
    expect(listeners.entries).toHaveLength(3);
});

it('subscribes only to an ordinary player own response and never finalizes', () => {
    const {result, finalize} = harness('p1');
    expect(listeners.entries[0].path).toBe('rooms/123456/events/prompt/responses/p1');
    act(() => listeners.entries[0].next({exists: () => true, data: () => response('p1').data()}));
    expect(result.current.room?.boardState?.sharedCardPrompt?.responses?.p1.status).toBe('declined');
    expect(finalize).not.toHaveBeenCalled();
});

it('leaves backend completion to triggers after all replies, retaining the legacy fallback only in legacy rooms', () => {
    const finalize = vi.fn(async () => {});
    const {result} = renderHook(() => {
        const [room,setRoom] = useState<Room|null>(() => ({...initialRoom(),promptCompletionAuthority:'server-prompts-v1'}));
        const [,setError] = useState<string|null>(null);
        useSharedPromptResponses({room,setRoom,setError,user:{uid:'coach',role:'coach'},finalize});
        return {room,setRoom};
    });
    emit(0,['p1','p2']);
    expect(result.current.room?.boardState?.sharedCardPrompt?.responses?.p2.status).toBe('declined');
    expect(finalize).not.toHaveBeenCalled();
    act(() => result.current.setRoom(previous => ({...previous!,promptCompletionAuthority:undefined})));
    expect(finalize).toHaveBeenCalledExactlyOnceWith('123456','prompt');
    expect(listeners.entries).toHaveLength(1);
});

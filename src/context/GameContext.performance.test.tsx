import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
    room: { id: '123456', hostId: 'coach', status: 'playing', flowSchemaVersion: 1,
        financialAcceleration: { multiplier: 1, updatedAt: 1 }, boardState: { revision: 1 } },
    user: {uid:'p1'}, retry: vi.fn(),
}));
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: fixture.user }) }));
vi.mock('./RoomContext', () => ({ useRoom: () => ({room:fixture.room, playerStatesHydrated:true, roomSyncState:'synced', isController:true}) }));
vi.mock('../hooks/usePublicFinancialEffects', () => ({ usePublicFinancialEffects: () => ({failure:null,retry:fixture.retry}) }));
vi.mock('../utils/telemetry', () => ({trackGameEvent:vi.fn(async()=>{})}));
import { GameProvider, useGame } from './GameContext';
import * as calculations from '../utils/gameUtils';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('does not recalculate finances or republish game context for unrelated room snapshots; updates on multiplier changes', async () => {
    const calculate = vi.spyOn(calculations,'calculateFinancialSummary');
    const hook = renderHook(() => useGame(), {wrapper: ({children}: {children:React.ReactNode}) => <GameProvider>{children}</GameProvider>});
    await act(async()=>{});
    const before = hook.result.current;
    calculate.mockClear();
    for (let revision = 2; revision <= 21; revision++) {
        fixture.room = {...fixture.room,boardState:{revision},financialAcceleration:{...fixture.room.financialAcceleration}};
        hook.rerender();
        expect(hook.result.current).toBe(before);
    }
    expect(calculate).not.toHaveBeenCalled();
    expect(hook.result.current).toBe(before);
    fixture.room = {...fixture.room,financialAcceleration:{multiplier:2,updatedAt:2}};
    hook.rerender();
    expect(calculate).toHaveBeenCalled();
    expect(hook.result.current.financialAcceleration.multiplier).toBe(2);
    expect(hook.result.current).not.toBe(before);
});

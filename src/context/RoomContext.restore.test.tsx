import React from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    user: {uid:'p1',role:'player',activeGame:undefined as undefined | {roomId:string}},
    getDoc: vi.fn(),
}));
vi.mock('./AuthContext', () => ({useAuth: () => ({user:mocks.user})}));
vi.mock('../../services/firebase', () => ({db:{}}));
vi.mock('../../services/realtime', () => ({realtimeDb:{}}));
vi.mock('../utils/serverClock', () => ({serverNow:()=>Date.now(),subscribeServerClock:()=>()=>{}}));
vi.mock('../utils/telemetry', () => ({trackGameEvent:async()=>{},trackBoardStage:()=>{}}));
vi.mock('../hooks/useGameDiagnostics', () => ({useGameDiagnostics:()=>{}}));
vi.mock('../hooks/useMovementSettlement', () => ({useMovementSettlement:()=>({retry:()=>{},error:null,busy:false})}));
vi.mock('../utils/recoveringSnapshot', () => ({
    observeSnapshots: () => () => () => {},
    subscribeSubscriptionHealth: () => () => {}, getSubscriptionErrors: () => '[]'
}));
vi.mock('firebase/firestore', async importOriginal => ({
    ...await importOriginal<typeof import('firebase/firestore')>(),
    doc: (_db:unknown,...parts:string[]) => parts.join('/'),
    collection: (_db:unknown,...parts:string[]) => parts.join('/'),
    getDoc: mocks.getDoc,
}));
vi.mock('firebase/database', () => ({
    ref:()=>({}),push:()=>({}),onValue:()=>()=>{},
    onDisconnect:()=>({remove:async()=>{},set:async()=>{}}),set:async()=>{},remove:async()=>{},
    serverTimestamp:()=>Date.now(),get:async()=>({val:()=>null})
}));
import { RoomProvider, useRoom } from './RoomContext';
afterEach(() => { cleanup(); localStorage.clear(); mocks.getDoc.mockClear(); });
it.each([true,false])('restores after StrictMode cancels the first read (account resume: %s)', async accountResume => {
    mocks.user.activeGame = accountResume ? {roomId:'123456'} : undefined;
    localStorage.setItem('active_room_p1','123456');
    mocks.getDoc.mockImplementation(async () => ({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',members:[{uid:'p1'}]})}));
    const hook = renderHook(() => useRoom(), {reactStrictMode:true, wrapper: ({children}:{children:React.ReactNode}) => <RoomProvider>{children}</RoomProvider>});
    await waitFor(() => expect(hook.result.current.room?.id).toBe('123456'));
    expect(mocks.getDoc).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('active_room_p1')).toBe('123456');
});

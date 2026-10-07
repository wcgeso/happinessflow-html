import React from 'react';
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
const fixture=vi.hoisted(()=>({user:{uid:'p1'},read:vi.fn(),hydrate:vi.fn()}));
vi.mock('./AuthContext',()=>({useAuth:()=>({user:fixture.user})}));
vi.mock('./RoomContext',()=>({useRoom:()=>({room:null,playerStatesHydrated:true,roomSyncState:'synced',isController:true})}));
vi.mock('../../services/firebase',()=>({db:{},auth:{currentUser:null}}));
vi.mock('../hooks/usePublicFinancialEffects',()=>({usePublicFinancialEffects:()=>({failure:null,retry:()=>{}})}));
vi.mock('../utils/telemetry',()=>({trackGameEvent:vi.fn()}));
vi.mock('../utils/recoveringSnapshot',()=>({observeSnapshots:()=>()=>{}}));
vi.mock('../game/settlement/scoreRecord',()=>({loadScoreRecord:fixture.hydrate}));
vi.mock('firebase/firestore',()=>({doc:(_db:unknown,...parts:string[])=>parts.join('/'),collection:(_db:unknown,...parts:string[])=>parts.join('/'),query:(path:string)=>path,where:()=>({}),orderBy:()=>({}),limit:()=>({}),startAfter:()=>({}),documentId:()=>({}),getDocs:fixture.read,updateDoc:vi.fn(),setDoc:vi.fn(),runTransaction:vi.fn(),serverTimestamp:()=>0}));
import {GameProvider,useGame} from './GameContext';
const empty={docs:[],forEach:()=>{}};
const wrapper=({children}:{children:React.ReactNode})=><GameProvider>{children}</GameProvider>;
afterEach(cleanup);
beforeEach(()=>{fixture.user={uid:'p1'};fixture.read.mockReset();fixture.hydrate.mockReset();fixture.read.mockResolvedValue(empty);});
it('hydrates own official details instead of treating the compact summary as full finances',async()=>{
 fixture.read.mockImplementation(async(path:string)=>path.startsWith('score_records')?{docs:[{id:'record',data:()=>({playerStorage:'subcollection',players:[{uid:'p1'}]})}]}:empty);
 const profession={id:'profession',title:'職業',salary:10};
 fixture.hydrate.mockResolvedValue({roomId:'r',sessionId:'s',financialHistoryStorage:'subcollection',isFinal:true,settledAt:1,players:[{uid:'p1',name:'甲',profession:'職業',professionData:profession,cash:1234,currentRankLevel:4,medicalInsuranceCount:1,abilities:{realEstateAbilityCount:2},selectedEnterprise:{name:'目標事業'},totalScore:56,happiness:8,summary:{totalIncome:99}}]});
 const hook=renderHook(()=>useGame(),{wrapper});await waitFor(()=>expect(hook.result.current.gameHistory).toHaveLength(1));
 expect(fixture.hydrate.mock.calls[0][3]).toBe('p1');expect(hook.result.current.gameHistory[0].gameStateSnapshot.cash).toBe(1234);expect(hook.result.current.gameHistory[0].professionData).toEqual(profession);expect(hook.result.current.gameHistory[0].historySource?.uid).toBe('p1');expect(hook.result.current.gameHistory[0].gameStateSnapshot).toMatchObject({currentRankLevel:4,medicalInsuranceCount:1,abilities:{realEstateAbilityCount:2},selectedEnterprise:{name:'目標事業'}});
});
it('clears previous account history and ignores late official and self-saved results',async()=>{
 let resolveOfficial:(value:unknown)=>void=()=>{},resolveDraft:(value:unknown)=>void=()=>{};
 fixture.read.mockImplementation((path:string)=>path.startsWith('score_records')?new Promise(resolve=>{resolveOfficial=resolve;}):new Promise(resolve=>{resolveDraft=resolve;}));
 const hook=renderHook(()=>useGame(),{wrapper});fixture.user={uid:'p2'};fixture.read.mockResolvedValue(empty);hook.rerender();
 fixture.hydrate.mockResolvedValue({players:[{uid:'p1',cash:888}]});
 await act(async()=>{resolveOfficial({docs:[{id:'old',data:()=>({})}]});resolveDraft({forEach:(callback:any)=>callback({id:'oldDraft',data:()=>({playerName:'舊玩家',updatedAt:1})})});});
 await waitFor(()=>expect(hook.result.current.gameHistory).toEqual([]));expect(hook.result.current.alertInfo).toBeNull();
});
it('exposes an actual history error and retries the original account reads',async()=>{
 fixture.read.mockRejectedValueOnce({code:'permission-denied'});
 const hook=renderHook(()=>useGame(),{wrapper});await waitFor(()=>expect(hook.result.current.historyLoadError).toContain('permission-denied'));
 await act(async()=>hook.result.current.retryHistory());await waitFor(()=>expect(hook.result.current.historyLoadError).toBe(''));expect(fixture.read).toHaveBeenCalledTimes(4);
});

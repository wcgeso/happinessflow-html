import React from 'react';
import { act,cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    user: {uid:'p1',role:'player',activeGame:undefined as undefined | {roomId:string}},
    getDoc: vi.fn(),
    setDoc:vi.fn(),
    updateDoc:vi.fn(),
    banking: vi.fn(),
    server: vi.fn(),
    creation:vi.fn(),
    membership:vi.fn(),
    lifecycle:vi.fn(),
    auth:{currentUser:{uid:"p1"}},
    recoverCreation:vi.fn(),
    claim:undefined as unknown,
}));
vi.mock('./AuthContext', () => ({useAuth: () => ({user:mocks.user})}));
vi.mock('../../services/firebase', () => ({db:{},auth:mocks.auth}));
vi.mock('../../services/realtime', () => ({realtimeDb:{}}));
vi.mock('../utils/serverClock', () => ({serverNow:()=>Date.now(),subscribeServerClock:()=>()=>{}}));
vi.mock('../utils/telemetry', () => ({trackGameEvent:async()=>{},trackBoardStage:()=>{}}));
vi.mock('../hooks/useGameDiagnostics', () => ({useGameDiagnostics:()=>{}}));
vi.mock('../hooks/useMovementSettlement', () => ({useMovementSettlement:()=>({retry:()=>{},error:null,busy:false})}));
vi.mock('../game/finance/serverBankingCommand', async importOriginal=>({...await importOriginal<typeof import('../game/finance/serverBankingCommand')>(),submitServerBanking:mocks.banking}));
vi.mock('../game/board/serverRoomMembership',()=>({submitRoomMembership:mocks.membership}));
vi.mock('../game/board/serverRoomLifecycle',()=>({submitRoomLifecycle:mocks.lifecycle}));
vi.mock('../game/board/serverRoomCreation',()=>({createRoomOnServer:mocks.creation,recoverRoomCreationOnServer:mocks.recoverCreation}));
vi.mock('../game/board/serverPromptCommand', () => ({submitServerGameCommand:mocks.server,callServerGameCommand:mocks.server}));
vi.mock('../utils/recoveringSnapshot', () => ({
    observeSnapshots: () => () => () => {},
    subscribeSubscriptionHealth: () => () => {}, getSubscriptionErrors: () => '[]'
}));
vi.mock('firebase/firestore', async importOriginal => ({
    ...await importOriginal<typeof import('firebase/firestore')>(),
    doc: (_db:unknown,...parts:string[]) => parts.join('/'),
    collection: (_db:unknown,...parts:string[]) => parts.join('/'),
    getDoc: mocks.getDoc,
    getDocFromServer:mocks.getDoc,
    setDoc:mocks.setDoc,
    updateDoc:mocks.updateDoc,
}));
vi.mock('firebase/database', () => ({
    ref:(_db:unknown,path:string)=>({path}),push:()=>({}),onValue:(target:{path?:string},listener:(snapshot:unknown)=>void)=>{if(target.path?.startsWith('roomControllers/'))listener({val:()=>({claimed:mocks.claim})});return()=>{};},
    onDisconnect:()=>({remove:async()=>{},set:async()=>{}}),set:async(_ref:unknown,value:{clientId?:string})=>{if(value?.clientId)mocks.claim=value;},remove:async()=>{},
    serverTimestamp:()=>Date.now(),get:async()=>({val:()=>null})
}));
import {HAPPINESS_CARDS} from '../constants/cards';
import { RoomProvider, useRoom, useRoomActions } from './RoomContext';
afterEach(() => { cleanup(); localStorage.clear(); mocks.claim=undefined; mocks.user.role='player'; mocks.getDoc.mockClear(); mocks.banking.mockReset(); mocks.server.mockReset();mocks.creation.mockReset();mocks.recoverCreation.mockReset();mocks.setDoc.mockReset();mocks.updateDoc.mockReset();mocks.membership.mockReset();mocks.auth.currentUser={uid:"p1"};vi.unstubAllEnvs(); });
it.each([true,false])('restores after StrictMode cancels the first read (account resume: %s)', async accountResume => {
    mocks.user.activeGame = accountResume ? {roomId:'123456'} : undefined;
    localStorage.setItem('active_room_p1','123456');
    mocks.getDoc.mockImplementation(async () => ({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',members:[{uid:'p1'}]})}));
    const hook = renderHook(() => useRoom(), {reactStrictMode:true, wrapper: ({children}:{children:React.ReactNode}) => <RoomProvider>{children}</RoomProvider>});
    await waitFor(() => expect(hook.result.current.room?.id).toBe('123456'));
    expect(mocks.getDoc).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('active_room_p1')).toBe('123456');
});
it('routes all personal finance forms to canonical server choices without client effects',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.banking.mockResolvedValue({status:'applied'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'}]})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>expect(hook.result.current.room?.id).toBe('123456'));
 const base={commandId:'original',boardEventId:'event',cashChange:999999,amount:30000,usage:'asset' as const,source:'cash' as const,name:'untrusted'};
 const examples=[
  [()=>hook.result.current.completeStockTrade({...base,stockList:[{symbol:'A10',qty:2,price:1000}]}),{type:'tradeStock',mode:'buy',trades:[{symbol:'A10',qty:2,expectedPrice:1000}]}],
  [()=>hook.result.current.completeCarPurchase({...base,assetDetails:{type:'汽車',downPayment:120000,loanAmount:1,loanInterest:1,cashflow:999999}}),{type:'purchaseCar',cashContribution:120000}],
  [()=>hook.result.current.completeInsurancePurchase({...base,insuranceType:'medical',insurancePayload:{medicalQty:100}}),{type:'purchaseInsurance',insuranceType:'medical'}],
  [()=>hook.result.current.completeDepositPurchase(base),{type:'purchaseDeposit',amount:30000}],
  [()=>hook.result.current.completeDepositWithdrawal({...base,relatedAssetId:'deposit'}),{type:'withdrawDeposit',amount:30000,assetId:'deposit'}],
  [()=>hook.result.current.buyCurrentRealEstateCard('event','N029',{...base,assetDetails:{type:'不動產',isSelfUse:true,cashflow:999999,loanAmount:1}}),{type:'purchaseRealEstate',source:'current',eventId:'event',cardId:'N029',toSelfUse:true}],
  [()=>hook.result.current.buyRealEstateFromMarket('N029','attempt',{...base,assetDetails:{type:'不動產',isSelfUse:false}}),{type:'purchaseRealEstate',source:'market',cardId:'N029',toSelfUse:false}],
  [()=>hook.result.current.completeHouseConversion('house',true,'convert'),{type:'convertHouse',assetId:'house',toSelfUse:true}],
 ] as const;
 await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 for(const [run,expected] of examples){await act(async()=>{await run();});expect(mocks.banking.mock.calls.at(-1)?.[3]).toEqual(expected);}
 expect(mocks.banking).toHaveBeenCalledTimes(8);
});

it('uses confirmed server market data and closes through the original event command',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.server.mockResolvedValue({status:'applied'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'}],marketUpdates:{code:'N001'},boardState:{currentTurnUid:'p1',currentEvent:{id:'event',playerUid:'p1',type:'card'},currentCard:{deck:'news',cardId:'N001'},currentCardReveal:{isRevealed:true,eventId:'event',cardId:'N001'}}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 await act(async()=>{await hook.result.current.applyBoardMarketPrices({A10:999999},'N001',true);});expect(mocks.server).not.toHaveBeenCalled();
 await expect(hook.result.current.applyBoardMarketPrices({},'N002')).rejects.toThrow('等待後端確認');
 await act(async()=>{expect(await hook.result.current.dismissBoardCard('event','N001')).toBe(true);});
 expect(mocks.server).toHaveBeenCalledWith({type:'finishMarket',roomId:'123456',sessionId:'session',eventId:'event',cardId:'N001',commandId:'market-finish:session:event'});
});

it('sends only happiness choices and the captured source event, never client points or cash effects',async()=>{
 const card=HAPPINESS_CARDS.find(c=>c.category!=='家庭重要歷程'&&!c.requiresStorySharing)!;
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.server.mockResolvedValue({status:'applied'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'}],boardState:{currentTurnUid:'p1',currentEvent:{id:'event',playerUid:'p1',type:'card'},currentCard:{deck:'happiness',cardId:card.id},currentCardReveal:{isRevealed:true,eventId:'event',cardId:card.id}}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 const forged={name:'untrusted',source:'cash' as const,usage:'happiness_event' as const,amount:1,cashChange:999999,boardFlow:'board-card' as const,boardEventId:'payment-id',boardSourceEventId:'captured-event',boardSourceCardId:card.id,fundingLoanAmount:100,happinessEventPayload:{id:'H011',sourceCardId:'H011',name:'forged',amount:1,points:999}};
 await act(async()=>{expect((await hook.result.current.completeBoardTransaction(forged)).status).toBe('applied');});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'happinessCard',roomId:'123456',sessionId:'session',eventId:'captured-event',cardId:card.id,choice:'accept',commandId:'happiness:session:captured-event:accept',fundingLoanAmount:100});
 await act(async()=>{expect((await hook.result.current.completeDirectHappinessCard('event',card.id,forged)).status).toBe('applied');});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'happinessCard',roomId:'123456',sessionId:'session',eventId:'event',cardId:card.id,choice:'accept',commandId:'happiness:session:event:accept'});
 await act(async()=>{expect(await hook.result.current.dismissBoardCard('old-event',card.id)).toBe(true);});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'happinessCard',roomId:'123456',sessionId:'session',eventId:'old-event',cardId:card.id,choice:'dismiss',commandId:'happiness:session:old-event:dismiss'});
});

it('routes medical payment, late closure and insurance claim without client amounts',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.server.mockResolvedValue({status:'applied'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'}],boardState:{currentTurnUid:'p1',currentEvent:{id:'event',playerUid:'p1',type:'card'},currentCard:{deck:'opportunity',cardId:'C035'},currentCardReveal:{isRevealed:true,eventId:'event',cardId:'C035'}}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 const forged={name:'untrusted',source:'cash' as const,usage:'expense' as const,amount:1,cashChange:99999,boardFlow:'board-card' as const,boardSourceEventId:'captured-event',boardSourceCardId:'C036',forcedDebtAmount:1234};
 await act(async()=>{expect((await hook.result.current.completeMedicalBoardCardAction('event','C035',forged)).status).toBe('applied');});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'payMedicalCard',roomId:'123456',sessionId:'session',eventId:'captured-event',cardId:'C036',commandId:'medical-pay:session:captured-event',forcedDebtAmount:1234});
 await act(async()=>{expect(await hook.result.current.dismissBoardCard('old-event','C035')).toBe(true);});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'finishMedicalCard',roomId:'123456',sessionId:'session',eventId:'old-event',cardId:'C035',commandId:'medical-finish:session:old-event'});
 await act(async()=>{expect((await hook.result.current.completeBoardTransaction({...forged,boardFlow:'insurance-claim',medicalClaimId:'claim-id',boardEventId:'claim-id'})).status).toBe('applied');});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'claimMedical',roomId:'123456',sessionId:'session',claimId:'claim-id',commandId:'fin:session:p1:claim-id'});
});

 it('routes standalone opportunity effects, payment and old closure using only captured choices',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.server.mockResolvedValue({status:'applied'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'}],boardState:{currentTurnUid:'p1',currentEvent:{id:'event',playerUid:'p1',type:'card'},currentCard:{deck:'opportunity',cardId:'C044'},currentCardReveal:{isRevealed:true,eventId:'event',cardId:'C044'}}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 await act(async()=>{expect((await hook.result.current.completeBoardTransaction({name:'forged',source:'cash',usage:'expense',amount:1,cashChange:999999,boardFlow:'board-card',boardEventId:'payment-id',boardSourceEventId:'captured-event',boardSourceCardId:'C044',forcedDebtAmount:8000})).status).toBe('applied');});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'opportunityCard',roomId:'123456',sessionId:'session',eventId:'captured-event',cardId:'C044',choice:'accept',commandId:'opportunity:session:captured-event:accept',forcedDebtAmount:8000});
 await act(async()=>{expect((await hook.result.current.applyVehicleLoss('loss-event','C038','car-id')).status).toBe('applied');});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'opportunityCard',roomId:'123456',sessionId:'session',eventId:'loss-event',cardId:'C038',choice:'accept',commandId:'opportunity:session:loss-event:accept',assetId:'car-id'});
 await act(async()=>{expect(await hook.result.current.dismissBoardCard('old-event','C055')).toBe(true);});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'opportunityCard',roomId:'123456',sessionId:'session',eventId:'old-event',cardId:'C055',choice:'dismiss',commandId:'opportunity:session:old-event:dismiss'});
});

it('routes C054 sharing submission and old closure without submitting local expense effects',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.server.mockResolvedValue({status:'applied'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'}],boardState:{currentTurnUid:'p1',currentEvent:{id:'event',playerUid:'p1',type:'card'},currentCard:{deck:'opportunity',cardId:'C054'}}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 await act(async()=>{expect(await hook.result.current.submitRequest({uid:'p1',playerName:'玩家',type:'board_share',amount:99999,boardCardId:'C054',boardEventId:'event'})).toBe(true);});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'submitFollowup',cardId:'C054',roomId:'123456',sessionId:'session',eventId:'event',commandId:'followup-submit:event:1'});
 await act(async()=>{expect((await hook.result.current.completeBoardTransaction({name:'forged',source:'income',usage:'expense_update',amount:99999,cashChange:99999,boardFlow:'board-card',boardEventId:'payment',boardSourceEventId:'event',boardSourceCardId:'C054',expensePayload:{category:'basicLiving',amount:99999,isIncrease:false}})).status).toBe('applied');});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'applyFollowup',cardId:'C054',roomId:'123456',sessionId:'session',eventId:'event',commandId:'fin:session:p1:payment'});
 await act(async()=>{expect(await hook.result.current.dismissBoardCard('old-event','C054')).toBe(true);});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'declineFollowup',cardId:'C054',roomId:'123456',sessionId:'session',eventId:'old-event',commandId:'followup-decline:session:old-event'});
});
it('routes coach C054 approval, rejection and cleanup to the server with the review attempt',async()=>{
 mocks.user.role='coach';mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.server.mockResolvedValue({status:'applied'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'p1',status:'playing',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'},{uid:'p2'}],pendingRequests:{req:{id:'req',uid:'p2',type:'board_share',boardCardId:'C054',boardEventId:'event',status:'pending',attempt:2}},boardState:{currentTurnUid:'p2',currentEvent:{id:'event',playerUid:'p2',type:'card'},currentCard:{deck:'opportunity',cardId:'C054'}}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 for(const [method,type,commandId] of [['approveRequest','approveFollowup','followup-approve:req:2'],['rejectRequest','rejectFollowup','followup-reject:req:2'],['clearRequest','clearFollowup','followup-clear:req:2']] as const){
  await act(async()=>{expect(await hook.result.current[method]('req')).toBe(true);});expect(mocks.server).toHaveBeenLastCalledWith({type,cardId:'C054',roomId:'123456',sessionId:'session',eventId:'event',requestId:'req',attempt:2,commandId});
 }
});
it('routes coach adjustments to canonical commands and retains uncertain failures',async()=>{
 mocks.user.role='coach';mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.server.mockResolvedValue({status:'applied'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'p1',status:'playing',bankingAuthority:'server-banking-v1',movementAuthority:'server-movement-v1',members:[{uid:'p1'},{uid:'p2'}],boardState:{currentTurnUid:'p2'}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 await act(async()=>{await hook.result.current.adjustPlayerCash('p2',500,'cash-id');});expect(mocks.server).toHaveBeenLastCalledWith({type:'coachAdjustment',roomId:'123456',sessionId:'session',commandId:'cash-id',action:'cash',playerUid:'p2',amount:500});
 await act(async()=>{await hook.result.current.adjustPlayerInvestmentIncome('p2',200,'income-id');});expect(mocks.server).toHaveBeenLastCalledWith(expect.objectContaining({action:'income',amount:200,commandId:'income-id'}));
 await act(async()=>{await hook.result.current.adjustPlayerLiability('p2','loan#1',{totalOwedDelta:-1000,monthlyPaymentDelta:-10,reason:' 更正 '},'liability-id');});expect(mocks.server).toHaveBeenLastCalledWith(expect.objectContaining({action:'liability',liabilityId:'loan#1',totalOwedDelta:-1000,monthlyPaymentDelta:-10,reason:'更正',commandId:'liability-id'}));
 await act(async()=>{await hook.result.current.adjustPlayerExpense('p2','basicLiving',100,' 原因 ','expense-id');});expect(mocks.server).toHaveBeenLastCalledWith(expect.objectContaining({action:'expense',category:'basicLiving',amount:100,reason:'原因',commandId:'expense-id'}));
 await act(async()=>{await hook.result.current.grantFinancialSubsidyToAllPlayers(500,'subsidy-id');});expect(mocks.server).toHaveBeenLastCalledWith({type:'coachSubsidy',roomId:'123456',sessionId:'session',commandId:'subsidy-id',amount:500});
 await act(async()=>{await hook.result.current.updateMarket({A10:1},'N002',false,'market-id');});expect(mocks.server).toHaveBeenLastCalledWith({type:'coachMarket',roomId:'123456',sessionId:'session',commandId:'market-id',code:'N002'});
 await act(async()=>{await hook.result.current.updateFinancialAcceleration(1.5,'acceleration-id');});expect(mocks.server).toHaveBeenLastCalledWith({type:'coachAcceleration',roomId:'123456',sessionId:'session',commandId:'acceleration-id',multiplier:1.5});
 await act(async()=>{await hook.result.current.updateRoomTimer(3600,true,null,'timer-original','set');});expect(mocks.server).toHaveBeenLastCalledWith({type:'setTimer',roomId:'123456',sessionId:'session',commandId:'timer-original',seconds:3600,paused:true,mode:'set'});
 mocks.server.mockResolvedValue({status:'waiting'});await act(async()=>{await expect(hook.result.current.adjustPlayerCash('p2',500,'waiting-id')).rejects.toMatchObject({code:'waiting-confirmation'});});
 await act(async()=>{await expect(hook.result.current.grantFinancialSubsidyToAllPlayers(500,'subsidy-waiting')).rejects.toMatchObject({code:'waiting-confirmation'});});
 await act(async()=>{await expect(hook.result.current.updateMarket({},'N002',false,'market-waiting')).rejects.toMatchObject({code:'waiting-confirmation'});});
 await act(async()=>{await expect(hook.result.current.updateFinancialAcceleration(3,'acceleration-waiting')).rejects.toMatchObject({code:'waiting-confirmation'});});
 await act(async()=>{await expect(hook.result.current.updateRoomTimer(60,false,null,'timer-waiting','set')).rejects.toMatchObject({code:'waiting-confirmation'});});
 mocks.server.mockRejectedValue(Object.assign(new Error('尚未確認'),{code:'functions/unavailable'}));await act(async()=>{await expect(hook.result.current.adjustPlayerCash('p2',500,'original-id')).rejects.toMatchObject({code:'unavailable'});});expect(mocks.server).toHaveBeenLastCalledWith(expect.objectContaining({commandId:'original-id'}));
});
it('routes happiness choices to own backend commands and refuses implicit toggles',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.server.mockResolvedValue({status:'applied'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'}],boardState:{currentTurnUid:'other'}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 await act(async()=>{expect((await hook.result.current.completeHappinessToggle('custom',true,'toggle-id')).status).toBe('applied');});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'personalHappiness',roomId:'123456',sessionId:'session',commandId:'toggle-id',action:'toggle',itemId:'custom',checked:true});
 await act(async()=>{expect((await hook.result.current.completeHappinessAdd('項目',2,'add-id')).status).toBe('applied');});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'personalHappiness',roomId:'123456',sessionId:'session',commandId:'add-id',action:'add',label:'項目',points:2});
 await act(async()=>{expect((await hook.result.current.completeHappinessRemove('custom','remove-id')).status).toBe('applied');});
 expect(mocks.server).toHaveBeenLastCalledWith({type:'personalHappiness',roomId:'123456',sessionId:'session',commandId:'remove-id',action:'remove',itemId:'custom'});
 mocks.server.mockClear();await act(async()=>{expect((await hook.result.current.completeHappinessToggle('custom',undefined,'implicit')).status).toBe('failed');});expect(mocks.server).not.toHaveBeenCalled();
});
it('uses canonical banking routes for manual and shared-prompt turnaround forms',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.banking.mockResolvedValue({status:'applied'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'}],boardState:{currentTurnUid:'other',sharedCardPrompt:{id:'shared',responseStorage:'subcollection'}}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 const loan={name:'申請信用貸款',source:'loan' as const,usage:'cash' as const,amount:1000,cashChange:99999,boardFlow:'manual-bank' as const,commandId:'legacy-loan',assetDetails:{type:'股票' as const,cashflow:99999,downPayment:0,loanAmount:99999,loanInterest:99999}};
 await act(async()=>{expect((await hook.result.current.completePlayerOnlyTransaction(loan)).status).toBe('applied');});expect(mocks.banking).toHaveBeenLastCalledWith(expect.any(Object),'p1','loan:session:p1:legacy-loan',{type:'borrowLoan',amount:1000});
 await act(async()=>{expect((await hook.result.current.completeBoardTransaction({...loan,commandId:'normal-loan'})).status).toBe('applied');});expect(mocks.banking).toHaveBeenLastCalledWith(expect.any(Object),'p1','loan:session:p1:normal-loan',{type:'borrowLoan',amount:1000});
 await act(async()=>{expect((await hook.result.current.completePlayerOnlyTransaction({name:'定存解約',source:'income',usage:'cash',amount:10000,cashChange:99999,relatedAssetId:'deposit',commandId:'withdraw'})).status).toBe('applied');});expect(mocks.banking).toHaveBeenLastCalledWith(expect.any(Object),'p1','deposit-withdrawal:session:p1:withdraw',{type:'withdrawDeposit',amount:10000,assetId:'deposit'});
 mocks.banking.mockClear();await act(async()=>{expect((await hook.result.current.completePlayerOnlyTransaction({...loan,fundingLoanAmount:1000})).status).toBe('failed');});expect(mocks.banking).not.toHaveBeenCalled();expect(mocks.server).not.toHaveBeenCalled();
 await act(async()=>{expect((await hook.result.current.completePlayerOnlyTransaction({name:'賣出',source:'income',usage:'cash',amount:99999,cashChange:99999,commandId:'sale',batchSellList:[{asset:{id:'car#1',name:'偽造名稱',type:'汽車',cost:1,cashflow:99999},price:300000,liability:{id:'fake',name:'假負債',totalOwed:0,monthlyPayment:0}}]})).status).toBe('applied');});expect(mocks.banking).toHaveBeenLastCalledWith(expect.any(Object),'p1','asset-sale:session:p1:sale',{type:'sellAssets',sales:[{assetId:'car#1',price:300000}]});
});
it('sends only the selected dream identifier and preserves an unconfirmed payment',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.banking.mockResolvedValue({status:'waiting',message:'等待確認'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'}],playerStates:{p1:{selectedDream:{id:'D02',cost:1,happyPoints:999}}}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 const data={name:'實現人生夢想：偽造名稱',source:'cash' as const,usage:'expense' as const,amount:1,cashChange:99999,commandId:'dream-original'};
 await act(async()=>{expect((await hook.result.current.completePlayerOnlyTransaction(data)).status).toBe('waiting');});
 expect(mocks.banking).toHaveBeenLastCalledWith(expect.any(Object),'p1','dream:session:p1:dream-original',{type:'purchaseDream',dreamId:'D02'});
 mocks.banking.mockResolvedValue({status:'duplicate'});await act(async()=>{expect((await hook.result.current.completePlayerOnlyTransaction(data)).status).toBe('duplicate');});expect(mocks.banking).toHaveBeenLastCalledWith(expect.any(Object),'p1','dream:session:p1:dream-original',{type:'purchaseDream',dreamId:'D02'});
});

it('routes target enterprise forms with the original intent and without client financial effects',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.banking.mockResolvedValue({status:'waiting',message:'等待確認'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'}],playerStates:{p1:{selectedEnterprise:{id:'E01',cost:1,income:999999}}}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 const data={name:'達成事業成就：偽造名称',source:'cash' as const,usage:'asset' as const,amount:1,cashChange:99999,commandId:'enterprise-original',boardEventId:'old-event',assetDetails:{type:'企業' as const,cashflow:999999,downPayment:1}};
 await act(async()=>{expect((await hook.result.current.completePlayerOnlyTransaction(data)).status).toBe('waiting');});
 expect(mocks.banking).toHaveBeenLastCalledWith(expect.any(Object),'p1','enterprise-original',{type:'purchaseEnterprise',enterpriseId:'E01',fundingLoanAmount:undefined,forcedDebtAmount:undefined});
 mocks.banking.mockResolvedValue({status:'duplicate'});await act(async()=>{expect((await hook.result.current.completeTargetEnterprisePurchase(data)).status).toBe('duplicate');});expect(mocks.banking).toHaveBeenLastCalledWith(expect.any(Object),'p1','enterprise-original',{type:'purchaseEnterprise',enterpriseId:'E01',fundingLoanAmount:undefined,forcedDebtAmount:undefined});
});

it('does not fall back to client finance when the room uses an unknown backend authority',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,bankingAuthority:'future-bank',members:[{uid:'p1'}]})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 await act(async()=>{expect((await hook.result.current.completeLoanBorrow({name:'借款',source:'loan',usage:'cash',amount:1000,cashChange:1000,commandId:'blocked'})).status).toBe('failed');});expect(mocks.banking).not.toHaveBeenCalled();expect(mocks.server).not.toHaveBeenCalled();expect(hook.result.current.error).toContain('請更新遊戲版本');
});

it('starts a backend room only on an explicit host action and keeps the original intent through waiting',async()=>{
 mocks.user.role='coach';mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'reserved',hostId:'p1',status:'waiting',isBoardGame:true,bankingAuthority:'server-banking-v1',members:[{uid:'p1'},{uid:'p2'}]})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>expect(hook.result.current.room?.id).toBe('123456'));expect(mocks.server).not.toHaveBeenCalled();
 mocks.server.mockResolvedValue({status:'waiting',reason:'等待確認'});await act(async()=>{await hook.result.current.startRoomGame();});expect(hook.result.current.error).toBe('等待確認');expect(hook.result.current.room?.status).toBe('waiting');
 expect(mocks.server).toHaveBeenLastCalledWith({type:'startRoom',roomId:'123456',sessionId:'reserved',commandId:'start:reserved:p1'});
 mocks.server.mockResolvedValue({status:'duplicate'});await act(async()=>{await hook.result.current.startRoomGame();});expect(hook.result.current.error).toBeNull();expect(mocks.server).toHaveBeenLastCalledWith({type:'startRoom',roomId:'123456',sessionId:'reserved',commandId:'start:reserved:p1'});expect(hook.result.current.room?.status).toBe('waiting');
});

it('creates enabled backend rooms through the server and attaches its confirmed state',async()=>{
 vi.stubEnv('VITE_SERVER_GAME_ROOMS','true');mocks.user.role='coach';mocks.user.activeGame=undefined;
 const room={id:'123456',sessionId:'server-session',hostId:'p1',status:'waiting',members:[{uid:'p1'}],bankingAuthority:'server-banking-v1'};
 mocks.creation.mockResolvedValue({status:'applied',roomId:room.id,sessionId:room.sessionId,room});
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});
 await act(async()=>{expect(await hook.result.current.createRoom({name:'房間',maxPlayers:6,duration:60,isBoardGame:true})).toBe('123456');});
 expect(mocks.creation).toHaveBeenCalledWith({name:'房間',maxPlayers:6,duration:60});expect(hook.result.current.room?.sessionId).toBe('server-session');expect(localStorage.getItem('active_room_p1')).toBe('123456');expect(mocks.getDoc).not.toHaveBeenCalled();
});
it('recovers the original creation without requiring a reload or another create action',async()=>{
 mocks.user.role='coach';mocks.user.activeGame=undefined;const room={id:'123456',sessionId:'s',hostId:'p1',status:'waiting',members:[{uid:'p1'}]};mocks.recoverCreation.mockResolvedValue({status:'duplicate',roomId:room.id,sessionId:room.sessionId,room});
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await act(async()=>{expect(await hook.result.current.recoverRoomCreation(false)).toBe(true);});expect(mocks.recoverCreation).toHaveBeenCalledWith(false);expect(hook.result.current.room?.id).toBe('123456');expect(mocks.creation).not.toHaveBeenCalled();
});
it.each([['false',false],['true',true]])('preserves legacy creation when backend activation is %s and practice is %s',async(flag,isPractice)=>{
 vi.stubEnv('VITE_SERVER_GAME_ROOMS',flag);mocks.user.role='coach';mocks.user.activeGame=undefined;mocks.getDoc.mockResolvedValue({exists:()=>false});mocks.setDoc.mockResolvedValue(undefined);mocks.updateDoc.mockResolvedValue(undefined);
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await act(async()=>{expect(await hook.result.current.createRoom({name:'舊模式',maxPlayers:6,duration:60,isBoardGame:true,isPractice:isPractice as boolean})).toMatch(/^\d{6}$/);});expect(mocks.creation).not.toHaveBeenCalled();expect(mocks.setDoc).toHaveBeenCalledTimes(1);expect(mocks.setDoc.mock.calls[0][1].bankingAuthority).toBeUndefined();expect(hook.result.current.room?.isBoardGame).toBe(true);
});
it('does not create a legacy room after the backend rejects the create request',async()=>{
 vi.stubEnv('VITE_SERVER_GAME_ROOMS','true');mocks.user.role='coach';mocks.user.activeGame=undefined;mocks.creation.mockRejectedValue(new Error('尚未取得後端開房權限'));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await act(async()=>{await expect(hook.result.current.createRoom({name:'房間',maxPlayers:6,duration:60,isBoardGame:true})).rejects.toThrow('後端開房權限');});expect(mocks.setDoc).not.toHaveBeenCalled();expect(mocks.getDoc).not.toHaveBeenCalled();expect(hook.result.current.room).toBeNull();
});
it('joins backend rooms through a canonical server command and attaches the latest confirmed membership',async()=>{
 mocks.user.activeGame=undefined;const candidate={id:'123456',sessionId:'s',hostId:'coach',status:'waiting',members:[{uid:'coach'}],bankingAuthority:'server-banking-v1'},joined={...candidate,members:[...candidate.members,{uid:'p1'}]};mocks.getDoc.mockResolvedValueOnce({exists:()=>true,data:()=>candidate}).mockResolvedValue({exists:()=>true,data:()=>joined});mocks.membership.mockResolvedValue({status:'applied'});
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await act(async()=>{await hook.result.current.joinRoom('123456');});expect(mocks.membership).toHaveBeenCalledWith(candidate,'p1',{type:'joinRoom'});expect(hook.result.current.room?.members.some(m=>m.uid==='p1')).toBe(true);expect(mocks.updateDoc).not.toHaveBeenCalled();
});
it('restores an existing playing seat even when a financial command remains unconfirmed',async()=>{
 mocks.user.activeGame=undefined;const candidate={id:'123456',sessionId:'s',hostId:'coach',status:'playing',members:[{uid:'coach'},{uid:'p1'}],bankingAuthority:'server-banking-v1'};mocks.getDoc.mockResolvedValue({exists:()=>true,data:()=>candidate});const finance={type:'borrowLoan',roomId:'123456',sessionId:'s',commandId:'finance',amount:1000};localStorage.setItem('hf-server-command:p1:123456:s',JSON.stringify(finance));mocks.server.mockResolvedValue({status:'waiting'});
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await act(async()=>{await hook.result.current.joinRoom('123456');});expect(hook.result.current.room?.id).toBe('123456');expect(mocks.membership).not.toHaveBeenCalled();expect(JSON.parse(localStorage.getItem('hf-server-command:p1:123456:s')!)).toEqual(finance);
 await act(async()=>{await hook.result.current.leaveRoom();});expect(hook.result.current.room).toBeNull();expect(mocks.membership).not.toHaveBeenCalled();expect(mocks.updateDoc).not.toHaveBeenCalled();
});
it('does not clear a waiting room or fall back to direct writes when leaving fails',async()=>{
 mocks.user.activeGame={roomId:'123456'};mocks.getDoc.mockResolvedValue({exists:()=>true,data:()=>({id:'123456',sessionId:'s',hostId:'coach',status:'waiting',members:[{uid:'p1'}],bankingAuthority:'server-banking-v1'})});mocks.membership.mockRejectedValue(new Error('待確認'));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>expect(hook.result.current.room?.id).toBe('123456'));await act(async()=>{await expect(hook.result.current.leaveRoom()).rejects.toThrow('待確認');});expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.error).toBe('待確認');expect(mocks.updateDoc).not.toHaveBeenCalled();
});
it('preserves an unknown-format room and refuses membership writes rather than falling back',async()=>{
 mocks.user.activeGame={roomId:'123456'};mocks.getDoc.mockResolvedValue({exists:()=>true,data:()=>({id:'123456',sessionId:'s',hostId:'coach',status:'waiting',members:[{uid:'p1'}],bankingAuthority:'server-banking-v2'})});
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>expect(hook.result.current.room?.id).toBe('123456'));
 await act(async()=>{await expect(hook.result.current.leaveRoom()).rejects.toThrow('請更新');await expect(hook.result.current.setRoomPlayerSlotOpen(5,false)).rejects.toThrow('請更新');});
 expect(hook.result.current.room?.id).toBe('123456');expect(mocks.membership).not.toHaveBeenCalled();expect(mocks.updateDoc).not.toHaveBeenCalled();
});
it.each(['finishRoom','closeRoom'] as const)('routes actual %s to the backend and preserves the room on failure',async type=>{
 mocks.lifecycle.mockReset();mocks.user.activeGame={roomId:'123456'};const room={id:'123456',sessionId:'s',hostId:'p1',status:'playing',members:[{uid:'p1'}],bankingAuthority:'server-banking-v1'};mocks.getDoc.mockResolvedValue({exists:()=>true,data:()=>room});mocks.lifecycle.mockRejectedValueOnce(new Error('封存尚待確認')).mockResolvedValueOnce({status:'duplicate'});
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 const actRoom=()=>type==='closeRoom'?hook.result.current.closeRoom():hook.result.current.finishRoomGame();await act(async()=>{await expect(actRoom()).rejects.toThrow('尚待確認');});expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.error).toContain('尚待確認');
 await act(async()=>{await actRoom();});expect(mocks.lifecycle).toHaveBeenLastCalledWith(room,'p1',type);expect(mocks.updateDoc).not.toHaveBeenCalled();expect(mocks.setDoc).not.toHaveBeenCalled();expect(hook.result.current.room?.id).toBe(type==='closeRoom'?undefined:'123456');
 mocks.lifecycle.mockReset();
});
it('routes coach offline handling to persistent backend commands without local Firestore writes',async()=>{
 mocks.user.role='coach';mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');mocks.server.mockResolvedValue({status:'applied'});
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'p1',status:'playing',isBoardGame:true,movementAuthority:'server-movement-v1',promptCompletionAuthority:'server-prompts-v1',bankingAuthority:'server-banking-v1',members:[{uid:'p1'},{uid:'target'}],boardState:{revision:12,currentTurnUid:'target',currentEvent:{id:'event',playerUid:'target'},sharedCardPrompt:{id:'prompt',sourceEventId:'event',targetPlayerUids:['target']}}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});
 await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 await act(async()=>{await hook.result.current.skipDisconnectedTurn('target');await hook.result.current.skipDisconnectedSharedPromptTarget('target');await hook.result.current.setCoachNextTurn('target');await hook.result.current.coachTriggerBoardCard('target','H020');await hook.result.current.repeatCurrentBoardEvent();await hook.result.current.clearCurrentBoardEvent();await hook.result.current.forceEndBoardTurn();});
 expect(mocks.server).toHaveBeenNthCalledWith(1,expect.objectContaining({type:'skipDisconnectedTurn',roomId:'123456',sessionId:'session',playerUid:'target',revision:12,commandId:'coach-offline-turn:session:target:12'}));
 expect(mocks.server).toHaveBeenNthCalledWith(2,expect.objectContaining({type:'skipDisconnectedSharedTarget',playerUid:'target',promptId:'prompt',eventId:'event',commandId:'coach-offline-shared:session:prompt:target'}));
 expect(mocks.server).toHaveBeenNthCalledWith(3,expect.objectContaining({type:'setCoachNextTurn',playerUid:'target',revision:12,commandId:'coach-turn:session:target:12'}));
 expect(mocks.server).toHaveBeenNthCalledWith(4,expect.objectContaining({type:'coachTestCard',playerUid:'target',cardId:'H020',revision:12,commandId:'coach-card-test:session:target:H020:12'}));
 expect(mocks.server).toHaveBeenNthCalledWith(5,expect.objectContaining({type:'coachReplayEvent',playerUid:'target',eventId:'event',revision:12,commandId:'coach-repeat:session:event:12'}));
 expect(mocks.server).toHaveBeenNthCalledWith(6,expect.objectContaining({type:'coachClearEvent',playerUid:'target',eventId:'event',revision:12,commandId:'coach-clear_event:session:target:12'}));
 expect(mocks.server).toHaveBeenNthCalledWith(7,expect.objectContaining({type:'coachForceEnd',playerUid:'target',eventId:'event',revision:12,commandId:'coach-force_end:session:target:12'}));
 expect(mocks.updateDoc).not.toHaveBeenCalled();expect(mocks.setDoc).not.toHaveBeenCalled();
 mocks.server.mockResolvedValue({status:'waiting'});
 await act(async()=>{await expect(hook.result.current.skipDisconnectedTurn('target')).rejects.toThrow('尚待確認');await expect(hook.result.current.setCoachNextTurn('target')).rejects.toThrow('尚待確認');await expect(hook.result.current.coachTriggerBoardCard('target','H020')).rejects.toThrow('尚待確認');});
 mocks.server.mockRejectedValue(Object.assign(new Error('玩家仍在線'),{code:'functions/failed-precondition'}));
 await act(async()=>{await expect(hook.result.current.skipDisconnectedSharedPromptTarget('target')).rejects.toThrow('玩家仍在線');});
});

it('retains uncertain shared outcomes and the original command while distinguishing permission refusal',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',isBoardGame:true,promptCompletionAuthority:'server-prompts-v1',bankingAuthority:'server-banking-v1',members:[{uid:'p1'}],boardState:{currentTurnUid:'other',currentEvent:{id:'event',playerUid:'other'},sharedCardPrompt:{id:'prompt',sourceEventId:'event',targetPlayerUids:['p1'],kind:'cash_dividend'}}})}));
 const hook=renderHook(()=>useRoom(),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider>{children}</RoomProvider>});await waitFor(()=>{expect(hook.result.current.room?.id).toBe('123456');expect(hook.result.current.isController).toBe(true);});
 const tx:any={name:'dividend',source:'income',usage:'cash',amount:100,cashChange:100};
 for(const code of ['functions/unavailable','functions/deadline-exceeded','functions/unknown','functions/cancelled']){mocks.server.mockRejectedValue(Object.assign(new Error('待確認'),{code}));await act(async()=>expect(await hook.result.current.completeSharedTransactionAction('prompt',tx,{status:'completed'})).toMatchObject({status:'waiting',code:code.replace('functions/','')}));}
 const submitted=mocks.server.mock.calls.map(([command])=>command).filter(command=>command.type==='sharedAction');expect(new Set(submitted.map(command=>command.commandId)).size).toBe(1);
 mocks.server.mockRejectedValue(Object.assign(new Error('權限不足'),{code:'functions/permission-denied'}));await act(async()=>expect(await hook.result.current.completeSharedTransactionAction('prompt',tx,{status:'completed'})).toMatchObject({status:'failed',code:'permission-denied',message:'權限不足'}));
 expect(mocks.setDoc).not.toHaveBeenCalled();expect(mocks.updateDoc).not.toHaveBeenCalled();
});

it('keeps room actions stable while room state changes, so action-only consumers do not re-render',async()=>{
 mocks.user.activeGame={roomId:'123456'};localStorage.setItem('active_room_p1','123456');
 mocks.getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({id:'123456',sessionId:'session',hostId:'coach',status:'playing',members:[{uid:'p1'}]})}));
 let actionRenders=0;
 const ActionOnly=React.memo(()=>{useRoomActions();actionRenders++;return null;});
 const hook=renderHook(()=>({room:useRoom(),actions:useRoomActions()}),{wrapper:({children}:{children:React.ReactNode})=><RoomProvider><ActionOnly/>{children}</RoomProvider>});
 const firstActions=hook.result.current.actions;
 await waitFor(()=>expect(hook.result.current.room.room?.id).toBe('123456'));
 expect(hook.result.current.actions).toBe(firstActions);
 expect(hook.result.current.room.endTurn).toBe(firstActions.endTurn);
 expect(actionRenders).toBe(1);
});

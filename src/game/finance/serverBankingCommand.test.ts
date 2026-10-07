import {describe,it,expect,vi,beforeEach} from 'vitest';
import {submitServerBanking,isBankPaydayCollected} from './serverBankingCommand';
import {submitServerGameCommand} from '../board/serverPromptCommand';
import type {Room} from '../../types';
vi.mock('../board/serverPromptCommand',()=>({submitServerGameCommand:vi.fn()}));
const call=vi.mocked(submitServerGameCommand);
const room={id:'client-bank',sessionId:'s'} as Room;
beforeEach(()=>{call.mockReset();});
describe('server banking gateway',()=>{
 it('restores the collected phase without the bounded cache and ignores another event or session',()=>{
  const state={bankSettlement:{sessionId:'s',eventId:'e',phase:'collected' as const},appliedBoardFinancialEventIds:[]};
  expect(isBankPaydayCollected(state,'s','e',true)).toBe(true);
  expect(isBankPaydayCollected(state,'other','e',true)).toBe(false);
  expect(isBankPaydayCollected(state,'s','other',true)).toBe(false);
  expect(isBankPaydayCollected({appliedBoardFinancialEventIds:['payday:e_bank']},'s','e')).toBe(true);
 });
 it('shares the same pending command and reports another command as busy',async()=>{
  let finish!:(value:unknown)=>void;call.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const first=submitServerBanking(room,'p1','same',{type:'borrowLoan',amount:10});
  const duplicate=submitServerBanking(room,'p1','same',{type:'borrowLoan',amount:10});
  expect(first).toBe(duplicate);
  expect(await submitServerBanking(room,'p1','same',{type:'borrowLoan',amount:20})).toMatchObject({status:'failed',code:'already-exists'});
  const busy=await submitServerBanking(room,'p1','different',{type:'borrowLoan',amount:10});
  expect(busy.code).toBe('busy');expect(call).toHaveBeenCalledTimes(1);
  expect(call).toHaveBeenCalledWith({type:'borrowLoan',amount:10,roomId:room.id,sessionId:'s',commandId:'same'});
  finish({status:'applied'});expect((await first).status).toBe('applied');
 });
 it('preserves the command when the result is uncertain',async()=>{
  call.mockRejectedValue({code:'functions/deadline-exceeded'});
  const result=await submitServerBanking(room,'p1','timeout',{type:'collectPayday',eventId:'bank'});
  expect(result).toMatchObject({status:'waiting',code:'deadline-exceeded',commandId:'timeout'});
 });
 it('preserves an explicit permission failure',async()=>{
  call.mockRejectedValue({code:'functions/permission-denied',message:'目前不是房間玩家'});
  expect(await submitServerBanking(room,'p1','denied',{type:'borrowLoan',amount:10})).toMatchObject({status:'failed',code:'permission-denied',message:'目前不是房間玩家'});
 });
});

it('stops unsupported room formats before acquiring a command lock or calling the backend',async()=>{
 expect(await submitServerBanking({...room,bankingAuthority:'future-bank'} as any,'p1','blocked',{type:'borrowLoan',amount:10})).toMatchObject({status:'failed',code:'update-required'});expect(call).not.toHaveBeenCalled();
 call.mockResolvedValue({status:'applied'});expect((await submitServerBanking(room,'p1','blocked',{type:'borrowLoan',amount:10})).status).toBe('applied');expect(call).toHaveBeenCalledOnce();
});

it.each(['functions/unknown','functions/cancelled','unavailable','internal'])('keeps %s as waiting for the original banking command',async(code)=>{
 call.mockRejectedValue({code});expect(await submitServerBanking(room,'p1','pending',{type:'borrowLoan',amount:10})).toMatchObject({status:'waiting',code:code.replace('functions/',''),commandId:'pending'});
});

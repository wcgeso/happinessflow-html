import {resolveBoardCardAction} from '../../utils/boardCardActions';
import {it,expect} from 'vitest';
import {validateFinancialEvent,buildExpenseBroadcast,buildRealEstatePurchaseState} from './cardState';
import {createDefaultGameState} from '../../utils/gameState';
import type {BoardState,TransactionData} from '../../types';

const board={currentEvent:{id:'source',playerUid:'p1'},currentCard:{cardId:'C045',deck:'opportunity'}} as BoardState;
const tx={boardFlow:'board-card',boardEventId:'source:expense_update',name:'物價上漲',usage:'expense_update',source:'income',amount:3000,cashChange:0,expensePayload:{category:'basicLiving',amount:3000,isIncrease:true}} as TransactionData;
it('binds an unpaid financial command to its current event while allowing independent bank forms',()=>{
 expect(validateFinancialEvent(board,tx,'p1')).toBeNull();
 expect(validateFinancialEvent({...board,currentEvent:{...board.currentEvent!,id:'next'}},tx,'p1')).toContain('尚未扣款');
 expect(validateFinancialEvent(board,tx,'other')).toContain('已更新');
 const shared={...board,sharedCardPrompt:{id:'prompt',sourceEventId:'source',sourceCardId:'C045'}} as BoardState;
 expect(validateFinancialEvent(shared,tx,'p1')).toContain('尚未扣款');
 expect(validateFinancialEvent(shared,{...tx,boardFlow:'manual-bank'},'p1')).toBeNull();
 expect(validateFinancialEvent({...shared,sharedCardPrompt:{...shared.sharedCardPrompt!,sourceEventId:'old'}},tx,'p1')).toBeNull();
});
it('prepares a canonical all-player expense in the same board mutation, rejecting altered amounts',()=>{
 const state=createDefaultGameState();
 const result=buildExpenseBroadcast(board,state,tx,'p1','payment',100);
 expect(result?.sharedExpenseEffect).toMatchObject({id:'payment',amount:3000,category:'basicLiving',sourcePlayerUid:'p1',timestamp:100});
 expect(board.sharedExpenseEffect).toBeUndefined();
 expect(()=>buildExpenseBroadcast(board,state,{...tx,expensePayload:{...tx.expensePayload!,amount:6000}},'p1','payment',100)).toThrow('來源卡片');
});

it('borrows only the real-estate down-payment shortfall atomically and keeps the original purchase idempotent',()=>{
 const state={...createDefaultGameState(),cash:0,profession:{salary:30000} as any};
 const action=resolveBoardCardAction('N047',state);
 if(action.kind!=='financial')throw new Error('N047 must offer a purchase');
 const tx={...action.txData,fundingLoanAmount:120000};
 const next=buildRealEstatePurchaseState(state,tx,'property',100);
 expect(next.cash).toBe(0);
 expect(next.liabilities.filter(row=>row.type==='信用貸款')).toMatchObject([{totalOwed:120000,monthlyPayment:12000}]);
 expect(next.liabilities.filter(row=>row.type==='不動產貸款')).toMatchObject([{totalOwed:1080000,linkedAssetId:'property:asset'}]);
 expect(next.assets).toHaveLength(1);
 expect(buildRealEstatePurchaseState(next,tx,'property',100)).toBe(next);
 expect(()=>buildRealEstatePurchaseState(state,{...tx,fundingLoanAmount:119999},'other',100)).toThrow('周轉金額');
 expect(()=>buildRealEstatePurchaseState({...state,liabilities:[{id:'debt',type:'信用貸款',totalOwed:200000,monthlyPayment:20000,name:'既有信貸'}]},tx,'other',100)).toThrow('信貸上限');
 expect(state.cash).toBe(0);expect(state.liabilities).toHaveLength(0);
});

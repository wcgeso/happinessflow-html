import {expect,it} from 'vitest';
import {getPersonalFinancialHandler} from './transactionRoute';
import type {TransactionData} from '../../types';
it.each([
 [{insuranceType:'medical'},'completeInsurancePurchase'],
 [{assetDetails:{type:'定存'}},'completeDepositPurchase'],
 [{stockList:[{symbol:'A20',qty:1,price:100}]},'completeStockTrade'],
 [{source:'cash',usage:'loan'},'completeLoanBorrow'],
 [{source:'loan',usage:'cash',commandId:'loan:bank-operation'},'completeLoanBorrow'],
 [{source:'cash',usage:'liability'},'completeLoanRepayment'],
 [{name:'解約定存 1000'},'completeDepositWithdrawal'],
 [{usage:'asset',assetDetails:{type:'汽車'}},'completeCarPurchase'],
 [{source:'loan',usage:'cash',fundingLoanAmount:1000},null],
 [{usage:'lifelong_learning'},null],
])('routes actual submitted banking formats to the room command: %j',(patch,handler)=>{
 expect(getPersonalFinancialHandler({name:'交易',amount:1000,cashChange:0,...patch} as TransactionData)).toBe(handler);
});

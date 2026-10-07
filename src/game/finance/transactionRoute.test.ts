import {expect,it} from 'vitest';
import {getPersonalFinancialHandler} from './transactionRoute';
import {DREAMS,ENTERPRISES} from '../../constants';
import {buildDreamTransaction,buildTargetEnterpriseTransaction} from '../../components/banking/TargetAndDreamModals';
import type {TransactionData} from '../../types';
it.each([
 [{name:'達成事業成就：目標企業',source:'cash',usage:'asset'},'completeTargetEnterprisePurchase'],
 [{name:'達成事業成就：目標企業',source:'income',usage:'cash'},null],
 [{name:'實現人生夢想：環遊世界八十天',source:'cash',usage:'expense'},'completeDreamPurchase'],
 [{name:'實現人生夢想：環遊世界八十天',source:'income',usage:'cash'},null],
 [{insuranceType:'medical'},'completeInsurancePurchase'],
 [{assetDetails:{type:'定存'}},'completeDepositPurchase'],
 [{stockList:[{symbol:'A20',qty:1,price:100}]},'completeStockTrade'],
 [{batchSellList:[{asset:{id:'car#1',name:'汽車',type:'汽車',cost:600000,cashflow:0},price:300000}]},'completeAssetSale'],
 [{source:'cash',usage:'loan'},'completeLoanBorrow'],
 [{source:'loan',usage:'cash',commandId:'loan:bank-operation'},'completeLoanBorrow'],
 [{source:'loan',usage:'cash'},'completeLoanBorrow'],
 [{source:'cash',usage:'liability'},'completeLoanRepayment'],
 [{name:'解約定存 1000'},'completeDepositWithdrawal'],
 [{name:'定存解約'},'completeDepositWithdrawal'],
 [{usage:'asset',assetDetails:{type:'汽車'}},'completeCarPurchase'],
 [{source:'loan',usage:'cash',fundingLoanAmount:1000},null],
 [{usage:'lifelong_learning'},null],
])('routes actual submitted banking formats to the room command: %j',(patch,handler)=>{
 expect(getPersonalFinancialHandler({name:'交易',amount:1000,cashChange:0,...patch} as TransactionData)).toBe(handler);
});

it('routes the actual target and dream modal builders for every official selection',()=>{
 for(const dream of DREAMS)expect(getPersonalFinancialHandler(buildDreamTransaction(dream))).toBe('completeDreamPurchase');
 for(const enterprise of ENTERPRISES)expect(getPersonalFinancialHandler(buildTargetEnterpriseTransaction(enterprise))).toBe('completeTargetEnterprisePurchase');
});

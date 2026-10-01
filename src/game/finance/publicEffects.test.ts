import {withAutomaticHappiness} from './automaticHappiness';
import {expect,it} from 'vitest';
import {applyPublicFinancialEffect} from './publicEffects';
import {createDefaultGameState} from '../../utils/gameState';
it('applies a recovered market bubble and shared expense using current private data',()=>{
  const initial={...createDefaultGameState(),cash:10000,expenses:{basicLiving:1000,transportEdu:0,otherMedicalChild:0},assets:[{id:'stock',name:'A',type:'股票' as const,quantity:5,shares:5,cost:500,downPayment:500,cashflow:0,lastPurchasePrice:100}]};
  const market=applyPublicFinancialEffect(initial,{id:'market',sessionId:'s',timestamp:1,kind:'market',sourcePlayerUid:'other',payload:{isBubble:true,code:'bubble',updates:{A:30}}},'self');
  expect(market.assets[0]).toMatchObject({quantity:2,shares:2,cost:200});expect(market.cash).toBe(10000);
  const expense={id:'expense',sessionId:'s',timestamp:2,kind:'expense' as const,sourcePlayerUid:'other',payload:{amount:1000,category:'basicLiving' as const,isIncrease:true}};
  expect(applyPublicFinancialEffect(market,expense,'self').expenses.basicLiving).toBe(market.expenses.basicLiving+1000);
  expect(applyPublicFinancialEffect(market,expense,'other')).toBe(market);
});

it('preserves legacy family awards when no derived happiness item changes',()=>{
 const state={...createDefaultGameState(),isSetup:true,happiness:[],happinessTotal:2};
 expect(withAutomaticHappiness(state).happinessTotal).toBe(2);
});

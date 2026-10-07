import assert from 'node:assert/strict';
import {createSequentialIdGenerator} from '../../src/game/finance/applyBoardTransaction';
import {parseBankingCommand} from '../src/banking';
import {parseRealEstateCommand} from '../src/realEstate';
import {parseOpportunityCommand} from '../src/opportunityCard';
import {parsePersonalHappinessCommand} from '../src/personalHappiness';
const assetId=createSequentialIdGenerator('operation')(),base={roomId:'room',sessionId:'session',commandId:`use:${assetId}`};
const cases=[
 {parse:parsePersonalHappinessCommand,data:{...base,type:'personalHappiness',action:'toggle',itemId:assetId,checked:true}},
 {parse:parsePersonalHappinessCommand,data:{...base,type:'personalHappiness',action:'remove',itemId:assetId}},
 {parse:parseBankingCommand,data:{...base,type:'repayLoan',liabilityId:assetId,amount:100}},
 {parse:parseBankingCommand,data:{...base,type:'withdrawDeposit',assetId,amount:10000}},
 {parse:parseBankingCommand,data:{...base,type:'purchaseInsurance',insuranceType:'house',targetAssetIds:[assetId]}},
 {parse:parseBankingCommand,data:{...base,type:'rollStartup',assetId,cardId:'C023',stage:1,eventId:'event'}},
 {parse:parseRealEstateCommand,data:{...base,type:'convertHouse',assetId,toSelfUse:true}},
 {parse:parseOpportunityCommand,data:{...base,type:'opportunityCard',eventId:'event',cardId:'C038',choice:'accept',assetId}},
];
let checks=0;for(const {parse,data} of cases){assert.equal(parse(data).commandId,base.commandId);checks++;for(const field of ['roomId','sessionId','commandId',...('assetId' in data?['assetId']:[]),...('liabilityId' in data?['liabilityId']:[]),...('itemId' in data?['itemId']:[])]){assert.throws(()=>parse({...data,[field]:'../bad'}),{code:'invalid-argument'});checks++;}for(const field of ['roomId','sessionId']){assert.throws(()=>parse({...data,[field]:'room#1'}),{code:'invalid-argument'});checks++;}}
assert.throws(()=>parseBankingCommand({...base,type:'purchaseInsurance',insuranceType:'house',targetAssetIds:['../bad']}),{code:'invalid-argument'});checks++;
console.log(`PASS ${checks} generated asset/loan identifier roundtrips; document paths remain restricted`);

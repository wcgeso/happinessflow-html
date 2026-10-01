import {beforeEach,expect,it,vi} from 'vitest';
import type {Firestore} from 'firebase/firestore';
import type {GameState} from '../../types';
import {runPrivateFinancialCommand,financialRecordId} from './privateCommand';
const mock=vi.hoisted(()=>({store:new Map<string,any>(),reads:[] as string[],writes:[] as string[],failure:null as null | {code:string},serverFailure:false}));
vi.mock('firebase/firestore',()=>({doc:(_db:unknown,...path:string[])=>path.join('/'),
 getDocFromServer:async(path:string)=>{if(mock.serverFailure)throw {code:'unavailable'};return {exists:()=>mock.store.has(path),data:()=>structuredClone(mock.store.get(path))};},
 runTransaction:(_db:unknown,fn:any)=>{if(mock.failure)return Promise.reject(mock.failure);return fn({update:(path:string,patch:any)=>{mock.writes.push(path);const data=mock.store.get(path);for(const [field,value] of Object.entries(patch)){const [parent,key]=field.split('.');if(key)data[parent]={...(data[parent]||{}),[key]:value};else data[parent]=value;}},get:async(path:string)=>{mock.reads.push(path);return{exists:()=>mock.store.has(path),data:()=>structuredClone(mock.store.get(path))};},
 set:(path:string,data:any)=>{mock.writes.push(path);mock.store.set(path,structuredClone(data));}});}}));
vi.mock('../../utils/telemetry',()=>({trackGameEvent:vi.fn(),trackBoardStage:vi.fn()}));
beforeEach(()=>{mock.store.clear();mock.reads=[];mock.writes=[];mock.failure=null;mock.serverFailure=false;});
it('keeps six-player personal finance independent, shares in-flight commands, and deduplicates beyond 200 later operations',async()=>{
 mock.store.set('rooms/test',{status:'playing',sessionId:'session',members:Array.from({length:6},(_,i)=>({uid:`p${i}`})),
  financialHistoryStorage:'subcollection',boardState:{revision:10,sharedCardPrompt:{targetPlayerUids:['p0','p1','p2','p3','p4','p5']}}});
 for(let i=0;i<6;i++)mock.store.set(`rooms/test/players/p${i}`,{cash:0,history:[],appliedBoardFinancialEventIds:[]});
 const command=(uid:string,id:string)=>runPrivateFinancialCommand({db:{} as Firestore,roomId:'test',uid,commandId:id,apply:(state:GameState)=>({status:'applied',state:{...state,cash:state.cash+100,
  appliedBoardFinancialEventIds:[id],history:[{id,timestamp:Number(id.split(':')[1])||0,name:'test',amount:100,cashChange:100,balance:state.cash+100,sourceLabel:'test',usageLabel:'test'},...state.history]}})});
 const first=command('p0','pay:0');expect(command('p0','pay:0')).toBe(first);
 expect(await command('p0','pay:busy')).toMatchObject({status:'failed',code:'busy'});
 expect(await first).toEqual({status:'applied'});
 for(let i=1;i<=250;i++)expect(await command('p0',`pay:${i}`)).toEqual({status:'applied'});
 expect(await command('p0','pay:0')).toEqual({status:'duplicate'});
 expect(mock.store.get('rooms/test/players/p0').cash).toBe(25100);
 expect(mock.store.get('rooms/test/players/p0').history).toHaveLength(100);
 expect(mock.store.has(`rooms/test/players/p0/transactions/${financialRecordId('session:pay:0')}`)).toBe(true);
 expect(mock.writes.filter(path=>path.includes('/transactions/'))).toHaveLength(251);
 expect(mock.store.get('rooms/test').boardState.revision).toBe(10);
 expect(mock.writes.every(path=>path.startsWith('rooms/test/players/p0'))).toBe(true);
 expect(mock.reads.some(path=>path.includes('/responses/'))).toBe(false);
});

it('commits a changed public happiness summary with private finance and keeps the board revision unchanged',async()=>{
 const initial={isSetup:true,selectionStep:'completed',cash:10000,history:[],assets:[],liabilities:[],expenses:{},income:{},happiness:[{id:'h_plane',checked:false,points:2}],happinessTotal:0};
 mock.store.set('rooms/test',{status:'playing',sessionId:'session',members:[{uid:'p0'}],financialHistoryStorage:'subcollection',boardState:{revision:9},publicPlayerStates:{p0:{uid:'p0',isSetup:true,selectionStep:'completed',happinessTotal:0}}});
 mock.store.set('rooms/test/players/p0',initial);
 const result=await runPrivateFinancialCommand({db:{} as Firestore,roomId:'test',uid:'p0',commandId:'car:1',apply:state=>({status:'applied',state:{...state,assets:[{id:'car',name:'汽車',type:'汽車',cost:1000,downPayment:0,cashflow:0}]}})});
 expect(result.status).toBe('applied');
 expect(mock.store.get('rooms/test/players/p0').happinessTotal).toBe(2);
 expect(mock.store.get('rooms/test').publicPlayerStates.p0.happinessTotal).toBe(2);
 expect(mock.store.get('rooms/test').boardState.revision).toBe(9);
 expect(mock.writes.filter(path=>path==='rooms/test')).toHaveLength(1);
});

it('rejects an unsupported cloud schema before applying financial effects',async()=>{
 mock.store.set('rooms/test',{status:'playing',flowSchemaVersion:2,members:[{uid:'p0'}]});
 mock.store.set('rooms/test/players/p0',{cash:1000});
 const apply=vi.fn(()=>({status:'applied' as const,state:{cash:0} as GameState}));
 expect(await runPrivateFinancialCommand({db:{} as Firestore,roomId:'test',uid:'p0',commandId:'old-client',apply})).toMatchObject({status:'failed',code:'unsupported-schema'});
 expect(apply).not.toHaveBeenCalled();expect(mock.writes).toHaveLength(0);
});

it.each(['deadline-exceeded','permission-denied'])('confirms a committed transaction after %s from the persistent receipt without applying again',async(code)=>{
 mock.store.set('rooms/test',{status:'playing',sessionId:'s',financialHistoryStorage:'subcollection'});
 mock.store.set(`rooms/test/players/p0/commandResults/${financialRecordId('s:loan')}`,{status:'applied'});
 mock.failure={code};
 const apply=vi.fn();
 expect(await runPrivateFinancialCommand({db:{} as Firestore,roomId:'test',uid:'p0',sessionId:'s',commandId:'loan',apply})).toEqual({status:'duplicate'});
 expect(apply).not.toHaveBeenCalled();expect(mock.writes).toHaveLength(0);
});
it('keeps an unconfirmed transaction waiting and preserves the original command ID',async()=>{
 mock.failure={code:'unavailable'};mock.serverFailure=true;
 expect(await runPrivateFinancialCommand({db:{} as Firestore,roomId:'test',uid:'p0',sessionId:'s',commandId:'original',apply:vi.fn()})).toMatchObject({status:'waiting',code:'waiting-confirmation',commandId:'original'});
 expect(mock.writes).toHaveLength(0);
});
it('does not retry permission denial or call it a waiting financial result',async()=>{
 mock.failure={code:'permission-denied'};
 expect(await runPrivateFinancialCommand({db:{} as Firestore,roomId:'test',uid:'p0',commandId:'denied',apply:vi.fn()})).toMatchObject({status:'failed',code:'permission-denied'});
 expect(mock.writes).toHaveLength(0);
});

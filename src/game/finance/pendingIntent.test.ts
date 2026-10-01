import {expect,it} from 'vitest';
import {readFinancialIntent,saveFinancialIntent,clearFinancialIntent} from './pendingIntent';
import type {TransactionData} from '../../types';

it('restores the original financial command only in the same room, session and player; late cleanup cannot erase the next intent',()=>{
 const storage=window.localStorage;storage.clear();
 const tx:TransactionData={name:'信用貸款',source:'loan',usage:'cash',amount:200000,cashChange:200000,boardFlow:'manual-bank',commandId:'original'};
 saveFinancialIntent(storage,'room','session','player',tx);
 expect(readFinancialIntent(storage,'room','session','player')).toEqual(tx);
 expect(readFinancialIntent(storage,'room','other','player')).toBeNull();
 expect(readFinancialIntent(storage,'room','session','other')).toBeNull();
 saveFinancialIntent(storage,'room','session','player',{...tx,commandId:'next'});
 clearFinancialIntent(storage,'room','session','player','original');
 expect(readFinancialIntent(storage,'room','session','player')?.commandId).toBe('next');
 clearFinancialIntent(storage,'room','session','player','next');
 expect(readFinancialIntent(storage,'room','session','player')).toBeNull();
 storage.setItem('hf-financial-intent:room:session:player','{bad json');
 expect(()=>readFinancialIntent(storage,'room','session','player')).toThrow('無法讀取');
});

it('restores an explicit personal action, rejects malformed actions and keeps a newer intent during late cleanup', async()=>{
 const {readPersonalIntent,clearPersonalIntent,personalIntentKey}=await import('./pendingIntent');
 const storage=window.localStorage;storage.clear();
 const intent={commandId:'toggle-original',action:{kind:'toggle',id:'h1',checked:true}};
 storage.setItem(personalIntentKey('r:s:u'),JSON.stringify(intent));
 expect(readPersonalIntent(storage,'r:s:u')).toEqual(intent);
 expect(readPersonalIntent(storage,'r:next:u')).toBeNull();
 storage.setItem(personalIntentKey('r:s:u'),JSON.stringify({...intent,commandId:'new'}));
 clearPersonalIntent(storage,'r:s:u','toggle-original');
 expect(readPersonalIntent(storage,'r:s:u')?.commandId).toBe('new');
 clearPersonalIntent(storage,'r:s:u','new');
 expect(readPersonalIntent(storage,'r:s:u')).toBeNull();
 storage.setItem(personalIntentKey('r:s:u'),JSON.stringify({commandId:'bad',action:{kind:'toggle',id:'h1'}}));
 expect(()=>readPersonalIntent(storage,'r:s:u')).toThrow('無法讀取');
});

it('preserves coach subsidy and market receipt identities across reload and rejects malformed drafts',async()=>{
 const {coachIntentKey,readCoachIntent,clearCoachIntent}=await import('./pendingIntent');
 const storage=localStorage;storage.clear();
 const intent={commandId:'subsidy-once',action:{kind:'subsidy',amount:10000}};
 storage.setItem(coachIntentKey('r:s:coach'),JSON.stringify(intent));
 expect(readCoachIntent(storage,'r:s:coach')).toEqual(intent);
 expect(readCoachIntent(storage,'r:new:coach')).toBeNull();
 const market={commandId:'bubble-once',action:{kind:'market',code:'BUBBLE',updates:{stock:10},isBubble:true}};
 storage.setItem(coachIntentKey('r:s:coach'),JSON.stringify(market));
 clearCoachIntent(storage,'r:s:coach','subsidy-once');
 expect(readCoachIntent(storage,'r:s:coach')).toEqual(market);
 storage.setItem(coachIntentKey('r:s:coach'),JSON.stringify({...market,action:{...market.action,updates:{stock:'bad'}}}));
 expect(()=>readCoachIntent(storage,'r:s:coach')).toThrow('無法讀取');
});

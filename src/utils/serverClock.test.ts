import {it,expect,vi} from 'vitest';
const mocked=vi.hoisted(()=>({receive:null as null|((snapshot:{val:()=>number})=>void),unsubscribe:vi.fn()}));
vi.mock('firebase/database',()=>({ref:vi.fn(),onValue:(_ref:unknown,next:any)=>{mocked.receive=next;return mocked.unsubscribe;}}));
vi.mock('../../services/realtime',()=>({realtimeDb:{}}));
it('reanchors the shared deadline on foreground recovery without treating the offset estimate as a measured bound',async()=>{
 const {subscribeServerClock,serverNow,clockMetadata}=await import('./serverClock');
 const date=vi.spyOn(Date,'now').mockReturnValue(100000),monotonic=vi.spyOn(performance,'now').mockReturnValue(0);
 const stop=subscribeServerClock();
 try{
  mocked.receive!({val:()=>1000});expect(serverNow()).toBe(101000);
  date.mockReturnValue(160000);monotonic.mockReturnValue(100);
  expect(clockMetadata().clock_wall_drift_ms).toBe(-59900);
  expect(serverNow()).toBe(161000);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(serverNow()).toBe(161000);
  expect(clockMetadata()).toMatchObject({clock_basis:'server_offset_estimate',clock_error_ms:-1,clock_wall_drift_ms:0});
 }finally{stop();date.mockRestore();monotonic.mockRestore();}
 expect(mocked.unsubscribe).toHaveBeenCalledOnce();
});

it('uses the calibrated wall clock after forty minutes even when the monotonic clock has drifted',async()=>{
 const {subscribeServerClock,serverNow,clockMetadata}=await import('./serverClock');
 const date=vi.spyOn(Date,'now').mockReturnValue(100000),monotonic=vi.spyOn(performance,'now').mockReturnValue(0);
 const stop=subscribeServerClock();
 try{
  mocked.receive!({val:()=>-1});
  date.mockReturnValue(2500000);monotonic.mockReturnValue(2400063);
  expect(clockMetadata().clock_wall_drift_ms).toBe(63);
  expect(serverNow()).toBe(2499999);
 }finally{stop();date.mockRestore();monotonic.mockRestore();}
});

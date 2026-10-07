import {expect,it,vi} from 'vitest';
const trackGameEvent=vi.fn(async()=>undefined);
vi.mock('./telemetry',()=>({trackGameEvent}));
import {describeError,installClientErrorReporting} from './clientErrors';

it('reports unhandled rejections once per distinct error', async()=>{
 installClientErrorReporting();
 const fire=(reason:unknown)=>window.dispatchEvent(Object.assign(new Event('unhandledrejection'),{reason}));
 fire(Object.assign(new Error('boom'),{code:'functions/internal'}));fire(Object.assign(new Error('boom'),{code:'functions/internal'}));
 await vi.waitFor(()=>expect(trackGameEvent).toHaveBeenCalledTimes(1));
 expect(trackGameEvent.mock.calls[0][1]).toMatchObject({kind:'rejection',error_message:'boom',error_code:'functions/internal'});
});

it('describes non-Error values', ()=>{
 expect(describeError({message:'x',code:'busy'})).toMatchObject({name:'object',message:'x',code:'busy'});
 expect(describeError('text')).toMatchObject({name:'string',message:'text'});
});

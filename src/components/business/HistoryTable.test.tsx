import React,{StrictMode} from 'react';
import {act,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {beforeEach,it,expect,vi} from 'vitest';
const read=vi.hoisted(()=>vi.fn());
vi.mock('../../../services/firebase',()=>({db:{}}));
vi.mock('firebase/firestore',()=>({collection:(_db:unknown,...parts:string[])=>parts.join('/'),query:(...parts:unknown[])=>parts,where:(...parts:unknown[])=>parts,orderBy:(...parts:unknown[])=>parts,limit:(count:number)=>({limit:count}),startAfter:(cursor:unknown)=>({cursor}),getDocs:read}));
vi.mock('../modals/ConfirmModal',()=>({ConfirmModal:()=>null}));
import {HistoryTable} from './HistoryTable';
const source={roomId:'r',uid:'p',sessionId:'s'};
const page=(count:number,label='交易')=>({size:count,docs:Array.from({length:count},(_,i)=>({data:()=>({id:`${label}-${i}`,name:`${label}-${i}`,timestamp:1000-i,cashChange:1})}))});
const deferred=()=>{let resolve!:(value:any)=>void,reject!:(value:unknown)=>void;const promise=new Promise<any>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
beforeEach(()=>read.mockReset());
it('accepts the current StrictMode request and ignores the disposed request',async()=>{
 const old=deferred(),current=deferred();read.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
 render(<StrictMode><HistoryTable history={[]} source={source}/></StrictMode>);await waitFor(()=>expect(read).toHaveBeenCalledTimes(2));await act(async()=>current.resolve(page(1,'目前')));expect(screen.getByText('目前-0')).toBeTruthy();await act(async()=>old.reject(new Error('舊錯誤')));expect(screen.queryByRole('alert')).toBeNull();
});
it('does not publish a previous player snapshot after switching the source',async()=>{
 const old=deferred();read.mockReturnValueOnce(old.promise).mockResolvedValueOnce(page(1,'新玩家'));const view=render(<HistoryTable history={[]} source={source}/>);view.rerender(<HistoryTable history={[]} source={{...source,uid:'next'}}/>);await screen.findByText('新玩家-0');await act(async()=>old.resolve(page(1,'舊玩家')));expect(screen.queryByText('舊玩家-0')).toBeNull();
});
it('requests 100 then 50 and serializes repeated pagination clicks',async()=>{
 const next=deferred();read.mockResolvedValueOnce(page(100)).mockReturnValueOnce(next.promise);render(<HistoryTable history={[]} source={source}/>);const button=await screen.findByText('載入較早 50 筆');fireEvent.click(button);fireEvent.click(button);expect(read).toHaveBeenCalledTimes(2);expect(read.mock.calls[0][0].at(-1)).toEqual({limit:100});expect(read.mock.calls[1][0].at(-1)).toEqual({limit:50});await act(async()=>next.resolve(page(1,'更早')));expect(screen.getByText('更早-0')).toBeTruthy();
});

import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {BoardFinancialCheckModal} from './BoardFinancialCheckModal';
import type {TransactionData} from '../../types';

vi.mock('../transaction/FinancialCheckBoard',()=>({FinancialCheckBoard:()=>null}));
afterEach(cleanup);
const transaction=(id:string):TransactionData=>({name:'測試財務',amount:0,cashChange:0,source:'cash',usage:'expense',commandId:id});
const deferred=()=>{let resolve!:(value:{status:'applied'})=>void;const promise=new Promise<{status:'applied'}>(done=>{resolve=done;});return {promise,resolve};};

it('keeps an identical transaction busy across parent snapshot rerenders',async()=>{
 const pending=deferred(),apply=vi.fn(()=>pending.promise),tx=transaction('one');
 const props={title:'測試財務',txData:tx,expectedEntries:[],onApply:apply,onClose:vi.fn()};
 const view=render(<BoardFinancialCheckModal {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'確認檢核答案'}));
 view.rerender(<BoardFinancialCheckModal {...props} txData={{...tx}} expectedEntries={[]}/>);
 expect(screen.getByRole('button',{name:'處理中...'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'取消',exact:true})).toBeDisabled();
 await act(async()=>pending.resolve({status:'applied'}));
 expect(apply).toHaveBeenCalledTimes(1);
});

it('does not mark a new event complete when the previous transaction resolves late',async()=>{
 const pending=deferred(),apply=vi.fn(()=>pending.promise);
 const props={title:'測試財務',txData:transaction('old'),expectedEntries:[],onApply:apply,onClose:vi.fn()};
 const view=render(<BoardFinancialCheckModal {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'確認檢核答案'}));
 view.rerender(<BoardFinancialCheckModal {...props} txData={transaction('new')}/>);
 await act(async()=>pending.resolve({status:'applied'}));
 expect(screen.queryByText('交易完成')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'確認檢核答案'})).toBeEnabled();
});

it('keeps waiting visible and safely retries the same transaction until receipt confirmation',async()=>{
 const tx=transaction('original');
 const apply=vi.fn().mockResolvedValueOnce({status:'waiting',message:'結果等待確認'}).mockResolvedValueOnce({status:'duplicate'});
 render(<BoardFinancialCheckModal title="測試財務" txData={tx} expectedEntries={[]} onApply={apply} onClose={vi.fn()}/>);
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'確認檢核答案'})));
 expect(screen.getByText('結果等待確認')).toBeInTheDocument();
 expect(screen.queryByText('交易完成')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'我知道了'}));
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'確認檢核答案'})));
 expect(apply.mock.calls.map(call=>call[0])).toEqual([tx,tx]);
 expect(screen.getByText('交易完成')).toBeInTheDocument();
});

it('keeps the original transaction recoverable when the server requires funding',async()=>{
 const tx=transaction('funding');
 const apply=vi.fn().mockResolvedValueOnce({status:'requires_funding',shortfall:5000}).mockResolvedValueOnce({status:'duplicate'});
 render(<BoardFinancialCheckModal title="測試財務" txData={tx} expectedEntries={[]} onApply={apply} onClose={vi.fn()}/>);
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'確認檢核答案'})));
 expect(screen.getByText('現金不足，需要周轉')).toBeInTheDocument();
 expect(screen.getByText(/還差 5,000/)).toBeInTheDocument();
 expect(screen.queryByText('交易完成')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'我知道了'}));
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'確認檢核答案'})));
 expect(apply.mock.calls.map(call=>call[0])).toEqual([tx,tx]);
 expect(screen.getByText('交易完成')).toBeInTheDocument();
});

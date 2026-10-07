import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ConfirmModal} from './ConfirmModal';
afterEach(cleanup);
it('awaits async confirmation, blocks repeats/cancellation and retains the error for safe retry',async()=>{
 let reject!:(error:Error)=>void;const confirm=vi.fn().mockImplementationOnce(()=>new Promise((_,r)=>{reject=r;})).mockResolvedValueOnce(undefined),cancel=vi.fn();
 render(<ConfirmModal title="結算" description="結束本場" onConfirm={confirm} onCancel={cancel}/>);
 fireEvent.click(screen.getByRole('button',{name:'確認'}));fireEvent.click(screen.getByRole('button',{name:'處理中…'}));fireEvent.click(screen.getByRole('button',{name:'取消'}));expect(confirm).toHaveBeenCalledTimes(1);expect(cancel).not.toHaveBeenCalled();
 await act(async()=>reject(new Error('封存尚待確認')));expect(screen.getByRole('alert').textContent).toBe('封存尚待確認');expect(cancel).not.toHaveBeenCalled();
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'確認'})));expect(confirm).toHaveBeenCalledTimes(2);expect(screen.queryByRole('alert')).toBeNull();
});

import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,act} from '@testing-library/react';
import {HouseConversionModal} from './HouseConversionModal';
it('keeps conversion open while submitting or unconfirmed, and closes only after success',async()=>{
 let resolve:(result:boolean)=>void=()=>{};
 const convert=vi.fn(()=>new Promise<boolean>(r=>{resolve=r;})),close=vi.fn();
 render(<HouseConversionModal isOpen onClose={close} onConvert={convert} asset={{id:'house',name:'N029',type:'不動產',cost:1100000,downPayment:100000,cashflow:6500,isSelfUse:false}}/>);
 fireEvent.click(screen.getByText('轉為自用'));
 const button=await screen.findByRole('button',{name:'確認轉換'});
 fireEvent.click(button);fireEvent.click(button);
 expect(convert).toHaveBeenCalledTimes(1);
 expect(close).not.toHaveBeenCalled();
 await act(async()=>resolve(false));
 expect(close).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'確認轉換'}));
 await act(async()=>resolve(true));
 expect(close).toHaveBeenCalledTimes(1);
});

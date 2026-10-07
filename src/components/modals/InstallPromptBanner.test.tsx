import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {InstallPromptBanner} from './InstallPromptBanner';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();});
it('keeps iOS instructions and persisted dismissal with native animation',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false}));vi.spyOn(navigator,'userAgent','get').mockReturnValue('iPhone');
 const view=render(<InstallPromptBanner/>);expect(screen.getByText('加入主畫面',{selector:'p'})).toBeInTheDocument();expect(screen.getByText('分享')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'關閉安裝提示'}));expect(screen.queryByText('分享')).toBeNull();expect(localStorage.getItem('hf_install_dismissed')).toBe('1');view.unmount();render(<InstallPromptBanner/>);expect(screen.queryByText('分享')).toBeNull();
});
it('retains the browser install action and removes the listener on unmount',async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false}));vi.spyOn(navigator,'userAgent','get').mockReturnValue('Android');
 const view=render(<InstallPromptBanner/>);const prompt=vi.fn();const event=Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt,userChoice:Promise.resolve({outcome:'accepted'})});
 fireEvent(window,event);expect(event.defaultPrevented).toBe(true);fireEvent.click(screen.getByRole('button',{name:'立即安裝'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'立即安裝'})).toBeNull());expect(prompt).toHaveBeenCalledTimes(1);
 view.unmount();const late=new Event('beforeinstallprompt',{cancelable:true});fireEvent(window,late);expect(late.defaultPrevented).toBe(false);
});
it('does not display a prompt when already installed',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true}));render(<InstallPromptBanner/>);fireEvent(window,new Event('beforeinstallprompt'));expect(screen.queryByRole('button')).toBeNull();
});

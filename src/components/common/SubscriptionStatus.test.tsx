import React from 'react';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../../utils/recoveringSnapshot',()=>({getSubscriptionHealth:()=> '[]',subscribeSubscriptionHealth:()=>()=>{}}));
import {SubscriptionStatus} from './SubscriptionStatus';
afterEach(cleanup);
it('shows an update requirement for unknown backend modes and retains the legacy version prop',()=>{
 render(<SubscriptionStatus room={{bankingAuthority:'future-bank'} as any}/>);expect(screen.getByRole('alert').textContent).toContain('財務處理模式');expect(screen.getByRole('button',{name:'重新載入遊戲'})).toBeDefined();cleanup();render(<SubscriptionStatus flowSchemaVersion={2}/>);expect(screen.getByRole('alert').textContent).toContain('遊戲流程版本');
});
it('does not block supported and legacy room display',()=>{
 render(<SubscriptionStatus room={{flowSchemaVersion:1,bankingAuthority:'server-banking-v1'} as any}/>);expect(screen.queryByRole('alert')).toBeNull();
});

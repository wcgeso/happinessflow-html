import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
const mocks=vi.hoisted(()=>({list:vi.fn(),read:vi.fn(),hydrate:vi.fn()}));
vi.mock('firebase/firestore',()=>({collection:()=>({}),query:()=>({}),where:()=>({}),limit:()=>({}),doc:(_db:unknown,...parts:string[])=>parts.join('/'),getDocs:mocks.list,getDoc:mocks.read}));
vi.mock('../../../services/firebase',()=>({db:{}}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{uid:'coach'}})}));
vi.mock('../../game/settlement/scoreRecord',()=>({loadScoreRecord:mocks.hydrate}));
vi.mock('../../components/business/FinancialStatement',()=>({FinancialStatement:()=>null}));
import {CoachHistoryView} from './CoachHistoryView';
afterEach(cleanup);
beforeEach(()=>{
 mocks.list.mockReset();mocks.read.mockReset();mocks.hydrate.mockReset();
 mocks.list.mockResolvedValue({docs:['a','b'].map(id=>({id,data:()=>({roomName:`場次${id}`,playerCount:1,players:[{uid:id,name:id,profession:'職業',happiness:1,score:1}]})}))});
 mocks.hydrate.mockImplementation(async(_db:unknown,_id:string,data:unknown)=>data);
});
it('displays a detail failure and allows an explicit retry',async()=>{
 mocks.read.mockRejectedValueOnce({code:'permission-denied'}).mockResolvedValueOnce({exists:()=>true,data:()=>({players:[{uid:'a'}]})});
 render(<CoachHistoryView onBack={()=>{}}/>);fireEvent.click(await screen.findByText('場次a'));
 expect(await screen.findByRole('alert')).toHaveTextContent('permission-denied');
 fireEvent.click(screen.getByText('重試載入'));
 await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
 expect(mocks.read).toHaveBeenCalledTimes(2);
});
it('ignores the previous detail error after selecting another room',async()=>{
 let rejectOld:(error:unknown)=>void=()=>{};
 mocks.read.mockImplementationOnce(()=>new Promise((_,reject)=>{rejectOld=reject;})).mockResolvedValueOnce({exists:()=>true,data:()=>({players:[{uid:'b'}]})});
 render(<CoachHistoryView onBack={()=>{}}/>);fireEvent.click(await screen.findByText('場次a'));fireEvent.click(screen.getByText('場次b'));
 await waitFor(()=>expect(mocks.hydrate).toHaveBeenCalledTimes(1));await act(async()=>rejectOld({code:'permission-denied'}));
 expect(screen.queryByRole('alert')).toBeNull();
});

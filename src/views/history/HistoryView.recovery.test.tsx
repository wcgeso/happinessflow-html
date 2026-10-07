import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
const mocks=vi.hoisted(()=>({read:vi.fn(),hydrate:vi.fn()}));
vi.mock('firebase/firestore',()=>({collection:()=>({}),query:()=>({}),where:()=>({}),orderBy:()=>({}),getDocs:mocks.read}));
vi.mock('../../../services/firebase',()=>({db:{}}));
vi.mock('../../context/GameContext',()=>({useGame:()=>({gameHistory:[]})}));
vi.mock('../../context/RoomContext',()=>({useRoom:()=>({room:null})}));
vi.mock('../../game/settlement/scoreRecord',()=>({loadScoreRecord:mocks.hydrate}));
vi.mock('../../components/business/FinancialStatement',()=>({FinancialStatement:()=>null}));
import {HistoryView,ScoreModal} from './HistoryView';
afterEach(cleanup);
beforeEach(()=>{mocks.read.mockReset();mocks.hydrate.mockReset();});
it('shows the actual failure and retries without replacing it with empty success',async()=>{
 mocks.read.mockRejectedValueOnce({code:'permission-denied'}).mockResolvedValueOnce({size:0,docs:[]});
 render(<HistoryView onBack={()=>{}} targetUserId="p1"/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('permission-denied');
 fireEvent.click(screen.getByText('重試載入'));
 await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
 expect(await screen.findByText('尚無遊戲紀錄')).toBeTruthy();expect(mocks.read).toHaveBeenCalledTimes(2);
});
it('ignores a previous player failure after switching targets',async()=>{
 let rejectOld:(error:unknown)=>void=()=>{};
 mocks.read.mockImplementationOnce(()=>new Promise((_,reject)=>{rejectOld=reject;})).mockResolvedValueOnce({size:0,docs:[]});
 const view=render(<HistoryView onBack={()=>{}} targetUserId="p1"/>);
 view.rerender(<HistoryView onBack={()=>{}} targetUserId="p2"/>);
 await screen.findByText('尚無遊戲紀錄');
 await act(async()=>rejectOld({code:'permission-denied'}));
 expect(screen.queryByRole('alert')).toBeNull();expect(screen.queryByText('正在載入紀錄數據...')).toBeNull();
});

it('restores insurance for the official score breakdown and keeps legacy records readable',()=>{
 const record:any={date:'2026-10-03',playerName:'甲',profession:'職業',happinessScore:0,financialSummary:{totalExpenses:10,monthlyCashflow:20,passiveIncome:0},gameStateSnapshot:{assets:[],liabilities:[],income:{},expenses:{},history:[],happiness:[],cash:100,loans:0,medicalInsuranceCount:1}};
 const view=render(<ScoreModal record={record} onClose={()=>{}}/>);
 const safety=screen.getByText('達到財務安全 (預備金/保險/收支平衡)').parentElement!;expect(safety).toHaveClass('text-slate-300');
 view.rerender(<ScoreModal record={{...record,gameStateSnapshot:{...record.gameStateSnapshot,medicalInsuranceCount:undefined}}} onClose={()=>{}}/>);expect(safety).toHaveClass('text-slate-500');
});

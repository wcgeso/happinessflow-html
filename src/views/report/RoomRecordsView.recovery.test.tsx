import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
const mocks=vi.hoisted(()=>({read:vi.fn(),hydrate:vi.fn()}));
vi.mock('firebase/firestore',()=>({collection:()=>({}),doc:()=>({}),getDoc:mocks.read,getDocs:vi.fn(),deleteDoc:vi.fn(),setDoc:vi.fn(),serverTimestamp:()=>0}));
vi.mock('../../../services/firebase',()=>({db:{}}));
vi.mock('../../game/settlement/settleGame',()=>({settleGame:vi.fn()}));
vi.mock('../../game/settlement/scoreRecord',()=>({loadScoreRecord:mocks.hydrate}));
vi.mock('../../components/business/FinancialStatement',()=>({FinancialStatement:({gameState,summary,historySource}:any)=><div data-testid="statement">{JSON.stringify({cash:gameState.cash,enterprise:gameState.selectedEnterprise,abilities:gameState.abilities,rank:gameState.currentRankLevel,insurance:gameState.medicalInsuranceCount,summary,historySource})}</div>}));
import {PlayerFinancialModal} from './RoomRecordsView';
const snapshot=(data:any)=>({exists:()=>true,data:()=>data});
const data={playerStorage:'subcollection',trustedSettlement:true,roomId:'r',sessionId:'s',financialHistoryStorage:'subcollection',players:[{uid:'p',name:'甲',cash:123,selectedEnterprise:{name:'目標事業'},abilities:{realEstateAbilityCount:2},currentRankLevel:4,medicalInsuranceCount:1,income:{},summary:{totalIncome:10,passiveIncome:0,netWorth:999}}]};
beforeEach(()=>{mocks.read.mockReset();mocks.hydrate.mockReset();mocks.hydrate.mockImplementation(async(_db:unknown,_id:string,data:unknown)=>data);});
afterEach(cleanup);
it('preserves the saved financial summary and full-history source',async()=>{
 mocks.read.mockResolvedValue(snapshot(data));render(<PlayerFinancialModal recordId="a" playerName="甲" playerIndex={0} onClose={()=>{}}/>);
 const report=await screen.findByTestId('statement');expect(report).toHaveTextContent('999');expect(report).toHaveTextContent('123');expect(report).toHaveTextContent('目標事業');expect(report).toHaveTextContent('"realEstateAbilityCount":2');expect(report).toHaveTextContent('"rank":4');expect(report).toHaveTextContent('"insurance":1');expect(report).toHaveTextContent('"sessionId":"s"');expect(mocks.hydrate.mock.calls[0][3]).toBe('p');
});
it('reports failure and recovers on retry',async()=>{
 mocks.read.mockRejectedValueOnce({code:'unavailable'}).mockResolvedValueOnce(snapshot(data));render(<PlayerFinancialModal recordId="a" playerName="甲" playerIndex={0} onClose={()=>{}}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');fireEvent.click(screen.getByText('重試載入'));await screen.findByTestId('statement');expect(screen.queryByRole('alert')).toBeNull();
});
it('ignores a previous record failure after switching records',async()=>{
 let rejectOld:(error:unknown)=>void=()=>{};mocks.read.mockImplementationOnce(()=>new Promise((_,reject)=>{rejectOld=reject;})).mockResolvedValueOnce(snapshot(data));
 const view=render(<PlayerFinancialModal recordId="a" playerName="甲" playerIndex={0} onClose={()=>{}}/>);view.rerender(<PlayerFinancialModal recordId="b" playerName="甲" playerIndex={0} onClose={()=>{}}/>);
 await screen.findByTestId('statement');await act(async()=>rejectOld({code:'permission-denied'}));expect(screen.queryByRole('alert')).toBeNull();await waitFor(()=>expect(mocks.hydrate).toHaveBeenCalledTimes(1));
});

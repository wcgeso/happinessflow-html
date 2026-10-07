import {PROFESSIONS,ENTERPRISES,DREAMS,createInitialMarketPrices} from '../../constants';
import type {GameState,Room} from '../../types';
import {createDefaultGameState} from '../../utils/gameState';
import {getInitialHappinessList} from '../../utils/gameUtils';

export type PlayerSelection={professionId:string;enterpriseId:string;dreamId:string};
export function buildPlayerSetup(selection:PlayerSelection,room:Pick<Room,'startedAt'|'marketPrices'|'previousMarketPrices'>,playerName:string,reportName:string):GameState{
 const profession=PROFESSIONS.find(p=>p.id===selection.professionId),enterprise=ENTERPRISES.find(e=>e.id===selection.enterpriseId),dream=DREAMS.find(d=>d.id===selection.dreamId);
 if(!profession||!enterprise||!dream)throw new Error('選擇內容已不存在，請重新選擇。');
 const marketPrices=room.marketPrices&&Object.keys(room.marketPrices).length?room.marketPrices:createInitialMarketPrices();
 return {...createDefaultGameState(),profession,selectedEnterprise:enterprise,selectedDream:dream,selectionDraft:{professionId:selection.professionId,enterpriseId:selection.enterpriseId,dreamId:selection.dreamId},currentRankTitle:profession.initialRank,currentRankLevel:1,cash:profession.savings,isSetup:true,selectionStep:'completed',expenses:{},income:{},happiness:getInitialHappinessList(enterprise,dream),marketPrices,previousMarketPrices:room.previousMarketPrices&&Object.keys(room.previousMarketPrices).length?room.previousMarketPrices:marketPrices,boardGameStartedAt:room.startedAt,playerName,reportName};
}

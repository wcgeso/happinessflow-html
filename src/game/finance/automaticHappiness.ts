import type {GameState,FinancialAccelerationState} from '../../types';
import {calculateFinancialSummary} from '../../utils/gameUtils';
export const withAutomaticHappiness = (state:GameState, acceleration?:FinancialAccelerationState):GameState => {
  if(!state.isSetup || !Array.isArray(state.happiness) || !Array.isArray(state.assets)) return state;
  const summary=calculateFinancialSummary(state,acceleration);
        let updatedHappiness = [...state.happiness];


        // 1. 財務自由 (理財收入 > 總支出)
        const isFinancialFree = summary.passiveIncome > summary.totalExpenses;
        const financeItem = updatedHappiness.find(h => h.id === 'h_finance');
        if (financeItem && financeItem.checked !== isFinancialFree) {
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_finance' ? { ...h, checked: isFinancialFree } : h);

        }

        // 2. 自住房相關：只取分數最高的那一間
        const houseSubIds: Record<string, string> = { '1room': 'h_house_1', '2room': 'h_house_2', '3room': 'h_house_3', '5room': 'h_house_5' };
        const housePoints: Record<string, number> = { '1room': 2, '2room': 4, '3room': 6, '5room': 8 };
        const selfUseTypes = state.assets
            .filter(a => a.houseType && a.isSelfUse)
            .map(a => a.houseType as string);
        const bestType = selfUseTypes.reduce<string | null>((best, t) =>
            best === null || (housePoints[t] || 0) > (housePoints[best] || 0) ? t : best
        , null);

        Object.entries(houseSubIds).forEach(([typeKey, itemId]) => {
            const shouldBeChecked = typeKey === bestType;
            const item = updatedHappiness.find(h => h.id === itemId);
            if (item && item.checked !== shouldBeChecked) {
                updatedHappiness = updatedHappiness.map(h => h.id === itemId ? { ...h, checked: shouldBeChecked } : h);

            }
        });

        const hasAnySelfUseHouse = state.assets.some(a => a.type === '不動產' && a.houseType && a.isSelfUse);
        const houseSelfItem = updatedHappiness.find(h => h.id === 'h_house_self');
        if (houseSelfItem && houseSelfItem.checked !== hasAnySelfUseHouse) {
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_house_self' ? { ...h, checked: hasAnySelfUseHouse } : h);

        }

        // 3. 幸福家庭 (完成 5 項: 約會, 求婚, 婚禮, 孩子1, 自住房)
        const hasDate = updatedHappiness.find(h => h.id === 'h_date')?.checked;
        const hasProposal = updatedHappiness.find(h => h.id === 'h_proposal')?.checked;
        const hasWedding = updatedHappiness.find(h => h.id === 'h_wedding')?.checked;
        const hasChild1 = updatedHappiness.find(h => h.id === 'h_child1')?.checked;
        const isFamilyComplete = !!(hasDate && hasProposal && hasWedding && hasChild1 && hasAnySelfUseHouse);

        const familyItem = updatedHappiness.find(h => h.id === 'h_family');
        if (familyItem && familyItem.checked !== isFamilyComplete) {
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_family' ? { ...h, checked: isFamilyComplete } : h);

        }

        // 4. 汽車（相容舊的飛行器資產資料）
        const hasAircraft = state.assets.some(a => a.type === '汽車' || a.type === '飛行器');
        const planeItem = updatedHappiness.find(h => h.id === 'h_plane');
        if (planeItem && planeItem.checked !== hasAircraft) {
            updatedHappiness = updatedHappiness.map(h => h.id === 'h_plane' ? { ...h, checked: hasAircraft } : h);

        }

  if(JSON.stringify(state.happiness)===JSON.stringify(updatedHappiness))return state;
  return {...state,happiness:updatedHappiness,happinessTotal:updatedHappiness.reduce((sum,item)=>sum+(item.checked?item.points:0),0)};
};

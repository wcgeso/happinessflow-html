import { Asset, HappinessItem, Enterprise, Dream, GameState, FinancialSummary } from '../types';

export const calculateFinancialSummary = (gameState: GameState): FinancialSummary => {
    if (!gameState.profession) return { totalIncome: 0, totalExpenses: 0, monthlyCashflow: 0, passiveIncome: 0, totalAssets: 0, totalLiabilities: 0, payday: 0 };

    const assets = gameState.assets || [];
    const liabilities = gameState.liabilities || [];
    const income = gameState.income || {};
    const expenses = gameState.expenses || {};

    // 1. 理財收入（資產收益 + 執行師手動調整）
    const passiveIncome = (Number(income.investment) || 0) + assets.reduce((sum, a) => {
        let incomeVal = Number(a.cashflow) || 0;
        // 投資不動產的能力加成
        if (a.type === '不動產' && !a.isSelfUse && (gameState.abilities?.realEstateAbilityCount || 0) > 0) {
            incomeVal += 10000 * gameState.abilities.realEstateAbilityCount;
        }
        return sum + incomeVal;
    }, 0);

    // 2. 額外動態收入 (從 income 物件中抓取，但排除掉可能重複計算的部分)
    const dynamicIncome = Object.entries(income).reduce((sum, [key, v]) => {
        // 排除 salary 和 已經在 passiveIncome 算過的項目（標籤含 "收益", "租金" 等）
        if (key === 'salary' || key === 'investment') return sum;
        return sum + (Number(v) || 0);
    }, 0);

    const totalIncome = (gameState.profession.salary || 0) + passiveIncome + dynamicIncome;

    // 3. 支出計算
    // A. 負債利息
    const creditLoanInterest = (liabilities.filter(l => l.type === '信用貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0)) + ((gameState.loans || 0) * 0.1);
    const aircraftLoanInterest = liabilities.filter(l => l.type === '飛行器貸款' || l.type === '汽車貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
    const businessLoanInterest = liabilities.filter(l => l.type === '企業貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
    const realEstateLoanInterest = liabilities.filter(l => l.type === '不動產貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);

    // B. 基礎支出 (職業設定 + 遊戲中發生的永久增加)
    const p = gameState.profession;
    const taxExpense = Math.floor((p.salary || 0) * 0.05); // 所得稅 5%

    // 這裡要包含職業基礎支出 + gameState.expenses 中的動態增減
    const basicLivingTotal = Math.max(0, (p.expenses?.basicLiving || 0) + (Number(expenses.basicLiving) || 0));
    const transportEduTotal = Math.max(0, (p.expenses?.transportEdu || 0) + (Number(expenses.transportEdu) || 0));
    const otherMedicalChildTotal = Math.max(0, (p.expenses?.otherMedicalChild || 0) + (Number(expenses.otherMedicalChild) || 0));

    // C. 職等加成支出
    const rankIncrease = Math.max(0, (gameState.currentRankLevel || 1) - 1);
    const rankExpenseBonus = rankIncrease * 10000;

    // D. 保險費用 (每張 2000H)
    const medicalInsuranceCount = gameState.medicalInsuranceCount || 0;
    const houseInsuranceCount = assets.filter(a => a.type === '不動產' && a.isInsured).length;
    // 汽車保險 (相容舊的飛行器資產資料)
    const aircraftInsuranceCount = assets.filter(a => ((a.type as string) === '飛行器' || (a.type as string) === '汽車') && a.isInsured).length;
    const insuranceCost = (medicalInsuranceCount + houseInsuranceCount + aircraftInsuranceCount) * 2000;

    const totalExpenses = taxExpense +
        basicLivingTotal +
        transportEduTotal +
        otherMedicalChildTotal +
        rankExpenseBonus +
        creditLoanInterest +
        aircraftLoanInterest +
        businessLoanInterest +
        realEstateLoanInterest +
        insuranceCost;

    const totalAssets = assets.reduce((sum, a) => {
        if (a.type === '股票') {
            const symMatch = a.name.match(/[A-Z]\d+/);
            const symbol = symMatch ? symMatch[0] : a.name;
            const marketPrice = (gameState.marketPrices && gameState.marketPrices[symbol]) || a.lastPurchasePrice || 0;
            return sum + (a.quantity || 0) * marketPrice;
        }
        return sum + (Number(a.cost) || 0);
    }, 0) + (Number(gameState.cash) || 0);

    const totalLiabilities = liabilities.reduce((sum, l) => sum + (Number(l.totalOwed) || 0), 0) + (Number(gameState.loans) || 0);

    return {
        totalIncome,
        totalExpenses,
        monthlyCashflow: totalIncome - totalExpenses,
        passiveIncome,
        totalAssets,
        totalLiabilities,
        payday: totalIncome - totalExpenses
    };
};

export const calculateScoreResult = (gameState: GameState, summary: FinancialSummary) => {
    const h = gameState.happinessTotal || 0;
    const reserve = (gameState.cash || 0) + (gameState.assets || []).filter(a => a.type === '定存').reduce((s, a) => s + (a.cost || 0), 0);
    const isReserveOk = reserve > summary.totalExpenses;
    const isInsured = (gameState.medicalInsuranceCount || 0) >= 1;
    const isCashflowOk = summary.monthlyCashflow > 0;

    const validInvestmentTypes = new Set(['股票', '不動產', '企業', '定存']);
    const playerAssetTypes = new Set((gameState.assets || []).map(a => a.type).filter(t => validInvestmentTypes.has(t as string)));

    const criteriaList = [
        { label: '遊玩積分', points: 2, achieved: true },
        { label: '幸福指數達 10', points: 1, achieved: h >= 10 },
        { label: '幸福指數達 30', points: 1, achieved: h >= 30 },
        { label: '幸福指數達 60', points: 2, achieved: h >= 60 },
        { label: '幸福指數達 80', points: 3, achieved: h >= 80 },
        { label: '幸福指數達 100', points: 5, achieved: h >= 100 },
        { label: '達到財務安全 (預備金/保險/收支平衡)', points: 1, achieved: isReserveOk && isInsured && isCashflowOk },
        { label: '達到財務寬裕 (擁有多種資產)', points: 2, achieved: playerAssetTypes.size >= 2 },
        { label: '達到財務自由 (理財收入 > 總支出)', points: 3, achieved: summary.passiveIncome > summary.totalExpenses },
    ];

    const totalScore = criteriaList.reduce((sum, c) => sum + (c.achieved ? c.points : 0), 0);
    return { totalScore, details: criteriaList };
};

export const formatMoney = (amount: number) => {
    const lucky = Number(amount) || 0;
    return lucky.toLocaleString();
};

export function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

export const getInitialHappinessList = (enterprise: Enterprise, dream: Dream): HappinessItem[] => {
    return [
        { id: 'h_finance', label: '實現幸福財務 (理財收入>總支出)', points: 30, checked: false, readOnly: true },
        { id: 'h_family', label: '實現幸福家庭 (完成5項)', points: 20, checked: false, readOnly: true },
        { id: 'h_date', label: '1. 第一次約會', points: 2, checked: false, readOnly: true },
        { id: 'h_proposal', label: '2. 難忘的求婚', points: 2, checked: false, readOnly: true },
        { id: 'h_wedding', label: '3. 浪漫的婚禮', points: 4, checked: false, readOnly: true },
        { id: 'h_child1', label: '4. 擁有第一個孩子', points: 4, checked: false, readOnly: true },
        { id: 'h_house_self', label: '5. 擁有自住的房子', points: 0, checked: false, readOnly: true },
        { id: 'h_house_1', label: '單間小套房', points: 2, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_house_2', label: '兩房一廳', points: 4, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_house_3', label: '三房兩廳', points: 6, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_house_5', label: '五房三廳', points: 8, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_child2', label: '擁有第二個孩子', points: 4, checked: false, readOnly: true },
        { id: 'h_plane', label: '擁有一台汽車', points: 4, checked: false, readOnly: true },
        { id: 'h_career', label: `事業成就 (${enterprise.name})`, code: enterprise.id, description: `投資額: ${formatMoney(enterprise.cost)} | 月收: +${formatMoney(enterprise.income)}`, points: 10, checked: false, readOnly: true },
        { id: 'h_dream', label: `完成夢想 (${dream.name})`, code: dream.id, description: `花費: ${formatMoney(dream.cost)} ${dream.description ? '| ' + dream.description : ''}`, points: 10, checked: false, readOnly: true },
    ];
};

/**
 * 遞迴清理物件中的 undefined 欄位，將其轉換為 null 或刪除，
 * 解決 Firebase 不支援 undefined 的問題。
 */
export const cleanDataForFirestore = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => cleanDataForFirestore(v));
    } else if (obj !== null && typeof obj === 'object') {
        return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                acc[key] = cleanDataForFirestore(value);
            }
            return acc;
        }, {} as any);
    }
    return obj;
};

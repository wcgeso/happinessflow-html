import { Asset, HappinessItem, Enterprise, Dream, GameState, FinancialSummary } from '../types';

export const calculateFinancialSummary = (gameState: GameState): FinancialSummary => {
    if (!gameState.profession) return { totalIncome: 0, totalExpenses: 0, monthlyCashflow: 0, passiveIncome: 0, totalAssets: 0, totalLiabilities: 0, payday: 0 };

    const assets = gameState.assets || [];
    const liabilities = gameState.liabilities || [];
    const income = gameState.income || {};
    const expenses = gameState.expenses || {};

    const passiveIncome = assets.reduce((sum, a) => {
        let incomeVal = a.cashflow;
        // 投資不動產的能力：所有出租房產租金 +10,000H * 能力次數
        if (a.type === '不動產' && !a.isSelfUse && gameState.abilities?.realEstateAbilityCount > 0) {
            incomeVal += 10000 * gameState.abilities.realEstateAbilityCount;
        }
        return sum + incomeVal;
    }, 0);
    const dynamicIncome = Object.values(income).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const totalIncome = (gameState.profession.salary || 0) + passiveIncome + dynamicIncome;

    // Calculate interest from liabilities' monthlyPayment
    const creditLoanInterest = (liabilities.filter(l => l.type === '信用貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0)) + ((gameState.loans || 0) * 0.1);
    const aircraftLoanInterest = liabilities.filter(l => l.type === '飛行器貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
    const businessLoanInterest = liabilities.filter(l => l.type === '企業貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
    const realEstateLoanInterest = liabilities.filter(l => l.type === '不動產貸款').reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);

    const p = gameState.profession;

    // Calculate each expense category, combining professional base and user adjustments
    // 所得稅務隨工作收入(salary)變動，比例為 5%
    const taxExpense = Math.floor((p.salary || 0) * 0.05);
    const basicLivingTotal = Math.max(0, (p.expenses?.basicLiving || 0) + (Number(expenses.basicLiving) || 0));
    const transportEduTotal = Math.max(0, (p.expenses?.transportEdu || 0) + (Number(expenses.transportEdu) || 0));
    const otherMedicalChildTotal = Math.max(0, (p.expenses?.otherMedicalChild || 0) + (Number(expenses.otherMedicalChild) || 0));

    const rankIncrease = Math.max(0, (gameState.currentRankLevel || 1) - 1);
    const otherExpensesBonus = rankIncrease * 10000; // This bonus is specifically for otherMedicalChild

    const totalInsuranceCount = (gameState.medicalInsuranceCount || 0) + assets.filter(a => a.isInsured).length;
    const insuranceCost = totalInsuranceCount * 2000;

    const totalExpenses = taxExpense +
                          basicLivingTotal +
                          transportEduTotal +
                          otherMedicalChildTotal +
                          otherExpensesBonus +
                          creditLoanInterest +
                          aircraftLoanInterest +
                          businessLoanInterest +
                          realEstateLoanInterest +
                          insuranceCost;

    const totalAssets = assets.reduce((sum, a) => {
        if (a.type === '股票') {
            const symbol = a.name.replace('股票 ', '');
            const marketPrice = (gameState.marketPrices && gameState.marketPrices[symbol]) || a.lastPurchasePrice || 0;
            return sum + (a.quantity || 0) * marketPrice;
        }
        return sum + a.cost;
    }, 0) + (gameState.cash || 0);

    return {
        totalIncome,
        totalExpenses,
        monthlyCashflow: totalIncome - totalExpenses,
        passiveIncome,
        totalAssets,
        totalLiabilities: liabilities.reduce((sum, l) => sum + (l.totalOwed || 0), 0) + (gameState.loans || 0),
        payday: totalIncome - totalExpenses
    };
};

export const formatMoney = (amount: number) => {
    const lucky = Number(amount) || 0;
    return `${lucky.toLocaleString()} H`;
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
        { id: 'h_house_2', label: '兩室一廳', points: 4, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_house_3', label: '三室兩廳', points: 6, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_house_5', label: '五室三廳', points: 8, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_child2', label: '擁有第二個孩子', points: 4, checked: false, readOnly: true },
        { id: 'h_plane', label: '擁有一架飛行器', points: 4, checked: false, readOnly: true },
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

import { useState, useMemo } from 'react';
import {
    Liability, Asset, Profession, Enterprise, Dream, HappinessItem,
    Mode, AssetType, TransactionData, StockTransactionItem,
    AccountEntry, AccountCategory, ChangeDirection
} from '../types';
import { STOCK_SYMBOLS, REAL_ESTATE_SYMBOLS, BUSINESS_SYMBOLS } from '../constants';

const formatMoney = (amount: number) => {
    const num = Number(amount);
    return `${Math.abs(num).toLocaleString()} H`;
};

type ExpenseType = 'housing_loan' | 'increase_monthly' | 'decrease_monthly' | '';

interface UseTransactionLogicProps {
    profession: Profession | null;
    selectedEnterprise: Enterprise | null;
    selectedDream: Dream | null;
    cash: number;
    salary: number;
    assets: Asset[];
    happiness: HappinessItem[];
    completedHappinessEvents?: string[];
    happinessSubMode: 'history' | 'pay' | 'inc_exp';
    setHappinessSubMode: (v: 'history' | 'pay' | 'inc_exp') => void;
    liabilities: Liability[];
    marketPrices?: Record<string, number>;
    onTransaction: (data: TransactionData) => void;
    onShowAlert?: (message: string, type: 'info' | 'error' | 'success') => void;
}

export const useTransactionLogic = ({
    profession,
    selectedEnterprise,
    selectedDream,
    cash,
    salary,
    assets,
    happiness,
    completedHappinessEvents = [],
    happinessSubMode,
    setHappinessSubMode,
    liabilities,
    marketPrices,
    onTransaction,
    onShowAlert
}: UseTransactionLogicProps) => {
    const [phase, setPhase] = useState<1 | 2 | 3>(1);
    const [mode, setMode] = useState<Mode>('buy');
    const [assetType, setAssetType] = useState<AssetType>('股票');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // States from TransactionForm
    const [stockInputs, setStockInputs] = useState<Record<string, { price: string, qty: string }>>({});
    const [reSelfUse, setReSelfUse] = useState(false);
    const [reSymbol, setReSymbol] = useState(REAL_ESTATE_SYMBOLS[0]);
    const [reDownPayment, setReDownPayment] = useState<string>('');
    const [reLoan, setReLoan] = useState<string>('');
    const [reInterest, setReInterest] = useState<string>('');
    const [reIncome, setReIncome] = useState<string>('');
    const [reHouseType, setReHouseType] = useState<string>('1room');
    const [bizSymbol, setBizSymbol] = useState(BUSINESS_SYMBOLS[0]);
    const [bizCost, setBizCost] = useState<string>('');
    const [bizLoan, setBizLoan] = useState<string>('');
    const [bizInterest, setBizInterest] = useState<string>('');
    const [bizIncome, setBizIncome] = useState<string>('');
    const [cdAmount, setCdAmount] = useState<string>('');
    const [insType, setInsType] = useState<'medical' | 'house' | 'aircraft'>('medical');
    const [insMedicalQty, setInsMedicalQty] = useState<string>('1');
    const [insSelectedHouses, setInsSelectedHouses] = useState<string[]>([]);
    const [insAircraftSelected, setInsAircraftSelected] = useState(false);
    const [showInsAircraftError, setShowInsAircraftError] = useState(false);
    const [aircraftCash, setAircraftCash] = useState<string>('');
    const [aircraftLoan, setAircraftLoan] = useState<string>('');
    const [sellCat, setSellCat] = useState<AssetType>('股票');
    const [sellStockDetails, setSellStockDetails] = useState<Record<string, { price: string; qty: string }>>({});
    const [repayInputs, setRepayInputs] = useState<Record<string, string>>({});
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [loanSubMode, setLoanSubMode] = useState<'borrow' | 'repay'>('borrow');
    const [repayType, setRepayType] = useState<'信用貸款' | '不動產貸款' | '企業貸款'>('信用貸款');
    const [borrowAmount, setBorrowAmount] = useState<string>('');
    const [repayAmount, setRepayAmount] = useState<string>('');
    const [divMode, setDivMode] = useState<'cash' | 'stock'>('cash');
    const [divInputs, setDivInputs] = useState<Record<string, string>>({});
    const [eventSubMode, setEventSubMode] = useState<'pay' | 'inc_exp' | 'dec_exp'>('pay');
    const [eventPayType, setEventPayType] = useState<string>('medical');
    const [eventAmount, setEventAmount] = useState<string>('');
    const [eventCustomName, setEventCustomName] = useState('');
    const [eventExpCategory, setEventExpCategory] = useState<'basicLiving' | 'transportEdu' | 'otherMedicalChild'>('basicLiving');
    const [eventTab, setEventTab] = useState<'chance' | 'happiness'>('chance');
    const [selectedExpense, setSelectedExpense] = useState<ExpenseType>('');
    const [expenseAmount, setExpenseAmount] = useState<string>('');
    const [expenseCategorySelect, setExpenseCategorySelect] = useState<'basicLiving' | 'transportEdu' | 'otherMedicalChild'>('otherMedicalChild');

    const [userEntries, setUserEntries] = useState<AccountEntry[]>([]);
    const [pendingTx, setPendingTx] = useState<TransactionData | null>(null);
    const [correctEntries, setCorrectEntries] = useState<AccountEntry[]>([]);

    const resetFormStates = () => {
        setPhase(1);
        setMode('buy');
        setAssetType('股票');
        setErrorMessage(null);
        setStockInputs({});
        setReSelfUse(false);
        setReSymbol(REAL_ESTATE_SYMBOLS[0]);
        setReDownPayment('');
        setReLoan('');
        setReInterest('');
        setReIncome('');
        setReHouseType('1room');
        setBizSymbol(BUSINESS_SYMBOLS[0]);
        setBizCost('');
        setBizLoan('');
        setBizInterest('');
        setBizIncome('');
        setCdAmount('');
        setInsType('medical');
        setInsMedicalQty('1');
        setInsSelectedHouses([]);
        setInsAircraftSelected(false);
        setShowInsAircraftError(false);
        setAircraftCash('');
        setAircraftLoan('');
        setSellCat('股票');
        setSellStockDetails({});
        setRepayInputs({});
        setWithdrawAmount('');
        setLoanSubMode('borrow');
        setRepayType('信用貸款');
        setBorrowAmount('');
        setRepayAmount('');
        setDivMode('cash');
        setDivInputs({});
        setEventSubMode('pay');
        setEventPayType('medical');
        setEventAmount('');
        setEventCustomName('');
        setEventExpCategory('basicLiving');
        setEventTab('chance');
        setHappinessSubMode('pay');
        setSelectedExpense('');
        setExpenseAmount('');
        setExpenseCategorySelect('otherMedicalChild');
        setUserEntries([]);
        setPendingTx(null);
        setCorrectEntries([]);
    };

    // Computed
    const stockAssets = useMemo(() => assets.filter(a => a.type === '股票'), [assets]);
    const cdTotal = useMemo(() => assets.filter(a => a.type === '定存').reduce((sum, a) => sum + a.cost, 0), [assets]);
    const uninsuredHouses = useMemo(() => assets.filter(a => a.type === '不動產' && !a.isInsured), [assets]);
    const hasAircraftAsset = useMemo(() => assets.some(a => (a.type as any) === '飛行器'), [assets]);

    const handlePhase1Submit = () => {
        let txData: TransactionData | null = null;
        let expectedEntries: AccountEntry[] = [];
        let impactList: string[] = [];
        setErrorMessage(null);

        const showError = (msg: string) => {
            if (onShowAlert) {
                onShowAlert(msg, 'error');
            } else {
                setErrorMessage(msg);
            }
        };

        // Copying logic from TransactionForm.tsx handlePhase1Submit...
        if (mode === 'expense' && selectedExpense === 'housing_loan') {
            const amount = Number(expenseAmount);
            if (!amount || amount <= 0) { showError("請輸入有效的還款金額"); return; }
            if (amount > cash) { showError("現金不足"); return; }
            txData = { name: "償還房屋貸款", amount: amount, cashChange: -amount, source: 'cash', usage: 'expense', expensePayload: { category: 'otherMedicalChild', amount: amount, isIncrease: false } };
            impactList.push(`現金 -${formatMoney(amount)}`, `不動產貸款 -${formatMoney(amount)}`);
            expectedEntries.push({ category: 'Assets', name: '現金', direction: 'Decrease' }, { category: 'Liabilities', name: '不動產貸款', direction: 'Decrease' }, { category: 'Expenses', name: '不動產貸款利息', direction: 'Decrease' });
        } else if (mode === 'expense' && selectedExpense === 'increase_monthly') {
            const amount = Number(expenseAmount);
            const category = expenseCategorySelect || 'otherMedicalChild';
            if (!amount || amount <= 0) { showError("請輸入有效的金額"); return; }
            const categoryName = category === 'basicLiving' ? '餐飲、服飾、居住類' : category === 'transportEdu' ? '交通、教育、娛樂類' : '其他、醫療、育兒類';
            txData = { name: `增加月支出：${categoryName}`, amount, cashChange: 0, source: 'income', usage: 'expense_update', expensePayload: { category, amount, isIncrease: true } };
            impactList.push(`${categoryName} +${formatMoney(amount)}`);
            expectedEntries.push({ category: 'Expenses', name: categoryName, direction: 'Increase' });
        } else if (mode === 'expense' && selectedExpense === 'decrease_monthly') {
            const amount = Number(expenseAmount);
            const category = expenseCategorySelect || 'otherMedicalChild';
            if (!amount || amount <= 0) { showError("請輸入有效的金額"); return; }
            const categoryName = category === 'basicLiving' ? '餐飲、服飾、居住類' : category === 'transportEdu' ? '交通、教育、娛樂類' : '其他、醫療、育兒類';
            txData = { name: `減少月支出：${categoryName}`, amount, cashChange: 0, source: 'cash', usage: 'expense_update', expensePayload: { category, amount, isIncrease: false } };
            impactList.push(`${categoryName}月支出 -${formatMoney(amount)}`);
            expectedEntries.push({ category: 'Expenses', name: categoryName, direction: 'Decrease' });
        } else if (mode === 'buy') {
            if (assetType === '股票') {
                const list = Object.entries(stockInputs)
                    .filter(([_, v]) => Number(v.qty) > 0)
                    .map(([s, v]) => {
                        const price = marketPrices ? (marketPrices[s] || 0) : Number(v.price);
                        return { symbol: s, price: price, qty: Number(v.qty) };
                    });

                if (list.length === 0) { showError("請輸入購買張數"); return; }
                const total = list.reduce((s, i) => s + (i.price * i.qty), 0);
                if (total > cash) { showError("現金不足"); return; }
                const tickerNames = list.map(i => i.symbol).join(', ');
                txData = { name: `購買股票 (${tickerNames})`, amount: total, cashChange: -total, source: 'cash', usage: 'asset', stockList: list, assetDetails: { type: '股票', cashflow: 0, downPayment: total } };
                impactList.push(`現金 -${formatMoney(total)}`);
                list.forEach(s => impactList.push(`股票 (${s.symbol}) +${formatMoney(s.price * s.qty)}`));
                expectedEntries.push({ category: 'Assets', name: '現金', direction: 'Decrease' });
                expectedEntries.push({ category: 'Assets', name: '股票', direction: 'Increase' });
            } else if (assetType === '不動產') {
                const existing = assets.find(a => a.type === '不動產' && a.name?.includes(reSymbol));
                if (existing) { showError(`您已經擁有 ${reSymbol} 不動產，無法重複購買`); return; }
                if (!reDownPayment) { showError("請輸入頭期款"); return; }
                const down = Number(reDownPayment), loan = Number(reLoan), inc = Number(reIncome), inter = Number(reInterest);
                if (down > cash) { showError("現金不足"); return; }
                txData = { name: `購買不動產 ${reSymbol} ${reSelfUse ? '(自用)' : ''}`, amount: down + loan, cashChange: -down, source: loan > 0 ? 'loan' : 'cash', usage: 'asset', assetDetails: { type: '不動產', cashflow: reSelfUse ? 0 : inc, downPayment: down, loanAmount: loan, loanInterest: inter, symbol: reSymbol, isSelfUse: reSelfUse, houseType: reHouseType } };
                impactList.push(`現金 -${formatMoney(down)}`, `不動產 (${reSymbol}) +${formatMoney(down + loan)}`);
                if (loan > 0) { impactList.push(`不動產貸款 +${formatMoney(loan)}`, `貸款利息(月) +${formatMoney(inter)}`); }
                if (!reSelfUse && inc > 0) { impactList.push(`租金收入(月) +${formatMoney(inc)}`); }
                expectedEntries.push({ category: 'Assets', name: `不動產 (${reSymbol})`, direction: 'Increase' });
                if (down > 0) expectedEntries.push({ category: 'Assets', name: '現金', direction: 'Decrease' });
                if (loan > 0) { expectedEntries.push({ category: 'Liabilities', name: '不動產貸款', direction: 'Increase' }, { category: 'Expenses', name: '不動產貸款利息', direction: 'Increase' }); }
                if (!reSelfUse && inc > 0) expectedEntries.push({ category: 'Income', name: '租金收入', direction: 'Increase' });
            } else if (assetType === '企業') {
                const cost = Number(bizCost), loan = Number(bizLoan || 0), inc = Number(bizIncome), inter = Number(bizInterest || 0);
                const existing = assets.find(a => a.type === '企業' && a.name?.includes(bizSymbol));
                if (existing) { showError(`您已經擁有 ${bizSymbol} 企業，無法重複購買`); return; }
                if (!cost || cost <= 0) { showError("請輸入有效的投資金額"); return; }
                if (!bizLoan) { showError("請輸入企業貸款金額，若無貸款請輸入 0"); return; }
                const down = cost - loan;
                if (down > cash) { showError("現金不足支付頭期款"); return; }
                txData = { name: `投資企業 ${bizSymbol}`, amount: cost, cashChange: loan - cost, source: loan > 0 ? 'loan' : 'cash', usage: 'asset', assetDetails: { type: '企業', cashflow: inc, downPayment: Math.max(0, down), loanAmount: loan, loanInterest: inter, symbol: bizSymbol } };
                impactList.push(`現金 -${formatMoney(cost)}`, `企業 (${bizSymbol}) +${formatMoney(cost)}`);
                if (loan > 0) { impactList.push(`企業貸款 +${formatMoney(loan)}`, `企業貸款利息(月) +${formatMoney(inter)}`, `現金（企業貸款） +${formatMoney(loan)}`); }
                if (inc > 0) { impactList.push(`企業收益(月) +${formatMoney(inc)}`); }
                expectedEntries = [{ category: 'Assets', name: `企業 (${bizSymbol})`, direction: 'Increase' }, { category: 'Assets', name: '現金', direction: 'Decrease' }];
                if (loan > 0) { expectedEntries.push({ category: 'Liabilities', name: '企業貸款', direction: 'Increase' }, { category: 'Expenses', name: '企業貸款利息', direction: 'Increase' }, { category: 'Assets', name: '現金（企業貸款）', direction: 'Increase' }); }
                if (inc > 0) expectedEntries.push({ category: 'Income', name: '企業收益', direction: 'Increase' });
            } else if (assetType === '定存') {
                const amt = Number(cdAmount);
                if (!amt) { showError("請輸入金額"); return; }
                if (amt <= 0 || amt % 10000 !== 0) { showError("定存金額必須為 10,000 的倍數且大於 0"); return; }
                if (amt > cash) { showError("現金不足"); return; }
                txData = { name: '存入定存', amount: amt, cashChange: -amt, source: 'cash', usage: 'asset', assetDetails: { type: '定存', cashflow: Math.floor(amt * 0.005), downPayment: amt } };
                impactList = [`現金 -${formatMoney(amt)}`, `定存 +${formatMoney(amt)}`, `定存利息(月) +${formatMoney(Math.floor(amt * 0.005))}`];
                expectedEntries = [{ category: 'Assets', name: '現金', direction: 'Decrease' }, { category: 'Assets', name: '定存', direction: 'Increase' }, { category: 'Income', name: '定存利息', direction: 'Increase' }];
            } else if (assetType === '保險') {
                let desc = '', pay: any = {}, qty = 0;
                if (insType === 'medical') { qty = Number(insMedicalQty); if (qty <= 0) { showError("請輸入張數"); return; } desc = `購買醫療保險 (${qty}張)`; pay = { medicalQty: qty }; }
                else if (insType === 'house') { qty = insSelectedHouses.length; if (qty <= 0) { showError("請選擇投保房屋"); return; } desc = `購買房屋保險 (${qty}間)`; pay = { targetAssetIds: insSelectedHouses }; }
                else if (insType === 'aircraft') { if (!insAircraftSelected) { showError("請勾選飛行器保險"); return; } qty = 1; desc = `購買飛行器保險`; pay = { aircraft: true }; }
                const total = qty * 2000;
                if (total > cash) { showError("現金不足"); return; }
                txData = { name: desc, amount: total, cashChange: -total, source: 'cash', usage: 'expense', insuranceType: insType, insurancePayload: pay };
                impactList = [`現金 -${formatMoney(total)}`, `保險月支出 +${formatMoney(total)}`];
                expectedEntries = [{ category: 'Assets', name: '現金', direction: 'Decrease' }, { category: 'Expenses', name: '保險支出', direction: 'Increase' }];
            } else if (assetType === '飛行器') {
                const c = Number(aircraftCash), l = Number(aircraftLoan);
                if (c + l !== 500000) { showError("支付現金與貸款額度加總不足 500,000 H"); return; }
                if (c > cash) { showError("現金不足"); return; }
                txData = { name: '購買飛行器（增加一顆骰子）', amount: 500000, cashChange: -c, source: l > 0 ? 'loan' : 'cash', usage: 'asset', assetDetails: { type: '飛行器' as any, cashflow: 0, downPayment: c, loanAmount: l, loanInterest: Math.floor(l * 0.005) } };
                impactList.push(`現金 -${formatMoney(c)}`, `飛行器資產 +${formatMoney(500000)}`);
                if (l > 0) impactList.push(`飛行器貸款 +${formatMoney(l)}`);
                expectedEntries.push({ category: 'Assets', name: '飛行器', direction: 'Increase' });
                if (c > 0) expectedEntries.push({ category: 'Assets', name: '現金', direction: 'Decrease' });
                if (l > 0) { expectedEntries.push({ category: 'Liabilities', name: '飛行器貸款', direction: 'Increase' }, { category: 'Expenses', name: '飛行器貸款利息', direction: 'Increase' }); }
            } else if (assetType === '目標企業' && selectedEnterprise) {
                if (happiness.find(h => h.id === 'h_career')?.checked) { showError(`您已達成事業成就：${selectedEnterprise.name}，不可重複購買`); return; }
                const { cost, income, name } = selectedEnterprise;
                if (cost > cash) { showError("現金不足以支付投資金額"); return; }
                txData = { name: `達成事業成就：${name}`, amount: cost, cashChange: -cost, source: 'cash', usage: 'asset', assetDetails: { type: '企業', cashflow: income, downPayment: cost, symbol: name } };
                impactList = [`現金 -${formatMoney(cost)}`, `企業 (${name}) +${formatMoney(cost)}`, `每月企業收益 +${formatMoney(income)}`];
                expectedEntries = [{ category: 'Assets', name: '現金', direction: 'Decrease' }, { category: 'Assets', name: `企業 (${name})`, direction: 'Increase' }, { category: 'Income', name: '企業收益', direction: 'Increase' }];
            } else if (assetType === '心儀夢想' && selectedDream) {
                if (happiness.find(h => h.id === 'h_dream')?.checked) { showError(`您已實現人生夢想：${selectedDream.name}，不可重複實現`); return; }
                const { cost, name } = selectedDream;
                if (cost > cash) { showError("現金不足以實現夢想"); return; }
                txData = { name: `實現人生夢想：${name}`, amount: cost, cashChange: -cost, source: 'cash', usage: 'expense' };
                impactList = [`現金 -${formatMoney(cost)}`, `成功實現夢想：${name}`];
                expectedEntries = [{ category: 'Assets', name: '現金', direction: 'Decrease' }];
            }
        } else if (mode === 'sell') {
            if (sellCat === '股票') {
                const entries = Object.entries(sellStockDetails).filter(([_, v]) => Number(v.price) > 0 && Number(v.qty) > 0);
                if (entries.length === 0) { showError("請輸入股票售價與賣出張數"); return; }
                const list: StockTransactionItem[] = [];
                let total = 0;
                for (const [id, v] of entries) {
                    const a = assets.find(x => x.id === id); if (!a || !a.quantity) continue;
                    const q = Number(v.qty), p = Number(v.price);
                    if (q > a.quantity) { showError("賣出張數不可大於持有張數"); return; }
                    list.push({ symbol: a.name.replace('股票 ', ''), price: p, qty: q });
                    total += p * q;
                }
                const tickerNames = list.map(i => i.symbol).join(', ');
                txData = { name: `賣出股票 (${tickerNames})`, amount: total, cashChange: total, source: 'income', usage: 'cash', stockList: list };
                impactList = [`現金 +${formatMoney(total)}`];
                list.forEach(s => impactList.push(`股票 (${s.symbol}) -${formatMoney(s.price * s.qty)}`));
                expectedEntries.push({ category: 'Assets', name: '現金', direction: 'Increase' });
                expectedEntries.push({ category: 'Assets', name: '股票', direction: 'Decrease' });
            } else if (sellCat === '定存') {
                const amt = Number(withdrawAmount);
                if (!amt) { showError("請輸入解約金額"); return; }
                if (amt > cdTotal) { showError("超過定存餘額"); return; }
                const interest = Math.floor(amt * 0.005);
                txData = { name: `定存解約`, amount: amt, cashChange: amt, source: 'income', usage: 'cash', relatedAssetId: assets.find(a => a.type === '定存')?.id, expensePayload: { category: 'otherMedicalChild', amount: interest, isIncrease: false } };
                impactList = [`現金 +${formatMoney(amt)}`, `定存 -${formatMoney(amt)}`, `定存利息(月) -${formatMoney(interest)}`];
                expectedEntries = [{ category: 'Assets', name: '現金', direction: 'Increase' }, { category: 'Assets', name: '定存', direction: 'Decrease' }, { category: 'Income', name: '定存利息', direction: 'Decrease' }];
            } else {
                const entries = Object.entries(repayInputs).filter(([_, v]) => Number(v) > 0);
                if (entries.length === 0) { showError("請輸入售價"); return; }
                const [id, price] = entries[0];
                const asset = assets.find(a => a.id === id); if (!asset) return;
                txData = { name: `賣出 ${asset.name}`, amount: Number(price), cashChange: Number(price), source: 'income', usage: 'cash', relatedAssetId: asset.id };
                const assetImpactName = asset.type === '股票' ? `股票 (${asset.name.replace('股票 ', '')})` : asset.name;
                impactList = [`現金 +${formatMoney(Number(price))}`, `${assetImpactName} -${formatMoney(asset.cost)}`];
                expectedEntries = [
                    { category: 'Assets', name: '現金', direction: 'Increase' },
                    { category: 'Assets', name: asset.type === '股票' ? '股票' : asset.name, direction: 'Decrease' }
                ];
                if (asset.cashflow > 0) {
                    const incName = asset.type === '企業' ? '企業收益' : asset.type === '不動產' ? '租金收入' : '理財收入';
                    impactList.push(`${incName} 減少`); expectedEntries.push({ category: 'Income', name: incName, direction: 'Decrease' });
                }
            }
        } else if (mode === 'loan') {
            if (loanSubMode === 'borrow') {
                const amt = Number(borrowAmount);
                if (!amt) { showError("請輸入借貸金額"); return; }
                if (amt > salary * 10) { showError(`上限為 $${(salary * 10).toLocaleString()} H`); return; }
                txData = { name: `申請信用貸款`, amount: amt, cashChange: amt, source: 'loan', usage: 'cash', assetDetails: { type: '股票', cashflow: 0, downPayment: 0, loanAmount: amt, loanInterest: Math.floor(amt * 0.1) } };
                impactList = [`現金 +${formatMoney(amt)}`, `信用貸款 +${formatMoney(amt)}`, `信貸利息 +${formatMoney(Math.floor(amt * 0.1))}`];
                expectedEntries = [{ category: 'Assets', name: '現金', direction: 'Increase' }, { category: 'Liabilities', name: '信用貸款', direction: 'Increase' }, { category: 'Expenses', name: '信貸利息', direction: 'Increase' }];
            } else {
                if (repayType === '信用貸款') {
                    const amt = Number(repayAmount);
                    if (!amt) { showError("請輸入還款金額"); return; }
                    if (amt > cash) { showError("現金不足"); return; }
                    txData = { name: `償還 信用貸款`, amount: amt, cashChange: -amt, source: 'cash', usage: 'liability', liabilityId: 'bank_loan' };
                    impactList = [`現金 -${formatMoney(amt)}`, `信用貸款 -${formatMoney(amt)}`, `信貸利息 減少`];
                    expectedEntries = [{ category: 'Assets', name: '現金', direction: 'Decrease' }, { category: 'Liabilities', name: '信用貸款', direction: 'Decrease' }, { category: 'Expenses', name: '信貸利息', direction: 'Decrease' }];
                } else {
                    const entries = Object.entries(repayInputs).filter(([_, v]) => Number(v) > 0);
                    if (entries.length === 0) { showError("請輸入還款金額"); return; }
                    const [id, amt] = entries[0];
                    const liab = liabilities.find(l => l.id === id); if (!liab) return;
                    txData = { name: `償還 ${liab.name}`, amount: Number(amt), cashChange: -Number(amt), source: 'cash', usage: 'liability', liabilityId: liab.id };
                    const interestLabel = repayType === '不動產貸款' ? '不動產貸款利息' : '企業貸款利息';
                    impactList = [`現金 -${formatMoney(Number(amt))}`, `${liab.name} -${formatMoney(Number(amt))}`, `${interestLabel} 減少`];
                    expectedEntries = [{ category: 'Assets', name: '現金', direction: 'Decrease' }, { category: 'Liabilities', name: liab.name, direction: 'Decrease' }, { category: 'Expenses', name: interestLabel, direction: 'Decrease' }];
                }
            }
        } else if (mode === 'dividend') {
            const entries = Object.entries(divInputs).filter(([_, v]) => Number(v) > 0);
            if (entries.length === 0) { showError("請輸入發放股利的內容"); return; }
            if (divMode === 'cash') {
                const total = entries.reduce((s, [id, v]) => {
                    const a = assets.find(x => x.id === id);
                    return s + (Number(v) * 100 * (a?.quantity || 1));
                }, 0);
                txData = { name: `領取股票現金股利`, amount: total, cashChange: total, source: 'income', usage: 'cash' };
                impactList = [`現金 +${formatMoney(total)}`];
                expectedEntries = [{ category: 'Assets', name: '現金', direction: 'Increase' }];
            } else {
                const items = entries.map(([id, v]) => {
                    const a = assets.find(x => x.id === id);
                    const rate = Number(v);
                    const added = Math.floor((a?.quantity || 0) * rate);
                    return { assetId: id, addedQty: added };
                });
                txData = { name: `領取配股股利`, amount: 0, cashChange: 0, source: 'income', usage: 'stock_update', stockDividendPayload: { items } };
                impactList = [`股票張數 增加`];
                expectedEntries = [{ category: 'Assets', name: '股票', direction: 'Increase' }];
            }
        } else if (mode === 'event') {
            if (eventTab === 'chance') {
                if (eventSubMode === 'pay') {
                    const amt = Number(eventAmount);
                    if (!amt) { showError("請輸入支付金額"); return; }
                    if (amt > cash) { showError("現金不足"); return; }
                    txData = { name: eventPayType === 'medical' ? '支付醫藥費' : eventPayType === 'maintenance' ? '支付飛行器維修費' : eventCustomName || '支付事件', amount: amt, cashChange: -amt, source: 'cash', usage: 'expense' };
                    impactList = [`現金 -${formatMoney(amt)}`];
                    expectedEntries = [{ category: 'Assets', name: '現金', direction: 'Decrease' }];
                } else {
                    const amt = Number(eventAmount);
                    if (!amt || amt <= 0) { showError("請輸入有效的月支出金額"); return; }
                    const isInc = eventSubMode === 'inc_exp';
                    const categoryName = eventExpCategory === 'basicLiving' ? '餐飲、服飾、居住類' : eventExpCategory === 'transportEdu' ? '交通、教育、娛樂類' : '其他、醫療、育兒類';
                    txData = { name: `${isInc ? '增加' : '減少'}月支出：${categoryName}`, amount: amt, cashChange: 0, source: 'income', usage: 'expense_update', expensePayload: { category: eventExpCategory, amount: amt, isIncrease: isInc }, impacts: [`每月${categoryName}支出${isInc ? '增加' : '減少'} ${formatMoney(amt)}`] };
                    impactList = txData.impacts || [];
                    expectedEntries = [{ category: 'Expenses', name: categoryName, direction: isInc ? 'Increase' : 'Decrease' }];
                }
            } else {
                // Happiness Event
                let effectiveSubMode = happinessSubMode;
                
                // If in history mode, determine the real mode based on selected milestone
                if (happinessSubMode === 'history') {
                    const milestones = [
                        { id: 'date', name: '第一次約會', type: 'pay' },
                        { id: 'propose', name: '難忘的求婚', type: 'pay' },
                        { id: 'wedding', name: '浪漫的婚禮', type: 'pay' },
                        { id: 'child1', name: '擁有第一個孩子', type: 'inc_exp' },
                        { id: 'child2', name: '擁有第二個孩子', type: 'inc_exp' }
                    ];
                    const selected = milestones.find(m => m.name === eventCustomName);
                    if (selected) {
                        const isAlreadyCompleted = completedHappinessEvents.includes(selected.id) || 
                                                 happiness.some(h => {
                                                     const mapping: Record<string, string> = {
                                                         'date': 'h_date',
                                                         'propose': 'h_proposal',
                                                         'wedding': 'h_wedding',
                                                         'child1': 'h_child1',
                                                         'child2': 'h_child2'
                                                     };
                                                     return h.id === mapping[selected.id] && h.checked;
                                                 });
                        if (isAlreadyCompleted) {
                            showError("此幸福歷程已達成，不能重複執行");
                            return;
                        }
                        effectiveSubMode = selected.type as any;
                    } else {
                        // Fallback if someone somehow submits without selecting
                        showError("請選擇幸福里程碑");
                        return;
                    }
                }

                if (effectiveSubMode === 'pay') {
                    const amt = Number(eventAmount);
                    if (!amt) { showError("請輸入支付金額"); return; }
                    if (amt > cash) { showError("現金不足"); return; }
                    const name = eventCustomName || '幸福支出';
                    
                    // Check if it's one of the special milestones for points
                    let points = 2;
                    let milestoneId = `custom_pay_${Date.now()}`;
                    if (name === '浪漫的婚禮') { points = 4; milestoneId = 'wedding'; }
                    else if (name === '第一次約會') { milestoneId = 'date'; }
                    else if (name === '難忘的求婚') { milestoneId = 'propose'; }

                    txData = { 
                        name: `幸福支出：${name}`, 
                        amount: amt, 
                        cashChange: -amt, 
                        source: 'cash', 
                        usage: 'happiness_event',
                        happinessEventPayload: {
                            id: milestoneId,
                            name: name,
                            amount: amt,
                            points: points
                        }
                    };
                    impactList = [`現金 -${formatMoney(amt)}`, `幸福點數 +${points} 點`];
                    expectedEntries = [{ category: 'Assets', name: '現金', direction: 'Decrease' }];
                } else {
                    // inc_exp
                    const amt = Number(eventAmount);
                    if (!amt || amt <= 0) { showError("請輸入有效的月支出金額"); return; }
                    const name = eventCustomName || '幸福生活升級';
                    const category = eventExpCategory || 'otherMedicalChild';
                    const categoryName = category === 'basicLiving' ? '餐飲、服飾、居住類' : category === 'transportEdu' ? '交通、教育、娛樂類' : '其他、醫療、育兒類';
                    
                    // Check if it's one of the special milestones for points
                    let points = 2;
                    let milestoneId = `custom_exp_${Date.now()}`;
                    if (name === '擁有第一個孩子') { points = 4; milestoneId = 'child1'; }
                    else if (name === '擁有第二個孩子') { points = 4; milestoneId = 'child2'; }

                    txData = { 
                        name: `幸福生活升級：${name}`, 
                        amount: 0, 
                        cashChange: 0, 
                        source: 'income', 
                        usage: 'happiness_event',
                        happinessEventPayload: {
                            id: milestoneId,
                            name: name,
                            amount: 0,
                            points: points,
                            monthlyExpenseChange: amt,
                            expenseCategory: category
                        }
                    };
                    impactList = [`${categoryName}月支出 +${formatMoney(amt)}`, `幸福點數 +${points} 點`];
                    expectedEntries = [{ category: 'Expenses', name: categoryName, direction: 'Increase' }];
                }
            }
        }

        if (txData) {
            txData.impacts = impactList;
            setPendingTx(txData);
            setCorrectEntries(expectedEntries);
            setPhase(2);
            setUserEntries([]);
        }
    };

    const checkAnswers = () => {
        const isCorrect = correctEntries.length === userEntries.length && correctEntries.every(c => userEntries.some(u => u.category === c.category && u.name === c.name && u.direction === c.direction));
        if (isCorrect) {
            setPhase(3);
        } else {
            let msg = "答案不正確，請依照交易影響重新檢視項目與增減方向";

            // If there are impacts, include them as hints in the alert
            if (pendingTx?.impacts && pendingTx.impacts.length > 0) {
                msg += "\n\n提示：\n" + pendingTx.impacts.map(i => `• ${i}`).join('\n');
            }

            setErrorMessage("答案不正確，請重新檢查項目與增減方向");
            if (onShowAlert) {
                onShowAlert(msg, 'error');
            } else {
                alert(msg);
            }
        }
    };

    const completeTransaction = () => {
        if (pendingTx) {
            onTransaction(pendingTx);
            resetFormStates(); // Add this line to reset form states after transaction is complete
            setPhase(3);
        }
    };

    const toggleEntry = (category: AccountCategory, direction: ChangeDirection, name: string) => {
        setUserEntries(prev => {
            const idx = prev.findIndex(e => e.category === category && e.name === name);
            if (idx !== -1) {
                if (prev[idx].direction === direction) return prev.filter((_, i) => i !== idx);
                const updated = [...prev]; updated[idx] = { ...updated[idx], direction }; return updated;
            }
            return [...prev, { category, name, direction }];
        });
    };

    return {
        phase, setPhase, mode, setMode, assetType, setAssetType,
        stockInputs, setStockInputs, reSelfUse, setReSelfUse, reSymbol, setReSymbol,
        reDownPayment, setReDownPayment, reLoan, setReLoan, reInterest, setReInterest,
        reIncome, setReIncome, reHouseType, setReHouseType,
        bizSymbol, setBizSymbol, bizCost, setBizCost, bizLoan, setBizLoan, bizInterest, setBizInterest, bizIncome, setBizIncome,
        cdAmount, setCdAmount, insType, setInsType, insMedicalQty, setInsMedicalQty,
        insSelectedHouses, setInsSelectedHouses, insAircraftSelected, setInsAircraftSelected,
        showInsAircraftError, setShowInsAircraftError, aircraftCash, setAircraftCash, aircraftLoan, setAircraftLoan,
        sellCat, setSellCat, sellStockDetails, setSellStockDetails, repayInputs, setRepayInputs,
        withdrawAmount, setWithdrawAmount, loanSubMode, setLoanSubMode, repayType, setRepayType,
        borrowAmount, setBorrowAmount, repayAmount, setRepayAmount, divMode, setDivMode, divInputs, setDivInputs,
        eventSubMode, setEventSubMode,
        eventPayType, setEventPayType, eventAmount, setEventAmount,
        eventCustomName, setEventCustomName, eventExpCategory, setEventExpCategory,
        eventTab, setEventTab, happinessSubMode, setHappinessSubMode,
        selectedExpense, setSelectedExpense, expenseAmount, setExpenseAmount, expenseCategorySelect, setExpenseCategorySelect,
        userEntries, setUserEntries, errorMessage, setErrorMessage, pendingTx, correctEntries,
        stockAssets, cdTotal, uninsuredHouses, hasAircraftAsset,
        handlePhase1Submit, checkAnswers, completeTransaction, toggleEntry, formatMoney,
    resetFormStates
    };
};

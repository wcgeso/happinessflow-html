import { GameState } from '../types';

export const createDefaultGameState = (): GameState => ({
    profession: null,
    selectedEnterprise: null,
    selectedDream: null,
    currentRankTitle: '',
    currentRankLevel: 1,
    cash: 0,
    children: 0,
    medicalInsuranceCount: 0,
    assets: [],
    liabilities: [],
    loans: 0,
    isSetup: false,
    selectionStep: null,
    history: [],
    happiness: [],
    happinessTotal: 0,
    marketPrices: {},
    previousMarketPrices: {},
    lastPublishedCode: '',
    abilities: {
        stockAbilityCount: 0,
        realEstateAbilityCount: 0,
        professionAbilityCount: 0,
    },
    completedHappinessEvents: [],
    pendingMedicalClaims: [],
    playerName: '',
    reportName: ''
} as GameState);

export const normalizeGameState = (state: Partial<GameState> | null | undefined): GameState => {
    const defaults = createDefaultGameState();
    const candidate = state && typeof state === 'object' ? state : {};
    const assets = Array.isArray(candidate.assets) ? candidate.assets : defaults.assets;
    const income = candidate.income && typeof candidate.income === 'object' ? candidate.income : {} as GameState['income'];
    const enterprise = candidate.selectedEnterprise;
    const shouldRestoreLegacyEnterprise = !!(
        enterprise &&
        Array.isArray(candidate.happiness) &&
        candidate.happiness.some(item => item.id === 'h_career' && item.checked) &&
        Number(income[enterprise.name]) > 0 &&
        !assets.some(asset => asset.type === '企業' && asset.name.includes(enterprise.name))
    );
    const normalizedIncome = shouldRestoreLegacyEnterprise
        ? Object.fromEntries(Object.entries(income).filter(([key]) => key !== enterprise?.name))
        : income;
    const normalizedAssets = shouldRestoreLegacyEnterprise && enterprise
        ? [...assets, {
            id: `legacy-target-enterprise:${enterprise.id}`,
            name: enterprise.name,
            cost: enterprise.cost,
            downPayment: enterprise.cost,
            cashflow: Number(income[enterprise.name]) || enterprise.income,
            type: '企業' as const,
            isInsured: false
        }]
        : assets;
    return {
        ...defaults,
        ...candidate,
        expenses: candidate.expenses && typeof candidate.expenses === 'object' ? candidate.expenses : {} as GameState['expenses'],
        income: normalizedIncome,
        assets: normalizedAssets,
        liabilities: Array.isArray(candidate.liabilities) ? candidate.liabilities : defaults.liabilities,
        history: Array.isArray(candidate.history) ? candidate.history : defaults.history,
        happiness: Array.isArray(candidate.happiness) ? candidate.happiness : defaults.happiness,
        completedHappinessEvents: Array.isArray(candidate.completedHappinessEvents) ? candidate.completedHappinessEvents : defaults.completedHappinessEvents,
        pendingMedicalClaims: Array.isArray(candidate.pendingMedicalClaims) ? candidate.pendingMedicalClaims : defaults.pendingMedicalClaims,
        appliedBoardFinancialEventIds: Array.isArray(candidate.appliedBoardFinancialEventIds) ? candidate.appliedBoardFinancialEventIds : [],
        marketPrices: candidate.marketPrices && typeof candidate.marketPrices === 'object' ? candidate.marketPrices : defaults.marketPrices,
        previousMarketPrices: candidate.previousMarketPrices && typeof candidate.previousMarketPrices === 'object' ? candidate.previousMarketPrices : defaults.previousMarketPrices,
        abilities: candidate.abilities && typeof candidate.abilities === 'object'
            ? { ...defaults.abilities, ...candidate.abilities }
            : defaults.abilities
    } as GameState;
};

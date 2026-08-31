import { GameState, Transaction } from '../types';

export interface FamilyMilestoneStage {
  cardId: string;
  progressId: string;
  happinessId: string;
  label: string;
  description: string;
  cost: string;
  points: string;
  cashCostAmount?: number;
  monthlyExpenseIncreaseAmount?: number;
  happinessPointsValue: number;
}

export const FAMILY_MILESTONE_STAGES: FamilyMilestoneStage[] = [
  {
    cardId: 'H011',
    progressId: 'date',
    happinessId: 'h_date',
    label: '1. 第一次約會',
    description: '家庭重要歷程起點。安排約會，展開關係經營。',
    cost: '3,000',
    points: '2點',
    cashCostAmount: 3000,
    happinessPointsValue: 2
  },
  {
    cardId: 'H012',
    progressId: 'propose',
    happinessId: 'h_proposal',
    label: '2. 難忘的求婚',
    description: '關係升級階段。表達承諾，進入求婚里程。',
    cost: '5,000',
    points: '2點',
    cashCostAmount: 5000,
    happinessPointsValue: 2
  },
  {
    cardId: 'H013',
    progressId: 'wedding',
    happinessId: 'h_wedding',
    label: '3. 浪漫的婚禮',
    description: '建立家庭的重要儀式。完成婚禮，正式進入家庭生活。',
    cost: '100,000',
    points: '4點',
    cashCostAmount: 100000,
    happinessPointsValue: 4
  },
  {
    cardId: 'H014',
    progressId: 'child1',
    happinessId: 'h_child1',
    label: '4. 擁有第一個孩子',
    description: '迎接第一個孩子，家庭責任與幸福同步提升。',
    cost: '月支出 +10,000',
    points: '4點',
    monthlyExpenseIncreaseAmount: 10000,
    happinessPointsValue: 4
  },
  {
    cardId: 'H015',
    progressId: 'child2',
    happinessId: 'h_child2',
    label: '5. 擁有第二個孩子',
    description: '迎接第二個孩子，家庭規模與月支出再度增加。',
    cost: '月支出 +10,000',
    points: '4點',
    monthlyExpenseIncreaseAmount: 10000,
    happinessPointsValue: 4
  }
];

export const getFamilyMilestoneStatus = (gameState: GameState) => {
  const completedProgressIds = new Set(gameState.completedHappinessEvents || []);
  const checkedHappinessIds = new Set(
    (gameState.happiness || []).filter(item => item.checked).map(item => item.id)
  );

  const stages = FAMILY_MILESTONE_STAGES.map((stage, index) => {
    const completed = completedProgressIds.has(stage.progressId) || checkedHappinessIds.has(stage.happinessId);
    return {
      ...stage,
      index,
      completed
    };
  });

  const completedCount = stages.filter(stage => stage.completed).length;
  const currentStageIndex = stages.findIndex(stage => !stage.completed);
  const currentStage = currentStageIndex === -1 ? FAMILY_MILESTONE_STAGES.length : currentStageIndex + 1;

  const stageLines = stages.flatMap((stage, index) => {
    const statusLabel = stage.completed
      ? '已完成'
      : currentStageIndex === index
        ? '目前階段'
        : '尚未開始';

    return [
      `${stage.label} ${statusLabel}`,
      `花費：${stage.cost}`,
      `幸福值：+${stage.points}`
    ];
  });

  return {
    stages,
    completedCount,
    currentStage,
    currentStageIndex,
    stageLines
  };
};

export const getFamilyMilestoneStageByCardId = (cardId: string) => {
  return FAMILY_MILESTONE_STAGES.find(stage => stage.cardId === cardId) || null;
};

export const getFamilyMilestoneStageByProgressId = (progressId?: string | null) => {
  return progressId
    ? FAMILY_MILESTONE_STAGES.find(stage => stage.progressId === progressId) || null
    : null;
};

export type FamilyMilestoneApplyResult =
  | { status: 'applied'; state: GameState }
  | { status: 'duplicate'; state: GameState }
  | { status: 'insufficient'; state: GameState; shortfall: number };

/** Apply one fixed family stage to the latest persisted player state. */
export const applyFamilyMilestoneStage = (
  state: GameState,
  stage: FamilyMilestoneStage,
  operationId: string,
  timestamp = Date.now()
): FamilyMilestoneApplyResult => {
  if (
    state.appliedBoardFinancialEventIds?.includes(operationId) ||
    (state.completedHappinessEvents || []).includes(stage.progressId) ||
    (state.happiness || []).some(item => item.id === stage.happinessId && item.checked)
  ) {
    return { status: 'duplicate', state };
  }

  const cashCost = stage.cashCostAmount || 0;
  const cash = Number(state.cash) || 0;
  if (cash < cashCost) {
    return { status: 'insufficient', state, shortfall: cashCost - cash };
  }

  const happiness = (state.happiness || []).some(item => item.id === stage.happinessId)
    ? state.happiness.map(item => item.id === stage.happinessId ? { ...item, checked: true } : item)
    : [...(state.happiness || []), {
        id: stage.happinessId,
        label: stage.label.replace(/^\d+\.\s*/, ''),
        points: stage.happinessPointsValue,
        checked: true
      }];
  const cashChange = -cashCost;
  const nextCash = cash + cashChange;
  const transaction: Transaction = {
    id: operationId,
    timestamp,
    name: `幸福支出：${stage.label.replace(/^\d+\.\s*/, '')}`,
    amount: cashCost || (stage.monthlyExpenseIncreaseAmount || 0),
    sourceLabel: cashCost ? '現金' : '收入',
    usageLabel: '幸福事件',
    cashChange,
    balance: nextCash,
    details: JSON.stringify({
      boardEventId: operationId,
      usage: 'happiness_event',
      familyStageProgressId: stage.progressId
    }),
    flowType: '生活'
  };

  const nextState: GameState = {
    ...state,
    cash: nextCash,
    expenses: stage.monthlyExpenseIncreaseAmount
      ? {
          ...state.expenses,
          otherMedicalChild: (state.expenses?.otherMedicalChild || 0) + stage.monthlyExpenseIncreaseAmount
        }
      : state.expenses,
    happiness,
    happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
    completedHappinessEvents: Array.from(new Set([...(state.completedHappinessEvents || []), stage.progressId])),
    appliedBoardFinancialEventIds: [...(state.appliedBoardFinancialEventIds || []), operationId],
    history: [...(state.history || []), transaction]
  };

  return { status: 'applied', state: nextState };
};

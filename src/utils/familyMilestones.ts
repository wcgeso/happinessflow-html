import { GameState } from '../types';

export interface FamilyMilestoneStage {
  cardId: string;
  progressId: string;
  happinessId: string;
  label: string;
  description: string;
  cost: string;
  points: string;
}

export const FAMILY_MILESTONE_STAGES: FamilyMilestoneStage[] = [
  {
    cardId: 'H011',
    progressId: 'date',
    happinessId: 'h_date',
    label: '1. 第一次約會',
    description: '家庭重要歷程起點。安排約會，展開關係經營。',
    cost: '3,000 H',
    points: '2點'
  },
  {
    cardId: 'H012',
    progressId: 'propose',
    happinessId: 'h_proposal',
    label: '2. 難忘的求婚',
    description: '關係升級階段。表達承諾，進入求婚里程。',
    cost: '5,000 H',
    points: '2點'
  },
  {
    cardId: 'H013',
    progressId: 'wedding',
    happinessId: 'h_wedding',
    label: '3. 浪漫的婚禮',
    description: '建立家庭的重要儀式。完成婚禮，正式進入家庭生活。',
    cost: '100,000 H',
    points: '4點'
  },
  {
    cardId: 'H014',
    progressId: 'child1',
    happinessId: 'h_child1',
    label: '4. 擁有第一個孩子',
    description: '迎接第一個孩子，家庭責任與幸福同步提升。',
    cost: '月支出 +10,000 H',
    points: '4點'
  },
  {
    cardId: 'H015',
    progressId: 'child2',
    happinessId: 'h_child2',
    label: '5. 擁有第二個孩子',
    description: '迎接第二個孩子，家庭規模與月支出再度增加。',
    cost: '月支出 +10,000 H',
    points: '4點'
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

import re

with open('src/utils/familyMilestones.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace FAMILY_MILESTONE_STAGES
new_stages = """export interface FamilyMilestoneStage {
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
];"""

content = re.sub(
    r"export interface FamilyMilestoneStage \{.*?\];",
    new_stages,
    content,
    flags=re.DOTALL
)

# Replace stageLines logic
old_stageLines = """  const stageLines = stages.map((stage, index) => {
    const statusLabel = stage.completed
      ? '已完成'
      : currentStageIndex === index
        ? '目前階段'
        : '尚未開始';

    return `${stage.label} ${statusLabel}`;
  });"""

new_stageLines = """  const stageLines = stages.flatMap((stage, index) => {
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
  });"""

content = content.replace(old_stageLines, new_stageLines)

with open('src/utils/familyMilestones.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched familyMilestones.ts")

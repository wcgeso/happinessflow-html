import re

with open('src/utils/boardCardDisplay.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """      effectLines: [
        ...familyMilestoneStatus.stageLines,
        `目前進度：第 ${familyMilestoneStatus.currentStage} 階段`,
        `幸福 +${happinessCard.happinessPoints}`,
        ...(happinessCard.cashCost ? [`一次性支出 ${happinessCard.cashCost.toLocaleString()}`] : []),
        ...(happinessCard.monthlyExpenseIncrease ? [`月支出 ${happinessCard.monthlyExpenseIncrease > 0 ? '+' : ''}${happinessCard.monthlyExpenseIncrease.toLocaleString()}`] : []),
        ...(happinessCard.childrenIncrease ? [`孩子數 +${happinessCard.childrenIncrease}`] : []),
        ...(happinessCard.otherPlayersCanJoin ? [`其他玩家可擲骰加入（至少 ${happinessCard.joinDiceMin || 0} 點）`] : []),
        ...(happinessCard.requiresStorySharing ? ['需要玩家分享故事'] : [])
      ]"""

new_block = """      effectLines: [
        ...familyMilestoneStatus.stageLines,
        `目前進度：第 ${familyMilestoneStatus.currentStage} 階段`,
        ...(happinessCard.otherPlayersCanJoin ? [`其他玩家可擲骰加入（至少 ${happinessCard.joinDiceMin || 0} 點）`] : []),
        ...(happinessCard.requiresStorySharing ? ['需要玩家分享故事'] : [])
      ]"""

content = content.replace(old_block, new_block)

with open('src/utils/boardCardDisplay.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched boardCardDisplay.ts")

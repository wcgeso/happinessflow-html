import re

with open('src/utils/boardCardDisplay.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """    return {
      ...card,
      title: stage?.label.replace(/^\d+\.\s*/, '') || happinessCard.title,
      description: happinessCard.description || '家庭重要歷程事件。',
      effectLines: ["""

new_block = """    return {
      ...card,
      title: stage?.label.replace(/^\d+\.\s*/, '') || happinessCard.title,
      description: happinessCard.description || '家庭重要歷程事件。',
      familyMilestoneStatus,
      effectLines: ["""

content = content.replace(old_block, new_block)

with open('src/utils/boardCardDisplay.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched boardCardDisplay.ts again")

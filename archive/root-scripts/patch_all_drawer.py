import re

# 1. Update boardCardDisplay.ts
with open('src/utils/boardCardDisplay.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace stage?.description with happinessCard.description
content = re.sub(r"description:\s*stage\?\.description\s*\|\|\s*'家庭重要歷程事件。'", "description: happinessCard.description || '家庭重要歷程事件。'", content)

# Remove `代號 ${card.id} ・ ` from any effect lines since we are adding it to subtitle? 
# Wait, user said "代號兼職工作室，這個應該要顯示在上方所有的卡片格式都要一致幫我檢查"
# This means subtitle should be "兼職工作室 N001" etc.
# I already updated RoomContext.tsx for subtitle. Let's do the same in boardCardDisplay.ts if it defines subtitle?
# boardCardDisplay.ts does not define subtitle. It defines assetSymbol.

with open('src/utils/boardCardDisplay.ts', 'w', encoding='utf-8') as f:
    f.write(content)


# 2. Update RoomContext.tsx
with open('src/context/RoomContext.tsx', 'r', encoding='utf-8') as f:
    room_content = f.read()

room_content = re.sub(r"description:\s*isFamilyMilestone\s*\?\s*\(stage\?\.description\s*\|\|\s*'家庭重要歷程事件。'\)\s*:\s*\(card\.description\s*\|\|\s*`\$\{card\.category\}事件`\)", 
                      r"description: card.description || `${card.category}事件`", room_content)

# Make sure all other descriptions are just card.description
# (I already changed buildNewsCardMeta earlier to use card.description)

with open('src/context/RoomContext.tsx', 'w', encoding='utf-8') as f:
    f.write(room_content)


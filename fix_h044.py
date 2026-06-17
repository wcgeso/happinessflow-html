import re

with open('src/constants/cards.ts', 'r', encoding='utf-8') as f:
    content = f.read()

family_milestone = '歷程\\n花費\\n幸福值\\n與心儀的對象第一次約會\\n3,000H\\n2點\\n一個終身難忘的求婚驚喜\\n5,000H\\n2點\\n一場浪漫的結婚典禮\\n100,000H\\n4點\\n第一個孩子出生\\n月支出+10,000H\\n4點\\n第二個孩子出生\\n月支出+10,000H\\n4點\\n抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。\\n其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。'.replace('\\n', '\n')

def replacer(m):
    # m.group(1) is the part before category/happinessPoints
    # We will insert description right after title
    line = m.group(0)
    if 'description:' not in line:
        line = re.sub(r"(title:\s*['\"][^'\"]*['\"])(,?)", r"\1, description: `" + family_milestone + r"`\2", line)
        line = re.sub(r"title:\s*['\"][^'\"]*['\"]", r"title: '幸福家庭的重要歷程'", line)
    return line

# Find the H044 line
content = re.sub(r"\{ id: 'H044'.*?\},", replacer, content, flags=re.DOTALL)

with open('src/constants/cards.ts', 'w', encoding='utf-8') as f:
    f.write(content)


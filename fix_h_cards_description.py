import re

with open('src/constants/cards.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# The regex needs to match the whole block for 幸福家庭的重要歷程 descriptions
pattern = re.compile(r"title:\s*'幸福家庭的重要歷程',\s*description:\s*`歷程.*?第二個孩子出生.*?4點\n(抽到卡片的玩家.*?才能完成一項歷程。)`,", re.DOTALL)

def repl(m):
    desc = m.group(1).replace('\n', '')
    return f"title: '幸福家庭的重要歷程', description: '{desc}',"

new_content = pattern.sub(repl, content)

with open('src/constants/cards.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done")

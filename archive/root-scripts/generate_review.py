import re

with open('src/constants/cards.ts', 'r', encoding='utf-8') as f:
    content = f.read()

parts = content.split("{ id: '")
cards = []

for p in parts[1:]:
    id_match = re.match(r"^([A-Z0-9]+)'", p)
    if not id_match:
        continue
    card_id = id_match.group(1)
    
    if not card_id.startswith(('H', 'C', 'N')):
        continue
        
    title = ""
    title_match = re.search(r"title:\s*'((?:[^'\\]|\\.)*)'", p)
    if title_match:
        title = title_match.group(1).replace("\\'", "'")
        
    desc = ""
    # Match either single quotes or backticks
    desc_match = re.search(r"description:\s*['`](.*?)['`],", p, re.DOTALL)
    if desc_match:
        desc = desc_match.group(1).replace("\\'", "'")
        
    cards.append((card_id, title, desc))

cards.sort(key=lambda x: (x[0][0], int(x[0][1:]) if x[0][1:].isdigit() else 999))

md = ["# 第二人生 - 卡片內容校對總表\n"]
md.append("以下為目前遊戲中 **幸福卡 (H)**、**機會卡 (C)** 與 **新聞卡 (N)** 的最新內容。已經過手動與自動校對，並將「蜂富城」等字眼移除。\n\n")

current_category = ""
for c in cards:
    cat = c[0][0]
    cat_name = {'H': '幸福卡 (Happiness)', 'C': '機會卡 (Opportunity)', 'N': '新聞卡 (News)'}.get(cat, '其他')
    if cat != current_category:
        md.append(f"## {cat_name}\n\n")
        current_category = cat
        
    desc_formatted = c[2].replace('\\n', '<br>').replace('\n', '<br>')
    md.append(f"### 【{c[0]}】 {c[1]}\n")
    if desc_formatted:
        md.append(f"**敘述**：\n> {desc_formatted}\n\n")
    else:
        md.append(f"**敘述**：*(無)*\n\n")

with open('../../card_review_latest.md', 'w', encoding='utf-8') as f:
    f.writelines(md)


import json
import re

with open('card_fixes.json', 'r', encoding='utf-8') as f:
    fixes = json.load(f)

with open('src/constants/cards.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []

for line in lines:
    # Find id: 'XXX'
    m = re.search(r"id:\s*['\"]([HCN]\d{3})['\"]", line)
    if m:
        card_id = m.group(1)
        if card_id in fixes:
            fix = fixes[card_id]
            title = fix['title'].replace("'", "\\'")
            desc = fix['desc'].replace("'", "\\'").replace('\n', '\\n')
            
            if card_id.startswith('H'):
                # update title
                if title:
                    line = re.sub(r"title:\s*['\"][^'\"]*['\"]", f"title: '{title}'", line)
                if desc:
                    # insert description if not present
                    if 'description:' not in line:
                        line = re.sub(r"(title:\s*['\"][^'\"]*['\"])(,?)", r"\1, description: '" + desc + r"'\2", line)
                    else:
                        line = re.sub(r"description:\s*['\"][^'\"]*['\"]", f"description: '{desc}'", line)
            else:
                # N or C cards: update description. Sometimes update title for C cards.
                if card_id.startswith('C') and title:
                    if title != '特殊的事件':
                        line = re.sub(r"title:\s*['\"][^'\"]*['\"]", f"title: '{title}'", line)
                
                if desc:
                    if 'description:' not in line:
                        # insert right after title
                        line = re.sub(r"(title:\s*['\"][^'\"]*['\"])(,?)", r"\1, description: '" + desc + r"'\2", line)
                    else:
                        line = re.sub(r"description:\s*['\"][^'\"]*['\"]", f"description: '{desc}'", line)
    new_lines.append(line)

with open('src/constants/cards.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

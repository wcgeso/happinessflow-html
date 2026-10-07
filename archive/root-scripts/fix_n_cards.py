import re

with open('src/constants/cards.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken string literals for N056, N057, N058
def fix_card(content, card_id):
    pattern = r"(id:\s*'" + card_id + r"'.*?title:\s*'創業貸款',\s*description:\s*)'(最近創業貸款政策推出.*?企業收入。)'"
    
    # We use a replacement function to change the single quotes to backticks and preserve the actual newlines inside
    def replacer(match):
        return match.group(1) + "`" + match.group(2) + "`"
    
    return re.sub(pattern, replacer, content, flags=re.DOTALL)

content = fix_card(content, 'N056')
content = fix_card(content, 'N057')
content = fix_card(content, 'N058')

with open('src/constants/cards.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed syntax")

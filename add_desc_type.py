import re

with open('src/constants/cards.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add description?: string; to interfaces that don't have it
interfaces = [
    'HappinessCard',
    'StockPriceNewsCard',
    'CashDividendNewsCard',
    'StockDividendNewsCard',
    'SmallBusinessNewsCard',
    'LargeEnterpriseNewsCard'
]

for iface in interfaces:
    pattern = r'(export interface ' + iface + r' \{.*?)(^\})'
    # we need to insert description?: string; right before the closing brace
    # use a multi-line regex
    match = re.search(r'export interface ' + iface + r' \{.*?(^\})', content, flags=re.DOTALL | re.MULTILINE)
    if match:
        content = content[:match.end(1) - 1] + '  description?: string;\n' + content[match.end(1) - 1:]

with open('src/constants/cards.ts', 'w', encoding='utf-8') as f:
    f.write(content)

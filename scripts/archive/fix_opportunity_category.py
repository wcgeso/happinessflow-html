import re

with open('src/constants/cards.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Map types to a nice Chinese category
mapping = {
    'investment': '投資理財',
    'purchase_1room': '市場交易',
    'purchase_any_house': '市場交易',
    'purchase_store': '市場交易',
    'purchase_startup': '企業併購',
    'enterprise_acquisition': '企業併購',
    'startup': '創業點子'
}

for t, cat in mapping.items():
    content = re.sub(
        rf"(type:\s*'{t}'\s*,)",
        rf"\1 category: '{cat}',",
        content
    )

with open('src/constants/cards.ts', 'w', encoding='utf-8') as f:
    f.write(content)

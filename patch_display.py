import re

with open('src/utils/boardCardDisplay.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Small Business
content = re.sub(
    r"description: '兼職工作室貸款專案。所有玩家皆可申請。'",
    r"description: newsCard.description || '兼職工作室貸款專案。所有玩家皆可申請。'",
    content
)

# Large Enterprise
content = re.sub(
    r"description: '大型企業投資機會。所有玩家皆可投資。'",
    r"description: newsCard.description || '大型企業投資機會。所有玩家皆可投資。'",
    content
)

# Cash Dividend
content = re.sub(
    r"description: '系統將自動根據您持有的股票發放現金股利。'",
    r"description: newsCard.description || '系統將自動根據您持有的股票發放現金股利。'",
    content
)

# Stock Dividend
content = re.sub(
    r"description: '系統將自動根據您持有的股票發放股票股息。'",
    r"description: newsCard.description || '系統將自動根據您持有的股票發放股票股息。'",
    content
)

with open('src/utils/boardCardDisplay.ts', 'w', encoding='utf-8') as f:
    f.write(content)

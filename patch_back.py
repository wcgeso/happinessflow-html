import re

with open('src/components/game/BoardCardDrawer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# "Happiness Flow" -> "蜂富人生"
content = content.replace("Happiness Flow", "蜂富人生")

# "Tap To Reveal" -> "點擊翻牌"
content = content.replace("Tap To Reveal", "點擊翻牌")

# "Card Draw" -> "抽取"
content = content.replace("Card Draw", "抽取")

# "Reveal Full Card" -> "翻開查看"
content = content.replace("Reveal Full Card", "翻開查看")

with open('src/components/game/BoardCardDrawer.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

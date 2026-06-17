import os
import re

files_to_check = [
    'src/constants/cards.ts',
    'src/utils/boardCardDisplay.ts',
    'src/context/RoomContext.tsx',
    'src/hooks/useGameLogic.ts',
    'src/components/game/BoardCardDrawer.tsx',
    'src/components/business/TransactionForm.tsx',
    'src/components/game/FinancialStatement.tsx'
]

for filepath in files_to_check:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # In template literals or strings:
    # Match digit followed by optional commas, optional space, and H or h
    # Wait, there are literal 'H's like `${card.cashCost.toLocaleString()}H`
    # Replace `}H` or `} H` with `}`
    content = re.sub(r'(\})\s*[Hh](?!\w)', r'\1', content)
    
    # Also replace in normal text (like cards.ts descriptions)
    # Match numbers like 3,000,000H or 300 H or 萬H
    # "萬H" -> "萬"
    content = re.sub(r'([0-9,萬])\s*[Hh](?!\w)', r'\1', content)

    # Also replace `H ` or `H。` in descriptions
    # e.g., 3,000,000H 的價格 -> 3,000,000 的價格
    # The regex above already handles this because it matches the digit/萬 and replaces it.
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
print("Stripped H!")

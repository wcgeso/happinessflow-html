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
    
    # Fix the template literals `}H` or `} H`
    content = re.sub(r'(\})\s*[Hh](?![a-zA-Z])', r'\1', content)
    
    # Fix the text literals
    content = re.sub(r'([0-9,萬])\s*[Hh](?![a-zA-Z])', r'\1', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
print("Stripped H properly!")

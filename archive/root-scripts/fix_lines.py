import re

with open('src/components/game/BoardCardDrawer.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The file got corrupted between lines 68 and 80.
# We need to restore it to:
#                     >
#                         <div
#                             className={`relative mx-auto w-full transition-all duration-700 ${cardHeightClass}`}
#                             style={{
#                                 perspective: '1200px'
#                             }}
#                         >
#                             <div
#                                 className="relative h-full w-full"
#                                 style={{
#                                     transformStyle: 'preserve-3d',

new_lines = []
skip = False
for i, line in enumerate(lines):
    if line.strip() == "onClick={() => !isRevealed && onReveal()}":
        pass
    new_lines.append(line)

with open('src/components/game/BoardCardDrawer.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

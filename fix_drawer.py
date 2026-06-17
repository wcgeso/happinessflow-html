with open('src/components/game/BoardCardDrawer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# find the broken section
broken_pattern = r'                        <div\n\n            <div\n                className={`transform transition-all duration-\[800ms\] cubic-bezier\(0\.2, 0\.8, 0\.2, 1\) \$\{isOpen \? \'translate-y-0 opacity-100\' : \'translate-y-full opacity-0 pointer-events-none\'\}`}\n            >\n                <div className={`mx-auto w-full max-w-sm px-4 pb-8 transition-all duration-\[800ms\] \$\{cardHeightClass\}`}>\n                    <div className="relative h-full w-full">\n                        <div className="group h-full w-full \[perspective:1200px\]">\n                            <div\n                                className="relative h-full w-full cursor-pointer"\n                                onClick=\{\(\) => !isRevealed && onReveal\(\)\}\n                                style=\{\{\n                                    transformStyle: \'preserve-3d\',\n                                    transform: isRevealed \? \'rotateY\(180deg\)\' : \'rotateY\(0deg\)\',\n                                    transition: \'transform 700ms cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)\'\n                                \}\}'

# actually it's easier to just recreate the file from scratch because it's untracked anyway? Wait, I don't have the full original source in memory.

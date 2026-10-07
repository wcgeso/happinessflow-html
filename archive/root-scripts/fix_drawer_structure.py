with open('src/components/game/BoardCardDrawer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# We will just replace everything from `const subtitleLabel = ...` down to the inner card flip structure.
pattern = r"    const subtitleLabel =.*?<div className=\"flex h-full flex-col items-center justify-center p-6\">"

replacement = """    const subtitleLabel = `${card.subtitle || ''} ${card.cardId}`.trim();
    const cardHeightClass = isRevealed ? 'h-[min(72vh,520px)]' : 'h-[min(56vh,320px)]';

    return (
        <div className="fixed inset-x-0 bottom-0 z-[10002]">
            <div className="absolute inset-0 -top-20 bg-gradient-to-t from-slate-950/75 via-slate-950/30 to-transparent pointer-events-none" />
            
            <div className={`transform transition-all duration-[800ms] cubic-bezier(0.2, 0.8, 0.2, 1) ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
                <div className={`mx-auto w-full max-w-sm px-4 pb-8 transition-all duration-[800ms] ${cardHeightClass}`}>
                    <div className="relative h-full w-full">
                        <div className="group h-full w-full [perspective:1200px]">
                            <div
                                className="relative h-full w-full cursor-pointer"
                                onClick={() => !isRevealed && onReveal()}
                                style={{
                                    transformStyle: 'preserve-3d',
                                    transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                    transition: 'transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1)'
                                }}
                            >
                                <div
                                    className={`absolute inset-0 rounded-[28px] border border-white/35 bg-gradient-to-br ${deckMeta.backClass} ${deckMeta.glowClass} overflow-hidden text-slate-950`}
                                    style={{ backfaceVisibility: 'hidden' }}
                                >
                                    <div className="flex h-full flex-col items-center justify-center p-6">"""

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/components/game/BoardCardDrawer.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Structure fixed!")

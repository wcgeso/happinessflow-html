with open('src/components/game/BoardCardDrawer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# We will just replace from `const cardHeightClass = ...` down to the inner card flip structure.
pattern = r"    const cardHeightClass =.*?(?=<div\n                                    className={`absolute inset-0 rounded-\[28px\] border border-white\/35 bg-gradient-to-br)"

replacement = """    // Using a landscape aspect ratio for the card (wide and short)
    const cardHeightClass = isRevealed ? 'h-[min(60vh,380px)]' : 'h-[min(45vh,280px)]';

    return (
        <div className="fixed inset-x-0 bottom-0 z-[10002]">
            <div className="absolute inset-0 -top-20 bg-gradient-to-t from-slate-950/75 via-slate-950/30 to-transparent pointer-events-none" />
            
            <div 
                className={`relative mx-auto w-full max-w-2xl px-3 pb-3 pt-6 sm:px-4 transform transition-all duration-[800ms] cubic-bezier(0.2, 0.8, 0.2, 1) ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
            >
                <div className="rounded-t-[28px] bg-transparent px-1 pb-3 pt-2 sm:px-2">
                    <div className="mb-3 flex justify-center">
                        <div className="h-1.5 w-14 rounded-full bg-slate-700" />
                    </div>

                    <div
                        onClick={isRevealed ? undefined : onReveal}
                        className={`block w-full text-left ${isRevealed ? '' : 'cursor-pointer'}`}
                        role={!isRevealed ? 'button' : undefined}
                        tabIndex={!isRevealed ? 0 : undefined}
                        onKeyDown={!isRevealed ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onReveal();
                            }
                        } : undefined}
                    >
                        <div
                            className={`relative mx-auto w-full transition-all duration-700 ${cardHeightClass}`}
                            style={{
                                perspective: '1200px'
                            }}
                        >
                            <div
                                className="relative h-full w-full"
                                style={{
                                    transformStyle: 'preserve-3d',
                                    transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                    transition: 'transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1)'
                                }}
                            >
                                """

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/components/game/BoardCardDrawer.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Landscape structure fixed!")

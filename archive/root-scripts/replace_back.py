import re

with open('src/components/game/BoardCardDrawer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'<div className="flex h-full items-stretch">.*?(?=</div>\s*</div>\s*<div\s*className="absolute inset-0 overflow-hidden)'
replacement = """<div className="flex h-full flex-col items-center justify-center p-6">
                                        <div className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-slate-950/15 bg-white/40 mb-6 shadow-sm">
                                            {deckMeta.icon}
                                        </div>
                                        <div className="text-3xl font-black tracking-widest text-slate-950 mb-10">{deckMeta.label}</div>
                                        <div className="rounded-full bg-white/30 px-6 py-2.5 text-sm font-black tracking-[0.2em] uppercase shadow-sm border border-white/20">
                                            點擊翻開
                                        </div>
                                    </div>"""

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/components/game/BoardCardDrawer.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Card back simplified!")

import re

with open('src/components/game/BoardCardDrawer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the return block
new_return = """    return (
        <div className="fixed inset-x-0 bottom-0 z-[10002] flex justify-center">
            <div className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-700 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
            
            <div 
                className={`relative w-full max-w-xl mx-auto flex flex-col justify-end transform transition-all duration-[800ms] cubic-bezier(0.2, 0.8, 0.2, 1) ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
            >
                <div className="rounded-t-[32px] bg-slate-900 border-t border-slate-700/50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col max-h-[85vh] sm:max-h-[90vh]">
                    
                    {/* Handle Bar */}
                    <div className="flex-shrink-0 pt-4 pb-2 flex justify-center">
                        <div className="h-1.5 w-16 rounded-full bg-slate-600/60" />
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
                        
                        {/* 1. PHYSICAL CARD */}
                        <div
                            onClick={isRevealed ? undefined : onReveal}
                            className={`relative w-full aspect-[16/10] sm:aspect-[16/9] mx-auto mt-2 transition-all duration-700 ${!isRevealed ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
                            style={{ perspective: '1500px' }}
                            role={!isRevealed ? 'button' : undefined}
                            tabIndex={!isRevealed ? 0 : undefined}
                        >
                            <div
                                className="relative h-full w-full"
                                style={{
                                    transformStyle: 'preserve-3d',
                                    transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                    transition: 'transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1)'
                                }}
                            >
                                {/* Card Back */}
                                <div
                                    className={`absolute inset-0 rounded-[24px] border-2 border-white/10 bg-gradient-to-br ${deckMeta.backClass} ${deckMeta.glowClass} overflow-hidden shadow-xl`}
                                    style={{ backfaceVisibility: 'hidden' }}
                                >
                                    {/* Pinstripe inner border */}
                                    <div className="absolute inset-[8px] rounded-[16px] border-[1.5px] border-white/40" />
                                    {/* Texture Pattern */}
                                    <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at center, #000 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
                                    
                                    <div className="flex h-full flex-col items-center justify-center relative z-10">
                                        <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-white/30 bg-white/20 shadow-lg backdrop-blur-md mb-4 animate-pulse">
                                            <div className="text-white drop-shadow-md scale-125">
                                                {deckMeta.icon}
                                            </div>
                                        </div>
                                        <div className="text-2xl font-black tracking-widest text-slate-900/70 drop-shadow-sm mix-blend-color-burn">{deckMeta.label}</div>
                                    </div>
                                </div>

                                {/* Card Front */}
                                <div
                                    className="absolute inset-0 overflow-hidden rounded-[24px] border border-slate-600 bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-xl"
                                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                >
                                    <div className={`h-2.5 w-full bg-gradient-to-r ${deckMeta.backClass} opacity-90`} />
                                    
                                    <div className="p-5 sm:p-6 flex flex-col h-[calc(100%-10px)] relative">
                                        {/* Faint background watermark */}
                                        <div className="absolute -right-6 -bottom-6 opacity-5 scale-150 pointer-events-none">
                                            {deckMeta.icon}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
                                                <span className="text-slate-300">{deckMeta.icon}</span>
                                                <span>{deckMeta.label}</span>
                                            </div>
                                            <div className="mt-2 text-2xl font-black leading-tight sm:text-3xl text-white drop-shadow-md">{card.title}</div>
                                            {subtitleLabel && (
                                                <div className="mt-3 inline-flex rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-300 shadow-inner">
                                                    {subtitleLabel}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Flavor Text */}
                                        {(() => {
                                            if (!card.description) return null;
                                            const starIndex = card.description.indexOf('*');
                                            const flavor = starIndex === -1 ? card.description.trim() : card.description.substring(0, starIndex).trim();
                                            return flavor ? (
                                                <div className="mt-auto pt-4 text-[13px] leading-relaxed text-slate-300/90 italic relative z-10">
                                                    {flavor}
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. DATA PANEL (Slides down gracefully when revealed) */}
                        <div className={`transition-all duration-700 ease-out overflow-hidden ${isRevealed ? 'max-h-[1000px] opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}`}>
                            <div className="flex flex-col space-y-5 pb-4">
                                {/* Rules Callout */}
                                {(() => {
                                    if (!card.description) return null;
                                    const starIndex = card.description.indexOf('*');
                                    const rules = starIndex === -1 ? '' : card.description.substring(starIndex).replace(/\\*/g, '').trim();
                                    if (!rules) return null;
                                    return (
                                        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-amber-500/5 p-4 shadow-inner">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-amber-400 text-[15px]">💡</span>
                                                <span className="text-xs font-black tracking-widest text-amber-400 uppercase">規則指示</span>
                                            </div>
                                            <div className="text-[13.5px] leading-relaxed text-amber-100/90 whitespace-pre-wrap font-medium">
                                                {rules}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Effect Lines */}
                                {(card.effectLines && card.effectLines.length > 0) && (
                                    <div className="bg-slate-950/50 rounded-2xl p-1 border border-slate-800/60 shadow-inner">
                                        <div className="bg-slate-800/40 rounded-xl px-4 py-1">
                                            {card.effectLines.map((line, index) => {
                                                const parts = line.includes('：') ? line.split('：') : line.split(' ');
                                                
                                                if (parts.length >= 2 && !(line.includes('：') === false && parts.length > 3)) {
                                                    const label = parts[0];
                                                    const value = parts.slice(1).join(line.includes('：') ? '：' : ' ');
                                                    
                                                    let valueColor = 'text-white';
                                                    if (value.includes('+') || label.includes('收入') || label.includes('報酬') || label.includes('幸福')) {
                                                        valueColor = 'text-emerald-400';
                                                    } 
                                                    if (value.includes('-') || label.includes('利息') || label.includes('支出') || label.includes('費用') || label.includes('頭期款') || label.includes('現金 -')) {
                                                        valueColor = 'text-rose-400';
                                                    }
                                                    
                                                    return (
                                                        <div key={`${card.cardId}_${index}`} className="flex items-center justify-between py-3.5 border-b border-slate-700/50 last:border-0">
                                                            <span className="text-[13.5px] font-medium text-slate-400">{label}</span>
                                                            <span className={`text-[15.5px] font-black tracking-wide ${valueColor}`}>{value}</span>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div key={`${card.cardId}_${index}`} className="py-3.5 border-b border-slate-700/50 last:border-0 text-[14px] text-slate-200 font-medium">
                                                        {line}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3. ACTION AREA (Sticky Footer) */}
                    {actionArea && (
                        <div className={`flex-shrink-0 p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md z-10 transition-all duration-700 ${isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
                            {actionArea}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
"""

# Find the 'return (' and replace everything after it
pattern = r"    return \([\s\S]*"
new_content = re.sub(pattern, new_return, content)

with open('src/components/game/BoardCardDrawer.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Replaced successfully")

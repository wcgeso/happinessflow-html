import re

with open('src/components/game/BoardCardDrawer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """                                {/* Effect Lines */}
                                {(card.effectLines && card.effectLines.length > 0) && (() => {
                                    const isStockCard = card.deck === 'news' && card.effectLines.length === 8 && card.effectLines.some(l => l.includes('A10'));"""

new_block = """                                {/* Effect Lines */}
                                {(() => {
                                    if (card.familyMilestoneStatus) {
                                        return (
                                            <div className="flex flex-col gap-2.5">
                                                {card.familyMilestoneStatus.stages.map((stage: any, index: number) => {
                                                    const isCurrent = card.familyMilestoneStatus.currentStageIndex === index;
                                                    const isCompleted = stage.completed;
                                                    
                                                    return (
                                                        <div key={index} className={`relative p-3 rounded-2xl border transition-all ${isCurrent ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : isCompleted ? 'bg-emerald-900/30 border-emerald-800/50 opacity-80' : 'bg-slate-800/40 border-slate-700/50 opacity-60'}`}>
                                                            {isCurrent && (
                                                                <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                                                            )}
                                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`font-black tracking-wider text-[14.5px] ${isCurrent ? 'text-amber-300' : isCompleted ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                                        {stage.label}
                                                                    </span>
                                                                    <span className={`text-[11px] px-1.5 py-0.5 rounded font-black tracking-widest ${isCurrent ? 'bg-amber-500/30 text-amber-200' : isCompleted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                                                                        {isCurrent ? '目前階段' : isCompleted ? '已完成' : '尚未開始'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2.5 text-[13px] font-bold tracking-wide bg-slate-950/40 px-2 py-1 rounded-lg w-fit">
                                                                    <span className="text-slate-400">花費: </span>
                                                                    <span className="text-rose-400">{stage.cost}</span>
                                                                    <span className="text-slate-600">|</span>
                                                                    <span className="text-slate-400">幸福: </span>
                                                                    <span className="text-emerald-400">+{stage.points}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {(card.effectLines && card.effectLines.length > 0) && (
                                                    <div className="mt-2 bg-slate-950/50 rounded-2xl p-1 border border-slate-800/60 shadow-inner">
                                                        <div className="bg-slate-800/40 rounded-xl px-4 py-1">
                                                            {card.effectLines.filter(l => !l.includes('目前進度') && !l.includes('尚未開始') && !l.includes('已完成') && !l.includes('目前階段')).map((line, index) => (
                                                                <div key={index} className="py-3.5 border-b border-slate-700/50 last:border-0 text-[14px] text-slate-200 font-medium">
                                                                    {line}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (!card.effectLines || card.effectLines.length === 0) return null;

                                    const isStockCard = card.deck === 'news' && card.effectLines.length === 8 && card.effectLines.some(l => l.includes('A10'));"""

content = content.replace(old_block, new_block)

with open('src/components/game/BoardCardDrawer.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced successfully")

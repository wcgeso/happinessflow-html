import React from 'react';
import { Sparkles, Newspaper, Heart } from 'lucide-react';
import { BoardCardResult } from '../../types';
import { isForcedBoardCard } from '../../utils/boardCardActions';
import { normalizeCardCopy } from '../../constants/cards';

interface BoardCardDrawerProps {
    card: BoardCardResult;
    isOpen: boolean;
    isRevealed: boolean;
    onReveal: () => void;
    onClose: () => void;
    actionArea?: React.ReactNode;
    closeDisabled?: boolean;
}

const DECK_META: Record<BoardCardResult['deck'], { label: string; icon: React.ReactNode; backClass: string; glowClass: string; }> = {
    happiness: {
        label: '幸福卡',
        icon: <Heart size={18} />,
        backClass: 'from-amber-300 via-yellow-300 to-orange-300',
        glowClass: 'shadow-[0_20px_50px_-25px_rgba(251,191,36,0.75)]'
    },
    news: {
        label: '新聞卡',
        icon: <Newspaper size={18} />,
        backClass: 'from-sky-300 via-cyan-300 to-blue-300',
        glowClass: 'shadow-[0_20px_50px_-25px_rgba(56,189,248,0.75)]'
    },
    opportunity: {
        label: '機運卡',
        icon: <Sparkles size={18} />,
        backClass: 'from-pink-300 via-fuchsia-300 to-violet-300',
        glowClass: 'shadow-[0_20px_50px_-25px_rgba(232,121,249,0.75)]'
    }
};

export const BoardCardDrawer: React.FC<BoardCardDrawerProps> = ({
    card,
    isOpen,
    isRevealed,
    onReveal,
    onClose,
    actionArea,
    closeDisabled = false
}) => {
    if (!isOpen) return null;

    const deckMeta = DECK_META[card.deck];
    const effectiveCloseDisabled = closeDisabled || isForcedBoardCard(card.cardId);
    const subtitleLabel = `${card.subtitle || ''} ${card.cardId}`.trim();
    const familyMilestoneStatus = card.familyMilestoneStatus;
    const isFamilyMilestoneCard =
        card.deck === 'happiness' &&
        card.subtitle === '家庭重要歷程' &&
        !!familyMilestoneStatus?.stages?.length;
    const currentFamilyStage = isFamilyMilestoneCard && familyMilestoneStatus.currentStageIndex >= 0
        ? familyMilestoneStatus.stages[familyMilestoneStatus.currentStageIndex]
        : null;
    const shortPrompt = (() => {
        if (card.deck === 'news') return '請看大地圖確認新聞卡內容，再決定接下來的操作。';
        if (card.deck === 'opportunity') return '請看大地圖確認機運卡內容，再決定是否接受或執行。';
        if (isFamilyMilestoneCard) return '';
        return '請看大地圖確認幸福卡內容，再決定是否執行。';
    })();
    return (
        <div className="fixed inset-x-0 bottom-0 z-[10002] flex justify-center">
            <div
                className={`absolute inset-0 bg-slate-950/60 transition-opacity duration-700 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={effectiveCloseDisabled ? undefined : onClose}
            />
            
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
                                    
                                    <div className={`relative z-10 flex h-full flex-col items-center justify-center transition-opacity duration-150 ${isRevealed ? 'opacity-0' : 'opacity-100'}`}>
                                        <div className="text-2xl font-black tracking-widest text-slate-900/70 drop-shadow-sm mix-blend-color-burn">
                                            {deckMeta.label}
                                        </div>
                                    </div>
                                </div>

                                {/* Card Front */}
                                <div
                                    className="absolute inset-0 overflow-hidden rounded-[24px] border border-slate-600 bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-xl"
                                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                >
                                    <div className={`h-2.5 w-full bg-gradient-to-r ${deckMeta.backClass} opacity-90`} />
                                    
                                    <div className="p-5 sm:p-6 flex flex-col h-[calc(100%-10px)] relative">
                                        <div>
                                            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
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
                                        <div className="mt-auto pt-4 relative z-10">
                                            {isFamilyMilestoneCard ? (
                                                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">
                                                            家庭重要歷程
                                                        </div>
                                                        <div className="rounded-full border border-cyan-400/30 bg-slate-800/80 px-3 py-1 text-[11px] font-black text-cyan-200">
                                                            目前進度：第 {familyMilestoneStatus.currentStage} 階段
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
                                                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">
                                                            目前階段
                                                        </div>
                                                        <div className="mt-2 text-lg font-black leading-tight text-white">
                                                            {currentFamilyStage ? currentFamilyStage.label : '已完成所有階段'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-[13px] font-bold leading-relaxed text-cyan-100">
                                                    {shortPrompt}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
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

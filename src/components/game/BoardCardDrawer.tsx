import React from 'react';
import { Sparkles, Newspaper, Heart } from 'lucide-react';
import { BoardCardResult } from '../../types';
import { isForcedBoardCard } from '../../utils/boardCardActions';
import { toCardPresentationModel } from '../../utils/cardPresentation';

interface BoardCardDrawerProps {
    card: BoardCardResult;
    isOpen: boolean;
    isRevealed: boolean;
    onReveal: () => void;
    onClose: () => void;
    actionArea?: React.ReactNode;
    closeDisabled?: boolean;
}

const DECK_META: Record<BoardCardResult['deck'], { label: string; icon: React.ReactNode; backClass: string; glowClass: string; editorialArt: string; }> = {
    happiness: {
        label: '幸福卡',
        icon: <Heart size={18} />,
        backClass: 'from-amber-300 via-yellow-300 to-orange-300',
        glowClass: 'shadow-[0_20px_50px_-25px_rgba(251,191,36,0.75)]',
        editorialArt: '/assets/projection-cards/happiness-editorial.webp'
    },
    news: {
        label: '新聞卡',
        icon: <Newspaper size={18} />,
        backClass: 'from-sky-300 via-cyan-300 to-blue-300',
        glowClass: 'shadow-[0_20px_50px_-25px_rgba(56,189,248,0.75)]',
        editorialArt: '/assets/projection-cards/news-editorial.webp'
    },
    opportunity: {
        label: '機運卡',
        icon: <Sparkles size={18} />,
        backClass: 'from-pink-300 via-fuchsia-300 to-violet-300',
        glowClass: 'shadow-[0_20px_50px_-25px_rgba(232,121,249,0.75)]',
        editorialArt: '/assets/projection-cards/opportunity-editorial.webp'
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
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    React.useEffect(() => {
        setIsCollapsed(false);
    }, [card.cardId]);

    if (!isOpen) return null;

    const presentation = toCardPresentationModel(card);
    const deckMeta = DECK_META[presentation.deck];
    const effectiveCloseDisabled = closeDisabled || isForcedBoardCard(card.cardId);
    const subtitleLabel = `${presentation.subtitle} ${presentation.cardId}`.trim();
    const familyMilestoneStatus = presentation.familyMilestoneStatus;
    const isFamilyMilestoneCard =
        presentation.deck === 'happiness' &&
        presentation.subtitle === '家庭重要歷程' &&
        !!familyMilestoneStatus?.stages?.length;
    const currentFamilyStage = isFamilyMilestoneCard && familyMilestoneStatus.currentStageIndex >= 0
        ? familyMilestoneStatus.stages[familyMilestoneStatus.currentStageIndex]
        : null;

    if (isCollapsed) {
        return (
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[95] flex justify-center px-4 pb-[calc(6.8rem+env(safe-area-inset-bottom,0px))]">
                <button
                    type="button"
                    onClick={() => setIsCollapsed(false)}
                    aria-label="展開卡片"
                    className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-[#d8c29a] bg-[#fffaf2]/98 px-4 py-2.5 text-sm font-black text-[#2e6570] shadow-[0_12px_30px_-16px_rgba(16,47,56,0.75)] backdrop-blur-md transition hover:bg-[#f3e4cc]"
                >
                    <span>展開卡片</span>
                    <span className="max-w-[min(55vw,18rem)] truncate text-slate-400">{presentation.title}</span>
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-x-0 bottom-0 z-[10002] flex justify-center">
            <div
                className={`absolute inset-0 bg-[#102f38]/72 transition-opacity duration-700 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={effectiveCloseDisabled ? undefined : onClose}
            />
            
            <div 
                className={`relative w-full max-w-xl mx-auto flex flex-col justify-end transform transition-all duration-[800ms] cubic-bezier(0.2, 0.8, 0.2, 1) ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
            >
                <div className="rounded-t-[32px] border-t border-[#d8c29a] bg-[#fffaf2] text-[#293a38] shadow-[0_-18px_48px_-24px_rgba(16,47,56,0.85)] flex flex-col max-h-[85vh] sm:max-h-[90vh]">
                    
                    {/* Handle Bar */}
                    <div className="relative flex-shrink-0 pt-4 pb-2 flex justify-center">
                        <div className="h-1.5 w-16 rounded-full bg-[#d8c29a]" />
                        <button
                            type="button"
                            onClick={() => setIsCollapsed(true)}
                            aria-label="收起卡片"
                            className="absolute right-4 top-2 rounded-full border border-[#d8c29a] bg-[#f4e6d0] px-3 py-1.5 text-[11px] font-black text-[#2e6570] transition hover:bg-[#ead7b8]"
                        >
                            收起卡片
                        </button>
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
                                    className="absolute inset-0 overflow-hidden rounded-[24px] border border-[#d8c29a] bg-[#fffaf2] text-[#293a38] shadow-xl"
                                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                >
                                    <div className={`relative z-10 h-2.5 w-full bg-gradient-to-r ${deckMeta.backClass} opacity-90`} />
                                    <img src={deckMeta.editorialArt} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 h-full w-full object-cover opacity-10" />
                                    <div className="absolute inset-0 bg-gradient-to-b from-[#fffaf2]/78 via-[#fffaf2]/92 to-[#f3e4cc]/98" />
                                    
                                    <div className="relative z-10 flex h-[calc(100%-10px)] flex-col p-5 sm:p-6">
                                        <div>
                                            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-[#a9643a]">
                                                <span>{deckMeta.label}</span>
                                            </div>
                                            <div className="mt-2 break-words text-2xl font-black leading-tight text-[#293a38] sm:text-3xl">{isFamilyMilestoneCard ? '幸福家庭的重要歷程' : card.title}</div>
                                            {subtitleLabel && (
                                                <div className="mt-3 inline-flex rounded-full border border-[#d8c29a] bg-[#f4e6d0] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#2e6570] shadow-inner">
                                                    {subtitleLabel}
                                                </div>
                                            )}
                                            {isFamilyMilestoneCard && (
                                                <div className="mt-4 rounded-2xl border border-[#d8c29a] bg-[#fff2de] px-4 py-3">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a9643a]">
                                                        當前階段
                                                    </div>
                                                    <div className="mt-1 text-lg font-black leading-tight text-[#293a38]">
                                                        {currentFamilyStage ? currentFamilyStage.label : '已完成所有階段'}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-auto pt-4 relative z-10">
                                            <div className="rounded-2xl border border-[#b9d9d0] bg-[#e5f1eb] px-4 py-3 text-center text-[12px] font-bold leading-relaxed text-[#2e6570]">
                                                卡片內容請查看投影幕。
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. ACTION AREA (Sticky Footer) */}
                    {actionArea && (
                        <div className={`player-card-actions z-10 flex-shrink-0 border-t border-[#ead7b8] bg-[#fffaf2]/96 p-4 backdrop-blur-md transition-all duration-700 sm:p-5 ${isRevealed ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0'}`}>
                            {actionArea}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

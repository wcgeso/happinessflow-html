import React, { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Search, X } from 'lucide-react';
import { HAPPINESS_CARDS, NEWS_CARDS, OPPORTUNITY_CARDS } from '../../constants/cards';
import { cn } from '../../utils/gameUtils';

type DeckFilter = 'all' | 'happiness' | 'opportunity' | 'news';

export interface CoachTestCard {
    id: string;
    title: string;
    description: string;
    deck: Exclude<DeckFilter, 'all'>;
}

interface CardTestConsoleProps {
    players: Array<{ uid: string; name: string }>;
    currentTurnUid?: string | null;
    hasBlockingFlow: boolean;
    isSubmitting: boolean;
    onClose: () => void;
    onTrigger: (playerUid: string, card: CoachTestCard) => void;
}

const cards: CoachTestCard[] = [
    ...HAPPINESS_CARDS.map(card => ({ id: card.id, title: card.title, description: card.description || '', deck: 'happiness' as const })),
    ...OPPORTUNITY_CARDS.map(card => ({ id: card.id, title: card.title, description: card.description || '', deck: 'opportunity' as const })),
    ...NEWS_CARDS.map(card => ({ id: card.id, title: card.title, description: card.description || '', deck: 'news' as const }))
];

const deckLabels: Record<DeckFilter, string> = {
    all: `全部 ${cards.length}`,
    happiness: `幸福 ${HAPPINESS_CARDS.length}`,
    opportunity: `機運 ${OPPORTUNITY_CARDS.length}`,
    news: `新聞 ${NEWS_CARDS.length}`
};

const deckStyles: Record<CoachTestCard['deck'], string> = {
    happiness: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    opportunity: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    news: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
};

export const CardTestConsole: React.FC<CardTestConsoleProps> = ({
    players,
    currentTurnUid,
    hasBlockingFlow,
    isSubmitting,
    onClose,
    onTrigger
}) => {
    const [playerUid, setPlayerUid] = useState(currentTurnUid || players[0]?.uid || '');
    const [deck, setDeck] = useState<DeckFilter>('all');
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!players.some(player => player.uid === playerUid)) {
            setPlayerUid(currentTurnUid || players[0]?.uid || '');
        }
    }, [currentTurnUid, playerUid, players]);

    const filteredCards = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return cards.filter(card =>
            (deck === 'all' || card.deck === deck)
            && (!keyword || `${card.id} ${card.title} ${card.description}`.toLowerCase().includes(keyword))
        );
    }, [deck, query]);

    return (
        <div className="fixed inset-0 z-[150] flex flex-col bg-slate-950 text-white">
            <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3 pt-safe md:px-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-violet-500/15 p-2 text-violet-300"><FlaskConical size={20} /></div>
                    <div>
                        <h2 className="font-black">卡片發送</h2>
                        <p className="text-[11px] text-slate-400">直接建立正式卡片流程，不會略過玩家操作</p>
                    </div>
                </div>
                <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="關閉卡片發送">
                    <X size={22} />
                </button>
            </header>

            <div className="shrink-0 space-y-3 border-b border-slate-800 bg-slate-900/70 p-4 md:px-6">
                <div className="grid gap-3 md:grid-cols-[240px_1fr]">
                    <label className="space-y-1 text-xs font-bold text-slate-400">
                        觸發玩家
                        <select value={playerUid} onChange={event => setPlayerUid(event.target.value)} className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-bold text-white">
                            {players.map(player => <option key={player.uid} value={player.uid}>{player.name}{player.uid === currentTurnUid ? '（目前回合）' : ''}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1 text-xs font-bold text-slate-400">
                        搜尋卡號或名稱
                        <span className="relative block">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="例如 H014、創業貸款" className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3 text-sm text-white outline-none focus:border-violet-400" />
                        </span>
                    </label>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {(Object.keys(deckLabels) as DeckFilter[]).map(value => (
                        <button key={value} type="button" onClick={() => setDeck(value)} className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-black', deck === value ? 'border-violet-400 bg-violet-500/20 text-violet-200' : 'border-slate-700 text-slate-400')}>
                            {deckLabels[value]}
                        </button>
                    ))}
                </div>
                {hasBlockingFlow && <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200">目前仍有遊戲流程，請先完成或在「流程」面板點選解除目前事件。</div>}
            </div>

            <main className="min-h-0 flex-1 overflow-y-auto p-4 pb-safe md:p-6">
                <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredCards.map(card => (
                        <article key={card.id} className="flex min-h-36 flex-col rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <span className={cn('inline-flex rounded-full border px-2 py-1 text-[10px] font-black', deckStyles[card.deck])}>{card.id}</span>
                                    <h3 className="mt-2 font-black text-white">{card.title}</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onTrigger(playerUid, card)}
                                    disabled={!playerUid || hasBlockingFlow || isSubmitting}
                                    className="h-10 shrink-0 rounded-xl bg-violet-600 px-3 text-xs font-black text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {isSubmitting ? '處理中' : '觸發'}
                                </button>
                            </div>
                            <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">{card.description || '依卡片規則進行。'}</p>
                        </article>
                    ))}
                </div>
                {filteredCards.length === 0 && <div className="py-16 text-center text-sm text-slate-500">找不到符合條件的卡片</div>}
            </main>
        </div>
    );
};

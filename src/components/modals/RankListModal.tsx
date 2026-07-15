import React from 'react';
import { cn } from '../../utils/gameUtils';
import { PlayerModalFrame } from '../common/PlayerModalFrame';

interface RankListModalProps {
    profession: any;
    currentRankTitle: string;
    onClose: () => void;
    onShowPromotion: () => void;
    onShowLifelong: () => void;
    currentRankLevel: number;
    disabled?: boolean;
}

export const RankListModal: React.FC<RankListModalProps> = ({
    profession,
    currentRankTitle,
    onClose,
    currentRankLevel
}) => {
    if (!profession) return null;

    const ranks = [
        { title: profession.initialRank, bonus: 0, target: null },
        ...(profession.promotions || []).map((promotion: any, index: number) => ({
            title: promotion.rankTitle,
            bonus: promotion.bonus,
            target: index + 2
        }))
    ];

    return (
        <PlayerModalFrame
            eyebrow="職業發展"
            title={profession.title}
            description={`目前職等：${currentRankTitle}`}
            accent="finance"
            onClose={onClose}
        >
            <div className="space-y-3">
                {ranks.map((rank, index) => {
                    const level = index + 1;
                    const isCurrent = currentRankTitle === rank.title;
                    const isUnlocked = currentRankLevel >= level;

                    return (
                        <div
                            key={`${level}-${rank.title}`}
                            className={cn(
                                'rounded-2xl border px-4 py-3 transition-colors',
                                isCurrent
                                    ? 'border-[#5da58e] bg-[#e0f0e5]'
                                    : isUnlocked
                                        ? 'border-[#d8c29a] bg-[#fffaf2]'
                                        : 'border-[#e3d7c5] bg-[#f4e6d0] opacity-60'
                            )}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className={cn('text-sm font-black', isCurrent ? 'text-[#168269]' : 'text-[#293a38]')}>
                                        LV{level} {rank.title}
                                    </div>
                                    {rank.bonus > 0 && (
                                        <div className="mt-1 text-[11px] font-bold text-[#765f47]">
                                            工作收入加成 +{rank.bonus.toLocaleString()}
                                        </div>
                                    )}
                                </div>

                                {isCurrent ? (
                                    <span className="shrink-0 rounded-full bg-[#168269] px-3 py-1 text-[10px] font-black text-white">
                                        目前職等
                                    </span>
                                ) : rank.target ? (
                                    <span className="shrink-0 rounded-full border border-[#d8c29a] bg-[#f4e6d0] px-3 py-1 text-[10px] font-black text-[#8c5b2b]">
                                        骰子 ≥ {rank.target}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </PlayerModalFrame>
    );
};

import React from 'react';
import { Enterprise, Dream, HappinessItem } from '../../types';

const formatMoney = (amount: number) => Math.abs(amount).toLocaleString();

interface GoalAchievementCardProps {
    type: 'enterprise' | 'dream';
    goal: Enterprise | Dream | null;
    happiness: HappinessItem[];
    currentCash: number;
    playerProfessionId?: string;
    currentRankLevel?: number;
}

export const GoalAchievementCard: React.FC<GoalAchievementCardProps> = ({
    type,
    goal,
    happiness,
    currentCash,
    playerProfessionId,
    currentRankLevel = 1
}) => {
    if (!goal) return null;

    const isAchieved = happiness.find(h => h.id === (type === 'enterprise' ? 'h_career' : 'h_dream'))?.checked;
    const label = type === 'enterprise' ? '已達成' : '已實現';
    const accent = type === 'enterprise'
        ? { surface: 'bg-[#e0f0e5]', border: 'border-[#b9d9d0]', text: 'text-[#168269]', badge: 'bg-[#168269]' }
        : { surface: 'bg-[#f4e6d0]', border: 'border-[#d8c29a]', text: 'text-[#a9643a]', badge: 'bg-[#a9643a]' };

    const isRelated = type === 'enterprise' && 'relatedProfessionId' in goal && goal.relatedProfessionId === playerProfessionId;
    const bonusPercent = isRelated ? currentRankLevel * 10 : 0;

    return (
        <div className="space-y-4">
            <div className={`relative overflow-hidden rounded-2xl border p-4 ${accent.surface} ${accent.border}`}>
                {isAchieved && (
                    <div className={`absolute right-0 top-0 rounded-bl-lg px-2 py-1 text-[10px] font-bold text-white ${accent.badge}`}>
                        {label}
                    </div>
                )}
                <div className={`mb-1 pr-14 text-lg font-black ${accent.text}`}>{goal.name}</div>
                <div className="space-y-1 mt-2">
                    <div className="flex justify-between text-xs text-[#765f47]">
                        <span>所需金額</span>
                        <span className="font-mono font-bold text-[#293a38]">{formatMoney(goal.cost)}</span>
                    </div>
                    {type === 'enterprise' && 'income' in goal && (
                        <div className="flex justify-between text-xs text-[#765f47]">
                            <span>預計月收益</span>
                            <div className="text-right">
                                <div className="font-mono font-bold text-[#168269]">+{formatMoney(goal.income + (isRelated ? Math.floor(goal.income * (bonusPercent / 100)) : 0))}</div>
                                {isRelated && <div className="text-[9px] text-[#36798a]">含職業加成 {bonusPercent}%</div>}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-between text-xs text-[#765f47]">
                        <span>達成獎勵</span>
                        <span className="font-bold text-[#b94f73]">+{goal.happyPoints} 幸福點數</span>
                    </div>
                    {type === 'enterprise' && 'relatedProfessionId' in (goal as any) && (
                        <div className="mt-2 flex items-center justify-between border-t border-[#d8c29a]/70 pt-2 text-xs text-[#765f47]">
                            <span>職業加成</span>
                            <div className="text-right flex flex-col items-end">
                                <span className={`rounded px-2 py-0.5 font-bold leading-none ${isRelated ? 'bg-[#d8e9e5] text-[#36798a]' : 'bg-[#ead7b8] text-[#7a6958]'}`}>
                                    {isRelated ? `${bonusPercent}%` : '---'}
                                </span>
                                <span className="mt-0.5 text-[9px] text-[#7a6958]">10%~50%（依職等計算）</span>
                            </div>
                        </div>
                    )}
                </div>
                {type === 'dream' && 'description' in goal && goal.description && (
                    <div className="mt-2 border-t border-[#d8c29a]/70 pt-2 text-[10px] italic text-[#7a6958]">{goal.description}</div>
                )}
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-[#d8c29a] bg-[#fffaf2] p-4">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-[#765f47]">目前持有現金</span>
                    <span className="font-bold text-[#168269]">{formatMoney(currentCash)}</span>
                </div>
                <div className="mt-2 text-center text-[10px] text-[#7a6958]">
                    點擊下方確認將支付全額並{type === 'enterprise' ? '完成事業成就' : '實現您的人生夢想'}
                </div>
            </div>
        </div>
    );
};

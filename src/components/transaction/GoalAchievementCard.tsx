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
    const colorClass = type === 'enterprise' ? 'emerald' : 'purple';
    const label = type === 'enterprise' ? '已達成' : '已實現';

    const isRelated = type === 'enterprise' && 'relatedProfessionId' in goal && goal.relatedProfessionId === playerProfessionId;
    const bonusPercent = isRelated ? currentRankLevel * 10 : 0;

    return (
        <div className="space-y-4">
            <div className={`p-4 bg-${colorClass}-900/20 border border-${colorClass}-500/30 rounded-lg relative overflow-hidden`}>
                {isAchieved && (
                    <div className={`absolute top-0 right-0 bg-${colorClass}-600 text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold`}>
                        {label}
                    </div>
                )}
                <div className={`text-${colorClass}-400 font-bold text-lg mb-1`}>{goal.name}</div>
                <div className="space-y-1 mt-2">
                    <div className="text-xs text-slate-400 flex justify-between">
                        <span>所需金額:</span>
                        <span className="text-white font-mono">{formatMoney(goal.cost)}</span>
                    </div>
                    {type === 'enterprise' && 'income' in goal && (
                        <div className="text-xs text-slate-400 flex justify-between">
                            <span>預計月收益:</span>
                            <div className="text-right">
                                <div className="text-emerald-400 font-mono">+{formatMoney(goal.income + (isRelated ? Math.floor(goal.income * (bonusPercent / 100)) : 0))}</div>
                                {isRelated && <div className="text-[9px] text-blue-400/80">(含職業加成 {bonusPercent}%)</div>}
                            </div>
                        </div>
                    )}
                    <div className="text-xs text-slate-400 flex justify-between">
                        <span>達成獎勵:</span>
                        <span className="text-amber-400 font-bold">+{goal.happyPoints} 幸福點數</span>
                    </div>
                    {type === 'enterprise' && 'relatedProfessionId' in (goal as any) && (
                        <div className="text-xs text-slate-400 flex justify-between items-center border-t border-slate-700/30 pt-1 mt-1">
                            <span>職業加成:</span>
                            <div className="text-right flex flex-col items-end">
                                <span className={`font-bold px-2 py-0.5 rounded leading-none ${isRelated ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 bg-slate-500/10'}`}>
                                    {isRelated ? `${bonusPercent}%` : '---'}
                                </span>
                                <span className="text-[9px] text-slate-500 mt-0.5">10%~50% (依職等計算)</span>
                            </div>
                        </div>
                    )}
                </div>
                {type === 'dream' && 'description' in goal && goal.description && (
                    <div className="text-[10px] text-slate-500 mt-2 italic border-t border-slate-700/50 pt-2">{goal.description}</div>
                )}
            </div>

            <div className="bg-slate-900 p-4 rounded-lg flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">目前持有現金</span>
                    <span className="text-emerald-400 font-bold">{formatMoney(currentCash)}</span>
                </div>
                <div className="text-[10px] text-slate-500 text-center mt-2 italic">
                    ※ 點擊下方確認將支付全額並{type === 'enterprise' ? '完成事業成就' : '實現您的人生夢想'}
                </div>
            </div>
        </div>
    );
};

import React from 'react';
import { AssetType, HappinessItem } from '../../types';

interface AssetTypeSelectorProps {
    assetTypes: AssetType[];
    currentType: AssetType;
    onTypeChange: (type: AssetType) => void;
    happiness: HappinessItem[];
    cols?: number;
}

export const AssetTypeSelector: React.FC<AssetTypeSelectorProps> = ({
    assetTypes,
    currentType,
    onTypeChange,
    happiness,
    cols = 3
}) => {
    return (
        <div className={`grid gap-2 ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {assetTypes.map((t) => {
                const isSelected = currentType === t;
                const isAchieved =
                    (t === '目標企業' && happiness.find((h) => h.id === 'h_career')?.checked) ||
                    (t === '心儀夢想' && happiness.find((h) => h.id === 'h_dream')?.checked);

                return (
                    <button
                        key={t}
                        onClick={() => onTypeChange(t as any)}
                        className={`py-2 rounded-lg border text-[11px] font-bold transition-all ${isSelected
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                            } ${isAchieved ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                        disabled={isAchieved}
                    >
                        {t}
                    </button>
                );
            })}
        </div>
    );
};

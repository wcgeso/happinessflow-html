import React from 'react';
import { HappinessPanel } from '../business/HappinessPanel';
import { PlayerModalFrame } from '../common/PlayerModalFrame';

interface HappinessListModalProps {
    items: any[];
    total: number;
    onToggle: (id: string) => void;
    onAdd: (name: string, points: number) => void;
    onRemove: (id: string) => void;
    onClose: () => void;
    disabled?: boolean;
}

export const HappinessListModal: React.FC<HappinessListModalProps> = ({
    items,
    total,
    onToggle,
    onAdd,
    onRemove,
    onClose,
    disabled = false
}) => {
    return (
        <PlayerModalFrame
            eyebrow="玩家狀態"
            title="幸福指數清單"
            description={`目前 ${total} 點，達成 100 點即可獲得勝利`}
            accent="happiness"
            onClose={onClose}
        >
            <div className="min-h-[22rem] overflow-hidden rounded-2xl">
                <HappinessPanel
                    items={items}
                    total={total}
                    onToggle={onToggle}
                    onAddCustomItem={onAdd}
                    onRemoveCustomItem={onRemove}
                    disabled={disabled}
                />
            </div>
        </PlayerModalFrame>
    );
};

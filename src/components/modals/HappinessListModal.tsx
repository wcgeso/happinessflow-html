import React from 'react';
import { Heart, Bell } from 'lucide-react';
import { Button } from '../ui/ui';
import { HappinessPanel } from '../business/HappinessPanel';

interface HappinessListModalProps {
    items: any[];
    total: number;
    onToggle: (id: string) => void;
    onAdd: (name: string, points: number) => void;
    onRemove: (id: string) => void;
    onClose: () => void;
}

export const HappinessListModal: React.FC<HappinessListModalProps> = ({
    items,
    total,
    onToggle,
    onAdd,
    onRemove,
    onClose
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-md bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="p-3 bg-slate-800 flex justify-between items-center border-b border-slate-700 shrink-0">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Heart className="text-pink-400 fill-pink-400" size={18} />
                        幸福指數清單
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <Bell size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <HappinessPanel
                        items={items}
                        total={total}
                        onToggle={onToggle}
                        onAddCustomItem={onAdd}
                        onRemoveCustomItem={onRemove}
                    />
                </div>
                <div className="p-3 bg-slate-800 border-t border-slate-700 text-center shrink-0">
                    <p className="text-xs text-slate-400 mb-2">達成 100 點即可獲得勝利</p>
                    <Button variant="secondary" onClick={onClose} className="w-full">關閉</Button>
                </div>
            </div>
        </div>
    );
};

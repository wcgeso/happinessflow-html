import React from 'react';
import { Bug, Plane, Stethoscope, Palette, TreePine, Briefcase } from 'lucide-react';
import { Button } from '../ui/ui';

interface AvatarOption {
    id: string;
    name: string;
    icon: React.ReactNode;
}

interface AvatarModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAvatar: string;
    onSelectAvatar: (avatarId: string) => void;
}

const avatarOptions: AvatarOption[] = [
    { id: 'bee', name: '小蜜蜂', icon: <Bug size={24} className="text-yellow-400" /> },
    { id: 'pilot', name: '飛行員', icon: <Plane size={24} className="text-blue-400" /> },
    { id: 'doctor', name: '醫生', icon: <Stethoscope size={24} className="text-red-400" /> },
    { id: 'artist', name: '藝術家', icon: <Palette size={24} className="text-pink-400" /> },
    { id: 'farmer', name: '農夫', icon: <TreePine size={24} className="text-green-400" /> },
    { id: 'business', name: '商人', icon: <Briefcase size={24} className="text-purple-400" /> },
];

export const AvatarModal: React.FC<AvatarModalProps> = ({
    isOpen,
    onClose,
    selectedAvatar,
    onSelectAvatar
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl p-6"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-xl font-bold text-white mb-6 text-center">選擇頭像</h3>
                <div className="grid grid-cols-3 gap-4">
                    {avatarOptions.map((avatar) => (
                        <div
                            key={avatar.id}
                            className={`flex flex-col items-center p-3 rounded-xl cursor-pointer transition-colors ${selectedAvatar === avatar.id
                                    ? 'bg-yellow-500/20 border-2 border-yellow-500'
                                    : 'bg-slate-800/50 border border-slate-700 hover:bg-slate-800/80'
                                }`}
                            onClick={() => {
                                onSelectAvatar(avatar.id);
                                onClose();
                            }}
                        >
                            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-2">
                                {avatar.icon}
                            </div>
                            <span className="text-sm text-white">{avatar.name}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex justify-center">
                    <Button
                        variant="secondary"
                        className="px-6"
                        onClick={onClose}
                    >
                        關閉
                    </Button>
                </div>
            </div>
        </div>
    );
};

export { avatarOptions };
export type { AvatarOption };

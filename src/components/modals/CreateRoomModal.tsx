import React, { useState } from 'react';
import { X, Users, Clock, Gamepad2, Calendar } from 'lucide-react';
import { Button } from '../ui/ui';

interface CreateRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (settings: { name: string; maxPlayers: number; duration: number }) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose, onCreate }) => {
    const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    const [name, setName] = useState(`遊戲-${today}`);
    const [maxPlayers, setMaxPlayers] = useState(6);
    const [duration, setDuration] = useState(1);

    const durations = [
        { label: '1 小時', value: 1 },
        { label: '1.5 小時', value: 1.5 },
        { label: '2 小時', value: 2 },
        { label: '2.5 小時', value: 2.5 },
        { label: '3 小時', value: 3 },
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                {/* Background Decor */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <div className="text-[10px] text-amber-500 font-black uppercase tracking-[0.2em] mb-1">New Game</div>
                            <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                建立新遊戲
                                <Gamepad2 size={24} className="text-amber-500" />
                            </h2>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 text-slate-500 hover:text-white transition-colors hover:bg-slate-800 rounded-xl"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Game Name */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Calendar size={14} />
                                遊戲名稱
                            </label>
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white font-bold focus:border-amber-500/50 outline-none transition-all"
                                placeholder="輸入遊戲名稱..."
                            />
                        </div>

                        {/* Player Count */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Users size={14} />
                                遊玩人數 (1-6人)
                            </label>
                            <div className="flex items-center gap-3">
                                {[1, 2, 3, 4, 5, 6].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => setMaxPlayers(num)}
                                        className={`flex-1 py-3 rounded-xl font-black transition-all ${
                                            maxPlayers === num 
                                            ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105' 
                                            : 'bg-slate-950 text-slate-500 border border-slate-800 hover:border-slate-700'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Duration */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Clock size={14} />
                                遊玩時間
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {durations.map((d) => (
                                    <button
                                        key={d.value}
                                        onClick={() => setDuration(d.value)}
                                        className={`py-3 rounded-xl font-black text-xs transition-all ${
                                            duration === d.value 
                                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105' 
                                            : 'bg-slate-950 text-slate-500 border border-slate-800 hover:border-slate-700'
                                        }`}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Button 
                            onClick={() => onCreate({ name, maxPlayers, duration })}
                            className="w-full py-6 mt-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-lg rounded-2xl shadow-xl shadow-amber-500/20 active:scale-[0.98] transition-all"
                        >
                            確認建立
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

import React from 'react';
import { useGame } from '../../context/GameContext';
import { useRoom } from '../../context/RoomContext';
import { Card } from '../../components/ui/ui';
import { Trophy, X, List, LogOut } from 'lucide-react';

interface ScoreViewProps {
    playerName: string;
    onClose: () => void;
}

export const ScoreView: React.FC<ScoreViewProps> = ({ playerName, onClose }) => {
    const { scoreResult } = useGame();
    const { leaveRoom } = useRoom();
    const [showConfirm, setShowConfirm] = React.useState(false);
    const [isLeaving, setIsLeaving] = React.useState(false);

    const handleLeaveRoom = async () => {
        setIsLeaving(true);
        try {
            await leaveRoom();
            onClose();
        } catch (err) {
            console.error('離開房間失敗:', err);
            alert('離開房間失敗，請稍後再試');
        } finally {
            setIsLeaving(false);
            setShowConfirm(false);
        }
    };

    return (
        <div className="h-[100dvh] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden touch-none relative">
            {/* Custom Confirm Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-xs rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-4">
                            <div className="mx-auto w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500">
                                <LogOut size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">確定要離開？</h3>
                                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                                    離開後將回到大廳，且不會記錄本次遊戲積分。此操作無法撤銷。
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 pt-2">
                                <button
                                    disabled={isLeaving}
                                    onClick={handleLeaveRoom}
                                    className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-700 text-white font-black rounded-xl transition-all active:scale-95"
                                >
                                    {isLeaving ? '正在離開...' : '確認離開'}
                                </button>
                                <button
                                    disabled={isLeaving}
                                    onClick={() => setShowConfirm(false)}
                                    className="w-full py-3 text-slate-500 hover:text-white font-bold text-sm transition-colors"
                                >
                                    取消
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-lg w-full h-full flex flex-col py-4 overflow-hidden no-scrollbar">
                <Card className="bg-slate-900 border-slate-500 shadow-2xl shadow-slate-500/10 flex flex-col overflow-hidden animate-in zoom-in-95 no-scrollbar relative">
                    {/* Close Button at Top Right */}
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-full transition-all z-10"
                    >
                        <X size={24} />
                    </button>

                    <div className="shrink-0 p-6 bg-slate-800/40 border-b border-slate-500/30 text-center">
                        <Trophy size={40} className="mx-auto text-yellow-400 mb-2" />
                        <h2 className="text-2xl font-black text-white">遊戲評分</h2>
                        <p className="text-amber-400 font-mono text-xs mt-1">玩家: {playerName}</p>
                        <p className="text-slate-500 text-[10px] mt-2 italic">※ 遊戲紀錄將由執行師統一確認存檔</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none no-scrollbar">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                                <List size={14} className="text-amber-400" /> 積分細項
                            </h3>
                            <div className="space-y-2">
                                {scoreResult.details.map((detail, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs py-3 border-b border-slate-700/50 last:border-0 text-slate-300">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/40" />
                                            {detail.label}
                                        </div>
                                        <span className="font-bold text-amber-400">+{detail.points}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Leave Room Button */}
                        <div className="pt-2">
                            <button
                                onClick={() => setShowConfirm(true)}
                                className="w-full flex items-center justify-center gap-2 py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-2xl font-black transition-all active:scale-95"
                            >
                                <LogOut size={18} />
                                離開房間
                            </button>
                            <p className="text-center text-[10px] text-slate-500 mt-3">
                                點擊離開將直接返回大廳，不會計算個人積分
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

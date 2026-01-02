import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Users, Copy, Check, Play, LogOut, ShieldCheck, Award } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { useAuth, getUserTitle, getAvatarBorderStyle, getCoachBadge, getPlayerBadge } from '../../context/AuthContext';
import { Button } from '../../components/ui/ui';

interface RoomViewProps {
    onBack: () => void;
}

export const RoomView: React.FC<RoomViewProps> = ({ onBack }) => {
    const { room, createRoom, leaveRoom, closeRoom, startRoomGame, isLoadingRoom, error } = useRoom();
    const { user } = useAuth();
    const [copied, setCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showRoomInfo, setShowRoomInfo] = useState(false);

    const coachMember = room?.members.find(m => m.role === 'coach');
    const playerMembers = room?.members.filter(m => m.role === 'player') || [];
    const displayCoach = coachMember;

    const handleCloseOrLeave = () => {
        setShowConfirm(true);
    };

    const confirmCloseOrLeave = async () => {
        // 先執行關閉/離開動作，但不等待它完成才切換 UI
        const action = isHost ? closeRoom() : leaveRoom();
        onBack();
        await action;
    };

    if (!room) return null;

    const roomLink = `${window.location.origin}?room=${room.id}`;

    const handleCopyCode = () => {
        if (!room.id) return;
        navigator.clipboard.writeText(room.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyLink = () => {
        if (!room.id) return;
        navigator.clipboard.writeText(roomLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    const isHost = user?.uid === room.hostId;

    return (
        <div className="flex-1 flex flex-col p-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="text-[10px] text-amber-500 font-black uppercase tracking-[0.2em] mb-1">Room Status</div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                        等待玩家加入
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowRoomInfo(true)}
                        className="flex flex-col items-center px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl hover:bg-amber-500/20 transition-all group"
                    >
                        <span className="text-[9px] text-amber-500 font-black uppercase tracking-widest mb-0.5">房間碼</span>
                        <span className="text-lg font-black text-white group-hover:scale-105 transition-transform">{room.id}</span>
                    </button>
                    <button 
                        onClick={handleCloseOrLeave}
                        className="p-3 bg-slate-900/50 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-2xl transition-all border border-slate-800"
                    >
                        {isHost ? <X size={20} /> : <LogOut size={20} />}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                {/* Member List - Now taking more space */}
                <div className="flex flex-col gap-4 flex-1 min-h-0">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <Users size={18} className="text-slate-500" />
                            <span className="text-sm font-black text-white uppercase tracking-widest">已加入成員</span>
                        </div>
                        {isHost && playerMembers.length === room.maxPlayers ? (
                            <button 
                                onClick={startRoomGame}
                                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 text-white text-xs font-black rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:bg-emerald-400 transition-all animate-pulse active:scale-95 border border-emerald-400/50"
                            >
                                <Play size={14} className="fill-current" />
                                開始遊戲
                            </button>
                        ) : (
                            <span className="text-xs font-black text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                                {playerMembers.length} / {room.maxPlayers} 玩家
                            </span>
                        )}
                    </div>

                    <div className="flex-1 bg-slate-900/30 border border-slate-800/50 rounded-3xl p-2 flex flex-col gap-2 overflow-hidden">
                        {/* Coach Section - Fixed size at top */}
                        <div className="shrink-0 flex flex-col items-center justify-center">
                            {displayCoach && (
                                <div 
                                    className={`flex flex-row items-center gap-3 p-1.5 px-3 rounded-xl border transition-all relative w-full max-w-sm ${
                                        displayCoach.uid === room.hostId 
                                        ? 'bg-gradient-to-r from-amber-500/10 to-amber-900/10 border-amber-500/30 shadow-md' 
                                        : 'bg-slate-900/80 border-slate-700'
                                    }`}
                                >
                                    <div className={`w-16 h-16 rounded-lg bg-slate-800 border-2 flex items-center justify-center text-3xl shadow-inner shrink-0 ${
                                         displayCoach.uid === room.hostId ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]' : 'border-slate-700'
                                     }`}>
                                        {displayCoach.photoURL?.startsWith('http') || displayCoach.photoURL?.startsWith('data:image') ? (
                                            <img src={displayCoach.photoURL} className="w-full h-full object-cover rounded-lg" alt="" />
                                        ) : '🐝'}
                                    </div>

                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-base font-black text-white truncate">{displayCoach.name}</span>
                                            {displayCoach.uid === user?.uid && (
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <img 
                                                src={getCoachBadge(displayCoach as any)} 
                                                className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0" 
                                                alt={getUserTitle(displayCoach as any)}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                            <span className="text-xs font-black text-amber-500 uppercase tracking-widest whitespace-nowrap bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/10">
                                                {getUserTitle(displayCoach as any)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Players Section - Filling all remaining space */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1 text-center">參與玩家</div>
                            <div className="flex-1 grid grid-cols-2 grid-rows-3 gap-1.5 w-full">
                                {playerMembers.map((member) => (
                                    <div 
                                        key={member.uid}
                                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all relative h-full ${
                                            member.uid === user?.uid 
                                            ? 'bg-amber-500/5 border-amber-500/20 shadow-sm' 
                                            : 'bg-slate-900/50 border-slate-800/50'
                                        }`}
                                    >
                                        {/* Avatar with badge overlay - Enlarged */}
                                        <div className="relative shrink-0 mb-2">
                                            <div className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-3xl shadow-inner">
                                                {member.photoURL?.startsWith('http') || member.photoURL?.startsWith('data:image') ? (
                                                    <img src={member.photoURL} className="w-full h-full object-cover rounded-xl" alt="" />
                                                ) : '🐝'}
                                            </div>
                                            
                                            <div className="absolute -bottom-1.5 -right-1.5">
                                                <img 
                                                    src={getPlayerBadge(member as any)} 
                                                    className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                                                    alt=""
                                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                                />
                                            </div>

                                            {member.uid === user?.uid && (
                                                <div className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] border-2 border-slate-900 z-10" />
                                            )}
                                        </div>

                                        {/* Info Below Avatar - Enlarged */}
                                        <div className="flex flex-col items-center min-w-0 text-center w-full px-1">
                                            <span className="text-sm font-black text-white truncate w-full mb-1">
                                                {member.name}
                                            </span>
                                            <span className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest truncate">
                                                {getUserTitle(member as any)}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {Array.from({ length: room.maxPlayers - playerMembers.length }).map((_, i) => (
                                    <div 
                                        key={`empty-${i}`}
                                        className="flex flex-col items-center justify-center p-2 rounded-xl border border-dashed border-slate-800/30 opacity-20 h-full"
                                    >
                                        <div className="w-16 h-16 rounded-xl bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-slate-700 mb-2">
                                            <Users size={24} />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">等待加入</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Action Removed as per request */}
            </div>
            
            {error && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-medium text-center animate-in slide-in-from-bottom-2">
                    {error}
                </div>
            )}

            {/* Room Info Modal */}
            {showRoomInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowRoomInfo(false)} />
                    <div className="relative bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => setShowRoomInfo(false)}
                            className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                        
                        <div className="flex flex-col items-center text-center">
                            <div className="text-xs text-slate-500 font-black uppercase tracking-widest mb-4">房間資訊</div>
                            
                            <div className="mb-8">
                                <div className="text-6xl font-black text-white tracking-[0.2em]">
                                    {room.id}
                                </div>
                            </div>

                            <div className="p-4 bg-white rounded-2xl shadow-2xl mb-6">
                                <QRCodeSVG 
                                    value={roomLink} 
                                    size={180}
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>
                            
                            <div className="w-full">
                                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 text-left px-2">房間連結</div>
                                <div 
                                    onClick={handleCopyLink}
                                    className="group flex items-center gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-amber-500/50 transition-all cursor-pointer"
                                >
                                    <div className="flex-1 truncate text-xs text-slate-400 font-medium text-left">
                                        {roomLink}
                                    </div>
                                    <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase transition-all shrink-0 ${linkCopied ? 'text-emerald-500' : 'text-slate-600 group-hover:text-amber-500'}`}>
                                        {linkCopied ? <Check size={12} /> : <Copy size={12} />}
                                        {linkCopied ? '已複製' : '複製'}
                                    </div>
                                </div>
                            </div>

                            <p className="mt-6 text-[10px] text-slate-500 font-medium uppercase tracking-wider">透過 QR Code 或房間連結邀請玩家</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
                    <div className="relative bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                            <X size={32} className="text-red-500" />
                        </div>
                        <h3 className="text-xl font-black text-white text-center mb-8">
                            {isHost ? '確定要關閉房間嗎？' : '確定要離開房間嗎？'}
                        </h3>
                        <div className="flex flex-col gap-3">
                            <Button 
                                onClick={confirmCloseOrLeave}
                                className="w-full py-4 bg-red-500 hover:bg-red-400 text-white font-black rounded-xl shadow-lg shadow-red-500/20"
                            >
                                {isHost ? '確認關閉' : '確認離開'}
                            </Button>
                            <button 
                                onClick={() => setShowConfirm(false)}
                                className="w-full py-4 text-slate-500 hover:text-white font-bold transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

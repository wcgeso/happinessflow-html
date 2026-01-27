import React, { useState } from 'react';
import { X, Users, Copy, Play, LogOut, RefreshCw, User as UserIcon } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { ProfileModal } from '../../components/modals/ProfileModal';
import { useAuth, getUserTitle, getAvatarBorderStyle, getCoachBadge, getPlayerBadge, getTitleColor, getBadgeGlowStyle } from '../../context/AuthContext';
import { Button } from '../../components/ui/ui';
import { cn } from '../../utils/gameUtils';
import SafeImage from '../../components/common/SafeImage';

interface RoomViewProps {
    onBack: () => void;
    viewMode?: 'player' | 'coach' | 'gm';
}

export const RoomView: React.FC<RoomViewProps> = ({ onBack, viewMode }) => {
    const { room, leaveRoom, closeRoom, startRoomGame, error } = useRoom();
    const { user } = useAuth();
    const [copied, setCopied] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const isHost = user?.uid === room?.hostId || (!room && localStorage.getItem('hf_dev_mode') === 'true');

    if (!room) {
        // 如果是開發者模式，顯示 Mock 數據避免空白畫面
        if (localStorage.getItem('hf_dev_mode') === 'true') {
            const mockRoom = {
                id: '888888',
                name: '開發者測試房間',
                hostId: user?.uid || 'dev-host',
                status: 'waiting' as const,
                members: [
                    {
                        uid: user?.uid || 'dev-host',
                        name: user?.name || '開發者',
                        photoURL: user?.photoURL || 'bee',
                        role: user?.role || 'coach',
                        joinedAt: new Date(),
                        title: user?.title || '傳奇執行師',
                        email: user?.email || ''
                    },
                    {
                        uid: 'player-1',
                        name: '測試玩家 A',
                        photoURL: 'bee',
                        role: 'player' as const,
                        joinedAt: new Date(),
                        title: '幸福拓荒者',
                        email: 'test@example.com'
                    }
                ],
                createdAt: new Date(),
                maxPlayers: 6,
                duration: 60,
                gameTimeLeft: 3600,
                isTimerPaused: true
            };

            return (
                <RoomContent
                    room={mockRoom as any}
                    user={user}
                    viewMode={viewMode}
                    onBack={onBack}
                    isHost={isHost}
                    leaveRoom={leaveRoom}
                    closeRoom={closeRoom}
                    startRoomGame={startRoomGame}
                    error={error}
                />
            );
        }
        return null;
    }

    return (
        <RoomContent
            room={room}
            user={user}
            viewMode={viewMode}
            onBack={onBack}
            isHost={isHost}
            leaveRoom={leaveRoom}
            closeRoom={closeRoom}
            startRoomGame={startRoomGame}
            error={error}
        />
    );
};

// 將渲染邏輯抽離成內部組件
const RoomContent: React.FC<{
    room: any;
    user: any;
    viewMode?: string;
    onBack: () => void;
    isHost: boolean;
    leaveRoom: any;
    closeRoom: any;
    startRoomGame: any;
    error: string | null;
}> = ({ room, user, viewMode, onBack, isHost, leaveRoom, closeRoom, startRoomGame, error }) => {
    const [copied, setCopied] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Profile Menu State
    const [profileMenu, setProfileMenu] = useState<{ isOpen: boolean; x: number; y: number; user: any | null }>({ isOpen: false, x: 0, y: 0, user: null });
    const [viewProfileUser, setViewProfileUser] = useState<any | null>(null);

    const handleAvatarClick = (e: React.MouseEvent, user: any) => {
        e.preventDefault();
        e.stopPropagation();
        const clientX = e.clientX;
        const clientY = e.clientY;

        setProfileMenu({
            isOpen: true,
            x: clientX,
            y: clientY,
            user
        });
    };

    const coachMember = room?.members.find((m: any) => m.uid === room.hostId);
    const playerMembers = room?.members.filter((m: any) => m.uid !== room.hostId) || [];
    const displayCoach = coachMember;

    const handleCloseOrLeave = () => {
        setShowConfirm(true);
    };

    const confirmCloseOrLeave = async () => {
        onBack();
        try {
            if (isHost && room.id !== '888888') {
                await closeRoom();
            } else if (!isHost && room.id !== '888888') {
                await leaveRoom();
            }
        } catch (err) {
            console.error('離開房間操作失敗:', err);
        }
    };

    const handleCopyCode = async () => {
        if (!room.id) return;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(room.id);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = room.id;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('複製失敗:', err);
        }
    };

    const isGM = (m: any) => {
        const email = m?.email?.toLowerCase() || '';
        const title = m?.title || '';
        const name = m?.name?.toUpperCase() || '';
        return email === 'gm0221@happinessflow.com' || title === '遊戲管理員' || name === 'GM' || name === 'GM0221';
    };

    const getMemberTitle = (m: any) => {
        if (isGM(m)) return '遊戲管理員';
        const isSelf = m.uid === user?.uid;
        const isRoomHost = m.uid === room?.hostId;
        if (m.role === 'coach' && !isRoomHost) return getUserTitle(m, 'player');
        if (isSelf && viewMode) return getUserTitle(m, viewMode as any);
        return getUserTitle(m);
    };

    const getMemberBadge = (m: any) => {
        if (isGM(m)) return '/assets/badges/傳奇執行師-去背.png';
        const isSelf = m.uid === user?.uid;
        const isRoomHost = m.uid === room?.hostId;
        if (m.role === 'coach' && !isRoomHost) return getPlayerBadge(m, 'player');
        if (isSelf && viewMode) return (viewMode === 'coach' || viewMode === 'gm') ? getCoachBadge(m, viewMode as any) : getPlayerBadge(m, viewMode as any);
        return m.role === 'coach' ? getCoachBadge(m) : getPlayerBadge(m);
    };

    const getMemberBadgeStyle = (m: any) => {
        const isSelf = m.uid === user?.uid;
        const isRoomHost = m.uid === room?.hostId;
        if (m.role === 'coach' && !isRoomHost) return getBadgeGlowStyle(m, 'player');
        if (isSelf && viewMode) return getBadgeGlowStyle(m, viewMode as any);
        return getBadgeGlowStyle(m);
    };

    const getMemberTitleColor = (m: any) => {
        const isSelf = m.uid === user?.uid;
        const isRoomHost = m.uid === room?.hostId;
        if (m.role === 'coach' && !isRoomHost) return getTitleColor(m, 'player');
        if (isSelf && viewMode) return getTitleColor(m, viewMode as any);
        return getTitleColor(m);
    };

    const renderMemberAvatar = (member: any, isCoach: boolean = false) => {
        const isCustom = member.photoURL?.startsWith('http') || member.photoURL?.startsWith('data:image');
        if (isCustom) {
            let position = { x: 50, y: 50 };
            let scale = 1;
            if (member.photoPosition) {
                try {
                    const pos = typeof member.photoPosition === 'string' ? JSON.parse(member.photoPosition) : member.photoPosition;
                    position = { x: pos.x !== undefined ? pos.x : 50, y: pos.y !== undefined ? pos.y : 50 };
                } catch (e) {
                    position = { x: 50, y: parseInt(member.photoPosition) || 50 };
                }
            }
            if (member.photoScale) scale = parseFloat(member.photoScale) || 1;
            return (
                <SafeImage
                    src={member.photoURL}
                    className={isCoach ? "w-full h-full object-cover rounded-lg" : "w-full h-full object-cover"}
                    alt=""
                    style={{ objectPosition: `${position.x}% ${position.y}%`, transform: `scale(${scale})` }}
                />
            );
        }
        return (
            <div className="w-full h-full bg-gradient-to-b from-amber-300 to-amber-600 flex items-center justify-center text-4xl shadow-inner select-none">
                🐝
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col p-6 animate-in fade-in duration-300" style={{ 
            paddingTop: 'env(safe-area-inset-top, 24px)',
            paddingBottom: 'env(safe-area-inset-bottom, 24px)'
        }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="text-[10px] text-amber-500 font-black uppercase tracking-[0.2em] mb-1">
                        {room?.name || `執行日記${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}.${String(new Date().getDate()).padStart(2, '0')}`}
                    </div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                        {room?.status === 'playing' ? '遊戲進行中' : '等待玩家加入'}
                        <span className={cn(
                            "flex h-2 w-2 rounded-full animate-pulse",
                            room?.status === 'playing' ? "bg-amber-500" : "bg-emerald-500"
                        )} />
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCopyCode}
                        className={`flex flex-col items-center px-4 py-2 border rounded-2xl transition-all group relative active:scale-95 ${copied ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20'}`}
                    >
                        <span className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${copied ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {copied ? '已複製' : '房間碼'}
                        </span>
                        <span className={`text-lg font-black group-hover:scale-105 transition-transform ${copied ? 'text-emerald-400' : 'text-white'}`}>
                            {room.id}
                        </span>
                        {!copied && (
                            <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-amber-500 text-slate-950 p-1 rounded-full shadow-lg">
                                    <Copy size={10} />
                                </div>
                            </div>
                        )}
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
                        {isHost ? (
                            room.status === 'playing' ? (
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/20 text-amber-500 text-xs font-black rounded-full border border-amber-500/30">
                                    <RefreshCw size={14} className="animate-spin" />
                                    遊戲進行中
                                </div>
                            ) : playerMembers.length >= room.maxPlayers ? (
                                <button
                                    onClick={startRoomGame}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 text-white text-xs font-black rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:bg-emerald-400 transition-all animate-pulse active:scale-95 border border-emerald-400/50"
                                >
                                    <Play size={14} className="fill-current" />
                                    開始遊戲
                                </button>
                            ) : (
                                <span className="text-xs font-black text-slate-500 bg-slate-500/10 px-3 py-1 rounded-full border border-slate-500/20">
                                    等待玩家中 ({playerMembers.length} / {room.maxPlayers})
                                </span>
                            )
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
                                    className="flex flex-row items-center gap-3 p-1.5 px-3 rounded-xl border border-amber-500/20 bg-amber-500/5 transition-all relative w-full max-w-sm shadow-[0_0_20px_rgba(245,158,11,0.1)] cursor-pointer active:scale-[0.98]"
                                    onClick={(e) => handleAvatarClick(e, displayCoach)}
                                >
                                    <div className={`w-16 h-16 rounded-lg bg-slate-800 border-2 flex items-center justify-center text-3xl shadow-inner shrink-0 ${getAvatarBorderStyle(displayCoach as any)
                                        }`}
                                    >
                                        {renderMemberAvatar(displayCoach, true)}
                                    </div>

                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-base font-black text-white truncate">{displayCoach.name}</span>
                                            {displayCoach.uid === user?.uid && (
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <SafeImage
                                                src={getMemberBadge(displayCoach as any)}
                                                className={`w-12 h-12 object-contain shrink-0 ${getMemberBadgeStyle(displayCoach as any)}`}
                                                alt={getMemberTitle(displayCoach as any)}
                                            />
                                            <span className={`text-xs font-black uppercase tracking-widest whitespace-nowrap px-3 py-1 rounded-full border ${isGM(displayCoach)
                                                ? 'bg-indigo-500/10 border-indigo-500/20'
                                                : 'bg-amber-500/10 border-amber-500/10'
                                                } ${getMemberTitleColor(displayCoach as any)}`}>
                                                {getMemberTitle(displayCoach as any)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Players Section - Filling all remaining space */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1 text-center">參與玩家</div>
                            <div className="flex-1 grid grid-cols-2 gap-1.5 w-full auto-rows-fr">
                                {playerMembers.map((member) => (
                                    <div
                                        key={member.uid}
                                        className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-800/50 bg-slate-900/50 transition-all relative h-full cursor-pointer active:scale-[0.98]"
                                        onClick={(e) => handleAvatarClick(e, member)}
                                    >
                                        {/* Avatar - Simplified */}
                                        <div className="relative shrink-0 mb-2">
                                            <div className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-3xl shadow-inner overflow-hidden">
                                                {renderMemberAvatar(member)}
                                            </div>
                                        </div>

                                        {member.uid === user?.uid && (
                                            <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] border-2 border-slate-900 z-10" />
                                        )}

                                        {/* Info Below Avatar */}
                                        <div className="flex flex-col items-center min-w-0 text-center w-full px-1">
                                            <span className="text-sm font-black text-white truncate w-full mb-1">
                                                {member.name}
                                            </span>
                                            <div className="flex items-center justify-center gap-1 w-full mt-1">
                                                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                                    <SafeImage
                                                        src={getMemberBadge(member as any)}
                                                        className={`w-full h-full object-contain ${getMemberBadgeStyle(member as any)}`}
                                                        alt=""
                                                    />
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-widest truncate ${getMemberTitleColor(member as any)}`}>
                                                    {getMemberTitle(member as any)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {Array.from({ length: room.maxPlayers - playerMembers.length }).map((_, i) => (
                                    <div
                                        key={`empty-${i}`}
                                        className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-900/30 border border-slate-800/50 h-full relative group transition-all duration-300"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-slate-950/50 border border-slate-800 flex items-center justify-center text-slate-600 mb-2 relative overflow-hidden animate-breath shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                                            {/* Internal pulsing gradient - slowed down to match breath */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent animate-pulse [animation-duration:4s]" />
                                            <Users size={24} strokeWidth={1.5} className="relative z-10 opacity-40 text-amber-500/60" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover:text-amber-500/60 transition-colors">等待中</span>
                                    </div>
                                ))}

                                {Array.from({ length: 6 - room.maxPlayers }).map((_, i) => (
                                    <div
                                        key={`disabled-${i}`}
                                        className="flex flex-col items-center justify-center p-2 rounded-2xl border border-transparent bg-slate-950/40 h-full select-none relative overflow-hidden"
                                    >
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-900/20 border border-white/5">
                                            <X size={20} strokeWidth={1.2} className="text-slate-800" />
                                        </div>
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

            {/* Profile Menu Popover */}
            {profileMenu.isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[250]"
                        onClick={() => setProfileMenu({ ...profileMenu, isOpen: false })}
                    />
                    <div
                        className="fixed z-[300] bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200"
                        style={{ top: Math.min(profileMenu.y, window.innerHeight - 60), left: Math.min(profileMenu.x, window.innerWidth - 120) }}
                    >
                        <button
                            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 w-full min-w-[100px]"
                            onClick={() => {
                                setViewProfileUser(profileMenu.user);
                                setProfileMenu({ ...profileMenu, isOpen: false });
                            }}
                        >
                            <UserIcon size={16} />
                            個人資料
                        </button>
                    </div>
                </>
            )}

            {/* Profile Modal for Viewing User */}
            <ProfileModal
                isOpen={!!viewProfileUser}
                onClose={() => setViewProfileUser(null)}
                targetUser={viewProfileUser}
                viewMode={viewMode as any}
            />
        </div>
    );
};

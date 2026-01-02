import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Bug, Plane, Stethoscope, Palette, TreePine, Briefcase, Edit3, Calendar, Hash, Award, History, Play, X, Check, Upload, Image as ImageIcon, Move, Copy } from 'lucide-react';
import { Button, Input, Slider } from '../ui/ui';
import { useAuth, getUserTitle } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { avatarOptions } from './AvatarModal';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
    const { user, updateUserProfile, uploadAvatar } = useAuth();
    const { gameHistory } = useGame();
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(user?.name || '');
    const [isEditingAvatar, setIsEditingAvatar] = useState(false);
    const [isAdjustingPosition, setIsAdjustingPosition] = useState(false);
    const [tempPosition, setTempPosition] = useState({ x: 50, y: 50 });
    const [tempScale, setTempScale] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const dragStartPosition = useRef({ x: 50, y: 50 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCopyId = () => {
        if (!user?.uid) return;
        navigator.clipboard.writeText(user.uid);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isCustomAvatar) return;
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartPos.current = { x: clientX, y: clientY };
        dragStartPosition.current = { ...tempPosition };
    };

    const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging || !isCustomAvatar) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        const deltaX = clientX - dragStartPos.current.x;
        const deltaY = clientY - dragStartPos.current.y;
        
        // 112 是預覽框寬度
        const movePercentX = (deltaX / 112) * 100;
        const movePercentY = (deltaY / 112) * 100;
        
        setTempPosition({
            x: Math.max(0, Math.min(100, dragStartPosition.current.x - movePercentX)),
            y: Math.max(0, Math.min(100, dragStartPosition.current.y - movePercentY))
        });
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (user?.photoPosition) {
            try {
                const pos = JSON.parse(user.photoPosition);
                setTempPosition(pos);
            } catch (e) {
                setTempPosition({ x: 50, y: parseInt(user.photoPosition) || 50 });
            }
        }
        if (user?.photoScale) {
            setTempScale(parseFloat(user.photoScale) || 1);
        }
    }, [user?.photoPosition, user?.photoScale]);

    const userStats = useMemo(() => {
        if (!gameHistory || gameHistory.length === 0) {
            return { totalGames: 0, winRate: 0, totalScore: 0, happinessRate: 0 };
        }
        const totalGames = gameHistory.length;
        const wins = gameHistory.filter(g => g.isWin).length;
        const totalScore = gameHistory.reduce((sum, g) => sum + (g.finalScore || 0), 0);
        const totalHappiness = gameHistory.reduce((sum, g) => sum + (g.happinessScore || 0), 0);
        const happinessRate = Math.round((totalHappiness / (totalGames * 100)) * 100);
        return {
            totalGames,
            winRate: Math.round((wins / totalGames) * 100),
            totalScore,
            happinessRate: Math.min(100, happinessRate)
        };
    }, [gameHistory]);

    if (!isOpen || !user) return null;

    const handleSaveName = async () => {
        if (!newName.trim() || newName === user.name) {
            setIsEditingName(false);
            return;
        }
        setIsSaving(true);
        try {
            await updateUserProfile(newName.trim());
            setIsEditingName(false);
        } catch (error) {
            console.error('Failed to update name:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSelectAvatar = async (avatarId: string) => {
        setIsSaving(true);
        try {
            const defaultPos = JSON.stringify({ x: 50, y: 50 });
            await updateUserProfile(undefined, avatarId, defaultPos, '1');
            // 彈窗模式下不自動關閉，讓使用者看到預覽
        } catch (error) {
            console.error('Failed to update avatar:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSavePosition = async () => {
        setIsSaving(true);
        try {
            await updateUserProfile(undefined, undefined, JSON.stringify(tempPosition), tempScale.toString());
            setIsAdjustingPosition(false);
            setIsEditingAvatar(false); // 儲存位置後關閉頭像編輯視窗
        } catch (error) {
            console.error('Failed to update position:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSaving(true);
        setError(null);
        try {
            await uploadAvatar(file);
            // 上傳後保持視窗開啟，讓使用者可以預覽或調整位置
        } catch (error: any) {
            console.error('Failed to upload avatar:', error);
            setError(error.message || '上傳失敗，請稍後再試');
            setTimeout(() => setError(null), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    const joinDate = user.creationTime 
        ? new Date(user.creationTime).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
        : '未知';

    const currentAvatar = avatarOptions.find(a => a.id === user.photoURL);
    const isCustomAvatar = user.photoURL?.startsWith('http') || user.photoURL?.startsWith('data:image');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Hidden File Input */}
                <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                />
                {/* Header */}
                <div className="relative h-32 bg-gradient-to-r from-amber-500/20 to-emerald-500/20">
                    {/* Error Toast */}
                    {error && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[70] w-[90%] max-w-sm animate-in slide-in-from-top duration-300">
                            <div className="bg-red-500/90 backdrop-blur-md text-white px-4 py-2 rounded-xl shadow-lg border border-red-400/50 flex items-center gap-2">
                                <div className="p-1 bg-white/20 rounded-full">
                                    <X size={14} className="text-white" />
                                </div>
                                <span className="text-sm font-medium">{error}</span>
                            </div>
                        </div>
                    )}
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-slate-950/50 hover:bg-slate-950 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <div className="absolute -bottom-12 left-8 flex items-end gap-4">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-2xl bg-slate-800 border-4 border-slate-900 flex items-center justify-center shadow-xl overflow-hidden">
                                {isCustomAvatar ? (
                                        <img 
                                            src={user.photoURL} 
                                            alt="Avatar" 
                                            className="w-full h-full object-cover" 
                                            style={{ 
                                                objectPosition: `${tempPosition.x}% ${tempPosition.y}%`,
                                                transform: `scale(${tempScale})`
                                            }}
                                        />
                                    ) : (
                                         <div className="w-full h-full bg-gradient-to-b from-amber-300 to-amber-600 flex items-center justify-center text-6xl shadow-inner select-none">
                                             🐝
                                         </div>
                                     )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 flex flex-col gap-1">
                                <button 
                                    onClick={() => setIsEditingAvatar(!isEditingAvatar)}
                                    disabled={isSaving}
                                    className="p-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg shadow-lg transition-transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:scale-100"
                                >
                                    {isSaving && !isEditingAvatar ? (
                                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Edit3 size={16} />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-16 px-8 pb-8">
                    {/* User Info */}
                    <div className="space-y-4 mb-8">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider shadow-sm ${
                                                user?.role === 'coach' 
                                                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white' 
                                                    : 'bg-slate-800 text-amber-500 border border-amber-500/20'
                                            }`}>
                                                {getUserTitle(user)}
                                            </span>
                                            {user.role === 'coach' && (
                                                 <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">
                                                     管理員
                                                 </span>
                                             )}
                                        </div>
                                        {isEditingName ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={newName}
                                                    maxLength={10}
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    className="h-9 bg-slate-950/50 border-slate-700 text-white font-black"
                                                    placeholder="輸入新暱稱 (最多10字)"
                                                    autoFocus
                                                />
                                                <button 
                                                    onClick={handleSaveName}
                                                    disabled={isSaving}
                                                    className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => { setIsEditingName(false); setNewName(user.name); }}
                                                    className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h2 className="text-2xl font-black text-white tracking-tight">{user.name}</h2>
                                                    <button 
                                                        onClick={() => setIsEditingName(true)}
                                                        className="p-1.5 text-slate-500 hover:text-amber-500 transition-colors rounded-lg hover:bg-amber-500/10"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                                    <Calendar size={10} className="text-slate-600" />
                                                    <span>加入於 {joinDate}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                                <button 
                                    onClick={handleCopyId}
                                    className={`p-1 rounded-md transition-all ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-600 hover:text-slate-400'}`}
                                    title="複製 ID"
                                >
                                    {copied ? <Check size={12} /> : <Copy size={12} />}
                                </button>
                                <span>ID：{user.uid}</span>
                                {copied && <span className="text-[8px] text-emerald-500 animate-in fade-in slide-in-from-left-1">已複製！</span>}
                            </div>
                        </div>
                    </div>

                    {/* Avatar Selection Panel Modal */}
                    {isEditingAvatar && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-black text-white uppercase tracking-widest">選擇頭像</h3>
                                    <button 
                                        onClick={() => setIsEditingAvatar(false)}
                                        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Preview Area */}
                                <div className="flex flex-col items-center mb-8">
                                    <div 
                                        className={`w-28 h-28 rounded-2xl bg-slate-800 border-4 ${isDragging ? 'border-amber-500' : 'border-slate-700'} flex items-center justify-center shadow-xl overflow-hidden mb-4 cursor-ns-resize touch-none select-none transition-colors`}
                                        onMouseDown={handleDragStart}
                                        onMouseMove={handleDragMove}
                                        onMouseUp={handleDragEnd}
                                        onMouseLeave={handleDragEnd}
                                        onTouchStart={handleDragStart}
                                        onTouchMove={handleDragMove}
                                        onTouchEnd={handleDragEnd}
                                    >
                                        {isCustomAvatar ? (
                                            <img 
                                                src={user.photoURL} 
                                                alt="Preview" 
                                                className="w-full h-full object-cover pointer-events-none"
                                                style={{ 
                                                    objectPosition: `${tempPosition.x}% ${tempPosition.y}%`,
                                                    transform: `scale(${tempScale})`
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-b from-amber-300 to-amber-600 flex items-center justify-center text-6xl shadow-inner select-none">
                                                🐝
                                            </div>
                                        )}
                                    </div>
                                    
                                    {isCustomAvatar && (
                                        <div className="w-full space-y-4">
                                            <div className="text-center">
                                                <div className="flex items-center justify-center gap-2 text-amber-500/80 mb-1">
                                                    <Move size={14} />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">任意方向滑動圖片調整</span>
                                                </div>
                                                <p className="text-[10px] text-slate-600">上下左右滑動照片以調整顯示位置</p>
                                            </div>

                                            <div className="px-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">縮放</span>
                                                    <Slider 
                                                        value={Math.round(tempScale * 100)} 
                                                        min={100} 
                                                        max={300} 
                                                        onChange={(v) => setTempScale(v / 100)} 
                                                    />
                                                    <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">{Math.round(tempScale * 100)}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex flex-col gap-3 mb-8">
                                    <button
                                        onClick={() => handleSelectAvatar('bee')}
                                        className={`w-full flex items-center justify-center gap-3 py-3 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                                            user.photoURL === 'bee'
                                            ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                                        }`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-b from-amber-300 to-amber-600 flex items-center justify-center text-sm shadow-sm">
                                            🐝
                                        </div>
                                        <span className="font-bold tracking-wide">選用預設蜜蜂頭像</span>
                                    </button>

                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isSaving}
                                        className="w-full flex items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isSaving && !isCustomAvatar ? (
                                            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Upload size={20} />
                                                <span>上傳照片</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {isCustomAvatar && (
                                    <button 
                                        onClick={handleSavePosition}
                                        disabled={isSaving}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <Check size={20} />
                                        <span>確認</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: '平均幸福指數', value: `${userStats.happinessRate}%`, icon: Award, color: 'text-pink-400', bg: 'bg-pink-500/10' },
                            { label: '賽季總積分', value: userStats.totalScore, icon: Award, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                            { label: '勝率', value: `${userStats.winRate}%`, icon: History, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                            { label: '遊玩局數', value: userStats.totalGames, icon: Play, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        ].map((stat, i) => (
                            <div key={i} className="p-4 bg-slate-950/30 border border-slate-800/50 rounded-2xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                                        <stat.icon size={14} className={stat.color} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                                </div>
                                <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

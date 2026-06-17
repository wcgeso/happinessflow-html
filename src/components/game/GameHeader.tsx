import React, { useState, useEffect, useMemo } from 'react';
import { Star, Settings, Heart, LogOut, TrendingUp, HelpCircle, Trophy, Users, Home, ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getProfessionIcon } from '../common/IconHelpers';
import { cn, formatMoney } from '../../utils/gameUtils';
import { useRoom } from '../../context/RoomContext';
import { useAuth, isGM as checkIsGM } from '../../context/AuthContext';
import SafeImage from '../common/SafeImage';
import { IS_DEV_VERSION } from '../../constants/version';
import { DevSettingsModal } from '../modals/DevSettingsModal';

interface GameHeaderProps {
    gameState: any;
    summary: any;
    onShowRankList: () => void;
    onShowPromotion: () => void;
    onShowHappiness: () => void;
    onFinishGame: () => void;
    onShowStockMarket: () => void;
    onShowTutorial: () => void;
    onLeaveRoom: () => void;
    onAddMoney?: (amount: number) => void;
    isDevMode?: boolean;
}

export const GameHeader: React.FC<GameHeaderProps> = ({ 
    gameState, 
    summary,
    onShowRankList, 
    onShowHappiness,
    onFinishGame,
    onShowStockMarket,
    onShowTutorial,
    onLeaveRoom,
    onAddMoney,
    isDevMode = false
}) => {
    const { user } = useAuth();
    const { room, playerStates } = useRoom();
    const [showSettings, setShowSettings] = useState(false);
    const [showRoomInfo, setShowRoomInfo] = useState(false);
    const [showDevSettings, setShowDevSettings] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>('--:--');

    const isGM = user?.role === 'coach' || checkIsGM(user);
    
    // 計算財富自由進度 (被動收入 / 總支出)
    const passiveIncome = summary.passiveIncome || 0;
    const totalExpenses = summary.totalExpenses || 1; // 避免除以零
    const financialFreedomProgress = Math.min((passiveIncome / totalExpenses) * 100, 100);
    const isFinanciallyFree = financialFreedomProgress >= 100;

    // 格式化時間
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // 倒數計時邏輯 (同步執行師設定)
    useEffect(() => {
        if (room?.gameTimeLeft === undefined) return;

        // 本地倒數邏輯，避免過度依賴 Firestore 更新頻率
        let localTime = room.gameTimeLeft;
        const isPaused = room.isTimerPaused ?? true;
        
        // 初始設定
        setTimeLeft(formatTime(localTime));

        if (isPaused || localTime <= 0) return;

        const timer = setInterval(() => {
            localTime = Math.max(0, localTime - 1);
            setTimeLeft(formatTime(localTime));
            
            if (localTime <= 0) {
                clearInterval(timer);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [room?.gameTimeLeft, room?.isTimerPaused]);

    const sortedPlayers = useMemo(() => {
        if (!room || !room.members) return [];
        
        // 取得所有成員，只要不是房主都視為玩家
        // 增加更嚴謹的過濾，確保成員有 uid
        const playersOnly = room.members.filter(m => m && m.uid && m.uid !== room.hostId);
        
        // 優先使用 room.playerStates，因為這是在 Firestore 中同步的
        const states = room.playerStates || playerStates || {};
        
        return playersOnly.map(m => ({
            ...m,
            happiness: states[m.uid]?.happinessTotal || 0
        }))
        .sort((a, b) => b.happiness - a.happiness);
    }, [room, playerStates]);

    const displayRoomName = useMemo(() => {
        if (room?.name) return room.name;
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        return `執行日記${yy}${mm}${dd}`;
    }, [room?.name]);

    const renderPlayerAvatar = (player: any) => {
        if (!player) return <Users size={16} className="text-slate-500" />;
        
        const isCustom = player.photoURL && (player.photoURL.startsWith('http') || player.photoURL.startsWith('data:image'));
        
        if (isCustom) {
            let position = { x: 50, y: 50 };
            let scale = 1;
            
            if (player.photoPosition) {
                try {
                    position = JSON.parse(player.photoPosition);
                } catch (e) {
                    position = { x: 50, y: parseInt(player.photoPosition) || 50 };
                }
            }
            if (player.photoScale) {
                scale = parseFloat(player.photoScale) || 1;
            }

            return (
                <SafeImage 
                    src={player.photoURL} 
                    className="w-full h-full object-cover" 
                    alt={player.name}
                    style={{ 
                        objectPosition: `${position.x}% ${position.y}%`,
                        transform: `scale(${scale})`
                    }}
                />
            );
        }

        return (
             <span className="text-xl">
                 {(!player.photoURL || player.photoURL === 'bee') ? '🐝' : '👤'}
             </span>
         );
     };

    return (
        <header className="fixed top-0 left-0 right-0 z-40 flex flex-col pt-safe pointer-events-none">
            {/* Top Profile Card HUD */}
            <div className="relative z-20 px-3 py-3 w-full">
                <div className="max-w-4xl mx-auto pointer-events-auto">
                    
                    {/* 懸浮名片主體 */}
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 rounded-3xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] p-3 flex items-center gap-3">
                        
                        {/* 左側：職業頭像區 */}
                        {gameState.profession && (
                            <div 
                                className="shrink-0 relative group cursor-pointer"
                                onClick={onShowRankList}
                            >
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700/50 flex flex-col items-center justify-center shadow-inner group-hover:border-yellow-500/50 transition-colors">
                                    {getProfessionIcon(gameState.profession.id, { size: 24, className: "text-yellow-400 mb-0.5 drop-shadow-md" })}
                                    <div className="flex items-center gap-0.5">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <Star
                                                key={i}
                                                size={8}
                                                className={cn(i < gameState.currentRankLevel ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700')}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 中央：雙軌進度條區 (幸福與財富) */}
                        <div className="flex-1 flex flex-col justify-center gap-3">
                            
                            {/* 上軌：幸福分數 (最醒目) */}
                            <div 
                                className="flex flex-col gap-1.5 cursor-pointer group"
                                onClick={onShowHappiness}
                            >
                                <div className="flex justify-between items-end">
                                    <div className="flex items-center gap-1.5">
                                        <Heart size={16} className="text-pink-500 fill-pink-500 group-hover:scale-110 transition-transform" />
                                        <span className="text-sm font-black text-pink-400 tracking-wider">幸福指數</span>
                                    </div>
                                    <span className="text-lg font-black text-white drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]">
                                        {gameState.happinessTotal} <span className="text-xs text-slate-500">/ 100</span>
                                    </span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-800/80 rounded-full overflow-hidden shadow-inner border border-slate-700/30">
                                    <div 
                                        className="h-full bg-gradient-to-r from-pink-600 to-pink-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(236,72,153,0.6)]"
                                        style={{ width: `${Math.min((gameState.happinessTotal / 100) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* 下軌：財務自由 */}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs font-black text-emerald-500 tracking-wider">財務自由</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-[10px] text-slate-500 font-mono">
                                            {formatMoney(passiveIncome)} / {formatMoney(totalExpenses)}
                                        </span>
                                        <span className={cn("text-sm font-black ml-1", isFinanciallyFree ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "text-slate-300")}>
                                            {financialFreedomProgress.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-slate-800/80 rounded-full overflow-hidden shadow-inner border border-slate-700/30">
                                    <div 
                                        className={cn("h-full rounded-full transition-all duration-1000", isFinanciallyFree ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" : "bg-gradient-to-r from-emerald-700 to-emerald-500")}
                                        style={{ width: `${financialFreedomProgress}%` }}
                                    />
                                </div>
                            </div>

                        </div>

                        {/* 右側：金流數據與設定 */}
                        <div className="shrink-0 flex flex-col items-end justify-between h-full py-0.5 border-l border-slate-700/50 pl-4">
                            
                            {/* 現金與月結餘 */}
                            <div className="flex flex-col items-end mb-2">
                                <div className="text-xs text-slate-500 font-bold mb-0.5">現金</div>
                                <div className="text-xl font-black text-white leading-none tracking-tight">{formatMoney(gameState.cash)}</div>
                                <div className={cn("text-xs font-black mt-1.5", summary.monthlyCashflow >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                    {summary.monthlyCashflow >= 0 ? '+' : ''}{formatMoney(summary.monthlyCashflow)} <span className="text-[10px] text-slate-500 font-normal">/月</span>
                                </div>
                            </div>

                            {/* 設定選單 */}
                            <div className="relative mt-auto">
                                <button
                                    onClick={() => setShowSettings(!showSettings)}
                                    className={cn(
                                        "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                                        showSettings 
                                            ? "bg-blue-600 text-white" 
                                            : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                                    )}
                                >
                                    <Settings size={16} className={cn("transition-transform duration-500", showSettings && "rotate-90")} />
                                </button>

                                {/* 展開的設定選單 */}
                                <AnimatePresence>
                                    {showSettings && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, y: -10, transformOrigin: 'top right' }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                            className="absolute top-full right-0 mt-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] p-2 flex flex-col gap-1 z-50"
                                        >
                                            <div className="px-3 py-2 border-b border-slate-800 mb-1 flex justify-between items-center">
                                                <span className="text-[10px] text-slate-500 font-bold tracking-widest">房間倒數</span>
                                                <span className="text-xs font-mono text-white">{timeLeft}</span>
                                            </div>
                                            <button onClick={() => { onFinishGame(); setShowSettings(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-sm font-bold">
                                                <Trophy size={16} className="text-amber-500" />
                                                結算評分
                                            </button>
                                            <button onClick={() => { onShowStockMarket(); setShowSettings(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-sm font-bold">
                                                <TrendingUp size={16} className="text-emerald-500" />
                                                股市行情
                                            </button>
                                            <button onClick={() => { onShowTutorial(); setShowSettings(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-sm font-bold">
                                                <HelpCircle size={16} className="text-blue-500" />
                                                遊戲教學
                                            </button>
                                            <div className="h-px bg-slate-800 my-1" />
                                            <button onClick={() => { setShowRoomInfo(true); setShowSettings(false); }} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-sm font-bold">
                                                <div className="flex items-center gap-3">
                                                    <Users size={16} className="text-indigo-400" />
                                                    房間玩家
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                                                    {room?.id}
                                                    <ChevronDown size={14} className="rotate-[-90deg]" />
                                                </div>
                                            </button>
                                            {IS_DEV_VERSION && isGM && isDevMode && (
                                                <button onClick={() => { setShowDevSettings(true); setShowSettings(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-amber-500 transition-colors text-sm font-bold">
                                                    <Settings size={16} />
                                                    開發者設定
                                                </button>
                                            )}
                                            <div className="h-px bg-slate-800 my-1" />
                                            <button onClick={() => { onLeaveRoom(); setShowSettings(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-rose-500/20 text-rose-500 transition-colors text-sm font-bold">
                                                <LogOut size={16} />
                                                離開房間
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 開發者設定面板 */}
            {IS_DEV_VERSION && isGM && isDevMode && (
                <DevSettingsModal
                    isOpen={showDevSettings}
                    onClose={() => setShowDevSettings(false)}
                    onAddMoney={(amount) => {
                        if (onAddMoney) onAddMoney(amount);
                    }}
                    currentCash={gameState.cash}
                />
            )}

            {/* 房間與玩家資訊 Modal */}
            <AnimatePresence>
                {showRoomInfo && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-auto">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowRoomInfo(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                                        <Home size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-sm font-black text-white tracking-wide">{displayRoomName}</div>
                                        <div className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">房號: {room?.id}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowRoomInfo(false)}
                                    className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            
                            <div className="p-4 max-h-[60vh] overflow-y-auto">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Users size={12} /> 玩家列表 ({sortedPlayers.length})
                                </h3>
                                <div className="flex flex-col gap-2">
                                    {sortedPlayers.length === 0 ? (
                                        <div className="text-center py-8 flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-600 mb-2">
                                                <Users size={24} />
                                            </div>
                                            <div className="text-slate-400 text-sm font-bold">目前沒有其他玩家</div>
                                            <div className="text-slate-600 text-xs">等待其他人加入房間...</div>
                                        </div>
                                    ) : (
                                        sortedPlayers.map((p) => (
                                            <div key={p.uid} className="flex items-center justify-between bg-slate-800/50 rounded-2xl p-3 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-700 flex items-center justify-center shadow-inner border border-slate-600/50">
                                                        {renderPlayerAvatar(p)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <div className="text-sm font-bold text-slate-200">{p.name || '未命名玩家'}</div>
                                                        <div className="text-[10px] text-slate-500">{p.isReady ? '🟢 已準備' : '🟡 準備中...'}</div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-1.5 bg-pink-500/10 px-2 py-1 rounded-lg border border-pink-500/20">
                                                        <Heart size={10} className="text-pink-500 fill-pink-500" />
                                                        <span className="text-xs font-black text-pink-400 tabular-nums">{p.happiness || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </header>
    );
};

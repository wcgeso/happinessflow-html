import React, { useState, useEffect, useMemo } from 'react';
import { Star, Plane, GraduationCap, Trophy, TrendingUp, Wallet, BarChart3, PieChart, Landmark, HelpCircle, ChevronDown, Clock, Users, Home, Heart, LogOut, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/ui';
import { getProfessionIcon } from '../common/IconHelpers';
import { cn, formatMoney } from '../../utils/gameUtils';
import { StockMarketModal } from '../transaction/StockMarketModal';
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
    onShowPromotion, 
    onFinishGame,
    onShowStockMarket,
    onShowTutorial,
    onLeaveRoom,
    onAddMoney,
    isDevMode = false
}) => {
    const { user } = useAuth();
    const { room, playerStates } = useRoom();
    const [showAircraftTooltip, setShowAircraftTooltip] = useState(false);
    const [showRoomInfo, setShowRoomInfo] = useState(false);
    const [showDevSettings, setShowDevSettings] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>('--:--');

    const isGM = user?.role === 'coach' || checkIsGM(user);

    const hasAircraft = gameState.assets.some((a: any) => a.type === '飛行器');
    const netAssets = summary.totalAssets - summary.totalLiabilities;

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
        <header className="fixed top-0 left-0 right-0 z-40 flex flex-col pt-safe">
            {/* Top Bar */}
            <div className="relative z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 shadow-md">
                <div className="max-w-7xl mx-auto flex items-center justify-between relative">
                    <div className="flex items-center gap-3">
                        {gameState.profession && (
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-8 h-8 rounded-full bg-slate-800 border border-yellow-500/50 flex items-center justify-center cursor-pointer hover:border-yellow-400 transition-colors"
                                    onClick={onShowRankList}
                                >
                                    {getProfessionIcon(gameState.profession.id, { size: 16, className: "text-yellow-400" })}
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Star
                                                key={i}
                                                size={10}
                                                className={cn(i < gameState.currentRankLevel ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700')}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-bold leading-none mt-1">{gameState.currentRankTitle}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-1.5 items-center h-8">
                        <button 
                            onClick={onFinishGame} 
                            className="h-8 bg-amber-600 hover:bg-amber-500 text-white text-[10px] px-2.5 flex items-center gap-1.5 shrink-0 shadow-lg shadow-amber-900/20 rounded-lg border border-amber-500/50 transition-all active:scale-95"
                        >
                            <Trophy size={14} />
                            <span className="font-black whitespace-nowrap uppercase tracking-wider">評分</span>
                        </button>
                        <div className="relative h-8 w-8 cursor-pointer hover:scale-105 transition-transform shrink-0">
                            <div
                                className={cn("w-full h-full flex items-center justify-center rounded-lg shadow-lg transition-colors text-white shadow-indigo-500/20", hasAircraft ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-600 hover:bg-slate-500')}
                                onMouseEnter={() => setShowAircraftTooltip(true)}
                                onMouseLeave={() => setShowAircraftTooltip(false)}
                            >
                                <Plane size={14} className={!hasAircraft ? 'text-slate-300' : 'text-white'} />
                            </div>
                            {showAircraftTooltip && (
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-40 bg-slate-800 text-white text-xs p-3 rounded border border-slate-600 z-[100] shadow-xl animate-in fade-in zoom-in-95 pointer-events-none">
                                    <div className="relative">
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-slate-800"></div>
                                        {hasAircraft ? '遊玩時可擲兩顆骰子' : '尚未擁有飛行器'}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onShowStockMarket}
                            className="h-8 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg shadow-lg text-[10px] px-2 flex items-center gap-1 shrink-0 transition-all active:scale-95 font-medium"
                        >
                            <TrendingUp size={12} className="text-emerald-400" />
                            <span className="font-bold whitespace-nowrap">股市</span>
                        </button>
                        <button
                            onClick={onLeaveRoom}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all border border-rose-500/20 active:scale-95 ml-1"
                            title="離開房間"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>

                {/* 懸掛式倒數計時器 (同步玩家畫面風格) */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full flex items-center justify-center z-30">
                    <button
                        onClick={() => setShowRoomInfo(!showRoomInfo)}
                        className={cn(
                            "flex items-center gap-1 px-3 py-1 rounded-b-xl border-x border-b transition-all duration-500 active:scale-95 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.5)]",
                            showRoomInfo 
                                ? "bg-blue-600 border-blue-400 text-white shadow-blue-900/40" 
                                : !room?.isTimerPaused 
                                    ? "bg-emerald-500 border-emerald-400 text-white"
                                    : "bg-slate-900/90 backdrop-blur-sm border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                        )}
                    >
                        <div className="flex items-center gap-1.5">
                            <span className={cn(
                                "text-[10px] font-black tracking-widest transition-colors duration-300",
                                (!room?.isTimerPaused) ? "text-white/90" : "text-white/60"
                            )}>
                                房號 {room?.id}
                            </span>
                            <div className={cn(
                                "w-px h-2.5 transition-colors duration-300",
                                (!room?.isTimerPaused) ? "bg-white/40" : "bg-white/20"
                            )} />
                            <Clock size={11} className={cn(
                                "transition-colors duration-300",
                                (!room?.isTimerPaused) ? "text-white" : showRoomInfo ? "text-white" : "text-slate-500"
                            )} />
                            <span className={cn(
                                "text-[10px] font-black tracking-wider tabular-nums transition-colors duration-300",
                                (!room?.isTimerPaused) ? "text-white" : (showRoomInfo ? "text-white" : "text-slate-400")
                            )}>
                                {timeLeft}
                            </span>
                        </div>
                        <ChevronDown size={11} className={cn("transition-transform duration-300", showRoomInfo && "rotate-180")} />
                    </button>

                    {/* 開發者模式按鈕 (僅 GM/執行師 且在開發環境且開啟開發者模式顯示) */}
                    {IS_DEV_VERSION && isGM && isDevMode && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDevSettings(true);
                            }}
                            className="ml-2 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 hover:bg-amber-500/30 transition-all active:scale-90 shadow-lg shadow-amber-900/10"
                            title="開發者設定"
                        >
                            <Settings size={14} className="animate-spin-slow" />
                        </button>
                    )}
                </div>

                {/* 開發者設定面板 (僅 GM/執行師 且在開發環境且開啟開發者模式顯示) */}
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

                {/* 下拉房間資訊面板 (懸浮式設計) */}
                <AnimatePresence>
                    {showRoomInfo && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0, y: 12 }}
                            animate={{ height: 'auto', opacity: 1, y: 28 }}
                            exit={{ height: 0, opacity: 0, y: 12 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="fixed top-16 left-0 right-0 flex justify-center z-[100] px-3 pointer-events-none"
                        >
                            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-[0_30px_70px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/5 overflow-hidden pointer-events-auto">
                                <div className="p-5 space-y-5">
                                    {/* 房間基本資訊 - 更加精緻的卡片感 */}
                                    <div className="flex items-center justify-between bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                                                <Home size={18} className="text-white" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-white tracking-wide">
                                                    {displayRoomName}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right bg-slate-900/80 px-3 py-2.5 rounded-lg border border-slate-700/50 flex items-center justify-center">
                                            <div className="text-xs font-black text-blue-400 font-mono tracking-wider">{room?.id}</div>
                                        </div>
                                    </div>

                                    {/* 玩家列表 - 優化列表視覺與排序感 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between px-1">
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                                <Users size={12} className="text-blue-500" />
                                                <span>玩家列表</span>
                                            </div>
                                            <span className="text-[9px] text-slate-600 font-bold bg-slate-800 px-2 py-0.5 rounded-full">{sortedPlayers.length} 位玩家</span>
                                        </div>
                                        <div className="grid gap-2 max-h-[320px] overflow-y-auto pr-1 no-scrollbar">
                                            {sortedPlayers.map((player) => (
                                                <div 
                                                    key={player.uid} 
                                                    className={cn(
                                                        "group flex items-center justify-between p-2.5 rounded-2xl border transition-all duration-300",
                                                        player.isLeft 
                                                            ? "bg-slate-900/40 border-slate-800/50 opacity-60 grayscale-[0.5]" 
                                                            : "bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/60"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <div className={cn(
                                                                "w-9 h-9 rounded-xl border-2 bg-slate-800 flex items-center justify-center overflow-hidden shadow-inner",
                                                                player.isLeft ? "border-slate-800" : "border-slate-700"
                                                            )}>
                                                                {renderPlayerAvatar(player)}
                                                            </div>
                                                            {player.isLeft && (
                                                                <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                                                                    <div className="w-full h-full bg-slate-900/20 backdrop-blur-[1px]" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    "text-xs font-black transition-colors",
                                                                    player.isLeft ? "text-slate-500" : "text-slate-200 group-hover:text-white"
                                                                )}>
                                                                    {player.name}
                                                                </span>
                                                                {player.isLeft && (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded-md border border-slate-700/50">
                                                                        已離開
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Heart size={12} className={player.isLeft ? "text-slate-600" : "text-pink-500"} fill="currentColor" />
                                                        <div className={cn(
                                                            "px-2.5 py-0.5 rounded-full text-[11px] font-black tabular-nums shadow-sm border",
                                                            player.isLeft 
                                                                ? "bg-slate-800/50 text-slate-500 border-slate-700/30" 
                                                                : "bg-pink-500/10 text-pink-500 border-pink-500/20"
                                                        )}>
                                                            {player.happiness}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 剩餘時間 - 強化警示感 */}
                                    <div className="pt-1">
                                        <div className="relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-blue-600/10 transition-colors"></div>
                                            <div className="relative flex items-center justify-between p-4 rounded-2xl border border-blue-500/20">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                                        <Clock size={20} className="text-blue-400 animate-pulse" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Remaining Time</div>
                                                        <div className="text-xs font-bold text-blue-400">遊戲剩餘時間</div>
                                                    </div>
                                                </div>
                                                <span className="text-2xl font-black text-blue-400 tabular-nums tracking-tighter drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">{timeLeft}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 關閉按鈕 - 縮小高度 */}
                                <button 
                                    onClick={() => setShowRoomInfo(false)}
                                    className="w-full py-2 bg-slate-800/30 hover:bg-slate-800/60 border-t border-slate-800/50 text-slate-500 hover:text-white transition-all duration-300 flex flex-col items-center group"
                                >
                                    <ChevronDown size={16} className="rotate-180 transition-transform group-hover:-translate-y-0.5" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Stats Bar - 增加上方內距避免遮擋計時器 */}
            <div className="relative z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 px-4 pt-6 pb-2 shadow-inner">
                <div className="max-w-7xl mx-auto grid grid-cols-2 gap-2">
                    {/* 現金 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800/50">
                        <div className="p-1.5 bg-blue-500/10 rounded-md shrink-0">
                            <Wallet size={14} className="text-blue-400" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter leading-none">現金</span>
                            <span className="text-sm font-black text-white leading-tight truncate">{formatMoney(gameState.cash)}</span>
                        </div>
                    </div>

                    {/* 理財收入 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800/50">
                        <div className="p-1.5 bg-emerald-500/10 rounded-md shrink-0">
                            <Landmark size={14} className="text-emerald-400" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter leading-none">理財收入</span>
                            <span className="text-sm font-black text-emerald-400 leading-tight truncate">+{formatMoney(summary.passiveIncome)}</span>
                        </div>
                    </div>

                    {/* 月結餘 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800/50">
                        <div className="p-1.5 bg-purple-500/10 rounded-md shrink-0">
                            <BarChart3 size={14} className="text-purple-400" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter leading-none">月結餘</span>
                            <span className={cn(
                                "text-sm font-black leading-tight truncate",
                                summary.monthlyCashflow >= 0 ? "text-emerald-400" : "text-rose-400"
                            )}>
                                {summary.monthlyCashflow >= 0 ? "+" : ""}{formatMoney(summary.monthlyCashflow)}
                            </span>
                        </div>
                    </div>

                    {/* 淨資產 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800/50">
                        <div className="p-1.5 bg-amber-500/10 rounded-md shrink-0">
                            <PieChart size={14} className="text-amber-400" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter leading-none">淨資產</span>
                            <span className={cn(
                                "text-sm font-black leading-tight truncate",
                                netAssets >= 0 ? "text-blue-400" : "text-rose-400"
                            )}>
                                {formatMoney(netAssets)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

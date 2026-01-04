import React, { useState, useEffect, useMemo } from 'react';
import { Star, Plane, GraduationCap, Trophy, TrendingUp, Wallet, BarChart3, PieChart, Landmark, HelpCircle, ChevronDown, Clock, Users, Home, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/ui';
import { getProfessionIcon } from '../common/IconHelpers';
import { cn, formatMoney } from '../../utils/gameUtils';
import { StockMarketModal } from '../transaction/StockMarketModal';
import { useRoom } from '../../context/RoomContext';

interface GameHeaderProps {
    gameState: any;
    summary: any;
    onShowRankList: () => void;
    onShowPromotion: () => void;
    onFinishGame: () => void;
    onShowStockMarket: () => void;
    onShowTutorial: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({ 
    gameState, 
    summary,
    onShowRankList, 
    onShowPromotion, 
    onFinishGame,
    onShowStockMarket,
    onShowTutorial
}) => {
    const { room, playerStates } = useRoom();
    const [showAircraftTooltip, setShowAircraftTooltip] = useState(false);
    const [showRoomInfo, setShowRoomInfo] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>('--:--');

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
        if (!room) return [];
        return room.members
            .filter(m => m.role === 'player')
            .map(m => ({
                ...m,
                happiness: playerStates[m.uid]?.happinessTotal || 0
            }))
            .sort((a, b) => b.happiness - a.happiness);
    }, [room, playerStates]);

    return (
        <header className="fixed top-0 left-0 right-0 z-40 flex flex-col">
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

                    <div className="flex gap-1 items-center h-8">
                        <Button
                            onClick={onShowTutorial}
                            className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-500 text-white border-none shadow-lg shadow-blue-900/40 flex items-center justify-center shrink-0 transition-all active:scale-95"
                            title="遊戲教學"
                        >
                            <span className="text-lg font-black leading-none select-none">?</span>
                        </Button>
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
                        <Button onClick={onFinishGame} className="h-8 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] px-2 flex items-center gap-1 shrink-0 shadow-lg shadow-yellow-900/20">
                            <Trophy size={12} />
                            <span className="font-bold whitespace-nowrap">評分</span>
                        </Button>
                    </div>
                </div>

                {/* 懸掛式倒數計時器 - 移至最外層容器並精確貼齊下緣 */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full flex items-center justify-center z-30">
                    <button
                        onClick={() => setShowRoomInfo(!showRoomInfo)}
                        className={cn(
                            "flex items-center gap-1 px-2.5 py-0.5 rounded-b-lg border-x border-b transition-all duration-300 active:scale-95 shadow-xl",
                            showRoomInfo 
                                ? "bg-blue-600 border-blue-400 text-white shadow-blue-900/40" 
                                : !room?.isTimerPaused 
                                    ? "bg-emerald-600/90 border-emerald-500 text-white animate-pulse"
                                    : "bg-slate-900/90 backdrop-blur-sm border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                        )}
                    >
                        <Clock size={9} className={cn(showRoomInfo || !room?.isTimerPaused ? "text-white" : "text-slate-500")} />
                        <span className="text-[9px] font-black tracking-wider tabular-nums">{timeLeft}</span>
                        <ChevronDown size={9} className={cn("transition-transform duration-300 opacity-60", showRoomInfo && "rotate-180 opacity-100")} />
                    </button>
                </div>

                {/* 下拉房間資訊面板 - 使用 Framer Motion 實現真實捲軸效果 */}
                <AnimatePresence>
                    {showRoomInfo && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute top-full left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-md z-[50] overflow-hidden"
                        >
                            <div className="bg-slate-900 border-x border-b border-blue-500/30 rounded-b-[2rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/5 overflow-hidden">
                                <div className="p-5 space-y-5">
                                    {/* 房間基本資訊 - 更加精緻的卡片感 */}
                                    <div className="flex items-center justify-between bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                                                <Home size={18} className="text-white" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-0.5">ROOM NAME</div>
                                                <div className="text-sm font-black text-white tracking-wide">{room?.name || '幸福流挑戰賽'}</div>
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
                                        <div className="grid gap-2">
                                            {sortedPlayers.map((player, index) => (
                                                <div key={player.uid} className="group flex items-center justify-between p-2.5 rounded-2xl border bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/60 transition-all duration-300">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <div className="w-9 h-9 rounded-xl border-2 border-slate-700 bg-slate-800 flex items-center justify-center overflow-hidden shadow-inner">
                                                                {player.photoURL ? (
                                                                    <img src={player.photoURL} alt={player.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Users size={16} className="text-slate-500" />
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-slate-200 group-hover:text-white transition-colors">{player.name}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Heart size={12} className="text-pink-500" fill="currentColor" />
                                                        <div className="px-2.5 py-0.5 rounded-full text-[11px] font-black tabular-nums shadow-sm bg-pink-500/10 text-pink-500 border border-pink-500/20">
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

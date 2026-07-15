import React, { useState, useEffect, useMemo } from 'react';
import { Star, Settings, Heart, LogOut, TrendingUp, HelpCircle, Trophy, Users, Home, ChevronDown, X, Dices } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getProfessionIcon } from '../common/IconHelpers';
import { cn, formatMoney } from '../../utils/gameUtils';
import { useRoom } from '../../context/RoomContext';
import { useAuth, isGM as checkIsGM } from '../../context/AuthContext';
import SafeImage from '../common/SafeImage';
import { IS_DEV_VERSION } from '../../constants/version';
import { DevSettingsModal } from '../modals/DevSettingsModal';
import { selectExperienceState } from '../../utils/experienceState';
import { isPresenceOnline } from '../../utils/presence';
import { getAudioSettings, setAudioSettings, AUDIO_SETTINGS_EVENT, AudioSettings } from '../../utils/audio';

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
    const { room, playerStates, presenceStates } = useRoom();
    const [showSettings, setShowSettings] = useState(false);
    const [showRoomInfo, setShowRoomInfo] = useState(false);
    const [showDevSettings, setShowDevSettings] = useState(false);
    const [audioSettings, setAudioSettingsState] = useState<AudioSettings>(() => getAudioSettings());
    const [timeLeft, setTimeLeft] = useState<string>('--:--');

    const isGM = user?.role === 'coach' || checkIsGM(user);

    useEffect(() => {
        const syncAudioSettings = (event: Event) => {
            const next = (event as CustomEvent<AudioSettings>).detail;
            setAudioSettingsState(next || getAudioSettings());
        };
        window.addEventListener(AUDIO_SETTINGS_EVENT, syncAudioSettings);
        return () => window.removeEventListener(AUDIO_SETTINGS_EVENT, syncAudioSettings);
    }, []);
    
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

    const boardTurnInfo = useMemo(() => {
        const experience = selectExperienceState({
            roomStatus: room?.status,
            isBoardGame: room?.isBoardGame,
            hostId: room?.hostId,
            members: room?.members,
            currentUid: user?.uid,
            boardState: room?.boardState,
        });
        if (experience.phase !== 'playing' || !experience.currentTurnUid) return null;

        const currentPresence = experience.currentTurnUid ? presenceStates?.[experience.currentTurnUid] : null;
        return {
            name: experience.isMyTurn ? '你' : experience.currentTurnName || '其他玩家',
            position: experience.turnPosition,
            participantCount: experience.participantCount,
            isMyTurn: experience.isMyTurn,
            pendingSkipTurns: experience.pendingSkipTurns,
            eventSummary: experience.eventSummary,
            isOnline: currentPresence ? isPresenceOnline(currentPresence) : null,
        };
    }, [room, presenceStates, user?.uid]);

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
        <header className="pointer-events-none fixed left-0 right-0 top-0 z-[120] flex flex-col pt-safe">
            {/* Top Profile Card HUD */}
            <div className="relative z-[300] w-full px-3 py-3">
                <div className="max-w-4xl mx-auto pointer-events-auto">
                    
                    {/* 懸浮名片主體 */}
                    <div className="player-surface relative z-[301] flex items-center gap-2.5 overflow-visible rounded-[24px] border bg-[#fffaf2]/96 p-2.5 shadow-[0_16px_36px_-22px_rgba(16,47,56,0.75)] backdrop-blur-xl sm:gap-3 sm:p-3">
                        
                        {/* 左側：職業頭像區 */}
                        {gameState.profession && (
                            <div 
                                className="shrink-0 relative group cursor-pointer"
                                onClick={onShowRankList}
                            >
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#f4e6d0] border-2 border-[#d8c29a] flex flex-col items-center justify-center shadow-inner group-hover:border-[#a9643a] transition-colors">
                                    {getProfessionIcon(gameState.profession.id, { size: 20, className: "text-[#a9643a] mb-0.5 sm:hidden" })}
                                    {getProfessionIcon(gameState.profession.id, { size: 24, className: "text-[#a9643a] mb-0.5 hidden sm:block" })}
                                    <div className="flex items-center gap-0.5">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Star
                                                key={i}
                                                size={8}
                                                className={cn(i < gameState.currentRankLevel ? 'text-[#b88a43] fill-[#b88a43]' : 'text-[#d8c29a]')}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 中央：雙軌進度條區 (幸福與財富) */}
                        <div className="flex-1 flex flex-col justify-center gap-2 sm:gap-3 overflow-hidden">
                            
                            {/* 上軌：幸福分數 (最醒目) */}
                            <div 
                                className="flex flex-col gap-1 cursor-pointer group"
                                onClick={onShowHappiness}
                            >
                                <div className="flex justify-between items-end">
                                    <div className="flex items-center gap-1">
                                        <Heart size={14} className="text-[#d94f83] fill-[#d94f83] group-hover:scale-110 transition-transform sm:w-4 sm:h-4" />
                                        <span className="text-[11px] sm:text-sm font-black text-[#bd4f73] tracking-wider whitespace-nowrap">幸福指數</span>
                                    </div>
                                    <span className="text-sm sm:text-lg font-black text-[#293a38] whitespace-nowrap">
                                        {gameState.happinessTotal} <span className="text-[10px] sm:text-xs text-[#8b7b68]">/ 100</span>
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-[#eadfca] rounded-full overflow-hidden shadow-inner border border-[#d8c29a]/60">
                                    <div 
                                        className="h-full bg-gradient-to-r from-[#c9655a] to-[#ef9a9a] rounded-full transition-all duration-1000"
                                        style={{ width: `${Math.min((gameState.happinessTotal / 100) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* 下軌：財務自由 */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] sm:text-xs font-black text-[#2e806d] tracking-wider whitespace-nowrap">財務自由</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-[8.5px] xs:text-[10px] sm:text-[11px] text-[#8b7b68] font-mono whitespace-nowrap">
                                            {formatMoney(passiveIncome)} / {formatMoney(totalExpenses)}
                                        </span>
                                        <span className={cn("text-xs sm:text-sm font-black ml-1", isFinanciallyFree ? "text-[#2e806d]" : "text-[#7a6958]")}>
                                            {financialFreedomProgress.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="h-1.5 w-full bg-[#eadfca] rounded-full overflow-hidden shadow-inner border border-[#d8c29a]/60">
                                    <div 
                                        className={cn("h-full rounded-full transition-all duration-1000", isFinanciallyFree ? "bg-gradient-to-r from-[#2e6570] to-[#5da58e]" : "bg-[#8eb49e]")}
                                        style={{ width: `${financialFreedomProgress}%` }}
                                    />
                                </div>
                            </div>

                        </div>

                        {/* 右側：金流數據與設定 */}
                        <div className="shrink-0 flex flex-col items-end justify-between h-full py-0.5 border-l border-[#d8c29a]/70 pl-2 sm:pl-4">
                            
                            {/* 現金與月結餘 */}
                            <div className="flex flex-col items-end mb-1">
                                <div className="text-[10px] text-[#8b7b68] font-bold mb-0.5">現金</div>
                                <div className="text-base sm:text-xl font-black text-[#293a38] leading-none tracking-tight whitespace-nowrap">{formatMoney(gameState.cash)}</div>
                                <div className={cn("text-[10px] sm:text-xs font-black mt-1.5", summary.monthlyCashflow >= 0 ? "text-[#2e806d]" : "text-[#b6544b]")}>
                                    {summary.monthlyCashflow >= 0 ? '+' : ''}{formatMoney(summary.monthlyCashflow)} <span className="text-[9px] text-[#8b7b68] font-normal">/月</span>
                                </div>
                            </div>

                            {/* 設定選單 */}
                            <div className="relative z-[1000] mt-auto">
                                <button
                                    onClick={() => setShowSettings(!showSettings)}
                                    aria-label={showSettings ? '關閉設定選單' : '開啟設定選單'}
                                    aria-expanded={showSettings}
                                    className={cn(
                                        "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                                        showSettings
                                            ? "bg-[#2e6570] text-white"
                                            : "bg-[#f4e6d0] text-[#7a6958] hover:text-[#293a38] hover:bg-[#ead7b8]"
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
                                            className="absolute right-0 top-full z-[1001] mt-2 isolate flex w-52 flex-col gap-1 rounded-2xl border border-[#d8c29a] bg-[#fffaf2] p-2 text-[#293a38] shadow-[0_20px_40px_-10px_rgba(16,47,56,0.45)]"
                                        >
                                            <div className="px-3 py-2 border-b border-[#ead7b8] mb-1 flex justify-between items-center">
                                                <span className="text-[10px] text-[#8b7b68] font-bold tracking-widest">房間倒數</span>
                                                <span className="text-xs font-mono text-[#293a38]">{timeLeft}</span>
                                            </div>
                                            <button
                                                onClick={() => setAudioSettingsState(setAudioSettings({ enabled: !audioSettings.enabled }))}
                                                aria-pressed={audioSettings.enabled}
                                                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f3e4cc] text-[#6f6253] hover:text-[#293a38] transition-colors text-sm font-bold"
                                            >
                                                <span>音效</span>
                                                <span className={audioSettings.enabled ? 'text-[#2e806d]' : 'text-[#8b7b68]'}>
                                                    {audioSettings.enabled ? '開啟' : '關閉'}
                                                </span>
                                            </button>
                                            <button onClick={() => { onFinishGame(); setShowSettings(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f3e4cc] text-[#6f6253] hover:text-[#293a38] transition-colors text-sm font-bold">
                                                <Trophy size={16} className="text-[#b88a43]" />
                                                結算評分
                                            </button>
                                            <button onClick={() => { onShowStockMarket(); setShowSettings(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f3e4cc] text-[#6f6253] hover:text-[#293a38] transition-colors text-sm font-bold">
                                                <TrendingUp size={16} className="text-[#2e806d]" />
                                                股市行情
                                            </button>
                                            <button onClick={() => { onShowTutorial(); setShowSettings(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f3e4cc] text-[#6f6253] hover:text-[#293a38] transition-colors text-sm font-bold">
                                                <HelpCircle size={16} className="text-[#2e6570]" />
                                                遊戲教學
                                            </button>
                                            <div className="h-px bg-[#ead7b8] my-1" />
                                            <button onClick={() => { setShowRoomInfo(true); setShowSettings(false); }} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#f3e4cc] text-[#6f6253] hover:text-[#293a38] transition-colors text-sm font-bold">
                                                <div className="flex items-center gap-3">
                                                    <Users size={16} className="text-[#2e6570]" />
                                                    房間玩家
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-[#8b7b68] font-mono">
                                                    {room?.id}
                                                    <ChevronDown size={14} className="rotate-[-90deg]" />
                                                </div>
                                            </button>
                                            {IS_DEV_VERSION && isGM && isDevMode && (
                                                <button onClick={() => { setShowDevSettings(true); setShowSettings(false); }} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[#8c5b2b] transition-colors hover:bg-[#f4e6d0]">
                                                    <Settings size={16} />
                                                    開發者設定
                                                </button>
                                            )}
                                            <div className="h-px bg-[#ead7b8] my-1" />
                                            <button onClick={() => { onLeaveRoom(); setShowSettings(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f5d9d0] text-[#b6544b] transition-colors text-sm font-bold">
                                                <LogOut size={16} />
                                                離開房間
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {boardTurnInfo && (
                        <div
                            aria-live="polite"
                            className={cn(
                                "relative z-[1] mt-2 rounded-2xl border px-3 py-2 shadow-[0_12px_26px_-18px_rgba(16,47,56,0.65)] backdrop-blur-xl transition-colors",
                                boardTurnInfo.isMyTurn
                                    ? "border-[#6aa98c] bg-[#e0f0e5] text-[#245d50]"
                                    : "border-[#d8c29a] bg-[#fffaf2]/96 text-[#293a38]"
                            )}
                        >
                            <div className="flex items-center gap-2 text-xs sm:text-sm">
                                <Dices size={16} className={boardTurnInfo.isMyTurn ? "text-emerald-300" : "text-amber-300"} />
                                <span className="font-bold text-[#8b7b68]">目前回合</span>
                                <strong className="min-w-0 truncate text-[#293a38]">{boardTurnInfo.name}</strong>
                                {boardTurnInfo.position && boardTurnInfo.participantCount > 0 && (
                                    <span className="shrink-0 text-[10px] font-bold text-[#8b7b68]">
                                        第 {boardTurnInfo.position}/{boardTurnInfo.participantCount} 位
                                    </span>
                                )}
                                {boardTurnInfo.isMyTurn && (
                                    <span className="shrink-0 rounded-full bg-[#b9dfc8] px-2 py-0.5 text-[10px] font-black text-[#245d50]">
                                        輪到你
                                    </span>
                                )}
                                <span className={cn(
                                    "shrink-0 text-[10px] font-bold",
                                    boardTurnInfo.isOnline === null ? "text-[#8b7b68]" : boardTurnInfo.isOnline ? "text-[#2e806d]" : "text-[#b6544b]"
                                )}>
                                    {boardTurnInfo.isOnline === null ? '連線同步中' : boardTurnInfo.isOnline ? '在線' : '已離線'}
                                </span>
                            </div>
                            {boardTurnInfo.eventSummary && (
                                <div className="mt-1 truncate pl-6 text-[10px] text-[#7a6958]" title={boardTurnInfo.eventSummary}>
                                    事件：{boardTurnInfo.eventSummary}
                                </div>
                            )}
                            {boardTurnInfo.pendingSkipTurns > 0 && (
                                <div className="mt-1 pl-6 text-[10px] font-black text-[#a9643a]">
                                    {boardTurnInfo.name} 下回合將暫停 {boardTurnInfo.pendingSkipTurns} 回合
                                </div>
                            )}
                        </div>
                    )}
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

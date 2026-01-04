import React, { useState, useMemo, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useAuth, getTitleColor, getUserTitle } from '../../context/AuthContext';
import { FinancialStatement } from '../../components/business/FinancialStatement';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { calculateFinancialSummary, formatMoney, cn } from '../../utils/gameUtils';
import { 
    Users, 
    AlertCircle, 
    RefreshCw, 
    Bell, 
    CheckCircle2,
    X,
    LayoutDashboard,
    ShieldAlert,
    TrendingUp,
    LogOut,
    LineChart,
    Clock,
    Plus,
    Minus,
    Play,
    Pause,
    RotateCcw,
    ChevronDown,
    Home,
    Heart,
    Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../services/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { STOCK_DATA, BUBBLE_BURST_CODES, STOCK_NAMES } from '../../constants';

export const CoachGameView: React.FC = () => {
    const { room, playerStates, leaveRoom, closeRoom, finishRoomGame, updateMarket, updateRoomTimer } = useRoom();
    const { user } = useAuth();

    console.log('CoachGameView 渲染 - 房間:', room?.id, '狀態:', room?.status, '玩家數:', Object.keys(playerStates).length);

    const [selectedPlayerUid, setSelectedPlayerUid] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSavingAll, setIsSavingAll] = useState(false);
    const [isPlayerListOpen, setIsPlayerListOpen] = useState(false); // 控制玩家列表收放
    const [isStockModalOpen, setIsStockModalOpen] = useState(false); // 控制股市面板
    const [stockCode, setStockCode] = useState('');
    const [isUpdatingMarket, setIsUpdatingMarket] = useState(false);
    const [confirmPublishData, setConfirmPublishData] = useState<{
        code: string;
        updates: Record<string, number>;
        isBubble: boolean;
    } | null>(null);

    // 通用確認彈窗狀態
    const [genericConfirm, setGenericConfirm] = useState<{
        title: string;
        description: string;
        onConfirm: () => void;
        type?: 'danger' | 'warning' | 'info';
    } | null>(null);

    // 遊戲倒數計時狀態
    const [timeLeft, setTimeLeft] = useState(room?.gameTimeLeft || 60 * 60);
    const [isPaused, setIsPaused] = useState(room?.isTimerPaused ?? true);
    const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);

    // 當房間數據更新時，同步本地計時器狀態
    useEffect(() => {
        if (room?.gameTimeLeft !== undefined) {
            // 只有當差距較大時才強制同步，避免秒數跳動感
            if (Math.abs(timeLeft - room.gameTimeLeft) > 2) {
                setTimeLeft(room.gameTimeLeft);
            }
        }
        if (room?.isTimerPaused !== undefined) {
            setIsPaused(room.isTimerPaused);
        }
    }, [room?.gameTimeLeft, room?.isTimerPaused]);

    // 處理倒數計時邏輯 (本地跑)
    useEffect(() => {
        let timer: any;
        if (!isPaused && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft(prev => {
                    const next = Math.max(0, prev - 1);
                    // 每 10 秒向 Firestore 同步一次，或者當計時結束時同步
                    if (next % 10 === 0 || next === 0) {
                        updateRoomTimer(next, isPaused);
                    }
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isPaused, timeLeft, updateRoomTimer]);

    const handleToggleTimer = () => {
        const newPaused = !isPaused;
        setIsPaused(newPaused);
        updateRoomTimer(timeLeft, newPaused);
    };

    const handleAdjustTime = (seconds: number) => {
        const newTime = Math.max(0, timeLeft + seconds);
        setTimeLeft(newTime);
        updateRoomTimer(newTime, isPaused);
    };

    const handleResetTimer = () => {
        const defaultTime = (room?.duration || 60) * 60;
        setTimeLeft(defaultTime);
        setIsPaused(true);
        updateRoomTimer(defaultTime, true);
    };

    interface RoomPlayer {
        uid: string;
        name: string;
        photoURL: string;
        role: 'player';
        isLeft: boolean;
        photoPosition?: string;
        photoScale?: string;
        [key: string]: any;
    }

    const renderPlayerAvatar = (player: RoomPlayer | null, className: string = "w-full h-full object-cover", isBanner: boolean = false) => {
        if (!player) return <span>👤</span>;
        
        const isCustom = player.photoURL?.startsWith('http') || player.photoURL?.startsWith('data:image');
        
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
                <img 
                    src={player.photoURL} 
                    className={className} 
                    alt={player.name}
                    style={{ 
                        objectPosition: `${position.x}% ${position.y}%`,
                        transform: `scale(${scale})`
                    }}
                />
            );
        }

        return (
            <span className={isBanner ? "" : "text-2xl"}>
                {player.photoURL === 'bee' ? '🐝' : '👤'}
            </span>
        );
    };

    const players = useMemo<RoomPlayer[]>(() => {
        const memberPlayers = room?.members.filter(m => m.role === 'player') || [];
        const stateUids = Object.keys(playerStates);
        
        // 合併 members 和 playerStates 的 UID，確保即使離開的玩家也能顯示
        const allUids = Array.from(new Set([
            ...memberPlayers.map(m => m.uid),
            ...stateUids
        ]));

        return allUids.map(uid => {
            const member = memberPlayers.find(m => m.uid === uid);
            const state = playerStates[uid];
            
            return {
                ...(member || {}),
                uid,
                name: member?.name || state?.profession?.title || '未知玩家',
                photoURL: member?.photoURL || 'bee',
                role: 'player' as const,
                isLeft: !member || member.isLeft // 只要不在 members 列表或標記為 isLeft 即視為已離開
            };
        });
    }, [room?.members, playerStates]);

    const selectedPlayer = useMemo(() => {
        return players.find(p => p.uid === selectedPlayerUid);
    }, [players, selectedPlayerUid]);

    const [showPublishSuccess, setShowPublishSuccess] = useState(false);
    const [successCode, setSuccessCode] = useState('');
    const [showRoomInfo, setShowRoomInfo] = useState(false);

    // 當選擇玩家時，記錄審計日誌
    useEffect(() => {
        if (selectedPlayerUid && user && user.role === 'coach') {
            const targetPlayer = players.find(p => p.uid === selectedPlayerUid);
            if (targetPlayer) {
                // 這裡暫時註解掉寫入 audit_logs，直到確定 Firestore Rules 允許寫入
                /*
                addDoc(collection(db, 'audit_logs'), {
                    coachId: user.uid,
                    coachName: user.name,
                    action: 'view_report',
                    targetPlayerId: selectedPlayerUid,
                    targetPlayerName: targetPlayer.name,
                    timestamp: serverTimestamp(),
                    roomId: room?.id
                }).catch(console.error);
                */
            }
        }
    }, [selectedPlayerUid, user, players, room?.id]);

    // 自動選擇第一個玩家
    useEffect(() => {
        if (!selectedPlayerUid && players.length > 0) {
            setSelectedPlayerUid(players[0].uid);
        }
    }, [players, selectedPlayerUid]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const selectedPlayerState = selectedPlayerUid ? playerStates[selectedPlayerUid] : null;
    
    const sortedPlayers = useMemo(() => {
        return players
            .map(p => ({
                ...p,
                happiness: playerStates[p.uid]?.happinessTotal || 0
            }))
            .sort((a, b) => {
                // 已離開的玩家排在最後
                if (a.isLeft && !b.isLeft) return 1;
                if (!a.isLeft && b.isLeft) return -1;
                return b.happiness - a.happiness;
            });
    }, [players, playerStates]);

    const selectedPlayerSummary = useMemo(() => {
        return selectedPlayerState ? calculateFinancialSummary(selectedPlayerState) : null;
    }, [selectedPlayerState]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            // 手動觸發一次房間數據獲取
            if (room?.id) {
                const roomDoc = await getDoc(doc(db, 'rooms', room.id));
                if (roomDoc.exists()) {
                    // 這裡其實不需要手動 setRoom，因為 onSnapshot 會處理
                    // 但主動 getDoc 可以確保連線正常並觸發快取更新
                    console.log('手動重新整理房間數據成功');
                }
            }
            // 模擬延遲讓使用者有感
            await new Promise(resolve => setTimeout(resolve, 600));
        } catch (error) {
            console.error('重新整理失敗:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const alerts = useMemo(() => {
        return Object.entries(playerStates).map(([uid, state]) => {
            const summary = calculateFinancialSummary(state);
            const player = players.find(p => p.uid === uid);
            if (summary.monthlyCashflow < 5000) {
                return {
                    uid,
                    name: player?.name || '未知玩家',
                    type: 'warning',
                    message: '現金流低於警戒值 (5,000 H)',
                    value: summary.monthlyCashflow
                };
            }
            if (state.cash < 10000) {
                return {
                    uid,
                    name: player?.name || '未知玩家',
                    type: 'danger',
                    message: '現金嚴重不足 (低於 10,000 H)',
                    value: state.cash
                };
            }
            return null;
        }).filter(Boolean);
    }, [playerStates, players]);

    const handleExit = async () => {
        setGenericConfirm({
            title: '離開房間',
            description: user?.uid === room?.hostId ? '確定要結束監控並關閉房間嗎？這將會中斷所有玩家的連線。' : '確定要結束監控並離開房間嗎？',
            type: user?.uid === room?.hostId ? 'danger' : 'warning',
            onConfirm: async () => {
                if (user?.uid === room?.hostId) {
                    await closeRoom();
                } else {
                    await leaveRoom();
                }
                setGenericConfirm(null);
            }
        });
    };

    const handleScore = async () => {
        setGenericConfirm({
            title: '遊戲結算',
            description: '確定要結束遊戲進行評分嗎？這將會把所有玩家導向評分畫面。',
            type: 'warning',
            onConfirm: async () => {
                await finishRoomGame();
                setGenericConfirm(null);
            }
        });
    };

    const handlePublishMarket = async () => {
        const upperCode = stockCode.toUpperCase().trim();
        if (!upperCode) return;

        const updates = STOCK_DATA[upperCode];
        const isBubble = BUBBLE_BURST_CODES.includes(upperCode);

        if (!updates && !isBubble) {
            alert('無效的股市代碼！');
            return;
        }

        // 改為顯示確認畫面，而不是 window.confirm
        setConfirmPublishData({
            code: upperCode,
            updates: updates || {},
            isBubble
        });
    };

    const executePublishMarket = async () => {
        if (!confirmPublishData) return;
        
        setIsUpdatingMarket(true);
        try {
            const publishedCode = confirmPublishData?.code || '';
            await updateMarket(confirmPublishData.updates, confirmPublishData.code, confirmPublishData.isBubble);
            
            setStockCode('');
            setConfirmPublishData(null);
            setIsStockModalOpen(false);
            setSuccessCode(publishedCode);
            setShowPublishSuccess(true);
        } catch (error: any) {
            alert(`發布失敗: ${error.message}`);
        } finally {
            setIsUpdatingMarket(false);
        }
    };

    const handleConfirmSave = async () => {
        if (!room || !players.length) return;
        
        setIsSavingAll(true);
        try {
            // 為每個玩家建立遊戲紀錄
            const savePromises = players.map(async (player) => {
                const state = playerStates[player.uid];
                if (!state) return;

                const summary = calculateFinancialSummary(state);
                
                // 這裡模擬 ScoreView 的積分計算邏輯，或者我們應該統一計算邏輯
                // 為了簡化，我們先儲存核心數據
                return addDoc(collection(db, 'game_records'), {
                    userId: player.uid,
                    userName: player.name,
                    profession: state.profession?.title,
                    cash: state.cash,
                    totalIncome: summary.totalIncome,
                    totalExpenses: summary.totalExpenses,
                    passiveIncome: summary.passiveIncome,
                    monthlyCashflow: summary.monthlyCashflow,
                    totalAssets: summary.totalAssets,
                    totalLiabilities: summary.totalLiabilities,
                    happinessTotal: state.happinessTotal,
                    roomId: room.id,
                    coachId: user?.uid,
                    coachName: user?.name,
                    createdAt: serverTimestamp(),
                    isCoachSaved: true
                });
            });

            await Promise.all(savePromises);
            
            // 審計日誌暫時註解，避免權限問題
            /*
            await addDoc(collection(db, 'audit_logs'), {
                coachId: user?.uid,
                coachName: user?.name,
                action: 'confirm_save_all',
                timestamp: serverTimestamp(),
                roomId: room.id
            });
            */

            alert('所有玩家紀錄已成功上傳！');
        } catch (error: any) {
            console.error('儲存紀錄失敗:', error);
            alert(`儲存失敗: ${error.message}`);
        } finally {
            setIsSavingAll(false);
        }
    };

    // 獲取顯示標題
    const displayTitle = useMemo(() => {
        // 1. 優先使用房間自定義名稱
        if (room?.name) {
            return room.name;
        }

        // 2. 次之從第一個玩家的資料中嘗試獲取報表名稱
        const firstPlayerState = Object.values(playerStates)[0];
        if (firstPlayerState?.reportName) {
            return firstPlayerState.reportName;
        }
        
        // 3. 預設名稱：執行日記20XX.XX.XX
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `執行日記${year}.${month}.${day}`;
    }, [room?.name, playerStates]);

    return (
        <div className="flex flex-col h-full bg-slate-950 text-white overflow-hidden relative">
            {/* Header */}
            <div className="h-16 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-40">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <ShieldAlert className="text-slate-900" size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-black tracking-tight">{displayTitle}</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                                Room: {room?.id}
                            </span>
                            <span className={`w-1.5 h-1.5 rounded-full ${room?.status === 'playing' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{room?.status === 'playing' ? '進行中' : '已結束'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-6 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700">
                        <div className="text-center">
                            <div className="text-[9px] text-slate-500 font-bold uppercase">總玩家數</div>
                            <div className="text-sm font-black">{players.length}</div>
                        </div>
                        <div className="w-px h-8 bg-slate-700" />
                        <div className="text-center">
                            <div className="text-[9px] text-slate-500 font-bold uppercase">異常警示</div>
                            <div className={`text-sm font-black ${alerts.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {alerts.length}
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleExit}
                        className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all border border-rose-500/20"
                    >
                        <LogOut size={20} />
                    </button>
                </div>

                {/* 懸掛式倒數計時器 (同步玩家畫面風格) */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full flex items-center justify-center z-30">
                    <button
                        onClick={() => setShowRoomInfo(!showRoomInfo)}
                        className={cn(
                            "flex items-center gap-1 px-2.5 py-0.5 rounded-b-lg border-x border-b transition-all duration-300 active:scale-95 shadow-xl",
                            showRoomInfo 
                                ? "bg-blue-600 border-blue-400 text-white shadow-blue-900/40" 
                                : !isPaused 
                                    ? "bg-emerald-600/90 border-emerald-500 text-white animate-pulse"
                                    : "bg-slate-900/90 backdrop-blur-sm border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                        )}
                    >
                        <Clock size={9} className={cn(showRoomInfo || !isPaused ? "text-white" : "text-slate-500")} />
                        <span className="text-[9px] font-black tracking-wider tabular-nums">{formatTime(timeLeft)}</span>
                        <ChevronDown size={9} className={cn("transition-transform duration-300 opacity-60", showRoomInfo && "rotate-180 opacity-100")} />
                    </button>
                </div>

                {/* 下拉房間資訊面板 (同步玩家畫面風格) */}
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
                                                                {renderPlayerAvatar(player as any, "w-full h-full object-cover")}
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
                                                <span className="text-2xl font-black text-blue-400 tabular-nums tracking-tighter drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">{formatTime(timeLeft)}</span>
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

            <div className="flex-1 flex min-h-0 relative">
                {/* Main Area: Financial Statement */}
                <div className="flex-1 flex flex-col bg-slate-950 relative min-w-0">
                    {/* Floating Avatar Menu - Mobile */}
                    {isPlayerListOpen && (
                        <>
                            {/* Backdrop for Menu */}
                            <div 
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] animate-in fade-in duration-300"
                                onClick={() => setIsPlayerListOpen(false)}
                            />
                            
                            {/* Avatars Popup Container */}
                            <div className="fixed right-4 bottom-32 z-[80] flex flex-col-reverse items-center gap-3 animate-in slide-in-from-bottom-8 duration-500">
                                {players.map((player, index) => {
                                    const isSelected = selectedPlayerUid === player.uid;
                                    const playerAlert = alerts.find(a => a?.uid === player.uid);
                                    const isLeft = player.isLeft;
                                    
                                    return (
                                        <button
                                            key={player.uid}
                                            onClick={() => {
                                                setSelectedPlayerUid(player.uid);
                                                setIsPlayerListOpen(false);
                                            }}
                                            className={`
                                                relative w-14 h-14 rounded-2xl shadow-2xl transition-all duration-300 transform
                                                flex items-center justify-center overflow-hidden border-2
                                                ${isSelected 
                                                    ? 'bg-amber-500 border-white scale-110' 
                                                    : 'bg-slate-800 border-slate-700 hover:border-amber-500/50'
                                                }
                                                ${isLeft ? 'opacity-40 grayscale bg-slate-900' : ''}
                                            `}
                                            style={{ 
                                                transitionDelay: `${index * 50}ms`
                                            }}
                                        >
                                            {renderPlayerAvatar(player)}
                                            
                                            {isLeft && (
                                                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                                                    <span className="text-[10px] font-black text-white/90 leading-none">已離開</span>
                                                </div>
                                            )}
                                            
                                            {playerAlert && !isLeft && (
                                                <div className="absolute top-0 right-0 w-4 h-4 bg-rose-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                                                    <AlertCircle size={10} className="text-white" />
                                                </div>
                                            )}

                                            {/* Player Name Tooltip-like label */}
                                            <div className="absolute right-16 px-3 py-1 bg-slate-800 text-white text-xs font-bold rounded-lg whitespace-nowrap border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                                {player.name} {isLeft && '(已離開)'}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Main Floating Toggle Button */}
                    <button 
                        onClick={() => setIsPlayerListOpen(!isPlayerListOpen)}
                        className={`fixed right-4 bottom-16 md:bottom-24 z-[90] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 active:scale-90 ${
                            isPlayerListOpen 
                            ? 'bg-slate-800 text-amber-500 rotate-90' 
                            : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        }`}
                    >
                        {isPlayerListOpen ? <X size={28} /> : <Users size={28} />}
                        
                        {/* Notification Badge if any alerts */}
                        {!isPlayerListOpen && alerts.length > 0 && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-slate-950 flex items-center justify-center animate-bounce">
                                {alerts.length}
                            </div>
                        )}
                    </button>

                    {selectedPlayerUid ? (
                        selectedPlayerState ? (
                            <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Player Summary Banner */}
                                <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-950 border-b border-slate-800 flex items-end justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-20 h-20 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-4xl shadow-2xl overflow-hidden relative ${
                                            selectedPlayer?.isLeft ? 'opacity-40 grayscale' : ''
                                        }`}>
                                            {renderPlayerAvatar(selectedPlayer, "w-full h-full object-cover rounded-xl", true)}
                                            
                                            {selectedPlayer?.isLeft && (
                                                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                                                    <span className="text-xs font-black text-white bg-slate-900/80 px-2 py-1 rounded-md">已離開</span>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h2 className="text-2xl font-black">
                                                    {selectedPlayer?.name}
                                                    {selectedPlayer?.isLeft && <span className="ml-2 text-sm font-bold text-slate-500">(已離開)</span>}
                                                </h2>
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider ${
                                                    getTitleColor(selectedPlayerState as any)
                                                }`}>
                                                    {getUserTitle(selectedPlayerState as any)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-slate-400 text-xs font-bold">
                                                <div className="flex items-center gap-1.5">
                                                    <LayoutDashboard size={14} className="text-amber-500" />
                                                    {selectedPlayerState.currentRankTitle || selectedPlayerState.profession?.title}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Heart size={14} className="text-pink-500 fill-pink-500" />
                                                    <span className="text-pink-500 font-black">{selectedPlayerState.happinessTotal}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                    {selectedPlayerSummary && (
                                        <FinancialStatement 
                                            gameState={selectedPlayerState} 
                                            summary={selectedPlayerSummary}
                                            hideNav={false}
                                            hideSummary={true}
                                            defaultShowDetails={true}
                                        />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
                                <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                                <p className="font-bold animate-pulse">等待玩家進入遊戲...</p>
                            </div>
                        )
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4">
                            <Users size={64} className="opacity-20" />
                            <p className="text-lg font-bold">請選擇一位玩家進行監控</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Stock Market Update Modal */}
            {isStockModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border-2 border-blue-500/50 w-full max-w-sm rounded-3xl shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] overflow-hidden flex flex-col">
                        {!confirmPublishData ? (
                            <div className="p-8 text-center space-y-6">
                                <div className="mx-auto w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center">
                                    <TrendingUp className="text-blue-500" size={48} />
                                </div>
                                
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-white tracking-tight">發布股市行情</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        請輸入要發布的股市代碼（如：N001, N025 等）
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        value={stockCode}
                                        onChange={(e) => setStockCode(e.target.value.toUpperCase())}
                                        placeholder="輸入代碼..."
                                        className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-center text-2xl font-black text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                                    />
                                    
                                    <div className="flex flex-col gap-3 pt-2">
                                        <button 
                                            onClick={handlePublishMarket}
                                            disabled={!stockCode.trim()}
                                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                                        >
                                            預覽發布
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setIsStockModalOpen(false);
                                                setStockCode('');
                                            }}
                                            className="w-full py-3 text-slate-400 hover:text-white font-bold text-sm transition-colors"
                                        >
                                            取消
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 text-center space-y-6">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xl font-black text-white">確認發布內容</h3>
                                    <span className="px-3 py-1 bg-blue-500/20 text-blue-500 rounded-lg text-sm font-black">
                                        代碼: {confirmPublishData.code}
                                    </span>
                                </div>

                                {confirmPublishData.isBubble ? (
                                    <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3">
                                        <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto">
                                            <AlertCircle className="text-rose-500" size={24} />
                                        </div>
                                        <div>
                                            <div className="text-rose-500 font-black text-lg">泡沫破裂警告</div>
                                            <div className="text-rose-400/80 text-xs font-medium">所有股票將受到劇烈影響</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                                        {/* 左側 A10-A40 */}
                                        <div className="space-y-2">
                                            {['A10', 'A20', 'A30', 'A40'].map(symbol => {
                                                const price = confirmPublishData.updates[symbol];
                                                if (price === undefined) return null;
                                                return (
                                                    <div key={symbol} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex flex-col items-center">
                                                        <div className="text-[10px] text-slate-500 font-bold mb-0.5">{STOCK_NAMES[symbol] || symbol}</div>
                                                        <div className="text-sm font-black text-emerald-500">{formatMoney(price)}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* 右側 B50-B80 */}
                                        <div className="space-y-2">
                                            {['B50', 'B60', 'B70', 'B80'].map(symbol => {
                                                const price = confirmPublishData.updates[symbol];
                                                if (price === undefined) return null;
                                                return (
                                                    <div key={symbol} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex flex-col items-center">
                                                        <div className="text-[10px] text-slate-500 font-bold mb-0.5">{STOCK_NAMES[symbol] || symbol}</div>
                                                        <div className="text-sm font-black text-emerald-500">{formatMoney(price)}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3 pt-2">
                                    <button 
                                        onClick={executePublishMarket}
                                        disabled={isUpdatingMarket}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {isUpdatingMarket ? (
                                            <>
                                                <RefreshCw size={20} className="animate-spin" />
                                                <span>發布中...</span>
                                            </>
                                        ) : (
                                            '確認並正式發布'
                                        )}
                                    </button>
                                    <button 
                                        onClick={() => setConfirmPublishData(null)}
                                        disabled={isUpdatingMarket}
                                        className="w-full py-3 text-slate-400 hover:text-white font-bold text-sm transition-colors"
                                    >
                                        返回修改
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 行情發布成功彈窗 */}
            {showPublishSuccess && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border-2 border-emerald-500/50 w-full max-w-sm rounded-3xl shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-8 text-center space-y-6">
                            <div className="relative mx-auto w-24 h-24">
                                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping duration-[2000ms]" />
                                <div className="relative w-full h-full bg-emerald-500/20 rounded-full flex items-center justify-center border-2 border-emerald-500/30">
                                    <CheckCircle2 className="text-emerald-500" size={56} />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white tracking-tight">行情發布成功！</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    股市行情代碼 <span className="text-emerald-400 font-bold">{successCode}</span> 已同步至所有玩家畫面
                                </p>
                            </div>

                            <div className="pt-2">
                                <button 
                                    onClick={() => setShowPublishSuccess(false)}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
                                >
                                    太棒了！
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {genericConfirm && (
                <ConfirmModal
                    title={genericConfirm.title}
                    description={genericConfirm.description}
                    type={genericConfirm.type}
                    onConfirm={genericConfirm.onConfirm}
                    onCancel={() => setGenericConfirm(null)}
                />
            )}

            {/* Timer Control Modal */}
            {isTimerModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border-2 border-amber-500/50 w-full max-w-sm rounded-3xl shadow-[0_0_50px_-12px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col">
                        <div className="p-8 text-center space-y-6">
                            <div className="mx-auto w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center">
                                <Clock className="text-amber-500" size={48} />
                            </div>
                            
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white tracking-tight">遊戲計時器控制</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    您可以暫停、繼續、重置或微調遊戲時間
                                </p>
                            </div>

                            <div className={cn(
                                "text-5xl font-black font-mono tracking-widest py-4 rounded-2xl border transition-all duration-300",
                                isPaused 
                                    ? "text-white bg-slate-800/50 border-slate-700" 
                                    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)]"
                            )}>
                                {formatTime(timeLeft)}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={handleToggleTimer}
                                    className={`col-span-2 py-4 rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                        isPaused 
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40' 
                                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40'
                                    }`}
                                >
                                    {isPaused ? <Play size={24} /> : <Pause size={24} />}
                                    {isPaused ? '開始計時' : '暫停計時'}
                                </button>
                                
                                <button 
                                    onClick={() => handleAdjustTime(60)}
                                    className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1"
                                >
                                    <Plus size={16} /> 1 分鐘
                                </button>
                                <button 
                                    onClick={() => handleAdjustTime(-60)}
                                    className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1"
                                >
                                    <Minus size={16} /> 1 分鐘
                                </button>
                                
                                <button 
                                    onClick={handleResetTimer}
                                    className="col-span-2 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold rounded-xl border border-rose-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <RotateCcw size={16} /> 重置為 {room?.duration || 60} 分鐘
                                </button>
                            </div>

                            <div className="pt-2">
                                <button 
                                    onClick={() => setIsTimerModalOpen(false)}
                                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-black text-lg rounded-2xl transition-all"
                                >
                                    關閉
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Bar: Quick Actions */}
            <div className="h-14 border-t border-slate-800 bg-slate-900 px-6 flex items-center justify-between shrink-0 relative">
                <div className="flex items-center gap-4">
                    {/* 遊戲倒數計時器 */}
                    <button 
                        onClick={() => setIsTimerModalOpen(true)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${
                            isPaused 
                            ? 'bg-slate-800 border-slate-700 text-slate-500' 
                            : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500 animate-pulse'
                        }`}
                    >
                        <Clock size={14} />
                        <span className="font-black text-xs tabular-nums tracking-wider">
                            {formatTime(timeLeft)}
                        </span>
                    </button>
                </div>

                {/* 中央結算按鈕 */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    {room?.status === 'playing' ? (
                        <button 
                            onClick={handleScore}
                            className="w-16 h-16 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full font-black text-xs transition-all flex flex-col items-center justify-center -mt-2 group active:scale-90 border-2 border-orange-500/50"
                            title="遊戲結算"
                        >
                            <ShieldAlert size={20} className="mb-0.5 group-hover:scale-110 transition-transform" />
                            <span>結算</span>
                        </button>
                    ) : (
                        <button 
                            onClick={handleConfirmSave}
                            disabled={isSavingAll}
                            className="w-16 h-16 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-white rounded-full font-black text-[10px] transition-all flex flex-col items-center justify-center -mt-2 group active:scale-90 border-2 border-orange-500/50"
                        >
                            <ShieldAlert size={20} className="mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="leading-tight">{isSavingAll ? '儲存中' : '儲存'}</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsStockModalOpen(true)}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-xs transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1.5"
                    >
                        <LineChart size={14} />
                        股市
                    </button>

                    <button 
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all disabled:opacity-50"
                        title="重新整理"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Timer Control Modal */}
            {isTimerModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border-2 border-amber-500/50 w-full max-w-sm rounded-3xl shadow-[0_0_50px_-12px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col">
                        <div className="p-8 text-center space-y-8">
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-black text-white tracking-tight">遊戲時間控制</h3>
                                <button onClick={() => setIsTimerModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="py-8 bg-slate-950/50 rounded-3xl border border-slate-800">
                                <div className="text-6xl font-black text-amber-500 tabular-nums tracking-tighter">
                                    {formatTime(timeLeft)}
                                </div>
                                <div className="text-slate-500 text-xs font-bold uppercase mt-2 tracking-widest">
                                    {isPaused ? '已暫停' : '計時中'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setIsPaused(!isPaused)}
                                    className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-lg transition-all active:scale-95 ${
                                        isPaused 
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40' 
                                        : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/40'
                                    }`}
                                >
                                    {isPaused ? <Play size={20} /> : <Pause size={20} />}
                                    {isPaused ? '開始' : '暫停'}
                                </button>
                                <button 
                                    onClick={() => {
                                        if (window.confirm('確定要重設時間嗎？')) {
                                            setTimeLeft(60 * 60);
                                            setIsPaused(true);
                                        }
                                    }}
                                    className="flex items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-lg transition-all active:scale-95 border border-slate-700"
                                >
                                    <RotateCcw size={20} />
                                    重設
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="text-slate-500 text-xs font-bold uppercase tracking-widest text-left px-1">調整時間</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <button 
                                            onClick={() => setTimeLeft(prev => prev + 60)}
                                            className="flex items-center justify-center gap-2 py-3 bg-slate-800/50 hover:bg-slate-800 text-emerald-500 rounded-xl font-bold transition-all border border-slate-800"
                                        >
                                            <Plus size={16} /> 1 分鐘
                                        </button>
                                        <button 
                                            onClick={() => setTimeLeft(prev => Math.max(0, prev - 60))}
                                            className="flex items-center justify-center gap-2 py-3 bg-slate-800/50 hover:bg-slate-800 text-rose-500 rounded-xl font-bold transition-all border border-slate-800"
                                        >
                                            <Minus size={16} /> 1 分鐘
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button 
                                            onClick={() => setTimeLeft(prev => prev + 300)}
                                            className="flex items-center justify-center gap-2 py-3 bg-slate-800/50 hover:bg-slate-800 text-emerald-500 rounded-xl font-bold transition-all border border-slate-800"
                                        >
                                            <Plus size={16} /> 5 分鐘
                                        </button>
                                        <button 
                                            onClick={() => setTimeLeft(prev => Math.max(0, prev - 300))}
                                            className="flex items-center justify-center gap-2 py-3 bg-slate-800/50 hover:bg-slate-800 text-rose-500 rounded-xl font-bold transition-all border border-slate-800"
                                        >
                                            <Minus size={16} /> 5 分鐘
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #334155;
                }
            `}</style>
        </div>
    );
};

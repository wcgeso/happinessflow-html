import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useAuth, getPlayerBadge } from '../../context/AuthContext';
import { FinancialStatement } from '../../components/business/FinancialStatement';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { calculateFinancialSummary, calculateScoreResult, formatMoney, cn } from '../../utils/gameUtils';
import { safeAsync } from '../../utils/utils';
import { ScoreView } from '../game/ScoreView';
import { StockMarketModal } from '../../components/transaction/StockMarketModal';
import { HappinessListModal } from '../../components/modals/HappinessListModal';
import SafeImage from '../../components/common/SafeImage';
import {
    Users,
    AlertCircle,
    RefreshCw,
    CheckCircle2,
    X,
    ShieldAlert,
    TrendingUp,
    LogOut,
    LineChart,
    Clock,
    Database,
    Plus,
    Minus,
    Play,
    Pause,
    RotateCcw,
    ChevronDown,
    Home,
    Heart,
    Settings,
    Rocket
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../services/firebase';
import { setDoc, serverTimestamp, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { STOCK_DATA, BUBBLE_BURST_CODES, STOCK_NAMES } from '../../constants';

export const CoachGameView: React.FC = () => {
    const { room, playerStates, leaveRoom, closeRoom, finishRoomGame, updateMarket, updateRoomTimer, approveRequest, rejectRequest } = useRoom();
    const { user } = useAuth();

    console.log('CoachGameView 渲染 - 房間:', room?.id, '狀態:', room?.status, '待審核數:', room?.pendingRequests ? Object.keys(room.pendingRequests).length : 0);

    const [selectedPlayerUid, setSelectedPlayerUid] = useState<string | null>(null);
    const [direction, setDirection] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSavingAll, setIsSavingAll] = useState(false);
    const [isPlayerListOpen, setIsPlayerListOpen] = useState(false); // 控制玩家列表收放
    const [isStockModalOpen, setIsStockModalOpen] = useState(false); // 控制股市面板
    const [isMarketViewOpen, setIsMarketViewOpen] = useState(false); // 控制股市行情查看
    const [isHappinessModalOpen, setIsHappinessModalOpen] = useState(false); // 控制幸福清單查看
    const [stockCode, setStockCode] = useState('');
    const [isUpdatingMarket, setIsUpdatingMarket] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

    // 檢查 localStorage 是否已有紀錄
    useEffect(() => {
        if (room?.id) {
            const isRecorded = localStorage.getItem(`score_recorded_${room.id}`);
            if (isRecorded) {
                setUploadStatus('success');
            }
        }
    }, [room?.id]);

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
    const [isTimerPanelOpen, setIsTimerPanelOpen] = useState(false);

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

    // 取得當前待審核的請求
    const pendingRequest = useMemo(() => {
        if (!room?.pendingRequests) return null;
        const requests = Object.values(room.pendingRequests)
            .filter(r => r.status === 'pending')
            .sort((a, b) => a.timestamp - b.timestamp);
        
        if (requests.length > 0) {
            console.log('執行師端偵測到請求:', requests[0].playerName, requests[0].type, requests[0].amount);
        }
        
        return requests[0];
    }, [room?.pendingRequests]);

    // 倒數計時邏輯
    useEffect(() => {
        let timer: NodeJS.Timeout;
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

    // 遊戲時間到自動存檔邏輯
    const prevTimeLeftRef = useRef(timeLeft);
    useEffect(() => {
        if (timeLeft === 0 && prevTimeLeftRef.current > 0) {
            console.log('[自動存檔] 遊戲時間到，執行最終存檔');
            saveRecords(true, true); // 靜默存檔
            setIsPaused(true);
        }
        prevTimeLeftRef.current = timeLeft;
    }, [timeLeft]);

    const handleStartGame = async () => {
        if (!room?.id) return;
        try {
            // 開始計時並更新房間狀態
            setIsPaused(false);
            await updateRoomTimer(timeLeft, false);
            // 如果需要更新房間狀態為 playing
            if (room.status === 'waiting') {
                const roomRef = doc(db, 'rooms', room.id);
                await safeAsync(setDoc(roomRef, { status: 'playing' }, { merge: true }));
            }
        } catch (error) {
            console.error('開始遊戲失敗:', error);
        }
    };

    const displayRoomName = useMemo(() => {
        if (room?.name) return room.name;
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        return `執行日記${yy}${mm}${dd}`;
    }, [room?.name]);

    const handleToggleTimer = () => {
        if (timeLeft === 0) return; // 時間到不能再操作
        const newPaused = !isPaused;
        setIsPaused(newPaused);
        updateRoomTimer(timeLeft, newPaused);
    };

    const handleAdjustTime = (seconds: number) => {
        if (timeLeft === 0) return; // 時間到不能再操作
        const newTime = Math.max(0, timeLeft + seconds);
        setTimeLeft(newTime);
        updateRoomTimer(newTime, isPaused);
    };

    const handleResetTimer = () => {
        if (timeLeft === 0) return; // 時間到不能再操作
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
                {(!player.photoURL || player.photoURL === 'bee') ? '🐝' : '👤'}
            </span>
        );
    };

    const players = useMemo<RoomPlayer[]>(() => {
        // 只要不是房主，都視為玩家（包含以玩家身份加入的執行師）
        const memberPlayers = room?.members.filter(m => m.uid !== room?.hostId) || [];
        const stateUids = Object.keys(playerStates);

        // 合併 members 和 playerStates 的 UID，確保即使離開的玩家也能顯示
        const allUids = Array.from(new Set([
            ...memberPlayers.map(m => m.uid),
            ...stateUids
        ]));

        return allUids.map(uid => {
            const member = memberPlayers.find(m => m.uid === uid);
            const state = playerStates[uid];

            // 永遠優先使用玩家加入時的名稱（ID），即便離開也要顯示
            const displayName = member?.name || state?.playerName || state?.profession?.title || '未知玩家';

            return {
                ...(member || {}),
                uid,
                name: displayName,
                photoURL: member?.photoURL || 'bee',
                role: 'player' as const,
                isLeft: !member || member.isLeft
            };
        });
    }, [room?.members, room?.hostId, playerStates]);

    const selectedPlayer = useMemo(() => {
        return players.find(p => p.uid === selectedPlayerUid);
    }, [players, selectedPlayerUid]);

    const allPlayersReady = useMemo(() => {
        const activePlayers = players.filter(p => !p.isLeft);
        if (activePlayers.length === 0) return false;
        return activePlayers.every(p => playerStates[p.uid]?.isSetup);
    }, [players, playerStates]);

    const [showPublishSuccess, setShowPublishSuccess] = useState(false);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [showBubbleAlert, setShowBubbleAlert] = useState(false);
    const [successCode, setSuccessCode] = useState('');
    const [successPrices, setSuccessPrices] = useState<Record<string, number>>({});
    const [showRoomInfo, setShowRoomInfo] = useState(false);

    // 監控股市泡沫化
    useEffect(() => {
        if (!room?.marketPrices) return;

        const prices = Object.values(room.marketPrices);
        if (prices.length < 8) return;

        let totalDrop = 0;
        let count = 0;

        Object.entries(room.marketPrices).forEach(([code, price]) => {
            const stockInfo = STOCK_DATA[code];
            if (stockInfo) {
                const basePrices = Object.values(stockInfo);
                const basePrice = Math.max(...basePrices);
                const drop = (basePrice - price) / basePrice;
                totalDrop += drop;
                count++;
            }
        });

        if (count >= 8 && (totalDrop / count) > 0.7) {
            setShowBubbleAlert(true);
            const timer = setTimeout(() => setShowBubbleAlert(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [room?.marketPrices]);

    const saveRecords = async (isFinal: boolean = false, isSilent: boolean = false) => {
        if (!room || !user || !players.length) return;

        if (!isSilent) console.log(`[存檔] 執行紀錄存檔中... (是否為結算: ${isFinal})`);

        try {
            // 整理所有玩家的積分數據
            const playersData = players.map(player => {
            const state = playerStates[player.uid];
            if (!state) return null;

            const summary = calculateFinancialSummary(state);
            const result = calculateScoreResult(state, summary);

            // 確保 income 中包含 salary 欄位
            const income = { ...state.income };
            if (!income.salary && state.profession) {
                income.salary = state.profession.salary;
            }

            return {
                uid: player.uid,
                name: player.name,
                profession: state.currentRankTitle || state.profession?.title || 'Unknown',
                professionData: state.profession, // 儲存完整的職業對象供歷史紀錄還原
                happiness: state.happinessTotal,
                cash: state.cash,
                assets: state.assets || [],
                liabilities: state.liabilities || [],
                income: income,
                expenses: state.expenses || {},
                history: state.history || [],
                happinessItems: state.happiness || [],
                loans: state.loans || 0,
                totalScore: result.totalScore,
                summary: summary // 儲存結算時的財務摘要
            };
        }).filter(Boolean);

            // 使用房間 sessionId 作為唯一紀錄 ID，確保同一個房間 session 覆蓋更新
            const recordId = room.sessionId || `${room.id}_${room.createdAt?.seconds || Math.floor(Date.now() / 1000)}`;
            const playerUids = playersData.map(p => p.uid);

            // 1. 儲存至歷史紀錄 (score_records)
            const scoreData = {
                roomId: room.id,
                roomName: room.name || '未命名房間',
                sessionId: recordId,
                settledAt: serverTimestamp(),
                gameTime: `${room.duration || 0} 分鐘`,
                coach: user?.name || 'Unknown Coach',
                coachId: user?.uid || '', // 增加 coachId 方便查詢
                players: playersData,
                playerUids, // 增加 playerUids 方便查詢
                isFinal,
                updatedAt: serverTimestamp()
            };
            await safeAsync(setDoc(doc(db, 'score_records', 'S1', 'records', recordId), scoreData));

            // 2. 儲存執行師帶領紀錄 (coach_records)
            const coachRecord = {
                date: new Date().toISOString(),
                roomCode: room.id || 'UNKNOWN',
                roomName: room.name || '未命名房間',
                playerCount: players.length,
                duration: room.duration || 0,
                coachId: user?.uid || '',
                coachName: user?.name || 'Unknown',
                timestamp: Date.now(),
                isFinal,
                players: playersData.map(p => ({
                    name: p.name,
                    profession: p.profession,
                    happiness: p.happiness,
                    score: p.totalScore,
                    isWin: p.happiness >= 100
                })),
                updatedAt: serverTimestamp()
            };
            await safeAsync(setDoc(doc(db, 'coach_records', recordId), coachRecord));

            // 3. 更新每位玩家的累計積分 (experience) - 僅在最終結算時
            if (isFinal) {
                await Promise.all(playersData.map(async (player) => {
                    if (!player.uid) return;
                    const userRef = doc(db, 'users', player.uid);
                    try {
                        await safeAsync(updateDoc(userRef, {
                            experience: increment(player.totalScore),
                            rankScore: increment(player.totalScore)
                        }));
                    } catch (e) {
                        console.error(`Failed to update experience for user ${player.uid}`, e);
                    }
                }));
            }

            if (!isSilent) {
                setUploadStatus('success');
            }
            
            if (room.id && isFinal) {
                localStorage.setItem(`score_recorded_${room.id}`, 'true');
            }

            if (!isSilent) {
                setShowSaveSuccess(true);
                setTimeout(() => setShowSaveSuccess(false), 2000);
            }

            if (!isSilent) console.log(`[存檔] 存檔成功 (ID: ${recordId})`);
        } catch (error) {
            console.error('儲存紀錄失敗:', error);
            if (isFinal && !isSilent) {
                setUploadStatus('error');
                alert(`儲存失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
            }
        }
    };

    // 當房間狀態變更為 finished 時，執行師自動觸發存檔
    useEffect(() => {
        if (room?.status === 'finished' && user?.uid === room?.hostId && uploadStatus === 'idle') {
            console.log('[自動存檔] 偵測到遊戲結束，執行最終存檔');
            saveRecords(true, true);
        }
    }, [room?.status, user?.uid, room?.hostId, uploadStatus]);

    // 遊戲自動存檔邏輯：開始時存一次，之後每兩分鐘存一次
    useEffect(() => {
        if (!room || room.status !== 'playing' || user?.uid !== room.hostId) return;

        // 1. 遊戲剛開始時存一次 (如果有 startedAt 且跟目前時間很近)
        const now = Date.now();
        const startedAt = room.startedAt || 0;
        const isJustStarted = Math.abs(now - startedAt) < 10000; // 10秒內視為剛開始

        if (isJustStarted) {
            console.log('[自動存檔] 遊戲開始初始存檔');
            saveRecords(false, true);
        }

        // 2. 每兩分鐘定時存檔
        const interval = setInterval(() => {
            console.log('[自動存檔] 兩分鐘定時存檔觸發');
            saveRecords(false, true);
        }, 2 * 60 * 1000);

        return () => clearInterval(interval);
    }, [room?.status, room?.startedAt, user?.uid, room?.hostId]);

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

    const slideVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? '50%' : '-50%',
            opacity: 0,
            scale: 0.98
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? '50%' : '-50%',
            opacity: 0,
            scale: 0.98
        })
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            // 手動觸發一次房間數據獲取
            if (room?.id) {
                const roomDoc = await safeAsync(getDoc(doc(db, 'rooms', room.id)));
                if (roomDoc && roomDoc.exists()) {
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
                // 不自動存檔，改由執行師手動觸發
                setUploadStatus('idle'); // 重置上傳狀態，確保出現儲存按鈕
                await finishRoomGame();
                // 立即嘗試存檔一次，確保狀態有被捕捉
                saveRecords(true, true);
                setGenericConfirm(null);
            }
        });
    };

    const handlePlayerSwipe = (event: any, info: any) => {
        const swipeThreshold = window.innerWidth / 7;

        // 降低對垂直位移的限制，優先允許水平切換
        if (Math.abs(info.offset.y) > Math.abs(info.offset.x) * 1.5) return;

        if (players.length <= 1) return;

        const currentIndex = players.findIndex(p => p.uid === selectedPlayerUid);
        if (currentIndex === -1) return;

        if (info.offset.x < -swipeThreshold) {
            // Swipe Left -> Next Player (slides in from right)
            setDirection(1);
            const nextIndex = (currentIndex + 1) % players.length;
            setSelectedPlayerUid(players[nextIndex].uid);
        } else if (info.offset.x > swipeThreshold) {
            // Swipe Right -> Previous Player (slides in from left)
            setDirection(-1);
            const prevIndex = (currentIndex - 1 + players.length) % players.length;
            setSelectedPlayerUid(players[prevIndex].uid);
        }
    };

    const handlePublishMarket = async () => {
        const upperCode = stockCode.toUpperCase().trim();
        if (!upperCode) return;

        const updates = STOCK_DATA[upperCode];
        let isBubble = BUBBLE_BURST_CODES.includes(upperCode);

        if (!updates && !isBubble) {
            alert('無效的股市代碼！');
            return;
        }

        // 檢查是否觸發泡沫化條件：總市值跌幅 >= 65%
        if (updates && !isBubble) {
            let totalPrevPrice = 0;
            let totalCurrentPrice = 0;
            let count = 0;

            const symbols = Object.keys(updates);

            symbols.forEach(symbol => {
                const prevPrice = room?.marketPrices?.[symbol] || 0;

                // 只有當前值存在時才納入計算
                if (prevPrice > 0) {
                    const currentPrice = updates[symbol];
                    totalPrevPrice += prevPrice;
                    totalCurrentPrice += currentPrice;
                    count++;
                }
            });

            // 只有當至少有數據可比對時才計算
            if (count > 0 && totalPrevPrice > 0) {
                // 計算市場總價值的跌幅
                const marketDrop = (totalPrevPrice - totalCurrentPrice) / totalPrevPrice;

                console.log(`[泡沫化檢查] 前次總市值=${totalPrevPrice}, 本次總市值=${totalCurrentPrice}, 市場跌幅=${(marketDrop * 100).toFixed(2)}% (門檻: 65%)`);

                if (marketDrop >= 0.65) {
                    isBubble = true;
                    console.log('[泡沫化檢查] 觸發泡沫化！');
                }
            }
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

            // 股市更新後立即自動存檔，確保歷史紀錄捕捉到資產變動
            saveRecords(false, true);

            setStockCode('');
            setConfirmPublishData(null);
            setIsStockModalOpen(false);
            setSuccessCode(publishedCode);
            // 直接使用剛發布的價格，而不是等待 room.marketPrices 更新
            setSuccessPrices(confirmPublishData.updates);
            setShowPublishSuccess(true);
        } catch (error: any) {
            alert(`發布失敗: ${error.message}`);
        } finally {
            setIsUpdatingMarket(false);
        }
    };

    const handleConfirmSave = async () => {
        if (!room || !players.length || uploadStatus === 'success') return;

        setIsSavingAll(true);
        setUploadStatus('uploading');
        try {
            await saveRecords(true);
        } catch (error: any) {
            console.error('結算儲存失敗:', error);
            setUploadStatus('error');
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
        <div className="flex flex-col h-full bg-slate-950 text-white overflow-hidden relative pt-safe pb-safe">
            {/* Header */}
            <div className="h-16 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-40">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <ShieldAlert className="text-slate-900" size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-black tracking-tight">{displayTitle}</h1>
                            <span className={cn(
                                "w-1.5 h-1.5 rounded-full ml-1 transition-all duration-500",
                                (room?.status === 'playing' && !isPaused) ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-slate-500"
                            )} />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                {room?.status === 'playing' ? (isPaused ? '計時暫停' : '正在計時') : '已結束'}
                            </span>
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
                            "flex items-center gap-1 px-3 py-1 rounded-b-xl border-x border-b transition-all duration-500 active:scale-95 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.5)]",
                            (!isPaused && timeLeft > 0)
                                ? "bg-emerald-500 border-emerald-400 text-white"
                                : showRoomInfo
                                    ? "bg-blue-600 border-blue-400 text-white shadow-blue-900/40"
                                    : "bg-slate-900/90 backdrop-blur-sm border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                        )}
                    >
                        <div className="flex items-center gap-1.5">
                            <span className={cn(
                                "text-[10px] font-black tracking-widest transition-colors duration-300",
                                (!isPaused && timeLeft > 0) ? "text-white/90" : "text-white/60"
                            )}>
                                房號 {room?.id}
                            </span>
                            <div className={cn(
                                "w-px h-2.5 transition-colors duration-300",
                                (!isPaused && timeLeft > 0) ? "bg-white/40" : "bg-white/20"
                            )} />
                            <Clock size={11} className={cn(
                                "transition-colors duration-300",
                                (!isPaused && timeLeft > 0) ? "text-white" : showRoomInfo ? "text-white" : "text-slate-500"
                            )} />
                            <span className={cn(
                                "text-[10px] font-black tracking-wider tabular-nums transition-colors duration-300",
                                (!isPaused && timeLeft > 0) ? "text-white" : (showRoomInfo ? "text-white" : "text-slate-400")
                            )}>
                                {formatTime(timeLeft)}
                            </span>
                        </div>
                        <ChevronDown size={11} className={cn("transition-transform duration-300", showRoomInfo && "rotate-180")} />
                    </button>
                </div>

                {/* 右上角懸掛式時間控制計時器 */}
                <div className="absolute right-6 top-full flex flex-col items-end z-[50]">
                    <button
                        onClick={() => setIsTimerPanelOpen(!isTimerPanelOpen)}
                        className={cn(
                            "flex items-center justify-center w-8 h-6 rounded-b-lg border-x border-b transition-all duration-300 active:scale-95 shadow-xl",
                            isTimerPanelOpen
                                ? "bg-amber-600 border-amber-400 text-white shadow-amber-900/40"
                                : "bg-slate-900/90 backdrop-blur-sm border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                        )}
                    >
                        <Settings size={10} className={cn(isTimerPanelOpen ? "text-white" : "text-slate-500", "transition-transform duration-500", isTimerPanelOpen && "rotate-90")} />
                    </button>

                    {/* 下拉控制面板 */}
                    <AnimatePresence>
                        {isTimerPanelOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0, y: -10 }}
                                animate={{ height: 'auto', opacity: 1, y: 0 }}
                                exit={{ height: 0, opacity: 0, y: -10 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                            >
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">時間控制</span>
                                        <div className="flex items-center gap-1">
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full transition-all duration-500",
                                                !isPaused ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-slate-500"
                                            )} />
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-wider",
                                                !isPaused ? "text-emerald-400" : "text-slate-500"
                                            )}>
                                                {!isPaused ? '正在計時' : '已暫停'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center py-2 bg-slate-800/30 rounded-xl border border-slate-800/50">
                                        <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
                                            {formatTime(timeLeft)}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => {
                                                if (window.confirm('確定要重設時間嗎？')) {
                                                    handleResetTimer();
                                                }
                                            }}
                                            disabled={timeLeft === 0}
                                            className={cn(
                                                "flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all border shadow-lg",
                                                timeLeft === 0
                                                    ? "bg-slate-800/50 text-slate-500 border-slate-700/50 cursor-not-allowed"
                                                    : "bg-slate-800 hover:bg-slate-700 text-white border-slate-700 active:scale-95"
                                            )}
                                        >
                                            <RotateCcw size={16} />
                                            重設
                                        </button>
                                        <button
                                            onClick={handleToggleTimer}
                                            disabled={timeLeft === 0}
                                            className={cn(
                                                "flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all shadow-lg",
                                                timeLeft === 0
                                                    ? "bg-slate-800/50 text-slate-500 border border-slate-700/50 cursor-not-allowed"
                                                    : isPaused
                                                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20 active:scale-95"
                                                        : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20 active:scale-95"
                                            )}
                                        >
                                            {isPaused ? <Play size={16} /> : <Pause size={16} />}
                                            {isPaused ? '開始' : '暫停'}
                                        </button>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-slate-800/50">
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => handleAdjustTime(-5)}
                                                disabled={timeLeft === 0}
                                                className={cn(
                                                    "flex items-center justify-center gap-1 py-2 rounded-lg font-bold text-[11px] transition-all",
                                                    timeLeft === 0
                                                        ? "bg-slate-800/10 text-slate-600 cursor-not-allowed"
                                                        : "bg-slate-800/30 hover:bg-slate-800 text-rose-500"
                                                )}
                                            >
                                                <Minus size={12} /> 5s
                                            </button>
                                            <button
                                                onClick={() => handleAdjustTime(5)}
                                                disabled={timeLeft === 0}
                                                className={cn(
                                                    "flex items-center justify-center gap-1 py-2 rounded-lg font-bold text-[11px] transition-all",
                                                    timeLeft === 0
                                                        ? "bg-slate-800/10 text-slate-600 cursor-not-allowed"
                                                        : "bg-slate-800/30 hover:bg-slate-800 text-emerald-500"
                                                )}
                                            >
                                                <Plus size={12} /> 5s
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => handleAdjustTime(-60)}
                                                disabled={timeLeft === 0}
                                                className={cn(
                                                    "flex items-center justify-center gap-1 py-2 rounded-lg font-bold text-[11px] transition-all",
                                                    timeLeft === 0
                                                        ? "bg-slate-800/10 text-slate-600 cursor-not-allowed"
                                                        : "bg-slate-800/30 hover:bg-slate-800 text-rose-500"
                                                )}
                                            >
                                                <Minus size={12} /> 1m
                                            </button>
                                            <button
                                                onClick={() => handleAdjustTime(60)}
                                                disabled={timeLeft === 0}
                                                className={cn(
                                                    "flex items-center justify-center gap-1 py-2 rounded-lg font-bold text-[11px] transition-all",
                                                    timeLeft === 0
                                                        ? "bg-slate-800/10 text-slate-600 cursor-not-allowed"
                                                        : "bg-slate-800/30 hover:bg-slate-800 text-emerald-500"
                                                )}
                                            >
                                                <Plus size={12} /> 1m
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => handleAdjustTime(-300)}
                                                disabled={timeLeft === 0}
                                                className={cn(
                                                    "flex items-center justify-center gap-1 py-2 rounded-lg font-bold text-[11px] transition-all",
                                                    timeLeft === 0
                                                        ? "bg-slate-800/10 text-slate-600 cursor-not-allowed"
                                                        : "bg-slate-800/30 hover:bg-slate-800 text-rose-500"
                                                )}
                                            >
                                                <Minus size={12} /> 5m
                                            </button>
                                            <button
                                                onClick={() => handleAdjustTime(300)}
                                                disabled={timeLeft === 0}
                                                className={cn(
                                                    "flex items-center justify-center gap-1 py-2 rounded-lg font-bold text-[11px] transition-all",
                                                    timeLeft === 0
                                                        ? "bg-slate-800/10 text-slate-600 cursor-not-allowed"
                                                        : "bg-slate-800/30 hover:bg-slate-800 text-emerald-500"
                                                )}
                                            >
                                                <Plus size={12} /> 5m
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

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
                                        <div className="grid gap-2 max-h-[40vh] overflow-y-auto pr-1 no-scrollbar">
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
                                                        <Clock size={20} className="text-blue-400" />
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

            {(!allPlayersReady || room?.status === 'waiting') ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950 relative overflow-hidden">
                    {/* 背景裝飾 */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-[100px] animate-pulse" />

                    <div className="relative z-10 max-w-md w-full">
                        <div className="mb-8 relative inline-block">
                            <div className="w-24 h-24 bg-amber-500/10 rounded-3xl flex items-center justify-center animate-bounce duration-1000">
                                <Users size={48} className="text-amber-500" />
                            </div>
                            <div className="absolute -top-2 -right-2">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
                                </div>
                            </div>
                        </div>

                        <h2 className="text-3xl font-black text-white mb-10 tracking-tight">等待玩家中...</h2>

                        {/* 玩家準備進度 */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm text-left">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">當前準備進度</span>
                                <span className="text-xs font-black text-amber-500">
                                    {players.filter(p => !p.isLeft && playerStates[p.uid]?.isSetup).length} / {players.filter(p => !p.isLeft).length}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {players.filter(p => !p.isLeft).map(player => (
                                    <div key={player.uid} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sm overflow-hidden">
                                                {renderPlayerAvatar(player)}
                                            </div>
                                            <span className="text-sm font-bold text-slate-300">{player.name}</span>
                                        </div>
                                        {playerStates[player.uid]?.isSetup ? (
                                            <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase">
                                                <CheckCircle2 size={12} />
                                                <span>已進入遊戲</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-amber-500/80 text-[10px] font-black uppercase">
                                                <RefreshCw size={12} className="animate-spin" />
                                                <span>
                                                    {(() => {
                                                        const step = playerStates[player.uid]?.selectionStep;
                                                        switch (step) {
                                                            case 'profession': return '選擇職業中';
                                                            case 'enterprise': return '選擇企業中';
                                                            case 'dream': return '選擇夢想中';
                                                            default: return '選擇中';
                                                        }
                                                    })()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 開始遊戲按鈕 - 放在進度列表下方 */}
                        {room?.status === 'waiting' && allPlayersReady && (
                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={handleStartGame}
                                    className="w-[200px] h-[60px] bg-blue-600 hover:bg-blue-500 text-white text-xl font-black rounded-2xl shadow-[0_10px_30px_-5px_rgba(37,99,235,0.4)] transition-all active:scale-95 animate-in zoom-in duration-300"
                                >
                                    開始遊戲
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {/* 泡沫化警示 */}
                    <AnimatePresence>
                        {showBubbleAlert && (
                            <motion.div
                                initial={{ opacity: 0, y: -50 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -50 }}
                                className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-rose-600/90 backdrop-blur-md px-8 py-3 rounded-full border border-rose-400 shadow-[0_0_30px_rgba(225,29,72,0.4)] flex items-center gap-3"
                            >
                                <ShieldAlert className="text-white animate-pulse" size={24} />
                                <span className="text-white text-xl font-black tracking-[0.2em]">股市泡沫化警報</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex-1 flex min-h-0 relative">
                        {/* 遊戲尚未開始時的中央開始按鈕 (僅在初始時間且暫停時顯示) */}
                        {allPlayersReady && room?.status === 'playing' && isPaused && timeLeft > 0 && timeLeft === (room?.duration || 0) * 60 && (
                            <div className="absolute inset-0 z-[80] flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px]">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="bg-slate-900/90 border border-amber-500/30 p-8 rounded-[40px] shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col items-center gap-6"
                                >
                                    <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-600/20 animate-pulse">
                                        <Rocket size={40} className="text-slate-900 fill-current" />
                                    </div>
                                    <div className="text-center">
                                        <h2 className="text-2xl font-black text-white mb-2">所有玩家已準備就緒</h2>
                                        <p className="text-slate-400 text-sm">點擊按鈕開始遊戲倒數計時</p>
                                    </div>
                                    <button
                                        onClick={handleToggleTimer}
                                        className="px-12 py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xl font-black rounded-2xl shadow-xl shadow-amber-900/40 transition-all active:scale-95 group"
                                    >
                                        開始遊戲
                                    </button>
                                </motion.div>
                            </div>
                        )}

                        {/* Main Area: Financial Statement */}
                        <div className="flex-1 flex flex-col bg-slate-950 relative min-w-0">
                            {/* Floating Avatar Menu - Mobile */}
                            <AnimatePresence>
                                {isPlayerListOpen && (
                                    <>
                                        {/* Backdrop for Menu */}
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[70]"
                                            onClick={() => setIsPlayerListOpen(false)}
                                        />

                                        {/* Avatars Popup Container */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                            className="fixed right-4 bottom-32 z-[80] flex flex-col-reverse items-end gap-3"
                                        >
                                            {players.map((player, index) => {
                                                const isSelected = selectedPlayerUid === player.uid;
                                                const playerAlert = alerts.find(a => a?.uid === player.uid);
                                                const isLeft = player.isLeft;

                                                return (
                                                    <motion.button
                                                        key={player.uid}
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.05 }}
                                                        onClick={() => {
                                                            setSelectedPlayerUid(player.uid);
                                                            setIsPlayerListOpen(false);
                                                        }}
                                                        className={cn(
                                                            "group relative flex items-center gap-3 p-1.5 pr-4 rounded-2xl transition-all duration-300 shadow-2xl border-2",
                                                            isSelected
                                                                ? "bg-amber-500 border-amber-300 text-slate-950"
                                                                : "bg-slate-900 border-slate-800 text-white hover:border-amber-500/50",
                                                            isLeft && "opacity-60 grayscale-[0.5]"
                                                        )}
                                                    >
                                                        {/* Player Name Label */}
                                                        <span className={cn(
                                                            "text-sm font-black tracking-wide pl-2",
                                                            isSelected ? "text-slate-950" : "text-slate-200"
                                                        )}>
                                                            {player.name}
                                                            {isLeft && <span className="ml-1 opacity-60 text-[10px]">(已離開)</span>}
                                                        </span>

                                                        <div className={cn(
                                                            "relative w-11 h-11 rounded-xl overflow-hidden border shadow-inner transition-transform duration-300 group-hover:scale-105",
                                                            isSelected ? "border-amber-200/50" : "border-slate-700"
                                                        )}>
                                                            {renderPlayerAvatar(player)}

                                                            {isLeft && (
                                                                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                                                                    <X size={16} className="text-white/60" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {playerAlert && !isLeft && (
                                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-2 border-slate-900 flex items-center justify-center animate-pulse">
                                                                <AlertCircle size={12} className="text-white" />
                                                            </div>
                                                        )}
                                                    </motion.button>
                                                );
                                            })}
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>

                            {/* Main Floating Toggle Button */}
                            <button
                                onClick={() => setIsPlayerListOpen(!isPlayerListOpen)}
                                className={cn(
                                    "fixed right-4 bottom-16 md:bottom-24 z-[90] w-14 h-14 rounded-2xl shadow-[0_20px_50px_-12px_rgba(245,158,11,0.5)] flex items-center justify-center transition-all duration-500 active:scale-90 border-2",
                                    isPlayerListOpen
                                        ? "bg-slate-900 border-amber-500 text-amber-500 rotate-180"
                                        : "bg-gradient-to-br from-amber-400 to-amber-600 border-amber-300 text-slate-950 hover:shadow-amber-500/40 hover:-translate-y-1"
                                )}
                            >
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={isPlayerListOpen ? 'close' : 'users'}
                                        initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                        exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {isPlayerListOpen ? <X size={28} /> : <Users size={28} />}
                                    </motion.div>
                                </AnimatePresence>

                                {/* Notification Badge if any alerts */}
                                {!isPlayerListOpen && alerts.length > 0 && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="absolute -top-2 -right-2 w-7 h-7 bg-rose-500 text-white text-[11px] font-black rounded-full border-2 border-slate-950 flex items-center justify-center shadow-lg animate-bounce"
                                    >
                                        {alerts.length}
                                    </motion.div>
                                )}
                            </button>

                            <AnimatePresence initial={false} custom={direction} mode="popLayout">
                                {room?.status === 'finished' ? (
                                    <motion.div
                                        key={selectedPlayerUid || 'settlement'}
                                        custom={direction}
                                        variants={slideVariants}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        transition={{
                                            x: { type: "spring", stiffness: 400, damping: 40 },
                                            opacity: { duration: 0.25 },
                                            scale: { duration: 0.25 }
                                        }}
                                        drag="x"
                                        dragConstraints={{ left: 0, right: 0 }}
                                        dragElastic={1}
                                        dragDirectionLock
                                        onDragStart={(e) => {
                                            e.stopPropagation();
                                        }}
                                        onDragEnd={handlePlayerSwipe}
                                        className="flex-1 flex flex-col overflow-hidden touch-pan-y"
                                    >
                                        <ScoreView
                                            playerName={selectedPlayer?.name || '執行師'}
                                            playerUid={selectedPlayer?.uid}
                                            isInline={true}
                                            onClose={() => { }}
                                        />
                                    </motion.div>
                                ) : selectedPlayerUid && selectedPlayerState ? (
                                    <motion.div
                                        key={selectedPlayerUid}
                                        custom={direction}
                                        variants={slideVariants}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        transition={{
                                            x: { type: "spring", stiffness: 400, damping: 40 },
                                            opacity: { duration: 0.25 },
                                            scale: { duration: 0.25 }
                                        }}
                                        drag="x"
                                        dragConstraints={{ left: 0, right: 0 }}
                                        dragElastic={1}
                                        dragDirectionLock
                                        onDragStart={(e) => {
                                            e.stopPropagation();
                                        }}
                                        onDragEnd={handlePlayerSwipe}
                                        className="flex-1 flex flex-col overflow-hidden touch-pan-y"
                                    >
                                        {/* Player Summary Banner */}
                                        <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-20 h-20 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-4xl shadow-2xl overflow-hidden relative ${selectedPlayer?.isLeft ? 'opacity-40 grayscale' : ''
                                                    }`}>
                                                    {renderPlayerAvatar(selectedPlayer, "w-full h-full object-cover rounded-xl", true)}

                                                    {selectedPlayer?.isLeft && (
                                                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                                                            <span className="text-xs font-black text-white bg-slate-900/80 px-2 py-1 rounded-md">已離開</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1.5">
                                                        <h2 className="text-2xl font-black">
                                                            {selectedPlayer?.name}
                                                            {selectedPlayer?.isLeft && <span className="ml-2 text-sm font-bold text-slate-500">(已離開)</span>}
                                                        </h2>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold">
                                                        {getPlayerBadge(selectedPlayer as any) && (
                                                            <div className="w-6 h-6 flex items-center justify-center">
                                                                <SafeImage
                                                                    src={getPlayerBadge(selectedPlayer as any)}
                                                                    className="w-full h-full object-contain drop-shadow-[0_0_5px_rgba(245,158,11,0.3)]"
                                                                    alt="Badge"
                                                                />
                                                            </div>
                                                        )}
                                                        {selectedPlayerState.currentRankTitle || selectedPlayerState.profession?.title}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 幸福指數 - 調整大小避免擠壓 */}
                                            <button
                                                onClick={() => setIsHappinessModalOpen(true)}
                                                className="flex flex-col items-center justify-center px-4 py-2 bg-pink-500/5 hover:bg-pink-500/10 active:scale-95 transition-all rounded-xl border border-pink-500/20 shadow-inner shrink-0 cursor-pointer"
                                            >
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <Heart size={14} className="text-pink-500 fill-pink-500 animate-pulse" />
                                                    <span className="text-[9px] font-black text-pink-500/60 uppercase tracking-widest">Happiness</span>
                                                </div>
                                                <div className="text-3xl font-black text-pink-500 tabular-nums tracking-tighter drop-shadow-[0_0_10px_rgba(236,72,153,0.3)]">
                                                    {selectedPlayerState.happinessTotal}
                                                </div>
                                            </button>
                                        </div>

                                        <div
                                            className="flex-1 overflow-y-auto p-6 custom-scrollbar touch-pan-y"
                                            onPointerDown={(e) => {
                                                // 確保在捲動內容時，如果偵測到橫向移動，不觸發拖拽
                                            }}
                                        >
                                            {!selectedPlayerState.isSetup ? (
                                                <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in zoom-in duration-500">
                                                    <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center border-2 border-amber-500/30">
                                                        <RefreshCw size={48} className="text-amber-500 animate-spin" />
                                                    </div>
                                                    <div className="text-center space-y-2">
                                                        <h3 className="text-2xl font-black text-white tracking-widest">
                                                            {(() => {
                                                                const step = selectedPlayerState.selectionStep;
                                                                switch (step) {
                                                                    case 'profession': return '選擇職業中';
                                                                    case 'enterprise': return '選擇企業中';
                                                                    case 'dream': return '選擇夢想中';
                                                                    default: return '進入遊戲中';
                                                                }
                                                            })()}
                                                        </h3>
                                                        <p className="text-slate-500 font-bold uppercase tracking-tighter">Waiting for player to complete setup</p>
                                                    </div>
                                                </div>
                                            ) : selectedPlayerSummary && (
                                                <FinancialStatement
                                                    gameState={selectedPlayerState}
                                                    summary={selectedPlayerSummary}
                                                    hideNav={false}
                                                    hideSummary={true}
                                                    showDashboard={true}
                                                    defaultShowDetails={true}
                                                />
                                            )}
                                        </div>
                                    </motion.div>
                                ) : !selectedPlayerUid ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4"
                                    >
                                        <Users size={64} className="opacity-20" />
                                        <p className="text-lg font-bold">請選擇一位玩家進行監控</p>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500"
                                    >
                                        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                                        <p className="font-bold animate-pulse">等待玩家進入遊戲...</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </>
            )}

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
                                    <>
                                        <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3 mb-4">
                                            <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto">
                                                <AlertCircle className="text-rose-500" size={24} />
                                            </div>
                                            <div>
                                                <div className="text-rose-500 font-black text-lg">泡沫破裂警告</div>
                                                <div className="text-rose-400/80 text-xs font-medium">所有股票將受到劇烈影響</div>
                                            </div>
                                        </div>

                                        {/* 顯示泡沫化後的股價 */}
                                        <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                                            {/* 左側 A10-A40 */}
                                            <div className="space-y-2">
                                                {['A10', 'A20', 'A30', 'A40'].map(symbol => {
                                                    const price = confirmPublishData.updates[symbol];
                                                    if (price === undefined) return null;
                                                    return (
                                                        <div key={symbol} className="bg-slate-800/50 p-3 rounded-xl border border-rose-700/50 flex flex-col items-center">
                                                            <div className="text-[10px] text-slate-500 font-bold mb-0.5">{STOCK_NAMES[symbol] || symbol}</div>
                                                            <div className="text-sm font-black text-rose-400">{formatMoney(price)}</div>
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
                                                        <div key={symbol} className="bg-slate-800/50 p-3 rounded-xl border border-rose-700/50 flex flex-col items-center">
                                                            <div className="text-[10px] text-slate-500 font-bold mb-0.5">{STOCK_NAMES[symbol] || symbol}</div>
                                                            <div className="text-sm font-black text-rose-400">{formatMoney(price)}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
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

            {/* 股市行情查看 */}
            {isMarketViewOpen && (
                <StockMarketModal
                    onClose={() => setIsMarketViewOpen(false)}
                    onOpenStockCodes={() => {
                        setIsMarketViewOpen(false);
                        setIsStockModalOpen(true);
                    }}
                    marketPrices={room?.marketPrices}
                    previousMarketPrices={room?.previousMarketPrices}
                />
            )}

            {/* 幸福清單查看 */}
            {isHappinessModalOpen && selectedPlayerState && (
                <HappinessListModal
                    items={selectedPlayerState.happiness || []}
                    total={selectedPlayerState.happinessTotal || 0}
                    onToggle={() => { }} // 執行師僅供查看
                    onAdd={() => { }}    // 執行師僅供查看
                    onRemove={() => { }} // 執行師僅供查看
                    onClose={() => setIsHappinessModalOpen(false)}
                    disabled={true}     // 唯讀模式
                />
            )}

            {/* 行情發布成功彈窗 */}
            {showPublishSuccess && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border-2 border-emerald-500/50 w-full max-w-2xl rounded-3xl shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
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

                            {/* 顯示當前所有股票價格 */}
                            {Object.keys(successPrices).length > 0 && (
                                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
                                    <h4 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">當前股價</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {Object.entries(successPrices)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([symbol, price]) => (
                                                <div key={symbol} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">{STOCK_NAMES[symbol] || symbol}</div>
                                                    <div className="text-xs text-slate-400 font-mono mb-1">{symbol}</div>
                                                    <div className="text-base font-black text-emerald-400 font-mono">{formatMoney(price)}</div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}

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

            {/* 紀錄儲存成功彈窗 */}
            {showSaveSuccess && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border-2 border-amber-500/50 w-full max-w-sm rounded-3xl shadow-[0_0_50px_-12px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-8 text-center space-y-6">
                            <div className="relative mx-auto w-24 h-24">
                                <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping duration-[2000ms]" />
                                <div className="relative w-full h-full bg-amber-500/20 rounded-full flex items-center justify-center border-2 border-amber-500/30">
                                    <Database className="text-amber-500" size={48} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white tracking-tight">紀錄儲存成功！</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    所有玩家的數據已更新至賽季排行榜
                                </p>
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={() => setShowSaveSuccess(false)}
                                    className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-lg rounded-2xl shadow-lg shadow-amber-900/40 transition-all active:scale-95"
                                >
                                    確認
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

            {/* Bottom Bar: Quick Actions */}
            <div className="h-14 border-t border-slate-800 bg-slate-900 px-6 flex items-center justify-between shrink-0 relative">
                <div className="flex items-center gap-4">
                    {/* 重新整理按鈕 */}
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all disabled:opacity-50"
                        title="重新整理"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* 中央結算按鈕 */}
                <div className="absolute left-1/2 bottom-2 -translate-x-1/2 z-[60]">
                    {room?.status === 'playing' ? (
                        <button
                            onClick={handleScore}
                            className="w-16 h-16 bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 rounded-full font-black text-xs transition-all flex flex-col items-center justify-center group active:scale-95 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.5)] border-2 border-amber-300/50"
                            title="遊戲結算"
                        >
                            <ShieldAlert size={22} className="mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="tracking-tighter">遊戲結算</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleConfirmSave}
                            disabled={isSavingAll || uploadStatus === 'success'}
                            className={cn(
                                "w-16 h-16 rounded-full font-black text-[10px] transition-all flex flex-col items-center justify-center group active:scale-95 border-2",
                                uploadStatus === 'success'
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-default"
                                    : "bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-800 text-white shadow-[0_4px_20px_-4px_rgba(16,185,129,0.5)] border-emerald-300/50"
                            )}
                        >
                            <CheckCircle2 size={22} className="mb-0.5 group-hover:scale-110 transition-transform" />
                            <span className="leading-tight tracking-tighter">
                                {isSavingAll ? '儲存中' : uploadStatus === 'success' ? '紀錄成功' : '儲存紀錄'}
                            </span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsMarketViewOpen(true)}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                    >
                        <TrendingUp size={14} />
                        股市行情
                    </button>
                </div>
            </div>

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

            {/* 審核彈窗 */}
            <AnimatePresence>
                {pendingRequest && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4 overflow-hidden">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl relative overflow-hidden"
                        >
                            {/* 背景裝飾 */}
                            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
                            <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl -ml-20 -mb-20" />

                            <div className="relative">
                                <div className="w-20 h-20 bg-blue-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-12">
                                    <ShieldAlert className="w-10 h-10 text-blue-400 -rotate-12" />
                                </div>

                                <h2 className="text-3xl font-black text-center mb-2 text-white tracking-tight">審核請求</h2>
                                <p className="text-slate-400 text-center mb-10 text-lg">請核對玩家操作資訊</p>

                                <div className="bg-slate-800/50 rounded-3xl p-8 mb-10 border border-slate-700/50 backdrop-blur-sm">
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center pb-4 border-b border-slate-700/50">
                                            <span className="text-slate-400 font-medium">玩家名稱</span>
                                            <span className="text-xl font-bold text-white">{pendingRequest.playerName}</span>
                                        </div>
                                        <div className="flex justify-between items-center pb-4 border-b border-slate-700/50">
                                            <span className="text-slate-400 font-medium">請求類型</span>
                                            <span className="text-lg font-semibold text-blue-400">
                                                {pendingRequest.type === 'payday' ? '領取月結餘' : 
                                                 pendingRequest.type === 'insurance' ? '保險理賠' : 
                                                 '新增幸福項目'}
                                                {pendingRequest.insuranceType === 'medical' && ' (醫療)'}
                                                {pendingRequest.insuranceType === 'aircraft' && ' (飛行器)'}
                                                {pendingRequest.type === 'happiness' && ` (${pendingRequest.happinessLabel})`}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-slate-400 font-medium text-lg">
                                                {pendingRequest.type === 'happiness' ? '幸福點數' : '申請金額'}
                                            </span>
                                            <span className={cn(
                                                "text-3xl font-black",
                                                pendingRequest.type === 'happiness' ? "text-pink-400" : "text-emerald-400"
                                            )}>
                                                {pendingRequest.type === 'happiness' ? `+${pendingRequest.amount}` : formatMoney(pendingRequest.amount)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => rejectRequest(pendingRequest.id)}
                                        className="py-5 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-lg transition-all active:scale-95 border border-slate-700 flex items-center justify-center gap-2"
                                    >
                                        <X className="w-6 h-6 text-red-400" />
                                        拒絕
                                    </button>
                                    <button
                                        onClick={() => approveRequest(pendingRequest.id)}
                                        className="py-5 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 className="w-6 h-6" />
                                        同意
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

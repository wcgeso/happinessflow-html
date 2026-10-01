import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameProvider, isPlayerStateForBoardGame, normalizeGameState, useGame } from './context/GameContext';
import { useAuth } from './context/AuthContext';
import { RoomProvider, useRoom } from './context/RoomContext';
import { VERSION_DISPLAY } from './constants/version';
import { Terminal, ShieldCheck, UserCircle, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhotoPromotionConsentModal } from './components/modals/PhotoPromotionConsentModal';
import { requiresPhotoPromotionConsent } from './constants/photoPromotionConsent';

// Lazy load views
const AuthView = React.lazy(() => import('./views/auth/AuthView').then(module => ({ default: module.AuthView })));
const LobbyView = React.lazy(() => import('./views/lobby/LobbyView').then(module => ({ default: module.LobbyView })));
const HistoryView = React.lazy(() => import('./views/history/HistoryView').then(module => ({ default: module.HistoryView })));
const CreateReportView = React.lazy(() => import('./views/setup/CreateReportView').then(module => ({ default: module.CreateReportView })));
const SelectionView = React.lazy(() => import('./views/selection/SelectionView').then(module => ({ default: module.SelectionView })));
const GameView = React.lazy(() => import('./views/game/GameView').then(module => ({ default: module.GameView })));
const ScoreView = React.lazy(() => import('./views/game/ScoreView').then(module => ({ default: module.ScoreView })));
const AchievementsView = React.lazy(() => import('./views/achievements/AchievementsView').then(module => ({ default: module.AchievementsView })));

const CoachGameView = React.lazy(() => import('./views/lobby/CoachGameView').then(module => ({ default: module.CoachGameView })));
// GM 開發工具：只有 GM 帳號需要，改動態載入避免每位玩家都下載。
const DeveloperPortal = React.lazy(() => import('./views/lobby/DeveloperPortal').then(module => ({ default: module.DeveloperPortal })));

import { GameSessionMeta, GameState } from './types';
import { debugLog } from './utils/debugLog';
// constants.ts／utils/gameUtils.ts 已經被 RoomContext／GameContext 等多個 Provider
// 靜態 import、強制進主要進入點的打包內容；這裡動態 import 完全不會讓它們被拆進別的
// chunk（Vite 建置會提示 "dynamic import will not move module into another chunk"），
// 改回靜態 import 讓行為跟實際打包結果一致，也少一個沒有意義的 await。
import { PROFESSIONS, ENTERPRISES, DREAMS, createInitialMarketPrices } from './constants';
import { getInitialHappinessList } from './utils/gameUtils';

// Mock Spinner
const Spinner = () => (
    <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

const AppContent = () => {
    const { user, isLoadingAuth, updatePhotoPromotionConsent } = useAuth();
    const { gameState, setGameState, completePlayerSetup } = useGame();

    // 維護模式判斷 (依據域名)
    const isMaintenance = false;

    // View State
    const [currentView, setCurrentView] = useState<'lobby' | 'history' | 'create_report' | 'selection' | 'game' | 'score' | 'achievements' | 'coach_monitor' | 'room_waiting'>('lobby');
    const [targetHistoryUserId, setTargetHistoryUserId] = useState<string | null>(null);
    const [sessionMeta, setSessionMeta] = useState<GameSessionMeta | null>(null);

    // Developer Mode State
    const [isDevPortalOpen, setIsDevPortalOpen] = useState(false);
    const [showDevConfirm, setShowDevConfirm] = useState(false);
    const [hasDevEnabled, setHasDevEnabled] = useState(() => localStorage.getItem('hf_dev_mode') === 'true');
    const [isDevRouting, setIsDevRouting] = useState(false);
    const [practiceRoomAutoOpen, setPracticeRoomAutoOpen] = useState(false);

    const isGM = user?.title === '遊戲管理員';
    const showPhotoPromotionConsent = !!user && requiresPhotoPromotionConsent(user.photoPromotionConsent);
    const [lobbyViewMode, setLobbyViewMode] = useState<'player' | 'coach' | 'gm'>('player');
    const [isViewModeDropdownOpen, setIsViewModeDropdownOpen] = useState(false);
    const [hasLobbyModalOpen, setHasLobbyModalOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsViewModeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDevNavigate = (view: any) => {
        debugLog('Global Dev Portal Navigation:', view);

        if (view === 'practice_room_open') {
            setPracticeRoomAutoOpen(true);
            setCurrentView('lobby');
            return;
        }

        setIsDevRouting(true);

        // 如果跳轉到需要 sessionMeta 的畫面但目前沒有，則補上預設值，避免 Spinner 轉圈圈
        if (['selection', 'game', 'score'].includes(view) && !sessionMeta) {
            setSessionMeta({
                playerName: user?.name || '開發者',
                reportName: `開發者測試 ${new Date().toLocaleDateString('zh-TW')}`,
                createdAt: new Date().toISOString()
            });
        }

        setCurrentView(view);
    };

    // 維護中頁面
    if (isMaintenance) {
        return (
            <div className="flex-1 bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center">
                <div className="w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center mb-8 animate-pulse">
                    <span className="text-5xl">🐝</span>
                </div>
                <div className="px-4 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-500 text-[10px] font-bold uppercase tracking-widest mb-4">
                    System Update
                </div>
                <h1 className="text-3xl font-black mb-4 bg-gradient-to-b from-white to-amber-500 bg-clip-text text-transparent">
                    正在優化您的幸福體驗
                </h1>
                <p className="text-slate-400 max-w-sm leading-relaxed mb-8">
                    「第二人生」正在進行系統維護與功能升級。<br />
                    我們很快就會帶著更棒的體驗回來！
                </p>
                <div className="text-[11px] text-slate-500 font-medium">
                    感謝您的耐心等待
                </div>
            </div>
        );
    }

    // If not logged in, show Auth
    if (isLoadingAuth) return <Spinner />;
    if (!user) {
        return (
            <Suspense fallback={<Spinner />}>
                <AuthView />
            </Suspense>
        );
    }

    return (
        <Suspense fallback={<Spinner />}>
            <MainRouting
                user={user}
                currentView={currentView}
                setCurrentView={setCurrentView}
                sessionMeta={sessionMeta}
                setSessionMeta={setSessionMeta}
                gameState={gameState}
                setGameState={setGameState}
                completePlayerSetup={completePlayerSetup}
                onDevNavigate={handleDevNavigate}
                isDevRouting={isDevRouting}
                setIsDevRouting={setIsDevRouting}
                lobbyViewMode={lobbyViewMode}
                setLobbyViewMode={setLobbyViewMode}
                setHasLobbyModalOpen={setHasLobbyModalOpen}
                targetHistoryUserId={targetHistoryUserId}
                setTargetHistoryUserId={setTargetHistoryUserId}
                practiceRoomAutoOpen={practiceRoomAutoOpen}
                setPracticeRoomAutoOpen={setPracticeRoomAutoOpen}
            />

            {/* Global Developer Portal - Modal only, trigger moved to Lobby identity menu */}
            {isGM && (
                <>
                    {/* fallback=null：獨立的 Suspense 邊界，避免它的 chunk 還沒下載完時
                        把外層已經渲染好的 MainRouting 一起蓋成 loading 畫面。 */}
                    <Suspense fallback={null}>
                        <DeveloperPortal
                            isOpen={isDevPortalOpen}
                            onClose={() => setIsDevPortalOpen(false)}
                            onNavigate={handleDevNavigate}
                            currentView={currentView}
                            version={VERSION_DISPLAY}
                        />
                    </Suspense>

                    <AnimatePresence>
                        {showDevConfirm && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[10001] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6"
                            >
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    className="bg-slate-900 border border-slate-800 p-8 rounded-[32px] max-w-sm w-full text-center space-y-6 shadow-2xl"
                                >
                                    <div className="w-16 h-16 bg-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto text-indigo-400">
                                        <ShieldCheck size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white">開啟開發者模式</h3>
                                        <p className="text-slate-400 text-sm mt-2 leading-relaxed">您即將進入開發者專屬區域，這可能會影響系統穩定性。是否繼續？</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => {
                                                setHasDevEnabled(true);
                                                localStorage.setItem('hf_dev_mode', 'true');
                                                setShowDevConfirm(false);
                                                setIsDevPortalOpen(true);
                                            }}
                                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all active:scale-95"
                                        >
                                            確認開啟
                                        </button>
                                        <button
                                            onClick={() => setShowDevConfirm(false)}
                                            className="w-full py-4 text-slate-500 font-bold hover:text-white transition-colors"
                                        >
                                            取消
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            {/* Global View Mode & Developer Switcher - Persistent across all views */}
            <AnimatePresence>
                {!showPhotoPromotionConsent && (user?.role === 'coach' || isGM) && (hasDevEnabled || (currentView === 'lobby' && !hasLobbyModalOpen)) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className="fixed bottom-6 right-6 z-[10000]"
                        ref={dropdownRef}
                    >
                        <AnimatePresence>
                            {isViewModeDropdownOpen && !hasDevEnabled && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                    className="absolute bottom-full right-0 mb-4 w-48 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-2 flex flex-col gap-1"
                                >
                                    <div className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800/50 mb-1">
                                        切換身分
                                    </div>

                                    <button
                                        onClick={() => {
                                            setLobbyViewMode('player');
                                            setIsViewModeDropdownOpen(false);
                                            if (currentView !== 'lobby' && currentView !== 'room_waiting') {
                                                setCurrentView('lobby');
                                            }
                                        }}
                                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all ${lobbyViewMode === 'player' ? "bg-amber-500 text-slate-950 shadow-lg" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                            }`}
                                    >
                                        <UserCircle size={18} />
                                        <span>玩家模式</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setLobbyViewMode('coach');
                                            setIsViewModeDropdownOpen(false);
                                            if (currentView !== 'lobby' && currentView !== 'room_waiting') {
                                                setCurrentView('lobby');
                                            }
                                        }}
                                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all ${lobbyViewMode === 'coach' ? "bg-amber-500 text-slate-950 shadow-lg" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                            }`}
                                    >
                                        <Users size={18} />
                                        <span>執行師模式</span>
                                    </button>

                                    {isGM && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setLobbyViewMode('gm');
                                                    setIsViewModeDropdownOpen(false);
                                                    if (currentView !== 'lobby' && currentView !== 'room_waiting') {
                                                        setCurrentView('lobby');
                                                    }
                                                }}
                                                className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all ${lobbyViewMode === 'gm' ? "bg-indigo-600 text-white shadow-lg" : "text-indigo-400/70 hover:bg-slate-800 hover:text-indigo-400"
                                                    }`}
                                            >
                                                <ShieldCheck size={18} />
                                                <span>管理員模式</span>
                                            </button>

                                            <div className="my-1 border-t border-slate-800/50" />

                                            <button
                                                onClick={() => {
                                                    if (hasDevEnabled) {
                                                        setIsDevPortalOpen(true);
                                                    } else {
                                                        setShowDevConfirm(true);
                                                    }
                                                    setIsViewModeDropdownOpen(false);
                                                }}
                                                className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-bold text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 transition-all"
                                            >
                                                <Terminal size={18} />
                                                <span>開發者入口</span>
                                            </button>
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            onClick={() => {
                                if (hasDevEnabled) {
                                    setIsDevPortalOpen(true);
                                } else {
                                    setIsViewModeDropdownOpen(!isViewModeDropdownOpen);
                                }
                            }}
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all active:scale-95 group relative overflow-hidden border ${hasDevEnabled
                                ? "bg-indigo-600 border-indigo-500 shadow-indigo-600/30"
                                : lobbyViewMode === 'gm'
                                    ? "bg-indigo-600 border-indigo-500 shadow-indigo-600/30"
                                    : "bg-slate-900 border-slate-800 shadow-black/50"
                                }`}
                        >
                            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-tr ${hasDevEnabled || lobbyViewMode === 'gm'
                                ? "from-indigo-600 to-violet-500"
                                : "from-slate-800 to-slate-700"
                                }`} />

                            <div className="relative z-10 flex flex-col items-center">
                                {hasDevEnabled ? (
                                    <Terminal size={24} className="text-white transition-colors" />
                                ) : lobbyViewMode === 'player' ? (
                                    <UserCircle size={24} className="text-slate-400 group-hover:text-white transition-colors" />
                                ) : lobbyViewMode === 'coach' ? (
                                    <Users size={24} className="text-amber-500 transition-colors" />
                                ) : (
                                    <ShieldCheck size={24} className="text-white transition-colors" />
                                )}
                            </div>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <PhotoPromotionConsentModal
                isOpen={showPhotoPromotionConsent}
                required
                onSubmit={updatePhotoPromotionConsent}
            />
        </Suspense>
    );
};

// Separated to use hooks cleanly if needed, or just inline.
const MainRouting = ({
    user,
    currentView,
    setCurrentView,
    sessionMeta,
    setSessionMeta,
    gameState,
    setGameState,
    completePlayerSetup,
    onDevNavigate,
    isDevRouting,
    setIsDevRouting,
    lobbyViewMode,
    setLobbyViewMode,
    setHasLobbyModalOpen,
    targetHistoryUserId,
    setTargetHistoryUserId,
    practiceRoomAutoOpen,
    setPracticeRoomAutoOpen
}: any) => {
    const { logout } = useAuth();
    const { room, playerStatesHydrated, roomSyncState } = useRoom();
    const [lastProcessedStartTime, setLastProcessedStartTime] = useState<number | null>(null);
    const routingUserUidRef = useRef<string | null>(null);

    useEffect(() => {
        if (routingUserUidRef.current === user?.uid) return;
        routingUserUidRef.current = user?.uid || null;
        setLastProcessedStartTime(null);
    }, [user?.uid]);


    // 監聽房間狀態
    useEffect(() => {
        // 如果是開發者模式跳轉中，不執行自動跳轉邏輯
        if (isDevRouting) {
            debugLog('開發者模式跳轉中，跳過自動路由');
            return;
        }

        // 如果房間數據還沒加載完整（例如只有 ID 的初始狀態），先跳過路由判斷
        // 避免因為 playerStates 還沒讀取到而誤觸狀態重設
        if (!room || !room.hostId) {
            const roomViews = ['selection', 'game', 'score', 'coach_monitor', 'room_waiting'];
            if (room && room.id && roomViews.includes(currentView)) {
                debugLog('房間數據加載中，暫緩路由');
                return;
            }
            if (!room && roomViews.includes(currentView)) {
                if (localStorage.getItem('hf_practice_mode') === 'true') return; // 練習模式允許無房間遊戲
                debugLog('不在房間中，跳回大廳');
                setCurrentView('lobby');
            }
            return;
        }

        // 首次讀到的 IndexedDB/cache 快照只供畫面暫存，不能拿來決定新局、
        // 恢復或切換流程；等 Firestore server snapshot 確認後再路由。
        if (room.status === 'playing' && roomSyncState !== 'synced') return;

        debugLog('App 路由監聽 - 角色:', user?.role, '房間狀態:', room.status, '當前視圖:', currentView);

        if (room.status === 'playing') {
            const isHost = user?.uid === room.hostId;

            // 處理玩家重設狀態 (當偵測到新的開始時間戳時)
            // 如果玩家在雲端已經有狀態（斷線重連），則不應觸發重設
            const cloudState = !isHost && playerStatesHydrated ? room.playerStates?.[user.uid] : undefined;
            const hasCloudState = isPlayerStateForBoardGame(cloudState, room.startedAt);
            const hasMatchingLocalState = gameState.boardGameStartedAt === room.startedAt &&
                (!!gameState.selectionStep || gameState.isSetup);
            
            if (!isHost && room.startedAt && !playerStatesHydrated) {
                return;
            }

            if (!isHost && room.startedAt && room.startedAt !== lastProcessedStartTime && !hasCloudState && !hasMatchingLocalState) {
                debugLog('偵測到新遊戲開始，重設玩家狀態');
                setLastProcessedStartTime(room.startedAt);

                const defaultReportName = `執行日記 ${new Date().toLocaleDateString('zh-TW')}`;

                // 確保玩家有 sessionMeta，避免 SelectionView 崩潰
                const newSessionMeta = {
                    playerName: user.name || user.displayName || '玩家',
                    reportName: defaultReportName,
                    createdAt: new Date().toISOString()
                };
                setSessionMeta(newSessionMeta);

                // 強制重設 gameState，補足所有缺失欄位以防畫面空白
                setGameState({
                    profession: null,
                    selectedEnterprise: null,
                    selectedDream: null,
                    expenses: {},
                    income: {},
                    currentRankTitle: '',
                    currentRankLevel: 1,
                    cash: 0,
                    children: 0,
                    medicalInsuranceCount: 0,
                    assets: [],
                    liabilities: [],
                    loans: 0,
                    isSetup: false,
                    selectionStep: 'profession',
                    history: [],
                    happiness: [],
                    happinessTotal: 0,
                    marketPrices: {},
                    previousMarketPrices: {},
                    lastPublishedCode: '',
                    lastMarketUpdateTimestamp: 0,
                    boardGameStartedAt: room.startedAt,
                    abilities: {
                        stockAbilityCount: 0,
                        realEstateAbilityCount: 0,
                        professionAbilityCount: 0,
                    },
                    completedHappinessEvents: [],
                    playerName: user.name || user.displayName || '玩家',
                    reportName: defaultReportName
                });
                setCurrentView('selection');
                return;
            }

            if (isHost) {
                // 檢查是否所有玩家都已完成設定 (isSetup 為 true)
                const playerUids = room.members
                    .filter(member => member.uid !== room.hostId)
                    .map(member => member.uid);
                const allPlayersSetup = playerUids.length > 0 &&
                    playerUids.every(uid => room.publicPlayerStates?.[uid]?.isSetup ?? room.playerStates?.[uid]?.isSetup);

                if (allPlayersSetup) {
                    if (currentView !== 'coach_monitor') {
                        debugLog('所有玩家已完成設定，執行師跳轉到監控畫面');
                        setCurrentView('coach_monitor');
                    }
                } else {
                    if (currentView !== 'waiting_players' && currentView !== 'coach_monitor') {
                        debugLog('仍有玩家在選擇職業，執行師留在等待畫面');
                        setCurrentView('coach_monitor');
                    }
                }
            } else if (!isHost && currentView !== 'selection' && currentView !== 'game') {
                debugLog('玩家跳轉到遊戲或選擇畫面');
                // 確保玩家有 sessionMeta
                if (!sessionMeta) {
                    setSessionMeta({
                        playerName: user.name || user.displayName || '玩家',
                        reportName: gameState.reportName || `執行日記 ${new Date().toLocaleDateString('zh-TW')}`,
                        createdAt: new Date().toISOString()
                    });
                }

                // 如果已經完成設定，直接進入遊戲
                if (gameState.isSetup || gameState.selectionStep === 'completed') {
                    debugLog('玩家已完成設定，跳轉到遊戲畫面');
                    setCurrentView('game');
                } else if (hasCloudState) {
                    // 斷線重連：如果本地還沒同步雲端狀態，則從雲端恢復
                    debugLog('斷線重連：從雲端恢復玩家狀態');
                    const cloudState = normalizeGameState(room.playerStates![user.uid]);
                    setGameState(cloudState);
                    setSessionMeta({
                        playerName: cloudState.playerName || user.name,
                        reportName: cloudState.reportName || `執行日記 ${new Date().toLocaleDateString('zh-TW')}`,
                        createdAt: new Date().toISOString()
                    });
                    
                    if (cloudState.isSetup || cloudState.selectionStep === 'completed') {
                        setCurrentView('game');
                    } else {
                        setCurrentView('selection');
                    }
                } else {
                    debugLog('玩家尚未完成設定，跳轉到選擇畫面');
                    // 初始化選擇步驟 (僅在尚未設定且未完成時)
                    setGameState(prev => {
                        if (prev.selectionStep || prev.isSetup) return prev;
                        return {
                            ...prev,
                            selectionStep: 'profession'
                        };
                    });
                    setCurrentView('selection');
                }
            }
        } else if (room.status === 'finished') {
            const isHost = user?.uid === room.hostId;
            if (!isHost && currentView !== 'score' && currentView !== 'game') {
                debugLog('玩家跳轉到評分畫面');
                setCurrentView('score');
            }
        }
    }, [
        user?.uid,
        user?.role,
        room?.status,
        roomSyncState,
        room?.hostId,
        room?.startedAt,
        room?.playerStates,
        playerStatesHydrated,
        room?.publicPlayerStates,
        currentView,
        sessionMeta,
        gameState.isSetup,
        gameState.selectionStep,
        lastProcessedStartTime
    ]);

    const handleSelectionStepChange = useCallback((step: 'profession' | 'enterprise' | 'dream') => {
        setGameState(prev => {
            if (prev.selectionStep === step && prev.boardGameStartedAt === room?.startedAt) return prev;
            return {
                ...prev,
                selectionStep: step,
                boardGameStartedAt: room?.startedAt
            };
        });
    }, [room?.startedAt, setGameState]);

    const handleSelectionChange = useCallback((selectionDraft: NonNullable<GameState['selectionDraft']>) => {
        setGameState(prev => ({
            ...prev,
            selectionDraft,
            boardGameStartedAt: room?.startedAt
        }));
    }, [room?.startedAt, setGameState]);

    const handleCreateReportComplete = (meta: GameSessionMeta) => {
        setIsDevRouting(false);
        setSessionMeta(meta);
        setGameState(prev => ({ ...prev, selectionStep: 'profession' }));
        setCurrentView('selection');
    };

    const handleSelectionComplete = async (data: { professionId: string; enterpriseId: string; dreamId: string }) => {
        setIsDevRouting(false);
        const profession = PROFESSIONS.find(item => item.id === data.professionId);
        const enterprise = ENTERPRISES.find(item => item.id === data.enterpriseId);
        const dream = DREAMS.find(item => item.id === data.dreamId);
        if (!profession || !enterprise || !dream) throw new Error('選擇內容已不存在，請重新選擇。');

        const initialMarketPrices = room?.marketPrices && Object.keys(room.marketPrices).length > 0
            ? room.marketPrices
            : createInitialMarketPrices();
        const previousMarketPrices = room?.previousMarketPrices && Object.keys(room.previousMarketPrices).length > 0
            ? room.previousMarketPrices
            : initialMarketPrices;
        const nextState: GameState = {
            profession,
            selectedEnterprise: enterprise,
            selectedDream: dream,
            selectionDraft: data,
            currentRankTitle: profession.initialRank,
            currentRankLevel: 1,
            cash: profession.savings,
            children: 0,
            medicalInsuranceCount: 0,
            assets: [],
            liabilities: [],
            loans: 0,
            isSetup: true,
            selectionStep: 'completed',
            expenses: {},
            income: {},
            history: [],
            happiness: getInitialHappinessList(enterprise, dream),
            happinessTotal: 0,
            marketPrices: initialMarketPrices,
            previousMarketPrices,
            abilities: {
                stockAbilityCount: 0,
                realEstateAbilityCount: 0,
                professionAbilityCount: 0,
            },
            completedHappinessEvents: [],
            boardGameStartedAt: room?.startedAt,
            playerName: sessionMeta?.playerName || user.name,
            reportName: sessionMeta?.reportName || '我的財報'
        } as GameState;

        await completePlayerSetup(nextState);
        setCurrentView('game');
    };

    const handleResumeGame = () => {
        setIsDevRouting(false);
        if (user?.role === 'coach') {
            setCurrentView('coach_monitor');
            return;
        }

        if (gameState.playerName) {
            setSessionMeta({
                playerName: gameState.playerName,
                reportName: gameState.reportName || `執行日記 ${new Date().toLocaleDateString('zh-TW')}`,
                createdAt: new Date().toISOString()
            });
        }
        setCurrentView('game');
    };

    const handleGameFinish = () => {
        setIsDevRouting(false);
        setCurrentView('score');
    };

    // 輔助函數：根據角色決定返回的大廳視圖
    const backToLobby = () => {
        setIsDevRouting(false);
        setTargetHistoryUserId(null);
        setCurrentView('lobby');
    };

    // Views
    switch (currentView) {
        case 'lobby':
            return (
                <LobbyView
                    onLogout={logout}
                    onCreateReport={() => {
                        setIsDevRouting(false);
                        setCurrentView('create_report');
                    }}
                    onResumeGame={() => {
                        setIsDevRouting(false);
                        handleResumeGame();
                    }}
                    onViewHistory={(uid) => {
                        setIsDevRouting(false);
                        setTargetHistoryUserId(uid || null);
                        setCurrentView('history');
                    }}
                    onViewAchievements={() => {
                        setIsDevRouting(false);
                        setCurrentView('achievements');
                    }}
                    onDevNavigate={onDevNavigate}
                    viewMode={lobbyViewMode}
                    onViewModeChange={setLobbyViewMode}
                    onModalStateChange={setHasLobbyModalOpen}
                    autoOpenCreateRoom={practiceRoomAutoOpen}
                    onAutoOpenHandled={() => setPracticeRoomAutoOpen(false)}
                />
            );
        case 'room_waiting':
            return (
                <LobbyView
                    onLogout={logout}
                    onCreateReport={() => {
                        setIsDevRouting(false);
                        setCurrentView('create_report');
                    }}
                    onResumeGame={() => {
                        setIsDevRouting(false);
                        handleResumeGame();
                    }}
                    onViewHistory={(uid) => {
                        setIsDevRouting(false);
                        setTargetHistoryUserId(uid || null);
                        setCurrentView('history');
                    }}
                    onViewAchievements={() => {
                        setIsDevRouting(false);
                        setCurrentView('achievements');
                    }}
                    onDevNavigate={onDevNavigate}
                    initialShowRoomView={true}
                    onBack={backToLobby}
                    viewMode={lobbyViewMode}
                    onViewModeChange={setLobbyViewMode}
                    onModalStateChange={setHasLobbyModalOpen}
                />
            );
        case 'history':
            return <HistoryView onBack={backToLobby} targetUserId={targetHistoryUserId} />;
        case 'achievements':
            return <AchievementsView onBack={backToLobby} />;
        case 'create_report':
            return (
                <CreateReportView
                    defaultName={user.name}
                    onBack={backToLobby}
                    onComplete={handleCreateReportComplete}
                />
            );
        case 'selection':
            if (!sessionMeta) return <Spinner />;
            return (
                <SelectionView
                    key={`${user?.uid ?? 'guest'}:${room?.id ?? 'solo'}:${room?.startedAt ?? gameState.boardGameStartedAt ?? 'unstarted'}`}
                    sessionMeta={sessionMeta}
                    initialStep={gameState.selectionStep as any}
                    initialSelections={gameState.selectionDraft}
                    onBackToLobby={backToLobby}
                    onComplete={handleSelectionComplete}
                    onStepChange={handleSelectionStepChange}
                    onSelectionChange={handleSelectionChange}
                />
            );
        case 'game':
            return (
                <GameView
                    onFinishGame={handleGameFinish}
                    isDevMode={isDevRouting}
                />
            );
        case 'score':
            return (
                <ScoreView
                    playerName={sessionMeta?.playerName || user.name}
                    onClose={() => setCurrentView('lobby')}
                />
            );
        case 'coach_monitor':
            return <CoachGameView />;
        default:
            return <div>Unknown View</div>;
    }
};

export default function AuthenticatedApp() {
    return <RoomProvider><GameProvider><AppContent /></GameProvider></RoomProvider>;
}

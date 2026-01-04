import React, { Suspense, useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RoomProvider, useRoom } from './context/RoomContext';

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

import { GameSessionMeta } from './types';

// Mock Spinner
const Spinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

const AppContent = () => {
    const { user, isLoadingAuth } = useAuth();
    const { gameState, setGameState } = useGame();

    // 維護模式判斷 (依據域名)
    const isMaintenance = window.location.hostname === 'happinessflow.vercel.app';

    // View State
    const [currentView, setCurrentView] = useState<'lobby' | 'history' | 'create_report' | 'selection' | 'game' | 'score' | 'achievements' | 'coach_monitor'>('lobby');
    const [sessionMeta, setSessionMeta] = useState<GameSessionMeta | null>(null);

    // 維護中頁面
    if (isMaintenance) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center">
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
                    「蜂富人生」正在進行系統維護與功能升級。<br />
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
            />
        </Suspense>
    );
};

// Separated to use hooks cleanly if needed, or just inline.
const MainRouting = ({ user, currentView, setCurrentView, sessionMeta, setSessionMeta, gameState, setGameState }: any) => {
    const { logout } = useAuth();
    const { room } = useRoom();

    // 監聽房間狀態，如果是執行師且房間開始遊戲，自動跳轉到監控畫面
    // 如果是玩家且房間開始遊戲，自動跳轉到職業選擇畫面
    // 如果房間結束，玩家跳轉到評分畫面
    useEffect(() => {
        if (!room) {
            // 如果玩家不在房間中且當前處於與房間相關的畫面，跳回大廳
            const roomViews = ['selection', 'game', 'score', 'coach_monitor'];
            if (roomViews.includes(currentView)) {
                console.log('不在房間中，跳回大廳');
                setCurrentView('lobby');
            }
            return;
        }

        console.log('App 路由監聽 - 角色:', user?.role, '房間狀態:', room.status, '當前視圖:', currentView);

        if (room.status === 'playing') {
            if (user?.role === 'coach' && currentView !== 'coach_monitor') {
                console.log('執行師跳轉到監控畫面');
                setCurrentView('coach_monitor');
            } else if (user?.role === 'player' && currentView !== 'selection' && currentView !== 'game') {
                console.log('玩家跳轉到職業選擇畫面');
                // 確保玩家有 sessionMeta
                if (!sessionMeta) {
                    setSessionMeta({
                        playerName: user.name,
                        reportName: '我的財報',
                        createdAt: new Date().toISOString()
                    });
                }
                setCurrentView('selection');
            }
        } else if (room.status === 'finished') {
            if (user?.role === 'player' && currentView !== 'score' && currentView !== 'game') {
                console.log('玩家跳轉到評分畫面');
                setCurrentView('score');
            }
        }
    }, [user?.uid, room?.status, currentView, sessionMeta]);

    const handleCreateReportComplete = (meta: GameSessionMeta) => {
        setSessionMeta(meta);
        setCurrentView('selection');
    };

    const handleSelectionComplete = (data: { professionId: string; enterpriseId: string; dreamId: string }) => {
        import('./constants').then(({ PROFESSIONS, ENTERPRISES, DREAMS, STOCK_SYMBOLS }) => {
            const profession = PROFESSIONS.find((p: any) => p.id === data.professionId);
            const enterprise = ENTERPRISES.find((e: any) => e.id === data.enterpriseId);
            const dream = DREAMS.find((d: any) => d.id === data.dreamId);

            if (profession && enterprise && dream) {
                import('./utils/gameUtils').then(({ getInitialHappinessList }) => {
                    const happinessItems = getInitialHappinessList(enterprise, dream);
                    setGameState({
                        profession,
                        selectedEnterprise: enterprise,
                        selectedDream: dream,
                        currentRankTitle: profession.initialRank,
                        currentRankLevel: 1,
                        cash: profession.savings,
                        children: 0,
                        medicalInsuranceCount: 0,
                        assets: [],
                        liabilities: [],
                        loans: 0,
                        isSetup: true,
                        expenses: {},
                        income: {},
                        history: [],
                        happiness: happinessItems,
                        happinessTotal: 0,
                        marketPrices: STOCK_SYMBOLS.reduce((acc: Record<string, number>, symbol: string) => {
                            acc[symbol] = 0;
                            return acc;
                        }, {} as Record<string, number>),
                        abilities: {
                            stockAbilityCount: 0,
                            realEstateAbilityCount: 0,
                            professionAbilityCount: 0,
                        },
                        completedHappinessEvents: [],
                        playerName: sessionMeta?.playerName || user.name,
                        reportName: sessionMeta?.reportName || '我的財報'
                    });
                    setCurrentView('game');
                });
            }
        });
    };

    const handleResumeGame = () => {
        if (gameState.playerName) {
            setSessionMeta({
                playerName: gameState.playerName,
                reportName: gameState.reportName || '我的財報',
                createdAt: new Date().toISOString()
            });
        }
        setCurrentView('game');
    };

    const handleGameFinish = () => {
        setCurrentView('score');
    };

    // Views
    switch (currentView) {
        case 'lobby':
            return (
                <LobbyView
                    onLogout={logout}
                    onCreateReport={() => setCurrentView('create_report')}
                    onResumeGame={handleResumeGame}
                    onViewHistory={() => setCurrentView('history')}
                    onViewAchievements={() => setCurrentView('achievements')}
                />
            );
        case 'history':
            return <HistoryView onBack={() => setCurrentView('lobby')} />;
        case 'achievements':
            return <AchievementsView onBack={() => setCurrentView('lobby')} />;
        case 'create_report':
            return (
                <CreateReportView
                    defaultName={user.name}
                    onBack={() => setCurrentView('lobby')}
                    onComplete={handleCreateReportComplete}
                />
            );
        case 'selection':
            return (
                <SelectionView
                    sessionMeta={sessionMeta}
                    onBackToLobby={() => setCurrentView('lobby')}
                    onComplete={handleSelectionComplete}
                />
            );
        case 'game':
            return (
                <GameView
                    onFinishGame={handleGameFinish}
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

export default function App() {
    useEffect(() => {
        // 防止行動端瀏覽器彈性滾動 (Elastic Scrolling)
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        document.body.style.touchAction = 'none';

        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.body.style.touchAction = '';
        };
    }, []);

    return (
        <AuthProvider>
            <RoomProvider>
                <GameProvider>
                    <div className="fixed inset-0 overflow-hidden bg-slate-950 select-none touch-none">
                        <AppContent />
                    </div>
                </GameProvider>
            </RoomProvider>
        </AuthProvider>
    );
}

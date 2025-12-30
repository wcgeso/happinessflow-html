import React, { Suspense, useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { AuthProvider, useAuth } from './context/AuthContext';

// Lazy load views
const AuthView = React.lazy(() => import('./views/auth/AuthView').then(module => ({ default: module.AuthView })));
const LobbyView = React.lazy(() => import('./views/lobby/LobbyView').then(module => ({ default: module.LobbyView })));
const HistoryView = React.lazy(() => import('./views/history/HistoryView').then(module => ({ default: module.HistoryView })));
const CreateReportView = React.lazy(() => import('./views/setup/CreateReportView').then(module => ({ default: module.CreateReportView })));
const SelectionView = React.lazy(() => import('./views/selection/SelectionView').then(module => ({ default: module.SelectionView })));
const GameView = React.lazy(() => import('./views/game/GameView').then(module => ({ default: module.GameView })));
const ScoreView = React.lazy(() => import('./views/game/ScoreView').then(module => ({ default: module.ScoreView })));
const AchievementsView = React.lazy(() => import('./views/achievements/AchievementsView').then(module => ({ default: module.AchievementsView })));

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

    // View State
    const [currentView, setCurrentView] = useState<'lobby' | 'history' | 'create_report' | 'selection' | 'game' | 'score' | 'achievements'>('lobby');
    const [sessionMeta, setSessionMeta] = useState<GameSessionMeta | null>(null);

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
                    onBackToLobby={() => setCurrentView('lobby')}
                />
            );
        default:
            return <div>Unknown View</div>;
    }
};

export default function App() {
    return (
        <AuthProvider>
            <GameProvider>
                <AppContent />
            </GameProvider>
        </AuthProvider>
    );
}

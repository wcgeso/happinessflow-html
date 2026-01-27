import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import { useGameLogic } from '../../hooks/useGameLogic';
import { AlertCircle, CheckCircle2, Bell, LogOut } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { FinancialStatement } from '../../components/business/FinancialStatement';
import { HappinessPanel } from '../../components/business/HappinessPanel';
import { TransactionForm } from '../../components/business/TransactionForm';
import { PaydayModal } from '../../components/modals/PaydayModal';
import { MedicalClaimModal } from '../../components/modals/MedicalClaimModal';
import { PromotionModal } from '../../components/modals/PromotionModal';
import { RankListModal } from '../../components/modals/RankListModal';
import { LifelongLearningModal } from '../../components/modals/LifelongLearningModal';
import { HappinessListModal } from '../../components/modals/HappinessListModal';
import { StockMarketModal } from '../../components/transaction/StockMarketModal';
import { TutorialModal } from '../../components/modals/TutorialModal';
import { DiceRollContainer } from '../../components/game/DiceRollContainer';
import { ScoreView } from './ScoreView';
import { PromotionType } from '../../hooks/useDiceRollLogic';
import { GameHeader } from '../../components/game/GameHeader';
import { GameStats } from '../../components/game/GameStats';
import { GameActions } from '../../components/game/GameActions';
import { HappinessWinAnimation } from '../../components/game/HappinessWinAnimation';
import { formatMoney } from '../../utils/gameUtils';

export const GameView: React.FC<{ onFinishGame: (meta: any) => void }> = ({ onFinishGame }) => {
    const { gameState, setGameState, summary, alertInfo, showAlert, hideAlert } = useGame();
    const { user } = useAuth();
    const { room, leaveRoom } = useRoom();

    useEffect(() => {
        if (room?.status === 'finished') {
            setShowScoreView(true);
        }
    }, [room?.status]);

    // 監控房間的市場價格更新
    useEffect(() => {
        let shouldUpdateState = false;
        let newState = {};

        // 1. 同步價格
        if (room?.marketPrices && Object.keys(room.marketPrices).length > 0) {
            // 檢查是否需要更新價格（避免無效渲染）
            const pricesChanged = JSON.stringify(room.marketPrices) !== JSON.stringify(gameState.marketPrices);

            if (pricesChanged) {
                shouldUpdateState = true;
                newState = {
                    ...newState,
                    previousMarketPrices: room.previousMarketPrices || gameState.previousMarketPrices,
                    marketPrices: { ...room.marketPrices }
                };
            }
        }

        // 2. 處理行情通知
        if (room?.marketUpdates && room.marketUpdates.timestamp !== gameState.lastMarketUpdateTimestamp) {
            const { code, isBubble, timestamp } = room.marketUpdates;

            shouldUpdateState = true;
            newState = {
                ...newState,
                lastMarketUpdateTimestamp: timestamp,
                lastPublishedCode: code
            };

            // 只有在遊戲進行中且是最近的更新才顯示通知 (避免重新整理時跳出)
            const isRecent = (Date.now() - timestamp) < 10000; // 10秒內的更新

            if (isRecent) {
                if (isBubble) {
                    showAlert(`⚠️ 股市泡沫破裂！\n代碼: ${code}\n所有股價大幅下跌`, 'error', false);
                } else {
                    showAlert(`📈 股市行情更新\n代碼: ${code}`, 'success', false);
                }
            }
        }

        if (shouldUpdateState) {
            setGameState(prev => ({
                ...prev,
                ...newState
            }));
        }
    }, [room?.marketPrices, room?.previousMarketPrices, room?.marketUpdates, gameState.lastMarketUpdateTimestamp, gameState.marketPrices, setGameState, showAlert]);

    // 監控遊戲時間結束
    useEffect(() => {
        if (room?.status === 'playing' && room?.gameTimeLeft === 0) {
            showAlert('⌛ 遊戲時間已到！\n請等待執行師進行結算。', 'info', true);
        }
    }, [room?.gameTimeLeft, room?.status, showAlert]);

    const {
        handleDeleteTransactionRecord,
        handleTransactionSubmit,
        handlePaydayConfirm,
        confirmMedicalClaim,
        confirmAircraftClaim,
        handleToggleHappiness,
        handleAddHappinessItem,
        handleRemoveHappinessItem,
        handlePromotionConfirm,
        handleBizUpgrade,
        handleLifelongConfirm,
        applyLifelongResult,
        applyExamResult,
        happinessSubMode,
        setHappinessSubMode
    } = useGameLogic();

    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [showHappinessModal, setShowHappinessModal] = useState(false);
    const [showPromotionModal, setShowPromotionModal] = useState(false);
    const [showLifelongModal, setShowLifelongModal] = useState(false);
    const [showPaydayModal, setShowPaydayModal] = useState(false);
    const [showMedicalClaimModal, setShowMedicalClaimModal] = useState(false);
    const [showDiceModal, setShowDiceModal] = useState(false);
    const [lastDiceSuccess, setLastDiceSuccess] = useState(false);
    const [showRankListModal, setShowRankListModal] = useState(false);
    const [showStockMarketModal, setShowStockMarketModal] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [showWinAnimation, setShowWinAnimation] = useState(false);
    const [showScoreView, setShowScoreView] = useState(false);
    const [isSettlement, setIsSettlement] = useState(false); // 追蹤是否是結算時打開
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    const [promotionType, setPromotionType] = useState<PromotionType | null>(null);

    useEffect(() => {
        const hasSeenTutorial = localStorage.getItem('happiness_flow_tutorial_seen');
        if (!hasSeenTutorial) {
            setShowTutorial(true);
        }
    }, []);

    // 監控幸福值是否達標
    useEffect(() => {
        if (gameState.happinessTotal >= 100 && !gameState.hasShownWinAnimation) {
            setShowWinAnimation(true);
            setGameState(prev => ({ ...prev, hasShownWinAnimation: true }));
        }
    }, [gameState.happinessTotal, gameState.hasShownWinAnimation, setGameState]);

    const handleCloseTutorial = () => {
        localStorage.setItem('happiness_flow_tutorial_seen', 'true');
        setShowTutorial(false);
    };

    const handleLeaveRoom = async () => {
        setIsLeaving(true);
        try {
            // 1. 執行離開房間邏輯 (從 Firestore 移除成員並清理 localStorage 的 active_room)
            await leaveRoom();

            // 2. 清理本地遊戲狀態，確保下次進入時是乾淨的
            localStorage.removeItem('happiness_game_state');
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
                selectionStep: null,
                history: [],
                happiness: [],
                happinessTotal: 0,
                marketPrices: {},
                previousMarketPrices: {},
                lastPublishedCode: '',
                lastMarketUpdateTimestamp: 0,
                abilities: {
                    stockAbilityCount: 0,
                    realEstateAbilityCount: 0,
                    professionAbilityCount: 0,
                },
                completedHappinessEvents: [],
                playerName: '',
                reportName: ''
            } as any);

            // 3. 回到大廳
            onFinishGame(null);
        } catch (err) {
            console.error('離開房間失敗:', err);
            showAlert('離開失敗，請稍後再試', 'error');
        } finally {
            setIsLeaving(false);
            setShowLeaveConfirm(false);
        }
    };

    const handleTransaction = (data: any) => {
        if (handleTransactionSubmit(data)) {
            // 只有一般交易才關閉視窗，股市漲幅等需要留在 Phase 3 的則由元件內部控制或不在此處關閉
            // 這裡判斷：如果是股市漲跌更新，則不立即關閉，讓 TransactionForm 顯示 Phase 3
            if (data.usage === 'stock_update' && data.stockFluctuationPayload) {
                // 不關閉，讓 TransactionForm 顯示成功畫面
                return;
            }
            setShowTransactionModal(false);
        }
    };

    const onModalPaydayConfirm = () => {
        handlePaydayConfirm();
        setShowPaydayModal(false);
    };

    const onModalMedicalConfirm = (type: 'medical' | 'aircraft') => {
        if (type === 'medical') {
            confirmMedicalClaim();
        } else {
            confirmAircraftClaim();
        }
        setShowMedicalClaimModal(false);
    };

    const onPromotionRegister = (type: PromotionType) => {
        if (type === 'normal') {
            if (handlePromotionConfirm(type)) {
                setPromotionType(type);
                setShowPromotionModal(false);
                setShowDiceModal(true);
            }
        }
    };

    const onLifelongConfirm = (type: string, cost: number) => {
        if (handleLifelongConfirm(type, cost)) {
            setPromotionType(type as PromotionType);
            setShowLifelongModal(false);
            setShowDiceModal(true);
        }
    };

    const onDiceComplete = (success: boolean, bonus: number, newTitle: string) => {
        setLastDiceSuccess(success);
        if (promotionType === 'normal') {
            applyExamResult(success, bonus, newTitle);
        } else if (promotionType) {
            // 不在這裡直接顯示 Alert，等到關閉彈窗再顯示
            applyLifelongResult(promotionType, success, false);
        }
    };

    const handleDiceModalClose = () => {
        setShowDiceModal(false);

        // 如果是終身學習且成功，在此時顯示 Alert
        if (lastDiceSuccess && promotionType && promotionType !== 'normal') {
            const messages: Record<string, string> = {
                'enhance_profession': '職業能力已提升，職位晉升一級！',
                'stock_ability': '已獲得投資股票的能力，現有持股已翻倍！',
                'real_estate_ability': '已獲得投資不動產的能力，房租收入已增加！'
            };
            showAlert(`🎉 ${messages[promotionType as string] || '學習成功！'}`, 'success');
        }

        // 重置成功狀態
        setLastDiceSuccess(false);
    };

    return (
        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden touch-none animate-in fade-in duration-500" style={{ 
            paddingTop: 'env(safe-area-inset-top, 20px)',
            paddingBottom: 'env(safe-area-inset-bottom, 20px)'
        }}>
            {showScoreView && (
                <div className="fixed inset-0 z-[10000]">
                    <ScoreView
                        playerName={user?.name || 'Player'}
                        onClose={() => {
                            setShowScoreView(false);
                            setIsSettlement(false);
                        }}
                        showAchievements={isSettlement}
                    />
                </div>
            )}
            {/* Alert System */}
            {alertInfo && (
                <div className={`fixed left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 shadow-xl flex items-center gap-3 animate-in zoom-in-95 duration-300 border backdrop-blur-md transition-all ${alertInfo.persist
                    ? "top-1/2 -translate-y-1/2 w-[85vw] max-w-xs text-center flex-col py-6 rounded-2xl bg-slate-900/95 border-slate-700/50 shadow-2xl"
                    : "bottom-32 w-max max-w-[90vw] flex-row rounded-full bg-slate-900/90 border-slate-700/50 shadow-lg"
                    } ${alertInfo.type === 'error' ? 'border-rose-500/50' :
                        alertInfo.type === 'success' ? 'border-emerald-500/50' :
                            'border-slate-700/50'
                    }`}>
                    <div className={`shrink-0 p-2 rounded-xl ${alertInfo.type === 'error' ? 'bg-rose-500/10 text-rose-400' :
                        alertInfo.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-blue-500/10 text-blue-400'
                        }`}>
                        {alertInfo.type === 'error' ? <AlertCircle size={20} /> : alertInfo.type === 'success' ? <CheckCircle2 size={20} /> : <Bell size={20} />}
                    </div>
                    <div className="flex flex-col gap-3 w-full">
                        <span className={`font-bold leading-snug whitespace-pre-line tracking-tight text-white ${alertInfo.persist ? "text-lg" : "text-sm px-1"
                            }`}>
                            {alertInfo.message}
                        </span>
                        {alertInfo.persist && (
                            <button
                                onClick={hideAlert}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black transition-all active:scale-95 shadow-lg shadow-blue-900/20 mt-1"
                            >
                                我知道了
                            </button>
                        )}
                    </div>
                </div>
            )}

            <GameHeader
                gameState={gameState}
                summary={summary}
                onShowRankList={() => setShowRankListModal(true)}
                onShowPromotion={() => setShowPromotionModal(true)}
                onFinishGame={() => setShowScoreView(true)}
                onShowStockMarket={() => setShowStockMarketModal(true)}
                onShowTutorial={() => setShowTutorial(true)}
                onLeaveRoom={() => setShowLeaveConfirm(true)}
            />

            {showLeaveConfirm && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-[32px] p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="p-4 bg-rose-500/20 text-rose-400 rounded-3xl">
                                <LogOut size={40} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white">確定要離開房間？</h3>
                                <p className="text-slate-400 font-medium">離開後將無法繼續目前的遊戲，且資料將不會被儲存。</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleLeaveRoom}
                                disabled={isLeaving}
                                className="w-full py-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-2xl text-lg font-black transition-all active:scale-95 shadow-lg shadow-rose-900/40 flex items-center justify-center gap-2"
                            >
                                {isLeaving ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : '確定離開'}
                            </button>
                            <button
                                onClick={() => setShowLeaveConfirm(false)}
                                disabled={isLeaving}
                                className="w-full py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-2xl text-lg font-black transition-all active:scale-95"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showWinAnimation && (
                <HappinessWinAnimation onComplete={() => setShowWinAnimation(false)} />
            )}

            {showStockMarketModal && (
                <StockMarketModal
                    onClose={() => setShowStockMarketModal(false)}
                    onOpenTrade={() => {
                        setShowStockMarketModal(false);
                        setShowTransactionModal(true);
                    }}
                />
            )}

            <main className="flex-1 overflow-y-auto no-scrollbar px-4 pt-48 pb-48 space-y-8 touch-pan-y">
                <div className="max-w-7xl mx-auto w-full space-y-6">
                    <GameStats
                        gameState={gameState}
                        summary={summary}
                        onOpenHappiness={() => setShowHappinessModal(true)}
                    />

                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <FinancialStatement
                            gameState={gameState}
                            summary={summary}
                            hideSummary={true}
                            defaultShowDetails={true}
                            onShowAlert={showAlert}
                            onDeleteTransaction={handleDeleteTransactionRecord}
                            onUpgradeBiz={handleBizUpgrade}
                            disabled={room?.status === 'finished'}
                        />
                    </div>
                </div>
                <div className="hidden lg:block space-y-6 h-[600px]">
                    <HappinessPanel
                        items={gameState.happiness}
                        total={gameState.happinessTotal}
                        onToggle={handleToggleHappiness}
                        onAddCustomItem={handleAddHappinessItem}
                        onRemoveCustomItem={handleRemoveHappinessItem}
                        disabled={room?.status === 'finished'}
                    />
                </div>
            </main>

            <GameActions
                onShowMedical={() => setShowMedicalClaimModal(true)}
                onShowTransaction={() => setShowTransactionModal(true)}
                onShowPayday={() => setShowPaydayModal(true)}
                onShowSettlement={() => {
                    setShowScoreView(true);
                    setIsSettlement(true);
                }}
                disabled={room?.status === 'finished'}
            />

            {/* Modals */}
            {showTransactionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <TransactionForm
                        profession={gameState.profession}
                        selectedEnterprise={gameState.selectedEnterprise}
                        selectedDream={gameState.selectedDream}
                        cash={gameState.cash}
                        salary={gameState.profession?.salary || 0}
                        assets={gameState.assets}
                        happiness={gameState.happiness}
                        currentRankLevel={gameState.currentRankLevel}
                        marketPrices={gameState.marketPrices}
                        previousMarketPrices={gameState.previousMarketPrices}
                        liabilities={gameState.liabilities.concat(gameState.loans > 0 ? [{ id: 'bank_loan', name: '信用貸款 (Legacy)', totalOwed: gameState.loans, monthlyPayment: gameState.loans * 0.1, type: '信用貸款' }] : [])}
                        happinessSubMode={happinessSubMode}
                        setHappinessSubMode={setHappinessSubMode}
                        onTransaction={handleTransaction}
                        onCancel={() => setShowTransactionModal(false)}
                        disabled={room?.status === 'finished'}
                        onShowMarket={() => {
                            setShowTransactionModal(false);
                            setShowStockMarketModal(true);
                        }}
                        onShowAlert={showAlert}
                    />
                </div>
            )}

            {showRankListModal && (
                <RankListModal
                    profession={gameState.profession}
                    currentRankTitle={gameState.currentRankTitle}
                    currentRankLevel={gameState.currentRankLevel}
                    onClose={() => setShowRankListModal(false)}
                    onShowPromotion={() => setShowPromotionModal(true)}
                    onShowLifelong={() => setShowLifelongModal(true)}
                    disabled={room?.status === 'finished'}
                />
            )}

            {showLifelongModal && (
                <LifelongLearningModal
                    isOpen={showLifelongModal}
                    onClose={() => setShowLifelongModal(false)}
                    onBack={() => {
                        setShowLifelongModal(false);
                        setShowRankListModal(true);
                    }}
                    onConfirm={onLifelongConfirm}
                    gameState={gameState}
                    disabled={room?.status === 'finished'}
                />
            )}

            {showPaydayModal && (
                <PaydayModal
                    isOpen={showPaydayModal}
                    monthlyCashflow={summary.monthlyCashflow}
                    formatMoney={formatMoney}
                    onConfirm={onModalPaydayConfirm}
                    onClose={() => setShowPaydayModal(false)}
                    disabled={room?.status === 'finished'}
                />
            )}

            {showMedicalClaimModal && (
                <MedicalClaimModal
                    isOpen={showMedicalClaimModal}
                    insuranceCount={gameState.medicalInsuranceCount}
                    hasInsuredAircraft={gameState.assets.some(a => a.type === '飛行器' && a.isInsured)}
                    formatMoney={formatMoney}
                    onConfirm={onModalMedicalConfirm}
                    onClose={() => setShowMedicalClaimModal(false)}
                    disabled={room?.status === 'finished'}
                />
            )}

            {showPromotionModal && (
                <PromotionModal
                    isOpen={showPromotionModal}
                    onConfirm={onPromotionRegister}
                    onClose={() => setShowPromotionModal(false)}
                    onBack={() => {
                        setShowPromotionModal(false);
                        setShowRankListModal(true);
                    }}
                    currentRankLevel={gameState.currentRankLevel}
                    disabled={room?.status === 'finished'}
                />
            )}

            {showDiceModal && (
                <DiceRollContainer
                    isOpen={showDiceModal}
                    onClose={handleDiceModalClose}
                    onResult={onDiceComplete}
                    promotionType={promotionType}
                />
            )}

            {showHappinessModal && (
                <HappinessListModal
                    items={gameState.happiness}
                    total={gameState.happinessTotal}
                    onToggle={handleToggleHappiness}
                    onAdd={handleAddHappinessItem}
                    onRemove={handleRemoveHappinessItem}
                    onClose={() => setShowHappinessModal(false)}
                    disabled={room?.status === 'finished'}
                />
            )}

            {showStockMarketModal && (
                <StockMarketModal
                    onClose={() => setShowStockMarketModal(false)}
                    onOpenTrade={() => {
                        setShowStockMarketModal(false);
                        setShowTransactionModal(true);
                    }}
                />
            )}

            <TutorialModal
                isOpen={showTutorial}
                onClose={handleCloseTutorial}
                showSkip={true}
            />

        </div>
    );
};

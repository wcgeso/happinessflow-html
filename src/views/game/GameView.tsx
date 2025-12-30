import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import { useGameLogic } from '../../hooks/useGameLogic';
import { AlertCircle, CheckCircle2, Bell } from 'lucide-react';
import { FinancialStatement } from '../../components/business/FinancialStatement';
import { HappinessPanel } from '../../components/business/HappinessPanel';
import { TransactionForm } from '../../components/business/TransactionForm';
import { PaydayModal } from '../../components/modals/PaydayModal';
import { MedicalClaimModal } from '../../components/modals/MedicalClaimModal';
import { PromotionModal } from '../../components/modals/PromotionModal';
import { RankListModal } from '../../components/modals/RankListModal';
import { LifelongLearningModal } from '../../components/modals/LifelongLearningModal';
import { SettlementConfirmModal } from '../../components/modals/SettlementConfirmModal';
import { HappinessListModal } from '../../components/modals/HappinessListModal';
import { StockMarketModal } from '../../components/transaction/StockMarketModal';
import { TutorialModal } from '../../components/modals/TutorialModal';
import { DiceRollContainer } from '../../components/game/DiceRollContainer';
import { PromotionType } from '../../hooks/useDiceRollLogic';
import { GameHeader } from '../../components/game/GameHeader';
import { GameStats } from '../../components/game/GameStats';
import { GameActions } from '../../components/game/GameActions';
import { HappinessWinAnimation } from '../../components/game/HappinessWinAnimation';
import { formatMoney } from '../../utils/gameUtils';

export const GameView: React.FC<{ onFinishGame: (meta: any) => void }> = ({ onFinishGame }) => {
    const { gameState, setGameState, summary, alertInfo, showAlert, hideAlert } = useGame();
    const { user } = useAuth();
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
    const [showSettlementConfirm, setShowSettlementConfirm] = useState(false);
    const [showStockMarketModal, setShowStockMarketModal] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [showWinAnimation, setShowWinAnimation] = useState(false);

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

    const confirmFinish = () => {
        setShowSettlementConfirm(false);
        onFinishGame({ playerName: user?.name || 'Player' });
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
        <div className="min-h-screen bg-slate-950 pb-20 overflow-x-hidden no-scrollbar animate-in fade-in duration-500">
            {/* Alert System */}
            {alertInfo && (
                <div className={`fixed bottom-36 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 border max-w-[90vw] w-max ${alertInfo.type === 'error' ? 'bg-rose-900 border-rose-500 text-rose-100' :
                    alertInfo.type === 'success' ? 'bg-emerald-900 border-emerald-500 text-emerald-100' :
                        'bg-slate-800 border-slate-600 text-white'
                    }`}>
                    <div className="shrink-0">
                        {alertInfo.type === 'error' ? <AlertCircle size={20} /> : alertInfo.type === 'success' ? <CheckCircle2 size={20} /> : <Bell size={20} />}
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="font-bold text-sm leading-tight whitespace-pre-line">
                            {alertInfo.message}
                        </span>
                        {alertInfo.persist && (
                            <button 
                                onClick={hideAlert}
                                className="mt-1 self-end px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-black transition-colors border border-white/20"
                            >
                                確認
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
                onFinishGame={() => setShowSettlementConfirm(true)}
                onShowStockMarket={() => setShowStockMarketModal(true)}
                onShowTutorial={() => setShowTutorial(true)}
            />

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

            <main className="max-w-7xl mx-auto px-4 pt-44 pb-32 space-y-8">
                <div className="space-y-6">
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
                    />
                </div>
            </main>

            <GameActions
                onShowMedical={() => setShowMedicalClaimModal(true)}
                onShowTransaction={() => setShowTransactionModal(true)}
                onShowPayday={() => setShowPaydayModal(true)}
                onShowSettlement={() => setShowSettlementConfirm(true)}
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
                />
            )}

            {showPaydayModal && (
                <PaydayModal
                    isOpen={showPaydayModal}
                    monthlyCashflow={summary.monthlyCashflow}
                    formatMoney={formatMoney}
                    onConfirm={onModalPaydayConfirm}
                    onClose={() => setShowPaydayModal(false)}
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

            {showSettlementConfirm && (
                <SettlementConfirmModal
                    onConfirm={confirmFinish}
                    onCancel={() => setShowSettlementConfirm(false)}
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

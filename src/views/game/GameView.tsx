import React, { useState, useEffect, useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import { useGameLogic } from '../../hooks/useGameLogic';
import { AlertCircle, CheckCircle2, Bell, LogOut } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { FinancialStatement } from '../../components/business/FinancialStatement';
import { HappinessPanel } from '../../components/business/HappinessPanel';
import { TargetDreamSelectorModal } from '../../components/banking/TargetDreamSelectorModal';
import { TransactionForm } from '../../components/business/TransactionForm';
import { PaydayModal } from '../../components/modals/PaydayModal';
import { MedicalClaimModal } from '../../components/modals/MedicalClaimModal';
import { PromotionModal } from '../../components/modals/PromotionModal';
import { RankListModal } from '../../components/modals/RankListModal';
import { LifelongLearningModal } from '../../components/modals/LifelongLearningModal';
import { HappinessListModal } from '../../components/modals/HappinessListModal';
import { TutorialModal } from '../../components/modals/TutorialModal';
import { DiceRollContainer } from '../../components/game/DiceRollContainer';
import { ScoreView } from './ScoreView';
import { PromotionType } from '../../hooks/useDiceRollLogic';
import { GameHeader } from '../../components/game/GameHeader';
import { GameStats } from '../../components/game/GameStats';
import { GameActions } from '../../components/game/GameActions';
import { BoardCardDrawer } from '../../components/game/BoardCardDrawer';
import { BoardFinancialCheckModal } from '../../components/game/BoardFinancialCheckModal';
import { HappinessWinAnimation } from '../../components/game/HappinessWinAnimation';
import { hydrateBoardCardResult } from '../../utils/boardCardDisplay';
import { formatMoney } from '../../utils/gameUtils';
import { TransactionData } from '../../types';
import { BoardAssetSaleCandidate, BoardFinancialAction, buildBoardAssetSaleFinancialAction, resolveBoardCardAction } from '../../utils/boardCardActions';
import { NEWS_CARD_MAP } from '../../constants/cards';

export const GameView: React.FC<{ 
    onFinishGame: (meta: any) => void;
    isDevMode?: boolean;
}> = ({ onFinishGame, isDevMode = false }) => {
    const { gameState, setGameState, summary, alertInfo, showAlert, hideAlert } = useGame();
    const { user } = useAuth();
    const { room, leaveRoom, rollBoardDice, revealBoardCard, applyBoardMarketPrices, abandonRealEstateCard, buyRealEstateFromMarket } = useRoom();

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
        executePayday,
        confirmMedicalClaim,
        executeMedicalClaim,
        confirmAircraftClaim,
        executeAircraftClaim,
        addMoney,
        handleToggleHappiness,
        handleAddHappinessItem,
        executeAddHappinessItem,
        handleRemoveHappinessItem,
        handlePromotionConfirm,
        executePromotionFee,
        handleBizUpgrade,
        handleLifelongConfirm,
        executeLifelongFee,
        applyLifelongResult,
        applyExamResult,
        handleFinishGame,
        happinessSubMode,
        setHappinessSubMode
    } = useGameLogic();

    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [showTargetDreamModal, setShowTargetDreamModal] = useState(false);
    const [showHappinessModal, setShowHappinessModal] = useState(false);
    const [showPromotionModal, setShowPromotionModal] = useState(false);
    const [showLifelongModal, setShowLifelongModal] = useState(false);
    const [showPaydayModal, setShowPaydayModal] = useState(false);
    const [showMedicalClaimModal, setShowMedicalClaimModal] = useState(false);
    const [showDiceModal, setShowDiceModal] = useState(false);
    const [lastDiceSuccess, setLastDiceSuccess] = useState(false);
    const [showRankListModal, setShowRankListModal] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [showWinAnimation, setShowWinAnimation] = useState(false);
    const [showScoreView, setShowScoreView] = useState(false);
    const [isSettlement, setIsSettlement] = useState(false); // 追蹤是否是結算時打開
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isBoardCardDrawerOpen, setIsBoardCardDrawerOpen] = useState(false);
    const [lastBoardCardKey, setLastBoardCardKey] = useState<string | null>(null);
    const [isBoardCardRevealed, setIsBoardCardRevealed] = useState(false);
    const [handledBankPromptKeys, setHandledBankPromptKeys] = useState<string[]>([]);
    const [lastBankPromptKey, setLastBankPromptKey] = useState<string | null>(null);
    const [handledSchoolPromptKeys, setHandledSchoolPromptKeys] = useState<string[]>([]);
    const [lastSchoolPromptKey, setLastSchoolPromptKey] = useState<string | null>(null);
    const [handledBoardCardKeys, setHandledBoardCardKeys] = useState<string[]>([]);
    const [paydayStep, setPaydayStep] = useState<'confirm' | 'followup'>('confirm');
    const [transactionQuickPreset, setTransactionQuickPreset] = useState<{ initialTab?: 'broker' | 'banking' | 'wealth', mode?: 'buy' | 'sell', assetType?: '保險' | '定存' | '股票' } | null>(null);
    const [boardFinancialAction, setBoardFinancialAction] = useState<BoardFinancialAction | null>(null);
    const [selectedBoardSaleAssetIds, setSelectedBoardSaleAssetIds] = useState<string[]>([]);
    const [appliedBoardMarketKeys, setAppliedBoardMarketKeys] = useState<string[]>([]);
    const [isApplyingBoardMarket, setIsApplyingBoardMarket] = useState(false);
    const [showRealEstateMarketModal, setShowRealEstateMarketModal] = useState(false);

    const [promotionType, setPromotionType] = useState<PromotionType | null>(null);
    const [isRollingBoardDice, setIsRollingBoardDice] = useState(false);

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
        setBoardFinancialAction({
            kind: 'financial',
            label: '確認交易內容',
            txData: data,
            expectedEntries: []
        });
        setShowTransactionModal(false);
        setTransactionQuickPreset(null);
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
            const result = handlePromotionConfirm(type);
            if (result === true) {
                setPromotionType(type);
                setShowPromotionModal(false);
                setShowDiceModal(true);
            } else if (result === 'pending') {
                setPromotionType(type);
                setShowPromotionModal(false);
            }
        }
    };

    const onLifelongConfirm = (type: string, cost: number) => {
        const result = handleLifelongConfirm(type, cost);
        if (result === true) {
            setPromotionType(type as PromotionType);
            setShowLifelongModal(false);
            setShowDiceModal(true);
        } else if (result === 'pending') {
            setPromotionType(type as PromotionType);
            setShowLifelongModal(false);
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

    const boardState = room?.boardState || null;
    const isBoardTurn = !!(room?.isBoardGame && boardState?.currentTurnUid === user?.uid);
    const hasCar = gameState.assets.some(asset => asset.type === '汽車' || asset.type === '飛行器');
    const activeBoardCard = boardState?.currentEvent?.playerUid === user?.uid ? boardState?.currentCard || null : null;
    const activeBankPromptKey = boardState?.currentEvent?.playerUid === user?.uid &&
        boardState?.currentEvent?.detail?.includes('月結餘')
        ? `${boardState.currentEvent.id}_bank`
        : null;
    const isActiveBankPromptPending = !!(activeBankPromptKey && !handledBankPromptKeys.includes(activeBankPromptKey));

    const activeSchoolPromptKey = boardState?.currentEvent?.playerUid === user?.uid &&
        (boardState?.currentEvent?.type === 'school' || boardState?.currentEvent?.detail?.includes('學校'))
        ? `${boardState.currentEvent.id}_school`
        : null;
    const isActiveSchoolPromptPending = !!(activeSchoolPromptKey && !handledSchoolPromptKeys.includes(activeSchoolPromptKey));

    const activeBoardCardKey = activeBoardCard && boardState?.currentEvent
        ? `${boardState.currentEvent.id}_${activeBoardCard.cardId}`
        : null;
    const activeBoardCardAction = useMemo(
        () => (activeBoardCard ? resolveBoardCardAction(activeBoardCard.cardId, gameState) : null),
        [activeBoardCard?.cardId, gameState]
    );
    const displayBoardCard = useMemo(
        () => hydrateBoardCardResult(activeBoardCard, gameState),
        [activeBoardCard, gameState]
    );
    const isActiveBoardCardHandled = !!(activeBoardCardKey && handledBoardCardKeys.includes(activeBoardCardKey));

    const handleBoardDiceRoll = async () => {
        setIsRollingBoardDice(true);
        try {
            const result = await rollBoardDice();
            setGameState(prev => ({
                ...prev,
                boardPosition: result.position,
                skipTurns: result.skipTurns,
                lastBoardEvent: `擲出 ${result.total} 點，前進至第 ${result.position + 1} 格`,
                pendingCardAction: result.detail
            }));
            showAlert(`擲出 ${result.total} 點，已完成移動並同步地圖事件`, 'success');
            return { total: result.total, dice: result.dice };
        } catch (err: any) {
            showAlert(err.message || '擲骰失敗', 'error');
            throw err;
        } finally {
            setIsRollingBoardDice(false);
        }
    };

    useEffect(() => {
        if (!activeBoardCardKey || activeBoardCardKey === lastBoardCardKey) return;
        if (showPaydayModal || isActiveBankPromptPending) return;

        setLastBoardCardKey(activeBoardCardKey);
        setIsBoardCardDrawerOpen(true);
        setIsBoardCardRevealed(false);
        setSelectedBoardSaleAssetIds([]);
    }, [activeBoardCardKey, lastBoardCardKey, showPaydayModal, isActiveBankPromptPending]);

    useEffect(() => {
        if (!activeBoardCardKey || !activeBoardCardAction || activeBoardCardAction.kind !== 'market') return;
        if (appliedBoardMarketKeys.includes(activeBoardCardKey) || isApplyingBoardMarket) return;

        let isCancelled = false;
        setIsApplyingBoardMarket(true);

        applyBoardMarketPrices(activeBoardCardAction.prices, activeBoardCardAction.code, activeBoardCardAction.isBubble)
            .then(() => {
                if (isCancelled) return;
                setAppliedBoardMarketKeys(prev => prev.includes(activeBoardCardKey) ? prev : [...prev, activeBoardCardKey]);
                showAlert('已同步股市行情到房間', 'success');
            })
            .catch((err: any) => {
                if (isCancelled) return;
                showAlert(err.message || '同步股市行情失敗', 'error');
            })
            .finally(() => {
                if (!isCancelled) {
                    setIsApplyingBoardMarket(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [activeBoardCardKey, activeBoardCardAction, appliedBoardMarketKeys, applyBoardMarketPrices, isApplyingBoardMarket, showAlert]);

    useEffect(() => {
        if (!activeBankPromptKey || activeBankPromptKey === lastBankPromptKey || !isActiveBankPromptPending) return;
        setLastBankPromptKey(activeBankPromptKey);
        setHandledBankPromptKeys(prev => prev.includes(activeBankPromptKey) ? prev : [...prev, activeBankPromptKey]);
        setPaydayStep('confirm');
        setShowPaydayModal(true);
    }, [activeBankPromptKey, lastBankPromptKey, isActiveBankPromptPending, summary.monthlyCashflow]);

    useEffect(() => {
        if (!activeSchoolPromptKey || activeSchoolPromptKey === lastSchoolPromptKey || !isActiveSchoolPromptPending) return;
        setLastSchoolPromptKey(activeSchoolPromptKey);
        setHandledSchoolPromptKeys(prev => prev.includes(activeSchoolPromptKey) ? prev : [...prev, activeSchoolPromptKey]);
        setShowPromotionModal(true);
    }, [activeSchoolPromptKey, lastSchoolPromptKey, isActiveSchoolPromptPending]);

    const markBoardCardHandled = async () => {
        if (!activeBoardCardKey) return;

        // 如果是房屋卡，且未被處理過，且不是透過購買行為（因為購買行為已經把狀態存到玩家身上），
        // 我們就把這張卡推進 realEstateMarket。
        if (activeBoardCard?.deck === 'news' && activeBoardCard?.cardId) {
            const newsCard = NEWS_CARD_MAP[activeBoardCard.cardId];
            if (newsCard && newsCard.type === 'real_estate') {
                await abandonRealEstateCard(activeBoardCard.cardId);
            }
        }

        setHandledBoardCardKeys(prev => prev.includes(activeBoardCardKey) ? prev : [...prev, activeBoardCardKey]);
        setIsBoardCardDrawerOpen(false);
    };

    const handleBoardCardReveal = () => {
        setIsBoardCardRevealed(true);
        if (boardState?.currentEvent?.id && activeBoardCard?.cardId) {
            revealBoardCard(boardState.currentEvent.id, activeBoardCard.cardId);
        }
    };

    const handleApplyDirectHappiness = () => {
        if (!activeBoardCard || !activeBoardCardAction || activeBoardCardAction.kind !== 'happiness') return;

        setGameState(prev => {
            const newItem = {
                id: `board_${activeBoardCard.cardId}_${Date.now()}`,
                label: activeBoardCardAction.title,
                points: activeBoardCardAction.points,
                checked: true,
                isCustom: true
            };
            const happiness = [...prev.happiness, newItem];
            return {
                ...prev,
                happiness,
                happinessTotal: happiness.reduce((sum, item) => sum + (item.checked ? item.points : 0), 0),
                completedHappinessEvents: Array.from(new Set([...(prev.completedHappinessEvents || []), activeBoardCard.cardId]))
            };
        });

        showAlert(`已套用 ${activeBoardCardAction.points} 點幸福`, 'success');
        markBoardCardHandled();
    };

    const handleApplyBoardFinancialTx = (txData: TransactionData) => {
        if ((gameState.cash + txData.cashChange) < 0) {
            showAlert('現金不足，無法套用這張卡片效果', 'error');
            return;
        }

        handleTransaction(txData);
        setBoardFinancialAction(null);
        showAlert('卡片效果已套用到財務報表', 'success');
        markBoardCardHandled();
    };

    const handleBuyRealEstateFromMarket = async (cardId: string, isSelfUse: boolean) => {
        const cardAction = resolveBoardCardAction(cardId, gameState);
        if (cardAction.kind === 'choice') {
            const opt = cardAction.options.find(o => o.id === (isSelfUse ? 'self_use' : 'rental'));
            if (opt && opt.action.kind === 'financial') {
                const txData = opt.action.txData;
                if ((gameState.cash + txData.cashChange) < 0) {
                    showAlert('現金不足，無法購買', 'error');
                    return;
                }
                handleTransaction(txData);
                await buyRealEstateFromMarket(cardId);
                showAlert('已從房市公告板購買房屋', 'success');
                setShowRealEstateMarketModal(false);
            }
        }
    };

    const openQuickTransaction = (assetType: '保險' | '定存') => {
        setTransactionQuickPreset({ mode: 'buy', assetType });
        setShowPaydayModal(false);
        setPaydayStep('confirm');
        setShowTransactionModal(true);
    };

    const handleBoardAssetSaleConfirm = (items: BoardAssetSaleCandidate[]) => {
        const action = buildBoardAssetSaleFinancialAction(
            `卡片出售：${activeBoardCard?.title || '資產出售'}`,
            items
        );

        if (!action) {
            showAlert('請先選擇要出售的資產', 'error');
            return;
        }

        setBoardFinancialAction(action);
    };

    return (
        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden touch-none animate-in fade-in duration-500 pb-safe">
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
                onShowHappiness={() => setShowHappinessModal(true)}
                onFinishGame={() => setShowScoreView(true)}
                onShowStockMarket={() => { setTransactionQuickPreset({ initialTab: 'broker' }); setShowTransactionModal(true); }}
                onShowTutorial={() => setShowTutorial(true)}
                onLeaveRoom={() => setShowLeaveConfirm(true)}
                onAddMoney={addMoney}
                isDevMode={isDevMode}
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

            <main className="fixed inset-0 overflow-y-auto no-scrollbar pt-[130px] pb-[120px] touch-pan-y">
                <div className="max-w-4xl mx-auto w-full px-4 md:px-6 space-y-6">
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <FinancialStatement
                            gameState={gameState}
                            summary={summary}
                            hideSummary={true}
                            showDashboard={false}
                            defaultShowDetails={true}
                            onShowAlert={showAlert}
                            onDeleteTransaction={handleDeleteTransactionRecord}
                            onUpgradeBiz={handleBizUpgrade}
                            disabled={room?.status === 'finished'}
                        />
                    </div>
                </div>
            </main>

            <GameActions
                onRollBoardDice={room?.isBoardGame ? handleBoardDiceRoll : undefined}
                onShowMedical={() => setShowMedicalClaimModal(true)}
                onShowTargetDream={() => setShowTargetDreamModal(true)}
                onShowTransaction={() => {
                    setTransactionQuickPreset(null);
                    setShowTransactionModal(true);
                }}
                onShowRealEstateMarket={() => setShowRealEstateMarketModal(true)}
                onShowPayday={() => setShowPaydayModal(true)}
                onShowSettlement={() => {
                    setShowScoreView(true);
                    setIsSettlement(true);
                }}
                isBoardTurn={isBoardTurn}
                isRollingBoardDice={isRollingBoardDice}
                hasCar={hasCar}
                disabled={room?.status === 'finished'}
            />

            {displayBoardCard && (
                <BoardCardDrawer
                    card={displayBoardCard}
                    isOpen={isBoardCardDrawerOpen}
                    isRevealed={isBoardCardRevealed}
                    onReveal={handleBoardCardReveal}
                    onClose={() => setIsBoardCardDrawerOpen(false)}
                    actionArea={isBoardCardRevealed && activeBoardCardAction ? (
                        <div className="space-y-3 px-2 pt-1">
                            {activeBoardCardAction.kind === 'financial' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={markBoardCardHandled}
                                        disabled={isActiveBoardCardHandled}
                                        className="rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        關閉
                                    </button>
                                    <button
                                        onClick={() => setBoardFinancialAction(activeBoardCardAction)}
                                        disabled={isActiveBoardCardHandled}
                                        className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isActiveBoardCardHandled ? '此卡已處理' : activeBoardCardAction.label}
                                    </button>
                                </div>
                            )}

                            {activeBoardCardAction.kind === 'happiness' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={markBoardCardHandled}
                                        disabled={isActiveBoardCardHandled}
                                        className="rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        關閉
                                    </button>
                                    <button
                                        onClick={handleApplyDirectHappiness}
                                        disabled={isActiveBoardCardHandled}
                                        className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isActiveBoardCardHandled ? '此卡已處理' : activeBoardCardAction.label}
                                    </button>
                                </div>
                            )}

                            {activeBoardCardAction.kind === 'market' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            setTransactionQuickPreset({ initialTab: 'broker' });
                                            setShowTransactionModal(true);
                                            markBoardCardHandled();
                                        }}
                                        disabled={isActiveBoardCardHandled}
                                        className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        前往交易
                                    </button>
                                    <button
                                        onClick={markBoardCardHandled}
                                        disabled={isActiveBoardCardHandled}
                                        className="rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        關閉
                                    </button>
                                </div>
                            )}

                            {activeBoardCardAction.kind === 'choice' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        {activeBoardCardAction.options.map(option => {
                                            let isInsufficientCash = false;
                                            if (option.action.kind === 'financial' && option.id !== 'reject') {
                                                isInsufficientCash = (gameState.cash + option.action.txData.cashChange) < 0;
                                            }
                                            return (
                                                <button
                                                    key={option.id}
                                                    onClick={() => {
                                                        if (option.action.kind === 'dismiss') {
                                                            markBoardCardHandled();
                                                            return;
                                                        }
                                                        setBoardFinancialAction(option.action);
                                                    }}
                                                    disabled={isActiveBoardCardHandled || isInsufficientCash}
                                                    className={`rounded-2xl py-3.5 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                                        option.id === 'reject'
                                                            ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                                    }`}
                                                >
                                                    {isInsufficientCash ? '現金不足' : option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={markBoardCardHandled}
                                        disabled={isActiveBoardCardHandled}
                                        className="w-full rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        關閉
                                    </button>
                                </div>
                            )}

                            {activeBoardCardAction.kind === 'unsupported' && (
                                <div className="space-y-3">
                                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-4 text-sm leading-relaxed text-slate-300">
                                        {activeBoardCardAction.note}
                                    </div>
                                    <button
                                        onClick={markBoardCardHandled}
                                        disabled={isActiveBoardCardHandled}
                                        className="w-full rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        關閉
                                    </button>
                                </div>
                            )}

                            {activeBoardCardAction.kind === 'asset_sale' && (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        {activeBoardCardAction.items.length === 0 && (
                                            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-4 text-sm leading-relaxed text-slate-300">
                                                {activeBoardCardAction.emptyNote}
                                            </div>
                                        )}

                                        {activeBoardCardAction.items.map(item => {
                                            const checked = selectedBoardSaleAssetIds.includes(item.id);
                                            return (
                                                <label
                                                    key={item.id}
                                                    className={`block rounded-3xl border px-4 py-4 transition-colors ${
                                                        item.selectable
                                                            ? checked
                                                                ? 'border-emerald-500/60 bg-emerald-500/10'
                                                                : 'border-slate-800 bg-slate-900/80'
                                                            : 'border-slate-800 bg-slate-900/60 opacity-70'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            disabled={!item.selectable}
                                                            onChange={() => {
                                                                if (!item.selectable) return;
                                                                setSelectedBoardSaleAssetIds(prev =>
                                                                    prev.includes(item.id)
                                                                        ? prev.filter(id => id !== item.id)
                                                                        : [...prev, item.id]
                                                                );
                                                            }}
                                                            className="mt-1 h-5 w-5 rounded border-slate-600 bg-slate-950 text-emerald-500"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-base font-black text-white">{item.asset.name}</div>
                                                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                                                                <div className="rounded-2xl bg-slate-950/70 px-3 py-2">
                                                                    <div className="text-[10px] font-black tracking-[0.18em] text-slate-500">售價</div>
                                                                    <div className="mt-1 font-bold text-white">{formatMoney(item.price)}</div>
                                                                </div>
                                                                <div className="rounded-2xl bg-slate-950/70 px-3 py-2">
                                                                    <div className="text-[10px] font-black tracking-[0.18em] text-slate-500">貸款</div>
                                                                    <div className="mt-1 font-bold text-white">{formatMoney(item.loanBalance)}</div>
                                                                </div>
                                                                <div className="col-span-2 rounded-2xl bg-slate-950/70 px-3 py-2">
                                                                    <div className="text-[10px] font-black tracking-[0.18em] text-slate-500">出售後入帳</div>
                                                                    <div className="mt-1 text-sm font-black text-emerald-300">{formatMoney(item.netCash)}</div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 text-xs leading-relaxed text-slate-400">{item.summary}</div>
                                                            {item.disabledReason && (
                                                                <div className="mt-2 text-xs font-bold text-rose-300">{item.disabledReason}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={markBoardCardHandled}
                                            disabled={isActiveBoardCardHandled}
                                            className="rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            關閉
                                        </button>
                                        <button
                                            onClick={() => handleBoardAssetSaleConfirm(
                                                activeBoardCardAction.items.filter(item => selectedBoardSaleAssetIds.includes(item.id))
                                            )}
                                            disabled={selectedBoardSaleAssetIds.length === 0}
                                            className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {activeBoardCardAction.confirmLabel}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                />
            )}

            {boardFinancialAction && (
                <BoardFinancialCheckModal
                    title={boardFinancialAction.txData.name}
                    txData={boardFinancialAction.txData}
                    expectedEntries={boardFinancialAction.expectedEntries}
                    onApply={handleApplyBoardFinancialTx}
                    onClose={() => setBoardFinancialAction(null)}
                />
            )}

            {/* Modals */}
            {showRealEstateMarketModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 sm:p-4">
                    <div className="bg-slate-900 sm:border border-slate-700 w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-[32px] p-6 space-y-6 shadow-2xl flex flex-col pt-safe">
                        <div className="flex items-center justify-between shrink-0">
                            <h2 className="text-2xl font-black text-white">房市公告板</h2>
                            <button
                                onClick={() => setShowRealEstateMarketModal(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                關閉
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-4 pb-safe pr-2 -mr-2">
                            {(!boardState?.realEstateMarket || boardState.realEstateMarket.length === 0) ? (
                                <div className="text-center py-10 text-slate-500 font-medium">
                                    目前市場上沒有釋出的房屋
                                </div>
                            ) : (
                                boardState.realEstateMarket.map(cardId => {
                                    const newsCard = NEWS_CARD_MAP[cardId];
                                    if (!newsCard || newsCard.type !== 'real_estate') return null;
                                    
                                    const action = resolveBoardCardAction(cardId, gameState);
                                    if (action.kind !== 'choice' && action.kind !== 'financial') return null;
                                    
                                    let selfUseOpt, rentalOpt;
                                    if (action.kind === 'choice') {
                                        selfUseOpt = action.options.find(o => o.id === 'self_use');
                                        rentalOpt = action.options.find(o => o.id === 'rental');
                                    } else {
                                        // 只能出租的情況
                                        rentalOpt = { action };
                                    }
                                    
                                    const title = `不動產 ${newsCard.propertyLabel}`;
                                    const price = newsCard.totalPrice;
                                    
                                    return (
                                        <div key={cardId} className="bg-slate-800 rounded-2xl p-5 border border-slate-700 flex flex-col gap-4">
                                            <div className="flex justify-between items-start border-b border-slate-700/50 pb-3">
                                                <div>
                                                    <div className="text-lg font-bold text-slate-200">{title}</div>
                                                    <div className="text-sm text-slate-400 mt-1">{newsCard.title}</div>
                                                </div>
                                                <div className="text-emerald-400 font-black text-xl">{formatMoney(price)}</div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-500">頭期款 (自備現金)</span>
                                                    <span className="text-slate-200 font-bold">{formatMoney(newsCard.downPayment)}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-500">銀行貸款</span>
                                                    <span className="text-rose-400 font-bold">{formatMoney(newsCard.loanAmount)}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-500">每月貸款利息</span>
                                                    <span className="text-rose-400 font-bold">{formatMoney(newsCard.monthlyPayment)}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-500">每月租金收入</span>
                                                    <span className="text-emerald-400 font-bold">{formatMoney(newsCard.rent)}</span>
                                                </div>
                                                {newsCard.happinessBonus > 0 && (
                                                    <div className="col-span-2 flex items-center gap-2 bg-fuchsia-500/10 text-fuchsia-400 px-3 py-2 rounded-lg">
                                                        <span className="font-bold">自用額外獎勵：</span>
                                                        <span>幸福點數 +{newsCard.happinessBonus}</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex gap-3 mt-2 pt-3 border-t border-slate-700/50">
                                                {selfUseOpt && (
                                                    <button
                                                        onClick={() => handleBuyRealEstateFromMarket(cardId, true)}
                                                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black transition-all active:scale-95"
                                                    >
                                                        自用購買
                                                    </button>
                                                )}
                                                {rentalOpt && (
                                                    <button
                                                        onClick={() => handleBuyRealEstateFromMarket(cardId, false)}
                                                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black transition-all active:scale-95"
                                                    >
                                                        出租購買
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

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
                        medicalInsuranceCount={gameState.medicalInsuranceCount}
                        marketPrices={gameState.marketPrices}
                        previousMarketPrices={gameState.previousMarketPrices}
                        liabilities={gameState.liabilities.concat(gameState.loans > 0 ? [{ id: 'bank_loan', name: '信用貸款 (Legacy)', totalOwed: gameState.loans, monthlyPayment: gameState.loans * 0.1, type: '信用貸款' }] : [])}
                        happinessSubMode={happinessSubMode}
                        setHappinessSubMode={setHappinessSubMode}
                        onTransaction={handleTransaction}
                        onCancel={() => {
                            setShowTransactionModal(false);
                            setTransactionQuickPreset(null);
                        }}
                        disabled={room?.status === 'finished'}
                        initialTab={transactionQuickPreset?.initialTab}
                        initialMode={transactionQuickPreset?.mode}
                        initialAssetType={transactionQuickPreset?.assetType}
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
                    step={paydayStep}
                    monthlyCashflow={summary.monthlyCashflow}
                    formatMoney={formatMoney}
                    onOpenInsurance={() => openQuickTransaction('保險')}
                    onOpenDeposit={() => openQuickTransaction('定存')}
                    onSkipFollowup={() => {
                        setShowPaydayModal(false);
                        setPaydayStep('confirm');
                    }}
                    onClose={() => {
                        if (paydayStep === 'confirm') {
                            handlePaydayConfirm();
                        }
                        setShowPaydayModal(false);
                        setPaydayStep('confirm');
                    }}
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
                />
            )}

            {showTargetDreamModal && (
                <TargetDreamSelectorModal
                    enterprise={gameState.selectedEnterprise}
                    dream={gameState.selectedDream}
                    cash={gameState.cash}
                    onTransaction={handleTransaction}
                    onClose={() => setShowTargetDreamModal(false)}
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

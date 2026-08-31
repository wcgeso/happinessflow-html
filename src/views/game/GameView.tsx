import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import { useGameLogic } from '../../hooks/useGameLogic';
import { AlertCircle, CheckCircle2, Bell, LogOut } from 'lucide-react';
import { getPendingRequestExecutionKey, useRoom } from '../../context/RoomContext';
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
import { BizUpgradeModal } from '../../components/modals/BizUpgradeModal';
import { DiceRollContainer } from '../../components/game/DiceRollContainer';
import { ScoreView } from './ScoreView';
import { PromotionType } from '../../hooks/useDiceRollLogic';
import { GameHeader } from '../../components/game/GameHeader';
import { GameStats } from '../../components/game/GameStats';
import { GameActions } from '../../components/game/GameActions';
import { BoardCardDrawer } from '../../components/game/BoardCardDrawer';
import { BoardFinancialApplyResult, BoardFinancialCheckModal } from '../../components/game/BoardFinancialCheckModal';
import { HappinessWinAnimation } from '../../components/game/HappinessWinAnimation';
import { hydrateBoardCardResult } from '../../utils/boardCardDisplay';
import { formatMoney } from '../../utils/gameUtils';
import { BoardCardResult, BoardFinancialFlow, FamilyMilestoneJoinPrompt, TransactionData } from '../../types';
import { BoardAssetSaleCandidate, BoardFinancialAction, BoardInvestmentAction, buildBoardAssetSaleFinancialAction, getSharedOpportunityKind, hasIncompleteSharedPrompts, isBoardPromptForCurrentEvent, isForcedBoardCard, resolveBoardCardAction, shouldBlockBoardCardDismissal } from '../../utils/boardCardActions';
import { getFamilyMilestoneStageByProgressId, getFamilyMilestoneStatus } from '../../utils/familyMilestones';
import { buildNewsCardMetaFromSchema, HAPPINESS_CARD_MAP, NEWS_CARD_MAP, OPPORTUNITY_CARD_MAP } from '../../constants/cards';
import { flowLog } from '../../utils/flowLog';
import { getBoardActionAvailability } from '../../utils/experienceState';
import { audioManager } from '../../utils/audio';
import { PlayerModalFrame } from '../../components/common/PlayerModalFrame';

export const marketPricesMatch = (current: Record<string, number> | undefined, target: Record<string, number> | undefined) => {
    if (!current || !target) return false;
    const targetKeys = Object.keys(target);
    if (targetKeys.length === 0) return false;
    return targetKeys.every(key => (current[key] || 0) === (target[key] || 0));
};

const withBoardFlow = (action: BoardFinancialAction, boardFlow: BoardFinancialFlow): BoardFinancialAction => ({
    ...action,
    txData: { ...action.txData, boardFlow }
});

export const GameView: React.FC<{ 
    onFinishGame: (meta: any) => void;
    isDevMode?: boolean;
}> = ({ onFinishGame, isDevMode = false }) => {
    const FAMILY_JOIN_ROLL_ANIMATION_MS = 700;
    const FAMILY_JOIN_ROLL_TICK_MS = 90;
    const { gameState, setGameState, summary, alertInfo, showAlert, hideAlert } = useGame();
    const { user } = useAuth();
    const { room, leaveToLobby, rollBoardDice, revealBoardCard, dismissBoardCard, advanceBoardEventQueue, endTurn, drawPostExamHappinessCard, drawBoardFollowupCard, openFamilyMilestoneJoinPrompt, openSharedCardPrompt, submitFamilyMilestoneJoinResponse, clearPendingFamilyMilestoneJoinAction, markFamilyMilestoneSourceActionCompleted, completeFamilyMilestoneAction, submitSharedCardPromptResponse, completeStartupLoanAction, completeStartupUpgradeAction, applyVehicleLoss, applyBoardExpenseToAllPlayers, moveCurrentPlayerToSquare, applyBoardMarketPrices, buyCurrentRealEstateCard, buyRealEstateFromMarket, submitRequest, clearRequest, updatePlayerDiagnostic } = useRoom();

    useEffect(() => {
        if (room?.status === 'finished') {
            setShowScoreView(true);
        }
    }, [room?.status]);

    // 監控房間的市場價格更新（只做純粹的價格同步，不處理 marketUpdates 事件
    // 本身——事件的一次性處理，包含泡沫破裂時的持股減半與提示，統一交給
    // GameContext 那個監聽器負責，避免兩邊搶著寫 lastMarketUpdateTimestamp
    // 造成競態：這裡原本也會在偵測到 marketUpdates 時搶先蓋掉
    // lastMarketUpdateTimestamp，導致 GameContext 那邊「timestamp >
    // lastMarketUpdateTimestamp」的守門條件永遠不成立，bubbleBurst()
    // 持股減半的效果因此經常不會真的執行（詳見稽核報告 C3）。
    useEffect(() => {
        if (!room?.marketPrices || Object.keys(room.marketPrices).length === 0) return;

        const pricesChanged = JSON.stringify(room.marketPrices) !== JSON.stringify(gameState.marketPrices);
        if (!pricesChanged) return;

        setGameState(prev => ({
            ...prev,
            previousMarketPrices: room.previousMarketPrices || prev.previousMarketPrices,
            marketPrices: { ...room.marketPrices }
        }));
    }, [room?.marketPrices, room?.previousMarketPrices, gameState.marketPrices, setGameState]);

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
    const [isBoardCardRevealAnimationComplete, setIsBoardCardRevealAnimationComplete] = useState(false);
    const boardCardRevealInFlightRef = useRef<string | null>(null);
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
    const [pendingForcedBoardPayment, setPendingForcedBoardPayment] = useState<TransactionData | null>(null);
    const [showForcedBoardPaymentModal, setShowForcedBoardPaymentModal] = useState(false);
    const [boardInvestmentAmount, setBoardInvestmentAmount] = useState(0);
    const [shouldResumeBankFollowup, setShouldResumeBankFollowup] = useState(false);
    const [isBoardFinancialCompleted, setIsBoardFinancialCompleted] = useState(false);
    const [pendingHandledBoardCard, setPendingHandledBoardCard] = useState<{ key: string; card: BoardCardResult | null } | null>(null);
    const [pendingBoardStepAdvance, setPendingBoardStepAdvance] = useState<'hospital' | 'repair' | null>(null);
    const [pendingBoardLifelongRoll, setPendingBoardLifelongRoll] = useState<PromotionType | null>(null);
    const [pendingCashEventRoll, setPendingCashEventRoll] = useState<PromotionType | null>(null);
    const [pendingMarketPurchase, setPendingMarketPurchase] = useState<{ cardId: string; attemptId: string } | null>(null);
    const [showHospitalRollModal, setShowHospitalRollModal] = useState(false);
    const [hospitalRollValue, setHospitalRollValue] = useState<number | null>(null);
    const [lastHospitalPromptKey, setLastHospitalPromptKey] = useState<string | null>(null);
    const [lastRepairPromptKey, setLastRepairPromptKey] = useState<string | null>(null);
    const [showRepairConfirmationModal, setShowRepairConfirmationModal] = useState(false);
    const [isSubmittingFamilyJoin, setIsSubmittingFamilyJoin] = useState(false);
    const [isSubmittingFamilySource, setIsSubmittingFamilySource] = useState(false);
    const [familyJoinRollValue, setFamilyJoinRollValue] = useState<number | null>(null);
    const [familyJoinResult, setFamilyJoinResult] = useState<'passed' | 'failed' | null>(null);
    const [isFamilyJoinRolling, setIsFamilyJoinRolling] = useState(false);
    const [familyJoinPromptSnapshot, setFamilyJoinPromptSnapshot] = useState<FamilyMilestoneJoinPrompt | null>(null);
    const [visibleFamilyJoinPromptId, setVisibleFamilyJoinPromptId] = useState<string | null>(null);
    const [dismissedFamilyJoinPromptIds, setDismissedFamilyJoinPromptIds] = useState<string[]>([]);
    const [submittedFamilyJoinPromptIds, setSubmittedFamilyJoinPromptIds] = useState<string[]>([]);
    const [handledFamilyJoinActionKeys, setHandledFamilyJoinActionKeys] = useState<string[]>([]);
    const [showBizUpgradeModal, setShowBizUpgradeModal] = useState(false);
    const [submittedSharedCardPromptIds, setSubmittedSharedCardPromptIds] = useState<string[]>([]);
    const [sharedSaleSelectionIds, setSharedSaleSelectionIds] = useState<string[]>([]);
    const [sharedInvestmentAmount, setSharedInvestmentAmount] = useState(0);
    const [pendingSharedCardCompletion, setPendingSharedCardCompletion] = useState<{
        promptId: string;
        status: 'completed' | 'declined' | 'no_effect';
        amount?: number;
        selectedAssetIds?: string[];
        note?: string;
        startupUpgradeCardId?: string;
    } | null>(null);
    const [processedStoryRequestIds, setProcessedStoryRequestIds] = useState<string[]>([]);
    const processingStoryRequestKeysRef = useRef(new Set<string>());
    const familyJoinCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const familyJoinRollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const familyJoinRollInFlightRef = useRef(false);
    const sharedCardPromptIdRef = useRef<string | null>(null);
    const completedFamilyFlowPromptIdRef = useRef<string | null>(null);
    const completedCurrentRealEstatePurchaseRef = useRef(false);
    const lastPlayerDiagnosticHashRef = useRef<string | null>(null);

    const [promotionType, setPromotionType] = useState<PromotionType | null>(null);
    const [isRollingBoardDice, setIsRollingBoardDice] = useState(false);
    const [isEndingTurn, setIsEndingTurn] = useState(false);

    useEffect(() => {
        const hasSeenTutorial = localStorage.getItem('happiness_flow_tutorial_seen');
        if (!hasSeenTutorial && !room?.isBoardGame) {
            setShowTutorial(true);
        }
    }, [room?.isBoardGame]);

    useEffect(() => {
        if (!room?.isBoardGame || !room.boardState || !user?.uid) return;
        if (room.boardState.hasRolledThisTurn) return;

        const storageKey = `happiness_flow_board_tutorial_seen_v1_${user.uid}`;
        if (!localStorage.getItem(storageKey)) {
            setShowTutorial(true);
        }
    }, [room?.boardState?.hasRolledThisTurn, room?.isBoardGame, user?.uid]);

    // 監控幸福值是否達標
    useEffect(() => {
        if (gameState.happinessTotal >= 100 && !gameState.hasShownWinAnimation) {
            setShowWinAnimation(true);
            setGameState(prev => ({ ...prev, hasShownWinAnimation: true }));
        }
    }, [gameState.happinessTotal, gameState.hasShownWinAnimation, setGameState]);

    const handleCloseTutorial = () => {
        if (room?.isBoardGame && user?.uid) {
            localStorage.setItem(`happiness_flow_board_tutorial_seen_v1_${user.uid}`, 'true');
        } else {
            localStorage.setItem('happiness_flow_tutorial_seen', 'true');
        }
        setShowTutorial(false);
    };

    const handleLeaveRoom = async () => {
        setIsLeaving(true);
        try {
            // 1. 執行離開房間邏輯 (從 Firestore 移除成員並清理 localStorage 的 active_room)
            await leaveToLobby();

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
        if (pendingForcedBoardPayment) {
            const applied = handleTransactionSubmit(data);
            if (!applied) return;

            setShowTransactionModal(false);
            setTransactionQuickPreset(null);

            const cashAfterTurnaround = gameState.cash + data.cashChange;
            if ((cashAfterTurnaround + pendingForcedBoardPayment.cashChange) < 0) {
                setShowForcedBoardPaymentModal(true);
                showAlert('周轉後現金仍不足，請繼續賣資產或改用借款', 'error');
            } else {
                showAlert('周轉完成，請回到財務檢核套用卡片', 'success');
            }
            return;
        }

        setBoardFinancialAction({
            kind: 'financial',
            label: '確認交易內容',
            txData: { ...data, boardFlow: data.boardFlow || 'manual-bank' },
            expectedEntries: data.financialCheckEntries || []
        });
        setPendingBoardLifelongRoll(null);
        setIsBoardFinancialCompleted(false);
        setShowTransactionModal(false);
        setTransactionQuickPreset(null);
    };

    const handleMedicalClaimConfirm = (claimId: string) => {
        const claim = (gameState.pendingMedicalClaims || []).find(item => item.id === claimId);
        const card = claim ? OPPORTUNITY_CARD_MAP[claim.sourceCardId] : null;
        const amount = card?.insurancePays || 0;
        if (!claim || card?.type !== 'medical' || amount <= 0) {
            showAlert('目前沒有可申請的醫療理賠事件', 'error');
            return;
        }

        setShowMedicalClaimModal(false);
        setBoardFinancialAction({
            kind: 'financial',
            label: '進入財務檢核',
            txData: {
                name: `醫療保險理賠：${card.title}`,
                amount,
                cashChange: amount,
                source: 'income',
                usage: 'cash',
                flowType: '其它',
                boardFlow: 'insurance-claim',
                boardEventId: claim.id,
                medicalClaimId: claim.id,
                impacts: [`${card.title} 醫療保險理賠 +${formatMoney(amount)}`]
            },
            expectedEntries: [{ category: 'Assets', name: '現金', direction: 'Increase' }]
        });
        setIsBoardFinancialCompleted(false);
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
                setPendingCashEventRoll(type);
                setBoardFinancialAction({
                    kind: 'financial',
                    label: '進入財務檢核',
                    txData: {
                        name: '升等考試報名費',
                        amount: 1000,
                        cashChange: -1000,
                        source: 'cash',
                        usage: 'expense',
                        impacts: ['現金 -1,000', '教育進修支出 +1,000']
                    },
                    expectedEntries: [
                        { category: 'Assets', name: '現金', direction: 'Decrease' }
                    ]
                });
                setIsBoardFinancialCompleted(false);
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
            setPendingCashEventRoll(type as PromotionType);
            setBoardFinancialAction({
                kind: 'financial',
                label: '進入財務檢核',
                txData: {
                    name: `終身學習報名費：${type}`,
                    amount: cost,
                    cashChange: -cost,
                    source: 'cash',
                    usage: 'expense',
                    lifelongLearningPayload: {
                        learningType: type as 'enhance_profession' | 'stock_ability' | 'real_estate_ability',
                        requiredRoll: 1
                    },
                    impacts: [`現金 -${formatMoney(cost)}`, `終身學習支出 +${formatMoney(cost)}`]
                },
                expectedEntries: [
                    { category: 'Assets', name: '現金', direction: 'Decrease' }
                ]
            });
            setIsBoardFinancialCompleted(false);
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
        const currentPromotionType = promotionType;
        const shouldDrawExamHappiness = currentPromotionType === 'normal' && !activeBoardCard;
        setShowDiceModal(false);

        // 如果是終身學習且成功，在此時顯示 Alert
        if (lastDiceSuccess && currentPromotionType && currentPromotionType !== 'normal') {
            const messages: Record<string, string> = {
                'enhance_profession': '職業能力已提升，職位晉升一級！',
                'stock_ability': '已獲得投資股票的能力，現有持股已翻倍！',
                'real_estate_ability': '已獲得投資不動產的能力，房租收入已增加！'
            };
            showAlert(`🎉 ${messages[currentPromotionType as string] || '學習成功！'}`, 'success');
        }

        // 重置成功狀態
        setLastDiceSuccess(false);
        setPromotionType(null);

        if (shouldDrawExamHappiness) {
            void drawPostExamHappinessCard(lastDiceSuccess);
        } else if (currentPromotionType === 'normal' && boardState?.currentEvent?.type === 'school') {
            void advanceBoardEventQueue('school');
        }
    };

    const boardState = room?.boardState || null;
    const observedSkipTurnsRef = useRef<Record<string, number>>({});
    const previousCashRef = useRef<number | null>(null);
    const previousHappinessRef = useRef<number | null>(null);
    const previousTurnUidRef = useRef<string | null>(null);
    const currentPlayerRoomState = user?.uid ? room?.playerStates?.[user.uid] : null;
    const pendingStartupUpgradeAction = currentPlayerRoomState?.pendingStartupUpgradeAction || gameState.pendingStartupUpgradeAction || null;
    const familyJoinPrompt = isBoardPromptForCurrentEvent(boardState?.familyMilestoneJoinPrompt, boardState)
        ? boardState?.familyMilestoneJoinPrompt || null
        : null;
    const sharedCardPrompt = isBoardPromptForCurrentEvent(boardState?.sharedCardPrompt, boardState)
        ? boardState?.sharedCardPrompt || null
        : null;
    const activeFamilyJoinPrompt = familyJoinPrompt;
    // Firestore 的 prompt 才是共享卡片唯一真實來源；動畫或本機快照不能決定
    // 是否仍需回覆，避免舊快照讓提示消失或把已回覆的玩家重新拉回流程。
    const activeSharedCardPrompt = sharedCardPrompt;
    const sharedCardDescription = activeSharedCardPrompt
        ? buildNewsCardMetaFromSchema(activeSharedCardPrompt.sourceCardId)?.description || ''
        : '';
    const isBoardTurn = !!(room?.isBoardGame && boardState?.currentTurnUid === user?.uid);
    const isActiveBankEvent = !!(
        room?.isBoardGame &&
        boardState?.currentEvent?.playerUid === user?.uid &&
        boardState.currentEvent.type === 'bank'
    );
    const canUseBankProducts = !room?.isBoardGame || !!currentPlayerRoomState?.bankServiceWindowActive || isActiveBankEvent;
    const hasCar = gameState.assets.some(asset => asset.type === '汽車' || asset.type === '飛行器');
    const activeBoardCard = boardState?.currentEvent?.playerUid === user?.uid ? boardState?.currentCard || null : null;

    useEffect(() => {
        const unlock = () => { void audioManager.unlock(); };
        document.addEventListener('pointerdown', unlock, { once: true, passive: true });
        document.addEventListener('keydown', unlock, { once: true });
        return () => {
            document.removeEventListener('pointerdown', unlock);
            document.removeEventListener('keydown', unlock);
        };
    }, []);

    useEffect(() => {
        const currentCash = gameState.cash;
        if (previousCashRef.current === null) {
            previousCashRef.current = currentCash;
            return;
        }
        if (currentCash !== previousCashRef.current) {
            const cue = currentCash > previousCashRef.current ? 'cash-in' : 'cash-out';
            void audioManager.unlock().then(() => audioManager.play(cue));
            previousCashRef.current = currentCash;
        }
    }, [gameState.cash]);

    useEffect(() => {
        const currentHappiness = gameState.happinessTotal;
        if (previousHappinessRef.current === null) {
            previousHappinessRef.current = currentHappiness;
            return;
        }
        if (currentHappiness !== previousHappinessRef.current) {
            void audioManager.unlock().then(() => audioManager.play('happiness'));
            previousHappinessRef.current = currentHappiness;
        }
    }, [gameState.happinessTotal]);

    useEffect(() => {
        const currentTurnUid = boardState?.currentTurnUid || null;
        if (previousTurnUidRef.current && currentTurnUid === user?.uid && currentTurnUid !== previousTurnUidRef.current) {
            void audioManager.unlock().then(() => audioManager.playOnce('turn', `turn:${boardState?.currentEvent?.id || 'room'}:${currentTurnUid}`));
        }
        previousTurnUidRef.current = currentTurnUid;
    }, [boardState?.currentEvent?.id, boardState?.currentTurnUid, user?.uid]);

    useEffect(() => {
        if (!room?.isBoardGame || !user?.uid) return;

        const skipTurns = boardState?.skipTurns?.[user.uid] || 0;
        const previousSkipTurns = observedSkipTurnsRef.current[user.uid] ?? skipTurns;
        observedSkipTurnsRef.current[user.uid] = skipTurns;

        if (skipTurns > previousSkipTurns) {
            showAlert(`你將暫停 ${skipTurns} 回合，下一次輪到你時會自動跳過。`, 'info');
        }
    }, [boardState?.skipTurns, room?.isBoardGame, showAlert, user?.uid]);
    const activeBankPromptKey = isActiveBankEvent && boardState.currentEvent
        ? `${boardState.currentEvent.id}_bank`
        : null;
    const isActiveBankPromptPending = !!(activeBankPromptKey && !handledBankPromptKeys.includes(activeBankPromptKey));

    const activeSchoolPromptKey = boardState?.currentEvent?.playerUid === user?.uid &&
        boardState?.currentEvent?.type === 'school'
        ? `${boardState.currentEvent.id}_school`
        : null;
    const isActiveSchoolPromptPending = !!(activeSchoolPromptKey && !handledSchoolPromptKeys.includes(activeSchoolPromptKey));
    const activeHospitalPromptKey = boardState?.currentEvent?.playerUid === user?.uid &&
        boardState?.currentEvent?.type === 'hospital'
        ? `${boardState.currentEvent.id}_hospital`
        : null;
    const activeRepairPromptKey = boardState?.currentEvent?.playerUid === user?.uid &&
        boardState?.currentEvent?.type === 'repair'
        ? `${boardState.currentEvent.id}_repair`
        : null;

    const activeBoardCardKey = activeBoardCard && boardState?.currentEvent
        ? `${boardState.currentEvent.id}_${activeBoardCard.cardId}`
        : null;
    const activeFamilySourceStage = useMemo(() => {
        const prompt = boardState?.familyMilestoneJoinPrompt;
        if (!prompt || !boardState.currentEvent || prompt.sourceEventId !== boardState.currentEvent.id) return null;
        if (prompt.sourcePlayerUid !== user?.uid || prompt.sourceCardId !== activeBoardCard?.cardId) return null;
        return getFamilyMilestoneStageByProgressId(prompt.sourceStageProgressId);
    }, [activeBoardCard?.cardId, boardState?.currentEvent, boardState?.familyMilestoneJoinPrompt, user?.uid]);
    const activeBoardCardAction = useMemo(
        () => (activeBoardCard ? resolveBoardCardAction(activeBoardCard.cardId, gameState, activeFamilySourceStage) : null),
        [activeBoardCard?.cardId, activeFamilySourceStage, gameState]
    );

    useEffect(() => {
        if (activeBoardCard || !isBoardCardDrawerOpen) return;
        setIsBoardCardDrawerOpen(false);
        setPendingHandledBoardCard(null);
    }, [activeBoardCard, isBoardCardDrawerOpen]);

    const hasIncompleteSharedBoardPrompt = useMemo(
        () => hasIncompleteSharedPrompts({ sharedCardPrompt, familyMilestoneJoinPrompt: familyJoinPrompt }),
        [familyJoinPrompt, sharedCardPrompt]
    );
    const activeFamilyJoinActionKey = currentPlayerRoomState?.pendingFamilyMilestoneJoinAction
        ? `${currentPlayerRoomState.pendingFamilyMilestoneJoinAction.promptId}_${currentPlayerRoomState.pendingFamilyMilestoneJoinAction.cardId}`
        : null;
    const isFamilyJoinTarget = !!(
        activeFamilyJoinPrompt &&
        user?.uid &&
        activeFamilyJoinPrompt.sourcePlayerUid !== user.uid &&
        activeFamilyJoinPrompt.targetPlayerUids.includes(user.uid)
    );
    const hasRespondedToFamilyJoin = !!(
        activeFamilyJoinPrompt &&
        user?.uid &&
        (
            activeFamilyJoinPrompt.responses?.[user.uid] ||
            submittedFamilyJoinPromptIds.includes(activeFamilyJoinPrompt.id)
        )
    );
    const pendingFamilyJoinAction = currentPlayerRoomState?.pendingFamilyMilestoneJoinAction || null;
    const pendingFamilyJoinStage = getFamilyMilestoneStageByProgressId(pendingFamilyJoinAction?.stageProgressId);
    const pendingFamilyJoinActionDefinition = pendingFamilyJoinAction
        ? resolveBoardCardAction(pendingFamilyJoinAction.cardId, gameState, pendingFamilyJoinStage)
        : null;
    const pendingFamilyJoinAcceptOption = pendingFamilyJoinActionDefinition?.kind === 'choice'
        ? pendingFamilyJoinActionDefinition.options.find(option => option.id === 'accept') || null
        : null;
    const isShowingFailedFamilyJoinResult = familyJoinResult === 'failed' &&
        visibleFamilyJoinPromptId === activeFamilyJoinPrompt?.id;
    const shouldShowFamilyJoinModal = !!(
        activeFamilyJoinPrompt &&
        activeFamilyJoinPrompt.sourceEventId === boardState?.currentEvent?.id &&
        isFamilyJoinTarget &&
        visibleFamilyJoinPromptId === activeFamilyJoinPrompt.id &&
        (!hasRespondedToFamilyJoin || isShowingFailedFamilyJoinResult) &&
        !showTransactionModal &&
        !showRealEstateMarketModal &&
        !showBizUpgradeModal &&
        !showTargetDreamModal &&
        !showMedicalClaimModal
    );
    const shouldShowFamilyJoinActionModal = !!(
        pendingFamilyJoinAction &&
        activeFamilyJoinActionKey &&
        activeFamilyJoinPrompt?.id === pendingFamilyJoinAction.promptId &&
        activeFamilyJoinPrompt.sourceEventId === boardState?.currentEvent?.id &&
        !handledFamilyJoinActionKeys.includes(activeFamilyJoinActionKey) &&
        !boardFinancialAction &&
        !shouldShowFamilyJoinModal
    );
    const isSharedCardTarget = !!(
        activeSharedCardPrompt &&
        user?.uid &&
        (
            activeSharedCardPrompt.sourcePlayerUid === user.uid ||
            activeSharedCardPrompt.targetPlayerUids.includes(user.uid)
        )
    );
    const hasRespondedToSharedCardPrompt = !!(
        activeSharedCardPrompt &&
        user?.uid &&
        (
            activeSharedCardPrompt.responses?.[user.uid] ||
            submittedSharedCardPromptIds.includes(activeSharedCardPrompt.id)
        )
    );
    const isSharedCardPromptBlocked = !!(
        boardFinancialAction ||
        pendingSharedCardCompletion ||
        showTransactionModal ||
        showRealEstateMarketModal ||
        showBizUpgradeModal ||
        showTargetDreamModal ||
        showMedicalClaimModal ||
        showPaydayModal ||
        showPromotionModal ||
        showDiceModal ||
        showHospitalRollModal
    );
    const hasPendingSharedCardPrompt = !!(
        activeSharedCardPrompt &&
        isSharedCardTarget &&
        !hasRespondedToSharedCardPrompt
    );
    const shouldShowSharedCardPromptModal = !!(
        hasPendingSharedCardPrompt &&
        !isSharedCardPromptBlocked
    );
    const displayBoardCard = useMemo(
        () => hydrateBoardCardResult(activeBoardCard, gameState),
        [activeBoardCard, gameState]
    );
    const sharedCardLocalAction = useMemo(
        () => (activeSharedCardPrompt ? resolveBoardCardAction(activeSharedCardPrompt.sourceCardId, gameState) : null),
        [activeSharedCardPrompt, gameState]
    );
    // 股利／配股金額改由 resolveBoardCardAction()（單一正式規則來源）計算，
    // 不再於畫面層另外重算一份可能與 boardCardActions.ts 算法（stockSymbolFromAssetName
    // 的股票代碼備援邏輯）不一致的數字，避免同一張卡出現兩套結果（P1-04）。
    const sharedDividendAmount = useMemo(() => {
        if (!activeSharedCardPrompt || activeSharedCardPrompt.kind !== 'cash_dividend') return 0;
        if (!sharedCardLocalAction || sharedCardLocalAction.kind !== 'financial') return 0;
        return sharedCardLocalAction.txData.amount || 0;
    }, [activeSharedCardPrompt, sharedCardLocalAction]);
    const sharedStockDividendItems = useMemo(() => {
        if (!activeSharedCardPrompt || activeSharedCardPrompt.kind !== 'stock_dividend') return [];
        if (!sharedCardLocalAction || sharedCardLocalAction.kind !== 'financial') return [];
        const payloadItems = sharedCardLocalAction.txData.stockDividendPayload?.items || [];
        return payloadItems
            .map(item => {
                const asset = gameState.assets.find(a => a.id === item.assetId);
                const symbol = asset?.name.match(/[A-Z]\d+/)?.[0] || asset?.name || '';
                return { assetId: item.assetId, addedQty: item.addedQty, symbol };
            })
            .filter(item => item.addedQty > 0);
    }, [activeSharedCardPrompt, sharedCardLocalAction, gameState.assets]);
    const startupUpgradeAsset = useMemo(() => {
        if (!pendingStartupUpgradeAction) return null;
        return gameState.assets.find(asset =>
            asset.type === '企業' &&
            !asset.isUpgraded &&
            asset.name.includes(pendingStartupUpgradeAction.symbol || '')
        ) || null;
    }, [gameState.assets, pendingStartupUpgradeAction]);

    useEffect(() => {
        if (showBizUpgradeModal && !startupUpgradeAsset) {
            setShowBizUpgradeModal(false);
        }
    }, [showBizUpgradeModal, startupUpgradeAsset]);
    const boardChoiceHasDismissOption = activeBoardCardAction?.kind === 'choice' &&
        activeBoardCardAction.options.some(option => option.action.kind === 'dismiss');
    const isForcedActiveBoardCard = !!(activeBoardCard && isForcedBoardCard(activeBoardCard.cardId));
    const isActiveBoardCardHandled = !!(activeBoardCardKey && handledBoardCardKeys.includes(activeBoardCardKey));
    const isPendingFamilySourceCardCompletion = !!(
        (pendingHandledBoardCard?.key === activeBoardCardKey || familyJoinPrompt?.sourceActionCompleted === true) &&
        activeFamilyJoinPrompt?.sourcePlayerUid === user?.uid &&
        activeFamilyJoinPrompt.sourceCardId === activeBoardCard?.cardId
    );
    const isGameFinished = room?.status === 'finished';
    const marketPurchaseCardId = pendingMarketPurchase?.cardId || null;
    const isNonBoardOverlayOpen =
        showTransactionModal ||
        showRankListModal ||
        showLifelongModal ||
        showMedicalClaimModal ||
        showTargetDreamModal ||
        showRealEstateMarketModal ||
        showBizUpgradeModal;
    const isProcessingEvent =
        showPaydayModal ||
        showPromotionModal ||
        showDiceModal ||
        showHospitalRollModal ||
        showRepairConfirmationModal ||
        isBoardCardDrawerOpen ||
        !!boardFinancialAction ||
        isNonBoardOverlayOpen ||
        isActiveBankPromptPending ||
        isActiveSchoolPromptPending ||
        shouldShowSharedCardPromptModal ||
        shouldShowFamilyJoinModal ||
        (!!activeBoardCardKey && !isActiveBoardCardHandled);
    const handleOpenRealEstateMarket = () => {
        if (isProcessingEvent) {
            showAlert('請先完成目前的遊戲流程，再開啟房市。', 'info');
            return;
        }
        setShowRealEstateMarketModal(true);
    };
    const visibleFlowModal =
        showTransactionModal ? 'transaction' :
        !!boardFinancialAction ? 'financial' :
        showDiceModal ? 'dice' :
        showPromotionModal ? 'promotion' :
        showPaydayModal ? 'payday' :
        showHospitalRollModal ? 'hospital' :
        showRepairConfirmationModal ? 'repair' :
        isBoardCardDrawerOpen ? 'board-card' :
        null;

    const playerDiagnostic = useMemo(() => {
        const activeModal = visibleFlowModal || (
            shouldShowFamilyJoinModal || shouldShowFamilyJoinActionModal ? 'family' :
            shouldShowSharedCardPromptModal ? 'shared-card' :
            showRealEstateMarketModal ? 'real-estate-market' :
            showBizUpgradeModal ? 'business-upgrade' :
            showTargetDreamModal ? 'dream' :
            null
        );
        const flow = !gameState.isSetup ? 'setup' :
            showScoreView || room?.status === 'finished' ? 'settlement' :
            shouldShowFamilyJoinModal || shouldShowFamilyJoinActionModal ? 'family-milestone' :
            shouldShowSharedCardPromptModal ? 'shared-card' :
            activeModal ? 'player-action' :
            boardState?.currentEvent ? 'board-event' :
            'idle';
        const pendingAction = shouldShowFamilyJoinModal || shouldShowFamilyJoinActionModal
            ? '家庭歷程回覆'
            : shouldShowSharedCardPromptModal
                ? '共享卡片回覆'
                : currentPlayerRoomState?.pendingStartupUpgradeAction
                    ? '企業升級'
                    : currentPlayerRoomState?.pendingCardAction
                        ? '卡片後續處理'
                        : null;

        return {
            sessionId: gameState.sessionId || room?.sessionId || 'unknown',
            flow,
            screen: showScoreView || room?.status === 'finished' ? 'settlement' : 'game',
            activeModal,
            boardEventId: boardState?.currentEvent?.id || null,
            cardId: activeBoardCard?.cardId || null,
            pendingAction,
            errorMessage: alertInfo?.type === 'error' ? alertInfo.message.slice(0, 160) : null,
            errorAt: alertInfo?.type === 'error' ? Date.now() : null
        };
    }, [activeBoardCard?.cardId, alertInfo, boardState?.currentEvent?.id, currentPlayerRoomState?.pendingCardAction, currentPlayerRoomState?.pendingStartupUpgradeAction, gameState.isSetup, gameState.sessionId, room?.sessionId, room?.status, shouldShowFamilyJoinActionModal, shouldShowFamilyJoinModal, shouldShowSharedCardPromptModal, showBizUpgradeModal, showRealEstateMarketModal, showScoreView, showTargetDreamModal, visibleFlowModal]);

    useEffect(() => {
        if (!room?.id || !user?.uid || !gameState.isSetup) return;
        const diagnosticHash = JSON.stringify(playerDiagnostic);
        if (diagnosticHash === lastPlayerDiagnosticHashRef.current) return;
        const timer = window.setTimeout(() => {
            void updatePlayerDiagnostic(playerDiagnostic)
                .then(() => {
                    lastPlayerDiagnosticHashRef.current = diagnosticHash;
                })
                .catch(error => {
                    console.warn('玩家診斷狀態同步失敗:', error);
                });
        }, playerDiagnostic.errorMessage ? 0 : 2000);
        return () => window.clearTimeout(timer);
    }, [gameState.isSetup, playerDiagnostic, room?.id, updatePlayerDiagnostic, user?.uid]);
    const canOpenNextBoardStep =
        !showDiceModal &&
        !showPromotionModal &&
        !showPaydayModal &&
        !showHospitalRollModal &&
        !showRepairConfirmationModal &&
        !isBoardCardDrawerOpen &&
        !boardFinancialAction &&
        !isNonBoardOverlayOpen;
    // 回合不再自動結束，玩家自己按「結束回合」才換下一位（比照大富翁）。
    // 條件：輪到自己、沒有正在移動、沒有排隊中/進行中的棋盤事件、
    // 沒有未回覆完的共享事件、且畫面上沒有任何流程視窗擋著。
    const storyShareRequest = useMemo(() => {
        if (!room?.pendingRequests || !user?.uid || !activeBoardCardKey || !activeBoardCard) return null;
        return Object.values(room.pendingRequests).find(request =>
            request.uid === user.uid &&
            request.type === 'happiness' &&
            request.happinessLabel === activeBoardCard.title &&
            request.boardEventId === boardState?.currentEvent?.id
        ) || null;
    }, [activeBoardCard?.title, activeBoardCardKey, boardState?.currentEvent?.id, room?.pendingRequests, user?.uid]);
    const boardShareRequest = useMemo(() => {
        if (!room?.pendingRequests || !user?.uid || !activeBoardCardKey || !activeBoardCard) return null;
        return Object.values(room.pendingRequests).find(request =>
            request.uid === user.uid &&
            request.type === 'board_share' &&
            request.boardCardId === activeBoardCard.cardId &&
            request.boardEventId === boardState?.currentEvent?.id
        ) || null;
    }, [activeBoardCard?.cardId, activeBoardCardKey, boardState?.currentEvent?.id, room?.pendingRequests, user?.uid]);
    const requiresOpportunityShareApproval = !!(
        activeBoardCard &&
        activeBoardCard.deck === 'opportunity' &&
        OPPORTUNITY_CARD_MAP[activeBoardCard.cardId]?.requiresStorySharing
    );

    const forcedBoardPaymentShortfall = pendingForcedBoardPayment
        ? Math.max(0, -(gameState.cash + pendingForcedBoardPayment.cashChange))
        : 0;

    const boardActionAvailability = getBoardActionAvailability({
        roomStatus: room?.status,
        isTimerPaused: room?.isTimerPaused,
        isBoardGame: room?.isBoardGame,
        currentUid: user?.uid,
        boardState,
        isRollingDice: isRollingBoardDice,
        isProcessingEvent,
        rollBlocker: isGameFinished
            ? { code: 'game_finished', message: '本局已結算' }
            : showPaydayModal || isActiveBankPromptPending
                ? { code: 'bank_pending', message: '請先完成銀行流程' }
                : showPromotionModal || isActiveSchoolPromptPending
                    ? { code: 'school_pending', message: '請先完成學校流程' }
                    : showDiceModal
                        ? { code: 'dice_pending', message: '請先完成擲骰結果' }
                        : isBoardCardDrawerOpen || (!!activeBoardCardKey && !isActiveBoardCardHandled)
                            ? { code: 'card_pending', message: '請先完成目前卡片' }
                            : boardFinancialAction
                                ? { code: 'financial_pending', message: '請先完成財務檢核' }
                                : isNonBoardOverlayOpen
                                    ? { code: 'overlay_open', message: '請先關閉目前視窗' }
                                    : null,
    });
    const canEndTurn = boardActionAvailability.canEndTurn;

    const handleBoardDiceRoll = async (diceCount?: 1 | 2) => {
        const blockReason = boardActionAvailability.rollBlocker?.message;
        if (blockReason || isProcessingEvent) {
            showAlert(blockReason || '請先完成目前事件', 'info');
            return null;
        }
        setIsRollingBoardDice(true);
        void audioManager.unlock().then(() => audioManager.play('dice'));
        try {
            const result = await rollBoardDice(diceCount);
            return result;
        } catch (err: any) {
            showAlert(err.message || '擲骰失敗', 'error');
            setIsRollingBoardDice(false);
            throw err;
        }
    };

    const handleEndTurn = async () => {
        if (isEndingTurn) return;
        if (!canEndTurn) {
            showAlert(boardActionAvailability.endTurnBlocker?.message || '請先完成目前的棋盤事件，才能結束回合。', 'info');
            return;
        }
        const startedAt = Date.now();
        const slowTimer = window.setTimeout(() => showAlert('回合仍在同步；若狀態未更新，請稍後再按一次結束回合', 'info'), 10000);
        setIsEndingTurn(true);
        try {
            await endTurn();
            flowLog({
                name: 'board-end-turn', roomId: room?.id || '', sessionId: room?.sessionId || '',
                phase: `${Date.now() - startedAt}ms`, revision: boardState?.revision,
                result: 'completed', timestamp: Date.now()
            });
        } catch (err: any) {
            showAlert(err?.message || '結束回合失敗，請再試一次', 'error');
        } finally {
            window.clearTimeout(slowTimer);
            setIsEndingTurn(false);
        }
    };

    const handleBoardDiceAnimationComplete = (result: any) => {
        const diceText = Array.isArray(result.dice) && result.dice.length > 1
            ? `（${result.dice.join(' + ')} = ${result.total}）`
            : `（${result.total}）`;
        setGameState(prev => ({
            ...prev,
            boardPosition: result.position,
            skipTurns: result.skipTurns,
            lastBoardEvent: `擲出骰子 ${diceText} 點，前進至第 ${result.position + 1} 格`,
            pendingCardAction: result.detail
        }));
        if (result.detail) {
            showAlert(`擲出骰子 ${diceText} 點\n${result.detail}`, 'info', true);
        } else {
            showAlert(`擲出骰子 ${diceText} 點，已完成移動並同步地圖事件`, 'success');
        }
        setIsRollingBoardDice(false);
    };

    useEffect(() => {
        if (!activeBoardCardKey || activeBoardCardKey === lastBoardCardKey) return;
        if (!canOpenNextBoardStep || isActiveBankPromptPending || isActiveSchoolPromptPending) return;

        setLastBoardCardKey(activeBoardCardKey);
        hideAlert();
        setIsBoardCardDrawerOpen(true);
        setIsBoardCardRevealed(false);
        setIsBoardCardRevealAnimationComplete(false);
        setSelectedBoardSaleAssetIds([]);
    }, [activeBoardCardKey, lastBoardCardKey, canOpenNextBoardStep, isActiveBankPromptPending, isActiveSchoolPromptPending, hideAlert]);

    const boardInvestmentKey = activeBoardCardAction?.kind === 'investment'
        ? `${activeBoardCardKey}:${activeBoardCardAction.businessSymbol}`
        : null;

    useEffect(() => {
        if (activeBoardCardAction?.kind !== 'investment') {
            setBoardInvestmentAmount(0);
            return;
        }

        setBoardInvestmentAmount(Math.min(
            activeBoardCardAction.maxAmount,
            Math.max(activeBoardCardAction.defaultAmount, activeBoardCardAction.minAmount)
        ));
    }, [boardInvestmentKey]);

    useEffect(() => {
        if (!activeSharedCardPrompt || activeSharedCardPrompt.kind !== 'investment') {
            setSharedInvestmentAmount(0);
            return;
        }

        const newsCard = NEWS_CARD_MAP[activeSharedCardPrompt.sourceCardId];
        setSharedInvestmentAmount(newsCard?.type === 'large_enterprise' ? Math.min(newsCard.maxInvestment, 1000000) : 0);
    }, [activeSharedCardPrompt?.id, activeSharedCardPrompt?.kind, activeSharedCardPrompt?.sourceCardId]);

    useEffect(() => {
        return () => {
            if (familyJoinCloseTimeoutRef.current) {
                clearTimeout(familyJoinCloseTimeoutRef.current);
            }
            if (familyJoinRollIntervalRef.current) {
                clearInterval(familyJoinRollIntervalRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!familyJoinPrompt?.id) {
            setFamilyJoinPromptSnapshot(null);
            setVisibleFamilyJoinPromptId(null);
            setFamilyJoinRollValue(null);
            setFamilyJoinResult(null);
            if (familyJoinCloseTimeoutRef.current) {
                clearTimeout(familyJoinCloseTimeoutRef.current);
                familyJoinCloseTimeoutRef.current = null;
            }
            return;
        }

        if (familyJoinPromptSnapshot && familyJoinPromptSnapshot.id !== familyJoinPrompt.id) {
            setFamilyJoinPromptSnapshot(null);
            setVisibleFamilyJoinPromptId(null);
            setFamilyJoinRollValue(null);
            setFamilyJoinResult(null);
        }

        if (!isFamilyJoinTarget) {
            return;
        }

        if (visibleFamilyJoinPromptId === familyJoinPrompt.id) {
            setFamilyJoinPromptSnapshot(current =>
                current?.id === familyJoinPrompt.id
                    ? { ...familyJoinPrompt, responses: { ...familyJoinPrompt.responses } }
                    : current
            );
            return;
        }

        if (hasRespondedToFamilyJoin) {
            setFamilyJoinPromptSnapshot(current => current ?? { ...familyJoinPrompt, responses: { ...familyJoinPrompt.responses } });
            return;
        }

        if (familyJoinCloseTimeoutRef.current) {
            clearTimeout(familyJoinCloseTimeoutRef.current);
            familyJoinCloseTimeoutRef.current = null;
        }

        setFamilyJoinPromptSnapshot({ ...familyJoinPrompt, responses: { ...familyJoinPrompt.responses } });
        setVisibleFamilyJoinPromptId(familyJoinPrompt.id);
        setFamilyJoinRollValue(null);
        setFamilyJoinResult(null);
        setIsSubmittingFamilyJoin(false);
    }, [
        dismissedFamilyJoinPromptIds,
        familyJoinPrompt,
        familyJoinPrompt?.id,
        hasRespondedToFamilyJoin,
        isFamilyJoinTarget,
        visibleFamilyJoinPromptId
    ]);

    useEffect(() => {
        if (!sharedCardPrompt?.id) {
            sharedCardPromptIdRef.current = null;
            return;
        }
        if (sharedCardPromptIdRef.current !== sharedCardPrompt.id) {
            sharedCardPromptIdRef.current = sharedCardPrompt.id;
            setSharedSaleSelectionIds([]);
            setSharedInvestmentAmount(0);
            setIsSubmittingFamilyJoin(false);
        }
    }, [
        sharedCardPrompt,
        sharedCardPrompt?.id
    ]);

    useEffect(() => {
        if (!storyShareRequest || !activeBoardCardAction || activeBoardCardAction.kind !== 'happiness') return;
        const requestKey = getPendingRequestExecutionKey(storyShareRequest);
        if (processedStoryRequestIds.includes(requestKey) || processingStoryRequestKeysRef.current.has(requestKey)) return;

        const finalize = async () => {
            processingStoryRequestKeysRef.current.add(requestKey);
            try {
                if (storyShareRequest.status === 'approved') {
                    const applied = handleTransactionSubmit({
                        ...activeBoardCardAction.txData,
                        boardEventId: activeBoardCardAction.txData.boardEventId || storyShareRequest.boardEventId || boardState?.currentEvent?.id
                    });
                    if (!applied) return;
                    if (!await clearRequest(storyShareRequest.id)) return;
                    setProcessedStoryRequestIds(prev => prev.includes(requestKey) ? prev : [...prev, requestKey]);
                    showAlert(`故事分享已確認，發放 ${activeBoardCardAction.points} 點幸福`, 'success');
                    void markBoardCardHandled();
                } else if (storyShareRequest.status === 'rejected') {
                    if (!await clearRequest(storyShareRequest.id)) return;
                    setProcessedStoryRequestIds(prev => prev.includes(requestKey) ? prev : [...prev, requestKey]);
                    showAlert('故事分享尚未通過主持人確認，這張卡暫不發放幸福點', 'info');
                    setIsBoardCardDrawerOpen(true);
                }
            } finally {
                processingStoryRequestKeysRef.current.delete(requestKey);
            }
        };
        void finalize();
    }, [
        activeBoardCardAction,
        clearRequest,
        handleTransactionSubmit,
        processedStoryRequestIds,
        showAlert,
        storyShareRequest
    ]);

    useEffect(() => {
        if (!boardShareRequest || !activeBoardCardAction || !requiresOpportunityShareApproval) return;
        const requestKey = getPendingRequestExecutionKey(boardShareRequest);
        if (processedStoryRequestIds.includes(requestKey) || processingStoryRequestKeysRef.current.has(requestKey)) return;

        const finalizeRejected = async () => {
            processingStoryRequestKeysRef.current.add(requestKey);
            if (!await clearRequest(boardShareRequest.id)) {
                processingStoryRequestKeysRef.current.delete(requestKey);
                return;
            }
            setProcessedStoryRequestIds(prev => [...prev, requestKey]);
            processingStoryRequestKeysRef.current.delete(requestKey);
            showAlert('分享尚未通過主持人確認，這張卡暫不執行效果', 'info');
            setIsBoardCardDrawerOpen(true);
        };

        const finalizeApproved = async () => {
            processingStoryRequestKeysRef.current.add(requestKey);
            if (!await clearRequest(boardShareRequest.id)) {
                processingStoryRequestKeysRef.current.delete(requestKey);
                return;
            }
            setProcessedStoryRequestIds(prev => [...prev, requestKey]);

            if (activeBoardCardAction.kind === 'effect') {
                await handleApplyBoardInstantEffect(activeBoardCardAction.title, activeBoardCardAction.afterApply);
                processingStoryRequestKeysRef.current.delete(requestKey);
                return;
            }

            if (activeBoardCardAction.kind === 'choice') {
                const acceptOption = activeBoardCardAction.options.find(option => option.id === 'accept');
                if (!acceptOption) {
                    showAlert('找不到可執行的卡片效果', 'error');
                    setIsBoardCardDrawerOpen(true);
                    processingStoryRequestKeysRef.current.delete(requestKey);
                    return;
                }

                if (acceptOption.action.kind === 'effect') {
                    await handleApplyBoardInstantEffect(acceptOption.action.title, acceptOption.action.afterApply);
                    return;
                }

                if (acceptOption.action.kind === 'financial') {
                    setBoardFinancialAction(withBoardFlow(acceptOption.action, 'board-card'));
                    setIsBoardFinancialCompleted(false);
                    processingStoryRequestKeysRef.current.delete(requestKey);
                    return;
                }
            }

            showAlert('這張分享卡目前沒有可接續的效果', 'error');
            setIsBoardCardDrawerOpen(true);
            processingStoryRequestKeysRef.current.delete(requestKey);
        };

        if (boardShareRequest.status === 'approved') {
            void finalizeApproved();
            return;
        }

        if (boardShareRequest.status === 'rejected') {
            void finalizeRejected();
        }
    }, [
        activeBoardCardAction,
        boardShareRequest,
        clearRequest,
        processedStoryRequestIds,
        requiresOpportunityShareApproval,
        showAlert
    ]);

    useEffect(() => {
        if (!activeBoardCardKey || !activeBoardCardAction || activeBoardCardAction.kind !== 'market') return;
        // 依 docs/gdd/CARD_SYSTEM.md 揭示規則：市場行情相關卡片也必須在揭示後才可正式生效，
        // 未翻牌前不得把行情寫入房間共享狀態（room.marketPrices 對全房間玩家可見）。
        if (!isBoardCardRevealAnimationComplete) return;
        const reveal = boardState?.currentCardReveal;
        if (
            reveal?.eventId !== boardState?.currentEvent?.id ||
            reveal?.cardId !== activeBoardCard.cardId ||
            reveal.isRevealed !== true
        ) return;
        if (marketPricesMatch(room?.marketPrices, activeBoardCardAction.prices)) {
            setAppliedBoardMarketKeys(prev => prev.includes(activeBoardCardKey) ? prev : [...prev, activeBoardCardKey]);
            setIsApplyingBoardMarket(false);
            return;
        }
        if (appliedBoardMarketKeys.includes(activeBoardCardKey) || isApplyingBoardMarket) return;

        setIsApplyingBoardMarket(true);

        applyBoardMarketPrices(activeBoardCardAction.prices, activeBoardCardAction.code, activeBoardCardAction.isBubble)
            .then(() => {
                setAppliedBoardMarketKeys(prev => prev.includes(activeBoardCardKey) ? prev : [...prev, activeBoardCardKey]);
                showAlert('已同步股市行情到房間', 'success');
            })
            .catch((err: any) => {
                showAlert(err.message || '同步股市行情失敗', 'error');
            })
            .finally(() => {
                setIsApplyingBoardMarket(false);
            });
    }, [activeBoardCard?.cardId, activeBoardCardAction, activeBoardCardKey, appliedBoardMarketKeys, applyBoardMarketPrices, boardState?.currentCardReveal, boardState?.currentEvent?.id, isApplyingBoardMarket, isBoardCardRevealAnimationComplete, room?.marketPrices, showAlert]);

    useEffect(() => {
        if (!activeBankPromptKey || activeBankPromptKey === lastBankPromptKey || !isActiveBankPromptPending) return;
        if (!canOpenNextBoardStep) return;
        setLastBankPromptKey(activeBankPromptKey);
        setHandledBankPromptKeys(prev => prev.includes(activeBankPromptKey) ? prev : [...prev, activeBankPromptKey]);
        setPaydayStep('confirm');
        hideAlert();
        setShowPaydayModal(true);
    }, [activeBankPromptKey, lastBankPromptKey, isActiveBankPromptPending, summary.monthlyCashflow, canOpenNextBoardStep, hideAlert]);

    useEffect(() => {
        if (!activeSchoolPromptKey || activeSchoolPromptKey === lastSchoolPromptKey || !isActiveSchoolPromptPending) return;
        if (!canOpenNextBoardStep) return;
        setLastSchoolPromptKey(activeSchoolPromptKey);
        hideAlert();
        setShowPromotionModal(true);
    }, [activeSchoolPromptKey, lastSchoolPromptKey, isActiveSchoolPromptPending, canOpenNextBoardStep, hideAlert]);

    useEffect(() => {
        if (!activeHospitalPromptKey || activeHospitalPromptKey === lastHospitalPromptKey) return;
        if (!canOpenNextBoardStep) return;
        setLastHospitalPromptKey(activeHospitalPromptKey);
        setShowDiceModal(false);
        setPromotionType(null);
        setLastDiceSuccess(false);
        setHospitalRollValue(null);
        hideAlert();
        if (boardState?.currentEvent?.hospitalFeeCoveredByInsurance) {
            showAlert('醫療保險已抵免本次醫藥費，仍暫停一回合。', 'success');
            void advanceBoardEventQueue('hospital');
            return;
        }
        setShowHospitalRollModal(true);
    }, [activeHospitalPromptKey, lastHospitalPromptKey, canOpenNextBoardStep, boardState?.currentEvent?.hospitalFeeCoveredByInsurance, hideAlert, showAlert, advanceBoardEventQueue]);

    useEffect(() => {
        if (!activeRepairPromptKey) {
            setShowRepairConfirmationModal(false);
            return;
        }
        if (activeRepairPromptKey === lastRepairPromptKey) return;
        if (!canOpenNextBoardStep) return;

        const repairFee = boardState?.currentEvent?.repairFee || 0;
        const repairHasCar = boardState?.currentEvent?.repairHasCar ?? true;

        setLastRepairPromptKey(activeRepairPromptKey);
        hideAlert();

        if (!repairHasCar || repairFee <= 0) {
            void advanceBoardEventQueue('repair');
            return;
        }

        setShowRepairConfirmationModal(true);
    }, [activeRepairPromptKey, advanceBoardEventQueue, boardState?.currentEvent?.repairFee, boardState?.currentEvent?.repairHasCar, canOpenNextBoardStep, hideAlert, lastRepairPromptKey]);

    useEffect(() => {
        if (!pendingForcedBoardPayment || forcedBoardPaymentShortfall > 0) return;
        setShowForcedBoardPaymentModal(false);
    }, [pendingForcedBoardPayment, forcedBoardPaymentShortfall]);

    const markBoardCardHandled = async (
        cardKey: string | null = activeBoardCardKey,
        card: typeof activeBoardCard = activeBoardCard,
        isExplicitDismissal = false
    ) => {
        if (!cardKey) return false;
        const eventId = boardState?.currentEvent?.id;
        if (shouldBlockBoardCardDismissal(
            boardState,
            eventId,
            card?.cardId,
            user?.uid,
            isExplicitDismissal
        )) {
            setPendingHandledBoardCard({ key: cardKey, card });
            const isFamilySourceCard = !!(
                card?.cardId &&
                familyJoinPrompt?.sourcePlayerUid === user?.uid &&
                familyJoinPrompt.sourceCardId === card.cardId
            );
            if (isFamilySourceCard) {
                setIsBoardCardDrawerOpen(true);
                setIsBoardCardRevealed(true);
            } else {
                setIsBoardCardDrawerOpen(false);
            }
            showAlert('還有玩家尚未完成共享事件回覆，請等待所有人完成後再結案。', 'info');
            return false;
        }

        if (eventId && card?.cardId) {
            try {
                const addToRealEstateMarket = isExplicitDismissal && card.deck === 'news' && NEWS_CARD_MAP[card.cardId]?.type === 'real_estate';
                const dismissed = await dismissBoardCard(eventId, card.cardId, addToRealEstateMarket);
                if (!dismissed) {
                    showAlert('卡片事件尚未完成，請稍後再試', 'info');
                    return false;
                }
            } catch (err: any) {
                showAlert(err?.message || '卡片結案失敗，請再試一次', 'error');
                return false;
            }
        }

        setHandledBoardCardKeys(prev => prev.includes(cardKey) ? prev : [...prev, cardKey]);
        setIsBoardCardDrawerOpen(false);

        return true;
    };

    const handleBoardCardReveal = () => {
        if (boardState?.currentEvent?.id && activeBoardCard?.cardId) {
            const cardKey = `${boardState.currentEvent.id}:${activeBoardCard.cardId}`;
            if (boardCardRevealInFlightRef.current === cardKey || isBoardCardRevealed) return;
            boardCardRevealInFlightRef.current = cardKey;

            void audioManager.unlock()
                .then(() => audioManager.playOnce('card', `card:${boardState.currentEvent.id}:${activeBoardCard.cardId}`))
                .catch(() => undefined);
            const eventId = boardState.currentEvent.id;
            const cardId = activeBoardCard.cardId;

            void (async () => {
                try {
                    await revealBoardCard(eventId, cardId);
                    setIsBoardCardRevealed(true);

                    if (HAPPINESS_CARD_MAP[cardId]?.category === '家庭重要歷程') {
                        const familyStatus = getFamilyMilestoneStatus(gameState);
                        const familyStage = familyStatus.currentStageIndex >= 0
                            ? familyStatus.stages[familyStatus.currentStageIndex]
                            : null;
                        await openFamilyMilestoneJoinPrompt(eventId, cardId, familyStage?.progressId);
                    }

                    const requiresSharedPrompt =
                        (activeBoardCard.deck === 'opportunity' && !!getSharedOpportunityKind(cardId)) ||
                        (activeBoardCard.deck === 'news' && ['cash_dividend', 'stock_dividend', 'large_enterprise', 'small_business'].includes((NEWS_CARD_MAP[cardId] as any)?.type || ''));

                    if (!requiresSharedPrompt) {
                        return;
                    }

                    const opened = await openSharedCardPrompt(eventId, cardId);
                    if (opened === 'opened') {
                        return;
                    }

                    if (opened === 'no_target') {
                        // 沒有任何玩家（含抽卡者）符合這張卡的資格，視為本次無效果，直接結案。
                        setIsBoardCardDrawerOpen(false);
                        await markBoardCardHandled();
                        return;
                    }

                    showAlert('共享卡片事件建立失敗，請重新翻開或再試一次', 'error');
                } catch (err: any) {
                    console.error('翻開棋盤卡片失敗:', err);
                    showAlert(err?.message || '卡片同步失敗，請重新整理後再試一次', 'error');
                } finally {
                    if (boardCardRevealInFlightRef.current === cardKey) {
                        boardCardRevealInFlightRef.current = null;
                    }
                }
            })();
        }
    };

    const handleCloseBoardCardDrawer = () => {
        if (activeBoardCardKey && !isActiveBoardCardHandled) {
            void (async () => {
                await markBoardCardHandled(activeBoardCardKey, activeBoardCard, true);
            })();
            return;
        }
        setIsBoardCardDrawerOpen(false);
    };

    const handleApplyDirectHappiness = async () => {
        if (!activeBoardCard || !activeBoardCardAction || activeBoardCardAction.kind !== 'happiness') return;

        if (HAPPINESS_CARD_MAP[activeBoardCard.cardId]?.requiresStorySharing) {
            if (!user?.uid || !room?.pendingRequests) return;
            if (storyShareRequest?.status === 'pending') {
                showAlert('故事分享確認已送出，請等待主持人確認', 'info');
                return;
            }

            void submitRequest({
                uid: user.uid,
                playerName: user.name || gameState.playerName || '玩家',
                type: 'happiness',
                amount: activeBoardCardAction.points,
                happinessLabel: activeBoardCard.title,
                boardCardId: activeBoardCard.cardId,
                boardEventId: boardState?.currentEvent?.id
            });
            setIsBoardCardDrawerOpen(false);
            showAlert('故事分享已送出，等待執行端／主持人確認後才會發放幸福點', 'success');
            return;
        }

        const applied = handleTransactionSubmit(activeBoardCardAction.txData);
        if (!applied) return;

        if (familyJoinPrompt?.sourcePlayerUid === user?.uid && familyJoinPrompt.sourceCardId === activeBoardCard.cardId) {
            const sourceCompleted = await markFamilyMilestoneSourceActionCompleted(familyJoinPrompt.id);
            if (!sourceCompleted) {
                showAlert('家庭歷程已套用，但主流程同步失敗，請再試一次', 'error');
                return;
            }
        }

        showAlert(`已套用 ${activeBoardCardAction.points} 點幸福`, 'success');
        void markBoardCardHandled();
    };

    const submitBoardShareApprovalRequest = () => {
        if (!activeBoardCard || !user?.uid || !room?.pendingRequests) return;
        if (boardShareRequest?.status === 'pending') {
            showAlert('分享確認已送出，請等待主持人確認', 'info');
            return;
        }

        void submitRequest({
            uid: user.uid,
            playerName: user.name || gameState.playerName || '玩家',
            type: 'board_share',
            amount: 0,
            boardCardId: activeBoardCard.cardId,
            boardEventId: boardState?.currentEvent?.id,
            shareLabel: activeBoardCard.title
        });
        setIsBoardCardDrawerOpen(false);
        showAlert('分享確認已送出，等待執行端／主持人確認後才會繼續卡片效果', 'success');
    };

    const handleApplyBoardInstantEffect = async (title: string, afterApply?: {
        drawCard?: 'happiness' | 'news';
        moveToSquare?: {
            squareType: 'school' | 'hospital' | 'bank' | 'repair';
            skipTurns?: number;
            detail?: string;
        };
    }) => {
        if (afterApply?.moveToSquare) {
            const move = afterApply.moveToSquare;
            const nextIndex = await moveCurrentPlayerToSquare(move);
            if (nextIndex !== null) {
                setGameState(prev => ({
                    ...prev,
                    boardPosition: nextIndex,
                    skipTurns: Math.max(prev.skipTurns || 0, move.skipTurns || 0),
                    pendingCardAction: move.detail || prev.pendingCardAction
                }));
            }
        }
        if (afterApply?.drawCard) {
            setIsBoardCardDrawerOpen(false);
            await drawBoardFollowupCard(
                afterApply.drawCard,
                `${title} 後續抽卡`,
                `卡片效果觸發，再抽一張${afterApply.drawCard === 'happiness' ? '幸福卡' : '新聞卡'}`
            );
            showAlert('卡片效果已套用，請處理後續抽到的卡片', 'success');
            return;
        }

        showAlert('卡片效果已套用', 'success');
        await markBoardCardHandled();
    };

    const applyJoinDirectHappiness = async (
        joinAction: { kind: 'happiness'; title: string; points: number; txData: TransactionData },
        promptId: string,
        actionKey: string
    ) => {
        const result = await completeFamilyMilestoneAction({ promptId, accepted: true });
        if (result.status === 'requires_funding') {
            showAlert(`現金不足，還差 ${formatMoney(result.shortfall || 0)}`, 'error');
            return false;
        }
        if (result.status === 'failed') {
            showAlert(result.message || '家庭歷程同步失敗，請重新整理後重試', 'error');
            return false;
        }
        setHandledFamilyJoinActionKeys(prev => prev.includes(actionKey) ? prev : [...prev, actionKey]);
        showAlert(`已同步完成家庭歷程，獲得 ${joinAction.points} 點幸福`, 'success');
        return true;
    };

    const handleFamilySourceDecline = async (promptId: string) => {
        if (isSubmittingFamilySource) return;
        setIsSubmittingFamilySource(true);
        try {
            const result = await completeFamilyMilestoneAction({ promptId, accepted: false });
            if (result.status === 'failed') {
                showAlert(result.message || '家庭歷程同步失敗，請重新整理後重試', 'error');
                return;
            }
            showAlert(
                result.status === 'duplicate'
                    ? '家庭歷程已完成，正在同步其他玩家進度'
                    : '已記錄不參與此階段，正在等待其他玩家完成',
                'success'
            );
        } finally {
            setIsSubmittingFamilySource(false);
        }
    };

    const applyResolvedBoardFinancialTx = async (txData: TransactionData): Promise<boolean | BoardFinancialApplyResult> => {
        const handledCardKey = activeBoardCardKey;
        const handledCard = activeBoardCard;
        const nextLifelongRoll = txData.usage === 'lifelong_learning' && txData.lifelongLearningPayload
            ? txData.lifelongLearningPayload.learningType as PromotionType
            : null;

        // 事件級防重複套用（P1-05）：以正式棋盤事件 ID 為準，避免 modal 重開、
        // effect 重跑或 snapshot 延遲導致同一筆棋盤財務結果被重複套用。
        const boardEventId = boardState?.currentEvent?.id;
        const operationId = txData.boardEventId || (boardEventId
            ? `${boardEventId}:${txData.usage}:${txData.name}:${txData.amount}:${txData.relatedAssetId || ''}`
            : undefined);
        const resolvedTxData = operationId ? { ...txData, boardEventId: operationId } : txData;
        const medicalCard = handledCard ? OPPORTUNITY_CARD_MAP[handledCard.cardId] : null;
        const pendingMedicalClaim = (
            resolvedTxData.boardFlow === 'board-card' &&
            boardEventId &&
            handledCard?.deck === 'opportunity' &&
            medicalCard?.type === 'medical' &&
            (gameState.medicalInsuranceCount || 0) > 0 &&
            (medicalCard.insurancePays || 0) > 0
        ) ? {
            id: `medical-claim:${boardEventId}:${handledCard.cardId}`,
            sourceEventId: boardEventId,
            sourceCardId: handledCard.cardId,
            createdAt: Date.now()
        } : undefined;
        const transactionData = pendingMedicalClaim
            ? { ...resolvedTxData, pendingMedicalClaim }
            : resolvedTxData;
        if (resolvedTxData.boardFlow === 'family-milestone') {
            const familyPromptId = currentPlayerRoomState?.pendingFamilyMilestoneJoinAction?.promptId || (
                familyJoinPrompt?.sourcePlayerUid === user?.uid ? familyJoinPrompt.id : null
            );
            if (!familyPromptId) return false;
            const result = await completeFamilyMilestoneAction({ promptId: familyPromptId, accepted: true });
            if (result.status === 'requires_funding') {
                showAlert(`現金不足，還差 ${formatMoney(result.shortfall || 0)}`, 'error');
                return result;
            }
            if (result.status === 'failed') {
                showAlert(result.message || '家庭歷程同步失敗，請重新整理後重試', 'error');
                return result;
            }
            completedFamilyFlowPromptIdRef.current = familyPromptId;
            setIsBoardFinancialCompleted(true);
            return result;
        }
        if (resolvedTxData.boardFlow === 'board-card' && boardState?.currentEvent?.id && activeBoardCard?.deck === 'news' && NEWS_CARD_MAP[activeBoardCard.cardId]?.type === 'real_estate') {
            const purchased = await buyCurrentRealEstateCard(boardState.currentEvent.id, activeBoardCard.cardId, resolvedTxData);
            if (!purchased) return false;
            completedCurrentRealEstatePurchaseRef.current = true;
            setIsBoardFinancialCompleted(true);
            return true;
        }
        if (resolvedTxData.boardFlow === 'startup-loan') {
            if (!pendingSharedCardCompletion?.startupUpgradeCardId) return false;
            const applied = await completeStartupLoanAction(pendingSharedCardCompletion.promptId);
            if (!applied) {
                showAlert('創業貸款同步失敗，請再試一次', 'error');
                return false;
            }
            setSubmittedSharedCardPromptIds(prev =>
                prev.includes(pendingSharedCardCompletion.promptId)
                    ? prev
                    : [...prev, pendingSharedCardCompletion.promptId]
            );
            closeSharedCardPromptModal(pendingSharedCardCompletion.promptId);
            setPendingSharedCardCompletion(null);
            setIsBoardFinancialCompleted(true);
            return true;
        }
        let applied: boolean | BoardFinancialApplyResult;
        if (resolvedTxData.boardFlow === 'real-estate-market') {
            if (!pendingMarketPurchase) return false;
            const marketResult = await buyRealEstateFromMarket(
                pendingMarketPurchase.cardId,
                pendingMarketPurchase.attemptId,
                resolvedTxData
            );
            if (marketResult.status === 'requires_funding') {
                return marketResult;
            }
            if (marketResult.status === 'failed') {
                setPendingMarketPurchase(null);
                setBoardFinancialAction(null);
                setShowRealEstateMarketModal(true);
                showAlert(marketResult.message || '此不動產已售出，房市已更新', 'info');
                return marketResult;
            }
            applied = true;
        } else if (resolvedTxData.boardFlow === 'vehicle-loss') {
            if (!boardEventId || !resolvedTxData.vehicleLossPayload) return false;
            const lossResult = await applyVehicleLoss(
                boardEventId,
                activeBoardCard?.cardId || 'C038',
                resolvedTxData.vehicleLossPayload.assetId
            );
            if (lossResult.status === 'failed') return lossResult;
            applied = true;
        } else {
            applied = handleTransactionSubmit(transactionData);
        }
        if (!applied) return false;
        if (resolvedTxData.boardFlow === 'vehicle-loss') {
            setIsBoardFinancialCompleted(true);
            return true;
        }

        if (boardFinancialAction?.afterApply?.affectsAllPlayersExpense) {
            const effect = boardFinancialAction.afterApply.affectsAllPlayersExpense;
            // 注意：抽卡者自己的本地 expenses 已經由上面的 handleTransactionSubmit()
            // 透過 expensePayload 正確套用過一次，這裡只需要把效果廣播給其他玩家，
            // 不能再對本地 gameState 重複套用同一筆支出（否則抽卡者會被算兩次）。
            await applyBoardExpenseToAllPlayers({
                amount: effect.amount,
                category: effect.category,
                isIncrease: effect.isIncrease,
                summary: boardFinancialAction.txData.name,
                detail: `全體玩家${effect.isIncrease ? '增加' : '減少'}${formatMoney(effect.amount)} 的${effect.category === 'basicLiving' ? '餐飲、服飾、居住類' : effect.category === 'transportEdu' ? '交通、教育、娛樂類' : '其他、醫療、育兒類'}月支出`
            });
        }

        if (boardFinancialAction?.afterApply?.moveToSquare) {
            const move = boardFinancialAction.afterApply.moveToSquare;
            const nextIndex = await moveCurrentPlayerToSquare(move);
            if (nextIndex !== null) {
                setGameState(prev => ({
                    ...prev,
                    boardPosition: nextIndex,
                    skipTurns: Math.max(prev.skipTurns || 0, move.skipTurns || 0),
                    pendingCardAction: move.detail || prev.pendingCardAction
                }));
            }
        }

        if (boardFinancialAction?.afterApply?.drawCard) {
            await drawBoardFollowupCard(
                boardFinancialAction.afterApply.drawCard,
                `${boardFinancialAction.txData.name} 後續抽卡`,
                `卡片效果觸發，再抽一張${boardFinancialAction.afterApply.drawCard === 'happiness' ? '幸福卡' : '新聞卡'}`
            );
        }

        if (resolvedTxData.boardFlow === 'shared-card' && pendingSharedCardCompletion) {
            const submitted = await submitSharedCardPromptResponse({
                promptId: pendingSharedCardCompletion.promptId,
                status: pendingSharedCardCompletion.status,
                amount: pendingSharedCardCompletion.amount,
                selectedAssetIds: pendingSharedCardCompletion.selectedAssetIds,
                note: pendingSharedCardCompletion.note
            });
            if (!submitted) {
                showAlert('共享卡片結算回覆送出失敗，請再試一次', 'error');
                return;
            }
            setSubmittedSharedCardPromptIds(prev =>
                prev.includes(pendingSharedCardCompletion.promptId)
                    ? prev
                    : [...prev, pendingSharedCardCompletion.promptId]
            );
            closeSharedCardPromptModal(pendingSharedCardCompletion.promptId);
        }

        setPendingHandledBoardCard(handledCardKey ? { key: handledCardKey, card: handledCard } : null);
        setPendingBoardLifelongRoll(nextLifelongRoll);
        setIsBoardFinancialCompleted(true);
        setPendingForcedBoardPayment(null);
        setShowForcedBoardPaymentModal(false);
        return true;
    };

    const handleApplyBoardFinancialTx = async (txData: TransactionData) => {
        if (txData.boardFlow === 'family-milestone') {
            const result = await applyResolvedBoardFinancialTx(txData);
            if (typeof result === 'object' && result?.status === 'requires_funding') {
                setPendingForcedBoardPayment(txData);
                setShowForcedBoardPaymentModal(true);
            }
            return result;
        }
        if (txData.boardFlow !== 'real-estate-market' && (gameState.cash + txData.cashChange) < 0) {
            setPendingForcedBoardPayment(txData);
            setShowForcedBoardPaymentModal(true);
            return false;
        }

        return applyResolvedBoardFinancialTx(txData);
    };

    const finalizeBoardFinancialFlow = async () => {
        if (boardFinancialAction?.txData.boardFlow === 'manual-bank') {
            setIsBoardFinancialCompleted(false);
            setBoardFinancialAction(null);
            return;
        }
        if (completedFamilyFlowPromptIdRef.current) {
            completedFamilyFlowPromptIdRef.current = null;
            setIsBoardFinancialCompleted(false);
            setBoardFinancialAction(null);
            setPendingHandledBoardCard(null);
            return;
        }
        if (completedCurrentRealEstatePurchaseRef.current) {
            completedCurrentRealEstatePurchaseRef.current = false;
            setIsBoardFinancialCompleted(false);
            setBoardFinancialAction(null);
            setPendingHandledBoardCard(null);
            setIsBoardCardDrawerOpen(false);
            showAlert('已購買房屋', 'success');
            return;
        }
        const familyJoinPromptId = currentPlayerRoomState?.pendingFamilyMilestoneJoinAction?.promptId || null;
        const familyJoinActionKey = activeFamilyJoinActionKey;
        let handledBoardCard = true;

        if (familyJoinPromptId) {
            const cleared = await clearPendingFamilyMilestoneJoinAction(familyJoinPromptId);
            if (!cleared) {
                showAlert('家庭歷程財務結果已套用，但同步結案失敗，請重新點擊關閉再試一次', 'error');
                return;
            }
        }
        if (pendingHandledBoardCard) {
            handledBoardCard = await markBoardCardHandled(pendingHandledBoardCard.key, pendingHandledBoardCard.card);
        } else if (activeBoardCardKey && !isActiveBoardCardHandled && boardState?.currentEvent?.playerUid === user?.uid) {
            // pendingHandledBoardCard 只是本機暫存狀態，若中途重新整理過網頁就會
            // 遺失，導致「等其他玩家回覆完後自動重試」的機制永久失效、卡片卡死。
            // 這裡改用 Firestore 上持久化的狀態直接判斷：這張卡如果還沒結案、
            // 而且輪到自己，就直接嘗試結案，不依賴本機暫存的重試旗標。
            handledBoardCard = await markBoardCardHandled(activeBoardCardKey, activeBoardCard);
        }
        if (handledBoardCard && pendingBoardStepAdvance) {
            await advanceBoardEventQueue(pendingBoardStepAdvance);
        }
        if (handledBoardCard) {
            setPendingHandledBoardCard(null);
            setPendingBoardStepAdvance(null);
            setPendingSharedCardCompletion(null);
        }
        setIsBoardFinancialCompleted(false);
        setBoardFinancialAction(null);
        if (familyJoinActionKey) {
            setHandledFamilyJoinActionKeys(prev => prev.includes(familyJoinActionKey) ? prev : [...prev, familyJoinActionKey]);
        }

        if (pendingMarketPurchase) {
            setPendingMarketPurchase(null);
            setShowRealEstateMarketModal(false);
            showAlert('已從房市公告板購買房屋', 'success');
        }

        if (pendingBoardLifelongRoll) {
            setPromotionType(pendingBoardLifelongRoll);
            setPendingBoardLifelongRoll(null);
            setShowDiceModal(true);
            return;
        }

        if (pendingCashEventRoll) {
            setPromotionType(pendingCashEventRoll);
            setPendingCashEventRoll(null);
            setShowDiceModal(true);
            return;
        }

        if (shouldResumeBankFollowup) {
            hideAlert();
            setPaydayStep('followup');
            setShowPaydayModal(true);
        }
    };

    const handleBuyRealEstateFromMarket = async (cardId: string, isSelfUse: boolean) => {
        const cardAction = resolveBoardCardAction(cardId, gameState);
        if (cardAction.kind === 'choice') {
            const opt = cardAction.options.find(o => o.id === (isSelfUse ? 'self_use' : 'rental'));
            if (opt && opt.action.kind === 'financial') {
                setPendingMarketPurchase({ cardId, attemptId: crypto.randomUUID() });
                setBoardFinancialAction(withBoardFlow(opt.action, 'real-estate-market'));
                setIsBoardFinancialCompleted(false);
                setShowRealEstateMarketModal(false);
            }
            return;
        }

        if (cardAction.kind === 'financial' && !isSelfUse) {
            setPendingMarketPurchase({ cardId, attemptId: crypto.randomUUID() });
            setBoardFinancialAction(withBoardFlow(cardAction, 'real-estate-market'));
            setIsBoardFinancialCompleted(false);
            setShowRealEstateMarketModal(false);
        }
    };

    const openQuickTransaction = (assetType: '保險' | '定存') => {
        if (!canUseBankProducts) {
            showAlert('本回合尚未經過銀行，暫時不能購買保險或定存', 'error');
            return;
        }
        setShouldResumeBankFollowup(true);
        setTransactionQuickPreset({ mode: 'buy', assetType });
        setShowPaydayModal(false);
        setPaydayStep('confirm');
        hideAlert();
        setShowTransactionModal(true);
    };

    const handleForcedBoardBorrow = async () => {
        if (!pendingForcedBoardPayment || forcedBoardPaymentShortfall <= 0) return;

        const borrowed = handleTransactionSubmit({
            name: `${pendingForcedBoardPayment.name} 周轉借款`,
            amount: forcedBoardPaymentShortfall,
            source: 'loan',
            usage: 'cash',
            cashChange: forcedBoardPaymentShortfall,
            impacts: [
                `現金 +${forcedBoardPaymentShortfall.toLocaleString()}`,
                `信用貸款 +${forcedBoardPaymentShortfall.toLocaleString()}`
            ]
        });
        if (!borrowed) return;

        const applied = await applyResolvedBoardFinancialTx(pendingForcedBoardPayment);
        if (applied) {
            setShowForcedBoardPaymentModal(false);
            setPendingForcedBoardPayment(null);
        }
    };

    const handleForcedBoardSellAssets = () => {
        setShowForcedBoardPaymentModal(false);
        setTransactionQuickPreset({ initialTab: 'broker', mode: 'sell' });
        setShowTransactionModal(true);
    };

    const handleForcedBoardForceDebt = async () => {
        if (!pendingForcedBoardPayment || forcedBoardPaymentShortfall <= 0) return;

        const borrowed = handleTransactionSubmit({
            name: `${pendingForcedBoardPayment.name} 強制計入負債`,
            amount: forcedBoardPaymentShortfall,
            source: 'loan',
            usage: 'forced_debt',
            cashChange: forcedBoardPaymentShortfall,
            impacts: [
                `現金 +${forcedBoardPaymentShortfall.toLocaleString()}`,
                `強制負債 +${forcedBoardPaymentShortfall.toLocaleString()}`
            ],
            financialCheckEntries: [
                { category: 'Assets', name: '現金', direction: 'Increase' },
                { category: 'Liabilities', name: '強制負債', direction: 'Increase' }
            ]
        });
        if (!borrowed) return;

        const applied = await applyResolvedBoardFinancialTx(pendingForcedBoardPayment);
        if (!applied) return;
        setShowForcedBoardPaymentModal(false);
        setPendingForcedBoardPayment(null);
        showAlert('現金不足，已強制計入強制負債並完成本回合事件', 'info');
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

        setBoardFinancialAction(withBoardFlow(action, 'board-card'));
        setIsBoardFinancialCompleted(false);
    };

    const handleBoardInvestmentConfirm = () => {
        if (!activeBoardCardAction || activeBoardCardAction.kind !== 'investment') return;

        const investmentAction = activeBoardCardAction as BoardInvestmentAction;
        const normalizedAmount = boardInvestmentAmount;

        if (normalizedAmount % investmentAction.step !== 0) {
            showAlert(`投資金額需以 ${formatMoney(investmentAction.step)} 為單位`, 'error');
            return;
        }

        if (normalizedAmount < investmentAction.minAmount) {
            showAlert(`投資金額至少需 ${formatMoney(investmentAction.minAmount)}`, 'error');
            return;
        }

        if (normalizedAmount > investmentAction.maxAmount) {
            showAlert(`投資金額不可超過 ${formatMoney(investmentAction.maxAmount)}`, 'error');
            return;
        }

        const investmentUnits = normalizedAmount / investmentAction.step;
        const monthlyIncome = investmentUnits * investmentAction.monthlyReturnPerStep;
        const businessLabel = `${investmentAction.businessSymbol} ${investmentAction.businessName}`.trim();

        setIsBoardCardDrawerOpen(false);
        setBoardFinancialAction(withBoardFlow({
            kind: 'financial',
            label: '進入財務檢核',
            txData: {
                name: `新聞卡：${activeBoardCard?.title || investmentAction.businessName}`,
                amount: normalizedAmount,
                cashChange: -normalizedAmount,
                source: 'cash',
                usage: 'asset',
                assetDetails: {
                    type: '企業',
                    cashflow: monthlyIncome,
                    downPayment: normalizedAmount,
                    loanAmount: 0,
                    loanInterest: 0,
                    symbol: investmentAction.businessSymbol
                },
                impacts: [
                    `現金 -${normalizedAmount.toLocaleString()}`,
                    `${businessLabel} +${normalizedAmount.toLocaleString()}`,
                    `企業收益(月) +${monthlyIncome.toLocaleString()}`
                ]
            },
            expectedEntries: [
                { category: 'Assets', name: '現金', direction: 'Decrease' },
                { category: 'Assets', name: businessLabel, direction: 'Increase' },
                { category: 'Income', name: '企業收益', direction: 'Increase' }
            ]
        }, 'board-card'));
        setIsBoardFinancialCompleted(false);
    };

    const handleHospitalRollConfirm = () => {
        if (!hospitalRollValue) return;

        const medicalFee = hospitalRollValue * 1000;
        setShowHospitalRollModal(false);
        setPendingBoardStepAdvance('hospital');
        setBoardFinancialAction({
            kind: 'financial',
            label: '進入財務檢核',
            txData: {
                name: '棋盤事件：醫院醫藥費',
                amount: medicalFee,
                cashChange: -medicalFee,
                source: 'cash',
                usage: 'expense',
                boardFlow: 'hospital',
                impacts: [
                    `醫療支出 ${medicalFee.toLocaleString()}`,
                    `醫藥費骰點 ${hospitalRollValue} 點`
                ]
            },
            expectedEntries: [
                { category: 'Assets', name: '現金', direction: 'Decrease' }
            ]
        });
        setIsBoardFinancialCompleted(false);
    };

    const handleRepairConfirmation = () => {
        const event = boardState?.currentEvent;
        const repairFee = event?.repairFee || 0;
        if (!event || event.type !== 'repair' || !event.repairHasCar || repairFee <= 0) return;

        const repairRoll = event.repairRoll || Math.max(1, Math.floor(repairFee / 2000));
        setShowRepairConfirmationModal(false);
        setPendingBoardStepAdvance('repair');
        setBoardFinancialAction({
            kind: 'financial',
            label: '進入財務檢核',
            txData: {
                name: '棋盤事件：維修廠保養費',
                amount: repairFee,
                cashChange: -repairFee,
                source: 'cash',
                usage: 'expense',
                boardFlow: 'repair',
                boardEventId: event.id,
                impacts: [
                    `汽車保養費 ${repairFee.toLocaleString()}`,
                    `保養費骰點 ${repairRoll} 點`
                ]
            },
            expectedEntries: [
                { category: 'Assets', name: '現金', direction: 'Decrease' }
            ]
        });
        setIsBoardFinancialCompleted(false);
    };

    const closeSharedCardPromptModal = (promptId: string) => {
        setSharedSaleSelectionIds([]);
        setSharedInvestmentAmount(0);
    };

    const submitSharedPromptAndClose = async (payload: {
        promptId: string;
        status: 'completed' | 'declined' | 'no_effect';
        amount?: number;
        selectedAssetIds?: string[];
        note?: string;
    }) => {
        const submitted = await submitSharedCardPromptResponse(payload);
        if (!submitted) {
            showAlert('共享卡片回覆尚未送出，請再試一次', 'error');
            return;
        }
        setSubmittedSharedCardPromptIds(prev => prev.includes(payload.promptId) ? prev : [...prev, payload.promptId]);
        closeSharedCardPromptModal(payload.promptId);
    };

    const handleSharedCardDecline = async () => {
        if (!activeSharedCardPrompt || hasRespondedToSharedCardPrompt) return;
        await submitSharedPromptAndClose({
            promptId: activeSharedCardPrompt.id,
            status: 'declined',
            note: '玩家選擇不參與'
        });
    };

    const handleSharedInvestmentLoan = () => {
        setTransactionQuickPreset({ initialTab: 'banking' });
        setShowTransactionModal(true);
    };

    const handleSharedExpenseConfirm = () => {
        if (!activeSharedCardPrompt || activeSharedCardPrompt.kind !== 'expense_adjustment' || hasRespondedToSharedCardPrompt) return;
        if (sharedCardLocalAction?.kind !== 'financial' || !sharedCardLocalAction.afterApply?.affectsAllPlayersExpense) return;

        setBoardFinancialAction(withBoardFlow({ ...sharedCardLocalAction, afterApply: undefined }, 'shared-card'));
        setIsBoardFinancialCompleted(false);
        setPendingSharedCardCompletion({
            promptId: activeSharedCardPrompt.id,
            status: 'completed',
            note: '共享月支出調整已完成'
        });
    };

    const handleSharedDividendConfirm = async () => {
        if (!activeSharedCardPrompt || hasRespondedToSharedCardPrompt) return;
        if (activeSharedCardPrompt.kind === 'cash_dividend') {
            if (sharedDividendAmount <= 0) {
                await submitSharedPromptAndClose({
                    promptId: activeSharedCardPrompt.id,
                    status: 'no_effect',
                    note: '沒有符合條件股票'
                });
                return;
            }
            setBoardFinancialAction(withBoardFlow({
                kind: 'financial',
                label: '進入財務檢核',
                txData: {
                    name: `新聞卡：${NEWS_CARD_MAP[activeSharedCardPrompt.sourceCardId]?.title || '股利發放'}`,
                    amount: sharedDividendAmount,
                    cashChange: sharedDividendAmount,
                    source: 'income',
                    usage: 'cash',
                    incomeMultiplierEligible: true,
                    impacts: [`現金 +${sharedDividendAmount.toLocaleString()}`]
                },
                expectedEntries: [{ category: 'Assets', name: '現金', direction: 'Increase' }]
            }, 'shared-card'));
            setPendingSharedCardCompletion({
                promptId: activeSharedCardPrompt.id,
                status: 'completed',
                amount: sharedDividendAmount,
                note: '現金股利已結算'
            });
            return;
        }

        if (sharedStockDividendItems.length === 0) {
            await submitSharedPromptAndClose({
                promptId: activeSharedCardPrompt.id,
                status: 'no_effect',
                note: '沒有符合條件股票'
            });
            return;
        }

        setBoardFinancialAction(withBoardFlow({
            kind: 'financial',
            label: '進入財務檢核',
            txData: {
                name: `新聞卡：${NEWS_CARD_MAP[activeSharedCardPrompt.sourceCardId]?.title || '股息發放'}`,
                amount: 0,
                cashChange: 0,
                source: 'income',
                usage: 'stock_update',
                stockDividendPayload: {
                    items: sharedStockDividendItems.map(item => ({ assetId: item.assetId, addedQty: item.addedQty }))
                },
                impacts: ['股票張數增加']
            },
            expectedEntries: [{ category: 'Assets', name: '股票', direction: 'Increase' }]
        }, 'shared-card'));
        setPendingSharedCardCompletion({
            promptId: activeSharedCardPrompt.id,
            status: 'completed',
            note: '股票股息已結算'
        });
    };

    const handleSharedAssetSaleConfirm = () => {
        if (!activeSharedCardPrompt || sharedCardLocalAction?.kind !== 'asset_sale' || hasRespondedToSharedCardPrompt) return;
        const selectedItems = sharedCardLocalAction.items.filter(item => sharedSaleSelectionIds.includes(item.id));
        if (sharedCardLocalAction.items.length === 0) {
            void submitSharedPromptAndClose({
                promptId: activeSharedCardPrompt.id,
                status: 'no_effect',
                note: sharedCardLocalAction.emptyNote
            });
            return;
        }
        const action = buildBoardAssetSaleFinancialAction(
            `卡片出售：${activeSharedCardPrompt.sourceCardId}`,
            selectedItems
        );
        if (!action) {
            showAlert('請先選擇要出售的資產，或直接放棄', 'error');
            return;
        }
        closeSharedCardPromptModal(activeSharedCardPrompt.id);
        setBoardFinancialAction(withBoardFlow(action, 'shared-card'));
        setPendingSharedCardCompletion({
            promptId: activeSharedCardPrompt.id,
            status: 'completed',
            amount: action.txData.cashChange,
            selectedAssetIds: selectedItems.map(item => item.id),
            note: '資產出售已完成'
        });
    };

    const handleSharedInvestmentConfirm = () => {
        if (!activeSharedCardPrompt || activeSharedCardPrompt.kind !== 'investment' || hasRespondedToSharedCardPrompt) return;
        const newsCard = NEWS_CARD_MAP[activeSharedCardPrompt.sourceCardId];
        if (!newsCard || newsCard.type !== 'large_enterprise') return;

        const step = 1000000;
        const normalizedAmount = sharedInvestmentAmount;
        if (normalizedAmount % step !== 0) {
            showAlert(`投資金額需以 ${formatMoney(step)} 為單位`, 'error');
            return;
        }
        if (normalizedAmount < step) {
            showAlert(`投資金額至少需 ${formatMoney(step)}`, 'error');
            return;
        }
        if (normalizedAmount > newsCard.maxInvestment) {
            showAlert(`投資金額不可超過 ${formatMoney(newsCard.maxInvestment)}`, 'error');
            return;
        }
        const monthlyIncome = (normalizedAmount / step) * newsCard.monthlyReturnPerMillion;
        setBoardFinancialAction(withBoardFlow({
            kind: 'financial',
            label: '進入財務檢核',
            txData: {
                name: `新聞卡：${newsCard.title}`,
                amount: normalizedAmount,
                cashChange: -normalizedAmount,
                source: 'cash',
                usage: 'asset',
                assetDetails: {
                    type: '企業',
                    cashflow: monthlyIncome,
                    downPayment: normalizedAmount,
                    loanAmount: 0,
                    loanInterest: 0,
                    symbol: newsCard.id
                },
                impacts: [
                    `現金 -${normalizedAmount.toLocaleString()}`,
                    `${newsCard.id} ${newsCard.businessName} +${normalizedAmount.toLocaleString()}`,
                    `企業收益(月) +${monthlyIncome.toLocaleString()}`
                ]
            },
            expectedEntries: [
                { category: 'Assets', name: '現金', direction: 'Decrease' },
                { category: 'Assets', name: `${newsCard.id} ${newsCard.businessName}`, direction: 'Increase' },
                { category: 'Income', name: '企業收益', direction: 'Increase' }
            ]
        }, 'shared-card'));
        setPendingSharedCardCompletion({
            promptId: activeSharedCardPrompt.id,
            status: 'completed',
            amount: normalizedAmount,
            note: '大型企業投資已完成'
        });
    };

    const handleSharedStartupLoanConfirm = () => {
        if (!activeSharedCardPrompt || activeSharedCardPrompt.kind !== 'startup_loan' || hasRespondedToSharedCardPrompt) return;
        const newsCard = NEWS_CARD_MAP[activeSharedCardPrompt.sourceCardId];
        if (!newsCard || newsCard.type !== 'small_business') return;
        const investmentAmount = newsCard.investmentPerMonth;

        setBoardFinancialAction(withBoardFlow({
            kind: 'financial',
            label: '進入財務檢核',
            txData: {
                name: `新聞卡：${newsCard.title}`,
                amount: investmentAmount,
                cashChange: newsCard.loanAmount - investmentAmount,
                source: 'loan',
                usage: 'asset',
                assetDetails: {
                    type: '企業',
                    cashflow: 0,
                    downPayment: investmentAmount,
                    loanAmount: newsCard.loanAmount,
                    loanInterest: newsCard.interestPerMonth,
                    symbol: newsCard.id
                },
                impacts: [
                    `現金 -${investmentAmount.toLocaleString()}`,
                    `現金（企業貸款） +${newsCard.loanAmount.toLocaleString()}`,
                    `兼職工作室 ${newsCard.id} +${investmentAmount.toLocaleString()}`,
                    `企業貸款 +${newsCard.loanAmount.toLocaleString()}`,
                    `企業貸款利息(月) +${newsCard.interestPerMonth.toLocaleString()}`
                ]
            },
            expectedEntries: [
                { category: 'Assets', name: '現金', direction: 'Decrease' },
                { category: 'Assets', name: '現金（企業貸款）', direction: 'Increase' },
                { category: 'Assets', name: `${newsCard.id} 兼職工作室`, direction: 'Increase' },
                { category: 'Liabilities', name: '企業貸款', direction: 'Increase' },
                { category: 'Expenses', name: '企業貸款利息', direction: 'Increase' }
            ]
        }, 'startup-loan'));
        setPendingSharedCardCompletion({
            promptId: activeSharedCardPrompt.id,
            status: 'completed',
            amount: investmentAmount,
            note: '創業貸款已建立',
            startupUpgradeCardId: newsCard.id
        });
        closeSharedCardPromptModal(activeSharedCardPrompt.id);
    };

    const closeFamilyJoinModal = (promptId: string) => {
        if (familyJoinCloseTimeoutRef.current) {
            clearTimeout(familyJoinCloseTimeoutRef.current);
            familyJoinCloseTimeoutRef.current = null;
        }

        setVisibleFamilyJoinPromptId(current => current === promptId ? null : current);
        setFamilyJoinPromptSnapshot(current => current?.id === promptId ? null : current);
        setDismissedFamilyJoinPromptIds(prev => prev.includes(promptId) ? prev : [...prev, promptId]);
        setIsSubmittingFamilyJoin(false);
    };

    const handleFamilyJoinRoll = () => {
        if (!activeFamilyJoinPrompt || !user?.uid || isSubmittingFamilyJoin || hasRespondedToFamilyJoin || isFamilyJoinRolling || familyJoinRollInFlightRef.current) return;

        familyJoinRollInFlightRef.current = true;
        const finalRoll = Math.floor(Math.random() * 6) + 1;
        setIsFamilyJoinRolling(true);
        setFamilyJoinResult(null);

        if (familyJoinRollIntervalRef.current) {
            clearInterval(familyJoinRollIntervalRef.current);
        }
        // 骰子先快速跳動幾次製造隨機感，再定格在最終結果，避免點擊後數字瞬間定死。
        familyJoinRollIntervalRef.current = setInterval(() => {
            setFamilyJoinRollValue(Math.floor(Math.random() * 6) + 1);
        }, FAMILY_JOIN_ROLL_TICK_MS);

        setTimeout(() => {
            if (familyJoinRollIntervalRef.current) {
                clearInterval(familyJoinRollIntervalRef.current);
                familyJoinRollIntervalRef.current = null;
            }
            setIsFamilyJoinRolling(false);
            void finalizeFamilyJoinRoll(finalRoll);
        }, FAMILY_JOIN_ROLL_ANIMATION_MS);
    };

    const finalizeFamilyJoinRoll = async (roll: number) => {
        if (!activeFamilyJoinPrompt || !user?.uid) {
            familyJoinRollInFlightRef.current = false;
            return;
        }

        const passed = roll >= activeFamilyJoinPrompt.requiredRoll;
        const promptId = activeFamilyJoinPrompt.id;

        setFamilyJoinRollValue(roll);
        setFamilyJoinResult(passed ? 'passed' : 'failed');
        setIsSubmittingFamilyJoin(true);

        try {
            const submitted = await submitFamilyMilestoneJoinResponse({
                promptId,
                status: passed ? 'passed' : 'failed',
                roll,
                cardId: activeFamilyJoinPrompt.sourceCardId
            });
            if (!submitted) {
                setFamilyJoinResult(null);
                showAlert('家庭歷程回覆同步失敗，請重新送出', 'error');
                return;
            }
            setSubmittedFamilyJoinPromptIds(prev => prev.includes(promptId) ? prev : [...prev, promptId]);
            showAlert(
                passed
                    ? `你擲出 ${roll} 點，成功加入家庭重要歷程`
                    : `你擲出 ${roll} 點，未達 ${activeFamilyJoinPrompt.requiredRoll} 點，這次無法加入`,
                passed ? 'success' : 'info'
            );

            if (passed) {
                // The result is already shown in the notification. The
                // participation choice should follow the persisted pending action.
                closeFamilyJoinModal(promptId);
            }
        } finally {
            setIsSubmittingFamilyJoin(false);
            familyJoinRollInFlightRef.current = false;
        }
    };

    const handleDeclineFamilyJoin = async () => {
        if (!activeFamilyJoinPrompt || isSubmittingFamilyJoin || hasRespondedToFamilyJoin) return;
        setIsSubmittingFamilyJoin(true);
        try {
            const submitted = await submitFamilyMilestoneJoinResponse({
                promptId: activeFamilyJoinPrompt.id,
                status: 'declined',
                cardId: activeFamilyJoinPrompt.sourceCardId
            });
            if (!submitted) {
                showAlert('家庭歷程回覆同步失敗，請再試一次', 'error');
                return;
            }
            setSubmittedFamilyJoinPromptIds(prev => prev.includes(activeFamilyJoinPrompt.id) ? prev : [...prev, activeFamilyJoinPrompt.id]);
            closeFamilyJoinModal(activeFamilyJoinPrompt.id);
        } finally {
            setIsSubmittingFamilyJoin(false);
        }
    };

    const handleFamilyJoinActionChoice = async (accepted: boolean) => {
        if (!pendingFamilyJoinAction || !activeFamilyJoinActionKey || !pendingFamilyJoinActionDefinition) return;

        if (pendingFamilyJoinActionDefinition.kind !== 'choice') {
            if (!accepted) {
                const result = await completeFamilyMilestoneAction({ promptId: pendingFamilyJoinAction.promptId, accepted: false });
                if (result.status === 'failed') {
                    showAlert(result.message || '家庭歷程拒絕結果同步失敗，請再試一次', 'error');
                    return;
                }
                setHandledFamilyJoinActionKeys(prev => prev.includes(activeFamilyJoinActionKey) ? prev : [...prev, activeFamilyJoinActionKey]);
            }
            return;
        }

        const selectedOption = pendingFamilyJoinActionDefinition.options.find(option => option.id === (accepted ? 'accept' : 'reject'));
        if (!selectedOption) return;

        if (selectedOption.action.kind === 'financial') {
            setBoardFinancialAction(withBoardFlow(selectedOption.action, 'family-milestone'));
            setIsBoardFinancialCompleted(false);
            return;
        }

        if (selectedOption.action.kind === 'happiness') {
            await applyJoinDirectHappiness(selectedOption.action, pendingFamilyJoinAction.promptId, activeFamilyJoinActionKey);
            return;
        }

        const result = await completeFamilyMilestoneAction({ promptId: pendingFamilyJoinAction.promptId, accepted: false });
        if (result.status === 'failed') {
            showAlert(result.message || '家庭歷程結果同步失敗，請再試一次', 'error');
            return;
        }
        setHandledFamilyJoinActionKeys(prev => prev.includes(activeFamilyJoinActionKey) ? prev : [...prev, activeFamilyJoinActionKey]);
    };

    useEffect(() => {
        if (!currentPlayerRoomState?.pendingFamilyMilestoneJoinAction || !activeFamilyJoinActionKey) return;
        if (activeFamilyJoinPrompt?.id !== currentPlayerRoomState.pendingFamilyMilestoneJoinAction.promptId) return;
        if (activeFamilyJoinPrompt.sourceEventId !== boardState?.currentEvent?.id) return;
        if (handledFamilyJoinActionKeys.includes(activeFamilyJoinActionKey)) return;
        if (!canOpenNextBoardStep || !!boardFinancialAction || shouldShowFamilyJoinModal || shouldShowFamilyJoinActionModal) return;

        const { promptId } = currentPlayerRoomState.pendingFamilyMilestoneJoinAction;
        const joinAction = pendingFamilyJoinActionDefinition;
        if (!joinAction) return;

        if (joinAction.kind === 'choice') {
            const acceptOption = joinAction.options.find(option => option.id === 'accept');
            if (acceptOption?.action.kind === 'financial') {
                setBoardFinancialAction(withBoardFlow(acceptOption.action, 'family-milestone'));
                setIsBoardFinancialCompleted(false);
                return;
            }
            if (acceptOption?.action.kind === 'happiness') {
                void applyJoinDirectHappiness(acceptOption.action, promptId, activeFamilyJoinActionKey);
                return;
            }

            if (acceptOption?.action.kind === 'dismiss' || !acceptOption) {
                void completeFamilyMilestoneAction({ promptId, accepted: false }).then(result => {
                    if (result.status === 'failed') {
                        showAlert(result.message || '家庭歷程結果同步失敗，請再試一次', 'error');
                        return;
                    }
                    setHandledFamilyJoinActionKeys(prev => prev.includes(activeFamilyJoinActionKey) ? prev : [...prev, activeFamilyJoinActionKey]);
                });
            }
            return;
        }

        if (joinAction.kind === 'financial') {
            setBoardFinancialAction(withBoardFlow(joinAction, 'family-milestone'));
            setIsBoardFinancialCompleted(false);
            return;
        }

        if (joinAction.kind === 'happiness') {
            void applyJoinDirectHappiness(joinAction, promptId, activeFamilyJoinActionKey);
            return;
        }

        void completeFamilyMilestoneAction({ promptId, accepted: false }).then(result => {
            if (result.status === 'failed') {
                showAlert(result.message || '家庭歷程結果同步失敗，請再試一次', 'error');
                return;
            }
            setHandledFamilyJoinActionKeys(prev => prev.includes(activeFamilyJoinActionKey) ? prev : [...prev, activeFamilyJoinActionKey]);
            showAlert('這張家庭歷程目前無法同步結算，已略過', 'info');
        });
    }, [
        activeFamilyJoinActionKey,
        activeFamilyJoinPrompt,
        boardState?.currentEvent?.id,
        boardFinancialAction,
        canOpenNextBoardStep,
        clearPendingFamilyMilestoneJoinAction,
        currentPlayerRoomState?.pendingFamilyMilestoneJoinAction,
        handledFamilyJoinActionKeys,
        pendingFamilyJoinActionDefinition,
        pendingHandledBoardCard,
        pendingBoardStepAdvance,
        pendingSharedCardCompletion,
        shouldShowFamilyJoinActionModal,
        shouldShowFamilyJoinModal,
        showAlert
    ]);

    useEffect(() => {
        if (!room?.isBoardGame || !boardState || !user?.uid || !activeSharedCardPrompt || !activeBoardCard) return;
        if (boardState.currentEvent?.playerUid !== user.uid) return;
        if (activeBoardCard.cardId !== activeSharedCardPrompt.sourceCardId) return;
        const hasAllResponses = activeSharedCardPrompt.targetPlayerUids.every(uid => !!activeSharedCardPrompt.responses?.[uid]);
        if (!hasAllResponses) return;
        if (isActiveBoardCardHandled) return;

        void finalizeBoardFinancialFlow();
    }, [
        activeBoardCard,
        activeBoardCardKey,
        activeSharedCardPrompt,
        finalizeBoardFinancialFlow,
        isActiveBoardCardHandled,
        room?.isBoardGame,
        boardState,
        user?.uid
    ]);

    return (
        <div className="player-ui h-[100dvh] flex flex-col overflow-hidden animate-in fade-in duration-500">
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
                <div className={`fixed left-1/2 z-[10070] -translate-x-1/2 border border-[#d8c29a] bg-[#fffaf2] text-[#293a38] animate-in zoom-in-95 duration-300 transition-all ${alertInfo.persist
                    ? "top-1/2 w-[min(90vw,420px)] -translate-y-1/2 rounded-[24px] p-6 text-center shadow-[0_28px_80px_-32px_rgba(16,47,56,0.85)]"
                    : "bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))] flex w-[min(90vw,520px)] items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-[0_14px_32px_-18px_rgba(16,47,56,0.75)] sm:bottom-32"
                    }`}>
                    {alertInfo.persist ? (
                        <div className="mb-4 flex items-center justify-center gap-2">
                            <div className={`flex shrink-0 items-center justify-center rounded-xl p-2 ${alertInfo.type === 'error' ? 'bg-[#f5d9d0] text-[#b6544b]' :
                                alertInfo.type === 'success' ? 'bg-[#d8e9e5] text-[#2e806d]' :
                                    'bg-[#f4e6d0] text-[#2e6570]'
                                }`}>
                                {alertInfo.type === 'error' ? <AlertCircle size={20} /> : alertInfo.type === 'success' ? <CheckCircle2 size={20} /> : <Bell size={20} />}
                            </div>
                            <div className="text-[10px] font-black tracking-[0.2em] text-[#2e6570]">遊戲通知</div>
                        </div>
                    ) : (
                        <div className={`flex shrink-0 items-center justify-center rounded-xl p-2 ${alertInfo.type === 'error' ? 'bg-[#f5d9d0] text-[#b6544b]' :
                            alertInfo.type === 'success' ? 'bg-[#d8e9e5] text-[#2e806d]' :
                                'bg-[#f4e6d0] text-[#2e6570]'
                            }`}>
                            {alertInfo.type === 'error' ? <AlertCircle size={20} /> : alertInfo.type === 'success' ? <CheckCircle2 size={20} /> : <Bell size={20} />}
                        </div>
                    )}
                    <div className={`flex w-full min-w-0 flex-col gap-3 ${alertInfo.persist ? 'items-center' : 'items-start'}`}>
                        <span className={`block max-w-full break-words whitespace-pre-line [overflow-wrap:anywhere] font-bold leading-snug tracking-tight text-[#293a38] ${alertInfo.persist ? "max-h-[min(48vh,360px)] overflow-y-auto text-lg" : "text-sm"
                            }`}>
                            {alertInfo.message}
                        </span>
                        {alertInfo.persist && (
                            <button
                                onClick={hideAlert}
                                className={`mt-1 w-full rounded-xl py-3 text-sm font-black text-white transition-all active:scale-95 ${alertInfo.type === 'error' ? 'bg-[#c9655a] hover:bg-[#b6544b]' : 'bg-[#2e6570] hover:bg-[#254f57]'}`}
                            >
                                我知道了
                            </button>
                        )}
                    </div>
                </div>
            )}

            {hasPendingSharedCardPrompt && !shouldShowSharedCardPromptModal && !showScoreView && (
                <div className="fixed left-1/2 top-[calc(5.5rem+env(safe-area-inset-top,0px))] z-[10060] w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-[#9fc8d5] bg-[#edf6f6] px-4 py-3 text-center text-sm font-black text-[#2e6570] shadow-lg" role="status">
                    共享卡片已準備好，完成目前流程後會自動開啟。
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

            {shouldShowFamilyJoinModal && activeFamilyJoinPrompt && (
                <div className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[32px] border border-amber-200/30 bg-[#fff8ee] p-6 text-[#6a4b2f] shadow-2xl">
                        <div className="space-y-3">
                            <div className="inline-flex rounded-full border border-[#d9b98b] bg-[#fff2de] px-4 py-1 text-sm font-black tracking-[0.2em] text-[#9a6f43]">
                                家庭重要歷程
                            </div>
                            <h3 className="text-3xl font-black leading-tight">其他玩家同步參與</h3>
                            <p className="text-base font-bold leading-relaxed text-[#7a5a3d]">
                                {activeFamilyJoinPrompt.sourcePlayerName} 抽到家庭重要歷程卡。
                                你現在可直接擲骰，擲出至少 {activeFamilyJoinPrompt.requiredRoll} 點就能一起參與這張卡。
                            </p>
                        </div>

                        <div className="mt-6 rounded-[28px] border border-[#ead0ab] bg-white/80 p-5 text-center">
                            <p className="text-sm font-bold tracking-[0.18em] text-[#b07c3f]">目前骰點</p>
                            <div className={`mt-3 text-5xl font-black text-[#5e432c] transition-transform ${isFamilyJoinRolling ? 'animate-bounce' : ''}`}>
                                {familyJoinRollValue ?? '-'}
                            </div>
                            {familyJoinResult && (
                                <p className={`mt-3 text-base font-black ${familyJoinResult === 'passed' ? 'text-[#d97706]' : 'text-[#9a6f43]'}`}>
                                    {familyJoinResult === 'passed' ? '達標，將開啟你的家庭歷程結算' : '未達標，這次無法加入'}
                                </p>
                            )}
                        </div>

                        {familyJoinResult === 'failed' ? (
                            <button
                                type="button"
                                onClick={() => closeFamilyJoinModal(activeFamilyJoinPrompt.id)}
                                disabled={isSubmittingFamilyJoin}
                                className="mt-6 w-full rounded-2xl bg-[#9a6f43] px-4 py-3 text-base font-black text-white transition hover:bg-[#825b37] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmittingFamilyJoin ? '同步中...' : '關閉'}
                            </button>
                        ) : (
                            <div className="mt-6 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleDeclineFamilyJoin}
                                    disabled={isSubmittingFamilyJoin || hasRespondedToFamilyJoin || isFamilyJoinRolling}
                                    className="flex-1 rounded-2xl border border-[#d9b98b] bg-white px-4 py-3 text-base font-black text-[#8b6a48] transition hover:bg-[#fff4e7] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {hasRespondedToFamilyJoin ? '已回覆' : '略過'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFamilyJoinRoll}
                                    disabled={isSubmittingFamilyJoin || hasRespondedToFamilyJoin || isFamilyJoinRolling}
                                    className="flex-1 rounded-2xl bg-[#f59e0b] px-4 py-3 text-base font-black text-white transition hover:bg-[#f2a81f] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {hasRespondedToFamilyJoin ? '已送出' : (isFamilyJoinRolling ? '擲骰中...' : (isSubmittingFamilyJoin ? '處理中...' : '立即擲骰'))}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {shouldShowFamilyJoinActionModal && pendingFamilyJoinAction && pendingFamilyJoinAcceptOption && (
                <div className="fixed inset-0 z-[10042] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[32px] border border-amber-200/30 bg-[#fff8ee] p-6 text-[#6a4b2f] shadow-2xl">
                        <div className="space-y-3">
                            <div className="inline-flex rounded-full border border-[#d9b98b] bg-[#fff2de] px-4 py-1 text-sm font-black tracking-[0.2em] text-[#9a6f43]">
                                家庭重要歷程
                            </div>
                            <h3 className="text-3xl font-black leading-tight">要參加這項家庭歷程嗎？</h3>
                            <p className="text-base font-bold leading-relaxed text-[#7a5a3d]">
                                你已擲骰達標，可以選擇是否完成自己的家庭歷程。選擇參加後，才會進入財務檢核。
                            </p>
                        </div>

                        <div className="mt-6 rounded-[24px] border border-[#ead0ab] bg-white/80 p-4">
                            <div className="text-lg font-black text-[#5e432c]">{pendingFamilyJoinAcceptOption.action.kind === 'financial' ? pendingFamilyJoinAcceptOption.action.txData.name : '家庭歷程獎勵'}</div>
                            {pendingFamilyJoinAcceptOption.action.kind === 'financial' && (
                                <div className="mt-2 space-y-1 text-sm font-bold text-[#8b6a48]">
                                    {(Array.isArray(pendingFamilyJoinAcceptOption.action.txData.impacts) ? pendingFamilyJoinAcceptOption.action.txData.impacts : []).map(impact => (
                                        <div key={impact}>{impact}</div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => { void handleFamilyJoinActionChoice(false); }}
                                className="flex-1 rounded-2xl border border-[#d9b98b] bg-white px-4 py-3 text-base font-black text-[#8b6a48] transition hover:bg-[#fff4e7]"
                            >
                                不參加
                            </button>
                            <button
                                type="button"
                                onClick={() => { void handleFamilyJoinActionChoice(true); }}
                                className="flex-1 rounded-2xl bg-[#f59e0b] px-4 py-3 text-base font-black text-white transition hover:bg-[#f2a81f]"
                            >
                                參加
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {shouldShowSharedCardPromptModal && activeSharedCardPrompt && (
                <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-[#102f38]/78 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-[32px] border border-[#d8c29a] bg-[#fffaf2] p-6 text-[#293a38] shadow-[0_28px_80px_-32px_rgba(16,47,56,0.85)]">
                        <div className="space-y-3">
                            <div className="inline-flex rounded-full border border-[#9fc8d5] bg-[#edf6f6] px-4 py-1 text-sm font-black tracking-[0.2em] text-[#36798a]">
                                共享卡片事件
                            </div>
                            <h3 className="text-3xl font-black leading-tight">
                                {activeSharedCardPrompt.kind === 'asset_sale' && '出售資產回覆'}
                                {activeSharedCardPrompt.kind === 'cash_dividend' && '現金股利結算'}
                                {activeSharedCardPrompt.kind === 'stock_dividend' && '股票股息結算'}
                                {activeSharedCardPrompt.kind === 'investment' && '大型企業投資'}
                                {activeSharedCardPrompt.kind === 'startup_loan' && '創業貸款選擇'}
                                {activeSharedCardPrompt.kind === 'expense_adjustment' && '全體月支出調整'}
                            </h3>
                            <p className="text-sm leading-relaxed text-[#765f47]">
                                {activeSharedCardPrompt.sourcePlayerName} 抽到 {activeSharedCardPrompt.sourceCardId}。
                                請完成屬於你的回覆，全部玩家處理完成後，本事件才會正式結束。
                            </p>
                            {sharedCardDescription && (
                                <p className="whitespace-pre-line rounded-2xl border border-[#ead6b9] bg-[#f8eee0] px-4 py-3 text-sm font-bold leading-relaxed text-[#765f47]">
                                    {sharedCardDescription}
                                </p>
                            )}
                        </div>

                        {activeSharedCardPrompt.kind === 'asset_sale' && sharedCardLocalAction?.kind === 'asset_sale' && (
                            <div className="mt-6 space-y-3">
                                {sharedCardLocalAction.items.length === 0 ? (
                                    <div className="rounded-3xl border border-[#ead6b9] bg-[#f8eee0] px-4 py-4 text-sm leading-relaxed text-[#765f47]">
                                        {sharedCardLocalAction.emptyNote}
                                    </div>
                                ) : (
                                    <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                                        {sharedCardLocalAction.items.map(item => {
                                            const checked = sharedSaleSelectionIds.includes(item.id);
                                            return (
                                                    <label key={item.id} className="block rounded-2xl border border-[#ead6b9] bg-[#f8eee0] p-4">
                                                    <div className="flex items-start gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            disabled={!item.selectable}
                                                            onChange={() => {
                                                                if (!item.selectable) return;
                                                                setSharedSaleSelectionIds(prev =>
                                                                    prev.includes(item.id)
                                                                        ? prev.filter(id => id !== item.id)
                                                                        : [...prev, item.id]
                                                                );
                                                            }}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-black text-[#293a38]">{item.asset.name}</div>
                                                            <div className="mt-1 text-xs text-[#7a6958]">{item.summary}</div>
                                                            <div className="mt-2 text-sm font-bold text-[#168269]">入帳 {formatMoney(item.netCash)}</div>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeSharedCardPrompt.kind === 'cash_dividend' && (
                            <div className="mt-6 rounded-3xl border border-[#ead6b9] bg-[#f8eee0] p-5 text-center">
                                <div className="text-xs font-black tracking-[0.2em] text-[#7a6958]">可領股利</div>
                                <div className="mt-3 text-4xl font-black text-[#168269]">{formatMoney(sharedDividendAmount)}</div>
                                <div className="mt-2 text-sm text-[#765f47]">
                                    {sharedDividendAmount > 0 ? '依你目前持股計算完成' : '沒有符合條件股票'}
                                </div>
                            </div>
                        )}

                        {activeSharedCardPrompt.kind === 'stock_dividend' && (
                            <div className="mt-6 rounded-3xl border border-[#ead6b9] bg-[#f8eee0] p-5">
                                <div className="text-xs font-black tracking-[0.2em] text-[#7a6958]">配股內容</div>
                                <div className="mt-3 space-y-2 text-sm text-[#5f4933]">
                                    {sharedStockDividendItems.length > 0 ? sharedStockDividendItems.map(item => (
                                        <div key={item.assetId} className="flex items-center justify-between rounded-2xl bg-[#fffaf2] px-3 py-2">
                                            <span>{item.symbol}</span>
                                            <span className="font-black text-[#168269]">+{item.addedQty} 張</span>
                                        </div>
                                    )) : (
                                        <div className="rounded-2xl bg-[#fffaf2] px-3 py-4 text-center text-[#7a6958]">沒有符合條件股票</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeSharedCardPrompt.kind === 'investment' && (
                            <div className="mt-6 rounded-3xl border border-[#ead6b9] bg-[#f8eee0] p-4">
                                <div className="flex items-center justify-between text-xs font-black tracking-[0.16em] text-[#7a6958]">
                                    <span>投資金額</span>
                                    <span>每次增減 {formatMoney(1000000)}</span>
                                </div>
                                <div className="mt-3 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSharedInvestmentAmount(current => Math.max(0, current - 1000000))}
                                        className="h-11 w-11 rounded-2xl bg-[#f4e6d0] text-xl font-black text-[#76573a]"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min={0}
                                        step={1000000}
                                        value={sharedInvestmentAmount || ''}
                                        onChange={(event) => setSharedInvestmentAmount(parseInt(event.target.value, 10) || 0)}
                                        className="h-11 flex-1 rounded-2xl border border-[#d8c29a] bg-[#fffaf2] px-3 text-center text-lg font-black text-[#293a38]"
                                        placeholder="0"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setSharedInvestmentAmount(current => current + 1000000)}
                                        className="h-11 w-11 rounded-2xl bg-[#f4e6d0] text-xl font-black text-[#76573a]"
                                    >
                                        +
                                    </button>
                                </div>
                                <div className="mt-3 text-xs font-bold text-[#7a6958]">可用現金 {formatMoney(gameState.cash)}</div>
                            </div>
                        )}

                        {activeSharedCardPrompt.kind === 'startup_loan' && (
                            <div className="mt-6 rounded-3xl border border-[#ead6b9] bg-[#f8eee0] p-5 text-sm leading-relaxed text-[#765f47]">
                                接受後會建立兼職工作室、企業貸款與每月支出。之後經過銀行時，會觸發升級擲骰。
                            </div>
                        )}

                        {activeSharedCardPrompt.kind === 'expense_adjustment' && sharedCardLocalAction?.kind === 'financial' && (
                            <div className="mt-6 rounded-3xl border border-[#e3bd78] bg-[#fff2d8] p-5">
                                <div className="text-xs font-black tracking-[0.2em] text-[#8c5b2b]">你的月支出調整</div>
                                <div className="mt-3 space-y-2 text-sm font-bold leading-relaxed text-[#76573a]">
                                    {(Array.isArray(sharedCardLocalAction.txData.impacts) ? sharedCardLocalAction.txData.impacts : []).map(impact => (
                                        <div key={impact}>{impact}</div>
                                    ))}
                                </div>
                                <div className="mt-3 text-xs leading-relaxed text-[#8c5b2b]">請完成財務檢核，這項調整會套用到你的財務報表。</div>
                            </div>
                        )}

                        <div className="mt-6 flex gap-3">
                            {activeSharedCardPrompt.kind !== 'expense_adjustment' && (
                                <button
                                    type="button"
                                    onClick={handleSharedCardDecline}
                                    disabled={hasRespondedToSharedCardPrompt}
                                    className="flex-1 rounded-2xl border border-[#d8c29a] bg-[#f4e6d0] px-4 py-3 text-base font-black text-[#76573a] transition hover:bg-[#ead7b8] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {hasRespondedToSharedCardPrompt ? '已回覆' : '放棄'}
                                </button>
                            )}
                            {activeSharedCardPrompt.kind === 'asset_sale' && (
                                <button
                                    type="button"
                                    onClick={handleSharedAssetSaleConfirm}
                                    disabled={hasRespondedToSharedCardPrompt || sharedCardLocalAction?.kind !== 'asset_sale' || sharedCardLocalAction.items.length === 0}
                                    className="flex-1 rounded-2xl bg-[#168269] px-4 py-3 text-base font-black text-white transition hover:bg-[#106b58] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    進入出售
                                </button>
                            )}
                            {(activeSharedCardPrompt.kind === 'cash_dividend' || activeSharedCardPrompt.kind === 'stock_dividend') && (
                                <button
                                    type="button"
                                    onClick={handleSharedDividendConfirm}
                                    disabled={hasRespondedToSharedCardPrompt}
                                    className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-base font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {(activeSharedCardPrompt.kind === 'cash_dividend' ? sharedDividendAmount : sharedStockDividendItems.length) > 0 ? '開始結算' : '關閉'}
                                </button>
                            )}
                            {activeSharedCardPrompt.kind === 'investment' && (
                                <>
                                    {activeSharedCardPrompt.sourceCardId === 'N055' && (
                                        <button type="button" onClick={handleSharedInvestmentLoan} disabled={hasRespondedToSharedCardPrompt} className="flex-1 rounded-2xl border border-[#d8c29a] bg-[#fffaf2] px-4 py-3 text-base font-black text-[#76573a] transition hover:bg-[#f4e6d0] disabled:cursor-not-allowed disabled:opacity-60">
                                            先貸款
                                        </button>
                                    )}
                                    <button type="button" onClick={handleSharedInvestmentConfirm} disabled={hasRespondedToSharedCardPrompt} className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-base font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
                                        參與投資
                                    </button>
                                </>
                            )}
                            {activeSharedCardPrompt.kind === 'startup_loan' && (
                                <button
                                    type="button"
                                    onClick={handleSharedStartupLoanConfirm}
                                    disabled={hasRespondedToSharedCardPrompt}
                                    className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-base font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    接受貸款
                                </button>
                            )}
                            {activeSharedCardPrompt.kind === 'expense_adjustment' && (
                                <button
                                    type="button"
                                    onClick={handleSharedExpenseConfirm}
                                    disabled={hasRespondedToSharedCardPrompt}
                                    className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-base font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    進入財務檢核
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showLeaveConfirm && (
                <PlayerModalFrame
                    eyebrow="離開遊戲"
                    title="確定要離開房間？"
                    description="離開後將無法繼續目前的遊戲，且資料將不會被儲存。"
                    accent="medical"
                    closeDisabled={isLeaving}
                    onClose={() => setShowLeaveConfirm(false)}
                    footer={(
                        <div className="flex flex-col gap-3 sm:flex-row-reverse">
                            <button
                                onClick={handleLeaveRoom}
                                disabled={isLeaving}
                                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#b54155] px-5 py-3 text-base font-black text-white transition hover:bg-[#9f3549] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isLeaving ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : '確定離開'}
                            </button>
                            <button
                                onClick={() => setShowLeaveConfirm(false)}
                                disabled={isLeaving}
                                className="min-h-12 flex-1 rounded-2xl border border-[#d8c29a] bg-[#fffaf2] px-5 py-3 text-base font-black text-[#765f47] transition hover:bg-[#f3e4cc] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                取消
                            </button>
                        </div>
                    )}
                >
                    <div className="flex justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#f5d9d0] text-[#b54155]">
                            <LogOut size={34} />
                        </div>
                    </div>
                </PlayerModalFrame>
            )}

            {showWinAnimation && (
                <HappinessWinAnimation onComplete={() => setShowWinAnimation(false)} />
            )}

            <main className="fixed inset-0 overflow-y-auto no-scrollbar pt-[calc(190px+env(safe-area-inset-top,0px))] pb-[calc(200px+env(safe-area-inset-bottom,0px))] sm:pb-[calc(230px+env(safe-area-inset-bottom,0px))] touch-pan-y">
                <div className="max-w-4xl mx-auto w-full px-4 md:px-6 space-y-6">
                    <div className="-mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <FinancialStatement
                            gameState={gameState}
                            summary={summary}
                            hideSummary={true}
                            showDashboard={false}
                            defaultShowDetails={true}
                            navPosition="inline"
                            showCardLogTab={room?.isBoardGame}
                            cardLogEntries={(room?.boardState?.cardLog || []).slice(0, 12)}
                            financialAccelerationMultiplier={room?.financialAcceleration?.multiplier || 1}
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
                onRollAnimationComplete={room?.isBoardGame ? handleBoardDiceAnimationComplete : undefined}
                onShowMedical={() => setShowMedicalClaimModal(true)}
                onShowTargetDream={() => setShowTargetDreamModal(true)}
                onShowTransaction={() => {
                    setTransactionQuickPreset(null);
                    setShowTransactionModal(true);
                }}
                onShowRealEstateMarket={handleOpenRealEstateMarket}
                onShowPayday={() => setShowPaydayModal(true)}
                onShowSettlement={() => {
                    setShowScoreView(true);
                    setIsSettlement(true);
                }}
                onEndTurn={handleEndTurn}
                canRoll={boardActionAvailability.canRoll}
                canEndTurn={canEndTurn && !isEndingTurn}
                rollBlockReason={boardActionAvailability.rollBlocker?.message}
                endTurnBlockReason={boardActionAvailability.endTurnBlocker?.message}
                hasRolledBoardDice={!!boardState?.hasRolledThisTurn}
                isBoardTurn={isBoardTurn}
                isRollingBoardDice={isRollingBoardDice}
                isEndingTurn={isEndingTurn}
                hasCar={hasCar}
                disabled={room?.status === 'finished'}
            />

            {displayBoardCard && (
                <BoardCardDrawer
                    card={displayBoardCard}
                    isOpen={visibleFlowModal === 'board-card'}
                    isRevealed={isBoardCardRevealed}
                    onReveal={handleBoardCardReveal}
                    onRevealAnimationComplete={() => setIsBoardCardRevealAnimationComplete(true)}
                    onClose={handleCloseBoardCardDrawer}
                    closeDisabled={visibleFlowModal !== 'board-card' || boardChoiceHasDismissOption}
                    actionArea={isBoardCardRevealed && activeBoardCardAction ? (
                        isPendingFamilySourceCardCompletion ? (
                            <div className="px-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => { void markBoardCardHandled(); }}
                                    disabled={hasIncompleteSharedBoardPrompt}
                                    className="w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-wait disabled:bg-slate-800 disabled:text-slate-400"
                                >
                                    {hasIncompleteSharedBoardPrompt ? '等待其他玩家完成' : '完成卡片'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 px-2 pt-1">
                            {activeBoardCardAction.kind === 'financial' && (
                                <div className={`grid gap-3 ${isForcedActiveBoardCard ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                    {!isForcedActiveBoardCard && (
                                        <button
                                            onClick={handleCloseBoardCardDrawer}
                                            disabled={isActiveBoardCardHandled}
                                            className="rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            關閉
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setIsBoardCardDrawerOpen(false);
                                            setBoardFinancialAction(withBoardFlow(
                                                activeBoardCardAction,
                                                activeBoardCardAction.txData.boardFlow || 'board-card'
                                            ));
                                            setIsBoardFinancialCompleted(false);
                                        }}
                                        disabled={isActiveBoardCardHandled}
                                        className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isActiveBoardCardHandled ? '此卡已處理' : activeBoardCardAction.label}
                                    </button>
                                </div>
                            )}

                            {activeBoardCardAction.kind === 'happiness' && (
                                <div className={`grid gap-3 ${isForcedActiveBoardCard ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                    {!isForcedActiveBoardCard && (
                                        <button
                                            onClick={() => { void markBoardCardHandled(); }}
                                            disabled={isActiveBoardCardHandled}
                                            className="rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            關閉
                                        </button>
                                    )}
                                    <button
                                        onClick={handleApplyDirectHappiness}
                                        disabled={isActiveBoardCardHandled}
                                        className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isActiveBoardCardHandled
                                            ? '此卡已處理'
                                            : HAPPINESS_CARD_MAP[activeBoardCard?.cardId || '']?.requiresStorySharing
                                                ? (storyShareRequest?.status === 'pending' ? '等待主持人確認' : '送出故事分享確認')
                                                : activeBoardCardAction.label}
                                    </button>
                                </div>
                            )}

                            {activeBoardCardAction.kind === 'effect' && (
                                <div className={`grid gap-3 ${isForcedActiveBoardCard ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                    {!isForcedActiveBoardCard && (
                                        <button
                                            onClick={() => { void markBoardCardHandled(); }}
                                            disabled={isActiveBoardCardHandled}
                                            className="rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            關閉
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (requiresOpportunityShareApproval) {
                                                submitBoardShareApprovalRequest();
                                                return;
                                            }
                                            void handleApplyBoardInstantEffect(activeBoardCardAction.title, activeBoardCardAction.afterApply);
                                        }}
                                        disabled={isActiveBoardCardHandled}
                                        className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isActiveBoardCardHandled
                                            ? '此卡已處理'
                                            : requiresOpportunityShareApproval
                                                ? (boardShareRequest?.status === 'pending' ? '等待主持人確認' : '送出分享確認')
                                                : activeBoardCardAction.label}
                                    </button>
                                </div>
                            )}

                            {activeBoardCardAction.kind === 'market' && (
                                <div className={`grid gap-3 ${isForcedActiveBoardCard ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                    <button
                                        onClick={() => {
                                            if (isApplyingBoardMarket) return;
                                            setTransactionQuickPreset({ initialTab: 'broker' });
                                            setShowTransactionModal(true);
                                            markBoardCardHandled();
                                        }}
                                        disabled={isActiveBoardCardHandled || isApplyingBoardMarket || !appliedBoardMarketKeys.includes(activeBoardCardKey || '')}
                                        className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isApplyingBoardMarket ? '同步行情中...' : '前往交易'}
                                    </button>
                                    {!isForcedActiveBoardCard && (
                                        <button
                                            onClick={() => { void markBoardCardHandled(); }}
                                            disabled={isActiveBoardCardHandled}
                                            className="rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            關閉
                                        </button>
                                    )}
                                </div>
                            )}

                            {activeBoardCardAction.kind === 'choice' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        {activeBoardCardAction.options.map(option => {
                                            return (
                                                <button
                                                    key={option.id}
                                                    onClick={() => {
                                                        if (requiresOpportunityShareApproval && option.id === 'accept') {
                                                            submitBoardShareApprovalRequest();
                                                            return;
                                                        }
                                                        if (option.action.kind === 'dismiss') {
                                                            if (
                                                                familyJoinPrompt?.sourcePlayerUid === user?.uid &&
                                                                familyJoinPrompt.sourceCardId === activeBoardCard?.cardId
                                                            ) {
                                                                void handleFamilySourceDecline(familyJoinPrompt.id);
                                                            } else {
                                                                void (async () => {
                                                                    await markBoardCardHandled(activeBoardCardKey, activeBoardCard, true);
                                                                })();
                                                            }
                                                            return;
                                                        }
                                                        if (option.action.kind === 'happiness') {
                                                            setIsBoardCardDrawerOpen(false);
                                                            const applied = handleTransactionSubmit(option.action.txData);
                                                            if (!applied) {
                                                                setIsBoardCardDrawerOpen(true);
                                                                return;
                                                            }
                                                            showAlert(`已套用 ${option.action.points} 點幸福`, 'success');
                                                            void markBoardCardHandled();
                                                            return;
                                                        }
                                                        if (option.action.kind === 'effect') {
                                                            setIsBoardCardDrawerOpen(false);
                                                            void handleApplyBoardInstantEffect(option.action.title, option.action.afterApply);
                                                            return;
                                                        }
                                                        setIsBoardCardDrawerOpen(false);
                                                        setBoardFinancialAction(withBoardFlow(
                                                            option.action,
                                                            option.action.txData.boardFlow || 'board-card'
                                                        ));
                                                        setIsBoardFinancialCompleted(false);
                                                    }}
                                                    disabled={isActiveBoardCardHandled || isSubmittingFamilySource}
                                                    className={`rounded-2xl py-3.5 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                                        option.id === 'reject'
                                                            ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                                    }`}
                                                >
                                                    {(requiresOpportunityShareApproval && option.id === 'accept')
                                                        ? (boardShareRequest?.status === 'pending' ? '等待主持人確認' : '送出分享確認')
                                                        : option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {!boardChoiceHasDismissOption && (
                                        <button
                                            onClick={handleCloseBoardCardDrawer}
                                            disabled={isActiveBoardCardHandled}
                                            className="w-full rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            關閉
                                        </button>
                                    )}
                                </div>
                            )}

                            {activeBoardCardAction.kind === 'investment' && (
                                <div className="space-y-3">
                                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-4 text-sm leading-relaxed text-slate-300">
                                        {activeBoardCardAction.note}
                                    </div>
                                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                                        <div className="flex items-center justify-between text-xs font-black tracking-[0.16em] text-slate-500">
                                            <span>投資金額</span>
                                            <span>每次增減 {formatMoney(activeBoardCardAction.step)}</span>
                                        </div>
                                        <div className="mt-3 flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setBoardInvestmentAmount(current => Math.max(activeBoardCardAction.minAmount, current - activeBoardCardAction.step))}
                                                className="h-11 w-11 rounded-2xl bg-slate-800 text-xl font-black text-slate-200 transition-colors hover:bg-slate-700"
                                            >
                                                -
                                            </button>
                                            <input
                                                type="number"
                                                min={activeBoardCardAction.minAmount}
                                                max={activeBoardCardAction.maxAmount}
                                                step={activeBoardCardAction.step}
                                                value={boardInvestmentAmount || ''}
                                                onChange={(event) => setBoardInvestmentAmount(parseInt(event.target.value, 10) || 0)}
                                                className="h-11 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-3 text-center text-lg font-black text-white"
                                                placeholder={activeBoardCardAction.minAmount.toString()}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setBoardInvestmentAmount(current => Math.min(activeBoardCardAction.maxAmount, current + activeBoardCardAction.step))}
                                                className="h-11 w-11 rounded-2xl bg-slate-800 text-xl font-black text-slate-200 transition-colors hover:bg-slate-700"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-400">
                                            <span>可用現金 {formatMoney(gameState.cash)}</span>
                                            <span>上限 {formatMoney(activeBoardCardAction.maxAmount)}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => { void markBoardCardHandled(); }}
                                            disabled={isActiveBoardCardHandled}
                                            className="rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            關閉
                                        </button>
                                        <button
                                            onClick={handleBoardInvestmentConfirm}
                                            disabled={
                                                isActiveBoardCardHandled ||
                                                boardInvestmentAmount < activeBoardCardAction.minAmount ||
                                                boardInvestmentAmount > activeBoardCardAction.maxAmount ||
                                                boardInvestmentAmount % activeBoardCardAction.step !== 0
                                            }
                                            className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {activeBoardCardAction.label}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeBoardCardAction.kind === 'unsupported' && (
                                <div className="space-y-3">
                                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-4 text-sm leading-relaxed text-slate-300">
                                        {activeBoardCardAction.note}
                                    </div>
                                    <button
                                        onClick={() => { void markBoardCardHandled(); }}
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
                                            onClick={() => { void markBoardCardHandled(); }}
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
                        )
                    ) : null}
                />
            )}

            {showRepairConfirmationModal && visibleFlowModal === 'repair' && (
                <PlayerModalFrame
                    eyebrow="維修廠事件"
                    title="確認汽車保養費"
                    description="你已經過維修廠，請先確認本次保養費，再進入財務檢核。"
                    accent="medical"
                    closeDisabled
                    footer={(
                        <button
                            type="button"
                            onClick={handleRepairConfirmation}
                            className="min-h-11 w-full rounded-xl bg-[#b6544b] px-4 py-2.5 text-base font-black text-white transition hover:bg-[#943f38]"
                        >
                            確認並進入財務檢核
                        </button>
                    )}
                >
                    <div className="space-y-3">
                        <div className="rounded-2xl border border-[#e7c1b6] bg-[#fbe9e3] px-4 py-4 text-center">
                            <div className="text-sm font-black text-[#875047]">保養費骰點</div>
                            <div className="mt-1 text-3xl font-black text-[#b6544b]">{boardState?.currentEvent?.repairRoll || 0} 點</div>
                        </div>
                        <div className="rounded-2xl border border-[#ead7b8] bg-[#fffaf2] px-4 py-4 text-center">
                            <div className="text-sm font-black text-[#765f47]">本次應付保養費</div>
                            <div className="mt-1 text-3xl font-black text-[#293a38]">{formatMoney(boardState?.currentEvent?.repairFee || 0)}</div>
                            <div className="mt-2 text-xs font-bold text-[#7a6958]">維修廠規則：骰點 × 2,000；抵達維修廠另暫停一回合。</div>
                        </div>
                    </div>
                </PlayerModalFrame>
            )}

            {boardFinancialAction && visibleFlowModal === 'financial' && (
                <BoardFinancialCheckModal
                    title={boardFinancialAction.txData.name}
                    txData={boardFinancialAction.txData}
                    expectedEntries={boardFinancialAction.expectedEntries}
                    onApply={handleApplyBoardFinancialTx}
                    isCompleted={isBoardFinancialCompleted}
                    onClose={() => {
                        if (isBoardFinancialCompleted) {
                            void finalizeBoardFinancialFlow();
                            return;
                        }
                        setPendingHandledBoardCard(null);
                        setPendingBoardLifelongRoll(null);
                        setPendingCashEventRoll(null);
                        if (pendingSharedCardCompletion) setPendingSharedCardCompletion(null);
                        const returningFromMarket = !!pendingMarketPurchase;
                        setPendingMarketPurchase(null);
                        setBoardFinancialAction(null);
                        if (returningFromMarket) {
                            setShowRealEstateMarketModal(true);
                        } else if (activeBoardCardKey && !isActiveBoardCardHandled) {
                            setIsBoardCardDrawerOpen(true);
                            setIsBoardCardRevealed(true);
                        }
                    }}
                />
            )}

            {/* Modals */}
            {showRealEstateMarketModal && (
                <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 sm:p-6 bg-[#102f38]/78 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-[32px] border border-[#d8c29a] bg-[#fffaf2] text-[#293a38] shadow-[0_28px_80px_-32px_rgba(16,47,56,0.85)]">
                        <div className="flex items-center justify-between shrink-0 border-b border-[#ead7b8] p-4 sm:p-5">
                            <h2 className="text-2xl font-black text-[#293a38]">房市公告板</h2>
                            <button
                                onClick={() => setShowRealEstateMarketModal(false)}
                                className="rounded-xl px-3 py-2 text-sm font-black text-[#76573a] transition-colors hover:bg-[#f4e6d0] hover:text-[#293a38]"
                            >
                                關閉
                            </button>
                        </div>

                        <div className="flex shrink-0 items-center justify-between border-b border-[#ead7b8] bg-[#f4e6d0] px-4 py-3 sm:px-6">
                            <span className="text-sm font-black tracking-wider text-[#76573a]">持有現金</span>
                            <span className="text-xl font-black text-[#168269]">{formatMoney(gameState.cash)}</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-4 p-4 sm:p-6">
                            {(!boardState?.realEstateMarket || boardState.realEstateMarket.length === 0) ? (
                                <div className="text-center py-10 text-[#7a6958] font-medium">
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
                                        <div key={cardId} className="bg-[#f8eee0] rounded-2xl p-5 border border-[#ead6b9] flex flex-col gap-4">
                                            <div className="flex justify-between items-start border-b border-[#ead6b9] pb-3">
                                                <div>
                                                    <div className="text-lg font-bold text-[#293a38]">{title}</div>
                                                    <div className="text-sm text-[#765f47] mt-1">{newsCard.title}</div>
                                                </div>
                                                <div className="text-[#168269] font-black text-xl">{formatMoney(price)}</div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                                                <div className="flex flex-col">
                                                    <span className="text-[#7a6958]">頭期款 (自備現金)</span>
                                                    <span className="text-[#293a38] font-bold">{formatMoney(newsCard.downPayment)}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[#7a6958]">銀行貸款</span>
                                                    <span className="text-rose-400 font-bold">{formatMoney(newsCard.loanAmount)}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[#7a6958]">每月貸款利息</span>
                                                    <span className="text-rose-400 font-bold">{formatMoney(newsCard.monthlyPayment)}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[#7a6958]">每月租金收入</span>
                                                    <span className="text-emerald-400 font-bold">{formatMoney(newsCard.rent)}</span>
                                                </div>
                                                {newsCard.happinessBonus > 0 && (
                                                    <div className="col-span-2 flex items-center gap-2 bg-fuchsia-500/10 text-fuchsia-400 px-3 py-2 rounded-lg">
                                                        <span className="font-bold">自用額外獎勵：</span>
                                                        <span>幸福點數 +{newsCard.happinessBonus}</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex gap-3 mt-2 pt-3 border-t border-[#ead6b9]">
                                                {selfUseOpt && (
                                                    <button
                                                        onClick={() => handleBuyRealEstateFromMarket(cardId, true)}
                                                        disabled={marketPurchaseCardId === cardId}
                                                        className="flex-1 py-3 bg-[#36798a] hover:bg-[#2e6570] text-white rounded-xl text-sm font-black transition-all active:scale-95 disabled:cursor-wait disabled:opacity-60"
                                                    >
                                                        自用購買
                                                    </button>
                                                )}
                                                {rentalOpt && (
                                                    <button
                                                        onClick={() => handleBuyRealEstateFromMarket(cardId, false)}
                                                        disabled={marketPurchaseCardId === cardId}
                                                        className="flex-1 py-3 bg-[#168269] hover:bg-[#106b58] text-white rounded-xl text-sm font-black transition-all active:scale-95 disabled:cursor-wait disabled:opacity-60"
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

            {showTransactionModal && visibleFlowModal === 'transaction' && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <TransactionForm
                        profession={gameState.profession}
                        selectedEnterprise={gameState.selectedEnterprise}
                        selectedDream={gameState.selectedDream}
                        cash={gameState.cash}
                        salary={gameState.profession?.salary || 0}
                        legacyLoans={gameState.loans}
                        assets={gameState.assets}
                        happiness={gameState.happiness}
                        currentRankLevel={gameState.currentRankLevel}
                        medicalInsuranceCount={gameState.medicalInsuranceCount}
                        marketPrices={gameState.marketPrices}
                        previousMarketPrices={gameState.previousMarketPrices}
                        liabilities={gameState.liabilities}
                        happinessSubMode={happinessSubMode}
                        setHappinessSubMode={setHappinessSubMode}
                        onTransaction={handleTransaction}
                        onCancel={() => {
                            setShowTransactionModal(false);
                            setTransactionQuickPreset(null);
                            if (pendingForcedBoardPayment) {
                                if (forcedBoardPaymentShortfall > 0) {
                                    setShowForcedBoardPaymentModal(true);
                                } else {
                                    showAlert('周轉完成，請回到財務檢核套用卡片', 'success');
                                }
                                return;
                            }
                            if (shouldResumeBankFollowup) {
                                setPaydayStep('followup');
                                setShowPaydayModal(true);
                            }
                        }}
                        disabled={room?.status === 'finished'}
                        initialTab={transactionQuickPreset?.initialTab}
                        initialMode={transactionQuickPreset?.mode}
                        initialAssetType={transactionQuickPreset?.assetType}
                        canUseBankProducts={canUseBankProducts}
                        onShowAlert={showAlert}
                />
            </div>
            )}

            {showForcedBoardPaymentModal && pendingForcedBoardPayment && (
                <PlayerModalFrame
                    eyebrow="現金不足"
                    title="需要先周轉資金"
                    description={`這張卡必須強制支付，目前還差 ${formatMoney(forcedBoardPaymentShortfall)}。`}
                    accent="opportunity"
                    onClose={() => setShowForcedBoardPaymentModal(false)}
                    footer={(
                        <div className="grid gap-3 sm:grid-cols-2">
                            <button
                                onClick={handleForcedBoardSellAssets}
                                className="min-h-12 rounded-2xl bg-[#168269] px-4 py-3 text-sm font-black text-white transition hover:bg-[#116c58]"
                            >
                                先賣股票 / 資產周轉
                            </button>
                            <button
                                onClick={handleForcedBoardBorrow}
                                className="min-h-12 rounded-2xl bg-[#2e6570] px-4 py-3 text-sm font-black text-white transition hover:bg-[#254f57]"
                            >
                                借信用貸款補差額
                            </button>
                            <button
                                onClick={handleForcedBoardForceDebt}
                                className="min-h-12 rounded-2xl bg-[#b54155] px-4 py-3 text-sm font-black text-white transition hover:bg-[#9f3549]"
                            >
                                強制結束並計入負債
                            </button>
                            <button
                                onClick={() => setShowForcedBoardPaymentModal(false)}
                                className="min-h-12 rounded-2xl border border-[#d8c29a] bg-[#fffaf2] px-4 py-3 text-sm font-black text-[#765f47] transition hover:bg-[#f3e4cc]"
                            >
                                稍後再處理
                            </button>
                        </div>
                    )}
                >
                    <div className="rounded-2xl border border-[#e4c78f] bg-[#fff2d8] p-4 text-sm font-bold leading-relaxed text-[#76573a]">
                        你可以先賣股票或資產、直接借信用貸款，或強制把差額記入負債並結束這次事件。
                    </div>
                </PlayerModalFrame>
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

            {showPaydayModal && visibleFlowModal === 'payday' && (
                <PaydayModal
                    isOpen={showPaydayModal}
                    step={paydayStep}
                    monthlyCashflow={summary.monthlyCashflow}
                    formatMoney={formatMoney}
                    onOpenInsurance={() => openQuickTransaction('保險')}
                    onOpenDeposit={() => openQuickTransaction('定存')}
                    onSkipFollowup={() => {
                        setShouldResumeBankFollowup(false);
                        setShowPaydayModal(false);
                        setPaydayStep('confirm');
                        void advanceBoardEventQueue('bank');
                    }}
                    onClose={() => {
                        if (paydayStep === 'confirm') {
                            handlePaydayConfirm();
                            if (startupUpgradeAsset && pendingStartupUpgradeAction) {
                                setShowPaydayModal(false);
                                setPaydayStep('confirm');
                                setShowBizUpgradeModal(true);
                                return;
                            }
                            if (canUseBankProducts) {
                                setPaydayStep('followup');
                                return;
                            }
                        }
                        setShouldResumeBankFollowup(false);
                        setShowPaydayModal(false);
                        setPaydayStep('confirm');
                        void advanceBoardEventQueue('bank');
                    }}
                    disabled={room?.status === 'finished'}
                />
            )}

            {showHospitalRollModal && visibleFlowModal === 'hospital' && (
                <PlayerModalFrame
                    eyebrow="醫院事件"
                    title="確認醫藥費"
                    description="棋子到達醫院後，要再擲一次骰子，醫藥費 = 點數 x 1,000。"
                    accent="medical"
                    footer={(
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => {
                                    if (hospitalRollValue) return;
                                    setHospitalRollValue(Math.floor(Math.random() * 6) + 1);
                                }}
                                disabled={!!hospitalRollValue}
                                className="min-h-12 rounded-2xl bg-[#2e6570] px-3 py-3 text-sm font-black text-white transition hover:bg-[#254f57] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                {hospitalRollValue ? '已完成擲骰' : '擲第二次骰子'}
                            </button>
                            <button
                                onClick={handleHospitalRollConfirm}
                                disabled={!hospitalRollValue}
                                className="min-h-12 rounded-2xl bg-[#168269] px-3 py-3 text-sm font-black text-white transition hover:bg-[#116c58] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                進入財務流程
                            </button>
                        </div>
                    )}
                >
                    <div className="rounded-3xl border border-[#d8c29a] bg-[#f8eee0] px-5 py-6 text-center">
                        <div className="text-[11px] font-black tracking-[0.24em] text-[#7a6958]">第二次骰點</div>
                        <div className="mt-3 text-5xl font-black text-[#293a38]">{hospitalRollValue ?? '？'}</div>
                        <div className="mt-3 text-sm font-bold text-[#765f47]">
                            {hospitalRollValue ? `醫藥費 ${formatMoney(hospitalRollValue * 1000)}` : '先擲骰確認點數'}
                        </div>
                    </div>
                </PlayerModalFrame>
            )}

            {showMedicalClaimModal && (
                <MedicalClaimModal
                    isOpen={showMedicalClaimModal}
                    claims={gameState.pendingMedicalClaims || []}
                    formatMoney={formatMoney}
                    onConfirm={handleMedicalClaimConfirm}
                    onClose={() => setShowMedicalClaimModal(false)}
                    disabled={room?.status === 'finished' || !!boardFinancialAction}
                />
            )}

            {showPromotionModal && visibleFlowModal === 'promotion' && (
                <PromotionModal
                    isOpen={showPromotionModal}
                    onConfirm={onPromotionRegister}
                    onClose={() => {
                        setShowPromotionModal(false);
                        setLastSchoolPromptKey(null);
                    }}
                    onBack={() => {
                        setShowPromotionModal(false);
                        setLastSchoolPromptKey(null);
                        setShowRankListModal(true);
                    }}
                    currentRankLevel={gameState.currentRankLevel}
                    disabled={room?.status === 'finished'}
                />
            )}

            {showDiceModal && visibleFlowModal === 'dice' && (
                <DiceRollContainer
                    isOpen={showDiceModal}
                    onClose={handleDiceModalClose}
                    onResult={onDiceComplete}
                    promotionType={promotionType}
                />
            )}

            {showBizUpgradeModal && startupUpgradeAsset && (
                <BizUpgradeModal
                    isOpen={showBizUpgradeModal}
                    asset={startupUpgradeAsset}
                    onClose={() => {
                        // 依 CARD_DECISION.md DEC-005：擲骰未達標（或尚未擲骰）時必須保留
                        // pendingStartupUpgradeAction，玩家下次經過銀行才能再次嘗試升級，
                        // 不得在此清除待升級狀態。
                        setShowBizUpgradeModal(false);
                        void advanceBoardEventQueue('bank');
                    }}
                    onUpgrade={async (diceRoll) => {
                        const result = await completeStartupUpgradeAction({
                            assetId: startupUpgradeAsset.id,
                            cardId: pendingStartupUpgradeAction?.cardId || '',
                            diceRoll
                        });
                        if (result.status === 'failed') {
                            showAlert(result.message || '企業升級同步失敗，請再試一次', 'error');
                            return false;
                        }
                        setShowBizUpgradeModal(false);
                        await advanceBoardEventQueue('bank');
                        return true;
                    }}
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
                    happiness={gameState.happiness}
                    onTransaction={handleTransaction}
                    onClose={() => setShowTargetDreamModal(false)}
                />
            )}

            <TutorialModal
                isOpen={showTutorial}
                onClose={handleCloseTutorial}
                showSkip={true}
                mode={room?.isBoardGame ? 'board' : 'general'}
            />

        </div>
    );
};

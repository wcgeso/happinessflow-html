import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    deleteField
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from './AuthContext';
import { BoardCardResult, BoardDeckState, BoardEventLog, BoardState, GameState } from '../types';
import { cleanObject, safeAsync } from '../utils/utils';
import { BOARD_SQUARES, createInitialDeckState, getSquareByIndex } from '../constants/board';
import { HAPPINESS_CARDS, NEWS_CARDS, OPPORTUNITY_CARDS } from '../constants/cards';
import { getFamilyMilestoneStageByCardId, getFamilyMilestoneStatus } from '../utils/familyMilestones';

interface RoomMember {
    uid: string;
    name: string;
    photoURL?: string;
    email?: string;
    title?: string;
    experience?: number;
    role: 'coach' | 'player' | 'gm';
    joinedAt: any;
    isLeft?: boolean;
    photoPosition?: string;
    photoScale?: string;
}

export interface PendingRequest {
    id: string;
    uid: string;
    playerName: string;
    type: 'payday' | 'insurance' | 'happiness' | 'promotion' | 'lifelong';
    amount: number;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
    insuranceType?: 'medical' | 'aircraft';
    happinessLabel?: string;
    promotionType?: string;
}

export interface Room {
    id: string; // 房間碼 (6位數)
    name?: string; // 房間標題
    hostId: string;
    status: 'waiting' | 'playing' | 'finished';
    members: RoomMember[];
    createdAt: any;
    maxPlayers: number;
    duration?: number; // 遊戲時長 (分鐘)
    gameTimeLeft?: number; // 剩餘秒數
    isTimerPaused?: boolean; // 計時器是否暫停
    playerStates?: Record<string, GameState>; // 直接存放在房間文件內，確保執行師有權限讀取
    startedAt?: number; // 遊戲開始時間戳
    sessionId?: string; // 穩定的遊戲場次 ID
    isBoardGame?: boolean; // 棋盤遊戲模式
    isPractice?: boolean; // 練習模式（不計分）
    marketPrices?: Record<string, number>; // 股市價格
    previousMarketPrices?: Record<string, number>; // 前一次股市價格
    marketUpdates?: {
        updates: Record<string, number>;
        code: string;
        isBubble: boolean;
        timestamp: number;
    };
    pendingRequests?: Record<string, PendingRequest>;
    boardState?: BoardState | null;
}

const buildHappinessCardMeta = (cardId: string, playerState?: GameState | null) => {
    const card = HAPPINESS_CARDS.find(item => item.id === cardId);
    if (!card) return null;

    const isFamilyMilestone = card.category === '家庭重要歷程';
    const stage = getFamilyMilestoneStageByCardId(card.id);
    const familyMilestoneStatus = playerState ? getFamilyMilestoneStatus(playerState) : null;

    return {
        deck: 'happiness' as const,
        title: isFamilyMilestone && stage ? stage.label.replace(/^\d+\.\s*/, '') : card.title,
        subtitle: card.category,
        description: card.description || `${card.category}事件`,
        effectLines: [
            ...(isFamilyMilestone && familyMilestoneStatus ? [
                ...familyMilestoneStatus.stageLines,
                `目前進度：第 ${familyMilestoneStatus.currentStage} 階段`
            ] : []),
            `幸福 +${card.happinessPoints}`,
            ...(card.cashCost ? [`一次性支出 ${card.cashCost.toLocaleString()}`] : []),
            ...(card.monthlyExpenseIncrease ? [`月支出 ${card.monthlyExpenseIncrease > 0 ? '+' : ''}${card.monthlyExpenseIncrease.toLocaleString()}`] : []),
            ...(card.childrenIncrease ? [`孩子數 +${card.childrenIncrease}`] : []),
            ...(card.otherPlayersCanJoin ? [`其他玩家可擲骰加入（至少 ${card.joinDiceMin || 0} 點）`] : []),
            ...(card.requiresStorySharing ? ['需要玩家分享故事'] : [])
        ]
    };
};

const buildOpportunityCardMeta = (cardId: string) => {
    const card = OPPORTUNITY_CARDS.find(item => item.id === cardId);
    if (!card) return null;

    return {
        deck: 'opportunity' as const,
        title: card.title,
        subtitle: card.category || '機運卡',
        description: card.description,
        effectLines: [
            ...(card.schoolFee ? [`學費 ${card.schoolFee.toLocaleString()}`] : []),
            ...(card.diceRequirement ? [`判定需求：至少 ${card.diceRequirement} 點`] : []),
            ...(card.purchasePrice ? [`價格 ${card.purchasePrice.toLocaleString()}`] : []),
            ...(card.purchasePercent ? [`成交比例 ${card.purchasePercent}%`] : []),
            ...(card.acquisitionMultiple ? [`收購倍率 ${card.acquisitionMultiple} 倍月收益`] : []),
            ...(card.cashLoss ? [`現金 -${card.cashLoss.toLocaleString()}`] : []),
            ...(card.cashGain ? [`現金 +${card.cashGain.toLocaleString()}`] : []),
            ...(card.monthlyExpenseChange ? [`月支出 ${card.monthlyExpenseChange > 0 ? '+' : ''}${card.monthlyExpenseChange.toLocaleString()}`] : []),
            ...(card.happinessLoss ? [`幸福 -${card.happinessLoss}`] : []),
            ...(card.missRounds ? [`暫停 ${card.missRounds} 回合`] : []),
            ...(card.drawCard ? [`再抽一張${card.drawCard === 'happiness' ? '幸福' : '新聞'}卡`] : []),
            ...(card.affectsAllPlayers ? ['影響全部玩家'] : []),
            ...(card.requiresStorySharing ? ['需要完成口頭分享'] : [])
        ]
    };
};

const buildNewsCardMeta = (cardId: string) => {
    const card = NEWS_CARDS.find(item => item.id === cardId);
    if (!card) return null;

    if (card.type === 'real_estate') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: card.subtype,
            description: card.description || '請依房市卡內容選擇自用或出租購買。',
            effectLines: [
                `總價：${card.totalPrice.toLocaleString()}`,
                `頭期款：${card.downPayment.toLocaleString()}`,
                `貸款：${card.loanAmount.toLocaleString()}`,
                `貸款利息（月）：${card.monthlyPayment.toLocaleString()}`,
                `租金收入（月）：${card.rent.toLocaleString()}`,
                `淨收益（月）：${card.netRentIncome > 0 ? '+' : ''}${card.netRentIncome.toLocaleString()}`,
                ...(card.canSelfUse ? [`自用幸福：+${card.happinessBonus}`] : [])
            ]
        };
    }

    if (card.type === 'small_business') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: card.subtype,
            description: card.description || '兼職工作室貸款專案。所有玩家皆可申請。',
            effectLines: [
                `投資金額：${card.investmentPerMonth.toLocaleString()}`,
                `貸款金額：${card.loanAmount.toLocaleString()}`,
                `企業貸款利息（月）：-${card.interestPerMonth.toLocaleString()}`
            ]
        };
    }

    if (card.type === 'large_enterprise') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: card.subtype,
            description: card.description || '大型企業投資機會。所有玩家皆可投資。',
            effectLines: [
                `最高投資額度：${card.maxInvestment.toLocaleString()}`,
                `投資報酬率：每投資 1,000,000，月收益 +${card.monthlyReturnPerMillion.toLocaleString()}`
            ]
        };
    }

    if (card.type === 'cash_dividend') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: card.subtype,
            description: card.description || '系統將自動根據您持有的股票發放現金股利。',
            effectLines: Object.entries(card.dividendPerShare).map(([code, dps]) =>
                `${code}：每張配發 ${(dps * 100).toLocaleString()}`
            )
        };
    }

    if (card.type === 'stock_dividend') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: card.subtype,
            description: card.description || '系統將自動根據您持有的股票發放股票股息。',
            effectLines: Object.entries(card.dividendRate).map(([code, rate]) =>
                `${code}：配股率 ${(rate * 100).toLocaleString()}%`
            )
        };
    }

    return {
        deck: 'news' as const,
        title: card.title,
        subtitle: card.subtype,
        description: card.description || '請依新聞卡內容進行財務與市場調整。',
        effectLines: [
            ...(card.type === 'stock_price'
                ? Object.entries(card.prices).map(([code, price]) => `${code}：${price.toLocaleString()}`)
                : [])
        ]
    };
};

const toUsedKey = (deck: keyof Pick<BoardDeckState, 'happiness' | 'opportunity' | 'news'>) => {
    if (deck === 'happiness') return 'usedHappiness';
    if (deck === 'opportunity') return 'usedOpportunity';
    return 'usedNews';
};

const drawBoardCard = (
    deckState: BoardDeckState,
    deck: keyof Pick<BoardDeckState, 'happiness' | 'opportunity' | 'news'>,
    playerState?: GameState | null
) => {
    let activeDeck = [...deckState[deck]];
    let usedDeck = [...deckState[toUsedKey(deck)]];

    if (activeDeck.length === 0) {
        activeDeck = [...usedDeck].sort(() => Math.random() - 0.5);
        usedDeck = [];
    }

    const cardId = activeDeck.shift();
    if (!cardId) return null;

    const meta = deck === 'happiness'
        ? buildHappinessCardMeta(cardId, playerState)
        : deck === 'opportunity'
            ? buildOpportunityCardMeta(cardId)
            : buildNewsCardMeta(cardId);
    if (!meta) return null;

    usedDeck.push(cardId);

    return {
        card: {
            deck: meta.deck,
            cardId,
            title: meta.title,
            description: meta.description,
            subtitle: meta.subtitle,
            effectLines: meta.effectLines
        } as BoardCardResult,
        deckState: {
            ...deckState,
            [deck]: activeDeck,
            [toUsedKey(deck)]: usedDeck
        } as BoardDeckState
    };
};

const hasCarAsset = (state?: GameState | null) => {
    return !!state?.assets?.some(asset => asset.type === '汽車' || asset.type === '飛行器');
};

const BOARD_MOVE_INTRO_DELAY_MS = 600;
const BOARD_MOVE_STEP_DURATION_MS = 380;
const BOARD_MOVE_LANDING_DELAY_MS = 600;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createInitialBoardState = (members: RoomMember[], playerStates?: Record<string, GameState>): BoardState => {
    const playerMembers = members.filter(member => member.role !== 'coach');
    const turnOrder = playerMembers.map(member => member.uid);
    const positions = Object.fromEntries(turnOrder.map(uid => [uid, 0]));
    const skipTurns = Object.fromEntries(turnOrder.map(uid => [uid, playerStates?.[uid]?.skipTurns || 0]));

    return {
        currentTurnUid: turnOrder[0] || null,
        turnOrder,
        playerPositions: positions,
        skipTurns,
        lastRoll: null,
        currentCard: null,
        currentCardReveal: null,
        currentEvent: null,
        movement: null,
        deckState: createInitialDeckState(),
        realEstateMarket: [],
        updatedAt: Date.now()
    };
};

const getNextTurnUid = (boardState: BoardState) => {
    if (!boardState.turnOrder.length) return null;
    if (!boardState.currentTurnUid) return boardState.turnOrder[0];

    let index = boardState.turnOrder.indexOf(boardState.currentTurnUid);
    const skipTurns = { ...boardState.skipTurns };

    for (let offset = 1; offset <= boardState.turnOrder.length; offset += 1) {
        const nextUid = boardState.turnOrder[(index + offset) % boardState.turnOrder.length];
        const remainingSkips = skipTurns[nextUid] || 0;
        if (remainingSkips > 0) {
            skipTurns[nextUid] = remainingSkips - 1;
            index = boardState.turnOrder.indexOf(nextUid);
            continue;
        }
        return { nextUid, skipTurns };
    }

    return { nextUid: boardState.currentTurnUid, skipTurns };
};

interface RoomContextValue {
    room: Room | null;
    isLoadingRoom: boolean;
    error: string | null;
    playerStates: Record<string, GameState>;
    createRoom: (settings?: { name: string; maxPlayers: number; duration: number; isPractice?: boolean; isBoardGame?: boolean }) => Promise<string>;
    joinRoom: (roomCode: string) => Promise<void>;
    leaveRoom: () => Promise<void>;
    startRoomGame: () => Promise<void>;
    finishRoomGame: () => Promise<void>;
    closeRoom: () => Promise<void>;
    updateMarket: (updates: Record<string, number>, code: string, isBubble?: boolean) => Promise<void>;
    updateRoomTimer: (timeLeft: number, isPaused: boolean) => Promise<void>;
    submitRequest: (request: Omit<PendingRequest, 'id' | 'status' | 'timestamp'>) => Promise<void>;
    approveRequest: (requestId: string) => Promise<void>;
    rejectRequest: (requestId: string) => Promise<void>;
    clearRequest: (requestId: string) => Promise<void>;
    rollBoardDice: () => Promise<{ position: number; detail: string; skipTurns: number; total: number }>;
    revealBoardCard: (eventId: string, cardId: string) => Promise<void>;
    applyBoardMarketPrices: (updates: Record<string, number>, code: string, isBubble?: boolean) => Promise<void>;
    abandonRealEstateCard: (cardId: string) => Promise<void>;
    buyRealEstateFromMarket: (cardId: string) => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [room, setRoom] = useState<Room | null>(null);
    const [isLoadingRoom, setIsLoadingRoom] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playerStates, setPlayerStates] = useState<Record<string, GameState>>({});

    // 監聽房間狀態
    useEffect(() => {
        if (!user) return;

        // 優先從目前 room 狀態拿 ID，若無則從 localStorage 拿
        const targetRoomId = room?.id || localStorage.getItem(`active_room_${user.uid}`);

        if (!targetRoomId) {
            // 如果連 localStorage 都沒 ID，確保 room 狀態也是 null
            if (room) setRoom(null);
            return;
        }

        console.log('開始監聽房間:', targetRoomId);
        const unsubscribe = onSnapshot(doc(db, 'rooms', targetRoomId), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as Room;
                console.log('房間數據更新:', data.id, '狀態:', data.status, '成員數:', data.members?.length);

                // 檢查自己是否還在成員名單中
                const isHost = data.hostId === user.uid;
                const stillMember = data.members?.some(m => m.uid === user.uid);

                if (!stillMember && !isHost) {
                    console.log('檢測到用戶已不在成員名單中，自動清除狀態');
                    setRoom(null);
                    localStorage.removeItem(`active_room_${user.uid}`);
                    return;
                }

                if (data.pendingRequests) {
                    console.log('偵測到待審核請求:', Object.keys(data.pendingRequests).length, '筆');
                }
                setRoom(data);

                // 更新 playerStates (不論是否為房主，只要 data 內有就更新)
                if (data.playerStates) {
                    setPlayerStates(data.playerStates);
                }

                // 儲存目前房間 ID 到 localStorage
                localStorage.setItem(`active_room_${user.uid}`, data.id);
            } else {
                console.log('房間不存在或已被關閉');
                setRoom(null);
                localStorage.removeItem(`active_room_${user.uid}`);
            }
        }, (err) => {
            console.error('監聽房間失敗:', err);
            if (err.code === 'permission-denied') {
                setError('權限不足，請檢查 Firebase Firestore Rules 設定');
            }
            if (err.code === 'not-found') {
                localStorage.removeItem(`active_room_${user.uid}`);
            }
        });

        return () => {
            console.log('停止監聽房間:', targetRoomId);
            unsubscribe();
        };
    }, [user?.uid, room?.id]); // 監聽 room.id 變化，確保切換房間時能重新綁定監聽器

    // 移除舊的獨立監聽器，改為統一由房間狀態驅動

    // 生成 6 位數房間碼
    const generateRoomCode = useCallback(async (): Promise<string> => {
        let code = '';
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
            attempts++;
            code = Math.floor(100000 + Math.random() * 900000).toString();
            const roomDoc = await safeAsync(getDoc(doc(db, 'rooms', code)));
            if (!roomDoc || !roomDoc.exists()) {
                isUnique = true;
            }
        }

        if (!isUnique) {
            throw new Error('無法生成唯一的房間碼，請稍後再試');
        }

        return code;
    }, []);

    const createRoom = useCallback(async (settings?: { name: string; maxPlayers: number; duration: number; isPractice?: boolean; isBoardGame?: boolean }) => {
        if (!user) throw new Error('請先登入');
        if (user.role !== 'coach') throw new Error('只有執行師可以開房');

        setIsLoadingRoom(true);
        setError(null);
        try {
            const roomCode = await generateRoomCode();
            const newRoom: Room = {
                id: roomCode,
                name: settings?.name || '',
                hostId: user.uid,
                status: 'waiting',
                members: [{
                    uid: user.uid,
                    name: user.name,
                    photoURL: user.photoURL || 'bee',
                    email: user.email || '',
                    title: user.title || '',
                    experience: user.experience || 0,
                    role: 'coach',
                    joinedAt: new Date(),
                    photoPosition: user.photoPosition,
                    photoScale: user.photoScale
                }],
                createdAt: serverTimestamp(),
                maxPlayers: settings?.maxPlayers || 6,
                duration: settings?.duration || 60,
                gameTimeLeft: (settings?.duration || 60) * 60,
                isTimerPaused: true,
                sessionId: `${roomCode}_${Date.now()}`,
                boardState: settings?.isBoardGame ? createInitialBoardState([{
                    uid: user.uid,
                    name: user.name,
                    photoURL: user.photoURL || 'bee',
                    email: user.email || '',
                    title: user.title || '',
                    experience: user.experience || 0,
                    role: 'coach',
                    joinedAt: new Date(),
                    photoPosition: user.photoPosition,
                    photoScale: user.photoScale
                }]) : null,
                ...(settings?.isBoardGame ? { isBoardGame: true } : {}),
                ...(settings?.isPractice ? { isPractice: true } : {})
            };
            const cleanedRoom = cleanObject(newRoom);
            await safeAsync(setDoc(doc(db, 'rooms', roomCode), cleanedRoom));
            setRoom(cleanedRoom);
            return roomCode;
        } catch (err: any) {
            console.error('建立房間失敗:', err);
            const errMsg = err.code === 'permission-denied'
                ? '權限不足，請檢查 Firebase Firestore Rules 設定'
                : (err.message || '建立房間時發生錯誤');
            setError(errMsg);
            throw new Error(errMsg);
        } finally {
            setIsLoadingRoom(false);
        }
    }, [user, generateRoomCode]);

    const joinRoom = async (roomCode: string) => {
        if (!user) throw new Error('請先登入');
        setIsLoadingRoom(true);
        setError(null);
        try {
            const roomRef = doc(db, 'rooms', roomCode);
            const roomDoc = await safeAsync(getDoc(roomRef));

            if (!roomDoc || !roomDoc.exists()) throw new Error('找不到此房間');

            const roomData = roomDoc.data() as Room;

            // 檢查是否已在房間內或已有存檔（支援斷線重連，不論房間狀態）
            const existingMember = roomData.members.find(m => m.uid === user.uid);
            const hasCloudState = roomData.playerStates && roomData.playerStates[user.uid];
            
            if (existingMember || hasCloudState) {
                // 如果已經在 members 裡面，直接進入
                if (existingMember) {
                    setRoom(roomData);
                    localStorage.setItem(`active_room_${user.uid}`, roomCode);
                    return;
                }
                
                // 如果不在 members 但有 playerStates，表示是中途離開又回來的玩家，允許重新加入
                console.log('偵測到雲端存檔，允許中途重新加入房間');
            } else if (roomData.status !== 'waiting') {
                throw new Error('遊戲已開始或已結束');
            }

            // 檢查人數限制 (排除教練)
            const playerMembers = roomData.members.filter(m => m.role === 'player');
            if (playerMembers.length >= roomData.maxPlayers) throw new Error('房間已滿');

            const newMember: RoomMember = {
                uid: user.uid,
                name: user.name,
                photoURL: user.photoURL || 'bee',
                email: user.email || '',
                title: user.title || '',
                experience: user.experience || 0,
                role: user.role,
                joinedAt: new Date(),
                photoPosition: user.photoPosition,
                photoScale: user.photoScale
            };

            const cleanedMember = cleanObject(newMember);

            // 使用同步更新確保本地狀態第一時間反映
            setRoom(prev => {
                if (!prev || prev.id !== roomCode) return prev;
                // 避免重複添加
                const exists = prev.members.some(m => m.uid === user.uid);
                if (exists) return prev;
                return {
                    ...prev,
                    members: [...prev.members, cleanedMember]
                };
            });

            await safeAsync(updateDoc(roomRef, {
                members: arrayUnion(cleanedMember)
            }));

            // 存入 localStorage 並手動更新 room ID 觸發監聽器
            localStorage.setItem(`active_room_${user.uid}`, roomCode);
            setRoom(prev => (prev?.id === roomCode ? prev : { id: roomCode, members: [], hostId: '', status: 'waiting', name: '' } as any));
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoadingRoom(false);
        }
    };

    const leaveRoom = async () => {
        if (!user || !room) return;
        const roomId = room.id;
        try {
            const roomRef = doc(db, 'rooms', roomId);
            const memberToRemove = room.members.find(m => m.uid === user.uid);

            // 先清除本地狀態，防止 UI 閃爍或重連
            setRoom(null);
            localStorage.removeItem(`active_room_${user.uid}`);

            if (memberToRemove) {
                await safeAsync(updateDoc(roomRef, {
                    members: arrayRemove(memberToRemove)
                }));
            }
        } catch (err: any) {
            console.error('離開房間失敗:', err);
        }
    };

    const startRoomGame = async () => {
        if (!room || user?.uid !== room.hostId) return;
        try {
            const nextBoardState = room.isBoardGame ? createInitialBoardState(room.members, room.playerStates) : null;
            await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
                status: 'playing',
                playerStates: {}, // 清空舊的玩家狀態
                pendingRequests: {}, // 初始化審核請求
                startedAt: Date.now(), // 新增開始時間戳，用來觸發玩家重設狀態
                sessionId: `${room.id}_${Date.now()}`, // 每場遊戲產生新的唯一 sessionId，避免覆蓋上一場紀錄
                boardState: nextBoardState
            }));
        } catch (err: any) {
            setError(err.message);
        }
    };

    const rollBoardDice = async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) {
            throw new Error('棋盤房間尚未準備完成');
        }

        const boardState = room.boardState;
        if (boardState.movement?.isActive) {
            throw new Error('目前角色仍在移動中');
        }
        if (boardState.currentTurnUid !== user.uid) {
            throw new Error('還沒輪到你');
        }

        const playerState = room.playerStates?.[user.uid];
        const diceCount = hasCarAsset(playerState) ? 2 : 1;
        const dice = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
        const total = dice.reduce((sum, value) => sum + value, 0);
        const startPosition = boardState.playerPositions[user.uid] || 0;
        const pathLength = BOARD_SQUARES.length;
        const path = Array.from({ length: total }, (_, step) => (startPosition + step + 1) % pathLength);
        let nextPosition = startPosition;
        const passedMessages: string[] = [];

        for (let step = 0; step < path.length; step += 1) {
            nextPosition = path[step];
            const square = getSquareByIndex(nextPosition);
            if (square.type === 'bank') {
                passedMessages.push(`經過${square.label}，請完成月結餘確認`);
            }
            if (square.type === 'school') {
                passedMessages.push(`經過${square.label}，可前往升等考試`);
            }
            if (square.type === 'repair' && hasCarAsset(playerState)) {
                const feeRoll = Math.floor(Math.random() * 6) + 1;
                passedMessages.push(`經過維修廠，汽車保養費 ${feeRoll * 2000}，請自行登錄`);
            }
        }

        const landedSquare = getSquareByIndex(nextPosition);
        let deckState = boardState.deckState;
        let currentCard: BoardCardResult | null = null;
        let detailMessages = [...passedMessages];
        const nextSkipTurns = { ...boardState.skipTurns };

        if (landedSquare.type === 'happiness' || landedSquare.type === 'opportunity' || landedSquare.type === 'news') {
            const drawResult = drawBoardCard(deckState, landedSquare.type, playerState);
            if (drawResult) {
                deckState = drawResult.deckState;
                currentCard = drawResult.card;
                detailMessages.push(`抽到${landedSquare.label}卡：${currentCard.title}`);
            }
        } else if (landedSquare.type === 'hospital') {
            const hospitalRoll = Math.floor(Math.random() * 6) + 1;
            nextSkipTurns[user.uid] = Math.max(nextSkipTurns[user.uid] || 0, landedSquare.pauseTurns || 1);
            detailMessages.push(`住院醫藥費 ${hospitalRoll * 1000}，並暫停一回合`);
        } else if (landedSquare.type === 'repair') {
            const repairRoll = Math.floor(Math.random() * 6) + 1;
            if (hasCarAsset(playerState)) {
                detailMessages.push(`踩到維修廠，保養費 ${repairRoll * 2000}，並暫停一回合`);
                nextSkipTurns[user.uid] = Math.max(nextSkipTurns[user.uid] || 0, landedSquare.pauseTurns || 1);
            } else {
                detailMessages.push('踩到維修廠，但目前沒有汽車');
            }
        } else if (landedSquare.type === 'school') {
            detailMessages.push('可選擇報名升等考試');
        } else if (landedSquare.type === 'bank') {
            detailMessages.push('請確認本回合月結餘');
        }

        const rollTimestamp = Date.now();
        const movementDurationMs =
            BOARD_MOVE_INTRO_DELAY_MS +
            path.length * BOARD_MOVE_STEP_DURATION_MS +
            BOARD_MOVE_LANDING_DELAY_MS;

        const nextTurn = getNextTurnUid({
            ...boardState,
            currentTurnUid: user.uid,
            skipTurns: nextSkipTurns
        });

        const event: BoardEventLog = {
            id: `${user.uid}_${Date.now()}`,
            playerUid: user.uid,
            playerName: room.members.find(member => member.uid === user.uid)?.name || user.name || '玩家',
            summary: `${room.members.find(member => member.uid === user.uid)?.name || user.name || '玩家'} 擲出 ${total} 點，停在 ${landedSquare.label}`,
            detail: detailMessages.join('｜'),
            squareIndex: nextPosition,
            timestamp: rollTimestamp + movementDurationMs,
            rollTotal: total
        };

        const updatedPlayerState = playerState ? cleanObject({
            ...playerState,
            boardPosition: nextPosition,
            skipTurns: nextSkipTurns[user.uid] || 0,
            lastBoardEvent: event.summary,
            pendingCardAction: detailMessages.join('\n')
        }) : undefined;

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), cleanObject({
            boardState: {
                ...boardState,
                currentTurnUid: user.uid,
                lastRoll: {
                    uid: user.uid,
                    dice,
                    total,
                    timestamp: rollTimestamp
                },
                currentCard: null,
                currentCardReveal: null,
                currentEvent: null,
                movement: {
                    playerUid: user.uid,
                    startPosition,
                    path,
                    rollTotal: total,
                    dice,
                    startedAt: rollTimestamp,
                    stepDurationMs: BOARD_MOVE_STEP_DURATION_MS,
                    introDelayMs: BOARD_MOVE_INTRO_DELAY_MS,
                    landingDelayMs: BOARD_MOVE_LANDING_DELAY_MS,
                    isActive: true
                },
                updatedAt: rollTimestamp
            }
        })));

        await wait(movementDurationMs);

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), cleanObject({
            boardState: {
                ...boardState,
                playerPositions: {
                    ...boardState.playerPositions,
                    [user.uid]: nextPosition
                },
                skipTurns: nextTurn?.skipTurns || nextSkipTurns,
                currentTurnUid: nextTurn?.nextUid || user.uid,
                lastRoll: {
                    uid: user.uid,
                    dice,
                    total,
                    timestamp: rollTimestamp
                },
                currentCard,
                currentCardReveal: currentCard ? {
                    eventId: event.id,
                    cardId: currentCard.cardId,
                    isRevealed: false
                } : null,
                currentEvent: event,
                movement: null,
                deckState,
                updatedAt: Date.now()
            },
            ...(updatedPlayerState ? {
                playerStates: {
                    ...(room.playerStates || {}),
                    [user.uid]: updatedPlayerState
                }
            } : {})
        })));

        return {
            position: nextPosition,
            detail: detailMessages.join('\n'),
            skipTurns: nextSkipTurns[user.uid] || 0,
            total
        };
    };

    const finishRoomGame = async () => {
        if (!room || user?.uid !== room.hostId) return;
        try {
            await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
                status: 'finished'
            }));
        } catch (err: any) {
            setError(err.message);
        }
    };

    const closeRoom = async () => {
        if (!room || user?.uid !== room.hostId) return;
        const roomId = room.id;
        try {
            // 先清除本地狀態
            setRoom(null);
            localStorage.removeItem(`active_room_${user.uid}`);

            await safeAsync(deleteDoc(doc(db, 'rooms', roomId)));
        } catch (err: any) {
            setError(err.message);
        }
    };

    const abandonRealEstateCard = async (cardId: string) => {
        if (!room) return;
        const boardState = room.boardState;
        if (!boardState) return;

        const currentMarket = boardState.realEstateMarket || [];
        if (currentMarket.includes(cardId)) return;

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            'boardState.realEstateMarket': [...currentMarket, cardId],
            'boardState.updatedAt': Date.now()
        }));
    };

    const buyRealEstateFromMarket = async (cardId: string) => {
        if (!room) return;
        const boardState = room.boardState;
        if (!boardState) return;

        const currentMarket = boardState.realEstateMarket || [];
        if (!currentMarket.includes(cardId)) return;

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            'boardState.realEstateMarket': currentMarket.filter(id => id !== cardId),
            'boardState.updatedAt': Date.now()
        }));
    };

    const updateMarket = async (updates: Record<string, number>, code: string, isBubble: boolean = false) => {
        if (!room || user?.role !== 'coach') return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            // 先獲取當前的 marketPrices 作為 previousMarketPrices
            const currentPrices = room.marketPrices || {};

            await safeAsync(updateDoc(roomRef, {
                marketUpdates: {
                    updates,
                    code,
                    isBubble,
                    timestamp: Date.now()
                },
                // 保存前一次的價格
                previousMarketPrices: currentPrices,
                // 更新為新的價格
                marketPrices: updates
            }));
        } catch (err: any) {
            console.error('更新行情失敗:', err);
            setError(err.message);
        }
    };

    const revealBoardCard = async (eventId: string, cardId: string) => {
        if (!room?.id || !room.isBoardGame || !room.boardState || !user) return;

        const { boardState } = room;
        const isCurrentCard =
            boardState.currentEvent?.id === eventId &&
            boardState.currentCard?.cardId === cardId;

        if (!isCurrentCard) return;

        await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
            'boardState.currentCardReveal': {
                eventId,
                cardId,
                isRevealed: true,
                revealedAt: Date.now(),
                revealedBy: user.uid
            },
            'boardState.updatedAt': Date.now()
        }));
    };

    const applyBoardMarketPrices = async (updates: Record<string, number>, code: string, isBubble: boolean = false) => {
        if (!room || !user) return;
        if (!room.isBoardGame || room.boardState?.currentTurnUid !== user.uid) return;

        try {
            const roomRef = doc(db, 'rooms', room.id);
            const currentPrices = room.marketPrices || {};

            await safeAsync(updateDoc(roomRef, {
                marketUpdates: {
                    updates,
                    code,
                    isBubble,
                    timestamp: Date.now()
                },
                previousMarketPrices: currentPrices,
                marketPrices: updates
            }));
        } catch (err: any) {
            console.error('套用棋盤行情失敗:', err);
            setError(err.message);
        }
    };

    const updateRoomTimer = async (timeLeft: number, isPaused: boolean) => {
        if (!room || user?.role !== 'coach') return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await safeAsync(updateDoc(roomRef, {
                gameTimeLeft: timeLeft,
                isTimerPaused: isPaused
            }));
        } catch (err: any) {
            console.error('更新計時器失敗:', err);
            setError(err.message);
        }
    };

    const submitRequest = async (request: Omit<PendingRequest, 'id' | 'status' | 'timestamp'>) => {
        if (!room) return;
        try {
            const requestId = `${request.uid}_${Date.now()}`;
            const newRequest: PendingRequest = {
                ...request,
                id: requestId,
                status: 'pending',
                timestamp: Date.now()
            };
            const roomRef = doc(db, 'rooms', room.id);
            await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}`]: newRequest
            }));
        } catch (err: any) {
            console.error('送出審核請求失敗:', err);
            setError(err.message);
        }
    };

    const approveRequest = async (requestId: string) => {
        if (!room || (user?.role !== 'coach' && user?.role !== 'gm')) return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}.status`]: 'approved'
            }));
        } catch (err: any) {
            console.error('核准請求失敗:', err);
            setError(err.message);
        }
    };

    const rejectRequest = async (requestId: string) => {
        if (!room || (user?.role !== 'coach' && user?.role !== 'gm')) return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}.status`]: 'rejected'
            }));
        } catch (err: any) {
            console.error('拒絕請求失敗:', err);
            setError(err.message);
        }
    };

    const clearRequest = async (requestId: string) => {
        if (!room) return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await safeAsync(updateDoc(roomRef, {
                [`pendingRequests.${requestId}`]: deleteField()
            }));
        } catch (err: any) {
            console.error('清除請求失敗:', err);
        }
    };

    return (
        <RoomContext.Provider value={{
            room,
            isLoadingRoom,
            error,
            playerStates,
            createRoom,
            joinRoom,
            leaveRoom,
            startRoomGame,
            finishRoomGame,
            closeRoom,
            updateMarket,
            updateRoomTimer,
            submitRequest,
            approveRequest,
            rejectRequest,
            clearRequest,
            rollBoardDice,
            revealBoardCard,
            applyBoardMarketPrices,
            abandonRealEstateCard,
            buyRealEstateFromMarket
        }}>
            {children}
        </RoomContext.Provider>
    );
};

export const useRoom = () => {
    const context = useContext(RoomContext);
    if (!context) throw new Error('useRoom must be used within a RoomProvider');
    return context;
};

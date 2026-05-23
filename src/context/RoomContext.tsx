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
import { GameState } from '../types';
import { cleanObject, safeAsync } from '../utils/utils';

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

interface Room {
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
    marketPrices?: Record<string, number>; // 股市價格
    previousMarketPrices?: Record<string, number>; // 前一次股市價格
    marketUpdates?: {
        updates: Record<string, number>;
        code: string;
        isBubble: boolean;
        timestamp: number;
    };
    pendingRequests?: Record<string, PendingRequest>;
}

interface RoomContextValue {
    room: Room | null;
    isLoadingRoom: boolean;
    error: string | null;
    playerStates: Record<string, GameState>;
    createRoom: (settings?: { name: string; maxPlayers: number; duration: number }) => Promise<string>;
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

    const createRoom = useCallback(async (settings?: { name: string; maxPlayers: number; duration: number }) => {
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
                sessionId: `${roomCode}_${Date.now()}`
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
            await safeAsync(updateDoc(doc(db, 'rooms', room.id), {
                status: 'playing',
                playerStates: {}, // 清空舊的玩家狀態
                pendingRequests: {}, // 初始化審核請求
                startedAt: Date.now(), // 新增開始時間戳，用來觸發玩家重設狀態
                sessionId: `${room.id}_${Date.now()}` // 每場遊戲產生新的唯一 sessionId，避免覆蓋上一場紀錄
            }));
        } catch (err: any) {
            setError(err.message);
        }
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
            clearRequest
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

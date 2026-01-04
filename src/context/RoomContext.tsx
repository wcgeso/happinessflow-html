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
    arrayRemove
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from './AuthContext';
import { GameState } from '../types';
import { cleanObject } from '../utils/utils';

interface RoomMember {
    uid: string;
    name: string;
    photoURL?: string;
    email?: string;
    title?: string;
    experience?: number;
    role: 'coach' | 'player';
    joinedAt: any;
    isLeft?: boolean;
    photoPosition?: string;
    photoScale?: string;
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

        // 如果目前沒有 room.id，嘗試從 localStorage 恢復（針對斷線重連）
        let activeRoomId = room?.id;
        if (!activeRoomId && user.role === 'player') {
            const savedRoomId = localStorage.getItem(`active_room_${user.uid}`);
            if (savedRoomId) {
                activeRoomId = savedRoomId;
                // 這裡我們先不 setRoom，等 snapshot 確定房間還在再說
            }
        }

        if (!activeRoomId) return;

        console.log('開始監聽房間:', activeRoomId);
        const unsubscribe = onSnapshot(doc(db, 'rooms', activeRoomId), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as Room;
                console.log('房間數據更新:', data.id, '狀態:', data.status);
                setRoom(data);
                
                // 如果是執行師，同步更新 playerStates
                if (user.role === 'coach' && data.playerStates) {
                    setPlayerStates(data.playerStates);
                }

                // 儲存目前房間 ID 到 localStorage
                if (user.role === 'player') {
                    localStorage.setItem(`active_room_${user.uid}`, data.id);
                }
            } else {
                console.log('房間不存在或已被關閉');
                setRoom(null);
                if (user.role === 'player') {
                    localStorage.removeItem(`active_room_${user.uid}`);
                }
            }
        }, (err) => {
            console.error('監聽房間失敗:', err);
            if (err.code === 'permission-denied') {
                setError('權限不足，請檢查 Firebase Firestore Rules 設定');
            }
            // 如果報錯且是找不到文件，也清除 localStorage
            if (err.code === 'not-found') {
                localStorage.removeItem(`active_room_${user.uid}`);
            }
        });

        return () => {
            console.log('停止監聽房間:', activeRoomId);
            unsubscribe();
        };
    }, [user?.uid, room?.id]); // 保持監聽 room.id 的變化，或者 user 切換

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
            try {
                const roomDoc = await getDoc(doc(db, 'rooms', code));
                if (!roomDoc.exists()) {
                    isUnique = true;
                }
            } catch (err) {
                console.error('檢查房間碼唯一性失敗:', err);
                // 如果是權限問題或其他錯誤，我們還是繼續嘗試或拋出錯誤
                throw new Error('無法檢查房間碼唯一性，請檢查網路連線');
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
                isTimerPaused: true
            };
            const cleanedRoom = cleanObject(newRoom);
            await setDoc(doc(db, 'rooms', roomCode), cleanedRoom);
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
            const roomDoc = await getDoc(roomRef);
            
            if (!roomDoc.exists()) throw new Error('找不到此房間');
            
            const roomData = roomDoc.data() as Room;
            
            // 檢查是否已在房間內（支援斷線重連，不論房間狀態）
            const existingMember = roomData.members.find(m => m.uid === user.uid);
            if (existingMember) {
                setRoom(roomData);
                return;
            }

            if (roomData.status !== 'waiting') throw new Error('遊戲已開始或已結束');
            
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
            await updateDoc(roomRef, {
                members: arrayUnion(cleanedMember)
            });
            
            setRoom({
                ...roomData,
                members: [...roomData.members, cleanedMember]
            });
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoadingRoom(false);
        }
    };

    const leaveRoom = async () => {
        if (!user || !room) return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            const memberToRemove = room.members.find(m => m.uid === user.uid);
            if (memberToRemove) {
                await updateDoc(roomRef, {
                    members: arrayRemove(memberToRemove)
                });
            }
            // 玩家主動離開房間，清除 localStorage 紀錄，不再顯示「繼續遊戲」
            if (user.role === 'player') {
                localStorage.removeItem(`active_room_${user.uid}`);
            }
            setRoom(null);
        } catch (err: any) {
            console.error('離開房間失敗:', err);
        }
    };

    const startRoomGame = async () => {
        if (!room || user?.uid !== room.hostId) return;
        try {
            await updateDoc(doc(db, 'rooms', room.id), {
                status: 'playing'
            });
        } catch (err: any) {
            setError(err.message);
        }
    };

    const finishRoomGame = async () => {
        if (!room || user?.uid !== room.hostId) return;
        try {
            await updateDoc(doc(db, 'rooms', room.id), {
                status: 'finished'
            });
        } catch (err: any) {
            setError(err.message);
        }
    };

    const closeRoom = async () => {
        if (!room || user?.uid !== room.hostId) return;
        try {
            await deleteDoc(doc(db, 'rooms', room.id));
            setRoom(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const updateMarket = async (updates: Record<string, number>, code: string, isBubble: boolean = false) => {
        if (!room || user?.role !== 'coach') return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await updateDoc(roomRef, {
                marketUpdates: {
                    updates,
                    code,
                    isBubble,
                    timestamp: Date.now()
                }
            });
        } catch (err: any) {
            console.error('更新行情失敗:', err);
            setError(err.message);
        }
    };

    const updateRoomTimer = async (timeLeft: number, isPaused: boolean) => {
        if (!room || user?.role !== 'coach') return;
        try {
            const roomRef = doc(db, 'rooms', room.id);
            await updateDoc(roomRef, {
                gameTimeLeft: timeLeft,
                isTimerPaused: isPaused
            });
        } catch (err: any) {
            console.error('更新計時器失敗:', err);
            setError(err.message);
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
            updateRoomTimer
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

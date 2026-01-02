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

interface RoomMember {
    uid: string;
    name: string;
    photoURL?: string;
    role: 'coach' | 'player';
    joinedAt: any;
}

interface Room {
    id: string; // 房間碼 (6位數)
    hostId: string;
    status: 'waiting' | 'playing' | 'finished';
    members: RoomMember[];
    createdAt: any;
    maxPlayers: number;
}

interface RoomContextValue {
    room: Room | null;
    isLoadingRoom: boolean;
    error: string | null;
    createRoom: () => Promise<string>;
    joinRoom: (roomCode: string) => Promise<void>;
    leaveRoom: () => Promise<void>;
    startRoomGame: () => Promise<void>;
    closeRoom: () => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [room, setRoom] = useState<Room | null>(null);
    const [isLoadingRoom, setIsLoadingRoom] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 監聽房間狀態
    useEffect(() => {
        if (!user || !room?.id) return;

        const unsubscribe = onSnapshot(doc(db, 'rooms', room.id), (snapshot) => {
            if (snapshot.exists()) {
                setRoom(snapshot.data() as Room);
            } else {
                // 房間被關閉
                setRoom(null);
            }
        }, (err) => {
            console.error('監聽房間失敗:', err);
            if (err.code === 'permission-denied') {
                setError('權限不足，請檢查 Firebase Firestore Rules 設定');
            }
        });

        return () => unsubscribe();
    }, [user, room?.id]);

    // 生成 6 位數房間碼
    const generateRoomCode = async (): Promise<string> => {
        let code = '';
        let isUnique = false;
        while (!isUnique) {
            code = Math.floor(100000 + Math.random() * 900000).toString();
            const roomDoc = await getDoc(doc(db, 'rooms', code));
            if (!roomDoc.exists()) {
                isUnique = true;
            }
        }
        return code;
    };

    const createRoom = async () => {
        if (!user || user.role !== 'coach') throw new Error('只有執行師可以開房');
        setIsLoadingRoom(true);
        setError(null);
        try {
            const roomCode = await generateRoomCode();
            const newRoom: Room = {
                id: roomCode,
                hostId: user.uid,
                status: 'waiting',
                members: [{
                    uid: user.uid,
                    name: user.name,
                    photoURL: user.photoURL,
                    role: 'coach',
                    joinedAt: new Date()
                }],
                createdAt: serverTimestamp(),
                maxPlayers: 6
            };
            await setDoc(doc(db, 'rooms', roomCode), newRoom);
            setRoom(newRoom);
            return roomCode;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoadingRoom(false);
        }
    };

    const joinRoom = async (roomCode: string) => {
        if (!user) throw new Error('請先登入');
        setIsLoadingRoom(true);
        setError(null);
        try {
            const roomRef = doc(db, 'rooms', roomCode);
            const roomDoc = await getDoc(roomRef);
            
            if (!roomDoc.exists()) throw new Error('找不到此房間');
            
            const roomData = roomDoc.data() as Room;
            if (roomData.status !== 'waiting') throw new Error('遊戲已開始或已結束');
            
            // 檢查人數限制 (排除教練)
            const playerMembers = roomData.members.filter(m => m.role === 'player');
            if (playerMembers.length >= roomData.maxPlayers) throw new Error('房間已滿');
            
            // 檢查是否已在房間內
            if (roomData.members.some(m => m.uid === user.uid)) {
                setRoom(roomData);
                return;
            }

            const newMember: RoomMember = {
                uid: user.uid,
                name: user.name,
                photoURL: user.photoURL,
                role: user.role,
                joinedAt: new Date()
            };

            await updateDoc(roomRef, {
                members: arrayUnion(newMember)
            });
            
            setRoom({
                ...roomData,
                members: [...roomData.members, newMember]
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

    const closeRoom = async () => {
        if (!room || user?.uid !== room.hostId) return;
        try {
            await deleteDoc(doc(db, 'rooms', room.id));
            setRoom(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <RoomContext.Provider value={{ 
            room, 
            isLoadingRoom, 
            error, 
            createRoom, 
            joinRoom, 
            leaveRoom, 
            startRoomGame, 
            closeRoom 
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

import re

with open('src/context/RoomContext.tsx', 'r') as f:
    content = f.read()

# 1. Add useRef and runTransaction to imports
content = re.sub(
    r"import React, \{ createContext, useContext, useState, useEffect, useCallback \} from 'react';",
    "import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';",
    content
)
content = re.sub(
    r"deleteField\n\} from 'firebase/firestore';",
    "deleteField,\n    runTransaction\n} from 'firebase/firestore';",
    content
)

# 2. Add isProcessingRef and executeWithLock
provider_start = "export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {\n    const { user } = useAuth();\n    const [room, setRoom] = useState<Room | null>(null);\n    const [isLoadingRoom, setIsLoadingRoom] = useState(false);\n    const [error, setError] = useState<string | null>(null);\n    const [playerStates, setPlayerStates] = useState<Record<string, GameState>>({});"
provider_new = provider_start + """\n
    const isProcessingRef = useRef<boolean>(false);
    const executeWithLock = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
        if (isProcessingRef.current) return undefined;
        isProcessingRef.current = true;
        try {
            return await action();
        } finally {
            isProcessingRef.current = false;
        }
    };"""
content = content.replace(provider_start, provider_new)

# 3. Modify rollBoardDice
# Just wrap the interior and convert to dot notation update or runTransaction
# Wait, rollBoardDice does updateDoc(...) which replaces the entire boardState. We can just use dot notation!
roll_old = """        await safeAsync(updateDoc(doc(db, 'rooms', room.id), cleanObject({
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
                movement,
                updatedAt: rollTimestamp
            },
            ...(playerState?.bankServiceWindowActive ? {
                playerStates: {
                    ...(room.playerStates || {}),
                    [user.uid]: cleanObject({
                        ...playerState,
                        bankServiceWindowActive: false,
                        bankServiceGrantedAtEventId: undefined
                    })
                }
            } : {})
        })));"""
roll_new = """        const updates: Record<string, any> = {
            'boardState.currentTurnUid': user.uid,
            'boardState.lastRoll': {
                uid: user.uid,
                dice,
                total,
                timestamp: rollTimestamp
            },
            'boardState.currentCard': null,
            'boardState.currentCardReveal': null,
            'boardState.currentEvent': null,
            'boardState.movement': movement,
            'boardState.updatedAt': rollTimestamp
        };
        if (playerState?.bankServiceWindowActive) {
            updates[`playerStates.${user.uid}`] = cleanObject({
                ...playerState,
                bankServiceWindowActive: false,
                bankServiceGrantedAtEventId: undefined
            });
        }
        await safeAsync(updateDoc(doc(db, 'rooms', room.id), cleanObject(updates)));"""
content = content.replace(roll_old, roll_new)

# Wrap rollBoardDice with executeWithLock
content = re.sub(
    r"    const rollBoardDice = async \(requestedDiceCount\?: 1 \| 2\) => \{",
    "    const rollBoardDice = async (requestedDiceCount?: 1 | 2) => executeWithLock(async () => {",
    content
)
# We have to close the wrapper. rollBoardDice ends with:
#         return {
#             position: nextPosition,
#             detail: passedMessages.join('\n'),
#             skipTurns: room.playerStates?.[user.uid]?.skipTurns || 0,
#             total
#         };
#     };
roll_end = """        return {
            position: nextPosition,
            detail: passedMessages.join('\\n'),
            skipTurns: room.playerStates?.[user.uid]?.skipTurns || 0,
            total
        };
    };"""
roll_end_new = """        return {
            position: nextPosition,
            detail: passedMessages.join('\\n'),
            skipTurns: room.playerStates?.[user.uid]?.skipTurns || 0,
            total
        };
    }) as Promise<{ position: number; detail: string; skipTurns: number; total: number }>;"""
content = content.replace(roll_end, roll_end_new)


# 4. advanceBoardEventQueue with Event Completion Guard and executeWithLock and arrayUnion/Dot Notation?
# No, advanceBoardEventQueue computes a deeply nested nextState. Doing runTransaction is safer here.
advance_start = """    const advanceBoardEventQueue = async (expectedType?: 'bank' | 'school' | 'hospital' | 'card' | 'exam_happiness' | 'followup') => {
        if (!room?.id || !room.isBoardGame || !room.boardState) return;

        const { boardState } = room;
        if (expectedType && boardState.currentEvent?.type !== expectedType) return;

        const nextState = buildBoardEventAdvanceState(room);
        if (!nextState) return;
        await safeAsync(updateDoc(doc(db, 'rooms', room.id), cleanObject({
            ...nextState,
            boardState: {
                ...(nextState.boardState || boardState),
                cardLog: nextState.boardState?.currentCard
                    ? appendBoardCardLog(boardState, nextState.boardState.currentCard, nextState.boardState.currentEvent)
                    : boardState.cardLog || [],
                updatedAt: Date.now()
            },
            ...(nextState.playerStates ? { playerStates: nextState.playerStates } : {})
        })));
    };"""

advance_new = """    const advanceBoardEventQueue = async (expectedType?: 'bank' | 'school' | 'hospital' | 'card' | 'exam_happiness' | 'followup') => executeWithLock(async () => {
        if (!room?.id || !room.isBoardGame || !room.boardState) return;

        const { boardState } = room;
        if (expectedType && boardState.currentEvent?.type !== expectedType) return;

        // Event Completion Guard: Ensure no pending shared events
        if (boardState.sharedCardPrompt) {
            const prompt = boardState.sharedCardPrompt;
            const hasAllResponses = prompt.targetPlayerUids.every(uid => prompt.responses?.[uid]);
            if (!hasAllResponses) {
                alert('還有玩家尚未完成卡片決策，請等待所有人完成後再推進事件。');
                return;
            }
        }
        if (boardState.familyMilestoneJoinPrompt) {
            const prompt = boardState.familyMilestoneJoinPrompt;
            const hasAllResponses = prompt.targetPlayerUids.every(uid => prompt.responses?.[uid]);
            if (!hasAllResponses) {
                alert('還有玩家尚未選擇是否加入家庭歷程，請等待所有人選擇後再推進事件。');
                return;
            }
        }

        // Use runTransaction to prevent race conditions during deep state updates
        await safeAsync(runTransaction(db, async (transaction) => {
            const roomRef = doc(db, 'rooms', room.id);
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) return;
            const currentRoom = roomDoc.data() as Room;
            const currentBoardState = currentRoom.boardState;
            if (!currentBoardState) return;
            
            // Check again in transaction
            if (expectedType && currentBoardState.currentEvent?.type !== expectedType) return;
            
            // Avoid advancing if same event ID was already advanced
            if (currentBoardState.currentEvent?.id !== boardState.currentEvent?.id) {
                return; // Event already changed
            }

            const nextState = buildBoardEventAdvanceState(currentRoom);
            if (!nextState) return;

            transaction.update(roomRef, cleanObject({
                ...nextState,
                boardState: {
                    ...(nextState.boardState || currentBoardState),
                    cardLog: nextState.boardState?.currentCard
                        ? appendBoardCardLog(currentBoardState, nextState.boardState.currentCard, nextState.boardState.currentEvent)
                        : currentBoardState.cardLog || [],
                    updatedAt: Date.now()
                },
                ...(nextState.playerStates ? { playerStates: nextState.playerStates } : {})
            }));
        }));
    });"""
content = content.replace(advance_start, advance_new)

with open('src/context/RoomContext.tsx', 'w') as f:
    f.write(content)

print("Patch applied")

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { collection, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { observeSnapshots } from '../utils/recoveringSnapshot';
import type { Room, SharedCardPromptResponse } from '../types';

const onResponseSnapshot = observeSnapshots('responses');

export function useSharedPromptResponses({ room, user, setRoom, setError, finalize }: {
    room: Room | null;
    user: { uid: string; role: string } | null;
    setRoom: Dispatch<SetStateAction<Room | null>>;
    setError: Dispatch<SetStateAction<string | null>>;
    finalize: (roomId: string, promptId: string) => Promise<void>;
}) {
    const prompt = room?.boardState?.sharedCardPrompt;
    const isCoach = !!user && (room?.hostId === user.uid || user.role === 'coach' || user.role === 'gm');
    const roomId = room?.id;
    const sessionId = room?.sessionId;
    const promptId = prompt?.id;
    const responseStorage = prompt?.responseStorage;
    const schema = room?.syncSchemaVersion;
    const completionAuthority = room?.promptCompletionAuthority;
    const uid = user?.uid;

    // Bind the subscription to its document scope, not the response contents.
    useEffect(() => {
        if (!uid || !roomId || schema !== 2 || responseStorage !== 'subcollection' || !promptId) return;
        let active = true;
        const receive = (responses: Record<string, SharedCardPromptResponse>) => {
            if (!active) return;
            setRoom(previous => {
                const current = previous?.boardState?.sharedCardPrompt;
                if (previous?.id !== roomId || previous.sessionId !== sessionId || current?.id !== promptId) return previous;
                const existing = current.responses || {};
                if (Object.keys(responses).every(key => JSON.stringify(existing[key]) === JSON.stringify(responses[key]))) return previous;
                return {
                    ...previous,
                    boardState: {
                        ...previous.boardState!,
                        sharedCardPrompt: { ...current, responses: { ...existing, ...responses } }
                    }
                };
            });
        };
        const failure = (error: { code?: string }) => {
            if (!active) return;
            console.error('監聽共享卡片回覆失敗:', error);
            if (error.code === 'permission-denied') setError('共享卡片回覆同步權限不足，請重新整理後再試一次');
        };
        const responsesRef = collection(db, 'rooms', roomId, 'events', promptId, 'responses');
        const stop = isCoach
            ? onResponseSnapshot(responsesRef, snapshot => receive(Object.fromEntries(
                snapshot.docs.map(response => [response.id, response.data() as SharedCardPromptResponse])
            )), failure)
            : onResponseSnapshot(doc(db, 'rooms', roomId, 'events', promptId, 'responses', uid), snapshot =>
                receive(snapshot.exists() ? { [uid]: snapshot.data() as SharedCardPromptResponse } : {}), failure);
        return () => { active = false; stop(); };
    }, [uid, roomId, sessionId, schema, promptId, responseStorage, isCoach, setRoom, setError]);

    const responsesKey = JSON.stringify(prompt?.responses || {});
    const targetsKey = JSON.stringify(prompt?.targetPlayerUids || []);
    // Legacy rooms retain the coach fallback; backend rooms are finalized by triggers/tasks.
    useEffect(() => {
        if (completionAuthority === 'server-prompts-v1' || !isCoach || !roomId || !promptId || schema !== 2 || responseStorage !== 'subcollection') return;
        const responses = JSON.parse(responsesKey) as Record<string, SharedCardPromptResponse>;
        const targets = JSON.parse(targetsKey) as string[];
        if (targets.every(target => responses[target])) void finalize(roomId, promptId);
    }, [completionAuthority, isCoach, roomId, sessionId, promptId, schema, responseStorage, responsesKey, targetsKey, finalize]);
}

import { doc, increment, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { SettlementPlayerInput, SettlementResult } from '../../types';

interface SettleGameInput {
    roomId: string;
    settlementId: string;
    coachUid: string;
    players: SettlementPlayerInput[];
}

export const settleGame = async ({ settlementId, coachUid, players }: SettleGameInput): Promise<SettlementResult> => {
    const recordRef = doc(db, 'score_records', 'S1', 'records', settlementId);
    const playerRefs = players.map(player => ({ player, ref: doc(db, 'users', player.uid) }));

    return runTransaction(db, async transaction => {
        const recordSnapshot = await transaction.get(recordRef);
        if (recordSnapshot.exists() && recordSnapshot.data()?.scoreAppliedAt) {
            return 'already_applied';
        }

        const playerSnapshots = await Promise.all(playerRefs.map(({ ref }) => transaction.get(ref)));
        if (playerSnapshots.some(snapshot => !snapshot.exists())) {
            throw new Error('玩家資料不存在，無法完成結算');
        }

        playerRefs.forEach(({ player, ref }) => {
            transaction.update(ref, {
                experience: increment(player.totalScore),
                rankScore: increment(player.totalScore)
            });
        });
        transaction.set(recordRef, {
            scoreAppliedAt: serverTimestamp(),
            scoreAppliedBy: coachUid
        }, { merge: true });

        return 'applied';
    });
};

// Read-only Admin SDK access to a seeded room's Firestore doc, for test
// assertions. Deliberately bypasses the UI so assertions don't depend on
// rendering timing/animation of the thing they're trying to verify.
import { getEmulatorDb } from '../../scripts/e2e/adminClient.mjs';

export const getRoom = async (roomCode: string) => {
  const db = getEmulatorDb();
  const snap = await db.collection('rooms').doc(roomCode).get();
  if (!snap.exists) throw new Error(`Room ${roomCode} does not exist`);
  return snap.data() as any;
};

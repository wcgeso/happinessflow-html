// Idempotently creates the 4 fixed local E2E accounts (1 coach + 3 players)
// in the Auth + Firestore emulators. Safe to re-run: existing accounts are
// looked up and reused rather than recreated.
//
// Usage: node scripts/e2e/seedAccounts.mjs

import { getEmulatorAuth, getEmulatorDb } from './adminClient.mjs';

export const TEST_ACCOUNTS = [
  { email: 'coach.local@hf.test', password: 'Coach123!', name: 'Coach', role: 'coach' },
  { email: 'p1.local@hf.test', password: 'Player123!', name: 'Player1', role: 'player' },
  { email: 'p2.local@hf.test', password: 'Player123!', name: 'Player2', role: 'player' },
  { email: 'p3.local@hf.test', password: 'Player123!', name: 'Player3', role: 'player' },
];

const upsertAuthUser = async ({ email, password, name }) => {
  const auth = getEmulatorAuth();
  try {
    const existing = await auth.getUserByEmail(email);
    return existing;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }
  return auth.createUser({
    email,
    password,
    displayName: name,
    emailVerified: true,
  });
};

const upsertUserDoc = async (uid, { email, name, role }) => {
  const db = getEmulatorDb();
  await db.collection('users').doc(uid).set(
    {
      uid,
      email,
      name,
      role,
      title: '',
      photoURL: 'bee',
    },
    { merge: true }
  );
};

export const seedAccounts = async () => {
  const result = {};
  for (const account of TEST_ACCOUNTS) {
    const userRecord = await upsertAuthUser(account);
    await upsertUserDoc(userRecord.uid, account);
    result[account.role === 'coach' ? 'coach' : account.email.split('.')[0]] = {
      uid: userRecord.uid,
      ...account,
    };
  }
  return result;
};

const isMain = process.argv[1] && process.argv[1].endsWith('seedAccounts.mjs');
if (isMain) {
  seedAccounts()
    .then((result) => {
      console.log('[e2e/seedAccounts] Seeded accounts:');
      for (const [key, value] of Object.entries(result)) {
        console.log(`  ${key}: ${value.email} (uid=${value.uid}, role=${value.role})`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[e2e/seedAccounts] Failed:', err);
      process.exit(1);
    });
}

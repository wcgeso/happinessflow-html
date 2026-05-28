/**
 * 建立測試帳號腳本
 * 執行方式: node scripts/create-test-accounts.mjs
 *
 * 建立兩個帳號:
 *   執行師: test-coach@hf.test  /  TestCoach123
 *   玩家:   test-player@hf.test /  TestPlayer123
 */

const API_KEY = 'AIzaSyDD6yXBqQ5qExLYvGFd8m3kSJYzRGu659g';
const PROJECT_ID = 'happinessflow-63b2e';
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`;

const accounts = [
  {
    email: 'test-coach@hf.test',
    password: 'TestCoach123',
    name: '測試執行師',
    role: 'coach',
  },
  {
    email: 'test-player@hf.test',
    password: 'TestPlayer123',
    name: '測試玩家',
    role: 'player',
  },
];

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createAuthUser(email, password) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) {
    if (data.error.message === 'EMAIL_EXISTS') {
      console.log(`  ⚠ ${email} 已存在，跳過建立`);
      // Try to sign in instead to get uid
      const signInRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
      );
      const signInData = await signInRes.json();
      if (signInData.error) throw new Error(signInData.error.message);
      return signInData.localId;
    }
    throw new Error(data.error.message);
  }
  return data.localId;
}

async function setFirestoreDoc(uid, data) {
  const url = `${FIRESTORE_URL}/${uid}?updateMask.fieldPaths=uid&updateMask.fieldPaths=email&updateMask.fieldPaths=name&updateMask.fieldPaths=role&updateMask.fieldPaths=title&updateMask.fieldPaths=photoURL&updateMask.fieldPaths=inviteCode`;

  const fields = {
    uid:        { stringValue: uid },
    email:      { stringValue: data.email },
    name:       { stringValue: data.name },
    role:       { stringValue: data.role },
    title:      { stringValue: '' },
    photoURL:   { stringValue: 'bee' },
    inviteCode: { stringValue: generateInviteCode() },
  };

  const res = await fetch(`${FIRESTORE_URL}/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  const result = await res.json();
  if (result.error) throw new Error(JSON.stringify(result.error));
}

console.log('🐝 蜂富人生 — 建立測試帳號\n');

for (const account of accounts) {
  console.log(`建立 [${account.role}]: ${account.email}`);
  try {
    const uid = await createAuthUser(account.email, account.password);
    console.log(`  ✓ Auth UID: ${uid}`);
    await setFirestoreDoc(uid, { ...account });
    console.log(`  ✓ Firestore 文件已建立`);
    console.log(`  → 帳號: ${account.email}`);
    console.log(`  → 密碼: ${account.password}`);
    console.log(`  → 角色: ${account.role}\n`);
  } catch (err) {
    console.error(`  ✗ 錯誤: ${err.message}\n`);
  }
}

console.log('完成！使用方式：');
console.log('  執行師帳號 → 用主要瀏覽器登入');
console.log('  玩家帳號   → 用無痕視窗或其他瀏覽器登入');

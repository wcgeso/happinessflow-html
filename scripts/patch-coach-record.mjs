/**
 * 補寫執行師帶領紀錄
 * 從玩家的 player_sessions 自動存檔拉資料，補上 score_records + coach_records
 *
 * 執行方式:
 *   node scripts/patch-coach-record.mjs
 */

import { createInterface } from 'readline';

const API_KEY    = 'AIzaSyDD6yXBqQ5qExLYvGFd8m3kSJYzRGu659g';
const PROJECT_ID = 'happinessflow-63b2e';
const BASE_URL   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── 目標玩家（姓名模糊比對用） ─────────────────────────────
const TARGET_NAMES = ['王誼宸', 'Carlos', '洪佩嬅'];
// 場次日期範圍（5/28 台灣時間）
const DATE_FROM = new Date('2026-05-27T16:00:00Z'); // UTC+8 5/28 00:00
const DATE_TO   = new Date('2026-05-28T16:00:00Z'); // UTC+8 5/28 24:00

// ── 工具函式 ───────────────────────────────────────────────
function ask(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    process.stderr.write(prompt);
    rl.question('', ans => { rl.close(); resolve(ans); });
  });
}

async function firebaseSignIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(`登入失敗：${data.error.message}`);
  return data.idToken;
}

async function fsGet(path, token) {
  const res = await fetch(`${BASE_URL}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.error) throw new Error(`GET ${path} 失敗：${data.error.message}`);
  return data;
}

async function fsQuery(collectionPath, token, conditions = []) {
  const res = await fetch(`${BASE_URL}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collectionPath.split('/').pop() }],
        parent: `projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath.split('/').slice(0, -1).join('/')}`,
        where: conditions.length === 1 ? conditions[0] : {
          compositeFilter: { op: 'AND', filters: conditions },
        },
      },
    }),
  });
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`Query ${collectionPath} 失敗`);
  return data.filter(d => d.document).map(d => d.document);
}

async function fsPatch(path, fields, token) {
  const fieldPaths = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const res = await fetch(`${BASE_URL}/${path}?${fieldPaths}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`PATCH ${path} 失敗：${data.error.message}`);
  return data;
}

// Firestore 值轉 JS
function fromFs(value) {
  if (value === undefined || value === null) return null;
  if ('stringValue'  in value) return value.stringValue;
  if ('integerValue' in value) return parseInt(value.integerValue);
  if ('doubleValue'  in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue'    in value) return null;
  if ('mapValue'     in value) {
    const obj = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      obj[k] = fromFs(v);
    }
    return obj;
  }
  if ('arrayValue'   in value) {
    return (value.arrayValue.values || []).map(fromFs);
  }
  return null;
}

function docToObj(doc) {
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    obj[k] = fromFs(v);
  }
  return obj;
}

// JS 轉 Firestore 值（簡化版，支援基本型別）
function toFsValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')  return { booleanValue: val };
  if (typeof val === 'number')   return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'string')   return { stringValue: val };
  if (Array.isArray(val))        return { arrayValue: { values: val.map(toFsValue) } };
  if (typeof val === 'object')   return { mapValue: { fields: Object.fromEntries(Object.entries(val).map(([k, v]) => [k, toFsValue(v)])) } };
  return { stringValue: String(val) };
}

function objToFsFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFsValue(v)]));
}

// ── 主程式 ────────────────────────────────────────────────
async function main() {
  console.log('🐝 第二人生 — 補寫執行師紀錄工具\n');

  const password = await ask('請輸入 GM 密碼 (gm0221@happinessflow.com)：');
  console.log('\n🔐 登入中...');
  const token = await firebaseSignIn('gm0221@happinessflow.com', password);
  console.log('✓ 登入成功\n');

  // 1. 找出目標玩家的 UID
  console.log('🔍 搜尋玩家 UID...');
  const usersRes = await fetch(`${BASE_URL}/users?pageSize=300`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const usersData = await usersRes.json();
  const allUsers = (usersData.documents || []).map(d => ({ ...docToObj(d), _id: d.name.split('/').pop() }));

  const targetPlayers = allUsers.filter(u =>
    TARGET_NAMES.some(name => (u.name || '').includes(name))
  );

  if (targetPlayers.length === 0) {
    console.error('✗ 找不到目標玩家，請確認姓名是否正確');
    process.exit(1);
  }

  console.log(`✓ 找到 ${targetPlayers.length} 位玩家：`);
  targetPlayers.forEach(p => console.log(`  • ${p.name} (${p._id})`));
  console.log('');

  // 2. 讀取每位玩家的 player_sessions 自動存檔
  console.log('📂 讀取玩家 5/28 遊戲存檔...');
  const playersData = [];

  for (const player of targetPlayers) {
    const sessionsRes = await fetch(
      `${BASE_URL}/player_sessions/${player._id}/records?pageSize=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const sessionsData = await sessionsRes.json();
    const sessions = (sessionsData.documents || []).map(d => ({
      ...docToObj(d),
      _id: d.name.split('/').pop(),
    }));

    // 篩選 5/28 的最終完成紀錄
    const targetSessions = sessions.filter(s => {
      const updated = new Date(s.updatedAt || s.createdAt || 0);
      return updated >= DATE_FROM && updated <= DATE_TO;
    });

    // 優先抓 completed，其次抓最新的 draft
    const best = targetSessions.find(s => s.status === 'completed')
      || targetSessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];

    if (!best) {
      console.log(`  ⚠ ${player.name}：找不到 5/28 的存檔`);
      continue;
    }

    console.log(`  ✓ ${player.name}：幸福分 ${best.happinessScore}｜積分 ${best.finalScore}｜狀態 ${best.status}`);
    playersData.push({
      uid:        player._id,
      name:       player.name,
      profession: best.profession || 'Unknown',
      happiness:  best.happinessScore || 0,
      cash:       best.gameStateSnapshot?.cash || 0,
      assets:     best.gameStateSnapshot?.assets || [],
      liabilities: best.gameStateSnapshot?.liabilities || [],
      income:     best.gameStateSnapshot?.income || {},
      expenses:   best.gameStateSnapshot?.expenses || {},
      history:    best.gameStateSnapshot?.history || [],
      happinessItems: best.gameStateSnapshot?.happiness || [],
      loans:      best.gameStateSnapshot?.loans || 0,
      totalScore: best.finalScore || 0,
      summary:    best.financialSummary || {},
      roomId:     best.roomId || null,
      _sessionId: best._id,
    });
  }

  if (playersData.length === 0) {
    console.error('\n✗ 所有玩家都找不到 5/28 的存檔，無法補寫紀錄');
    process.exit(1);
  }

  // 3. 取得 roomId（用玩家存檔的 roomId，或產生備用 ID）
  const roomId = playersData.find(p => p.roomId)?.roomId || null;
  const now = new Date().toISOString();
  const recordId = roomId
    ? `${roomId}_patched_${Date.now()}`
    : `patched_528_${Date.now()}`;

  console.log(`\n📋 準備寫入紀錄 ID：${recordId}`);
  console.log(`   房間代碼：${roomId || '（無）'}`);
  console.log(`   玩家數：${playersData.length}\n`);

  // 4. 組合 score_records 資料
  const playerUids = playersData.map(p => p.uid);
  const coachUid   = (await fsGet(`users?pageSize=1`, token)); // 取 coachId 用 token 本身

  // 用登入的 coachId（從 token 解碼簡易方式：查 users 集合）
  const coachUser = allUsers.find(u => u.email === 'wcgeso0221@gmail.com');
  const coachId   = coachUser?._id || '';
  const coachName = coachUser?.name || '執行師';

  const scoreData = {
    roomId:    roomId || '',
    roomName:  '5/28 補寫紀錄',
    sessionId: recordId,
    settledAt: now,
    gameTime:  '60 分鐘',
    coach:     coachName,
    coachId:   coachId,
    players:   playersData.map(p => ({
      uid:         p.uid,
      name:        p.name,
      profession:  p.profession,
      happiness:   p.happiness,
      cash:        p.cash,
      assets:      p.assets,
      liabilities: p.liabilities,
      income:      p.income,
      expenses:    p.expenses,
      history:     p.history,
      happinessItems: p.happinessItems,
      loans:       p.loans,
      totalScore:  p.totalScore,
      summary:     p.summary,
    })),
    playerUids,
    isFinal:   true,
    isPatch:   true,
    patchedAt: now,
    patchNote: '由 patch-coach-record.mjs 從 player_sessions 補寫',
  };

  const coachRecord = {
    date:        now,
    roomCode:    roomId || 'PATCHED',
    roomName:    '5/28 補寫紀錄',
    playerCount: playersData.length,
    duration:    60,
    coachId:     coachId,
    coachName:   coachName,
    timestamp:   Date.now(),
    isFinal:     true,
    isPatch:     true,
    patchedAt:   now,
    players:     playersData.map(p => ({
      name:       p.name,
      profession: p.profession,
      happiness:  p.happiness,
      score:      p.totalScore,
      isWin:      p.happiness >= 100,
    })),
    updatedAt:   now,
  };

  // 5. 寫入 Firestore
  console.log('💾 寫入 score_records...');
  await fsPatch(
    `score_records/S1/records/${recordId}`,
    objToFsFields(scoreData),
    token
  );
  console.log('  ✓ score_records 已寫入');

  console.log('💾 寫入 coach_records...');
  await fsPatch(
    `coach_records/${recordId}`,
    objToFsFields(coachRecord),
    token
  );
  console.log('  ✓ coach_records 已寫入');

  console.log('\n🎉 完成！以下紀錄已補寫：');
  playersData.forEach(p =>
    console.log(`  • ${p.name}  幸福 ${p.happiness} 分  積分 ${p.totalScore}`)
  );
  console.log(`\n  紀錄 ID：${recordId}`);
  console.log('  重新整理後台頁面即可看到。');
}

main().catch(err => {
  console.error('\n✗ 錯誤：', err.message);
  process.exit(1);
});

// Production Firestore access for the production stress run.
//
// Uses the Firebase CLI login of whoever runs the script (`firebase login`),
// so no service-account key file is needed. The CLI's refresh token is copied
// into a private (0600) temp ADC file for this process only and deleted on
// exit. Only used by the E2E_TARGET=prod run, which writes to a dedicated test
// room and never touches other rooms.

import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);
export const PROD_PROJECT_ID = 'happinessflow-online';

let db;

export const getProdDb = () => {
  if (db) return db;
  const config = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'));
  const refreshToken = config?.tokens?.refresh_token;
  if (!refreshToken) throw new Error('找不到 Firebase CLI 登入資訊，請先執行 firebase login');
  const api = require('firebase-tools/lib/api');
  const dir = mkdtempSync(join(tmpdir(), 'hf-adc-'));
  const file = join(dir, 'adc.json');
  writeFileSync(file, JSON.stringify({
    type: 'authorized_user',
    client_id: api.clientId(),
    client_secret: api.clientSecret(),
    refresh_token: refreshToken,
  }), { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = file;
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
  const app = getApps()[0] ?? initializeApp({ projectId: PROD_PROJECT_ID, credential: applicationDefault() });
  db = getFirestore(app);
  return db;
};

// Switches the E2E suite between the local emulator (default) and the
// production project. Production is opt-in via E2E_TARGET=prod and reads the
// accounts from environment variables so no password lives in the repo.
import { getEmulatorDb } from '../../scripts/e2e/adminClient.mjs';
import { getProdDb } from '../../scripts/e2e/prodAdmin.mjs';
import { seedAccounts, TEST_ACCOUNTS } from '../../scripts/e2e/seedAccounts.mjs';

export const IS_PROD = process.env.E2E_TARGET === 'prod';

export type E2EAccount = { email: string; password: string; name: string; role: 'coach' | 'player' };

const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`缺少環境變數 ${key}`);
  return value;
};

export const getAccounts = (playerCount: number): E2EAccount[] => {
  if (!IS_PROD) return TEST_ACCOUNTS as E2EAccount[];
  const coach: E2EAccount = {
    email: required('HF_E2E_COACH_EMAIL'),
    password: required('HF_E2E_COACH_PASSWORD'),
    name: process.env.HF_E2E_COACH_NAME || 'Coach',
    role: 'coach',
  };
  const players: E2EAccount[] = Array.from({ length: playerCount }, (_, index) => ({
    email: required(`HF_E2E_P${index + 1}_EMAIL`),
    password: required(`HF_E2E_P${index + 1}_PASSWORD`),
    name: required(`HF_E2E_P${index + 1}_NAME`),
    role: 'player',
  }));
  return [coach, ...players];
};

export const getDb = () => (IS_PROD ? getProdDb() : getEmulatorDb());
export const seedIfLocal = async () => { if (!IS_PROD) await seedAccounts(); };

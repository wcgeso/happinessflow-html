// Emulator-only Firebase Admin SDK bootstrap for local E2E tooling.
//
// This module refuses to initialize unless both FIRESTORE_EMULATOR_HOST and
// FIREBASE_AUTH_EMULATOR_HOST are set and point at localhost/127.0.0.1. That
// guards against accidentally running seed/reset scripts against the real
// production project.

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Must match the client app's default projectId in services/firebase.ts,
// since that's the project the emulator UI/data will be scoped under when
// the app itself has no VITE_FIREBASE_PROJECT_ID override.
export const PROJECT_ID = 'happinessflow-online';

const isLocalEmulatorHost = (value) => {
  if (!value) return false;
  const host = value.split(':')[0];
  return host === 'localhost' || host === '127.0.0.1';
};

const assertEmulatorEnv = () => {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (!isLocalEmulatorHost(firestoreHost)) {
    throw new Error(
      '[e2e/adminClient] Refusing to run: FIRESTORE_EMULATOR_HOST is not set to localhost. ' +
      'Got: ' + JSON.stringify(firestoreHost) + '. ' +
      'Set FIRESTORE_EMULATOR_HOST=localhost:8080 before running this script.'
    );
  }
  if (!isLocalEmulatorHost(authHost)) {
    throw new Error(
      '[e2e/adminClient] Refusing to run: FIREBASE_AUTH_EMULATOR_HOST is not set to localhost. ' +
      'Got: ' + JSON.stringify(authHost) + '. ' +
      'Set FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 before running this script.'
    );
  }
};

let appInstance;

export const getEmulatorApp = () => {
  assertEmulatorEnv();
  if (!appInstance) {
    appInstance = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  }
  return appInstance;
};

export const getEmulatorAuth = () => getAuth(getEmulatorApp());
export const getEmulatorDb = () => getFirestore(getEmulatorApp());

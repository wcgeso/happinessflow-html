
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithEmailAndPassword as _signInWithEmailAndPassword,
  signInWithPopup as _signInWithPopup,
  signInWithRedirect as _signInWithRedirect,
  getRedirectResult,
  signOut as _signOut,
  onAuthStateChanged as _onAuthStateChanged,
  setPersistence,
  OAuthProvider,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { debugLog } from '../src/utils/debugLog';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC9j-9nImSDSGgucGuaW6IHYBRiuvQ0-Mc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "happinessflow-online.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "happinessflow-online",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "happinessflow-online.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "338788521967",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:338788521967:web:327e29d8c849032e9e481a",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-JVQCEGCLNY",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://happinessflow-online-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// 登入只保留在目前瀏覽器工作階段；關閉分頁／瀏覽器後，下一次開啟必須重新登入。
// 同一分頁重新整理仍可保留登入，避免網路短暫中斷造成不必要的登出。
export const authPersistenceReady = setPersistence(auth, browserSessionPersistence);
// Emulator 只允許在本機 Vite 開發模式使用；正式／Preview build 一律連線雲端 Firebase。
const useFirebaseEmulator = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true';
const firestoreEmulatorUrl = useFirebaseEmulator ? import.meta.env.VITE_FIRESTORE_EMULATOR_URL : undefined;
const firestoreEmulatorEndpoint = firestoreEmulatorUrl ? new URL(firestoreEmulatorUrl) : null;
// 可在相同 build 上做 transport A/B：auto（目前預設）或 default（SDK 預設傳輸）。
// 不把 long polling 固定寫死，避免某些手機網路被迫使用較慢的傳輸方式。
const firestoreTransport = import.meta.env.VITE_FIRESTORE_TRANSPORT === 'default' ? 'default' : 'auto';
export const db = initializeFirestore(app, {
  ...(firestoreTransport === 'auto' ? { experimentalAutoDetectLongPolling: true } : {}),
  ...(firestoreEmulatorEndpoint
    ? {
        host: firestoreEmulatorEndpoint.host,
        ssl: firestoreEmulatorEndpoint.protocol === 'https:',
      }
    : {}),
});
if (import.meta.env.DEV) {
  console.info(`[Firebase] Firestore transport: ${firestoreTransport}`);
}

// 本地開發：連接 Firebase Emulator（VITE_USE_EMULATOR=true 時啟用）
if (useFirebaseEmulator) {
  connectAuthEmulator(
    auth,
    import.meta.env.VITE_AUTH_EMULATOR_URL || 'http://localhost:9099',
    { disableWarnings: true }
  );
  if (firestoreEmulatorEndpoint) {
    debugLog('%c🔧 Firebase Emulator 已透過遠端隧道啟用', 'color: #f59e0b; font-weight: bold');
  } else {
    connectFirestoreEmulator(db, 'localhost', 8080);
    debugLog('%c🔧 Firebase Emulator 已啟用（本地開發模式）', 'color: #f59e0b; font-weight: bold');
  }

}
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

// Add custom parameters to providers
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

appleProvider.setCustomParameters({
  locale: 'zh_TW'
});

// Export auth methods
export const signInWithEmailAndPassword = _signInWithEmailAndPassword;
export const signInWithPopup = _signInWithPopup;
export const signInWithRedirect = _signInWithRedirect;
export const signOut = _signOut;
export const onAuthStateChanged = _onAuthStateChanged;
export { getRedirectResult };

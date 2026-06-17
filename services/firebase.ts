
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword as _signInWithEmailAndPassword,
  signInWithPopup as _signInWithPopup,
  signInWithRedirect as _signInWithRedirect,
  getRedirectResult,
  signOut as _signOut,
  onAuthStateChanged as _onAuthStateChanged,
  OAuthProvider,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC9j-9nImSDSGgucGuaW6IHYBRiuvQ0-Mc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "happinessflow-online.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "happinessflow-online",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "happinessflow-online.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "338788521967",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:338788521967:web:327e29d8c849032e9e481a",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-JVQCEGCLNY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(app);

// 本地開發：連接 Firebase Emulator（VITE_USE_EMULATOR=true 時啟用）
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.log('%c🔧 Firebase Emulator 已啟用（本地開發模式）', 'color: #f59e0b; font-weight: bold');
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

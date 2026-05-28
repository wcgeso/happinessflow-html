
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
  apiKey: "AIzaSyDD6yXBqQ5qExLYvGFd8m3kSJYzRGu659g",
  authDomain: "happinessflow-63b2e.firebaseapp.com",
  projectId: "happinessflow-63b2e",
  storageBucket: "happinessflow-63b2e.firebasestorage.app",
  messagingSenderId: "663631477568",
  appId: "1:663631477568:web:9587c1dc9a3df6d749d8a5",
  measurementId: "G-8BTEG67DMF"
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

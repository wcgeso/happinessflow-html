
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
  OAuthProvider
} from 'firebase/auth';
import {
  initializeFirestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDD6yXBqQ5qExLYvGFd8m3kSJYzRGu659g",
  authDomain: "happinessflow.vercel.app",
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

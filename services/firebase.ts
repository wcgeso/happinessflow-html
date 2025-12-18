
import { initializeApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyAqRtzNpXozMB3obu2S-nwdWVQ7Uu01gYA",
  authDomain: "the-happeniss-flow-game.firebaseapp.com",
  projectId: "the-happeniss-flow-game",
  storageBucket: "the-happeniss-flow-game.firebasestorage.app",
  messagingSenderId: "54477291050",
  appId: "1:54477291050:web:8efff9dbb79f6b4fb90d53",
  measurementId: "G-K2Z04E3XRV"
};

let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

// 在本機環境 (localhost) 時關閉 Firebase，讓遊戲可以只用本地狀態運行
const isLocalEnv =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

if (!isLocalEnv) {
  try {
    const app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

export const auth = authInstance;
export const db = dbInstance;
export const googleProvider = new GoogleAuthProvider();

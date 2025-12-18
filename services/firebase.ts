
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  Auth, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword as _signInWithEmailAndPassword,
  signInWithPopup as _signInWithPopup,
  signOut as _signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';

// 模擬的用戶數據
const MOCK_USER = {
  uid: 'local-user-123',
  email: 'local@example.com',
  displayName: '本地測試用戶',
  photoURL: null,
  emailVerified: true
};

// 模擬的遊戲數據
const MOCK_GAME_DATA = {
  profession: '釀蜜師',
  cash: 100000,
  assets: [],
  liabilities: [],
  currentRound: 1,
  happiness: 50,
  lastUpdated: new Date().toISOString()
};

// 創建模擬的 auth 和 db 實例
const createMockAuth = () => ({
  currentUser: MOCK_USER,
  onAuthStateChanged: (callback: (user: any) => void) => {
    callback(MOCK_USER);
    return () => {}; // 返回一個空的取消訂閱函數
  },
  signInWithEmailAndPassword: async (email: string, password: string) => ({
    user: MOCK_USER
  }),
  signInWithPopup: async () => ({
    user: MOCK_USER
  }),
  signOut: async () => {}
});

const createMockDb = () => ({
  collection: (name: string) => ({
    doc: (id: string) => ({
      get: async () => ({
        exists: () => true,
        data: () => MOCK_GAME_DATA,
        id: 'local-game-123'
      }),
      set: async (data: any) => {
        console.log('Saving game data:', data);
        return Promise.resolve();
      },
      update: async (data: any) => {
        console.log('Updating game data:', data);
        return Promise.resolve();
      },
      delete: async () => {
        console.log('Deleting game data');
        return Promise.resolve();
      }
    }),
    where: () => ({
      get: async () => ({
        docs: [{
          id: 'local-game-123',
          data: () => MOCK_GAME_DATA,
          ref: { id: 'local-game-123' }
        }]
      })
    }),
    add: async (data: any) => {
      console.log('Adding document:', data);
      return { id: 'new-doc-' + Date.now() };
    },
    get: async () => ({
      docs: [{
        id: 'local-game-123',
        data: () => MOCK_GAME_DATA,
        ref: { id: 'local-game-123' }
      }]
    })
  })
});

// 檢查是否為本地環境
const isLocalEnv =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname === '');

let authInstance: any = null;
let dbInstance: any = null;

if (isLocalEnv) {
  console.log('Running in local development mode with mock data');
  authInstance = createMockAuth();
  dbInstance = createMockDb();
} else {
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyAqRtzNpXozMB3obu2S-nwdWVQ7Uu01gYA",
      authDomain: "the-happeniss-flow-game.firebaseapp.com",
      projectId: "the-happeniss-flow-game",
      storageBucket: "the-happeniss-flow-game.firebasestorage.app",
      messagingSenderId: "54477291050",
      appId: "1:54477291050:web:8efff9dbb79f6b4fb90d53",
      measurementId: "G-K2Z04E3XRV"
    };
    
    const app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
  } catch (error) {
    console.error("Firebase initialization failed, falling back to mock data:", error);
    authInstance = createMockAuth();
    dbInstance = createMockDb();
  }
}

// 導出模擬的 auth 方法
export const auth = authInstance;
export const db = dbInstance;
export const googleProvider = new GoogleAuthProvider();

// 導出模擬的登入方法
export const signInWithEmailAndPassword = isLocalEnv
  ? async (email: string, password: string) => ({
      user: MOCK_USER
    })
  : _signInWithEmailAndPassword;

export const signInWithPopup = isLocalEnv
  ? async () => ({
      user: MOCK_USER
    })
  : _signInWithPopup;

export const signOut = isLocalEnv
  ? async () => {}
  : _signOut;

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
} from 'firebase/auth';
import { auth, googleProvider, appleProvider, storage, db } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

interface User {
    uid: string;
    email: string;
    name: string;
    photoURL?: string;
    photoPosition?: string;
    photoScale?: string;
    creationTime?: string;
}

interface AuthContextValue {
    user: User | null;
    isLoadingAuth: boolean;
    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    loginWithApple: () => Promise<void>;
    register: (email: string, password: string, playerName: string) => Promise<void>;
    updateUserProfile: (name?: string, photoURL?: string, photoPosition?: string, photoScale?: string) => Promise<void>;
    uploadAvatar: (file: File) => Promise<string>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);

    useEffect(() => {
        if (!auth) {
            setIsLoadingAuth(false);
            return;
        }

        // Handle redirect result
        const checkRedirect = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result?.user) {
                    // User signed in with redirect
                    console.log('Redirect sign-in success');
                }
            } catch (error) {
                console.error('Redirect sign-in error:', error);
            }
        };
        checkRedirect();

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // 先設定基本資訊
                const basicUserInfo: User = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Player',
                    photoURL: firebaseUser.photoURL || 'bee',
                    creationTime: firebaseUser.metadata.creationTime
                };

                // 嘗試從 Firestore 獲取自定義頭像 (因為 Auth Profile 的 photoURL 有長度限制)
                try {
                    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        if (data.photoURL) basicUserInfo.photoURL = data.photoURL;
                        if (data.photoPosition) basicUserInfo.photoPosition = data.photoPosition;
                        if (data.photoScale) basicUserInfo.photoScale = data.photoScale;
                    }
                } catch (error) {
                    console.error('獲取 Firestore 使用者資料失敗:', error);
                }

                setUser(basicUserInfo);
            } else {
                setUser(null);
            }
            setIsLoadingAuth(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        setIsLoadingAuth(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            console.error('登入錯誤:', error);
            throw error; // 直接拋出原始錯誤，保留 .code 屬性
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const loginWithGoogle = async () => {
        try {
            console.log('Attempting Google login with popup...');
            await signInWithPopup(auth, googleProvider);
        } catch (error: any) {
            console.error('Google Popup Error:', error.code, error.message);
            
            // Fallback to redirect if popup is blocked or fails
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
                try {
                    console.log('Popup blocked, falling back to redirect...');
                    await signInWithRedirect(auth, googleProvider);
                } catch (redirectError: any) {
                    console.error('Google Redirect Error:', redirectError);
                    throw redirectError;
                }
            } else {
                throw error;
            }
        }
    };

    const loginWithApple = async () => {
        try {
            console.log('Attempting Apple login with popup...');
            await signInWithPopup(auth, appleProvider);
        } catch (error: any) {
            console.error('Apple Popup Error:', error.code, error.message);
            
            // Fallback to redirect if popup is blocked or fails
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
                try {
                    console.log('Popup blocked, falling back to redirect...');
                    await signInWithRedirect(auth, appleProvider);
                } catch (redirectError: any) {
                    console.error('Apple Redirect Error:', redirectError);
                    throw redirectError;
                }
            } else {
                throw error;
            }
        }
    };

    const register = async (email: string, password: string, playerName: string) => {
        setIsLoadingAuth(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const nickname = playerName.trim() || email.split('@')[0];
            await updateProfile(userCredential.user, { 
                displayName: nickname,
                photoURL: 'bee'
            });
            
            setUser({
                uid: userCredential.user.uid,
                email: userCredential.user.email || '',
                name: nickname,
                photoURL: 'bee',
                creationTime: userCredential.user.metadata.creationTime
            });
        } catch (error: any) {
            console.error('註冊錯誤:', error);
            throw error; // 直接拋出原始錯誤
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const updateUserProfile = async (name?: string, photoURL?: string, photoPosition?: string, photoScale?: string) => {
        if (!auth.currentUser) return;
        
        try {
            const isBase64 = photoURL?.startsWith('data:image');
            
            // 1. 更新 Firebase Auth Profile (僅限非 Base64 的短 URL)
            await updateProfile(auth.currentUser, {
                displayName: name || auth.currentUser.displayName,
                photoURL: isBase64 ? 'custom_avatar' : (photoURL || auth.currentUser.photoURL)
            });
            
            // 2. 更新 Firestore (儲存長 Base64 或一般資料)
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const updateData: any = {};
            if (name) updateData.name = name;
            if (photoURL) updateData.photoURL = photoURL;
            if (photoPosition) updateData.photoPosition = photoPosition;
            if (photoScale) updateData.photoScale = photoScale;
            
            try {
                await setDoc(userRef, updateData, { merge: true });
            } catch (fsError) {
                console.error('Firestore 更新失敗:', fsError);
            }
            
            // 3. 更新本地狀態
            setUser(prev => prev ? {
                ...prev,
                name: name || prev.name,
                photoURL: photoURL || prev.photoURL,
                photoPosition: photoPosition || prev.photoPosition,
                photoScale: photoScale || prev.photoScale
            } : null);
        } catch (error) {
            console.error('更新資料錯誤:', error);
            throw error;
        }
    };

    const uploadAvatar = async (file: File): Promise<string> => {
        if (!auth.currentUser) throw new Error('未登入');
        
        // 檢查檔案大小，建議限制在 500KB 以內以符合 Firestore 效能
        if (file.size > 500 * 1024) {
            throw new Error('照片檔案過大 (需小於 500KB)，請先壓縮後再上傳');
        }
        
        try {
            // 將檔案轉換為 Base64 字串
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // 直接更新個人資料中的 photoURL
            await updateUserProfile(undefined, base64);
            return base64;
        } catch (error) {
            console.error('頭像處理失敗:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            if (auth) {
                await signOut(auth);
            }
            setUser(null);
        } catch (error) {
            console.error('登出時發生錯誤:', error);
            throw new Error('登出失敗，請稍後再試');
        }
    };

    const value: AuthContextValue = {
        user,
        isLoadingAuth,
        login,
        loginWithGoogle,
        loginWithApple,
        register,
        updateUserProfile,
        uploadAvatar,
        logout
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

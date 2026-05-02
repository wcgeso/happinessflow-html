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
import { safeAsync } from '../utils/utils';
import { generateInviteCode, findUserByInviteCode, computeEffectiveCoachId } from '../utils/referralUtils';

interface User {
    uid: string;
    email: string;
    name: string;
    role: 'coach' | 'player' | 'gm';
    photoURL?: string;
    photoPosition?: string;
    photoScale?: string;
    creationTime?: string;
    title?: string;
    experience?: number; // 場次或積分
    rankScore?: number; // 排行榜積分：遊戲結算積分的累加
    inviteCode?: string;
    referredBy?: string;
    effectiveCoachId?: string;
}

export const isGM = (user: User | null): boolean => {
    if (!user) return false;
    return user.role === 'gm' || getUserTitle(user) === '遊戲管理員';
};

export const getUserTitle = (user: User | null, roleOverride?: 'coach' | 'player' | 'gm'): string => {
    if (!user) return '';
    
    // 優先判斷特殊唯一稱號
    const email = user.email?.toLowerCase() || '';
    const name = user.name?.toUpperCase() || '';
    if (
        user.title === '遊戲管理員' || 
        user.title === '管理員' || 
        email === 'gm0221@happinessflow.com' ||
        name === 'GM' ||
        name === 'GM0221' ||
        roleOverride === 'gm'
    ) return '遊戲管理員';
    if (user.title === '幸福實踐家') return '幸福實踐家';

    let currentRole: 'coach' | 'player' | 'gm' = user.role;
    if (roleOverride === 'coach') currentRole = 'coach';
    else if (roleOverride === 'player') currentRole = 'player';
    else if (roleOverride === 'gm') currentRole = 'gm';

    if (currentRole === 'gm') return '遊戲管理員';

    if (currentRole === 'coach') {
        const exp = user.experience || 0;
        if (exp >= 40) return '傳奇執行師';
        if (exp >= 20) return '資深執行師';
        return '蜂富執行師';
    } else {
        const exp = user.experience || 0;
        if (exp >= 1000 || user.title === '蜂后傳奇') return '蜂后傳奇';
        if (exp >= 500) return '蜂饒大師';
        if (exp >= 200) return '築夢家';
        if (exp >= 50) return '採蜜人';
        return '尋夢者';
    }
};

export const getTitleColor = (user: User | null, roleOverride?: 'coach' | 'player' | 'gm'): string => {
    if (!user) return 'text-slate-400';
    
    const title = getUserTitle(user, roleOverride);
    if (title === '遊戲管理員') return 'text-indigo-400';
    
    const currentRole = (roleOverride === 'gm' ? 'coach' : (roleOverride || user.role)) as 'coach' | 'player';
    if (currentRole === 'coach') return 'text-amber-500';
    
    // 玩家根據稱號有不同顏色
    switch (title) {
        case '幸福實踐家': return 'text-rose-400';
        case '蜂后傳奇': return 'text-amber-400';
        case '蜂饒大師': return 'text-purple-400';
        case '築夢家': return 'text-cyan-400';
        case '採蜜人': return 'text-emerald-400';
        default: return 'text-amber-500/80';
    }
};

export const getAvatarBorderStyle = (user: User | null, roleOverride?: 'coach' | 'player' | 'gm'): string => {
    if (!user) return 'border-slate-700';
    
    const title = getUserTitle(user, roleOverride);
    
    if (title === '遊戲管理員') {
        return 'border-2 animate-gm-border ring-1 ring-white/20';
    }

    // 執行師特殊邊框
    const currentRole = (roleOverride === 'gm' ? 'coach' : (roleOverride || user.role)) as 'coach' | 'player';
    if (currentRole === 'coach') {
        return 'border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
    }

    switch (title) {
        case '幸福實踐家':
            return 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)] animate-pulse';
        case '蜂后傳奇':
            return 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
        case '蜂饒大師':
            return 'border-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.4)]';
        case '築夢家':
            return 'border-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.3)]';
        case '採蜜人':
            return 'border-emerald-400';
        case '尋夢者':
        default:
            return 'border-slate-700';
    }
};

export const getBadgeGlowStyle = (user: User | null, roleOverride?: 'coach' | 'player' | 'gm'): string => {
    if (!user) return '';
    const title = getUserTitle(user, roleOverride);
    if (title === '幸福實踐家') return 'drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]';
    if (title === '蜂后傳奇') return 'drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]';
    if (title === '蜂饒大師') return 'drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]';
    
    const currentRole = (roleOverride === 'gm' ? 'coach' : (roleOverride || user.role)) as 'coach' | 'player';
    if (currentRole === 'coach' || title === '遊戲管理員') return 'drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return '';
};

export const getCoachBadge = (user: User | null, roleOverride?: 'coach' | 'player' | 'gm'): string => {
    if (!user) return '';
    const title = getUserTitle(user, roleOverride);
    // GM 帳號優先判斷
    if (title === '遊戲管理員' || user.email?.toLowerCase() === 'gm0221@happinessflow.com') return '/assets/badges/傳奇執行師-去背.png';
    
    const currentRole = (roleOverride === 'gm' ? 'coach' : (roleOverride || user.role)) as 'coach' | 'player';
    if (currentRole !== 'coach') return '';
    
    if (title === '傳奇執行師') return '/assets/badges/傳奇執行師-去背.png';
    if (title === '資深執行師') return '/assets/badges/資深執行師-去背.png';
    return '/assets/badges/蜂富執行師-去背.png';
};

export const getPlayerBadge = (user: User | null, roleOverride?: 'coach' | 'player' | 'gm'): string => {
    if (!user) return '';
    const title = getUserTitle(user, roleOverride);
    // GM 帳號優先判斷
    if (title === '遊戲管理員' || user.email?.toLowerCase() === 'gm0221@happinessflow.com') return '/assets/badges/傳奇執行師-去背.png';

    // 移除 role !== 'player' 的限制，讓執行師以玩家身份進入時也能顯示玩家徽章
    switch (title) {
        case '幸福實踐家': return '/assets/badges/幸福實踐家-去背.png';
        case '蜂后傳奇': return '/assets/badges/蜂后傳奇-去背.png';
        case '蜂饒大師': return '/assets/badges/蜂饒大師-去背.png';
        case '築夢家': return '/assets/badges/築夢家-去背.png';
        case '採蜜人': return '/assets/badges/採蜜人-去背.png';
        case '尋夢者': return '/assets/badges/尋夢者-去背.png';
        default: return '';
    }
};

interface AuthContextValue {
    user: User | null;
    isLoadingAuth: boolean;
    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    loginWithApple: () => Promise<void>;
    register: (email: string, password: string, playerName: string, refCode?: string) => Promise<void>;
    bindReferral: (inviteCode: string) => Promise<{ success: boolean; referrerName?: string; error?: string }>;
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
                const result = await safeAsync(getRedirectResult(auth));
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
                    role: 'player', // 預設角色
                    photoURL: firebaseUser.photoURL || 'bee',
                    creationTime: firebaseUser.metadata.creationTime
                };

                // GM 帳號特殊處理
                if (firebaseUser.email?.toLowerCase() === 'gm0221@happinessflow.com') {
                    basicUserInfo.role = 'coach';
                    basicUserInfo.title = '遊戲管理員';
                }

                // 嘗試從 Firestore 獲取自定義資料
                try {
                    const userDoc = await safeAsync(getDoc(doc(db, 'users', firebaseUser.uid)));
                    if (userDoc?.exists()) {
                        const data = userDoc.data();
                        if (data.role) basicUserInfo.role = data.role;
                        if (data.photoURL) basicUserInfo.photoURL = data.photoURL;
                        if (data.photoPosition) basicUserInfo.photoPosition = data.photoPosition;
                        if (data.photoScale) basicUserInfo.photoScale = data.photoScale;
                        if (data.title) basicUserInfo.title = data.title;
                        if (data.experience !== undefined) basicUserInfo.experience = data.experience;
                        if (data.rankScore !== undefined) basicUserInfo.rankScore = data.rankScore;
                        if (data.inviteCode) {
                            basicUserInfo.inviteCode = data.inviteCode;
                        } else {
                            // 舊帳號補齊邀請碼
                            const newCode = generateInviteCode();
                            basicUserInfo.inviteCode = newCode;
                            safeAsync(updateDoc(doc(db, 'users', firebaseUser.uid), { inviteCode: newCode }));
                        }
                        if (data.referredBy) basicUserInfo.referredBy = data.referredBy;
                        if (data.effectiveCoachId) basicUserInfo.effectiveCoachId = data.effectiveCoachId;
                    } else {
                        // 如果 Firestore 還沒資料（例如透過 Google/Apple 第三方登入），自動建立初始資料
                        const isGM = firebaseUser.email?.toLowerCase() === 'gm0221@happinessflow.com';
                        const initialRole: 'coach' | 'player' = isGM ? 'coach' : 'player';
                        const initialData = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            name: basicUserInfo.name,
                            role: initialRole,
                            title: isGM ? '遊戲管理員' : '',
                            photoURL: basicUserInfo.photoURL,
                            createdAt: new Date().toISOString()
                        };
                        await safeAsync(setDoc(doc(db, 'users', firebaseUser.uid), initialData, { merge: true }));
                        
                        // 更新本地狀態以匹配新建立的資料
                        basicUserInfo.role = initialRole;
                        basicUserInfo.title = initialData.title;
                    }
                } catch (error) {
                    console.error('獲取或初始化 Firestore 使用者資料失敗:', error);
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
            await safeAsync(signInWithEmailAndPassword(auth, email, password), null, (err) => { throw err; });
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const loginWithGoogle = async () => {
        try {
            console.log('Attempting Google login with popup...');
            await safeAsync(signInWithPopup(auth, googleProvider), null, (err) => { throw err; });
        } catch (error: any) {
            console.error('Google Popup Error:', error.code, error.message);
            
            // Fallback to redirect if popup is blocked or fails
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
                try {
                    console.log('Popup blocked, falling back to redirect...');
                    await safeAsync(signInWithRedirect(auth, googleProvider), null, (err) => { throw err; });
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
            await safeAsync(signInWithPopup(auth, appleProvider), null, (err) => { throw err; });
        } catch (error: any) {
            console.error('Apple Popup Error:', error.code, error.message);
            
            // Fallback to redirect if popup is blocked or fails
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
                try {
                    console.log('Popup blocked, falling back to redirect...');
                    await safeAsync(signInWithRedirect(auth, appleProvider), null, (err) => { throw err; });
                } catch (redirectError: any) {
                    console.error('Apple Redirect Error:', redirectError);
                    throw redirectError;
                }
            } else {
                throw error;
            }
        }
    };

    const register = async (email: string, password: string, playerName: string, refCode?: string) => {
        setIsLoadingAuth(true);
        try {
            const userCredential = await safeAsync(createUserWithEmailAndPassword(auth, email, password), null, (err) => { throw err; });
            if (!userCredential) return;

            const nickname = playerName.trim() || email.split('@')[0];
            const isGM = email.toLowerCase() === 'gm0221@happinessflow.com';
            const role = isGM ? 'coach' : 'player';
            const title = isGM ? '遊戲管理員' : '';
            const inviteCode = generateInviteCode();

            // 處理邀請碼綁定
            let referredBy: string | undefined;
            let effectiveCoachId: string | undefined;
            if (refCode) {
                const referrer = await findUserByInviteCode(refCode);
                if (referrer && referrer.uid !== userCredential.user.uid) {
                    referredBy = referrer.uid;
                    if (referrer.role === 'coach' || referrer.role === 'gm') {
                        effectiveCoachId = referrer.uid;
                    } else {
                        effectiveCoachId = (await computeEffectiveCoachId(referrer.uid)) || undefined;
                    }
                }
            }

            await safeAsync(updateProfile(userCredential.user, {
                displayName: nickname,
                photoURL: 'bee'
            }));

            await safeAsync(setDoc(doc(db, 'users', userCredential.user.uid), {
                uid: userCredential.user.uid,
                email: userCredential.user.email,
                name: nickname,
                role: role,
                title: title,
                photoURL: 'bee',
                inviteCode,
                ...(referredBy && { referredBy }),
                ...(effectiveCoachId && { effectiveCoachId })
            }, { merge: true }));

            setUser({
                uid: userCredential.user.uid,
                email: userCredential.user.email || '',
                name: nickname,
                role: role,
                title: title,
                photoURL: 'bee',
                inviteCode,
                referredBy,
                effectiveCoachId,
                creationTime: userCredential.user.metadata.creationTime
            });
        } catch (error: any) {
            console.error('註冊錯誤:', error);
            throw error;
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const bindReferral = async (inviteCode: string): Promise<{ success: boolean; referrerName?: string; error?: string }> => {
        if (!auth.currentUser || !user) return { success: false, error: '未登入' };
        if (user.referredBy) return { success: false, error: '已綁定邀請人，無法更改' };

        const referrer = await findUserByInviteCode(inviteCode);
        if (!referrer) return { success: false, error: '找不到此邀請碼' };
        if (referrer.uid === user.uid) return { success: false, error: '不能使用自己的邀請碼' };

        let effectiveCoachId: string | undefined;
        if (referrer.role === 'coach' || referrer.role === 'gm') {
            effectiveCoachId = referrer.uid;
        } else {
            effectiveCoachId = (await computeEffectiveCoachId(referrer.uid)) || undefined;
        }

        await updateDoc(doc(db, 'users', user.uid), {
            referredBy: referrer.uid,
            ...(effectiveCoachId && { effectiveCoachId })
        });
        setUser(prev => prev ? { ...prev, referredBy: referrer.uid, effectiveCoachId } : prev);
        return { success: true, referrerName: referrer.name };
    };

    const updateUserProfile = async (name?: string, photoURL?: string, photoPosition?: string, photoScale?: string) => {
        if (!auth.currentUser) return;
        
        try {
            const isBase64 = photoURL?.startsWith('data:image');
            
            // 1. 更新 Firebase Auth Profile (僅限非 Base64 的短 URL)
            await safeAsync(updateProfile(auth.currentUser, {
                displayName: name || auth.currentUser.displayName,
                photoURL: isBase64 ? 'custom_avatar' : (photoURL || auth.currentUser.photoURL)
            }));
            
            // 2. 更新 Firestore (儲存長 Base64 或一般資料)
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const updateData: any = {};
            if (name) updateData.name = name;
            if (photoURL) updateData.photoURL = photoURL;
            if (photoPosition) updateData.photoPosition = photoPosition;
            if (photoScale) updateData.photoScale = photoScale;
            
            try {
                await safeAsync(setDoc(userRef, updateData, { merge: true }));
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
                await safeAsync(signOut(auth));
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
        bindReferral,
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

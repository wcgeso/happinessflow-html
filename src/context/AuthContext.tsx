import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
} from 'firebase/auth';
import { auth } from '../../services/firebase';

interface User {
    email: string;
    name: string;
}

interface AuthContextValue {
    user: User | null;
    isLoadingAuth: boolean;
    login: (email: string, password: string, playerName: string) => Promise<void>;
    register: (email: string, password: string, playerName: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const isLocalEnv = false;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(
        isLocalEnv ? { email: 'local@example.com', name: '本地測試用戶' } : null
    );
    const [isLoadingAuth, setIsLoadingAuth] = useState(!isLocalEnv);

    useEffect(() => {
        if (!auth) {
            setIsLoadingAuth(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                setUser({
                    email: firebaseUser.email || '',
                    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Player'
                });
            } else {
                setUser(null);
            }
            setIsLoadingAuth(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string, playerName: string) => {
        setIsLoadingAuth(true);
        try {
            // Local development mode: direct login without verification
            setUser({
                email: email.trim() || 'local@example.com',
                name: playerName || email.split('@')[0] || '本地測試用戶'
            });
        } catch (error) {
            console.error('登入錯誤:', error);
            throw new Error('登入時發生錯誤');
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const register = async (email: string, password: string, playerName: string) => {
        if (auth) {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const nickname = playerName.trim() || email.split('@')[0];
                await updateProfile(userCredential.user, { displayName: nickname });
            } catch (error: any) {
                throw new Error(error.message || '註冊失敗');
            }
        } else {
            setUser({
                email,
                name: playerName || email.split('@')[0]
            });
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
        register,
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

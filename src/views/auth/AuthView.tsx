import React, { useState } from 'react';
import { Card, Button, Input } from '../../components/ui/ui';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { VERSION_DISPLAY, IS_DEV_VERSION } from '../../constants/version';
import SafeImage from '../../components/common/SafeImage';

export const AuthView: React.FC = () => {
    const { login, register, loginWithGoogle, loginWithApple } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isAppleLoading, setIsAppleLoading] = useState(false);

    const translateFirebaseError = (code: string) => {
        switch (code) {
            case 'auth/invalid-email':
                return '電子郵件格式不正確';
            case 'auth/user-disabled':
                return '此帳號已被停用';
            case 'auth/invalid-password':
            case 'auth/wrong-password':
                return '密碼錯誤';
            case 'auth/invalid-credential':
                return '電子郵件或密碼錯誤';
            case 'auth/user-not-found':
                return '找不到此帳號';
            case 'auth/email-already-in-use':
                return '此電子郵件已被註冊';
            case 'auth/operation-not-allowed':
                return '此登入方式未啟用';
            case 'auth/weak-password':
                return '密碼強度不足（至少 6 位數）';
            case 'auth/popup-closed-by-user':
                return '登入視窗已被關閉';
            case 'auth/network-request-failed':
                return '網路連線失敗，請檢查網路狀態';
            case 'auth/too-many-requests':
                return '嘗試次數過多，帳號已被暫時鎖定，請稍後再試';
            case 'auth/internal-error':
                return '系統內部錯誤，請稍後再試';
            default:
                return '發生錯誤，請稍後再試';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            // 處理特殊帳號 gm0221 (不分大小寫)
            const cleanEmail = email.trim();
            const cleanPassword = password.trim();
            let finalEmail = cleanEmail;
            let finalPassword = cleanPassword;
            const isGM = cleanEmail.toLowerCase() === 'gm0221' || cleanEmail.toLowerCase() === 'gm0221@happinessflow.com';
            
            if (isGM) {
                finalEmail = 'gm0221@happinessflow.com';
                // GM 帳號：如果密碼為空，或輸入為 gm0221，則自動帶入預設密碼
                if (!cleanPassword || cleanPassword === 'gm0221' || cleanEmail.toLowerCase() === 'gm0221') {
                    finalPassword = 'gm0221';
                }
            }

            if (isLogin) {
                try {
                    await login(finalEmail, finalPassword);
                } catch (err: any) {
                    // 如果是 GM 且登入失敗，嘗試自動註冊
                    if (isGM) {
                        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
                            try {
                                await register(finalEmail, finalPassword, 'GM0221');
                            } catch (regErr: any) {
                                if (regErr.code === 'auth/email-already-in-use') {
                                    setError('GM 帳號已存在但密碼不正確，請檢查密碼是否為 gm0221');
                                } else {
                                    throw regErr;
                                }
                            }
                        } else {
                            throw err;
                        }
                    } else {
                        throw err;
                    }
                }
            } else {
                await register(finalEmail, finalPassword, name);
            }
        } catch (err: any) {
            let errorMessage = translateFirebaseError(err.code);
            
            // 針對 gm0221 的特別提示
             if (email.toLowerCase() === 'gm0221') {
                 if (err.code === 'auth/invalid-credential' && isLogin) {
                     errorMessage = '密碼錯誤！請檢查大小寫（建議試試 GM0221 或 gm0221）';
                 } else if (err.code === 'auth/email-already-in-use' && !isLogin) {
                    errorMessage = '此帳號已完成註冊！請點擊下方「點此登入」直接進入遊戲';
                }
            }
            
            setError(errorMessage);
            setIsSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setIsGoogleLoading(true);
        try {
            await loginWithGoogle();
        } catch (err: any) {
            setError(translateFirebaseError(err.code));
            setIsGoogleLoading(false);
        }
    };

    const handleAppleLogin = async () => {
        setError(null);
        setIsAppleLoading(true);
        try {
            await loginWithApple();
        } catch (err: any) {
            setError(translateFirebaseError(err.code));
            setIsAppleLoading(false);
        }
    };

    const handleGMQuickLogin = async () => {
        setError(null);
        setIsSubmitting(true);
        const gmEmail = 'gm0221@happinessflow.com';
        const gmPass = 'gm0221';
        
        try {
            await login(gmEmail, gmPass);
        } catch (err: any) {
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
                try {
                    await register(gmEmail, gmPass, 'GM0221');
                } catch (regErr: any) {
                    if (regErr.code === 'auth/email-already-in-use') {
                        setError('GM 帳號已存在但密碼不是 gm0221，請聯繫開發者重設或使用正確密碼');
                    } else {
                        setError('GM 快速登入失敗：' + regErr.message);
                    }
                    setIsSubmitting(false);
                }
            } else {
                setError('GM 快速登入失敗：' + err.message);
                setIsSubmitting(false);
            }
        }
    };

    const handleInvalid = (e: React.FormEvent<HTMLInputElement>) => {
        const target = e.target as HTMLInputElement;
        
        if (target.validity.valueMissing) {
            target.setCustomValidity('請填寫此欄位');
        } else if (target.type === 'email' && target.validity.typeMismatch) {
            target.setCustomValidity('請輸入有效的電子郵件地址');
        } else if (target.type === 'email' && target.value && !target.value.includes('@')) {
            target.setCustomValidity('電子郵件地址必須包含 "@"');
        } else {
            target.setCustomValidity('');
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.checkValidity();
    };

    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
        (e.target as HTMLInputElement).setCustomValidity('');
    };

    return (
        <div className="flex-1 w-full bg-slate-950 flex flex-col items-center p-4 relative overflow-y-auto no-scrollbar" style={{ 
            paddingTop: 'calc(2rem + env(safe-area-inset-top))',
            paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))'
        }}>
            {/* Background Elements */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-950 to-black z-0"></div>
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-600/10 blur-[120px] rounded-full"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-700 my-auto flex flex-col justify-center min-h-fit">
                <div className="text-center mb-6 md:mb-10 pt-2">
                    {/* Circular Icon Container */}
                    <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-b from-amber-300 to-amber-600 shadow-[0_0_40px_rgba(245,158,11,0.2)] mb-4 md:mb-6 relative group transition-transform hover:scale-105 duration-500">
                        <div className="absolute inset-0 rounded-full bg-amber-400/10 blur-xl group-hover:blur-2xl transition-all"></div>
                        <span className="text-4xl md:text-5xl relative z-10 drop-shadow-xl select-none">🐝</span>
                    </div>

                    {/* Gradient Title */}
                    <h1 className="text-4xl md:text-5xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white via-amber-100 to-amber-500 tracking-tight">
                        蜂富人生
                    </h1>

                    {/* English Subtitle */}
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="h-[1px] w-5 bg-gradient-to-r from-transparent to-amber-500/40"></div>
                        <span className="text-amber-500/80 font-bold tracking-[0.25em] text-[9px] uppercase">Happiness Flow</span>
                        <div className="h-[1px] w-5 bg-gradient-to-l from-transparent to-amber-500/40"></div>
                    </div>

                    <p className="bg-clip-text text-transparent bg-gradient-to-b from-white via-amber-100 to-amber-500 font-bold text-xs tracking-wide">財務是為了實現幸福的人生而服務</p>
                </div>

                <Card className="bg-slate-900/40 backdrop-blur-2xl border-white/5 p-5 md:p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>

                    {error && (
                        <div className="mb-4 md:mb-6 p-3 md:p-4 bg-rose-500/10 border-l-4 border-rose-500 rounded-r-xl text-rose-200 text-xs md:text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-300 shadow-[0_4px_20px_rgba(244,63,94,0.15)]">
                            <div className="p-1.5 bg-rose-500/20 rounded-full shrink-0">
                                <AlertCircle size={16} className="text-rose-400" />
                            </div>
                            <span className="flex-1 leading-tight">{error}</span>
                        </div>
                    )}

                    {!isLogin && (
                        <h2 className="text-base md:text-lg font-bold text-white mb-4 md:mb-6 flex items-center justify-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10">
                                <UserPlus size={16} className="text-amber-400" />
                            </div>
                            <span className="tracking-tight">建立新帳號</span>
                        </h2>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
                        {!isLogin && (
                            <div className="space-y-1">
                                <div className="flex justify-between items-end px-1">
                                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">暱稱</label>
                                    <span className={`text-[8px] font-bold ${
                                        name.replace(/[\u3100-\u312F\u31A0-\u31BF]/g, '').length >= ( /[\u4e00-\u9fa5]/.test(name.replace(/[\u3100-\u312F\u31A0-\u31BF]/g, '')) ? 8 : 12) 
                                            ? 'text-amber-500' 
                                            : 'text-slate-500'
                                    }`}>
                                        {name.replace(/[\u3100-\u312F\u31A0-\u31BF]/g, '').length}/{/[\u4e00-\u9fa5]/.test(name.replace(/[\u3100-\u312F\u31A0-\u31BF]/g, '')) ? 8 : 12}
                                    </span>
                                </div>
                                <Input
                                    required
                                    value={name}
                                    onChange={(e) => {
                                                const val = e.target.value;
                                                // 排除注音符號後的有效長度
                                                const effectiveVal = val.replace(/[\u3100-\u312F\u31A0-\u31BF]/g, '');
                                                // 無論中英文，上限統一為 8 字
                                                const max = 8;
                                                if (effectiveVal.length <= max) {
                                                    setName(val);
                                                }
                                            }}
                                    onInvalid={handleInvalid}
                                    onInput={handleInput}
                                    onBlur={handleBlur}
                                    placeholder="輸入您的暱稱"
                                    className="bg-slate-950/50 border-white/5 focus:border-amber-500/50 transition-all h-10 text-sm"
                                />
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest ml-1">電子郵件 / 帳號</label>
                            <Input
                                type="text"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onInvalid={handleInvalid}
                                onInput={handleInput}
                                onBlur={handleBlur}
                                className="bg-slate-950/50 border-white/5 focus:border-amber-500/50 transition-all h-10 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest ml-1">密碼</label>
                            <Input
                                type="text"
                                required={email.toLowerCase() !== 'gm0221'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onInvalid={handleInvalid}
                                onInput={handleInput}
                                onBlur={handleBlur}
                                className="bg-slate-950/50 border-white/5 focus:border-amber-500/50 transition-all h-10 text-sm"
                            />
                        </div>

                        <Button
                            type="submit"
                            variant="amber"
                            disabled={isSubmitting || isGoogleLoading}
                            className="w-full py-3 text-sm font-black tracking-widest shadow-2xl mt-1 md:mt-2 transition-all active:scale-[0.98] shadow-amber-900/20"
                        >
                            {isSubmitting ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                    <span>處理中...</span>
                                </div>
                            ) : (
                                <>
                                    {isLogin ? '登入' : '立即開始'}
                                    <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </Button>
                    </form>

                    {isLogin && (
                        <>
                            <div className="relative my-4 md:my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-white/5"></div>
                                </div>
                                <div className="relative flex justify-center text-[9px] md:text-[10px] uppercase tracking-widest">
                                    <span className="bg-slate-900 px-3 text-slate-500 font-bold">或</span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={isSubmitting || isGoogleLoading}
                                className="w-full py-2.5 md:py-3 text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {isGoogleLoading ? (
                                    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <SafeImage src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                                )}
                                {isGoogleLoading ? '跳轉中...' : '使用 Google 登入'}
                            </Button>
                        </>
                    )}

                    <div className="mt-4 md:mt-6 pt-4 md:pt-5 border-t border-white/5 text-center flex flex-col gap-3 md:gap-4">
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-amber-500 hover:text-amber-400 text-[10px] md:text-[11px] font-medium transition-all flex items-center justify-center gap-2 w-full"
                        >
                            {isLogin ? '還沒有帳號？立即註冊' : '已經有帳號？點此登入'}
                        </button>

                        <div className="flex items-center justify-center gap-4 text-[9px] md:text-[10px] text-slate-500 font-medium">
                            <a 
                                href="https://happinessflow.vercel.app/privacy.html" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:text-amber-500/80 transition-colors"
                            >
                                隱私權政策
                            </a>
                            <div className="w-[1px] h-2 bg-white/10"></div>
                            <a 
                                href="https://happinessflow.vercel.app/terms.html" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:text-amber-500/80 transition-colors"
                            >
                                服務條款
                            </a>
                        </div>
                        <div className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest mt-0.5 ${IS_DEV_VERSION ? 'text-amber-500' : 'text-slate-600'}`}>
                            {VERSION_DISPLAY}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

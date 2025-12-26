import React, { useState } from 'react';
import { Card, Button, Input } from '../../components/ui/ui';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, UserPlus, LogIn } from 'lucide-react';

export const AuthView: React.FC = () => {
    const { login, register } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLogin) {
            await login(email, password, '');
        } else {
            await register(email, password, name);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-950 to-black z-0"></div>
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-700">
                <div className="text-center mb-10 pt-2">
                    {/* Circular Icon Container */}
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-b from-amber-300 to-amber-600 shadow-[0_0_40px_rgba(245,158,11,0.2)] mb-6 relative group transition-transform hover:scale-105 duration-500">
                        <div className="absolute inset-0 rounded-full bg-amber-400/10 blur-xl group-hover:blur-2xl transition-all"></div>
                        <span className="text-5xl relative z-10 drop-shadow-xl select-none">🐝</span>
                    </div>

                    {/* Gradient Title */}
                    <h1 className="text-5xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white via-amber-100 to-amber-500 tracking-tight">
                        蜂富人生
                    </h1>

                    {/* English Subtitle */}
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="h-[1px] w-5 bg-gradient-to-r from-transparent to-amber-500/40"></div>
                        <span className="text-amber-500/80 font-bold tracking-[0.25em] text-[9px] uppercase">Happiness Flow</span>
                        <div className="h-[1px] w-5 bg-gradient-to-l from-transparent to-amber-500/40"></div>
                    </div>

                    <p className="text-slate-400 font-medium text-xs opacity-80 tracking-wide">財務是為了實現幸福的人生而服務</p>
                </div>

                <Card className="bg-slate-900/40 backdrop-blur-2xl border-white/5 p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>

                    {!isLogin && (
                        <h2 className="text-lg font-bold text-white mb-6 flex items-center justify-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-500/10">
                                <UserPlus size={18} className="text-indigo-400" />
                            </div>
                            <span className="tracking-tight">建立新帳號</span>
                        </h2>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">暱稱</label>
                                <Input
                                    required
                                    placeholder="您的稱呼"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-slate-950/50 border-white/5 focus:border-amber-500/50 transition-all h-10 text-sm"
                                />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">電子郵件</label>
                            <Input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-slate-950/50 border-white/5 focus:border-amber-500/50 transition-all h-10 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">密碼</label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-slate-950/50 border-white/5 focus:border-amber-500/50 transition-all h-10 text-sm"
                            />
                        </div>

                        <Button
                            type="submit"
                            className={`w-full py-3.5 text-sm font-black tracking-widest shadow-2xl mt-2 transition-all active:scale-[0.98] ${isLogin
                                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-900/20'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
                                }`}
                        >
                            {isLogin ? '登入系統' : '立即開始'}
                            <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-white/5 text-center">
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-slate-500 hover:text-amber-500 text-[11px] font-medium transition-all flex items-center justify-center gap-2 w-full"
                        >
                            {isLogin ? '還沒有帳號？探索財富自由' : '已經有快速通行證？點此登入'}
                        </button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

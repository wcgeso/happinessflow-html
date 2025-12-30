import React from 'react';
import { Button } from '../../components/ui';

type LoginViewProps = {
  onLogin: (email: string, password: string) => void;
  onSwitchToRegister: () => void;
  error?: string;
};

export const LoginView: React.FC<LoginViewProps> = ({ 
  onLogin, 
  onSwitchToRegister,
  error 
}) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">登入帳號</h2>
          
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                電子郵件
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                密碼
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            
            <Button type="submit" variant="amber" className="w-full py-2.5">
              登入
            </Button>
            
            <div className="text-center text-sm text-slate-400 mt-4">
              還沒有帳號？{' '}
              <button 
                type="button" 
                onClick={onSwitchToRegister}
                className="text-amber-500 hover:text-amber-400 font-medium"
              >
                註冊新帳號
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

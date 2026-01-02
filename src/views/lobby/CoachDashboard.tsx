import React from 'react';
import { Play, Users, Clock, TrendingUp, PlusCircle } from 'lucide-react';

interface CoachDashboardProps {
  onCreateGame: () => void;
  onViewHistory: () => void;
  userStats: any;
}

export const CoachDashboard: React.FC<CoachDashboardProps> = ({ onCreateGame, onViewHistory, userStats }) => {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Coach Welcome & Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 p-6 bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/20 rounded-3xl backdrop-blur-md flex flex-col justify-center">
          <h3 className="text-2xl font-black text-white mb-2">執行師管理中心</h3>
          <p className="text-amber-200/60 text-sm font-medium">
            歡迎回來！今天準備帶領哪一場精彩的財富覺醒之旅？
          </p>
        </div>
        <div className="p-6 bg-slate-900/50 border border-slate-800/50 rounded-3xl backdrop-blur-sm flex flex-col items-center justify-center text-center">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">帶領場次</div>
          <div className="text-3xl font-black text-amber-500">{userStats.totalGames}</div>
          <div className="absolute top-3 right-3 opacity-10">
            <TrendingUp size={20} className="text-amber-500" />
          </div>
        </div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Create Game Card */}
        <button 
          onClick={onCreateGame}
          className="group relative p-1 overflow-hidden rounded-3xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-amber-500/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600 animate-gradient-xy" />
          <div className="relative p-8 bg-amber-500 rounded-[22px] flex flex-col items-start text-left overflow-hidden min-h-[200px]">
            <div className="absolute -right-8 -bottom-8 opacity-10 rotate-12 transition-transform group-hover:scale-110 group-hover:rotate-0 duration-500">
              <PlusCircle size={160} className="fill-white" />
            </div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-inner">
              <Play size={24} className="text-white fill-white translate-x-0.5" />
            </div>
            <span className="text-3xl font-black text-white mb-2 tracking-tight">建立新遊戲</span>
            <span className="text-amber-500/20 font-black absolute top-4 right-6 text-6xl select-none">CREATE</span>
            <p className="text-amber-100/90 text-sm font-medium max-w-[200px] leading-relaxed">
              設定人數、時間，開啟一場全新的遊戲房間
            </p>
          </div>
        </button>

        {/* Coach Tools Grid */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={onViewHistory}
            className="group p-6 bg-slate-900/50 border border-slate-800/50 rounded-3xl hover:bg-slate-800/50 hover:border-amber-500/30 transition-all flex flex-col items-start text-left relative overflow-hidden"
          >
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <Clock size={20} className="text-blue-500" />
            </div>
            <span className="text-lg font-black text-white mb-1">帶領紀錄</span>
            <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">History</span>
          </button>

          <button 
            className="group p-6 bg-slate-900/50 border border-slate-800/50 rounded-3xl hover:bg-slate-800/50 hover:border-emerald-500/30 transition-all flex flex-col items-start text-left relative overflow-hidden"
          >
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <Users size={20} className="text-emerald-500" />
            </div>
            <span className="text-lg font-black text-white mb-1">學員管理</span>
            <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Students</span>
            <div className="absolute top-2 right-2 px-2 py-0.5 bg-slate-800 text-slate-500 text-[8px] font-bold rounded-full border border-slate-700">
              即將推出
            </div>
          </button>

          <div className="col-span-2 p-5 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-slate-400">目前暫無進行中的房間</span>
            </div>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Active Rooms</span>
          </div>
        </div>
      </div>
    </div>
  );
};

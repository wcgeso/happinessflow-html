import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { Card } from '../../components/ui/ui';
import { LogOut, Award, Play, History, User, BookOpen, Mail } from 'lucide-react';
import { AvatarModal, TutorialModal, LetterToPlayersModal } from '../../components/modals';

interface LobbyViewProps {
  user: { name: string; email: string } | null;
  onLogout: () => void;
  onCreateReport: () => void;
  onViewHistory: () => void;
  onViewAchievements: () => void; 
}

export const LobbyView: React.FC<LobbyViewProps> = ({ user, onLogout, onCreateReport, onViewHistory, onViewAchievements }) => {
  const { gameHistory } = useGame();
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('default');

  const userStats = React.useMemo(() => {
    if (gameHistory.length === 0) return { totalGames: 0, winRate: 0, totalScore: 0, happinessRate: 0 };
    const totalGames = gameHistory.length;
    const wins = gameHistory.filter(g => g.isWin).length;
    const totalScore = gameHistory.reduce((sum, g) => sum + g.finalScore, 0);
    const totalHappiness = gameHistory.reduce((sum, g) => sum + (g.happinessScore || 0), 0);
    // 幸福達成率以平均幸福指數除以 100 作為百分比基準
    const happinessRate = Math.round((totalHappiness / (totalGames * 100)) * 100);
    return { 
      totalGames, 
      winRate: Math.round((wins / totalGames) * 100), 
      totalScore,
      happinessRate: Math.min(100, happinessRate) // 確保不超過 100%
    };
  }, [gameHistory]);

  return (
    <div className="h-screen bg-slate-950 flex flex-col relative overflow-hidden select-none">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
      </div>

      {/* Header Bar - Fixed Height */}
      <div className="relative z-10 px-6 py-4 h-20 flex justify-between items-center border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/50 shrink-0">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full bg-slate-900 border-2 border-yellow-500/50 flex items-center justify-center cursor-pointer hover:border-yellow-400 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all group"
            onClick={() => setShowAvatarModal(true)}
          >
            <User size={24} className="text-yellow-400 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">歡迎回來</div>
            <h2 className="text-lg font-black text-white leading-tight">{user?.name || '幸福拓荒者'}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onLogout} 
            className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent rounded-xl transition-all text-sm font-medium"
          >
            <LogOut size={18} />
            <span>登出</span>
          </button>
        </div>
      </div>
      
      <div className="relative z-10 flex-1 flex flex-col px-6 py-4 max-w-2xl mx-auto w-full overflow-hidden">
        {/* Main Content Area - Auto Scaling */}
        <div className="flex-1 flex flex-col justify-center gap-6 lg:gap-8">
          {/* Logo Section */}
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-100 to-amber-500 tracking-tight mb-2">
              蜂富人生
            </h1>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-[1px] w-5 bg-gradient-to-r from-transparent to-amber-500/40"></div>
              <span className="text-amber-500/80 font-bold tracking-[0.25em] text-[10px] md:text-xs uppercase">Happiness Flow</span>
              <div className="h-[1px] w-5 bg-gradient-to-l from-transparent to-amber-500/40"></div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-2 md:gap-4">
            {[
              { label: '平均幸福指數', value: userStats.happinessRate, color: 'text-pink-400', icon: Award },
              { label: '賽季總積分', value: userStats.totalScore, color: 'text-yellow-400', icon: Award },
              { label: '勝率', value: `${userStats.winRate}%`, color: 'text-emerald-400', icon: History },
              { label: '遊玩局數', value: userStats.totalGames, color: 'text-blue-400', icon: Play },
            ].map((stat, i) => (
              <div key={i} className="group relative p-2 md:p-4 bg-slate-900/50 border border-slate-800/50 rounded-2xl backdrop-blur-sm hover:bg-slate-800/50 hover:border-slate-700/50 transition-all flex flex-col items-center text-center">
                <div className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 md:mb-2">{stat.label}</div>
                <div className={`text-lg md:text-3xl font-black ${stat.color} mb-1`}>{stat.value}</div>
                <div className="absolute top-1 right-1 md:top-2 md:right-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <stat.icon size={10} className="md:w-[14px] md:h-[14px]" />
                </div>
              </div>
            ))}
          </div>

          {/* Main Actions Container */}
          <div className="flex flex-col gap-3 md:gap-4">
            {/* Primary Action: Start Game */}
            <button 
              onClick={onCreateReport} 
              className="group relative p-1 overflow-hidden rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-2xl shadow-emerald-500/20"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 animate-gradient-x" />
              <div className="relative p-5 md:p-6 bg-emerald-600 rounded-2xl flex items-center justify-between overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                  <Play size={100} className="fill-white" />
                </div>
                <div className="flex flex-col text-left relative z-10"> 
                  <span className="text-2xl md:text-3xl font-black text-white mb-0.5 tracking-tight">開始新人生</span> 
                  <span className="text-emerald-100/80 text-xs md:text-sm font-medium">建立新財報，開啟您的財富覺醒之旅</span> 
                </div> 
                <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center relative z-10 group-hover:bg-white/30 transition-colors shadow-inner"> 
                  <Play size={24} className="text-white fill-white translate-x-0.5" /> 
                </div> 
              </div> 
            </button>

            {/* Secondary Actions Grid */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {/* Achievements */}
              <button 
                onClick={onViewAchievements} 
                className="group relative p-4 md:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all flex flex-col gap-2 md:gap-3 text-left"
              > 
                <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors"> 
                  <Award size={18} className="text-amber-500" /> 
                </div> 
                <div className="flex flex-col"> 
                  <span className="text-base md:text-lg font-black text-white leading-tight whitespace-nowrap">成就獎勵</span> 
                  <span className="text-slate-500 text-[10px] md:text-xs mt-0.5">解鎖榮譽與目標</span> 
                </div> 
              </button>

              {/* History */}
              <button 
                onClick={onViewHistory} 
                className="group relative p-4 md:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all flex flex-col gap-2 md:gap-3 text-left"
              > 
                <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors"> 
                  <History size={18} className="text-blue-500" /> 
                </div> 
                <div className="flex flex-col"> 
                  <span className="text-base md:text-lg font-black text-white leading-tight whitespace-nowrap">歷史紀錄</span> 
                  <span className="text-slate-500 text-[10px] md:text-xs mt-0.5">回顧財報與數據</span> 
                </div> 
              </button>

              {/* Tutorial */}
              <button 
                onClick={() => setShowTutorialModal(true)} 
                className="group relative p-4 md:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all flex flex-col gap-2 md:gap-3 text-left"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors"> 
                  <BookOpen size={18} className="text-indigo-500" /> 
                </div> 
                <div className="flex flex-col"> 
                  <span className="text-base md:text-lg font-black text-white leading-tight whitespace-nowrap">遊戲教學</span> 
                  <span className="text-slate-500 text-[10px] md:text-xs mt-0.5">掌握致富的核心規則</span> 
                </div> 
              </button>

              {/* Letter to Players */}
              <button 
                onClick={() => setShowLetterModal(true)} 
                className="group relative p-4 md:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all flex flex-col gap-2 md:gap-3 text-left"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20 group-hover:bg-yellow-500/20 transition-colors relative"> 
                  <Mail size={18} className="text-yellow-400" /> 
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                </div> 
                <div className="flex flex-col"> 
                  <span className="text-base md:text-lg font-black text-white leading-tight whitespace-nowrap">給玩家的一封信</span> 
                  <span className="text-slate-500 text-[10px] md:text-xs mt-0.5 whitespace-nowrap">來自團隊的叮嚀與祝福</span> 
                </div> 
              </button>
            </div>
          </div>
        </div>

        {/* Footer info - Static bottom */}
        <div className="py-4 text-center shrink-0">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            v1.2.0 · Designed for Financial Awakening
          </p>
        </div>
      </div>

      {showLetterModal && (
        <LetterToPlayersModal
          isOpen={showLetterModal}
          onClose={() => setShowLetterModal(false)}
        />
      )}

      {showAvatarModal && (
        <AvatarModal
          isOpen={showAvatarModal}
          onClose={() => setShowAvatarModal(false)}
          selectedAvatar={selectedAvatar}
          onSelectAvatar={setSelectedAvatar}
        />
      )}

      {showTutorialModal && (
        <TutorialModal
          isOpen={showTutorialModal}
          onClose={() => setShowTutorialModal(false)}
        />
      )}
    </div>
  );
};

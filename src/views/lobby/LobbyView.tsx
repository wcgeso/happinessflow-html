import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useAuth, getUserTitle } from '../../context/AuthContext';
import { LogOut, Award, Play, History, BookOpen, Mail, Users, Scan } from 'lucide-react';
import { ProfileModal, TutorialModal, LetterToPlayersModal, avatarOptions, CreateRoomModal, QRScannerModal } from '../../components/modals';
import { RoomView } from './RoomView';
import { CoachDashboard } from './CoachDashboard';
import { VERSION_DISPLAY, IS_DEV_VERSION } from '../../constants/version';
import { useRoom } from '../../context/RoomContext';

interface LobbyViewProps {
  onLogout: () => void;
  onCreateReport: () => void;
  onResumeGame: () => void;
  onViewHistory: () => void;
  onViewAchievements: () => void; 
}

export const LobbyView: React.FC<LobbyViewProps> = ({ onLogout, onCreateReport, onResumeGame, onViewHistory, onViewAchievements }) => {
  const { gameHistory, gameState } = useGame();
  const { user } = useAuth();
  const { room, joinRoom, createRoom } = useRoom();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showRoomView, setShowRoomView] = useState(false);
  const [viewMode, setViewMode] = useState<'player' | 'coach'>(user?.role === 'coach' ? 'coach' : 'player');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // 處理 QR Code 掃描成功
  const handleScanSuccess = async (decodedText: string) => {
    setShowScanner(false);
    
    // 解析 URL 獲取房間碼，例如: http://localhost:5173/?room=123456
    let roomCode = decodedText;
    try {
      if (decodedText.includes('?room=')) {
        const url = new URL(decodedText);
        roomCode = url.searchParams.get('room') || decodedText;
      }
    } catch (e) {
      // 如果不是有效的 URL，就直接使用原始文字
    }

    // 清理房間碼 (只保留數字)
    roomCode = roomCode.replace(/\D/g, '').slice(0, 6);
    
    if (roomCode.length === 6) {
      setRoomCodeInput(roomCode);
      setIsJoiningRoom(true);
      setJoinError(null);
      try {
        await joinRoom(roomCode);
      } catch (err: any) {
        setJoinError(err.message);
      } finally {
        setIsJoiningRoom(false);
      }
    } else {
      setJoinError('無效的房間碼');
    }
  };

  // 處理 QR Code 房間碼自動加入
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode && user && !room) {
      joinRoom(roomCode).catch(console.error);
    }
  }, [user, room, joinRoom]);

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim()) return;
    setIsJoiningRoom(true);
    setJoinError(null);
    try {
      await joinRoom(roomCodeInput.trim());
    } catch (err: any) {
      setJoinError(err.message);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleCreateRoom = async (settings: { name: string; maxPlayers: number; duration: number }) => {
    try {
      // 這裡可以將 settings 傳給 createRoom，如果後端有支援
      await createRoom();
      setShowCreateRoomModal(false);
      setShowRoomView(true);
    } catch (err: any) {
      console.error('Create room error:', err);
    }
  };

  const [isLetterRead, setIsLetterRead] = useState(() => {
    return localStorage.getItem('letter_to_players_read') === 'true';
  });

  const handleOpenLetter = () => {
    setShowLetterModal(true);
    if (!isLetterRead) {
      setIsLetterRead(true);
      localStorage.setItem('letter_to_players_read', 'true');
    }
  };

  const userAvatar = React.useMemo(() => {
    if (!user) return null;
    const isCustom = user.photoURL?.startsWith('http') || user.photoURL?.startsWith('data:image');
    
    if (isCustom) {
       let position = { x: 50, y: 50 };
       let scale = 1;
       
       if (user.photoPosition) {
         try {
           position = JSON.parse(user.photoPosition);
         } catch (e) {
           position = { x: 50, y: parseInt(user.photoPosition) || 50 };
         }
       }
       if (user.photoScale) {
         scale = parseFloat(user.photoScale) || 1;
       }
 
       return (
         <img 
           src={user.photoURL} 
           alt="Avatar" 
           className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
           style={{ 
             objectPosition: `${position.x}% ${position.y}%`,
             transform: `scale(${scale})`
           }}
         />
       );
     }
     
     return (
       <div className="w-full h-full bg-gradient-to-b from-amber-300 to-amber-600 flex items-center justify-center text-2xl shadow-inner select-none group-hover:scale-110 transition-transform">
         🐝
       </div>
     );
   }, [user]);

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

  if (showRoomView || room) {
    return (
      <div className="h-[100dvh] bg-slate-950 flex flex-col relative overflow-hidden select-none touch-none">
        <RoomView onBack={() => setShowRoomView(false)} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-slate-950 flex flex-col relative overflow-hidden select-none touch-none">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
      </div>

      {/* Header Bar - Fixed Height */}
      <div className="relative z-10 px-6 py-4 h-20 flex justify-between items-center border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/50 shrink-0">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full bg-slate-900 border-2 border-yellow-500/50 flex items-center justify-center cursor-pointer hover:border-yellow-400 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all group overflow-hidden"
            onClick={() => setShowProfileModal(true)}
          >
            {userAvatar}
          </div>
          <div className="flex flex-col">
             <div className="flex items-center gap-2 mb-1">
               <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider shadow-sm ${
                 user?.role === 'coach' 
                   ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white' 
                   : 'bg-slate-800 text-amber-500 border border-amber-500/20'
               }`}>
                 {getUserTitle(user)}
               </span>
             </div>
             <div className="flex items-center gap-2">
               <h2 className="text-lg font-black text-white leading-tight">{user?.name || '幸福拓荒者'}</h2>
             </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'coach' && (
            <button 
              onClick={() => setViewMode(viewMode === 'player' ? 'coach' : 'player')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-[10px] font-black tracking-tight shadow-sm ${
                viewMode === 'coach' 
                  ? 'bg-amber-500 text-black shadow-amber-500/10' 
                  : 'bg-slate-800 text-slate-500 hover:text-white border border-slate-700/50'
              }`}
            >
              <Users size={12} />
              <span>{viewMode === 'coach' ? '玩家模式' : '執行師模式'}</span>
            </button>
          )}
          <button 
            onClick={onLogout} 
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-500 hover:text-white hover:bg-red-500/10 rounded-lg transition-all text-[10px] font-bold"
          >
            <LogOut size={14} />
            <span>登出</span>
          </button>
        </div>
      </div>
      
      <div className="relative z-10 flex-1 flex flex-col px-6 py-4 max-w-4xl mx-auto w-full overflow-hidden">
        {/* Main Content Area - Auto Scaling */}
        <div className="flex-1 flex flex-col justify-center gap-6 lg:gap-8">
          {/* Logo Section - Common to both modes */}
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-100 to-amber-500 tracking-tight mb-2">
              {viewMode === 'coach' ? '執行師後台' : '蜂富人生'}
            </h1>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-[1px] w-5 bg-gradient-to-r from-transparent to-amber-500/40"></div>
              <span className="text-amber-500/80 font-bold tracking-[0.25em] text-[10px] md:text-xs uppercase">
                {viewMode === 'coach' ? 'Coach Management' : 'Happiness Flow'}
              </span>
              <div className="h-[1px] w-5 bg-gradient-to-l from-transparent to-amber-500/40"></div>
            </div>
          </div>

          {viewMode === 'coach' ? (
            <CoachDashboard 
              onCreateGame={() => setShowCreateRoomModal(true)}
              onViewHistory={onViewHistory}
              userStats={userStats}
            />
          ) : (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-4 duration-500">
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
                {/* Primary Action: Continue Game */}
                {gameState.isSetup && (
                  <button 
                    onClick={onResumeGame} 
                    className="group relative p-1 overflow-hidden rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-2xl shadow-emerald-500/20"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-400 to-emerald-600 animate-gradient-x" />
                    <div className="relative p-5 md:p-6 bg-emerald-600 rounded-2xl flex items-center justify-between overflow-hidden">
                      <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                        <Play size={100} className="fill-white" />
                      </div>
                      <div className="flex flex-col text-left relative z-10"> 
                        <span className="text-2xl md:text-3xl font-black text-white mb-0.5 tracking-tight">繼續遊戲</span> 
                        <span className="text-emerald-100/80 text-xs md:text-sm font-medium">回到您的「{gameState.reportName || '我的財報'}」，繼續您的財富之旅</span> 
                      </div> 
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center relative z-10 group-hover:bg-white/30 transition-colors shadow-inner"> 
                        <Play size={24} className="text-white fill-white translate-x-0.5" /> 
                      </div> 
                    </div> 
                  </button>
                )}

                {/* Main Action Area - Player Only: Join Room */}
                {!gameState.isSetup && (
                  <div className="bg-slate-900/50 p-4 rounded-3xl border border-white/5 backdrop-blur-xl">
                    <div className="flex gap-2 h-14">
                      <div className="flex-[2] relative">
                        <input 
                          type="text" 
                          value={roomCodeInput}
                          onChange={(e) => setRoomCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="房間碼"
                          className="w-full h-full bg-slate-950 border-2 border-slate-800 rounded-xl px-4 text-xl font-black tracking-[0.2em] text-white placeholder:text-slate-700 placeholder:tracking-normal focus:border-amber-500 focus:bg-slate-900 transition-all outline-none"
                        />
                        {isJoiningRoom && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={handleJoinRoom}
                        disabled={roomCodeInput.length !== 6 || isJoiningRoom}
                        className="flex-1 h-full bg-gradient-to-r from-amber-500 to-yellow-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-black font-black text-sm rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5 px-2"
                      >
                        <Play size={16} className="fill-black" />
                        <span>加入</span>
                      </button>

                      <button 
                      onClick={() => setShowScanner(true)}
                      className="aspect-square h-full bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl transition-all active:scale-95 border border-slate-700 flex items-center justify-center shadow-lg"
                      title="掃碼"
                    >
                      <Scan size={18} />
                    </button>
                    </div>

                    {joinError && (
                      <div className="mt-2 text-red-400 text-xs font-bold flex items-center gap-1 animate-shake">
                        <div className="w-1 h-1 bg-red-400 rounded-full" />
                        {joinError}
                      </div>
                    )}
                  </div>
                )}

                {/* Secondary Actions Grid */}
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <button onClick={onViewAchievements} className="group relative p-4 md:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all flex flex-col gap-2 text-left"> 
                    <div className="w-10 h-10 bg-pink-500/10 rounded-xl flex items-center justify-center border border-pink-500/20 group-hover:bg-pink-500/20 transition-colors"> 
                      <Award size={20} className="text-pink-500" /> 
                    </div> 
                    <div className="flex flex-col"> 
                      <span className="text-lg font-black text-white leading-tight">成就獎勵</span> 
                      <span className="text-slate-500 text-xs mt-0.5">解鎖榮譽與目標</span> 
                    </div> 
                  </button>

                  <button onClick={onViewHistory} className="group relative p-4 md:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all flex flex-col gap-2 text-left"> 
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors"> 
                      <History size={20} className="text-emerald-500" /> 
                    </div> 
                    <div className="flex flex-col"> 
                      <span className="text-lg font-black text-white leading-tight">歷史紀錄</span> 
                      <span className="text-slate-500 text-xs mt-0.5">回顧財報與數據</span> 
                    </div> 
                  </button>

                  <button 
                    onClick={() => setShowTutorialModal(true)} 
                    className="group relative p-4 md:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all flex flex-col gap-2 text-left"
                  >
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors"> 
                      <BookOpen size={20} className="text-blue-500" /> 
                    </div> 
                    <div className="flex flex-col"> 
                      <span className="text-lg font-black text-white leading-tight">遊戲教學</span> 
                      <span className="text-slate-500 text-xs mt-0.5">掌握致富的核心規則</span> 
                    </div> 
                  </button>

                  <button 
                    onClick={handleOpenLetter} 
                    className="group relative p-4 md:p-5 bg-slate-900/80 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all flex flex-col gap-2 text-left"
                  >
                    <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20 group-hover:bg-yellow-500/20 transition-colors relative"> 
                      <Mail size={20} className="text-yellow-500" /> 
                      {!isLetterRead && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                      )}
                    </div> 
                    <div className="flex flex-col"> 
                      <span className="text-lg font-black text-white leading-tight">給玩家的一封信</span> 
                      <span className="text-slate-500 text-xs mt-0.5">來自團隊的叮嚀與祝福</span> 
                    </div> 
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info - Static bottom */}
        <div className="py-4 text-center shrink-0 flex flex-col gap-2">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${IS_DEV_VERSION ? 'text-amber-500' : 'text-slate-600'}`}>
            {VERSION_DISPLAY}
          </p>
          <div className="flex items-center justify-center gap-3 text-[10px] text-slate-600 font-medium">
            <a 
              href="https://happinessflow.vercel.app/privacy.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-amber-500/60 transition-colors"
            >
              隱私權政策
            </a>
            <div className="w-[1px] h-2 bg-slate-800"></div>
            <a 
              href="https://happinessflow.vercel.app/terms.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-amber-500/60 transition-colors"
            >
              服務條款
            </a>
          </div>
        </div>
      </div>

      {showLetterModal && (
        <LetterToPlayersModal 
          isOpen={showLetterModal} 
          onClose={() => setShowLetterModal(false)} 
        />
      )}

      {showCreateRoomModal && (
        <CreateRoomModal
          isOpen={showCreateRoomModal}
          onClose={() => setShowCreateRoomModal(false)}
          onCreate={handleCreateRoom}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {showScanner && (
        <QRScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScanSuccess={handleScanSuccess}
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

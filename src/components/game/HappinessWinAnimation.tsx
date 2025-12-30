import React, { useEffect, useState } from 'react';
import { Star, Heart, Trophy, Sparkles } from 'lucide-react';

interface HappinessWinAnimationProps {
  onComplete: () => void;
}

export const HappinessWinAnimation: React.FC<HappinessWinAnimationProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'pre-intro' | 'buildup' | 'peak' | 'main' | 'outro'>('pre-intro');
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    // 立即進入 buildup 狀態，消除靜態「圖片感」
    setPhase('buildup');
    
    // 精準動效時序調整
    const timer2 = setTimeout(() => setPhase('peak'), 4000);     // 4.0s: 能量聚集頂峰
    const timer3 = setTimeout(() => setPhase('main'), 7500);     // 7.5s: 華麗綻放標題
    const timer4 = setTimeout(() => setCanClose(true), 9500);    // 9.5s: 顯示交互提示

    return () => {
      [timer2, timer3, timer4].forEach(clearTimeout);
    };
  }, []);

  const handleClose = () => {
    if (!canClose) return;
    setPhase('outro');
    setTimeout(onComplete, 1000);
  };

  // 生成煙火位置的固定數組，避免重新渲染時跳動
  const [fireworkConfigs] = useState(() => [...Array(8)].map((_, i) => ({
    left: `${15 + Math.random() * 70}%`,
    top: `${15 + Math.random() * 50}%`,
    delay: i * 0.6
  })));

  return (
    <div 
      className={`fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden cursor-pointer animate-in fade-in zoom-in-95 duration-1000 ease-out ${canClose ? 'pointer-events-auto' : 'pointer-events-none'}`}
      onClick={handleClose}
    >
      {/* 0. 煙火放射特效層 (Fireworks) - 提升 z-index 確保可見 */}
      {(phase === 'buildup' || phase === 'peak' || phase === 'main') && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {fireworkConfigs.map((config, fireworkIndex) => (
            <div key={fireworkIndex} className="absolute" 
                 style={{ 
                   left: config.left, 
                   top: config.top,
                   animation: `firework-launch 2s ease-out infinite`,
                   animationDelay: `${config.delay}s`
                 }}>
              {[...Array(24)].map((_, particleIndex) => {
                return (
                  <div key={particleIndex} className="absolute w-1.5 h-1.5 rounded-full"
                       style={{
                         backgroundColor: ['#ff0000', '#ffd700', '#00ff00', '#00ffff', '#ff00ff', '#ffffff'][particleIndex % 6],
                         boxShadow: `0 0 12px currentColor`,
                         animation: `firework-particle-${fireworkIndex}-${particleIndex} 2s ease-out infinite`,
                         animationDelay: `${config.delay}s`
                       }} />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* 1. 動態背景層：深邃星空與光束 */}
      <div className={`absolute inset-0 bg-slate-950 transition-opacity duration-1000 ${phase === 'outro' ? 'opacity-0' : 'opacity-100'}`}>
        {/* 旋轉光束 (Radial Rays) */}
        <div className={`absolute inset-0 opacity-40 transition-transform duration-[15000ms] ease-linear animate-smooth-rotate ${phase !== 'pre-intro' ? 'scale-150' : 'scale-100'}`}
             style={{ background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(236,72,153,0.3) 30deg, transparent 60deg, rgba(250,204,21,0.3) 90deg, transparent 120deg)' }} />
        
        {/* 漂浮粒子背景 */}
        <div className="absolute inset-0">
          {[...Array(40)].map((_, i) => (
            <div key={i} className="absolute animate-pulse" 
                 style={{ 
                   left: `${Math.random() * 100}%`, 
                   top: `${Math.random() * 100}%`,
                   width: `${Math.random() * 4}px`,
                   height: `${Math.random() * 4}px`,
                   backgroundColor: i % 2 === 0 ? '#ec4899' : '#facc15',
                   boxShadow: `0 0 15px ${i % 2 === 0 ? '#ec4899' : '#facc15'}`,
                   animationDelay: `${Math.random() * 5}s`
                 }} />
          ))}
        </div>
      </div>

      {/* 2. 核心內容層 - 調整 z-index */}
      <div className="relative z-30 flex flex-col items-center max-w-full w-full px-4 text-center overflow-y-auto max-h-screen py-8 no-scrollbar transition-all duration-1000">
        
        {/* 能量球鋪陳動畫 (The Core Orb) */}
        <div className="relative mb-6 md:mb-8 shrink-0 transition-all duration-1000">
          {/* 外圍擴散環 */}
          {(phase === 'buildup' || phase === 'peak') && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-16 h-16 md:w-20 md:h-20 border-2 border-pink-500 rounded-full animate-ping opacity-50" />
              <div className="w-16 h-16 md:w-20 md:h-20 border-2 border-yellow-500 rounded-full animate-ping opacity-30 delay-300" />
            </div>
          )}

          {/* 核心獎盃與容器 - 移除 pre-intro 狀態，讓進入時就帶有動態 */}
          <div className={`relative bg-slate-900/40 p-6 md:p-12 rounded-full border border-white/10 backdrop-blur-xl shadow-[0_0_60px_rgba(236,72,153,0.3)] transform will-change-transform transition-all duration-[2000ms] cubic-bezier(0.34, 1.56, 0.64, 1) ${
            phase === 'buildup' ? 'scale-75 rotate-[-10deg] opacity-80 blur-sm' :
            phase === 'peak' ? 'scale-105 md:scale-110 rotate-[360deg] opacity-100 blur-none shadow-[0_0_100px_rgba(250,204,21,0.5)]' :
            'scale-90 md:scale-100 rotate-0 opacity-100'
          }`}>
            <Trophy className={`w-24 h-24 md:w-40 md:h-40 transition-colors duration-1000 ${phase === 'peak' || phase === 'main' ? 'text-yellow-400' : 'text-slate-600'}`} 
                    style={{ filter: phase === 'main' ? 'drop-shadow(0 0 20px rgba(250,204,21,0.8))' : 'none' }} />
            
            {/* 獎盃上的閃爍特效 */}
            {phase === 'main' && (
              <>
                <Sparkles className="absolute -top-2 -right-2 md:top-4 md:right-4 text-yellow-200 animate-bounce w-8 h-8 md:w-10 md:h-10" />
                <Sparkles className="absolute -bottom-2 -left-2 md:bottom-4 md:left-4 text-pink-300 animate-bounce delay-500 w-8 h-8 md:w-10 md:h-10" />
              </>
            )}
          </div>
        </div>

        {/* 標題與文字 (逐級顯現) */}
        <div className={`transform transition-all duration-1000 w-full ${
          phase === 'main' ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <h2 className="text-5xl md:text-8xl lg:text-9xl font-black mb-4 md:mb-8 tracking-tight py-2 md:py-4 font-cute leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-pink-300 via-pink-500 to-rose-600 px-2 md:px-8 drop-shadow-[0_6px_12px_rgba(236,72,153,0.4)] block">
              幸福達標
            </span>
          </h2>

          <div className="relative inline-block mb-6 md:mb-12 group font-cute max-w-full">
            <div className="absolute -inset-1 md:-inset-2 bg-gradient-to-r from-pink-600 to-yellow-500 rounded-full blur-lg opacity-50 animate-pulse"></div>
            <div className="relative bg-slate-900/80 px-6 py-3 md:px-12 md:py-5 rounded-full border border-white/20 backdrop-blur-md">
              <p className="text-xl md:text-4xl font-bold text-white flex items-center justify-center gap-3 md:gap-6 whitespace-nowrap">
                <Heart size={20} className="text-pink-500 fill-pink-500 animate-heartbeat md:w-9 md:h-9" />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-pink-100 to-white">
                  100 幸福指數達成
                </span>
                <Heart size={20} className="text-pink-500 fill-pink-500 animate-heartbeat md:w-9 md:h-9" />
              </p>
            </div>
          </div>

          <div className="space-y-3 font-cute text-slate-200 px-2 w-full">
            <p className="text-lg md:text-3xl font-medium tracking-wide drop-shadow-md whitespace-nowrap overflow-hidden text-ellipsis">
              恭喜你！成功解鎖了人生的圓滿與喜悅
            </p>
            <div className="text-sm md:text-xl lg:text-2xl leading-relaxed space-y-1 md:space-y-2 opacity-90">
              <p>真正的幸福不在於錢越多越好，而是在於內心的豐盛，</p>
              <p>是否成為自己想要的樣子，過上自己想要的生活！</p>
            </div>
          </div>
        </div>

        {/* 交互提示 */}
        {canClose && (
          <div className="mt-8 md:mt-16 animate-bounce font-cute opacity-60 hover:opacity-100 transition-opacity shrink-0">
            <p className="text-slate-400 text-xs md:text-base font-bold uppercase tracking-[0.2em] md:tracking-[0.4em] flex items-center gap-2 md:gap-3 justify-center">
              <Sparkles size={14} className="md:w-[18px] md:h-[18px]" /> 點擊任意處繼續 <Sparkles size={14} className="md:w-[18px] md:h-[18px]" />
            </p>
          </div>
        )}
      </div>

      {/* 3. 頂級粒子系統：噴泉與爆裂混合 */}
      {(phase !== 'pre-intro' && phase !== 'outro') && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(120)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor: ['#fbbf24', '#f87171', '#34d399', '#60a5fa', '#a78bfa', '#ec4899'][i % 6],
                left: '50%',
                top: '50%',
                animation: `pro-particle-${i} ${phase === 'main' ? '3s' : '5s'} cubic-bezier(0.2, 0.8, 0.2, 1) ${phase === 'main' ? 'forwards' : 'infinite'}`,
                animationDelay: phase === 'main' ? '0s' : `${-Math.random() * 5}s`,
                opacity: 0
              }}
            />
          ))}
          <style>{`
            ${[...Array(120)].map((_, i) => {
              const angle = (i / 120) * 360 + (Math.random() * 40 - 20);
              const dist = phase === 'main' ? 400 + Math.random() * 800 : 200 + Math.random() * 400;
              return `
                @keyframes pro-particle-${i} {
                  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
                  10% { opacity: 1; }
                  100% { transform: translate(calc(-50% + ${Math.cos(angle * Math.PI / 180) * dist}px), calc(-50% + ${Math.sin(angle * Math.PI / 180) * dist}px)) scale(0); opacity: 0; }
                }
              `;
            }).join('')}
            
            @keyframes firework-launch {
              0% { transform: scale(0); opacity: 0; }
              10% { opacity: 1; }
              30% { transform: scale(1); opacity: 1; }
              100% { opacity: 0; }
            }

            ${[...Array(6)].map((_, fi) => 
              [...Array(24)].map((_, pi) => {
                const angle = (pi / 24) * 360 + (Math.random() * 20 - 10);
                const dist = 150 + Math.random() * 200;
                return `
                  @keyframes firework-particle-${fi}-${pi} {
                    0% { transform: translate(0, 0) scale(1); opacity: 1; }
                    100% { transform: translate(${Math.cos(angle * Math.PI / 180) * dist}px, ${Math.sin(angle * Math.PI / 180) * dist}px) scale(0); opacity: 0; }
                  }
                `;
              }).join('')
            ).join('')}

            @keyframes heartbeat {
              0%, 100% { transform: scale(1); }
              10%, 30% { transform: scale(1.3); }
              20% { transform: scale(1.1); }
            }
            .animate-heartbeat {
              animation: heartbeat 1.5s infinite;
            }

            @keyframes continuous-rotate {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            .animate-smooth-rotate {
              animation: continuous-rotate 10s linear infinite;
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

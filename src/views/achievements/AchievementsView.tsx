import React, { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { ACHIEVEMENTS } from '../../constants/achievements';
import { Card, Button } from '../../components/ui/ui';
import { 
  Award, 
  ArrowLeft, 
  Heart, 
  Plane, 
  Settings, 
  PlusSquare, 
  Cloud, 
  Briefcase, 
  Star, 
  Trophy, 
  Play, 
  Users, 
  ShieldCheck, 
  Gem, 
  Zap,
  Lock,
  Baby,
  Home,
  Building,
  CheckCircle,
  TrendingUp
} from 'lucide-react';
import { cn } from '../../utils/gameUtils';

interface AchievementsViewProps {
  onBack: () => void;
}

const IconMap: Record<string, any> = {
  Heart,
  Plane,
  Settings,
  PlusSquare,
  Cloud,
  Briefcase,
  Star,
  Trophy,
  Play,
  Users,
  ShieldCheck,
  Gem,
  Zap,
  Baby,
  Home,
  Building,
  CheckCircle,
  TrendingUp
};

export const AchievementsView: React.FC<AchievementsViewProps> = ({ onBack }) => {
  const { gameHistory } = useGame();

  const unlockedStatus = useMemo(() => {
    const status: Record<string, boolean> = {};
    
    // 統計數據
    const totalPlays = gameHistory.length;
    const professions = new Set(gameHistory.map(h => h.profession));
    const maxHappiness = Math.max(0, ...gameHistory.map(h => h.happinessScore));
    const maxRank = Math.max(1, ...gameHistory.map(h => h.gameStateSnapshot?.assets.length ? 1 : 1)); // 這裡需要更精確的等級紀錄，暫以 snapshot 模擬邏輯
    
    // 檢查每項成就
    ACHIEVEMENTS.forEach(achievement => {
      let isUnlocked = false;
      
      switch (achievement.id) {
        case 'happy_30': isUnlocked = maxHappiness >= 30; break;
        case 'happy_60': isUnlocked = maxHappiness >= 60; break;
        case 'happy_80': isUnlocked = maxHappiness >= 80; break;
        case 'happy_100': isUnlocked = maxHappiness >= 100; break;
        
        case 'first_aircraft': 
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.some(a => a.type === '飛行器'));
          break;
        case 'repair_aircraft':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('維修飛行器')));
          break;
        case 'first_hospital':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('住院')));
          break;
        case 'hospital_5':
          const totalHospital = gameHistory.reduce((sum, h) => 
            sum + (h.gameStateSnapshot?.history.filter(t => t.name.includes('住院')).length || 0), 0);
          isUnlocked = totalHospital >= 5;
          break;
          
        case 'first_dream':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.checked));
          break;
        case 'dreams_3':
          const totalDreams = gameHistory.reduce((sum, h) => 
            sum + (h.gameStateSnapshot?.happiness.filter(i => i.id.startsWith('h_dream') && i.checked).length || 0), 0);
          isUnlocked = totalDreams >= 3;
          break;
        case 'dreams_6':
          const totalDreams6 = gameHistory.reduce((sum, h) => 
            sum + (h.gameStateSnapshot?.happiness.filter(i => i.id.startsWith('h_dream') && i.checked).length || 0), 0);
          isUnlocked = totalDreams6 >= 6;
          break;
        case 'dreams_10':
          const totalDreams10 = gameHistory.reduce((sum, h) => 
            sum + (h.gameStateSnapshot?.happiness.filter(i => i.id.startsWith('h_dream') && i.checked).length || 0), 0);
          isUnlocked = totalDreams10 >= 10;
          break;

        case 'first_career':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_career' && i.checked));
          break;
        case 'careers_3':
          const totalCareers = gameHistory.reduce((sum, h) => 
            sum + (h.gameStateSnapshot?.happiness.filter(i => i.id.startsWith('h_career') && i.checked).length || 0), 0);
          isUnlocked = totalCareers >= 3;
          break;
        case 'careers_6':
          const totalCareers6 = gameHistory.reduce((sum, h) => 
            sum + (h.gameStateSnapshot?.happiness.filter(i => i.id.startsWith('h_career') && i.checked).length || 0), 0);
          isUnlocked = totalCareers6 >= 6;
          break;
        case 'careers_10':
          const totalCareers10 = gameHistory.reduce((sum, h) => 
            sum + (h.gameStateSnapshot?.happiness.filter(i => i.id.startsWith('h_career') && i.checked).length || 0), 0);
          isUnlocked = totalCareers10 >= 10;
          break;

        case 'rank_3':
          isUnlocked = gameHistory.some(h => (h.maxRankLevel || 1) >= 3);
          break;
        case 'rank_5':
          isUnlocked = gameHistory.some(h => (h.maxRankLevel || 1) >= 5);
          break;

        case 'first_play': isUnlocked = totalPlays >= 1; break;
        case 'plays_5': isUnlocked = totalPlays >= 5; break;
        case 'plays_10': isUnlocked = totalPlays >= 10; break;
        case 'plays_20': isUnlocked = totalPlays >= 20; break;

        case 'professions_3': isUnlocked = professions.size >= 3; break;
        case 'professions_6': isUnlocked = professions.size >= 6; break;
        case 'professions_10': isUnlocked = professions.size >= 10; break;

        case 'finance_safe':
          isUnlocked = gameHistory.some(h => {
            const s = h.financialSummary;
            return (h.gameStateSnapshot?.cash || 0) > s.totalExpenses;
          });
          break;
        case 'finance_rich':
          isUnlocked = gameHistory.some(h => {
            const assets = h.gameStateSnapshot?.assets || [];
            return new Set(assets.map(a => a.type)).size >= 3;
          });
          break;
        case 'finance_free':
          isUnlocked = gameHistory.some(h => h.isWin);
          break;

        case 'marriage':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_wedding' && i.checked));
          break;
        case 'first_child':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_child1' && i.checked));
          break;
        case 'first_house':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.some(a => a.type === '不動產'));
          break;
        case 'luxury_house':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.some(a => a.type === '不動產' && a.cost >= 10000000));
          break;
        case 'debt_free':
          isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.loans || 0) === 0 && (h.gameStateSnapshot?.liabilities.length || 0) === 0);
          break;
        case 'passive_income_50k':
          isUnlocked = gameHistory.some(h => h.financialSummary.passiveIncome >= 50000);
          break;
        case 'five_blessings':
          isUnlocked = gameHistory.some(h => {
            const snap = h.gameStateSnapshot;
            const hasHouse = snap?.assets.some(a => a.type === '不動產') || snap?.happiness.some(i => i.id === 'h_house_self' && i.checked);
            const hasCareer = snap?.happiness.some(i => i.id === 'h_career' && i.checked);
            const hasChild = snap?.happiness.some(i => i.id === 'h_child1' && i.checked);
            const hasPlane = snap?.assets.some(a => a.type === '飛行器') || snap?.happiness.some(i => i.id === 'h_plane' && i.checked);
            return hasHouse && hasCareer && hasChild && hasPlane && h.isWin;
          });
          break;
      }
      
      status[achievement.id] = isUnlocked;
    });
    
    return status;
  }, [gameHistory]);

  const stats = useMemo(() => {
    const total = ACHIEVEMENTS.length;
    const unlocked = Object.values(unlockedStatus).filter(Boolean).length;
    const percent = Math.round((unlocked / total) * 100);
    return { total, unlocked, percent };
  }, [unlockedStatus]);

  const categories = [
    { id: 'all', label: '全部', icon: Award },
    { id: 'happiness', label: '幸福', icon: Heart },
    { id: 'finance', label: '財務', icon: Zap },
    { id: 'career', label: '事業', icon: Briefcase },
    { id: 'dream', label: '夢想', icon: Cloud },
    { id: 'asset', label: '資產', icon: Home },
    { id: 'event', label: '事件', icon: Star },
    { id: 'gameplay', label: '遊玩', icon: Play },
  ];

  const [activeCategory, setActiveCategory] = React.useState('all');

  const groupedAchievements = useMemo(() => {
    const groups: Record<string, typeof ACHIEVEMENTS> = {};
    
    ACHIEVEMENTS.forEach(a => {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    });

    if (activeCategory === 'all') {
      return categories
        .filter(c => c.id !== 'all' && groups[c.id])
        .map(c => ({
          category: c,
          achievements: groups[c.id]
        }));
    }

    const activeCat = categories.find(c => c.id === activeCategory);
    if (!activeCat || !groups[activeCategory]) return [];

    return [{
      category: activeCat,
      achievements: groups[activeCategory]
    }];
  }, [activeCategory]);

  return (
    <div className="h-screen bg-slate-950 flex flex-col relative overflow-hidden select-none">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yellow-500 rounded-full blur-[120px]" />
      </div>

      {/* Header Bar */}
      <div className="relative z-10 px-6 py-4 h-20 flex justify-between items-center border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Award size={20} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white leading-tight">成就獎勵</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">已解鎖 {stats.unlocked} / {stats.total} ({stats.percent}%)</p>
          </div>
        </div>
        <Button 
          variant="secondary" 
          onClick={onBack}
          className="text-slate-400 hover:text-white hover:bg-slate-800 border-none bg-transparent"
        >
          <ArrowLeft size={20} className="mr-2" />
          返回大廳
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="relative z-10 px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-800/30">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border",
              activeCategory === cat.id
                ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
            )}
          >
            <cat.icon size={16} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Achievement Grid */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-12">
          {groupedAchievements.map(group => (
            <div key={group.category.id} className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <group.category.icon size={16} className="text-amber-500" />
                </div>
                <h3 className="text-lg font-black text-white">{group.category.label}</h3>
                <div className="flex-1 h-px bg-gradient-to-r from-slate-800 to-transparent" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.achievements.map(achievement => {
                  const isUnlocked = unlockedStatus[achievement.id];
                  const Icon = IconMap[achievement.icon || 'Award'] || Award;
                  
                  return (
                    <Card 
                      key={achievement.id}
                      className={cn(
                        "p-5 transition-all duration-300 border-2",
                        isUnlocked 
                          ? "bg-slate-900/80 border-amber-500/30 shadow-[0_4px_20px_rgba(245,158,11,0.05)]" 
                          : "bg-slate-900/40 border-slate-800/50 opacity-60"
                      )}
                    >
                      <div className="flex gap-4">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border",
                          isUnlocked 
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-500" 
                            : "bg-slate-800 border-slate-700 text-slate-600"
                        )}>
                          {isUnlocked ? <Icon size={28} /> : <Lock size={24} />}
                        </div>
                        <div className="flex flex-col justify-center">
                          <h3 className={cn(
                            "font-black text-lg leading-tight",
                            isUnlocked ? "text-white" : "text-slate-500"
                          )}>
                            {achievement.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {achievement.description}
                          </p>
                          {isUnlocked && (
                            <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                              <Award size={10} />
                              已達成
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

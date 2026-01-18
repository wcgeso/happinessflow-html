import React, { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { ACHIEVEMENTS } from '../../constants/achievements';
import { Card, Button } from '../../components/ui/ui';
import {
  Award, ArrowLeft, Heart, Plane, Settings, PlusSquare, Cloud, Briefcase, Star, Trophy,
  Play, Users, ShieldCheck, Gem, Zap, Lock, Baby, Home, Building, CheckCircle,
  TrendingUp, Sun, Smile, Music, Scale, Sunrise, Crown, Coins, Scissors, DollarSign,
  Layers, PiggyBank, BaggageClaim, LineChart, ArrowUpRight, Sparkles, ArrowUpCircle,
  UserCheck, Landmark, Boxes, Lightbulb, Medal, Compass, Handshake, Globe, Flag,
  Hammer, Check, Banknote, BarChart, Map, Key, PieChart, Infinity, Anchor, Shuffle
} from 'lucide-react';
import { cn } from '../../utils/gameUtils';

interface AchievementsViewProps {
  onBack: () => void;
}

const IconMap: Record<string, any> = {
  Award, Heart, Plane, Settings, PlusSquare, Cloud, Briefcase, Star, Trophy,
  Play, Users, ShieldCheck, Gem, Zap, Lock, Baby, Home, Building, CheckCircle,
  TrendingUp, Sun, Smile, Music, Scale, Sunrise, Crown, Coins, Scissors, DollarSign,
  Layers, PiggyBank, BaggageClaim, LineChart, ArrowUpRight, Sparkles, ArrowUpCircle,
  UserCheck, Landmark, Boxes, Lightbulb, Medal, Compass, Handshake, Globe, Flag,
  Hammer, Check, Banknote, BarChart, Map, Key, PieChart, Infinity, Anchor, Shuffle
};

export const AchievementsView: React.FC<AchievementsViewProps> = ({ onBack }) => {
  const { gameHistory } = useGame();

  const unlockedStatus = useMemo(() => {
    const status: Record<string, boolean> = {};

    // --- 統計數據數據準備 ---
    const totalPlays = gameHistory.length;
    const professions = new Set(gameHistory.map(h => h.profession));
    const maxHappiness = Math.max(0, ...gameHistory.map(h => h.happinessScore));
    const cumulativeHappiness = gameHistory.reduce((sum, h) => sum + (h.happinessScore || 0), 0);
    const cumulativeCareers = gameHistory.reduce((sum, h) =>
      sum + (h.gameStateSnapshot?.happiness.filter(i => i.id.startsWith('h_career') && i.checked).length || 0), 0);
    const cumulativeDreams = gameHistory.reduce((sum, h) =>
      sum + (h.gameStateSnapshot?.happiness.filter(i => i.id.startsWith('h_dream') && i.checked).length || 0), 0);
    const cumulativeHospitals = gameHistory.reduce((sum, h) =>
      sum + (h.gameStateSnapshot?.history.filter(t => t.name.includes('住院')).length || 0), 0);
    const cumulativeChildren = gameHistory.reduce((sum, h) =>
      sum + (h.gameStateSnapshot?.happiness.filter(i => (i.id === 'h_child1' || i.id === 'h_child2') && i.checked).length || 0), 0);
    const cumulativeBizCodes = new Set(gameHistory.flatMap(h =>
      h.gameStateSnapshot?.happiness.filter(i => i.id.startsWith('h_career') && i.checked).map(i => i.code) || []
    ));
    const cumulativeBizAssets = new Set(gameHistory.flatMap(h =>
      h.gameStateSnapshot?.assets.filter(a => a.type === '企業').map(a => a.name) || []
    ));
    const cumulativeDonations = gameHistory.reduce((sum, h) =>
      sum + (h.gameStateSnapshot?.history.filter(t => t.name.includes('捐款')).reduce((s, t) => s + Math.abs(t.cashChange), 0) || 0), 0);
    const cumulativeEvents = gameHistory.reduce((sum, h) =>
      sum + (h.gameStateSnapshot?.history.length || 0), 0);

    // --- 檢查每項成就 ---
    ACHIEVEMENTS.forEach(achievement => {
      let isUnlocked = false;

      switch (achievement.id) {
        // --- 一、幸福類 ---
        case 'happy_30': isUnlocked = maxHappiness >= 30; break;
        case 'happy_60': isUnlocked = maxHappiness >= 60; break;
        case 'happy_80': isUnlocked = maxHappiness >= 80; break;
        case 'happy_100': isUnlocked = maxHappiness >= 100; break;
        case 'happy_total_500': isUnlocked = cumulativeHappiness >= 500; break;
        case 'happy_total_1000': isUnlocked = cumulativeHappiness >= 1000; break;
        case 'happy_total_2000': isUnlocked = cumulativeHappiness >= 2000; break;
        case 'contentment':
          isUnlocked = gameHistory.some(h => h.happinessScore >= 60 && !h.gameStateSnapshot?.happiness.some(i => i.id.startsWith('h_dream') && i.checked));
          break;
        case 'happy_duet':
          isUnlocked = gameHistory.some(h => h.happinessScore >= 70 && h.gameStateSnapshot?.happiness.some(i => i.id === 'h_career' && i.checked) && h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.checked));
          break;
        case 'all_round_happy':
          isUnlocked = gameHistory.some(h => {
            const hItems = h.gameStateSnapshot?.happiness || [];
            return hItems.some(i => i.id === 'h_date' && i.checked) &&
              hItems.some(i => i.id === 'h_proposal' && i.checked) &&
              hItems.some(i => i.id === 'h_wedding' && i.checked) &&
              hItems.some(i => i.id === 'h_child1' && i.checked) &&
              hItems.some(i => i.id === 'h_house_self' && i.checked);
          });
          break;
        case 'perfect_balance':
          isUnlocked = gameHistory.some(h => Math.abs(h.financialSummary.totalIncome - h.financialSummary.totalExpenses) <= 500);
          break;
        // 微笑人生 (已移除)
        // status['smile_life'] = ...
        case 'smile_life':
          isUnlocked = false; // This achievement is removed, so it's never unlocked.
          break;
        case 'sunshine_in_adversity':
          // 逆境出的陽光 (修改: 負債 > 1000W 且 幸福 >= 60)
          isUnlocked = gameHistory.some(h => h.financialSummary.totalLiabilities >= 10000000 && h.happinessScore >= 60);
          break;
        case 'family_glory':
          // 家族榮耀
          isUnlocked = gameHistory.some(h => h.happinessScore === 100 && (h.gameStateSnapshot?.happiness.filter(i => (i.id === 'h_child1' || i.id === 'h_child2') && i.checked).length || 0) >= 2);
          break;
        case 'ultimate_happiness':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.every(i => i.checked));
          break;

        // --- 二、財務類 ---
        case 'finance_safe':
          isUnlocked = gameHistory.some(h => {
            const cash = h.gameStateSnapshot?.cash || 0;
            const deposit = h.gameStateSnapshot?.assets.filter(a => a.type === '定存').reduce((s, a) => s + a.cost, 0) || 0;
            const hasInsurance = h.gameStateSnapshot?.assets.some(a => a.id === 'medical_insurance_id' || a.name.includes('保險'));
            return cash > h.financialSummary.totalExpenses && hasInsurance && (cash + deposit) > (h.financialSummary.totalExpenses * 6);
          });
          break;
        case 'finance_rich':
          isUnlocked = gameHistory.some(h => new Set(h.gameStateSnapshot?.assets.map(a => a.type)).size >= 3);
          break;
        case 'finance_free': isUnlocked = gameHistory.some(h => h.isWin); break;
        case 'debt_free':
          isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.loans || 0) === 0 && (h.gameStateSnapshot?.liabilities.length || 0) === 0);
          break;
        case 'passive_100k': isUnlocked = gameHistory.some(h => h.financialSummary.passiveIncome >= 100000); break;
        case 'cash_king_20m': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.cash || 0) >= 20000000); break;
        case 'reserve_master_12m':
          isUnlocked = gameHistory.some(h => {
            const cash = h.gameStateSnapshot?.cash || 0;
            const deposit = h.gameStateSnapshot?.assets.filter(a => a.type === '定存').reduce((s, a) => s + a.cost, 0) || 0;
            return (cash + deposit) > (h.financialSummary.totalExpenses * 12);
          });
          break;
        case 'thrift_expert':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.filter(t => t.name.includes('償還') || t.name.includes('降低支出')).length >= 5);
          break;
        case 'monthly_millionaire': isUnlocked = gameHistory.some(h => h.financialSummary.monthlyCashflow >= 1000000); break;
        case 'finance_tutor': isUnlocked = gameHistory.some(h => (h.finalScore || 0) >= 20); break;
        case 'finance_pyramid':
          isUnlocked = gameHistory.some(h => {
            const types = new Set(h.gameStateSnapshot?.assets.map(a => a.type));
            return types.has('定存') && types.has('股票') && types.has('不動產') && types.has('企業');
          });
          break;
        case 'first_million': isUnlocked = gameHistory.some(h => (h.financialSummary.totalAssets - h.financialSummary.totalLiabilities) >= 1000000); break;
        case 'billionaire': isUnlocked = gameHistory.some(h => h.financialSummary.totalAssets >= 100000000); break;
        case 'compound_power':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('股利') && t.cashChange >= 100000));
          break;
        case 'investment_winner':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('賣出槓桿') || (t.name.includes('賣出') && t.details?.includes('200%'))));
          break;

        // --- 三、事業類 ---
        case 'first_career': isUnlocked = cumulativeCareers >= 1; break;
        case 'careers_3': isUnlocked = cumulativeCareers >= 3; break;
        case 'careers_6': isUnlocked = cumulativeCareers >= 6; break;
        case 'careers_10': isUnlocked = cumulativeCareers >= 10; break;
        case 'career_mania_3': isUnlocked = cumulativeBizCodes.size >= 3; break;
        case 'midas_touch': isUnlocked = gameHistory.some(h => (h.financialSummary.passiveIncome / h.financialSummary.totalIncome) >= 0.5); break;
        case 'biz_upgrade': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.some(a => a.isUpgraded)); break;
        case 'career_successor': isUnlocked = gameHistory.some(h => (h.maxRankLevel || 1) >= 5 && h.gameStateSnapshot?.happiness.some(i => i.id === 'h_career' && i.checked)); break;
        case 'honorary_chairman_6': isUnlocked = cumulativeBizCodes.size >= 6; break;
        case 'chain_empire':
          isUnlocked = gameHistory.some(h => {
            const bizNames = h.gameStateSnapshot?.assets.filter(a => a.type === '企業').map(a => a.name) || [];
            const counts: Record<string, number> = {};
            bizNames.forEach(n => counts[n] = (counts[n] || 0) + 1);
            return Object.values(counts).some(c => c >= 3);
          });
          break;
        case 'entrepreneur_spirit':
          isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.assets.filter(a => a.type === '企業').length || 0) >= 2 && h.financialSummary.passiveIncome > (h.gameStateSnapshot?.income.salary || 0));
          break;
        case 'slash_boss':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('事業') && (t.details?.includes('Rank 5') || t.round && t.round > 30)));
          break;
        case 'industry_navigator': isUnlocked = cumulativeBizAssets.size >= 20; break;
        // case 'biz_collector_30': isUnlocked = cumulativeBizAssets.size >= 30; break;
        // case 'biz_guardian_5': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.assets.filter(a => a.type === '企業').length || 0) >= 5); break;

        // --- 四、夢想類 ---
        case 'first_dream': isUnlocked = cumulativeDreams >= 1; break;
        case 'dreams_3': isUnlocked = cumulativeDreams >= 3; break;
        case 'dreams_6': isUnlocked = cumulativeDreams >= 6; break;
        case 'dreams_10': isUnlocked = cumulativeDreams >= 10; break;
        case 'dream_helper': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.checked) && h.gameStateSnapshot?.happiness.some(i => i.id === 'h_career' && i.checked)); break;
        case 'world_tour': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.label?.includes('環遊世界') && i.checked)); break;
        case 'dream_ambassador': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.checked) && new Set(h.gameStateSnapshot?.assets.map(a => a.type)).size >= 3); break;
        case 'wealth_dream': isUnlocked = gameHistory.some(h => h.isWin && h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.checked)); break;
        case 'luxury_dream': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.code === 'D03' && i.checked)); break;
        case 'soul_guardian':
          isUnlocked = gameHistory.some(h => {
            const items = h.gameStateSnapshot?.happiness || [];
            const targets = ['D01', 'D03', 'D04', 'D07', 'D08'];
            return targets.every(t => items.some(i => i.code === t && i.checked));
          });
          break;
        case 'dream_builder_10m': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.cash || 0) >= 10000000 && h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.checked)); break;
        case 'debt_free_dreams':
          isUnlocked = gameHistory.some(h => (h.financialSummary.totalLiabilities === 0) && (h.gameStateSnapshot?.happiness.filter(i => i.id.startsWith('h_dream') && i.checked).length || 0) >= 1);
          break;

        case 'soul_billionaire':
          isUnlocked = gameHistory.some(h => {
            const items = h.gameStateSnapshot?.happiness || [];
            return items.filter(i => i.checked).length >= (items.length / 2);
          });
          break;

        // --- 五、資產類 ---
        case 'first_aircraft': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.some(a => a.type === '飛行器')); break;
        case 'repair_aircraft': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('維修飛行器'))); break;
        case 'first_house': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.some(a => a.type === '不動產')); break;
        case 'luxury_house_2': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.assets.filter(a => a.type === '不動產' && (a.name?.includes('五室三廳'))).length || 0) >= 2); break;
        // case 'stock_god': ...
        case 'landlord_5': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.filter(a => a.type === '不動產').length >= 5); break;
        case 'rent_king': isUnlocked = gameHistory.some(h => h.financialSummary.passiveIncome > (h.gameStateSnapshot?.income.salary || 0)); break;
        case 'asset_allocator':
          isUnlocked = gameHistory.some(h => {
            const assets = h.gameStateSnapshot?.assets || [];
            const types = new Set(assets.map(a => a.type as string));
            const hasInsurance = types.has('保險') || assets.some(a => a.name?.includes('保險'));
            return types.has('股票') && types.has('不動產') && types.has('企業') && types.has('定存') && types.has('飛行器') && hasInsurance;
          });
          break;
        case 'deposit_5m': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.assets.filter(a => a.type === '定存').reduce((s, a) => s + a.cost, 0) || 0) >= 5000000); break;
        case 'invest_pro_40m':
          // 賣出股票總獲利超過 3000 萬
          isUnlocked = gameHistory.some(h => {
            const stockSales = h.gameStateSnapshot?.history.filter(t => t.name.includes('賣出股票') || t.name.includes('賣出槓桿'));
            const profit = stockSales?.reduce((sum, t) => {
              // 解析細節中的獲利資訊，如果沒有細節則嘗試從 cashChange 反推 (假設獲利佔一部分)
              if (t.details?.includes('獲利')) {
                const match = t.details.match(/獲利:? ([\d,]+)/);
                return sum + (match ? parseInt(match[1].replace(/,/g, '')) : 0);
              }
              return sum;
            }, 0) || 0;
            return profit >= 30000000;
          });
          break;
        case 'risk_manager': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.some(a => a.name.includes('保險'))); break;
        // case 'private_fleet': ...
        // case 'long_term_holder': ...
        // case 'asset_legend_1b': ...
        case 'all_round_investor':
          isUnlocked = gameHistory.some(h => {
            const heldTypes = new Set(h.gameStateSnapshot?.assets.map(a => a.type) || []);
            const tradedTypes = new Set(h.gameStateSnapshot?.history.filter(t => t.name.includes('買入') || t.name.includes('獲得')).map(t => {
              if (t.name.includes('股票')) return '股票';
              if (t.name.includes('房產') || t.name.includes('不動產')) return '不動產';
              if (t.name.includes('事業') || t.name.includes('企業')) return '企業';
              if (t.name.includes('定存')) return '定存';
              if (t.name.includes('飛行器')) return '飛行器';
              if (t.name.includes('保險')) return '保險';
              return '';
            }).filter(Boolean));

            // 額外檢查資產名是否包含保險
            const hasInsurance = h.gameStateSnapshot?.assets.some(a => a.name.includes('保險')) || tradedTypes.has('保險');

            const combined = new Set([...heldTypes, ...tradedTypes]);
            return combined.has('股票') && combined.has('不動產') && combined.has('企業') && combined.has('定存') && combined.has('飛行器') && hasInsurance;
          });
          break;

        // --- 六、事件類 ---
        case 'first_hospital': isUnlocked = cumulativeHospitals >= 1; break;
        case 'hospital_5': isUnlocked = cumulativeHospitals >= 5; break;
        case 'marriage': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_wedding' && i.checked)); break;
        case 'first_child': isUnlocked = cumulativeChildren >= 1; break;
        case 'multi_children_2': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_child2' && i.checked)); break;
        case 'rebirth': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.cashChange < 0 && t.balance < 0) && h.isWin); break;
        case 'lucky_koi': isUnlocked = gameHistory.some(h => !h.gameStateSnapshot?.history.some(t => t.cashChange < -100000)); break;
        case 'insurance_guardian':
          // 保險守護 (修改: 第一次領取保險)
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('保險理賠')));
          break;
        // case 'fate_master_50': ...
        case 'promotion_pro': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.filter(t => t.name.includes('職等') || t.name.includes('加薪')).length >= 5); break;
        // case 'philanthropist_5m': ...
        case 'fate_god_100': isUnlocked = totalPlays >= 20; break;

        // --- 七、遊玩類 ---
        case 'first_play': isUnlocked = totalPlays >= 1; break;
        case 'plays_5': isUnlocked = totalPlays >= 5; break;
        case 'plays_10': isUnlocked = totalPlays >= 10; break;
        case 'plays_20': isUnlocked = totalPlays >= 20; break;
        case 'professions_3': isUnlocked = professions.size >= 3; break;
        case 'professions_6': isUnlocked = professions.size >= 6; break;
        case 'professions_10': isUnlocked = professions.size >= 10; break;
        case 'rank_3': isUnlocked = gameHistory.some(h => (h.maxRankLevel || 1) >= 3); break;
        case 'rank_5': isUnlocked = gameHistory.some(h => (h.maxRankLevel || 1) >= 5); break;
        case 'five_blessings':
          isUnlocked = gameHistory.some(h => {
            const items = h.gameStateSnapshot?.happiness || [];
            const hasHouse = items.some(i => i.id === 'h_house_self' && i.checked);
            const hasChild = items.some(i => i.id === 'h_child1' && i.checked);
            const hasBiz = items.some(i => i.id === 'h_career' && i.checked);
            const hasPlane = items.some(i => i.id === 'h_plane' && i.checked);
            return hasHouse && hasChild && hasBiz && hasPlane && h.isWin;
          });
          break;
        case 'all_professions_win':
          const wins = new Set(gameHistory.filter(h => h.isWin).map(h => h.profession));
          isUnlocked = wins.size >= 10;
          break;
        case 'perfect_life':
          isUnlocked = gameHistory.some(h => {
            const snapshot = h.gameStateSnapshot;
            const hItems = snapshot?.happiness || [];
            const hasDream = hItems.some(i => i.id === 'h_dream' && i.checked);
            const hasCareer = hItems.some(i => i.id === 'h_career' && i.checked);
            return h.happinessScore >= 100 &&
              h.financialSummary.totalLiabilities === 0 &&
              hasDream && hasCareer &&
              (snapshot?.cash || 0) >= 30000000;
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
    { id: 'unlocked', label: '已達成', icon: CheckCircle },
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

    // 過濾邏輯
    let filteredAchievements = ACHIEVEMENTS;
    if (activeCategory === 'unlocked') {
      filteredAchievements = ACHIEVEMENTS.filter(a => unlockedStatus[a.id]);
    } else if (activeCategory !== 'all') {
      filteredAchievements = ACHIEVEMENTS.filter(a => a.category === activeCategory);
    }

    filteredAchievements.forEach(a => {
      const cat = a.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(a);
    });

    // 依照導覽列順序排列分組
    return categories
      .filter(c => c.id !== 'all' && c.id !== 'unlocked' && groups[c.id])
      .map(c => ({
        category: c,
        achievements: groups[c.id]
      }));
  }, [activeCategory, unlockedStatus]);

  return (
    <div className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden select-none touch-none">
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
      <div className="relative z-10 px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-800/30 touch-pan-x">
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
      <div className="relative z-10 flex-1 overflow-y-auto p-6 touch-pan-y no-scrollbar">
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

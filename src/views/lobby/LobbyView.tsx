import React, { useState, useEffect, useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { useAuth, isGM as authIsGM, getUserTitle, getCoachBadge, getPlayerBadge, getTitleColor, getAvatarBorderStyle, getBadgeGlowStyle } from '../../context/AuthContext';
import { LogOut, Award, Play, History, BookOpen, Mail, Users, ShieldCheck, UserCircle, Trophy } from 'lucide-react';
import { ProfileModal, TutorialModal, LetterToPlayersModal, CreateRoomModal, LeaderboardModal, FriendsModal } from '../../components/modals';
import SafeImage from '../../components/common/SafeImage';
import { RoomView } from './RoomView';
import { CoachDashboard } from './CoachDashboard';
import { DeveloperPortal } from './DeveloperPortal';
import { CoachHistoryView } from '../history/CoachHistoryView';
import { CoachReportView } from '../report/CoachReportView';
import { RoomRecordsView } from '../report/RoomRecordsView';
import { VERSION_DISPLAY, IS_DEV_VERSION } from '../../constants/version';
import { useRoom } from '../../context/RoomContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { cn } from '../../utils/gameUtils';
import { safeAsync } from '../../utils/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'lucide-react';
import { ACHIEVEMENTS } from '../../constants/achievements';

interface LobbyViewProps {
  onLogout: () => void;
  onCreateReport: () => void;
  onResumeGame: () => void;
  onViewHistory: (userId?: string) => void;
  onViewAchievements: () => void;
  onDevNavigate?: (view: string) => void;
  onBack?: () => void;
  initialShowRoomView?: boolean;
  viewMode?: 'player' | 'coach' | 'gm';
  onViewModeChange?: (mode: 'player' | 'coach' | 'gm') => void;
  onModalStateChange?: (hasOpenModal: boolean) => void;
  autoOpenCreateRoom?: boolean;
  onAutoOpenHandled?: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  onLogout,
  onCreateReport,
  onResumeGame,
  onViewHistory,
  onViewAchievements,
  onDevNavigate,
  onBack,
  initialShowRoomView = false,
  viewMode = 'player',
  onViewModeChange,
  onModalStateChange,
  autoOpenCreateRoom,
  onAutoOpenHandled,
}) => {
  const { gameHistory, gameState } = useGame();
  const { user } = useAuth();
  const { room, joinRoom, createRoom } = useRoom();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showCoachHistory, setShowCoachHistory] = useState(false);
  const [showCoachReport, setShowCoachReport] = useState(false);
  const [showCoachSelfReport, setShowCoachSelfReport] = useState(false);
  const [showRoomRecords, setShowRoomRecords] = useState(false);
  const [showRoomView, setShowRoomView] = useState(initialShowRoomView);
  const [isGMToolsOpen, setIsGMToolsOpen] = useState(false);



  // Notify parent when any modal state changes
  useEffect(() => {
    const hasOpenModal = showProfileModal || showTutorialModal || showLetterModal ||
      showCreateRoomModal || showLeaderboardModal || showFriendsModal ||
      showCoachHistory || showCoachReport || showCoachSelfReport || showRoomView || isGMToolsOpen || showRoomRecords;
    onModalStateChange?.(hasOpenModal);
  }, [showProfileModal, showTutorialModal, showLetterModal, showCreateRoomModal,
    showLeaderboardModal, showFriendsModal, showCoachHistory, showCoachReport, showCoachSelfReport, showRoomView, isGMToolsOpen, showRoomRecords, onModalStateChange]);

  useEffect(() => {
    if (autoOpenCreateRoom) {
      setShowCreateRoomModal(true);
      onAutoOpenHandled?.();
    }
  }, [autoOpenCreateRoom]);

  // 房間被執行師關閉後，避免空的房間彈窗遮住大廳。
  useEffect(() => {
    if (!room && showRoomView) {
      setShowRoomView(false);
    }
  }, [room, showRoomView]);

  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // 處理 QR Code 房間碼自動加入
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode && user && !room) {
      joinRoom(roomCode)
        .catch(console.error);
    }
  }, [user, room, joinRoom]);

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim()) return;
    setIsJoiningRoom(true);
    setJoinError(null);
    try {
      await joinRoom(roomCodeInput.trim());
      // 移除 setShowRoomView(true)，改由 RoomContext 的 room 狀態驅動自動跳轉
    } catch (err: any) {
      setJoinError(err.message);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleCreateRoom = async (settings: { name: string; maxPlayers: number; duration: number; isBoardGame?: boolean }) => {
    try {
      const isPractice = localStorage.getItem('hf_practice_mode') === 'true';
      await createRoom({ ...settings, isPractice });
      setShowCreateRoomModal(false);
      // 移除 setShowRoomView(true)，改由 RoomContext 的 room 狀態驅動自動跳轉
    } catch (err: any) {
      console.error('Create room error:', err);
      // 重新拋出錯誤，讓 CreateRoomModal 捕捉並顯示
      throw err;
    }
  };

  const [isLetterRead, setIsLetterRead] = useState(() => {
    if (!user?.uid) return false;
    return localStorage.getItem(`letter_to_players_read_${user.uid}`) === 'true';
  });

  const handleOpenLetter = () => {
    setShowLetterModal(true);
    if (!isLetterRead && user?.uid) {
      setIsLetterRead(true);
      localStorage.setItem(`letter_to_players_read_${user.uid}`, 'true');
    }
  };

  // Calculate unlocked achievements
  const unlockedAchievementsCount = useMemo(() => {
    if (!gameHistory || gameHistory.length === 0) return 0;

    let count = 0;
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

    ACHIEVEMENTS.forEach(achievement => {
      let isUnlocked = false;

      switch (achievement.id) {
        // --- 幸福類 ---
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
            return hItems.some(i => i.id === 'h_date' && i.checked) && hItems.some(i => i.id === 'h_wedding' && i.checked) && hItems.some(i => i.id === 'h_house_self' && i.checked);
          });
          break;
        case 'perfect_balance':
          isUnlocked = gameHistory.some(h => Math.abs(h.financialSummary.totalIncome - h.financialSummary.totalExpenses) <= 500);
          break;
        // 微笑人生 (已移除)
        case 'smile_life': isUnlocked = false; break;
        case 'sunshine_in_adversity':
          isUnlocked = gameHistory.some(h => h.financialSummary.totalLiabilities >= 10000000 && h.happinessScore >= 60);
          break;
        case 'family_glory':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_child2' && i.checked) && h.happinessScore >= 100);
          break;
        case 'ultimate_happiness':
          isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.every(i => i.checked));
          break;

        // --- 財務類 ---
        case 'finance_safe':
          isUnlocked = gameHistory.some(h => {
            const cash = h.gameStateSnapshot?.cash || 0;
            const deposit = h.gameStateSnapshot?.assets.filter(a => a.type === '定存').reduce((s, a) => s + a.cost, 0) || 0;
            return cash > h.financialSummary.totalExpenses && (cash + deposit) > (h.financialSummary.totalExpenses * 6);
          });
          break;
        case 'finance_rich': isUnlocked = gameHistory.some(h => new Set(h.gameStateSnapshot?.assets.map(a => a.type)).size >= 3); break;
        case 'finance_free': isUnlocked = gameHistory.some(h => h.isWin); break;
        case 'debt_free': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.loans || 0) === 0); break;
        case 'passive_100k': isUnlocked = gameHistory.some(h => h.financialSummary.passiveIncome >= 100000); break;
        case 'cash_king_20m': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.cash || 0) >= 20000000); break;
        case 'reserve_master_12m':
          isUnlocked = gameHistory.some(h => {
            const cash = h.gameStateSnapshot?.cash || 0;
            const deposit = h.gameStateSnapshot?.assets.filter(a => a.type === '定存').reduce((s, a) => s + a.cost, 0) || 0;
            return (cash + deposit) > (h.financialSummary.totalExpenses * 12);
          });
          break;
        case 'thrift_expert': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.filter(t => t.name.includes('償還')).length >= 5); break;
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
        case 'compound_power': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('股利') && t.cashChange >= 100000)); break;
        case 'investment_winner': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('賣出槓桿'))); break;

        // --- 事業類 ---
        case 'first_career': isUnlocked = cumulativeCareers >= 1; break;
        case 'careers_3': isUnlocked = cumulativeCareers >= 3; break;
        case 'careers_6': isUnlocked = cumulativeCareers >= 6; break;
        case 'careers_10': isUnlocked = cumulativeCareers >= 10; break;
        case 'career_mania_3': isUnlocked = cumulativeBizCodes.size >= 3; break;
        case 'midas_touch': isUnlocked = gameHistory.some(h => (h.financialSummary.passiveIncome / h.financialSummary.totalIncome) >= 0.5); break;
        case 'biz_upgrade': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.some(a => a.isUpgraded)); break;
        case 'career_successor': isUnlocked = gameHistory.some(h => (h.maxRankLevel || 1) >= 5 && h.gameStateSnapshot?.happiness.some(i => i.id === 'h_career' && i.checked)); break;
        case 'honorary_chairman_6': isUnlocked = cumulativeBizCodes.size >= 6; break;
        case 'chain_empire': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.assets.filter(a => a.type === '企業').length || 0) >= 3); break;
        case 'entrepreneur_spirit': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.assets.filter(a => a.type === '企業').length || 0) >= 2 && h.financialSummary.passiveIncome > (h.gameStateSnapshot?.income.salary || 0)); break;
        case 'slash_boss': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('事業') && (t.round || 0) > 30)); break;
        case 'industry_navigator': isUnlocked = cumulativeBizAssets.size >= 20; break;
        // case 'biz_collector_30': isUnlocked = cumulativeBizAssets.size >= 30; break;
        // case 'biz_guardian_5': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.assets.filter(a => a.type === '企業').length || 0) >= 5); break;

        // --- 夢想類 ---
        case 'first_dream': isUnlocked = cumulativeDreams >= 1; break;
        case 'dreams_3': isUnlocked = cumulativeDreams >= 3; break;
        case 'dreams_6': isUnlocked = cumulativeDreams >= 6; break;
        case 'dreams_10': isUnlocked = cumulativeDreams >= 10; break;
        case 'dream_helper': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.checked) && h.gameStateSnapshot?.happiness.some(i => i.id === 'h_career' && i.checked)); break;
        case 'world_tour': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.label?.includes('環遊世界') && i.checked)); break;
        case 'dream_ambassador': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.checked) && new Set(h.gameStateSnapshot?.assets.map(a => a.type)).size >= 3); break;
        case 'wealth_dream': isUnlocked = gameHistory.some(h => h.isWin && h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.checked)); break;
        case 'luxury_dream': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.code === 'D03' && i.checked)); break;
        case 'soul_guardian': isUnlocked = gameHistory.some(h => ['D01', 'D03', 'D04', 'D07', 'D08'].every(t => h.gameStateSnapshot?.happiness.some(i => i.code === t && i.checked))); break;
        case 'dream_builder_10m': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.cash || 0) >= 10000000 && h.gameStateSnapshot?.happiness.some(i => i.id === 'h_dream' && i.checked)); break;
        case 'debt_free_dreams': isUnlocked = gameHistory.some(h => h.financialSummary.totalLiabilities === 0 && h.gameStateSnapshot?.happiness.filter(i => i.id.startsWith('h_dream') && i.checked).length >= 1); break;

        case 'soul_billionaire': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.filter(i => i.checked).length >= 10); break;

        // --- 資產類 ---
        case 'first_aircraft': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.some(a => a.type === '汽車' || a.type === '飛行器')); break;
        case 'repair_aircraft': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('維修汽車') || t.name.includes('維修飛行器'))); break;
        case 'first_house': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.some(a => a.type === '不動產')); break;
        case 'luxury_house_2': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.filter(a => a.type === '不動產' && a.name?.includes('五房三廳')).length >= 2); break;
        // case 'stock_god': ...
        case 'landlord_5': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.assets.filter(a => a.type === '不動產').length >= 5); break;
        case 'rent_king': isUnlocked = gameHistory.some(h => h.financialSummary.passiveIncome > (h.gameStateSnapshot?.income.salary || 0)); break;
        case 'asset_allocator':
          isUnlocked = gameHistory.some(h => {
            const assets = h.gameStateSnapshot?.assets || [];
            const types = new Set(assets.map(a => a.type as string));
            const hasInsurance = types.has('保險') || assets.some(a => a.name?.includes('保險'));
            return types.has('股票') && types.has('不動產') && types.has('企業') && types.has('定存') && (types.has('汽車') || types.has('飛行器')) && hasInsurance;
          });
          break;
        case 'deposit_5m': isUnlocked = gameHistory.some(h => (h.gameStateSnapshot?.assets.filter(a => a.type === '定存').reduce((s, a) => s + a.cost, 0) || 0) >= 5000000); break;
        case 'invest_pro_40m':
          isUnlocked = gameHistory.some(h => {
            const stockSales = h.gameStateSnapshot?.history.filter(t => t.name.includes('賣出股票') || t.name.includes('賣出槓桿'));
            const profit = stockSales?.reduce((sum, t) => {
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
        // case 'long_term_holder': ...
        // case 'asset_legend_1b': ...
        case 'all_round_investor': {
          isUnlocked = gameHistory.some(h => {
            const heldTypes = new Set(h.gameStateSnapshot?.assets.map(a => a.type) || []);
            const tradedTypes = new Set(h.gameStateSnapshot?.history.filter(t => t.name.includes('買入') || t.name.includes('獲得')).map(t => {
              if (t.name.includes('股票')) return '股票';
              if (t.name.includes('房產') || t.name.includes('不動產')) return '不動產';
              if (t.name.includes('事業') || t.name.includes('企業')) return '企業';
              if (t.name.includes('定存')) return '定存';
              if (t.name.includes('汽車') || t.name.includes('飛行器')) return '汽車';
              if (t.name.includes('保險')) return '保險';
              return '';
            }).filter(Boolean));

            // 額外檢查資產名是否包含保險
            const hasInsurance = h.gameStateSnapshot?.assets.some(a => a.name.includes('保險')) || tradedTypes.has('保險');

            const combined = new Set([...heldTypes, ...tradedTypes]);
            return combined.has('股票') && combined.has('不動產') && combined.has('企業') && combined.has('定存') && combined.has('汽車') && hasInsurance;
          });
          break;
        }

        // --- 事件/遊玩類 ---
        case 'first_hospital': isUnlocked = cumulativeHospitals >= 1; break;
        case 'hospital_5': isUnlocked = cumulativeHospitals >= 5; break;
        case 'marriage': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_wedding' && i.checked)); break;
        case 'first_child': isUnlocked = cumulativeChildren >= 1; break;
        case 'multi_children_2': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.happiness.some(i => i.id === 'h_child2' && i.checked)); break;
        case 'rebirth': isUnlocked = gameHistory.some(h => h.isWin && h.gameStateSnapshot?.history.some(t => t.cashChange < 0 && t.balance < 0)); break;
        case 'lucky_koi': isUnlocked = gameHistory.some(h => !h.gameStateSnapshot?.history.some(t => t.cashChange < -100000)); break;
        case 'insurance_guardian': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.some(t => t.name.includes('保險理賠'))); break;
        // case 'fate_master_50': ...
        case 'promotion_pro': isUnlocked = gameHistory.some(h => h.gameStateSnapshot?.history.filter(t => t.name.includes('職等') || t.name.includes('加薪')).length >= 5); break;
        // case 'philanthropist_5m': ...
        case 'fate_god_100': isUnlocked = totalPlays >= 20; break;
        case 'stress_expert_10m': isUnlocked = false; break;
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
            return items.some(i => i.id === 'h_house_self' && i.checked) && items.some(i => i.id === 'h_child1' && i.checked) && items.some(i => i.id === 'h_career' && i.checked) && items.some(i => i.id === 'h_plane' && i.checked) && h.isWin;
          });
          break;
        case 'all_professions_win': isUnlocked = new Set(gameHistory.filter(h => h.isWin).map(h => h.profession)).size >= 10; break;
        case 'perfect_life':
          isUnlocked = gameHistory.some(h => {
            const hItems = h.gameStateSnapshot?.happiness || [];
            const hasDream = hItems.some(i => i.id === 'h_dream' && i.checked);
            const hasCareer = hItems.some(i => i.id === 'h_career' && i.checked);
            return h.happinessScore >= 100 &&
              h.financialSummary.totalLiabilities === 0 &&
              hasDream && hasCareer &&
              (h.gameStateSnapshot?.cash || 0) >= 30000000;
          });
          break;

        default: isUnlocked = false;
      }

      if (isUnlocked) count++;
    });

    return count;
  }, [gameHistory]);

  // Check if there are new achievements
  const hasNewAchievements = useMemo(() => {
    if (!user?.uid) return false;
    const lastViewedCount = parseInt(localStorage.getItem(`achievements_last_viewed_${user.uid}`) || '0');
    return unlockedAchievementsCount > lastViewedCount;
  }, [user?.uid, unlockedAchievementsCount]);

  const handleViewAchievements = () => {
    if (user?.uid) {
      localStorage.setItem(`achievements_last_viewed_${user.uid}`, unlockedAchievementsCount.toString());
    }
    onViewAchievements();
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
        <SafeImage
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

  const [systemStats, setSystemStats] = useState({ totalUsers: 0, activeToday: 0 });

  // 獲取系統統計數據
  React.useEffect(() => {
    if (viewMode !== 'gm') return;

    const fetchSystemStats = async () => {
      try {
        const usersSnap = await safeAsync(getDocs(collection(db, 'users')));
        if (!usersSnap) return;
        const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        setSystemStats({
          totalUsers: allUsers.length,
          activeToday: 0
        });
      } catch (error) {
        console.error('Error fetching system stats:', error);
      }
    };

    fetchSystemStats();
  }, [viewMode]);

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

  if (showRoomView || (room && room.status === 'waiting')) {
    return (
      <div className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden select-none touch-none pt-safe pb-safe">
        <RoomView
          onBack={() => {
            setShowRoomView(false);
            if (onBack) onBack();
          }}
          viewMode={viewMode}
        />
      </div>
    );
  }

  if (showCoachHistory) {
    return <CoachHistoryView onBack={() => setShowCoachHistory(false)} />;
  }

  if (showCoachReport) {
    return <CoachReportView onBack={() => setShowCoachReport(false)} />;
  }

  if (showCoachSelfReport) {
    return <CoachReportView onBack={() => setShowCoachSelfReport(false)} coachFilter={user?.uid} />;
  }

  if (showRoomRecords) {
    return <RoomRecordsView onBack={() => setShowRoomRecords(false)} />;
  }

  return (
    <div className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden select-none pb-safe md:overflow-auto">
      {/* Background with safe area support */}
      <div className="fixed inset-0 bg-slate-950 z-0"></div>
      
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
      </div>

      {/* Header Bar - Fixed height with safe area support */}
      <div className="relative z-50 px-6 pt-safe pb-2 h-auto min-h-[4rem] md:min-h-[5rem] flex justify-between items-center border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/50 shrink-0">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center cursor-pointer hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all group overflow-hidden ${getAvatarBorderStyle(user)}`}
            onClick={() => setShowProfileModal(true)}
          >
            {userAvatar}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white leading-tight">{user?.name || '幸福拓荒者'}</h2>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <SafeImage
                src={viewMode === 'coach' ? getCoachBadge(user, viewMode) : getPlayerBadge(user, viewMode)}
                className={`w-7 h-7 object-contain ${getBadgeGlowStyle(user, viewMode)}`}
                alt=""
              />
              <span className={`text-[11px] font-black tracking-wider ${getTitleColor(user, viewMode)}`}>
                {getUserTitle(user, viewMode)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleViewAchievements}
            className="relative flex items-center gap-1.5 px-3 py-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-all text-[10px] font-bold border border-amber-500/30 hover:border-amber-500/50"
          >
            <Award size={14} />
            <span>成就</span>
            {hasNewAchievements && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border border-slate-950 animate-pulse" />
            )}
          </button>
          <div className="w-[1px] h-4 bg-slate-800 mx-1"></div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-500 hover:text-white hover:bg-red-500/10 rounded-lg transition-all text-[10px] font-bold relative z-[60]"
          >
            <LogOut size={14} />
            <span>登出</span>
          </button>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col px-6 py-4 max-w-4xl mx-auto w-full overflow-hidden md:overflow-y-auto no-scrollbar">
        {/* Main Content Area - Auto Scaling */}
          <div className="flex-1 flex flex-col justify-center gap-6 lg:gap-8 md:justify-start md:pb-8">
            {/* Logo Section - Common to both modes */}
            <div className="text-center relative top-4">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-100 to-amber-500 tracking-tight mb-2">
                {viewMode === 'gm' ? 'GM 控制台' : viewMode === 'coach' ? '執行師' : '幸福流'}
              </h1>
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="h-[1px] w-5 bg-gradient-to-r from-transparent to-amber-500/40"></div>
                <span className="text-amber-500/80 font-bold tracking-[0.25em] text-[10px] md:text-xs uppercase">
                  {viewMode === 'gm' ? 'Game Management' : 'Happiness Flow'}
                </span>
              <div className="h-[1px] w-5 bg-gradient-to-l from-transparent to-amber-500/40"></div>
            </div>
          </div>

          {viewMode === 'gm' ? (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* GM Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-900/50 border border-slate-800/50 rounded-3xl backdrop-blur-sm">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">系統狀態</div>
                  <div className="text-2xl font-black text-emerald-500 flex items-center gap-2">
                    運作正常
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="p-6 bg-slate-900/50 border border-slate-800/50 rounded-3xl backdrop-blur-sm">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">系統總人數</div>
                  <div className="text-2xl font-black text-white">{systemStats.totalUsers}</div>
                </div>
              </div>

              {/* GM Dashboard Wrapper */}
              <CoachDashboard
                onCreateGame={() => { localStorage.removeItem('hf_practice_mode'); setShowCreateRoomModal(true); }}
                onViewHistory={onViewHistory}
                onViewCoachHistory={() => setShowCoachHistory(true)}
                onViewFriends={() => setShowFriendsModal(true)}
                onViewLeaderboard={() => setShowLeaderboardModal(true)}
                onViewTutorial={() => setShowTutorialModal(true)}
                userStats={userStats}
                isGMMode={true}
                onGMToolsStateChange={setIsGMToolsOpen}
                onViewCoachReport={() => setShowCoachReport(true)}
                onViewRoomRecords={() => setShowRoomRecords(true)}
              />
            </div>
          ) : viewMode === 'coach' ? (
            <CoachDashboard
              onCreateGame={() => { localStorage.removeItem('hf_practice_mode'); setShowCreateRoomModal(true); }}
              onViewHistory={onViewHistory}
              onViewCoachHistory={() => setShowCoachHistory(true)}
              onViewFriends={() => setShowFriendsModal(true)}
              onViewLeaderboard={() => setShowLeaderboardModal(true)}
              onViewTutorial={() => setShowTutorialModal(true)}
              userStats={userStats}
              onGMToolsStateChange={setIsGMToolsOpen}
              onViewCoachSelfReport={() => setShowCoachSelfReport(true)}
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
                {(gameState.isSetup || room?.status === 'waiting' || room?.status === 'playing') && room && (
                  <button
                    onClick={() => {
                      if (room.status === 'waiting') {
                        setShowRoomView(true);
                      } else {
                        onResumeGame();
                      }
                    }}
                    className="group relative p-1 overflow-hidden rounded-3xl transition-all duration-500 hover:scale-[1.01] active:scale-[0.99] shadow-2xl shadow-emerald-500/20"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-400 to-emerald-600 animate-gradient-x opacity-90 group-hover:opacity-100 transition-opacity" />
                    <div className="relative p-6 md:p-8 bg-slate-950/20 backdrop-blur-sm rounded-[22px] flex items-center justify-between overflow-hidden">
                      {/* Animated Background Pulse */}
                      <div className="absolute inset-0 bg-emerald-500/10 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />

                      <div className="absolute -right-6 -bottom-6 opacity-10 rotate-12 transition-transform duration-700 group-hover:scale-125 group-hover:rotate-0">
                        <Play size={140} className="fill-white" />
                      </div>

                      <div className="flex flex-col text-left relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[10px] font-black text-emerald-100/60 uppercase tracking-[0.2em]">Session in progress</span>
                        </div>
                        <span className="text-3xl md:text-4xl font-black text-white mb-1 tracking-tight">繼續遊戲</span>
                        <span className="text-emerald-100/60 text-xs md:text-sm font-medium max-w-[240px] leading-relaxed">
                          回到「{gameState.reportName || '我的財報'}」，繼續您的幸福致富之旅
                        </span>
                      </div>

                      <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center relative z-10 group-hover:bg-white/20 transition-all duration-500 shadow-xl group-hover:translate-x-1 group-hover:-rotate-6 border border-white/20">
                        <Play size={28} className="text-white fill-white translate-x-0.5" />
                      </div>
                    </div>
                  </button>
                )}

                {/* Main Action Area - Player Only: Join Room */}
                {(!gameState.isSetup || room?.status !== 'playing') && (
                  <div className="relative group">
                    {/* Background Glow */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-[32px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative bg-slate-900/60 p-4 rounded-3xl border border-white/5 backdrop-blur-xl">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">加入房間</h3>
                        <span className="text-[10px] font-bold text-slate-500 ml-auto uppercase tracking-tighter">Enter Room Code</span>
                      </div>

                      <div className="flex gap-3 h-14">
                        <div className="flex-[2] relative">
                          <input
                            type="text"
                            value={roomCodeInput}
                            onChange={(e) => setRoomCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="請輸入 6 位數房間碼"
                            className="w-full h-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl px-6 text-xl font-black tracking-[0.3em] text-white placeholder:text-slate-800 placeholder:tracking-normal placeholder:text-[10px] focus:border-amber-500/50 focus:bg-slate-900 transition-all outline-none shadow-inner"
                          />
                          {isJoiningRoom && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handleJoinRoom}
                          disabled={roomCodeInput.length !== 6 || isJoiningRoom}
                          className="flex-1 h-full bg-gradient-to-br from-amber-400 to-amber-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-black font-black text-sm rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 group/btn relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                          <span className="relative z-10">進入</span>
                          <Play size={18} className="relative z-10 fill-black group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      </div>

                      {joinError && (
                        <div className="mt-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2 animate-shake">
                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                          {joinError}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── 加入線上棋盤房間 ── */}
                {/* Secondary Actions Grid */}
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <button
                    onClick={() => onViewHistory()}
                    className="group relative p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 hover:border-emerald-500/30 transition-all duration-300 flex items-center gap-4 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-12 h-12 shrink-0 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                      <History size={22} className="text-emerald-500" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-base font-black text-white tracking-wide">歷史紀錄</span>
                      <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">HISTORY</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowLeaderboardModal(true)}
                    className="group relative p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 hover:border-amber-500/30 transition-all duration-300 flex items-center gap-4 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-12 h-12 shrink-0 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform duration-500">
                      <Trophy size={22} className="text-amber-500" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-base font-black text-white tracking-wide">排行榜</span>
                      <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Ranking</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowTutorialModal(true)}
                    className="group relative p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 hover:border-indigo-500/30 transition-all duration-300 flex items-center gap-4 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-12 h-12 shrink-0 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
                      <BookOpen size={22} className="text-indigo-500" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-base font-black text-white tracking-wide">遊戲教學</span>
                      <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Tutorial</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowFriendsModal(true)}
                    className="group relative p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 hover:border-purple-500/30 transition-all duration-300 flex items-center gap-4 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-12 h-12 shrink-0 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform duration-500">
                      <Users size={22} className="text-purple-500" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-base font-black text-white tracking-wide">好友</span>
                      <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Friends</span>
                    </div>
                  </button>

                  <button
                    onClick={handleOpenLetter}
                    className="col-span-2 group relative p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 hover:border-white/20 transition-all duration-300 flex items-center justify-between overflow-hidden"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 shrink-0 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500">
                        <Mail size={22} className="text-slate-300" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-base font-black text-white tracking-wide">致玩家的一封信</span>
                        <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Letter to players</span>
                      </div>
                    </div>
                    {!isLetterRead && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black text-amber-500 uppercase">New</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info - Static bottom */}
        <div className="relative py-4 text-center shrink-0 flex flex-col gap-2">

          <p className={`text-[10px] font-bold uppercase tracking-widest ${IS_DEV_VERSION ? 'text-amber-500' : 'text-slate-600'}`}>
            {VERSION_DISPLAY}
          </p>
          <div className="flex items-center justify-center gap-3 text-[10px] text-slate-600 font-medium">
            <a
              href="https://happinessflow-online.vercel.app/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-500/60 transition-colors"
            >
              隱私權政策
            </a>
            <div className="w-[1px] h-2 bg-slate-800"></div>
            <a
              href="https://happinessflow-online.vercel.app/terms.html"
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
          viewMode={viewMode}
        />
      )}


      {showTutorialModal && (
        <TutorialModal
          isOpen={showTutorialModal}
          onClose={() => setShowTutorialModal(false)}
        />
      )}

      {showLeaderboardModal && (
        <LeaderboardModal
          isOpen={showLeaderboardModal}
          onClose={() => setShowLeaderboardModal(false)}
        />
      )}

      {showFriendsModal && (
        <FriendsModal
          isOpen={showFriendsModal}
          onClose={() => {
            setShowFriendsModal(false);
          }}
          onViewHistory={(uid) => {
            setShowFriendsModal(false);
            onViewHistory(uid);
          }}
        />
      )}
    </div>
  );
};

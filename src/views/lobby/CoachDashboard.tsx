import React, { useState, useEffect } from 'react';
import { Play, Users, TrendingUp, PlusCircle, UserPlus, Search, ShieldCheck, X, Trophy, BookOpen, RefreshCw, AlertTriangle, History, FileText, ChevronRight, ChevronDown, ScrollText, Database } from 'lucide-react';
import { db } from '../../../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, isGM } from '../../context/AuthContext';
import SafeImage from '../../components/common/SafeImage';
import { Button, Input } from '../../components/ui/ui';
import { safeAsync } from '../../utils/utils';
import { handlePromotionToCoach } from '../../utils/referralUtils';

interface CoachDashboardProps {
  onCreateGame: () => void;
  onCreateBoardRoom?: () => void;
  onViewHistory: () => void;
  onViewCoachHistory: () => void;
  onViewFriends: () => void;
  onViewLeaderboard: () => void;
  onViewTutorial: () => void;
  userStats: any;
  isGMMode?: boolean;
  onGMToolsStateChange?: (isOpen: boolean) => void;
  onViewCoachReport?: () => void;
  onViewCoachSelfReport?: () => void;
  onViewRoomRecords?: () => void;
}

// ── 推廣名單樹節點 ──────────────────────────────────────────
const ReferralTreeNode: React.FC<{ user: any; allUsers: any[]; depth: number }> = ({ user, allUsers, depth }) => {
  const [expanded, setExpanded] = React.useState(false);
  const children = allUsers.filter(u => u.referredBy === user.id);
  const roleLabel = user.title === '遊戲管理員' ? '管理員' : user.role === 'coach' ? '執行師' : '玩家';
  const roleColor = user.role === 'coach' ? 'text-amber-400' : 'text-slate-400';

  return (
    <div className={depth > 0 ? 'ml-5 border-l border-slate-700/40 pl-3' : ''}>
      <div className="flex items-center gap-2 py-1.5 group">
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors shrink-0"
        >
          {children.length > 0 ? (
            expanded
              ? <ChevronDown size={13} />
              : <ChevronRight size={13} />
          ) : (
            <span className="w-1 h-1 rounded-full bg-slate-700 inline-block" />
          )}
        </button>
        <span className="text-xs font-bold text-white truncate max-w-[140px]">{user.name || '未設定'}</span>
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 ${roleColor}`}>{roleLabel}</span>
        {children.length > 0 && (
          <span className="text-[9px] text-slate-500 font-bold ml-auto shrink-0">{children.length} 位</span>
        )}
      </div>
      {expanded && children.map(child => (
        <ReferralTreeNode key={child.id} user={child} allUsers={allUsers} depth={depth + 1} />
      ))}
    </div>
  );
};

// ── 推廣名單頁籤 ────────────────────────────────────────────
const ReferralListTab: React.FC<{ allUsers: any[] }> = ({ allUsers }) => {
  const [filter, setFilter] = React.useState('');

  // 只顯示有至少一位直接下線的用戶作為根節點
  const rootReferrers = allUsers.filter(u => {
    const hasReferrals = allUsers.some(x => x.referredBy === u.id);
    if (!hasReferrals) return false;
    if (!filter) return true;
    return u.name?.toLowerCase().includes(filter.toLowerCase()) ||
           u.email?.toLowerCase().includes(filter.toLowerCase());
  }).sort((a, b) => {
    const aCount = allUsers.filter(x => x.referredBy === a.id).length;
    const bCount = allUsers.filter(x => x.referredBy === b.id).length;
    return bCount - aCount;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 font-bold mt-0.5">共 {rootReferrers.length} 位用戶有推廣玩家</p>
        </div>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="搜尋用戶..."
            className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {allUsers.length === 0 ? (
        <div className="text-center py-12 text-slate-500 font-bold text-sm">請先切換到「用戶列表」頁籤以載入資料</div>
      ) : rootReferrers.length === 0 ? (
        <div className="text-center py-12 text-slate-500 font-bold text-sm">目前無用戶有推廣玩家</div>
      ) : (
        <div className="space-y-2">
          {rootReferrers.map(user => (
            <div key={user.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
              <ReferralTreeNode user={user} allUsers={allUsers} depth={0} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const CoachDashboard: React.FC<CoachDashboardProps> = ({
  onCreateGame,
  onCreateBoardRoom,
  onViewHistory,
  onViewCoachHistory,
  onViewFriends,
  onViewLeaderboard,
  onViewTutorial,
  userStats: _userStats,
  isGMMode = false,
  onGMToolsStateChange,
  onViewCoachReport,
  onViewCoachSelfReport,
  onViewRoomRecords,
}) => {
  const { user: currentUser } = useAuth();
  const isGMUser = isGM(currentUser);

  // GM 管理相關狀態
  const [showGMTools, setShowGMTools] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [showClearScoresConfirm, setShowClearScoresConfirm] = useState(false);
  const [gmStats, setGmStats] = useState({ totalUsers: 0, totalCoaches: 0, totalAdmins: 0, totalPlayers: 0 });
  const [searchEmail, setSearchEmail] = useState('');
  const [gmTab, setGmTab] = useState<'manage' | 'users' | 'referrals'>('manage');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userSearchFilter, setUserSearchFilter] = useState('');
  const [userSortBy, setUserSortBy] = useState<'name' | 'email' | 'role'>('name');
  const [showChangelog, setShowChangelog] = useState(false);
  const [coachSessionCount, setCoachSessionCount] = useState<number | null>(null);

  // 從 coach_records 讀取該執行師的實際帶局場次
  useEffect(() => {
    if (!currentUser?.uid) return;
    const fetchCoachSessions = async () => {
      const q = query(
        collection(db, 'coach_records'),
        where('coachId', '==', currentUser.uid),
        where('isFinal', '==', true)
      );
      const snap = await safeAsync(getDocs(q));
      if (snap) setCoachSessionCount(snap.size);
    };
    fetchCoachSessions();
  }, [currentUser?.uid]);

  // Notify parent when GM tools state changes
  useEffect(() => {
    onGMToolsStateChange?.(showGMTools || showSyncConfirm || showClearScoresConfirm);
  }, [showGMTools, showSyncConfirm, showClearScoresConfirm, onGMToolsStateChange]);

  // 獲取統計數據和所有用戶
  const fetchStats = async () => {
    try {
      const querySnapshot = await safeAsync(getDocs(collection(db, 'users')));
      if (!querySnapshot) return;
      const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setAllUsers(users);

      const totalAdmins = users.filter(u => u.title === '遊戲管理員').length;
      const totalCoaches = users.filter(u => u.role === 'coach').length;
      const totalPlayers = users.filter(u => u.role === 'player' && u.title !== '遊戲管理員').length;

      setGmStats({
        totalUsers: users.length,
        totalCoaches,
        totalAdmins,
        totalPlayers
      });
    } catch (error) {
      console.error('獲取統計數據失敗:', error);
    }
  };

  React.useEffect(() => {
    if (isGMUser) {
      fetchStats();
    }
  }, [isGMUser]);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showScoreEdit, setShowScoreEdit] = useState(false);
  const [editScoreValue, setEditScoreValue] = useState('');

  const showToast = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage({ text: '', type: '' });
    }, 3000);
  };

  const handleUpdateScore = async () => {
    if (!searchResult || isUpdating) return;
    const newScore = parseInt(editScoreValue, 10);
    if (isNaN(newScore) || newScore < 0) {
      showToast('請輸入有效的積分數字（0 以上整數）', 'error');
      return;
    }
    setIsUpdating(true);
    try {
      const userRef = doc(db, 'users', searchResult.id);
      await safeAsync(updateDoc(userRef, { rankScore: newScore, experience: newScore }));
      setSearchResult({ ...searchResult, rankScore: newScore, experience: newScore });
      setShowScoreEdit(false);
      showToast(`積分已更新為 ${newScore}`, 'success');
    } catch (e: any) {
      showToast(`更新失敗: ${e.message}`, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // 補錄功能狀態
  const [backfillUID, setBackfillUID] = useState('');
  const [backfillEmail, setBackfillEmail] = useState('');
  const [isBackfilling, setIsBackfilling] = useState(false);

  // 推廣綁定功能狀態
  const [bindReferrerEmail, setBindReferrerEmail] = useState('');
  const [bindPlayerEmails, setBindPlayerEmails] = useState('');
  const [isBindingReferral, setIsBindingReferral] = useState(false);
  const [bindReferralResult, setBindReferralResult] = useState('');

  const handleBackfillUser = async () => {
    if (!backfillUID.trim() || !backfillEmail.trim()) {
      showToast('請輸入 UID 和 Email', 'error');
      return;
    }
    setIsBackfilling(true);
    try {
      const email = backfillEmail.trim();
      const uid = backfillUID.trim();
      const nickname = email.split('@')[0];

      await safeAsync(setDoc(doc(db, 'users', uid), {
        uid: uid,
        email: email,
        name: nickname,
        role: 'player',
        title: '',
        photoURL: 'bee',
        createdAt: new Date().toISOString()
      }, { merge: true }));

      showToast(`已成功補錄用戶：${email}`, 'success');
      setBackfillUID('');
      setBackfillEmail('');
      fetchStats(); // 重新獲取統計數據
    } catch (error: any) {
      console.error('補錄失敗:', error);
      showToast(`補錄失敗: ${error.message}`, 'error');
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleBindReferral = async () => {
    const referrerEmail = bindReferrerEmail.trim();
    const playerList = bindPlayerEmails.split('\n').map(s => s.trim()).filter(Boolean);
    if (!referrerEmail || playerList.length === 0) {
      setBindReferralResult('❌ 請填入推廣者信箱和至少一位玩家信箱');
      return;
    }
    setIsBindingReferral(true);
    setBindReferralResult('處理中...');
    try {
      const allSnap = await safeAsync(getDocs(collection(db, 'users')));
      if (!allSnap) throw new Error('無法讀取用戶資料');
      const allUsers = allSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // 找推廣者
      const referrer = allUsers.find((u: any) =>
        u.email?.toLowerCase() === referrerEmail.toLowerCase()
      );
      if (!referrer) {
        setBindReferralResult(`❌ 找不到推廣者：${referrerEmail}`);
        setIsBindingReferral(false);
        return;
      }

      const lines: string[] = [`✅ 推廣者：${referrer.name}（${referrer.email}）`, ''];
      for (const playerInput of playerList) {
        const player = allUsers.find((u: any) =>
          u.email?.toLowerCase() === playerInput.toLowerCase() ||
          u.name?.toLowerCase() === playerInput.toLowerCase()
        );
        if (!player) {
          lines.push(`❌ 找不到：${playerInput}`);
          continue;
        }
        await safeAsync(
          import('firebase/firestore').then(({ updateDoc, doc: firestoreDoc }) =>
            updateDoc(firestoreDoc(db, 'users', player.id), {
              referredBy: referrer.id,
              effectiveCoachId: (referrer.role === 'coach' || referrer.role === 'gm') ? referrer.id : (referrer.effectiveCoachId || null)
            })
          )
        );
        lines.push(`✅ 已綁定：${player.name}（${player.email}）`);
      }
      setBindReferralResult(lines.join('\n'));
    } catch (e: any) {
      setBindReferralResult(`❌ 錯誤：${e.message}`);
    } finally {
      setIsBindingReferral(false);
    }
  };

  const handleSearchUser = async () => {
    const searchTerm = searchEmail.trim();
    if (!searchTerm) return;
    setIsSearching(true);
    setSearchResult(null);

    try {
      const lowerSearch = searchTerm.toLowerCase();
      console.log('Searching for:', searchTerm);

      // 1. 先嘗試 UID 精確搜尋
      const userDocRef = doc(db, 'users', searchTerm);
      const userDocSnap = await safeAsync(getDoc(userDocRef));
      if (userDocSnap?.exists()) {
        setSearchResult({ id: userDocSnap.id, ...userDocSnap.data() });
        setIsSearching(false);
        return;
      }

      // 2. 獲取所有使用者進行模糊匹配 (Email 或 名字)
      const allUsersQuery = query(collection(db, 'users'));
      const allUsersSnapshot = await safeAsync(getDocs(allUsersQuery));
      if (!allUsersSnapshot) {
        setIsSearching(false);
        return;
      }

      const foundUsers = allUsersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() as any }))
        .filter(u =>
          (u.email && u.email.toLowerCase().includes(lowerSearch)) ||
          (u.name && u.name.toLowerCase().includes(lowerSearch))
        );

      if (foundUsers.length > 0) {
        // 如果只有一個結果，直接顯示；如果多個，目前先取第一個 (未來可以擴充為列表)
        setSearchResult(foundUsers[0]);
        if (foundUsers.length > 1) {
          showToast(`找到 ${foundUsers.length} 個相符結果`, 'success');
        }
      } else {
        showToast(`找不到與 "${searchTerm}" 相關的使用者`, 'error');
      }
    } catch (error) {
      console.error('搜尋失敗:', error);
      showToast('搜尋發生錯誤，請稍後再試', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpdateUserRole = async (newRole: 'coach' | 'player') => {
    if (!searchResult || isUpdating) return;
    setIsUpdating(true);

    try {
      console.log(`Attempting to update user role to ${newRole}:`, searchResult.id);
      const userRef = doc(db, 'users', searchResult.id);

      await safeAsync(setDoc(userRef, {
        role: newRole,
        updatedAt: new Date().toISOString()
      }, { merge: true }));

      // 玩家升格為執行師時，自動將其下線的 effectiveCoachId 轉移到本人
      if (newRole === 'coach') {
        handlePromotionToCoach(searchResult.id).catch(e =>
          console.error('升格轉移下線失敗:', e)
        );
      }

      setSearchResult({ ...searchResult, role: newRole });
      fetchStats(); // 重新獲取統計數據
      showToast(`已成功更新身分為：${newRole === 'coach' ? '執行師' : '玩家'}`, 'success');
    } catch (error: any) {
      console.error('更新角色失敗詳情:', error);
      showToast(`更新失敗: ${error.message}`, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateGMStatus = async (isGM: boolean) => {
    if (!searchResult || isUpdating) return;
    setIsUpdating(true);

    try {
      const userRef = doc(db, 'users', searchResult.id);
      const newTitle = isGM ? '遊戲管理員' : '';

      await safeAsync(setDoc(userRef, {
        title: newTitle,
        updatedAt: new Date().toISOString()
      }, { merge: true }));

      setSearchResult({ ...searchResult, title: newTitle });
      fetchStats(); // 重新獲取統計數據
      showToast(isGM ? '已成功設為管理員' : '已成功移除管理員權限', 'success');
    } catch (error: any) {
      console.error('更新管理員權限失敗:', error);
      showToast(`更新失敗: ${error.message}`, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // 全服積分同步邏輯
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncScores = () => {
    setShowSyncConfirm(true);
  };

  const executeSyncScores = async () => {
    setShowSyncConfirm(false);
    setIsSyncing(true);
    try {
      // 1. 讀取所有遊戲紀錄
      const recordsRef = collection(db, 'score_records', 'S1', 'records');
      const recordsSnap = await safeAsync(getDocs(recordsRef));
      if (!recordsSnap) {
        setIsSyncing(false);
        return;
      }

      const playerScores: Record<string, number> = {};
      let totalGames = 0;

      recordsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.players && Array.isArray(data.players)) {
          totalGames++;
          data.players.forEach((player: any) => {
            if (player.uid && typeof player.totalScore === 'number') {
              playerScores[player.uid] = (playerScores[player.uid] || 0) + player.totalScore;
            }
          });
        }
      });

      console.log(`分析完成：共 ${totalGames} 場遊戲，${Object.keys(playerScores).length} 位玩家`);

      // 2. 批量更新用戶積分
      const userIds = Object.keys(playerScores);
      const batchSize = 450;

      for (let i = 0; i < userIds.length; i += batchSize) {
        const currentBatch = writeBatch(db);
        const chunk = userIds.slice(i, i + batchSize);

        chunk.forEach(uid => {
          const userRef = doc(db, 'users', uid);
          currentBatch.set(userRef, { experience: playerScores[uid], rankScore: playerScores[uid] }, { merge: true });
        });

        await currentBatch.commit();
      }

      showToast(`同步成功！已重新計算 ${userIds.length} 位玩家的積分。`, 'success');
    } catch (e: any) {
      console.error('同步失敗:', e);
      showToast('同步失敗: ' + e.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearScores = () => {
    setShowClearScoresConfirm(true);
  };

  const executeClearScores = async () => {
    setShowClearScoresConfirm(false);
    setIsSyncing(true);
    try {
      const allUsersSnap = await safeAsync(getDocs(collection(db, 'users')));
      if (!allUsersSnap) {
        setIsSyncing(false);
        return;
      }

      const userIds = allUsersSnap.docs.map(d => d.id);
      const batchSize = 450;

      for (let i = 0; i < userIds.length; i += batchSize) {
        const currentBatch = writeBatch(db);
        userIds.slice(i, i + batchSize).forEach(uid => {
          currentBatch.set(doc(db, 'users', uid), { experience: 0, rankScore: 0 }, { merge: true });
        });
        await currentBatch.commit();
      }

      showToast(`已清除 ${userIds.length} 位玩家的排行榜積分`, 'success');
    } catch (e: any) {
      console.error('清除積分失敗:', e);
      showToast('清除失敗: ' + e.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* GM Admin Tools - Only visible in GM mode */}
      {isGMMode && isGMUser && (
        <div className="flex flex-col gap-4">
          <div className="relative group">
            <button
              onClick={() => setShowGMTools(!showGMTools)}
              className="w-full p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center justify-between hover:bg-indigo-500/20 transition-all group shadow-lg shadow-indigo-500/5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                  <ShieldCheck size={20} className="text-indigo-400" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-black text-white">GM 權限管理系統</div>
                  <div className="text-[10px] text-indigo-400/80 font-bold uppercase tracking-widest">Administrator Controls</div>
                </div>
              </div>
              <div className="px-3 py-1 bg-indigo-500/20 rounded-full text-[10px] font-black text-indigo-400 border border-indigo-500/30 uppercase">
                {showGMTools ? '收合' : '展開管理'}
              </div>
            </button>

            {showGMTools && (
              <div className="fixed top-20 inset-x-0 bottom-0 z-[100] bg-slate-950/98 backdrop-blur-2xl flex flex-col items-center p-6 md:p-12 overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
                <div className="w-full max-w-4xl space-y-8">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-8">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-indigo-500/20 rounded-3xl flex items-center justify-center border border-indigo-500/30 shadow-2xl shadow-indigo-500/20">
                        <ShieldCheck size={32} className="text-indigo-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white tracking-tight">GM 權限管理系統</h2>
                        <p className="text-indigo-400/60 font-black uppercase tracking-[0.2em] text-[10px] mt-0.5">Administrator Controls</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowGMTools(false)}
                      className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl flex items-center justify-center transition-all border border-slate-700 hover:border-slate-600 group"
                    >
                      <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 bg-slate-900/50 border border-slate-800/50 rounded-2xl backdrop-blur-sm">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">系統總人數</div>
                      <div className="text-xl font-black text-white">{gmStats.totalUsers}</div>
                    </div>
                    <div className="p-4 bg-slate-900/50 border border-slate-800/50 rounded-2xl backdrop-blur-sm">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">一般玩家</div>
                      <div className="text-xl font-black text-white/80">{gmStats.totalPlayers}</div>
                    </div>
                    <div className="p-4 bg-slate-900/50 border border-slate-800/50 rounded-2xl backdrop-blur-sm">
                      <div className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest mb-0.5">執行師</div>
                      <div className="text-xl font-black text-amber-500">{gmStats.totalCoaches}</div>
                    </div>
                    <div className="p-4 bg-slate-900/50 border border-slate-800/50 rounded-2xl backdrop-blur-sm">
                      <div className="text-[9px] font-black text-indigo-400/80 uppercase tracking-widest mb-0.5">管理員</div>
                      <div className="text-xl font-black text-indigo-400">{gmStats.totalAdmins}</div>
                    </div>
                  </div>

                  {/* Tab Navigation */}
                  <div className="flex gap-2 border-b border-slate-800/50">
                    <button
                      onClick={() => setGmTab('manage')}
                      className={`px-6 py-3 font-black text-sm uppercase tracking-wider transition-all ${gmTab === 'manage' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      權限管理
                    </button>
                    <button
                      onClick={() => setGmTab('users')}
                      className={`px-6 py-3 font-black text-sm uppercase tracking-wider transition-all ${gmTab === 'users' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      用戶列表
                    </button>
                    <button
                      onClick={() => setGmTab('referrals')}
                      className={`px-6 py-3 font-black text-sm uppercase tracking-wider transition-all ${gmTab === 'referrals' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      用戶推廣名單
                    </button>
                  </div>

                  {/* Tab Content */}
                  {gmTab === 'referrals' ? (
                    <ReferralListTab allUsers={allUsers} />
                  ) : gmTab === 'manage' ? (
                    <>
                      {/* Search Area */}
                      <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-[32px] p-8 md:p-10 space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-indigo-300/80 ml-1">搜尋使用者</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400/50" size={20} />
                          <Input
                            placeholder="輸入使用者Email或UID..."
                            value={searchEmail}
                            onChange={(e) => setSearchEmail(e.target.value)}
                            className="pl-12 h-12 bg-slate-900/50 border-indigo-500/20 rounded-xl text-base focus:ring-indigo-500/40"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                          />
                        </div>
                        <Button
                          onClick={handleSearchUser}
                          disabled={isSearching}
                          className="bg-indigo-600 hover:bg-indigo-500 font-black px-10 h-12 rounded-xl text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                        >
                          {isSearching ? '搜尋中...' : '搜尋'}
                        </Button>
                      </div>
                    </div>

                    {message.text && (
                      <div className={`p-4 rounded-2xl text-sm font-black text-center animate-in fade-in zoom-in-95 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                        {message.text}
                      </div>
                    )}

                    {searchResult && (
                      <div className="relative p-6 bg-slate-900/80 border border-indigo-500/20 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
                        {/* Close search results */}
                        <button
                          onClick={() => setSearchResult(null)}
                          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                        >
                          <X size={16} />
                        </button>

                        <div className="flex items-center gap-5">
                          <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-3xl overflow-hidden border-2 border-indigo-500/20 shadow-inner relative group">
                            {searchResult.photoURL && (searchResult.photoURL.startsWith('http') || searchResult.photoURL.startsWith('data:image')) ? (
                              <SafeImage
                                src={searchResult.photoURL}
                                alt=""
                                className="w-full h-full object-cover"
                                style={searchResult.photoPosition ? {
                                  objectPosition: (() => {
                                    try {
                                      const pos = typeof searchResult.photoPosition === 'string'
                                        ? JSON.parse(searchResult.photoPosition)
                                        : searchResult.photoPosition;
                                      return `${pos.x}% ${pos.y}%`;
                                    } catch (e) {
                                      return 'center';
                                    }
                                  })(),
                                  transform: `scale(${searchResult.photoScale || 1})`
                                } : {}}
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-b from-amber-300 to-amber-600 flex items-center justify-center text-4xl shadow-inner select-none">
                                🐝
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <div className="text-base font-black text-white">{searchResult.name}</div>
                            <div className="text-[11px] text-slate-500 font-medium mb-1">{searchResult.email}</div>
                            <div className="flex flex-wrap gap-2">
                              {/* 顯示身分標籤 */}
                              {(searchResult.title === '遊戲管理員' || searchResult.role === 'gm') && (
                                <div className="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                  管理員
                                </div>
                              )}
                              {searchResult.role === 'coach' && (
                                <div className="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                  執行師
                                </div>
                              )}
                              {searchResult.role === 'player' && searchResult.title !== '遊戲管理員' && (
                                <div className="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                                  一般玩家
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 w-full md:w-auto">
                          {/* 積分修改區塊 */}
                          <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">目前積分</div>
                            <div className="text-sm font-black text-amber-400 flex-1">{(searchResult.rankScore || 0).toLocaleString()}</div>
                            {!showScoreEdit ? (
                              <Button
                                onClick={() => { setShowScoreEdit(true); setEditScoreValue(String(searchResult.rankScore || 0)); }}
                                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-black text-xs px-4 h-8 rounded-xl border border-amber-500/30 transition-all"
                              >
                                修改積分
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  value={editScoreValue}
                                  onChange={(e) => setEditScoreValue(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateScore()}
                                  className="h-8 w-24 bg-slate-950/50 border-amber-500/30 rounded-xl text-sm text-center font-black"
                                  autoFocus
                                />
                                <Button
                                  onClick={handleUpdateScore}
                                  disabled={isUpdating}
                                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 h-8 rounded-xl transition-all"
                                >
                                  確認
                                </Button>
                                <button
                                  onClick={() => setShowScoreEdit(false)}
                                  className="text-slate-500 hover:text-white transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-3 w-full">
                          {/* 管理員權限按鈕 */}
                          {!(searchResult.title === '遊戲管理員' || searchResult.role === 'gm') ? (
                            <Button
                              onClick={() => handleUpdateGMStatus(true)}
                              disabled={isUpdating}
                              className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs gap-2 px-6 h-12 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 whitespace-nowrap"
                            >
                              <ShieldCheck size={16} />
                              設為管理員
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleUpdateGMStatus(false)}
                              disabled={isUpdating}
                              className="flex-1 md:flex-none bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 font-black text-xs gap-2 px-6 h-12 rounded-xl border border-slate-700 hover:border-rose-500/50 transition-all active:scale-95 whitespace-nowrap"
                            >
                              <X size={16} />
                              移除管理員
                            </Button>
                          )}

                          {/* 執行師權限按鈕 */}
                          {searchResult.role !== 'coach' ? (
                            <Button
                              onClick={() => handleUpdateUserRole('coach')}
                              disabled={isUpdating}
                              className="flex-1 md:flex-none bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs gap-2 px-6 h-12 rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 whitespace-nowrap"
                            >
                              <UserPlus size={16} />
                              授權執行師
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleUpdateUserRole('player')}
                              disabled={isUpdating}
                              className="flex-1 md:flex-none bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 font-black text-xs gap-2 px-6 h-12 rounded-xl border border-slate-700 hover:border-rose-500/50 transition-all active:scale-95 whitespace-nowrap"
                            >
                              <X size={16} />
                              取消執行師
                            </Button>
                          )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manual Backfill Area */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 md:p-10 space-y-6">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-black text-white">手動補錄遺漏帳號</h3>
                      <p className="text-xs text-slate-500 font-bold">當學員已註冊但資料庫未記錄時，可在此手動建立資料</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">UID</label>
                        <Input
                          placeholder="輸入學員 UID..."
                          value={backfillUID}
                          onChange={(e) => setBackfillUID(e.target.value)}
                          className="h-12 bg-slate-950/50 border-slate-800 rounded-xl text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                        <Input
                          placeholder="輸入學員 Email..."
                          value={backfillEmail}
                          onChange={(e) => setBackfillEmail(e.target.value)}
                          className="h-12 bg-slate-950/50 border-slate-800 rounded-xl text-sm"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleBackfillUser}
                      disabled={isBackfilling}
                      className="w-full bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white font-black h-12 rounded-xl border border-slate-700 hover:border-indigo-500 transition-all active:scale-95"
                    >
                      {isBackfilling ? '補錄中...' : '執行補錄資料'}
                    </Button>
                  </div>

                  {/* 手動綁定推廣關係 */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 md:p-10 space-y-6">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-black text-white">手動綁定推廣關係</h3>
                      <p className="text-xs text-slate-500 font-bold">將指定玩家設定為某位用戶的推廣下線，支援 Email 或名稱查詢</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">推廣者 Email</label>
                        <Input
                          placeholder="wcgeso0221@gmail.com"
                          value={bindReferrerEmail}
                          onChange={e => setBindReferrerEmail(e.target.value)}
                          className="h-12 bg-slate-950/50 border-slate-800 rounded-xl text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">玩家清單（每行一位，填 Email 或名稱）</label>
                        <textarea
                          placeholder={'劉冠瑋\n林茂岑\n黃拉拉\nClaire'}
                          value={bindPlayerEmails}
                          onChange={e => setBindPlayerEmails(e.target.value)}
                          rows={4}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-xl text-sm text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleBindReferral}
                      disabled={isBindingReferral}
                      className="w-full bg-slate-800 hover:bg-violet-600 text-slate-400 hover:text-white font-black h-12 rounded-xl border border-slate-700 hover:border-violet-500 transition-all active:scale-95"
                    >
                      {isBindingReferral ? '綁定中...' : '執行推廣綁定'}
                    </Button>
                    {bindReferralResult && (
                      <pre className="text-xs text-slate-300 bg-slate-950/60 border border-slate-800 rounded-xl p-4 whitespace-pre-wrap leading-relaxed">
                        {bindReferralResult}
                      </pre>
                    )}
                  </div>
                    </>
                  ) : (
                    <>
                      {/* Users List Tab */}
                      <div className="space-y-6">
                        {/* Search and Sort */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="md:col-span-2 space-y-2">
                            <label className="text-sm font-black text-indigo-300/80 ml-1">搜尋用戶</label>
                            <div className="relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400/50" size={20} />
                              <Input
                                placeholder="輸入名稱或信箱..."
                                value={userSearchFilter}
                                onChange={(e) => setUserSearchFilter(e.target.value)}
                                className="pl-12 h-12 bg-slate-900/50 border-indigo-500/20 rounded-xl text-base focus:ring-indigo-500/40 w-full"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-black text-indigo-300/80 ml-1">排序</label>
                            <select
                              value={userSortBy}
                              onChange={(e) => setUserSortBy(e.target.value as 'name' | 'email' | 'role')}
                              className="w-full h-12 bg-slate-900/50 border border-indigo-500/20 rounded-xl text-white px-4 focus:ring-2 focus:ring-indigo-500/40 appearance-none font-semibold"
                            >
                              <option value="name">按名稱</option>
                              <option value="email">按信箱</option>
                              <option value="role">按權限</option>
                            </select>
                          </div>
                        </div>

                        {/* Users Table */}
                        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden max-h-[600px] overflow-y-auto">
                          <table className="w-full">
                            <thead className="bg-slate-900/80 border-b border-slate-800/50 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">名稱</th>
                                <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">信箱</th>
                                <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">權限</th>
                                <th className="px-4 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allUsers
                                .filter(u => {
                                  const filter = userSearchFilter.toLowerCase();
                                  return (u.name?.toLowerCase().includes(filter) || u.email?.toLowerCase().includes(filter));
                                })
                                .sort((a, b) => {
                                  if (userSortBy === 'name') return (a.name || '').localeCompare(b.name || '');
                                  if (userSortBy === 'email') return (a.email || '').localeCompare(b.email || '');
                                  // Sort by role: admin, coach, player
                                  const roleOrder: Record<string, number> = { '遊戲管理員': 0, 'coach': 1, 'player': 2 };
                                  const aRole = a.title === '遊戲管理員' ? '遊戲管理員' : a.role;
                                  const bRole = b.title === '遊戲管理員' ? '遊戲管理員' : b.role;
                                  return (roleOrder[aRole] || 999) - (roleOrder[bRole] || 999);
                                })
                                .map((user, idx) => {
                                  const roleLabel = user.title === '遊戲管理員' ? '管理員' : (user.role === 'coach' ? '執行師' : '玩家');
                                  const roleColor = user.title === '遊戲管理員' ? 'text-indigo-400' : (user.role === 'coach' ? 'text-amber-500' : 'text-slate-400');

                                  return (
                                    <tr key={user.id} className={`border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors ${idx % 2 === 0 ? 'bg-slate-950/20' : ''}`}>
                                      <td className="px-4 py-4 text-sm font-semibold text-white">{user.name || '未設定'}</td>
                                      <td className="px-4 py-4 text-sm text-slate-400">{user.email || '無'}</td>
                                      <td className="px-4 py-4 text-sm">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-800/50 border ${roleColor} border-current/20`}>
                                          {roleLabel}
                                        </span>
                                      </td>
                                      <td className="px-4 py-4 text-center">
                                        <button
                                          onClick={() => {
                                            setSearchEmail(user.email || user.id);
                                            setGmTab('manage');
                                          }}
                                          className="px-3 py-1.5 text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all active:scale-95"
                                        >
                                          編輯
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                          {allUsers.filter(u => {
                            const filter = userSearchFilter.toLowerCase();
                            return (u.name?.toLowerCase().includes(filter) || u.email?.toLowerCase().includes(filter));
                          }).length === 0 && (
                            <div className="text-center py-8 text-slate-400 font-semibold">
                              未找到符合的用戶
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => onViewCoachReport?.()}
            className="w-full p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-between hover:bg-emerald-500/20 transition-all group shadow-lg shadow-emerald-500/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                <FileText size={20} className="text-emerald-500" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">執行師報表</div>
                <div className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-widest">Commission Report</div>
              </div>
            </div>
            <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-[10px] font-black text-emerald-500 border border-emerald-500/30 uppercase">
              查看報表
            </div>
          </button>

          <button
            onClick={() => onViewRoomRecords?.()}
            className="w-full p-4 bg-violet-500/10 border border-violet-500/20 rounded-3xl flex items-center justify-between hover:bg-violet-500/20 transition-all group shadow-lg shadow-violet-500/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-500/20 rounded-2xl flex items-center justify-center border border-violet-500/30">
                <Database size={20} className="text-violet-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">房間紀錄管理</div>
                <div className="text-[10px] text-violet-400/80 font-bold uppercase tracking-widest">Room Records</div>
              </div>
            </div>
            <div className="px-3 py-1 bg-violet-500/20 rounded-full text-[10px] font-black text-violet-400 border border-violet-500/30 uppercase">
              瀏覽紀錄
            </div>
          </button>

          <button
            onClick={() => setShowChangelog(true)}
            className="w-full p-4 bg-sky-500/10 border border-sky-500/20 rounded-3xl flex items-center justify-between hover:bg-sky-500/20 transition-all group shadow-lg shadow-sky-500/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-500/20 rounded-2xl flex items-center justify-center border border-sky-500/30">
                <ScrollText size={20} className="text-sky-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">系統更新日誌</div>
                <div className="text-[10px] text-sky-400/80 font-bold uppercase tracking-widest">Changelog</div>
              </div>
            </div>
            <div className="px-3 py-1 bg-sky-500/20 rounded-full text-[10px] font-black text-sky-400 border border-sky-500/30 uppercase">
              查看日誌
            </div>
          </button>

          <button
            onClick={handleSyncScores}
            disabled={isSyncing}
            className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center justify-between hover:bg-amber-500/20 transition-all group shadow-lg shadow-amber-500/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-2xl flex items-center justify-center border border-amber-500/30">
                {isSyncing ? (
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RefreshCw size={20} className="text-amber-500" />
                )}
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">重新同步全服積分</div>
                <div className="text-[10px] text-amber-500/80 font-bold uppercase tracking-widest">System Maintenance</div>
              </div>
            </div>
            <div className="px-3 py-1 bg-amber-500/20 rounded-full text-[10px] font-black text-amber-500 border border-amber-500/30 uppercase">
              {isSyncing ? '同步中...' : '執行同步'}
            </div>
          </button>

          <button
            onClick={handleClearScores}
            disabled={isSyncing}
            className="w-full p-4 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center justify-between hover:bg-rose-500/20 transition-all group shadow-lg shadow-rose-500/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500/20 rounded-2xl flex items-center justify-center border border-rose-500/30">
                <Trophy size={20} className="text-rose-500" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">清除排行榜積分</div>
                <div className="text-[10px] text-rose-500/80 font-bold uppercase tracking-widest">Reset Leaderboard</div>
              </div>
            </div>
            <div className="px-3 py-1 bg-rose-500/20 rounded-full text-[10px] font-black text-rose-500 border border-rose-500/30 uppercase">
              {isSyncing ? '處理中...' : '清除積分'}
            </div>
          </button>
        </div>
      )}


      {/* Changelog Modal */}
      <AnimatePresence>
        {showChangelog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10002] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowChangelog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-[32px] max-w-sm w-full shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sky-500/20 rounded-2xl flex items-center justify-center border border-sky-500/30">
                    <ScrollText size={20} className="text-sky-400" />
                  </div>
                  <div>
                    <div className="text-base font-black text-white">系統更新日誌</div>
                    <div className="text-[10px] text-sky-400/80 font-bold uppercase tracking-widest">Changelog</div>
                  </div>
                </div>
                <button onClick={() => setShowChangelog(false)} className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto no-scrollbar">
                {[
                  {
                    version: 'v2.0',
                    date: '2026-06-24',
                    color: 'amber',
                    items: [
                      '幸福家庭重要歷程卡片改版：大地圖只顯示規則表，玩家端卡片只顯示個人目前進度與當前階段',
                      '全面移除金額顯示中的 H 單位，統一介面金額格式',
                      '財務檢核現金不足時，新增獨立的「強制負債」規則，不再記入信用貸款',
                      '強制負債改為零利息，且後續有現金流入時會優先自動償還',
                      '新聞卡中的不動產與企業投資財務檢核規則，已統一對齊一般買不動產與買企業流程',
                    ],
                  },
                  {
                    version: 'v1.4.7',
                    date: '2026-05-28',
                    color: 'emerald',
                    items: [
                      '修復執行師儲存紀錄時錯誤顯示「練習模式不儲存紀錄」的問題',
                      '執行師儲存機制改為直接從 Firestore 讀取最新玩家狀態，不再依賴記憶體，確保資料準確',
                      '練習模式判斷改以房間本身的 isPractice 欄位為準，不再受 localStorage 殘留旗標影響',
                      '修復前一場練習模式未正常退出導致下一場正式遊戲無法儲存的問題',
                    ],
                  },
                  {
                    version: 'v1.4.6',
                    date: '2026-05-15',
                    color: 'rose',
                    items: [
                      '修復排行榜積分重複累加問題：同一場遊戲的積分現在只會計算一次，不再因重複觸發而倍增',
                      'GM 管理面板新增「手動修改個人積分」功能：可搜尋玩家並直接修正 rankScore',
                      '修復排行榜底部「您的積分」顯示舊快取數值的問題，改為即時抓取最新資料',
                      '修復同一房間進行多場遊戲時，後場覆蓋前場紀錄的問題（sessionId 現在每場重新生成）',
                      'GM 房間紀錄管理新增「查看財務報表」功能：點擊玩家可查看與遊戲內相同格式的完整財務報表',
                      '修正自用房幸福分數邏輯：同時持有多間自用房時，改為只計算分數最高的那一間',
                    ],
                  },
                  {
                    version: 'v1.4.5',
                    date: '2026-05-14',
                    color: 'sky',
                    items: [
                      '新增玩家端自動存檔機制：遊戲開始後每 1 分鐘自動將遊戲資料儲存至 Firebase',
                      '執行師端自動存檔頻率調整為每 1 分鐘一次，確保後台資料即時更新',
                      '新增 player_sessions 資料集合：玩家資料獨立備份，即使執行師斷線仍保留紀錄',
                      '歷史紀錄頁面整合官方紀錄與玩家自存紀錄，避免重複顯示',
                      '遊戲結束時玩家端同步觸發最終存檔，確保資料完整',
                    ],
                  },
                  {
                    version: 'v1.4.4',
                    date: '2026-05-11',
                    color: 'emerald',
                    items: [
                      'GM 控制台新增「房間紀錄管理」頁面：可瀏覽、搜尋所有開房紀錄，並支援單筆刪除',
                      '房間紀錄管理新增「手動新增紀錄」功能：可補登遺漏場次，支援搜尋綁定玩家帳號並自動累加排名積分',
                      '財務檢核彈窗刪除按鈕放大並優化間距',
                    ],
                  },
                  {
                    version: 'v1.4.3',
                    date: '2026-05-04',
                    color: 'violet',
                    items: [
                      '升等考試與終身學習改為需經執行師審核後才能擲骰',
                      '開發者傳送門新增「開房邀請練習」模式：正常開房、玩家可加入，但不計分不留紀錄',
                      '醫療保險限定每位玩家僅能購買一張',
                      '股票買入／賣出表單新增預計總金額即時顯示',
                      '兼職工作室升級按鈕改為文字「升級」，更易辨識',
                      '企業升級改為兩次擲骰：第一骰判定是否符合（≥5），第二骰決定收入增加（點數 × 10,000）',
                      '修復手機版幸福指數卡片被固定標題列遮擋的問題',
                      '點擊幸福事件 tab 自動切換至幸福歷程，並預先選取當前可進行的階段',
                      '遊戲頂部新增財務自由指標列，即時顯示理財收入與總支出的比較及達成狀態',
                      '修復遊戲評分彈窗在手機上超出螢幕且無法上下捲動的問題',
                      '幸福指數卡片高度縮小，改善手機版版面空間利用',
                    ],
                  },
                  {
                    version: 'v1.4.2',
                    date: '2026-05-02',
                    color: 'indigo',
                    items: [
                      '執行師模式新增「執行報表」入口：只顯示個人場次與應繳回金額',
                      '執行師報表新增應繳回公司明細（公司利潤 30%、賽季獎金 10%、推廣獎金 20%）',
                      '修復執行師報表頁面在手機上被瀏海遮擋的問題',
                      'GM 頁面按鈕順序調整',
                    ],
                  },
                  {
                    version: 'v1.4.1',
                    date: '2026-05-02',
                    color: 'teal',
                    items: [
                      '個人頁面「推廣玩家」區塊改為僅執行師身份可見',
                    ],
                  },
                  {
                    version: 'v1.4.0',
                    date: '2026-05-02',
                    color: 'sky',
                    items: [
                      '新增邀請碼系統：每位用戶自動生成專屬邀請碼',
                      '支援多層推廣鏈結，推廣獎金自動歸屬最近執行師',
                      '執行師升格後自動更新下線的歸屬',
                      '新增「用戶推廣名單」總表（GM 控制台）',
                      '新增系統更新日誌入口',
                    ],
                  },
                  {
                    version: 'v1.3.0',
                    date: '2026-04-28',
                    color: 'violet',
                    items: [
                      '新增 PWA 安裝引導：iOS 步驟說明 + Android 原生安裝',
                      '修復個人彈窗在桌面版無法捲動的問題',
                      '邀請碼區塊拆分為「複製邀請碼」與「分享連結」兩個按鈕',
                    ],
                  },
                  {
                    version: 'v1.2.0',
                    date: '2026-04-20',
                    color: 'emerald',
                    items: [
                      '排行榜積分改為遊戲結算積分的累加（rankScore）',
                      '修復排行榜顯示體驗值而非遊戲積分的問題',
                    ],
                  },
                  {
                    version: 'v1.1.0',
                    date: '2026-04-10',
                    color: 'amber',
                    items: [
                      '新增 GM 控制台：用戶管理、角色調整',
                      '新增執行師報表功能',
                      '新增好友系統與排行榜',
                    ],
                  },
                  {
                    version: 'v1.0.0',
                    date: '2026-03-01',
                    color: 'slate',
                    items: [
                      '第二人生 正式上線',
                      '基礎遊戲功能：創建房間、遊戲結算',
                      '用戶驗證與個人檔案',
                    ],
                  },
                ].map(log => (
                  <div key={log.version} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full bg-${log.color}-500/20 text-${log.color}-400 border border-${log.color}-500/30`}>
                        {log.version}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{log.date}</span>
                    </div>
                    <ul className="space-y-1 pl-2">
                      {log.items.map((item, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="text-slate-500 mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Scores Confirmation Modal */}
      <AnimatePresence>
        {showClearScoresConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10002] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-8 rounded-[32px] max-w-sm w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-500/20 rounded-3xl flex items-center justify-center mx-auto text-rose-500">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">確認清除排行榜？</h3>
                <p className="text-slate-400 text-sm mt-3 leading-relaxed text-left bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                  這將把所有玩家的排行榜積分歸零，此操作無法撤銷。<br /><br />
                  <span className="text-rose-500 font-bold">⚠️ 危險操作：</span><br />
                  確認後，所有玩家的 experience 積分將被設為 0。
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={executeClearScores}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-rose-500/20"
                >
                  確認清除
                </button>
                <button
                  onClick={() => setShowClearScoresConfirm(false)}
                  className="w-full py-4 text-slate-500 font-bold hover:text-white transition-colors"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync Score Confirmation Modal */}
      <AnimatePresence>
        {showSyncConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10002] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-8 rounded-[32px] max-w-sm w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-amber-500/20 rounded-3xl flex items-center justify-center mx-auto text-amber-500">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">確認執行同步？</h3>
                <p className="text-slate-400 text-sm mt-3 leading-relaxed text-left bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                  這將讀取所有歷史紀錄並重新計算所有玩家的總積分。<br /><br />
                  <span className="text-amber-500 font-bold">⚠️ 注意事項：</span><br />
                  請勿在多人同時遊玩時執行，以免造成數據衝突。
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={executeSyncScores}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                >
                  確認執行
                </button>
                <button
                  onClick={() => setShowSyncConfirm(false)}
                  className="w-full py-4 text-slate-500 font-bold hover:text-white transition-colors"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Main Actions - Only visible in Coach Mode */}
      {
        !isGMMode && (
          <div className="flex flex-col gap-4">
            {/* Create Game Card */}
            <button
              onClick={onCreateGame}
              className="group relative p-1 overflow-hidden rounded-3xl transition-all duration-500 hover:scale-[1.01] active:scale-[0.99] shadow-2xl shadow-amber-500/20"
            >
              {/* Animated Border Gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 animate-gradient-x opacity-90 group-hover:opacity-100 transition-opacity" />

              <div className="relative p-6 md:p-8 bg-slate-950/20 backdrop-blur-sm rounded-[22px] flex items-center justify-between overflow-hidden">
                {/* Animated Background Pulse */}
                <div className="absolute inset-0 bg-amber-500/10 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="absolute -right-6 -bottom-6 opacity-10 rotate-12 transition-transform duration-700 group-hover:scale-125 group-hover:rotate-0">
                  <PlusCircle size={140} className="fill-white" />
                </div>

                <div className="flex flex-col text-left relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] font-black text-amber-100/60 uppercase tracking-[0.2em]">Start Session</span>
                  </div>
                  <span className="text-3xl md:text-4xl font-black text-white mb-1 tracking-tight">建立新遊戲</span>
                  <span className="text-amber-100/60 text-xs md:text-sm font-medium max-w-[240px] leading-relaxed">
                    快速設定人數與時間，開啟專屬遊戲房間
                  </span>
                </div>

                <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center relative z-10 group-hover:bg-white/20 transition-all duration-500 shadow-xl group-hover:translate-x-1 group-hover:-rotate-6 border border-white/20">
                  <Play size={28} className="text-white fill-white translate-x-0.5" />
                </div>
              </div>
            </button>


            {/* Coach Tools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-slate-900/50 border border-slate-800/50 rounded-2xl backdrop-blur-sm flex items-center justify-between text-left relative overflow-hidden">
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">執行總場次</div>
                  <div className="text-3xl font-black text-amber-500">
                    {coachSessionCount === null ? '—' : coachSessionCount}
                  </div>
                </div>
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                  <TrendingUp size={24} className="text-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={onViewCoachHistory}
                  className="group relative p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 hover:border-emerald-500/30 transition-all duration-300 flex items-center gap-4 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                    <History size={22} className="text-emerald-500" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-black text-white tracking-wide">執行紀錄</span>
                    <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">History</span>
                  </div>
                </button>

                <button
                  onClick={onViewCoachSelfReport}
                  className="group relative p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 hover:border-emerald-500/30 transition-all duration-300 flex items-center gap-4 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                    <FileText size={22} className="text-emerald-500" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-black text-white tracking-wide">執行報表</span>
                    <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">My Report</span>
                  </div>
                </button>

                <button
                  onClick={onViewLeaderboard}
                  className="group relative p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 hover:border-amber-500/30 transition-all duration-300 flex items-center gap-4 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform duration-500">
                    <Trophy size={22} className="text-amber-500" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-black text-white tracking-wide">排行榜</span>
                    <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Ranking</span>
                  </div>
                </button>

                <button
                  onClick={onViewTutorial}
                  className="group relative p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 hover:border-indigo-500/30 transition-all duration-300 flex items-center gap-4 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
                    <BookOpen size={22} className="text-indigo-500" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-black text-white tracking-wide">遊戲教學</span>
                    <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Tutorial</span>
                  </div>
                </button>

                <button
                  onClick={onViewFriends}
                  className="group relative p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:bg-slate-800/60 hover:border-purple-500/30 transition-all duration-300 flex items-center gap-4 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform duration-500">
                    <Users size={22} className="text-purple-500" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-black text-white tracking-wide">好友</span>
                    <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Friends</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

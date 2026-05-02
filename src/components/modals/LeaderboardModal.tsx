import React, { useState, useEffect } from 'react';
import { X, Trophy, Medal, Star, Target, Crown } from 'lucide-react';
import SafeImage from '../common/SafeImage';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { safeAsync } from '../../utils/utils';
import { useAuth, getUserTitle } from '../../context/AuthContext';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RankingUser {
  id: string;
  name: string;
  score: number;
  title: string;
  avatar: string;
  rank: number;
  isCurrentUser?: boolean;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose }) => {
  const { user: currentUser } = useAuth();
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    const fetchRankings = async () => {
      if (!isOpen) return;

      try {
        setLoading(true);
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('rankScore', 'desc'), limit(50));
        const querySnapshot = await safeAsync(getDocs(q));

        if (!querySnapshot) {
          setRankings([]);
          return;
        }

        const fetchedRankings: RankingUser[] = [];
        let foundCurrentUser = false;

        querySnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          const rank = index + 1;
          const isMe = data.uid === currentUser?.uid;

          if (isMe) {
            foundCurrentUser = true;
            setCurrentUserRank(rank);
          }

          fetchedRankings.push({
            id: doc.id,
            name: data.name || '神秘玩家',
            score: data.rankScore || 0,
            title: getUserTitle(data as any),
            avatar: data.photoURL || 'bee',
            rank: rank,
            isCurrentUser: isMe
          });
        });

        setRankings(fetchedRankings);

        // 如果前50名沒找到自己，且自己有積分，則顯示在下方
        if (!foundCurrentUser && currentUser?.rankScore) {
          // 這裡簡化處理，實際排名可能需要額外查詢 count
          setCurrentUserRank(null);
        }
      } catch (error) {
        console.error('Error fetching rankings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-full bg-slate-950 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="relative p-6 pt-safe border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
              <Trophy size={20} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">排行榜</h2>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">RANKING</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-12 right-6 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-slate-500 font-bold text-sm">正在載入排名數據...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rankings.map((user, index) => (
                <div
                  key={user.id}
                  className={`group relative p-4 rounded-2xl border transition-all ${user.isCurrentUser
                    ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20'
                    : index === 0
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-slate-800/30 border-slate-800 hover:border-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank Badge */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' :
                      index === 1 ? 'bg-slate-300 text-black' :
                        index === 2 ? 'bg-amber-700 text-white' :
                          'bg-slate-800 text-slate-400'
                      }`}>
                      {index + 1}
                    </div>

                    {/* Avatar */}
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border border-slate-700">
                      {user.avatar === 'bee' ? (
                        <span className="text-2xl">🐝</span>
                      ) : user.avatar.startsWith('data:image') || user.avatar.startsWith('http') ? (
                        <SafeImage src={user.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{user.avatar}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white truncate">
                          {user.name}
                          {user.isCurrentUser && <span className="ml-2 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase">你</span>}
                        </h3>
                        {index === 0 && <Crown size={14} className="text-amber-500" />}
                      </div>
                      <p className="text-slate-500 text-[10px] font-bold tracking-wider uppercase">{user.title}</p>
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <div className="text-lg font-black text-white">{user.score.toLocaleString()}</div>
                      <div className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter">積分 Score</div>
                    </div>
                  </div>
                </div>
              ))}

              {rankings.length === 0 && (
                <div className="text-center py-20">
                  <p className="text-slate-500 font-bold">目前尚無排名數據</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Your Rank */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center overflow-hidden border border-blue-500/30">
                {currentUser?.photoURL === 'bee' ? (
                  <span className="text-xl">🐝</span>
                ) : currentUser?.photoURL?.startsWith('data:image') || currentUser?.photoURL?.startsWith('http') ? (
                  <SafeImage src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">👤</span>
                )}
              </div>
              <div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">您的排名 Your Rank</p>
                <p className="text-base font-black text-white">
                  {currentUserRank ? `第 ${currentUserRank} 名` : '未入榜'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">目前積分</p>
              <p className="text-base font-black text-blue-500">{(currentUser?.rankScore || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}; 

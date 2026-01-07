import React, { useState, useEffect } from 'react';
import { X, Users, UserPlus, Search, MessageSquare, Shield, Check, Clock, UserMinus, CheckCircle, AlertCircle, User as UserIcon } from 'lucide-react';
import { ProfileModal } from './ProfileModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, getCoachBadge, getPlayerBadge, getTitleColor } from '../../context/AuthContext';
import { db } from '../../../services/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  limit
} from 'firebase/firestore';
import { UserPublicInfo, Friendship } from '../../types';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewHistory?: (uid: string) => void;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({ isOpen, onClose, onViewHistory }) => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'requests' | 'add'>('list');
  const [searchQuery, setSearchQuery] = useState(''); // For Add Friend tab
  const [filterQuery, setFilterQuery] = useState(''); // For Friend List tab
  const [friends, setFriends] = useState<(UserPublicInfo & { friendshipId: string })[]>([]);
  const [requests, setRequests] = useState<(UserPublicInfo & { friendshipId: string })[]>([]);
  const [searchResults, setSearchResults] = useState<UserPublicInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; score: number } | null>(null);

  // Profile Menu State
  const [profileMenu, setProfileMenu] = useState<{ isOpen: boolean; x: number; y: number; user: any | null }>({ isOpen: false, x: 0, y: 0, user: null });
  const [viewProfileUser, setViewProfileUser] = useState<any | null>(null);

  const handleAvatarClick = (e: React.MouseEvent, user: any) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.clientX;
    const clientY = e.clientY;

    setProfileMenu({
      isOpen: true,
      x: clientX,
      y: clientY,
      user
    });
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // 監聽好友列表與請求
  useEffect(() => {
    if (!currentUser || !isOpen) return;

    setIsLoading(true);

    // 監聽已接受的好友
    const qFriends1 = query(
      collection(db, 'friendships'),
      where('status', '==', 'accepted'),
      where('requesterId', '==', currentUser.uid)
    );
    const qFriends2 = query(
      collection(db, 'friendships'),
      where('status', '==', 'accepted'),
      where('receiverId', '==', currentUser.uid)
    );

    const updateFriends = async (snapshot1: any, snapshot2: any) => {
      const allDocs = [...snapshot1.docs, ...snapshot2.docs];
      const friendData = await Promise.all(
        allDocs.map(async (d) => {
          const data = d.data() as Friendship;
          const friendId = data.requesterId === currentUser.uid ? data.receiverId : data.requesterId;
          const userDoc = await getDoc(doc(db, 'users', friendId));
          return {
            ...(userDoc.data() as UserPublicInfo),
            friendshipId: d.id,
            uid: friendId
          };
        })
      );
      // 去重
      const uniqueFriends = Array.from(new Map(friendData.map(f => [f.uid, f])).values());
      setFriends(uniqueFriends.filter(f => f.name));
      setIsLoading(false);
    };

    let snap1: any = { docs: [] };
    let snap2: any = { docs: [] };

    const unsubscribeFriends1 = onSnapshot(qFriends1, (snapshot) => {
      snap1 = snapshot;
      updateFriends(snap1, snap2);
    });

    const unsubscribeFriends2 = onSnapshot(qFriends2, (snapshot) => {
      snap2 = snapshot;
      updateFriends(snap1, snap2);
    });

    // 監聽待處理的請求
    const qRequests = query(
      collection(db, 'friendships'),
      where('status', '==', 'pending'),
      where('receiverId', '==', currentUser.uid)
    );

    const unsubscribeRequests = onSnapshot(qRequests, async (snapshot) => {
      console.log('[好友系統] 收到請求快照，文件數:', snapshot.docs.length);

      const requestData = await Promise.all(
        snapshot.docs.map(async (d) => {
          const data = d.data() as Friendship;
          console.log('[好友系統] 處理請求:', d.id, '來自:', data.requesterId);

          try {
            const userDoc = await getDoc(doc(db, 'users', data.requesterId));
            if (!userDoc.exists()) {
              console.warn('[好友系統] 找不到發送者資料:', data.requesterId);
              return {
                name: '未知使用者',
                photoURL: 'bee',
                role: 'player',
                friendshipId: d.id,
                uid: data.requesterId
              } as UserPublicInfo & { friendshipId: string };
            }

            const userData = userDoc.data() as UserPublicInfo;
            return {
              ...userData,
              friendshipId: d.id,
              uid: data.requesterId
            };
          } catch (e) {
            console.error('[好友系統] 讀取發送者資料失敗:', e);
            return null;
          }
        })
      );

      const validRequests = requestData.filter((r): r is (UserPublicInfo & { friendshipId: string }) => r !== null && !!r.name);
      console.log('[好友系統] 有效請求數:', validRequests.length);
      setRequests(validRequests);
    }, (error) => {
      console.error('[好友系統] 監聽請求失敗:', error);
    });

    return () => {
      unsubscribeFriends1();
      unsubscribeFriends2();
      unsubscribeRequests();
    };
  }, [currentUser, isOpen]);

  // 搜尋使用者
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || activeTab !== 'add') {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const promises = [];

        // 1. 搜尋名稱 (prefix search) - 已移除，改為精確搜尋
        // const qName = query(...)


        // 2. 搜尋 Email (exact match)
        if (searchQuery.includes('@')) {
          const qEmail = query(
            collection(db, 'users'),
            where('email', '==', searchQuery),
            limit(1)
          );
          promises.push(getDocs(qEmail).then(snap => snap.docs));
        }

        // 3. 搜尋 User ID (直接獲取文檔)
        // 只有當輸入長度足夠時才嘗試，避免無效讀取
        if (searchQuery.length >= 20) {
          promises.push(getDoc(doc(db, 'users', searchQuery)).then(docSnap =>
            docSnap.exists() ? [docSnap] : []
          ));
        }

        const results = await Promise.all(promises);
        const allDocs = results.flat();

        // 去重並過濾自己
        const uniqueUsers = new Map();
        allDocs.forEach(d => {
          if (d.id !== currentUser?.uid) {
            uniqueUsers.set(d.id, { ...d.data(), uid: d.id } as UserPublicInfo);
          }
        });

        setSearchResults(Array.from(uniqueUsers.values()));
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchUsers, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, currentUser]);

  // 發送好友請求
  const handleAddFriend = async (targetUid: string) => {
    if (!currentUser) return;
    try {
      // 檢查是否已經是好友或已有請求
      const q1 = query(
        collection(db, 'friendships'),
        where('requesterId', '==', currentUser.uid),
        where('receiverId', '==', targetUid)
      );
      const q2 = query(
        collection(db, 'friendships'),
        where('requesterId', '==', targetUid),
        where('receiverId', '==', currentUser.uid)
      );

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

      if (!snap1.empty || !snap2.empty) {
        showNotification('已經是好友或已發送請求', 'error');
        return;
      }

      await addDoc(collection(db, 'friendships'), {
        requesterId: currentUser.uid,
        receiverId: targetUid,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showNotification('好友請求已發送', 'success');
    } catch (error) {
      console.error('Add friend error:', error);
      showNotification('發送請求失敗', 'error');
    }
  };

  // 接受好友請求
  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await updateDoc(doc(db, 'friendships', friendshipId), {
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Accept request error:', error);
    }
  };

  // 拒絕或解除好友
  const handleDeleteFriendship = async (friendshipId: string, name?: string, score?: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    console.log('handleDeleteFriendship called', { friendshipId, name, score });

    // 如果是拒絕請求（沒有提供 name/score），直接刪除
    if (!name) {
      try {
        console.log('Directly deleting friendship (reject/cancel)');
        await deleteDoc(doc(db, 'friendships', friendshipId));
      } catch (error) {
        console.error('Delete friendship error:', error);
      }
      return;
    }
    // 否則開啟確認彈窗
    console.log('Opening delete confirmation');
    setItemToDelete({ id: friendshipId, name, score: score || 0 });
  };

  const confirmDeleteFriend = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'friendships', itemToDelete.id));
      showNotification('已刪除好友', 'success');
      setItemToDelete(null);
    } catch (error) {
      console.error('Delete friendship error:', error);
      showNotification('刪除失敗', 'error');
    }
  };

  // 渲染頭像
  const renderAvatar = (u: UserPublicInfo) => {
    if (u.photoURL && u.photoURL.length > 20) {
      let position = { x: 50, y: 50 };
      if (u.photoPosition) {
        try {
          position = JSON.parse(u.photoPosition);
        } catch (e) {
          position = { x: 50, y: parseInt(u.photoPosition) || 50 };
        }
      }
      const scale = parseFloat(u.photoScale || '1');
      return (
        <img
          src={u.photoURL}
          alt=""
          className="w-full h-full object-cover"
          style={{
            objectPosition: `${position.x}% ${position.y}% `,
            transform: `scale(${scale})`
          }}
        />
      );
    }
    return <span className="text-2xl">{u.photoURL === 'bee' ? '🐝' : '🦁'}</span>;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="relative p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
              <Users size={20} className="text-purple-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">好友</h2>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">FRIENDS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notification Toast - 調整位置到 Header 下方 */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`absolute top-20 left-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center justify-center gap-2 text-xs font-black backdrop-blur-md border border-white/10
                ${notification.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'}`}
            >
              {notification.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {notification.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex p-2 bg-slate-950/50 border-b border-slate-800 gap-1">
          {[
            { id: 'list', label: '好友列表', icon: Users, count: friends.length },
            { id: 'requests', label: '好友請求', icon: Clock, count: requests.length },
            { id: 'add', label: '新增好友', icon: UserPlus },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black text-xs ${activeTab === tab.id
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
            >
              <tab.icon size={16} />
              <span className={`${activeTab === tab.id ? 'inline-block' : 'hidden sm:inline-block'}`}>
                {tab.label}
              </span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-[10px] text-white rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Bar - Always take up space to prevent layout shift */}
        <div className="p-4 bg-slate-900/50">
          {activeTab !== 'requests' ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                value={activeTab === 'add' ? searchQuery : filterQuery}
                onChange={(e) => activeTab === 'add' ? setSearchQuery(e.target.value) : setFilterQuery(e.target.value)}
                placeholder={activeTab === 'add' ? "輸入 Email 或完整 ID 搜尋..." : "搜尋好友列表..."}
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 text-sm font-bold text-white placeholder:text-slate-700 focus:border-purple-500/50 focus:bg-slate-900 transition-all outline-none"
              />
            </div>
          ) : (
            <div className="w-full h-11" />
          )}
        </div>

        {/* Content Area */}
        <div className="p-4 h-[50vh] overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'list' && (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-3"
              >
                {isLoading ? (
                  <div className="text-center py-8 text-slate-500 text-sm">載入中...</div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">尚無好友</div>
                ) : (
                  friends
                    .filter(f => f.name.toLowerCase().includes(filterQuery.toLowerCase()))
                    .map((friend) => (
                      <div
                        key={friend.uid}
                        className="group relative py-3 px-4 bg-slate-800/30 border border-slate-800 rounded-2xl hover:border-purple-500/30 transition-all cursor-pointer active:scale-[0.98]"
                        onClick={(e) => handleAvatarClick(e, friend)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border border-slate-700 group-hover:border-purple-500/50 transition-colors">
                              {renderAvatar(friend)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-black text-white truncate">{friend.name}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <img
                                src={friend.title === '遊戲管理員' ? getCoachBadge(friend as any, 'gm') : getPlayerBadge(friend as any, 'player')}
                                className="w-4 h-4 object-contain"
                                alt=""
                              />
                              <span className={`text-[10px] font-bold uppercase ${getTitleColor(friend as any, friend.title === '遊戲管理員' ? 'gm' : 'player')}`}>
                                {friend.title === '遊戲管理員' ? '遊戲管理員' : (friend.title || '尋夢者')}
                              </span>
                              <span className="text-slate-700 text-[10px] ml-1">•</span>
                              <span className="text-amber-500 text-[10px] font-black">積分{friend.experience || 0}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div
                              role="button"
                              onClick={(e) => {
                                console.log('Button Clicked!', friend.name);
                                handleDeleteFriendship(friend.friendshipId, friend.name, friend.experience, e);
                              }}
                              className="relative z-50 p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer select-none active:scale-95"
                            >
                              <UserMinus size={18} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </motion.div>
            )}

            {activeTab === 'requests' && (
              <motion.div
                key="requests"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-3"
              >

                {requests.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">尚無好友請求</div>
                ) : (
                  requests.map((req) => (
                    <div key={req.uid} className="p-4 bg-slate-800/30 border border-slate-800 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border border-slate-700">
                          {renderAvatar(req)}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-black text-white">{req.name}</h3>
                          <p className="text-slate-500 text-[10px] font-bold">請求加為好友</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptRequest(req.friendshipId)}
                            className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all border border-emerald-500/20"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteFriendship(req.friendshipId)}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all border border-red-500/20"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'add' && (
              <motion.div
                key="add"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-3"
              >
                {searchQuery.trim() === '' ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center border border-purple-500/20 mb-4">
                      <UserPlus size={40} className="text-purple-500" />
                    </div>
                    <h3 className="text-lg font-black text-white mb-2">尋找新朋友</h3>
                    <p className="text-slate-500 text-xs max-w-[200px] mb-6">
                      輸入朋友的名稱，一起開啟幸福致富之旅
                    </p>
                  </div>
                ) : isSearching ? (
                  <div className="text-center py-8 text-slate-500 text-sm">搜尋中...</div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">找不到使用者</div>
                ) : (
                  searchResults.map((result) => (
                    <div key={result.uid} className="p-4 bg-slate-800/30 border border-slate-800 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border border-slate-700">
                          {renderAvatar(result)}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-black text-white">{result.name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <img
                              src={(result as any).role === 'coach' ? getCoachBadge(result as any, 'coach') : getPlayerBadge(result as any, 'player')}
                              className="w-4 h-4 object-contain"
                              alt=""
                            />
                            <span className={`text-[10px] font-bold uppercase ${getTitleColor(result as any, (result as any).role || 'player')}`}>
                              {result.title || '尋夢者'}
                            </span>
                            <span className="text-slate-700 text-[10px] ml-1">•</span>
                            <span className="text-amber-500 text-[10px] font-black">積分{result.experience || 0}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddFriend(result.uid)}
                          className="px-4 py-2 bg-purple-500 text-white text-xs font-black rounded-xl hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/20"
                        >
                          加為好友
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>


      </motion.div>

      {/* Delete Confirmation Modal Overlay - Fixed Global Overlay */}
      <AnimatePresence>
        {itemToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl text-center space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto text-red-500 border border-red-500/20">
                <UserMinus size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">刪除好友？</h3>
                <p className="text-slate-400 text-xs mt-1">您確定要刪除 <span className="text-white font-bold">{itemToDelete.name}</span> 嗎？此動作無法復原。</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-3 text-slate-400 font-bold text-sm bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteFriend}
                  className="flex-1 py-3 text-white font-bold text-sm bg-red-500 hover:bg-red-600 rounded-xl transition-all shadow-lg shadow-red-500/20"
                >
                  確認刪除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Menu Popover */}
      {profileMenu.isOpen && (
        <>
          <div
            className="fixed inset-0 z-[250]"
            onClick={() => setProfileMenu({ ...profileMenu, isOpen: false })}
          />
          <div
            className="fixed z-[300] bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200"
            style={{ top: Math.min(profileMenu.y, window.innerHeight - 60), left: Math.min(profileMenu.x, window.innerWidth - 120) }}
          >
            <button
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 w-full min-w-[100px]"
              onClick={() => {
                setViewProfileUser(profileMenu.user);
                setProfileMenu({ ...profileMenu, isOpen: false });
              }}
            >
              <UserIcon size={16} />
              個人資料
            </button>
          </div>
        </>
      )}

      {/* Profile Modal for Viewing Friend */}
      <ProfileModal
        isOpen={!!viewProfileUser}
        onClose={() => setViewProfileUser(null)}
        targetUser={viewProfileUser}
        viewMode="player"
        onViewHistory={(uid) => {
          setViewProfileUser(null);
          onClose();
          onViewHistory?.(uid);
        }}
      />
    </div>
  );
}; 

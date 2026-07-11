import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Search, ChevronRight, AlertTriangle, Database, Users, Calendar, Hash, Plus, FileText } from 'lucide-react';
import { db } from '../../../services/firebase';
import { collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { safeAsync } from '../../utils/utils';
import { CoachRecord, GameState } from '../../types';
import { cn, calculateFinancialSummary } from '../../utils/gameUtils';
import { FinancialStatement } from '../../components/business/FinancialStatement';
import { settleGame } from '../../game/settlement/settleGame';

const PROFESSION_TITLES = [
  '築巢師系列', '店員系列', '會計師系列', '釀蜜師系列', '教師系列',
  '技師系列', '醫師系列', '表演練習生系列', '飛行員系列', '裁縫師系列',
];

interface PlayerEntry {
  name: string;
  uid: string;
  profession: string;
  happiness: number | '';
  score: number | '';
  isWin: boolean;
}

// ── Player Financial Modal ───────────────────────────────────────────────────

interface PlayerFinancialModalProps {
  recordId: string;
  playerName: string;
  playerIndex: number;
  onClose: () => void;
}

const PlayerFinancialModal: React.FC<PlayerFinancialModalProps> = ({ recordId, playerName, playerIndex, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [displayName, setDisplayName] = useState(playerName);
  const [profession, setProfession] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const snap = await safeAsync(getDoc(doc(db, 'score_records', 'S1', 'records', recordId)));
      if (snap?.exists()) {
        const data = snap.data();
        const players: any[] = data.players || [];
        const p = players[playerIndex]?.name === playerName
          ? players[playerIndex]
          : players.find((pl: any) => pl.name === playerName);

        if (p) {
          // 還原薪資（同 HistoryView 邏輯）
          const income = { ...p.income };
          if (!income.salary && p.summary) {
            const passive = p.summary.passiveIncome || 0;
            const total = p.summary.totalIncome || 0;
            if (total > passive) income.salary = total - passive;
          }

          // 重新計算精確財務摘要（同 HistoryView 邏輯）
          const reconstructed: any = {
            profession: p.professionData || { title: p.profession, salary: income.salary || 0, expenses: { basicLiving: 0, transportEdu: 0, otherMedicalChild: 0 } },
            assets: p.assets || [],
            liabilities: p.liabilities || [],
            income,
            expenses: p.expenses || {},
            loans: p.loans || 0,
            medicalInsuranceCount: p.medicalInsuranceCount || 0,
            currentRankLevel: p.currentRankLevel || 1,
            cash: p.cash || 0,
            marketPrices: data.marketPrices || {}
          };
          const freshSummary = calculateFinancialSummary(reconstructed);

          const dummyGameState: GameState = {
            profession: p.professionData || {
              title: p.profession,
              salary: income.salary || 0,
              id: 'dummy',
              initialRank: '',
              savings: 0,
              expenses: {
                tax: Math.floor((income.salary || 0) * 0.05),
                basicLiving: p.expenses?.basicLiving || 0,
                transportEdu: p.expenses?.transportEdu || 0,
                otherMedicalChild: p.expenses?.otherMedicalChild || 0
              },
              mortgageTotal: 0,
              businessLoanTotal: 0,
              creditLoanTotal: 0,
              promotions: []
            },
            selectedEnterprise: null,
            selectedDream: null,
            expenses: p.expenses || {},
            income: { ...income },
            currentRankTitle: p.profession,
            currentRankLevel: 1,
            cash: p.cash || 0,
            children: 0,
            medicalInsuranceCount: 0,
            assets: p.assets || [],
            liabilities: p.liabilities || [],
            loans: p.loans || 0,
            isSetup: true,
            history: p.history || [],
            happiness: p.happinessItems || [],
            happinessTotal: p.happiness || 0,
            marketPrices: {},
            previousMarketPrices: {},
            lastPublishedCode: '',
            abilities: { stockAbilityCount: 0, realEstateAbilityCount: 0, professionAbilityCount: 0 },
            completedHappinessEvents: [],
            playerName: p.name,
          };

          setGameState(dummyGameState);
          setSummary(freshSummary);
          setDisplayName(p.name);
          setProfession(p.profession || '');
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [recordId, playerName, playerIndex]);

  return (
    <div className="fixed inset-0 z-[10003] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <FileText className="text-emerald-400" size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white leading-none">完整財務報表</h3>
              <div className="text-slate-500 text-sm mt-1.5">{displayName}{profession ? ` • ${profession}` : ''}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-slate-500 font-bold text-sm">載入財務資料中...</p>
            </div>
          ) : !gameState || !summary ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
              <FileText size={40} className="opacity-30" />
              <p className="font-bold">此場次無財務報表數據</p>
              <p className="text-xs text-slate-600">手動新增的紀錄或舊版場次不含財務快照</p>
            </div>
          ) : (
            <FinancialStatement
              gameState={gameState}
              summary={summary}
              hideSummary={true}
              defaultShowDetails={true}
              hideNav={false}
              disabled={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Add Record Modal ─────────────────────────────────────────────────────────

interface AddRecordModalProps {
  onClose: () => void;
  onSaved: (record: CoachRecord) => void;
}

const AddRecordModal: React.FC<AddRecordModalProps> = ({ onClose, onSaved }) => {
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState('');
  const [selectedCoachName, setSelectedCoachName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [duration, setDuration] = useState('');
  const [players, setPlayers] = useState<PlayerEntry[]>([
    { name: '', uid: '', profession: '', happiness: '', score: '', isWin: false },
  ]);
  const [searchOpenIdx, setSearchOpenIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const snap = await safeAsync(getDocs(collection(db, 'users')));
      if (!snap) return;
      const list = snap.docs.map(d => ({ id: d.id, name: d.data().name || '', role: d.data().role || '', title: d.data().title || '' }));
      setAllUsers(list.map(u => ({ id: u.id, name: u.name })));
      const coachList = list
        .filter(u => u.role === 'coach' || u.title === '遊戲管理員')
        .map(u => ({ id: u.id, name: u.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
      setCoaches(coachList);
    };
    fetchData();
  }, []);

  const handleCoachChange = (id: string) => {
    setSelectedCoachId(id);
    setSelectedCoachName(coaches.find(c => c.id === id)?.name || '');
  };

  const updatePlayer = (i: number, patch: Partial<PlayerEntry>) => {
    setPlayers(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  };

  const addPlayer = () => {
    setPlayers(prev => [...prev, { name: '', uid: '', profession: '', happiness: '', score: '', isWin: false }]);
  };

  const removePlayer = (i: number) => {
    setPlayers(prev => prev.filter((_, idx) => idx !== i));
    if (searchOpenIdx === i) setSearchOpenIdx(null);
  };

  const getSearchResults = (query: string) => {
    if (!query.trim() || query.length < 1) return [];
    return allUsers.filter(u => u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  };

  const selectUser = (i: number, user: { id: string; name: string }) => {
    updatePlayer(i, { name: user.name, uid: user.id });
    setSearchOpenIdx(null);
  };

  const handleSave = async () => {
    if (!selectedCoachId) { setError('請選擇執行師'); return; }
    if (!roomCode.trim()) { setError('請填寫房號'); return; }
    if (players.some(p => !p.name.trim())) { setError('請填寫所有玩家姓名'); return; }

    setIsSaving(true);
    setError('');
    try {
      const recordId = `manual_${Date.now()}`;
      const dateISO = new Date(`${date}T12:00:00`).toISOString();

      const playerData = players.map(p => ({
        name: p.name.trim(),
        profession: p.profession,
        happiness: Number(p.happiness) || 0,
        score: Number(p.score) || 0,
        isWin: p.isWin,
      }));

      const coachRecord: any = {
        date: dateISO,
        roomCode: roomCode.trim(),
        playerCount: players.length,
        duration: Number(duration) || 0,
        playTime: Number(duration) || 0,
        totalRounds: 0,
        coachId: selectedCoachId,
        coachName: selectedCoachName,
        timestamp: Date.now(),
        isFinal: true,
        isManual: true,
        players: playerData,
        updatedAt: serverTimestamp(),
      };
      if (roomName.trim()) coachRecord.roomName = roomName.trim();

      await safeAsync(setDoc(doc(db, 'coach_records', recordId), coachRecord));

      const scoreData = {
        roomId: roomCode.trim(),
        roomName: roomName.trim() || roomCode.trim(),
        sessionId: recordId,
        settledAt: serverTimestamp(),
        gameTime: `${duration || 0} 分鐘`,
        coach: selectedCoachName,
        coachId: selectedCoachId,
        isManual: true,
        players: players.map(p => ({
          uid: p.uid || '',
          name: p.name.trim(),
          profession: p.profession,
          happiness: Number(p.happiness) || 0,
          totalScore: Number(p.score) || 0,
        })),
        playerUids: players.filter(p => p.uid).map(p => p.uid),
      };
      await setDoc(doc(db, 'score_records', 'S1', 'records', recordId), scoreData, { merge: true });
      await settleGame({
        roomId: roomCode.trim(),
        settlementId: recordId,
        coachUid: selectedCoachId,
        players: players
          .filter(player => player.uid)
          .map(player => ({ uid: player.uid, totalScore: Number(player.score) || 0 }))
      });

      onSaved({ id: recordId, ...coachRecord } as CoachRecord);
    } catch (err) {
      console.error('新增失敗:', err);
      setError('儲存失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10002] bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg my-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
              <Plus size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">手動新增紀錄</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Manual Entry</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Coach */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">執行師</label>
            <select
              value={selectedCoachId}
              onChange={e => handleCoachChange(e.target.value)}
              className="w-full h-10 bg-slate-800 border border-slate-700 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">選擇執行師...</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Date + Room Code */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">日期</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-10 bg-slate-800 border border-slate-700 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">房號</label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value)}
                placeholder="e.g. ABC123"
                className="w-full h-10 bg-slate-800 border border-slate-700 rounded-xl px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Room Name + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">房間名稱（選填）</label>
              <input
                type="text"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                placeholder="房間名稱"
                className="w-full h-10 bg-slate-800 border border-slate-700 rounded-xl px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">時長（分鐘）</label>
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="0"
                className="w-full h-10 bg-slate-800 border border-slate-700 rounded-xl px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Players */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                玩家列表
                <span className="ml-2 text-slate-600">（輸入姓名可搜尋帳號自動綁定積分）</span>
              </label>
              <button
                onClick={addPlayer}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] font-black text-emerald-400 hover:bg-emerald-500/20 transition-all"
              >
                <Plus size={10} />
                新增玩家
              </button>
            </div>

            <div className="space-y-3">
              {players.map((player, i) => {
                const searchResults = player.uid ? [] : getSearchResults(player.name);
                const showDropdown = searchOpenIdx === i && searchResults.length > 0;

                return (
                  <div key={i} className="bg-slate-800/50 rounded-2xl p-3 border border-slate-700/50 space-y-2.5">
                    {/* Name row */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-500 w-4 shrink-0 text-center">{i + 1}</span>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="玩家姓名（可搜尋帳號）"
                          value={player.name}
                          onFocus={() => setSearchOpenIdx(i)}
                          onBlur={() => setTimeout(() => setSearchOpenIdx(null), 150)}
                          onChange={e => {
                            updatePlayer(i, { name: e.target.value, uid: '' });
                            setSearchOpenIdx(i);
                          }}
                          className="w-full h-9 bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
                        />
                        {showDropdown && (
                          <div className="absolute top-10 left-0 right-0 z-20 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                            {searchResults.map(u => (
                              <button
                                key={u.id}
                                onMouseDown={() => selectUser(i, u)}
                                className="w-full px-3 py-2.5 text-left hover:bg-slate-700 flex items-center justify-between transition-colors"
                              >
                                <span className="text-sm font-bold text-white">{u.name}</span>
                                <span className="text-[9px] text-emerald-400 font-black">綁定積分</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {player.uid && (
                        <span className="shrink-0 px-1.5 py-0.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-[9px] font-black text-emerald-400">
                          ✓ 已綁定
                        </span>
                      )}
                      {players.length > 1 && (
                        <button
                          onClick={() => removePlayer(i)}
                          className="shrink-0 w-7 h-7 bg-rose-500/10 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 pl-6">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold block mb-1">職業</label>
                        <select
                          value={player.profession}
                          onChange={e => updatePlayer(i, { profession: e.target.value })}
                          className="w-full h-8 bg-slate-900/60 border border-slate-700/50 rounded-lg px-1.5 text-[10px] text-white focus:outline-none focus:border-emerald-500/50"
                        >
                          <option value="">選擇...</option>
                          {PROFESSION_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold block mb-1">幸福指數</label>
                        <input
                          type="number"
                          value={player.happiness}
                          onChange={e => updatePlayer(i, { happiness: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="0"
                          className="w-full h-8 bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold block mb-1">積分</label>
                        <input
                          type="number"
                          value={player.score}
                          onChange={e => updatePlayer(i, { score: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="0"
                          className="w-full h-8 bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>

                    {/* Win */}
                    <div className="pl-6">
                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <input
                          type="checkbox"
                          checked={player.isWin}
                          onChange={e => updatePlayer(i, { isWin: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-600 accent-amber-500"
                        />
                        <span className="text-[11px] font-bold text-amber-400">達成財務自由 (WIN)</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Note about score update */}
          <div className="flex items-start gap-2 px-3 py-2 bg-slate-800/60 rounded-xl">
            <Users size={12} className="text-slate-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              綁定帳號的玩家積分會自動加入其排名分數。未綁定的玩家仍會記錄在紀錄中，但不計入積分。
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-rose-400 shrink-0" />
              <p className="text-sm text-rose-400 font-bold">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {isSaving
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Plus size={16} /> 儲存紀錄</>
            }
          </button>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-2xl transition-all"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

// ── RoomRecordsView ──────────────────────────────────────────────────────────

interface RoomRecordsViewProps {
  onBack: () => void;
}

export const RoomRecordsView: React.FC<RoomRecordsViewProps> = ({ onBack }) => {
  const [records, setRecords] = useState<CoachRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoachRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingFinancial, setViewingFinancial] = useState<{ recordId: string; playerName: string; playerIndex: number } | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const snap = await safeAsync(getDocs(collection(db, 'coach_records')));
      if (snap) {
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() })) as CoachRecord[];
        fetched.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setRecords(fetched);
      }
    } catch (err) {
      console.error('載入紀錄失敗:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await safeAsync(deleteDoc(doc(db, 'coach_records', deleteTarget.id)));
      await safeAsync(deleteDoc(doc(db, 'score_records', 'S1', 'records', deleteTarget.id)));
      setRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('刪除失敗:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRecordSaved = (record: CoachRecord) => {
    setRecords(prev => [record, ...prev]);
    setShowAddModal(false);
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(r =>
      r.coachName?.toLowerCase().includes(q) ||
      r.roomCode?.toLowerCase().includes(q) ||
      r.roomName?.toLowerCase().includes(q) ||
      r.players?.some(p => p.name?.toLowerCase().includes(q))
    );
  }, [records, searchQuery]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('zh-TW', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr; }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-800/50 p-6 pt-safe md:p-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-violet-500/20 rounded-3xl flex items-center justify-center border border-violet-500/30 shadow-lg shadow-violet-500/10">
            <Database size={28} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">房間紀錄管理</h1>
            <p className="text-violet-400/60 font-bold uppercase tracking-[0.1em] text-xs mt-0.5">
              Room Records · {records.length} 筆
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 font-black text-sm rounded-2xl transition-all active:scale-95"
          >
            <Plus size={16} />
            手動新增
          </button>
          <button
            onClick={onBack}
            className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl flex items-center justify-center transition-all border border-slate-700"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 md:px-8 py-4 border-b border-slate-800/30 shrink-0">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="搜尋執行師、房號、玩家名稱..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-10 bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-slate-400 font-semibold">載入中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <Database size={40} className="opacity-30" />
            <p className="font-bold">{searchQuery ? '找不到符合的紀錄' : '尚無房間紀錄'}</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-3">
            {filtered.map(record => (
              <div
                key={record.id}
                className="bg-slate-900/60 border border-slate-800/50 rounded-2xl overflow-hidden hover:border-slate-700/50 transition-all"
              >
                {/* Record Header Row */}
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform",
                      expandedId === record.id ? "rotate-90" : ""
                    )}>
                      <ChevronRight size={16} className="text-slate-500" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="flex items-center gap-1 text-[11px] font-black text-slate-400">
                        <Calendar size={11} className="text-slate-600" />
                        {formatDate(record.date)}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-500/10 rounded-lg text-[11px] font-black text-violet-400 border border-violet-500/20">
                        <Hash size={10} />
                        {record.roomCode}
                      </span>
                      <span className="text-[11px] font-black text-white truncate max-w-[120px]">
                        {record.coachName}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                        <Users size={10} />
                        {record.playerCount} 人
                      </span>
                      {record.roomName && (
                        <span className="text-[11px] text-slate-600 truncate max-w-[100px]">{record.roomName}</span>
                      )}
                      {(record as any).isManual && (
                        <span className="px-1.5 py-0.5 bg-amber-500/10 rounded text-[9px] font-black text-amber-400 border border-amber-500/20">手動</span>
                      )}
                    </div>
                  </button>

                  <button
                    onClick={() => setDeleteTarget(record)}
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all active:scale-95"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Expanded: Player List */}
                {expandedId === record.id && record.players && record.players.length > 0 && (
                  <div className="border-t border-slate-800/50 px-4 pb-4 pt-3">
                    <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">玩家列表</div>
                    <div className="space-y-2">
                      {record.players.map((p, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-800/40 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-black text-slate-600 w-4">{i + 1}</span>
                            <span className="text-sm font-bold text-white truncate">{p.name}</span>
                            <span className="text-[10px] text-slate-500 truncate">{p.profession}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-black text-pink-400">♥ {p.happiness}</span>
                            <span className="text-xs font-black text-amber-400">{p.score} 分</span>
                            {p.isWin && <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">WIN</span>}
                            <button
                              onClick={() => setViewingFinancial({ recordId: record.id, playerName: p.name, playerIndex: i })}
                              className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-[10px] font-black text-emerald-400 transition-all active:scale-95"
                            >
                              <FileText size={10} />
                              報表
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-[9px] text-slate-700 font-mono">ID: {record.id}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player Financial Modal */}
      {viewingFinancial && (
        <PlayerFinancialModal
          recordId={viewingFinancial.recordId}
          playerName={viewingFinancial.playerName}
          playerIndex={viewingFinancial.playerIndex}
          onClose={() => setViewingFinancial(null)}
        />
      )}

      {/* Add Record Modal */}
      {showAddModal && (
        <AddRecordModal
          onClose={() => setShowAddModal(false)}
          onSaved={handleRecordSaved}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} className="text-rose-400" />
            </div>
            <h3 className="text-xl font-black text-white text-center mb-2">確認刪除</h3>
            <p className="text-slate-400 text-center text-sm mb-1">
              將刪除以下紀錄，此操作無法復原：
            </p>
            <div className="my-4 p-3 bg-slate-800/60 rounded-xl text-center space-y-1">
              <div className="text-white font-black">{deleteTarget.coachName}</div>
              <div className="text-slate-400 text-xs">{formatDate(deleteTarget.date)} · 房號 {deleteTarget.roomCode}</div>
              <div className="text-slate-500 text-xs">{deleteTarget.playerCount} 位玩家</div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Trash2 size={16} /> 確認刪除</>
                )}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-2xl transition-all"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

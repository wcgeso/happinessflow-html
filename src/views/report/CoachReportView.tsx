import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { db } from '../../../services/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { safeAsync } from '../../utils/utils';
import { CoachRecord } from '../../types';

interface CoachReportViewProps {
  onBack: () => void;
  coachFilter?: string; // 若傳入則只顯示該執行師的資料（執行師自用模式）
}

interface GroupedData {
  [coachId: string]: { coachName: string; records: CoachRecord[] };
}

interface MonthData {
  [month: string]: { records: CoachRecord[]; coaches: GroupedData };
}

interface UserInfo {
  id: string;
  name: string;
  role: string;
  referredBy?: string;
  effectiveCoachId?: string;
}

interface PlayerReferralInfo {
  playerName: string;
  referrer: UserInfo | null;
  effectiveCoach: UserInfo | null;
}

const PLAYER_FEE = 500;
const COACH_CUT = 0.4;
const COMPANY_CUT = 0.3;
const PROMOTION_BONUS = 0.2;
const SEASON_BONUS = 0.1;

export const CoachReportView: React.FC<CoachReportViewProps> = ({ onBack, coachFilter }) => {
  const [records, setRecords] = useState<CoachRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedCoach, setSelectedCoach] = useState<string>('all');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // uid -> UserInfo map
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  // sessionId -> playerUids map (from score_records)
  const [sessionPlayerUids, setSessionPlayerUids] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [coachSnap, scoreSnap, usersSnap] = await Promise.all([
        safeAsync(getDocs(collection(db, 'coach_records'))),
        safeAsync(getDocs(collection(db, 'score_records', 'S1', 'records'))),
        safeAsync(getDocs(collection(db, 'users'))),
      ]);

      // Build user map
      if (usersSnap) {
        const map: Record<string, UserInfo> = {};
        usersSnap.docs.forEach(d => {
          const data = d.data();
          map[d.id] = {
            id: d.id,
            name: data.name || '未知用戶',
            role: data.role || 'player',
            referredBy: data.referredBy,
            effectiveCoachId: data.effectiveCoachId,
          };
        });
        setUserMap(map);
      }

      // Build sessionId -> playerUids map
      if (scoreSnap) {
        const uidMap: Record<string, string[]> = {};
        scoreSnap.docs.forEach(d => {
          const data = d.data();
          if (data.playerUids?.length) {
            uidMap[d.id] = data.playerUids;
          } else if (data.players?.length) {
            uidMap[d.id] = data.players.map((p: any) => p.uid).filter(Boolean);
          }
        });
        setSessionPlayerUids(uidMap);
      }

      // Coach records
      if (coachSnap) {
        const fetched = coachSnap.docs.map(d => ({ id: d.id, ...d.data() })) as CoachRecord[];
        fetched.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setRecords(fetched);
        if (fetched.length > 0) {
          const latestDate = new Date(fetched[0].date);
          setSelectedMonth(`${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, '0')}`);
        }
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMonthFromDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const organizeDataByMonth = (): MonthData => {
    const grouped: MonthData = {};
    records.forEach(record => {
      const month = getMonthFromDate(record.date);
      if (!grouped[month]) grouped[month] = { records: [], coaches: {} };
      grouped[month].records.push(record);
      const coachId = record.coachId;
      if (!grouped[month].coaches[coachId]) {
        grouped[month].coaches[coachId] = { coachName: record.coachName, records: [] };
      }
      grouped[month].coaches[coachId].records.push(record);
    });
    return grouped;
  };

  const calculateFees = (playerCount: number) => {
    const total = playerCount * PLAYER_FEE;
    return {
      total,
      coachCut: Math.round(total * COACH_CUT),
      companyCut: Math.round(total * COMPANY_CUT),
      promotionBonus: Math.round(total * PROMOTION_BONUS),
      seasonBonus: Math.round(total * SEASON_BONUS),
    };
  };

  // Calculate how much a coach must return to the company for a single record
  const calculateReturnAmount = (record: CoachRecord) => {
    const uids = sessionPlayerUids[record.id] || [];
    const selfReferredCount = uids.filter(uid => userMap[uid]?.referredBy === record.coachId).length;
    const otherCount = record.playerCount - selfReferredCount;
    const companyCut = Math.round(record.playerCount * PLAYER_FEE * COMPANY_CUT);
    const seasonBonus = Math.round(record.playerCount * PLAYER_FEE * SEASON_BONUS);
    const promotionBonusToReturn = Math.round(otherCount * PLAYER_FEE * PROMOTION_BONUS);
    const promotionBonusToKeep = Math.round(selfReferredCount * PLAYER_FEE * PROMOTION_BONUS);
    return { companyCut, seasonBonus, promotionBonusToReturn, promotionBonusToKeep, selfReferredCount, otherCount, total: companyCut + seasonBonus + promotionBonusToReturn };
  };

  // Build referral chain info for each player in a session
  const getPlayerReferralInfos = (sessionId: string, players: { name: string }[]): PlayerReferralInfo[] => {
    const uids = sessionPlayerUids[sessionId] || [];
    return players.map((p, idx) => {
      const uid = uids[idx];
      if (!uid || !userMap[uid]) {
        return { playerName: p.name, referrer: null, effectiveCoach: null };
      }
      const playerUser = userMap[uid];
      const referrer = playerUser.referredBy ? (userMap[playerUser.referredBy] || null) : null;
      let effectiveCoach: UserInfo | null = null;
      if (referrer && referrer.role !== 'coach' && referrer.role !== 'gm') {
        const ecId = playerUser.effectiveCoachId || referrer?.effectiveCoachId;
        effectiveCoach = ecId ? (userMap[ecId] || null) : null;
      }
      return { playerName: p.name, referrer, effectiveCoach };
    });
  };

  const roleLabel = (role: string) => {
    if (role === 'coach' || role === 'gm') return { text: '執行師', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    return { text: '玩家', color: 'text-slate-400 bg-slate-800/80 border-slate-700' };
  };

  const monthlyData = organizeDataByMonth();
  const sortedMonths = Object.keys(monthlyData).sort().reverse();
  const currentMonthData = selectedMonth ? monthlyData[selectedMonth] : undefined;

  const coachOptions = currentMonthData
    ? [
        { id: 'all', name: '全部執行師' },
        ...Object.entries(currentMonthData.coaches)
          .sort((a, b) => a[1].coachName.localeCompare(b[1].coachName))
          .map(([id, data]) => ({ id, name: data.coachName })),
      ]
    : [];

  let coachRecords: { coachName: string; records: CoachRecord[] };
  if (!currentMonthData) {
    coachRecords = { coachName: '全部執行師', records: [] };
  } else if (selectedCoach === 'all') {
    coachRecords = { coachName: '全部執行師', records: currentMonthData.records };
  } else {
    coachRecords = currentMonthData.coaches[selectedCoach] || { coachName: '全部執行師', records: [] };
  }

  // 執行師自用模式：只顯示自己的紀錄
  if (coachFilter) {
    coachRecords = {
      coachName: coachRecords.coachName,
      records: coachRecords.records.filter(r => r.coachId === coachFilter),
    };
  }

  const totalStats = coachRecords.records.reduce(
    (acc, record) => {
      const fees = calculateFees(record.playerCount);
      return {
        games: acc.games + 1,
        players: acc.players + record.playerCount,
        totalRevenue: acc.totalRevenue + fees.total,
        coachPayment: acc.coachPayment + fees.coachCut,
        companyProfit: acc.companyProfit + fees.companyCut,
        promotionBonus: acc.promotionBonus + fees.promotionBonus,
        seasonBonus: acc.seasonBonus + fees.seasonBonus,
      };
    },
    { games: 0, players: 0, totalRevenue: 0, coachPayment: 0, companyProfit: 0, promotionBonus: 0, seasonBonus: 0 }
  );

  const totalReturnStats = coachRecords.records.reduce(
    (acc, record) => {
      const ret = calculateReturnAmount(record);
      return {
        companyCut: acc.companyCut + ret.companyCut,
        seasonBonus: acc.seasonBonus + ret.seasonBonus,
        promotionBonusToReturn: acc.promotionBonusToReturn + ret.promotionBonusToReturn,
        promotionBonusToKeep: acc.promotionBonusToKeep + ret.promotionBonusToKeep,
        total: acc.total + ret.total,
      };
    },
    { companyCut: 0, seasonBonus: 0, promotionBonusToReturn: 0, promotionBonusToKeep: 0, total: 0 }
  );

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[1000] bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-semibold">加載報表中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-800/50 p-6 pt-safe md:p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-500/20 rounded-3xl flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
            <FileText size={28} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">執行師報表</h1>
            <p className="text-emerald-400/60 font-bold uppercase tracking-[0.1em] text-xs mt-0.5">
              {coachFilter ? 'My Commission Report' : 'Coach Commission Report'}
            </p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl flex items-center justify-center transition-all border border-slate-700 hover:border-slate-600 group"
        >
          <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Filters */}
          <div className={`grid gap-4 ${coachFilter ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            <div className="space-y-2">
              <label className="text-sm font-black text-slate-300 ml-1">選擇月份</label>
              <select
                value={selectedMonth}
                onChange={e => { setSelectedMonth(e.target.value); setSelectedCoach('all'); }}
                className="w-full h-12 bg-slate-900/50 border border-emerald-500/20 rounded-xl text-white px-4 focus:ring-2 focus:ring-emerald-500/40 appearance-none cursor-pointer font-semibold"
              >
                {sortedMonths.map(month => (
                  <option key={month} value={month}>
                    {new Date(`${month}-01`).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            {!coachFilter && (
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-300 ml-1">選擇執行師</label>
                <select
                  value={selectedCoach}
                  onChange={e => setSelectedCoach(e.target.value)}
                  className="w-full h-12 bg-slate-900/50 border border-emerald-500/20 rounded-xl text-white px-4 focus:ring-2 focus:ring-emerald-500/40 appearance-none cursor-pointer font-semibold"
                >
                  {coachOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: '總場次', value: totalStats.games, color: 'text-white', border: 'border-slate-800/50' },
              { label: '總玩家數', value: totalStats.players, color: 'text-white', border: 'border-slate-800/50' },
              { label: '總收入', value: `NT$ ${totalStats.totalRevenue.toLocaleString()}`, color: 'text-blue-400', border: 'border-blue-500/10' },
              { label: '執行師費用', value: `NT$ ${totalStats.coachPayment.toLocaleString()}`, color: 'text-emerald-400', border: 'border-emerald-500/10' },
              { label: '公司利潤', value: `NT$ ${totalStats.companyProfit.toLocaleString()}`, color: 'text-amber-400', border: 'border-amber-500/10' },
            ].map(card => (
              <div key={card.label} className={`p-4 bg-slate-900/40 border ${card.border} rounded-2xl backdrop-blur-sm`}>
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{card.label}</div>
                <div className={`text-2xl font-black ${card.color}`}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Fee Summary */}
          {totalStats.games > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 md:p-8">
              <h3 className="text-lg font-black text-white mb-6">費用分拆明細</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { label: '總收入', value: totalStats.totalRevenue, note: '100%', color: 'blue' },
                  { label: '帶盤費 (40%)', value: totalStats.coachPayment, note: '執行師應收', color: 'emerald' },
                  { label: '公司利潤 (30%)', value: totalStats.companyProfit, note: '公司保留', color: 'amber' },
                  { label: '推廣獎金 (20%)', value: totalStats.promotionBonus, note: '執行師獎勵', color: 'purple' },
                  { label: '賽季獎金 (10%)', value: totalStats.seasonBonus, note: '季度累積', color: 'rose' },
                ].map(item => (
                  <div key={item.label} className={`p-4 bg-slate-900/50 rounded-2xl border border-${item.color}-500/20`}>
                    <div className={`text-[10px] font-black text-${item.color}-400 uppercase tracking-widest mb-2`}>{item.label}</div>
                    <div className={`text-2xl font-black text-${item.color}-300`}>NT$ {item.value.toLocaleString()}</div>
                    <div className={`text-[10px] text-${item.color}-400/60 mt-1`}>{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Return Amount Summary */}
          {totalStats.games > 0 && (
            <div className="bg-rose-500/5 border border-rose-500/30 rounded-3xl p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white">應繳回公司金額</h3>
                <div className="text-right">
                  <div className="text-3xl font-black text-rose-400">NT$ {totalReturnStats.total.toLocaleString()}</div>
                  {totalReturnStats.promotionBonusToKeep > 0 && (
                    <div className="text-[11px] text-slate-500 mt-1">自推保留 NT$ {totalReturnStats.promotionBonusToKeep.toLocaleString()}</div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                  <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">公司利潤 (30%)</div>
                  <div className="text-2xl font-black text-amber-300">NT$ {totalReturnStats.companyCut.toLocaleString()}</div>
                  <div className="text-[10px] text-amber-400/60 mt-1">必繳</div>
                </div>
                <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                  <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">賽季獎金 (10%)</div>
                  <div className="text-2xl font-black text-rose-300">NT$ {totalReturnStats.seasonBonus.toLocaleString()}</div>
                  <div className="text-[10px] text-rose-400/60 mt-1">必繳</div>
                </div>
                <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                  <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">推廣獎金（非自推）(20%)</div>
                  <div className="text-2xl font-black text-purple-300">NT$ {totalReturnStats.promotionBonusToReturn.toLocaleString()}</div>
                  <div className="text-[10px] text-purple-400/60 mt-1">
                    {totalReturnStats.promotionBonusToKeep > 0
                      ? `自推部分 NT$ ${totalReturnStats.promotionBonusToKeep.toLocaleString()} 不計入`
                      : '必繳'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Records List */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">詳細紀錄</h3>
            {coachRecords.records.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/30 border border-slate-800/50 rounded-2xl">
                <p className="text-slate-400 font-semibold">此月份無執行紀錄</p>
              </div>
            ) : (
              <AnimatePresence>
                {coachRecords.records.map((record, idx) => {
                  const fees = calculateFees(record.playerCount);
                  const isExpanded = expandedRecord === record.id;
                  const referralInfos = isExpanded && record.players
                    ? getPlayerReferralInfos(record.id, record.players)
                    : [];
                  const perPlayerBonus = PLAYER_FEE * PROMOTION_BONUS;

                  return (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all cursor-pointer"
                      onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
                    >
                      {/* Summary Row */}
                      <div className="p-4 md:p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 flex-shrink-0">
                            <Calendar size={20} className="text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-black truncate">{record.roomName || '未命名房間'}</div>
                            <div className="text-xs text-slate-400 mt-1">
                              {new Date(record.date).toLocaleDateString('zh-TW')} · {record.coachName}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-sm text-slate-400">玩家數</div>
                            <div className="text-xl font-black text-white">{record.playerCount}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-slate-400">費用總額</div>
                            <div className="text-xl font-black text-emerald-400">NT$ {fees.total.toLocaleString()}</div>
                          </div>
                          <div className="text-slate-600">
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t border-slate-800/50 bg-slate-900/20 p-4 md:p-6 space-y-6"
                            onClick={e => e.stopPropagation()}
                          >
                            {/* Player Referral Chain */}
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Users size={14} className="text-purple-400" />
                                <span className="text-sm font-black text-slate-300">玩家推廣歸屬</span>
                                <span className="text-[10px] text-purple-400/60 font-bold ml-1">每位推廣獎金 NT$ {perPlayerBonus}</span>
                              </div>
                              <div className="space-y-2">
                                {referralInfos.map((info, i) => {
                                  const rl = info.referrer ? roleLabel(info.referrer.role) : null;
                                  const isReferrerCoach = info.referrer && (info.referrer.role === 'coach' || info.referrer.role === 'gm');
                                  const bonusRecipient = isReferrerCoach
                                    ? info.referrer
                                    : info.effectiveCoach;

                                  return (
                                    <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2">
                                      {/* Player name */}
                                      <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-slate-700 rounded-full flex items-center justify-center text-[10px] font-black text-slate-300">{i + 1}</div>
                                        <span className="text-sm font-black text-white">{info.playerName}</span>
                                        {bonusRecipient && (
                                          <span className="ml-auto text-[10px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                                            推廣獎金 → {bonusRecipient.name}
                                          </span>
                                        )}
                                      </div>

                                      {/* Referral chain */}
                                      {!info.referrer ? (
                                        <div className="text-[11px] text-slate-600 pl-7">無推廣關係</div>
                                      ) : (
                                        <div className="pl-7 space-y-1">
                                          <div className="flex items-center gap-2 text-[11px]">
                                            <span className="text-slate-500">直接推廣人：</span>
                                            <span className="text-slate-300 font-bold">{info.referrer.name}</span>
                                            <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-black ${rl?.color}`}>{rl?.text}</span>
                                          </div>
                                          {!isReferrerCoach && (
                                            <div className="flex items-center gap-2 text-[11px] pl-4">
                                              <span className="text-slate-600">└ 歸屬執行師：</span>
                                              {info.effectiveCoach ? (
                                                <>
                                                  <span className="text-amber-300 font-bold">{info.effectiveCoach.name}</span>
                                                  <span className="px-1.5 py-0.5 rounded-full border text-[10px] font-black text-amber-400 bg-amber-500/10 border-amber-500/20">執行師</span>
                                                </>
                                              ) : (
                                                <span className="text-slate-600">無歸屬執行師</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Fee Breakdown */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                              {[
                                { label: '總收入', value: fees.total, color: 'blue' },
                                { label: '帶盤費', value: fees.coachCut, color: 'emerald' },
                                { label: '公司利潤', value: fees.companyCut, color: 'amber' },
                                { label: '推廣獎金', value: fees.promotionBonus, color: 'purple' },
                                { label: '賽季獎金', value: fees.seasonBonus, color: 'rose' },
                              ].map(item => (
                                <div key={item.label} className={`p-3 bg-${item.color}-500/10 rounded-xl border border-${item.color}-500/20`}>
                                  <div className={`text-[10px] font-black text-${item.color}-400 uppercase tracking-wider mb-1`}>{item.label}</div>
                                  <div className={`text-lg font-black text-${item.color}-300`}>NT$ {item.value.toLocaleString()}</div>
                                </div>
                              ))}
                            </div>

                            {/* Return Amount for this record */}
                            {(() => {
                              const ret = calculateReturnAmount(record);
                              return (
                                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-black text-slate-300">應繳回公司</span>
                                    <span className="text-xl font-black text-rose-400">NT$ {ret.total.toLocaleString()}</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="text-center p-2 bg-amber-500/10 rounded-lg">
                                      <div className="text-[10px] text-amber-400/70 mb-1">公司利潤 (30%)</div>
                                      <div className="text-sm font-black text-amber-300">NT$ {ret.companyCut.toLocaleString()}</div>
                                    </div>
                                    <div className="text-center p-2 bg-rose-500/10 rounded-lg">
                                      <div className="text-[10px] text-rose-400/70 mb-1">賽季獎金 (10%)</div>
                                      <div className="text-sm font-black text-rose-300">NT$ {ret.seasonBonus.toLocaleString()}</div>
                                    </div>
                                    <div className="text-center p-2 bg-purple-500/10 rounded-lg">
                                      <div className="text-[10px] text-purple-400/70 mb-1">推廣獎金 (20%)</div>
                                      <div className="text-sm font-black text-purple-300">NT$ {ret.promotionBonusToReturn.toLocaleString()}</div>
                                      {ret.selfReferredCount > 0 && (
                                        <div className="text-[9px] text-slate-500 mt-0.5">自推 {ret.selfReferredCount} 人保留</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

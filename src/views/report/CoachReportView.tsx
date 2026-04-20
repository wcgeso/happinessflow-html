import React, { useState, useEffect } from 'react';
import { X, FileText, TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';
import { db } from '../../../services/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { safeAsync } from '../../utils/utils';
import { Button } from '../../components/ui/ui';
import { CoachRecord } from '../../types';

interface CoachReportViewProps {
  onBack: () => void;
}

interface GroupedData {
  [coachId: string]: {
    coachName: string;
    records: CoachRecord[];
  };
}

interface MonthData {
  [month: string]: {
    records: CoachRecord[];
    coaches: GroupedData;
  };
}

const PLAYER_FEE = 500;
const COACH_CUT = 0.4; // 40%
const COMPANY_CUT = 0.3; // 30%
const PROMOTION_BONUS = 0.2; // 20%
const SEASON_BONUS = 0.1; // 10%

export const CoachReportView: React.FC<CoachReportViewProps> = ({ onBack }) => {
  const [records, setRecords] = useState<CoachRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedCoach, setSelectedCoach] = useState<string>('all');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  useEffect(() => {
    fetchCoachRecords();
  }, []);

  const fetchCoachRecords = async () => {
    setIsLoading(true);
    try {
      const recordsRef = collection(db, 'coach_records');
      const recordsSnap = await safeAsync(getDocs(recordsRef));
      if (!recordsSnap) {
        setIsLoading(false);
        return;
      }

      const fetchedRecords = recordsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CoachRecord[];

      // Sort by timestamp descending
      fetchedRecords.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRecords(fetchedRecords);

      // Set initial month to latest
      if (fetchedRecords.length > 0) {
        const latestDate = new Date(fetchedRecords[0].date);
        const month = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(month);
      }
    } catch (error) {
      console.error('Error fetching coach records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMonthFromDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const organizeDataByMonth = (): MonthData => {
    const grouped: MonthData = {};

    records.forEach(record => {
      const month = getMonthFromDate(record.date);
      if (!grouped[month]) {
        grouped[month] = { records: [], coaches: {} };
      }
      grouped[month].records.push(record);

      // Group by coach
      const coachId = record.coachId;
      if (!grouped[month].coaches[coachId]) {
        grouped[month].coaches[coachId] = {
          coachName: record.coachName,
          records: []
        };
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
      seasonBonus: Math.round(total * SEASON_BONUS)
    };
  };

  const monthlyData = organizeDataByMonth();
  const sortedMonths = Object.keys(monthlyData).sort().reverse();
  const currentMonthData = selectedMonth ? monthlyData[selectedMonth] : undefined;

  const coachOptions = currentMonthData
    ? [
        { id: 'all', name: '全部執行師' },
        ...Object.entries(currentMonthData.coaches)
          .sort((a, b) => a[1].coachName.localeCompare(b[1].coachName))
          .map(([id, data]) => ({ id, name: data.coachName }))
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

  // Calculate totals
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
        seasonBonus: acc.seasonBonus + fees.seasonBonus
      };
    },
    { games: 0, players: 0, totalRevenue: 0, coachPayment: 0, companyProfit: 0, promotionBonus: 0, seasonBonus: 0 }
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
      <div className="border-b border-slate-800/50 p-6 md:p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-500/20 rounded-3xl flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
            <FileText size={28} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">執行師報表</h1>
            <p className="text-emerald-400/60 font-bold uppercase tracking-[0.1em] text-xs mt-0.5">Coach Commission Report</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-black text-slate-300 ml-1">選擇月份</label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setSelectedCoach('all');
                }}
                className="w-full h-12 bg-slate-900/50 border border-emerald-500/20 rounded-xl text-white px-4 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 appearance-none cursor-pointer font-semibold"
              >
                {sortedMonths.map(month => (
                  <option key={month} value={month}>
                    {new Date(`${month}-01`).toLocaleDateString('zh-TW', {
                      year: 'numeric',
                      month: 'long'
                    })}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-slate-300 ml-1">選擇執行師</label>
              <select
                value={selectedCoach}
                onChange={(e) => setSelectedCoach(e.target.value)}
                className="w-full h-12 bg-slate-900/50 border border-emerald-500/20 rounded-xl text-white px-4 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 appearance-none cursor-pointer font-semibold"
              >
                {coachOptions.map(coach => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl backdrop-blur-sm">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">總場次</div>
              <div className="text-2xl font-black text-white">{totalStats.games}</div>
            </div>
            <div className="p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl backdrop-blur-sm">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">總玩家數</div>
              <div className="text-2xl font-black text-white">{totalStats.players}</div>
            </div>
            <div className="p-4 bg-slate-900/40 border border-blue-500/10 rounded-2xl backdrop-blur-sm">
              <div className="text-[9px] font-black text-blue-500/80 uppercase tracking-widest mb-1">總收入</div>
              <div className="text-2xl font-black text-blue-400">NT$ {totalStats.totalRevenue.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-slate-900/40 border border-emerald-500/10 rounded-2xl backdrop-blur-sm">
              <div className="text-[9px] font-black text-emerald-500/80 uppercase tracking-widest mb-1">執行師費用</div>
              <div className="text-2xl font-black text-emerald-400">NT$ {totalStats.coachPayment.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-slate-900/40 border border-amber-500/10 rounded-2xl backdrop-blur-sm">
              <div className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest mb-1">公司利潤</div>
              <div className="text-2xl font-black text-amber-400">NT$ {totalStats.companyProfit.toLocaleString()}</div>
            </div>
          </div>

          {/* Fee Summary */}
          {totalStats.games > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 md:p-8">
              <h3 className="text-lg font-black text-white mb-6">費用分拆明細 (全部收入分配)</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="p-4 bg-slate-900/50 rounded-2xl border border-blue-500/20">
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">總收入</div>
                  <div className="text-2xl font-black text-blue-300">NT$ {totalStats.totalRevenue.toLocaleString()}</div>
                  <div className="text-[10px] text-blue-400/60 mt-1">100%</div>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-2xl border border-emerald-500/20">
                  <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">帶盤費 (40%)</div>
                  <div className="text-2xl font-black text-emerald-300">NT$ {totalStats.coachPayment.toLocaleString()}</div>
                  <div className="text-[10px] text-emerald-400/60 mt-1">執行師應收</div>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-2xl border border-amber-500/20">
                  <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">公司利潤 (30%)</div>
                  <div className="text-2xl font-black text-amber-300">NT$ {totalStats.companyProfit.toLocaleString()}</div>
                  <div className="text-[10px] text-amber-400/60 mt-1">公司保留</div>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-2xl border border-purple-500/20">
                  <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">推廣獎金 (20%)</div>
                  <div className="text-2xl font-black text-purple-300">NT$ {totalStats.promotionBonus.toLocaleString()}</div>
                  <div className="text-[10px] text-purple-400/60 mt-1">執行師獎勵</div>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-2xl border border-rose-500/20">
                  <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">賽季獎金 (10%)</div>
                  <div className="text-2xl font-black text-rose-300">NT$ {totalStats.seasonBonus.toLocaleString()}</div>
                  <div className="text-[10px] text-rose-400/60 mt-1">季度累積</div>
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

                  return (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all group cursor-pointer"
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

                        <div className="flex items-center gap-6 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-sm text-slate-400">玩家數</div>
                            <div className="text-xl font-black text-white">{record.playerCount}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-slate-400">費用總額</div>
                            <div className="text-xl font-black text-emerald-400">NT$ {fees.total.toLocaleString()}</div>
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
                            className="border-t border-slate-800/50 bg-slate-900/20 p-4 md:p-6 space-y-4"
                          >
                            {/* Player Names */}
                            {record.players && record.players.length > 0 && (
                              <div>
                                <div className="text-sm font-black text-slate-300 mb-2">玩家名單</div>
                                <div className="flex flex-wrap gap-2">
                                  {record.players.map((player, idx) => (
                                    <div
                                      key={idx}
                                      className="px-3 py-1.5 bg-slate-800/50 rounded-full text-xs font-semibold text-slate-300 border border-slate-700"
                                    >
                                      {player.name}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Fee Breakdown */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <div className="text-[10px] font-black text-blue-400 uppercase tracking-wider mb-1">總收入</div>
                                <div className="text-lg font-black text-blue-300">NT$ {fees.total.toLocaleString()}</div>
                              </div>

                              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-1">帶盤費</div>
                                <div className="text-lg font-black text-emerald-300">NT$ {fees.coachCut.toLocaleString()}</div>
                              </div>

                              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider mb-1">公司利潤</div>
                                <div className="text-lg font-black text-amber-300">NT$ {fees.companyCut.toLocaleString()}</div>
                              </div>

                              <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                <div className="text-[10px] font-black text-purple-400 uppercase tracking-wider mb-1">推廣獎金</div>
                                <div className="text-lg font-black text-purple-300">NT$ {fees.promotionBonus.toLocaleString()}</div>
                              </div>

                              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                <div className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-1">賽季獎金</div>
                                <div className="text-lg font-black text-rose-300">NT$ {fees.seasonBonus.toLocaleString()}</div>
                              </div>
                            </div>
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

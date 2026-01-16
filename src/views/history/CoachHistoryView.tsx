import React, { useState, useEffect } from 'react';
import { Card, Button } from '../../components/ui/ui';
import {
    ArrowLeft,
    History as HistoryIcon,
    Users,
    ChevronDown,
    ChevronUp,
    Trophy
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../../services/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { CoachRecord, GameState } from '../../types';
import { cn, safeAsync } from '../../utils/utils';
import { FinancialStatement } from '../../components/business/FinancialStatement';
import { FileText, X } from 'lucide-react';

const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '未知日期') return '未知日期';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;

        // 如果包含 'T'，表示是完整的 ISO 字串，顯示日期與時間
        if (dateStr.includes('T')) {
            return date.toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(/\//g, '-');
        }
        return dateStr;
    } catch (e) {
        return dateStr;
    }
};

const FullFinancialStatementModal: React.FC<{
    playerData: any;
    date: string;
    roomName: string;
    onClose: () => void;
}> = ({ playerData, date, roomName, onClose }) => {
    if (!playerData) return null;

    // 還原薪資與支出邏輯 (參考 HistoryView.tsx)
    const snapshot = playerData;
    const summary = playerData.summary;

    let restoredSalary = snapshot.income.salary || 0;
    if (restoredSalary === 0 && summary.totalIncome > (summary.passiveIncome || 0)) {
        restoredSalary = summary.totalIncome - (summary.passiveIncome || 0);
    }

    const dummyGameState: GameState = {
        profession: snapshot.professionData || {
            title: snapshot.profession,
            salary: restoredSalary,
            id: 'dummy',
            initialRank: '',
            savings: 0,
            expenses: {
                tax: snapshot.expenses.taxes || snapshot.expenses.tax || Math.floor(restoredSalary * 0.05),
                basicLiving: snapshot.expenses.basicLiving || 0,
                transportEdu: snapshot.expenses.transportEdu || 0,
                otherMedicalChild: snapshot.expenses.otherMedicalChild || 0
            },
            mortgageTotal: 0,
            businessLoanTotal: 0,
            creditLoanTotal: 0,
            promotions: []
        },
        selectedEnterprise: null,
        selectedDream: null,
        expenses: snapshot.expenses,
        income: {
            ...snapshot.income,
            salary: restoredSalary
        },
        currentRankTitle: snapshot.profession,
        currentRankLevel: 1,
        cash: snapshot.cash,
        children: 0,
        medicalInsuranceCount: 0,
        assets: snapshot.assets,
        liabilities: snapshot.liabilities,
        loans: snapshot.loans,
        isSetup: true,
        history: snapshot.history,
        happiness: snapshot.happinessItems || snapshot.happiness || [],
        happinessTotal: snapshot.happiness,
        marketPrices: {},
        previousMarketPrices: {},
        lastPublishedCode: '',
        abilities: {
            stockAbilityCount: 0,
            realEstateAbilityCount: 0,
            professionAbilityCount: 0
        },
        completedHappinessEvents: [],
        playerName: snapshot.name,
        reportName: roomName
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
            <div
                className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                            <FileText className="text-emerald-400" size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white leading-none">玩家財務報表</h3>
                            <div className="text-slate-500 text-sm mt-1.5 flex flex-col gap-0.5">
                                <span>{snapshot.name} • {roomName}</span>
                                <span className="text-xs opacity-80">{formatDate(date)}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30">
                    <FinancialStatement
                        gameState={dummyGameState}
                        summary={summary}
                        hideSummary={true}
                        defaultShowDetails={true}
                        hideNav={false}
                        disabled={true}
                    />
                </div>
            </div>
        </div>
    );
};

interface CoachHistoryViewProps {
    onBack: () => void;
}

export const CoachHistoryView: React.FC<CoachHistoryViewProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [records, setRecords] = useState<CoachRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedScoreRecord, setSelectedScoreRecord] = useState<any | null>(null);
    const [viewingPlayerUid, setViewingPlayerUid] = useState<string | null>(null);
    const [isFetchingDetail, setIsFetchingDetail] = useState(false);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'coach_records'),
            where('coachId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedRecords = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as CoachRecord[];

            // Client-side sort to avoid Firestore index requirement
            fetchedRecords.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            setRecords(fetchedRecords);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching coach records:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const toggleExpand = async (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
            setSelectedScoreRecord(null);
            return;
        }
        
        setExpandedId(id);
        setIsFetchingDetail(true);
        
        // Fetch detailed score record
        try {
            const scoreDoc = await safeAsync(getDoc(doc(db, 'score_records', 'S1', 'records', id)));
            if (scoreDoc && scoreDoc.exists()) {
                setSelectedScoreRecord(scoreDoc.data());
            }
        } catch (error) {
            console.error("Error fetching detailed score record:", error);
        } finally {
            setIsFetchingDetail(false);
        }
    };

    const handleViewStatement = (playerUid: string) => {
        setViewingPlayerUid(playerUid);
    };

    const viewingPlayerData = viewingPlayerUid && selectedScoreRecord?.players?.find((p: any) => p.uid === viewingPlayerUid);

    return (
        <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden touch-none">
            <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar touch-pan-y">
                <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                    {/* Header Section */}
                    <div className="flex flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <HistoryIcon className="text-emerald-500" size={28} />
                            </div>
                            <div>
                                <h2 className="text-xl md:text-3xl font-bold text-white">執行紀錄</h2>
                                <p className="hidden md:block text-slate-500 text-sm mt-0.5">執行師帶領遊戲的專業歷程</p>
                            </div>
                        </div>

                        <Button
                            variant="secondary"
                            onClick={onBack}
                            className="bg-slate-900/50 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 h-10 px-4"
                        >
                            <ArrowLeft size={18} className="mr-2" /> 返回
                        </Button>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="bg-slate-900/40 border-slate-800 p-4 flex flex-col items-center justify-center text-center">
                            <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">累計場次</div>
                            <div className="text-2xl font-black text-white">{records.length}</div>
                        </Card>
                        <Card className="bg-slate-900/40 border-slate-800 p-4 flex flex-col items-center justify-center text-center">
                            <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">帶領人數</div>
                            <div className="text-2xl font-black text-amber-400">
                                {records.reduce((acc, curr) => acc + (curr.playerCount || 0), 0)}
                            </div>
                        </Card>
                    </div>

                    {/* Records List */}
                    <div className="space-y-4">
                        {loading ? (
                            <div className="py-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/50">
                                載入中...
                            </div>
                        ) : records.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/50">
                                尚無執行紀錄
                            </div>
                        ) : (
                            records.map((record) => (
                                <div key={record.id} className="space-y-2">
                                    <Card
                                        className={cn(
                                            "bg-slate-900/50 border-slate-800 p-4 backdrop-blur-sm cursor-pointer hover:bg-slate-800/50 transition-all duration-200",
                                            expandedId === record.id && "ring-1 ring-amber-500/30 border-amber-500/30"
                                        )}
                                        onClick={() => toggleExpand(record.id)}
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                                                    <HistoryIcon size={20} />
                                                </div>
                                                <div>
                                                    <div className="text-slate-200 font-bold text-base flex items-center gap-2">
                                                        {record.roomName || `房間：${record.roomCode}`}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
                                                        <span>{formatDate(record.date)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between md:justify-end gap-6 md:gap-10">
                                                <div className="flex flex-col items-center md:items-end">
                                                    <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">玩家人數</div>
                                                    <div className="text-white font-black text-xl">{record.playerCount}</div>
                                                </div>

                                                {record.duration && (
                                                    <div className="hidden lg:flex flex-col items-end">
                                                        <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">遊戲時長</div>
                                                        <div className="text-slate-300 font-bold">{record.duration} 分鐘</div>
                                                    </div>
                                                )}

                                                <div className="text-slate-500">
                                                    {expandedId === record.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Expanded Player List */}
                                    {expandedId === record.id && record.players && (
                                        <div className="animate-in slide-in-from-top-2 duration-300">
                                            <Card className="bg-slate-900/80 border-slate-800 p-4">
                                                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
                                                    <Users className="text-amber-400" size={18} />
                                                    <h3 className="text-base text-white font-bold">參與玩家</h3>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {record.players.map((player, idx) => {
                                                        const pUid = (player as any).uid || (selectedScoreRecord?.players?.[idx]?.uid);
                                                        return (
                                                            <div key={idx} className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-xl flex flex-col gap-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <div className="text-slate-200 font-bold text-sm flex items-center gap-2">
                                                                            {player.name}
                                                                            {player.isWin && <Trophy size={12} className="text-yellow-400" />}
                                                                        </div>
                                                                        <div className="text-slate-500 text-xs">{player.profession}</div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-pink-500 font-black text-sm">{player.happiness} 幸福</div>
                                                                        <div className="text-yellow-400 font-bold text-xs">{player.score} 分</div>
                                                                    </div>
                                                                </div>
                                                                
                                                                {pUid && (
                                                                      <Button
                                                                          variant="secondary"
                                                                          onClick={(e) => {
                                                                              e.stopPropagation();
                                                                              handleViewStatement(pUid);
                                                                          }}
                                                                          disabled={isFetchingDetail || !selectedScoreRecord}
                                                                          className="w-full bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white border border-slate-700/50 h-8 text-[10px] uppercase tracking-wider font-bold py-0"
                                                                      >
                                                                          {isFetchingDetail ? "載入中..." : (
                                                                              <span className="flex items-center gap-2">
                                                                                  <FileText size={14} /> 查看財務報表
                                                                              </span>
                                                                          )}
                                                                      </Button>
                                                                  )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </Card>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Financial Statement Modal */}
            {viewingPlayerData && (
                <FullFinancialStatementModal
                    playerData={viewingPlayerData}
                    date={selectedScoreRecord?.settledAt?.toDate?.()?.toISOString() || selectedScoreRecord?.settledAt || records.find(r => r.id === expandedId)?.date || ""}
                    roomName={selectedScoreRecord?.roomName || records.find(r => r.id === expandedId)?.roomName || "遊戲紀錄"}
                    onClose={() => setViewingPlayerUid(null)}
                />
            )}
        </div>
    );
};

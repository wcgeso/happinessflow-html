import React, { useState, useMemo, useEffect } from 'react';
import { Card, Button, Input } from '../../components/ui/ui';
import {
    ArrowLeft,
    History as HistoryIcon,
    Search,
    Users,
    ChevronDown,
    ChevronUp,
    FileText,
    X,
    ExternalLink,
    Calendar
} from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { calculateFinancialSummary, calculateScoreResult, formatMoney } from '../../utils/gameUtils';
import { cn } from '../../utils/utils';
import { useRoom } from '../../context/RoomContext';
import { Trophy } from 'lucide-react';
import { GameRecord, GameState } from '../../types';
import { FinancialStatement } from '../../components/business/FinancialStatement';
import { ScoreView } from '../game/ScoreView';
import { db } from '../../../services/firebase';
import { safeAsync } from '../../utils/utils';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
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

interface HistoryViewProps {
    onBack: () => void;
    targetUserId?: string | null;
}



const FullFinancialStatementModal: React.FC<{
    record: GameRecord | null;
    onClose: () => void;
}> = ({ record, onClose }) => {
    if (!record) return null;

    // 強力還原薪資與支出邏輯
    const snapshot = record.gameStateSnapshot;
    const summary = record.financialSummary;

    // 1. 還原薪資：如果快照中是0，則用 總收入 - 理財收入 推算
    let restoredSalary = snapshot.income.salary || 0;
    if (restoredSalary === 0 && summary.totalIncome > (summary.passiveIncome || 0)) {
        restoredSalary = summary.totalIncome - (summary.passiveIncome || 0);
    }

    // Convert GameRecord's snapshot back to a partial GameState for FinancialStatement
    const dummyGameState: GameState = {
        profession: record.professionData || {
            title: record.profession,
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
        currentRankTitle: record.profession,
        currentRankLevel: 1,
        cash: snapshot.cash,
        children: 0,
        medicalInsuranceCount: 0,
        assets: snapshot.assets,
        liabilities: snapshot.liabilities,
        loans: snapshot.loans,
        isSetup: true,
        history: snapshot.history,
        happiness: snapshot.happiness,
        happinessTotal: record.happinessScore,
        marketPrices: {},
        previousMarketPrices: {},
        lastPublishedCode: '',
        abilities: {
            stockAbilityCount: 0,
            realEstateAbilityCount: 0,
            professionAbilityCount: 0
        },
        completedHappinessEvents: [],
        playerName: record.playerName,
        reportName: record.reportName
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
                            <h3 className="text-2xl font-bold text-white leading-none">完整財務報表</h3>
                            <div className="text-slate-500 text-sm mt-1.5 flex flex-col gap-0.5">
                                <span>{record.playerName} • {record.reportName}</span>
                                <span className="text-xs opacity-80">{formatDate(record.date)}</span>
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
                        summary={record.financialSummary}
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

const ScoreModal: React.FC<{
    record: GameRecord | null;
    onClose: () => void;
}> = ({ record, onClose }) => {
    if (!record) return null;

    const dummyGameState: GameState = {
        profession: { title: record.profession, id: 'dummy', initialRank: '', salary: 0, savings: 0, expenses: { tax: 0, basicLiving: 0, transportEdu: 0, otherMedicalChild: 0 }, mortgageTotal: 0, businessLoanTotal: 0, creditLoanTotal: 0, promotions: [] },
        selectedEnterprise: null,
        selectedDream: null,
        expenses: record.gameStateSnapshot.expenses,
        income: record.gameStateSnapshot.income,
        currentRankTitle: record.profession,
        currentRankLevel: 1,
        cash: record.gameStateSnapshot.cash,
        children: 0,
        medicalInsuranceCount: 0,
        assets: record.gameStateSnapshot.assets,
        liabilities: record.gameStateSnapshot.liabilities,
        loans: record.gameStateSnapshot.loans,
        isSetup: true,
        history: record.gameStateSnapshot.history,
        happiness: record.gameStateSnapshot.happiness,
        happinessTotal: record.happinessScore,
        marketPrices: {},
        previousMarketPrices: {},
        lastPublishedCode: '',
        abilities: { stockAbilityCount: 0, realEstateAbilityCount: 0, professionAbilityCount: 0 },
        completedHappinessEvents: [],
        playerName: record.playerName,
        reportName: record.reportName
    };

    const { details, totalScore } = calculateScoreResult(dummyGameState, record.financialSummary);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="shrink-0 p-6 bg-slate-800/40 border-b border-slate-500/30 text-center relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                        <X size={24} />
                    </button>
                    <div className="mx-auto text-yellow-400 mb-2 flex justify-center">
                        <Trophy size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-white">遊戲評分</h2>
                    <p className="text-amber-400 font-mono text-xs mt-1">
                        {record.playerName} • {formatDate(record.date)}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-none no-scrollbar">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                            積分細項
                        </h3>
                        <div className="space-y-2">
                            {details.map((detail, idx) => (
                                <div key={idx} className={`flex justify-between items-center text-xs py-3 border-b border-slate-700/50 last:border-0 ${detail.achieved ? 'text-slate-300' : 'text-slate-500'}`}>
                                    <div className="flex items-center gap-2">
                                        {detail.achieved ? (
                                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                                                <div className="w-2 h-2 rounded-full bg-current" />
                                            </div>
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-slate-600">
                                                <div className="w-1 h-1 rounded-full bg-current" />
                                            </div>
                                        )}
                                        {detail.label}
                                    </div>
                                    <span className={`font-bold ${detail.achieved ? 'text-amber-400' : 'text-slate-600'}`}>
                                        +{detail.points}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="shrink-0 p-6 pt-0">
                    <div className="bg-slate-800/80 rounded-2xl p-4 border border-amber-500/30 flex justify-between items-center shadow-lg shadow-amber-900/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                                <Trophy size={20} />
                            </div>
                            <div>
                                <div className="text-[9px] font-black text-amber-500/60 uppercase tracking-[0.2em] leading-none mb-1">Total Score</div>
                                <div className="text-base font-black text-white tracking-wide uppercase">結算總積分</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-black text-amber-400 font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                                {totalScore}
                            </div>
                            <div className="text-[9px] font-black text-amber-500/40 mt-0.5 tracking-widest">POINTS</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export const HistoryView: React.FC<HistoryViewProps> = ({ onBack, targetUserId }) => {
    const { gameHistory: myHistory } = useGame();
    const [targetHistory, setTargetHistory] = useState<GameRecord[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [fullStatementRecord, setFullStatementRecord] = useState<GameRecord | null>(null);
    const [scoreRecord, setScoreRecord] = useState<GameRecord | null>(null);

    // Determine which history to display
    const currentHistory = targetUserId ? (targetHistory || []) : myHistory;

    useEffect(() => {
        if (!targetUserId) {
            setTargetHistory(null);
            return;
        }

        const fetchTargetHistory = async () => {
            setIsLoading(true);
            console.log('[HistoryView] Fetching history for UID:', targetUserId);
            try {
                // Remove orderBy to avoid potential missing index errors
                const q = query(
                    collection(db, 'score_records', 'S1', 'records'),
                    where('playerUids', 'array-contains', targetUserId)
                );
                const querySnapshot = await safeAsync(getDocs(q));

                if (!querySnapshot) {
                    setTargetHistory([]);
                    return;
                }

                console.log('[HistoryView] Query result size:', querySnapshot.size);

                const records: GameRecord[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.id.startsWith('MOCK_') ? doc.data() : doc.data();
                    if (!data.players || !Array.isArray(data.players)) return;

                    const playerData = data.players.find((p: any) => p.uid === targetUserId);
                    if (playerData) {
                        // 推算薪資 (針對舊資料遺失 salary 的情況)
                        const income = { ...playerData.income };
                        if (!income.salary && playerData.summary) {
                            const passive = playerData.summary.passiveIncome || 0;
                            const total = playerData.summary.totalIncome || 0;
                            if (total > passive) {
                                income.salary = total - passive;
                            }
                        }

                        // 重要：重新根據快照計算財務摘要，確保數據準確
                        const reconstructedGameState: any = {
                            profession: playerData.professionData || { title: playerData.profession, salary: income.salary || 0, expenses: { basicLiving: 0, transportEdu: 0, otherMedicalChild: 0 } },
                            assets: playerData.assets || [],
                            liabilities: playerData.liabilities || [],
                            income: income,
                            expenses: playerData.expenses || {},
                            loans: playerData.loans || 0,
                            medicalInsuranceCount: playerData.medicalInsuranceCount || 0,
                            currentRankLevel: playerData.currentRankLevel || 1,
                            cash: playerData.cash || 0,
                            marketPrices: data.marketPrices || {}
                        };
                        const freshSummary = calculateFinancialSummary(reconstructedGameState);

                        records.push({
                            id: doc.id,
                            date: data.settledAt?.toDate ? data.settledAt.toDate().toISOString() :
                                (data.settledAt ? new Date(data.settledAt).toISOString() : new Date().toISOString()),
                            playerName: playerData.name,
                            reportName: data.roomName || `${playerData.name} 的財務報表`,
                            profession: playerData.profession,
                            professionData: playerData.professionData,
                            finalScore: playerData.totalScore || 0,
                            happinessScore: playerData.happiness || 0,
                            isWin: playerData.happiness >= 100,
                            financialSummary: freshSummary, // 使用重新計算後的精確摘要
                            gameStateSnapshot: {
                                assets: playerData.assets || [],
                                liabilities: playerData.liabilities || [],
                                income: income,
                                expenses: playerData.expenses || {},
                                history: playerData.history || [],
                                happiness: playerData.happinessItems || [],
                                cash: playerData.cash || 0,
                                loans: playerData.loans || 0
                            },
                            allPlayers: (data.players || []).map((p: any) => ({
                                name: p.name || '玩家',
                                happiness: p.happiness ?? p.happinessTotal ?? 0,
                                totalScore: p.totalScore ?? p.score ?? 0,
                                profession: p.profession || '未知職業'
                            }))
                        });
                    }
                });

                // Sort locally by date desc
                records.sort((a, b) => {
                    const dateA = new Date(a.date).getTime();
                    const dateB = new Date(b.date).getTime();
                    return dateB - dateA;
                });

                console.log('[HistoryView] Processed records count:', records.length);
                setTargetHistory(records);
            } catch (error) {
                console.error('[HistoryView] Error fetching target history:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTargetHistory();
    }, [targetUserId]);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden touch-none pt-safe pb-safe">
            <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar touch-pan-y">
                <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                    {/* Header Section */}
                    <div className="flex flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <HistoryIcon className="text-emerald-400" size={28} />
                            </div>
                            <div>
                                <h2 className="text-xl md:text-3xl font-bold text-white">歷史紀錄</h2>
                                <p className="hidden md:block text-slate-500 text-sm mt-0.5">查看過往的所有遊戲歷程與成就</p>
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

                    {/* Content Section - Card layout for both mobile and desktop (expandable) */}
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                                <p className="text-slate-500 font-bold text-sm">正在載入紀錄數據...</p>
                            </div>
                        ) : currentHistory.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/50">
                                尚無遊戲紀錄
                            </div>
                        ) : (
                            currentHistory.map((record, index) => (
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
                                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                                    <Users size={20} />
                                                </div>
                                                <div>
                                                    <div className="text-slate-200 font-bold text-base flex items-center gap-2">
                                                        {record.reportName || '未命名報表'}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
                                                        <span>{formatDate(record.date)}</span>
                                                        <span>•</span>
                                                        <span className="text-slate-400">{record.finalRankTitle || record.profession}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between md:justify-end gap-6 md:gap-10">
                                                <div className="flex flex-col items-center md:items-end">
                                                    <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">幸福指數</div>
                                                    <div className="text-pink-500 font-black text-xl">{record.happinessScore ?? 0}</div>
                                                </div>
                                                <div className="flex flex-col items-center md:items-end">
                                                    <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">評分得分</div>
                                                    <div className="text-yellow-400 font-black text-xl">{record.finalScore ?? 0}</div>
                                                </div>
                                                <div className="hidden lg:flex flex-col items-end">
                                                    <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">總資產</div>
                                                    <div className="text-blue-400 font-bold font-mono">{record.financialSummary ? formatMoney(record.financialSummary.totalAssets) : '$0'}</div>
                                                </div>

                                                <div className="text-slate-500">
                                                    {expandedId === record.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Expanded Details */}
                                    {expandedId === record.id && (
                                        <div className="animate-in slide-in-from-top-2 duration-300">
                                            {/* Financial Summary Snapshot - Now Full Width */}
                                            <Card className="bg-slate-900/80 border-slate-800 p-4 space-y-4">
                                                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="text-emerald-400" size={18} />
                                                        <h3 className="text-base text-white font-bold">財務報表詳情</h3>
                                                    </div>
                                                    <div className="flex items-center ml-auto">
                                                        <Button
                                                            variant="secondary"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setScoreRecord(record);
                                                            }}
                                                            className="h-7 px-2 bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 border text-[10px] font-bold"
                                                        >
                                                            <Trophy size={12} className="mr-1" />
                                                            評分
                                                        </Button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFullStatementRecord(record);
                                                            }}
                                                            className="h-7 w-7 rounded p-0 flex items-center justify-center bg-slate-500/10 border-slate-500/20 text-slate-400 hover:bg-slate-500/20 hover:text-slate-300 border font-bold ml-2 transition-colors"
                                                        >
                                                            <ExternalLink size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div className="space-y-0.5">
                                                        <div className="text-slate-500 text-[9px] uppercase tracking-wider">總收入 (每月)</div>
                                                        <div className="text-emerald-400 text-lg font-bold font-mono">{record.financialSummary ? formatMoney(record.financialSummary.totalIncome) : '$0'}</div>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <div className="text-slate-500 text-[9px] uppercase tracking-wider">總支出 (每月)</div>
                                                        <div className="text-rose-400 text-lg font-bold font-mono">{record.financialSummary ? formatMoney(record.financialSummary.totalExpenses) : '$0'}</div>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <div className="text-slate-500 text-[9px] uppercase tracking-wider">總資產</div>
                                                        <div className="text-blue-400 text-lg font-bold font-mono">{record.financialSummary ? formatMoney(record.financialSummary.totalAssets) : '$0'}</div>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <div className="text-slate-500 text-[9px] uppercase tracking-wider">總負債</div>
                                                        <div className="text-rose-400 text-lg font-bold font-mono">{record.financialSummary ? formatMoney(record.financialSummary.totalLiabilities) : '$0'}</div>
                                                    </div>
                                                </div>
                                            </Card>

                                            {/* New: All Players Board */}
                                            {record.allPlayers && record.allPlayers.length > 0 ? (
                                                <Card className="bg-slate-900/80 border-slate-800 overflow-hidden mt-4">
                                                    <div className="p-3 bg-slate-800/40 border-b border-slate-800">
                                                        <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                                                            <Users size={14} className="text-pink-400" />
                                                            玩家表現
                                                        </h3>
                                                    </div>
                                                    <div className="divide-y divide-slate-800">
                                                        {[...record.allPlayers].sort((a, b) => b.totalScore - a.totalScore).map((p, idx) => (
                                                            <div key={idx} className="p-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={cn(
                                                                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                                                        idx === 0 ? "bg-yellow-500/20 text-yellow-500" :
                                                                            idx === 1 ? "bg-slate-300/20 text-slate-300" :
                                                                                idx === 2 ? "bg-amber-600/20 text-amber-600" :
                                                                                    "bg-slate-800 text-slate-500"
                                                                    )}>
                                                                        {idx + 1}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-bold text-white">{p.name}</div>
                                                                        <div className="text-[10px] text-slate-500">{p.profession}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-4">
                                                                    <div className="text-right">
                                                                        <div className="text-[9px] text-slate-500 uppercase tracking-tighter">幸福值</div>
                                                                        <div className="text-xs font-black text-pink-500">{p.happiness}</div>
                                                                    </div>
                                                                    <div className="text-right min-w-[3rem]">
                                                                        <div className="text-[9px] text-slate-500 uppercase tracking-tighter">積分</div>
                                                                        <div className="text-xs font-black text-yellow-400">{p.totalScore}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </Card>
                                            ) : (
                                                <div className="text-center py-4 text-slate-600 text-xs italic">
                                                    ( 暫無其他玩家表現數據 )
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <FullFinancialStatementModal
                record={fullStatementRecord}
                onClose={() => setFullStatementRecord(null)}
            />

            <ScoreModal
                record={scoreRecord}
                onClose={() => setScoreRecord(null)}
            />
        </div>
    );
};

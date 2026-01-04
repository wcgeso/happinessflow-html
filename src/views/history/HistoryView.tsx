import React, { useState, useMemo } from 'react';
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
import { formatMoney } from '../../utils/gameUtils';
import { cn } from '../../utils/utils';
import { GameRecord, GameState } from '../../types';
import { FinancialStatement } from '../../components/business/FinancialStatement';

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
}



const FullFinancialStatementModal: React.FC<{
    record: GameRecord | null;
    onClose: () => void;
}> = ({ record, onClose }) => {
    if (!record) return null;

    // Convert GameRecord's snapshot back to a partial GameState for FinancialStatement
    const dummyGameState: GameState = {
        profession: {
            title: record.profession,
            salary: record.gameStateSnapshot.income.salary || 0,
            // Add other required profession fields with dummy values if needed
            id: 'dummy',
            initialRank: '',
            savings: 0,
            expenses: {
                tax: record.gameStateSnapshot.expenses.taxes || 0,
                basicLiving: 0,
                transportEdu: 0,
                otherMedicalChild: 0
            },
            mortgageTotal: 0,
            businessLoanTotal: 0,
            creditLoanTotal: 0,
            promotions: []
        },
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
                    />
                </div>
            </div>
        </div>
    );
};

export const HistoryView: React.FC<HistoryViewProps> = ({ onBack }) => {
    const { gameHistory } = useGame();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [fullStatementRecord, setFullStatementRecord] = useState<GameRecord | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden touch-none">
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
                        返回 <ArrowLeft size={18} className="ml-2 rotate-180" />
                    </Button>
                </div>

                {/* Content Section - Card layout for both mobile and desktop (expandable) */}
                <div className="space-y-4">
                    {gameHistory.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/50">
                            尚無遊戲紀錄
                        </div>
                    ) : (
                        gameHistory.map((record) => (
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
                                                <div className="text-pink-500 font-black text-xl">{record.happinessScore}</div>
                                            </div>
                                            <div className="flex flex-col items-center md:items-end">
                                                <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">評分得分</div>
                                                <div className="text-yellow-400 font-black text-xl">{record.finalScore}</div>
                                            </div>
                                            <div className="hidden lg:flex flex-col items-end">
                                                <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">總資產</div>
                                                <div className="text-blue-400 font-bold font-mono">{formatMoney(record.financialSummary.totalAssets)}</div>
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
                                                <Button
                                                    variant="secondary"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFullStatementRecord(record);
                                                    }}
                                                    className="h-7 px-2 bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border text-[10px] font-bold"
                                                >
                                                    <ExternalLink size={12} className="mr-1" />
                                                    詳情
                                                </Button>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="space-y-0.5">
                                                    <div className="text-slate-500 text-[9px] uppercase tracking-wider">總收入 (每月)</div>
                                                    <div className="text-emerald-400 text-lg font-bold font-mono">{formatMoney(record.financialSummary.totalIncome)}</div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="text-slate-500 text-[9px] uppercase tracking-wider">總支出 (每月)</div>
                                                    <div className="text-rose-400 text-lg font-bold font-mono">{formatMoney(record.financialSummary.totalExpenses)}</div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="text-slate-500 text-[9px] uppercase tracking-wider">總資產</div>
                                                    <div className="text-blue-400 text-lg font-bold font-mono">{formatMoney(record.financialSummary.totalAssets)}</div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="text-slate-500 text-[9px] uppercase tracking-wider">總負債</div>
                                                    <div className="text-rose-400 text-lg font-bold font-mono">{formatMoney(record.financialSummary.totalLiabilities)}</div>
                                                </div>
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

            <FullFinancialStatementModal 
                record={fullStatementRecord} 
                onClose={() => setFullStatementRecord(null)} 
            />
        </div>
    );
};

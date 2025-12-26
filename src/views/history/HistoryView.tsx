import React, { useState, useMemo } from 'react';
import { Card, Button, Input } from '../../components/ui/ui';
import { 
    ArrowLeft, 
    History, 
    Search, 
    Users,
    ChevronDown,
    ChevronUp,
    FileText,
    TrendingUp,
    TrendingDown,
    Wallet,
    DollarSign
} from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { formatMoney } from '../../utils/gameUtils';
import { cn } from '../../utils/utils';
import { GameRecord, Transaction } from '../../types';

interface HistoryViewProps {
    onBack: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onBack }) => {
    const { gameHistory } = useGame();
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const filteredHistory = useMemo(() => {
        return [...gameHistory]
            .filter(record => {
                const matchesSearch = record.playerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                   record.profession.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesSearch;
            });
    }, [gameHistory, searchTerm]);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header Section */}
                <div className="flex flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <History className="text-emerald-400" size={28} />
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

                {/* Filters Section */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/30 p-4 rounded-xl border border-slate-800/50 backdrop-blur-sm">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <Input 
                            placeholder="搜尋玩家或職業..." 
                            className="pl-10 bg-slate-950/50 border-slate-700 text-slate-200 focus:ring-emerald-500/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Content Section - Card layout for both mobile and desktop (expandable) */}
                <div className="space-y-4">
                    {filteredHistory.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/50">
                            尚無遊戲紀錄
                        </div>
                    ) : (
                        filteredHistory.map((record) => (
                            <div key={record.id} className="space-y-2">
                                <Card 
                                    className={cn(
                                        "bg-slate-900/50 border-slate-800 p-4 backdrop-blur-sm cursor-pointer hover:bg-slate-800/50 transition-all duration-200",
                                        expandedId === record.id && "ring-1 ring-emerald-500/30 border-emerald-500/30"
                                    )}
                                    onClick={() => toggleExpand(record.id)}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                                <Users size={20} />
                                            </div>
                                            <div>
                                                <div className="text-slate-200 font-bold text-lg">{record.playerName}</div>
                                                <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
                                                    <span>{record.date}</span>
                                                    <span>•</span>
                                                    <span className="text-slate-400">{record.profession}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between md:justify-end gap-6 md:gap-12">
                                            <div className="flex flex-col items-center md:items-end">
                                                <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">幸福指數</div>
                                                <div className="text-pink-500 font-black text-xl">{record.happinessScore}</div>
                                            </div>
                                            <div className="flex flex-col items-center md:items-end">
                                                <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">結算得分</div>
                                                <div className="text-yellow-400 font-black text-xl">{record.finalScore}</div>
                                            </div>
                                            <div className="hidden sm:flex flex-col items-end">
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
                                    <div className="animate-in slide-in-from-top-2 duration-300 space-y-4">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {/* Financial Summary Snapshots */}
                                            <Card className="bg-slate-900/80 border-slate-800 p-5 space-y-6">
                                                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                                                    <FileText className="text-emerald-400" size={18} />
                                                    <h3 className="text-white font-bold">財務報表快照</h3>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                                                    <div>
                                                        <div className="text-slate-500 text-xs mb-1">總收入 (每月)</div>
                                                        <div className="text-emerald-400 font-bold font-mono">{formatMoney(record.financialSummary.totalIncome)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-slate-500 text-xs mb-1">總支出 (每月)</div>
                                                        <div className="text-rose-400 font-bold font-mono">{formatMoney(record.financialSummary.totalExpenses)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-slate-500 text-xs mb-1">被動收入</div>
                                                        <div className="text-blue-400 font-bold font-mono">{formatMoney(record.financialSummary.passiveIncome)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-slate-500 text-xs mb-1">每月淨現金流</div>
                                                        <div className={cn(
                                                            "font-bold font-mono",
                                                            record.financialSummary.monthlyCashflow >= 0 ? "text-emerald-400" : "text-rose-400"
                                                        )}>
                                                            {formatMoney(record.financialSummary.monthlyCashflow)}
                                                        </div>
                                                    </div>
                                                    <div className="pt-2 border-t border-slate-800/50">
                                                        <div className="text-slate-500 text-xs mb-1">總資產</div>
                                                        <div className="text-blue-400 font-bold font-mono">{formatMoney(record.financialSummary.totalAssets)}</div>
                                                    </div>
                                                    <div className="pt-2 border-t border-slate-800/50">
                                                        <div className="text-slate-500 text-xs mb-1">總負債</div>
                                                        <div className="text-rose-400 font-bold font-mono">{formatMoney(record.financialSummary.totalLiabilities)}</div>
                                                    </div>
                                                </div>

                                                {/* Assets & Liabilities Lists */}
                                                <div className="space-y-4 pt-4 border-t border-slate-800">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Wallet className="text-blue-400" size={14} />
                                                            <span className="text-slate-300 text-sm font-bold">資產清單</span>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {record.gameStateSnapshot?.assets.map(asset => (
                                                                <div key={asset.id} className="flex justify-between items-center bg-slate-950/40 p-2 rounded border border-slate-800/50">
                                                                    <span className="text-slate-400 text-xs">{asset.name}</span>
                                                                    <span className="text-blue-400 text-xs font-mono">{formatMoney(asset.cost)}</span>
                                                                </div>
                                                            )) || <div className="text-slate-600 text-xs italic">無資產紀錄</div>}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <DollarSign className="text-rose-400" size={14} />
                                                            <span className="text-slate-300 text-sm font-bold">負債清單</span>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {record.gameStateSnapshot?.liabilities.map(liab => (
                                                                <div key={liab.id} className="flex justify-between items-center bg-slate-950/40 p-2 rounded border border-slate-800/50">
                                                                    <span className="text-slate-400 text-xs">{liab.name}</span>
                                                                    <span className="text-rose-400 text-xs font-mono">{formatMoney(liab.totalOwed)}</span>
                                                                </div>
                                                            )) || <div className="text-slate-600 text-xs italic">無負債紀錄</div>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>

                                            {/* Transaction History */}
                                            <Card className="bg-slate-900/80 border-slate-800 p-5 flex flex-col h-[500px]">
                                                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                                                    <History className="text-blue-400" size={18} />
                                                    <h3 className="text-white font-bold">對局交易歷史</h3>
                                                </div>
                                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                                    {record.gameStateSnapshot?.history.map((tx) => (
                                                        <div key={tx.id} className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/50 hover:border-slate-700 transition-colors">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <div className="font-bold text-slate-200 text-sm">{tx.name}</div>
                                                                <div className={cn(
                                                                    "text-xs font-bold font-mono",
                                                                    tx.cashChange >= 0 ? "text-emerald-400" : "text-rose-400"
                                                                )}>
                                                                    {tx.cashChange >= 0 ? "+" : ""}{formatMoney(tx.cashChange)}
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <div className="text-[10px] text-slate-500">{tx.sourceLabel} → {tx.usageLabel}</div>
                                                                <div className="text-[10px] text-slate-400 font-mono">餘額: {formatMoney(tx.balance)}</div>
                                                            </div>
                                                        </div>
                                                    )) || <div className="text-slate-600 text-center py-10 italic">無交易紀錄</div>}
                                                </div>
                                            </Card>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

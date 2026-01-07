import React, { useState, useEffect } from 'react';
import { Card, Button } from '../../components/ui/ui';
import {
    ArrowLeft,
    History as HistoryIcon,
    Users,
    ChevronDown,
    ChevronUp,
    Calendar,
    LayoutDashboard,
    TrendingUp,
    Trophy
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../../services/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { CoachRecord } from '../../types';
import { cn } from '../../utils/utils';

const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '未知日期') return '未知日期';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;

        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(/\//g, '-');
    } catch (e) {
        return dateStr;
    }
};

interface CoachHistoryViewProps {
    onBack: () => void;
}

export const CoachHistoryView: React.FC<CoachHistoryViewProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [records, setRecords] = useState<CoachRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

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
                                                    {record.players.map((player, idx) => (
                                                        <div key={idx} className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-xl flex items-center justify-between">
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
                                                    ))}
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
        </div>
    );
};

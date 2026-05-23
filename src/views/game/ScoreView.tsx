import React from 'react';
import { useGame } from '../../context/GameContext';
import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/ui';
import { calculateFinancialSummary, calculateScoreResult } from '../../utils/gameUtils';
import { Trophy, X, List, LogOut, Upload, CheckCircle2, AlertCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../services/firebase';
import { doc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { safeAsync } from '../../utils/utils';

interface ScoreViewProps {
    playerName: string;
    playerUid?: string;
    onClose: () => void;
    isInline?: boolean;
    showAchievements?: boolean; // 是否顯示成就通知（執行師結算時才顯示）
}

export const ScoreView: React.FC<ScoreViewProps> = ({ playerName, playerUid, onClose, isInline, showAchievements = false }) => {
    const { scoreResult: localScoreResult, setGameState } = useGame();
    const { leaveRoom, room, playerStates } = useRoom();

    // 成就通知狀態
    const [achievementQueue, setAchievementQueue] = React.useState<any[]>([]);
    const [visibleAchievements, setVisibleAchievements] = React.useState<any[]>([]);

    // 計算該玩家的積分 (如果是執行師端查看特定玩家)
    const displayScoreResult = React.useMemo(() => {
        if (playerUid && playerStates[playerUid]) {
            const state = playerStates[playerUid];
            const summary = calculateFinancialSummary(state);
            return calculateScoreResult(state, summary);
        }
        return localScoreResult;
    }, [playerUid, playerStates, localScoreResult]);

    // 初始化成就隊列（只在 showAchievements 為 true 時）
    React.useEffect(() => {
        if (!showAchievements || !displayScoreResult || isInline) return;

        // 使用 roomId 和 playerName 作為 key 來追蹤已顯示的成就
        const storageKey = `achievements_shown_${room?.id}_${playerName}`;
        const shownAchievements = localStorage.getItem(storageKey);

        // 如果已經顯示過，則不再顯示
        if (shownAchievements) return;

        const achievements = displayScoreResult.details
            .filter((d: any) => d.achieved && d.label !== '遊玩積分') // 過濾掉基礎積分
            .map((d: any, index: number) => ({
                id: `achievement-${index}-${d.label}`,
                label: d.label
            }));

        if (achievements.length > 0) {
            setAchievementQueue(achievements);
            // 標記為已顯示
            localStorage.setItem(storageKey, 'true');
        }
    }, [displayScoreResult, isInline, showAchievements, room?.id, playerName]);

    // 處理成就顯示邏輯
    React.useEffect(() => {
        if (achievementQueue.length > 0 && visibleAchievements.length < 6) {
            const timer = setTimeout(() => {
                const next = achievementQueue[0];
                if (!next) return;

                setAchievementQueue(prev => prev.slice(1));
                setVisibleAchievements(prev => [...prev, next]);

                // 3秒後移除
                setTimeout(() => {
                    setVisibleAchievements(prev => prev.filter(a => a.id !== next.id));
                }, 3000);
            }, 300); // 間隔 0.3 秒

            return () => clearTimeout(timer);
        }
    }, [achievementQueue, visibleAchievements]);

    const { user } = useAuth();
    const [showConfirm, setShowConfirm] = React.useState(false);
    const [isLeaving, setIsLeaving] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadStatus, setUploadStatus] = React.useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

    // 檢查 localStorage 是否已有紀錄，防止重新整理後按鈕恢復
    React.useEffect(() => {
        if (room?.id) {
            const isRecorded = localStorage.getItem(`score_recorded_${room.id}`);
            if (isRecorded) {
                setUploadStatus('success');
            }
        }
    }, [room?.id]);

    // 格式化時間 (分鐘)
    const formatDuration = (mins: number) => {
        return `${mins} 分鐘`;
    };

    const handleUploadScores = async () => {
        if (!room || !user || isUploading) return;

        setIsUploading(true);
        setUploadStatus('uploading');

        const playersData = Object.entries(playerStates).map(([uid, state]) => {
            const summary = calculateFinancialSummary(state);
            const result = calculateScoreResult(state, summary);

            // 確保 income 中包含 salary 欄位
            const income = { ...state.income };
            if (!income.salary && state.profession) {
                income.salary = state.profession.salary;
            }

            return {
                uid,
                name: state.playerName || 'Unknown',
                profession: state.profession?.title || 'Unknown',
                professionData: state.profession, // 儲存完整的職業對象供歷史紀錄還原
                happiness: state.happinessTotal,
                cash: state.cash,
                assets: state.assets || [],
                liabilities: state.liabilities || [],
                income: income,
                expenses: state.expenses || {},
                history: state.history || [],
                happinessItems: state.happiness || [],
                loans: state.loans || 0,
                totalScore: result.totalScore,
                summary: summary
            };
        });

        const playerUids = playersData.map(p => p.uid);
        // 使用房間 sessionId 作為唯一紀錄 ID，確保同一個房間 session 覆蓋更新
        const recordId = room.sessionId || `${room.id}_${room.createdAt?.seconds || Math.floor(Date.now() / 1000)}`;

        const scoreData = {
            roomId: room.id,
            roomName: room.name || '未命名房間',
            sessionId: recordId, // 增加 sessionId 方便追蹤
            settledAt: serverTimestamp(),
            gameTime: formatDuration(room.duration || 0),
            coach: user.name || 'Unknown Coach',
            coachId: user.uid || '', // 增加 coachId 方便查詢
            players: playersData,
            playerUids // 增加 playerUids 方便查詢
        };

        let attempts = 0;
        const maxAttempts = 3;

        const attemptUpload = async (): Promise<boolean> => {
            try {
                // 將資料儲存至 score_records/S1/records 集合中
                await safeAsync(setDoc(doc(db, 'score_records', 'S1', 'records', recordId), scoreData));

                // 2. 儲存執行師帶領紀錄 (coach_records)
                const coachRecord = {
                    date: new Date().toISOString(),
                    roomCode: room.id || 'UNKNOWN',
                    roomName: room.name || '未命名房間',
                    playerCount: playersData.length,
                    duration: room.duration || 0,
                    coachId: user?.uid || '',
                    coachName: user?.name || 'Unknown',
                    timestamp: Date.now(),
                    isFinal: true,
                    players: playersData.map(p => ({
                        name: p.name,
                        profession: p.profession,
                        happiness: p.happiness,
                        score: p.totalScore,
                        isWin: p.happiness >= 100
                    })),
                    updatedAt: serverTimestamp()
                };
                await safeAsync(setDoc(doc(db, 'coach_records', recordId), coachRecord));

                // 3. 更新每位玩家的累計積分 (experience) - 同一場只能加一次
                const scoreIncrementKey = `score_incremented_${recordId}`;
                if (!localStorage.getItem(scoreIncrementKey)) {
                    localStorage.setItem(scoreIncrementKey, 'true');
                    await Promise.all(playersData.map(async (player) => {
                        if (!player.uid) return;
                        const userRef = doc(db, 'users', player.uid);
                        try {
                            await safeAsync(updateDoc(userRef, {
                                experience: increment(player.totalScore),
                                rankScore: increment(player.totalScore)
                            }));
                        } catch (e) {
                            console.error(`Failed to update experience for user ${player.uid}`, e);
                        }
                    }));
                }

                return true;
            } catch (err) {
                console.error(`上傳嘗試 ${attempts + 1} 失敗:`, err);
                return false;
            }
        };

        while (attempts < maxAttempts) {
            const success = await attemptUpload();
            if (success) {
                setUploadStatus('success');
                setIsUploading(false);
                // 永久紀錄到本地，防止該房間重複點選
                if (room?.id) {
                    localStorage.setItem(`score_recorded_${room.id}`, 'true');
                }
                return;
            }
            attempts++;
            if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 等待 2 秒後重試
            }
        }

        setUploadStatus('error');
        setIsUploading(false);
    };

    const handleLeaveRoom = async () => {
        setIsLeaving(true);
        try {
            // 1. 執行離開房間邏輯
            await leaveRoom();

            // 2. 清理本地遊戲狀態，確保回到大廳時是乾淨的
            localStorage.removeItem('happiness_game_state');
            localStorage.removeItem('hf_practice_mode');
            setGameState({
                profession: null,
                selectedEnterprise: null,
                selectedDream: null,
                currentRankTitle: '',
                currentRankLevel: 1,
                cash: 0,
                children: 0,
                medicalInsuranceCount: 0,
                assets: [],
                liabilities: [],
                loans: 0,
                isSetup: false,
                selectionStep: null,
                history: [],
                happiness: [],
                happinessTotal: 0,
                marketPrices: {},
                previousMarketPrices: {},
                lastPublishedCode: '',
                abilities: {
                    stockAbilityCount: 0,
                    realEstateAbilityCount: 0,
                    professionAbilityCount: 0,
                },
                completedHappinessEvents: [],
                playerName: '',
                reportName: ''
            } as any);

            // 3. 觸發 onClose 回到大廳
            onClose();
        } catch (err) {
            console.error('離開房間失敗:', err);
            alert('離開房間失敗，請稍後再試');
        } finally {
            setIsLeaving(false);
            setShowConfirm(false);
        }
    };

    if (isInline) {
        return (
            <div className="w-full h-full flex flex-col overflow-hidden no-scrollbar bg-slate-900/50">
                <div className="shrink-0 p-6 bg-slate-800/40 border-b border-slate-500/30 text-center">
                    <Trophy size={40} className="mx-auto text-yellow-400 mb-2" />
                    <h2 className="text-2xl font-black text-white">遊戲結算</h2>
                    <p className="text-amber-400 font-mono text-xs mt-1">
                        {room?.name || '本次遊戲'} - {formatDuration(room?.duration || 0)}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-none no-scrollbar">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                            <List size={14} className="text-amber-400" /> 積分概覽 (當前選中: {playerName})
                        </h3>
                        <div className="space-y-2">
                            {displayScoreResult.details.map((detail, idx) => (
                                <div key={idx} className={`flex justify-between items-center text-xs py-3 border-b border-slate-700/50 last:border-0 ${detail.achieved ? 'text-slate-300' : 'text-slate-500'}`}>
                                    <div className="flex items-center gap-2">
                                        {detail.achieved ? (
                                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                                                <Check size={12} strokeWidth={3} />
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

                <div className="shrink-0 p-4 pt-0 flex justify-center">
                    <div className="bg-slate-800/90 rounded-2xl px-5 py-2 border border-amber-500/30 flex items-center gap-4 shadow-xl shadow-amber-900/20">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                                <Trophy size={14} />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">結算總分</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-amber-400 font-mono tracking-tighter">
                                {displayScoreResult.totalScore}
                            </span>
                            <span className="text-[8px] font-bold text-amber-500/40 uppercase">pts</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 relative pt-safe pb-safe">
            {/* 成就達成通知隊列 */}
            <div className="fixed top-4 mt-safe left-0 right-0 z-[1000] flex flex-col items-center gap-2 pointer-events-none">
                <AnimatePresence mode="popLayout">
                    {visibleAchievements.map((achievement) => (
                        <motion.div
                            key={achievement.id}
                            initial={{ opacity: 0, y: -20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            layout
                            className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-6 flex items-center h-[40px] shadow-lg"
                        >
                            <span className="text-white text-sm font-bold tracking-wide flex items-center gap-2">
                                <Trophy size={14} className="text-yellow-400" />
                                達成成就：{achievement.label}
                            </span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Custom Confirm Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-xs rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-4">
                            <div className="mx-auto w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500">
                                <LogOut size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">確定要離開？</h3>
                                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                                    離開後將回到大廳，且不會記錄本次遊戲積分。此操作無法撤銷。
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 pt-2">
                                <button
                                    disabled={isLeaving}
                                    onClick={handleLeaveRoom}
                                    className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-700 text-white font-black rounded-xl transition-all active:scale-95"
                                >
                                    {isLeaving ? '正在離開...' : '確認離開'}
                                </button>
                                <button
                                    disabled={isLeaving}
                                    onClick={() => setShowConfirm(false)}
                                    className="w-full py-3 text-slate-500 hover:text-white font-bold text-sm transition-colors"
                                >
                                    取消
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-lg w-full max-h-full flex flex-col py-4">
                <Card className="bg-slate-900 border-slate-500 shadow-2xl shadow-slate-500/10 flex flex-col overflow-hidden animate-in zoom-in-95 no-scrollbar relative min-h-0">
                    {/* Close Button at Top Right */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-full transition-all z-10"
                    >
                        <X size={24} />
                    </button>

                    <div className="shrink-0 p-6 bg-slate-800/40 border-b border-slate-500/30 text-center">
                        <Trophy size={40} className="mx-auto text-yellow-400 mb-2" />
                        <h2 className="text-2xl font-black text-white">遊戲評分</h2>
                        <p className="text-amber-400 font-mono text-xs mt-1">玩家: {playerName}</p>
                        <p className="text-slate-500 text-[10px] mt-2 italic">※ 遊戲紀錄將由執行師統一確認存檔</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 scrollbar-none no-scrollbar">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                                <List size={14} className="text-amber-400" /> 積分細項
                            </h3>
                            <div className="space-y-2">
                                {displayScoreResult.details.map((detail, idx) => (
                                    <div key={idx} className={`flex justify-between items-center text-xs py-3 border-b border-slate-700/50 last:border-0 ${detail.achieved ? 'text-slate-300' : 'text-slate-500'}`}>
                                        <div className="flex items-center gap-2">
                                            {detail.achieved ? (
                                                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                                                    <Check size={12} strokeWidth={3} />
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

                    {/* Fixed Bottom Section */}
                    <div className="shrink-0 p-6 pt-0 space-y-3">
                        {/* Total Score Display */}
                        <div className="bg-slate-800/80 rounded-2xl p-4 border border-amber-500/30 flex justify-between items-center shadow-lg shadow-amber-900/20 mt-auto">
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
                                    {displayScoreResult.totalScore}
                                </div>
                                <div className="text-[9px] font-black text-amber-500/40 mt-0.5 tracking-widest">POINTS</div>
                            </div>
                        </div>

                        {/* Buttons Area */}
                        <div className="space-y-3">
                            {/* Coach Only: Upload Button (練習模式不顯示) */}
                            {room?.hostId === user?.uid && (
                                localStorage.getItem('hf_practice_mode') === 'true' ? (
                                    <div className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-sm">
                                        <span>🧪</span>
                                        <span>練習模式・不計分・不留紀錄</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <button
                                            disabled={isUploading || uploadStatus === 'success'}
                                            onClick={handleUploadScores}
                                            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black transition-all active:scale-95 ${uploadStatus === 'success'
                                                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                                                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed'
                                                }`}
                                        >
                                            {isUploading ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    <span>正在上傳...</span>
                                                </div>
                                            ) : uploadStatus === 'success' ? (
                                                <>
                                                    <CheckCircle2 size={18} />
                                                    <span>紀錄成功</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload size={18} />
                                                    <span>儲存紀錄</span>
                                                </>
                                            )}
                                        </button>

                                        {uploadStatus === 'error' && (
                                            <p className="text-[10px] text-rose-400 flex items-center justify-center gap-1">
                                                <AlertCircle size={10} /> 上傳失敗，請重試
                                            </p>
                                        )}
                                    </div>
                                )
                            )}

                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

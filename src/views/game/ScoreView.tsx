import React, { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { Card, Button } from '../../components/ui/ui';
import { Trophy, Check, X, List } from 'lucide-react';
import { formatMoney } from '../../utils/gameUtils';
import { useGameLogic } from '../../hooks/useGameLogic';

interface ScoreViewProps {
    playerName: string;
    onBackToLobby: () => void;
}

export const ScoreView: React.FC<ScoreViewProps> = ({ playerName, onBackToLobby }) => {
    const { gameState, summary, scoreResult, clearAutoSave, resetGameState } = useGame();
    const { handleFinishGame } = useGameLogic();
    const [isSaving, setIsSaving] = useState(false);

    const handleConfirm = async () => {
        if (isSaving) return;
        
        setIsSaving(true);
        console.log('開始結算流程...');
        try {
            console.log('正在儲存遊戲紀錄...');
            await handleFinishGame({ playerName: playerName });
            console.log('遊戲紀錄儲存成功');

            console.log('正在清除自動存檔...');
            await clearAutoSave();
            console.log('自動存檔清除成功');

            console.log('正在重置遊戲狀態...');
            resetGameState();
            
            console.log('正在返回大廳...');
            onBackToLobby();
        } catch (error: any) {
            console.error('結算存檔過程中發生錯誤:', error);
            const errorMsg = error.message || '未知錯誤';
            alert(`存檔失敗：${errorMsg}\n請檢查 Firebase Rules 或網路連線`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-[100dvh] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden touch-none">
            <div className="max-w-lg w-full h-full flex flex-col py-4 overflow-hidden no-scrollbar">
                <Card className="bg-slate-900 border-slate-500 shadow-2xl shadow-slate-500/10 flex flex-col overflow-hidden animate-in zoom-in-95 no-scrollbar">
                    <div className="shrink-0 p-6 bg-slate-800/40 border-b border-slate-500/30 text-center">
                        <Trophy size={40} className="mx-auto text-yellow-400 mb-2" />
                        <h2 className="text-2xl font-black text-white">遊戲結算評分</h2>
                        <p className="text-amber-400 font-mono text-xs mt-1">玩家: {playerName}</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none no-scrollbar">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">最終總積分</p>
                                <div className="text-5xl font-black text-white">{scoreResult.totalScore}</div>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">幸福指數</p>
                                <div className="text-3xl font-black text-pink-500">{gameState.happinessTotal}</div>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                                <List size={14} className="text-amber-400" /> 積分細項
                            </h3>
                            <div className="space-y-2">
                                {scoreResult.details.map((detail, idx) => (
                                    <div key={idx} className={`flex justify-between items-center text-xs py-2 border-b border-slate-700/50 last:border-0 ${detail.achieved ? 'text-slate-300' : 'text-slate-600'}`}>
                                        <div className="flex items-center gap-2">
                                            {detail.achieved ? (
                                                <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                                                    <Check size={10} className="text-amber-500" />
                                                </div>
                                            ) : (
                                                <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                                    <X size={10} className="text-slate-700" />
                                                </div>
                                            )}
                                            {detail.label}
                                        </div>
                                        <span className={`font-bold ${detail.achieved ? 'text-emerald-400' : 'text-slate-700'}`}>+{detail.points}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">理財收入</p>
                                <p className="text-base font-black text-emerald-400">{formatMoney(summary.passiveIncome)}</p>
                            </div>
                            <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">總資產</p>
                                <p className="text-base font-black text-blue-400">{formatMoney(summary.totalAssets)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 p-4 bg-slate-900 border-t border-slate-800">
                        <Button 
                            className="w-full py-3 text-lg font-black bg-amber-600 hover:bg-amber-500 shadow-xl shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed" 
                            onClick={handleConfirm}
                            disabled={isSaving}
                        >
                            {isSaving ? '正在儲存...' : '確認並存檔'}
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

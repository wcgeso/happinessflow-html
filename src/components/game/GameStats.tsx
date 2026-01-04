import React from 'react';
import { Heart, Wallet, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { Card } from '../ui/ui';
import { formatMoney, cn } from '../../utils/gameUtils';

interface GameStatsProps {
    gameState: any;
    summary: any;
    onOpenHappiness: () => void;
}

export const GameStats: React.FC<GameStatsProps> = ({ gameState, summary, onOpenHappiness }) => {
    return (
        <div className="w-full">
            {/* Happiness Card */}
            <Card className="p-5 relative overflow-hidden bg-slate-900 border-slate-700 cursor-pointer hover:border-pink-500/50 transition-all group min-h-[120px]" onClick={onOpenHappiness}>
                <div className="relative z-10 flex flex-col justify-between h-full">
                    <div>
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2"> 
                            <Heart size={14} className="text-pink-500" />
                            幸福指數
                        </h3>
                        <div className="flex items-baseline gap-2 mb-2">
                            <div className="text-5xl font-black text-white tracking-tighter"> {gameState.happinessTotal} </div>
                            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1"> / 100 </div>
                        </div>
                        <div className="w-full max-w-md bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="h-full bg-pink-500 transition-all duration-1000" style={{ width: `${Math.min((gameState.happinessTotal / 100) * 100, 100)}%` }} />
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-2 uppercase tracking-[0.3em]"> 邁向幸福人生 </div>
                </div>
                <div className="absolute right-6 top-2 flex flex-col items-center group-hover:scale-110 transition-transform duration-500 mt-1">
                    {/* 增加父容器尺寸並取消 overflow，確保光暈有足夠空間擴散 */}
                    <div className="relative w-24 h-24 flex items-center justify-center">
                        {/* 1. 底層呼吸光暈 - 調整 drop-shadow 範圍 */}
                        {gameState.happinessTotal > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center animate-pulse duration-[3000ms]">
                                <Heart 
                                    size={70} 
                                    className="text-pink-500/40 fill-pink-500/40" 
                                    style={{ filter: 'drop-shadow(0 0 15px rgba(236, 72, 153, 0.7))' }}
                                    strokeWidth={0} 
                                />
                            </div>
                        )}

                        {/* 2. 背景空心層 */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Heart size={70} className="text-slate-700/30" strokeWidth={1.5} />
                        </div>
                        
                        {/* 3. 顏色填充層 - 確保內部容器寬度足夠，不截斷水平向的光暈 */}
                        <div 
                            className="absolute bottom-0 left-0 w-full transition-all duration-1000 ease-out z-10" 
                            style={{ 
                                height: `${Math.min((gameState.happinessTotal / 100) * 100, 100)}%`,
                                overflow: 'hidden' 
                            }}
                        >
                            <div className="absolute bottom-0 left-0 w-24 h-24 flex items-center justify-center">
                                <Heart 
                                    size={70} 
                                    className="text-pink-500 fill-pink-500" 
                                    style={{ filter: 'drop-shadow(0 0 8px rgba(236, 72, 153, 0.4))' }}
                                    strokeWidth={1} 
                                />
                            </div>
                        </div>

                        {/* 4. 頂層光澤 */}
                        <div className="absolute top-7 left-9 w-3 h-2 bg-white/30 rounded-full blur-[1px] z-20 rotate-[-20deg]" />
                    </div>
                </div>
            </Card>
        </div>
    );
};

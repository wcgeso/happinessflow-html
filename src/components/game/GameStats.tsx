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
            <Card className="p-6 relative overflow-hidden bg-slate-900 border-slate-700 cursor-pointer hover:border-pink-500/50 transition-all group min-h-[140px]" onClick={onOpenHappiness}>
                <div className="relative z-10 flex flex-col justify-between h-full">
                    <div>
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2"> 
                            <Heart size={14} className="text-pink-500" />
                            幸福指數
                        </h3>
                        <div className="flex items-baseline gap-2 mb-3">
                            <div className="text-6xl font-black text-white tracking-tighter"> {gameState.happinessTotal} </div>
                            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1"> / 100 </div>
                        </div>
                        <div className="w-full max-w-md bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="h-full bg-pink-500 transition-all duration-1000" style={{ width: `${Math.min((gameState.happinessTotal / 100) * 100, 100)}%` }} />
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-4 uppercase tracking-[0.3em]"> 邁向圓滿人生 </div>
                </div>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
                    <div className="relative w-24 h-24">
                        <Heart size={96} className="text-slate-600/20 absolute inset-0 z-10" strokeWidth={1} />
                        <div className="absolute bottom-0 left-0 w-full overflow-hidden transition-all duration-1000 ease-out z-0" style={{ height: `${Math.min((gameState.happinessTotal / 100) * 100, 100)}%` }}>
                            <div className="absolute bottom-0 left-0 w-24 h-24">
                                <Heart size={96} className="text-pink-500 fill-pink-500 drop-shadow-[0_0_20px_rgba(236,72,153,0.4)]" strokeWidth={1} />
                            </div>
                        </div>
                    </div>
                    <div className="px-3 py-1 bg-pink-500/10 rounded-full border border-pink-500/20 shadow-lg shadow-pink-500/5">
                        <span className="text-xs font-black text-pink-500 font-mono">
                            {Math.min((gameState.happinessTotal / 100) * 100, 100).toFixed(0)}%
                        </span>
                    </div>
                </div>
            </Card>
        </div>
    );
};

import React, { useState } from 'react';
import { Star, Plane, GraduationCap, Trophy, TrendingUp, Wallet, BarChart3, PieChart, Landmark, HelpCircle } from 'lucide-react';
import { Button } from '../ui/ui';
import { getProfessionIcon } from '../common/IconHelpers';
import { cn, formatMoney } from '../../utils/gameUtils';
import { StockMarketModal } from '../transaction/StockMarketModal';

interface GameHeaderProps {
    gameState: any;
    summary: any;
    onShowRankList: () => void;
    onShowPromotion: () => void;
    onFinishGame: () => void;
    onShowStockMarket: () => void;
    onShowTutorial: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({ 
    gameState, 
    summary,
    onShowRankList, 
    onShowPromotion, 
    onFinishGame,
    onShowStockMarket,
    onShowTutorial
}) => {
    const [showAircraftTooltip, setShowAircraftTooltip] = useState(false);
    const hasAircraft = gameState.assets.some((a: any) => a.type === '飛行器');
    const netAssets = summary.totalAssets - summary.totalLiabilities;

    return (
        <header className="fixed top-0 left-0 right-0 z-40 flex flex-col">
            {/* Top Bar */}
            <div className="relative z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 shadow-md">
                <div className="max-w-7xl mx-auto flex items-center justify-between relative">
                    <div className="flex items-center gap-3">
                        {gameState.profession && (
                            <>
                                <div
                                    className="w-9 h-9 rounded-full bg-slate-800 border-2 border-yellow-500 flex items-center justify-center cursor-pointer hover:border-yellow-400 transition-colors"
                                    onClick={onShowRankList}
                                >
                                    {getProfessionIcon(gameState.profession.id, { size: 18, className: "text-yellow-400" })}
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-0.5">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Star
                                                key={i}
                                                size={10}
                                                className={cn(i < gameState.currentRankLevel ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600')}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[10px] text-slate-400 leading-none mt-0.5">{gameState.currentRankTitle}</span>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex gap-1 items-center h-8">
                        <Button
                            onClick={onShowTutorial}
                            className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-500 text-white border-none shadow-lg shadow-blue-900/40 flex items-center justify-center shrink-0 transition-all active:scale-95"
                            title="遊戲教學"
                        >
                            <span className="text-lg font-black leading-none select-none">?</span>
                        </Button>
                        <div className="relative h-8 w-8 cursor-pointer hover:scale-105 transition-transform shrink-0">
                            <div
                                className={cn("w-full h-full flex items-center justify-center rounded-lg shadow-lg transition-colors text-white shadow-indigo-500/20", hasAircraft ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-600 hover:bg-slate-500')}
                                onMouseEnter={() => setShowAircraftTooltip(true)}
                                onMouseLeave={() => setShowAircraftTooltip(false)}
                            >
                                <Plane size={14} className={!hasAircraft ? 'text-slate-300' : 'text-white'} />
                            </div>
                            {showAircraftTooltip && (
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-40 bg-slate-800 text-white text-xs p-3 rounded border border-slate-600 z-[100] shadow-xl animate-in fade-in zoom-in-95 pointer-events-none">
                                    <div className="relative">
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-slate-800"></div>
                                        {hasAircraft ? '遊玩時可擲兩顆骰子' : '尚未擁有飛行器'}
                                    </div>
                                </div>
                            )}
                        </div>
                        <Button
                            onClick={onShowStockMarket}
                            className="h-8 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 shadow-lg text-[10px] px-2 flex items-center gap-1 shrink-0"
                        >
                            <TrendingUp size={12} />
                            <span className="font-bold whitespace-nowrap">股市</span>
                        </Button>
                        <Button onClick={onFinishGame} className="h-8 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] px-2 flex items-center gap-1 shrink-0 shadow-lg shadow-yellow-900/20">
                            <Trophy size={12} />
                            <span className="font-bold whitespace-nowrap">結算</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="relative z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 px-4 py-2 shadow-inner">
                <div className="max-w-7xl mx-auto grid grid-cols-2 gap-2">
                    {/* 現金 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800/50">
                        <div className="p-1.5 bg-blue-500/10 rounded-md shrink-0">
                            <Wallet size={14} className="text-blue-400" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter leading-none">現金</span>
                            <span className="text-sm font-black text-white leading-tight truncate">{formatMoney(gameState.cash)}</span>
                        </div>
                    </div>

                    {/* 理財收入 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800/50">
                        <div className="p-1.5 bg-emerald-500/10 rounded-md shrink-0">
                            <Landmark size={14} className="text-emerald-400" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter leading-none">理財收入</span>
                            <span className="text-sm font-black text-emerald-400 leading-tight truncate">+{formatMoney(summary.passiveIncome)}</span>
                        </div>
                    </div>

                    {/* 月結餘 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800/50">
                        <div className="p-1.5 bg-purple-500/10 rounded-md shrink-0">
                            <BarChart3 size={14} className="text-purple-400" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter leading-none">月結餘</span>
                            <span className={cn(
                                "text-sm font-black leading-tight truncate",
                                summary.monthlyCashflow >= 0 ? "text-emerald-400" : "text-rose-400"
                            )}>
                                {summary.monthlyCashflow >= 0 ? "+" : ""}{formatMoney(summary.monthlyCashflow)}
                            </span>
                        </div>
                    </div>

                    {/* 淨資產 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800/50">
                        <div className="p-1.5 bg-amber-500/10 rounded-md shrink-0">
                            <PieChart size={14} className="text-amber-400" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter leading-none">淨資產</span>
                            <span className={cn(
                                "text-sm font-black leading-tight truncate",
                                netAssets >= 0 ? "text-blue-400" : "text-rose-400"
                            )}>
                                {formatMoney(netAssets)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

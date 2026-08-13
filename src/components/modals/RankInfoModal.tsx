import React from 'react';
import { X, Trophy, Star } from 'lucide-react';

interface RankInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTitle?: string;
    currentRole?: 'coach' | 'player' | 'gm';
    currentExperience?: number;
}

const PLAYER_RANKS = [
    {
        title: '尋夢者',
        minXP: 0,
        maxXP: 49,
        badge: '/assets/badges/尋夢者-去背.png',
        color: 'text-amber-500/80',
        glow: '',
        border: 'border-slate-700',
        bg: 'bg-slate-800/40',
        activeBg: 'bg-slate-800/80',
        dotColor: 'bg-slate-500',
        description: '踏上第二人生之旅的起點',
        xpLabel: '起始位階',
    },
    {
        title: '採蜜人',
        minXP: 50,
        maxXP: 199,
        badge: '/assets/badges/採蜜人-去背.png',
        color: 'text-emerald-400',
        glow: '',
        border: 'border-emerald-500/40',
        bg: 'bg-emerald-500/5',
        activeBg: 'bg-emerald-500/15',
        dotColor: 'bg-emerald-500',
        description: '辛勤採蜜，累積財富的播種者',
        xpLabel: '50 積分',
    },
    {
        title: '築夢家',
        minXP: 200,
        maxXP: 499,
        badge: '/assets/badges/築夢家-去背.png',
        color: 'text-cyan-400',
        glow: 'drop-shadow-[0_0_6px_rgba(34,211,238,0.4)]',
        border: 'border-cyan-500/40',
        bg: 'bg-cyan-500/5',
        activeBg: 'bg-cyan-500/15',
        dotColor: 'bg-cyan-400',
        description: '以智慧與努力建構幸福藍圖',
        xpLabel: '200 積分',
    },
    {
        title: '蜂饒大師',
        minXP: 500,
        maxXP: 999,
        badge: '/assets/badges/蜂饒大師-去背.png',
        color: 'text-purple-400',
        glow: 'drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]',
        border: 'border-purple-500/40',
        bg: 'bg-purple-500/5',
        activeBg: 'bg-purple-500/15',
        dotColor: 'bg-purple-400',
        description: '掌握財富之道，豐饒人生的掌舵者',
        xpLabel: '500 積分',
    },
    {
        title: '蜂后傳奇',
        minXP: 1000,
        maxXP: null,
        badge: '/assets/badges/蜂后傳奇-去背.png',
        color: 'text-amber-400',
        glow: 'drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]',
        border: 'border-amber-400/40',
        bg: 'bg-amber-500/5',
        activeBg: 'bg-amber-500/15',
        dotColor: 'bg-amber-400',
        description: '傳說中的蜂富領袖，幸福人生的最高象徵',
        xpLabel: '1000 積分',
    },
    {
        title: '幸福實踐家',
        minXP: null,
        maxXP: null,
        badge: '/assets/badges/幸福實踐家-去背.png',
        color: 'text-rose-400',
        glow: 'drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]',
        border: 'border-rose-500/40',
        bg: 'bg-rose-500/5',
        activeBg: 'bg-rose-500/15',
        dotColor: 'bg-rose-500',
        description: '由系統特別授予的最高榮譽稱號',
        xpLabel: '特殊榮譽',
        special: true,
    },
];

const COACH_RANKS = [
    {
        title: '執行師',
        minGames: 0,
        maxGames: 19,
        badge: '/assets/badges/蜂富執行師-去背.png',
        color: 'text-amber-500',
        glow: 'drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]',
        border: 'border-amber-500/40',
        bg: 'bg-amber-500/5',
        activeBg: 'bg-amber-500/15',
        dotColor: 'bg-amber-500',
        description: '認證執行師，帶領玩家踏上蜂富之旅',
        gamesLabel: '認證執行師',
    },
    {
        title: '資深執行師',
        minGames: 20,
        maxGames: 39,
        badge: '/assets/badges/資深執行師-去背.png',
        color: 'text-amber-400',
        glow: 'drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]',
        border: 'border-amber-400/40',
        bg: 'bg-amber-500/5',
        activeBg: 'bg-amber-500/15',
        dotColor: 'bg-amber-400',
        description: '經驗豐富的執行師，深得玩家信賴',
        gamesLabel: '執行 20 場',
    },
    {
        title: '傳奇執行師',
        minGames: 40,
        maxGames: null,
        badge: '/assets/badges/傳奇執行師-去背.png',
        color: 'text-yellow-300',
        glow: 'drop-shadow-[0_0_10px_rgba(253,224,71,0.6)]',
        border: 'border-yellow-400/50',
        bg: 'bg-yellow-500/5',
        activeBg: 'bg-yellow-500/15',
        dotColor: 'bg-yellow-400',
        description: '執行師中的傳奇，最頂尖的幸福引導者',
        gamesLabel: '執行 40 場',
    },
];

export const RankInfoModal: React.FC<RankInfoModalProps> = ({
    isOpen,
    onClose,
    currentTitle,
    currentRole,
    currentExperience = 0,
}) => {
    if (!isOpen) return null;

    const isCoach = currentRole === 'coach' || currentRole === 'gm';

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950 animate-in slide-in-from-right-full duration-300">
            {/* Header */}
            <div className="flex-shrink-0 pt-safe px-5 py-4 flex items-center gap-4 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center">
                        <Trophy size={16} className="text-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-white tracking-tight">位階系統</h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Rank System</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-lg mx-auto px-5 py-6 space-y-8 pb-safe">

                    {/* Player Ranks Section */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-6 h-6 bg-rose-500/20 rounded-lg flex items-center justify-center">
                                <Star size={13} className="text-rose-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-white">玩家位階</h2>
                                <p className="text-[10px] text-slate-500 font-bold">以累積賽季積分解鎖</p>
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            {PLAYER_RANKS.map((rank, idx) => {
                                const isCurrent = currentTitle === rank.title;

                                return (
                                    <div
                                        key={rank.title}
                                        className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all ${isCurrent
                                            ? `${rank.activeBg} ${rank.border} shadow-lg`
                                            : `${rank.bg} ${rank.border}`
                                            }`}
                                    >
                                        {/* Badge Image */}
                                        <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center">
                                            <img
                                                src={rank.badge}
                                                alt={rank.title}
                                                className={`w-full h-full object-contain transition-all ${rank.glow}`}
                                            />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                <span className={`text-base font-black ${rank.color}`}>
                                                    {rank.title}
                                                </span>
                                                {isCurrent && (
                                                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider ${rank.color} bg-white/10 border border-current`}>
                                                        目前位階
                                                    </span>
                                                )}
                                                {rank.special && (
                                                    <span className="px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/30">
                                                        特殊
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] font-medium mb-2 text-slate-400">
                                                {rank.description}
                                            </p>
                                            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${isCurrent ? `${rank.color} bg-white/10` : `${rank.color} bg-white/5`}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${rank.dotColor}`} />
                                                {rank.xpLabel}
                                            </div>
                                        </div>

                                        {/* Progress for current */}
                                        {isCurrent && !rank.special && rank.maxXP !== null && (
                                            <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-slate-800 rounded-full overflow-hidden mb-0">
                                                <div
                                                    className={`h-full rounded-full transition-all ${rank.dotColor}`}
                                                    style={{
                                                        width: `${Math.min(100, ((currentExperience - (rank.minXP ?? 0)) / ((rank.maxXP ?? currentExperience) - (rank.minXP ?? 0))) * 100)}%`
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-slate-800" />

                    {/* Coach Ranks Section */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-6 h-6 bg-amber-500/20 rounded-lg flex items-center justify-center">
                                <Trophy size={13} className="text-amber-500" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-white">執行師位階</h2>
                                <p className="text-[10px] text-slate-500 font-bold">執行師專屬，以執行場次累積</p>
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            {COACH_RANKS.map((rank) => {
                                const isCurrent = isCoach && currentTitle === rank.title;

                                return (
                                    <div
                                        key={rank.title}
                                        className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all ${isCurrent
                                            ? `${rank.activeBg} ${rank.border} shadow-lg`
                                            : `${rank.bg} ${rank.border}`
                                            }`}
                                    >
                                        {/* Badge Image */}
                                        <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center">
                                            <img
                                                src={rank.badge}
                                                alt={rank.title}
                                                className={`w-full h-full object-contain transition-all ${rank.glow}`}
                                            />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                <span className={`text-base font-black ${rank.color}`}>
                                                    {rank.title}
                                                </span>
                                                {isCurrent && (
                                                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider ${rank.color} bg-white/10 border border-current`}>
                                                        目前位階
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] font-medium mb-2 text-slate-400">
                                                {rank.description}
                                            </p>
                                            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${isCurrent ? `${rank.color} bg-white/10` : `${rank.color} bg-white/5`}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${rank.dotColor}`} />
                                                {rank.gamesLabel}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

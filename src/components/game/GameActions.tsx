import React from 'react';
import { CirclePlus, Dices, Target, Landmark } from 'lucide-react';

interface GameActionsProps {
    onRollBoardDice?: () => void;
    onShowMedical: () => void;
    onShowTransaction: () => void;
    onShowPayday: () => void;
    onShowSettlement: () => void;
    onShowTargetDream: () => void;
    isBoardTurn?: boolean;
    isRollingBoardDice?: boolean;
    hasCar?: boolean;
    disabled?: boolean;
}

export const GameActions: React.FC<GameActionsProps> = ({
    onRollBoardDice,
    onShowMedical,
    onShowTransaction,
    onShowPayday,
    onShowSettlement,
    onShowTargetDream,
    isBoardTurn = false,
    isRollingBoardDice = false,
    hasCar = false,
    disabled = false,
}) => {
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 mb-safe">
            {/* 目標與夢想 */}
            <button
                onClick={onShowTargetDream}
                disabled={disabled}
                className={`group relative flex flex-col items-center gap-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                title={disabled ? "遊戲已結算" : "購買目標與夢想"}
            >
                <div className="w-12 h-12 bg-gradient-to-br from-fuchsia-400 to-fuchsia-600 text-white rounded-full shadow-[0_8px_20px_-6px_rgba(217,70,239,0.5)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-110 group-enabled:hover:-translate-y-1 group-active:scale-95 border-2 border-white/20">
                    <Target size={24} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-wider transition-all group-enabled:group-hover:text-fuchsia-300">目標夢想</span>
            </button>

            {/* 中間主按鈕：棋盤模式 → 擲骰子；一般模式 → 數位銀行 */}
            {onRollBoardDice ? (
                <button
                    onClick={onRollBoardDice}
                    disabled={disabled || !isBoardTurn || isRollingBoardDice}
                    className={`group relative flex flex-col items-center gap-2 ${disabled || !isBoardTurn ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                    title={!isBoardTurn ? "尚未輪到你" : (isRollingBoardDice ? "同步中..." : `擲骰${hasCar ? ' (2顆)' : ' (1顆)'}`)}
                >
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-sky-600 text-white rounded-full shadow-[0_10px_25px_-8px_rgba(34,211,238,0.6)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-110 group-enabled:hover:-translate-y-1 group-active:scale-95 border-2 border-white/30">
                        <Dices size={32} strokeWidth={2.5} />
                    </div>
                    <span className="text-[11px] font-black text-cyan-300 uppercase tracking-widest transition-all group-enabled:group-hover:text-cyan-200">
                        {isRollingBoardDice ? '同步中' : '擲骰子'}
                    </span>
                </button>
            ) : (
                <button
                    onClick={onShowTransaction}
                    disabled={disabled}
                    className={`group relative flex flex-col items-center gap-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                    title={disabled ? "遊戲已結算" : "數位銀行"}
                >
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-full shadow-[0_10px_25px_-8px_rgba(16,185,129,0.6)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-110 group-enabled:hover:-translate-y-1 group-active:scale-95 border-2 border-white/30">
                        <Landmark size={32} strokeWidth={2.5} />
                    </div>
                    <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest transition-all group-enabled:group-hover:text-emerald-300">數位銀行</span>
                </button>
            )}

            {/* 棋盤模式有擲骰時，右邊額外顯示數位銀行小按鈕 */}
            {onRollBoardDice && (
                <button
                    onClick={onShowTransaction}
                    disabled={disabled}
                    className={`group relative flex flex-col items-center gap-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                    title={disabled ? "遊戲已結算" : "數位銀行"}
                >
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-full shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-110 group-enabled:hover:-translate-y-1 group-active:scale-95 border-2 border-white/20">
                        <Landmark size={24} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider transition-all group-enabled:group-hover:text-emerald-300">數位銀行</span>
                </button>
            )}
        </div>
    );
};


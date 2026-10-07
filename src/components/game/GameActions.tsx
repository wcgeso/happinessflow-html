import React, { useState, useEffect } from 'react';
import { CirclePlus, Dices, Target, Landmark, Building, CheckCircle2 } from 'lucide-react';

interface GameActionsProps {
    onRollBoardDice?: (diceCount?: 1 | 2) => Promise<any> | void;
    onRollAnimationComplete?: (result: any) => void;
    onBuyRealEstate?: () => void;
    onShowMedical: () => void;
    onShowTransaction: () => void;
    onShowPayday: () => void;
    onShowSettlement: () => void;
    onShowTargetDream: () => void;
    onShowRealEstateMarket?: () => void;
    onEndTurn?: () => void;
    canRoll?: boolean;
    canEndTurn?: boolean;
    rollBlockReason?: string | null;
    endTurnBlockReason?: string | null;
    hasRolledBoardDice?: boolean;
    isBoardTurn?: boolean;
    isRollingBoardDice?: boolean;
    isEndingTurn?: boolean;
    hasCar?: boolean;
    disabled?: boolean;
}

const GameActionsBase: React.FC<GameActionsProps> = ({
    onRollBoardDice,
    onRollAnimationComplete,
    onShowMedical,
    onShowTransaction,
    onShowPayday,
    onShowSettlement,
    onShowTargetDream,
    onShowRealEstateMarket,
    onEndTurn,
    canRoll = false,
    canEndTurn = false,
    rollBlockReason = null,
    endTurnBlockReason = null,
    hasRolledBoardDice = false,
    isBoardTurn = false,
    isRollingBoardDice = false,
    isEndingTurn = false,
    hasCar = false,
    disabled = false,
}) => {
    const [isAnimating, setIsAnimating] = useState(false);
    const [showEndTurnReminder, setShowEndTurnReminder] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 640);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (!isBoardTurn || !hasRolledBoardDice) setIsAnimating(false);
    }, [hasRolledBoardDice, isBoardTurn]);
    useEffect(() => { if (!isRollingBoardDice) setIsAnimating(false); }, [isRollingBoardDice]);

    const tz = isMobile ? '26px' : '32px';
    const tagTz = isMobile ? '31px' : '39px';

    // 將結果固定在正面，落地時仍保留完整六面骰體，不切換成平面圖。
    const getDiceFaces = (result: number | null) => {
        const front = Math.min(6, Math.max(1, result || 5));
        const back = 7 - front;
        const others = [1, 2, 3, 4, 5, 6].filter(n => n !== front && n !== back);
        return {
            front,
            back,
            right: others[0],
            left: others[1],
            bottom: others[2],
            top: others[3]
        };
    };
    const isActive = isBoardTurn && canRoll && !isRollingBoardDice && !isAnimating && !disabled;
    const shouldShowEndTurn = !!(onEndTurn && hasRolledBoardDice);
    const visibleBlockReason = shouldShowEndTurn ? endTurnBlockReason : rollBlockReason;
    const isVisualActive = isActive || isAnimating;

    useEffect(() => {
        if (!shouldShowEndTurn || !canEndTurn || disabled || isEndingTurn) {
            setShowEndTurnReminder(false);
            return;
        }
        setShowEndTurnReminder(false);
        const reminderTimer = window.setTimeout(() => setShowEndTurnReminder(true), 10000);
        return () => window.clearTimeout(reminderTimer);
    }, [canEndTurn, disabled, isEndingTurn, shouldShowEndTurn]);

    // 汽車仍保留單骰／雙骰選擇，但玩家端只顯示一顆主骰，避免兩顆骰子擠在按鈕內。
    const visibleDiceCount = 1;
    const faceBg = isVisualActive 
        ? "bg-gradient-to-br from-white via-[#f8fafc] to-[#d7dee5] border-white/90 shadow-[inset_5px_5px_10px_rgba(255,255,255,0.95),inset_-7px_-8px_12px_rgba(71,85,105,0.24),0_5px_0_rgba(100,116,139,0.72),0_12px_16px_rgba(15,23,42,0.34)]"
        : "bg-gradient-to-br from-[#e7f0ed] via-[#c8d9d4] to-[#91aaa3] border-[#dce9e5]/80 shadow-[inset_5px_5px_10px_rgba(255,255,255,0.5),inset_-7px_-8px_12px_rgba(46,101,112,0.3),0_5px_0_rgba(82,111,104,0.75),0_12px_16px_rgba(15,45,52,0.38)]";
    const coreBg = isVisualActive ? 'bg-[#dce6e3]' : 'bg-[#9fb9b2]';
    const dotBg = isVisualActive ? "bg-slate-800" : "bg-[#5d766f]";
    const dot1Bg = isVisualActive ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-[#9a6a5a]";

    const renderDots = (num: number) => {
        switch (num) {
            case 1:
                return <div className={`w-4 h-4 rounded-full ${dot1Bg}`} />;
            case 2:
                return (
                    <div className="w-full h-full p-2.5 flex justify-between">
                        <div className={`w-2.5 h-2.5 rounded-full self-start ${dotBg}`}/>
                        <div className={`w-2.5 h-2.5 rounded-full self-end ${dotBg}`}/>
                    </div>
                );
            case 3:
                return (
                    <div className="w-full h-full p-2.5 flex flex-col justify-between">
                        <div className={`w-2.5 h-2.5 rounded-full self-start ${dotBg}`}/>
                        <div className={`w-2.5 h-2.5 rounded-full self-center ${dotBg}`}/>
                        <div className={`w-2.5 h-2.5 rounded-full self-end ${dotBg}`}/>
                    </div>
                );
            case 4:
                return (
                    <div className="w-full h-full p-2.5 grid grid-cols-2 grid-rows-2 gap-2 place-items-center">
                        <div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                        <div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                        <div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                        <div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                    </div>
                );
            case 5:
                return (
                    <div className="relative w-full h-full">
                        <div className={`absolute top-2.5 left-2.5 w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                        <div className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                        <div className={`absolute bottom-2.5 left-2.5 w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                        <div className={`absolute bottom-2.5 right-2.5 w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                    </div>
                );
            case 6:
                return (
                    <div className="w-full h-full p-2.5 flex justify-between">
                        <div className="flex flex-col justify-between"><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/></div>
                        <div className="flex flex-col justify-between"><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/></div>
                    </div>
                );
            default:
                if (num > 6) {
                    return <span className={`text-[32px] font-black ${isVisualActive ? 'text-slate-800' : 'text-[#5d766f]'}`}>{num}</span>;
                }
                return null;
        }
    };

    const renderDie = (result: number, index: number) => {
        const faces = getDiceFaces(result);
        const faceBase = "absolute inset-0 flex items-center justify-center overflow-hidden rounded-[11px] border sm:rounded-[14px]";
        return (
            <div
                key={`die-${index}`}
                data-testid="board-die"
                data-die-value={result}
                className="relative h-[52px] w-[52px] drop-shadow-[0_10px_8px_rgba(6,21,27,0.32)] sm:h-[64px] sm:w-[64px]"
                style={{ transformStyle: 'preserve-3d' }}
            >
                <div className="absolute inset-0 h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
                    <div className={`absolute inset-0 rounded-[11px] sm:rounded-[14px] ${coreBg}`} style={{ transform: 'translateZ(0)' }} />
                    <div className={`${faceBase} ${faceBg}`} style={{ transform: `translateZ(${tz})`, backfaceVisibility: 'hidden' }}>{renderDots(faces.front)}</div>
                    <div className={`${faceBase} ${faceBg} brightness-75`} style={{ transform: `rotateY(180deg) translateZ(${tz})`, backfaceVisibility: 'hidden' }}>{renderDots(faces.back)}</div>
                    <div className={`${faceBase} ${faceBg} brightness-90`} style={{ transform: `rotateY(90deg) translateZ(${tz})`, backfaceVisibility: 'hidden' }}>{renderDots(faces.right)}</div>
                    <div className={`${faceBase} ${faceBg} brightness-75`} style={{ transform: `rotateY(-90deg) translateZ(${tz})`, backfaceVisibility: 'hidden' }}>{renderDots(faces.left)}</div>
                    <div className={`${faceBase} ${faceBg} brightness-[.65]`} style={{ transform: `rotateX(90deg) translateZ(${tz})`, backfaceVisibility: 'hidden' }}>{renderDots(faces.bottom)}</div>
                    <div className={`${faceBase} ${faceBg} brightness-110`} style={{ transform: `rotateX(-90deg) translateZ(${tz})`, backfaceVisibility: 'hidden' }}>{renderDots(faces.top)}</div>
                </div>
            </div>
        );
    };

    const handleDiceClick = async () => {
        if (!isActive || !onRollBoardDice) return;

        setIsAnimating(true);
        let rollResult: { total: number; dice: number[] } | void;
        try {
            rollResult = await onRollBoardDice(hasCar ? 2 : 1);
        } catch {
            setIsAnimating(false);
            return;
        }

        if (!rollResult || typeof rollResult.total !== 'number') {
            setIsAnimating(false);
            return;
        }

        // 玩家只送出一次擲骰指令；骰點與動畫由大螢幕依房間事件播放。
        onRollAnimationComplete?.(rollResult);
        if (!onRollAnimationComplete) setIsAnimating(false);
    };


    return (
        <div className="fixed bottom-8 left-0 right-0 z-[90] pointer-events-none">
            {/* Dock 容器 */}
            <div className="pointer-events-none mx-auto w-full max-w-xl px-2">
                <div className="flex items-end justify-center gap-1.5 px-2 pt-4 sm:gap-3 sm:px-5 sm:pt-5">
                    {/* 左側：房市公告板 */}
                    {onShowRealEstateMarket && (
                        <button
                            onClick={onShowRealEstateMarket}
                            disabled={disabled}
                            aria-label="開啟房市公告板"
                            className={`pointer-events-auto group relative flex flex-col items-center gap-1 sm:gap-1.5 px-1 sm:px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                            title={disabled ? "遊戲已結算" : "房市公告板"}
                        >
                            <div className="w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] rounded-[14px] border border-[#d8c29a] bg-[#f4e6d0] text-[#a9643a] shadow-[0_8px_16px_-10px_rgba(16,47,56,0.45)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-active:scale-95 sm:rounded-[18px]">
                                <Building size={20} strokeWidth={2} className="sm:hidden" /><Building size={24} strokeWidth={2} className="hidden sm:block" />
                            </div>
                            <span className="text-[10px] font-black text-[#fffaf2] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] transition-colors group-enabled:group-hover:text-[#f0c85c]">房市</span>
                        </button>
                    )}

                    {/* 左側：目標與夢想 */}
                    <button
                        onClick={onShowTargetDream}
                        disabled={disabled}
                        aria-label="開啟目標與夢想"
                        className={`pointer-events-auto group relative flex flex-col items-center gap-1 sm:gap-1.5 px-1 sm:px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                        title={disabled ? "遊戲已結算" : "購買目標與夢想"}
                    >
                        <div className="w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] rounded-[14px] border border-[#d8c29a] bg-[#f4e6d0] text-[#a9643a] shadow-[0_8px_16px_-10px_rgba(16,47,56,0.45)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-active:scale-95 sm:rounded-[18px]">
                            <Target size={20} strokeWidth={2} className="sm:hidden" /><Target size={24} strokeWidth={2} className="hidden sm:block" />
                        </div>
                        <span className="text-[10px] font-black text-[#fffaf2] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] transition-colors group-enabled:group-hover:text-[#f0c85c]">目標</span>
                    </button>

                    {/* 中央主按鈕：擲骰子 / 數位銀行 */}
                    <div className="pointer-events-auto px-2 pb-1 relative" style={{ perspective: '700px' }}>
                        {onRollBoardDice ? (
                            shouldShowEndTurn ? (
                            <div className="relative flex flex-col items-center gap-1">
                                <button
                                    onClick={onEndTurn}
                                    disabled={disabled || !canEndTurn || isEndingTurn}
                                    aria-label="結束回合"
                                    className={`group relative flex flex-col items-center gap-2 ${canEndTurn && !isEndingTurn ? 'rounded-2xl ring-4 ring-[#f0c85c]/35' : ''} ${(disabled || !canEndTurn) ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                                    title={!isBoardTurn ? '尚未輪到你' : (canEndTurn ? '本回合已完成，點擊結束回合換下一位玩家' : '請先完成目前的棋盤事件')}
                                >
                                    <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border-2 border-[#d8c29a] bg-gradient-to-br from-[#d6a94e] to-[#a9643a] text-white shadow-[0_12px_24px_-10px_rgba(169,100,58,0.55)] transition-all duration-300 group-enabled:hover:-translate-y-1 group-enabled:hover:scale-105 group-active:scale-95 sm:h-[64px] sm:w-[64px] sm:rounded-[18px]">
                                        <CheckCircle2 size={26} strokeWidth={2.5} className="sm:hidden" /><CheckCircle2 size={32} strokeWidth={2.5} className="hidden sm:block" />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-[#f0c85c] drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{isEndingTurn ? '提交中' : canEndTurn ? '完成，結束回合' : '結束回合'}</span>
                                </button>
                                {showEndTurnReminder && canEndTurn && !isEndingTurn && (
                                    <span className="absolute bottom-full mb-2 w-36 rounded-xl border border-[#d8c29a] bg-[#fffaf2] px-2 py-1.5 text-center text-[10px] font-black leading-tight text-[#2e6570] shadow-lg">
                                        本回合已完成，請點擊結束回合
                                    </span>
                                )}
                            </div>
                            ) : (
                            <div className="relative flex flex-col items-center gap-2">
                                {/* 向上引導動畫 (輪到自己時顯示) */}
                                {/* 發光底圖 */}
                                {isActive && !isAnimating && (
                                    <div
                                        className="absolute inset-0 rounded-full bg-[#5da58e] blur-2xl opacity-30 z-0"
                                    />
                                )}

                                <button
                                    type="button"
                                    onClick={handleDiceClick}
                                    disabled={!isActive}
                                    aria-label={isRollingBoardDice ? '骰子同步中' : (isBoardTurn ? `擲骰子${hasCar ? '，使用2顆' : ''}` : '尚未輪到你擲骰子')}
                                    style={{ touchAction: "manipulation" }}
                                    className={`relative z-10 min-h-[52px] sm:min-h-[64px] transition-transform duration-200 ${isActive ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-not-allowed'} ${!isVisualActive ? 'opacity-100' : ''}`}
                                    title={!isBoardTurn ? "尚未輪到你" : (isRollingBoardDice ? "同步中..." : `點擊拋擲 (${hasCar ? '2顆' : '1顆'})`)}
                                >
                                    <div className="relative flex w-[52px] items-center justify-center gap-2 sm:w-[64px]">
                                        {Array.from({ length: visibleDiceCount }, () => 5).map(renderDie)}

                                        {hasCar && (
                                            <div
                                                className="absolute -top-3 -right-3 w-7 h-7 rounded-full border-2 border-[#293a38] bg-[#f0c85c] flex items-center justify-center shadow-sm"
                                                style={{ transform: `translateZ(${tagTz})` }}
                                                title="持有汽車時使用雙骰"
                                            >
                                                <span className="text-[10px] font-black text-[#604721] leading-none tracking-tighter">x2</span>
	                                    </div>
                                        )}
                                    </div>
                                </button>
                                <span className={`text-[11px] font-black uppercase tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] transition-colors ${
                                    isActive ? 'text-[#fffaf2]' : 'text-[#b9aa98]'
                                }`}>
                                    {isRollingBoardDice ? '同步中' : (isBoardTurn ? `點擊拋擲${hasCar ? ' (2顆)' : ''}` : '擲骰子')}
                                </span>
                            </div>
                            )
                        ) : (
                            <button
                                onClick={onShowTransaction}
                                disabled={disabled}
                                aria-label="開啟數位銀行"
                                className={`group relative flex flex-col items-center gap-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                                title={disabled ? "遊戲已結算" : "數位銀行"}
                            >
                                <div className="relative w-[72px] h-[72px] rounded-[24px] border-2 border-[#d8c29a] bg-gradient-to-br from-[#5da58e] to-[#2e6570] text-white shadow-[0_12px_24px_-8px_rgba(46,101,112,0.55)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-active:scale-95">
                                    <Landmark size={36} strokeWidth={2} className="drop-shadow-md" />
                                </div>
                                <span className="text-[11px] font-black text-[#fffaf2] uppercase tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">數位銀行</span>
                            </button>
                        )}
                        {onRollBoardDice && visibleBlockReason && !isAnimating && (
                            <div
                                role="status"
                                className="absolute bottom-[-1.4rem] left-1/2 w-[220px] -translate-x-1/2 text-center text-[10px] font-bold leading-tight text-[#f0c85c] drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                            >
                                {visibleBlockReason}
                            </div>
                        )}
                    </div>

                    {/* 右側：數位銀行 (如果在棋盤模式下) */}
                    {onRollBoardDice && (
                        <button
                            onClick={onShowTransaction}
                            disabled={disabled}
                            aria-label="開啟數位銀行"
                            className={`pointer-events-auto group relative flex flex-col items-center gap-1 sm:gap-1.5 px-1 sm:px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                            title={disabled ? "遊戲已結算" : "數位銀行"}
                        >
                            <div className="w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] rounded-[14px] border border-[#d8c29a] bg-[#e0f0e5] text-[#2e6570] shadow-[0_8px_16px_-10px_rgba(16,47,56,0.45)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-active:scale-95 sm:rounded-[18px]">
                                <Landmark size={20} strokeWidth={2} className="sm:hidden" /><Landmark size={24} strokeWidth={2} className="hidden sm:block" />
                            </div>
                            <span className="text-[10px] font-black text-[#fffaf2] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] transition-colors group-enabled:group-hover:text-[#b9d9d0]">銀行</span>
                        </button>
                    )}

                    {/* 右側：醫療理賠 */}
                    <button
                        onClick={onShowMedical}
                        disabled={disabled}
                        aria-label="開啟醫療理賠"
                        className={`pointer-events-auto group relative flex flex-col items-center gap-1 sm:gap-1.5 px-1 sm:px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                        title={disabled ? "遊戲已結算" : "醫療理賠"}
                    >
                        <div className="w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] rounded-[14px] border border-[#d8c29a] bg-[#f5d9d0] text-[#b6544b] shadow-[0_8px_16px_-10px_rgba(16,47,56,0.45)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-active:scale-95 sm:rounded-[18px]">
                            <CirclePlus size={20} strokeWidth={2} className="sm:hidden" /><CirclePlus size={24} strokeWidth={2} className="hidden sm:block" />
                        </div>
                        <span className="text-[10px] font-black text-[#fffaf2] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] transition-colors group-enabled:group-hover:text-[#f5d9d0]">醫療</span>
                    </button>

                </div>
            </div>
        </div>
    );
};

// Memoized: the game view re-renders on every room update; this subtree only when its props change.
export const GameActions = React.memo(GameActionsBase);

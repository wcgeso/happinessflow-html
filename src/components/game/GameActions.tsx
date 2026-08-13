import React, { useRef, useState, useEffect } from 'react';
import { CirclePlus, Dices, Target, Landmark, Building, CheckCircle2 } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';

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
    hasCar?: boolean;
    disabled?: boolean;
}

export const GameActions: React.FC<GameActionsProps> = ({
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
    hasCar = false,
    disabled = false,
}) => {
    const diceControls = useAnimation();
    const [isAnimating, setIsAnimating] = useState(false);
    const [diceResults, setDiceResults] = useState<number[]>([]);
    const [selectedDiceCount, setSelectedDiceCount] = useState<1 | 2>(hasCar ? 2 : 1);
    const landingFaceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const animationCompleteTimerRef = useRef<NodeJS.Timeout | null>(null);
    const DICE_ROLL_DURATION_MS = 3500;
    const DICE_RESULT_REVEAL_MS = 850;
    const idleDiceRotation = { rotateX: -18, rotateY: 22, rotateZ: 0 };

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
        setSelectedDiceCount(hasCar ? 2 : 1);
    }, [hasCar]);

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
    const isActive = isBoardTurn && canRoll && !isRollingBoardDice && !disabled;
    const shouldShowEndTurn = !!(onEndTurn && hasRolledBoardDice && !isRollingBoardDice);
    const visibleBlockReason = shouldShowEndTurn ? endTurnBlockReason : rollBlockReason;
    const isVisualActive = isActive || isAnimating;
    const visibleDiceCount = diceResults.length > 0 ? diceResults.length : selectedDiceCount;
    const faceBg = isVisualActive 
        ? "bg-gradient-to-br from-white to-slate-100 border-slate-300 shadow-[inset_0_0_15px_rgba(0,0,0,0.05)]" 
        : "bg-gradient-to-br from-[#d8e5e0] to-[#a9c0ba] border-[#829f97] shadow-[inset_0_0_15px_rgba(46,101,112,0.18)]";
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

    // 當擲骰結束 (或是換人回合時)，強制將骰子重置回手上
    useEffect(() => {
        if (!isRollingBoardDice) {
            if (landingFaceTimerRef.current) {
                clearTimeout(landingFaceTimerRef.current);
                landingFaceTimerRef.current = null;
            }
            if (animationCompleteTimerRef.current) {
                clearTimeout(animationCompleteTimerRef.current);
                animationCompleteTimerRef.current = null;
            }
            diceControls.stop(); // 停止所有進行中的動畫(包含延遲消失)
            diceControls.set({ x: 0, y: 0, z: 0, scale: 1, opacity: 1, ...idleDiceRotation });
            setIsAnimating(false);
            setDiceResults([]);
        }
    }, [isRollingBoardDice, diceControls]);

    useEffect(() => {
        return () => {
            if (landingFaceTimerRef.current) clearTimeout(landingFaceTimerRef.current);
            if (animationCompleteTimerRef.current) clearTimeout(animationCompleteTimerRef.current);
        };
    }, []);

    const showResultWhenLanded = () => {
        if (landingFaceTimerRef.current) clearTimeout(landingFaceTimerRef.current);
        landingFaceTimerRef.current = setTimeout(() => {
            diceControls.set(idleDiceRotation);
            landingFaceTimerRef.current = null;
        }, DICE_RESULT_REVEAL_MS);
    };

    const getRollingRotation = (spinSeed: number) => {
        const spinX = (Math.floor(Math.random() * 2) + 2) * 360;
        const spinY = (Math.floor(Math.random() * 2) + 2) * 360;
        const spinZ = spinSeed + (Math.random() * 180 + 180);

        return {
            rotateX: [0, spinX * 0.35, spinX, spinX * 1.08, 0, 0, 0, 0, 0],
            rotateY: [0, spinY * 0.4, spinY, spinY * 1.12, 0, 0, 0, 0, 0],
            rotateZ: [0, spinZ * 0.5, spinZ, spinZ * 1.1, 0, 0, 0, 0, 0],
        };
    };

    const renderDie = (result: number, index: number) => {
        const faces = getDiceFaces(result);
        const faceBase = "absolute inset-0 flex items-center justify-center overflow-hidden rounded-[6px]";
        return (
            <div key={`die-${index}`} className="relative h-[52px] w-[52px] sm:h-[64px] sm:w-[64px]" style={{ transformStyle: 'preserve-3d' }}>
                <div className="absolute inset-0 h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
                    <div className={`absolute inset-0 ${coreBg}`} style={{ transform: 'translateZ(0)' }} />
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
            rollResult = await onRollBoardDice(hasCar ? selectedDiceCount : 1);
        } catch (e) {
            setIsAnimating(false);
            return;
        }

        if (!rollResult || typeof rollResult.total !== 'number') {
            setIsAnimating(false);
            return;
        }

        const actualDice = Array.isArray(rollResult.dice) && rollResult.dice.length > 0
            ? rollResult.dice
            : [rollResult.total];
        setDiceResults(actualDice);
        showResultWhenLanded();

        const targetX = (Math.random() - 0.5) * 150;
        const apexY = -250;
        const landY = -100;
        const rollingRotation = getRollingRotation(360);

        diceControls.start({
            x: [0, targetX * 0.5, targetX, targetX * 1.05, targetX, targetX * 1.02, targetX, targetX, targetX],
            y: [0, apexY, landY, landY - 40, landY, landY - 15, landY, landY, landY],
            z: [0, -100, -300, -300, -300, -300, -300, -300, -300],
            scale: [1, 1.2, 0.58, 0.5, 0.58, 0.52, 0.5, 0.5, 0.5],
            ...rollingRotation,
            transition: {
                duration: DICE_ROLL_DURATION_MS / 1000,
                times: [0, 0.12, 0.22, 0.3, 0.35, 0.42, 0.5, 0.88, 1],
                ease: ["easeOut", "easeIn", "easeOut", "easeIn", "easeOut", "easeIn", "linear", "easeInOut"]
            }
        });

        animationCompleteTimerRef.current = setTimeout(() => {
            if (onRollAnimationComplete) {
                onRollAnimationComplete(rollResult);
            }
            animationCompleteTimerRef.current = null;
        }, DICE_ROLL_DURATION_MS);
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
                            <button
                                onClick={onEndTurn}
                                disabled={disabled || !canEndTurn}
                                aria-label="結束回合"
                                className={`group relative flex flex-col items-center gap-2 ${(disabled || !canEndTurn) ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                                title={!isBoardTurn ? '尚未輪到你' : (canEndTurn ? '結束回合，換下一位玩家' : '請先完成目前的棋盤事件')}
                            >
                                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border-2 border-[#d8c29a] bg-gradient-to-br from-[#d6a94e] to-[#a9643a] text-white shadow-[0_12px_24px_-10px_rgba(169,100,58,0.55)] transition-all duration-300 group-enabled:hover:-translate-y-1 group-enabled:hover:scale-105 group-active:scale-95 sm:h-[64px] sm:w-[64px] sm:rounded-[18px]">
                                    <CheckCircle2 size={26} strokeWidth={2.5} className="sm:hidden" /><CheckCircle2 size={32} strokeWidth={2.5} className="hidden sm:block" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-widest text-[#f0c85c] drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">結束回合</span>
                            </button>
                            ) : (
                            <div className="relative flex flex-col items-center gap-2">
                                {/* 向上引導動畫 (輪到自己時顯示) */}
                                {/* 發光底圖 */}
                                {isActive && !isAnimating && (
                                    <motion.div
                                        className="absolute inset-0 rounded-full bg-[#5da58e] blur-2xl opacity-30 z-0"
                                        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                    />
                                )}

                                <motion.button
                                    animate={diceControls}
                                    initial={{ x: 0, y: 0, z: 0, scale: 1, opacity: 1, ...idleDiceRotation }}
                                    whileHover={isActive ? { scale: 1.05 } : {}}
                                    whileTap={isActive ? { scale: 0.95 } : {}}
                                    onClick={handleDiceClick}
                                    aria-label={isRollingBoardDice ? '骰子同步中' : (isBoardTurn ? `擲骰子${hasCar ? `，目前選擇${selectedDiceCount}顆` : ''}` : '尚未輪到你擲骰子')}
                                    style={{ touchAction: "manipulation", transformStyle: "preserve-3d" }}
                                    className={`relative z-10 min-h-[52px] sm:min-h-[64px] ${!isVisualActive ? 'opacity-100 cursor-not-allowed' : 'cursor-pointer'}`}
                                    title={!isBoardTurn ? "尚未輪到你" : (isRollingBoardDice ? "同步中..." : `點擊拋擲 (${hasCar ? `${selectedDiceCount}顆` : '1顆'})`)}
                                >
                                    <div className={`relative flex items-center justify-center gap-2 ${visibleDiceCount === 2 ? 'w-[112px] sm:w-[136px]' : 'w-[52px] sm:w-[64px]'}`} style={{ transformStyle: 'preserve-3d' }}>
	                                        {(diceResults.length > 0 ? diceResults : Array.from({ length: selectedDiceCount }, () => 5)).map(renderDie)}

	                                        {hasCar && isVisualActive && (
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    if (!isActive) return;
                                                    setSelectedDiceCount(prev => prev === 2 ? 1 : 2);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key !== 'Enter' && event.key !== ' ') return;
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    if (!isActive) return;
                                                    setSelectedDiceCount(prev => prev === 2 ? 1 : 2);
                                                }}
                                                className="absolute -top-3 -right-3 w-7 h-7 rounded-full border-2 border-[#293a38] bg-[#f0c85c] flex items-center justify-center shadow-sm"
                                                style={{ transform: `translateZ(${tagTz})` }}
                                                title={isActive ? '點一下切換單骰 / 雙骰' : '持有汽車時可切換單骰 / 雙骰'}
                                            >
                                                <span className="text-[10px] font-black text-[#604721] leading-none tracking-tighter">x{selectedDiceCount}</span>
	                                    </div>
                                        )}
                                    </div>
                                </motion.button>
                                <span className={`text-[11px] font-black uppercase tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] transition-colors ${
                                    isActive ? 'text-[#fffaf2]' : 'text-[#b9aa98]'
                                }`}>
                                    {isRollingBoardDice ? '同步中' : (isBoardTurn ? `點擊拋擲${hasCar ? ` (${selectedDiceCount}顆)` : ''}` : '擲骰子')}
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

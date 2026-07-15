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
    const [diceResult, setDiceResult] = useState<number | null>(null);
    const [showLandingFace, setShowLandingFace] = useState(false);
    const [selectedDiceCount, setSelectedDiceCount] = useState<1 | 2>(hasCar ? 2 : 1);
    const landingFaceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const animationCompleteTimerRef = useRef<NodeJS.Timeout | null>(null);
    const shouldShowLandingFace = isAnimating && showLandingFace && diceResult !== null;
    const DICE_ROLL_DURATION_MS = 2400;
    const DICE_RESULT_REVEAL_MS = 850;

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

    const tz = isMobile ? '25px' : '31px';
    const tagTz = isMobile ? '31px' : '39px';

    // 根據結果動態分配骰子面，確保 Top 面永遠是骰出的點數
    const getDiceFaces = (result: number | null) => {
        const top = result || 5; // 預設 Top 是 5
        const bottom = 7 - top;
        const others = [1, 2, 3, 4, 5, 6].filter(n => n !== top && n !== bottom);
        return {
            front: others[0],
            back: others[1],
            right: others[2],
            left: others[3],
            bottom: bottom,
            top: top
        };
    };
    const faces = getDiceFaces(diceResult);

    const isActive = isBoardTurn && canRoll && !isRollingBoardDice && !disabled;
    const shouldShowEndTurn = !!(onEndTurn && hasRolledBoardDice && !isRollingBoardDice);
    const visibleBlockReason = shouldShowEndTurn ? endTurnBlockReason : rollBlockReason;
    const isVisualActive = isActive || isAnimating;
    const faceBg = isVisualActive 
        ? "bg-gradient-to-br from-white to-slate-100 border-slate-300 shadow-[inset_0_0_15px_rgba(0,0,0,0.05)]" 
        : "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]";
    const dotBg = isVisualActive ? "bg-slate-800" : "bg-slate-950";
    const dot1Bg = isVisualActive ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-slate-950";

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
                    return <span className={`text-[32px] font-black ${isVisualActive ? 'text-slate-800' : 'text-slate-950'}`}>{num}</span>;
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
            diceControls.set({ x: 0, y: 0, z: 0, scale: 1, opacity: 1, rotateX: -15, rotateY: 15, rotateZ: 0 });
            setIsAnimating(false);
            setShowLandingFace(false);
            setDiceResult(null);
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
        setShowLandingFace(false);
        landingFaceTimerRef.current = setTimeout(() => {
            diceControls.set({ rotateX: 0, rotateY: 0, rotateZ: 0 });
            setShowLandingFace(true);
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

        const actualDiceTotal = rollResult.total;
        setDiceResult(actualDiceTotal);
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
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-safe">
            {/* Dock 容器 */}
            <div className="mx-auto w-fit pointer-events-auto">
                <div className="flex items-end gap-1.5 sm:gap-3 px-3 sm:px-6 pb-6 pt-8">
                    {/* 左側：房市公告板 */}
                    {onShowRealEstateMarket && (
                        <button
                            onClick={onShowRealEstateMarket}
                            disabled={disabled}
                            aria-label="開啟房市公告板"
                            className={`group relative flex flex-col items-center gap-1 sm:gap-1.5 px-1 sm:px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                            title={disabled ? "遊戲已結算" : "房市公告板"}
                        >
                            <div className="w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] bg-gradient-to-br from-slate-800 to-slate-900 text-amber-400 rounded-[14px] sm:rounded-[18px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-enabled:hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] group-active:scale-95 border border-slate-700">
                                <Building size={20} strokeWidth={2} className="sm:hidden" /><Building size={24} strokeWidth={2} className="hidden sm:block" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 tracking-wider transition-colors group-enabled:group-hover:text-amber-400">房市</span>
                        </button>
                    )}

                    {/* 左側：目標與夢想 */}
                    <button
                        onClick={onShowTargetDream}
                        disabled={disabled}
                        aria-label="開啟目標與夢想"
                        className={`group relative flex flex-col items-center gap-1 sm:gap-1.5 px-1 sm:px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                        title={disabled ? "遊戲已結算" : "購買目標與夢想"}
                    >
                        <div className="w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-400 rounded-[14px] sm:rounded-[18px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-enabled:hover:shadow-[0_0_20px_rgba(217,70,239,0.2)] group-active:scale-95 border border-slate-700">
                            <Target size={20} strokeWidth={2} className="sm:hidden" /><Target size={24} strokeWidth={2} className="hidden sm:block" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 tracking-wider transition-colors group-enabled:group-hover:text-fuchsia-400">目標</span>
                    </button>

                    {/* 中央主按鈕：擲骰子 / 數位銀行 */}
                    <div className="px-2 pb-1 relative" style={{ perspective: '1000px' }}>
                        {onRollBoardDice ? (
                            shouldShowEndTurn ? (
                            <button
                                onClick={onEndTurn}
                                disabled={disabled || !canEndTurn}
                                aria-label="結束回合"
                                className={`group relative flex flex-col items-center gap-2 ${(disabled || !canEndTurn) ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                                title={!isBoardTurn ? '尚未輪到你' : (canEndTurn ? '結束回合，換下一位玩家' : '請先完成目前的棋盤事件')}
                            >
                                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border-2 border-amber-300/60 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_12px_24px_-8px_rgba(245,158,11,0.6),inset_0_2px_4px_rgba(255,255,255,0.4)] transition-all duration-300 group-enabled:hover:-translate-y-1 group-enabled:hover:scale-105 group-active:scale-95 sm:h-[64px] sm:w-[64px] sm:rounded-[18px]">
                                    <CheckCircle2 size={26} strokeWidth={2.5} className="sm:hidden" /><CheckCircle2 size={32} strokeWidth={2.5} className="hidden sm:block" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]">結束回合</span>
                            </button>
                            ) : (
                            <div className="relative flex flex-col items-center gap-2">
                                {/* 向上引導動畫 (輪到自己時顯示) */}
                                {/* 發光底圖 */}
                                {isActive && !isAnimating && (
                                    <motion.div
                                        className="absolute inset-0 bg-cyan-500 rounded-full blur-2xl opacity-30 z-0"
                                        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                    />
                                )}

                                <motion.button
                                    animate={diceControls}
                                    initial={{ x: 0, y: 0, z: 0, rotateX: -15, rotateY: 15, rotateZ: 0 }}
                                    whileHover={isActive ? { scale: 1.05 } : {}}
                                    whileTap={isActive ? { scale: 0.95 } : {}}
                                    onClick={handleDiceClick}
                                    aria-label={isRollingBoardDice ? '骰子同步中' : (isBoardTurn ? `擲骰子${hasCar ? `，目前選擇${selectedDiceCount}顆` : ''}` : '尚未輪到你擲骰子')}
                                    style={{ touchAction: "manipulation", transformStyle: "preserve-3d" }}
                                    className={`relative z-10 w-[52px] h-[52px] sm:w-[64px] sm:h-[64px] ${!isVisualActive ? 'opacity-50 cursor-not-allowed filter grayscale-[0.5]' : 'cursor-pointer'}`}
                                    title={!isBoardTurn ? "尚未輪到你" : (isRollingBoardDice ? "同步中..." : `點擊拋擲 (${hasCar ? `${selectedDiceCount}顆` : '1顆'})`)}
                                >
		                                    {/* 飛行中保留六面骰體，落地後只顯示單一結果面。 */}
		                                    <div className="absolute inset-0 w-full h-full" style={{ transformStyle: shouldShowLandingFace ? "flat" : "preserve-3d" }}>
	                                            {shouldShowLandingFace ? (
                                                <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`}>
                                                    {renderDots(diceResult)}
                                                </div>
                                            ) : (
                                                <>
                                                    <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: `translateZ(${tz})` }}>
                                                        {renderDots(faces.front)}
                                                    </div>
                                                    <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: `rotateY(180deg) translateZ(${tz})` }}>
                                                        {renderDots(faces.back)}
                                                    </div>
                                                    <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: `rotateY(90deg) translateZ(${tz})` }}>
                                                        {renderDots(faces.right)}
                                                    </div>
                                                    <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: `rotateY(-90deg) translateZ(${tz})` }}>
                                                        {renderDots(faces.left)}
                                                    </div>
                                                    <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: `rotateX(90deg) translateZ(${tz})` }}>
                                                        {renderDots(faces.bottom)}
                                                    </div>
                                                    <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: `rotateX(-90deg) translateZ(${tz})` }}>
                                                        {renderDots(faces.top)}
                                                    </div>
                                                </>
                                            )}

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
                                                className="absolute -top-3 -right-3 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm"
                                                style={{ transform: `translateZ(${tagTz})` }}
                                                title={isActive ? '點一下切換單骰 / 雙骰' : '持有汽車時可切換單骰 / 雙骰'}
                                            >
                                                <span className="text-[10px] font-black text-amber-900 leading-none tracking-tighter">x{selectedDiceCount}</span>
                                            </div>
                                        )}
                                    </div>
                                </motion.button>
                                <span className={`text-[11px] font-black uppercase tracking-widest transition-colors ${
                                    isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-slate-500'
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
                                <div className="relative w-[72px] h-[72px] bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-[24px] shadow-[0_12px_24px_-8px_rgba(16,185,129,0.6),inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-active:scale-95 border-2 border-white/40">
                                    <Landmark size={36} strokeWidth={2} className="drop-shadow-md" />
                                </div>
                                <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">數位銀行</span>
                            </button>
                        )}
                        {onRollBoardDice && visibleBlockReason && !isAnimating && (
                            <div
                                role="status"
                                className="absolute bottom-[-1.4rem] left-1/2 w-[220px] -translate-x-1/2 text-center text-[10px] font-bold leading-tight text-amber-200/90"
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
                            className={`group relative flex flex-col items-center gap-1 sm:gap-1.5 px-1 sm:px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                            title={disabled ? "遊戲已結算" : "數位銀行"}
                        >
                            <div className="w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] bg-gradient-to-br from-slate-800 to-slate-900 text-emerald-400 rounded-[14px] sm:rounded-[18px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-enabled:hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] group-active:scale-95 border border-slate-700">
                                <Landmark size={20} strokeWidth={2} className="sm:hidden" /><Landmark size={24} strokeWidth={2} className="hidden sm:block" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 tracking-wider transition-colors group-enabled:group-hover:text-emerald-400">銀行</span>
                        </button>
                    )}

                    {/* 右側：醫療理賠 */}
                    <button
                        onClick={onShowMedical}
                        disabled={disabled}
                        aria-label="開啟醫療理賠"
                        className={`group relative flex flex-col items-center gap-1 sm:gap-1.5 px-1 sm:px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                        title={disabled ? "遊戲已結算" : "醫療理賠"}
                    >
                        <div className="w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] bg-gradient-to-br from-slate-800 to-slate-900 text-rose-400 rounded-[14px] sm:rounded-[18px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-enabled:hover:shadow-[0_0_20px_rgba(244,63,94,0.2)] group-active:scale-95 border border-slate-700">
                            <CirclePlus size={20} strokeWidth={2} className="sm:hidden" /><CirclePlus size={24} strokeWidth={2} className="hidden sm:block" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 tracking-wider transition-colors group-enabled:group-hover:text-rose-400">醫療</span>
                    </button>

                </div>
            </div>
        </div>
    );
};

import React, { useRef, useState, useEffect } from 'react';
import { CirclePlus, Dices, Target, Landmark, Building, ChevronUp } from 'lucide-react';
import { motion, useAnimation, useDragControls, PanInfo } from 'framer-motion';

interface GameActionsProps {
    onRollBoardDice?: () => void;
    onShowMedical: () => void;
    onShowTransaction: () => void;
    onShowPayday: () => void;
    onShowSettlement: () => void;
    onShowTargetDream: () => void;
    onShowRealEstateMarket?: () => void;
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
    onShowRealEstateMarket,
    isBoardTurn = false,
    isRollingBoardDice = false,
    hasCar = false,
    disabled = false,
}) => {
    const diceControls = useAnimation();
    const dragControls = useDragControls();
    const [isDragging, setIsDragging] = useState(false);

    // 當擲骰結束 (或是換人回合時)，強制將骰子重置回手上
    useEffect(() => {
        if (!isRollingBoardDice) {
            diceControls.stop(); // 停止所有進行中的動畫(包含延遲消失)
            diceControls.set({ x: 0, y: 0, z: 0, scale: 1, opacity: 1, rotateX: -15, rotateY: 15, rotateZ: 0 });
        }
    }, [isRollingBoardDice, diceControls]);

    const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsDragging(false);
        
        const distance = Math.sqrt(info.offset.x ** 2 + info.offset.y ** 2);
        const speed = Math.sqrt(info.velocity.x ** 2 + info.velocity.y ** 2);

        // 只要滑動距離超過 30px 或速度夠快，且輪到該玩家，就判定為丟出 (不限方向)
        if ((distance > 30 || speed > 200) && isBoardTurn && !isRollingBoardDice && !disabled && onRollBoardDice) {
            
            // 根據滑動向量計算丟出去的目標位置
            const dirX = info.offset.x;
            const dirY = info.offset.y;
            
            // 基礎飛行距離與高度
            const targetX = dirX * 3;
            const apexY = Math.min(dirY * 2, -200); // 最高點
            const landY = apexY + 150; // 落地點 (比最高點低)

            // 減緩旋轉速度：從原本 720+ 降到 360+ (約 1~1.5 圈)，更真實
            const rotX = (-dirY * 2) + (Math.random() * 180 + 360);
            const rotY = (dirX * 2) + (Math.random() * 180 + 360);
            const rotZ = (dirX + dirY) + (Math.random() * 180 + 180);

            // 將「拋物線彈跳」與「延遲淡出」合併為單一動畫，防止瀏覽器在切換動畫時壓扁 3D 圖層
            diceControls.start({
                x: [0, targetX * 0.5, targetX, targetX * 1.05, targetX, targetX * 1.02, targetX, targetX, targetX],
                y: [0, apexY, landY, landY - 40, landY, landY - 15, landY, landY, landY], 
                z: [0, -100, -300, -300, -300, -300, -300, -300, -300], 
                scale: [1, 1.2, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4], 
                opacity: [1, 1, 1, 1, 1, 1, 1, 1, 0], 
                rotateX: [0, rotX * 0.5, rotX, rotX + 30, rotX + 30, rotX + 35, rotX + 35, rotX + 35, rotX + 35],
                rotateY: [0, rotY * 0.5, rotY, rotY + 15, rotY + 15, rotY + 20, rotY + 20, rotY + 20, rotY + 20],
                rotateZ: [0, rotZ * 0.5, rotZ, rotZ + 10, rotZ + 10, rotZ + 15, rotZ + 15, rotZ + 15, rotZ + 15],
                transition: { 
                    duration: 3.5, // 總時長 3.5 秒 (包含落地停留的 2 秒)
                    // 0~1.2s 是飛行與彈跳, 1.2s~3.2s 是靜止, 3.2s~3.5s 是淡出消失
                    times: [0, 0.1, 0.2, 0.26, 0.29, 0.33, 0.35, 0.91, 1], 
                    ease: ["easeOut", "easeIn", "easeOut", "easeIn", "easeOut", "easeIn", "linear", "easeInOut"] 
                }
            });
            
            // 延遲觸發擲骰邏輯，讓玩家欣賞一下彈跳
            setTimeout(() => {
                onRollBoardDice();
            }, 600);
        } else {
            // 沒滑到位，彈回原位
            diceControls.start({
                x: 0,
                y: 0,
                z: 0,
                scale: 1,
                opacity: 1,
                rotateX: -15,
                rotateY: 15,
                rotateZ: 0,
                transition: { type: "spring", stiffness: 400, damping: 25 }
            });
        }
    };

    const isActive = isBoardTurn && !isRollingBoardDice && !disabled;
    const faceBg = isActive 
        ? "bg-gradient-to-br from-white to-slate-100 border-slate-300 shadow-[inset_0_0_15px_rgba(0,0,0,0.05)]" 
        : "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]";
    const dotBg = isActive ? "bg-slate-800" : "bg-slate-950";
    const dot1Bg = isActive ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-slate-950";

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-safe">
            {/* Dock 容器 */}
            <div className="mx-auto w-fit pointer-events-auto">
                <div className="flex items-end gap-3 px-6 pb-6 pt-8">
                    {/* 左側：房市公告板 */}
                    {onShowRealEstateMarket && (
                        <button
                            onClick={onShowRealEstateMarket}
                            disabled={disabled}
                            className={`group relative flex flex-col items-center gap-1.5 px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                            title={disabled ? "遊戲已結算" : "房市公告板"}
                        >
                            <div className="w-[52px] h-[52px] bg-gradient-to-br from-slate-800 to-slate-900 text-amber-400 rounded-[18px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-enabled:hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] group-active:scale-95 border border-slate-700">
                                <Building size={24} strokeWidth={2} />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 tracking-wider transition-colors group-enabled:group-hover:text-amber-400">房市</span>
                        </button>
                    )}

                    {/* 左側：目標與夢想 */}
                    <button
                        onClick={onShowTargetDream}
                        disabled={disabled}
                        className={`group relative flex flex-col items-center gap-1.5 px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                        title={disabled ? "遊戲已結算" : "購買目標與夢想"}
                    >
                        <div className="w-[52px] h-[52px] bg-gradient-to-br from-slate-800 to-slate-900 text-fuchsia-400 rounded-[18px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-enabled:hover:shadow-[0_0_20px_rgba(217,70,239,0.2)] group-active:scale-95 border border-slate-700">
                            <Target size={24} strokeWidth={2} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 tracking-wider transition-colors group-enabled:group-hover:text-fuchsia-400">目標</span>
                    </button>

                    {/* 中央主按鈕：擲骰子 / 數位銀行 */}
                    <div className="px-2 pb-1 relative" style={{ perspective: '1000px' }}>
                        {onRollBoardDice ? (
                            <div className="relative flex flex-col items-center gap-2">
                                {/* 向上引導動畫 (輪到自己時顯示) */}
                                {isActive && !isDragging && (
                                    <motion.div 
                                        className="absolute -top-10 text-cyan-400 opacity-50"
                                        animate={{ y: [0, -10, 0], opacity: [0, 0.8, 0] }}
                                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                    >
                                        <ChevronUp size={24} strokeWidth={3} />
                                    </motion.div>
                                )}

                                {/* 發光底圖 */}
                                {isActive && !isDragging && (
                                    <motion.div
                                        className="absolute inset-0 bg-cyan-500 rounded-full blur-2xl opacity-30 z-0"
                                        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                    />
                                )}

                                <motion.button
                                    drag={isActive ? true : false}
                                    dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
                                    dragElastic={0.8}
                                    onDragStart={() => setIsDragging(true)}
                                    onDragEnd={handleDragEnd}
                                    animate={diceControls}
                                    initial={{ x: 0, y: 0, z: 0, rotateX: -15, rotateY: 15, rotateZ: 0 }}
                                    whileHover={isActive ? { scale: 1.05 } : {}}
                                    whileTap={isActive ? { scale: 0.95 } : {}}
                                    onClick={() => {
                                        // 保留點擊觸發，防呆
                                        if (isActive) {
                                            const targetX = (Math.random() - 0.5) * 150;
                                            const apexY = -250;
                                            const landY = -100;
                                            const rotX = Math.random() * 180 + 360;
                                            const rotY = Math.random() * 180 + 360;
                                            const rotZ = Math.random() * 180 + 180;

                                            diceControls.start({
                                                x: [0, targetX * 0.5, targetX, targetX * 1.05, targetX, targetX * 1.02, targetX, targetX, targetX],
                                                y: [0, apexY, landY, landY - 40, landY, landY - 15, landY, landY, landY],
                                                z: [0, -100, -300, -300, -300, -300, -300, -300, -300],
                                                scale: [1, 1.2, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
                                                opacity: [1, 1, 1, 1, 1, 1, 1, 1, 0],
                                                rotateX: [0, rotX * 0.5, rotX, rotX + 30, rotX + 30, rotX + 35, rotX + 35, rotX + 35, rotX + 35],
                                                rotateY: [0, rotY * 0.5, rotY, rotY + 15, rotY + 15, rotY + 20, rotY + 20, rotY + 20, rotY + 20],
                                                rotateZ: [0, rotZ * 0.5, rotZ, rotZ + 10, rotZ + 10, rotZ + 15, rotZ + 15, rotZ + 15, rotZ + 15],
                                                transition: { 
                                                    duration: 3.5, 
                                                    times: [0, 0.1, 0.2, 0.26, 0.29, 0.33, 0.35, 0.91, 1],
                                                    ease: ["easeOut", "easeIn", "easeOut", "easeIn", "easeOut", "easeIn", "linear", "easeInOut"]
                                                }
                                            });
                                            
                                            setTimeout(() => {
                                                onRollBoardDice();
                                            }, 600);
                                        }
                                    }}
                                    style={{ touchAction: "none", transformStyle: "preserve-3d" }}
                                    className={`relative z-10 w-[64px] h-[64px] ${!isActive ? 'opacity-50 cursor-not-allowed filter grayscale-[0.5]' : 'cursor-grab active:cursor-grabbing'}`}
                                    title={!isBoardTurn ? "尚未輪到你" : (isRollingBoardDice ? "同步中..." : `滑動拋擲${hasCar ? ' (2顆)' : ' (1顆)'}`)}
                                >
                                    {/* 骰子主體 (加上 transform-style 確保子元素 3D) */}
                                    <div className="absolute inset-0 w-full h-full" style={{ transformStyle: "preserve-3d" }}>
                                        {/* 6個骰子面 */}
                                        <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: 'translateZ(32px)' }}>
                                            <div className={`w-4 h-4 rounded-full ${dot1Bg}`} />
                                        </div>
                                        <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: 'rotateY(180deg) translateZ(32px)' }}>
                                            <div className="w-full h-full p-2.5 flex justify-between">
                                                <div className="flex flex-col justify-between"><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/></div>
                                                <div className="flex flex-col justify-between"><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/><div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/></div>
                                            </div>
                                        </div>
                                        <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: 'rotateY(90deg) translateZ(32px)' }}>
                                            <div className="w-full h-full p-2.5 flex flex-col justify-between">
                                                <div className={`w-2.5 h-2.5 rounded-full self-start ${dotBg}`}/>
                                                <div className={`w-2.5 h-2.5 rounded-full self-center ${dotBg}`}/>
                                                <div className={`w-2.5 h-2.5 rounded-full self-end ${dotBg}`}/>
                                            </div>
                                        </div>
                                        <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: 'rotateY(-90deg) translateZ(32px)' }}>
                                            <div className="w-full h-full p-2.5 grid grid-cols-2 grid-rows-2 gap-2 place-items-center">
                                                <div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                                                <div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                                                <div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                                                <div className={`w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                                            </div>
                                        </div>
                                        <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: 'rotateX(90deg) translateZ(32px)' }}>
                                            <div className="w-full h-full p-2.5 flex justify-between">
                                                <div className={`w-2.5 h-2.5 rounded-full self-start ${dotBg}`}/>
                                                <div className={`w-2.5 h-2.5 rounded-full self-end ${dotBg}`}/>
                                            </div>
                                        </div>
                                        <div className={`absolute inset-0 border-2 rounded-[14px] flex items-center justify-center ${faceBg}`} style={{ transform: 'rotateX(-90deg) translateZ(32px)' }}>
                                            <div className="relative w-full h-full">
                                                <div className={`absolute top-2.5 left-2.5 w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                                                <div className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                                                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                                                <div className={`absolute bottom-2.5 left-2.5 w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                                                <div className={`absolute bottom-2.5 right-2.5 w-2.5 h-2.5 rounded-full ${dotBg}`}/>
                                            </div>
                                        </div>

                                        {hasCar && isActive && (
                                            <div className="absolute -top-3 -right-3 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm" style={{ transform: 'translateZ(40px)' }}>
                                                <span className="text-[10px] font-black text-amber-900 leading-none tracking-tighter">x2</span>
                                            </div>
                                        )}
                                    </div>
                                </motion.button>
                                <span className={`text-[11px] font-black uppercase tracking-widest transition-colors ${
                                    isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-slate-500'
                                }`}>
                                    {isRollingBoardDice ? '同步中' : (isBoardTurn ? '滑動拋擲' : '擲骰子')}
                                </span>
                            </div>
                        ) : (
                            <button
                                onClick={onShowTransaction}
                                disabled={disabled}
                                className={`group relative flex flex-col items-center gap-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                                title={disabled ? "遊戲已結算" : "數位銀行"}
                            >
                                <div className="relative w-[72px] h-[72px] bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-[24px] shadow-[0_12px_24px_-8px_rgba(16,185,129,0.6),inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-active:scale-95 border-2 border-white/40">
                                    <Landmark size={36} strokeWidth={2} className="drop-shadow-md" />
                                </div>
                                <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">數位銀行</span>
                            </button>
                        )}
                    </div>

                    {/* 右側：數位銀行 (如果在棋盤模式下) */}
                    {onRollBoardDice && (
                        <button
                            onClick={onShowTransaction}
                            disabled={disabled}
                            className={`group relative flex flex-col items-center gap-1.5 px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                            title={disabled ? "遊戲已結算" : "數位銀行"}
                        >
                            <div className="w-[52px] h-[52px] bg-gradient-to-br from-slate-800 to-slate-900 text-emerald-400 rounded-[18px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-enabled:hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] group-active:scale-95 border border-slate-700">
                                <Landmark size={24} strokeWidth={2} />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 tracking-wider transition-colors group-enabled:group-hover:text-emerald-400">銀行</span>
                        </button>
                    )}

                    {/* 右側：醫療理賠 */}
                    <button
                        onClick={onShowMedical}
                        disabled={disabled}
                        className={`group relative flex flex-col items-center gap-1.5 px-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                        title={disabled ? "遊戲已結算" : "醫療理賠"}
                    >
                        <div className="w-[52px] h-[52px] bg-gradient-to-br from-slate-800 to-slate-900 text-rose-400 rounded-[18px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-105 group-enabled:hover:-translate-y-1 group-enabled:hover:shadow-[0_0_20px_rgba(244,63,94,0.2)] group-active:scale-95 border border-slate-700">
                            <CirclePlus size={24} strokeWidth={2} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 tracking-wider transition-colors group-enabled:group-hover:text-rose-400">醫療</span>
                    </button>
                </div>
            </div>
        </div>
    );
};


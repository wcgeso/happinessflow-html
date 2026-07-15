import React from 'react';
import { cn } from '../../utils/gameUtils';

interface DiceFaceProps {
    value: number;
    rolling: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const DiceFace: React.FC<DiceFaceProps> = ({ value, rolling, size = 'md', className }) => {
    const sizeClasses = {
        sm: 'w-16 h-16',
        md: 'w-24 h-24',
        lg: 'w-32 h-32'
    };

    const dotSizeClasses = {
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5'
    };

    const getDots = (val: number) => {
        switch (val) {
            case 1: return [{ row: 2, col: 2, color: 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)] scale-125' }];
            case 2: return [{ row: 1, col: 1 }, { row: 3, col: 3 }];
            case 3: return [{ row: 1, col: 1 }, { row: 2, col: 2 }, { row: 3, col: 3 }];
            case 4: return [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 3 }];
            case 5: return [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 2, col: 2 }, { row: 3, col: 1 }, { row: 3, col: 3 }];
            case 6: return [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 2, col: 1 }, { row: 2, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 3 }];
            default: return [];
        }
    };

    return (
        <div className={cn(
            "relative",
            sizeClasses[size],
            rolling && "animate-dice-roll",
            className
        )} role="img" aria-label={`骰子 ${value} 點`}>
            {/* 骰子主體 - 3D 效果層 */}
            <div className={cn(
                "w-full h-full bg-white rounded-[24px] shadow-2xl relative overflow-hidden transition-transform duration-200 transform-gpu",
                !rolling && "group-hover:scale-[1.03]",
                /* 使用 shadow 代替 border 來營造 3D 感，避免影響內部對齊 */
                "shadow-[inset_-8px_-8px_15px_rgba(0,0,0,0.1),8px_8px_15px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.05)]"
            )}>
                {/* 表面漸變 - 增加絲綢質感 */}
                <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-slate-100" />
                
                {/* 內部光暈 */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,1)_0%,rgba(255,255,255,0)_70%)] opacity-60" />

                {/* 點數格 - 使用絕對定位與 Flex 確保絕對置中 */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-3 z-10">
                    {getDots(value).map((dot, idx) => (
                        <div
                            key={`${value}-${idx}`}
                            className="flex h-full w-full items-center justify-center"
                            style={{ gridColumnStart: dot.col, gridRowStart: dot.row }}
                        >
                            <div
                                className={cn(
                                    "rounded-full transition-all duration-150 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]",
                                    dotSizeClasses[size],
                                    dot.color || "bg-slate-900",
                                    rolling && "scale-90 opacity-80"
                                )}
                            />
                        </div>
                    ))}
                </div>

                <div className="absolute inset-x-3 top-2 h-px rounded-full bg-white/80" />
            </div>

            {/* 底部投影 */}
            <div className={cn(
                "absolute -bottom-4 left-1/2 -translate-x-1/2 w-4/5 h-2 bg-black/40 blur-lg rounded-full transition-all duration-300",
                rolling ? "scale-x-125 opacity-25" : "scale-100 opacity-50"
            )} />
        </div>
    );
};

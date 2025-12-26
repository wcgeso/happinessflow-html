import React from 'react';
import { cn } from '../../utils/gameUtils';

interface DiceFaceProps {
    value: number;
    rolling: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const DiceFace: React.FC<DiceFaceProps> = ({ value, rolling, size = 'md', className }) => {
    const [displayValue, setDisplayValue] = React.useState(value);

    React.useEffect(() => {
        let interval: NodeJS.Timeout;
        if (rolling) {
            interval = setInterval(() => {
                setDisplayValue(Math.floor(Math.random() * 6) + 1);
            }, 80);
        } else {
            setDisplayValue(value);
        }
        return () => clearInterval(interval);
    }, [rolling, value]);

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
            "relative perspective-1000",
            sizeClasses[size],
            rolling ? "animate-dice-roll" : "animate-dice-float",
            className
        )}>
            {/* 骰子主體 - 3D 效果層 */}
            <div className={cn(
                "w-full h-full bg-white rounded-2xl shadow-2xl relative overflow-hidden transition-all duration-300 transform-gpu",
                !rolling && "hover:scale-110 hover:rotate-3",
                /* 使用 shadow 代替 border 來營造 3D 感，避免影響內部對齊 */
                "shadow-[inset_-8px_-8px_15px_rgba(0,0,0,0.1),8px_8px_15px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.05)]"
            )}>
                {/* 表面漸變 - 增加絲綢質感 */}
                <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-slate-100" />
                
                {/* 內部光暈 */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,1)_0%,rgba(255,255,255,0)_70%)] opacity-60" />

                {/* 點數格 - 使用絕對定位與 Flex 確保絕對置中 */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-3 z-10">
                    {getDots(displayValue).map((dot, idx) => (
                        <div
                            key={`${displayValue}-${idx}`}
                            className={cn(
                                "w-full h-full flex items-center justify-center",
                                `col-start-${dot.col} row-start-${dot.row}`
                            )}
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

                {/* 反光效果 */}
                <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -rotate-45 -translate-x-full animate-[shimmer_3s_infinite]" />
            </div>

            {/* 底部投影 */}
            <div className={cn(
                "absolute -bottom-6 left-1/2 -translate-x-1/2 w-4/5 h-3 bg-black/40 blur-xl rounded-full transition-all duration-300",
                rolling ? "scale-x-150 opacity-20 blur-lg" : "scale-100 opacity-60"
            )} />
        </div>
    );
};

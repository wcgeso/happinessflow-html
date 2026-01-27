import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/ui';

interface SelectionCarouselProps {
    title: string;
    headerText?: string;
    subtitle: string;
    items: any[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    renderItem: (item: any, isSelected: boolean) => React.ReactNode;
    onNext?: () => void;
    onBack?: () => void;
    btnLabel?: string;
    sessionMeta: { playerName: string };
    shape?: 'rectangle' | 'circle';
    showSliderPrompt?: boolean;
}

export const SelectionCarousel: React.FC<SelectionCarouselProps> = ({
    title,
    headerText,
    subtitle,
    items,
    selectedId,
    onSelect,
    renderItem,
    onNext,
    onBack,
    btnLabel,
    sessionMeta,
    shape = 'rectangle',
    showSliderPrompt = true,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const isCircle = shape === 'circle';
    const itemWidth = 280 + 24; // 卡片寬度 + 間距
    const [centerIndex, setCenterIndex] = useState<number | null>(null);

    const displayItems = useMemo(() => {
        return [...items, ...items, ...items];
    }, [items]);

    const initialOffsetSet = useRef<boolean>(false);
    const isScrolling = useRef<boolean>(false);
    const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

    // 設置初始滾動位置
    useEffect(() => {
        if (scrollRef.current && !initialOffsetSet.current) {
            const centerIndex = items.length;
            scrollRef.current.scrollLeft = centerIndex * itemWidth;
            initialOffsetSet.current = true;
        }
    }, [items.length, itemWidth]);

    // 移除 IntersectionObserver，改用即時滾動計算以達到零延遲
    useEffect(() => {
        // 初始位置設置後，執行一次即時計算
        if (initialOffsetSet.current) {
            calculateSelection(scrollRef.current);
        }
    }, [items]);

    const calculateSelection = (container: HTMLDivElement | null) => {
        if (!container) return;

        const scrollPos = container.scrollLeft;
        const containerWidth = container.offsetWidth;
        const centerPos = scrollPos + containerWidth / 2;

        // 計算中心點在哪個索引上
        const index = Math.round(centerPos / itemWidth);
        const actualIndex = index % items.length;
        const itemId = items[actualIndex]?.id;

        if (itemId && itemId !== selectedId) {
            onSelect(itemId);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        const listWidth = items.length * itemWidth;

        // 無縫滾動邏輯
        if (container.scrollLeft < listWidth / 2) {
            container.scrollLeft += listWidth;
        } else if (container.scrollLeft > listWidth * 2) {
            container.scrollLeft -= listWidth;
        }

        // 即時更新選中項
        calculateSelection(container);
    };

    return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-500 z-50 touch-none pt-safe">
            {/* Header */}
            <div className="relative shrink-0 px-6 py-4 md:py-6 border-b border-slate-800/50 flex items-center justify-between bg-slate-900/80 backdrop-blur-md z-50">
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">遊戲玩家</span>
                    <span className="text-sm font-black text-white">{sessionMeta.playerName}</span>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 text-center">
                    <div className="text-xs font-black text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 tracking-widest">{title}</div>
                </div>

                <div className="flex items-center gap-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-all active:scale-90"
                            aria-label="返回"
                        >
                            <ArrowLeft size={18} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 relative flex flex-col justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950 touch-pan-x">

                {headerText && (
                    <div className="absolute top-8 left-0 right-0 text-center z-20">
                        <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg tracking-wide">{headerText}</h2>
                        <div className="w-16 h-1 bg-amber-500 mx-auto mt-2 rounded-full"></div>
                    </div>
                )}

                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="w-full flex items-center overflow-x-auto snap-x snap-mandatory gap-6 pb-12 pt-20 hide-scrollbar"
                    style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    {displayItems.map((item: any, idx: number) => {
                        const actualId = item.id;
                        const isSelected = selectedId === actualId;
                        return (
                            <div
                                ref={el => {
                                    itemRefs.current[idx] = el;
                                }}
                                key={`${actualId}-${idx}`}
                                data-index={idx}
                                className={`snap-center shrink-0 transition-all duration-200 ease-out cursor-pointer flex flex-col relative
                      ${isCircle ? 'w-[75vw] max-w-[280px] aspect-square' : 'w-[85vw] max-w-[280px] h-[55vh]'} 
                      ${isSelected ? 'scale-110 z-30' : 'scale-90 opacity-40 hover:opacity-100 z-10'}`}
                            >
                                <div className={`w-full h-full bg-slate-900 border-2 overflow-hidden flex flex-col shadow-2xl relative transition-all duration-200 
                      ${isCircle ? 'rounded-full items-center justify-center' : 'rounded-2xl'} 
                      ${isSelected ? 'border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)]' : 'border-slate-700 shadow-none'}`}>
                                    <div className={`flex-1 flex flex-col items-center text-center space-y-4 overflow-hidden ${isCircle ? 'justify-center p-8' : 'p-6'}`} style={{ maxHeight: '100%' }}>
                                        {renderItem(item, isSelected)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {showSliderPrompt && (
                    <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-slate-500 animate-pulse pointer-events-none">
                        ← 左右滑動選擇 →
                    </div>
                )}
            </div>

            <div className="shrink-0 p-4 border-t border-slate-800/50 bg-slate-900 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-40 pb-safe">
                <Button
                    variant="primary"
                    disabled={!selectedId}
                    onClick={onNext}
                    className={`w-full py-4 text-base font-black uppercase tracking-widest shadow-xl transition-all duration-200 ${selectedId ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/40 translate-y-0 active:scale-95' : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'}`}
                >
                    {selectedId ? btnLabel : subtitle}
                </Button>
            </div>
        </div>
    );
};

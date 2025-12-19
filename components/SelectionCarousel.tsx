import React, { useRef, useEffect, useCallback, useState, useLayoutEffect } from 'react';

interface SelectionCarouselProps {
  items: Array<{ id: string; [key: string]: any }>;
  selectedId: string;
  onSelect: (id: string) => void;
  onBack?: () => void;
  renderItem: (item: any, isSelected: boolean) => React.ReactNode;
  isCircle?: boolean;
  title?: string;
}

const SelectionCarousel: React.FC<SelectionCarouselProps> = ({
  items,
  selectedId: externalSelectedId,
  onSelect,
  renderItem,
  isCircle = false,
  title = '',
  onBack,
}) => {
  // 內部狀態管理選中的項目
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(externalSelectedId);
  
  // 同步外部和內部的選中狀態
  useEffect(() => {
    setInternalSelectedId(externalSelectedId);
  }, [externalSelectedId]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number>();
  const isInitialMount = useRef(true);

  // 使用 requestAnimationFrame 來檢測中央卡片
  const checkCenterItem = useCallback(() => {
    if (!scrollRef.current) return;
    
    const container = scrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerCenterX = containerRect.left + containerRect.width / 2;
    
    // 獲取視窗中央的垂直位置（考慮滾動位置）
    const viewportCenterY = window.innerHeight / 2 + window.scrollY;
    
    // 找到最接近中央的卡片
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-item-id]'));
    let closestCard = null;
    let minDistance = Infinity;
    
    cards.forEach(card => {
      const cardRect = card.getBoundingClientRect();
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2 + window.scrollY;
      
      // 計算卡片中心與畫面中央的距離
      const distanceX = Math.abs(cardCenterX - containerCenterX);
      const distanceY = Math.abs(cardCenterY - viewportCenterY);
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestCard = card;
      }
    });
    
    // 如果找到最近的卡片且距離在閾值內，則選擇它
    if (closestCard && minDistance < 300) { // 調整此閾值以改變靈敏度
      const itemId = closestCard.getAttribute('data-item-id');
      if (itemId && itemId !== internalSelectedId) {
        setInternalSelectedId(itemId);
        onSelect(itemId);
      }
    }
    
    // 繼續檢測
    rafId.current = requestAnimationFrame(checkCenterItem);
  }, [internalSelectedId, onSelect]);
  
  // 啟動/停止檢測
  useEffect(() => {
    rafId.current = requestAnimationFrame(checkCenterItem);
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [checkCenterItem]);
  

  // 滾動處理 - 處理無限滾動並觸發中央卡片檢測
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const itemWidth = 280 + 24;
    const listWidth = items.length * itemWidth;

    // 無限滾動邏輯
    if (container.scrollLeft < listWidth / 2) {
      container.scrollLeft += listWidth;
    } else if (container.scrollLeft > listWidth * 1.5) {
      container.scrollLeft -= listWidth;
    }
    
    // 立即觸發中央卡片檢測
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }
    rafId.current = requestAnimationFrame(checkCenterItem);
  };

  // 初始化時滾動到選中的項目
  useLayoutEffect(() => {
    if (internalSelectedId && scrollRef.current) {
      const selectedElement = scrollRef.current.querySelector(`[data-item-id="${internalSelectedId}"]`) as HTMLElement;
      if (selectedElement) {
        // 使用 requestAnimationFrame 確保 DOM 已更新
        requestAnimationFrame(() => {
          selectedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        });
      }
    }
  }, [internalSelectedId]);

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-500 z-50">
      {/* 標題部分 */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {onBack && (
          <button 
            onClick={onBack}
            className="text-white hover:text-emerald-400 transition-colors"
            aria-label="返回"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {/* 滾動容器 */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="w-full flex items-center overflow-x-auto snap-x snap-mandatory gap-6 pb-4 pt-16 scrollbar-hide"
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {items.map((item, idx) => {
          const isSelected = selectedId === item.id;
          return (
            <div 
              key={`${item.id}-${idx}`}
              data-item-id={item.id}
              onClick={() => onSelect(item.id)}
              className={`snap-center shrink-0 transition-all duration-300 ease-out cursor-pointer flex flex-col relative z-10 
                ${isCircle ? 'w-[75vw] max-w-[280px] aspect-square' : 'w-[85vw] max-w-[280px] h-[55vh]'} 
                ${isSelected ? 'scale-105' : 'scale-90 opacity-60'}`}
            >
              <div className={`w-full h-full bg-slate-900 border-2 overflow-hidden flex flex-col shadow-2xl relative transition-colors duration-300 
                ${isCircle ? 'rounded-full items-center justify-center' : 'rounded-2xl'} 
                ${isSelected ? 'border-emerald-500 shadow-emerald-500/30' : 'border-slate-700'}`}>
                <div className={`flex-1 flex flex-col items-center text-center space-y-4 overflow-hidden ${isCircle ? 'justify-center p-8' : 'p-6'}`}>
                  {renderItem(item, isSelected)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SelectionCarousel;

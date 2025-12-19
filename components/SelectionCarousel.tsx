import React, { useRef, useEffect, useCallback, useState, useLayoutEffect, memo } from 'react';

type Item = {
  id: string;
  [key: string]: any;
};

interface SelectionCarouselProps {
  items: Item[];
  selectedId: string;
  onSelect: (id: string) => void;
  onBack?: () => void;
  renderItem: (item: Item, isSelected: boolean) => React.ReactNode;
  isCircle?: boolean;
  title?: string;
  className?: string;
  itemClassName?: string;
  selectedItemClassName?: string;
  containerClassName?: string;
  scrollContainerClassName?: string;
  headerClassName?: string;
  showBackButton?: boolean;
  backButtonAriaLabel?: string;
  backButtonClassName?: string;
  backButtonIcon?: React.ReactNode;
  onItemClick?: (item: Item) => void;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  scrollBehavior?: 'smooth' | 'auto';
  scrollSnapType?: 'none' | 'x' | 'y' | 'both';
  scrollSnapAlign?: 'start' | 'center' | 'end';
  scrollSnapStop?: 'always' | 'normal';
}

const SelectionCarousel: React.FC<SelectionCarouselProps> = ({
  items,
  selectedId: externalSelectedId,
  onSelect,
  renderItem,
  isCircle = false,
  title = '',
  onBack,
  className = '',
  itemClassName = '',
  selectedItemClassName = '',
  containerClassName = '',
  scrollContainerClassName = '',
  headerClassName = '',
  showBackButton = true,
  backButtonAriaLabel = '返回',
  backButtonClassName = '',
  backButtonIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  onItemClick,
  onScroll,
  scrollBehavior = 'smooth',
  scrollSnapType = 'x',
  scrollSnapAlign = 'center',
  scrollSnapStop = 'always',
}) => {
  // 內部狀態管理選中的項目
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(externalSelectedId);
  
  // 同步外部和內部的選中狀態
  useEffect(() => {
    setInternalSelectedId(externalSelectedId);
  }, [externalSelectedId]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);
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
  const handleContainerScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const itemWidth = 280 + 24;
    const listWidth = items.length * itemWidth;

    // 無限滾動邏輯
    if (container.scrollLeft < listWidth / 2) {
      container.scrollLeft += listWidth;
    } else if (container.scrollLeft > listWidth * 1.5) {
      container.scrollLeft -= listWidth;
    }
    
    // 調用傳入的 onScroll 回調
    if (onScroll) {
      onScroll(e);
    }
    
    // 立即觸發中央卡片檢測
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }
    rafId.current = requestAnimationFrame(checkCenterItem);
  }, [items.length, onScroll, checkCenterItem]);

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

  const handleItemClick = useCallback((item: Item) => {
    onSelect(item.id);
    if (onItemClick) {
      onItemClick(item);
    }
  }, [onSelect, onItemClick]);

  const handleBackClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onBack) {
      onBack();
    }
  }, [onBack]);

  // 合併滾動處理邏輯到 handleContainerScroll

  return (
    <div className={`fixed inset-0 bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-500 z-50 ${className}`}>
      {/* 標題部分 */}
      <div className={`shrink-0 px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10 ${headerClassName}`}>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {onBack && showBackButton && (
          <button 
            onClick={handleBackClick}
            className={`text-white hover:text-emerald-400 transition-colors ${backButtonClassName}`}
            aria-label={backButtonAriaLabel}
          >
            {backButtonIcon}
          </button>
        )}
      </div>
      
      {/* 滾動容器 */}
      <div 
        ref={scrollRef}
        onScroll={handleContainerScroll}
        className={`w-full flex items-center overflow-x-auto gap-6 pb-4 pt-16 hide-scrollbar ${scrollContainerClassName}`}
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType,
          scrollSnapAlign,
          scrollSnapStop,
          scrollBehavior: scrollBehavior as any,
        }}
      >
        {items.map((item, idx) => {
          const isSelected = externalSelectedId === item.id;
          return (
            <div 
              key={`${item.id}-${idx}`}
              data-item-id={item.id}
              onClick={() => handleItemClick(item)}
              className={`shrink-0 transition-all duration-300 ease-out cursor-pointer flex flex-col relative z-10 
                ${isCircle ? 'w-[75vw] max-w-[280px] aspect-square' : 'w-[85vw] max-w-[280px] h-[55vh]'} 
                ${isSelected ? `scale-105 ${selectedItemClassName}` : 'scale-90 opacity-60'} ${itemClassName}`}
              style={{
                scrollSnapAlign,
                scrollSnapStop,
              }}
            >
              <div className={`w-full h-full bg-slate-900 border-2 overflow-hidden flex flex-col shadow-2xl relative transition-all duration-300 
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

// 使用 memo 優化性能，避免不必要的重新渲染
export default memo(SelectionCarousel, (prevProps, nextProps) => {
  // 只有當 selectedId 或 items 長度變化時才重新渲染
  return prevProps.selectedId === nextProps.selectedId && 
         prevProps.items.length === nextProps.items.length;
});

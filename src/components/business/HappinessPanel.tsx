
import React, { useState, useRef } from 'react';
import { HappinessItem } from '../../types';
import { Heart, Trash2, Lock, CornerDownRight } from 'lucide-react';

interface HappinessPanelProps {
  items: HappinessItem[];
  total: number;
  onToggle: (id: string) => void;
  onAddCustomItem?: (label: string, points: number) => void;
  onRemoveCustomItem?: (id: string) => void;
  disabled?: boolean;
}

export const HappinessPanel: React.FC<HappinessPanelProps> = ({
  items,
  total,
  onToggle,
  onAddCustomItem,
  onRemoveCustomItem,
  disabled = false
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPoints, setNewItemPoints] = useState('2');

  const [showDetailId, setShowDetailId] = useState<string | null>(null);

  // Long press logic
  // Fix: Use number type for timerRef instead of NodeJS.Timeout for browser compatibility
  const timerRef = useRef<number | null>(null);

  const handleTouchStart = (id: string) => {
    timerRef.current = setTimeout(() => {
      setShowDetailId(id);
    }, 600) as unknown as number; // 600ms for long press
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleAddItem = () => {
    if (newItemName.trim() && onAddCustomItem) {
      onAddCustomItem(newItemName, Number(newItemPoints));
      setNewItemName('');
      setNewItemPoints('2');
      setShowAddModal(false);
    }
  };

  return (
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#d8c29a] bg-[#fffaf2] text-[#293a38] shadow-[0_18px_40px_-30px_rgba(92,64,33,0.7)]">
        {/* Header */}
        <div className="bg-[#f4e6d0] p-4 border-b border-[#d8c29a] flex justify-between items-center shrink-0">
          <h3 className="flex items-center gap-2 font-bold text-[#bd4f73]">
            <Heart className="fill-[#d94f83] text-[#d94f83]" size={20} />
            幸福指數
          </h3>
          <span className="text-2xl font-black text-[#293a38]">{total}</span>
        </div>

        {/* List - Scrollable Area */}
        <div className="flex-1 overflow-y-auto bg-[#fbf7ef] p-3 scrollbar-thin scrollbar-thumb-[#d8c29a] scrollbar-track-[#f4e6d0]">
          {items.map(item => (
            <div
              key={item.id}
              onMouseDown={() => handleTouchStart(item.id)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
              onTouchStart={() => handleTouchStart(item.id)}
              onTouchEnd={handleTouchEnd}
              onClick={() => !item.readOnly && !disabled && onToggle(item.id)}
              className={`
              group relative mb-2 flex min-h-14 select-none items-center gap-3 rounded-xl border px-3 py-3 transition-colors
              ${item.checked
                  ? 'border-[#e8a9bf] bg-[#f9e3ea] text-[#8d315d]'
                  : item.readOnly
                    ? 'border-[#dfcfb7] bg-[#f7f0e5] text-[#6f6253]'
                    : 'border-[#ead6b9] bg-[#fffaf2] text-[#765f47]'}
              ${!item.readOnly && !disabled ? 'cursor-pointer hover:border-[#d8c29a] hover:bg-[#f8eee0]' : 'cursor-default'}
              ${item.parentId ? 'ml-5 w-[calc(100%-1.25rem)] border-l-2 border-l-[#d8c29a]' : ''}
            `}
            >
              {/* Indentation Indicator */}
              {item.parentId && (
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-[#b89a72]">
                  <CornerDownRight size={12} />
                </div>
              )}

              <div className={`
              flex h-5 w-5 shrink-0 items-center justify-center rounded-md border
                  ${item.checked
                    ? 'border-[#d94f83] bg-[#d94f83]'
                    : item.readOnly
                      ? 'border-[#cdbb9f] bg-[#efe5d5]'
                      : 'border-[#d8c29a] bg-[#fffaf2]'}
            `}>
                {item.checked && <span className="text-white text-xs font-bold">✓</span>}
              </div>

              <div className="flex-1 text-sm font-medium flex flex-col">
                <span className={item.parentId ? "text-xs" : ""}>{item.label}</span>
                {item.code && <span className="text-[10px] text-[#7a6958] font-mono">{item.code}</span>}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className={`rounded-full px-2 py-1 text-xs font-black ${item.checked ? 'bg-[#fffaf2] text-[#bd4f73]' : 'bg-[#efe5d5] text-[#765f47]'}`}>
                  +{item.points}
                </div>
                {item.readOnly && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#efe5d5] text-[#9a8166]" title="由遊戲進度自動解鎖">
                    <Lock size={12} />
                  </div>
                )}
              </div>

              {/* Remove Custom Item Button */}
              {item.isCustom && onRemoveCustomItem && !disabled && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveCustomItem(item.id);
                  }}
                  className="ml-2 p-1.5 text-[#7a6958] hover:text-[#b54155] hover:bg-[#fff0f0] rounded z-10"
                  title="刪除項目"
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* Detail Overlay/Tooltip (Long Press) */}
              {showDetailId === item.id && item.description && (
                <div className="absolute inset-0 z-20 bg-[#fffaf2]/95 flex items-center justify-center p-2 rounded-lg text-center animate-in fade-in zoom-in-95" onClick={(e) => { e.stopPropagation(); setShowDetailId(null); }}>
                  <div>
                    <div className="mb-1 text-xs font-bold text-[#bd4f73]">{item.code} 詳細資訊</div>
                    <div className="text-sm text-[#293a38]">{item.description}</div>
                    <div className="text-[10px] text-[#7a6958] mt-2">(點擊關閉)</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
  );
};

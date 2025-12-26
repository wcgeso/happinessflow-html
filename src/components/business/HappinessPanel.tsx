
import React, { useState, useRef } from 'react';
import { HappinessItem } from '../../types';
import { Card, Button, Input } from '../ui/ui';
import { Heart, Plus, Trash2, Lock, Info, CornerDownRight } from 'lucide-react';

interface HappinessPanelProps {
  items: HappinessItem[];
  total: number;
  onToggle: (id: string) => void;
  onAddCustomItem?: (label: string, points: number) => void;
  onRemoveCustomItem?: (id: string) => void;
}

export const HappinessPanel: React.FC<HappinessPanelProps> = ({
  items,
  total,
  onToggle,
  onAddCustomItem,
  onRemoveCustomItem
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
    <>
      <Card className="h-full bg-slate-900 border-slate-700 flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-pink-400 flex items-center gap-2">
            <Heart className="fill-pink-400 text-pink-400" size={20} />
            幸福指數
          </h3>
          <span className="text-2xl font-black text-white">{total}</span>
        </div>

        {/* List - Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800">
          {items.map(item => (
            <div
              key={item.id}
              onMouseDown={() => handleTouchStart(item.id)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
              onTouchStart={() => handleTouchStart(item.id)}
              onTouchEnd={handleTouchEnd}
              onClick={() => !item.readOnly && onToggle(item.id)}
              className={`
              flex items-center gap-3 p-3 mb-2 rounded-lg border transition-all relative group select-none
              ${item.checked
                  ? 'bg-pink-900/20 border-pink-600/50 text-pink-100'
                  : 'bg-slate-800 border-slate-700 text-slate-400'}
              ${!item.readOnly ? 'cursor-pointer hover:bg-slate-800/80' : 'cursor-default opacity-80'}
              ${item.parentId ? 'ml-6 border-l-2 border-l-slate-600 pl-3 scale-95' : ''}
            `}
            >
              {/* Indentation Indicator */}
              {item.parentId && (
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-slate-600">
                  <CornerDownRight size={12} />
                </div>
              )}

              <div className={`
              w-5 h-5 rounded border flex items-center justify-center shrink-0
              ${item.checked ? 'bg-pink-500 border-pink-500' : 'border-slate-600'}
              ${item.readOnly ? 'opacity-50' : ''}
            `}>
                {item.checked && <span className="text-white text-xs font-bold">✓</span>}
              </div>

              <div className="flex-1 text-sm font-medium flex flex-col">
                <span className={item.parentId ? "text-xs" : ""}>{item.label}</span>
                {item.code && <span className="text-[10px] text-slate-500 font-mono">{item.code}</span>}
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs font-bold opacity-80">+{item.points}</div>
                {item.readOnly && <Lock size={12} className="text-slate-600" />}
              </div>

              {/* Remove Custom Item Button */}
              {item.isCustom && onRemoveCustomItem && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveCustomItem(item.id);
                  }}
                  className="ml-2 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 rounded z-10"
                  title="刪除項目"
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* Detail Overlay/Tooltip (Long Press) */}
              {showDetailId === item.id && item.description && (
                <div className="absolute inset-0 z-20 bg-slate-900/95 flex items-center justify-center p-2 rounded-lg text-center animate-in fade-in zoom-in-95" onClick={(e) => { e.stopPropagation(); setShowDetailId(null); }}>
                  <div>
                    <div className="text-xs text-pink-400 font-bold mb-1">{item.code} 詳細資訊</div>
                    <div className="text-sm text-white">{item.description}</div>
                    <div className="text-[10px] text-slate-500 mt-2">(點擊關閉)</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer - Add Custom Item */}
        <div className="p-3 border-t border-slate-700 bg-slate-800 shrink-0">
          <Button
            variant="secondary"
            className="w-full border-dashed border-2 border-slate-600 text-slate-400 hover:text-white hover:border-slate-500"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> 自訂幸福項目
          </Button>
        </div>
      </Card>

      {/* Floating Modal for Adding Custom Item */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowAddModal(false)} // Close on backdrop click
        >
          {/* Modal Content */}
          <Card
            className="w-full max-w-sm bg-slate-900 border-slate-600 shadow-2xl p-6 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
          >
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="text-pink-400" /> 新增自訂幸福項目
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">項目名稱</label>
                <Input
                  placeholder="例如: 全家出國旅遊"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">增加幸福點數</label>
                <Input
                  type="number"
                  value={newItemPoints}
                  onChange={e => setNewItemPoints(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">
                  取消
                </Button>
                <Button variant="primary" onClick={handleAddItem} className="flex-1 bg-pink-600 hover:bg-pink-500">
                  確認新增
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};
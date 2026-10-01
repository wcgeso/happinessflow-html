import React from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '../ui/ui';

interface SelectionOptionGridProps {
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
}

export const SelectionOptionGrid: React.FC<SelectionOptionGridProps> = ({
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
}) => {
    const selectedItem = items.find(item => item.id === selectedId);
    const selectedName = selectedItem?.name || selectedItem?.title || selectedItem?.id;

    return (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-950 pt-safe text-white">
            <header className="relative z-10 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-slate-800 bg-slate-900 px-4 py-3 md:px-8 md:py-4">
                <div className="flex min-w-0 flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">遊戲玩家</span>
                    <span className="truncate text-sm font-black">{sessionMeta.playerName}</span>
                </div>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-center text-xs font-black tracking-widest text-amber-400">
                    {title}
                </span>
                {onBack ? (
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex h-11 w-11 shrink-0 items-center justify-center justify-self-end rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                        aria-label="返回"
                    >
                        <ArrowLeft size={18} />
                    </button>
                ) : <span className="h-11 w-11 shrink-0" />}
            </header>

            <main className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 md:px-8">
                <div className="mx-auto max-w-6xl py-5 md:py-8">
                    {headerText && <h1 className="mb-2 text-center text-xl font-black tracking-wide md:text-3xl">{headerText}</h1>}
                    <p className="mb-5 text-center text-sm text-slate-400 md:mb-7">點選一張卡片作為你的選擇</p>

                    <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3 md:gap-5">
                        {items.map(item => {
                            const isSelected = selectedId === item.id;
                            const label = item.name || item.title || item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    data-selection-option={item.id}
                                    aria-label={`選擇${label}`}
                                    aria-pressed={isSelected}
                                    onClick={() => onSelect(item.id)}
                                    className={`relative flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border-2 p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/60 md:p-6 ${
                                        isSelected
                                            ? 'border-amber-400 bg-slate-800 shadow-[0_0_24px_rgba(245,158,11,0.18)]'
                                            : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                                    }`}
                                >
                                    {isSelected && (
                                        <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950" aria-hidden="true">
                                            <Check size={17} strokeWidth={3} />
                                        </span>
                                    )}
                                    <div className="flex w-full flex-col items-center gap-4">
                                        {renderItem(item, isSelected)}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </main>

            <footer className="z-10 shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3 pb-safe md:px-8 md:py-4">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-h-10 text-center sm:text-left">
                        <span className="block text-xs text-slate-500">目前選擇</span>
                        <span className="font-bold text-amber-300">{selectedName || '尚未選擇'}</span>
                    </div>
                    <Button
                        variant="primary"
                        disabled={!selectedId}
                        onClick={onNext}
                        className={`min-h-12 w-full text-sm font-black tracking-wide sm:w-auto sm:min-w-72 ${selectedId ? 'bg-amber-600 text-white hover:bg-amber-500' : 'cursor-not-allowed bg-slate-800 text-slate-500'}`}
                    >
                        {selectedId ? btnLabel : subtitle}
                    </Button>
                </div>
            </footer>
        </div>
    );
};

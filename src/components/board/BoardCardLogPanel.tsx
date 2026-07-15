import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { normalizeCardCopy } from '../../constants/cards';
import { BoardCardLogEntry } from '../../types';

interface BoardCardLogPanelProps {
  entries: BoardCardLogEntry[];
  onClose?: () => void;
  variant?: 'default' | 'projection' | 'inline';
}

const getDeckLabel = (deck: BoardCardLogEntry['deck']) => {
  if (deck === 'news') return '新聞卡';
  if (deck === 'opportunity') return '機運卡';
  return '幸福卡';
};

const getEntryResult = (entry: BoardCardLogEntry) => {
  const line = entry.effectLines?.[0] || entry.summary || '';
  return normalizeCardCopy(line).trim();
};

export const BoardCardLogPanel: React.FC<BoardCardLogPanelProps> = ({ entries, onClose, variant = 'default' }) => {
  const [showAllProjectionEntries, setShowAllProjectionEntries] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  if (variant === 'projection') {
    const visibleEntries = entries.slice(0, showAllProjectionEntries ? 12 : 3);

    return (
      <motion.aside
        initial={prefersReducedMotion ? false : { x: 36, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
        className="fixed bottom-5 right-5 top-24 z-[10030] flex w-[380px] flex-col overflow-hidden rounded-[26px] border border-[#e9c77d]/45 bg-[#102f38] text-[#fff9e9] shadow-[0_28px_70px_-30px_rgba(0,0,0,0.9)]"
        style={{ backgroundColor: 'rgba(16, 47, 56, 0.96)' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-[10px] font-black tracking-[0.28em] text-[#e8c37a]">CARD LOG</div>
            <div className="mt-1 text-lg font-black">抽卡日誌</div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-[#fff4d8]"
            >
              關閉
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {visibleEntries.length > 0 ? visibleEntries.map(entry => {
            const result = getEntryResult(entry);
            return (
              <motion.div
                key={entry.id}
                initial={prefersReducedMotion ? false : { x: 18, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
                className="rounded-[18px] border border-white/10 bg-white/[0.07] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black tracking-[0.1em] text-[#e8c37a]">
                    {entry.playerName} · {getDeckLabel(entry.deck)}
                  </span>
                  <span className="text-[10px] font-bold text-white/45">{entry.cardId}</span>
                </div>
                <div className="mt-1.5 text-base font-black leading-tight text-white">{entry.title}</div>
                {result && (
                  <div className="mt-2 line-clamp-2 text-sm font-bold leading-relaxed text-[#d9e8e4]">
                    {result}
                  </div>
                )}
                {showAllProjectionEntries && entry.description && (
                  <div className="mt-2 border-t border-white/10 pt-2 text-xs font-semibold leading-relaxed text-white/65">
                    {normalizeCardCopy(entry.description)}
                  </div>
                )}
              </motion.div>
            );
          }) : (
            <div className="rounded-[18px] border border-dashed border-white/20 bg-white/[0.04] px-4 py-5 text-sm font-bold text-white/65">
              目前還沒有抽卡紀錄。
            </div>
          )}
        </div>

        {entries.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAllProjectionEntries(current => !current)}
            className="border-t border-white/10 px-5 py-3 text-sm font-black text-[#f1d28f]"
          >
            {showAllProjectionEntries ? '收起摘要' : `查看完整紀錄（${Math.min(entries.length, 12)}）`}
          </button>
        )}
      </motion.aside>
    );
  }

  return (
    <div className={variant === 'inline'
      ? "w-full rounded-[24px] border border-[#d9bd98] bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(243,230,206,0.97))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_50px_-32px_rgba(92,64,33,0.6)] sm:p-5"
      : "fixed inset-x-3 bottom-[calc(6.8rem+env(safe-area-inset-bottom,0px))] top-auto z-[10030] mx-auto w-auto max-w-[420px] rounded-[28px] border border-[#d9bd98] bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(243,230,206,0.97))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_50px_-32px_rgba(92,64,33,0.6)] md:bottom-5 md:top-24 md:inset-x-auto md:right-5 md:w-[360px]"}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black tracking-[0.28em] text-[#9c7c58]">CARD LOG</div>
          <div className="mt-1 text-lg font-black text-[#4f3c29]">抽卡日誌</div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#dbc39d] bg-[#fffaf2] px-3 py-2 text-xs font-black text-[#76573a]"
          >
            關閉
          </button>
        ) : (
          <div className="text-xs font-bold text-[#8f7353]">顯示最近 12 筆</div>
        )}
      </div>

      <div className={variant === 'inline'
        ? "mt-4 max-h-[65vh] space-y-3 overflow-y-auto pr-1"
        : "mt-4 max-h-[calc(100dvh-15rem)] space-y-3 overflow-y-auto pr-1 md:max-h-[65vh]"}>
        {entries.length > 0 ? entries.map((entry) => (
          <div key={entry.id} className="rounded-[20px] border border-[#e5cfac] bg-[#fffaf2] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black tracking-[0.18em] text-[#9c7c58]">
                  {entry.playerName} 抽到 {getDeckLabel(entry.deck)}
                </div>
                <div className="mt-2 text-lg font-black leading-tight text-[#4f3c29]">{entry.title}</div>
              </div>
              <div className="rounded-full border border-[#dbc39d] bg-[#f4e6d0] px-3 py-1 text-[11px] font-black tracking-[0.14em] text-[#76573a]">
                {`${entry.subtitle || ''} ${entry.cardId}`.trim()}
              </div>
            </div>

            {entry.description && (
              <div className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#6f5336]">
                {normalizeCardCopy(entry.description)}
              </div>
            )}

            {!!entry.effectLines?.length && (
              <div className="mt-3 grid gap-2">
                {entry.effectLines.map((line, lineIndex) => (
                  <div
                    key={`${entry.id}_${lineIndex}`}
                    className="rounded-[12px] border border-[#ead6b9] bg-white px-3 py-2 text-sm font-black text-[#5f4933] whitespace-pre-wrap"
                  >
                    {normalizeCardCopy(line)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )) : (
          <div className="rounded-[20px] border border-dashed border-[#d4b68d] bg-[#fffaf2] px-4 py-5 text-sm font-bold leading-relaxed text-[#7a6045]">
            目前還沒有抽卡紀錄。
          </div>
        )}
      </div>
    </div>
  );
};

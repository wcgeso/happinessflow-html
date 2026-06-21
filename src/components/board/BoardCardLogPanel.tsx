import React from 'react';
import { normalizeCardCopy } from '../../constants/cards';
import { BoardCardLogEntry } from '../../types';

interface BoardCardLogPanelProps {
  entries: BoardCardLogEntry[];
  onClose?: () => void;
}

const getDeckLabel = (deck: BoardCardLogEntry['deck']) => {
  if (deck === 'news') return '新聞卡';
  if (deck === 'opportunity') return '機運卡';
  return '幸福卡';
};

export const BoardCardLogPanel: React.FC<BoardCardLogPanelProps> = ({ entries, onClose }) => {
  return (
    <div className="fixed inset-x-4 top-24 z-[10030] mx-auto w-auto max-w-[420px] rounded-[28px] border border-[#d9bd98] bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(243,230,206,0.97))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_50px_-32px_rgba(92,64,33,0.6)] md:inset-x-auto md:right-5 md:w-[360px]">
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

      <div className="mt-4 max-h-[65vh] space-y-3 overflow-y-auto pr-1">
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

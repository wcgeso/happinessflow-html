import React from 'react';
import { X } from 'lucide-react';

export type PlayerModalAccent = 'happiness' | 'news' | 'opportunity' | 'finance' | 'medical';

export interface PlayerModalFrameProps {
  eyebrow?: string;
  title: string;
  description?: string;
  accent?: PlayerModalAccent;
  onClose?: () => void;
  closeDisabled?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  layout?: 'fullscreen' | 'dialog';
}

const ACCENT_STYLES: Record<PlayerModalAccent, {
  bar: string;
  eyebrow: string;
  icon: string;
}> = {
  happiness: {
    bar: 'from-[#d94f83] to-[#ef9a9a]',
    eyebrow: 'text-[#bd4f73]',
    icon: 'bg-[#f7d5df] text-[#bd4f73]'
  },
  news: {
    bar: 'from-[#2e6570] to-[#75aeb0]',
    eyebrow: 'text-[#2e6570]',
    icon: 'bg-[#d8e9e5] text-[#2e6570]'
  },
  opportunity: {
    bar: 'from-[#a9643a] to-[#d9a267]',
    eyebrow: 'text-[#a9643a]',
    icon: 'bg-[#f0dfc9] text-[#a9643a]'
  },
  finance: {
    bar: 'from-[#2e6570] to-[#5da58e]',
    eyebrow: 'text-[#2e6570]',
    icon: 'bg-[#d8e9e5] text-[#2e6570]'
  },
  medical: {
    bar: 'from-[#c9655a] to-[#e6a17f]',
    eyebrow: 'text-[#b6544b]',
    icon: 'bg-[#f5d9d0] text-[#b6544b]'
  }
};

export const PlayerModalFrame: React.FC<PlayerModalFrameProps> = ({
  eyebrow,
  title,
  description,
  accent = 'finance',
  onClose,
  closeDisabled = false,
  children,
  footer,
  layout = 'fullscreen'
}) => {
  const accentStyle = ACCENT_STYLES[accent];
  const isDialog = layout === 'dialog';

  return (
    <div className={`fixed inset-0 z-[10050] flex min-h-0 justify-center bg-[#102f38]/78 backdrop-blur-sm ${isDialog ? 'items-center p-3 sm:px-4 sm:py-6' : 'items-end px-0 py-0 sm:items-center sm:px-4 sm:py-6'}`}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-modal-title"
        className={`relative flex w-full min-h-0 flex-col overflow-hidden border border-[#d8c29a] bg-[#fffaf2] text-[#293a38] shadow-[0_28px_80px_-32px_rgba(16,47,56,0.85)] motion-reduce:transition-none sm:h-auto sm:max-h-[min(92dvh,860px)] sm:max-w-[720px] sm:rounded-[28px] ${isDialog ? 'max-h-[calc(100dvh-1.5rem)] rounded-[24px]' : 'h-[100dvh] max-h-[100dvh]'}`}
      >
        <div className={`h-1.5 shrink-0 bg-gradient-to-r ${accentStyle.bar}`} />

        <header className={`flex shrink-0 items-start gap-3 border-b border-[#ead7b8] px-5 pb-4 sm:px-7 sm:pt-5 ${isDialog ? 'pt-5' : 'pt-[calc(var(--safe-top)+1.1rem)]'}`}>
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accentStyle.icon}`} aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-current" />
          </div>
          <div className="min-w-0 flex-1">
            {eyebrow && <div className={`text-[10px] font-black tracking-[0.2em] ${accentStyle.eyebrow}`}>{eyebrow}</div>}
            <h2 id="player-modal-title" className="mt-1 break-words text-2xl font-black leading-tight text-[#293a38] sm:text-3xl">
              {title}
            </h2>
            {description && <p className="mt-2 whitespace-pre-line text-sm font-bold leading-relaxed text-[#6f6253]">{description}</p>}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              aria-label="關閉視窗"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d8c29a] bg-[#fffaf2] text-[#7a6958] transition hover:bg-[#f3e4cc] hover:text-[#293a38] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X size={18} />
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {children}
        </div>

        {footer && (
          <footer className={`shrink-0 border-t border-[#ead7b8] bg-[#fffaf2]/96 px-5 pt-4 backdrop-blur-md sm:px-7 sm:pb-5 ${isDialog ? 'pb-4' : 'pb-[calc(var(--safe-bottom)+1rem)]'}`}>
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
};

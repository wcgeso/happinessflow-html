import React, { useEffect, useState } from 'react';
import { Camera, Check, ShieldCheck, X } from 'lucide-react';
import type { PhotoPromotionConsentChoice } from '../../constants/photoPromotionConsent';

interface PhotoPromotionConsentModalProps {
  isOpen: boolean;
  required?: boolean;
  initialChoice?: PhotoPromotionConsentChoice;
  onSubmit: (choice: PhotoPromotionConsentChoice) => Promise<void>;
  onClose?: () => void;
}

const choices: Array<{ value: PhotoPromotionConsentChoice; title: string; description: string }> = [
  {
    value: 'agreed',
    title: '同意',
    description: '我同意上述照片與遊戲畫面供《第二人生》推廣使用。',
  },
  {
    value: 'declined',
    title: '不同意',
    description: '我不同意使用包含我個人影像或可辨識資訊的照片與遊戲畫面。',
  },
];

export const PhotoPromotionConsentModal: React.FC<PhotoPromotionConsentModalProps> = ({
  isOpen,
  required = false,
  initialChoice,
  onSubmit,
  onClose,
}) => {
  const [choice, setChoice] = useState<PhotoPromotionConsentChoice | undefined>(initialChoice);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setChoice(initialChoice);
    setError('');
  }, [initialChoice, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!choice || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await onSubmit(choice);
      onClose?.();
    } catch (submitError) {
      console.error('照片與遊戲畫面使用同意儲存失敗:', submitError);
      setError('同意選擇尚未儲存，請確認網路連線後再試一次。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10100] flex items-center justify-center overflow-y-auto bg-[#071c22]/92 p-4 pt-safe pb-safe backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-promotion-consent-title"
    >
      <div className="relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-[#d8c29a] bg-[#fffaf2] text-[#293a38] shadow-[0_30px_90px_-24px_rgba(0,0,0,0.9)]">
        {!required && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#f4e6d0] text-[#76573a] transition-colors hover:bg-[#ead7b8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2e6570]/30"
            aria-label="關閉同意書"
          >
            <X size={20} />
          </button>
        )}

        <div className="overflow-y-auto p-5 sm:p-8">
          <div className="pr-12">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e0f0e5] text-[#2e6570]">
              <Camera size={28} />
            </div>
            <h2 id="photo-promotion-consent-title" className="text-2xl font-black sm:text-3xl">
              照片與遊戲畫面使用同意
            </h2>
            <p className="mt-3 text-sm font-medium leading-7 text-[#765f47] sm:text-base">
              《第二人生》先行版測試期間，團隊可能拍攝活動現場照片，或擷取遊戲畫面，用於官方網站、社群媒體及其他與《第二人生》相關的推廣內容。請選擇是否同意使用可能包含您個人影像或可辨識資訊的素材。
            </p>
          </div>

          <div className="mt-5 flex gap-3 rounded-2xl border border-[#bdd8c6] bg-[#e0f0e5] p-4 text-sm font-bold leading-6 text-[#285c50]">
            <ShieldCheck className="mt-0.5 shrink-0" size={20} />
            <p>不同意不會影響您參與遊戲，之後也可在個人資料中修改選擇。</p>
          </div>

          <fieldset className="mt-6 space-y-3">
            <legend className="mb-3 text-sm font-black text-[#594a3c]">請選擇一項</legend>
            {choices.map(option => {
              const selected = choice === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex min-h-[76px] cursor-pointer items-start gap-4 rounded-2xl border-2 p-4 transition-colors focus-within:ring-4 focus-within:ring-[#2e6570]/25 ${selected
                    ? 'border-[#2e6570] bg-[#e0f0e5]'
                    : 'border-[#e4d2b3] bg-white hover:border-[#b9a17a]'
                    }`}
                >
                  <input
                    type="radio"
                    name="photo-promotion-consent"
                    value={option.value}
                    checked={selected}
                    autoFocus={option.value === (initialChoice || 'agreed')}
                    onChange={() => setChoice(option.value)}
                    className="sr-only"
                  />
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-[#2e6570] bg-[#2e6570] text-white' : 'border-[#b9a17a] bg-white'}`}>
                    {selected && <Check size={15} strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="block text-base font-black">{option.title}</span>
                    <span className="mt-1 block text-sm font-medium leading-6 text-[#765f47]">{option.description}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {error && (
            <div role="alert" className="mt-4 rounded-2xl border border-[#d98d98] bg-[#fff0f2] px-4 py-3 text-sm font-bold text-[#a63249]">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-[#ead7b8] bg-[#fffaf2] p-4 sm:px-8 sm:py-5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!choice || isSaving}
            className="min-h-12 w-full rounded-2xl bg-[#2e6570] px-5 py-3 text-base font-black text-white shadow-[0_10px_24px_-12px_rgba(46,101,112,0.8)] transition-all hover:bg-[#25545d] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#c9c2b5] disabled:text-[#746d62] disabled:shadow-none"
          >
            {isSaving ? '正在儲存…' : '確認選擇'}
          </button>
        </div>
      </div>
    </div>
  );
};

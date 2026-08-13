import React, { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'hf_install_dismissed';

const isStandalone = (): boolean =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

const isIOS = (): boolean =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

const isAndroid = (): boolean =>
    /Android/.test(navigator.userAgent);

export const InstallPromptBanner: React.FC = () => {
    const [show, setShow] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [platform, setPlatform] = useState<'ios' | 'android' | 'other' | null>(null);

    useEffect(() => {
        // 已安裝 or 已關閉過 → 不顯示
        if (isStandalone()) return;
        if (localStorage.getItem(STORAGE_KEY)) return;

        if (isIOS()) {
            setPlatform('ios');
            setShow(true);
            return;
        }

        if (isAndroid()) {
            setPlatform('android');
        } else {
            setPlatform('other');
        }

        // Android/Chrome：等待 beforeinstallprompt 事件
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShow(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem(STORAGE_KEY, '1');
    };

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShow(false);
        }
        setDeferredPrompt(null);
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                    className="fixed bottom-0 left-0 right-0 z-[200] pb-safe px-4 pb-4"
                >
                    <div className="max-w-lg mx-auto bg-slate-900 border border-amber-500/20 rounded-2xl p-4 shadow-2xl shadow-black/50">
                        <div className="flex items-start gap-3">
                            {/* App icon */}
                            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-700">
                                <img src="/icon-192.png" alt="第二人生" className="w-full h-full object-cover" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-white font-black text-sm">加入主畫面</p>
                                <p className="text-slate-400 text-xs mt-0.5">
                                    {platform === 'ios'
                                        ? '安裝後可全螢幕開啟，體驗更流暢'
                                        : '安裝 App，隨時快速開啟'}
                                </p>

                                {/* iOS 步驟說明 */}
                                {platform === 'ios' && (
                                    <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-400 font-bold">
                                        <span>點</span>
                                        <span className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
                                            <Share size={11} />
                                            分享
                                        </span>
                                        <span>→</span>
                                        <span className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
                                            <PlusSquare size={11} />
                                            加入主畫面
                                        </span>
                                    </div>
                                )}

                                {/* Android/其他：安裝按鈕 */}
                                {platform !== 'ios' && deferredPrompt && (
                                    <button
                                        onClick={handleInstall}
                                        className="mt-3 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl transition-all active:scale-95"
                                    >
                                        <Download size={13} />
                                        立即安裝
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={handleDismiss}
                                className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all shrink-0"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

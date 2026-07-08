import React, { useEffect, useState } from 'react';

// 寬螢幕（桌機/平板橫向）才需要「固定手機版面」框架，避免在真實手機上疊加框架
const WIDE_SCREEN_BREAKPOINT = 560;

interface DeviceFrameProps {
    children: React.ReactNode;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({ children }) => {
    const [isWideScreen, setIsWideScreen] = useState(
        () => typeof window !== 'undefined' && window.innerWidth >= WIDE_SCREEN_BREAKPOINT
    );

    useEffect(() => {
        const handleResize = () => setIsWideScreen(window.innerWidth >= WIDE_SCREEN_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 真實手機（窄螢幕）不需要框架
    if (!isWideScreen) {
        return <>{children}</>;
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
            <div className="relative flex h-[860px] max-h-[92vh] w-[400px] flex-col overflow-hidden rounded-[42px] border-8 border-slate-800 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
                {children}
            </div>
        </div>
    );
};

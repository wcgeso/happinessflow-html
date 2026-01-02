import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Zap, ZapOff, Camera } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInsecure, setIsInsecure] = useState(false);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const containerId = "native-qr-reader-v6";

  const startCamera = async () => {
    // 檢查安全上下文
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setIsInsecure(true);
      return;
    }

    setCameraError(null);
    
    try {
      if (!qrCodeRef.current) {
        qrCodeRef.current = new Html5Qrcode(containerId);
      }

      const config = {
        fps: 25, // 提高幀率增加捕捉機會
        qrbox: { width: 280, height: 280 }, // 使用固定大小確保與視覺框較好對齊
        aspectRatio: 1.0, // 強制 1:1 掃描區域
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // 開啟原生硬體加速（如果支援）
        }
      };

      await qrCodeRef.current.start(
        { 
          facingMode: "environment",
          // 請求更高解析度以提升識別率
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        },
        config,
        (decodedText) => {
          qrCodeRef.current?.stop().then(() => onScanSuccess(decodedText)).catch(() => onScanSuccess(decodedText));
        },
        undefined
      );
      
      setIsReady(true);
    } catch (err: any) {
      console.error("相機啟動失敗:", err);
      // 如果是因為需要使用者手動觸發 (常見於某些版本的 iOS Safari)
      if (err.toString().includes("NotAllowedError") || err.toString().includes("Permission denied")) {
        setCameraError("請允許瀏覽器存取相機權限");
      } else {
        setCameraError("無法啟動相機，請檢查硬體或權限設定");
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      // 在 HTTPS 環境下，大多數瀏覽器允許在彈窗開啟時自動請求權限
      startCamera();
    }

    return () => {
      if (qrCodeRef.current && qrCodeRef.current.isScanning) {
        qrCodeRef.current.stop().catch(e => console.error("Cleanup stop failed", e));
      }
    };
  }, [isOpen]);

  const toggleFlash = async () => {
    if (qrCodeRef.current && qrCodeRef.current.isScanning) {
      try {
        const newState = !isFlashOn;
        // 使用 any 繞過非標準屬性檢查 (torch 是部分行動裝置支援的擴展屬性)
        await qrCodeRef.current.applyVideoConstraints({
          advanced: [{ torch: newState } as any]
        });
        setIsFlashOn(newState);
      } catch (err) {
        console.warn("此裝置不支援閃光燈控制");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden">
      {/* 核心相機渲染容器 */}
      <div id={containerId} className="absolute inset-0 w-full h-full bg-black"></div>

      {/* 非安全連線警告 (例如使用 http://192.168... 訪問) */}
      {isInsecure && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-50 p-8 text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
            <ZapOff size={40} className="text-red-500" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">連線不安全</h3>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            瀏覽器基於安全考量，禁止在非 HTTPS 連線下使用相機。<br/>
            <span className="text-amber-500/80 font-bold">請改用 localhost 或部署至 HTTPS 環境。</span>
          </p>
          <button 
            onClick={onClose}
            className="w-full max-w-xs py-4 bg-slate-800 text-white font-black rounded-2xl active:scale-95 transition-all"
          >
            返回大廳
          </button>
        </div>
      )}

      {/* 啟動遮罩 / 錯誤提示 */}
      {!isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 p-8 text-center">
          {cameraError ? (
            <>
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                <Camera size={40} className="text-red-500" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">相機無法啟動</h3>
              <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                {cameraError}
              </p>
              <button 
                onClick={onClose}
                className="w-full max-w-xs py-4 bg-slate-800 text-white font-black rounded-2xl active:scale-95 transition-all"
              >
                返回大廳
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
              <p className="text-amber-500/60 text-xs font-bold tracking-widest uppercase animate-pulse">
                正在調用相機...
              </p>
            </div>
          )}
        </div>
      )}

      {/* 介面層 */}
      {isReady && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col">
          {/* 頂部控制列 */}
          <div className="p-6 flex items-center justify-between pointer-events-auto">
            <button 
              onClick={onClose}
              className="w-12 h-12 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <X size={28} />
            </button>
            
            <button 
              onClick={toggleFlash}
              className="w-12 h-12 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              {isFlashOn ? <ZapOff size={24} /> : <Zap size={24} />}
            </button>
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              {/* 掃描框主體 - 與 config 中的 qrbox (280px) 保持一致 */}
              <div className="w-[280px] h-[280px] border-2 border-white/10 rounded-[2.5rem] overflow-hidden relative">
                {/* 掃描動態線 */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-[0_0_15px_rgba(245,158,11,1)] animate-scan-move"></div>
              </div>

              {/* 四個角提示線 */}
              <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-amber-500 rounded-tl-[2rem]"></div>
              <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-amber-500 rounded-tr-[2rem]"></div>
              <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-amber-500 rounded-bl-[2rem]"></div>
              <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-amber-500 rounded-br-[2rem]"></div>
            </div>
          </div>

          {/* 底部提示文字 */}
          <div className="mt-auto p-16 text-center pointer-events-auto">
            <div className="inline-block px-6 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/5">
              <p className="text-amber-500 text-[10px] font-black tracking-widest uppercase">請將 QR Code 置於框內</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        #${containerId} video {
          width: 100vw !important;
          height: 100vh !important;
          object-fit: cover !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
        }
        #${containerId}__scan_region {
            background: transparent !important;
        }
        #${containerId}__scan_region > div {
            border: 3px solid #f59e0b !important;
            border-radius: 24px !important;
            box-shadow: 0 0 0 1000px rgba(0,0,0,0.6) !important;
        }
        @keyframes scan-move {
          0% { top: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan-move {
          animation: scan-move 2.5s linear infinite;
        }
      `}</style>
    </div>
  );
};

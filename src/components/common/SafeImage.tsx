import React, { useState, useEffect } from 'react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    fallbackSrc?: string;
}

/**
 * SafeImage 元件
 * 1. 提供圖片載入失敗時的 fallback 機制
 * 2. 預設使用 lazy loading 減少記憶體消耗
 * 3. 針對 Android 低記憶體環境優化
 */
const SafeImage: React.FC<SafeImageProps> = ({ 
    src, 
    fallbackSrc = '/icon-192.png', 
    alt = '', 
    className, 
    ...props 
}) => {
    const [imgSrc, setImgSrc] = useState<string | undefined>(src);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setImgSrc(src);
        setHasError(false);

        // Cleanup function to help garbage collection in some WebView environments
        return () => {
            // 不要在這裡直接清空 imgSrc，因為 React 的非同步渲染可能會導致問題
            // 這裡留作未來可能的 Android 特定優化擴充點
        };
    }, [src]);

    const handleError = () => {
        if (!hasError) {
            console.warn(`SafeImage: Failed to load ${src}, falling back to ${fallbackSrc}`);
            setHasError(true);
            setImgSrc(fallbackSrc);
        }
    };

    return (
        <img
            src={imgSrc}
            alt={alt}
            className={className}
            onError={handleError}
            loading="lazy" // 預設延遲載入以節省記憶體
            {...props}
        />
    );
};

export default SafeImage;

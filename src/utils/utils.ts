export function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

/**
 * Recursively removes all undefined properties from an object.
 * Firestore does not support 'undefined' as a value.
 */
export const cleanObject = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(cleanObject);
    }

    const cleanedObj: any = {};
    Object.keys(obj).forEach((key) => {
        const value = obj[key];
        if (value !== undefined) {
            cleanedObj[key] = cleanObject(value);
        }
    });
    return cleanedObj;
};

/**
 * Safely executes an async function with error handling and fallback value.
 * Useful for preventing app crashes on mobile devices during network instability.
 */
export const safeAsync = async <T>(
    promise: Promise<T>,
    fallback: T | null = null,
    onError?: (err: any) => void
): Promise<T | null> => {
    try {
        return await promise;
    } catch (err) {
        console.error('SafeAsync error:', err);
        if (onError) onError(err);
        return fallback;
    }
};

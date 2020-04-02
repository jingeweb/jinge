declare function setImmediateFallback(callback: () => void): number;
declare function clearImmediateFallback(handle: number): void;
declare global {
    interface Window {
        setImmediate: (callback: () => void) => number;
        clearImmediate: (immediate: number) => void;
    }
}
export declare const setImmediate: typeof setImmediateFallback;
export declare const clearImmediate: typeof clearImmediateFallback;
export {};

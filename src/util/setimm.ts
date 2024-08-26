/**
 * setImmediate polyfill only for modern browsers
 */
import { isUndefined, isString } from './type';
declare global {
  interface Window {
    setImmediate(callback: () => void): number;
    clearImmediate(immediate: number): void;
  }
}

isUndefined(window.setImmediate) &&
  (function setImmediatePolyfill() {
    let nextHandle = 1; // Spec says greater than zero
    const tasksByHandle: Map<number, () => void> = new Map();

    function runIfPresent(handle: number): void {
      try {
        const fn = tasksByHandle.get(handle);
        if (fn) {
          tasksByHandle.delete(handle);
          fn();
        }
      } catch (ex) {
        console.error(ex);
      }
    }
    function clearImmediateFallback(handle: number): void {
      tasksByHandle.delete(handle);
    }
    (window as Window).clearImmediate = clearImmediateFallback;
    if (!isUndefined(window.queueMicrotask)) {
      // 绝大部分现代浏览器都支持 queueMicrotask: https://caniuse.com/?search=queueMicrotask
      (window as Window).setImmediate = function setImmediateFallback(callback: () => void) {
        const handle = nextHandle++;
        tasksByHandle.set(handle, callback);
        window.queueMicrotask(() => {
          runIfPresent(handle);
        });
        return handle;
      };
    } else {
      const PREFIX = `setImmediate$${Date.now().toString(32)}${Math.floor(Math.random() * 0xffffff).toString(32)}$`;
      (window as Window).setImmediate = function setImmediateFallback(
        callback: () => void,
      ): number {
        const handle = nextHandle++;
        tasksByHandle.set(handle, callback);

        window.postMessage(`${PREFIX}${nextHandle}`);
        // console.log('siiii', callback);
        return handle;
      };
      window.addEventListener('message', (ev) => {
        if (ev.source !== window || !isString(ev.data) || !ev.data.startsWith(PREFIX)) {
          return;
        }
        runIfPresent(parseInt(ev.data.slice(PREFIX.length)));
      });
    }
  })();
export const setImmediate = (window as Window).setImmediate;
export const clearImmediate = (window as Window).clearImmediate;

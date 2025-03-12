import {
  type AnyFn,
  type PropertyPathItem,
  type UnwatchFn,
  type ViewModel,
  type WatchHandler,
  type WatchOptions,
  vmWatch,
} from '../../src';

export function expectWatch(
  vm: ViewModel,
  expectFn: AnyFn,
  updateFn: AnyFn,
  path?: PropertyPathItem | PropertyPathItem[],
  options?: WatchOptions,
) {
  setTimeout(updateFn);
  return new Promise<void>((resolve) => {
    let unwatchFn: UnwatchFn;
    const cb: WatchHandler = (nv, ov, p) => {
      expectFn(nv, ov, p);
      unwatchFn?.();
      resolve();
    };
    if (path) {
      unwatchFn = vmWatch(vm, path as PropertyPathItem[], cb, options);
    } else {
      unwatchFn = vmWatch(vm, cb);
    }
  });
}

export function mockOffscreenCanvas() {
  if (typeof global.OffscreenCanvas === 'undefined') {
    global.OffscreenCanvas = class OffscreenCanvas {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(width: number, height: number) {
        //
      }
    } as unknown as typeof global.OffscreenCanvas;
  }
}

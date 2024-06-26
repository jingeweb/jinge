import { AnyFn } from "src/util";


export interface ListenerOptions {
  once?: boolean;
  /**
   * bellow options only for dom listener
   */
  capture?: boolean;
  passive?: boolean;
  stop?: boolean;
  prevent?: boolean;
}


const LISTENERS = Symbol();

export type EventMap = {
  [key: string]: AnyFn;
};

export class Emitter<Events extends EventMap> {
  [LISTENERS]?: Map<keyof Events, Map<AnyFn, ListenerOptions | undefined>>;

  // constructor(initializeListeners?: {
  //   [E in keyof Events]: {
  //     fn: Events[E];
  //     opts: ListenerOptions;
  //   };
  // }) {
  //   this[MESSENGER] = null;

  //   if (initializeListeners) {
  //     for (const eventName in initializeListeners) {
  //       const handler = initializeListeners[eventName];
  //       this.__on(eventName, handler.fn, handler.opts);
  //     }
  //   }
  // }

  __emit<E extends keyof Events>(eventName: E, ...args: Parameters<Events[E]>) {
    const listeners = this[LISTENERS]?.get(eventName);
    listeners?.forEach((opts, fn) => {
      try {
        fn(...args);
      } catch (ex) {
        // eslint-disable-next-line no-console
        console.error('failed __notify', eventName, 'due to:', ex);
      }
      if (opts?.once) {
        listeners.delete(fn);
      }
    });
  }

  /**
   * 监听事件，返回该监听的卸载函数
   */
  __on<E extends keyof Events>(eventName: E, eventListener: Events[E], options?: ListenerOptions) {
    let map = this[LISTENERS];
    if (!map) map = this[LISTENERS] = new Map();
    let listeners = map.get(eventName);
    if (!listeners) {
      map.set(eventName, (listeners = new Map()));
    }
    listeners.set(eventListener, options);

    return () => {
      listeners.delete(eventListener);
    };
  }
}

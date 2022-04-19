export type MessengerListener = (...args: unknown[]) => void;
export interface MessengerListenerOptions {
  once?: boolean;
  /**
   * bellow options only for dom listener
   */
  capture?: boolean;
  passive?: boolean;
  stop?: boolean;
  prevent?: boolean;
}
export interface MessengerHandler {
  fn: MessengerListener;
  opts?: MessengerListenerOptions;
}

export const MESSENGER_LISTENERS = Symbol('listeners');

export class Messenger {
  [MESSENGER_LISTENERS]: Map<string, Map<MessengerListener, MessengerListenerOptions>>;

  constructor(templateListeners?: Record<string, MessengerHandler>) {
    this[MESSENGER_LISTENERS] = null;

    if (templateListeners) {
      for (const eventName in templateListeners) {
        const handler = templateListeners[eventName];
        this.__on(eventName, handler.fn, handler.opts);
      }
    }
  }

  __notify(eventName: string, ...args: unknown[]): void {
    if (!this[MESSENGER_LISTENERS]) return;
    const listeners = this[MESSENGER_LISTENERS].get(eventName);
    if (!listeners) return;
    listeners.forEach((opts, handler) => {
      handler(...args);
      if (opts?.once) {
        listeners.delete(handler);
      }
    });
  }

  __on(eventName: string, eventListener: MessengerListener, options?: MessengerListenerOptions): void {
    if (!this[MESSENGER_LISTENERS]) {
      this[MESSENGER_LISTENERS] = new Map();
    }
    let listeners = this[MESSENGER_LISTENERS].get(eventName);
    if (!listeners) {
      this[MESSENGER_LISTENERS].set(eventName, (listeners = new Map()));
    }
    listeners.set(eventListener, options);
  }

  /**
   * clear all event listeners.
   */
  __off(): void;
  /**
   * clear all event listeners bind on special event name.
   */
  __off(eventName: string): void;
  /**
   * clear special event listener bind on special event name.
   */
  __off(eventName: string, eventListener: MessengerListener): void;
  __off(eventName?: string, eventListener?: MessengerListener): void {
    const lisMap = this[MESSENGER_LISTENERS];
    if (!lisMap) {
      return;
    }
    if (!eventName) {
      lisMap.forEach((listeners) => listeners.clear());
      lisMap.clear();
      return;
    }
    const listeners = lisMap.get(eventName);
    if (!listeners) {
      return;
    }
    if (!eventListener) {
      listeners.clear();
    } else {
      listeners.delete(eventListener);
    }
  }
}

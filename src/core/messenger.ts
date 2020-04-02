import {
  warn
} from '../util';

export type MessengerListener = (...args: unknown[]) => void;
export interface MessengerListenerOptions {
  capture?: boolean;
  passive?: boolean;
  once?: boolean;
  stop?: boolean;
  prevent?: boolean;
  prepend?: boolean;
}
export interface MessengerHandler {
  fn: MessengerListener;
  opts?: MessengerListenerOptions;
}

export const MESSENGER_LISTENERS = Symbol('listeners');

export class Messenger {
  [MESSENGER_LISTENERS]: Map<string, MessengerHandler[]>;

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
    listeners.forEach(handler => {
      handler.fn(...args);
    });
  }

  __on(eventName: string, eventListener: MessengerListener, options?: MessengerListenerOptions): void {
    if (!this[MESSENGER_LISTENERS]) {
      this[MESSENGER_LISTENERS] = new Map();
    }
    let listeners = this[MESSENGER_LISTENERS].get(eventName);
    if (!listeners) {
      this[MESSENGER_LISTENERS].set(eventName, listeners = []);
    }
    if (listeners.findIndex(it => {
      return it.fn === eventListener;
    }) >= 0) {
      warn('dulplicated messenger listener', eventName, eventListener);
      return;
    }
    let fn = eventListener;
    if (options && options.once) {
      fn = (...args: unknown[]): void => {
        eventListener(...args);
        this.__off(eventName, eventListener);
      };
    }
    if (options && options.prepend) {
      listeners.unshift({
        fn, opts: options
      });
    } else {
      listeners.push({
        fn, opts: options
      });
    }
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
    if (!this[MESSENGER_LISTENERS]) return;
    if (!eventName) {
      this[MESSENGER_LISTENERS].clear();
      return;
    }
    const listeners = this[MESSENGER_LISTENERS].get(eventName);
    if (!listeners) return;
    if (!eventListener) {
      listeners.length = 0;
      return;
    }
    const idx = listeners.findIndex(it => {
      return it.fn === eventListener;
    });
    listeners.splice(idx, 1);
  }
}

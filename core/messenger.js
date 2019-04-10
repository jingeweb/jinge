import {
  Symbol
} from '../util';

export const LISTENERS = Symbol('listeners');

export function notifyHelper(listenersMap, notifyKey, ...notifyArgs) {
  if (!listenersMap) return;
  const listeners = listenersMap.get(notifyKey);
  if (!listeners) return;
  listeners.forEach(handler => handler(...notifyArgs));
}

export function onHelper(listenersMap, notifyKey, listener) {
  let listeners = listenersMap.get(notifyKey);
  if (!listeners) {
    listeners = [];
    listenersMap.set(notifyKey, listeners);
  }
  if (listeners.indexOf(listener) < 0) {
    listeners.push(listener);
  }
}

export function offHelper(listenersMap, notifyKey, listener) {
  if (!listenersMap) return;
  if (!notifyKey) {
    listenersMap.forEach(ls => ls.length = 0);
    listenersMap.clear();
    return;
  }
  const listeners = listenersMap.get(notifyKey);
  if (!listeners) return;
  if (!listener) {
    listeners.length = 0; // clear all if listener is not provided
    return;
  }
  const idx = listeners.indexOf(listener);
  if (idx < 0) return;
  listeners.splice(idx, 1);
}

export function clearHelper(listenersMap, notifyKey) {
  if (!listenersMap) return;
  if (!notifyKey) {
    listenersMap.clear();
  } else {
    listenersMap.delete(notifyKey);
  }
}

export function onceHelper(listenersMap, notifyKey, listener) {
  function onceListener(...args) {
    listener(...args);
    offHelper(listenersMap, notifyKey, onceListener);
  }
  onHelper(listenersMap, notifyKey, onceListener);
}

export class Messenger {
  constructor() {
    this[LISTENERS] = null;
  }
  notify(eventName, ...args) {
    notifyHelper(this[LISTENERS], eventName, ...args);
  }
  on(eventName, eventListener, opts) {
    const me = this;
    if (!me[LISTENERS]) {
      me[LISTENERS] = new Map();
    }
    if (opts) {
      eventListener.tag = opts;
    }
    if (opts && opts.once) {
      onceHelper(me[LISTENERS], eventName, eventListener);
    } else {
      onHelper(me[LISTENERS], eventName, eventListener);
    }
  }
  off(eventName, eventListener) {
    offHelper(this[LISTENERS], eventName, eventListener);
  }
  clear(eventName) {
    clearHelper(this[LISTENERS], eventName);
  }
}
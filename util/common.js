
export function Symbol(description) {
  return window.Symbol(description);
}

export function assert_fail(msg) {
  msg && console.error(msg);
  throw new Error('assert failed!');
}

export function startsWith(str, search, position = 0) {
  return str.startsWith( search, position);
}

export function defineProperty(...args) {
  return Object.defineProperty(...args);
}

export function obj2class(obj) {
  return Object.keys(obj).map(k => {
    return obj[k] ? k : '';
  }).join(' ');
}

export function defineProperties(...args) {
  return Object.defineProperties(...args);
}

export function simpleUUID() {
  return Date.now().toString(32) + Math.floor(Math.random() * 0xffff).toString(32);
}

export const raf = window.requestAnimationFrame;
export const caf = window.cancelAnimationFrame;

export function mapObject(obj, fn) {
  const newObj = {};
  for(const k in obj) {
    newObj[k] = fn(obj[k], k);
  }
  return newObj;
}

export function Symbol(description) {
  return window.Symbol(description);
}

export function assertFail(msg) {
  msg && console.error(msg);
  throw new Error('assert failed!');
}

export function startsWith(str, search, position = 0) {
  return str.startsWith(search, position);
}

export function defineProperty(...args) {
  return Object.defineProperty(...args);
}

export function assignObject(target, ...srcs) {
  return Object.assign(target, ...srcs);
}

export function obj2class(obj, prepend) {
  const classes = Object.keys(obj).map(k => {
    return obj[k] ? k : '';
  }).join(' ').trim();
  return prepend ? `${prepend} ${classes}` : classes;
}

export function obj2style(obj) {
  return Object.keys(obj).map(k => {
    return `${k}: ${obj[k]}`;
  }).join(';').trim();
}

export function defineProperties(...args) {
  return Object.defineProperties(...args);
}

export function uid() {
  return Date.now().toString(32) + Math.floor(Math.random() * 0xffff).toString(32);
}

export const raf = window.requestAnimationFrame;
export const caf = window.cancelAnimationFrame;

export function mapObject(obj, fn) {
  const newObj = {};
  for (const k in obj) {
    newObj[k] = fn(obj[k], k);
  }
  return newObj;
}

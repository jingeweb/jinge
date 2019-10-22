export function typeOf(v) {
  return typeof v;
}

export function isObject(v) {
  return v !== null && typeOf(v) === 'object';
}

export function isString(v) {
  return typeOf(v) === 'string';
}

export function isNumber(v) {
  return typeOf(v) === 'number' && !Number.isNaN(v) && Number.isFinite(v);
}

export function isUndefined(v) {
  return typeOf(v) === 'undefined';
}

export function isArray(v) {
  // const ov = isObject(v) && v.constructor === Array;
  // const nv = Array.isArray(v);
  // if (ov !== nv) debugger
  return Array.isArray(v);
  // return isObject(v) && (
  //   v.constructor === Array ||
  //   Object.prototype.toString.call(v) === '[object Array]'
  // );
}

export function isBoolean(v) {
  return typeof v === 'boolean' || instanceOf(v, Boolean);
}

export function isFunction(v) {
  return typeOf(v) === 'function';
}

export function instanceOf(v, Clazz) {
  return v instanceof Clazz;
}

export function isDOMNode(ele) {
  return instanceOf(ele, Node);
}

export function isPromise(obj) {
  return isObject(obj) && isFunction(obj.then);
}

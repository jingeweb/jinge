export function typeOf(v: unknown): string {
  return typeof v;
}

export function isObject(v: unknown): boolean {
  return v !== null && typeOf(v) === 'object';
}

export function isString(v: unknown): boolean {
  return typeOf(v) === 'string';
}

export function isNumber(v: unknown): boolean {
  return typeOf(v) === 'number' && !Number.isNaN(v as number) && Number.isFinite(v as number);
}

export function isUndefined(v: unknown): boolean {
  return typeOf(v) === 'undefined';
}

export function isArray(v: unknown): boolean {
  return Array.isArray(v);
}

export function isBoolean(v: unknown): boolean {
  return typeof v === 'boolean' || v instanceof Boolean;
}

export function isFunction(v: unknown): boolean {
  return typeOf(v) === 'function';
}

export function isPromise(obj: { then?: unknown }): boolean {
  return isObject(obj) && isFunction(obj.then);
}

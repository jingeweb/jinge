export function typeOf(v: unknown): string {
  return typeof v;
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeOf(v) === 'object';
}

export function isString(v: unknown): v is string {
  return typeOf(v) === 'string';
}

export function isNumber(v: unknown): v is number {
  return typeOf(v) === 'number' && !Number.isNaN(v as number) && Number.isFinite(v as number);
}

export function isUndefined(v: unknown): v is undefined {
  return typeOf(v) === 'undefined';
}

export function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

export function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean' || v instanceof Boolean;
}

export function isFunction(v: unknown): v is (...args: unknown[]) => unknown {
  return typeOf(v) === 'function';
}

export function isPromise(obj: { then?: unknown }): obj is Promise<unknown> {
  return isObject(obj) && isFunction(obj.then);
}

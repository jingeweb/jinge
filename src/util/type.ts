export function typeOf(v: unknown): string {
  return typeof v;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isObject<T extends object = Record<string | symbol, any>>(v: unknown): v is T {
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

export function isArray<T = unknown>(v: unknown): v is T[] {
  return Array.isArray(v);
}

export function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean' || v instanceof Boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFn = (...args: any[]) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyObj = Record<string | symbol | number, any>;

export function isFunction<T extends AnyFn = AnyFn>(v: unknown): v is T {
  return typeOf(v) === 'function';
}

export function isPromise<T = void>(obj: unknown): obj is Promise<T> {
  return isObject(obj) && isFunction(obj.then);
}

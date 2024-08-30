export const LOOP_DATA = Symbol('LOOP_DATA');
export const KEY_FN = Symbol('KEY_FN');
export const RENDER_LEN = Symbol('RENDER_LEN');
export const KEYS = Symbol('KEYS');

export type Key = string | number | symbol;
export type KeyFn<T> = (value: T, index: number) => Key;

export interface ForProps<T> {
  loop: T[] | undefined | null;
  keyFn?: KeyFn<T>;
}

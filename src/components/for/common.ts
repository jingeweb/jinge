export const LOOP_DATA = Symbol('LOOP_DATA');
export const KEY_FN = Symbol('KEY_FN');
export const LEN = Symbol('LEN');
export const KEYS = Symbol('KEYS');
export const WATING_UPDATE = Symbol('WATING_UPDATE');

export type Key = string | number | symbol;
export type KeyFn<T> = (value: T, index: number) => Key;

export interface ForProps<T> {
  loop: T[] | undefined | null;
  key?: KeyFn<T>;
}

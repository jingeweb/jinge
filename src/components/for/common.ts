import type { ComponentHost } from '../../core';

export type Key = string | number | symbol;
export type KeyMap = Map<Key, number>;
export type KeyFn<T> = (value: T, index: number) => Key;

export const EACH = Symbol('each');
export interface EachVm<T> {
  data: T;
  index: number;
  key?: Key;
}
export type ForEach<T> = ComponentHost & { [EACH]: EachVm<T> };

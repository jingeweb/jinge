import type { ComponentHost } from '../../core';

export type Key<T> = string | number | symbol | T;
export type KeyMap<T> = Map<Key<T>, number>;
export type KeyFn<T> = (value: T, index: number) => Key<T>;

export const KEY_DATA = Symbol('data');
export const KEY_INDEX = Symbol('index');
export interface EachVm<T> {
  data: T;
  index: number;
  key?: Key<T>;
}
export type ForEach<T> = ComponentHost & { [KEY_DATA]: EachVm<T> };

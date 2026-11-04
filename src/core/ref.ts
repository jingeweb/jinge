import type { FC } from '../jsx';
import type { ComponentHost } from './component';

import { type AnyFn, isObject } from '../util';
import { REFS } from './common';

export const REF = Symbol('REF');

export interface Ref<T extends Node | Record<string, AnyFn>> {
  value?: T;
}
export type RefValue<T extends Ref<any> | RefFn<any> | undefined> =
  T extends Ref<infer R>
    ? R
    : T extends RefFn<infer R extends Node | Record<string, AnyFn>>
      ? R
      : never;

export function ref<T extends Node | FC>(): T extends Node
  ? Ref<T>
  : T extends FC
    ? Ref<RefValue<Parameters<T>[0]['ref']>>
    : never {
  return { [REF]: true, value: undefined } as any;
}

export function isRef<T extends Node | Record<string, AnyFn>>(v: object): v is Ref<T> {
  return (v as unknown as { [REF]: boolean })[REF] === true;
}

/** 挂载时接收 DOM 节点或组件公开实例；所属组件卸载时接收 undefined。 */
export type RefFn<T = Node> = (el: T | undefined) => void;

/** 用于给编译器使用的 set ref 函数 */
export function setRefForComponent(
  target: ComponentHost,

  ref: Ref<any> | RefFn<any>,
  el: ComponentHost | Node,
) {
  let rns = target[REFS];
  if (!rns) {
    target[REFS] = rns = [];
  }
  rns.push(ref);

  if (isObject<Ref<any>>(ref)) {
    (ref as Ref<any>).value = el;
  } else {
    (ref as RefFn<any>)(el);
  }
}

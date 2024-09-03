import { isObject } from '../util';
import { REFS } from './common';
import type { ComponentHost } from './component';

export const REF = Symbol('REF');

export interface Ref<T = Node> {
  value?: T;
}

export function ref<T = Node>(): Ref<T> {
  return { [REF]: true, value: undefined } as unknown as Ref<T>;
}

export function isRef<T = Node>(v: object): v is Ref<T> {
  return (v as unknown as { [REF]: boolean })[REF] === true;
}

export type RefFn<T = Node> = (el: T) => void;

/** 用于给编译器使用的 set ref 函数 */
export function setRefForComponent(
  target: ComponentHost,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: Ref<any> | RefFn<any>,
  el: ComponentHost | Node,
) {
  let rns = target[REFS];
  if (!rns) {
    target[REFS] = rns = [];
  }
  rns.push(ref);
  if (isObject<Ref>(ref)) {
    (ref as Ref<Node | ComponentHost>).value = el;
  } else {
    (ref as RefFn<Node | ComponentHost>)(el);
  }
}

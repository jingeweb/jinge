/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FC } from '../jsx';
import { type AnyFn, isObject } from '../util';
import { REFS } from './common';
import type { ComponentHost } from './component';

export const REF = Symbol('REF');

export interface Ref<T extends Node | Record<string, AnyFn>> {
  value?: T;
}
export type RefValue<T extends Ref<any> | undefined> = T extends Ref<infer R> ? R : never;

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

export type RefFn<T = Node> = (el: T) => void;

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

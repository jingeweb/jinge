import { isObject } from '../util';
import { REFS } from './common';
import type { ComponentHost } from './component';

export const REF = Symbol('REF');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Ref<T = Node> {
  value?: T;
}

export function ref<T = Node>(): Ref<T> {
  return { [REF]: true, value: undefined } as unknown as Ref<T>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isRef<T = Node>(v: object): v is Ref<T> {
  return (v as unknown as { [REF]: boolean })[REF] === true;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // let elOrArr = rns.get(ref);
  // if (!elOrArr) {
  //   rns.set(ref, el);
  // } else if (isArray(elOrArr)) {
  //   (elOrArr as (Component | Node)[]).push(el);
  // } else {
  //   elOrArr = [elOrArr as Component, el];
  //   rns.set(ref, elOrArr);
  // }
  // const isComp = isComponent(el);
  // if (!isComp && target === relatedComponent) {
  //   return;
  // }
  // /**
  //  * 如果被 ref: 标记的元素（el）本身就是组件（Component）节点，
  //  *   那么 el 自身就是关联组件，el 自身在被销毁时可以执行删除关联 refs 的操作；
  //  * 如果 el 是 DOM 节点，则必须将它添加到关联组件（比如 <if>） relatedComponent 里，
  //  *   在 relatedComponent 被销毁时执行关联 refs 的删除。
  //  */
  // let rbs = ((isComp ? el : relatedComponent) as Component)[RELATED_REFS];
  // if (!rbs) {
  //   ((isComp ? el : relatedComponent) as Component)[RELATED_REFS] = rbs = [];
  // }
  // rbs.push({
  //   [RELATED_REFS_ORIGIN]: target,
  //   [RELATED_REFS_KEY]: ref,
  //   [RELATED_REFS_NODE]: isComp ? undefined : (el as Node),
  // });
}

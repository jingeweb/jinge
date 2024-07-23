import { isArray } from '../util';
import {
  REFS,
  RELATED_REFS,
  RELATED_REFS_KEY,
  RELATED_REFS_NODE,
  RELATED_REFS_ORIGIN,
} from './common';
import { isComponent, type Component } from './component';

/** 用于给编译器使用的 set ref 函数 */
export function setRefForComponent(
  target: Component,
  ref: string,
  el: Component | Node,
  relatedComponent?: Component,
) {
  let rns = target[REFS];
  if (!rns) {
    target[REFS] = rns = new Map();
  }
  let elOrArr = rns.get(ref);
  if (!elOrArr) {
    rns.set(ref, el);
  } else if (isArray(elOrArr)) {
    (elOrArr as (Component | Node)[]).push(el);
  } else {
    elOrArr = [elOrArr as Component, el];
    rns.set(ref, elOrArr);
  }
  const isComp = isComponent(el);
  if (!isComp && target === relatedComponent) {
    return;
  }
  /**
   * 如果被 ref: 标记的元素（el）本身就是组件（Component）节点，
   *   那么 el 自身就是关联组件，el 自身在被销毁时可以执行删除关联 refs 的操作；
   * 如果 el 是 DOM 节点，则必须将它添加到关联组件（比如 <if>） relatedComponent 里，
   *   在 relatedComponent 被销毁时执行关联 refs 的删除。
   */
  let rbs = ((isComp ? el : relatedComponent) as Component)[RELATED_REFS];
  if (!rbs) {
    ((isComp ? el : relatedComponent) as Component)[RELATED_REFS] = rbs = [];
  }
  rbs.push({
    [RELATED_REFS_ORIGIN]: target,
    [RELATED_REFS_KEY]: ref,
    [RELATED_REFS_NODE]: isComp ? undefined : (el as Node),
  });
}

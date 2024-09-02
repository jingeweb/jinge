/**
 * `transition-group` 使用了取巧地实现方式。对 <For> 组件的每一个 Slot 包装进 TransitionGroupItem，
 * `TransitionGroupItem` 在 `onUnmount` 也就是实际销毁前，先将自身状态主动变更为已销毁，从而欺骗框架层跳过对该组件的销毁，
 * 也就保留了 dom 不被移除，直到 leave 动画结束后，才又将状态变为正常后调用 `destroyComponent` 函数执行实际的销毁。
 */

import type { ComponentHost } from '../../core';
import {
  addUnmountFn,
  COMPONENT_STATE_DESTROIED,
  COMPONENT_STATE_RENDERED,
  CONTEXT,
  DEFAULT_SLOT,
  destroyComponent,
  newComponentWithDefaultSlot,
  renderFunctionComponent,
  renderSlotFunction,
  ROOT_NODES,
  SLOTS,
  STATE,
} from '../../core';
import type { JNode, PropsWithSlots } from '../../jsx';
import { addEvent, throwErr } from '../../util';
import { For, type ForSlot } from '../for';
import type { EachVm, Key } from '../for/common';

import { classnames2tokens, TRANSITION_END } from './helper';
import type { TransitionClassnames } from './transition';

const CLASSNAMES = Symbol('classnames');
const APPEAR = Symbol('appear');

function TransitionGroupItem(
  this: ComponentHost,
  props: PropsWithSlots<
    {
      [CLASSNAMES]: string[][];
      [APPEAR]: boolean;
    },
    JNode
  >,
) {
  const toggleClass = (el: Element, enter: boolean, init = false) => {
    const clist = el.classList;
    const ir = enter ? 2 : 0;
    const ia = enter ? 0 : 2;
    !init && clist.remove(...classTokens[ir], ...classTokens[ir + 1]);
    clist.add(...classTokens[ia], ...classTokens[ia + 1]);
  };

  const classTokens = props[CLASSNAMES];
  const el = newComponentWithDefaultSlot(this[CONTEXT]);
  const nodes = renderSlotFunction(el, this[SLOTS][DEFAULT_SLOT]);
  if (nodes.length > 1 || !(nodes[0] instanceof Element)) {
    throwErr('transition-require-element');
  }
  const rootEl = nodes[0] as Element;

  let tm = 0;

  if (props[APPEAR]) {
    toggleClass(rootEl, false, true);
    tm = window.setTimeout(() => {
      toggleClass(rootEl, true);
    }, 10);
  } else {
    toggleClass(rootEl, true, true);
  }

  addUnmountFn(this, () => {
    if (tm) clearTimeout(tm);
    // 在实际销毁前，先将自身状态主动变更为已销毁，从而欺骗框架层跳过对该组件的销毁，也就保留了 dom 不被移除。
    el[STATE] = COMPONENT_STATE_DESTROIED;
    toggleClass(rootEl, false);
    addEvent(rootEl, TRANSITION_END, () => {
      // leave 动画结束后，才又将状态变为正常后调用 `destroyComponent` 函数执行实际的销毁。
      el[STATE] = COMPONENT_STATE_RENDERED;
      destroyComponent(el);
    });
  });

  this[ROOT_NODES].push(el);
  return nodes;
}

export type TransitionGroupProps<T> = {
  loop: T[] | null | undefined;
  /** TransitionGroup 必须指定 keyFn */
  keyFn: (v: T, index: number) => Key;
  appear?: boolean;
};

export function TransitionGroup<T>(
  this: ComponentHost,
  props: PropsWithSlots<TransitionGroupProps<T> & TransitionClassnames, ForSlot<T>>,
) {
  const itemProps = {
    [CLASSNAMES]: classnames2tokens(props),
    [APPEAR]: !!props.appear,
  };
  const renderEachFn = (host: ComponentHost, forEachVm: EachVm<T>) => {
    const el = newComponentWithDefaultSlot(host[CONTEXT], (tranHost) => {
      return this[SLOTS][DEFAULT_SLOT]?.(tranHost, forEachVm) ?? [];
    });
    host[ROOT_NODES].push(el);
    return renderFunctionComponent(el, TransitionGroupItem, itemProps);
  };

  const el = newComponentWithDefaultSlot(this[CONTEXT], renderEachFn);
  this[ROOT_NODES].push(el);
  const nodes = renderFunctionComponent(el, For, props);
  itemProps[APPEAR] = true;
  return nodes;
}

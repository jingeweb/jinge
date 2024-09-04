/**
 * `transition-group` 使用了取巧地实现方式。对 <For> 组件的每一个 Slot 包装进 TransitionGroupItem，
 * `TransitionGroupItem` 在 `onUnmount` 也就是实际销毁前，先将自身状态主动变更为已销毁，从而欺骗框架层跳过对该组件的销毁，
 * 也就保留了 dom 不被移除，直到 leave 动画结束后，才又将状态变为正常后调用 `destroyComponent` 函数执行实际的销毁。
 */

import type { ComponentHost } from '../../core';
import {
  COMPONENT_STATE_DESTROIED,
  COMPONENT_STATE_RENDERED,
  CONTEXT,
  DEFAULT_SLOT,
  ROOT_NODES,
  SLOTS,
  STATE,
  addUnmountFn,
  destroyComponent,
  newComponentWithDefaultSlot,
  renderFunctionComponent,
  renderSlotFunction,
} from '../../core';
import type { JNode, PropsWithSlots } from '../../jsx';
import { type AnyFn, addEvent, throwErr } from '../../util';
import { For, type ForSlot } from '../for';
import type { EachVm, Key } from '../for/common';

import { TRANSITION_END, classnames2tokens } from './helper';
import type { TransitionClassnames } from './transition';

const CLASSNAMES = Symbol('classnames');
const APPEAR = Symbol('appear');
const ONDESTROY = Symbol('onDestroy');

export function TransitionGroupItem(
  this: ComponentHost,
  props: PropsWithSlots<
    {
      [CLASSNAMES]: string[][];
      [APPEAR]: boolean;
      [ONDESTROY]: (fn: AnyFn) => AnyFn;
    },
    JNode
  >,
) {
  const classTokens = props[CLASSNAMES];
  const toggleClass = (el: Element, enter: boolean, init = false) => {
    const clist = el.classList;
    const ir = enter ? 2 : 0;
    const ia = enter ? 0 : 2;
    !init && clist.remove(...classTokens[ir], ...classTokens[ir + 1]);
    clist.add(...classTokens[ia], ...classTokens[ia + 1]);
  };

  let el: ComponentHost | undefined = newComponentWithDefaultSlot(this[CONTEXT]);
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

  const finalDestroy = () => {
    if (!el) return;
    el[STATE] = COMPONENT_STATE_RENDERED;
    destroyComponent(el);
    el = undefined;
  };
  // 在实际销毁前，先将自身状态主动变更为已销毁，从而欺骗框架层跳过对该组件的销毁，也就保留了 dom 不被移除。
  // 但保留的 dom 在某种形式上成了垂悬对象，也就是即使父组件 TransitionGroup 整体被销毁时也还是存在，为了避免这个问题，
  // 通过 props[ONDESTROY] 向父组件注册监听器，当父组件整体都被销毁时，直接立即销毁当前保留的还在动画中的 dom
  const dereg = props[ONDESTROY](finalDestroy);

  addUnmountFn(this, () => {
    if (tm) clearTimeout(tm);
    if (!el) return;
    // 在实际销毁前，先将自身状态主动变更为已销毁，从而欺骗框架层跳过对该组件的销毁，也就保留了 dom 不被移除。
    el[STATE] = COMPONENT_STATE_DESTROIED;
    toggleClass(rootEl, false);

    addEvent(
      rootEl,
      TRANSITION_END,
      () => {
        dereg(); // 将 finalDestroy 从监听列表删除，防止内存泄露。
        // leave 动画结束后，才又将状态变为正常后调用 `destroyComponent` 函数执行实际的销毁。
        finalDestroy();
      },
      { once: true },
    );
  });

  this[ROOT_NODES].push(el);
  return nodes;
}

export interface TransitionGroupProps<T> {
  loop: T[] | null | undefined;
  /** TransitionGroup 必须指定 keyFn */
  keyFn: (v: T, index: number) => Key;
  appear?: boolean;
}

export function TransitionGroup<T>(
  this: ComponentHost,
  props: PropsWithSlots<TransitionGroupProps<T> & TransitionClassnames, ForSlot<T>>,
) {
  const onDestroyNotifies = new Set<AnyFn>();
  const itemProps = {
    [CLASSNAMES]: classnames2tokens(props),
    [APPEAR]: !!props.appear,
    [ONDESTROY]: (fn: AnyFn) => {
      onDestroyNotifies.add(fn);
      return () => onDestroyNotifies.delete(fn);
    },
  };

  addUnmountFn(this, () => {
    onDestroyNotifies.forEach((notifyFn) => notifyFn());
    onDestroyNotifies.clear();
  });
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

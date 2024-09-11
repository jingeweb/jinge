import type { FC } from '../jsx';
import type { AnyFn } from '../util';
import { isFunction, isObject, throwErr } from '../util';

import type { ComponentState, Context, ContextState, Slots } from './common';
import {
  COMPONENT_STATE_DESTROIED,
  COMPONENT_STATE_INITIALIZE,
  COMPONENT_STATE_RENDERED,
  COMPONENT_STATE_WILLDESTROY,
  CONTEXT,
  CONTEXT_STATE,
  CONTEXT_STATE_TOUCHED,
  CONTEXT_STATE_TOUCHED_FREEZED,
  CONTEXT_STATE_UNTOUCH,
  CONTEXT_STATE_UNTOUCH_FREEZED,
  DEFAULT_SLOT,
  NON_ROOT_COMPONENT_NODES,
  ONMOUNT,
  REFS,
  ROOT_NODES,
  SLOTS,
  STATE,
  UNMOUNT_FNS,
  __,
} from './common';
import { setCurrentComponentHost } from './hook';
import type { Ref, RefFn } from './ref';

/**
 * 用于判定是否是 Component 的函数。比 instanceof 要快很多。https://jsperf.app/bufamo
 */
export function isComponent(v: unknown): v is ComponentHost {
  return !!(v as Record<symbol, unknown>)[__];
}

export class ComponentHost {
  /**
   * 用于判定是否是 Component 的属性。比 instanceof 要快很多。https://jsperf.app/bufamo
   */
  readonly [__] = true;
  /**
   * 将构造函数传递来的 attrs 存下来，以便可以在后期使用，以及在组件销毁时销毁该 attrs。
   * 如果传递的 attrs 不是 ViewModel，则说明没有需要监听绑定的 attribute，不保存该 attrs。
   */
  // [PASSED_ATTRIBUTES]?: ViewModel;
  /**
   * 组件的上下文对象
   */
  [CONTEXT]?: Context;
  [CONTEXT_STATE]: ContextState = CONTEXT_STATE_UNTOUCH;
  /**
   * 编译器传递进来的渲染函数，跟 WebComponent 里的 Slot 概念类似。
   */
  [SLOTS]: Slots;

  /**
   * 组件的状态
   */
  [STATE]: ComponentState = COMPONENT_STATE_INITIALIZE;

  /**
   * NON_ROOT_COMPONENT_NODES means nearest non-root component-nodes in the view-tree.
   * Node in view-tree have two types, html-node and component-node.
   *   html-node include html dom node and html text node,
   *   component-node is an instance of a Component.
   * For example, we have rendered a view-tree:
   *             RootApp(Component)
   *             /     |          \
   *         h1(Html)  h2(Html)  A(Component)
   *            |                 |
   *        C(Component)     D(Component)
   *
   * The nearest non-root component-nodes of RootApp include C,
   *   but not include A(as it's root) or D(as it's not nearest).
   *
   * By the way, the ROOT_NODES of view-tree above is [h1, h2, A]
   */
  [NON_ROOT_COMPONENT_NODES]: ComponentHost[] = [];
  // /**
  //  * refs contains all children with ref: attribute.
  //  *
  //  * 使用 ref: 标记的元素（Component 或 html node），会保存在 REF_NODES 中，
  //  *   之后通过 __getRef 函数可以获取到元素实例。
  //  */
  // [REFS]?: Map<string, Component | Node | (Component | Node)[]>;
  [REFS]?: (Ref<Node | ComponentHost> | RefFn<Node | ComponentHost>)[];

  [ONMOUNT]?: AnyFn[];
  /**
   * store functions will be called before unmount/destroy
   */
  [UNMOUNT_FNS]?: AnyFn[];
  /**
   * ROOT_NODES means root children of this component,
   *   include html-nodes and component-nodes.
   * We use this infomation to remove DOM after this component is destroied.
   * We do not maintain the whole parent-child view-tree but only root children,
   * because when we remove the root children, whole view-tree will be
   * removed, so we do not need waste memory to maintain whole view-tree.
   */
  [ROOT_NODES]: (ComponentHost | Node)[] = [];

  constructor() {
    this[SLOTS] = {};
  }
}

///// 以下为不常用的函数，不作为 Component 的类成员函数，可以尽量减少打包产物的大小 //////

/**
 * Get first rendered DOM Node after Component is rendered.
 *
 * 按从左往右从上到下的深度遍历，找到的第一个 DOM 节点。
 */
export function getFirstDOM<T = Node>(component: ComponentHost): T {
  const el = component[ROOT_NODES][0];
  return isComponent(el) ? getFirstDOM(el) : (el as T);
}

/**
 * Get last rendered DOM Node after Component is rendered.
 *
 * 按从右往左，从上到下的深度遍历，找到的第一个 DOM 节点（相对于从左到右的顺序是最后一个 DOM 节点）。
 */
export function getLastDOM<T = Node>(component: ComponentHost): T {
  const rns = component[ROOT_NODES];
  const el = rns[rns.length - 1];
  return isComponent(el) ? getLastDOM(el) : (el as T);
}

export function handleRenderDone(component: ComponentHost) {
  /*
   * Set NOTIFIABLE=true to enable ViewModel notify.
   * Don't forgot to add these code if you override HANDLE_AFTER_RENDER
   */

  for (const n of component[ROOT_NODES]) {
    if (isComponent(n)) {
      handleRenderDone(n);
    }
  }
  for (const n of component[NON_ROOT_COMPONENT_NODES]) {
    handleRenderDone(n);
  }

  component[ONMOUNT]?.forEach((onMountFn) => {
    const dereg = onMountFn();
    if (isFunction(dereg)) {
      addUnmountFn(component, dereg);
    }
  });
  // onMount 事件后，函数不会再被执行，可以清理函数。
  component[ONMOUNT] && (component[ONMOUNT].length = 0);

  component[STATE] = COMPONENT_STATE_RENDERED;
  component[CONTEXT_STATE] =
    component[CONTEXT_STATE] === CONTEXT_STATE_TOUCHED
      ? CONTEXT_STATE_TOUCHED_FREEZED
      : CONTEXT_STATE_UNTOUCH_FREEZED; // has been rendered, can't modify context
}

export function addMountFn(component: ComponentHost, fn: AnyFn) {
  let fns = component[ONMOUNT];
  if (!fns) fns = component[ONMOUNT] = [];
  fns.push(fn);
}
export function addUnmountFn(component: ComponentHost, fn: AnyFn) {
  let fns = component[UNMOUNT_FNS];
  if (!fns) fns = component[UNMOUNT_FNS] = [];
  fns.push(fn);
}

/**
 * 销毁组件的内容，但不销毁组件本身。
 */
export function destroyComponentContent(target: ComponentHost, removeDOM = false) {
  for (const component of target[NON_ROOT_COMPONENT_NODES]) {
    // it's not necessary to remove dom when destroy non-root component,
    // because those dom nodes will be auto removed when their parent dom is removed.
    destroyComponent(component, false);
  }

  let $parent: Node | null = null;
  for (const node of target[ROOT_NODES]) {
    if (isComponent(node)) {
      destroyComponent(node, removeDOM);
    } else if (removeDOM) {
      if (!$parent) {
        $parent = (node as Node).parentNode;
      }
      $parent!.removeChild(node as Node);
    }
  }
}

/**
 * 销毁组件
 */
export function destroyComponent(target: ComponentHost, removeDOM = true) {
  if (target[STATE] >= COMPONENT_STATE_WILLDESTROY) return;
  target[STATE] = COMPONENT_STATE_WILLDESTROY;

  target[UNMOUNT_FNS]?.forEach((fn) => fn());
  target[UNMOUNT_FNS] && (target[UNMOUNT_FNS].length = 0);

  // destroy children(include child component and html nodes)
  destroyComponentContent(target, removeDOM);

  target[REFS]?.forEach((ref) => {
    if (isObject<Ref>(ref)) ref.value = undefined;
    else (ref as RefFn<undefined>)(undefined);
  });
  target[REFS] && (target[REFS].length = 0);
  target[STATE] = COMPONENT_STATE_DESTROIED;
  target[ROOT_NODES].length = 0;
  target[NON_ROOT_COMPONENT_NODES].length = 0;
  target[CONTEXT] = undefined;
}

/** 重置组件，销毁旧的，重置为全新。目前此函数仅用于 hmr 时更新组件。 */
export function resetComponent(target: ComponentHost, context: Context) {
  destroyComponent(target);
  target[STATE] = COMPONENT_STATE_INITIALIZE;
  target[SLOTS] = {};
  target[CONTEXT] = context;
  target[CONTEXT_STATE] = CONTEXT_STATE_UNTOUCH;
}

export function getComponentContext<T = unknown>(component: ComponentHost, key: string | symbol) {
  return component[CONTEXT]?.[key] as T;
}
export function setComponentContext(
  component: ComponentHost,
  key: string | symbol,
  value: unknown,
) {
  const contextState = component[CONTEXT_STATE];
  if (
    contextState === CONTEXT_STATE_UNTOUCH_FREEZED ||
    contextState === CONTEXT_STATE_TOUCHED_FREEZED
  ) {
    throwErr('setctx-after-render');
  }
  let context = component[CONTEXT];
  if (contextState === CONTEXT_STATE_UNTOUCH) {
    // we copy context to make sure child component do not modify context passed from parent.
    // we do not copy it by default until setContext function is called, because it unnecessary to waste memory if
    // child component do not modify the context.
    context = component[CONTEXT] = Object.assign({}, component[CONTEXT]);
    component[CONTEXT_STATE] = CONTEXT_STATE_TOUCHED; // has been copied.
  }
  if (!context) return;

  context[key] = value;
}
/**
 * 给编译器使用的创建 Component 并同时设置 SLOTS 的函数
 */
export function newComponentWithSlots(context: Context | undefined, slots: Slots) {
  const c = new ComponentHost();
  c[CONTEXT] = context;
  Object.assign(c[SLOTS], slots);
  return c;
}

/**
 * 给编译器使用的创建 Component 并同时设置 DEFAULT_SLOT 的函数
 */
export function newComponentWithDefaultSlot(
  context: Context | undefined,
  defaultSlot?: Slots[typeof DEFAULT_SLOT] | undefined,
) {
  const c = new ComponentHost();
  c[CONTEXT] = context;
  defaultSlot && (c[SLOTS][DEFAULT_SLOT] = defaultSlot);
  return c;
}

export function renderFunctionComponent<T extends FC>(
  host: ComponentHost,
  fc: T,
  attrs?: Omit<Parameters<T>[0], 'children'>,
) {
  // BEGIN_DROP_IN_PRODUCTION
  // 注意必须从 window 上取 __JINGE_HMR__，不要直接 import from '../hmr'，因为要解偶代码依赖，防止 hmr 相关代码被打包到产物中。

  // 渲染逻辑执行时，fc 有可能是内存中的旧版本，新版本通过 hmr 已经被更新，
  // 因此先通过 getLatestFunctionComponent 拿到最版本的组件。
  const __HMR__ = window.__JINGE_HMR__;
  if (__HMR__) {
    fc = __HMR__.getLatestFunctionComponent(fc) as T;
    __HMR__.registerComponentInstance(fc, host, attrs, host[CONTEXT]);
  }
  // END_DROP_IN_PRODUCTION

  setCurrentComponentHost(host);
  const nodes = fc.call(host, attrs);
  setCurrentComponentHost(undefined);
  return nodes as Node[];
}

export function renderSlotFunction(host: ComponentHost, fc?: AnyFn, attrs?: object) {
  if (!fc) return [];
  setCurrentComponentHost(host);
  const nodes = fc(host, attrs);
  setCurrentComponentHost(undefined);
  return nodes as Node[];
}

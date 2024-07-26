import { innerWatchPath } from '../vm';
import type { AnyFn } from '../util';
import { appendChildren, replaceChildren, throwErr, isObject } from '../util';

import type { ViewModel, ViewModelCore } from '../vm/core';
import {
  $$,
  VM_NOTIFIABLE,
  VM_PROXY,
  VM_TARGET,
  destroyViewModelCore,
  isPublicProperty,
} from '../vm/core';
import { proxyComponent } from '../vm/proxy';
import type { ComponentState, ContextState, Slots } from './common';
import {
  DEFAULT_SLOT,
  RELATED_WATCH,
  UNMOUNT_FNS,
  REFS,
  // RELATED_REFS,
  // RELATED_REFS_KEY,
  // RELATED_REFS_NODE,
  // RELATED_REFS_ORIGIN,
  NON_ROOT_COMPONENT_NODES,
  ROOT_NODES,
  STATE,
  CONTEXT,
  CONTEXT_STATE,
  SLOTS,
  __,
  COMPONENT_STATE_INITIALIZE,
  COMPONENT_STATE_DESTROIED,
  COMPONENT_STATE_WILLDESTROY,
  COMPONENT_STATE_RENDERED,
  CONTEXT_STATE_UNTOUCH,
  CONTEXT_STATE_TOUCHED_FREEZED,
  CONTEXT_STATE_UNTOUCH_FREEZED,
  CONTEXT_STATE_TOUCHED,
} from './common';
import type { Ref, RefFn } from './ref';

/**
 * 用于判定是否是 Component 的函数。比 instanceof 要快很多。https://jsperf.app/bufamo
 */
export function isComponent<T extends Component>(v: unknown): v is T {
  return !!(v as Record<symbol, unknown>)[__];
}

export class Component<
  // eslint-disable-next-line @typescript-eslint/ban-types
  Props extends object = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Children = any,
> {
  /**
   * 用于判定是否是 Component 的属性。比 instanceof 要快很多。https://jsperf.app/bufamo
   */
  readonly [__] = true;

  /**
   * 专门用于 typescript jsx 类型校验的字段，请勿在 render() 函数之外使用。编译器会将 render() 函数里的 this.props.children 转换成 slots 传递。
   */
  get props(): {
    ref?: Ref | RefFn;
    key?: string | number;
    children: Children;
  } & Omit<Props, 'ref' | 'key' | 'children'> {
    // props 专门用于 typescript 类型提示
    throw 'do not use props';
  }

  readonly [$$]: ViewModelCore;
  /**
   * 将构造函数传递来的 attrs 存下来，以便可以在后期使用，以及在组件销毁时销毁该 attrs。
   * 如果传递的 attrs 不是 ViewModel，则说明没有需要监听绑定的 attribute，不保存该 attrs。
   */
  // [PASSED_ATTRIBUTES]?: ViewModel;
  /**
   * 组件的上下文对象
   */
  [CONTEXT]?: Record<string | symbol, unknown>;
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
  [NON_ROOT_COMPONENT_NODES]: Component[] = [];
  // /**
  //  * refs contains all children with ref: attribute.
  //  *
  //  * 使用 ref: 标记的元素（Component 或 html node），会保存在 REF_NODES 中，
  //  *   之后通过 __getRef 函数可以获取到元素实例。
  //  */
  // [REFS]?: Map<string, Component | Node | (Component | Node)[]>;
  [REFS]?: (Ref | RefFn)[];
  /**
   * 当被 ref: 标记的元素属于 <if> 或 <for> 等组件的 slot 时，这些元素被添加到当前模板组件（称为 origin component)的 refs 里，
   *   但显然当 <if> 元素控制销毁时，也需要将这个元素从 origin component 的 refs 中删除，
   *   否则 origin component 中通过 __getRef 还能拿到这个已经被销毁的元素。
   *
   * 为了实现这个目的，会在将 ref: 标记的元素添加到模板组件 refs 中时，同时也添加到 relatedRefs 中，
   *   这样，在关联节点（比如受 <if> 控制的元素，或 <if> 下面的 DOM 节点）被销毁时，
   *   也会从模板组件的 refs 里面删除。
   */
  // [RELATED_REFS]?: {
  //   [RELATED_REFS_ORIGIN]: Component;
  //   [RELATED_REFS_KEY]: string;
  //   [RELATED_REFS_NODE]?: Node;
  // }[];

  /**
   *
   */
  [RELATED_WATCH]?: AnyFn[];

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
  [ROOT_NODES]: (Component | Node)[] = [];

  constructor() {
    this[$$] = {
      // 初始化时 Component 默认的 VM_NOTIFIABLE 为 false，
      // 待 RENDER 结束后才修改为 true，用于避免无谓的消息通知。
      [VM_NOTIFIABLE]: false,
      [VM_TARGET]: this,
      [VM_PROXY]: proxyComponent(this),
    };
    this[SLOTS] = {};
    return this[$$][VM_PROXY] as typeof this;
  }

  /**
   * 将 attrs 的属性（attrName）绑定到组件的同名属性上。调用 watch 监控 attrs[attrName]，在其变更后，更新组件的同名属性。如果提供了 onUpdate 参数，则会调用该函数。
   */
  bindAttr<A extends object, P extends keyof A>(
    attrs: A,
    attrName: keyof A,
    onUpdate?: (v: A[P]) => void,
  ): A[P];

  /**
   * 将 attrs 的属性（attrName）绑定到组件的 componentProp 属性上。调用 watch 监控 attrs[attrName]，在其变理后，更新组件的 componentProp 属性。如果提供了 onUpdate 参数，则会调用该函数。
   */
  bindAttr<A extends object, P extends keyof A, BP extends keyof typeof this>(
    attrs: A,
    attrName: P,
    componentProp: BP,
    onUpdate?: (v: A[P]) => void,
  ): A[P];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bindAttr(attrs: ViewModel, attrName: string, componentProp?: any, onUpdate?: any) {
    if (!isPublicProperty(attrName)) throwErr('bind-attr-not-pub-prop');

    const val = attrs[attrName];
    const core = attrs[$$];
    if (!core) return val;
    if (typeof componentProp === 'function') {
      onUpdate = componentProp;
      componentProp = undefined;
    }
    const unwatchFn = innerWatchPath(
      attrs,
      core,
      val,
      (v) => {
        this[(componentProp ?? attrName) as keyof typeof this] = v;
        onUpdate?.(v);
      },
      [attrName],
    );
    this.addUnmountFn(unwatchFn);
    return val;
  }

  /**
   * 将 unmountFn 函数保存起来，在组件销毁(unmount/destroy)时自动调用。
   *
   * 这是一个辅助功能，相比于通过 onUnmount 生命周期函数来手动管理会更简洁些。
   * 比如一个典型的使用场景是，在 onMount 生命周期函数中，通过 addEventListener 给 dom 元素手动绑定了事件，
   * 然后在 onUnmount 中调用 removeEventListener 移除事件。使用 addUnmountFn 则可以简化为：
   * ```ts
   * import { Component } from 'jinge';
   * class A extends Component {
   *   onMount() {
   *     const btn = this.getRef('button');
   *     btn.addEventListener('click', handler)
   *     this.addUnmountFn(() => {
   *       btn.removeEventListener('click', handler);
   *     });
   *   }
   * }
   * ```
   * 或者使用 `registerEvent` 则可以进一步简化：
   * ```ts
   * import { Component, registerEvent } from 'jinge';
   * class A extends Component {
   *   onMount() {
   *     this.addUnmountFn(registerEvent(this.getRef('button'), 'click', (evt) => {
   *       // click handler
   *     }));
   *   }
   * }
   * ```
   */
  addUnmountFn(unmountFn: () => void): void {
    let deregs = this[UNMOUNT_FNS];
    if (!deregs) {
      this[UNMOUNT_FNS] = deregs = [];
    }
    deregs.push(unmountFn);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render(): any {
    return this[SLOTS][DEFAULT_SLOT]?.(this) ?? [];
  }

  // /**
  //  * 在 nextTick 时调用 update 函数。
  //  */
  // updateNextTick(handler?: AnyFn) {
  //   const updateRenderFn = (this as unknown as { update: AnyFn }).update;
  //   if (!updateRenderFn || this[STATE] !== COMPONENT_STATE_RENDERED) {
  //     return;
  //   }

  //   if (!handler) {
  //     handler = updateRenderFn;
  //   }

  //   let ntMap = this[UPDATE_NEXT_MAP];
  //   if (!ntMap) ntMap = this[UPDATE_NEXT_MAP] = new Map();
  //   if (ntMap.has(handler)) {
  //     // already in queue.
  //     return;
  //   }
  //   ntMap.set(
  //     handler,
  //     setImmediate(() => {
  //       type F = () => void;
  //       ntMap.delete(handler as F);
  //       (handler as F).call(this);
  //     }),
  //   );
  // }

  setContext(key: string | symbol, value: unknown, forceOverride = false) {
    const contextState = this[CONTEXT_STATE];
    if (
      contextState === CONTEXT_STATE_UNTOUCH_FREEZED ||
      contextState === CONTEXT_STATE_TOUCHED_FREEZED
    ) {
      throwErr('setctx-after-render');
    }
    let context = this[CONTEXT];
    if (contextState === CONTEXT_STATE_TOUCHED) {
      // we copy context to make sure child component do not modify context passed from parent.
      // we do not copy it by default until setContext function is called, because it unnecessary to waste memory if
      // child component do not modify the context.
      context = this[CONTEXT] = Object.assign({}, this[CONTEXT]);
      this[CONTEXT_STATE] = CONTEXT_STATE_TOUCHED; // has been copied.
    }
    if (!context) return;
    if (key in context) {
      // override exist may case hidden bug hard to debug.
      // so we force programmer to pass third argument to
      //   tell us he/she know what he/she is doing.
      if (!forceOverride) {
        throwErr('ctx-key-exist', key);
      }
    }
    context[key] = value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getContext<T = any>(key: string | symbol): T {
    return this[CONTEXT]?.[key as string] as T;
  }

  // /**
  //  * Get child node(or nodes) marked by 'ref:' attribute in template
  //  */
  // getRef<T extends Component | Node | (Component | Node)[] = HTMLElement>(ref: string) {
  //   if (this[STATE] !== COMPONENT_STATE_RENDERED) {
  //     import.meta.env.DEV &&
  //       console.error(
  //         `Warning: call __getRef before component '${this.constructor.name}' rendered will get nothing.`,
  //       );
  //   }
  //   return this[REFS]?.get(ref) as T;
  // }

  /**
   * lifecycle hook, called after rendered.
   */
  onMount() {
    // lifecycle hook, default do nothing.
  }

  /**
   * lifecycle hook, called before destroy.
   */
  onUnmount() {
    // lifecycle hook, default do nothing.
  }
}

///// 以下为不常用的函数，不作为 Component 的类成员函数，可以尽量减少打包产物的大小 //////

/**
 * Get first rendered DOM Node after Component is rendered.
 *
 * 按从左往右从上到下的深度遍历，找到的第一个 DOM 节点。
 */
export function getFirstDOM<T = Node>(component: Component): T {
  const el = component[ROOT_NODES][0];
  return isComponent(el) ? getFirstDOM(el) : (el as T);
}

/**
 * Get last rendered DOM Node after Component is rendered.
 *
 * 按从右往左，从上到下的深度遍历，找到的第一个 DOM 节点（相对于从左到右的顺序是最后一个 DOM 节点）。
 */
export function getLastDOM<T = Node>(component: Component): T {
  const rns = component[ROOT_NODES];
  const el = rns[rns.length - 1];
  return isComponent(el) ? getLastDOM(el) : (el as T);
}

/**
 * Render Component to HTMLElement.
 * This method is usually used to render the entire application.
 * See the `bootstrap()` function in `./bootstrap.js`.
 *
 * By default, the target element will be replaced(that means deleted).
 * But you can disable it by pass `replaceMode`=`false`,
 * which means component append to target as it's children.
 */
export function renderToDOM(component: Component, targetEl: HTMLElement, replaceMode = true) {
  if (component[STATE] !== COMPONENT_STATE_INITIALIZE) {
    throwErr('dup-render');
  }
  const rr = component.render();
  if (replaceMode) {
    replaceChildren(targetEl.parentNode as HTMLElement, rr, targetEl);
  } else {
    appendChildren(targetEl, rr);
  }
  handleRenderDone(component);
}
export function handleRenderDone(component: Component) {
  /*
   * Set NOTIFIABLE=true to enable ViewModel notify.
   * Don't forgot to add these code if you override HANDLE_AFTER_RENDER
   */

  // this[PASSED_ATTRIBUTES] && (this[PASSED_ATTRIBUTES][$$][VM_NOTIFIABLE] = true);
  component[$$][VM_NOTIFIABLE] = true;

  for (const n of component[ROOT_NODES]) {
    if (isComponent(n)) {
      handleRenderDone(n);
    }
  }
  for (const n of component[NON_ROOT_COMPONENT_NODES]) {
    handleRenderDone(n);
  }
  component[STATE] = COMPONENT_STATE_RENDERED;
  component[CONTEXT_STATE] =
    component[CONTEXT_STATE] === CONTEXT_STATE_TOUCHED
      ? CONTEXT_STATE_TOUCHED_FREEZED
      : CONTEXT_STATE_UNTOUCH_FREEZED; // has been rendered, can't modify context
  component.onMount();
}

/**
 * 销毁组件的内容，但不销毁组件本身。
 */
export function destroyComponentContent(target: Component, removeDOM = false) {
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
      ($parent as Node).removeChild(node as Node);
    }
  }
}

/**
 * 销毁组件
 */
export function destroyComponent(target: Component, removeDOM = true) {
  if (target[STATE] >= COMPONENT_STATE_WILLDESTROY) return;
  target[STATE] = COMPONENT_STATE_WILLDESTROY;
  /*
   * once component is being destroied,
   *   we mark component and it's passed-attrs un-notifiable to ignore
   *   possible messeges occurs in BEFORE_DESTROY lifecycle callback.
   */
  target[$$][VM_NOTIFIABLE] = false;
  // const passedAttrs = this[PASSED_ATTRIBUTES];
  // passedAttrs && (passedAttrs[$$][VM_NOTIFIABLE] = false);

  // notify before destroy lifecycle
  // 需要注意，必须先 NOTIFY 向外通知销毁消息，再执行 BEFORE_DESTROY 生命周期函数。
  //   因为在 BEFORE_DESTROY 里会销毁外部消息回调函数里可能会用到的属性等资源。
  // const emitter = this[EMITTER];

  // emitter.emit('beforeDestroy');
  target.onUnmount();
  // destroy children(include child component and html nodes)
  destroyComponentContent(target, removeDOM);
  // clear messenger listeners.
  // emitter?.clear();
  // passedAttrs && destroyViewModelCore(passedAttrs[$$]);

  // destroy view model
  destroyViewModelCore(target[$$]);
  // 删除关联 watchers
  target[RELATED_WATCH]?.forEach((unwatchFn) => unwatchFn());
  target[RELATED_WATCH] && (target[RELATED_WATCH].length = 0);

  // // clear next tick update setImmediate
  // target[UPDATE_NEXT_MAP]?.forEach((imm) => {
  //   clearImmediate(imm);
  // });
  // target[UPDATE_NEXT_MAP]?.clear();

  // destroy 22 refs:
  // target[RELATED_REFS]?.forEach((info) => {
  //   const refs = info[RELATED_REFS_ORIGIN][REFS];
  //   if (!refs) return;
  //   const rns = refs.get(info[RELATED_REFS_KEY]);
  //   if (isArray(rns)) {
  //     arrayRemove(rns as (Component | Node)[], info[RELATED_REFS_NODE] || target);
  //   } else {
  //     refs.delete(info[RELATED_REFS_KEY]);
  //   }
  // });
  // target[RELATED_REFS] && (target[RELATED_REFS].length = 0);

  // auto call all deregister functions
  target[UNMOUNT_FNS]?.forEach((fn) => fn());
  target[UNMOUNT_FNS] && (target[UNMOUNT_FNS].length = 0);
  target[REFS]?.forEach((ref) => {
    if (isObject<Ref>(ref)) ref.value = undefined;
    else ref(undefined);
  });
  target[REFS] && (target[REFS].length = 0);
  // clear properties
  target[STATE] = COMPONENT_STATE_DESTROIED;
  // unlink all symbol properties. maybe unnecessary.
  target[ROOT_NODES].length = 0;
  target[NON_ROOT_COMPONENT_NODES].length = 0;
  target[CONTEXT] = undefined;
}

/**
 * 给编译器使用的创建 Component 并同时设置 SLOTS 的函数
 */
export function newComponentWithSlots(
  Clazz: {
    new (attrs: object): Component;
  },
  attrs: object,
  slots: Slots,
) {
  const c = new Clazz(attrs);
  Object.assign(c[SLOTS], slots);
  return c;
}

/**
 * 给编译器使用的创建 Component 并同时设置 DEFAULT_SLOT 的函数
 */
export function newComponentWithDefaultSlot(
  Clazz: {
    new (attrs: object): Component;
  },
  attrs: object,
  defaultSlot: Slots[typeof DEFAULT_SLOT],
) {
  const c = new Clazz(attrs);
  c[SLOTS][DEFAULT_SLOT] = defaultSlot;
  return c;
}

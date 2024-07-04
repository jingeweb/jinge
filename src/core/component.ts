/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WatchHandler } from '../vm';
import { innerWatchPath, watchPath } from '../vm';
import type { AnyFn } from '../util';
import {
  isArray,
  arrayRemove,
  registerEvent,
  clearImmediate,
  setImmediate,
  appendChildren,
  replaceChildren,
  warn,
} from '../util';

import type { PropertyPathItem, ViewModel, ViewModelCore } from '../vm/core';
import {
  $$,
  VM_NOTIFIABLE,
  VM_PROXY,
  VM_TARGET,
  destroyViewModelCore,
  isPublicProperty,
} from '../vm/core';
import { proxyComponent } from '../vm/proxy';
import type { Slots } from './common';
import {
  DEFAULT_SLOT,
  RELATED_WATCH,
  DEREGISTER_FUNCTIONS,
  REFS,
  RELATED_REFS,
  RELATED_REFS_KEY,
  RELATED_REFS_NODE,
  RELATED_REFS_ORIGIN,
  UPDATE_NEXT_MAP,
  NON_ROOT_COMPONENT_NODES,
  ROOT_NODES,
  STATE,
  CONTEXT,
  CONTEXT_STATE,
  PASSED_ATTRIBUTES,
  SLOTS,
  ComponentState,
  ContextStates,
  // EMITTER,
  __,
  SET_REF,
  WATCH,
  DESTROY_CONTENT,
  DESTROY,
  RENDER_TO_DOM,
  HANDLE_RENDER_DONE,
} from './common';
// import type { EventMap, ListenerOptions } from './emitter';
// import { Emitter, LISTENERS } from './emitter';

/** Bellow is utility functions **/

export function isComponent<T extends Component>(v: unknown): v is T {
  return !!(v as Record<symbol, unknown>)[__];
}

export function assertRenderResults(renderResults?: Node[]): Node[] {
  if (!isArray(renderResults) || renderResults.length === 0) {
    throw new Error('Render results of component is empty');
  }
  return renderResults;
}

export type LifeCycleEvents = {
  afterRender: () => void;
  beforeDestroy: () => void;
};

export class Component<Props extends object = {}, Children = any> {
  /**
   * 专门用于 typescript jsx 类型校验的字段，请勿在 render() 函数之外使用。编译器会将 render() 函数里的 this.props.children 转换成 slots 传递。
   */
  get props(): {
    children: Children;
  } & Props {
    // props 专门用于 typescript 类型提示
    throw 'do not use props';
  }

  readonly [$$]: ViewModelCore;
  readonly [__] = true;
  /**
   * 将构造函数传递来的 attrs 存下来，以便可以在后期使用，以及在组件销毁时销毁该 attrs。
   * 如果传递的 attrs 不是 ViewModel，则说明没有需要监听绑定的 attribute，不保存该 attrs。
   */
  [PASSED_ATTRIBUTES]?: ViewModel;
  /**
   * 组件的上下文对象
   */
  [CONTEXT]?: Record<string | symbol, unknown>;
  [CONTEXT_STATE]: ContextStates = ContextStates.UNTOUCH;
  /**
   * 编译器传递进来的渲染函数，跟 WebComponent 里的 Slot 概念类似。
   */
  [SLOTS]: Slots;

  /**
   * 组件的状态
   */
  [STATE]: ComponentState = ComponentState.INITIALIZE;

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
  /**
   * refs contains all children with ref: attribute.
   *
   * 使用 ref: 标记的元素（Component 或 html node），会保存在 REF_NODES 中，
   *   之后通过 __getRef 函数可以获取到元素实例。
   */
  [REFS]?: Map<string, Component | Node | (Component | Node)[]>;
  /**
   * 当被 ref: 标记的元素属于 <if> 或 <for> 等组件的 slot 时，这些元素被添加到当前模板组件（称为 origin component)的 refs 里，
   *   但显然当 <if> 元素控制销毁时，也需要将这个元素从 origin component 的 refs 中删除，
   *   否则 origin component 中通过 __getRef 还能拿到这个已经被销毁的元素。
   *
   * 为了实现这个目的，会在将 ref: 标记的元素添加到模板组件 refs 中时，同时也添加到 relatedRefs 中，
   *   这样，在关联节点（比如受 <if> 控制的元素，或 <if> 下面的 DOM 节点）被销毁时，
   *   也会从模板组件的 refs 里面删除。
   */
  [RELATED_REFS]?: {
    [RELATED_REFS_ORIGIN]: Component;
    [RELATED_REFS_KEY]: string;
    [RELATED_REFS_NODE]?: Node;
  }[];

  /**
   *
   */
  [RELATED_WATCH]?: Set<AnyFn>;
  /**
   * update-next-map
   */
  [UPDATE_NEXT_MAP]?: Map<(() => void) | number, number>;
  /**
   * deregister functions
   */
  [DEREGISTER_FUNCTIONS]?: Set<() => void>;
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

  /** 给编译器使用的 watch 函数 */
  [WATCH](propPath: PropertyPathItem[], handler: WatchHandler, relatedComponent?: Component) {
    const unwatchFn = watchPath(
      this,
      (v, old, p) => {
        // console.log('onchange', v, old, p, propPath);
        handler(v, old, p);
      },
      propPath,
      true,
      true,
    );
    if (relatedComponent && relatedComponent !== this) {
      let rw = relatedComponent[RELATED_WATCH];
      if (!rw) rw = relatedComponent[RELATED_WATCH] = new Set();
      const newFn = () => {
        unwatchFn();
        rw?.delete(newFn);
      };
      rw.add(newFn);
      return newFn;
    } else {
      return unwatchFn;
    }
  }

  /**
   * 将 attrs 的属性（attrName）绑定到组件的同名属性上。调用 watch 监控 attrs[attrName]，在更新后更新同名属性并调用组件的 __updateNextTick()。
   */
  bindAttr<A extends object, P extends keyof A>(attrs: A, attrName: keyof A): A[P];
  /**
   *
   * 将 attrs 的属性（attrName）绑定到组件的 componentProp 属性上。调用 watch 监控 attrs[attrName]，在更新后更新 componentProp 属性并调用组件的 __updateNextTick()。
   */
  bindAttr<A extends object, P extends keyof A, BP extends keyof typeof this>(
    attrs: A,
    attrName: P,
    componentProp: BP,
  ): A[P];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bindAttr(attrs: ViewModel, attrName: string, componentProp?: any) {
    if (!isPublicProperty(attrName))
      throw new Error(`attrName of __bindAttr() requires public property`);
    const core = attrs[$$];
    if (!core)
      throw new Error('attrs of __bindAttr() requires view-model, use vm() to wrap object');

    const val = attrs[attrName];
    const unwatchFn = innerWatchPath(
      attrs,
      core,
      val,
      (v) => {
        this[(componentProp ?? attrName) as keyof typeof this] = v;
        this.updateNextTick();
      },
      [attrName],
    );
    this.addDeregisterFn(unwatchFn);
    return val;
  }

  /**
   * store deregisterFn and auto call it when component is being destroy.
   */
  addDeregisterFn(deregisterFn: () => void): void {
    let deregs = this[DEREGISTER_FUNCTIONS];
    if (!deregs) {
      this[DEREGISTER_FUNCTIONS] = deregs = new Set();
    }
    deregs.add(deregisterFn);
  }

  /**
   * Helper function to add dom event listener.
   * Return deregister function which will remove event listener.
   * If you do dot call deregister function, it will be auto called when component is destroied.
   * @returns {Function} deregister function to remove listener
   */
  domAddListener(
    $el: Element | Window | Document,
    eventName: string,
    listener: EventListener,
    capture?: boolean | AddEventListenerOptions,
  ) {
    const deregEvtFn = registerEvent(
      $el,
      eventName,
      ($event) => {
        // bind component to listener's function context.
        listener.call(this, $event);
      },
      capture,
    );
    this.addDeregisterFn(deregEvtFn);
    return () => {
      deregEvtFn();
      this[DEREGISTER_FUNCTIONS]?.delete(deregEvtFn);
    };
  }

  // /**
  //  * Helper function to pass all listener to target dom element.
  //  * By default target dom element is first
  //  * @param {Array} ignoredEventNames event names not passed
  //  */
  // __domPassListeners(ignoredEventNames?: string[]): void;
  // __domPassListeners(targetEl?: HTMLElement): void;
  // __domPassListeners(ignoredEventNames: string[], targetEl: HTMLElement): void;
  // __domPassListeners(ignoredEventNames?: string[] | HTMLElement, targetEl?: HTMLElement): void {
  //   if (this[STATE] !== ComponentState.RENDERED) {
  //     throw new Error('domPassListeners must be applied to component which is rendered.');
  //   }
  //   const lis = this[EMITTER][LISTENERS];
  //   if (!lis?.size) {
  //     return;
  //   }
  //   if (ignoredEventNames && !isArray(ignoredEventNames)) {
  //     targetEl = ignoredEventNames as HTMLElement;
  //     ignoredEventNames = undefined;
  //   } else if (!targetEl) {
  //     targetEl = this.__firstDOM as unknown as HTMLElement;
  //   }
  //   if (targetEl.nodeType !== Node.ELEMENT_NODE) {
  //     return;
  //   }
  //   lis.forEach((handlers, eventName) => {
  //     if (ignoredEventNames?.indexOf(eventName as string)) {
  //       return;
  //     }
  //     handlers.forEach((opts, handler) => {
  //       const deregFn = registerEvent(
  //         targetEl,
  //         eventName as string,
  //         opts && (opts.stop || opts.prevent)
  //           ? ($evt: Event): void => {
  //               opts.stop && $evt.stopPropagation();
  //               opts.prevent && $evt.preventDefault();
  //               handler.call(this, $evt);
  //             }
  //           : ($evt: Event): void => {
  //               handler.call(this, $evt);
  //             },
  //         opts,
  //       );
  //       this.__addDeregisterFn(deregFn);
  //     });
  //   });
  // }

  /**
   * Get first rendered DOM Node after Component is rendered.
   *
   * 按从左往右从上到下的深度遍历，找到的第一个 DOM 节点。
   */
  get firstDOM(): Node {
    const el = this[ROOT_NODES][0];
    return isComponent(el) ? el.firstDOM : (el as Node);
  }

  /**
   * Get last rendered DOM Node after Component is rendered.
   *
   * 按从右往左，从上到下的深度遍历，找到的第一个 DOM 节点（相对于从左到右的顺序是最后一个 DOM 节点）。
   */
  get lastDOM(): Node {
    const rns = this[ROOT_NODES];
    const el = rns[rns.length - 1];
    return isComponent(el) ? el.lastDOM : (el as Node);
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
  [RENDER_TO_DOM](targetEl: HTMLElement, replaceMode = true) {
    if (this[STATE] !== ComponentState.INITIALIZE) {
      throw new Error('component has already been rendered.');
    }
    const rr = this.render();
    if (replaceMode) {
      replaceChildren(targetEl.parentNode as HTMLElement, rr, targetEl);
    } else {
      appendChildren(targetEl, rr);
    }
    this[HANDLE_RENDER_DONE]();
  }

  [DESTROY](removeDOM = true) {
    if (this[STATE] >= ComponentState.WILLDESTROY) return;
    this[STATE] = ComponentState.WILLDESTROY;
    /*
     * once component is being destroied,
     *   we mark component and it's passed-attrs un-notifiable to ignore
     *   possible messeges occurs in BEFORE_DESTROY lifecycle callback.
     */
    this[$$][VM_NOTIFIABLE] = false;
    const passedAttrs = this[PASSED_ATTRIBUTES];
    passedAttrs && (passedAttrs[$$][VM_NOTIFIABLE] = false);

    // notify before destroy lifecycle
    // 需要注意，必须先 NOTIFY 向外通知销毁消息，再执行 BEFORE_DESTROY 生命周期函数。
    //   因为在 BEFORE_DESTROY 里会销毁外部消息回调函数里可能会用到的属性等资源。
    // const emitter = this[EMITTER];

    // emitter.emit('beforeDestroy');
    this.onBeforeDestroy();
    // destroy children(include child component and html nodes)
    this[DESTROY_CONTENT](removeDOM);
    // clear messenger listeners.
    // emitter?.clear();
    passedAttrs && destroyViewModelCore(passedAttrs[$$]);

    // destroy view model
    destroyViewModelCore(this[$$]);
    // 删除关联 watchers
    this[RELATED_WATCH]?.forEach((unwatchFn) => unwatchFn());
    this[RELATED_WATCH]?.clear();

    // clear next tick update setImmediate
    this[UPDATE_NEXT_MAP]?.forEach((imm) => {
      clearImmediate(imm);
    });
    this[UPDATE_NEXT_MAP]?.clear();

    // destroy 22 refs:
    this[RELATED_REFS]?.forEach((info) => {
      const refs = info[RELATED_REFS_ORIGIN][REFS];
      if (!refs) return;
      const rns = refs.get(info[RELATED_REFS_KEY]);
      if (isArray(rns)) {
        arrayRemove(rns as (Component | Node)[], info[RELATED_REFS_NODE] || this);
      } else {
        refs.delete(info[RELATED_REFS_KEY]);
      }
    });
    this[RELATED_REFS] && (this[RELATED_REFS].length = 0);

    // auto call all deregister functions
    this[DEREGISTER_FUNCTIONS]?.forEach((fn) => fn());
    this[DEREGISTER_FUNCTIONS]?.clear();
    this[REFS]?.clear();
    // clear properties
    this[STATE] = ComponentState.DESTROIED;
    // unlink all symbol properties. maybe unnecessary.
    this[ROOT_NODES].length = 0;
    this[NON_ROOT_COMPONENT_NODES].length = 0;
    this[CONTEXT] = undefined;
  }

  /**
   * 销毁组件的内容，但不销毁组件本身。
   */
  [DESTROY_CONTENT](removeDOM = false) {
    for (const component of this[NON_ROOT_COMPONENT_NODES]) {
      // it's not necessary to remove dom when destroy non-root component,
      // because those dom nodes will be auto removed when their parent dom is removed.
      component[DESTROY](false);
    }

    let $parent: Node | null = null;
    for (const node of this[ROOT_NODES]) {
      if (isComponent(node)) {
        node[DESTROY](removeDOM);
      } else if (removeDOM) {
        if (!$parent) {
          $parent = (node as Node).parentNode;
        }
        ($parent as Node).removeChild(node as Node);
      }
    }
  }

  /**
   *
   */
  [HANDLE_RENDER_DONE]() {
    /*
     * Set NOTIFIABLE=true to enable ViewModel notify.
     * Don't forgot to add these code if you override HANDLE_AFTER_RENDER
     */

    this[PASSED_ATTRIBUTES] && (this[PASSED_ATTRIBUTES][$$][VM_NOTIFIABLE] = true);
    this[$$][VM_NOTIFIABLE] = true;

    for (const n of this[ROOT_NODES]) {
      if (isComponent(n)) {
        n[HANDLE_RENDER_DONE]();
      }
    }
    for (const n of this[NON_ROOT_COMPONENT_NODES]) {
      n[HANDLE_RENDER_DONE]();
    }
    this[STATE] = ComponentState.RENDERED;
    this[CONTEXT_STATE] =
      this[CONTEXT_STATE] === ContextStates.TOUCHED
        ? ContextStates.TOUCHED_FREEZED
        : ContextStates.UNTOUCH_FREEZED; // has been rendered, can't modify context
    this.onAfterRender();
    // this[EMITTER].emit('afterRender');
  }

  // renderSlot<N extends keyof S>(slotName: N, ...args: Parameters<S[N]>) {
  //   const renderFn = this[SLOTS][slotName];
  //   if (!renderFn) throw new Error('slot not found');
  //   return renderFn(this);
  // }

  render(): any {
    const renderFn = this[SLOTS][DEFAULT_SLOT];
    if (!renderFn) throw new Error('render() must be overrided');
    return renderFn(this);
  }

  /**
   * 在 nextTick 时调用 update 函数。
   */
  updateNextTick(handler?: AnyFn) {
    const updateRenderFn = (this as unknown as { update: AnyFn }).update;
    if (!updateRenderFn || this[STATE] !== ComponentState.RENDERED) {
      return;
    }

    if (!handler) {
      handler = updateRenderFn;
    }

    let ntMap = this[UPDATE_NEXT_MAP];
    if (!ntMap) ntMap = this[UPDATE_NEXT_MAP] = new Map();
    if (ntMap.has(handler)) {
      // already in queue.
      return;
    }
    ntMap.set(
      handler,
      setImmediate(() => {
        type F = () => void;
        ntMap.delete(handler as F);
        (handler as F).call(this);
      }),
    );
  }

  setContext(key: string | symbol, value: unknown, forceOverride = false) {
    const contextState = this[CONTEXT_STATE];
    if (
      contextState === ContextStates.UNTOUCH_FREEZED ||
      contextState === ContextStates.TOUCHED_FREEZED
    ) {
      throw new Error(
        "Can't setContext after component has been rendered. Try put setContext code into constructor.",
      );
    }
    let context = this[CONTEXT];
    if (contextState === ContextStates.UNTOUCH) {
      // we copy context to make sure child component do not modify context passed from parent.
      // we do not copy it by default until setContext function is called, because it unnecessary to waste memory if
      // child component do not modify the context.
      context = this[CONTEXT] = Object.assign({}, this[CONTEXT]);
      this[CONTEXT_STATE] = ContextStates.TOUCHED; // has been copied.
    }
    if (!context) return;
    if (key in context) {
      // override exist may case hidden bug hard to debug.
      // so we force programmer to pass third argument to
      //   tell us he/she know what he/she is doing.
      if (!forceOverride) {
        throw new Error(
          `Contenxt with key: ${key.toString()} is exist. Pass third argument forceOverride=true to override it.`,
        );
      }
    }
    context[key] = value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getContext<T = any>(key: string | symbol): T {
    return this[CONTEXT]?.[key as string] as T;
  }

  /**
   * This method is used for compiler generated code.
   * Do not use it manually.
   */
  [SET_REF](ref: string, el: Component | Node, relatedComponent?: Component) {
    let rns = this[REFS];
    if (!rns) {
      this[REFS] = rns = new Map();
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
    if (!isComp && this === relatedComponent) {
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
      [RELATED_REFS_ORIGIN]: this,
      [RELATED_REFS_KEY]: ref,
      [RELATED_REFS_NODE]: isComp ? undefined : (el as Node),
    });
  }

  /**
   * Get child node(or nodes) marked by 'ref:' attribute in template
   */
  getRef<T extends Component | Node | (Component | Node)[] = HTMLElement>(ref: string) {
    if (this[STATE] !== ComponentState.RENDERED) {
      warn(
        `Warning: call __getRef before component '${this.constructor.name}' rendered will get nothing.`,
      );
    }
    return this[REFS]?.get(ref) as T;
  }

  // __on<E extends keyof (Events & LifeCycleEvents)>(
  //   eventName: E,
  //   handler: (Events & LifeCycleEvents)[E],
  //   options?: ListenerOptions,
  // ) {
  //   return this[EMITTER].on(eventName as string, handler, options);
  // }

  // __emit<E extends keyof Events>(eventName: E, ...args: Parameters<Events[E]>) {
  //   this[EMITTER].emit(eventName as string, ...args);
  // }

  /**
   * lifecycle hook, called after rendered.
   */
  onAfterRender() {
    // lifecycle hook, default do nothing.
  }

  /**
   * lifecycle hook, called before destroy.
   */
  onBeforeDestroy() {
    // lifecycle hook, default do nothing.
  }
}

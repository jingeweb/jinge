import { watch } from 'src/vm_v2';
import type { AnyFn, CLASSNAME } from '../util';
import {
  isArray,
  arrayRemove,
  registerEvent,
  isFunction,
  clearImmediate,
  setImmediate,
  appendChildren,
  replaceChildren,
  warn,
} from '../util';

import type { ViewModel, ViewModelCore } from '../vm_v2/core';
import {
  $$,
  NOTIFIABLE,
  PROXY,
  destroyViewModelCore,
  isPublicProperty,
  isViewModel,
} from '../vm_v2/core';
import { proxyComponent } from '../vm_v2/proxy';
import type { CompilerAttrs } from './attribute';
import type { RenderFn } from './common';
import {
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
  EMITTER,
  __,
} from './common';
import type { EventMap, ListenerOptions } from './emitter';
import { Emitter, LISTENERS } from './emitter';

export interface ComponentInnerProperties {
  /**
   * 将构造函数传递来的 attrs 存下来，以便可以在后期使用，以及在组件销毁时销毁该 attrs。
   * 如果传递的 attrs 不是 ViewModel，则说明没有需要监听绑定的 attribute，不保存该 attrs。
   */
  [PASSED_ATTRIBUTES]?: ViewModel;
  /**
   * 组件的上下文对象
   */
  [CONTEXT]?: Record<string | symbol, unknown>;
  [CONTEXT_STATE]: ContextStates;
  /**
   * 编译器传递进来的渲染函数，跟 WebComponent 里的 Slot 概念类似。
   */
  [SLOTS]?: Record<string, RenderFn> & {
    default?: RenderFn;
  };
  /**
   * 组件的状态
   */
  [STATE]: ComponentState;
  /**
   * ROOT_NODES means root children of this component,
   *   include html-nodes and component-nodes.
   * We use this infomation to remove DOM after this component is destroied.
   * We do not maintain the whole parent-child view-tree but only root children,
   * because when we remove the root children, whole view-tree will be
   * removed, so we do not need waste memory to maintain whole view-tree.
   */
  [ROOT_NODES]: (Component | Node)[];
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
  [NON_ROOT_COMPONENT_NODES]: Component[];
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
   * update-next-map
   */
  [UPDATE_NEXT_MAP]?: Map<(() => void) | number, number>;
  /**
   * deregister functions
   */
  [DEREGISTER_FUNCTIONS]?: Set<() => void>;
}

/** Bellow is utility functions **/

export function isComponent<T extends Component>(v: unknown): v is T {
  return !!(v as Record<symbol, unknown>)[__];
}

export function assertRenderResults(renderResults: Node[]): Node[] {
  if (!isArray(renderResults) || renderResults.length === 0) {
    throw new Error('Render results of component is empty');
  }
  return renderResults;
}

export type LifeCycleEvents = {
  afterRender: () => void;
  beforeDestroy: () => void;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export class Component<Events extends EventMap = {}> {
  /**
   * 指定组件的渲染模板。
   */
  static readonly template: string;

  /**
   * 某些情况下，需要判断一个函数是否是组件的构造函数。添加一个静态成员属性符号用于进行该判断。
   * isComponent 函数既可以判断是否是构造函数（配合 isFunction），又可以判断一个对像是否是组件实例。
   *
   * 示例：
   *
   * ````js
   * import { isComponent, Component } from 'jinge';
   *
   * class A {};
   * class B extends Component {};
   * console.log(isComponent(A)); // false
   * console.log(isComponent(B)); // true
   * ````
   */
  static readonly [__] = true;

  /* 使用 symbol 来定义属性，避免业务层无意覆盖了支撑 jinge 框架逻辑的属性带来坑 */
  [__]: ComponentInnerProperties;
  [$$]: ViewModelCore;
  [EMITTER]: Emitter<EventMap>;

  /* 预定义好的常用的传递样式控制的属性 */
  class?: CLASSNAME;
  style?: string | Record<string, string | number>;

  /**
   * ATTENTION!!!
   *
   * Don't use constructor directly, use static factory method `create(attrs)` instead.
   */
  constructor(attrs: object) {
    const isVmAttrs = isViewModel(attrs);
    const compilerAttrs = (attrs as { [__]?: CompilerAttrs })[__];
    this[$$] = proxyComponent(this);
    this[EMITTER] = new Emitter();
    this[__] = {
      [PASSED_ATTRIBUTES]: isVmAttrs ? attrs : undefined,
      [CONTEXT]: compilerAttrs?.[CONTEXT],
      [CONTEXT_STATE]: ContextStates.UNTOUCH,
      [SLOTS]: compilerAttrs?.[SLOTS],
      [STATE]: ComponentState.INITIALIZE,
      [ROOT_NODES]: [],
      [NON_ROOT_COMPONENT_NODES]: [],
    };

    /** class 和 style 两个最常用的属性，默认从 attributes 中取出并监听。 */
    ['class', 'style'].forEach((p) => {
      if (!(p in attrs)) return;
      if (!isVmAttrs) throw new Error('attrs must be ViewModel');
      this.__bindAttr(attrs, p);
    });

    return this[$$][PROXY] as typeof this;
  }

  /**
   * 将 attrs 的属性（attrName）绑定到组件的（componentProp）属性上，即调用 watch 进行监控和更新并在更新后调用组件的 __updateNextTick()。
   * 如果不传递 componentProp 参数，则 componentProp 和 attrName 同名。
   */
  __bindAttr<A extends object, P extends keyof typeof this>(
    attrs: A,
    attrName: keyof A,
    componentProp?: P,
  ) {
    if (!isPublicProperty(attrName))
      throw new Error(`attrName of __bindAttr() requires public property`);
    this.__addDeregisterFn(
      watch(
        attrs,
        attrName,
        (v) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this[componentProp ?? (attrName as unknown as P)] = v as any;
          this.__updateNextTick();
        },
        { immediate: true },
      ),
    );
  }

  /**
   * store deregisterFn and auto call it when component is being destroy.
   */
  __addDeregisterFn(deregisterFn: () => void): void {
    let deregs = this[__][DEREGISTER_FUNCTIONS];
    if (!deregs) {
      this[__][DEREGISTER_FUNCTIONS] = deregs = new Set();
    }
    deregs.add(deregisterFn);
  }

  /**
   * Helper function to add dom event listener.
   * Return deregister function which will remove event listener.
   * If you do dot call deregister function, it will be auto called when component is destroied.
   * @returns {Function} deregister function to remove listener
   */
  __domAddListener(
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
    this.__addDeregisterFn(deregEvtFn);
    return () => {
      deregEvtFn();
      this[__][DEREGISTER_FUNCTIONS]?.delete(deregEvtFn);
    };
  }

  /**
   * Helper function to pass all listener to target dom element.
   * By default target dom element is first
   * @param {Array} ignoredEventNames event names not passed
   */
  __domPassListeners(ignoredEventNames?: string[]): void;
  __domPassListeners(targetEl?: HTMLElement): void;
  __domPassListeners(ignoredEventNames: string[], targetEl: HTMLElement): void;
  __domPassListeners(ignoredEventNames?: string[] | HTMLElement, targetEl?: HTMLElement): void {
    if (this[__][STATE] !== ComponentState.RENDERED) {
      throw new Error('domPassListeners must be applied to component which is rendered.');
    }
    const lis = this[EMITTER][LISTENERS];
    if (!lis?.size) {
      return;
    }
    if (ignoredEventNames && !isArray(ignoredEventNames)) {
      targetEl = ignoredEventNames as HTMLElement;
      ignoredEventNames = undefined;
    } else if (!targetEl) {
      targetEl = this.__firstDOM as unknown as HTMLElement;
    }
    if (targetEl.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    lis.forEach((handlers, eventName) => {
      if (ignoredEventNames?.indexOf(eventName as string)) {
        return;
      }
      handlers.forEach((opts, handler) => {
        const deregFn = registerEvent(
          targetEl,
          eventName as string,
          opts && (opts.stop || opts.prevent)
            ? ($evt: Event): void => {
                opts.stop && $evt.stopPropagation();
                opts.prevent && $evt.preventDefault();
                handler.call(this, $evt);
              }
            : ($evt: Event): void => {
                handler.call(this, $evt);
              },
          opts,
        );
        this.__addDeregisterFn(deregFn);
      });
    });
  }

  /**
   * Get first rendered DOM Node after Component is rendered.
   *
   * 按从左往右从上到下的深度遍历，找到的第一个 DOM 节点。
   */
  get __firstDOM(): Node {
    const el = this[__][ROOT_NODES][0];
    return isComponent(el) ? el.__firstDOM : (el as Node);
  }

  /**
   * Get last rendered DOM Node after Component is rendered.
   *
   * 按从右往左，从上到下的深度遍历，找到的第一个 DOM 节点（相对于从左到右的顺序是最后一个 DOM 节点）。
   */
  get __lastDOM(): Node {
    const rns = this[__][ROOT_NODES];
    const el = rns[rns.length - 1];
    return isComponent(el) ? el.__lastDOM : (el as Node);
  }

  /**
   * 组件的实际渲染函数，渲染模板或默认插槽。
   * 该函数可被子组件重载，进而覆盖渲染逻辑。
   * 该函数可以是同步或异步函数，但通常推荐使用同步函数，将异步初始化逻辑放到 __beforeRender 生命周期函数中。
   */
  __render(): Node[] {
    let renderFn = (this.constructor as unknown as { template?: RenderFn }).template; // 编译器已经将 string 转成了 RenderFn，此处强制转换类型以绕开 typescript.
    if (!renderFn && this[__][SLOTS]) {
      renderFn = this[__][SLOTS].default;
    }
    if (!isFunction(renderFn)) {
      throw new Error(
        `Template of ${this.constructor.name} not found. Forget static getter "template"?`,
      );
    }
    return assertRenderResults(renderFn(this));
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
  __renderToDOM(targetEl: HTMLElement, replaceMode = true) {
    if (this[__][STATE] !== ComponentState.INITIALIZE) {
      throw new Error('component has already been rendered.');
    }
    const rr = assertRenderResults(this.__render());
    if (replaceMode) {
      replaceChildren(targetEl.parentNode as HTMLElement, rr, targetEl);
    } else {
      appendChildren(targetEl, rr);
    }
    this.__handleAfterRender();
  }

  __destroy(removeDOM = true) {
    const comp = this[__];
    if (comp[STATE] >= ComponentState.WILLDESTROY) return;
    comp[STATE] = ComponentState.WILLDESTROY;
    /*
     * once component is being destroied,
     *   we mark component and it's passed-attrs un-notifiable to ignore
     *   possible messeges occurs in BEFORE_DESTROY lifecycle callback.
     */
    this[$$][NOTIFIABLE] = false;
    const passedAttrs = comp[PASSED_ATTRIBUTES];
    passedAttrs && (passedAttrs[$$][NOTIFIABLE] = false);

    // notify before destroy lifecycle
    // 需要注意，必须先 NOTIFY 向外通知销毁消息，再执行 BEFORE_DESTROY 生命周期函数。
    //   因为在 BEFORE_DESTROY 里会销毁外部消息回调函数里可能会用到的属性等资源。
    const emitter = this[EMITTER];

    emitter.emit('beforeDestroy');
    this.__beforeDestroy();
    // destroy children(include child component and html nodes)
    this.__destroyContent(removeDOM);
    // clear messenger listeners.
    emitter?.clear();
    passedAttrs && destroyViewModelCore(passedAttrs[$$]);

    // destroy view model
    destroyViewModelCore(this[$$]);

    // clear next tick update setImmediate
    comp[UPDATE_NEXT_MAP]?.forEach((imm) => {
      clearImmediate(imm);
    });
    comp[UPDATE_NEXT_MAP]?.clear();

    // destroy 22 refs:
    comp[RELATED_REFS]?.forEach((info) => {
      const refs = info[RELATED_REFS_ORIGIN][__][REFS];
      if (!refs) return;
      const rns = refs.get(info[RELATED_REFS_KEY]);
      if (isArray(rns)) {
        arrayRemove(rns as (Component | Node)[], info[RELATED_REFS_NODE] || this);
      } else {
        refs.delete(info[RELATED_REFS_KEY]);
      }
    });
    comp[RELATED_REFS] && (comp[RELATED_REFS].length = 0);

    // auto call all deregister functions
    comp[DEREGISTER_FUNCTIONS]?.forEach((fn) => fn());
    comp[DEREGISTER_FUNCTIONS]?.clear();

    // clear properties
    comp[STATE] = ComponentState.DESTROIED;
    // unlink all symbol properties. maybe unnecessary.
    comp[ROOT_NODES].length = 0;
    comp[NON_ROOT_COMPONENT_NODES].length = 0;
    comp[REFS]?.clear();
    comp[CONTEXT] = undefined;
  }

  /**
   * 销毁组件的内容，但不销毁组件本身。
   */
  __destroyContent(removeDOM = false) {
    for (const component of this[__][NON_ROOT_COMPONENT_NODES]) {
      // it's not necessary to remove dom when destroy non-root component,
      // because those dom nodes will be auto removed when their parent dom is removed.
      component.__destroy(false);
    }

    let $parent: Node | null = null;
    for (const node of this[__][ROOT_NODES]) {
      if (isComponent(node)) {
        node.__destroy(removeDOM);
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
  __handleAfterRender() {
    /*
     * Set NOTIFIABLE=true to enable ViewModel notify.
     * Don't forgot to add these code if you override HANDLE_AFTER_RENDER
     */
    const comp = this[__];
    comp[PASSED_ATTRIBUTES] && (comp[PASSED_ATTRIBUTES][$$][NOTIFIABLE] = true);
    this[$$][NOTIFIABLE] = true;

    for (const n of comp[ROOT_NODES]) {
      if (isComponent(n)) {
        n.__handleAfterRender();
      }
    }
    for (const n of comp[NON_ROOT_COMPONENT_NODES]) {
      n.__handleAfterRender();
    }
    comp[STATE] = ComponentState.RENDERED;
    comp[CONTEXT_STATE] =
      comp[CONTEXT_STATE] === ContextStates.TOUCHED
        ? ContextStates.TOUCHED_FREEZED
        : ContextStates.UNTOUCH_FREEZED; // has been rendered, can't modify context
    this.__afterRender();
    this[EMITTER].emit('afterRender');
  }

  /**
   * 在 nextTick 时调用 __update 函数。
   */
  __updateNextTick(handler?: AnyFn) {
    const updateRenderFn = (this as unknown as { __update: AnyFn }).__update;
    if (!updateRenderFn || this[__][STATE] !== ComponentState.RENDERED) {
      return;
    }

    if (!handler) {
      handler = updateRenderFn;
    }

    let ntMap = this[__][UPDATE_NEXT_MAP];
    if (!ntMap) ntMap = this[__][UPDATE_NEXT_MAP] = new Map();
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

  __setContext(key: string | symbol, value: unknown, forceOverride = false) {
    const comp = this[__];
    const contextState = comp[CONTEXT_STATE];
    if (
      contextState === ContextStates.UNTOUCH_FREEZED ||
      contextState === ContextStates.TOUCHED_FREEZED
    ) {
      throw new Error(
        "Can't setContext after component has been rendered. Try put setContext code into constructor.",
      );
    }
    let context = comp[CONTEXT];
    if (contextState === ContextStates.UNTOUCH) {
      // we copy context to make sure child component do not modify context passed from parent.
      // we do not copy it by default until setContext function is called, because it unnecessary to waste memory if
      // child component do not modify the context.
      context = comp[CONTEXT] = Object.assign({}, comp[CONTEXT]);
      comp[CONTEXT_STATE] = ContextStates.TOUCHED; // has been copied.
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
  __getContext<T = any>(key: string | symbol): T {
    return this[__][CONTEXT]?.[key as string] as T;
  }

  /**
   * This method is used for compiler generated code.
   * Do not use it manually.
   */
  __setRef(ref: string, el: Component | Node, relatedComponent?: Component) {
    let rns = this[__][REFS];
    if (!rns) {
      this[__][REFS] = rns = new Map();
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
    let rbs = ((isComp ? el : relatedComponent) as Component)[__][RELATED_REFS];
    if (!rbs) {
      ((isComp ? el : relatedComponent) as Component)[__][RELATED_REFS] = rbs = [];
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
  __getRef<T extends Component | Node | (Component | Node)[] = HTMLElement>(ref: string) {
    if (this[__][STATE] !== ComponentState.RENDERED) {
      warn(
        `Warning: call __getRef before component '${this.constructor.name}' rendered will get nothing.`,
      );
    }
    return this[__][REFS]?.get(ref) as T;
  }

  __on<E extends keyof (Events & LifeCycleEvents)>(
    eventName: E,
    handler: (Events & LifeCycleEvents)[E],
    options?: ListenerOptions,
  ) {
    return this[EMITTER].on(eventName as string, handler, options);
  }

  __emit<E extends keyof Events>(eventName: E, ...args: Parameters<Events[E]>) {
    this[EMITTER].emit(eventName as string, ...args);
  }

  /**
   * lifecycle hook, called after rendered.
   */
  __afterRender() {
    // lifecycle hook, default do nothing.
  }

  /**
   * lifecycle hook, called before destroy.
   */
  __beforeDestroy() {
    // lifecycle hook, default do nothing.
  }
}
